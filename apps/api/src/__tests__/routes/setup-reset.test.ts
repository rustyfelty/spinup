import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { exec } from 'child_process';
import { promisify } from 'util';
import { prisma } from '../../services/prisma';
import setupRoutes from '../../routes/setup';

const execAsync = promisify(exec);

// Mock Prisma
vi.mock('../../services/prisma', () => ({
  prisma: {
    setupState: {
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    server: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    job: {
      deleteMany: vi.fn(),
    },
    configVersion: {
      deleteMany: vi.fn(),
    },
    membership: {
      deleteMany: vi.fn(),
    },
    user: {
      deleteMany: vi.fn(),
    },
    orgSettings: {
      deleteMany: vi.fn(),
    },
    rolePermission: {
      deleteMany: vi.fn(),
    },
    org: {
      deleteMany: vi.fn(),
    },
    oAuthSession: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(prisma)),
  },
}));

// Mock child_process exec
vi.mock('child_process', () => ({
  exec: vi.fn((cmd, callback) => {
    callback(null, 'Command executed', '');
  }),
}));

// Mock fs promises
vi.mock('fs/promises', () => ({
  default: {
    rm: vi.fn(),
    access: vi.fn(),
  },
}));

describe('POST /api/setup/reset - Complete System Reset', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = fastify({ logger: false });

    // Add JWT plugin mock
    app.decorate('jwt', {
      sign: vi.fn().mockReturnValue('mock-jwt-token'),
      verify: vi.fn().mockReturnValue({ sub: 'user123', org: 'org123' })
    });

    await app.register(setupRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Security Tests', () => {
    it('should require confirmation token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/reset',
        payload: {}
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.payload);
      expect(result.message).toContain('Confirmation token required');
    });

    it('should reject invalid confirmation token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/reset',
        payload: {
          confirmationToken: 'wrong-token'
        }
      });

      expect(response.statusCode).toBe(403);
      const result = JSON.parse(response.payload);
      expect(result.message).toContain('Invalid confirmation token');
    });

    it('should accept valid confirmation token', async () => {
      // Mock existing setup state
      (prisma.setupState.findUnique as any).mockResolvedValue({
        id: 'singleton',
        systemConfigured: true,
        oauthConfigured: true,
        guildSelected: true,
        rolesConfigured: true,
        completed: true
      });

      // Mock empty results for all finds
      (prisma.server.findMany as any).mockResolvedValue([]);

      // Mock successful deletes
      (prisma.job.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.configVersion.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.server.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.membership.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.user.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.rolePermission.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.orgSettings.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.org.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.oAuthSession.deleteMany as any).mockResolvedValue({ count: 0 });

      // Mock setup state reset
      (prisma.setupState.upsert as any).mockResolvedValue({
        id: 'singleton',
        systemConfigured: false,
        oauthConfigured: false,
        guildSelected: false,
        rolesConfigured: false,
        completed: false
      });

      const response = await app.inject({
        method: 'POST',
        url: '/reset',
        payload: {
          confirmationToken: 'RESET-SYSTEM-COMPLETELY'
        }
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(true);
      expect(result.message).toContain('System reset completed successfully');
    });

    it('should require authentication if setup is complete', async () => {
      // Mock completed setup state
      (prisma.setupState.findUnique as any).mockResolvedValue({
        id: 'singleton',
        completed: true
      });

      const response = await app.inject({
        method: 'POST',
        url: '/reset',
        payload: {
          confirmationToken: 'RESET-SYSTEM-COMPLETELY'
        },
        // No auth cookie
      });

      expect(response.statusCode).toBe(401);
      const result = JSON.parse(response.payload);
      expect(result.message).toContain('Authentication required');
    });
  });

  describe('Cleanup Operations', () => {
    beforeEach(() => {
      // Mock existing data
      (prisma.setupState.findUnique as any).mockResolvedValue({
        id: 'singleton',
        systemConfigured: true,
        oauthConfigured: true,
        guildSelected: true,
        rolesConfigured: true,
        completed: false // Not complete, so no auth required
      });
    });

    it('should stop and remove all Docker containers', async () => {
      const mockServers = [
        { id: 'server1', containerId: 'container1', name: 'Test Server 1' },
        { id: 'server2', containerId: 'container2', name: 'Test Server 2' }
      ];

      (prisma.server.findMany as any).mockResolvedValue(mockServers);
      (prisma.job.deleteMany as any).mockResolvedValue({ count: 5 });
      (prisma.configVersion.deleteMany as any).mockResolvedValue({ count: 3 });
      (prisma.server.deleteMany as any).mockResolvedValue({ count: 2 });
      (prisma.membership.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.user.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.rolePermission.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.orgSettings.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.org.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.oAuthSession.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.setupState.upsert as any).mockResolvedValue({
        id: 'singleton',
        systemConfigured: false
      });

      const response = await app.inject({
        method: 'POST',
        url: '/reset',
        payload: {
          confirmationToken: 'RESET-SYSTEM-COMPLETELY'
        }
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.cleanup.containersRemoved).toBe(2);
      expect(result.cleanup.serversDeleted).toBe(2);
    });

    it('should delete all database records in correct order', async () => {
      (prisma.server.findMany as any).mockResolvedValue([]);
      (prisma.job.deleteMany as any).mockResolvedValue({ count: 10 });
      (prisma.configVersion.deleteMany as any).mockResolvedValue({ count: 5 });
      (prisma.server.deleteMany as any).mockResolvedValue({ count: 3 });
      (prisma.membership.deleteMany as any).mockResolvedValue({ count: 7 });
      (prisma.user.deleteMany as any).mockResolvedValue({ count: 4 });
      (prisma.rolePermission.deleteMany as any).mockResolvedValue({ count: 15 });
      (prisma.orgSettings.deleteMany as any).mockResolvedValue({ count: 1 });
      (prisma.org.deleteMany as any).mockResolvedValue({ count: 1 });
      (prisma.oAuthSession.deleteMany as any).mockResolvedValue({ count: 8 });
      (prisma.setupState.upsert as any).mockResolvedValue({
        id: 'singleton',
        systemConfigured: false
      });

      const response = await app.inject({
        method: 'POST',
        url: '/reset',
        payload: {
          confirmationToken: 'RESET-SYSTEM-COMPLETELY'
        }
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);

      // Verify deletion order (dependencies first)
      const deleteOrder = [
        prisma.job.deleteMany,
        prisma.configVersion.deleteMany,
        prisma.server.deleteMany,
        prisma.membership.deleteMany,
        prisma.user.deleteMany,
        prisma.rolePermission.deleteMany,
        prisma.orgSettings.deleteMany,
        prisma.org.deleteMany,
        prisma.oAuthSession.deleteMany
      ];

      deleteOrder.forEach(fn => {
        expect(fn).toHaveBeenCalled();
      });

      // Verify counts in response
      expect(result.cleanup.jobsDeleted).toBe(10);
      expect(result.cleanup.configVersionsDeleted).toBe(5);
      expect(result.cleanup.serversDeleted).toBe(3);
      expect(result.cleanup.membershipsDeleted).toBe(7);
      expect(result.cleanup.usersDeleted).toBe(4);
      expect(result.cleanup.rolePermissionsDeleted).toBe(15);
      expect(result.cleanup.orgSettingsDeleted).toBe(1);
      expect(result.cleanup.orgsDeleted).toBe(1);
      expect(result.cleanup.oauthSessionsDeleted).toBe(8);
    });

    it('should reset SetupState to initial values', async () => {
      (prisma.server.findMany as any).mockResolvedValue([]);
      (prisma.job.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.configVersion.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.server.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.membership.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.user.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.rolePermission.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.orgSettings.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.org.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.oAuthSession.deleteMany as any).mockResolvedValue({ count: 0 });

      const expectedReset = {
        id: 'singleton',
        systemConfigured: false,
        oauthConfigured: false,
        guildSelected: false,
        rolesConfigured: false,
        completed: false,
        selectedGuildId: null,
        installerDiscordId: null,
        installerUserId: null
      };

      (prisma.setupState.upsert as any).mockResolvedValue(expectedReset);

      const response = await app.inject({
        method: 'POST',
        url: '/reset',
        payload: {
          confirmationToken: 'RESET-SYSTEM-COMPLETELY'
        }
      });

      expect(response.statusCode).toBe(200);
      expect(prisma.setupState.upsert).toHaveBeenCalledWith({
        where: { id: 'singleton' },
        create: expect.objectContaining({
          id: 'singleton',
          systemConfigured: false,
          oauthConfigured: false,
          guildSelected: false,
          rolesConfigured: false,
          completed: false
        }),
        update: expect.objectContaining({
          systemConfigured: false,
          oauthConfigured: false,
          guildSelected: false,
          rolesConfigured: false,
          completed: false,
          selectedGuildId: null,
          installerDiscordId: null,
          installerUserId: null
        })
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      (prisma.setupState.findUnique as any).mockResolvedValue({
        id: 'singleton',
        systemConfigured: true,
        completed: false
      });
    });

    it('should handle Docker cleanup failures gracefully', async () => {
      const mockServers = [
        { id: 'server1', containerId: 'container1', name: 'Test Server 1' }
      ];

      (prisma.server.findMany as any).mockResolvedValue(mockServers);

      // Mock exec to fail
      const childProcess = await import('child_process');
      (childProcess.exec as any).mockImplementation((cmd: string, callback: Function) => {
        callback(new Error('Docker daemon not running'), '', 'Error');
      });

      // Other operations succeed
      (prisma.job.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.configVersion.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.server.deleteMany as any).mockResolvedValue({ count: 1 });
      (prisma.membership.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.user.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.rolePermission.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.orgSettings.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.org.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.oAuthSession.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.setupState.upsert as any).mockResolvedValue({
        id: 'singleton',
        systemConfigured: false
      });

      const response = await app.inject({
        method: 'POST',
        url: '/reset',
        payload: {
          confirmationToken: 'RESET-SYSTEM-COMPLETELY'
        }
      });

      // Should still succeed but log warnings
      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.cleanup.containerErrors).toBeGreaterThan(0);
    });

    it('should handle database transaction failures', async () => {
      (prisma.server.findMany as any).mockResolvedValue([]);
      (prisma.$transaction as any).mockRejectedValue(new Error('Database connection lost'));

      const response = await app.inject({
        method: 'POST',
        url: '/reset',
        payload: {
          confirmationToken: 'RESET-SYSTEM-COMPLETELY'
        }
      });

      expect(response.statusCode).toBe(500);
      const result = JSON.parse(response.payload);
      expect(result.message).toContain('Failed to reset system');
    });
  });

  describe('Idempotency', () => {
    it('should handle multiple reset requests gracefully', async () => {
      // First request
      (prisma.setupState.findUnique as any).mockResolvedValue({
        id: 'singleton',
        systemConfigured: false,
        oauthConfigured: false,
        guildSelected: false,
        rolesConfigured: false,
        completed: false
      });

      (prisma.server.findMany as any).mockResolvedValue([]);
      (prisma.job.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.configVersion.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.server.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.membership.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.user.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.rolePermission.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.orgSettings.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.org.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.oAuthSession.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.setupState.upsert as any).mockResolvedValue({
        id: 'singleton',
        systemConfigured: false,
        oauthConfigured: false,
        guildSelected: false,
        rolesConfigured: false,
        completed: false
      });

      const response1 = await app.inject({
        method: 'POST',
        url: '/reset',
        payload: {
          confirmationToken: 'RESET-SYSTEM-COMPLETELY'
        }
      });

      expect(response1.statusCode).toBe(200);

      // Second request (system already reset)
      const response2 = await app.inject({
        method: 'POST',
        url: '/reset',
        payload: {
          confirmationToken: 'RESET-SYSTEM-COMPLETELY'
        }
      });

      expect(response2.statusCode).toBe(200);
      const result2 = JSON.parse(response2.payload);
      expect(result2.message).toContain('System reset completed successfully');
      expect(result2.cleanup.alreadyReset).toBe(false);
    });
  });
});