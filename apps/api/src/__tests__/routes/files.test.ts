import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import { filesRoutes } from '../../routes/files';
import { prisma } from '../../services/prisma';
import { promises as fs } from 'fs';
import path from 'path';

describe('File Management Routes - TDD Implementation', () => {
  let app: FastifyInstance;
  let testToken: string;
  const testUserId = 'test-user-files';
  const testOrgId = 'test-org-files';
  const testServerId = 'test-server-files';
  const testDir = '/tmp/test-files';

  beforeAll(async () => {
    app = Fastify({ logger: false });

    // Register plugins
    await app.register(jwt, { secret: 'test-secret' });
    await app.register(cookie);
    await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

    // Register routes
    await app.register(filesRoutes, { prefix: '/api/files' });

    await app.ready();

    // Create test token
    testToken = app.jwt.sign({ sub: testUserId, org: testOrgId });

    // CRITICAL: Create org FIRST before any dependent entities
    try {
      await prisma.org.upsert({
        where: { id: testOrgId },
        create: { id: testOrgId, discordGuild: 'test-files-guild', name: 'Test Files Org' },
        update: {},
      });

      // Now create server with valid orgId reference
      await prisma.server.upsert({
        where: { id: testServerId },
        create: {
          id: testServerId,
          orgId: testOrgId,
          name: 'Test File Server',
          gameKey: 'minecraft',
          status: 'RUNNING',
          createdBy: testUserId,
          memoryCap: 2048,
          cpuShares: 1024,
        },
        update: {},
      });

      // Create test directory
      await fs.mkdir(testDir, { recursive: true });
    } catch (error) {
      console.error('Failed to set up test data:', error);
      throw error;
    }
  });

  afterAll(async () => {
    // Cleanup in reverse order - delete dependent entities first
    try {
      await prisma.server.deleteMany({ where: { id: testServerId } });
      await prisma.org.deleteMany({ where: { id: testOrgId } });
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to clean up test data:', error);
    }
    await app.close();
  });

  describe('GET /api/files/:serverId/list', () => {
    it('should require authentication', async () => {
      // RED: Authentication not enforced
      const response = await app.inject({
        method: 'GET',
        url: `/api/files/${testServerId}/list`,
        query: { path: '/' },
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body)).toHaveProperty('error', 'Unauthorized');
    });

    it('should list files in server directory', async () => {
      // RED: File listing not implemented
      const response = await app.inject({
        method: 'GET',
        url: `/api/files/${testServerId}/list`,
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        query: { path: '/' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('files');
      expect(Array.isArray(body.files)).toBe(true);
      body.files.forEach((file: any) => {
        expect(file).toHaveProperty('name');
        expect(file).toHaveProperty('type');
        expect(file).toHaveProperty('size');
        expect(file).toHaveProperty('modified');
      });
    });

    it('should prevent path traversal attacks', async () => {
      // RED: Path traversal not prevented
      const response = await app.inject({
        method: 'GET',
        url: `/api/files/${testServerId}/list`,
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        query: { path: '../../etc/passwd' },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toHaveProperty('error', 'Bad Request');
      expect(JSON.parse(response.body).message).toContain('Invalid path');
    });

    it('should handle non-existent directories', async () => {
      // RED: Error handling not implemented
      const response = await app.inject({
        method: 'GET',
        url: `/api/files/${testServerId}/list`,
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        query: { path: '/non-existent-dir' },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toHaveProperty('error', 'Not Found');
    });
  });

  describe('POST /api/files/:serverId/upload', () => {
    it('should upload files to server directory', async () => {
      // RED: File upload not implemented
      const fileContent = 'Hello World';
      const fileName = 'test.txt';

      const form = new FormData();
      form.append('file', new Blob([fileContent]), fileName);
      form.append('path', '/');

      const response = await app.inject({
        method: 'POST',
        url: `/api/files/${testServerId}/upload`,
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        payload: form,
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result).toHaveProperty('uploaded', true);
      expect(result).toHaveProperty('fileName', fileName);
      expect(result).toHaveProperty('size', fileContent.length);
    });

    it('should enforce file size limits', async () => {
      // RED: Size limit not enforced
      const largeFile = Buffer.alloc(15 * 1024 * 1024); // 15MB (over 10MB limit)

      const form = new FormData();
      form.append('file', new Blob([largeFile]), 'large.bin');
      form.append('path', '/');

      const response = await app.inject({
        method: 'POST',
        url: `/api/files/${testServerId}/upload`,
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        payload: form,
      });

      expect(response.statusCode).toBe(413);
      expect(JSON.parse(response.body)).toHaveProperty('error', 'Payload Too Large');
    });

    it('should validate MIME types', async () => {
      // RED: MIME type validation not implemented
      const executableContent = '#!/bin/bash\nrm -rf /';

      const form = new FormData();
      form.append('file', new Blob([executableContent]), 'malicious.sh');
      form.append('path', '/');

      const response = await app.inject({
        method: 'POST',
        url: `/api/files/${testServerId}/upload`,
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        payload: form,
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).message).toContain('file type not allowed');
    });

    it('should handle concurrent uploads', async () => {
      // RED: Concurrency not handled
      const uploads = Array(5).fill(null).map((_, i) => {
        const form = new FormData();
        form.append('file', new Blob([`Content ${i}`]), `file${i}.txt`);
        form.append('path', '/');

        return app.inject({
          method: 'POST',
          url: `/api/files/${testServerId}/upload`,
          headers: {
            authorization: `Bearer ${testToken}`,
          },
          payload: form,
        });
      });

      const responses = await Promise.all(uploads);
      responses.forEach(response => {
        expect(response.statusCode).toBe(200);
      });
    });
  });

  describe('GET /api/files/:serverId/download', () => {
    it('should download files from server', async () => {
      // RED: File download not implemented
      const response = await app.inject({
        method: 'GET',
        url: `/api/files/${testServerId}/download`,
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        query: { path: '/test.txt' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('application/octet-stream');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.body).toBe('Hello World');
    });

    it('should prevent downloading sensitive files', async () => {
      // RED: Security check not implemented
      const response = await app.inject({
        method: 'GET',
        url: `/api/files/${testServerId}/download`,
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        query: { path: '/server.properties' }, // Sensitive config file
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.body)).toHaveProperty('error', 'Forbidden');
    });
  });

  describe('PUT /api/files/:serverId/edit', () => {
    it('should edit text files in place', async () => {
      // RED: File editing not implemented
      const response = await app.inject({
        method: 'PUT',
        url: `/api/files/${testServerId}/edit`,
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        payload: {
          path: '/config.yml',
          content: 'server:\n  port: 25565\n  max-players: 100',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toHaveProperty('updated', true);
    });

    it('should validate file content before saving', async () => {
      // RED: Content validation not implemented
      const response = await app.inject({
        method: 'PUT',
        url: `/api/files/${testServerId}/edit`,
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        payload: {
          path: '/server.properties',
          content: 'invalid=yaml{content', // Invalid format
        },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).message).toContain('Invalid file format');
    });

    it('should create backup before editing', async () => {
      // RED: Backup functionality not implemented
      const response = await app.inject({
        method: 'PUT',
        url: `/api/files/${testServerId}/edit`,
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        payload: {
          path: '/important.conf',
          content: 'new content',
          createBackup: true,
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result).toHaveProperty('backupPath');
      expect(result.backupPath).toContain('.backup');
    });
  });

  describe('DELETE /api/files/:serverId/delete', () => {
    it('should delete files with confirmation', async () => {
      // RED: File deletion not implemented
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/files/${testServerId}/delete`,
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        payload: {
          path: '/unwanted.txt',
          confirm: true,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toHaveProperty('deleted', true);
    });

    it('should prevent deletion of critical files', async () => {
      // RED: Protection not implemented
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/files/${testServerId}/delete`,
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        payload: {
          path: '/server.jar', // Critical server file
          confirm: true,
        },
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.body).message).toContain('Cannot delete critical file');
    });

    it('should support batch deletion', async () => {
      // RED: Batch operations not implemented
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/files/${testServerId}/delete-batch`,
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        payload: {
          paths: ['/temp1.txt', '/temp2.txt', '/temp3.txt'],
          confirm: true,
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result).toHaveProperty('deleted');
      expect(result.deleted).toBe(3);
    });
  });

  describe('POST /api/files/:serverId/archive', () => {
    it('should create archives of server files', async () => {
      // RED: Archive creation not implemented
      const response = await app.inject({
        method: 'POST',
        url: `/api/files/${testServerId}/archive`,
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        payload: {
          paths: ['/world', '/plugins'],
          archiveName: 'backup.zip',
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result).toHaveProperty('archivePath');
      expect(result).toHaveProperty('size');
      expect(result).toHaveProperty('downloadUrl');
    });

    it('should handle large file archiving with progress', async () => {
      // RED: Progress tracking not implemented
      const response = await app.inject({
        method: 'POST',
        url: `/api/files/${testServerId}/archive`,
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        payload: {
          paths: ['/large-world'],
          archiveName: 'large-backup.tar.gz',
          compress: true,
        },
      });

      expect(response.statusCode).toBe(202); // Accepted for async processing
      const result = JSON.parse(response.body);
      expect(result).toHaveProperty('jobId');
      expect(result).toHaveProperty('statusUrl');
    });
  });

  describe('POST /api/files/:serverId/extract', () => {
    it('should safely extract archives', async () => {
      // RED: Archive extraction not implemented
      const response = await app.inject({
        method: 'POST',
        url: `/api/files/${testServerId}/extract`,
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        payload: {
          archivePath: '/uploads/plugin-pack.zip',
          destinationPath: '/plugins',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toHaveProperty('extracted', true);
      expect(JSON.parse(response.body)).toHaveProperty('fileCount');
    });

    it('should prevent zip bomb attacks', async () => {
      // RED: Zip bomb protection not implemented
      const response = await app.inject({
        method: 'POST',
        url: `/api/files/${testServerId}/extract`,
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        payload: {
          archivePath: '/uploads/malicious.zip', // Zip bomb
          destinationPath: '/temp',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).message).toContain('exceeds maximum');
    });
  });

  describe('Docker Volume Integration', () => {
    it('should map file operations to Docker volumes', async () => {
      // RED: Docker volume mapping not implemented
      const response = await app.inject({
        method: 'GET',
        url: `/api/files/${testServerId}/volume-info`,
        headers: {
          authorization: `Bearer ${testToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const info = JSON.parse(response.body);
      expect(info).toHaveProperty('volumeName');
      expect(info).toHaveProperty('mountPath');
      expect(info).toHaveProperty('sizeUsed');
      expect(info).toHaveProperty('sizeLimit');
    });

    it('should handle Docker exec for file operations', async () => {
      // RED: Docker exec integration not working (known bug)
      const response = await app.inject({
        method: 'POST',
        url: `/api/files/${testServerId}/exec-edit`,
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        payload: {
          command: 'sed -i "s/old/new/g" config.yml',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toHaveProperty('executed', true);
    });
  });

  describe('File Permissions & Security', () => {
    it('should enforce file permissions based on user role', async () => {
      // RED: Permission system not implemented
      const readOnlyToken = app.jwt.sign({ sub: 'readonly-user', org: testOrgId, role: 'viewer' });

      const response = await app.inject({
        method: 'PUT',
        url: `/api/files/${testServerId}/edit`,
        headers: {
          authorization: `Bearer ${readOnlyToken}`,
        },
        payload: {
          path: '/config.yml',
          content: 'modified content',
        },
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.body)).toHaveProperty('error', 'Forbidden');
    });

    it('should scan uploaded files for malware signatures', async () => {
      // RED: Security scanning not implemented
      const maliciousContent = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

      const form = new FormData();
      form.append('file', new Blob([maliciousContent]), 'virus.txt');
      form.append('path', '/');

      const response = await app.inject({
        method: 'POST',
        url: `/api/files/${testServerId}/upload`,
        headers: {
          authorization: `Bearer ${testToken}`,
        },
        payload: form,
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).message).toContain('security threat detected');
    });
  });
});