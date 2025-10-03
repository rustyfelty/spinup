import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { prisma } from '../../services/prisma';
import setupRoutes from '../../routes/setup';

// Mock discord-oauth service
vi.mock('../../services/discord-oauth', () => ({
  discordOAuth: {
    getGuild: vi.fn().mockResolvedValue({
      id: 'guild123',
      name: 'Test Guild',
      icon: null,
      banner: null,
      description: null
    }),
    getUser: vi.fn().mockResolvedValue({
      id: 'discord123',
      username: 'testuser',
      discriminator: '0001',
      avatar: null
    })
  }
}));

// Mock Prisma
vi.mock('../../services/prisma', () => ({
  prisma: {
    setupState: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    org: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    membership: {
      findFirst: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    orgSettings: {
      create: vi.fn(),
      upsert: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(prisma)),
  },
}));

describe('POST /api/setup/complete - Idempotent Completion', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = fastify({ logger: false });
    await app.register(setupRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Idempotency Tests', () => {
    const validRequest = {
      orgName: 'Test Organization',
      rolePermissions: [
        {
          discordRoleId: 'role_admin',
          discordRoleName: 'Admin',
          discordRoleColor: 0xFF0000,
          permissions: {
            canCreateServer: true,
            canDeleteServer: true,
            canStartServer: true,
            canStopServer: true,
            canManageSettings: true
          }
        }
      ]
    };

    it('should complete setup successfully on first call', async () => {
      // Setup state indicating all steps complete
      (prisma.setupState.findUnique as any).mockResolvedValue({
        id: 'singleton',
        systemConfigured: true,
        oauthConfigured: true,
        guildSelected: true,
        rolesConfigured: true,
        selectedGuildId: 'guild123',
        installerUserId: 'discord123',
      });

      // No existing user or org
      (prisma.user.findUnique as any).mockResolvedValue(null);
      (prisma.org.findFirst as any).mockResolvedValue(null);
      (prisma.org.findUnique as any).mockResolvedValue(null);

      // Mock successful creation
      (prisma.user.upsert as any).mockResolvedValue({
        id: 'user1',
        discordId: 'discord123',
        displayName: 'testuser',
        avatarUrl: 'https://cdn.discordapp.com/avatars/discord123/avatar123.png',
      });

      (prisma.org.upsert as any).mockResolvedValue({
        id: 'org1',
        discordGuildId: 'guild123',
        discordGuildName: 'Test Guild',
        name: 'Test Guild',
      });

      (prisma.membership.upsert as any).mockResolvedValue({
        id: 'member1',
        userId: 'user1',
        orgId: 'org1',
        role: 'owner',
      });

      (prisma.orgSettings.upsert as any).mockResolvedValue({
        id: 'settings1',
        orgId: 'org1',
      });

      (prisma.setupState.update as any).mockResolvedValue({
        id: 'singleton',
        completed: true,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/complete',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Setup completed successfully');

      // Verify upsert was used for idempotency
      expect(prisma.user.upsert).toHaveBeenCalled();
      expect(prisma.org.upsert).toHaveBeenCalled();
      expect(prisma.membership.upsert).toHaveBeenCalled();
      expect(prisma.orgSettings.upsert).toHaveBeenCalled();
    });

    it('should be idempotent - handle duplicate completion gracefully', async () => {
      // Setup state indicating all steps complete
      (prisma.setupState.findUnique as any).mockResolvedValue({
        id: 'singleton',
        systemConfigured: true,
        oauthConfigured: true,
        guildSelected: true,
        rolesConfigured: true,
        selectedGuildId: 'guild123',
        installerUserId: 'discord123',
        completed: true, // Already completed
      });

      // Existing user and org
      const existingUser = {
        id: 'user1',
        discordId: 'discord123',
        displayName: 'testuser',
        avatarUrl: 'https://cdn.discordapp.com/avatars/discord123/avatar123.png',
      };

      const existingOrg = {
        id: 'org1',
        discordGuildId: 'guild123',
        discordGuildName: 'Test Guild',
        name: 'Test Guild',
      };

      (prisma.user.findUnique as any).mockResolvedValue(existingUser);
      (prisma.org.findFirst as any).mockResolvedValue(existingOrg);
      (prisma.org.findUnique as any).mockResolvedValue(existingOrg);

      // Mock upserts returning existing data
      (prisma.user.upsert as any).mockResolvedValue(existingUser);
      (prisma.org.upsert as any).mockResolvedValue(existingOrg);
      (prisma.membership.upsert as any).mockResolvedValue({
        id: 'member1',
        userId: 'user1',
        orgId: 'org1',
        role: 'owner',
      });
      (prisma.orgSettings.upsert as any).mockResolvedValue({
        id: 'settings1',
        orgId: 'org1',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/complete',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Setup already completed');
      expect(result.alreadyCompleted).toBe(true);
    });

    it('should handle concurrent completion requests gracefully', async () => {
      // Setup state indicating all steps complete
      (prisma.setupState.findUnique as any).mockResolvedValue({
        id: 'singleton',
        systemConfigured: true,
        oauthConfigured: true,
        guildSelected: true,
        rolesConfigured: true,
        selectedGuildId: 'guild123',
        installerUserId: 'discord123',
      });

      // No existing data initially
      (prisma.user.findUnique as any).mockResolvedValue(null);
      (prisma.org.findFirst as any).mockResolvedValue(null);
      (prisma.org.findUnique as any).mockResolvedValue(null);

      // Mock successful upserts
      (prisma.user.upsert as any).mockResolvedValue({
        id: 'user1',
        discordId: 'discord123',
        displayName: 'testuser',
        avatarUrl: 'https://cdn.discordapp.com/avatars/discord123/avatar123.png',
      });

      (prisma.org.upsert as any).mockResolvedValue({
        id: 'org1',
        discordGuildId: 'guild123',
        discordGuildName: 'Test Guild',
        name: 'Test Guild',
      });

      (prisma.membership.upsert as any).mockResolvedValue({
        id: 'member1',
        userId: 'user1',
        orgId: 'org1',
        role: 'owner',
      });

      (prisma.orgSettings.upsert as any).mockResolvedValue({
        id: 'settings1',
        orgId: 'org1',
      });

      (prisma.setupState.update as any).mockResolvedValue({
        id: 'singleton',
        completed: true,
      });

      // Send multiple concurrent requests
      const promises = Array(5).fill(null).map(() =>
        app.inject({
          method: 'POST',
          url: '/complete',
          payload: validRequest,
        })
      );

      const responses = await Promise.all(promises);

      // All should succeed
      responses.forEach(response => {
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.payload);
        expect(result.success).toBe(true);
      });

      // Upserts should handle concurrency gracefully
      expect(prisma.user.upsert).toHaveBeenCalled();
      expect(prisma.org.upsert).toHaveBeenCalled();
    });

    it('should update existing org if guild already exists', async () => {
      // Setup state
      (prisma.setupState.findUnique as any).mockResolvedValue({
        id: 'singleton',
        systemConfigured: true,
        oauthConfigured: true,
        guildSelected: true,
        rolesConfigured: true,
        selectedGuildId: 'guild123',
        installerUserId: 'discord123',
      });

      // Existing org with different settings
      const existingOrg = {
        id: 'org1',
        discordGuildId: 'guild123',
        discordGuildName: 'Old Guild Name',
        name: 'Old Guild Name',
      };

      (prisma.org.findFirst as any).mockResolvedValue(existingOrg);
      (prisma.org.findUnique as any).mockResolvedValue(existingOrg);
      (prisma.user.findUnique as any).mockResolvedValue(null);

      // Mock upserts
      (prisma.user.upsert as any).mockResolvedValue({
        id: 'user1',
        discordId: 'discord123',
        displayName: 'testuser',
        avatarUrl: 'https://cdn.discordapp.com/avatars/discord123/avatar123.png',
      });

      (prisma.org.upsert as any).mockResolvedValue({
        id: 'org1',
        discordGuildId: 'guild123',
        discordGuildName: 'Test Guild', // Updated name
        name: 'Test Guild',
      });

      (prisma.membership.upsert as any).mockResolvedValue({
        id: 'member1',
        userId: 'user1',
        orgId: 'org1',
        role: 'owner',
      });

      (prisma.orgSettings.upsert as any).mockResolvedValue({
        id: 'settings1',
        orgId: 'org1',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/complete',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(true);

      // Verify org was updated with upsert
      expect(prisma.org.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { discordGuildId: 'guild123' },
          update: expect.objectContaining({
            discordGuildName: 'Test Guild',
            name: 'Test Guild',
          }),
          create: expect.any(Object),
        })
      );
    });
  });

  describe('Validation Tests', () => {
    it('should reject if setup steps are incomplete', async () => {
      (prisma.setupState.findUnique as any).mockResolvedValue({
        id: 'singleton',
        systemConfigured: true,
        oauthConfigured: true,
        guildSelected: false, // Not complete
        rolesConfigured: false,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/complete',
        payload: {
          installerDiscordId: 'discord123',
          installerDiscordUsername: 'testuser',
          guildId: 'guild123',
          guildName: 'Test Guild',
        },
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.payload);
      expect(result.message).toContain('Setup steps are not complete');
    });

    it('should handle missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/complete',
        payload: {
          installerDiscordId: 'discord123',
          // Missing other required fields
        },
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.payload);
      expect(result.message).toContain('required');
    });

    it('should handle database transaction failures gracefully', async () => {
      (prisma.setupState.findUnique as any).mockResolvedValue({
        id: 'singleton',
        systemConfigured: true,
        oauthConfigured: true,
        guildSelected: true,
        rolesConfigured: true,
        selectedGuildId: 'guild123',
      });

      // Mock transaction failure
      (prisma.$transaction as any).mockRejectedValue(new Error('Database connection lost'));

      const response = await app.inject({
        method: 'POST',
        url: '/complete',
        payload: {
          orgName: 'Test Organization',
          rolePermissions: [
            {
              discordRoleId: 'role_admin',
              discordRoleName: 'Admin',
              discordRoleColor: 0xFF0000,
              permissions: {
                canCreateServer: true,
                canDeleteServer: true,
                canStartServer: true,
                canStopServer: true,
                canManageSettings: true
              }
            }
          ]
        },
      });

      expect(response.statusCode).toBe(500);
      const result = JSON.parse(response.payload);
      expect(result.message).toContain('Failed to complete setup');
    });
  });
});