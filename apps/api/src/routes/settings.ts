import type { FastifyInstance } from "fastify";
import { prisma } from "../services/prisma";
import { requireAuth } from "../middleware/auth";

/**
 * Settings routes - manages global application settings
 */
export default async function settingsRoutes(app: FastifyInstance) {
  // Get current settings
  app.get("/", { preHandler: requireAuth }, async (request, reply) => {
    let settings = await prisma.settings.findUnique({
      where: { id: "global" }
    });

    // Create default settings if they don't exist
    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          id: "global",
          webDomain: process.env.WEB_ORIGIN || "http://localhost:5173",
          apiDomain: process.env.API_URL || "http://localhost:8080"
        }
      });
    }

    return reply.send(settings);
  });

  // Update settings (admin only)
  app.patch<{
    Body: {
      webDomain?: string;
      apiDomain?: string;
    };
  }>("/", { preHandler: requireAuth }, async (request, reply) => {
    const { webDomain, apiDomain } = request.body;

    // Validate URLs if provided
    if (webDomain) {
      try {
        new URL(webDomain);
      } catch (error) {
        return reply.code(400).send({ error: "Invalid webDomain URL format" });
      }
    }

    if (apiDomain) {
      try {
        new URL(apiDomain);
      } catch (error) {
        return reply.code(400).send({ error: "Invalid apiDomain URL format" });
      }
    }

    // Get or create settings
    let settings = await prisma.settings.findUnique({
      where: { id: "global" }
    });

    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          id: "global",
          webDomain: webDomain || process.env.WEB_ORIGIN || "http://localhost:5173",
          apiDomain: apiDomain || process.env.API_URL || "http://localhost:8080"
        }
      });
    } else {
      settings = await prisma.settings.update({
        where: { id: "global" },
        data: {
          ...(webDomain && { webDomain }),
          ...(apiDomain && { apiDomain })
        }
      });
    }

    return reply.send(settings);
  });
}
