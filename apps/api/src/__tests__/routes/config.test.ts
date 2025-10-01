import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { configRoutes } from '../../routes/config';
import { prisma } from '../../services/prisma';

describe('Config Routes', () => {
  const app = Fastify();
  let testOrgId: string;
  let testServerId: string;

  beforeAll(async () => {
    await app.register(configRoutes, { prefix: '/api/config' });
    await app.ready();

    // Create test organization
    const org = await prisma.org.create({
      data: {
        discordGuild: 'test-guild-config',
        name: 'Test Org for Config',
      },
    });
    testOrgId = org.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.configVersion.deleteMany({
      where: { server: { orgId: testOrgId } },
    });
    await prisma.server.deleteMany({ where: { orgId: testOrgId } });
    await prisma.org.delete({ where: { id: testOrgId } });
    await app.close();
  });

  beforeEach(async () => {
    // Clean up servers and configs before each test
    await prisma.configVersion.deleteMany({
      where: { server: { orgId: testOrgId } },
    });
    await prisma.server.deleteMany({ where: { orgId: testOrgId } });
  });

  describe('GET /api/config/:id', () => {
    it('should return 404 for non-existent server', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/config/non-existent-id',
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Server not found');
    });

    it('should return 501 for non-Minecraft servers', async () => {
      const server = await prisma.server.create({
        data: {
          orgId: testOrgId,
          name: 'Valheim Server',
          gameKey: 'valheim',
          status: 'STOPPED',
          ports: [],
          createdBy: 'test-user',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/config/${server.id}`,
      });

      expect(response.statusCode).toBe(501);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('adapter_not_ready');
    });

    it('should return default config for Minecraft server without config file', async () => {
      const server = await prisma.server.create({
        data: {
          orgId: testOrgId,
          name: 'Minecraft Server',
          gameKey: 'minecraft-java',
          status: 'STOPPED',
          ports: [],
          createdBy: 'test-user',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/config/${server.id}`,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);

      // Should have default values
      expect(data).toBeDefined();
      expect(data.difficulty).toBeDefined();
      expect(data.gamemode).toBeDefined();
    });
  });

  describe('PUT /api/config/:id', () => {
    beforeEach(async () => {
      const server = await prisma.server.create({
        data: {
          orgId: testOrgId,
          name: 'Config Test Server',
          gameKey: 'minecraft-java',
          status: 'STOPPED',
          ports: [],
          createdBy: 'test-user',
        },
      });
      testServerId = server.id;
    });

    it('should update Minecraft server config', async () => {
      const newConfig = {
        level_name: 'TestWorld',
        difficulty: 'hard',
        max_players: '20',
        online_mode: 'true',
        pvp: 'true',
        motd: 'Test Server',
        gamemode: 'survival',
        spawn_protection: '16',
        view_distance: '10',
        enable_command_block: 'false',
        allow_flight: 'false',
        white_list: 'false',
      };

      const response = await app.inject({
        method: 'PUT',
        url: `/api/config/${testServerId}`,
        payload: newConfig,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.ok).toBe(true);
    });

    it('should return 400 for invalid config data', async () => {
      const invalidConfig = {
        level_name: 'Test',
        difficulty: 'invalid-difficulty', // Invalid value
      };

      const response = await app.inject({
        method: 'PUT',
        url: `/api/config/${testServerId}`,
        payload: invalidConfig,
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toContain('Invalid configuration');
    });

    it('should create config version in database', async () => {
      const newConfig = {
        level_name: 'VersionTest',
        difficulty: 'normal',
        max_players: '10',
        online_mode: 'true',
        pvp: 'false',
        motd: 'Version Test',
        gamemode: 'creative',
        spawn_protection: '8',
        view_distance: '12',
        enable_command_block: 'true',
        allow_flight: 'true',
        white_list: 'false',
      };

      const response = await app.inject({
        method: 'PUT',
        url: `/api/config/${testServerId}`,
        payload: newConfig,
      });

      expect(response.statusCode).toBe(200);

      // Verify config version was created
      const versions = await prisma.configVersion.findMany({
        where: { serverId: testServerId },
      });

      expect(versions.length).toBe(1);
      expect(versions[0].values).toMatchObject({
        level_name: 'VersionTest',
        gamemode: 'creative',
      });
    });

    it('should indicate restart needed for running server', async () => {
      // Update server to RUNNING
      await prisma.server.update({
        where: { id: testServerId },
        data: { status: 'RUNNING' },
      });

      const newConfig = {
        level_name: 'RestartTest',
        difficulty: 'easy',
        max_players: '15',
        online_mode: 'true',
        pvp: 'true',
        motd: 'Restart Test',
        gamemode: 'survival',
        spawn_protection: '16',
        view_distance: '10',
        enable_command_block: 'false',
        allow_flight: 'false',
        white_list: 'false',
      };

      const response = await app.inject({
        method: 'PUT',
        url: `/api/config/${testServerId}`,
        payload: newConfig,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.needsRestart).toBe(true);
      expect(data.message).toContain('Restart');
    });

    it('should return 404 for non-existent server', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/config/non-existent-id',
        payload: {
          level_name: 'Test',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 501 for non-Minecraft servers', async () => {
      const valheimServer = await prisma.server.create({
        data: {
          orgId: testOrgId,
          name: 'Valheim Server',
          gameKey: 'valheim',
          status: 'STOPPED',
          ports: [],
          createdBy: 'test-user',
        },
      });

      const response = await app.inject({
        method: 'PUT',
        url: `/api/config/${valheimServer.id}`,
        payload: {
          some_config: 'value',
        },
      });

      expect(response.statusCode).toBe(501);
    });
  });

  describe('GET /api/config/:id/history', () => {
    beforeEach(async () => {
      const server = await prisma.server.create({
        data: {
          orgId: testOrgId,
          name: 'History Test Server',
          gameKey: 'minecraft-java',
          status: 'STOPPED',
          ports: [],
          createdBy: 'test-user',
        },
      });
      testServerId = server.id;
    });

    it('should return empty array for server with no config history', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/config/${testServerId}/history`,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(0);
    });

    it('should return config version history', async () => {
      // Create multiple config versions
      await prisma.configVersion.create({
        data: {
          serverId: testServerId,
          schemaVer: '1.0',
          values: { level_name: 'World1' },
          createdBy: 'test-user',
        },
      });

      await prisma.configVersion.create({
        data: {
          serverId: testServerId,
          schemaVer: '1.0',
          values: { level_name: 'World2' },
          createdBy: 'test-user',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/config/${testServerId}/history`,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.length).toBe(2);

      // Should be ordered by most recent first
      expect(data[0].values).toMatchObject({ level_name: 'World2' });
      expect(data[1].values).toMatchObject({ level_name: 'World1' });
    });

    it('should limit history to 10 versions', async () => {
      // Create 15 config versions
      for (let i = 0; i < 15; i++) {
        await prisma.configVersion.create({
          data: {
            serverId: testServerId,
            schemaVer: '1.0',
            values: { level_name: `World${i}` },
            createdBy: 'test-user',
          },
        });
      }

      const response = await app.inject({
        method: 'GET',
        url: `/api/config/${testServerId}/history`,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.length).toBe(10); // Should be limited to 10
    });

    it('should return 404 for non-existent server', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/config/non-existent-id/history',
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
