import { FastifyPluginCallback } from "fastify";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../services/prisma";
import { mcConfigSchema } from "@spinup/shared";

export const configRoutes: FastifyPluginCallback = (app, _opts, done) => {
  // Get server configuration
  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

    try {
      const server = await prisma.server.findUnique({
        where: { id }
      });

      if (!server) {
        return reply.code(404).send({ error: "Server not found" });
      }

      // Only support Minecraft Java for MVP
      if (server.gameKey !== "minecraft-java") {
        return reply.code(501).send({
          error: "adapter_not_ready",
          message: "Configuration editor only available for Minecraft Java servers"
        });
      }

      // Read server.properties file
      const root = process.env.DATA_DIR || "/srv/spinup";
      const configFile = path.join(root, server.id, "data", "server.properties");

      try {
        const properties = await readProperties(configFile);

        // Parse into our config schema
        const config = mcConfigSchema.parse({
          level_name: properties["level-name"] || "world",
          difficulty: properties["difficulty"] || "easy",
          max_players: properties["max-players"] || "10",
          online_mode: properties["online-mode"] || "true",
          pvp: properties["pvp"] || "true",
          motd: properties["motd"] || "A Minecraft Server",
          gamemode: properties["gamemode"] || "survival",
          spawn_protection: properties["spawn-protection"] || "16",
          view_distance: properties["view-distance"] || "10",
          enable_command_block: properties["enable-command-block"] || "false",
          allow_flight: properties["allow-flight"] || "false",
          white_list: properties["white-list"] || "false"
        });

        return reply.send(config);

      } catch (error: any) {
        if (error.code === "ENOENT") {
          // File doesn't exist yet, return defaults
          return reply.send(mcConfigSchema.parse({}));
        }
        throw error;
      }

    } catch (error) {
      app.log.error("Failed to get config:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  // Update server configuration
  app.put("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

    try {
      const server = await prisma.server.findUnique({
        where: { id }
      });

      if (!server) {
        return reply.code(404).send({ error: "Server not found" });
      }

      // Only support Minecraft Java for MVP
      if (server.gameKey !== "minecraft-java") {
        return reply.code(501).send({
          error: "adapter_not_ready",
          message: "Configuration editor only available for Minecraft Java servers"
        });
      }

      // Validate config
      const result = mcConfigSchema.safeParse(req.body);
      if (!result.success) {
        return reply.code(400).send({
          error: "Invalid configuration",
          details: result.error.flatten()
        });
      }

      const config = result.data;

      // Prepare properties format
      const properties: Record<string, string> = {
        "level-name": config.level_name,
        "difficulty": config.difficulty,
        "max-players": String(config.max_players),
        "online-mode": config.online_mode,
        "pvp": config.pvp,
        "motd": config.motd,
        "gamemode": config.gamemode,
        "spawn-protection": String(config.spawn_protection),
        "view-distance": String(config.view_distance),
        "enable-command-block": config.enable_command_block,
        "allow-flight": config.allow_flight,
        "white-list": config.white_list
      };

      // Write to file
      const root = process.env.DATA_DIR || "/srv/spinup";
      const configFile = path.join(root, server.id, "data", "server.properties");

      // Ensure directory exists
      await fs.mkdir(path.dirname(configFile), { recursive: true });

      // Write properties file
      await writeProperties(configFile, properties);

      // Save config version to database
      await prisma.configVersion.create({
        data: {
          serverId: server.id,
          schemaVer: "1.0",
          values: config as any,
          createdBy: "system" // TODO: Use authenticated user ID
        }
      });

      // Server needs restart for changes to take effect
      const needsRestart = server.status === "RUNNING";

      return reply.send({
        ok: true,
        needsRestart,
        message: needsRestart
          ? "Configuration saved. Restart the server for changes to take effect."
          : "Configuration saved."
      });

    } catch (error) {
      app.log.error("Failed to update config:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  // Get config history
  app.get("/:id/history", async (req, reply) => {
    const { id } = req.params as { id: string };

    try {
      const server = await prisma.server.findUnique({
        where: { id }
      });

      if (!server) {
        return reply.code(404).send({ error: "Server not found" });
      }

      const versions = await prisma.configVersion.findMany({
        where: { serverId: id },
        orderBy: { createdAt: "desc" },
        take: 10
      });

      return reply.send(versions);

    } catch (error) {
      app.log.error("Failed to get config history:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  done();
};

// Helper functions for reading/writing properties files
async function readProperties(filePath: string): Promise<Record<string, string>> {
  const content = await fs.readFile(filePath, "utf8");
  const lines = content.split("\n");
  const properties: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (trimmed.startsWith("#") || trimmed === "") {
      continue;
    }

    const index = trimmed.indexOf("=");
    if (index > 0) {
      const key = trimmed.substring(0, index).trim();
      const value = trimmed.substring(index + 1).trim();
      properties[key] = value;
    }
  }

  return properties;
}

async function writeProperties(filePath: string, properties: Record<string, string>): Promise<void> {
  const lines: string[] = [
    "# Minecraft server properties",
    "# Generated by SpinUp",
    `# ${new Date().toISOString()}`,
    ""
  ];

  for (const [key, value] of Object.entries(properties)) {
    lines.push(`${key}=${value}`);
  }

  await fs.writeFile(filePath, lines.join("\n"), "utf8");
}