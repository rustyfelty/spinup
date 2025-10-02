import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import { serverRoutes } from "./routes/servers";
import { ssoRoutes } from "./routes/sso";
import { configRoutes } from "./routes/config";
import { systemRoutes } from "./routes/system";
import { aiRoutes } from "./routes/ai";
import { fileRoutes } from "./routes/files";
import settingsRoutes from "./routes/settings";
import { startWorker } from "./workers/server.worker";

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
    transport: process.env.NODE_ENV === "development" ? {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname"
      }
    } : undefined
  }
});

async function start() {
  try {
    // Register plugins
    await app.register(cors, {
      origin: [
        process.env.WEB_ORIGIN || "http://localhost:5173",
        "http://localhost:5174", // Alternative port if 5173 is in use
        "http://localhost:5175"  // Another fallback
      ],
      credentials: true
    });

    // Validate JWT secret is configured
    const jwtSecret = process.env.API_JWT_SECRET;
    if (!jwtSecret || jwtSecret.length < 32) {
      throw new Error("API_JWT_SECRET must be set and at least 32 characters long");
    }

    await app.register(cookie, {
      secret: jwtSecret
    });

    await app.register(jwt, {
      secret: jwtSecret,
      cookie: {
        cookieName: "spinup_sess",
        signed: true
      }
    });

    await app.register(rateLimit, {
      max: 100,
      timeWindow: "1 minute"
    });

    await app.register(multipart, {
      limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
      }
    });

    // Custom error handler to prevent information leakage
    app.setErrorHandler((error, request, reply) => {
      // Log the full error internally
      request.log.error(error);

      // In production, don't expose internal error details
      if (process.env.NODE_ENV === "production") {
        // Only send generic error messages to client
        const statusCode = error.statusCode || 500;
        const safeMessage = statusCode >= 500
          ? "Internal server error"
          : error.message || "An error occurred";

        return reply.status(statusCode).send({
          error: error.name || "Error",
          message: safeMessage
        });
      }

      // In development, send detailed errors
      return reply.status(error.statusCode || 500).send({
        error: error.name || "Error",
        message: error.message,
        ...(error.validation && { validation: error.validation }),
        stack: error.stack
      });
    });

    // Health check
    app.get("/health", async () => ({ status: "ok" }));

    // Register routes
    await app.register(ssoRoutes, { prefix: "/api/sso" });
    await app.register(serverRoutes, { prefix: "/api/servers" });
    await app.register(configRoutes, { prefix: "/api/config" });
    await app.register(systemRoutes, { prefix: "/api/system" });
    await app.register(aiRoutes, { prefix: "/api/ai" });
    await app.register(fileRoutes, { prefix: "/api/files" });
    await app.register(settingsRoutes, { prefix: "/api/settings" });

    // Start job worker
    startWorker();

    // Start server
    const port = Number(process.env.API_PORT || 8080);
    await app.listen({ port, host: "0.0.0.0" });

    console.log(`✅ SpinUp API running on http://localhost:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();