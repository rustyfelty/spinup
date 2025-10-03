import Fastify, { FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import setupRoutes from '../routes/setup';

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

  // Register setup routes under /api/setup prefix (matches production)
  await app.register(setupRoutes, { prefix: '/api/setup' });

  await app.ready();

  return app;
}
