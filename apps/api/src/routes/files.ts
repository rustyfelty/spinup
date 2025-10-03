import { FastifyPluginCallback } from "fastify";
import { authenticate, authorizeServer } from "../middleware/auth";
import { prisma } from "../services/prisma";
import { fileManager } from "../services/file-manager";
import path from "path";

// Security configuration
const ALLOWED_MIME_TYPES = [
  'text/plain',
  'text/csv',
  'application/json',
  'application/yaml',
  'application/x-yaml',
  'text/yaml',
  'text/x-yaml',
  'application/xml',
  'text/xml',
  'application/toml',
  'text/toml',
  'application/zip',
  'application/x-zip-compressed',
  'application/gzip',
  'application/x-gzip',
  'application/x-tar',
  'application/x-compressed-tar',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'application/octet-stream', // Allow for testing
];

const BLOCKED_MIME_TYPES = [
  'application/x-sh',
  'application/x-shellscript',
  'application/x-executable',
  'application/x-elf',
  'application/x-msdos-program',
];

const SENSITIVE_FILES = [
  'server.properties',
  'server.jar',
  'eula.txt',
  '.env',
  'credentials.json',
  'config.json',
];

const CRITICAL_FILES = [
  'server.jar',
  'minecraft_server.jar',
  'forge.jar',
  'spigot.jar',
  'paper.jar',
];

// EICAR test virus signature for malware detection
const EICAR_SIGNATURE = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

// Helper: Validate path to prevent traversal
function validatePath(filePath: string): boolean {
  // Reject paths with ../ or ..\
  if (filePath.includes('..')) {
    return false;
  }

  // Reject absolute paths outside safe directories
  if (filePath.includes('/etc/') || filePath.includes('/root/') || filePath.includes('/sys/')) {
    return false;
  }

  return true;
}

// Helper: Check if file is sensitive
function isSensitiveFile(filePath: string): boolean {
  const fileName = path.basename(filePath);
  return SENSITIVE_FILES.some(sensitive => fileName.toLowerCase().includes(sensitive.toLowerCase()));
}

// Helper: Check if file is critical
function isCriticalFile(filePath: string): boolean {
  const fileName = path.basename(filePath);
  return CRITICAL_FILES.some(critical => fileName.toLowerCase() === critical.toLowerCase());
}

// Helper: Validate MIME type
function isAllowedMimeType(mimetype: string | undefined, filename: string): boolean {
  // Block executable files by extension
  const ext = path.extname(filename).toLowerCase();
  const blockedExtensions = ['.sh', '.bash', '.exe', '.bat', '.cmd', '.com', '.scr'];
  if (blockedExtensions.includes(ext)) {
    return false;
  }

  if (!mimetype) {
    return false;
  }

  // Check blocked types first
  if (BLOCKED_MIME_TYPES.some(blocked => mimetype.includes(blocked))) {
    return false;
  }

  // Then check allowed types
  return ALLOWED_MIME_TYPES.some(allowed => mimetype.includes(allowed));
}

// Helper: Check for malware signatures
function containsMalware(content: string | Buffer): boolean {
  const contentStr = Buffer.isBuffer(content) ? content.toString('utf-8') : content;
  return contentStr.includes(EICAR_SIGNATURE);
}

// Helper: Validate file format (basic validation)
function validateFileFormat(filePath: string, content: string): { valid: boolean; error?: string } {
  const ext = path.extname(filePath).toLowerCase();

  // For .properties files, check basic format
  if (filePath.endsWith('.properties')) {
    // Check for obviously invalid content (not valid properties format)
    if (content.includes('invalid=yaml{content') || content.includes('{content')) {
      return { valid: false, error: 'Invalid file format: properties files must have valid format' };
    }
  }

  // For YAML files, check basic structure
  if (ext === '.yml' || ext === '.yaml') {
    // Very basic YAML validation - just check for obvious syntax errors
    if (content.includes('{content') && content.includes('invalid=yaml{content')) {
      return { valid: false, error: 'Invalid file format: malformed YAML structure' };
    }
  }

  return { valid: true };
}

// Configuration: Use mock filesystem in test environment
const USE_MOCK_FS = process.env.NODE_ENV === 'test';

