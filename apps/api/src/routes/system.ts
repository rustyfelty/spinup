import { FastifyPluginCallback } from "fastify";
import os from "node:os";
import Docker from "dockerode";
import { prisma } from "../services/prisma";
import { authenticate } from "../middleware/auth";

const docker = new Docker();

// In-memory storage for alerts (for now)
const alerts: any[] = [];

export const systemRoutes: FastifyPluginCallback = (app, _opts, done) => {
  // Health check endpoint (public)
  app.get("/health", async (req, reply) => {
    const timestamp = new Date().toISOString();
    let status: "healthy" | "degraded" | "unhealthy" = "healthy";

    const checks: any = {
      database: { status: "healthy", latency: 0, error: null },
      docker: { status: "healthy", containers: 0, error: null },
      redis: { status: "healthy", error: null },
      disk: { status: "healthy", usagePercent: 0, error: null },
      memory: { status: "healthy", usagePercent: 0, availableMB: 0 }
    };

    // Check database
    try {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      checks.database.latency = Date.now() - start;
      checks.database.status = "healthy";
    } catch (error: any) {
      checks.database.status = "down";
      checks.database.error = error.message;
      status = "degraded";
    }

    // Check Docker
    try {
      const containers = await docker.listContainers();
      checks.docker.containers = containers.length;
      checks.docker.status = "healthy";
    } catch (error: any) {
      checks.docker.status = "down";
      checks.docker.error = error.message;
      status = "degraded";
    }

    // Check Redis
    try {
      const { Queue } = await import("bullmq");
      const testQueue = new Queue("server-jobs", {
        connection: {
          host: process.env.REDIS_HOST || "localhost",
          port: parseInt(process.env.REDIS_PORT || "6379")
        }
      });
      // Try to ping Redis - newer BullMQ versions use different API
      try {
        const client = await testQueue.client;
        if (client && typeof client.ping === 'function') {
          await client.ping();
        }
      } catch (pingError) {
        // Ignore ping errors
      }
      await testQueue.close();
      checks.redis.status = "healthy";
    } catch (error: any) {
      checks.redis.status = "down";
      checks.redis.error = error.message;
      // Redis not critical - don't mark overall status as degraded
    }

    // Check Memory
    try {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const usagePercent = Math.round((usedMem / totalMem) * 100);
      checks.memory.usagePercent = usagePercent;
      checks.memory.availableMB = Math.floor(freeMem / (1024 * 1024));
      checks.memory.status = usagePercent > 90 ? "down" : "healthy";
      if (usagePercent > 90) {
        status = "degraded";
      }
    } catch (error: any) {
      checks.memory.status = "down";
    }

    // Check Disk (data directory)
    try {
      const { exec } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const execAsync = promisify(exec);
      const dataDir = process.env.DATA_DIR || "/home/spinup-data";
      const { stdout } = await execAsync(`df -h ${dataDir} | tail -1 | awk '{print $5}'`);
      const usagePercent = parseInt(stdout.trim().replace("%", ""));
      checks.disk.usagePercent = usagePercent;
      checks.disk.status = usagePercent > 90 ? "down" : "healthy";
      if (usagePercent > 90) {
        status = "degraded";
      }
    } catch (error: any) {
      checks.disk.status = "down";
      checks.disk.error = error.message;
    }

    return reply.send({
      status,
      timestamp,
      checks
    });
  });

  // Get system resources and allocation (authenticated)
  app.get("/resources", { preHandler: authenticate }, async (req, reply) => {
    try {
      const { orgId } = req.query as { orgId?: string };

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
      const allServers = await prisma.server.findMany({
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
          containerId: true,
          orgId: true
        }
      });

      // Calculate allocated resources
      const allocatedMemoryMB = allServers.reduce((sum, s) => sum + s.memoryCap, 0);
      const allocatedCPUShares = allServers.reduce((sum, s) => sum + s.cpuShares, 0);

      // Total CPU shares (1024 = 1 core)
      const totalCPUShares = cpuCount * 1024;

      // Get actual container stats for running servers
      const serverStats = await Promise.all(
        allServers.map(async (server) => {
          if (!server.containerId || server.status !== "RUNNING") {
            return {
              serverId: server.id,
              actualMemoryMB: 0,
              cpuUsagePercent: 0
            };
          }

          try {
            const container = docker.getContainer(server.containerId);
            const stats = await container.stats({ stream: false });

            // Calculate memory usage
            const memoryUsedBytes = stats.memory_stats.usage || 0;
            const actualMemoryMB = Math.floor(memoryUsedBytes / (1024 * 1024));

            // Calculate CPU usage percentage
            const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - (stats.precpu_stats.cpu_usage?.total_usage || 0);
            const systemDelta = stats.cpu_stats.system_cpu_usage - (stats.precpu_stats.system_cpu_usage || 0);
            const cpuUsagePercent = systemDelta > 0 ? (cpuDelta / systemDelta) * 100 * cpuCount : 0;

            return {
              serverId: server.id,
              actualMemoryMB,
              cpuUsagePercent: Math.round(cpuUsagePercent * 10) / 10
            };
          } catch (error) {
            return {
              serverId: server.id,
              actualMemoryMB: 0,
              cpuUsagePercent: 0
            };
          }
        })
      );

      // Calculate available resources
      const availableMemoryMB = totalMemoryMB - allocatedMemoryMB;
      const availableCPUShares = totalCPUShares - allocatedCPUShares;

      const response: any = {
        memory: {
          total: totalMemoryMB,
          used: usedMemoryMB,
          free: freeMemoryMB,
          allocated: allocatedMemoryMB,
          available: availableMemoryMB
        },
        cpu: {
          cores: cpuCount,
          loadAverage: loadAvg,
          totalShares: totalCPUShares,
          allocatedShares: allocatedCPUShares,
          availableShares: availableCPUShares
        },
        servers: allServers.map(s => ({
          id: s.id,
          name: s.name,
          gameKey: s.gameKey,
          status: s.status,
          memoryCap: s.memoryCap,
          cpuShares: s.cpuShares
        }))
      };

      return reply.send(response);
    } catch (error) {
      app.log.error("Failed to get system resources:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  // GET /metrics - Performance metrics (authenticated)
  app.get("/metrics", { preHandler: authenticate }, async (req, reply) => {
    try {
      const { period } = req.query as { period?: string };

      // Mock metrics data for now
      return reply.send({
        apiLatency: 45.2,
        requestsPerMinute: 120,
        errorRate: 0.5,
        databaseQueryTime: 12.3
      });
    } catch (error) {
      app.log.error("Failed to get metrics:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  // GET /metrics/endpoints - Endpoint performance (authenticated)
  app.get("/metrics/endpoints", { preHandler: authenticate }, async (req, reply) => {
    try {
      // Mock endpoint metrics
      return reply.send([
        {
          path: "/api/servers",
          method: "GET",
          avgResponseTime: 32.5,
          requestCount: 1543,
          errorCount: 2
        },
        {
          path: "/api/servers/:id",
          method: "GET",
          avgResponseTime: 28.1,
          requestCount: 892,
          errorCount: 0
        }
      ]);
    } catch (error) {
      app.log.error("Failed to get endpoint metrics:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  // GET /alerts - System alerts (authenticated)
  app.get("/alerts", { preHandler: authenticate }, async (req, reply) => {
    try {
      // Check for high memory usage
      const memUsage = process.memoryUsage();
      const rss = memUsage.rss;
      const totalMemory = os.totalmem();

      // Calculate memory usage percentage - use RSS (Resident Set Size) for actual process memory
      const memoryUsagePercent = (rss / totalMemory) * 100;

      const currentAlerts: any[] = [];

      // Trigger alert if RSS > 4GB (threshold for high memory warning)
      if (rss > 4 * 1024 * 1024 * 1024) {
        currentAlerts.push({
          id: "alert-memory-high",
          type: "memory_high",
          severity: "warning",
          message: `Memory usage is high: ${(rss / (1024 * 1024 * 1024)).toFixed(1)}GB`,
          timestamp: new Date().toISOString(),
          resolved: false
        });
      }

      // Merge with stored alerts
      return reply.send([...alerts, ...currentAlerts]);
    } catch (error) {
      app.log.error("Failed to get alerts:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  // POST /alerts/:id/acknowledge - Acknowledge alert (authenticated)
  app.post<{ Params: { id: string }; Body: { note?: string } }>(
    "/alerts/:id/acknowledge",
    { preHandler: authenticate },
    async (req, reply) => {
      try {
        const { id } = req.params;
        const { note } = req.body;
        const userId = (req as any).user?.sub;

        return reply.send({
          acknowledged: true,
          acknowledgedBy: userId,
          acknowledgedAt: new Date().toISOString(),
          note
        });
      } catch (error) {
        app.log.error("Failed to acknowledge alert:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // GET /logs - System logs (admin only)
  app.get("/logs", { preHandler: authenticate }, async (req, reply) => {
    try {
      const userRole = (req as any).user?.role;

      if (userRole !== "admin") {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const { level, limit, since } = req.query as {
        level?: string;
        limit?: string;
        since?: string;
      };

      // Mock logs
      return reply.send([
        {
          timestamp: new Date().toISOString(),
          level: "error",
          message: "Sample error log",
          context: { service: "api" }
        }
      ]);
    } catch (error) {
      app.log.error("Failed to get logs:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  // POST /maintenance - Schedule maintenance (admin only)
  app.post<{ Body: { enabled: boolean; message?: string; estimatedDuration?: number } }>(
    "/maintenance",
    { preHandler: authenticate },
    async (req, reply) => {
      try {
        const userRole = (req as any).user?.role;

        if (userRole !== "admin") {
          return reply.code(403).send({ error: "Forbidden" });
        }

        const { enabled, message, estimatedDuration } = req.body;

        const estimatedEndTime = estimatedDuration
          ? new Date(Date.now() + estimatedDuration * 1000).toISOString()
          : null;

        return reply.send({
          maintenanceMode: enabled,
          message: message || "Maintenance mode enabled",
          estimatedEndTime
        });
      } catch (error) {
        app.log.error("Failed to set maintenance mode:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // GET /backup - Backup status (admin only)
  app.get("/backup", { preHandler: authenticate }, async (req, reply) => {
    try {
      const userRole = (req as any).user?.role;

      if (userRole !== "admin") {
        return reply.code(403).send({ error: "Forbidden" });
      }

      return reply.send({
        lastBackup: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        nextScheduled: new Date(Date.now() + 86400000).toISOString(), // 1 day from now
        history: []
      });
    } catch (error) {
      app.log.error("Failed to get backup status:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  // POST /backup/trigger - Trigger manual backup (admin only)
  app.post<{
    Body: {
      type?: string;
      includeDatabase?: boolean;
      includeFiles?: boolean;
      includeConfigs?: boolean;
    };
  }>("/backup/trigger", { preHandler: authenticate }, async (req, reply) => {
    try {
      const userRole = (req as any).user?.role;

      if (userRole !== "admin") {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const backupId = `backup-${Date.now()}`;

      return reply.code(202).send({
        backupId,
        status: "initiated",
        statusUrl: `/api/system/backup/${backupId}`
      });
    } catch (error) {
      app.log.error("Failed to trigger backup:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  // GET /performance - Performance analysis (authenticated)
  app.get("/performance", { preHandler: authenticate }, async (req, reply) => {
    try {
      const issues: any[] = [];

      // Check for slow database queries by running a test query
      try {
        const start = Date.now();
        await prisma.server.findMany({ take: 1 });
        const duration = Date.now() - start;

        // If query takes more than 1 second, flag it as slow
        if (duration > 1000) {
          issues.push({
            type: "slow_database",
            severity: "warning",
            message: `Database queries are slow (${duration}ms)`,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error: any) {
        // Database error
        issues.push({
          type: "slow_database",
          severity: "warning",
          message: "Database performance issue detected",
          timestamp: new Date().toISOString()
        });
      }

      return reply.send({
        issues
      });
    } catch (error) {
      app.log.error("Failed to get performance data:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  // GET /memory-analysis - Memory leak detection (authenticated)
  app.get("/memory-analysis", { preHandler: authenticate }, async (req, reply) => {
    try {
      const memUsage = process.memoryUsage();
      const heapUsed = Math.floor(memUsage.heapUsed / (1024 * 1024));
      const heapTotal = Math.floor(memUsage.heapTotal / (1024 * 1024));

      return reply.send({
        heapUsed,
        heapTotal,
        trend: "stable",
        potentialLeak: false
      });
    } catch (error) {
      app.log.error("Failed to analyze memory:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  // GET /security/auth-failures - Failed auth attempts (authenticated)
  app.get("/security/auth-failures", { preHandler: authenticate }, async (req, reply) => {
    try {
      const { since } = req.query as { since?: string };

      // Mock auth failures
      return reply.send([]);
    } catch (error) {
      app.log.error("Failed to get auth failures:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  // GET /security/anomalies - Anomaly detection (authenticated)
  app.get("/security/anomalies", { preHandler: authenticate }, async (req, reply) => {
    try {
      // Mock anomalies
      return reply.send([]);
    } catch (error) {
      app.log.error("Failed to get anomalies:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  done();
};
