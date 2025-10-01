import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../services/prisma";

/**
 * Authentication middleware - verifies JWT token
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (error) {
    return reply.status(401).send({
      error: "Unauthorized",
      message: "Authentication required"
    });
  }
}

/**
 * Authorization middleware - verifies user has access to the server
 */
export async function authorizeServer(request: FastifyRequest, reply: FastifyReply) {
  try {
    // First ensure authentication
    await request.jwtVerify();

    const userId = (request.user as any).sub;
    const orgId = (request.user as any).org;
    const serverId = (request.params as any).id;

    if (!serverId) {
      reply.status(400).send({
        error: "Bad Request",
        message: "Server ID required"
      });
      return;
    }

    // Check if server exists and belongs to user's org
    const server = await prisma.server.findUnique({
      where: { id: serverId }
    });

    if (!server) {
      reply.status(404).send({
        error: "Not Found",
        message: "Server not found"
      });
      return;
    }

    if (server.orgId !== orgId) {
      reply.status(403).send({
        error: "Forbidden",
        message: "You do not have access to this server"
      });
      return;
    }

    // Attach server and user info to request for use in handlers
    (request as any).authorizedServer = server;
    (request as any).userId = userId;
    (request as any).orgId = orgId;

  } catch (error: any) {
    reply.status(401).send({
      error: "Unauthorized",
      message: "Authentication required"
    });
    return;
  }
}

/**
 * Authorization middleware - verifies user has access to create servers in org
 */
export async function authorizeOrgAccess(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();

    const userId = (request.user as any).sub;
    const userOrgId = (request.user as any).org;

    // For GET requests with orgId query param
    const queryOrgId = (request.query as any).orgId;
    // For POST requests with orgId in body
    const bodyOrgId = (request.body as any)?.orgId;

    const requestedOrgId = queryOrgId || bodyOrgId;

    if (!requestedOrgId) {
      reply.status(400).send({
        error: "Bad Request",
        message: "Organization ID required"
      });
      return;
    }

    // Verify user has access to this org
    if (requestedOrgId !== userOrgId) {
      reply.status(403).send({
        error: "Forbidden",
        message: "You do not have access to this organization"
      });
      return;
    }

    // Attach user info to request
    (request as any).userId = userId;
    (request as any).orgId = userOrgId;

  } catch (error: any) {
    reply.status(401).send({
      error: "Unauthorized",
      message: "Authentication required"
    });
  }
}
