import { FastifyPluginCallback } from "fastify";
import { prisma } from "../services/prisma";
import { GAMES } from "@spinup/shared";
import { enqueueCreate, enqueueStart, enqueueStop, enqueueDelete } from "../workers/jobs";
import { authenticate, authorizeServer, authorizeOrgAccess } from "../middleware/auth";

interface CreateServerBody {
  orgId: string;
  name: string;
  gameKey: string;
  memoryCap?: number;
  cpuShares?: number;
}

interface ServerParams {
  id: string;
}

export const serverRoutes: FastifyPluginCallback = (fastify, opts, done) => {
  /**
   * GET / - List all servers for the authenticated org
   */
  fastify.get("/", { preHandler: authorizeOrgAccess }, async (request, reply) => {
    try {
      const { orgId } = request.query as { orgId?: string };

      if (!orgId) {
        return reply.status(400).send({
          error: "Bad Request",
          message: "orgId query parameter is required"
        });
      }

      const servers = await prisma.server.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        include: {
          org: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      return reply.status(200).send(servers);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: "Internal Server Error",
        message: "Failed to retrieve servers"
      });
    }
  });

  /**
   * GET /:id - Get server details
   */
  fastify.get<{ Params: ServerParams }>("/:id", { preHandler: authorizeServer }, async (request, reply) => {
    try {
      const { id } = request.params;

      // Re-fetch with includes since middleware only gets basic server
      const server = await prisma.server.findUnique({
        where: { id },
        include: {
          org: {
            select: {
              id: true,
              name: true
            }
          },
          configs: {
            orderBy: { createdAt: "desc" },
            take: 1
          },
          jobs: {
            orderBy: { createdAt: "desc" },
            take: 5
          }
        }
      });

      // Middleware already checked server exists, but double-check
      if (!server) {
        return reply.status(404).send({
          error: "Not Found",
          message: "Server not found"
        });
      }

      return reply.status(200).send(server);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: "Internal Server Error",
        message: "Failed to retrieve server details"
      });
    }
  });

  /**
   * POST / - Create a new server (enqueue CREATE job)
   */
  fastify.post<{ Body: CreateServerBody }>("/", {
    preHandler: authorizeOrgAccess,
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "5 minutes"
      }
    }
  }, async (request, reply) => {
    try {
      const { orgId, name, gameKey, memoryCap, cpuShares } = request.body;

      // Validate required fields
      if (!orgId || !name || !gameKey) {
        return reply.status(400).send({
          error: "Bad Request",
          message: "orgId, name, and gameKey are required"
        });
      }

      // Validate the gameKey exists in GAMES
      const game = GAMES.find(g => g.key === gameKey);
      if (!game) {
        return reply.status(400).send({
          error: "Bad Request",
          message: `Invalid gameKey: ${gameKey}. Valid options: ${GAMES.map(g => g.key).join(", ")}`
        });
      }

      // Verify org exists
      const org = await prisma.org.findUnique({
        where: { id: orgId }
      });

      if (!org) {
        return reply.status(404).send({
          error: "Not Found",
          message: "Organization not found"
        });
      }

      // TODO: Get createdBy from authenticated user context
      // For now using a placeholder
      const createdBy = "system";

      // Use provided resources or default to recommended
      const finalMemoryCap = memoryCap || game.resources.recommended.memory;
      const finalCpuShares = cpuShares || game.resources.recommended.cpu;

      // Create server record with status: "CREATING"
      const server = await prisma.server.create({
        data: {
          orgId,
          name,
          gameKey,
          status: "CREATING",
          ports: [],
          createdBy,
          memoryCap: finalMemoryCap,
          cpuShares: finalCpuShares
        }
      });

      // Enqueue CREATE job
      await enqueueCreate(server.id);

      // Return server ID
      return reply.status(201).send({
        id: server.id
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: "Internal Server Error",
        message: "Failed to create server"
      });
    }
  });

  /**
   * POST /:id/start - Start server (enqueue START job)
   */
  fastify.post<{ Params: ServerParams }>("/:id/start", { preHandler: authorizeServer }, async (request, reply) => {
    try {
      const { id } = request.params;

      // Verify server exists
      const server = await prisma.server.findUnique({
        where: { id }
      });

      if (!server) {
        return reply.status(404).send({
          error: "Not Found",
          message: "Server not found"
        });
      }

      // Check if server is in a valid state to start
      if (server.status === "RUNNING") {
        return reply.status(400).send({
          error: "Bad Request",
          message: "Server is already running"
        });
      }

      if (server.status === "CREATING" || server.status === "DELETING") {
        return reply.status(400).send({
          error: "Bad Request",
          message: `Cannot start server with status: ${server.status}`
        });
      }

      // Enqueue START job
      await enqueueStart(server.id);

      return reply.status(202).send({
        message: "Start job enqueued",
        serverId: server.id
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: "Internal Server Error",
        message: "Failed to start server"
      });
    }
  });

  /**
   * POST /:id/stop - Stop server (enqueue STOP job)
   */
  fastify.post<{ Params: ServerParams }>("/:id/stop", { preHandler: authorizeServer }, async (request, reply) => {
    try {
      const { id } = request.params;

      // Verify server exists
      const server = await prisma.server.findUnique({
        where: { id }
      });

      if (!server) {
        return reply.status(404).send({
          error: "Not Found",
          message: "Server not found"
        });
      }

      // Check if server is in a valid state to stop
      if (server.status === "STOPPED") {
        return reply.status(400).send({
          error: "Bad Request",
          message: "Server is already stopped"
        });
      }

      if (server.status === "CREATING" || server.status === "DELETING") {
        return reply.status(400).send({
          error: "Bad Request",
          message: `Cannot stop server with status: ${server.status}`
        });
      }

      // Enqueue STOP job
      await enqueueStop(server.id);

      return reply.status(202).send({
        message: "Stop job enqueued",
        serverId: server.id
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: "Internal Server Error",
        message: "Failed to stop server"
      });
    }
  });

  /**
   * DELETE /:id - Delete server (enqueue DELETE job)
   */
  fastify.delete<{ Params: ServerParams }>("/:id", { preHandler: authorizeServer }, async (request, reply) => {
    try {
      const { id } = request.params;

      // Verify server exists
      const server = await prisma.server.findUnique({
        where: { id }
      });

      if (!server) {
        return reply.status(404).send({
          error: "Not Found",
          message: "Server not found"
        });
      }

      // Check if server is already being deleted
      if (server.status === "DELETING") {
        return reply.status(400).send({
          error: "Bad Request",
          message: "Server is already being deleted"
        });
      }

      // Update server status to DELETING
      await prisma.server.update({
        where: { id },
        data: { status: "DELETING" }
      });

      // Enqueue DELETE job
      await enqueueDelete(server.id);

      return reply.status(202).send({
        message: "Delete job enqueued",
        serverId: server.id
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: "Internal Server Error",
        message: "Failed to delete server"
      });
    }
  });

  /**
   * GET /:id/logs - Get container logs
   */
  fastify.get<{ Params: ServerParams }>("/:id/logs", { preHandler: authorizeServer }, async (request, reply) => {
    try {
      const { id } = request.params;

      // Verify server exists
      const server = await prisma.server.findUnique({
        where: { id }
      });

      if (!server) {
        return reply.status(404).send({
          error: "Not Found",
          message: "Server not found"
        });
      }

      // If no container ID yet, return empty logs
      if (!server.containerId) {
        return reply.status(200).send([]);
      }

      // Fetch logs from Docker
      const docker = (await import("dockerode")).default;
      const dockerClient = new docker();

      try {
        const container = dockerClient.getContainer(server.containerId);
        const logs = await container.logs({
          stdout: true,
          stderr: true,
          tail: 100, // Last 100 lines
          timestamps: false
        });

        // Parse logs (Docker returns buffer with special formatting)
        const logLines = logs
          .toString('utf-8')
          .split('\n')
          .filter(line => line.trim())
          .map(line => {
            // Remove Docker's 8-byte header if present
            if (line.length > 8 && line.charCodeAt(0) <= 2) {
              return line.substring(8);
            }
            return line;
          });

        return reply.status(200).send(logLines);
      } catch (dockerError: any) {
        // Container might not exist yet
        if (dockerError.statusCode === 404) {
          return reply.status(200).send([]);
        }
        throw dockerError;
      }
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: "Internal Server Error",
        message: "Failed to retrieve logs"
      });
    }
  });

  done();
};
