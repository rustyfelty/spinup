import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../../services/prisma';
import { enqueueCreate, enqueueStart, enqueueStop, enqueueDelete } from '../../workers/jobs';

describe('Job Queue Functions', () => {
  let testOrgId: string;
  let testServerId: string;

  beforeAll(async () => {
    // Create test organization
    const org = await prisma.org.create({
      data: {
        discordGuild: 'test-guild-jobs',
        name: 'Test Org for Jobs',
      },
    });
    testOrgId = org.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.job.deleteMany({
      where: { server: { orgId: testOrgId } },
    });
    await prisma.server.deleteMany({ where: { orgId: testOrgId } });
    await prisma.org.delete({ where: { id: testOrgId } });
  });

  beforeEach(async () => {
    // Create fresh test server for each test
    const server = await prisma.server.create({
      data: {
        orgId: testOrgId,
        name: 'Job Test Server',
        gameKey: 'minecraft-java',
        status: 'STOPPED',
        ports: [],
        createdBy: 'test-user',
      },
    });
    testServerId = server.id;

    // Clean up existing jobs
    await prisma.job.deleteMany({
      where: { serverId: testServerId },
    });
  });

  describe('enqueueCreate', () => {
    it('should create CREATE job in database', async () => {
      const job = await enqueueCreate(testServerId);

      expect(job).toBeDefined();
      expect(job.serverId).toBe(testServerId);
      expect(job.type).toBe('CREATE');
      expect(job.status).toBe('PENDING');
      expect(job.progress).toBe(0);
    });

    it('should create job with empty payload and logs', async () => {
      const job = await enqueueCreate(testServerId);

      expect(job.payload).toEqual({});
      expect(job.logs).toBe('');
      expect(job.error).toBeNull();
    });

    it('should allow multiple CREATE jobs for same server', async () => {
      const job1 = await enqueueCreate(testServerId);
      const job2 = await enqueueCreate(testServerId);

      expect(job1.id).not.toBe(job2.id);

      const jobs = await prisma.job.findMany({
        where: { serverId: testServerId, type: 'CREATE' },
      });
      expect(jobs.length).toBe(2);
    });
  });

  describe('enqueueStart', () => {
    it('should create START job in database', async () => {
      const job = await enqueueStart(testServerId);

      expect(job).toBeDefined();
      expect(job.serverId).toBe(testServerId);
      expect(job.type).toBe('START');
      expect(job.status).toBe('PENDING');
    });

    it('should have correct initial state', async () => {
      const job = await enqueueStart(testServerId);

      expect(job.progress).toBe(0);
      expect(job.startedAt).toBeNull();
      expect(job.finishedAt).toBeNull();
      expect(job.error).toBeNull();
    });
  });

  describe('enqueueStop', () => {
    it('should create STOP job in database', async () => {
      const job = await enqueueStop(testServerId);

      expect(job).toBeDefined();
      expect(job.serverId).toBe(testServerId);
      expect(job.type).toBe('STOP');
      expect(job.status).toBe('PENDING');
    });
  });

  describe('enqueueDelete', () => {
    it('should create DELETE job in database', async () => {
      const job = await enqueueDelete(testServerId);

      expect(job).toBeDefined();
      expect(job.serverId).toBe(testServerId);
      expect(job.type).toBe('DELETE');
      expect(job.status).toBe('PENDING');
    });
  });

  describe('Job Lifecycle', () => {
    it('should track job timestamps correctly', async () => {
      const job = await enqueueCreate(testServerId);
      const createdAt = new Date(job.createdAt);
      const now = new Date();

      expect(createdAt.getTime()).toBeLessThanOrEqual(now.getTime());
      expect(job.startedAt).toBeNull();
      expect(job.finishedAt).toBeNull();
    });

    it('should allow updating job status', async () => {
      const job = await enqueueCreate(testServerId);

      // Update to RUNNING
      const updated = await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'RUNNING',
          startedAt: new Date(),
          progress: 50,
        },
      });

      expect(updated.status).toBe('RUNNING');
      expect(updated.startedAt).not.toBeNull();
      expect(updated.progress).toBe(50);
    });

    it('should allow marking job as complete', async () => {
      const job = await enqueueCreate(testServerId);

      const completed = await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'SUCCESS',
          finishedAt: new Date(),
          progress: 100,
        },
      });

      expect(completed.status).toBe('SUCCESS');
      expect(completed.finishedAt).not.toBeNull();
      expect(completed.progress).toBe(100);
    });

    it('should allow marking job as failed with error', async () => {
      const job = await enqueueCreate(testServerId);
      const errorMessage = 'Container creation failed';

      const failed = await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          error: errorMessage,
        },
      });

      expect(failed.status).toBe('FAILED');
      expect(failed.error).toBe(errorMessage);
      expect(failed.finishedAt).not.toBeNull();
    });
  });

  describe('Job Relationships', () => {
    it('should maintain relationship with server', async () => {
      const job = await enqueueCreate(testServerId);

      const jobWithServer = await prisma.job.findUnique({
        where: { id: job.id },
        include: { server: true },
      });

      expect(jobWithServer?.server).toBeDefined();
      expect(jobWithServer?.server.id).toBe(testServerId);
      expect(jobWithServer?.server.name).toBe('Job Test Server');
    });

    it('should cascade delete jobs when server is deleted', async () => {
      await enqueueCreate(testServerId);
      await enqueueStart(testServerId);
      await enqueueStop(testServerId);

      const jobsBefore = await prisma.job.findMany({
        where: { serverId: testServerId },
      });
      expect(jobsBefore.length).toBe(3);

      // Delete server
      await prisma.server.delete({
        where: { id: testServerId },
      });

      // Jobs should be deleted
      const jobsAfter = await prisma.job.findMany({
        where: { serverId: testServerId },
      });
      expect(jobsAfter.length).toBe(0);
    });
  });

  describe('Job Querying', () => {
    it('should query jobs by status', async () => {
      const job1 = await enqueueCreate(testServerId);
      const job2 = await enqueueStart(testServerId);

      await prisma.job.update({
        where: { id: job1.id },
        data: { status: 'SUCCESS' },
      });

      const pendingJobs = await prisma.job.findMany({
        where: { serverId: testServerId, status: 'PENDING' },
      });

      expect(pendingJobs.length).toBe(1);
      expect(pendingJobs[0].id).toBe(job2.id);
    });

    it('should query jobs by type', async () => {
      await enqueueCreate(testServerId);
      await enqueueStart(testServerId);
      await enqueueStart(testServerId);

      const startJobs = await prisma.job.findMany({
        where: { serverId: testServerId, type: 'START' },
      });

      expect(startJobs.length).toBe(2);
      startJobs.forEach(job => {
        expect(job.type).toBe('START');
      });
    });

    it('should order jobs by creation time', async () => {
      const job1 = await enqueueCreate(testServerId);
      await new Promise(resolve => setTimeout(resolve, 10));
      const job2 = await enqueueStart(testServerId);
      await new Promise(resolve => setTimeout(resolve, 10));
      const job3 = await enqueueStop(testServerId);

      const jobs = await prisma.job.findMany({
        where: { serverId: testServerId },
        orderBy: { createdAt: 'desc' },
      });

      expect(jobs[0].id).toBe(job3.id);
      expect(jobs[1].id).toBe(job2.id);
      expect(jobs[2].id).toBe(job1.id);
    });
  });
});
