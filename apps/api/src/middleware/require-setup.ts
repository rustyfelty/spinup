import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../services/prisma';

/**
 * Global middleware that enforces setup completion before allowing access to the API.
 * Similar to how WordPress won't run without setup being complete.
 *
 * Returns 412 Precondition Failed if setup is incomplete and route is not whitelisted.
 */
export async function requireSetupComplete(request: FastifyRequest, reply: FastifyReply) {
  // Whitelist of routes that don't require setup to be complete
  const whitelistedPrefixes = [
    '/api/setup/',          // All setup routes
    '/api/system/health',   // Health check
  ];

  // Check if current route is whitelisted
  const isWhitelisted = whitelistedPrefixes.some(prefix =>
    request.url.startsWith(prefix)
  );

  // If route is whitelisted, allow it to proceed
  if (isWhitelisted) {
    return;
  }

  try {
    // Check if setup is complete
    const setupState = await prisma.setupState.findUnique({
      where: { id: 'singleton' }
    });

    const isComplete = setupState?.systemConfigured &&
      setupState?.oauthConfigured &&
      setupState?.guildSelected &&
      setupState?.rolesConfigured;

    if (!isComplete) {
      return reply.status(412).send({
        error: 'Precondition Failed',
        message: 'Setup must be completed before accessing this resource. Please complete the setup wizard.',
        requiresSetup: true
      });
    }

    // Setup is complete, allow request to proceed
  } catch (error: any) {
    // If there's an error checking setup status, log it but allow the request
    // This prevents the app from breaking if there's a transient database issue
    console.error('Error checking setup status in middleware:', error);
  }
}
