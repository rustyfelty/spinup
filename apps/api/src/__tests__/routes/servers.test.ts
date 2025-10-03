import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { serverRoutes } from '../../routes/servers';
import { prisma } from '../../services/prisma';
import { GAMES } from '@spinup/shared';

describe('Server Routes', () => {
  const app = Fastify();
  let testOrgId: string;
  let testServerId: string;
  let testToken: string;
  const testUserId = 'test-user-servers';

  beforeAll(async () => {
    // Register JWT plugin
    await app.register(jwt, { secret: 'test-secret' });

    await app.register(serverRoutes, { prefix: '/api/servers' });
    await app.ready();

    // Create test organization
    const org = await prisma.org.create({
      data: {
        discordGuild: 'test-guild-servers',
        name: 'Test Org for Servers',
      },
    });
    testOrgId = org.id;

    // Create test token
    testToken = app.jwt.sign({ sub: testUserId, org: testOrgId });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.server.deleteMany({ where: { orgId: testOrgId } });
    await prisma.org.delete({ where: { id: testOrgId } });
    await app.close();
  });

  beforeEach(async () => {
    // Clean up servers before each test
    await prisma.server.deleteMany({ where: { orgId: testOrgId } });
  });

  describe('GET /api/servers', () => {
    it('should return empty array when no servers exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/servers',
        query: { orgId: testOrgId },
        headers: {
          authorization: `Bearer ${testToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(0);
    });

    it('should return 400 when orgId is missing', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/servers',
        headers: {
          authorization: `Bearer ${testToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Bad Request');
    });

    it('should return list of servers for organization', async () => {
      // Create test servers
      const server1 = await prisma.server.create({
        data: {
          orgId: testOrgId,
          name: 'Test Server 1',
          gameKey: 'minecraft-java',
          status: 'STOPPED',
          ports: [],
          createdBy: 'test-user',
        },
      });

      const server2 = await prisma.server.create({
        data: {
          orgId: testOrgId,
          name: 'Test Server 2',
          gameKey: 'valheim',
          status: 'RUNNING',
          ports: [{ container: 2456, host: 32456, proto: 'udp' }],
          createdBy: 'test-user',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers',
        query: { orgId: testOrgId },
        headers: {
          authorization: `Bearer ${testToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.length).toBe(2);
      expect(data[0].name).toContain('Test Server');
    });
  });

  describe('POST /api/servers', () => {
    it('should create a new server successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/servers',
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        payload: {
          orgId: testOrgId,
          name: 'New Minecraft Server',
          gameKey: 'minecraft-java',
        },
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.body);
      expect(data.id).toBeDefined();
      testServerId = data.id;

      // Verify server was created in database
      const server = await prisma.server.findUnique({
        where: { id: data.id },
      });
      expect(server).toBeDefined();
      expect(server?.name).toBe('New Minecraft Server');
      expect(server?.status).toBe('CREATING');
      expect(server?.gameKey).toBe('minecraft-java');
    });

    it('should return 400 when required fields are missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/servers',
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        payload: {
          orgId: testOrgId,
          name: 'Incomplete Server',
          // gameKey missing
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Bad Request');
    });

    it('should return 400 for invalid gameKey', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/servers',
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        payload: {
          orgId: testOrgId,
          name: 'Invalid Game Server',
          gameKey: 'invalid-game-key',
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Bad Request');
      expect(data.message).toContain('Invalid gameKey');
    });

    it('should return 403 when trying to create server in different org', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/servers',
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        payload: {
          orgId: 'non-existent-org-id',
          name: 'Test Server',
          gameKey: 'minecraft-java',
        },
      });

      expect(response.statusCode).toBe(403);
      const data = JSON.parse(response.body);
      expect(data.message).toContain('do not have access');
    });

    it('should create job for new server', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/servers',
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        payload: {
          orgId: testOrgId,
          name: 'Server with Job',
          gameKey: 'minecraft-java',
        },
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.body);

      // Check that a CREATE job was created
      const jobs = await prisma.job.findMany({
        where: { serverId: data.id, type: 'CREATE' },
      });
      expect(jobs.length).toBeGreaterThan(0);
      expect(jobs[0].status).toBe('PENDING');
    });
  });

  describe('GET /api/servers/:id', () => {
    beforeEach(async () => {
      const server = await prisma.server.create({
        data: {
          orgId: testOrgId,
          name: 'Detail Test Server',
          gameKey: 'minecraft-java',
          status: 'STOPPED',
          ports: [],
          createdBy: 'test-user',
        },
      });
      testServerId = server.id;
    });

    it('should return server details', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/servers/${testServerId}`,
        headers: {
          authorization: `Bearer ${testToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.id).toBe(testServerId);
      expect(data.name).toBe('Detail Test Server');
      expect(data.org).toBeDefined();
      expect(data.org.name).toBe('Test Org for Servers');
    });

    it('should return 404 for non-existent server', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/non-existent-id',
        headers: {
          authorization: `Bearer ${testToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.body);
      expect(data.message).toContain('Server not found');
    });

    it('should include recent jobs in response', async () => {
      // Create some jobs
      await prisma.job.create({
        data: {
          serverId: testServerId,
          type: 'CREATE',
          status: 'SUCCESS',
          progress: 100,
          payload: {},
          logs: '',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/servers/${testServerId}`,
        headers: {
          authorization: `Bearer ${testToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.jobs).toBeDefined();
      expect(data.jobs.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/servers/:id/start', () => {
    beforeEach(async () => {
      const server = await prisma.server.create({
        data: {
          orgId: testOrgId,
          name: 'Start Test Server',
          gameKey: 'minecraft-java',
          status: 'STOPPED',
          ports: [],
          containerId: 'mock-container-id',
          createdBy: 'test-user',
        },
      });
      testServerId = server.id;
    });

    it('should enqueue start job for stopped server', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/servers/${testServerId}/start`,
        headers: {
          authorization: `Bearer ${testToken}`,
        },
      });

      expect(response.statusCode).toBe(202);
      const data = JSON.parse(response.body);
      expect(data.message).toContain('Start job enqueued');

      // Verify job was created
      const jobs = await prisma.job.findMany({
        where: { serverId: testServerId, type: 'START' },
      });
      expect(jobs.length).toBeGreaterThan(0);
    });

    it('should return 400 when server is already running', async () => {
      // Update server to RUNNING
      await prisma.server.update({
        where: { id: testServerId },
        data: { status: 'RUNNING' },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/servers/${testServerId}/start`,
        headers: {
          authorization: `Bearer ${testToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.message).toContain('already running');
    });

    it('should return 400 when server is in CREATING status', async () => {
      await prisma.server.update({
        where: { id: testServerId },
        data: { status: 'CREATING' },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/servers/${testServerId}/start`,
        headers: {
          authorization: `Bearer ${testToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.message).toContain('Cannot start');
    });

    it('should return 404 for non-existent server', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/non-existent-id/start',
        headers: {
          authorization: `Bearer ${testToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/servers/:id/stop', () => {
    beforeEach(async () => {
      const server = await prisma.server.create({
        data: {
          orgId: testOrgId,
          name: 'Stop Test Server',
          gameKey: 'minecraft-java',
          status: 'RUNNING',
          ports: [],
          containerId: 'mock-container-id',
          createdBy: 'test-user',
        },
      });
      testServerId = server.id;
    });

    it('should enqueue stop job for running server', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/servers/${testServerId}/stop`,
        headers: {
          authorization: `Bearer ${testToken}`,
        },
      });

      expect(response.statusCode).toBe(202);
      const data = JSON.parse(response.body);
      expect(data.message).toContain('Stop job enqueued');

      // Verify job was created
      const jobs = await prisma.job.findMany({
        where: { serverId: testServerId, type: 'STOP' },
      });
      expect(jobs.length).toBeGreaterThan(0);
    });

    it('should return 400 when server is already stopped', async () => {
      await prisma.server.update({
        where: { id: testServerId },
        data: { status: 'STOPPED' },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/servers/${testServerId}/stop`,
        headers: {
          authorization: `Bearer ${testToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.message).toContain('already stopped');
    });
  });

  describe('DELETE /api/servers/:id', () => {
    beforeEach(async () => {
      const server = await prisma.server.create({
        data: {
          orgId: testOrgId,
          name: 'Delete Test Server',
          gameKey: 'minecraft-java',
          status: 'STOPPED',
          ports: [],
          createdBy: 'test-user',
        },
      });
      testServerId = server.id;
    });

    it('should enqueue delete job and update status', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/servers/${testServerId}`,
        headers: {
          authorization: `Bearer ${testToken}`,
        },
      });

      expect(response.statusCode).toBe(202);
      const data = JSON.parse(response.body);
      expect(data.message).toContain('Delete job enqueued');

      // Verify server status updated to DELETING
      const server = await prisma.server.findUnique({
        where: { id: testServerId },
      });
      expect(server?.status).toBe('DELETING');

      // Verify job was created
      const jobs = await prisma.job.findMany({
        where: { serverId: testServerId, type: 'DELETE' },
      });
      expect(jobs.length).toBeGreaterThan(0);
    });

    it('should return 400 when server is already being deleted', async () => {
      await prisma.server.update({
        where: { id: testServerId },
        data: { status: 'DELETING' },
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/servers/${testServerId}`,
        headers: {
          authorization: `Bearer ${testToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.message).toContain('already being deleted');
    });

    it('should return 404 for non-existent server', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/servers/non-existent-id',
        headers: {
          authorization: `Bearer ${testToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/servers/:id/logs', () => {
    beforeEach(async () => {
      const server = await prisma.server.create({
        data: {
          orgId: testOrgId,
          name: 'Logs Test Server',
          gameKey: 'minecraft-java',
          status: 'RUNNING',
          ports: [],
          containerId: null, // No container yet
          createdBy: 'test-user',
        },
      });
      testServerId = server.id;
    });

    it('should return empty array when no container exists', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/servers/${testServerId}/logs`,
        headers: {
          authorization: `Bearer ${testToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(0);
    });

    it('should return 404 for non-existent server', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/non-existent-id/logs',
        headers: {
          authorization: `Bearer ${testToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
