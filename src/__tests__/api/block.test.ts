/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST, DELETE } from '@/app/api/block/route';
import { GET as GET_BLOCKS } from '@/app/api/blocks/route';
import { getTestDb, resetTestDb, closeTestDb, TEST_USER_ID, TEST_USER2_ID, getAuthHeaders, createTestUser2 } from '@/lib/test-db';

jest.mock('../../lib/db', () => {
  return require('../../lib/test-db').getTestDb();
});

function makeReq(url: string, options?: RequestInit) {
  const headers = { 'Content-Type': 'application/json', ...getAuthHeaders(), ...(options?.headers as Record<string, string> || {}) };
  return new NextRequest(url, { ...options, headers });
}

function setupProfiles() {
  const db = getTestDb();
  createTestUser2();
  db.prepare(
    `INSERT INTO user_profiles (user_id, display_name, username, is_discoverable) VALUES (?, ?, ?, ?)`
  ).run(TEST_USER_ID, 'User One', 'userone', 1);
  db.prepare(
    `INSERT INTO user_profiles (user_id, display_name, username, is_discoverable) VALUES (?, ?, ?, ?)`
  ).run(TEST_USER2_ID, 'User Two', 'usertwo', 1);
}

describe('Block API', () => {
  beforeEach(() => {
    resetTestDb();
  });

  afterAll(() => {
    closeTestDb();
  });

  describe('POST /api/block', () => {
    it('should block a user', async () => {
      setupProfiles();

      const response = await POST(makeReq('http://localhost/api/block', {
        method: 'POST',
        body: JSON.stringify({ userId: TEST_USER2_ID }),
      }));
      expect(response.status).toBe(200);

      const db = getTestDb();
      const block = db.prepare('SELECT * FROM blocks WHERE blocker_id = ? AND blocked_id = ?').get(TEST_USER_ID, TEST_USER2_ID);
      expect(block).toBeDefined();
    });

    it('should remove follow relationships when blocking', async () => {
      setupProfiles();
      const db = getTestDb();
      // Both directions of follow
      db.prepare('INSERT INTO follows (follower_id, following_id, status) VALUES (?, ?, ?)').run(TEST_USER_ID, TEST_USER2_ID, 'accepted');
      db.prepare('INSERT INTO follows (follower_id, following_id, status) VALUES (?, ?, ?)').run(TEST_USER2_ID, TEST_USER_ID, 'pending');

      await POST(makeReq('http://localhost/api/block', {
        method: 'POST',
        body: JSON.stringify({ userId: TEST_USER2_ID }),
      }));

      const follows = db.prepare('SELECT * FROM follows').all();
      expect(follows).toHaveLength(0);
    });

    it('should reject self-block', async () => {
      const response = await POST(makeReq('http://localhost/api/block', {
        method: 'POST',
        body: JSON.stringify({ userId: TEST_USER_ID }),
      }));
      expect(response.status).toBe(400);
    });

    it('should reject duplicate block', async () => {
      setupProfiles();
      const db = getTestDb();
      db.prepare('INSERT INTO blocks (blocker_id, blocked_id) VALUES (?, ?)').run(TEST_USER_ID, TEST_USER2_ID);

      const response = await POST(makeReq('http://localhost/api/block', {
        method: 'POST',
        body: JSON.stringify({ userId: TEST_USER2_ID }),
      }));
      expect(response.status).toBe(409);
    });
  });

  describe('DELETE /api/block', () => {
    it('should unblock a user', async () => {
      setupProfiles();
      const db = getTestDb();
      db.prepare('INSERT INTO blocks (blocker_id, blocked_id) VALUES (?, ?)').run(TEST_USER_ID, TEST_USER2_ID);

      const response = await DELETE(makeReq('http://localhost/api/block', {
        method: 'DELETE',
        body: JSON.stringify({ userId: TEST_USER2_ID }),
      }));
      expect(response.status).toBe(200);

      const block = db.prepare('SELECT * FROM blocks WHERE blocker_id = ? AND blocked_id = ?').get(TEST_USER_ID, TEST_USER2_ID);
      expect(block).toBeUndefined();
    });

    it('should return 404 if not blocked', async () => {
      const response = await DELETE(makeReq('http://localhost/api/block', {
        method: 'DELETE',
        body: JSON.stringify({ userId: TEST_USER2_ID }),
      }));
      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/blocks', () => {
    it('should list blocked users with profile info', async () => {
      setupProfiles();
      const db = getTestDb();
      db.prepare('INSERT INTO blocks (blocker_id, blocked_id) VALUES (?, ?)').run(TEST_USER_ID, TEST_USER2_ID);

      const response = await GET_BLOCKS(makeReq('http://localhost/api/blocks'));
      const data = await response.json();

      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({
        blocked_id: TEST_USER2_ID,
        display_name: 'User Two',
        username: 'usertwo',
      });
    });
  });
});
