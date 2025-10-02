import { describe, it, expect, beforeEach } from 'vitest';
import { OAuthSessionManager } from '../../services/oauth-session-manager';

describe('OAuthSessionManager', () => {
  let sessionManager: OAuthSessionManager;

  beforeEach(() => {
    sessionManager = new OAuthSessionManager();
  });

  describe('createSession', () => {
    it('should create a session with valid data', () => {
      const session = sessionManager.createSession({
        userId: '123456789',
        accessToken: 'test_access_token',
        refreshToken: 'test_refresh_token',
        expiresIn: 3600
      });

      expect(session.sessionToken).toBeDefined();
      expect(session.sessionToken).toHaveLength(64); // 32 bytes hex = 64 chars
      expect(session.userId).toBe('123456789');
      expect(session.accessToken).toBe('test_access_token');
      expect(session.refreshToken).toBe('test_refresh_token');
      expect(session.expiresAt).toBeInstanceOf(Date);
    });

    it('should set expiration time correctly', () => {
      const beforeCreate = Date.now();
      const session = sessionManager.createSession({
        userId: '123456789',
        accessToken: 'test_access_token',
        refreshToken: 'test_refresh_token',
        expiresIn: 3600 // 1 hour
      });
      const afterCreate = Date.now();

      const expectedMinExpiry = beforeCreate + 3600 * 1000;
      const expectedMaxExpiry = afterCreate + 3600 * 1000;

      expect(session.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMinExpiry);
      expect(session.expiresAt.getTime()).toBeLessThanOrEqual(expectedMaxExpiry);
    });

    it('should generate unique session tokens', () => {
      const session1 = sessionManager.createSession({
        userId: '123456789',
        accessToken: 'token1',
        refreshToken: 'refresh1',
        expiresIn: 3600
      });

      const session2 = sessionManager.createSession({
        userId: '987654321',
        accessToken: 'token2',
        refreshToken: 'refresh2',
        expiresIn: 3600
      });

      expect(session1.sessionToken).not.toBe(session2.sessionToken);
    });
  });

  describe('getSession', () => {
    it('should retrieve an existing session', () => {
      const created = sessionManager.createSession({
        userId: '123456789',
        accessToken: 'test_access_token',
        refreshToken: 'test_refresh_token',
        expiresIn: 3600
      });

      const retrieved = sessionManager.getSession(created.sessionToken);

      expect(retrieved).toBeDefined();
      expect(retrieved?.sessionToken).toBe(created.sessionToken);
      expect(retrieved?.userId).toBe('123456789');
      expect(retrieved?.accessToken).toBe('test_access_token');
    });

    it('should return null for non-existent session', () => {
      const session = sessionManager.getSession('non_existent_token');
      expect(session).toBeNull();
    });

    it('should return null for expired session', () => {
      const created = sessionManager.createSession({
        userId: '123456789',
        accessToken: 'test_access_token',
        refreshToken: 'test_refresh_token',
        expiresIn: -1 // Already expired
      });

      const retrieved = sessionManager.getSession(created.sessionToken);
      expect(retrieved).toBeNull();
    });

    it('should automatically clean up expired session on retrieval', () => {
      const created = sessionManager.createSession({
        userId: '123456789',
        accessToken: 'test_access_token',
        refreshToken: 'test_refresh_token',
        expiresIn: -1 // Already expired
      });

      // First retrieval should return null and delete the session
      sessionManager.getSession(created.sessionToken);

      // Second retrieval should still return null
      const retrieved = sessionManager.getSession(created.sessionToken);
      expect(retrieved).toBeNull();
    });
  });

  describe('updateSession', () => {
    it('should update an existing session', () => {
      const created = sessionManager.createSession({
        userId: '123456789',
        accessToken: 'old_token',
        refreshToken: 'old_refresh',
        expiresIn: 3600
      });

      const updated = sessionManager.updateSession(created.sessionToken, {
        accessToken: 'new_token',
        refreshToken: 'new_refresh',
        expiresIn: 7200
      });

      expect(updated).toBe(true);

      const retrieved = sessionManager.getSession(created.sessionToken);
      expect(retrieved?.accessToken).toBe('new_token');
      expect(retrieved?.refreshToken).toBe('new_refresh');
    });

    it('should return false for non-existent session', () => {
      const updated = sessionManager.updateSession('non_existent', {
        accessToken: 'new_token',
        refreshToken: 'new_refresh',
        expiresIn: 3600
      });

      expect(updated).toBe(false);
    });

    it('should not update userId', () => {
      const created = sessionManager.createSession({
        userId: '123456789',
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresIn: 3600
      });

      sessionManager.updateSession(created.sessionToken, {
        accessToken: 'new_token',
        refreshToken: 'new_refresh',
        expiresIn: 3600
      });

      const retrieved = sessionManager.getSession(created.sessionToken);
      expect(retrieved?.userId).toBe('123456789'); // Unchanged
    });
  });

  describe('deleteSession', () => {
    it('should delete an existing session', () => {
      const created = sessionManager.createSession({
        userId: '123456789',
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresIn: 3600
      });

      const deleted = sessionManager.deleteSession(created.sessionToken);
      expect(deleted).toBe(true);

      const retrieved = sessionManager.getSession(created.sessionToken);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent session', () => {
      const deleted = sessionManager.deleteSession('non_existent');
      expect(deleted).toBe(false);
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should remove all expired sessions', () => {
      // Create some sessions with different expiration times
      const expired1 = sessionManager.createSession({
        userId: '1',
        accessToken: 'token1',
        refreshToken: 'refresh1',
        expiresIn: -100 // Already expired
      });

      const expired2 = sessionManager.createSession({
        userId: '2',
        accessToken: 'token2',
        refreshToken: 'refresh2',
        expiresIn: -50 // Already expired
      });

      const valid = sessionManager.createSession({
        userId: '3',
        accessToken: 'token3',
        refreshToken: 'refresh3',
        expiresIn: 3600 // Still valid
      });

      const deletedCount = sessionManager.cleanupExpiredSessions();

      expect(deletedCount).toBe(2); // Should delete 2 expired sessions

      // Valid session should still exist
      expect(sessionManager.getSession(valid.sessionToken)).toBeDefined();

      // Expired sessions should be gone
      expect(sessionManager.getSession(expired1.sessionToken)).toBeNull();
      expect(sessionManager.getSession(expired2.sessionToken)).toBeNull();
    });

    it('should return 0 when no sessions are expired', () => {
      sessionManager.createSession({
        userId: '1',
        accessToken: 'token1',
        refreshToken: 'refresh1',
        expiresIn: 3600
      });

      sessionManager.createSession({
        userId: '2',
        accessToken: 'token2',
        refreshToken: 'refresh2',
        expiresIn: 7200
      });

      const deletedCount = sessionManager.cleanupExpiredSessions();
      expect(deletedCount).toBe(0);
    });
  });

  describe('getSessionCount', () => {
    it('should return 0 for empty session manager', () => {
      expect(sessionManager.getSessionCount()).toBe(0);
    });

    it('should return correct count after creating sessions', () => {
      sessionManager.createSession({
        userId: '1',
        accessToken: 'token1',
        refreshToken: 'refresh1',
        expiresIn: 3600
      });

      sessionManager.createSession({
        userId: '2',
        accessToken: 'token2',
        refreshToken: 'refresh2',
        expiresIn: 3600
      });

      expect(sessionManager.getSessionCount()).toBe(2);
    });

    it('should return correct count after deleting sessions', () => {
      const session1 = sessionManager.createSession({
        userId: '1',
        accessToken: 'token1',
        refreshToken: 'refresh1',
        expiresIn: 3600
      });

      sessionManager.createSession({
        userId: '2',
        accessToken: 'token2',
        refreshToken: 'refresh2',
        expiresIn: 3600
      });

      sessionManager.deleteSession(session1.sessionToken);

      expect(sessionManager.getSessionCount()).toBe(1);
    });
  });
});
