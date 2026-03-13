/**
 * @jest-environment node
 */

import { getTestDb, resetTestDb, closeTestDb, TEST_USER_ID, TEST_USER2_ID, createTestUser2 } from '@/lib/test-db';

describe('Social schema (user_profiles, follows, blocks)', () => {
  beforeEach(() => {
    resetTestDb();
    createTestUser2();
  });

  afterAll(() => {
    closeTestDb();
  });

  describe('user_profiles', () => {
    it('should create a profile', () => {
      const db = getTestDb();
      db.prepare(
        `INSERT INTO user_profiles (user_id, display_name, username) VALUES (?, ?, ?)`
      ).run(TEST_USER_ID, 'Test User', 'testuser');

      const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(TEST_USER_ID);
      expect(profile).toMatchObject({
        user_id: TEST_USER_ID,
        display_name: 'Test User',
        username: 'testuser',
        is_discoverable: 0,
      });
    });

    it('should enforce unique username', () => {
      const db = getTestDb();
      db.prepare(
        `INSERT INTO user_profiles (user_id, display_name, username) VALUES (?, ?, ?)`
      ).run(TEST_USER_ID, 'User 1', 'sameusername');

      expect(() => {
        db.prepare(
          `INSERT INTO user_profiles (user_id, display_name, username) VALUES (?, ?, ?)`
        ).run(TEST_USER2_ID, 'User 2', 'sameusername');
      }).toThrow();
    });

    it('should enforce user_id foreign key', () => {
      const db = getTestDb();
      expect(() => {
        db.prepare(
          `INSERT INTO user_profiles (user_id, display_name, username) VALUES (?, ?, ?)`
        ).run(9999, 'Ghost', 'ghost');
      }).toThrow();
    });
  });

  describe('follows', () => {
    it('should create a follow request with pending status', () => {
      const db = getTestDb();
      db.prepare(
        `INSERT INTO follows (follower_id, following_id) VALUES (?, ?)`
      ).run(TEST_USER_ID, TEST_USER2_ID);

      const follow = db.prepare(
        'SELECT * FROM follows WHERE follower_id = ? AND following_id = ?'
      ).get(TEST_USER_ID, TEST_USER2_ID);

      expect(follow).toMatchObject({
        follower_id: TEST_USER_ID,
        following_id: TEST_USER2_ID,
        status: 'pending',
      });
    });

    it('should enforce unique follower/following pair', () => {
      const db = getTestDb();
      db.prepare(
        `INSERT INTO follows (follower_id, following_id) VALUES (?, ?)`
      ).run(TEST_USER_ID, TEST_USER2_ID);

      expect(() => {
        db.prepare(
          `INSERT INTO follows (follower_id, following_id) VALUES (?, ?)`
        ).run(TEST_USER_ID, TEST_USER2_ID);
      }).toThrow();
    });

    it('should allow follow in both directions', () => {
      const db = getTestDb();
      db.prepare(
        `INSERT INTO follows (follower_id, following_id) VALUES (?, ?)`
      ).run(TEST_USER_ID, TEST_USER2_ID);
      db.prepare(
        `INSERT INTO follows (follower_id, following_id) VALUES (?, ?)`
      ).run(TEST_USER2_ID, TEST_USER_ID);

      const all = db.prepare('SELECT * FROM follows').all();
      expect(all).toHaveLength(2);
    });
  });

  describe('blocks', () => {
    it('should create a block', () => {
      const db = getTestDb();
      db.prepare(
        `INSERT INTO blocks (blocker_id, blocked_id) VALUES (?, ?)`
      ).run(TEST_USER_ID, TEST_USER2_ID);

      const block = db.prepare(
        'SELECT * FROM blocks WHERE blocker_id = ? AND blocked_id = ?'
      ).get(TEST_USER_ID, TEST_USER2_ID);

      expect(block).toMatchObject({
        blocker_id: TEST_USER_ID,
        blocked_id: TEST_USER2_ID,
      });
    });

    it('should enforce unique blocker/blocked pair', () => {
      const db = getTestDb();
      db.prepare(
        `INSERT INTO blocks (blocker_id, blocked_id) VALUES (?, ?)`
      ).run(TEST_USER_ID, TEST_USER2_ID);

      expect(() => {
        db.prepare(
          `INSERT INTO blocks (blocker_id, blocked_id) VALUES (?, ?)`
        ).run(TEST_USER_ID, TEST_USER2_ID);
      }).toThrow();
    });
  });
});
