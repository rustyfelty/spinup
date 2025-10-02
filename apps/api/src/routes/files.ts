import { FastifyPluginCallback } from "fastify";
import { z } from "zod";
import { prisma } from "../services/prisma";
import { fileManager } from "../services/file-manager";

const ListFilesSchema = z.object({
  serverId: z.string(),
  path: z.string().optional().default("/")
});

const ReadFileSchema = z.object({
  serverId: z.string(),
  path: z.string()
});

const WriteFileSchema = z.object({
  serverId: z.string(),
  path: z.string(),
  content: z.string()
});

const DeleteFileSchema = z.object({
  serverId: z.string(),
  path: z.string()
});

const CreateDirSchema = z.object({
  serverId: z.string(),
  path: z.string()
});

export const fileRoutes: FastifyPluginCallback = (app, _opts, done) => {
  // List files in a directory
  app.get<{
    Querystring: { serverId: string; path?: string };
  }>("/list", async (req, reply) => {
    try {
      const { serverId, path = "/" } = ListFilesSchema.parse(req.query);

      // Verify server exists and user has access
      const server = await prisma.server.findUnique({
        where: { id: serverId },
        include: { org: true }
      });

      if (!server) {
        return reply.code(404).send({ error: "Server not found" });
      }

      if (!server.containerId) {
        return reply.code(400).send({ error: "Server container not available" });
      }

      const files = await fileManager.listFiles(server.containerId, path);
      return reply.send({ files });
    } catch (error: any) {
      app.log.error("Failed to list files:", error);
      return reply.code(500).send({ error: error.message || "Internal server error" });
    }
  });

  // Read file contents
  app.get<{
    Querystring: { serverId: string; path: string };
  }>("/read", async (req, reply) => {
    try {
      const { serverId, path } = ReadFileSchema.parse(req.query);

      const server = await prisma.server.findUnique({
        where: { id: serverId }
      });

      if (!server) {
        return reply.code(404).send({ error: "Server not found" });
      }

      if (!server.containerId) {
        return reply.code(400).send({ error: "Server container not available" });
      }

      const content = await fileManager.readFile(server.containerId, path);
      return reply.send({ content });
    } catch (error: any) {
      app.log.error("Failed to read file:", error);
      return reply.code(500).send({ error: error.message || "Internal server error" });
    }
  });

  // Write file contents
  app.post<{
    Body: { serverId: string; path: string; content: string };
  }>("/write", async (req, reply) => {
    try {
      const { serverId, path, content } = WriteFileSchema.parse(req.body);

      const server = await prisma.server.findUnique({
        where: { id: serverId }
      });

      if (!server) {
        return reply.code(404).send({ error: "Server not found" });
      }

      if (!server.containerId) {
        return reply.code(400).send({ error: "Server container not available" });
      }

      await fileManager.writeFile(server.containerId, path, content);
      return reply.send({ success: true });
    } catch (error: any) {
      app.log.error("Failed to write file:", error);
      // Return 400 for validation errors, 500 for others
      if (error.message?.includes("Path traversal") || error.message?.includes("Access denied")) {
        return reply.code(400).send({ error: error.message });
      }
      return reply.code(500).send({ error: error.message || "Internal server error" });
    }
  });

  // Delete file or directory
  app.delete<{
    Body: { serverId: string; path: string };
  }>("/delete", {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: "1 minute"
      }
    }
  }, async (req, reply) => {
    try {
      const { serverId, path } = DeleteFileSchema.parse(req.body);

      const server = await prisma.server.findUnique({
        where: { id: serverId }
      });

      if (!server) {
        return reply.code(404).send({ error: "Server not found" });
      }

      if (!server.containerId) {
        return reply.code(400).send({ error: "Server container not available" });
      }

      await fileManager.deleteFile(server.containerId, path);
      return reply.send({ success: true });
    } catch (error: any) {
      app.log.error("Failed to delete file:", error);
      return reply.code(500).send({ error: error.message || "Internal server error" });
    }
  });

  // Create directory
  app.post<{
    Body: { serverId: string; path: string };
  }>("/mkdir", async (req, reply) => {
    try {
      const { serverId, path } = CreateDirSchema.parse(req.body);

      const server = await prisma.server.findUnique({
        where: { id: serverId }
      });

      if (!server) {
        return reply.code(404).send({ error: "Server not found" });
      }

      if (!server.containerId) {
        return reply.code(400).send({ error: "Server container not available" });
      }

      await fileManager.createDirectory(server.containerId, path);
      return reply.send({ success: true });
    } catch (error: any) {
      app.log.error("Failed to create directory:", error);
      return reply.code(500).send({ error: error.message || "Internal server error" });
    }
  });

  // Download file
  app.get<{
    Querystring: { serverId: string; path: string };
  }>("/download", async (req, reply) => {
    try {
      const { serverId, path } = ReadFileSchema.parse(req.query);

      const server = await prisma.server.findUnique({
        where: { id: serverId }
      });

      if (!server) {
        return reply.code(404).send({ error: "Server not found" });
      }

      if (!server.containerId) {
        return reply.code(400).send({ error: "Server container not available" });
      }

      const content = await fileManager.readFile(server.containerId, path);
      const filename = path.split("/").pop() || "download";

      reply.header("Content-Disposition", `attachment; filename="${filename}"`);
      return reply.send(content);
    } catch (error: any) {
      app.log.error("Failed to download file:", error);
      return reply.code(500).send({ error: error.message || "Internal server error" });
    }
  });

  // Upload file
  app.post("/upload", {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: "1 minute"
      }
    }
  }, async (req, reply) => {
    try {
      const data = await req.file();
      if (!data) {
        return reply.code(400).send({ error: "No file uploaded" });
      }

      const buffer = await data.toBuffer();
      const serverId = data.fields.serverId?.value as string;
      const path = data.fields.path?.value as string;

      if (!serverId || !path) {
        return reply.code(400).send({ error: "serverId and path are required" });
      }

      const server = await prisma.server.findUnique({
        where: { id: serverId }
      });

      if (!server) {
        return reply.code(404).send({ error: "Server not found" });
      }

      if (!server.containerId) {
        return reply.code(400).send({ error: "Server container not available" });
      }

      // Upload file to container
      const fullPath = `${path}/${data.filename}`;
      await fileManager.uploadFile(server.containerId, fullPath, buffer);

      return reply.send({ success: true, path: fullPath });
    } catch (error: any) {
      app.log.error("Failed to upload file:", error);
      return reply.code(500).send({ error: error.message || "Internal server error" });
    }
  });

  // Extract zip file
  app.post<{
    Body: { serverId: string; zipPath: string; extractPath?: string };
  }>("/extract-zip", async (req, reply) => {
    try {
      const { serverId, zipPath, extractPath } = z.object({
        serverId: z.string(),
        zipPath: z.string(),
        extractPath: z.string().optional()
      }).parse(req.body);

      const server = await prisma.server.findUnique({
        where: { id: serverId }
      });

      if (!server) {
        return reply.code(404).send({ error: "Server not found" });
      }

      if (!server.containerId) {
        return reply.code(400).send({ error: "Server container not available" });
      }

      await fileManager.extractZip(server.containerId, zipPath, extractPath);
      return reply.send({ success: true });
    } catch (error: any) {
      app.log.error("Failed to extract zip:", error);
      return reply.code(500).send({ error: error.message || "Internal server error" });
    }
  });

  // Compress files to zip
  app.post<{
    Body: { serverId: string; sourcePaths: string[]; zipPath: string };
  }>("/compress-zip", async (req, reply) => {
    try {
      const { serverId, sourcePaths, zipPath } = z.object({
        serverId: z.string(),
        sourcePaths: z.array(z.string()),
        zipPath: z.string()
      }).parse(req.body);

      const server = await prisma.server.findUnique({
        where: { id: serverId }
      });

      if (!server) {
        return reply.code(404).send({ error: "Server not found" });
      }

      if (!server.containerId) {
        return reply.code(400).send({ error: "Server container not available" });
      }

      await fileManager.compressZip(server.containerId, sourcePaths, zipPath);
      return reply.send({ success: true, zipPath });
    } catch (error: any) {
      app.log.error("Failed to compress zip:", error);
      return reply.code(500).send({ error: error.message || "Internal server error" });
    }
  });

  done();
};
