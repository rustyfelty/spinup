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

  done();
};
