import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { serverRoutes } from "./routes/servers";
import { ssoRoutes } from "./routes/sso";
import { configRoutes } from "./routes/config";
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
      origin: process.env.WEB_ORIGIN || "http://localhost:5173",
      credentials: true
    });

    await app.register(cookie, {
      secret: process.env.API_JWT_SECRET || "devsecret123456789"
    });

    await app.register(jwt, {
      secret: process.env.API_JWT_SECRET || "devsecret123456789",
      cookie: {
        cookieName: "spinup_sess",
        signed: false
      }
    });

    await app.register(rateLimit, {
      max: 100,
      timeWindow: "1 minute"
    });

    // Health check
    app.get("/health", async () => ({ status: "ok" }));

    // Register routes
    await app.register(ssoRoutes, { prefix: "/api/sso" });
    await app.register(serverRoutes, { prefix: "/api/servers" });
    await app.register(configRoutes, { prefix: "/api/config" });

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