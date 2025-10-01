import { prisma } from '../services/prisma';

/**
 * Test setup utility functions
 *
 * Usage:
 * import { createTestOrg, createTestServer, cleanupTestData } from './__tests__/setup';
 */

export interface TestOrg {
  id: string;
  discordGuild: string;
  name: string;
}

export interface TestServer {
  id: string;
  orgId: string;
  name: string;
  gameKey: string;
  status: string;
}

export interface TestUser {
  id: string;
  discordId: string;
  displayName: string;
}

/**
 * Create a test organization
 */
export async function createTestOrg(suffix: string = ''): Promise<TestOrg> {
  const org = await prisma.org.create({
    data: {
      discordGuild: `test-guild-${suffix || Date.now()}`,
      name: `Test Organization ${suffix}`,
    },
  });
  return org;
}

/**
 * Create a test user
 */
export async function createTestUser(suffix: string = ''): Promise<TestUser> {
  const user = await prisma.user.create({
    data: {
      discordId: `test-user-${suffix || Date.now()}`,
      displayName: `Test User ${suffix}`,
    },
  });
  return user;
}

/**
 * Create a test server
 */
export async function createTestServer(
  orgId: string,
  options: {
    name?: string;
    gameKey?: string;
    status?: 'CREATING' | 'RUNNING' | 'STOPPED' | 'ERROR' | 'DELETING';
    containerId?: string;
  } = {}
): Promise<TestServer> {
  const server = await prisma.server.create({
    data: {
      orgId,
      name: options.name || 'Test Server',
      gameKey: options.gameKey || 'minecraft-java',
      status: options.status || 'STOPPED',
      ports: [],
      containerId: options.containerId,
      createdBy: 'test-user',
    },
  });
  return server;
}

/**
 * Create a test membership
 */
export async function createTestMembership(
  userId: string,
  orgId: string,
  role: 'OWNER' | 'ADMIN' | 'OPERATOR' | 'VIEWER' = 'OPERATOR'
) {
  const membership = await prisma.membership.create({
    data: {
      userId,
      orgId,
      role,
    },
  });
  return membership;
}

/**
 * Clean up all test data by organization ID
 */
export async function cleanupTestOrg(orgId: string) {
  // Delete in correct order to avoid foreign key violations
  await prisma.job.deleteMany({
    where: { server: { orgId } },
  });
  await prisma.configVersion.deleteMany({
    where: { server: { orgId } },
  });
  await prisma.backup.deleteMany({
    where: { server: { orgId } },
  });
  await prisma.server.deleteMany({
    where: { orgId },
  });
  await prisma.membership.deleteMany({
    where: { orgId },
  });
  await prisma.audit.deleteMany({
    where: { orgId },
  });
  await prisma.org.delete({
    where: { id: orgId },
  });
}

/**
 * Clean up test user and related data
 */
export async function cleanupTestUser(userId: string) {
  await prisma.loginToken.deleteMany({
    where: { userId },
  });
  await prisma.membership.deleteMany({
    where: { userId },
  });
  await prisma.audit.deleteMany({
    where: { actorId: userId },
  });
  await prisma.user.delete({
    where: { id: userId },
  });
}

/**
 * Clean up test server
 */
export async function cleanupTestServer(serverId: string) {
  await prisma.job.deleteMany({
    where: { serverId },
  });
  await prisma.configVersion.deleteMany({
    where: { serverId },
  });
  await prisma.backup.deleteMany({
    where: { serverId },
  });
  await prisma.server.delete({
    where: { id: serverId },
  });
}

/**
 * Create a full test context (org, user, membership)
 */
export async function createTestContext(suffix: string = '') {
  const org = await createTestOrg(suffix);
  const user = await createTestUser(suffix);
  const membership = await createTestMembership(user.id, org.id, 'OWNER');

  return { org, user, membership };
}

/**
 * Clean up full test context
 */
export async function cleanupTestContext(orgId: string, userId: string) {
  await cleanupTestOrg(orgId);
  await cleanupTestUser(userId);
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  options: {
    timeout?: number;
    interval?: number;
    timeoutMessage?: string;
  } = {}
): Promise<void> {
  const { timeout = 10000, interval = 100, timeoutMessage = 'Condition not met' } = options;

  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(timeoutMessage);
}

/**
 * Get test database connection info
 */
export function getTestDatabaseUrl(): string {
  return process.env.DATABASE_URL_TEST || process.env.DATABASE_URL || '';
}

/**
 * Check if running in test environment
 */
export function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
}
