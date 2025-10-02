import { FastifyPluginCallback } from "fastify";
import os from "node:os";
import Docker from "dockerode";
import { prisma } from "../services/prisma";

const docker = new Docker();

export const systemRoutes: FastifyPluginCallback = (app, _opts, done) => {
  // Get system resources and allocation
  app.get("/resources", async (req, reply) => {
    try {
      // Get system information
      const totalMemoryBytes = os.totalmem();
      const freeMemoryBytes = os.freemem();
      const totalMemoryMB = Math.floor(totalMemoryBytes / (1024 * 1024));
      const freeMemoryMB = Math.floor(freeMemoryBytes / (1024 * 1024));
      const usedMemoryMB = totalMemoryMB - freeMemoryMB;

      const cpus = os.cpus();
      const cpuCount = cpus.length;
      const loadAvg = os.loadavg();

      // Get all servers with their resource allocations
      const servers = await prisma.server.findMany({
        where: {
          status: {
            in: ["RUNNING", "CREATING"]
          }
        },
        select: {
          id: true,
          name: true,
          gameKey: true,
          status: true,
          memoryCap: true,
          cpuShares: true,
          containerId: true
        }
      });

      // Calculate allocated resources
      const allocatedMemoryMB = servers.reduce((sum, s) => sum + s.memoryCap, 0);
      const allocatedCPUShares = servers.reduce((sum, s) => sum + s.cpuShares, 0);

      // Get actual container stats for running servers
      const serverStats = await Promise.all(
        servers.map(async (server) => {
          if (!server.containerId) {
            return {
              id: server.id,
              name: server.name,
              gameKey: server.gameKey,
              allocated: {
                memory: server.memoryCap,
                cpu: server.cpuShares
              },
              used: null
            };
          }

          try {
            const container = docker.getContainer(server.containerId);
            const stats = await container.stats({ stream: false });

            // Calculate memory usage
            const memoryUsedBytes = stats.memory_stats.usage || 0;
            const memoryUsedMB = Math.floor(memoryUsedBytes / (1024 * 1024));

            // Calculate CPU usage percentage
            const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - (stats.precpu_stats.cpu_usage?.total_usage || 0);
            const systemDelta = stats.cpu_stats.system_cpu_usage - (stats.precpu_stats.system_cpu_usage || 0);
            const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * 100 * cpuCount : 0;

            return {
              id: server.id,
              name: server.name,
              gameKey: server.gameKey,
              allocated: {
                memory: server.memoryCap,
                cpu: server.cpuShares
              },
              used: {
                memory: memoryUsedMB,
                cpuPercent: Math.round(cpuPercent * 10) / 10
              }
            };
          } catch (error) {
            // Container might not exist yet or stats not available
            return {
              id: server.id,
              name: server.name,
              gameKey: server.gameKey,
              allocated: {
                memory: server.memoryCap,
                cpu: server.cpuShares
              },
              used: null
            };
          }
        })
      );

      return reply.send({
        memory: {
          total: totalMemoryMB,
          used: usedMemoryMB,
          free: freeMemoryMB,
          allocated: allocatedMemoryMB,
          available: totalMemoryMB - allocatedMemoryMB
        },
        cpu: {
          cores: cpuCount,
          loadAverage: loadAvg.map(l => Math.round(l * 100) / 100),
          totalShares: cpuCount * 1024, // Total available CPU shares
          allocatedShares: allocatedCPUShares,
          availableShares: (cpuCount * 1024) - allocatedCPUShares
        },
        servers: serverStats
      });
    } catch (error) {
      app.log.error("Failed to get system resources:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  // Health check endpoint
  app.get("/health", async (req, reply) => {
    const checks = {
      timestamp: new Date().toISOString(),
      status: "healthy" as "healthy" | "degraded" | "unhealthy",
      checks: {
        database: { status: "unknown" as "healthy" | "unhealthy", latency: 0, error: null as string | null },
        docker: { status: "unknown" as "healthy" | "unhealthy", containers: 0, error: null as string | null },
        disk: { status: "unknown" as "healthy" | "unhealthy", usagePercent: 0, error: null as string | null },
        memory: { status: "unknown" as "healthy" | "unhealthy", usagePercent: 0, availableMB: 0 },
        redis: { status: "unknown" as "healthy" | "unhealthy", error: null as string | null },
      }
    };

    // Check database
    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      checks.checks.database.latency = Date.now() - dbStart;
      checks.checks.database.status = checks.checks.database.latency < 100 ? "healthy" : "unhealthy";
    } catch (error: any) {
      checks.checks.database.status = "unhealthy";
      checks.checks.database.error = error.message;
    }

    // Check Docker
    try {
      const containers = await docker.listContainers({ all: true });
      checks.checks.docker.containers = containers.length;
      checks.checks.docker.status = "healthy";
    } catch (error: any) {
      checks.checks.docker.status = "unhealthy";
      checks.checks.docker.error = error.message;
    }

    // Check Memory
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memoryUsagePercent = Math.round(((totalMemory - freeMemory) / totalMemory) * 100);
    checks.checks.memory.usagePercent = memoryUsagePercent;
    checks.checks.memory.availableMB = Math.floor(freeMemory / (1024 * 1024));
    checks.checks.memory.status = memoryUsagePercent > 90 ? "unhealthy" : "healthy";

    // Check Disk (using statfs API - no shell execution needed)
    try {
      const { statfs } = await import("node:fs/promises");
      const stats = await statfs("/");
      const total = stats.blocks * stats.bsize;
      const free = stats.bfree * stats.bsize;
      const used = total - free;
      const usagePercent = Math.round((used / total) * 100);
      checks.checks.disk.usagePercent = usagePercent;
      checks.checks.disk.status = usagePercent > 90 ? "unhealthy" : "healthy";
    } catch (error: any) {
      checks.checks.disk.error = error.message;
      checks.checks.disk.status = "unhealthy";
    }

    // Check Redis (BullMQ connection)
    try {
      const { Queue } = await import("bullmq");
      const testQueue = new Queue("server-jobs", {
        connection: {
          host: process.env.REDIS_HOST || "localhost",
          port: parseInt(process.env.REDIS_PORT || "6379")
        }
      });
      await testQueue.client.ping();
      await testQueue.close();
      checks.checks.redis.status = "healthy";
    } catch (error: any) {
      checks.checks.redis.status = "unhealthy";
      checks.checks.redis.error = error.message;
    }

    // Determine overall status
    const unhealthyCount = Object.values(checks.checks).filter(c => c.status === "unhealthy").length;
    if (unhealthyCount === 0) {
      checks.status = "healthy";
    } else if (unhealthyCount <= 1) {
      checks.status = "degraded";
    } else {
      checks.status = "unhealthy";
    }

    const statusCode = checks.status === "healthy" ? 200 : checks.status === "degraded" ? 200 : 503;
    return reply.code(statusCode).send(checks);
  });

  done();
};
