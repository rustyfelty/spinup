import { FastifyInstance } from 'fastify';
import { prisma } from '../services/prisma';
import { discordOAuth } from '../services/discord-oauth';
import { oauthSessionManager } from '../services/oauth-session-manager';
import { randomBytes } from 'crypto';
import axios from 'axios';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// In-memory store for OAuth states (CSRF protection only)
const oauthStates = new Map<string, { expiresAt: number }>();

interface SetupStatusResponse {
  isComplete: boolean;
  currentStep: string;
  steps: {
    systemConfigured: boolean;
    discordConfigured: boolean;
    guildSelected: boolean;
    rolesConfigured: boolean;
  };
  selectedGuildId?: string;
  installerUserId?: string;
}

interface DiscordBotValidationRequest {
  token: string;
}

interface DiscordBotTestResponse {
  valid: boolean;
  botUser?: {
    id: string;
    username: string;
    discriminator: string;
  };
  error?: string;
}

export default async function setupRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/setup/status
   * Returns current setup state and next step
   */
  fastify.get<{
    Reply: SetupStatusResponse;
  }>('/status', async (request, reply) => {
    try {
      // Get or create setup state
      let setupState = await prisma.setupState.findUnique({
        where: { id: 'singleton' }
      });

      if (!setupState) {
        setupState = await prisma.setupState.create({
          data: { id: 'singleton' }
        });
      }

      // Determine current step
      let currentStep = 'welcome';
      if (!setupState.systemConfigured) {
        currentStep = 'system';
      } else if (!setupState.discordConfigured) {
        currentStep = 'discord';
      } else if (!setupState.guildSelected) {
        currentStep = 'guild-select';
      } else if (!setupState.rolesConfigured) {
        currentStep = 'roles';
      } else {
        currentStep = 'complete';
      }

      const isComplete = setupState.systemConfigured &&
        setupState.discordConfigured &&
        setupState.guildSelected &&
        setupState.rolesConfigured;

      return reply.status(200).send({
        isComplete,
        currentStep,
        steps: {
          systemConfigured: setupState.systemConfigured,
          discordConfigured: setupState.discordConfigured,
          guildSelected: setupState.guildSelected,
          rolesConfigured: setupState.rolesConfigured
        },
        selectedGuildId: setupState.selectedGuildId || undefined,
        installerUserId: setupState.installerUserId || undefined
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get setup status'
      } as any);
    }
  });

  /**
   * POST /api/setup/discord/validate
   * Validates Discord bot token
   */
  fastify.post<{
    Body: DiscordBotValidationRequest;
    Reply: DiscordBotTestResponse;
  }>('/discord/validate', async (request, reply) => {
    const { token } = request.body;

    if (!token || token.trim().length === 0) {
      return reply.status(400).send({
        valid: false,
        error: 'Discord bot token is required'
      });
    }

    try {
      // Test token by getting bot user info
      const response = await axios.get('https://discord.com/api/v10/users/@me', {
        headers: {
          Authorization: `Bot ${token}`
        }
      });

      const botUser = response.data;

      // Verify it's a bot account
      if (!botUser.bot) {
        return reply.status(400).send({
          valid: false,
          error: 'Token belongs to a user account, not a bot'
        });
      }

      return reply.status(200).send({
        valid: true,
        botUser: {
          id: botUser.id,
          username: botUser.username,
          discriminator: botUser.discriminator
        }
      });
    } catch (error: any) {
      fastify.log.error(error);

      if (error.response?.status === 401) {
        return reply.status(401).send({
          valid: false,
          error: 'Invalid bot token'
        });
      }

      return reply.status(500).send({
        valid: false,
        error: error.response?.data?.message || 'Failed to validate Discord bot token'
      });
    }
  });

  /**
   * POST /api/setup/discord/test
   * Tests Discord bot connection and permissions
   */
  fastify.post<{
    Body: DiscordBotValidationRequest;
    Reply: DiscordBotTestResponse & { guilds?: number };
  }>('/discord/test', async (request, reply) => {
    const { token } = request.body;

    if (!token || token.trim().length === 0) {
      return reply.status(400).send({
        valid: false,
        error: 'Discord bot token is required'
      });
    }

    try {
      // Get bot user info
      const userResponse = await axios.get('https://discord.com/api/v10/users/@me', {
        headers: {
          Authorization: `Bot ${token}`
        }
      });

      const botUser = userResponse.data;

      if (!botUser.bot) {
        return reply.status(400).send({
          valid: false,
          error: 'Token belongs to a user account, not a bot'
        });
      }

      // Get guilds the bot is in
      const guildsResponse = await axios.get('https://discord.com/api/v10/users/@me/guilds', {
        headers: {
          Authorization: `Bot ${token}`
        }
      });

      const guilds = guildsResponse.data;

      return reply.status(200).send({
        valid: true,
        botUser: {
          id: botUser.id,
          username: botUser.username,
          discriminator: botUser.discriminator
        },
        guilds: guilds.length
      });
    } catch (error: any) {
      fastify.log.error(error);

      if (error.response?.status === 401) {
        return reply.status(401).send({
          valid: false,
          error: 'Invalid bot token'
        });
      }

      return reply.status(500).send({
        valid: false,
        error: error.response?.data?.message || 'Failed to test Discord bot connection'
      });
    }
  });

  /**
   * POST /api/setup/system/configure
   * Configure system settings (domains, secrets)
   */
  fastify.post<{
    Body: {
      webDomain: string;
      apiDomain: string;
    };
  }>('/system/configure', async (request, reply) => {
    const { webDomain, apiDomain } = request.body;

    if (!webDomain || !apiDomain) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'webDomain and apiDomain are required'
      });
    }

    try {
      // Update or create settings
      await prisma.settings.upsert({
        where: { id: 'global' },
        create: {
          id: 'global',
          webDomain,
          apiDomain
        },
        update: {
          webDomain,
          apiDomain
        }
      });

      // Mark system as configured
      await prisma.setupState.upsert({
        where: { id: 'singleton' },
        create: {
          id: 'singleton',
          systemConfigured: true
        },
        update: {
          systemConfigured: true
        }
      });

      return reply.status(200).send({
        success: true,
        message: 'System configured successfully'
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to configure system settings'
      });
    }
  });

  /**
   * POST /api/setup/discord/configure
   * Save Discord bot token to .env
   */
  fastify.post<{
    Body: {
      botToken: string;
      clientId: string;
      clientSecret: string;
    };
  }>('/discord/configure', async (request, reply) => {
    const { botToken, clientId, clientSecret } = request.body;

    if (!botToken || !clientId || !clientSecret) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'botToken, clientId, and clientSecret are required'
      });
    }

    try {
      // Validate token first
      const userResponse = await axios.get('https://discord.com/api/v10/users/@me', {
        headers: {
          Authorization: `Bot ${botToken}`
        }
      });

      if (!userResponse.data.bot) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid bot token'
        });
      }

      // Write to .env file
      const envPath = join(process.cwd(), '../../.env');
      let envContent = readFileSync(envPath, 'utf-8');

      // Update or add Discord credentials
      const updates = {
        'DISCORD_BOT_TOKEN': botToken,
        'DISCORD_CLIENT_ID': clientId,
        'DISCORD_CLIENT_SECRET': clientSecret,
        'DISCORD_REDIRECT_URI': `${process.env.WEB_ORIGIN || 'http://localhost:5173'}/setup-wizard`
      };

      for (const [key, value] of Object.entries(updates)) {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${key}=${value}`);
        } else {
          envContent += `\n${key}=${value}`;
        }
      }

      writeFileSync(envPath, envContent, 'utf-8');

      // Update process.env for immediate use (for current process only)
      process.env.DISCORD_BOT_TOKEN = botToken;
      process.env.DISCORD_CLIENT_ID = clientId;
      process.env.DISCORD_CLIENT_SECRET = clientSecret;
      process.env.DISCORD_REDIRECT_URI = updates.DISCORD_REDIRECT_URI;

      fastify.log.info('Discord credentials saved to .env');

      // Mark Discord bot as configured (keeping discordConfigured for backwards compatibility)
      await prisma.setupState.upsert({
        where: { id: 'singleton' },
        create: {
          id: 'singleton',
          discordConfigured: true,
          botConfigured: true
        },
        update: {
          discordConfigured: true,
          botConfigured: true
        }
      });

      return reply.status(200).send({
        success: true,
        message: 'Discord bot configured successfully'
      });
    } catch (error: any) {
      fastify.log.error(error);

      if (error.response?.status === 401) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid bot token'
        });
      }

      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to configure Discord bot'
      });
    }
  });

  /**
   * GET /api/setup/discord/auth-url
   * Generate Discord OAuth URL for user login
   */
  fastify.get('/discord/auth-url', async (request, reply) => {
    try {
      const state = randomBytes(32).toString('hex');
      const { url } = discordOAuth.generateAuthUrl(state);

      // Store state with 2 minute expiry
      oauthStates.set(state, {
        expiresAt: Date.now() + 2 * 60 * 1000
      });

      // Clean up expired states
      for (const [key, value] of oauthStates.entries()) {
        if (value.expiresAt < Date.now()) {
          oauthStates.delete(key);
        }
      }

      return reply.status(200).send({ url, state });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to generate OAuth URL'
      });
    }
  });

  /**
   * GET /api/setup/discord/callback
   * Handle Discord OAuth callback
   */
  fastify.get<{
    Querystring: {
      code: string;
      state: string;
      guild_id?: string;
    };
  }>('/discord/callback', async (request, reply) => {
    const { code, state, guild_id } = request.query;

    if (!code || !state) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Missing code or state parameter'
      });
    }

    // Validate state
    const stateData = oauthStates.get(state);
    if (!stateData) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid or expired state token'
      });
    }

    if (stateData.expiresAt < Date.now()) {
      oauthStates.delete(state);
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'State token expired'
      });
    }

    try {
      // Exchange code for access token
      const tokenData = await discordOAuth.exchangeCode(code);

      // Get user info
      const user = await discordOAuth.getUser(tokenData.access_token);

      // Create session using session manager
      const session = await oauthSessionManager.createSession({
        userId: user.id,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in
      });
      console.log('[DEBUG] Created session with token:', session.sessionToken);

      // Mark OAuth as configured in SetupState
      // If guild_id was provided (from bot authorization), also mark guild as selected
      const updateData: any = {
        oauthConfigured: true
      };

      if (guild_id) {
        updateData.guildSelected = true;
        updateData.selectedGuildId = guild_id;
        updateData.installerDiscordId = user.id;
      }

      await prisma.setupState.upsert({
        where: { id: 'singleton' },
        create: {
          id: 'singleton',
          ...updateData
        },
        update: updateData
      });

      // Clean up OAuth state
      oauthStates.delete(state);

      return reply.status(200).send({
        success: true,
        sessionToken: session.sessionToken,
        guildId: guild_id || null,
        user: {
          id: user.id,
          username: user.username,
          discriminator: user.discriminator,
          avatar: user.avatar
        }
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: error.message || 'Failed to complete OAuth flow'
      });
    }
  });

  /**
   * POST /api/setup/discord/guilds
   * Get user's guilds (where they are owner/admin)
   */
  fastify.post<{
    Body: {
      sessionToken: string;
    };
  }>('/discord/guilds', async (request, reply) => {
    const { sessionToken } = request.body;

    if (!sessionToken) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Session token is required'
      });
    }

    // Get session from session manager
    const session = await oauthSessionManager.getSession(sessionToken);
    if (!session) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or expired session token'
      });
    }

    try {
      // Fetch user's guilds from Discord using OAuth access token
      const guilds = await discordOAuth.getUserGuilds(session.accessToken, true);

      return reply.status(200).send({
        success: true,
        guilds
      });
    } catch (error: any) {
      fastify.log.error(error);

      // Handle rate limiting with retry-after
      if (error.statusCode === 429) {
        return reply.status(429).send({
          error: 'Rate Limited',
          message: error.message,
          retryAfter: error.retryAfter
        });
      }

      return reply.status(500).send({
        error: 'Internal Server Error',
        message: error.message || 'Failed to fetch guilds'
      });
    }
  });

  /**
   * POST /api/setup/select-guild
   * Select a Discord guild for the organization
   */
  fastify.post<{
    Body: {
      guildId: string;
      installerDiscordId: string;
    };
  }>('/select-guild', async (request, reply) => {
    const { guildId, installerDiscordId } = request.body;

    // Validate required fields
    if (!guildId || !installerDiscordId) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'guildId and installerDiscordId are required'
      });
    }

    // Validate empty strings
    if (typeof guildId !== 'string' || guildId.trim() === '') {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'guildId must be a non-empty string'
      });
    }

    if (typeof installerDiscordId !== 'string' || installerDiscordId.trim() === '') {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'installerDiscordId must be a non-empty string'
      });
    }

    // Validate snowflake format (Discord IDs are 17-20 digit numbers)
    const snowflakeRegex = /^\d{17,20}$/;
    if (!snowflakeRegex.test(guildId)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'guildId must be a valid Discord snowflake ID (17-20 digits)'
      });
    }

    if (!snowflakeRegex.test(installerDiscordId)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'installerDiscordId must be a valid Discord snowflake ID (17-20 digits)'
      });
    }

    try {
      // Check if OAuth is configured
      const setupState = await prisma.setupState.findUnique({
        where: { id: 'singleton' }
      });

      if (!setupState?.oauthConfigured) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'OAuth is not configured. Please complete OAuth setup first.'
        });
      }

      // Update setup state (no bot validation required for OAuth-only flow)
      const updatedSetupState = await prisma.setupState.upsert({
        where: { id: 'singleton' },
        create: {
          id: 'singleton',
          guildSelected: true,
          selectedGuildId: guildId,
          installerDiscordId
        },
        update: {
          guildSelected: true,
          selectedGuildId: guildId,
          installerDiscordId
        }
      });

      return reply.status(200).send({
        message: 'Guild selected successfully',
        setupState: updatedSetupState
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: error.message || 'Failed to select guild'
      });
    }
  });

  /**
   * GET /api/setup-v2/guild/:guildId/roles
   * Get roles for a selected guild using OAuth access token
   * Requires: Authorization: Bearer <sessionToken> header
   */
  fastify.get<{
    Params: {
      guildId: string;
    };
  }>('/guild/:guildId/roles', async (request, reply) => {
    const { guildId } = request.params;
    const authHeader = request.headers.authorization;

    // Validate Authorization header
    if (!authHeader) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authorization header is required'
      });
    }

    if (!authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authorization header must use Bearer token format'
      });
    }

    const sessionToken = authHeader.substring(7).trim();
    if (!sessionToken) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Bearer token cannot be empty'
      });
    }

    // Validate guildId format
    const snowflakeRegex = /^\d{17,20}$/;
    if (!snowflakeRegex.test(guildId)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'guildId must be a valid Discord snowflake ID (17-20 digits)'
      });
    }

    try {
      // Verify OAuth session exists
      console.log('[DEBUG] Looking for session token:', sessionToken);
      const session = await oauthSessionManager.getSession(sessionToken);
      console.log('[DEBUG] Session found:', session ? 'YES' : 'NO');
      if (!session) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid or expired session token. Please re-authenticate.'
        });
      }

      // Check if OAuth is configured
      const setupState = await prisma.setupState.findUnique({
        where: { id: 'singleton' }
      });

      if (!setupState?.oauthConfigured) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'OAuth is not configured. Please complete OAuth setup first.'
        });
      }

      // Fetch user's roles in the guild using OAuth
      const roles = await discordOAuth.getGuildRolesWithOAuth(guildId, session.accessToken);

      // Fetch guild info to get the guild name
      const guilds = await discordOAuth.getUserGuilds(session.accessToken);
      const guild = guilds.find(g => g.id === guildId);

      // Filter out @everyone role and managed roles
      const selectableRoles = roles.filter(role =>
        role.name !== '@everyone' && !role.managed
      );

      return reply.status(200).send({
        source: 'oauth',
        guildName: guild?.name || '',
        roles: selectableRoles.map(role => ({
          id: role.id,
          name: role.name,
          color: role.color,
          position: role.position
        }))
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: error.message || 'Failed to fetch guild roles'
      });
    }
  });

  /**
   * POST /api/setup/configure-roles
   * Configure role permissions (capability-based)
   */
  fastify.post<{
    Body: {
      guildId: string;
      rolePermissions: Array<{
        discordRoleId: string;
        discordRoleName: string;
        discordRoleColor: number;
        permissions: Record<string, boolean>;
      }>;
    };
  }>('/configure-roles', async (request, reply) => {
    const { guildId, rolePermissions } = request.body;

    if (!guildId) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'guildId is required'
      });
    }

    try {
      const botToken = process.env.DISCORD_BOT_TOKEN || '';

      // Validate all role IDs exist in the guild
      const guildRoles = await discordOAuth.getGuildRoles(guildId, botToken);
      const validRoleIds = new Set(guildRoles.map(r => r.id));

      for (const rolePermission of rolePermissions) {
        if (!validRoleIds.has(rolePermission.discordRoleId)) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Invalid role ID: ${rolePermission.discordRoleId}`
          });
        }
      }

      // Get setup state
      const setupState = await prisma.setupState.findUnique({
        where: { id: 'singleton' }
      });

      if (!setupState?.selectedGuildId) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'No guild selected. Please select a guild first.'
        });
      }

      // Mark roles as configured
      await prisma.setupState.update({
        where: { id: 'singleton' },
        data: {
          rolesConfigured: true
        }
      });

      return reply.status(200).send({
        success: true,
        message: 'Role permissions configured successfully'
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: error.message || 'Failed to configure roles'
      });
    }
  });

  /**
   * POST /api/setup/complete
   * Finalize setup and create organization
   */
  fastify.post<{
    Body: {
      orgName: string;
      rolePermissions: Array<{
        discordRoleId: string;
        discordRoleName: string;
        discordRoleColor: number;
        permissions: Record<string, boolean>;
      }>;
    };
  }>('/complete', async (request, reply) => {
    const { orgName, rolePermissions } = request.body;

    if (!orgName) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'orgName is required'
      });
    }

    try {
      const setupState = await prisma.setupState.findUnique({
        where: { id: 'singleton' }
      });

      if (!setupState?.selectedGuildId) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Setup not complete. Please complete all steps first.'
        });
      }

      const botToken = process.env.DISCORD_BOT_TOKEN || '';

      // Get guild details
      const guild = await discordOAuth.getGuild(setupState.selectedGuildId, botToken);

      // Create a special "Server Owner" role with full permissions
      const ownerRolePermission = {
        discordRoleId: 'server_owner', // Special ID for server owner
        discordRoleName: 'Server Owner',
        discordRoleColor: 16711680, // Red color (#FF0000)
        canCreateServer: true,
        canDeleteServer: true,
        canStartServer: true,
        canStopServer: true,
        canRestartServer: true,
        canEditConfig: true,
        canEditFiles: true,
        canInstallMods: true,
        canCreateBackup: true,
        canRestoreBackup: true,
        canDeleteBackup: true,
        canViewLogs: true,
        canViewMetrics: true,
        canViewConsole: true,
        canExecuteCommands: true,
        canManageMembers: true,
        canManageRoles: true,
        canManageSettings: true
      };

      // Create organization with settings and role permissions
      const org = await prisma.org.create({
        data: {
          discordGuild: setupState.selectedGuildId, // Backwards compatibility
          discordGuildId: guild.id,
          discordGuildName: guild.name,
          discordIconHash: guild.icon || undefined,
          discordOwnerDiscordId: setupState.installerDiscordId || undefined,
          name: orgName,
          settings: {
            create: {
              rolePermissions: {
                create: [
                  // Server Owner role first
                  ownerRolePermission,
                  // Then user-configured roles
                  ...rolePermissions.map(rp => ({
                  discordRoleId: rp.discordRoleId,
                  discordRoleName: rp.discordRoleName,
                  discordRoleColor: rp.discordRoleColor,
                  canCreateServer: rp.permissions.canCreateServer || false,
                  canDeleteServer: rp.permissions.canDeleteServer || false,
                  canStartServer: rp.permissions.canStartServer || false,
                  canStopServer: rp.permissions.canStopServer || false,
                  canRestartServer: rp.permissions.canRestartServer || false,
                  canEditConfig: rp.permissions.canEditConfig || false,
                  canEditFiles: rp.permissions.canEditFiles || false,
                  canInstallMods: rp.permissions.canInstallMods || false,
                  canCreateBackup: rp.permissions.canCreateBackup || false,
                  canRestoreBackup: rp.permissions.canRestoreBackup || false,
                  canDeleteBackup: rp.permissions.canDeleteBackup || false,
                  canViewLogs: rp.permissions.canViewLogs !== false, // Default true
                  canViewMetrics: rp.permissions.canViewMetrics !== false, // Default true
                  canViewConsole: rp.permissions.canViewConsole || false,
                  canExecuteCommands: rp.permissions.canExecuteCommands || false,
                  canManageMembers: rp.permissions.canManageMembers || false,
                  canManageRoles: rp.permissions.canManageRoles || false,
                  canManageSettings: rp.permissions.canManageSettings || false
                }))]
              }
            }
          }
        },
        include: {
          settings: {
            include: {
              rolePermissions: true
            }
          }
        }
      });

      // If installer Discord ID is available, create user and membership
      if (setupState.installerDiscordId) {
        // Check if user already exists
        let user = await prisma.user.findUnique({
          where: { discordId: setupState.installerDiscordId }
        });

        if (!user) {
          // Create user (minimal info for now)
          user = await prisma.user.create({
            data: {
              discordId: setupState.installerDiscordId,
              displayName: 'Installer', // Will be updated on first login
              memberships: {
                create: {
                  orgId: org.id,
                  role: 'OWNER'
                }
              }
            }
          });
        } else {
          // Create membership
          await prisma.membership.create({
            data: {
              userId: user.id,
              orgId: org.id,
              role: 'OWNER'
            }
          });
        }

        // Update setup state with installer user ID
        await prisma.setupState.update({
          where: { id: 'singleton' },
          data: {
            installerUserId: user.id
          }
        });
      }

      return reply.status(200).send({
        success: true,
        message: 'Setup completed successfully',
        org: {
          id: org.id,
          name: org.name,
          discordGuildId: org.discordGuildId,
          discordGuildName: org.discordGuildName
        }
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: error.message || 'Failed to complete setup'
      });
    }
  });
}
