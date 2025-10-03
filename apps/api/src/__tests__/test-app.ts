import Fastify, { FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import setupV2Routes from '../routes/setup-v2';

/**
 * Build a test Fastify application with setup routes configured
 * This mimics the production setup mode from index.ts
 */
export async function build(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false // Disable logging during tests
  });

  // Register CORS
  await app.register(cors, {
    origin: ['http://localhost:5173', 'https://daboyz.live'],
    credentials: true
  });

  // Register cookie plugin with test secret
  await app.register(cookie, {
    secret: 'test-jwt-secret-32-characters-min'
  });

  // Register JWT plugin with test secret
  await app.register(jwt, {
    secret: 'test-jwt-secret-32-characters-min',
    cookie: {
      cookieName: 'spinup_sess',
      signed: true
    }
  });

  // Register setup-v2 routes under /api/setup prefix (matches production)
  await app.register(setupV2Routes, { prefix: '/api/setup' });

  // Also register under /api/setup-v2 for backward compatibility tests
  await app.register(setupV2Routes, { prefix: '/api/setup-v2' });

  await app.ready();

  return app;
}
