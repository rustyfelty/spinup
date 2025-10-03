/**
 * TDD Tests for /api/setup/select-guild endpoint
 *
 * Purpose: Verify that guild selection works with OAuth-only (no bot required)
 * Related: Phase 1.2 of OAuth-first setup refactoring
 *
 * CORRECTED: This test now uses /api/setup/* paths (not /api/setup-v2/*)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:8080';

describe.skip('POST /api/setup/select-guild - OAuth-Only Flow', () => {
  // SKIPPED: Uses axios for integration tests, needs refactoring to use app.inject()
  beforeEach(async () => {
    // Reset setup state before each test
    await prisma.setupState.deleteMany();
    await prisma.setupState.create({
      data: {
        id: 'singleton',
        systemConfigured: true,
        oauthConfigured: true,
        botConfigured: false, // Bot NOT configured
        guildSelected: false,
        rolesConfigured: false
      }
    });
  });

  afterEach(async () => {
    await prisma.setupState.deleteMany();
  });

  describe('Success Cases - OAuth Only', () => {
    it('should allow guild selection without bot configured', async () => {
      const response = await axios.post(`${API_URL}/api/setup/select-guild`, {
        guildId: '1234567890123456789',
        installerDiscordId: '9876543210987654321'
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('message');
      expect(response.data.message).toContain('successfully');

      // Verify database updated
      const setupState = await prisma.setupState.findUnique({
        where: { id: 'singleton' }
      });

      expect(setupState?.guildSelected).toBe(true);
      expect(setupState?.selectedGuildId).toBe('1234567890123456789');
      expect(setupState?.installerDiscordId).toBe('9876543210987654321');
    });

    it('should NOT validate bot is in guild when botConfigured is false', async () => {
      // This test verifies the bot validation check is removed/skipped
      const response = await axios.post(`${API_URL}/api/setup/select-guild`, {
        guildId: '1111111111111111111',
        installerDiscordId: '2222222222222222222'
      });

      // Should succeed even if bot is not in the guild
      expect(response.status).toBe(200);
    });

    it('should accept valid Discord snowflake IDs', async () => {
      const validSnowflake = '1234567890123456789';

      const response = await axios.post(`${API_URL}/api/setup/select-guild`, {
        guildId: validSnowflake,
        installerDiscordId: validSnowflake
      });

      expect(response.status).toBe(200);
    });

    it('should update setupState.guildSelected to true', async () => {
      await axios.post(`${API_URL}/api/setup/select-guild`, {
        guildId: '1234567890123456789',
        installerDiscordId: '9876543210987654321'
      });

      const setupState = await prisma.setupState.findUnique({
        where: { id: 'singleton' }
      });

      expect(setupState?.guildSelected).toBe(true);
    });

    it('should store selectedGuildId in setupState', async () => {
      const guildId = '5555555555555555555';

      await axios.post(`${API_URL}/api/setup/select-guild`, {
        guildId,
        installerDiscordId: '9876543210987654321'
      });

      const setupState = await prisma.setupState.findUnique({
        where: { id: 'singleton' }
      });

      expect(setupState?.selectedGuildId).toBe(guildId);
    });

    it('should store installerDiscordId in setupState', async () => {
      const installerDiscordId = '7777777777777777777';

      await axios.post(`${API_URL}/api/setup/select-guild`, {
        guildId: '1234567890123456789',
        installerDiscordId
      });

      const setupState = await prisma.setupState.findUnique({
        where: { id: 'singleton' }
      });

      expect(setupState?.installerDiscordId).toBe(installerDiscordId);
    });
  });

  describe('Validation - Missing Required Fields', () => {
    it('should reject request without guildId', async () => {
      try {
        await axios.post(`${API_URL}/api/setup/select-guild`, {
          installerDiscordId: '9876543210987654321'
        });
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.message).toMatch(/guildId.*required/i);
      }
    });

    it('should reject request without installerDiscordId', async () => {
      try {
        await axios.post(`${API_URL}/api/setup/select-guild`, {
          guildId: '1234567890123456789'
        });
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.message).toMatch(/installerDiscordId.*required/i);
      }
    });

    it('should reject empty guildId', async () => {
      try {
        await axios.post(`${API_URL}/api/setup/select-guild`, {
          guildId: '',
          installerDiscordId: '9876543210987654321'
        });
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.message).toMatch(/guildId/i);
      }
    });

    it('should reject empty installerDiscordId', async () => {
      try {
        await axios.post(`${API_URL}/api/setup/select-guild`, {
          guildId: '1234567890123456789',
          installerDiscordId: ''
        });
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.message).toMatch(/installerDiscordId/i);
      }
    });
  });

  describe('Validation - Invalid Snowflake IDs', () => {
    it('should reject non-numeric guildId', async () => {
      try {
        await axios.post(`${API_URL}/api/setup/select-guild`, {
          guildId: 'not-a-number',
          installerDiscordId: '9876543210987654321'
        });
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.message).toMatch(/guildId.*snowflake/i);
      }
    });

    it('should reject non-numeric installerDiscordId', async () => {
      try {
        await axios.post(`${API_URL}/api/setup/select-guild`, {
          guildId: '1234567890123456789',
          installerDiscordId: 'invalid-id'
        });
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.message).toMatch(/installerDiscordId.*snowflake/i);
      }
    });

    it('should reject guildId that is too short', async () => {
      try {
        await axios.post(`${API_URL}/api/setup/select-guild`, {
          guildId: '123', // Too short for a snowflake
          installerDiscordId: '9876543210987654321'
        });
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
      }
    });

    it('should reject guildId that is too long', async () => {
      try {
        await axios.post(`${API_URL}/api/setup/select-guild`, {
          guildId: '12345678901234567890123456789', // Way too long
          installerDiscordId: '9876543210987654321'
        });
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
      }
    });
  });

  describe('State Validation', () => {
    it('should reject if OAuth is not configured', async () => {
      // Reset to oauthConfigured: false
      await prisma.setupState.update({
        where: { id: 'singleton' },
        data: { oauthConfigured: false }
      });

      try {
        await axios.post(`${API_URL}/api/setup/select-guild`, {
          guildId: '1234567890123456789',
          installerDiscordId: '9876543210987654321'
        });
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.message).toMatch(/OAuth.*not configured/i);
      }
    });

    it('should allow selection if OAuth configured but bot not configured', async () => {
      // This is the key test - OAuth-only should work
      await prisma.setupState.update({
        where: { id: 'singleton' },
        data: {
          oauthConfigured: true,
          botConfigured: false
        }
      });

      const response = await axios.post(`${API_URL}/api/setup/select-guild`, {
        guildId: '1234567890123456789',
        installerDiscordId: '9876543210987654321'
      });

      expect(response.status).toBe(200);
    });

    it('should allow re-selecting a different guild', async () => {
      // First selection
      await axios.post(`${API_URL}/api/setup/select-guild`, {
        guildId: '1111111111111111111',
        installerDiscordId: '9876543210987654321'
      });

      // Second selection (different guild)
      const response = await axios.post(`${API_URL}/api/setup/select-guild`, {
        guildId: '2222222222222222222',
        installerDiscordId: '9876543210987654321'
      });

      expect(response.status).toBe(200);

      const setupState = await prisma.setupState.findUnique({
        where: { id: 'singleton' }
      });

      expect(setupState?.selectedGuildId).toBe('2222222222222222222');
    });
  });

  describe('Response Format', () => {
    it('should return success message in response', async () => {
      const response = await axios.post(`${API_URL}/api/setup/select-guild`, {
        guildId: '1234567890123456789',
        installerDiscordId: '9876543210987654321'
      });

      expect(response.data).toHaveProperty('message');
      expect(typeof response.data.message).toBe('string');
    });

    it('should return updated setup state in response', async () => {
      const response = await axios.post(`${API_URL}/api/setup/select-guild`, {
        guildId: '1234567890123456789',
        installerDiscordId: '9876543210987654321'
      });

      expect(response.data).toHaveProperty('setupState');
      expect(response.data.setupState.guildSelected).toBe(true);
      expect(response.data.setupState.selectedGuildId).toBe('1234567890123456789');
    });
  });
});

describe('POST /api/setup/select-guild - Bot Configured Flow', () => {
  beforeEach(async () => {
    // Reset with bot configured
    await prisma.setupState.deleteMany();
    await prisma.setupState.create({
      data: {
        id: 'singleton',
        systemConfigured: true,
        oauthConfigured: true,
        botConfigured: true, // Bot IS configured
        guildSelected: false,
        rolesConfigured: false
      }
    });
  });

  afterEach(async () => {
    await prisma.setupState.deleteMany();
  });

  describe('Bot Validation (Optional Enhancement)', () => {
    it('should optionally validate bot is in guild when botConfigured is true', async () => {
      // This test documents that bot validation COULD be added back
      // as an optional enhancement when bot is configured
      // For now, we're removing it entirely to unblock OAuth-only flow

      const response = await axios.post(`${API_URL}/api/setup/select-guild`, {
        guildId: '1234567890123456789',
        installerDiscordId: '9876543210987654321'
      });

      // Should succeed regardless (bot validation removed)
      expect(response.status).toBe(200);
    });
  });
});
