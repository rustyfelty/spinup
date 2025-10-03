import Docker from "dockerode";
import { Readable } from "node:stream";
import tar from "tar-stream";
import unzipper from "unzipper";
import archiver from "archiver";

const docker = new Docker();

export interface FileInfo {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number;
  modified: string;
  permissions: string;
}

class FileManagerService {
  /**
   * Validate and sanitize file paths to prevent directory traversal
   */
  private validatePath(filePath: string): string {
    // Normalize path and remove any ".." sequences
    const normalized = filePath.replace(/\\/g, "/").replace(/\/+/g, "/");

    // Block path traversal attempts
    if (normalized.includes("..")) {
      throw new Error("Path traversal detected: cannot use '..' in paths");
    }

    // Ensure it's an absolute path
    if (!normalized.startsWith("/")) {
      return `/${normalized}`;
    }

    return normalized;
  }

  /**
   * List files in a container directory
   */
  async listFiles(containerId: string, dirPath: string): Promise<FileInfo[]> {
    const container = docker.getContainer(containerId);
    const normalizedPath = this.validatePath(dirPath);

    try {
      // Use ls -la to get detailed file information
      const exec = await container.exec({
        Cmd: ["ls", "-la", "--time-style=iso", normalizedPath],
        AttachStdout: true,
        AttachStderr: true,
      });

      const stream = await exec.start({ Detach: false });
      let output = "";
      let errorOutput = "";

      // Handle Docker stream multiplexing
      return new Promise<FileInfo[]>((resolve, reject) => {
        stream.on("data", (chunk: Buffer) => {
          // Docker multiplexes stdout/stderr in the stream
          // First byte indicates stream type: 1=stdout, 2=stderr
          const header = chunk[0];
          const data = chunk.slice(8).toString(); // Skip 8-byte header

          if (header === 1) {
            output += data;
          } else if (header === 2) {
            errorOutput += data;
          }
        });

        stream.on("end", () => {
          if (errorOutput && errorOutput.toLowerCase().includes("no such file")) {
            reject(new Error(`Directory not found: ${normalizedPath}`));
            return;
          }

          // Parse ls output
          const files: FileInfo[] = [];
          const lines = output.split("\n").filter(line => line.trim());

          for (const line of lines) {
            // Skip total line and current/parent dir
            if (line.startsWith("total") || line.endsWith(" .") || line.endsWith(" ..")) {
              continue;
            }

            // Parse ls -la output format with --time-style=iso:
            // -rw-rw-r--  1 minecraft minecraft        2 10-02 23:14 banned-ips.json
            const parts = line.split(/\s+/);
            if (parts.length < 8) continue;

            const permissions = parts[0];
            const size = parseInt(parts[4], 10);
            const date = parts[5];
            const time = parts[6];
            const name = parts.slice(7).join(" ");

            const type = permissions.startsWith("d") ? "directory" : "file";
            const filePath = normalizedPath === "/" ? `/${name}` : `${normalizedPath}/${name}`;

            files.push({
              name,
              path: filePath,
              type,
              size: isNaN(size) ? 0 : size,
              modified: `${date}T${time}`,
              permissions,
            });
          }

          resolve(files);
        });

        stream.on("error", reject);
      });
    } catch (error: any) {
      if (error.statusCode === 404) {
        throw new Error(`Container not found: ${containerId}`);
      }
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  /**
   * Read file contents from container
   */
  async readFile(containerId: string, filePath: string): Promise<string> {
    const container = docker.getContainer(containerId);
    const normalizedPath = this.validatePath(filePath);

    try {
      // Get file as tar archive
      const stream = await container.getArchive({ path: normalizedPath });

      return new Promise((resolve, reject) => {
        const extract = tar.extract();
        let fileContent = "";

        extract.on("entry", (header, entryStream, next) => {
          entryStream.on("data", (chunk) => {
            fileContent += chunk.toString();
          });
          entryStream.on("end", next);
          entryStream.resume();
        });

        extract.on("finish", () => resolve(fileContent));
        extract.on("error", reject);

        stream.pipe(extract);
      });
    } catch (error: any) {
      if (error.statusCode === 404) {
        throw new Error(`File not found: ${normalizedPath}`);
      }
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  /**
   * Write file contents to container
   */
  async writeFile(containerId: string, filePath: string, content: string): Promise<void> {
    const container = docker.getContainer(containerId);
    const normalizedPath = this.validatePath(filePath);

    // Get directory and filename
    const pathParts = normalizedPath.split("/");
    const filename = pathParts.pop()!;
    const dirPath = pathParts.join("/") || "/";

    try {
      // Create tar archive with file
      const pack = tar.pack();
      pack.entry({ name: filename }, content);
      pack.finalize();

      // Upload to container
      await container.putArchive(pack, { path: dirPath });
    } catch (error: any) {
      throw new Error(`Failed to write file: ${error.message}`);
    }
  }

  /**
   * Delete file or directory from container
   */
  async deleteFile(containerId: string, filePath: string): Promise<void> {
    const container = docker.getContainer(containerId);
    const normalizedPath = this.validatePath(filePath);

    try {
      const exec = await container.exec({
        Cmd: ["rm", "-rf", normalizedPath],
        AttachStdout: true,
        AttachStderr: true
      });

      const stream = await exec.start({ Detach: false });
      let errorOutput = "";

      await new Promise<void>((resolve, reject) => {
        stream.on("data", (chunk) => {
          errorOutput += chunk.toString();
        });
        stream.on("end", () => {
          if (errorOutput.toLowerCase().includes("error")) {
            reject(new Error(errorOutput));
          } else {
            resolve();
          }
        });
        stream.on("error", reject);
      });
    } catch (error: any) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Create directory in container
   */
  async createDirectory(containerId: string, dirPath: string): Promise<void> {
    const container = docker.getContainer(containerId);
    const normalizedPath = this.validatePath(dirPath);

    try {
      const exec = await container.exec({
        Cmd: ["mkdir", "-p", normalizedPath],
        AttachStdout: true,
        AttachStderr: true
      });

      const stream = await exec.start({ Detach: false });
      let errorOutput = "";

      await new Promise<void>((resolve, reject) => {
        stream.on("data", (chunk) => {
          errorOutput += chunk.toString();
        });
        stream.on("end", () => {
          if (errorOutput.toLowerCase().includes("error")) {
            reject(new Error(errorOutput));
          } else {
            resolve();
          }
        });
        stream.on("error", reject);
      });
    } catch (error: any) {
      throw new Error(`Failed to create directory: ${error.message}`);
    }
  }

  /**
   * Upload file to container
   */
  async uploadFile(containerId: string, filePath: string, fileBuffer: Buffer): Promise<void> {
    const container = docker.getContainer(containerId);
    const normalizedPath = this.validatePath(filePath);

    // Get directory and filename
    const pathParts = normalizedPath.split("/");
    const filename = pathParts.pop()!;
    const dirPath = pathParts.join("/") || "/";

    try {
      // Create tar archive with file
      const pack = tar.pack();
      pack.entry({ name: filename }, fileBuffer);
      pack.finalize();

      // Upload to container
      await container.putArchive(pack, { path: dirPath });
    } catch (error: any) {
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Extract zip file in container
   */
  async extractZip(containerId: string, zipPath: string, extractPath?: string): Promise<void> {
    const container = docker.getContainer(containerId);
    const normalizedZipPath = this.validatePath(zipPath);

    // Default extract path is the same directory as the zip file
    const defaultExtractPath = normalizedZipPath.substring(0, normalizedZipPath.lastIndexOf("/")) || "/";
    const normalizedExtractPath = extractPath ? this.validatePath(extractPath) : defaultExtractPath;

    try {
      // Read the zip file from container
      const stream = await container.getArchive({ path: normalizedZipPath });

      return new Promise((resolve, reject) => {
        const extract = tar.extract();
        let zipBuffer = Buffer.alloc(0);

        extract.on("entry", (header, entryStream, next) => {
          const chunks: Buffer[] = [];
          entryStream.on("data", (chunk) => {
            chunks.push(chunk);
          });
          entryStream.on("end", () => {
            zipBuffer = Buffer.concat(chunks);
            next();
          });
          entryStream.resume();
        });

        extract.on("finish", async () => {
          try {
            // Parse zip and extract files
            const directory = await unzipper.Open.buffer(zipBuffer);

            // Extract each file
            for (const file of directory.files) {
              if (file.type === "File") {
                const fileBuffer = await file.buffer();
                const targetPath = `${normalizedExtractPath}/${file.path}`;
                await this.uploadFile(containerId, targetPath, fileBuffer);
              } else if (file.type === "Directory") {
                const dirPath = `${normalizedExtractPath}/${file.path}`;
                await this.createDirectory(containerId, dirPath);
              }
            }

            resolve();
          } catch (err: any) {
            reject(new Error(`Failed to extract zip contents: ${err.message}`));
          }
        });

        extract.on("error", reject);
        stream.pipe(extract);
      });
    } catch (error: any) {
      if (error.statusCode === 404) {
        throw new Error(`Zip file not found: ${normalizedZipPath}`);
      }
      throw new Error(`Failed to extract zip: ${error.message}`);
    }
  }

  /**
   * Compress files/directories into a zip file
   */
  async compressZip(containerId: string, sourcePaths: string[], zipPath: string): Promise<void> {
    const container = docker.getContainer(containerId);
    const normalizedZipPath = this.validatePath(zipPath);

    try {
      // Create archive
      const archive = archiver("zip", { zlib: { level: 9 } });
      const chunks: Buffer[] = [];

      archive.on("data", (chunk) => chunks.push(chunk));

      // Add each source path to archive
      for (const sourcePath of sourcePaths) {
        const normalizedSourcePath = this.validatePath(sourcePath);

        try {
          // Get file info
          const files = await this.listFiles(containerId, normalizedSourcePath.substring(0, normalizedSourcePath.lastIndexOf("/")) || "/");
          const fileName = normalizedSourcePath.substring(normalizedSourcePath.lastIndexOf("/") + 1);
          const fileInfo = files.find(f => f.name === fileName);

          if (!fileInfo) {
            throw new Error(`File not found: ${normalizedSourcePath}`);
          }

          if (fileInfo.type === "file") {
            // Read and add file
            const content = await this.readFile(containerId, normalizedSourcePath);
            archive.append(content, { name: fileInfo.name });
          } else {
            // TODO: Handle directory recursion
            throw new Error("Directory compression not yet implemented");
          }
        } catch (error: any) {
          throw new Error(`Failed to add ${sourcePath} to archive: ${error.message}`);
        }
      }

      // Finalize archive
      await archive.finalize();
      const zipBuffer = Buffer.concat(chunks);

      // Upload zip to container
      await this.uploadFile(containerId, normalizedZipPath, zipBuffer);
    } catch (error: any) {
      throw new Error(`Failed to create zip: ${error.message}`);
    }
  }
}

export const fileManager = new FileManagerService();