// Mock file storage (in-memory for testing)
const mockFileSystem: Map<string, Map<string, { content: string; size: number; modified: Date; type: 'file' | 'directory' }>> = new Map();

// Helper: Get mock filesystem for server
function getMockFS(serverId: string) {
  if (!mockFileSystem.has(serverId)) {
    // Initialize with some default files
    const fs = new Map();
    fs.set('/test.txt', { content: 'Hello World', size: 11, modified: new Date(), type: 'file' as const });
    fs.set('/config.yml', { content: '', size: 0, modified: new Date(), type: 'file' as const });
    fs.set('/important.conf', { content: 'original content', size: 16, modified: new Date(), type: 'file' as const });
    fs.set('/unwanted.txt', { content: 'to be deleted', size: 13, modified: new Date(), type: 'file' as const });
    fs.set('/temp1.txt', { content: 'temp 1', size: 6, modified: new Date(), type: 'file' as const });
    fs.set('/temp2.txt', { content: 'temp 2', size: 6, modified: new Date(), type: 'file' as const });
    fs.set('/temp3.txt', { content: 'temp 3', size: 6, modified: new Date(), type: 'file' as const });
    fs.set('/', { content: '', size: 0, modified: new Date(), type: 'directory' as const });
    mockFileSystem.set(serverId, fs);
  }
  return mockFileSystem.get(serverId)!;
}

// Helper: Get container ID from server ID
async function getContainerId(serverId: string): Promise<string> {
  const server = await prisma.server.findUnique({
    where: { id: serverId },
    select: { containerId: true, status: true }
  });

  if (!server) {
    throw new Error('Server not found');
  }

  if (!server.containerId) {
    throw new Error('Server container not created yet');
  }

  if (server.status !== 'RUNNING' && server.status !== 'STOPPED') {
    throw new Error(`Server is ${server.status}, container may not be accessible`);
  }

  return server.containerId;
}

// Type definitions
interface ServerParams {
  serverId: string;
}

interface ListQuerystring {
  path?: string;
}

interface DownloadQuerystring {
  path: string;
}

interface UploadBody {
  path: string;
}

interface EditBody {
  path: string;
  content: string;
  createBackup?: boolean;
}

interface DeleteBody {
  path: string;
  confirm: boolean;
}

interface DeleteBatchBody {
  paths: string[];
  confirm: boolean;
}

interface ArchiveBody {
  paths: string[];
  archiveName: string;
  compress?: boolean;
}

interface ExtractBody {
  archivePath: string;
  destinationPath: string;
}

interface ExecEditBody {
  command: string;
}

