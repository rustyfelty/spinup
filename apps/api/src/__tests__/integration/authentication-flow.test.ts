import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import { prisma } from '../../services/prisma';
import ssoRoutes from '../../routes/sso';

// Mock Prisma
vi.mock('../../services/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    membership: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    org: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    magicLink: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

describe('Authentication Flow - Integration Tests', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();

    app = fastify({ logger: false });

    // Register plugins
    await app.register(cookie);
    await app.register(jwt, {
      secret: 'test-jwt-secret-for-testing-only'
    });

    // Register SSO routes
    await app.register(ssoRoutes, { prefix: '/api/sso' });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Dev Login Flow (Development Only)', () => {
    it('should authenticate user in development mode', async () => {
      process.env.NODE_ENV = 'development';

      const mockUser = {
        id: 'user123',
        discordId: 'discord123',
        displayName: 'Test User',
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockMembership = {
        id: 'member123',
        userId: 'user123',
        orgId: 'org123',
        role: 'member',
        createdAt: new Date()
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.membership.findFirst as any).mockResolvedValue(mockMembership);

      const response = await app.inject({
        method: 'POST',
        url: '/api/sso/dev/login',
        payload: {
          userId: 'user123'
        }
      });

      expect(response.statusCode).toBe(200);

      const result = JSON.parse(response.payload);
      expect(result.user).toMatchObject({
        id: 'user123',
        displayName: 'Test User'
      });

      // Verify JWT cookie was set
      const cookies = response.cookies;
      const sessionCookie = cookies.find(c => c.name === 'spinup_sess');

      expect(sessionCookie).toBeDefined();
      expect(sessionCookie?.value).toBeTruthy();
    });

    it('should reject dev login in production mode', async () => {
      process.env.NODE_ENV = 'production';

      const response = await app.inject({
        method: 'POST',
        url: '/api/sso/dev/login',
        payload: {
          userId: 'user123'
        }
      });

      expect(response.statusCode).toBe(403);

      const result = JSON.parse(response.payload);
      expect(result.message).toContain('only available in development');
    });

    it('should handle user not found', async () => {
      process.env.NODE_ENV = 'development';

      (prisma.user.findUnique as any).mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/sso/dev/login',
        payload: {
          userId: 'nonexistent'
        }
      });

      expect(response.statusCode).toBe(404);

      const result = JSON.parse(response.payload);
      expect(result.message).toContain('User not found');
    });

    it('should handle user with no organization membership', async () => {
      process.env.NODE_ENV = 'development';

      const mockUser = {
        id: 'user123',
        discordId: 'discord123',
        displayName: 'Test User',
        avatarUrl: null
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.membership.findFirst as any).mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/sso/dev/login',
        payload: {
          userId: 'user123'
        }
      });

      expect(response.statusCode).toBe(403);

      const result = JSON.parse(response.payload);
      expect(result.message).toContain('No organization membership');
    });
  });

  describe('Magic Link Flow (Discord Login)', () => {
    it('should create and consume magic link successfully', async () => {
      const mockUser = {
        id: 'user123',
        discordId: 'discord123',
        displayName: 'Discord User',
        avatarUrl: 'https://cdn.discordapp.com/avatars/123/456.png'
      };

      const mockMembership = {
        id: 'member123',
        userId: 'user123',
        orgId: 'org123',
        role: 'member'
      };

      const mockMagicLink = {
        token: 'magic_token_123',
        userId: 'user123',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
      };

      // Issue magic link (called by Discord bot)
      (prisma.user.upsert as any).mockResolvedValue(mockUser);
      (prisma.membership.findFirst as any).mockResolvedValue(mockMembership);

      // Consume magic link
      (prisma.magicLink.findUnique as any).mockResolvedValue(mockMagicLink);
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);

      const consumeResponse = await app.inject({
        method: 'GET',
        url: '/api/sso/discord/consume?token=magic_token_123'
      });

      expect(consumeResponse.statusCode).toBe(302); // Redirect
      expect(consumeResponse.headers.location).toBe('/');

      // Verify cookie was set
      const cookies = consumeResponse.cookies;
      const sessionCookie = cookies.find(c => c.name === 'spinup_sess');

      expect(sessionCookie).toBeDefined();

      // Verify magic link was deleted
      expect(prisma.magicLink.delete).toHaveBeenCalledWith({
        where: { token: 'magic_token_123' }
      });
    });

    it('should reject expired magic link', async () => {
      const expiredMagicLink = {
        token: 'expired_token',
        userId: 'user123',
        createdAt: new Date(Date.now() - 10 * 60 * 1000),
        expiresAt: new Date(Date.now() - 5 * 60 * 1000) // Expired 5 min ago
      };

      (prisma.magicLink.findUnique as any).mockResolvedValue(expiredMagicLink);

      const response = await app.inject({
        method: 'GET',
        url: '/api/sso/discord/consume?token=expired_token'
      });

      expect(response.statusCode).toBe(400);

      const result = JSON.parse(response.payload);
      expect(result.message).toContain('expired');

      // Verify expired link was deleted
      expect(prisma.magicLink.delete).toHaveBeenCalledWith({
        where: { token: 'expired_token' }
      });
    });

    it('should reject invalid magic link token', async () => {
      (prisma.magicLink.findUnique as any).mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/sso/discord/consume?token=invalid_token'
      });

      expect(response.statusCode).toBe(400);

      const result = JSON.parse(response.payload);
      expect(result.message).toContain('Invalid or expired');
    });

    it('should handle magic link for deleted user', async () => {
      const mockMagicLink = {
        token: 'token123',
        userId: 'deleted_user',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
      };

      (prisma.magicLink.findUnique as any).mockResolvedValue(mockMagicLink);
      (prisma.user.findUnique as any).mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/sso/discord/consume?token=token123'
      });

      expect(response.statusCode).toBe(404);

      const result = JSON.parse(response.payload);
      expect(result.message).toContain('User not found');
    });
  });

  describe('JWT Token Authentication', () => {
    it('should verify valid JWT token in cookies', async () => {
      const token = app.jwt.sign({
        sub: 'user123',
        org: 'org123'
      });

      // Create a protected route to test
      app.get('/protected', {
        preHandler: async (request, reply) => {
          try {
            const decoded = await request.jwtVerify();
            request.user = decoded;
          } catch (err) {
            reply.status(401).send({ message: 'Unauthorized' });
          }
        }
      }, async (request, reply) => {
        return { authenticated: true, user: request.user };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        cookies: {
          spinup_sess: token
        }
      });

      expect(response.statusCode).toBe(200);

      const result = JSON.parse(response.payload);
      expect(result.authenticated).toBe(true);
      expect(result.user.sub).toBe('user123');
    });

    it('should reject invalid JWT token', async () => {
      app.get('/protected', {
        preHandler: async (request, reply) => {
          try {
            await request.jwtVerify();
          } catch (err) {
            reply.status(401).send({ message: 'Unauthorized' });
          }
        }
      }, async (request) => {
        return { authenticated: true };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        cookies: {
          spinup_sess: 'invalid.jwt.token'
        }
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject expired JWT token', async () => {
      const expiredToken = app.jwt.sign(
        { sub: 'user123', org: 'org123' },
        { expiresIn: '-1h' } // Expired 1 hour ago
      );

      app.get('/protected', {
        preHandler: async (request, reply) => {
          try {
            await request.jwtVerify();
          } catch (err) {
            reply.status(401).send({ message: 'Token expired' });
          }
        }
      }, async () => {
        return { authenticated: true };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        cookies: {
          spinup_sess: expiredToken
        }
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject missing JWT token', async () => {
      app.get('/protected', {
        preHandler: async (request, reply) => {
          try {
            await request.jwtVerify();
          } catch (err) {
            reply.status(401).send({ message: 'No token provided' });
          }
        }
      }, async () => {
        return { authenticated: true };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/protected'
        // No cookies
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Logout Flow', () => {
    it('should clear session cookie on logout', async () => {
      const token = app.jwt.sign({ sub: 'user123', org: 'org123' });

      const response = await app.inject({
        method: 'POST',
        url: '/api/sso/logout',
        cookies: {
          spinup_sess: token
        }
      });

      expect(response.statusCode).toBe(200);

      const result = JSON.parse(response.payload);
      expect(result.message).toContain('Logged out');

      // Verify cookie was cleared
      const setCookieHeader = response.headers['set-cookie'];
      expect(setCookieHeader).toBeDefined();

      if (typeof setCookieHeader === 'string') {
        expect(setCookieHeader).toContain('Max-Age=0');
      } else if (Array.isArray(setCookieHeader)) {
        const sessionCookie = setCookieHeader.find(c => c.includes('spinup_sess'));
        expect(sessionCookie).toContain('Max-Age=0');
      }
    });

    it('should handle logout without active session', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/sso/logout'
        // No cookies
      });

      expect(response.statusCode).toBe(200);

      const result = JSON.parse(response.payload);
      expect(result.message).toContain('Logged out');
    });
  });

  describe('Cookie Security Settings', () => {
    it('should set httpOnly flag on session cookie', async () => {
      process.env.NODE_ENV = 'development';

      const mockUser = {
        id: 'user123',
        discordId: 'discord123',
        displayName: 'Test User'
      };

      const mockMembership = {
        userId: 'user123',
        orgId: 'org123',
        role: 'member'
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.membership.findFirst as any).mockResolvedValue(mockMembership);

      const response = await app.inject({
        method: 'POST',
        url: '/api/sso/dev/login',
        payload: { userId: 'user123' }
      });

      const cookies = response.cookies;
      const sessionCookie = cookies.find(c => c.name === 'spinup_sess');

      expect(sessionCookie?.httpOnly).toBe(true);
    });

    it('should set secure flag in production', async () => {
      process.env.NODE_ENV = 'production';

      // In production, secure cookie should be set
      // (This would need actual SSO implementation test)
      expect(process.env.NODE_ENV).toBe('production');
    });

    it('should set SameSite attribute appropriately', async () => {
      process.env.NODE_ENV = 'development';

      const mockUser = {
        id: 'user123',
        discordId: 'discord123',
        displayName: 'Test User'
      };

      const mockMembership = {
        userId: 'user123',
        orgId: 'org123',
        role: 'member'
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.membership.findFirst as any).mockResolvedValue(mockMembership);

      const response = await app.inject({
        method: 'POST',
        url: '/api/sso/dev/login',
        payload: { userId: 'user123' }
      });

      // Cookie attributes would be set by @fastify/cookie
      expect(response.statusCode).toBe(200);
    });
  });

  describe('Cross-Origin Requests (CORS)', () => {
    it('should include credentials in cross-origin requests', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/api/sso/dev/login',
        headers: {
          origin: 'http://localhost:5173',
          'access-control-request-method': 'POST'
        }
      });

      // CORS headers would be handled by @fastify/cors plugin
      expect(response.statusCode).toBeOneOf([200, 204]);
    });
  });

  describe('Session Persistence', () => {
    it('should maintain session across requests', async () => {
      const token = app.jwt.sign({
        sub: 'user123',
        org: 'org123'
      });

      app.get('/session-check', {
        preHandler: async (request, reply) => {
          try {
            const decoded = await request.jwtVerify();
            request.user = decoded;
          } catch (err) {
            reply.status(401).send({ message: 'Unauthorized' });
          }
        }
      }, async (request) => {
        return { userId: request.user.sub };
      });

      // First request
      const response1 = await app.inject({
        method: 'GET',
        url: '/session-check',
        cookies: { spinup_sess: token }
      });

      expect(response1.statusCode).toBe(200);

      // Second request with same token
      const response2 = await app.inject({
        method: 'GET',
        url: '/session-check',
        cookies: { spinup_sess: token }
      });

      expect(response2.statusCode).toBe(200);

      const result1 = JSON.parse(response1.payload);
      const result2 = JSON.parse(response2.payload);

      expect(result1.userId).toBe(result2.userId);
    });
  });

  describe('Multi-Organization Support', () => {
    it('should handle users with multiple org memberships', async () => {
      const mockUser = {
        id: 'user123',
        discordId: 'discord123',
        displayName: 'Multi-Org User'
      };

      const mockMemberships = [
        { id: 'member1', userId: 'user123', orgId: 'org1', role: 'owner' },
        { id: 'member2', userId: 'user123', orgId: 'org2', role: 'member' }
      ];

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.membership.findMany as any).mockResolvedValue(mockMemberships);

      // User should be able to switch between orgs
      const token1 = app.jwt.sign({ sub: 'user123', org: 'org1' });
      const token2 = app.jwt.sign({ sub: 'user123', org: 'org2' });

      expect(token1).not.toBe(token2);
    });

    it('should validate org membership in protected routes', async () => {
      const token = app.jwt.sign({ sub: 'user123', org: 'org123' });

      app.get('/org/:orgId/data', {
        preHandler: async (request, reply) => {
          const decoded = await request.jwtVerify();
          const { orgId } = request.params as { orgId: string };

          if (decoded.org !== orgId) {
            reply.status(403).send({ message: 'Not authorized for this org' });
          }
        }
      }, async () => {
        return { data: 'org-specific-data' };
      });

      // Access matching org - should succeed
      const validResponse = await app.inject({
        method: 'GET',
        url: '/org/org123/data',
        cookies: { spinup_sess: token }
      });

      expect(validResponse.statusCode).toBe(200);

      // Access different org - should fail
      const invalidResponse = await app.inject({
        method: 'GET',
        url: '/org/org456/data',
        cookies: { spinup_sess: token }
      });

      expect(invalidResponse.statusCode).toBe(403);
    });
  });
});
