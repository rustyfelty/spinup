import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface GameServerContext {
  gameName?: string;
  gameType?: "steam" | "direct-download" | "wine" | "custom";
  ports?: Array<{ container: number; proto: "tcp" | "udp" }>;
  envVars?: Record<string, string>;
  systemRequirements?: {
    memory: number;
    cpu: number;
  };
}

interface ClaudeResponse {
  message: string;
  script?: string;
  ports?: Array<{ container: number; proto: "tcp" | "udp" }>;
  envVars?: Record<string, string>;
  status: "researching" | "drafting" | "ready" | "error";
  suggestedResources?: {
    memory: number;
    cpu: number;
  };
}

interface AISession {
  id: string;
  userId: string;
  orgId: string;
  context: GameServerContext;
  messages: Message[];
  generatedScript?: string;
  scriptMetadata?: {
    ports: Array<{ container: number; proto: "tcp" | "udp" }>;
    envVars: Record<string, string>;
    resources: { memory: number; cpu: number };
  };
  createdAt: Date;
  expiresAt: Date;
}

// In-memory storage for sessions (should be Redis in production)
const sessions = new Map<string, AISession>();

export class ClaudeAssistant {
  private configPath: string;

  constructor() {
    this.configPath = path.join(__dirname, "claude-configs", "game-server-wizard.md");
  }

  /**
   * Initialize a new AI session for custom server setup
   */
  async initSession(
    userId: string,
    orgId: string,
    context: GameServerContext
  ): Promise<{ sessionId: string; greeting: string }> {
    const sessionId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes

    const session: AISession = {
      id: sessionId,
      userId,
      orgId,
      context,
      messages: [],
      createdAt: now,
      expiresAt,
    };

    sessions.set(sessionId, session);

    // Clean up expired sessions
    this.cleanupExpiredSessions();

    // Generate greeting based on context
    const greeting = context.gameName
      ? `I'll help you set up a ${context.gameName} server! Let me ask a few questions to get started, then I'll research the best setup method.`
      : `I'll help you set up a custom game server! What game would you like to host?`;

    return { sessionId, greeting };
  }

  /**
   * Send a message and get Claude's response
   */
  async chat(sessionId: string, userMessage: string): Promise<ClaudeResponse> {
    const session = sessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found or expired");
    }

    if (new Date() > session.expiresAt) {
      sessions.delete(sessionId);
      throw new Error("Session expired");
    }

    // Add user message to history
    session.messages.push({
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    });

