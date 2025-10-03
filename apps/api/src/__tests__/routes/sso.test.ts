import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import { ssoRoutes } from '../../routes/sso';
import { prisma } from '../../services/prisma';

// Environment variables are set in setup.ts before any modules load
const JWT_SECRET = process.env.API_JWT_SECRET!;
const SERVICE_TOKEN = process.env.SERVICE_TOKEN!;

describe('SSO Routes', () => {
  const app = Fastify();

  beforeAll(async () => {

    await app.register(cookie, { secret: JWT_SECRET });
    await app.register(jwt, {
      secret: JWT_SECRET,
      cookie: {
        cookieName: 'spinup_sess',
        signed: true
      }
    });
    await app.register(ssoRoutes, { prefix: '/api/sso' });
    await app.ready();
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.loginToken.deleteMany({
      where: {
        user: { discordId: { startsWith: 'test-discord-' } },
      },
    });
    await prisma.membership.deleteMany({
      where: {
        user: { discordId: { startsWith: 'test-discord-' } },
      },
    });
    await prisma.user.deleteMany({
      where: { discordId: { startsWith: 'test-discord-' } },
    });
    await prisma.org.deleteMany({
      where: { discordGuild: { startsWith: 'test-guild-' } },
    });
    await app.close();
  });

  describe('POST /api/sso/discord/issue', () => {
    it('should issue magic link with valid service token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/sso/discord/issue',
        headers: {
          authorization: `Bearer ${SERVICE_TOKEN}`,
        },
        payload: {
          discordUserId: 'test-discord-user-1',
          discordGuildId: 'test-guild-sso-1',
          displayName: 'Test User',
          avatarUrl: 'https://example.com/avatar.png',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.magicUrl).toBeDefined();
      expect(data.magicUrl).toContain('token=');

      // Verify user and org were created/updated
      const user = await prisma.user.findUnique({
        where: { discordId: 'test-discord-user-1' },
      });
      expect(user).toBeDefined();
      expect(user?.displayName).toBe('Test User');

      const org = await prisma.org.findUnique({
        where: { discordGuild: 'test-guild-sso-1' },
      });
      expect(org).toBeDefined();
    });

    it('should return 401 with invalid service token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/sso/discord/issue',
        headers: {
          authorization: 'Bearer invalid-token',
        },
        payload: {
          discordUserId: 'test-user',
          discordGuildId: 'test-guild',
          displayName: 'Test',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 with invalid payload', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/sso/discord/issue',
        headers: {
          authorization: `Bearer ${SERVICE_TOKEN}`,
        },
        payload: {
          // Missing required fields
          discordUserId: 'test-user',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should create membership for new user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/sso/discord/issue',
        headers: {
          authorization: `Bearer ${SERVICE_TOKEN}`,
        },
        payload: {
          discordUserId: 'test-discord-user-2',
          discordGuildId: 'test-guild-sso-2',
          displayName: 'New User',
        },
      });

      expect(response.statusCode).toBe(200);

      // Verify membership was created
      const user = await prisma.user.findUnique({
        where: { discordId: 'test-discord-user-2' },
        include: { memberships: true },
      });
      expect(user?.memberships.length).toBeGreaterThan(0);
      expect(user?.memberships[0].role).toBe('OPERATOR');
    });

    it('should create login token with correct expiration', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/sso/discord/issue',
        headers: {
          authorization: `Bearer ${SERVICE_TOKEN}`,
        },
        payload: {
          discordUserId: 'test-discord-user-3',
          discordGuildId: 'test-guild-sso-3',
          displayName: 'Token Test User',
        },
      });

      expect(response.statusCode).toBe(200);

      // Extract token from URL
      const data = JSON.parse(response.body);
      const url = new URL(data.magicUrl);
      const token = url.searchParams.get('token');
      expect(token).toBeDefined();

      // Verify login token in database
      const user = await prisma.user.findUnique({
        where: { discordId: 'test-discord-user-3' },
        include: { loginTokens: true },
      });
      expect(user?.loginTokens.length).toBeGreaterThan(0);

      const loginToken = user?.loginTokens[0];
      const expiresAt = new Date(loginToken!.expiresAt);
      const now = new Date();
      const diffMinutes = (expiresAt.getTime() - now.getTime()) / 1000 / 60;
      expect(diffMinutes).toBeGreaterThan(4);
      expect(diffMinutes).toBeLessThan(6); // Should expire in ~5 minutes
    });
  });

  describe('POST /api/sso/dev/login (development only)', () => {
    it('should create dev session and return user info', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/sso/dev/login',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.success).toBe(true);
      expect(data.user).toBeDefined();
      expect(data.org).toBeDefined();
      expect(data.user.displayName).toBe('Dev User');
      expect(data.org.name).toBe('Development Organization');

      // Verify cookie was set
      const cookies = response.cookies;
      expect(cookies.some((c: any) => c.name === 'spinup_sess')).toBe(true);
    });

    it('should create dev user and org on first call', async () => {
      // Delete if exists
      await prisma.membership.deleteMany({
        where: { user: { discordId: 'dev-user' } },
      });
      await prisma.user.deleteMany({
        where: { discordId: 'dev-user' },
      });
      await prisma.org.deleteMany({
        where: { discordGuild: 'dev-org' },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/sso/dev/login',
      });

      expect(response.statusCode).toBe(200);

      // Verify they were created
      const user = await prisma.user.findUnique({
        where: { discordId: 'dev-user' },
      });
      expect(user).toBeDefined();

      const org = await prisma.org.findUnique({
        where: { discordGuild: 'dev-org' },
      });
      expect(org).toBeDefined();
    });
  });

  describe('POST /api/sso/logout', () => {
    it('should clear session cookie', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/sso/logout',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.success).toBe(true);

      // Verify cookie was cleared
      const setCookieHeader = response.headers['set-cookie'];
      if (typeof setCookieHeader === 'string') {
        expect(setCookieHeader).toContain('spinup_sess=');
      }
    });
  });

  describe('GET /api/sso/me', () => {
    it('should return 401 without valid JWT', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sso/me',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return user info with valid JWT', async () => {
      // First create a dev session
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/sso/dev/login',
      });

      const cookies = loginResponse.cookies;
      const sessionCookie = cookies.find((c: any) => c.name === 'spinup_sess');
      expect(sessionCookie).toBeDefined();

      // Now get user info
      const response = await app.inject({
        method: 'GET',
        url: '/api/sso/me',
        cookies: {
          spinup_sess: sessionCookie!.value,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.user).toBeDefined();
      expect(data.org).toBeDefined();
      expect(data.role).toBeDefined();
    });
  });
});