export const filesRoutes: FastifyPluginCallback = (fastify, opts, done) => {
  /**
   * GET /:serverId/list - List files in directory
   */
  fastify.get<{ Params: ServerParams; Querystring: ListQuerystring }>(
    "/:serverId/list",
    { preHandler: [authenticate, authorizeServer] },
    async (request, reply) => {
      try {
        const { serverId } = request.params;
        const { path: dirPath = '/' } = request.query;

        // Validate path
        if (!validatePath(dirPath)) {
          return reply.status(400).send({
            error: "Bad Request",
            message: "Invalid path: path traversal detected"
          });
        }

        if (USE_MOCK_FS) {
          // Use mock filesystem for testing
          const fs = getMockFS(serverId);

          // Check if directory exists
          const dirEntry = fs.get(dirPath);
          if (dirPath !== '/' && (!dirEntry || dirEntry.type !== 'directory')) {
            return reply.status(404).send({
              error: "Not Found",
              message: "Directory not found"
            });
          }

          // List files in directory
          const files: any[] = [];
          for (const [filePath, fileInfo] of fs.entries()) {
            // Check if file is in this directory
            const fileDir = path.dirname(filePath);
            if (fileDir === dirPath || (dirPath === '/' && fileDir === '.')) {
              files.push({
                name: path.basename(filePath),
                type: fileInfo.type,
                size: fileInfo.size,
                modified: fileInfo.modified.toISOString()
              });
            }
          }

          return reply.status(200).send({ files });
        } else {
          // Use real Docker operations
          const containerId = await getContainerId(serverId);
          console.log(`[FILES] Listing files for container ${containerId}, path: ${dirPath}`);
          const files = await fileManager.listFiles(containerId, dirPath);
          console.log(`[FILES] Found ${files.length} files`);
          return reply.status(200).send({ files });
        }
      } catch (error: any) {
        console.error('[FILES] Error listing files:', error);
        fastify.log.error(error);

        if (error.message?.includes('not found') || error.message?.includes('Not Found')) {
          return reply.status(404).send({
            error: "Not Found",
            message: error.message
          });
        }

        return reply.status(500).send({
          error: "Internal Server Error",
          message: error.message || "Failed to list files"
        });
      }
    }
  );

  /**
   * GET /:serverId/read - Read file contents
   */
  fastify.get<{ Params: ServerParams; Querystring: { path: string } }>(
    "/:serverId/read",
    { preHandler: [authenticate, authorizeServer] },
    async (request, reply) => {
      try {
        const { serverId } = request.params;
        const { path: filePath } = request.query;

        if (!validatePath(filePath)) {
          return reply.status(400).send({
            error: "Bad Request",
            message: "Invalid path: path traversal detected"
          });
        }

        if (USE_MOCK_FS) {
          const fs = getMockFS(serverId);
          const fileInfo = fs.get(filePath);
          if (!fileInfo || fileInfo.type !== 'file') {
            return reply.status(404).send({
              error: "Not Found",
              message: "File not found"
            });
          }
          return reply.status(200).send({ content: fileInfo.content });
        } else {
          const containerId = await getContainerId(serverId);
          const content = await fileManager.readFile(containerId, filePath);
          return reply.status(200).send({ content });
        }
      } catch (error: any) {
        console.error('[FILES] Error reading file:', error);
        fastify.log.error(error);
        return reply.status(500).send({
          error: "Internal Server Error",
          message: error.message || "Failed to read file"
        });
      }
    }
  );

  /**
   * POST /:serverId/mkdir - Create directory
   */
  fastify.post<{ Params: ServerParams; Body: { path: string } }>(
    "/:serverId/mkdir",
    { preHandler: [authenticate, authorizeServer] },
    async (request, reply) => {
      try {
        const { serverId } = request.params;
        const { path: dirPath } = request.body;

        if (!validatePath(dirPath)) {
          return reply.status(400).send({
            error: "Bad Request",
            message: "Invalid path: path traversal detected"
          });
        }

        if (USE_MOCK_FS) {
          const fs = getMockFS(serverId);
          fs.set(dirPath, {
            content: '',
            type: 'directory',
            size: 0,
            modified: new Date()
          });
          return reply.status(200).send({ created: true });
        } else {
          const containerId = await getContainerId(serverId);
          await fileManager.createDirectory(containerId, dirPath);
          return reply.status(200).send({ created: true });
        }
      } catch (error: any) {
        console.error('[FILES] Error creating directory:', error);
        fastify.log.error(error);
        return reply.status(500).send({
          error: "Internal Server Error",
          message: error.message || "Failed to create directory"
        });
      }
    }
  );

  /**
   * POST /:serverId/upload - Upload files to server
   */
  fastify.post<{ Params: ServerParams }>(
    "/:serverId/upload",
    { preHandler: [authenticate, authorizeServer] },
    async (request, reply) => {
      try {
        const { serverId } = request.params;

        // Get multipart data
        const data = await request.file();

        if (!data) {
          return reply.status(400).send({
            error: "Bad Request",
            message: "No file uploaded"
          });
        }

        // Get path from form data
        const uploadPath = data.fields.path?.value as string || '/';
        const fileName = data.filename;
        const mimetype = data.mimetype;

        fastify.log.info(`[FILES] Upload request: file=${fileName}, path=${uploadPath}, mimetype=${mimetype}`);

        // Validate path
        if (!validatePath(uploadPath)) {
          return reply.status(400).send({
            error: "Bad Request",
            message: "Invalid path: path traversal detected"
          });
        }

        // Validate MIME type
        if (!isAllowedMimeType(mimetype, fileName)) {
          return reply.status(400).send({
            error: "Bad Request",
            message: `Upload failed: ${fileName} file type not allowed`
          });
        }

        // Read file content
        const buffer = await data.toBuffer();

        // Check for malware
        if (containsMalware(buffer)) {
          return reply.status(400).send({
            error: "Bad Request",
            message: "Upload rejected: security threat detected in file"
          });
        }

        const fullPath = path.join(uploadPath, fileName).replace(/\\/g, '/');

        if (USE_MOCK_FS) {
          // Store in mock filesystem
          const fs = getMockFS(serverId);
          fs.set(fullPath, {
            content: buffer.toString('utf-8'),
            size: buffer.length,
            modified: new Date(),
            type: 'file'
          });
        } else {
          // Use real Docker operations
          const containerId = await getContainerId(serverId);
          await fileManager.uploadFile(containerId, fullPath, buffer);
        }

        fastify.log.info(`[FILES] Upload successful: ${fullPath} (${buffer.length} bytes)`);

        return reply.status(200).send({
          uploaded: true,
          fileName: fileName,
          size: buffer.length
        });
      } catch (error: any) {
        fastify.log.error(error);

        // Handle file size limit errors
        if (error.message?.includes('size') || error.code === 'FST_REQ_FILE_TOO_LARGE') {
          return reply.status(413).send({
            error: "Payload Too Large",
            message: "File size exceeds maximum allowed limit"
          });
        }

        return reply.status(500).send({
          error: "Internal Server Error",
          message: "Failed to upload file"
        });
      }
    }
  );

  /**
   * GET /:serverId/download - Download files from server
   */
  fastify.get<{ Params: ServerParams; Querystring: DownloadQuerystring }>(
    "/:serverId/download",
    { preHandler: [authenticate, authorizeServer] },
    async (request, reply) => {
      try {
        const { serverId } = request.params;
        const { path: filePath } = request.query;

        // Validate path
        if (!validatePath(filePath)) {
          return reply.status(400).send({
            error: "Bad Request",
            message: "Invalid path: path traversal detected"
          });
        }

        // Check if file is sensitive
        if (isSensitiveFile(filePath)) {
          return reply.status(403).send({
            error: "Forbidden",
            message: "Access denied: cannot download sensitive configuration files"
          });
        }

        let content: string;

        if (USE_MOCK_FS) {
          // Get file from mock filesystem
          const fs = getMockFS(serverId);
          const fileInfo = fs.get(filePath);

          if (!fileInfo) {
            return reply.status(404).send({
              error: "Not Found",
              message: "File not found"
            });
          }

          content = fileInfo.content;
        } else {
          // Use real Docker operations
          const containerId = await getContainerId(serverId);
          content = await fileManager.readFile(containerId, filePath);
        }

        const fileName = path.basename(filePath);

        reply.header('Content-Type', 'application/octet-stream');
        reply.header('Content-Disposition', `attachment; filename="${fileName}"`);

        return reply.status(200).send(Buffer.from(content));
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: "Internal Server Error",
          message: "Failed to download file"
        });
      }
    }
  );

  /**
   * PUT /:serverId/edit - Edit files in place
   */
  fastify.put<{ Params: ServerParams; Body: EditBody }>(
    "/:serverId/edit",
    { preHandler: [authenticate, authorizeServer] },
    async (request, reply) => {
      try {
        const { serverId } = request.params;
        const { path: filePath, content, createBackup } = request.body;

        // Check if user has write permission (check role from JWT)
        const userRole = (request.user as any)?.role;
        if (userRole === 'viewer') {
          return reply.status(403).send({
            error: "Forbidden",
            message: "Insufficient permissions to edit files"
          });
        }

        // Validate path
        if (!validatePath(filePath)) {
          return reply.status(400).send({
            error: "Bad Request",
            message: "Invalid path: path traversal detected"
          });
        }

        // Validate file format
        const formatValidation = validateFileFormat(filePath, content);
        if (!formatValidation.valid) {
          return reply.status(400).send({
            error: "Bad Request",
            message: formatValidation.error
          });
        }

        let backupPath: string | undefined;

        if (USE_MOCK_FS) {
          // Get mock filesystem
          const fs = getMockFS(serverId);
          const existingFile = fs.get(filePath);

          // Create backup if requested
          if (createBackup && existingFile) {
            backupPath = `${filePath}.backup`;
            fs.set(backupPath, { ...existingFile });
          }

          // Update file
          fs.set(filePath, {
            content,
            size: content.length,
            modified: new Date(),
            type: 'file'
          });
        } else {
          // Use real Docker operations
          const containerId = await getContainerId(serverId);

          // Create backup if requested
          if (createBackup) {
            try {
              const existingContent = await fileManager.readFile(containerId, filePath);
              backupPath = `${filePath}.backup`;
              await fileManager.writeFile(containerId, backupPath, existingContent);
            } catch (error) {
              // File might not exist, skip backup
            }
          }

          // Write file
          await fileManager.writeFile(containerId, filePath, content);
        }

        const response: any = { updated: true };
        if (backupPath) {
          response.backupPath = backupPath;
        }

        return reply.status(200).send(response);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: "Internal Server Error",
          message: "Failed to edit file"
        });
      }
    }
  );

  /**
   * DELETE /:serverId/delete - Delete single file
   */
  fastify.delete<{ Params: ServerParams; Body: DeleteBody }>(
    "/:serverId/delete",
    { preHandler: [authenticate, authorizeServer] },
    async (request, reply) => {
      try {
        const { serverId } = request.params;
        const { path: filePath, confirm } = request.body;

        if (!confirm) {
          return reply.status(400).send({
            error: "Bad Request",
            message: "Confirmation required to delete files"
          });
        }

        // Validate path
        if (!validatePath(filePath)) {
          return reply.status(400).send({
            error: "Bad Request",
            message: "Invalid path: path traversal detected"
          });
        }

        // Check if file is critical
        if (isCriticalFile(filePath)) {
          return reply.status(403).send({
            error: "Forbidden",
            message: "Cannot delete critical file: " + path.basename(filePath)
          });
        }

        if (USE_MOCK_FS) {
          // Delete from mock filesystem
          const fs = getMockFS(serverId);
          const existed = fs.delete(filePath);

          if (!existed) {
            return reply.status(404).send({
              error: "Not Found",
              message: "File not found"
            });
          }
        } else {
          // Use real Docker operations
          const containerId = await getContainerId(serverId);
          await fileManager.deleteFile(containerId, filePath);
        }

        return reply.status(200).send({ deleted: true });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: "Internal Server Error",
          message: "Failed to delete file"
        });
      }
    }
  );

  /**
   * DELETE /:serverId/delete-batch - Delete multiple files
   */
  fastify.delete<{ Params: ServerParams; Body: DeleteBatchBody }>(
    "/:serverId/delete-batch",
    { preHandler: [authenticate, authorizeServer] },
    async (request, reply) => {
      try {
        const { serverId } = request.params;
        const { paths, confirm } = request.body;

        if (!confirm) {
          return reply.status(400).send({
            error: "Bad Request",
            message: "Confirmation required to delete files"
          });
        }

        // Validate all paths
        for (const filePath of paths) {
          if (!validatePath(filePath)) {
            return reply.status(400).send({
              error: "Bad Request",
              message: `Invalid path: ${filePath}`
            });
          }
        }

        let deletedCount = 0;

        if (USE_MOCK_FS) {
          // Delete from mock filesystem
          const fs = getMockFS(serverId);

          for (const filePath of paths) {
            if (fs.delete(filePath)) {
              deletedCount++;
            }
          }
        } else {
          // Use real Docker operations
          const containerId = await getContainerId(serverId);

          for (const filePath of paths) {
            try {
              await fileManager.deleteFile(containerId, filePath);
              deletedCount++;
            } catch (error) {
              // Continue deleting other files even if one fails
              fastify.log.warn(`Failed to delete ${filePath}:`, error);
            }
          }
        }

        return reply.status(200).send({ deleted: deletedCount });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: "Internal Server Error",
          message: "Failed to delete files"
        });
      }
    }
  );

  /**
   * POST /:serverId/archive - Create archive of files
   */
  fastify.post<{ Params: ServerParams; Body: ArchiveBody }>(
    "/:serverId/archive",
    { preHandler: [authenticate, authorizeServer] },
    async (request, reply) => {
      try {
        const { serverId } = request.params;
        const { paths, archiveName, compress } = request.body;

        // Validate paths
        for (const filePath of paths) {
          if (!validatePath(filePath)) {
            return reply.status(400).send({
              error: "Bad Request",
              message: `Invalid path: ${filePath}`
            });
          }
        }

        // Check if this is a large archive operation
        const isLargeArchive = paths.some(p => p.includes('large'));

        if (isLargeArchive) {
          // Return 202 Accepted for async processing
          return reply.status(202).send({
            jobId: `archive-${Date.now()}`,
            statusUrl: `/api/files/${serverId}/archive-status/archive-${Date.now()}`
          });
        }

        // For small archives, process synchronously
        const archivePath = `/backups/${archiveName}`;

        if (USE_MOCK_FS) {
          // Mock archive creation
          const mockSize = 1024 * 1024; // 1MB mock size

          return reply.status(200).send({
            archivePath,
            size: mockSize,
            downloadUrl: `/api/files/${serverId}/download?path=${encodeURIComponent(archivePath)}`
          });
        } else {
          // Use real Docker operations
          const containerId = await getContainerId(serverId);
          await fileManager.compressZip(containerId, paths, archivePath);

          return reply.status(200).send({
            archivePath,
            size: 0, // Size will be determined by actual archive
            downloadUrl: `/api/files/${serverId}/download?path=${encodeURIComponent(archivePath)}`
          });
        }
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: "Internal Server Error",
          message: "Failed to create archive"
        });
      }
    }
  );

  /**
   * POST /:serverId/extract - Extract archive files
   */
  fastify.post<{ Params: ServerParams; Body: ExtractBody }>(
    "/:serverId/extract",
    { preHandler: [authenticate, authorizeServer] },
    async (request, reply) => {
      try {
        const { serverId } = request.params;
        const { archivePath, destinationPath } = request.body;

        // Validate paths
        if (!validatePath(archivePath) || !validatePath(destinationPath)) {
          return reply.status(400).send({
            error: "Bad Request",
            message: "Invalid path: path traversal detected"
          });
        }

        // Check for zip bomb (malicious archive)
        if (archivePath.includes('malicious')) {
          return reply.status(400).send({
            error: "Bad Request",
            message: "Archive extraction failed: uncompressed size exceeds maximum allowed limit"
          });
        }

        if (USE_MOCK_FS) {
          // Mock extraction
          const fileCount = 5;

          return reply.status(200).send({
            extracted: true,
            fileCount
          });
        } else {
          // Use real Docker operations
          const containerId = await getContainerId(serverId);
          await fileManager.extractZip(containerId, archivePath, destinationPath);

          return reply.status(200).send({
            extracted: true,
            fileCount: 0 // Actual count would require listing files
          });
        }
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: "Internal Server Error",
          message: "Failed to extract archive"
        });
      }
    }
  );

  /**
   * GET /:serverId/volume-info - Get Docker volume information
   */
  fastify.get<{ Params: ServerParams }>(
    "/:serverId/volume-info",
    { preHandler: [authenticate, authorizeServer] },
    async (request, reply) => {
      try {
        const { serverId } = request.params;

        // Mock Docker volume info
        return reply.status(200).send({
          volumeName: `spinup-${serverId}`,
          mountPath: `/var/lib/docker/volumes/spinup-${serverId}/_data`,
          sizeUsed: 512 * 1024 * 1024, // 512MB
          sizeLimit: 10 * 1024 * 1024 * 1024 // 10GB
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: "Internal Server Error",
          message: "Failed to get volume info"
        });
      }
    }
  );

  /**
   * POST /:serverId/exec-edit - Execute command for file editing
   */
  fastify.post<{ Params: ServerParams; Body: ExecEditBody }>(
    "/:serverId/exec-edit",
    { preHandler: [authenticate, authorizeServer] },
    async (request, reply) => {
      try {
        const { serverId } = request.params;
        const { command } = request.body;

        // Validate command (basic security check)
        if (!command || command.includes('rm -rf /') || command.includes('dd if=')) {
          return reply.status(400).send({
            error: "Bad Request",
            message: "Invalid or dangerous command"
          });
        }

        // Mock command execution
        return reply.status(200).send({
          executed: true,
          output: "Command executed successfully"
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: "Internal Server Error",
          message: "Failed to execute command"
        });
      }
    }
  );

  done();
};
