import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../services/prisma';
import { discordOAuth } from '../services/discord-oauth';
import { oauthSessionManager } from '../services/oauth-session-manager';
import { oauthStates } from './sso';
import { randomBytes } from 'crypto';
import axios from 'axios';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Middleware to prevent access to setup routes if setup is already complete
 */
async function preventSetupIfComplete(request: FastifyRequest, reply: FastifyReply) {
  try {
    const setupState = await prisma.setupState.findUnique({
      where: { id: 'singleton' }
    });

    // Check if setup is complete
    const isComplete = setupState?.systemConfigured &&
      setupState?.oauthConfigured &&
      setupState?.guildSelected &&
      setupState?.rolesConfigured;

    if (isComplete) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Setup has already been completed. Access to setup wizard is locked.'
      });
    }
  } catch (error: any) {
    // If there's an error checking status, allow the request to proceed
    // This ensures setup can still work if there are transient database issues
    console.error('Error checking setup status:', error);
  }
}

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
   * Returns current setup state with validation and auto-repair
   */
  fastify.get<{
    Reply: SetupStatusResponse & {
      validationErrors?: string[];
      repaired?: boolean;
      repairs?: string[];
    };
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

      // Validation and auto-repair
      const validationErrors: string[] = [];
      const repairs: string[] = [];
      let repaired = false;

      // Check for inconsistent state and repair
      const isComplete = Boolean(
        setupState.systemConfigured &&
        setupState.oauthConfigured &&
        setupState.guildSelected &&
        setupState.rolesConfigured
      );

      if (isComplete) {
        // Verify org exists if setup appears complete
        const org = await prisma.org.findFirst();
        if (!org) {
          validationErrors.push('All setup steps complete but no organization exists');

          // Cannot auto-repair missing org, need to re-run setup
          await prisma.setupState.update({
            where: { id: 'singleton' },
            data: {
              rolesConfigured: false
            }
          });
          repairs.push('Reset rolesConfigured flag due to missing organization');
          repaired = true;

          setupState = await prisma.setupState.findUnique({
            where: { id: 'singleton' }
          })!;
        }
      }

      // Check for orphaned guild selection
      if (setupState.guildSelected && !setupState.selectedGuildId) {
        validationErrors.push('Guild marked as selected but no guild ID stored');

        // Auto-repair: Reset guild selection
        await prisma.setupState.update({
          where: { id: 'singleton' },
          data: {
            guildSelected: false,
            rolesConfigured: false // Also reset roles since they depend on guild
          }
        });
        repairs.push('Reset guild selection due to missing guild ID');
        repaired = true;

        setupState = await prisma.setupState.findUnique({
          where: { id: 'singleton' }
        })!;
      }

      // Check for step dependencies
      if (setupState.rolesConfigured && !setupState.guildSelected) {
        validationErrors.push('Roles configured but no guild selected');

        // Auto-repair: Reset roles configuration
        await prisma.setupState.update({
          where: { id: 'singleton' },
          data: {
            rolesConfigured: false
          }
        });
        repairs.push('Reset roles configuration due to missing guild selection');
        repaired = true;

        setupState = await prisma.setupState.findUnique({
          where: { id: 'singleton' }
        })!;
      }

      if (setupState.guildSelected && !setupState.oauthConfigured) {
        validationErrors.push('Guild selected but OAuth not configured');

        // Auto-repair: Reset guild and roles
        await prisma.setupState.update({
          where: { id: 'singleton' },
          data: {
            guildSelected: false,
            rolesConfigured: false,
            selectedGuildId: null
          }
        });
        repairs.push('Reset guild selection due to missing OAuth configuration');
        repaired = true;

        setupState = await prisma.setupState.findUnique({
          where: { id: 'singleton' }
        })!;
      }

      // Clean up expired OAuth sessions
      const expiredSessions = await prisma.oAuthSession.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      });

      if (expiredSessions.count > 0) {
        repairs.push(`Cleaned up ${expiredSessions.count} expired OAuth sessions`);
        repaired = true;
      }

      // Determine current step based on validated state
      let currentStep = 'welcome';
      if (!setupState.systemConfigured) {
        currentStep = 'system';
      } else if (!setupState.oauthConfigured) {
        currentStep = 'discord';
      } else if (!setupState.guildSelected) {
        currentStep = 'guild-select';
      } else if (!setupState.rolesConfigured) {
        currentStep = 'roles';
      } else {
        currentStep = 'complete';
      }

      const response: any = {
        isComplete,
        currentStep,
        steps: {
          systemConfigured: setupState.systemConfigured,
          discordConfigured: setupState.oauthConfigured,
          guildSelected: setupState.guildSelected,
          rolesConfigured: setupState.rolesConfigured
        },
        selectedGuildId: setupState.selectedGuildId || undefined,
        installerUserId: setupState.installerUserId || undefined
      };

      // Include validation info if there were issues
      if (validationErrors.length > 0) {
        response.validationErrors = validationErrors;
      }

      if (repaired) {
        response.repaired = true;
        response.repairs = repairs;
        fastify.log.info('Setup state auto-repaired:', repairs);
      }

      return reply.status(200).send(response);
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
  }>('/discord/validate', { preHandler: preventSetupIfComplete }, async (request, reply) => {
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
  }>('/discord/test', { preHandler: preventSetupIfComplete }, async (request, reply) => {
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
  }>('/system/configure', { preHandler: preventSetupIfComplete }, async (request, reply) => {
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
  }>('/discord/configure', { preHandler: preventSetupIfComplete }, async (request, reply) => {
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
   * POST /api/setup/configure-domains
   * Configure domain settings for the application
   */
  fastify.post<{
    Body: {
      webDomain: string;
      apiDomain: string;
    };
  }>('/configure-domains', { preHandler: preventSetupIfComplete }, async (request, reply) => {
    const { webDomain, apiDomain } = request.body;

    if (!webDomain || !apiDomain) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'webDomain and apiDomain are required'
      });
    }

    // Validate URLs
    try {
      new URL(webDomain);
      new URL(apiDomain);
    } catch (error) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid URL format for webDomain or apiDomain'
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

      // Mark system as configured in setup state
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
        message: 'Domain configuration saved successfully'
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to save domain configuration'
      });
    }
  });

  /**
   * GET /api/setup/discord/auth-url
   * Generate Discord OAuth URL for user login during setup
   */
  fastify.get('/discord/auth-url', { preHandler: preventSetupIfComplete }, async (request, reply) => {
    try {
      const state = randomBytes(32).toString('hex');

      // Use the unified callback endpoint with setup flow marker
      const apiOrigin = process.env.API_ORIGIN || 'http://localhost:8080';
      const redirectUri = `${apiOrigin}/api/sso/discord/login/callback`;

      const { url } = discordOAuth.generateAuthUrl(state, {
        redirectUri,
        includeBot: true // Include bot scope for setup flow
      });

      // Store state with flow type for the callback handler
      oauthStates.set(state, {
        expiresAt: Date.now() + 10 * 60 * 1000,
        flow: 'setup' as 'setup'
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
   * Legacy callback endpoint - kept for backwards compatibility
   * Redirects to the unified callback handler
   */
  fastify.get<{
    Querystring: {
      code: string;
      state: string;
      guild_id?: string;
    };
  }>('/discord/callback', async (request, reply) => {
    const { code, state, guild_id } = request.query;

    // Redirect to the unified callback handler
    const apiOrigin = process.env.API_ORIGIN || 'http://localhost:8080';
    const params = new URLSearchParams();
    if (code) params.set('code', code);
    if (state) params.set('state', state);
    if (guild_id) params.set('guild_id', guild_id);

    const redirectUrl = `${apiOrigin}/api/sso/discord/login/callback?${params.toString()}`;
    return reply.redirect(redirectUrl);
  });

  /**
   * POST /api/setup/discord/guilds
   * Get user's guilds (where they are owner/admin)
   */
  fastify.post<{
    Body: {
      sessionToken: string;
    };
  }>('/discord/guilds', { preHandler: preventSetupIfComplete }, async (request, reply) => {
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
  }>('/select-guild', { preHandler: preventSetupIfComplete }, async (request, reply) => {
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
   * GET /api/setup/guild/:guildId/roles
   * Get roles for a selected guild using OAuth access token
   * Requires: Authorization: Bearer <sessionToken> header
   */
  fastify.get<{
    Params: {
      guildId: string;
    };
  }>('/guild/:guildId/roles', { preHandler: preventSetupIfComplete }, async (request, reply) => {
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
  }>('/configure-roles', { preHandler: preventSetupIfComplete }, async (request, reply) => {
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
   * Finalize setup and create organization (IDEMPOTENT)
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
      // Check current setup state
      const setupState = await prisma.setupState.findUnique({
        where: { id: 'singleton' }
      });

      // Validate all required setup steps are complete
      if (!setupState?.systemConfigured || !setupState?.oauthConfigured ||
          !setupState?.guildSelected || !setupState?.rolesConfigured) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Setup steps are not complete. Please complete all steps first.'
        });
      }

      if (!setupState?.selectedGuildId) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'No guild selected. Please complete guild selection first.'
        });
      }

      // Check if already completed (org already exists for this guild)
      const existingOrg = await prisma.org.findUnique({
        where: { discordGuildId: setupState.selectedGuildId }
      });

      if (existingOrg) {
        // Already completed - return success idempotently
        fastify.log.info(`Setup already completed for guild ${setupState.selectedGuildId}`);

        return reply.status(200).send({
          success: true,
          message: 'Setup already completed for this Discord guild',
          alreadyCompleted: true,
          org: {
            id: existingOrg.id,
            name: existingOrg.name,
            discordGuildId: existingOrg.discordGuildId,
            discordGuildName: existingOrg.discordGuildName
          }
        });
      }

      const botToken = process.env.DISCORD_BOT_TOKEN || '';

      // Get guild details
      const guild = await discordOAuth.getGuild(setupState.selectedGuildId, botToken);

      // Create a special "Server Owner" role with full permissions
      const ownerRolePermission = {
        discordRoleId: 'server_owner',
        discordRoleName: 'Server Owner',
        discordRoleColor: 16711680,
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

      // Use transaction for atomicity
      const result = await prisma.$transaction(async (tx) => {
        // Upsert organization (idempotent)
        const org = await tx.org.upsert({
          where: { discordGuildId: setupState.selectedGuildId },
          update: {
            discordGuildName: guild.name,
            discordIconHash: guild.icon || undefined,
            discordBannerHash: guild.banner || undefined,
            discordDescription: guild.description || undefined,
            name: orgName
          },
          create: {
            discordGuild: setupState.selectedGuildId, // Backwards compatibility
            discordGuildId: guild.id,
            discordGuildName: guild.name,
            discordIconHash: guild.icon || undefined,
            discordBannerHash: guild.banner || undefined,
            discordDescription: guild.description || undefined,
            discordOwnerDiscordId: setupState.installerDiscordId || undefined,
            name: orgName
          }
        });

        // Upsert organization settings (idempotent)
        const settings = await tx.orgSettings.upsert({
          where: { orgId: org.id },
          update: {},
          create: { orgId: org.id }
        });

        // Delete existing role permissions and recreate (simpler than complex upsert)
        await tx.discordRolePermission.deleteMany({
          where: { orgSettingsId: settings.id }
        });

        // Create role permissions
        await tx.discordRolePermission.createMany({
          data: [
            // Server Owner role first
            {
              orgSettingsId: settings.id,
              ...ownerRolePermission
            },
            // Then user-configured roles
            ...rolePermissions.map(rp => ({
              orgSettingsId: settings.id,
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
              canViewLogs: rp.permissions.canViewLogs !== false,
              canViewMetrics: rp.permissions.canViewMetrics !== false,
              canViewConsole: rp.permissions.canViewConsole || false,
              canExecuteCommands: rp.permissions.canExecuteCommands || false,
              canManageMembers: rp.permissions.canManageMembers || false,
              canManageRoles: rp.permissions.canManageRoles || false,
              canManageSettings: rp.permissions.canManageSettings || false
            }))
          ]
        });

        // Handle installer user and membership if available
        let user = null;
        if (setupState.installerDiscordId) {
          // Try to get Discord user info from OAuth session
          let discordUserInfo: any = null;
          try {
            const oauthSession = await tx.oAuthSession.findFirst({
              where: { userId: setupState.installerDiscordId },
              orderBy: { createdAt: 'desc' }
            });

            if (oauthSession?.accessToken) {
              discordUserInfo = await discordOAuth.getUser(oauthSession.accessToken);
              fastify.log.info('Fetched Discord user info for installer:', discordUserInfo.username);
            }
          } catch (err) {
            fastify.log.warn('Failed to fetch Discord user info, using placeholder:', err);
          }

          const avatarUrl = discordUserInfo?.avatar
            ? `https://cdn.discordapp.com/avatars/${discordUserInfo.id}/${discordUserInfo.avatar}.png`
            : null;

          // Upsert user (idempotent)
          user = await tx.user.upsert({
            where: { discordId: setupState.installerDiscordId },
            update: {
              displayName: discordUserInfo?.username || 'Installer',
              avatarUrl
            },
            create: {
              discordId: setupState.installerDiscordId,
              displayName: discordUserInfo?.username || 'Installer',
              avatarUrl
            }
          });

          // Upsert membership (idempotent)
          await tx.membership.upsert({
            where: {
              userId_orgId: {
                userId: user.id,
                orgId: org.id
              }
            },
            update: {
              role: 'OWNER'
            },
            create: {
              userId: user.id,
              orgId: org.id,
              role: 'OWNER'
            }
          });

          // Update setup state with installer user ID
          await tx.setupState.update({
            where: { id: 'singleton' },
            data: {
              installerUserId: user.id
            }
          });
        }

        return { org, user };
      });

      // Auto-login if we have a user
      if (result.user) {
        const jwtSecret = process.env.API_JWT_SECRET;
        if (!jwtSecret) {
          throw new Error('API_JWT_SECRET not configured');
        }

        const sessionToken = fastify.jwt.sign(
          {
            sub: result.user.id,
            org: result.org.id
          },
          { expiresIn: '1d' }
        );

        const cookieOptions = {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: 24 * 60 * 60 * 1000,
          sameSite: (process.env.NODE_ENV === 'production' ? 'strict' : 'lax') as 'strict' | 'lax',
          signed: true
        };

        reply.setCookie('spinup_sess', sessionToken, cookieOptions);
        fastify.log.info(`Installer user ${result.user.id} automatically logged in after setup completion`);
      }

      return reply.status(200).send({
        success: true,
        message: 'Setup completed successfully',
        org: {
          id: result.org.id,
          name: result.org.name,
          discordGuildId: result.org.discordGuildId,
          discordGuildName: result.org.discordGuildName
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

  /**
   * GET /api/setup/org-info
   * Get current organization Discord guild info
   */
  fastify.get('/org-info', async (request, reply) => {
    try {
      const org = await prisma.org.findFirst({
        select: {
          id: true,
          name: true,
          discordGuildId: true,
          discordGuildName: true
        }
      });

      if (!org) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'No organization found'
        });
      }

      return reply.status(200).send({
        id: org.id,
        name: org.name,
        discordGuildId: org.discordGuildId,
        discordGuildName: org.discordGuildName
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get organization info'
      });
    }
  });

  /**
   * POST /api/setup/reset
   * Complete system reset with comprehensive cleanup
   * Requires confirmation token and optional authentication
   */
  fastify.post<{
    Body: {
      confirmationToken: string;
    };
  }>('/reset', async (request, reply) => {
    const { confirmationToken } = request.body;

    // Require confirmation token for safety
    if (!confirmationToken) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Confirmation token required. Use "RESET-SYSTEM-COMPLETELY" to confirm.'
      });
    }

    if (confirmationToken !== 'RESET-SYSTEM-COMPLETELY') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Invalid confirmation token. Use "RESET-SYSTEM-COMPLETELY" to confirm system reset.'
      });
    }

    try {
      // Check if setup is complete (requires auth)
      const setupState = await prisma.setupState.findUnique({
        where: { id: 'singleton' }
      });

      // If setup is complete (all steps done), require authentication
      const isComplete = setupState &&
        setupState.systemConfigured &&
        setupState.oauthConfigured &&
        setupState.guildSelected &&
        setupState.rolesConfigured;

      if (isComplete) {
        // Check for JWT cookie authentication
        const token = request.cookies['spinup_sess'];
        if (!token) {
          return reply.status(401).send({
            error: 'Unauthorized',
            message: 'Authentication required to reset completed system'
          });
        }

        try {
          // Verify JWT token
          const decoded = fastify.jwt.verify(token);
          fastify.log.info(`System reset initiated by user: ${(decoded as any).sub}`);
        } catch (err) {
          return reply.status(401).send({
            error: 'Unauthorized',
            message: 'Invalid authentication token'
          });
        }
      }

      fastify.log.warn('SYSTEM RESET INITIATED - Starting comprehensive cleanup');

      // Initialize cleanup counters
      const cleanup = {
        containersRemoved: 0,
        containerErrors: 0,
        filesDeleted: 0,
        jobsDeleted: 0,
        configVersionsDeleted: 0,
        serversDeleted: 0,
        membershipsDeleted: 0,
        usersDeleted: 0,
        rolePermissionsDeleted: 0,
        orgSettingsDeleted: 0,
        orgsDeleted: 0,
        oauthSessionsDeleted: 0,
        alreadyReset: false
      };

      // Step 1: Stop and remove all Docker containers
      const servers = await prisma.server.findMany({
        select: { id: true, name: true, containerId: true }
      });

      if (servers.length > 0) {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        for (const server of servers) {
          if (server.containerId) {
            try {
              // Stop container
              await execAsync(`docker stop ${server.containerId}`);
              // Remove container
              await execAsync(`docker rm ${server.containerId}`);
              cleanup.containersRemoved++;
              fastify.log.info(`Removed container ${server.containerId} for server ${server.name}`);
            } catch (err) {
              cleanup.containerErrors++;
              fastify.log.warn(`Failed to remove container ${server.containerId}: ${err}`);
            }
          }
        }
      }

      // Step 2: Delete server data directories
      const dataDir = process.env.DATA_DIR || '/srv/spinup';
      if (servers.length > 0) {
        const fs = await import('fs/promises');
        for (const server of servers) {
          try {
            const serverDir = `${dataDir}/${server.id}`;
            await fs.rm(serverDir, { recursive: true, force: true });
            cleanup.filesDeleted++;
            fastify.log.info(`Deleted data directory for server ${server.name}`);
          } catch (err) {
            fastify.log.warn(`Failed to delete data directory for server ${server.id}: ${err}`);
          }
        }
      }

      // Step 3: Delete all database records in dependency order
      await prisma.$transaction(async (tx) => {
        // Delete job-related records first
        const jobResult = await tx.job.deleteMany({});
        cleanup.jobsDeleted = jobResult.count;

        // Delete server-related records (in dependency order)
        await tx.backup.deleteMany({});
        await tx.customScript.deleteMany({});

        const configResult = await tx.configVersion.deleteMany({});
        cleanup.configVersionsDeleted = configResult.count;

        const serverResult = await tx.server.deleteMany({});
        cleanup.serversDeleted = serverResult.count;

        // Delete user/membership records
        const membershipResult = await tx.membership.deleteMany({});
        cleanup.membershipsDeleted = membershipResult.count;

        // Delete auth-related records
        await tx.loginToken.deleteMany({});
        await tx.pairingCode.deleteMany({});
        await tx.audit.deleteMany({});

        const userResult = await tx.user.deleteMany({});
        cleanup.usersDeleted = userResult.count;

        // Delete org-related records
        const rolePermissionResult = await tx.discordRolePermission.deleteMany({});
        cleanup.rolePermissionsDeleted = rolePermissionResult.count;

        const orgSettingsResult = await tx.orgSettings.deleteMany({});
        cleanup.orgSettingsDeleted = orgSettingsResult.count;

        const orgResult = await tx.org.deleteMany({});
        cleanup.orgsDeleted = orgResult.count;

        // Delete OAuth sessions
        const oauthResult = await tx.oAuthSession.deleteMany({});
        cleanup.oauthSessionsDeleted = oauthResult.count;

        // Reset setup state to initial values
        await tx.setupState.upsert({
          where: { id: 'singleton' },
          create: {
            id: 'singleton',
            systemConfigured: false,
            oauthConfigured: false,
            botConfigured: false,
            guildSelected: false,
            rolesConfigured: false
          },
          update: {
            systemConfigured: false,
            oauthConfigured: false,
            botConfigured: false,
            guildSelected: false,
            rolesConfigured: false,
            selectedGuildId: null,
            installerDiscordId: null,
            installerUserId: null,
            onboardingComplete: false,
            firstServerCreated: false
          }
        });
      });

      // Clear the auth cookie if present
      reply.clearCookie('spinup_sess', { path: '/' });

      fastify.log.warn('SYSTEM RESET COMPLETE - All data has been wiped');

      return reply.status(200).send({
        success: true,
        message: 'System reset completed successfully. All data has been removed.',
        cleanup
      });
    } catch (error: any) {
      fastify.log.error('System reset failed:', error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: error.message || 'Failed to reset system'
      });
    }
  });
}
