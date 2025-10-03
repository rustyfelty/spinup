import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { serverRoutes } from './src/routes/servers.js';
import { prisma } from './src/services/prisma.js';

const app = Fastify({ logger: true });

// Register JWT plugin
await app.register(jwt, { secret: 'test-secret' });
await app.register(serverRoutes, { prefix: '/api/servers' });
await app.ready();

// Create test org
const org = await prisma.org.create({
  data: {
    discordGuild: 'debug-test-guild',
    name: 'Debug Test Org',
  },
});

// Create test token
const testToken = app.jwt.sign({ sub: 'debug-user', org: org.id });

// Make request
const response = await app.inject({
  method: 'GET',
  url: '/api/servers',
  query: { orgId: org.id },
  headers: {
    authorization: `Bearer ${testToken}`,
  },
});

console.log('Status:', response.statusCode);
console.log('Body:', response.body);

// Cleanup
await prisma.org.delete({ where: { id: org.id } });
await app.close();
