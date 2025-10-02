import { randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface OAuthSession {
  sessionToken: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface CreateSessionParams {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // Seconds until expiration
}

export interface UpdateSessionParams {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Database-backed OAuth session manager for setup wizard
 *
 * Features:
 * - Persists sessions across server restarts
 * - Automatic expiration handling
 * - Session cleanup
 * - Token refresh support
 */
export class OAuthSessionManager {
  constructor() {
    // Run cleanup every 5 minutes
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 5 * 60 * 1000);
  }

  /**
   * Create a new OAuth session
   */
  async createSession(params: CreateSessionParams): Promise<OAuthSession> {
    const sessionToken = randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + params.expiresIn * 1000);

    const session = await prisma.oAuthSession.create({
      data: {
        sessionToken,
        userId: params.userId,
        accessToken: params.accessToken,
        refreshToken: params.refreshToken,
        expiresAt
      }
    });

    return {
      sessionToken: session.sessionToken,
      userId: session.userId,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt
    };
  }

  /**
   * Get a session by token
   * Returns null if session doesn't exist or is expired
   */
  async getSession(sessionToken: string): Promise<OAuthSession | null> {
    const session = await prisma.oAuthSession.findUnique({
      where: { sessionToken }
    });

    if (!session) {
      return null;
    }

    // Check if expired
    if (new Date() > session.expiresAt) {
      await prisma.oAuthSession.delete({
        where: { sessionToken }
      });
      return null;
    }

    return {
      sessionToken: session.sessionToken,
      userId: session.userId,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt
    };
  }

  /**
   * Update an existing session (e.g., after token refresh)
   */
  async updateSession(sessionToken: string, params: UpdateSessionParams): Promise<boolean> {
    try {
      await prisma.oAuthSession.update({
        where: { sessionToken },
        data: {
          accessToken: params.accessToken,
          refreshToken: params.refreshToken,
          expiresAt: new Date(Date.now() + params.expiresIn * 1000)
        }
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionToken: string): Promise<boolean> {
    try {
      await prisma.oAuthSession.delete({
        where: { sessionToken }
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clean up all expired sessions
   * Returns the number of sessions deleted
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await prisma.oAuthSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });

    return result.count;
  }

  /**
   * Get total session count (for monitoring)
   */
  async getSessionCount(): Promise<number> {
    return await prisma.oAuthSession.count();
  }

  /**
   * Clear all sessions (for testing)
   */
  async clearAllSessions(): Promise<void> {
    await prisma.oAuthSession.deleteMany({});
  }
}

// Export singleton instance
export const oauthSessionManager = new OAuthSessionManager();