    try {
      // Call actual Claude Code with custom system prompt
      const response = await this.callClaudeCode(session, userMessage);

      // Add assistant response to history
      session.messages.push({
        role: "assistant",
        content: response.message,
        timestamp: new Date(),
      });

      // Extract script if present
      const scriptMatch = response.message.match(/```bash\n([\s\S]*?)\n```/);
      if (scriptMatch) {
        response.script = scriptMatch[1];
        session.generatedScript = scriptMatch[1];

        // Try to extract metadata from script
        response.envVars = this.extractEnvVars(scriptMatch[1]);
        response.ports = this.extractPorts(session);
      }

      return response;
    } catch (error: any) {
      console.error("Claude chat error:", error);
      return {
        message: "I apologize, but I encountered an error. Please try again.",
        status: "error",
      };
    }
  }

  /**
   * Call Claude Code with the game server wizard system prompt
   */
  private async callClaudeCode(
    session: AISession,
    userMessage: string
  ): Promise<ClaudeResponse> {
    const { spawn } = await import("node:child_process");

    try {
      // Use a simplified system prompt that fits in CLI args
      const systemPrompt = `You are an expert at setting up game servers in Docker containers. Generate bash scripts for SpinUp's Ubuntu 22.04 containers with /data volume. Scripts MUST use 'set -euo pipefail' and 'exec' for the final command. Use SteamCMD for Steam games, direct downloads for others. Include progress echo statements. Support env vars like \${SERVER_PORT:-27015}. Wrap scripts in \`\`\`bash blocks.`;

      // Build conversation context
      const conversationContext = session.messages
        .slice(-6) // Last 6 messages for context
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n\n");

      const fullPrompt = conversationContext
        ? `${conversationContext}\n\nUser: ${userMessage}`
        : `User: ${userMessage}`;

      // Call Claude Code CLI with working directory set to project root
      const path = await import("node:path");
      const projectRoot = path.join(__dirname, "../../../..");

      return new Promise((resolve, reject) => {
        const claude = spawn("claude", [
          "-p",
          "--output-format",
          "text",
          "--append-system-prompt",
          systemPrompt,
          "--dangerously-skip-permissions",
          fullPrompt,
        ], {
          cwd: projectRoot
        });

        let stdout = "";
        let stderr = "";

        claude.stdout.on("data", (data) => {
          stdout += data.toString();
        });

        claude.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        claude.on("error", (error) => {
          reject(new Error(`Failed to spawn Claude: ${error.message}`));
        });

        claude.on("close", (code) => {
          if (code !== 0 && code !== null) {
            console.error("Claude stderr:", stderr);
            reject(new Error(`Claude exited with code ${code}: ${stderr}`));
            return;
          }

          if (stderr && !stderr.includes("workspace trust")) {
            console.warn("Claude stderr:", stderr);
          }

          // Parse response
          let status: "researching" | "drafting" | "ready" | "error" = "ready";
          const lowerOut = stdout.toLowerCase();
          if (
            lowerOut.includes("researching") ||
            lowerOut.includes("looking up") ||
            lowerOut.includes("let me search")
          ) {
            status = "researching";
          } else if (
            lowerOut.includes("draft") ||
            lowerOut.includes("generating") ||
            lowerOut.includes("creating")
          ) {
            status = "drafting";
          } else if (stdout.includes("```bash")) {
            status = "ready";
          }

          resolve({
            message: stdout.trim(),
            status,
          });
        });

        // Set timeout
        setTimeout(() => {
          claude.kill();
          reject(new Error("Claude Code timeout after 90 seconds"));
        }, 90000);
      });
    } catch (error: any) {
      console.error("Claude Code execution error:", error);
      throw new Error(`Failed to call Claude Code: ${error.message}`);
    }
  }

  /**
   * Validate a generated script
   */
  async validateScript(script: string): Promise<{
    valid: boolean;
    issues: Array<{ type: "error" | "warning"; message: string }>;
    suggestions: string[];
  }> {
    const issues: Array<{ type: "error" | "warning"; message: string }> = [];
    const suggestions: string[] = [];

    // Check for required header
    if (!script.includes("set -euo pipefail")) {
      issues.push({
        type: "error",
        message: "Script must include 'set -euo pipefail' for error handling",
      });
    }

    // Check for exec
    if (!script.includes("exec ")) {
      issues.push({
        type: "error",
        message: "Script must use 'exec' for the final server command",
      });
    }

    // Check for dangerous patterns
    const dangerousPatterns = [
      { pattern: /rm\s+-rf\s+\/\s*$/m, message: "Dangerous: rm -rf / detected" },
      { pattern: /curl.*\|\s*sh/i, message: "Dangerous: piped curl execution detected" },
      { pattern: /wget.*\|\s*sh/i, message: "Dangerous: piped wget execution detected" },
      { pattern: /eval\s+/i, message: "Dangerous: eval usage detected" },
      { pattern: /sudo\s+/i, message: "Warning: sudo not available in container" },
    ];

    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(script)) {
        issues.push({ type: "error", message });
      }
    }

    // Check for best practices
    if (!script.includes("echo ")) {
      suggestions.push("Consider adding progress messages with 'echo'");
    }

    if (!script.includes("cd /data")) {
      suggestions.push("Ensure the script changes to /data directory for installation");
    }

    const valid = issues.filter((i) => i.type === "error").length === 0;

    return { valid, issues, suggestions };
  }

  /**
   * Finalize the script and prepare for server creation
   */
  async finalizeScript(
    sessionId: string,
    script: string,
    metadata: {
      ports: Array<{ container: number; proto: "tcp" | "udp" }>;
      envVars: Record<string, string>;
    }
  ): Promise<{
    script: string;
    scriptHash: string;
    ports: Array<{ container: number; proto: "tcp" | "udp" }>;
    envVars: Record<string, string>;
  }> {
    const session = sessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found or expired");
    }

    // Validate script one final time
    const validation = await this.validateScript(script);
    if (!validation.valid) {
      throw new Error(
        `Script validation failed: ${validation.issues.map((i) => i.message).join(", ")}`
      );
    }

    // Generate script hash
    const crypto = await import("node:crypto");
    const scriptHash = crypto.createHash("sha256").update(script).digest("hex");

    // Store metadata in session
    session.scriptMetadata = {
      ports: metadata.ports,
      envVars: metadata.envVars,
      resources: session.context.systemRequirements || { memory: 2048, cpu: 2048 },
    };

    // Clean up session after finalization
    sessions.delete(sessionId);

    return {
      script,
      scriptHash,
      ports: metadata.ports,
      envVars: metadata.envVars,
    };
  }

  /**
   * Get session info
   */
  getSession(sessionId: string): AISession | undefined {
    const session = sessions.get(sessionId);
    if (session && new Date() <= session.expiresAt) {
      return session;
    }
    if (session) {
      sessions.delete(sessionId);
    }
    return undefined;
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions() {
    const now = new Date();
    for (const [id, session] of sessions.entries()) {
      if (now > session.expiresAt) {
        sessions.delete(id);
      }
    }
  }


  /**
   * Extract environment variables from script
   */
  private extractEnvVars(script: string): Record<string, string> {
    const envVars: Record<string, string> = {};

    // Match ${VAR:-default} or ${VAR}
    const matches = script.matchAll(/\$\{([A-Z_]+):-([^}]+)\}/g);

    for (const match of matches) {
      const [, varName, defaultValue] = match;
      envVars[varName] = defaultValue.replace(/['"]/g, "");
    }

    return envVars;
  }

  /**
   * Extract ports from context or script comments
   */
  private extractPorts(session: AISession): Array<{ container: number; proto: "tcp" | "udp" }> {
    if (session.context.ports && session.context.ports.length > 0) {
      return session.context.ports;
    }

    // Default ports based on game if known
    const gameName = session.context.gameName?.toLowerCase();
    if (gameName?.includes("terraria")) {
      return [{ container: 7777, proto: "tcp" }];
    }
    if (gameName?.includes("minecraft")) {
      return [{ container: 25565, proto: "tcp" }];
    }
    if (gameName?.includes("valheim")) {
      return [
        { container: 2456, proto: "udp" },
        { container: 2457, proto: "udp" },
        { container: 2458, proto: "udp" },
      ];
    }

    // Default
    return [{ container: 27015, proto: "udp" }];
  }
}

// Export singleton instance
export const claudeAssistant = new ClaudeAssistant();
