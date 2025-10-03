import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { build } from '../test-app';
import { prisma } from '../../services/prisma';
import { discordOAuth } from '../../services/discord-oauth';
import { oauthSessionManager } from '../../services/oauth-session-manager';

// Mock the discord OAuth service
vi.mock('../../services/discord-oauth', () => ({
  discordOAuth: {
    generateAuthUrl: vi.fn(),
    exchangeCode: vi.fn(),
    getUser: vi.fn(),
    getUserGuilds: vi.fn()
  }
}));

describe('Setup V2 - OAuth Callback Flow', () => {
  let app: Awaited<ReturnType<typeof build>>;

  beforeEach(async () => {
    app = await build();

    // Clean up database
    await prisma.setupState.deleteMany();

    // Clear session manager
    oauthSessionManager.clearAllSessions();

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/setup/discord/auth-url (CORRECT PATH)', () => {
    it('should generate OAuth authorization URL', async () => {
      vi.mocked(discordOAuth.generateAuthUrl).mockReturnValue({
        url: 'https://discord.com/api/oauth2/authorize?client_id=123&redirect_uri=http://localhost:5173/setup-wizard&response_type=code&scope=identify%20guilds%20guilds.members.read&state=test_state_123',
        state: 'test_state_123'
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/setup/discord/auth-url'
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.url).toContain('discord.com/api/oauth2/authorize');
      expect(body.url).toContain('client_id');
      expect(body.url).toContain('scope=identify');
      expect(body.state).toBeDefined();
      expect(body.state).toHaveLength(64); // 32 bytes hex
    });

    it('should handle service errors', async () => {
      vi.mocked(discordOAuth.generateAuthUrl).mockImplementation(() => {
        throw new Error('Service unavailable');
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/setup/discord/auth-url'
      });

      expect(response.statusCode).toBe(500);

      const body = JSON.parse(response.body);
      expect(body.error).toBe('Internal Server Error');
    });
  });

  describe('GET /api/setup/discord/callback (CORRECT PATH)', () => {
    it('should handle successful OAuth callback', async () => {
      // First, generate auth URL to get a valid state
      vi.mocked(discordOAuth.generateAuthUrl).mockReturnValue({
        url: 'https://discord.com/oauth2/authorize',
        state: 'valid_state_token'
      });

      const authUrlResponse = await app.inject({
        method: 'GET',
        url: '/api/setup/discord/auth-url'
      });

      const { state } = JSON.parse(authUrlResponse.body);

      // Mock Discord API responses
      vi.mocked(discordOAuth.exchangeCode).mockResolvedValue({
        access_token: 'mock_access_token',
        token_type: 'Bearer',
        expires_in: 604800,
        refresh_token: 'mock_refresh_token',
        scope: 'identify guilds'
      });

      vi.mocked(discordOAuth.getUser).mockResolvedValue({
        id: '123456789012345678',
        username: 'testuser',
        discriminator: '0001',
        avatar: 'avatar_hash'
      });

      // Make callback request
      const response = await app.inject({
        method: 'GET',
        url: `/api/setup/discord/callback?code=test_code&state=${state}`
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.sessionToken).toBeDefined();
      expect(body.sessionToken).toHaveLength(64); // 32 bytes hex
      expect(body.user).toEqual({
        id: '123456789012345678',
        username: 'testuser',
        discriminator: '0001',
        avatar: 'avatar_hash'
      });

      // Verify session was created
      const session = oauthSessionManager.getSession(body.sessionToken);
      expect(session).toBeDefined();
      expect(session?.userId).toBe('123456789012345678');
      expect(session?.accessToken).toBe('mock_access_token');
      expect(session?.refreshToken).toBe('mock_refresh_token');

      // Verify oauthConfigured was set in database
      const setupState = await prisma.setupState.findUnique({
        where: { id: 'singleton' }
      });
      expect(setupState?.oauthConfigured).toBe(true);
    });

    it('should reject callback without code parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/setup/discord/callback?state=some_state'
      });

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.error).toBe('Bad Request');
      expect(body.message).toContain('code');
    });

    it('should reject callback without state parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/setup/discord/callback?code=test_code'
      });

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.error).toBe('Bad Request');
      expect(body.message).toContain('state');
    });

    it('should reject callback with invalid state', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/setup/discord/callback?code=test_code&state=invalid_state'
      });

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.error).toBe('Bad Request');
      expect(body.message).toContain('Invalid or expired state');
    });

    it('should handle Discord API errors during token exchange', async () => {
      // Generate valid state first
      vi.mocked(discordOAuth.generateAuthUrl).mockReturnValue({
        url: 'https://discord.com/oauth2/authorize',
        state: 'valid_state_token'
      });

      const authUrlResponse = await app.inject({
        method: 'GET',
        url: '/api/setup/discord/auth-url'
      });

      const { state } = JSON.parse(authUrlResponse.body);

      // Mock exchange code to fail
      vi.mocked(discordOAuth.exchangeCode).mockRejectedValue(
        new Error('Invalid authorization code')
      );

      const response = await app.inject({
        method: 'GET',
        url: `/api/setup/discord/callback?code=invalid_code&state=${state}`
      });

      expect(response.statusCode).toBe(500);

      const body = JSON.parse(response.body);
      expect(body.error).toBe('Internal Server Error');
      expect(body.message).toContain('OAuth flow');
    });

    it('should handle Discord API errors during user fetch', async () => {
      // Generate valid state first
      vi.mocked(discordOAuth.generateAuthUrl).mockReturnValue({
        url: 'https://discord.com/oauth2/authorize',
        state: 'valid_state_token'
      });

      const authUrlResponse = await app.inject({
        method: 'GET',
        url: '/api/setup/discord/auth-url'
      });

      const { state } = JSON.parse(authUrlResponse.body);

      // Mock successful token exchange but failed user fetch
      vi.mocked(discordOAuth.exchangeCode).mockResolvedValue({
        access_token: 'mock_access_token',
        token_type: 'Bearer',
        expires_in: 604800,
        refresh_token: 'mock_refresh_token',
        scope: 'identify guilds'
      });

      vi.mocked(discordOAuth.getUser).mockRejectedValue(
        new Error('Failed to fetch user')
      );

      const response = await app.inject({
        method: 'GET',
        url: `/api/setup/discord/callback?code=test_code&state=${state}`
      });

      expect(response.statusCode).toBe(500);

      const body = JSON.parse(response.body);
      expect(body.error).toBe('Internal Server Error');
    });
  });

  describe('POST /api/setup/discord/guilds (CORRECT PATH)', () => {
    it('should fetch user guilds with valid session', async () => {
      // Create a session manually
      const session = oauthSessionManager.createSession({
        userId: '123456789012345678',
        accessToken: 'valid_access_token',
        refreshToken: 'valid_refresh_token',
        expiresIn: 3600
      });

      // Mock Discord API
      vi.mocked(discordOAuth.getUserGuilds).mockResolvedValue([
        {
          id: '987654321098765432',
          name: 'Test Guild',
          icon: 'icon_hash',
          owner: true,
          permissions: '2147483647',
          features: []
        }
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/setup/discord/guilds',
        payload: {
          sessionToken: session.sessionToken
        }
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.guilds).toBeDefined();
      expect(body.guilds).toHaveLength(1);
      expect(body.guilds[0]).toMatchObject({
        id: '987654321098765432',
        name: 'Test Guild',
        owner: true
      });
    });

    it('should reject request without session token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/setup/discord/guilds',
        payload: {}
      });

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.error).toBe('Bad Request');
      expect(body.message).toContain('Session token is required');
    });

    it('should reject request with invalid session token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/setup/discord/guilds',
        payload: {
          sessionToken: 'invalid_token_12345'
        }
      });

      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.body);
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toContain('Invalid or expired');
    });

    it('should reject request with expired session token', async () => {
      // Create an expired session
      const session = oauthSessionManager.createSession({
        userId: '123456789012345678',
        accessToken: 'expired_token',
        refreshToken: 'expired_refresh',
        expiresIn: -1 // Already expired
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/setup/discord/guilds',
        payload: {
          sessionToken: session.sessionToken
        }
      });

      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.body);
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toContain('Invalid or expired');
    });

    it('should handle Discord API errors', async () => {
      // Create a valid session
      const session = oauthSessionManager.createSession({
        userId: '123456789012345678',
        accessToken: 'valid_access_token',
        refreshToken: 'valid_refresh_token',
        expiresIn: 3600
      });

      // Mock Discord API to fail
      vi.mocked(discordOAuth.getUserGuilds).mockRejectedValue(
        new Error('Discord API error')
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/setup/discord/guilds',
        payload: {
          sessionToken: session.sessionToken
        }
      });

      expect(response.statusCode).toBe(500);

      const body = JSON.parse(response.body);
      expect(body.error).toBe('Internal Server Error');
    });
  });
});
