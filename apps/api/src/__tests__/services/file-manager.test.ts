import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Docker from 'dockerode';
import { Readable, PassThrough } from 'stream';

// Mock dockerode
vi.mock('dockerode', () => {
  return {
    default: vi.fn(() => ({
      getContainer: vi.fn()
    }))
  };
});

// Import after mocking
import { fileManager } from '../../services/file-manager';

describe('FileManager Service - Integration Tests', () => {
  let mockContainer: any;
  let mockExec: any;
  let mockStream: PassThrough;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a mock stream
    mockStream = new PassThrough();

    // Mock exec object
    mockExec = {
      start: vi.fn().mockResolvedValue(mockStream)
    };

    // Mock container object
    mockContainer = {
      exec: vi.fn().mockResolvedValue(mockExec),
      getArchive: vi.fn(),
      putArchive: vi.fn()
    };

    // Mock Docker instance
    const dockerMock = new Docker();
    (dockerMock.getContainer as any) = vi.fn().mockReturnValue(mockContainer);
  });

  afterEach(() => {
    if (mockStream) {
      mockStream.destroy();
    }
  });

  describe('Path Validation and Security', () => {
    it('should reject path traversal attempts with ../', async () => {
      await expect(
        fileManager.listFiles('container123', '/data/../../../etc/passwd')
      ).rejects.toThrow('Path traversal detected');
    });

    it('should reject path traversal attempts with multiple ..', async () => {
      await expect(
        fileManager.readFile('container123', '/data/../../sensitive')
      ).rejects.toThrow('Path traversal detected');
    });

    it('should normalize paths correctly', async () => {
      // Setup mock response for successful ls
      setTimeout(() => {
        // Docker stream header (8 bytes: type=1, size=0)
        const header = Buffer.from([1, 0, 0, 0, 0, 0, 0, 50]);
        const data = Buffer.from('total 0\n-rw-r--r-- 1 user user 0 2025-10-04 14:00 test.txt\n');
        mockStream.write(Buffer.concat([header, data]));
        mockStream.end();
      }, 10);

      const files = await fileManager.listFiles('container123', '//data///subdir/');

      expect(mockContainer.exec).toHaveBeenCalledWith({
        Cmd: ['ls', '-la', '--time-style=iso', '/data/subdir'],
        AttachStdout: true,
        AttachStderr: true,
      });
    });

    it('should handle absolute and relative paths', async () => {
      setTimeout(() => {
        const header = Buffer.from([1, 0, 0, 0, 0, 0, 0, 50]);
        const data = Buffer.from('total 0\n');
        mockStream.write(Buffer.concat([header, data]));
        mockStream.end();
      }, 10);

      await fileManager.listFiles('container123', 'relative/path');

      expect(mockContainer.exec).toHaveBeenCalledWith({
        Cmd: ['ls', '-la', '--time-style=iso', '/relative/path'],
        AttachStdout: true,
        AttachStderr: true,
      });
    });
  });

  describe('List Files', () => {
    it('should parse ls output correctly', async () => {
      const lsOutput = `total 24
drwxr-xr-x  5 minecraft minecraft 4096 2025-10-04 14:30 .
drwxr-xr-x  3 root      root      4096 2025-10-03 12:00 ..
-rw-r--r--  1 minecraft minecraft  123 2025-10-04 14:25 server.properties
drwxr-xr-x  2 minecraft minecraft 4096 2025-10-04 14:20 plugins
-rw-r--r--  1 minecraft minecraft 5432 2025-10-04 14:30 server.log
`;

      setTimeout(() => {
        const header = Buffer.from([1, 0, 0, 0, 0, 0, 0, lsOutput.length]);
        mockStream.write(Buffer.concat([header, Buffer.from(lsOutput)]));
        mockStream.end();
      }, 10);

      const files = await fileManager.listFiles('container123', '/data');

      expect(files).toHaveLength(3);
      expect(files[0]).toMatchObject({
        name: 'server.properties',
        type: 'file',
        size: 123
      });
      expect(files[1]).toMatchObject({
        name: 'plugins',
        type: 'directory'
      });
      expect(files[2]).toMatchObject({
        name: 'server.log',
        type: 'file',
        size: 5432
      });
    });

    it('should handle empty directories', async () => {
      const lsOutput = 'total 0\n';

      setTimeout(() => {
        const header = Buffer.from([1, 0, 0, 0, 0, 0, 0, lsOutput.length]);
        mockStream.write(Buffer.concat([header, Buffer.from(lsOutput)]));
        mockStream.end();
      }, 10);

      const files = await fileManager.listFiles('container123', '/empty');

      expect(files).toHaveLength(0);
    });

    it('should handle directory not found errors', async () => {
      setTimeout(() => {
        const errorMsg = 'ls: cannot access /nonexistent: No such file or directory\n';
        const header = Buffer.from([2, 0, 0, 0, 0, 0, 0, errorMsg.length]); // stderr
        mockStream.write(Buffer.concat([header, Buffer.from(errorMsg)]));
        mockStream.end();
      }, 10);

      await expect(
        fileManager.listFiles('container123', '/nonexistent')
      ).rejects.toThrow('Directory not found');
    });

    it('should handle files with spaces in names', async () => {
      const lsOutput = `total 8
-rw-r--r--  1 user user 1234 2025-10-04 14:30 file with spaces.txt
-rw-r--r--  1 user user 5678 2025-10-04 14:31 another file.log
`;

      setTimeout(() => {
        const header = Buffer.from([1, 0, 0, 0, 0, 0, 0, lsOutput.length]);
        mockStream.write(Buffer.concat([header, Buffer.from(lsOutput)]));
        mockStream.end();
      }, 10);

      const files = await fileManager.listFiles('container123', '/data');

      expect(files[0].name).toBe('file with spaces.txt');
      expect(files[1].name).toBe('another file.log');
    });
  });

  describe('Read File', () => {
    it('should read text file content', async () => {
      const fileContent = 'server-port=25565\ndifficulty=normal\ngamemode=survival';

      setTimeout(() => {
        const header = Buffer.from([1, 0, 0, 0, 0, 0, 0, fileContent.length]);
        mockStream.write(Buffer.concat([header, Buffer.from(fileContent)]));
        mockStream.end();
      }, 10);

      const content = await fileManager.readFile('container123', '/data/server.properties');

      expect(content).toBe(fileContent);
      expect(mockContainer.exec).toHaveBeenCalledWith({
        Cmd: ['cat', '/data/server.properties'],
        AttachStdout: true,
        AttachStderr: true,
      });
    });

    it('should handle file not found errors', async () => {
      setTimeout(() => {
        const errorMsg = 'cat: /data/missing.txt: No such file or directory\n';
        const header = Buffer.from([2, 0, 0, 0, 0, 0, 0, errorMsg.length]);
        mockStream.write(Buffer.concat([header, Buffer.from(errorMsg)]));
        mockStream.end();
      }, 10);

      await expect(
        fileManager.readFile('container123', '/data/missing.txt')
      ).rejects.toThrow('File not found');
    });

    it('should handle large files', async () => {
      const largeContent = 'x'.repeat(10000);

      setTimeout(() => {
        const header = Buffer.from([1, 0, 0, 0, 0, 0, 0, largeContent.length]);
        mockStream.write(Buffer.concat([header, Buffer.from(largeContent)]));
        mockStream.end();
      }, 10);

      const content = await fileManager.readFile('container123', '/data/large.log');

      expect(content.length).toBe(10000);
    });

    it('should handle UTF-8 encoded files', async () => {
      const utf8Content = 'Hello 世界 🌍 Привет';

      setTimeout(() => {
        const header = Buffer.from([1, 0, 0, 0, 0, 0, 0, Buffer.byteLength(utf8Content)]);
        mockStream.write(Buffer.concat([header, Buffer.from(utf8Content, 'utf-8')]));
        mockStream.end();
      }, 10);

      const content = await fileManager.readFile('container123', '/data/unicode.txt');

      expect(content).toBe(utf8Content);
    });
  });

  describe('Write File', () => {
    it('should write content to file', async () => {
      const newContent = 'server-port=25566\ndifficulty=hard';

      setTimeout(() => {
        mockStream.end();
      }, 10);

      await fileManager.writeFile('container123', '/data/server.properties', newContent);

      // Verify exec was called to write file
      expect(mockContainer.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          Cmd: expect.arrayContaining(['tee', '/data/server.properties'])
        })
      );
    });

    it('should reject writing to protected paths', async () => {
      await expect(
        fileManager.writeFile('container123', '/etc/passwd', 'malicious')
      ).rejects.toThrow();
    });

    it('should handle write permission errors', async () => {
      setTimeout(() => {
        const errorMsg = 'tee: /data/readonly.txt: Permission denied\n';
        const header = Buffer.from([2, 0, 0, 0, 0, 0, 0, errorMsg.length]);
        mockStream.write(Buffer.concat([header, Buffer.from(errorMsg)]));
        mockStream.end();
      }, 10);

      await expect(
        fileManager.writeFile('container123', '/data/readonly.txt', 'content')
      ).rejects.toThrow('Permission denied');
    });

    it('should handle empty content', async () => {
      setTimeout(() => {
        mockStream.end();
      }, 10);

      await fileManager.writeFile('container123', '/data/empty.txt', '');

      expect(mockContainer.exec).toHaveBeenCalled();
    });
  });

  describe('Delete File', () => {
    it('should delete files', async () => {
      setTimeout(() => {
        mockStream.end();
      }, 10);

      await fileManager.deleteFile('container123', '/data/old.log');

      expect(mockContainer.exec).toHaveBeenCalledWith({
        Cmd: ['rm', '-f', '/data/old.log'],
        AttachStdout: true,
        AttachStderr: true,
      });
    });

    it('should delete directories recursively', async () => {
      setTimeout(() => {
        mockStream.end();
      }, 10);

      await fileManager.deleteFile('container123', '/data/old_plugins');

      expect(mockContainer.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          Cmd: expect.arrayContaining(['rm'])
        })
      );
    });

    it('should prevent deletion of critical files', async () => {
      await expect(
        fileManager.deleteFile('container123', '/data/server.jar')
      ).rejects.toThrow('Cannot delete critical file');
    });

    it('should handle file not found during deletion', async () => {
      setTimeout(() => {
        const errorMsg = 'rm: cannot remove /data/nonexistent: No such file or directory\n';
        const header = Buffer.from([2, 0, 0, 0, 0, 0, 0, errorMsg.length]);
        mockStream.write(Buffer.concat([header, Buffer.from(errorMsg)]));
        mockStream.end();
      }, 10);

      // Should not throw error for non-existent files (idempotent)
      await fileManager.deleteFile('container123', '/data/nonexistent');
    });
  });

  describe('Create Directory', () => {
    it('should create directories', async () => {
      setTimeout(() => {
        mockStream.end();
      }, 10);

      await fileManager.createDirectory('container123', '/data/new_folder');

      expect(mockContainer.exec).toHaveBeenCalledWith({
        Cmd: ['mkdir', '-p', '/data/new_folder'],
        AttachStdout: true,
        AttachStderr: true,
      });
    });

    it('should create nested directories', async () => {
      setTimeout(() => {
        mockStream.end();
      }, 10);

      await fileManager.createDirectory('container123', '/data/plugins/custom/configs');

      expect(mockContainer.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          Cmd: expect.arrayContaining(['mkdir', '-p'])
        })
      );
    });

    it('should handle existing directory gracefully', async () => {
      setTimeout(() => {
        mockStream.end();
      }, 10);

      // mkdir -p should not fail if directory exists
      await fileManager.createDirectory('container123', '/data/existing');

      expect(mockContainer.exec).toHaveBeenCalled();
    });
  });

  describe('Malware and Security Scanning', () => {
    it('should detect EICAR test signature', async () => {
      const eicarSignature = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

      await expect(
        fileManager.writeFile('container123', '/data/malware.txt', eicarSignature)
      ).rejects.toThrow('Malware detected');
    });

    it('should allow safe content', async () => {
      const safeContent = 'This is perfectly safe server configuration';

      setTimeout(() => {
        mockStream.end();
      }, 10);

      await fileManager.writeFile('container123', '/data/config.txt', safeContent);

      expect(mockContainer.exec).toHaveBeenCalled();
    });

    it('should validate MIME types for uploads', async () => {
      const invalidBinaryContent = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]).toString('binary');

      await expect(
        fileManager.writeFile('container123', '/data/file.txt', invalidBinaryContent)
      ).rejects.toThrow();
    });
  });

  describe('File Size Limits', () => {
    it('should reject files exceeding size limit', async () => {
      const hugeContent = 'x'.repeat(101 * 1024 * 1024); // 101 MB

      await expect(
        fileManager.writeFile('container123', '/data/huge.txt', hugeContent)
      ).rejects.toThrow('File size exceeds limit');
    });

    it('should allow files within size limit', async () => {
      const normalContent = 'x'.repeat(1024); // 1 KB

      setTimeout(() => {
        mockStream.end();
      }, 10);

      await fileManager.writeFile('container123', '/data/normal.txt', normalContent);

      expect(mockContainer.exec).toHaveBeenCalled();
    });
  });

  describe('Archive Operations', () => {
    it('should create tar.gz archives', async () => {
      setTimeout(() => {
        mockStream.end();
      }, 10);

      await fileManager.createArchive('container123', '/data/backup', '/data/plugins');

      expect(mockContainer.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          Cmd: expect.arrayContaining(['tar'])
        })
      );
    });

    it('should extract archives', async () => {
      setTimeout(() => {
        mockStream.end();
      }, 10);

      await fileManager.extractArchive('container123', '/data/archive.tar.gz', '/data/restored');

      expect(mockContainer.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          Cmd: expect.arrayContaining(['tar', '-xzf'])
        })
      );
    });

    it('should handle zip archives', async () => {
      setTimeout(() => {
        mockStream.end();
      }, 10);

      await fileManager.extractArchive('container123', '/data/archive.zip', '/data/unzipped');

      expect(mockContainer.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          Cmd: expect.arrayContaining(['unzip'])
        })
      );
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle container not found', async () => {
      (mockContainer.exec as any).mockRejectedValue(new Error('No such container'));

      await expect(
        fileManager.listFiles('nonexistent', '/data')
      ).rejects.toThrow('No such container');
    });

    it('should handle Docker daemon connection errors', async () => {
      (mockContainer.exec as any).mockRejectedValue(new Error('Cannot connect to Docker daemon'));

      await expect(
        fileManager.readFile('container123', '/data/file.txt')
      ).rejects.toThrow('Cannot connect to Docker daemon');
    });

    it('should handle stream errors gracefully', async () => {
      setTimeout(() => {
        mockStream.destroy(new Error('Stream error'));
      }, 10);

      await expect(
        fileManager.listFiles('container123', '/data')
      ).rejects.toThrow('Stream error');
    });

    it('should handle timeout on slow operations', async () => {
      // Don't end the stream to simulate timeout
      vi.useFakeTimers();

      const promise = fileManager.readFile('container123', '/data/slow.txt');

      vi.advanceTimersByTime(30000); // 30 seconds

      await expect(promise).rejects.toThrow('timeout');

      vi.useRealTimers();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple concurrent reads', async () => {
      const promises = Array(10).fill(null).map((_, i) => {
        setTimeout(() => {
          const content = `File ${i} content`;
          const header = Buffer.from([1, 0, 0, 0, 0, 0, 0, content.length]);
          mockStream.write(Buffer.concat([header, Buffer.from(content)]));
          mockStream.end();
        }, 10);

        return fileManager.readFile('container123', `/data/file${i}.txt`);
      });

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
    });

    it('should handle concurrent write operations', async () => {
      const promises = Array(5).fill(null).map((_, i) => {
        setTimeout(() => {
          mockStream.end();
        }, 10);

        return fileManager.writeFile('container123', `/data/file${i}.txt`, `Content ${i}`);
      });

      await Promise.all(promises);

      expect(mockContainer.exec).toHaveBeenCalledTimes(5);
    });
  });
});
