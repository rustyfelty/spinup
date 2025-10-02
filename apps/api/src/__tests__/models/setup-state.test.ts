import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../../services/prisma';

describe('SetupState Model', () => {
  beforeAll(async () => {
    // Ensure clean slate before all tests
    try {
      await prisma.setupState.deleteMany({});
    } catch (error) {
      console.error('Failed to clean setup state before tests:', error);
    }
  });

  afterAll(async () => {
    // Clean up all test data
    try {
      await prisma.setupState.deleteMany({});
    } catch (error) {
      console.error('Failed to clean up setup state after tests:', error);
    }
  });

  beforeEach(async () => {
    // Reset setup state before each test
    try {
      await prisma.setupState.deleteMany({});
    } catch (error) {
      console.error('Failed to reset setup state before test:', error);
    }
  });

  describe('Default Values', () => {
    it('should create SetupState with all boolean fields defaulting to false', async () => {
      const setupState = await prisma.setupState.create({
        data: {
          id: 'singleton',
        },
      });

      expect(setupState.systemConfigured).toBe(false);
      expect(setupState.oauthConfigured).toBe(false);
      expect(setupState.botConfigured).toBe(false);
      expect(setupState.guildSelected).toBe(false);
      expect(setupState.rolesConfigured).toBe(false);
      expect(setupState.onboardingComplete).toBe(false);
      expect(setupState.firstServerCreated).toBe(false);
    });

    it('should create SetupState with optional fields as null', async () => {
      const setupState = await prisma.setupState.create({
        data: {
          id: 'singleton',
        },
      });

      expect(setupState.selectedGuildId).toBeNull();
      expect(setupState.installerUserId).toBeNull();
      expect(setupState.installerDiscordId).toBeNull();
    });

    it('should set createdAt and updatedAt timestamps on creation', async () => {
      const setupState = await prisma.setupState.create({
        data: {
          id: 'singleton',
        },
      });

      expect(setupState.createdAt).toBeInstanceOf(Date);
      expect(setupState.updatedAt).toBeInstanceOf(Date);
      expect(setupState.createdAt.getTime()).toBeLessThanOrEqual(setupState.updatedAt.getTime());
    });
  });

  describe('Singleton Pattern', () => {
    it('should enforce singleton pattern with unique id', async () => {
      await prisma.setupState.create({
        data: {
          id: 'singleton',
        },
      });

      // Attempting to create another record with the same id should fail
      await expect(
        prisma.setupState.create({
          data: {
            id: 'singleton',
          },
        })
      ).rejects.toThrow();
    });

    it('should allow only one SetupState record to exist', async () => {
      await prisma.setupState.create({
        data: {
          id: 'singleton',
        },
      });

      const allRecords = await prisma.setupState.findMany({});
      expect(allRecords).toHaveLength(1);
      expect(allRecords[0].id).toBe('singleton');
    });

    it('should support upsert pattern for singleton record', async () => {
      // First upsert creates the record
      const created = await prisma.setupState.upsert({
        where: { id: 'singleton' },
        create: {
          id: 'singleton',
          systemConfigured: true,
        },
        update: {
          systemConfigured: true,
        },
      });

      expect(created.systemConfigured).toBe(true);

      // Second upsert updates the same record
      const updated = await prisma.setupState.upsert({
        where: { id: 'singleton' },
        create: {
          id: 'singleton',
          oauthConfigured: true,
        },
        update: {
          oauthConfigured: true,
        },
      });

      expect(updated.id).toBe('singleton');
      expect(updated.oauthConfigured).toBe(true);
      expect(updated.systemConfigured).toBe(true); // Previous value preserved

      // Verify only one record exists
      const allRecords = await prisma.setupState.findMany({});
      expect(allRecords).toHaveLength(1);
    });
  });

  describe('OAuth Configuration Without Bot', () => {
    it('should allow oauthConfigured: true with botConfigured: false', async () => {
      const setupState = await prisma.setupState.create({
        data: {
          id: 'singleton',
          systemConfigured: true,
          oauthConfigured: true,
          botConfigured: false,
          guildSelected: true,
          rolesConfigured: true,
        },
      });

      expect(setupState.oauthConfigured).toBe(true);
      expect(setupState.botConfigured).toBe(false);
      expect(setupState.systemConfigured).toBe(true);
      expect(setupState.guildSelected).toBe(true);
      expect(setupState.rolesConfigured).toBe(true);
    });

    it('should allow completing setup with bot not configured', async () => {
      const setupState = await prisma.setupState.create({
        data: {
          id: 'singleton',
          systemConfigured: true,
          oauthConfigured: true,
          botConfigured: false,
          guildSelected: true,
          rolesConfigured: true,
          onboardingComplete: true,
          selectedGuildId: 'test-guild-123',
          installerUserId: 'user-456',
          installerDiscordId: 'discord-789',
        },
      });

      expect(setupState.onboardingComplete).toBe(true);
      expect(setupState.botConfigured).toBe(false);
      expect(setupState.oauthConfigured).toBe(true);
      expect(setupState.selectedGuildId).toBe('test-guild-123');
      expect(setupState.installerUserId).toBe('user-456');
      expect(setupState.installerDiscordId).toBe('discord-789');
    });

    it('should support OAuth-only workflow progression', async () => {
      // Step 1: System configured
      let setupState = await prisma.setupState.create({
        data: {
          id: 'singleton',
          systemConfigured: true,
        },
      });
      expect(setupState.systemConfigured).toBe(true);
      expect(setupState.oauthConfigured).toBe(false);

      // Step 2: OAuth configured
      setupState = await prisma.setupState.update({
        where: { id: 'singleton' },
        data: { oauthConfigured: true },
      });
      expect(setupState.oauthConfigured).toBe(true);
      expect(setupState.botConfigured).toBe(false);

      // Step 3: Guild selected
      setupState = await prisma.setupState.update({
        where: { id: 'singleton' },
        data: {
          guildSelected: true,
          selectedGuildId: 'guild-123',
        },
      });
      expect(setupState.guildSelected).toBe(true);
      expect(setupState.selectedGuildId).toBe('guild-123');

      // Step 4: Roles configured
      setupState = await prisma.setupState.update({
        where: { id: 'singleton' },
        data: { rolesConfigured: true },
      });
      expect(setupState.rolesConfigured).toBe(true);

      // Step 5: Onboarding complete (without bot)
      setupState = await prisma.setupState.update({
        where: { id: 'singleton' },
        data: { onboardingComplete: true },
      });
      expect(setupState.onboardingComplete).toBe(true);
      expect(setupState.botConfigured).toBe(false); // Bot still not configured
    });
  });

  describe('Bot Configuration After OAuth', () => {
    it('should allow setting botConfigured: true after oauthConfigured: true', async () => {
      const setupState = await prisma.setupState.create({
        data: {
          id: 'singleton',
          systemConfigured: true,
          oauthConfigured: true,
        },
      });

      expect(setupState.oauthConfigured).toBe(true);
      expect(setupState.botConfigured).toBe(false);

      const updated = await prisma.setupState.update({
        where: { id: 'singleton' },
        data: { botConfigured: true },
      });

      expect(updated.botConfigured).toBe(true);
      expect(updated.oauthConfigured).toBe(true);
    });

    it('should allow botConfigured: true before oauthConfigured at database level', async () => {
      // Note: Database allows this, but business logic should prevent it
      // This test verifies database schema doesn't enforce this constraint
      const setupState = await prisma.setupState.create({
        data: {
          id: 'singleton',
          botConfigured: true,
          oauthConfigured: false,
        },
      });

      expect(setupState.botConfigured).toBe(true);
      expect(setupState.oauthConfigured).toBe(false);
      // Business logic validation should be implemented in application layer
    });

    it('should support adding bot configuration to completed OAuth setup', async () => {
      // Initial OAuth-only setup
      let setupState = await prisma.setupState.create({
        data: {
          id: 'singleton',
          systemConfigured: true,
          oauthConfigured: true,
          guildSelected: true,
          rolesConfigured: true,
          onboardingComplete: true,
          selectedGuildId: 'guild-123',
        },
      });

      expect(setupState.onboardingComplete).toBe(true);
      expect(setupState.botConfigured).toBe(false);

      // Add bot configuration later
      setupState = await prisma.setupState.update({
        where: { id: 'singleton' },
        data: { botConfigured: true },
      });

      expect(setupState.botConfigured).toBe(true);
      expect(setupState.oauthConfigured).toBe(true);
      expect(setupState.onboardingComplete).toBe(true);
    });
  });

  describe('Complete Flow States', () => {
    it('should represent OAuth-only complete flow', async () => {
      const setupState = await prisma.setupState.create({
        data: {
          id: 'singleton',
          systemConfigured: true,
          oauthConfigured: true,
          guildSelected: true,
          rolesConfigured: true,
          botConfigured: false,
          onboardingComplete: true,
          selectedGuildId: 'test-guild-oauth-only',
          installerUserId: 'user-oauth',
          installerDiscordId: 'discord-oauth',
        },
      });

      // OAuth-only complete flow verification
      expect(setupState.systemConfigured).toBe(true);
      expect(setupState.oauthConfigured).toBe(true);
      expect(setupState.guildSelected).toBe(true);
      expect(setupState.rolesConfigured).toBe(true);
      expect(setupState.botConfigured).toBe(false);
      expect(setupState.onboardingComplete).toBe(true);

      // Helper function equivalent: isOAuthOnlyComplete
      const isOAuthOnlyComplete =
        setupState.oauthConfigured &&
        setupState.guildSelected &&
        setupState.rolesConfigured &&
        !setupState.botConfigured;

      expect(isOAuthOnlyComplete).toBe(true);
    });

    it('should represent full complete flow with bot', async () => {
      const setupState = await prisma.setupState.create({
        data: {
          id: 'singleton',
          systemConfigured: true,
          oauthConfigured: true,
          guildSelected: true,
          rolesConfigured: true,
          botConfigured: true,
          onboardingComplete: true,
          firstServerCreated: true,
          selectedGuildId: 'test-guild-full',
          installerUserId: 'user-full',
          installerDiscordId: 'discord-full',
        },
      });

      // Full complete flow verification
      expect(setupState.systemConfigured).toBe(true);
      expect(setupState.oauthConfigured).toBe(true);
      expect(setupState.guildSelected).toBe(true);
      expect(setupState.rolesConfigured).toBe(true);
      expect(setupState.botConfigured).toBe(true);
      expect(setupState.onboardingComplete).toBe(true);
      expect(setupState.firstServerCreated).toBe(true);

      // Helper function equivalent: isFullyComplete
      const isFullyComplete =
        setupState.oauthConfigured &&
        setupState.guildSelected &&
        setupState.rolesConfigured &&
        setupState.botConfigured;

      expect(isFullyComplete).toBe(true);
    });

    it('should distinguish between OAuth-only and full completion', async () => {
      const oauthOnly = await prisma.setupState.create({
        data: {
          id: 'singleton',
          oauthConfigured: true,
          guildSelected: true,
          rolesConfigured: true,
          botConfigured: false,
        },
      });

      const isOAuthOnlyComplete =
        oauthOnly.oauthConfigured &&
        oauthOnly.guildSelected &&
        oauthOnly.rolesConfigured &&
        !oauthOnly.botConfigured;

      const isFullyComplete =
        oauthOnly.oauthConfigured &&
        oauthOnly.guildSelected &&
        oauthOnly.rolesConfigured &&
        oauthOnly.botConfigured;

      expect(isOAuthOnlyComplete).toBe(true);
      expect(isFullyComplete).toBe(false);

      // Update to full completion
      const fullComplete = await prisma.setupState.update({
        where: { id: 'singleton' },
        data: { botConfigured: true },
      });

      const isFullyCompleteAfter =
        fullComplete.oauthConfigured &&
        fullComplete.guildSelected &&
        fullComplete.rolesConfigured &&
        fullComplete.botConfigured;

      expect(isFullyCompleteAfter).toBe(true);
    });

    it('should track partial completion states', async () => {
      const setupState = await prisma.setupState.create({
        data: {
          id: 'singleton',
          systemConfigured: true,
          oauthConfigured: true,
          guildSelected: false,
          rolesConfigured: false,
          botConfigured: false,
        },
      });

      // Not yet complete
      const isComplete =
        setupState.oauthConfigured &&
        setupState.guildSelected &&
        setupState.rolesConfigured;

      expect(isComplete).toBe(false);
      expect(setupState.oauthConfigured).toBe(true);
      expect(setupState.guildSelected).toBe(false);
    });
  });

  describe('Field Updates', () => {
    it('should update individual fields independently', async () => {
      let setupState = await prisma.setupState.create({
        data: {
          id: 'singleton',
        },
      });

      // Update systemConfigured
      setupState = await prisma.setupState.update({
        where: { id: 'singleton' },
        data: { systemConfigured: true },
      });
      expect(setupState.systemConfigured).toBe(true);

      // Update oauthConfigured
      setupState = await prisma.setupState.update({
        where: { id: 'singleton' },
        data: { oauthConfigured: true },
      });
      expect(setupState.oauthConfigured).toBe(true);
      expect(setupState.systemConfigured).toBe(true); // Previous value preserved

      // Update selectedGuildId
      setupState = await prisma.setupState.update({
        where: { id: 'singleton' },
        data: {
          selectedGuildId: 'new-guild-id',
          guildSelected: true,
        },
      });
      expect(setupState.selectedGuildId).toBe('new-guild-id');
      expect(setupState.guildSelected).toBe(true);
    });

    it('should update updatedAt timestamp on field changes', async () => {
      const setupState = await prisma.setupState.create({
        data: {
          id: 'singleton',
          systemConfigured: true,
        },
      });

      const originalUpdatedAt = setupState.updatedAt;

      // Wait a bit to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await prisma.setupState.update({
        where: { id: 'singleton' },
        data: { oauthConfigured: true },
      });

      expect(updated.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });

    it('should allow setting optional fields to null', async () => {
      const setupState = await prisma.setupState.create({
        data: {
          id: 'singleton',
          selectedGuildId: 'test-guild',
          installerUserId: 'test-user',
          installerDiscordId: 'test-discord',
        },
      });

      expect(setupState.selectedGuildId).toBe('test-guild');

      const updated = await prisma.setupState.update({
        where: { id: 'singleton' },
        data: {
          selectedGuildId: null,
          installerUserId: null,
        },
      });

      expect(updated.selectedGuildId).toBeNull();
      expect(updated.installerUserId).toBeNull();
      expect(updated.installerDiscordId).toBe('test-discord'); // Not updated
    });

    it('should support toggling boolean fields', async () => {
      let setupState = await prisma.setupState.create({
        data: {
          id: 'singleton',
          botConfigured: false,
        },
      });

      expect(setupState.botConfigured).toBe(false);

      // Toggle to true
      setupState = await prisma.setupState.update({
        where: { id: 'singleton' },
        data: { botConfigured: true },
      });
      expect(setupState.botConfigured).toBe(true);

      // Toggle back to false
      setupState = await prisma.setupState.update({
        where: { id: 'singleton' },
        data: { botConfigured: false },
      });
      expect(setupState.botConfigured).toBe(false);
    });
  });

  describe('Data Integrity', () => {
    it('should preserve all fields during partial updates', async () => {
      const setupState = await prisma.setupState.create({
        data: {
          id: 'singleton',
          systemConfigured: true,
          oauthConfigured: true,
          guildSelected: true,
          rolesConfigured: true,
          botConfigured: false,
          selectedGuildId: 'guild-123',
          installerUserId: 'user-456',
          installerDiscordId: 'discord-789',
          onboardingComplete: true,
          firstServerCreated: false,
        },
      });

      // Update only botConfigured
      const updated = await prisma.setupState.update({
        where: { id: 'singleton' },
        data: { botConfigured: true },
      });

      // All other fields should be preserved
      expect(updated.systemConfigured).toBe(true);
      expect(updated.oauthConfigured).toBe(true);
      expect(updated.guildSelected).toBe(true);
      expect(updated.rolesConfigured).toBe(true);
      expect(updated.botConfigured).toBe(true);
      expect(updated.selectedGuildId).toBe('guild-123');
      expect(updated.installerUserId).toBe('user-456');
      expect(updated.installerDiscordId).toBe('discord-789');
      expect(updated.onboardingComplete).toBe(true);
      expect(updated.firstServerCreated).toBe(false);
    });

    it('should handle empty string values for optional fields', async () => {
      const setupState = await prisma.setupState.create({
        data: {
          id: 'singleton',
          selectedGuildId: '',
          installerUserId: '',
        },
      });

      expect(setupState.selectedGuildId).toBe('');
      expect(setupState.installerUserId).toBe('');
    });

    it('should retrieve SetupState by singleton id', async () => {
      await prisma.setupState.create({
        data: {
          id: 'singleton',
          systemConfigured: true,
        },
      });

      const retrieved = await prisma.setupState.findUnique({
        where: { id: 'singleton' },
      });

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('singleton');
      expect(retrieved?.systemConfigured).toBe(true);
    });

    it('should return null for non-existent SetupState', async () => {
      const notFound = await prisma.setupState.findUnique({
        where: { id: 'singleton' },
      });

      expect(notFound).toBeNull();
    });
  });

  describe('Complex Workflow Scenarios', () => {
    it('should support complete OAuth-first then add bot later workflow', async () => {
      // Phase 1: Complete OAuth-only setup
      let setupState = await prisma.setupState.create({
        data: {
          id: 'singleton',
          systemConfigured: true,
          oauthConfigured: true,
          guildSelected: true,
          rolesConfigured: true,
          botConfigured: false,
          onboardingComplete: true,
          selectedGuildId: 'guild-workflow',
          installerUserId: 'user-workflow',
        },
      });

      expect(setupState.onboardingComplete).toBe(true);
      expect(setupState.botConfigured).toBe(false);

      // Phase 2: First server created (OAuth-only)
      setupState = await prisma.setupState.update({
        where: { id: 'singleton' },
        data: { firstServerCreated: true },
      });

      expect(setupState.firstServerCreated).toBe(true);
      expect(setupState.botConfigured).toBe(false);

      // Phase 3: User decides to add bot later
      setupState = await prisma.setupState.update({
        where: { id: 'singleton' },
        data: { botConfigured: true },
      });

      expect(setupState.botConfigured).toBe(true);
      expect(setupState.oauthConfigured).toBe(true);
      expect(setupState.onboardingComplete).toBe(true);
      expect(setupState.firstServerCreated).toBe(true);
    });

    it('should support full workflow with bot from the start', async () => {
      // Complete flow with bot configured
      const setupState = await prisma.setupState.create({
        data: {
          id: 'singleton',
          systemConfigured: true,
          oauthConfigured: true,
          botConfigured: true,
          guildSelected: true,
          rolesConfigured: true,
          onboardingComplete: true,
          firstServerCreated: true,
          selectedGuildId: 'guild-full-flow',
          installerUserId: 'user-full-flow',
          installerDiscordId: 'discord-full-flow',
        },
      });

      // Verify all flags are set
      expect(setupState.systemConfigured).toBe(true);
      expect(setupState.oauthConfigured).toBe(true);
      expect(setupState.botConfigured).toBe(true);
      expect(setupState.guildSelected).toBe(true);
      expect(setupState.rolesConfigured).toBe(true);
      expect(setupState.onboardingComplete).toBe(true);
      expect(setupState.firstServerCreated).toBe(true);
    });

    it('should support resetting setup state', async () => {
      // Create complete setup
      let setupState = await prisma.setupState.create({
        data: {
          id: 'singleton',
          systemConfigured: true,
          oauthConfigured: true,
          botConfigured: true,
          guildSelected: true,
          rolesConfigured: true,
          onboardingComplete: true,
          selectedGuildId: 'guild-reset',
        },
      });

      expect(setupState.onboardingComplete).toBe(true);

      // Reset to fresh state
      setupState = await prisma.setupState.update({
        where: { id: 'singleton' },
        data: {
          systemConfigured: false,
          oauthConfigured: false,
          botConfigured: false,
          guildSelected: false,
          rolesConfigured: false,
          onboardingComplete: false,
          firstServerCreated: false,
          selectedGuildId: null,
          installerUserId: null,
          installerDiscordId: null,
        },
      });

      // Verify all fields reset
      expect(setupState.systemConfigured).toBe(false);
      expect(setupState.oauthConfigured).toBe(false);
      expect(setupState.botConfigured).toBe(false);
      expect(setupState.guildSelected).toBe(false);
      expect(setupState.rolesConfigured).toBe(false);
      expect(setupState.onboardingComplete).toBe(false);
      expect(setupState.firstServerCreated).toBe(false);
      expect(setupState.selectedGuildId).toBeNull();
    });
  });
});
