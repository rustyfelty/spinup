import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import { DiscordOAuthService } from '../../services/discord-oauth';

// Mock axios
vi.mock('axios');

describe('Discord OAuth Service - Integration Tests', () => {
  let discordOAuth: DiscordOAuthService;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Save original env
    originalEnv = { ...process.env };

    // Set test environment variables
    process.env.DISCORD_CLIENT_ID = 'test_client_id_123';
    process.env.DISCORD_CLIENT_SECRET = 'test_client_secret_456';
    process.env.DISCORD_REDIRECT_URI = 'https://test.com/callback';
    process.env.DISCORD_BOT_TOKEN = 'test_bot_token_789';

    discordOAuth = new DiscordOAuthService();
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = originalEnv;
  });

  describe('OAuth URL Generation', () => {
    it('should generate valid OAuth URL with state', () => {
      const { url, state } = discordOAuth.generateAuthUrl();

      expect(url).toContain('https://discord.com/api/oauth2/authorize');
      expect(url).toContain('client_id=test_client_id_123');
      expect(url).toContain('redirect_uri=https://test.com/callback');
      expect(url).toContain('scope=identify+guilds+guilds.members.read+bot');
      expect(url).toContain(`state=${state}`);
      expect(state).toHaveLength(64); // 32 bytes = 64 hex chars
    });

    it('should accept custom state token', () => {
      const customState = 'my-custom-state-token';
      const { url, state } = discordOAuth.generateAuthUrl(customState);

      expect(url).toContain(`state=${customState}`);
      expect(state).toBe(customState);
    });

    it('should include bot scope with administrator permissions by default', () => {
      const { url } = discordOAuth.generateAuthUrl();

      expect(url).toContain('scope=identify+guilds+guilds.members.read+bot');
      expect(url).toContain('permissions=8'); // Administrator
    });

    it('should exclude bot scope when includeBot is false', () => {
      const { url } = discordOAuth.generateAuthUrl(undefined, { includeBot: false });

      expect(url).toContain('scope=identify+guilds+guilds.members.read');
      expect(url).not.toContain('+bot');
      expect(url).not.toContain('permissions=');
    });

    it('should support custom redirect URI', () => {
      const customUri = 'https://custom.com/oauth/callback';
      const { url } = discordOAuth.generateAuthUrl(undefined, { redirectUri: customUri });

      expect(url).toContain(`redirect_uri=${encodeURIComponent(customUri)}`);
    });

    it('should add prompt=none when skipPrompt is true', () => {
      const { url } = discordOAuth.generateAuthUrl(undefined, { skipPrompt: true });

      expect(url).toContain('prompt=none');
    });

    it('should not add prompt parameter when skipPrompt is false', () => {
      const { url } = discordOAuth.generateAuthUrl(undefined, { skipPrompt: false });

      expect(url).not.toContain('prompt=');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce 3 second rate limit between calls', async () => {
      (axios.get as any).mockResolvedValue({ data: { id: 'user123', username: 'testuser' } });

      // First call - should execute immediately
      const promise1 = discordOAuth.getUser('token1');
      await vi.advanceTimersByTimeAsync(0);
      await promise1;

      expect(axios.get).toHaveBeenCalledTimes(1);

      // Second call - should wait 3 seconds
      const promise2 = discordOAuth.getUser('token2');
      await vi.advanceTimersByTimeAsync(2999);
      expect(axios.get).toHaveBeenCalledTimes(1); // Still waiting

      await vi.advanceTimersByTimeAsync(1);
      await promise2;
      expect(axios.get).toHaveBeenCalledTimes(2); // Now executed
    });

    it('should not delay if 3+ seconds have passed', async () => {
      (axios.get as any).mockResolvedValue({ data: { id: 'user123' } });

      await discordOAuth.getUser('token1');
      expect(axios.get).toHaveBeenCalledTimes(1);

      // Wait 5 seconds
      await vi.advanceTimersByTimeAsync(5000);

      // Should execute immediately
      await discordOAuth.getUser('token2');
      expect(axios.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('Token Exchange', () => {
    it('should exchange code for access token', async () => {
      const mockTokenResponse = {
        access_token: 'access_token_123',
        token_type: 'Bearer',
        expires_in: 604800,
        refresh_token: 'refresh_token_456',
        scope: 'identify guilds'
      };

      (axios.post as any).mockResolvedValue({ data: mockTokenResponse });

      const result = await discordOAuth.exchangeCode('oauth_code_789');

      expect(axios.post).toHaveBeenCalledWith(
        'https://discord.com/api/v10/oauth2/token',
        expect.any(String),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        })
      );

      expect(result).toEqual(mockTokenResponse);
    });

    it('should use custom redirect URI if provided', async () => {
      (axios.post as any).mockResolvedValue({ data: {} });

      await discordOAuth.exchangeCode('code123', 'https://custom.com/callback');

      const callArgs = (axios.post as any).mock.calls[0];
      const body = callArgs[1];

      expect(body).toContain('redirect_uri=https%3A%2F%2Fcustom.com%2Fcallback');
    });

    it('should handle OAuth errors', async () => {
      (axios.post as any).mockRejectedValue({
        response: {
          data: {
            error_description: 'Invalid authorization code'
          }
        }
      });

      await expect(
        discordOAuth.exchangeCode('invalid_code')
      ).rejects.toThrow('Invalid authorization code');
    });

    it('should handle network errors', async () => {
      (axios.post as any).mockRejectedValue(new Error('Network error'));

      await expect(
        discordOAuth.exchangeCode('code123')
      ).rejects.toThrow('Failed to exchange OAuth code');
    });
  });

  describe('User Info Retrieval', () => {
    it('should fetch user information', async () => {
      const mockUser = {
        id: '123456789',
        username: 'testuser',
        discriminator: '0001',
        avatar: 'avatar_hash_123'
      };

      (axios.get as any).mockResolvedValue({ data: mockUser });

      const user = await discordOAuth.getUser('access_token_123');

      expect(axios.get).toHaveBeenCalledWith(
        'https://discord.com/api/v10/users/@me',
        {
          headers: { Authorization: 'Bearer access_token_123' }
        }
      );

      expect(user).toEqual(mockUser);
    });

    it('should handle unauthorized errors', async () => {
      (axios.get as any).mockRejectedValue({
        response: {
          status: 401,
          data: { message: 'Unauthorized' }
        }
      });

      await expect(
        discordOAuth.getUser('invalid_token')
      ).rejects.toThrow('Failed to get user info');
    });

    it('should handle expired tokens', async () => {
      (axios.get as any).mockRejectedValue({
        response: {
          status: 401,
          data: { message: 'Invalid OAuth token' }
        }
      });

      await expect(
        discordOAuth.getUser('expired_token')
      ).rejects.toThrow('Invalid OAuth token');
    });
  });

  describe('Guild Retrieval', () => {
    it('should fetch user guilds with owner/admin filter', async () => {
      const mockGuilds = [
        {
          id: 'guild1',
          name: 'Admin Guild',
          icon: null,
          owner: false,
          permissions: '8', // Administrator
          features: []
        },
        {
          id: 'guild2',
          name: 'Owner Guild',
          icon: null,
          owner: true,
          permissions: '0',
          features: []
        },
        {
          id: 'guild3',
          name: 'Member Guild',
          icon: null,
          owner: false,
          permissions: '37080128', // No admin
          features: []
        }
      ];

      (axios.get as any).mockResolvedValue({ data: mockGuilds });

      const guilds = await discordOAuth.getUserGuilds('access_token_123', true);

      expect(guilds).toHaveLength(2); // Only admin and owner guilds
      expect(guilds[0].id).toBe('guild1');
      expect(guilds[1].id).toBe('guild2');
    });

    it('should return all guilds when filter is disabled', async () => {
      const mockGuilds = [
        { id: 'guild1', owner: false, permissions: '0', name: 'Guild 1', icon: null, features: [] },
        { id: 'guild2', owner: false, permissions: '0', name: 'Guild 2', icon: null, features: [] }
      ];

      (axios.get as any).mockResolvedValue({ data: mockGuilds });

      const guilds = await discordOAuth.getUserGuilds('access_token_123', false);

      expect(guilds).toHaveLength(2);
    });

    it('should handle 429 rate limit errors with retry-after', async () => {
      (axios.get as any).mockRejectedValue({
        response: {
          status: 429,
          headers: { 'retry-after': '30' },
          data: { retry_after: 30 }
        }
      });

      try {
        await discordOAuth.getUserGuilds('access_token_123');
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('rate limit exceeded');
        expect(error.message).toContain('30 seconds');
        expect(error.statusCode).toBe(429);
        expect(error.retryAfter).toBe(30000); // milliseconds
      }
    });

    it('should filter guilds by administrator permission correctly', async () => {
      const guilds = [
        {
          id: 'guild1',
          name: 'Admin Guild',
          permissions: BigInt(0x8).toString(), // ADMINISTRATOR
          owner: false,
          icon: null,
          features: []
        },
        {
          id: 'guild2',
          name: 'Manage Server',
          permissions: BigInt(0x20).toString(), // MANAGE_GUILD (not admin)
          owner: false,
          icon: null,
          features: []
        }
      ];

      (axios.get as any).mockResolvedValue({ data: guilds });

      const result = await discordOAuth.getUserGuilds('token', true);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('guild1');
    });
  });

  describe('Guild Details (Bot Token)', () => {
    it('should fetch guild details with bot token', async () => {
      const mockGuild = {
        id: 'guild123',
        name: 'Test Guild',
        icon: 'icon_hash',
        owner_id: 'owner123',
        features: [],
        banner: null
      };

      (axios.get as any).mockResolvedValue({ data: mockGuild });

      const guild = await discordOAuth.getGuild('guild123', 'bot_token_789');

      expect(axios.get).toHaveBeenCalledWith(
        'https://discord.com/api/v10/guilds/guild123',
        {
          headers: { Authorization: 'Bot bot_token_789' }
        }
      );

      expect(guild).toEqual(mockGuild);
    });

    it('should handle guild not found', async () => {
      (axios.get as any).mockRejectedValue({
        response: { status: 404 }
      });

      await expect(
        discordOAuth.getGuild('nonexistent', 'bot_token')
      ).rejects.toThrow('Guild not found or bot is not in the guild');
    });

    it('should handle bot not in guild', async () => {
      (axios.get as any).mockRejectedValue({
        response: {
          status: 404,
          data: { message: 'Unknown Guild' }
        }
      });

      await expect(
        discordOAuth.getGuild('guild123', 'bot_token')
      ).rejects.toThrow('Guild not found or bot is not in the guild');
    });
  });

  describe('Guild Roles', () => {
    it('should fetch and sort guild roles by position', async () => {
      const mockRoles = [
        { id: 'role1', name: 'Member', position: 1, color: 0, permissions: '0', managed: false },
        { id: 'role2', name: 'Admin', position: 10, color: 0xFF0000, permissions: '8', managed: false },
        { id: 'role3', name: 'Moderator', position: 5, color: 0x00FF00, permissions: '28', managed: false }
      ];

      (axios.get as any).mockResolvedValue({ data: mockRoles });

      const roles = await discordOAuth.getGuildRoles('guild123', 'bot_token');

      expect(roles).toHaveLength(3);
      expect(roles[0].name).toBe('Admin'); // Highest position first
      expect(roles[1].name).toBe('Moderator');
      expect(roles[2].name).toBe('Member');
    });

    it('should fetch guild roles with OAuth token and bot token fallback', async () => {
      const mockMember = {
        user: { id: 'user123' },
        roles: ['role1', 'role2']
      };

      const mockAllRoles = [
        { id: 'role1', name: 'Admin', position: 2, color: 0, permissions: '8', managed: false },
        { id: 'role2', name: 'Member', position: 1, color: 0, permissions: '0', managed: false },
        { id: 'role3', name: 'Other', position: 3, color: 0, permissions: '0', managed: false }
      ];

      (axios.get as any)
        .mockResolvedValueOnce({ data: mockMember }) // Member endpoint
        .mockResolvedValueOnce({ data: mockAllRoles }); // Roles endpoint

      const roles = await discordOAuth.getGuildRolesWithOAuth('guild123', 'oauth_token');

      expect(roles).toHaveLength(2);
      expect(roles.map(r => r.id)).toEqual(['role1', 'role2']);
    });

    it('should fallback to minimal role data if bot token unavailable', async () => {
      delete process.env.DISCORD_BOT_TOKEN;

      const mockMember = {
        roles: ['role1', 'role2']
      };

      (axios.get as any).mockResolvedValue({ data: mockMember });

      const roles = await discordOAuth.getGuildRolesWithOAuth('guild123', 'oauth_token');

      expect(roles).toHaveLength(2);
      expect(roles[0]).toMatchObject({
        id: 'role1',
        name: expect.stringContaining('Role'),
        color: 0,
        position: 0
      });
    });

    it('should handle user not in guild', async () => {
      (axios.get as any).mockRejectedValue({
        response: { status: 403 }
      });

      await expect(
        discordOAuth.getGuildRolesWithOAuth('guild123', 'oauth_token')
      ).rejects.toThrow('not a member');
    });
  });

  describe('Guild Members', () => {
    it('should fetch guild members', async () => {
      const mockMembers = [
        {
          user: { id: 'user1', username: 'User1' },
          nick: null,
          roles: ['role1'],
          joined_at: '2025-01-01T00:00:00Z'
        },
        {
          user: { id: 'user2', username: 'User2' },
          nick: 'Nickname',
          roles: ['role1', 'role2'],
          joined_at: '2025-01-02T00:00:00Z'
        }
      ];

      (axios.get as any).mockResolvedValue({ data: mockMembers });

      const members = await discordOAuth.getGuildMembers('guild123', 'bot_token', 100);

      expect(axios.get).toHaveBeenCalledWith(
        'https://discord.com/api/v10/guilds/guild123/members',
        {
          headers: { Authorization: 'Bot bot_token' },
          params: { limit: 100 }
        }
      );

      expect(members).toEqual(mockMembers);
    });

    it('should use default limit of 1000', async () => {
      (axios.get as any).mockResolvedValue({ data: [] });

      await discordOAuth.getGuildMembers('guild123', 'bot_token');

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: { limit: 1000 }
        })
      );
    });
  });

  describe('Bot Guild Membership Check', () => {
    it('should return true if bot is in guild', async () => {
      (axios.get as any).mockResolvedValue({
        data: { id: 'guild123', name: 'Test Guild' }
      });

      const isInGuild = await discordOAuth.isBotInGuild('guild123', 'bot_token');

      expect(isInGuild).toBe(true);
    });

    it('should return false if bot is not in guild', async () => {
      (axios.get as any).mockRejectedValue({
        response: { status: 404 }
      });

      const isInGuild = await discordOAuth.isBotInGuild('guild123', 'bot_token');

      expect(isInGuild).toBe(false);
    });

    it('should throw error for non-404 errors', async () => {
      (axios.get as any).mockRejectedValue({
        response: {
          status: 403,
          data: { message: 'Missing permissions' }
        }
      });

      await expect(
        discordOAuth.isBotInGuild('guild123', 'bot_token')
      ).rejects.toThrow('Missing permissions');
    });
  });

  describe('Token Refresh', () => {
    it('should refresh access token', async () => {
      const mockRefreshResponse = {
        access_token: 'new_access_token',
        token_type: 'Bearer',
        expires_in: 604800,
        refresh_token: 'new_refresh_token',
        scope: 'identify guilds'
      };

      (axios.post as any).mockResolvedValue({ data: mockRefreshResponse });

      const result = await discordOAuth.refreshToken('old_refresh_token');

      expect(axios.post).toHaveBeenCalledWith(
        'https://discord.com/api/v10/oauth2/token',
        expect.stringContaining('grant_type=refresh_token'),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        })
      );

      expect(result).toEqual(mockRefreshResponse);
    });

    it('should handle invalid refresh token', async () => {
      (axios.post as any).mockRejectedValue({
        response: {
          data: { error_description: 'Invalid refresh token' }
        }
      });

      await expect(
        discordOAuth.refreshToken('invalid_token')
      ).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('Individual Guild Member', () => {
    it('should fetch specific guild member by user ID', async () => {
      const mockMember = {
        user: { id: 'user123', username: 'TestUser' },
        nick: 'Nickname',
        roles: ['role1', 'role2'],
        joined_at: '2025-01-01T00:00:00Z'
      };

      (axios.get as any).mockResolvedValue({ data: mockMember });

      const member = await discordOAuth.getGuildMember('guild123', 'user123', 'bot_token');

      expect(axios.get).toHaveBeenCalledWith(
        'https://discord.com/api/v10/guilds/guild123/members/user123',
        {
          headers: { Authorization: 'Bot bot_token' }
        }
      );

      expect(member).toEqual(mockMember);
    });

    it('should handle member not found in guild', async () => {
      (axios.get as any).mockRejectedValue({
        response: { status: 404 }
      });

      await expect(
        discordOAuth.getGuildMember('guild123', 'user999', 'bot_token')
      ).rejects.toThrow('Member not found in guild');
    });
  });

  describe('User Guild Member Details', () => {
    it('should fetch current user member details in guild', async () => {
      const mockMember = {
        user: { id: 'user123' },
        roles: ['role1', 'role2'],
        nick: 'MyNickname',
        joined_at: '2025-01-01T00:00:00Z'
      };

      (axios.get as any).mockResolvedValue({ data: mockMember });

      const member = await discordOAuth.getUserGuildMember('guild123', 'oauth_token');

      expect(axios.get).toHaveBeenCalledWith(
        'https://discord.com/api/v10/users/@me/guilds/guild123/member',
        {
          headers: { Authorization: 'Bearer oauth_token' }
        }
      );

      expect(member).toEqual(mockMember);
    });

    it('should handle user not member of guild', async () => {
      (axios.get as any).mockRejectedValue({
        response: { status: 403 }
      });

      await expect(
        discordOAuth.getUserGuildMember('guild123', 'oauth_token')
      ).rejects.toThrow('User is not a member of this guild');
    });

    it('should handle guild not found', async () => {
      (axios.get as any).mockRejectedValue({
        response: { status: 404 }
      });

      await expect(
        discordOAuth.getUserGuildMember('guild123', 'oauth_token')
      ).rejects.toThrow('Guild not found');
    });
  });

  describe('Environment Variable Handling', () => {
    it('should read credentials from environment variables', () => {
      const { url } = discordOAuth.generateAuthUrl();

      expect(url).toContain('client_id=test_client_id_123');
    });

    it('should handle missing credentials gracefully', () => {
      delete process.env.DISCORD_CLIENT_ID;
      delete process.env.DISCORD_CLIENT_SECRET;

      const service = new DiscordOAuthService();
      const { url } = service.generateAuthUrl();

      expect(url).toContain('client_id=');
    });

    it('should use default redirect URI if not set', () => {
      delete process.env.DISCORD_REDIRECT_URI;

      const service = new DiscordOAuthService();
      const { url } = service.generateAuthUrl();

      expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A5173%2Fsetup%2Fdiscord%2Fcallback');
    });
  });
});
