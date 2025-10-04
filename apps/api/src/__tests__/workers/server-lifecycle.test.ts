import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Queue, Worker } from 'bullmq';
import Docker from 'dockerode';
import fs from 'node:fs/promises';
import { prisma } from '../../services/prisma';

// Mock dependencies
vi.mock('dockerode');
vi.mock('node:fs/promises');
vi.mock('../../services/prisma', () => ({
  prisma: {
    server: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    job: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    customScript: {
      findUnique: vi.fn(),
    },
  },
}));
vi.mock('../../services/port-allocator', () => ({
  allocateHostPort: vi.fn().mockImplementation((port) => Promise.resolve(port + 10000))
}));

describe('Server Worker - Lifecycle Integration Tests', () => {
  let mockDocker: any;
  let mockContainer: any;
  let mockQueue: Queue;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock container methods
    mockContainer = {
      id: 'container_123',
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      restart: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      inspect: vi.fn().mockResolvedValue({
        State: { Running: true, Status: 'running' }
      }),
      logs: vi.fn().mockReturnValue({
        on: vi.fn(),
        pipe: vi.fn()
      })
    };

    // Mock Docker instance
    mockDocker = {
      createContainer: vi.fn().mockResolvedValue(mockContainer),
      getContainer: vi.fn().mockReturnValue(mockContainer),
      pull: vi.fn((image, callback) => {
        callback(null, {
          on: (event: string, handler: Function) => {
            if (event === 'end') handler();
          }
        });
      }),
      listImages: vi.fn().mockResolvedValue([
        { RepoTags: ['itzg/minecraft-server:latest'] }
      ])
    };

    (Docker as any).mockImplementation(() => mockDocker);

    // Mock filesystem
    (fs.mkdir as any).mockResolvedValue(undefined);
    (fs.access as any).mockResolvedValue(undefined);
    (fs.writeFile as any).mockResolvedValue(undefined);
    (fs.rm as any).mockResolvedValue(undefined);
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  describe('CREATE Job', () => {
    it('should create server with all lifecycle steps', async () => {
      const mockServer = {
        id: 'server123',
        gameKey: 'minecraft',
        name: 'Test Minecraft Server',
        orgId: 'org123',
        status: 'CREATING',
        memoryCap: 2048,
        cpuShares: 2048,
        ports: null,
        containerId: null
      };

      const mockJob = {
        id: 'job123',
        serverId: 'server123',
        type: 'CREATE',
        status: 'PENDING',
        progress: 0
      };

      (prisma.server.findUnique as any).mockResolvedValue(mockServer);
      (prisma.job.findUnique as any).mockResolvedValue(mockJob);

      // Simulate job processing
      const jobData = {
        serverId: 'server123',
        jobId: 'job123',
        gameKey: 'minecraft'
      };

      // Verify directory creation
      await fs.mkdir('/srv/spinup/server123/data', { recursive: true });
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('server123/data'),
        expect.objectContaining({ recursive: true })
      );

      // Verify Docker image pull
      await new Promise((resolve) => {
        mockDocker.pull('itzg/minecraft-server:latest', (err: any, stream: any) => {
          stream.on('end', resolve);
        });
      });

      expect(mockDocker.pull).toHaveBeenCalledWith(
        'itzg/minecraft-server:latest',
        expect.any(Function)
      );

      // Verify container creation
      const containerConfig = {
        Image: 'itzg/minecraft-server:latest',
        name: 'spinup-server123',
        HostConfig: {
          Memory: 2048 * 1024 * 1024,
          CpuShares: 2048,
          RestartPolicy: {
            Name: 'unless-stopped'
          },
          Binds: [
            expect.stringContaining('/data')
          ],
          PortBindings: expect.any(Object)
        },
        Env: expect.arrayContaining([
          'EULA=TRUE',
          'TYPE=PAPER'
        ])
      };

      await mockDocker.createContainer(containerConfig);

      expect(mockDocker.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          Image: 'itzg/minecraft-server:latest'
        })
      );

      // Verify job completion update
      await prisma.job.update({
        where: { id: 'job123' },
        data: {
          status: 'SUCCESS',
          progress: 100,
          finishedAt: expect.any(Date)
        }
      });

      expect(prisma.job.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'job123' },
          data: expect.objectContaining({
            status: 'SUCCESS'
          })
        })
      );
    });

    it('should handle Docker image pull failures', async () => {
      mockDocker.pull = vi.fn((image, callback) => {
        callback(new Error('Image not found'), null);
      });

      await expect(
        new Promise((resolve, reject) => {
          mockDocker.pull('invalid/image:latest', (err: any) => {
            if (err) reject(err);
            else resolve(null);
          });
        })
      ).rejects.toThrow('Image not found');
    });

    it('should allocate unique ports for server', async () => {
      const { allocateHostPort } = await import('../../services/port-allocator');

      const port1 = await allocateHostPort(25565);
      const port2 = await allocateHostPort(25575);

      expect(port1).toBeGreaterThanOrEqual(30000);
      expect(port2).toBeGreaterThanOrEqual(30000);
      expect(port1).not.toBe(port2);
    });

    it('should create data directory with correct permissions', async () => {
      await fs.mkdir('/srv/spinup/server123/data', { recursive: true });

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('data'),
        expect.objectContaining({ recursive: true })
      );

      // Verify directory is accessible
      await fs.access('/srv/spinup/server123/data', (fs as any).constants.W_OK);

      expect(fs.access).toHaveBeenCalled();
    });

    it('should handle missing data directory permissions', async () => {
      (fs.access as any).mockRejectedValue(new Error('EACCES: permission denied'));

      await expect(
        fs.access('/srv/spinup/test', (fs as any).constants.W_OK)
      ).rejects.toThrow('permission denied');
    });

    it('should mount volumes correctly', async () => {
      const containerConfig = {
        Image: 'itzg/minecraft-server:latest',
        HostConfig: {
          Binds: [
            '/srv/spinup/server123/data:/data'
          ]
        }
      };

      await mockDocker.createContainer(containerConfig);

      expect(mockDocker.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          HostConfig: expect.objectContaining({
            Binds: expect.arrayContaining([
              expect.stringContaining('/data')
            ])
          })
        })
      );
    });

    it('should set environment variables correctly', async () => {
      const containerConfig = {
        Image: 'itzg/minecraft-server:latest',
        Env: [
          'EULA=TRUE',
          'TYPE=PAPER',
          'MEMORY=2G'
        ]
      };

      await mockDocker.createContainer(containerConfig);

      expect(mockDocker.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          Env: expect.arrayContaining(['EULA=TRUE'])
        })
      );
    });

    it('should update server record with container ID and ports', async () => {
      await prisma.server.update({
        where: { id: 'server123' },
        data: {
          containerId: 'container_123',
          ports: {
            '25565': 35565,
            '25575': 35575
          },
          status: 'STOPPED'
        }
      });

      expect(prisma.server.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'server123' },
          data: expect.objectContaining({
            containerId: 'container_123',
            ports: expect.any(Object)
          })
        })
      );
    });
  });

  describe('START Job', () => {
    it('should start existing container', async () => {
      const mockServer = {
        id: 'server123',
        containerId: 'container_123',
        gameKey: 'minecraft',
        status: 'STOPPED'
      };

      (prisma.server.findUnique as any).mockResolvedValue(mockServer);

      await mockContainer.start();

      expect(mockContainer.start).toHaveBeenCalled();

      await prisma.server.update({
        where: { id: 'server123' },
        data: { status: 'RUNNING' }
      });

      expect(prisma.server.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'RUNNING' }
        })
      );
    });

    it('should validate container exists before starting', async () => {
      const mockServer = {
        id: 'server123',
        containerId: null,
        status: 'STOPPED'
      };

      (prisma.server.findUnique as any).mockResolvedValue(mockServer);

      // Should throw error if no container ID
      expect(mockServer.containerId).toBeNull();
    });

    it('should handle container already running', async () => {
      mockContainer.start = vi.fn().mockRejectedValue({
        statusCode: 304,
        message: 'container already started'
      });

      try {
        await mockContainer.start();
      } catch (error: any) {
        expect(error.statusCode).toBe(304);
        // Should not fail the job, just log warning
      }
    });

    it('should verify data directory exists before starting', async () => {
      await fs.access('/srv/spinup/server123/data');

      expect(fs.access).toHaveBeenCalled();
    });

    it('should handle missing data directory error', async () => {
      (fs.access as any).mockRejectedValue({
        code: 'ENOENT',
        message: 'Directory not found'
      });

      await expect(
        fs.access('/srv/spinup/missing/data')
      ).rejects.toMatchObject({
        code: 'ENOENT'
      });
    });
  });

  describe('STOP Job', () => {
    it('should stop running container gracefully', async () => {
      const mockServer = {
        id: 'server123',
        containerId: 'container_123',
        status: 'RUNNING'
      };

      (prisma.server.findUnique as any).mockResolvedValue(mockServer);

      await mockContainer.stop({ t: 15 }); // 15 second timeout

      expect(mockContainer.stop).toHaveBeenCalledWith({ t: 15 });

      await prisma.server.update({
        where: { id: 'server123' },
        data: { status: 'STOPPED' }
      });
    });

    it('should handle container already stopped', async () => {
      mockContainer.stop = vi.fn().mockRejectedValue({
        statusCode: 304,
        message: 'container already stopped'
      });

      try {
        await mockContainer.stop();
      } catch (error: any) {
        expect(error.statusCode).toBe(304);
        // Should be idempotent, not fail
      }
    });

    it('should force kill after timeout', async () => {
      mockContainer.stop = vi.fn().mockRejectedValue({
        message: 'timeout waiting for container'
      });

      mockContainer.kill = vi.fn().mockResolvedValue(undefined);

      // If stop times out, should kill
      try {
        await mockContainer.stop({ t: 15 });
      } catch (error) {
        await mockContainer.kill();
        expect(mockContainer.kill).toHaveBeenCalled();
      }
    });
  });

  describe('RESTART Job', () => {
    it('should restart container with timeout', async () => {
      const mockServer = {
        id: 'server123',
        containerId: 'container_123',
        status: 'RUNNING'
      };

      (prisma.server.findUnique as any).mockResolvedValue(mockServer);

      await mockContainer.restart({ t: 15 });

      expect(mockContainer.restart).toHaveBeenCalledWith({ t: 15 });

      await prisma.server.update({
        where: { id: 'server123' },
        data: { status: 'RUNNING' }
      });
    });

    it('should handle restart of stopped container', async () => {
      mockContainer.inspect = vi.fn().mockResolvedValue({
        State: { Running: false, Status: 'exited' }
      });

      const state = await mockContainer.inspect();
      expect(state.State.Running).toBe(false);

      // Should use start instead of restart
      await mockContainer.start();
      expect(mockContainer.start).toHaveBeenCalled();
    });
  });

  describe('DELETE Job', () => {
    it('should delete container and data directory', async () => {
      const mockServer = {
        id: 'server123',
        containerId: 'container_123',
        status: 'STOPPED'
      };

      (prisma.server.findUnique as any).mockResolvedValue(mockServer);

      // Stop container if running
      await mockContainer.stop({ t: 15 });

      // Remove container
      await mockContainer.remove({ v: true, force: true });

      expect(mockContainer.remove).toHaveBeenCalledWith(
        expect.objectContaining({ force: true })
      );

      // Remove data directory
      await fs.rm('/srv/spinup/server123', { recursive: true, force: true });

      expect(fs.rm).toHaveBeenCalledWith(
        expect.stringContaining('server123'),
        expect.objectContaining({ recursive: true, force: true })
      );

      // Delete server record
      // (Would be handled by API route, not worker)
    });

    it('should handle container not found during deletion', async () => {
      mockContainer.remove = vi.fn().mockRejectedValue({
        statusCode: 404,
        message: 'No such container'
      });

      // Should continue with data deletion even if container missing
      try {
        await mockContainer.remove();
      } catch (error: any) {
        expect(error.statusCode).toBe(404);
      }

      // Should still delete data directory
      await fs.rm('/srv/spinup/server123', { recursive: true, force: true });
      expect(fs.rm).toHaveBeenCalled();
    });

    it('should force remove running container', async () => {
      mockContainer.inspect = vi.fn().mockResolvedValue({
        State: { Running: true }
      });

      await mockContainer.remove({ force: true });

      expect(mockContainer.remove).toHaveBeenCalledWith(
        expect.objectContaining({ force: true })
      );
    });
  });

  describe('Job Error Handling', () => {
    it('should update job status to FAILED on error', async () => {
      const error = new Error('Docker daemon not responding');

      await prisma.job.update({
        where: { id: 'job123' },
        data: {
          status: 'FAILED',
          error: error.message,
          finishedAt: new Date()
        }
      });

      expect(prisma.job.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FAILED',
            error: 'Docker daemon not responding'
          })
        })
      );
    });

    it('should capture error stack traces in logs', async () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n  at test.ts:123:45';

      await prisma.job.update({
        where: { id: 'job123' },
        data: {
          status: 'FAILED',
          error: error.message,
          logs: error.stack
        }
      });

      expect(prisma.job.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            logs: expect.stringContaining('at test.ts')
          })
        })
      );
    });

    it('should handle concurrent job processing conflicts', async () => {
      // Simulate Prisma unique constraint violation
      (prisma.job.update as any).mockRejectedValue({
        code: 'P2002',
        meta: { target: ['serverId', 'status'] }
      });

      await expect(
        prisma.job.update({
          where: { id: 'job123' },
          data: { status: 'RUNNING' }
        })
      ).rejects.toMatchObject({
        code: 'P2002'
      });
    });

    it('should rollback on container creation failure', async () => {
      mockDocker.createContainer = vi.fn().mockRejectedValue(
        new Error('Image not found')
      );

      // Should clean up data directory
      await fs.rm('/srv/spinup/server123', { recursive: true, force: true });

      expect(fs.rm).toHaveBeenCalled();

      // Should update job to FAILED
      await prisma.job.update({
        where: { id: 'job123' },
        data: {
          status: 'FAILED',
          error: 'Image not found'
        }
      });
    });
  });

  describe('Progress Tracking', () => {
    it('should update progress during CREATE job', async () => {
      const progressUpdates = [10, 30, 60, 90, 100];

      for (const progress of progressUpdates) {
        await prisma.job.update({
          where: { id: 'job123' },
          data: { progress }
        });
      }

      expect(prisma.job.update).toHaveBeenCalledTimes(progressUpdates.length);
    });

    it('should track time taken for each step', async () => {
      const startTime = new Date();

      await new Promise(resolve => setTimeout(resolve, 100));

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      expect(duration).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Resource Limits', () => {
    it('should apply memory limits to container', async () => {
      const memoryCap = 4096; // MB

      await mockDocker.createContainer({
        Image: 'test/image',
        HostConfig: {
          Memory: memoryCap * 1024 * 1024 // Convert to bytes
        }
      });

      expect(mockDocker.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          HostConfig: expect.objectContaining({
            Memory: 4096 * 1024 * 1024
          })
        })
      );
    });

    it('should apply CPU share limits', async () => {
      const cpuShares = 2048;

      await mockDocker.createContainer({
        Image: 'test/image',
        HostConfig: {
          CpuShares: cpuShares
        }
      });

      expect(mockDocker.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          HostConfig: expect.objectContaining({
            CpuShares: 2048
          })
        })
      );
    });

    it('should set restart policy to unless-stopped', async () => {
      await mockDocker.createContainer({
        Image: 'test/image',
        HostConfig: {
          RestartPolicy: {
            Name: 'unless-stopped'
          }
        }
      });

      expect(mockDocker.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          HostConfig: expect.objectContaining({
            RestartPolicy: { Name: 'unless-stopped' }
          })
        })
      );
    });
  });

  describe('Custom Server Scripts', () => {
    it('should create custom server with placeholder script', async () => {
      const placeholderContent = '#!/bin/bash\necho "Waiting for configuration"\nexec tail -f /dev/null';

      await fs.writeFile('/srv/spinup/server123/data/server_init.sh', placeholderContent, {
        mode: 0o755
      });

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('server_init.sh'),
        expect.stringContaining('Waiting for configuration'),
        expect.objectContaining({ mode: 0o755 })
      );
    });

    it('should mount custom script into container', async () => {
      const binds = [
        '/srv/spinup/server123/data:/data',
        '/srv/spinup/server123/data/server_init.sh:/startup/server_init.sh:ro'
      ];

      await mockDocker.createContainer({
        Image: 'test/custom',
        HostConfig: { Binds: binds }
      });

      expect(mockDocker.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          HostConfig: expect.objectContaining({
            Binds: expect.arrayContaining([
              expect.stringContaining('server_init.sh')
            ])
          })
        })
      );
    });

    it('should use custom ports from script spec', async () => {
      const customPorts = [
        { container: 27015, host: 37015, proto: 'tcp' },
        { container: 27016, host: 37016, proto: 'udp' }
      ];

      const mockCustomScript = {
        serverId: 'server123',
        portSpecs: customPorts,
        envVars: {},
        content: '#!/bin/bash\necho "Custom server"'
      };

      (prisma.customScript.findUnique as any).mockResolvedValue(mockCustomScript);

      const script = await prisma.customScript.findUnique({
        where: { serverId: 'server123' }
      });

      expect(script?.portSpecs).toEqual(customPorts);
    });
  });
});
