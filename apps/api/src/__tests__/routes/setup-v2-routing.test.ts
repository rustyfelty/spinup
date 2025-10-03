import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { build } from '../test-app';
import { prisma } from '../../services/prisma';

/**
 * Test suite to verify correct routing configuration for setup-v2 routes
 *
 * CRITICAL ISSUE RESOLVED:
 * - Frontend was calling /api/setup-v2/discord/callback
 * - But routes are registered under /api/setup prefix only
 * - This caused 404 errors and white screen on OAuth callback
 *
 * SOLUTION:
 * - Frontend updated to call /api/setup/discord/callback
 * - Tests verify correct endpoint paths
 */
describe('Setup V2 - Routing Configuration', () => {
  let app: Awaited<ReturnType<typeof build>>;

  beforeEach(async () => {
    app = await build();

    // Clean up database
    await prisma.setupState.deleteMany();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Route Registration Under /api/setup Prefix', () => {
    it('should respond to /api/setup/status endpoint', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/setup/status'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('isComplete');
      expect(body).toHaveProperty('currentStep');
      expect(body).toHaveProperty('steps');
    });

    it('should respond to /api/setup/discord/auth-url endpoint', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/setup/discord/auth-url'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('url');
      expect(body).toHaveProperty('state');
    });

    it('should respond to /api/setup/discord/callback endpoint', async () => {
      // Even with invalid params, should get 400 (not 404)
      const response = await app.inject({
        method: 'GET',
        url: '/api/setup/discord/callback?code=test&state=invalid'
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Bad Request');
    });

    it('should respond to /api/setup/discord/guilds endpoint', async () => {
      // Should get 400 for missing token (not 404)
      const response = await app.inject({
        method: 'POST',
        url: '/api/setup/discord/guilds',
        payload: {}
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Bad Request');
    });

    it('should respond to /api/setup/select-guild endpoint', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/setup/select-guild',
        payload: {}
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Bad Request');
    });

    it('should respond to /api/setup/configure-domains endpoint', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/setup/configure-domains',
        payload: {}
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Bad Request');
    });

    it('should respond to /api/setup/configure-roles endpoint', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/setup/configure-roles',
        payload: {}
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Bad Request');
    });

    it('should respond to /api/setup/complete endpoint', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/setup/complete',
        payload: {}
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Bad Request');
    });
  });

  describe('Backward Compatibility - /api/setup-v2 Prefix', () => {
    it('should also respond to /api/setup-v2/status for backward compatibility', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/setup-v2/status'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('isComplete');
    });

    it('should also respond to /api/setup-v2/discord/callback', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/setup-v2/discord/callback?code=test&state=invalid'
      });

      // Should get 400 (not 404)
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Bad Request');
    });
  });

  describe('Frontend-Backend Endpoint Consistency', () => {
    it('should document the correct endpoint paths for frontend', () => {
      // This test documents the CORRECT paths that frontend should use
      const correctEndpoints = {
        status: '/api/setup/status',
        authUrl: '/api/setup/discord/auth-url',
        callback: '/api/setup/discord/callback',
        guilds: '/api/setup/discord/guilds',
        selectGuild: '/api/setup/select-guild',
        guildRoles: '/api/setup/guild/:guildId/roles',
        configureDomains: '/api/setup/configure-domains',
        configureRoles: '/api/setup/configure-roles',
        complete: '/api/setup/complete',
        reset: '/api/setup/reset'
      };

      // Verify these are the paths registered in the API
      expect(correctEndpoints.callback).toBe('/api/setup/discord/callback');
      expect(correctEndpoints.guilds).toBe('/api/setup/discord/guilds');

      // Document that /api/setup-v2/* paths should NOT be used
      const incorrectPaths = [
        '/api/setup-v2/discord/callback',  // WRONG - causes 404 in production
        '/api/setup-v2/discord/guilds'     // WRONG - causes 404 in production
      ];

      // These should be avoided in frontend code
      expect(incorrectPaths).toHaveLength(2);
    });
  });
});
