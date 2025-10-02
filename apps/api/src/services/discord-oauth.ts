import axios from 'axios';
import { randomBytes } from 'crypto';

// Simple rate limiter - ensures 3 seconds between Discord API calls
class DiscordRateLimiter {
  private lastCallTime: number = 0;
  private readonly minDelayMs: number = 3000; // 3 seconds

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;

    if (timeSinceLastCall < this.minDelayMs) {
      const waitTime = this.minDelayMs - timeSinceLastCall;
      console.log(`[Rate Limiter] Waiting ${waitTime}ms before next Discord API call`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastCallTime = Date.now();
  }
}

const rateLimiter = new DiscordRateLimiter();

interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
}

interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  features: string[];
}

interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
  permissions: string;
  managed: boolean;
}

interface DiscordMember {
  user: DiscordUser;
  nick: string | null;
  roles: string[];
  joined_at: string;
}

interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export class DiscordOAuthService {
  // Read credentials dynamically from process.env each time
  private get clientId(): string {
    return process.env.DISCORD_CLIENT_ID || '';
  }

  private get clientSecret(): string {
    return process.env.DISCORD_CLIENT_SECRET || '';
  }

  private get redirectUri(): string {
    return process.env.DISCORD_REDIRECT_URI || 'http://localhost:5173/setup/discord/callback';
  }

  /**
   * Generate OAuth authorization URL with state for CSRF protection
   * Includes 'bot' scope to automatically invite the bot to the selected guild
   */
  generateAuthUrl(state?: string): { url: string; state: string } {
    const stateToken = state || randomBytes(32).toString('hex');

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'identify guilds guilds.members.read bot',
      permissions: '8', // Administrator permission (0x8)
      state: stateToken
    });

    return {
      url: `https://discord.com/api/oauth2/authorize?${params.toString()}`,
      state: stateToken
    };
  }

  /**
   * Exchange OAuth code for access token
   */
  async exchangeCode(code: string): Promise<OAuthTokenResponse> {
    await rateLimiter.waitIfNeeded();

    try {
      const response = await axios.post(
        'https://discord.com/api/v10/oauth2/token',
        new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.redirectUri
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to exchange OAuth code: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /**
   * Get user info from access token
   */
  async getUser(accessToken: string): Promise<DiscordUser> {
    await rateLimiter.waitIfNeeded();

    try {
      const response = await axios.get('https://discord.com/api/v10/users/@me', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get user info: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get guilds the user is in (with owner/admin filter)
   */
  async getUserGuilds(accessToken: string, filterOwnerAdmin = true): Promise<DiscordGuild[]> {
    await rateLimiter.waitIfNeeded();

    try {
      const response = await axios.get('https://discord.com/api/v10/users/@me/guilds', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      let guilds: DiscordGuild[] = response.data;

      // Filter to only guilds where user is owner or admin
      if (filterOwnerAdmin) {
        guilds = guilds.filter(guild => {
          // Check if user is owner
          if (guild.owner) return true;

          // Check if user has ADMINISTRATOR permission (0x8)
          const permissions = BigInt(guild.permissions);
          const ADMINISTRATOR = BigInt(0x8);
          return (permissions & ADMINISTRATOR) === ADMINISTRATOR;
        });
      }

      return guilds;
    } catch (error: any) {
      if (error.response?.status === 429) {
        const retryAfter = error.response?.headers['retry-after'] || error.response?.data?.retry_after || 60;
        const retryAfterMs = typeof retryAfter === 'number' ? retryAfter * 1000 : parseInt(retryAfter) * 1000;
        const retryError: any = new Error(`Discord API rate limit exceeded. Please wait ${Math.ceil(retryAfterMs / 1000)} seconds and try again.`);
        retryError.retryAfter = retryAfterMs;
        retryError.statusCode = 429;
        throw retryError;
      }
      throw new Error(`Failed to get user guilds: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get guild details (requires bot token)
   */
  async getGuild(guildId: string, botToken: string): Promise<DiscordGuild> {
    await rateLimiter.waitIfNeeded();

    try {
      const response = await axios.get(`https://discord.com/api/v10/guilds/${guildId}`, {
        headers: {
          Authorization: `Bot ${botToken}`
        }
      });

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Guild not found or bot is not in the guild');
      }
      throw new Error(`Failed to get guild: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get guild roles (requires bot token)
   */
  async getGuildRoles(guildId: string, botToken: string): Promise<DiscordRole[]> {
    await rateLimiter.waitIfNeeded();

    try {
      const response = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
        headers: {
          Authorization: `Bot ${botToken}`
        }
      });

      const roles: DiscordRole[] = response.data;

      // Sort by position (highest first)
      return roles.sort((a, b) => b.position - a.position);
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Guild not found or bot is not in the guild');
      }
      throw new Error(`Failed to get guild roles: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get guild roles using OAuth access token
   * Fetches the user's member data which includes their role IDs,
   * then fetches full role details using bot token if available
   */
  async getGuildRolesWithOAuth(guildId: string, accessToken: string): Promise<DiscordRole[]> {
    await rateLimiter.waitIfNeeded();

    try {
      // Get the user's member data which includes their role IDs
      const memberResponse = await axios.get(
        `https://discord.com/api/v10/users/@me/guilds/${guildId}/member`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      const memberData = memberResponse.data;
      const roleIds: string[] = memberData.roles || [];

      console.log('[DEBUG] Got role IDs from Discord:', roleIds);

      // If we have a bot token, fetch full role details
      const botToken = process.env.DISCORD_BOT_TOKEN;
      if (botToken && roleIds.length > 0) {
        console.log('[DEBUG] Bot token available, fetching full role details');

        try {
          // Fetch ALL guild roles using bot token
          const allGuildRoles = await this.getGuildRoles(guildId, botToken);

          // Filter to only the roles the user has
          const userRoles = allGuildRoles.filter(role => roleIds.includes(role.id));

          console.log('[DEBUG] Got', userRoles.length, 'role details for user');
          return userRoles;
        } catch (botError: any) {
          console.log('[DEBUG] Failed to fetch via bot, falling back to role IDs:', botError.message);
          // Fall through to role ID fallback
        }
      }

      // Fallback: create minimal role objects from IDs
      console.log('[DEBUG] No bot token or bot fetch failed, using role ID fallback');
      const roles: DiscordRole[] = roleIds.map((roleId: string) => ({
        id: roleId,
        name: `Role ${roleId.substring(0, 8)}`,
        color: 0,
        position: 0,
        permissions: '0',
        managed: false,
        mentionable: false
      }));

      return roles;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('User is not a member of this guild or lacks permissions');
      }
      if (error.response?.status === 404) {
        throw new Error('Guild not found or user is not a member');
      }
      if (error.response?.status === 429) {
        throw new Error('Discord API rate limit exceeded. Please wait a moment and try again.');
      }
      throw new Error(`Failed to get guild roles via OAuth: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get user's member details in a specific guild (including roles)
   */
  async getUserGuildMember(guildId: string, accessToken: string) {
    await rateLimiter.waitIfNeeded();

    try {
      const response = await axios.get(
        `https://discord.com/api/v10/users/@me/guilds/${guildId}/member`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('User is not a member of this guild');
      }
      if (error.response?.status === 404) {
        throw new Error('Guild not found');
      }
      throw new Error(`Failed to get guild member: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get guild members (requires bot token)
   */
  async getGuildMembers(guildId: string, botToken: string, limit = 1000): Promise<DiscordMember[]> {
    await rateLimiter.waitIfNeeded();

    try {
      const response = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/members`, {
        headers: {
          Authorization: `Bot ${botToken}`
        },
        params: {
          limit
        }
      });

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Guild not found or bot is not in the guild');
      }
      throw new Error(`Failed to get guild members: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Check if bot is in a guild
   */
  async isBotInGuild(guildId: string, botToken: string): Promise<boolean> {
    try {
      await this.getGuild(guildId, botToken);
      return true;
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('not in the guild')) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get guild member by user ID (requires bot token)
   */
  async getGuildMember(guildId: string, userId: string, botToken: string): Promise<DiscordMember> {
    await rateLimiter.waitIfNeeded();

    try {
      const response = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
        headers: {
          Authorization: `Bot ${botToken}`
        }
      });

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Member not found in guild');
      }
      throw new Error(`Failed to get guild member: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Refresh an access token
   */
  async refreshToken(refreshToken: string): Promise<OAuthTokenResponse> {
    await rateLimiter.waitIfNeeded();

    try {
      const response = await axios.post(
        'https://discord.com/api/v10/oauth2/token',
        new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to refresh token: ${error.response?.data?.error_description || error.message}`);
    }
  }
}

export const discordOAuth = new DiscordOAuthService();
