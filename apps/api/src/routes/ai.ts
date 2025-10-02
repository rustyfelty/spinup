import { FastifyPluginCallback } from "fastify";
import { claudeAssistant } from "../services/ai-assistant";
import { authenticate } from "../middleware/auth";

interface InitSessionBody {
  gameName?: string;
  gameType?: "steam" | "direct-download" | "wine" | "custom";
  ports?: Array<{ container: number; proto: "tcp" | "udp" }>;
  envVars?: Record<string, string>;
}

interface ChatBody {
  sessionId: string;
  message: string;
}

interface ValidateBody {
  sessionId: string;
  script: string;
}

interface FinalizeBody {
  sessionId: string;
  script: string;
  metadata: {
    ports: Array<{ container: number; proto: "tcp" | "udp" }>;
    envVars: Record<string, string>;
  };
}

export const aiRoutes: FastifyPluginCallback = (app, _opts, done) => {
  /**
   * POST /init - Initialize a new AI session for custom server setup
   */
  app.post<{ Body: InitSessionBody }>("/custom-server/init", { preHandler: authenticate }, async (req, reply) => {
    try {
      const { gameName, gameType, ports, envVars } = req.body;
      const userId = req.userId;
      const orgId = req.orgId;

      if (!userId || !orgId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const result = await claudeAssistant.initSession(userId, orgId, {
        gameName,
        gameType,
        ports,
        envVars,
      });

      return reply.send(result);
    } catch (error: any) {
      app.log.error("Failed to init AI session:", error);
      return reply.code(500).send({ error: "Failed to initialize AI session" });
    }
  });

  /**
   * POST /chat - Send a message and get AI response
   */
  app.post<{ Body: ChatBody }>("/custom-server/chat", { preHandler: authenticate }, async (req, reply) => {
    try {
      const { sessionId, message } = req.body;

      if (!sessionId || !message) {
        return reply.code(400).send({ error: "sessionId and message are required" });
      }

      const response = await claudeAssistant.chat(sessionId, message);

      return reply.send(response);
    } catch (error: any) {
      app.log.error("Failed to chat with AI:", error);

      if (error.message.includes("not found") || error.message.includes("expired")) {
        return reply.code(404).send({ error: error.message });
      }

      return reply.code(500).send({ error: "Failed to get AI response" });
    }
  });

  /**
   * POST /validate - Validate a generated script
   */
  app.post<{ Body: ValidateBody }>("/custom-server/validate", { preHandler: authenticate }, async (req, reply) => {
    try {
      const { sessionId, script } = req.body;

      if (!sessionId || !script) {
        return reply.code(400).send({ error: "sessionId and script are required" });
      }

      // Verify session exists
      const session = claudeAssistant.getSession(sessionId);
      if (!session) {
        return reply.code(404).send({ error: "Session not found or expired" });
      }

      const validation = await claudeAssistant.validateScript(script);

      return reply.send(validation);
    } catch (error: any) {
      app.log.error("Failed to validate script:", error);
      return reply.code(500).send({ error: "Failed to validate script" });
    }
  });

  /**
   * POST /finalize - Finalize the script and prepare for server creation
   */
  app.post<{ Body: FinalizeBody }>("/custom-server/finalize", { preHandler: authenticate }, async (req, reply) => {
    try {
      const { sessionId, script, metadata } = req.body;

      if (!sessionId || !script || !metadata) {
        return reply.code(400).send({ error: "sessionId, script, and metadata are required" });
      }

      // Verify session exists
      const session = claudeAssistant.getSession(sessionId);
      if (!session) {
        return reply.code(404).send({ error: "Session not found or expired" });
      }

      const result = await claudeAssistant.finalizeScript(sessionId, script, metadata);

      return reply.send(result);
    } catch (error: any) {
      app.log.error("Failed to finalize script:", error);

      if (error.message.includes("validation failed")) {
        return reply.code(400).send({ error: error.message });
      }

      return reply.code(500).send({ error: "Failed to finalize script" });
    }
  });

  /**
   * GET /session/:id - Get session info
   */
  app.get<{ Params: { id: string } }>("/custom-server/session/:id", { preHandler: authenticate }, async (req, reply) => {
    try {
      const { id } = req.params;

      const session = claudeAssistant.getSession(id);
      if (!session) {
        return reply.code(404).send({ error: "Session not found or expired" });
      }

      // Return session without sensitive data
      return reply.send({
        id: session.id,
        context: session.context,
        messageCount: session.messages.length,
        hasScript: !!session.generatedScript,
        expiresAt: session.expiresAt,
      });
    } catch (error: any) {
      app.log.error("Failed to get session:", error);
      return reply.code(500).send({ error: "Failed to get session" });
    }
  });

  done();
};
