import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import { aiRoutes, clearRateLimits, setAiServiceOverride } from '../../routes/ai';
import { prisma } from '../../services/prisma';

describe('AI Routes - TDD Implementation', () => {
  let app: FastifyInstance;
  let testToken: string;
  const testUserId = 'test-user-ai';
  const testOrgId = 'test-org-ai';

  beforeAll(async () => {
    app = Fastify({ logger: false });

    // Register plugins
    await app.register(jwt, { secret: 'test-secret' });
    await app.register(cookie);

    // Register routes
    await app.register(aiRoutes, { prefix: '/api/ai' });

    await app.ready();

    // Create test token
    testToken = app.jwt.sign({ sub: testUserId, org: testOrgId });

    // Create test org - ensure it exists before any dependent operations
    try {
      await prisma.org.upsert({
        where: { id: testOrgId },
        create: { id: testOrgId, discordGuild: 'test-ai-guild', name: 'Test AI Org' },
        update: {},
      });
    } catch (error) {
      console.error('Failed to create test org:', error);
      throw error;
    }
  });

  beforeEach(() => {
    // Clear rate limits before each test to prevent interference
    clearRateLimits();
  });

  afterEach(() => {
    // Clear any AI service override after each test
    setAiServiceOverride(null);
  });

  afterAll(async () => {
    // Clean up in reverse order - delete dependent entities first
    try {
      // Delete any servers created during tests
      await prisma.server.deleteMany({ where: { orgId: testOrgId } });
      // Delete org last
      await prisma.org.deleteMany({ where: { id: testOrgId } });
    } catch (error) {
      console.error('Failed to clean up test data:', error);
    }
    await app.close();
  });

  describe('POST /api/ai/chat', () => {
    it('should require authentication', async () => {
      // RED: This test should fail initially
      const response = await app.inject({
        method: 'POST',
        url: '/api/ai/chat',
        payload: {
          message: 'Hello AI',
          context: 'server-management',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body)).toHaveProperty('error', 'Unauthorized');
    });

    it('should validate request payload', async () => {
      // RED: Payload validation not implemented
      const response = await app.inject({
        method: 'POST',
        url: '/api/ai/chat',
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        payload: {
          // Missing required fields
        },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toHaveProperty('error', 'Bad Request');
    });

    it('should handle AI chat requests with valid auth', async () => {
      // RED: Endpoint not implemented
      const response = await app.inject({
        method: 'POST',
        url: '/api/ai/chat',
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        payload: {
          message: 'How do I configure my Minecraft server?',
          context: 'server-config',
          serverId: 'test-server-123',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('response');
      expect(data).toHaveProperty('conversationId');
    });

    it('should enforce rate limiting per user', async () => {
      // RED: Rate limiting not implemented
      const requests = Array(10).fill(null).map(() =>
        app.inject({
          method: 'POST',
          url: '/api/ai/chat',
          headers: {
            authorization: `Bearer ${testToken}`,
          },
          payload: {
            message: 'Test message',
            context: 'test',
          },
        })
      );

      const responses = await Promise.all(requests);
      const tooManyRequests = responses.filter(r => r.statusCode === 429);

      expect(tooManyRequests.length).toBeGreaterThan(0);
    });

    it('should persist conversation context', async () => {
      // RED: Context persistence not implemented
      // First message
      const firstResponse = await app.inject({
        method: 'POST',
        url: '/api/ai/chat',
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        payload: {
          message: 'My server name is TestCraft',
          context: 'server-config',
        },
      });

      expect(firstResponse.statusCode).toBe(200);
      const { conversationId } = JSON.parse(firstResponse.body);

      // Follow-up message should remember context
      const secondResponse = await app.inject({
        method: 'POST',
        url: '/api/ai/chat',
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        payload: {
          message: 'What is my server name?',
          conversationId,
        },
      });

      expect(secondResponse.statusCode).toBe(200);
      const data = JSON.parse(secondResponse.body);
      expect(data.response).toContain('TestCraft');
    });
  });

  describe('GET /api/ai/suggestions', () => {
    it('should provide contextual suggestions based on server state', async () => {
      // RED: Suggestions endpoint not implemented
      const response = await app.inject({
        method: 'GET',
        url: '/api/ai/suggestions',
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        query: {
          serverId: 'test-server-123',
          context: 'server-stopped',
        },
      });

      expect(response.statusCode).toBe(200);
      const suggestions = JSON.parse(response.body);
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toHaveProperty('action');
      expect(suggestions[0]).toHaveProperty('description');
    });
  });

  describe('POST /api/ai/analyze-logs', () => {
    it('should analyze server logs for issues', async () => {
      // RED: Log analysis not implemented
      const mockLogs = `
        [ERROR] Server crashed due to out of memory
        [WARN] Player connection timeout
        [INFO] Server started successfully
      `;

      const response = await app.inject({
        method: 'POST',
        url: '/api/ai/analyze-logs',
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        payload: {
          serverId: 'test-server-123',
          logs: mockLogs,
        },
      });

      expect(response.statusCode).toBe(200);
      const analysis = JSON.parse(response.body);
      expect(analysis).toHaveProperty('issues');
      expect(analysis).toHaveProperty('recommendations');
      expect(analysis.issues).toContain('memory');
    });
  });

  describe('Model Selection', () => {
    it('should allow switching between AI models', async () => {
      // RED: Model selection not implemented
      const response = await app.inject({
        method: 'POST',
        url: '/api/ai/chat',
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        payload: {
          message: 'Test message',
          context: 'test',
          model: 'gpt-4', // Specify model
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('model', 'gpt-4');
    });
  });

  describe('Error Handling', () => {
    it('should gracefully handle AI service failures', async () => {
      // RED: Error handling not robust
      // Mock AI service failure by injecting an override that throws
      setAiServiceOverride(async () => {
        throw new Error('AI service unavailable');
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/ai/chat',
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        payload: {
          message: 'Test message',
          context: 'test',
        },
      });

      expect(response.statusCode).toBe(503);
      const error = JSON.parse(response.body);
      expect(error).toHaveProperty('error', 'Service Unavailable');
      expect(error).toHaveProperty('message');
    });

    it('should handle token limit exceeded', async () => {
      // RED: Token limit handling not implemented
      const longMessage = 'x'.repeat(10000); // Very long message

      const response = await app.inject({
        method: 'POST',
        url: '/api/ai/chat',
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        payload: {
          message: longMessage,
          context: 'test',
        },
      });

      expect(response.statusCode).toBe(400);
      const error = JSON.parse(response.body);
      expect(error.message).toContain('token limit');
    });
  });

  describe('Security', () => {
    it('should sanitize user input to prevent injection', async () => {
      // RED: Input sanitization not implemented
      const maliciousInput = '<script>alert("XSS")</script>';

      const response = await app.inject({
        method: 'POST',
        url: '/api/ai/chat',
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        payload: {
          message: maliciousInput,
          context: 'test',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.response).not.toContain('<script>');
    });

    it('should validate server ownership before providing server-specific AI help', async () => {
      // RED: Ownership validation not implemented
      const response = await app.inject({
        method: 'POST',
        url: '/api/ai/chat',
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        payload: {
          message: 'Show me the config',
          context: 'server-config',
          serverId: 'unauthorized-server-456', // User doesn't own this server
        },
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.body)).toHaveProperty('error', 'Forbidden');
    });
  });
});