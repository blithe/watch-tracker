/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST, DELETE } from '@/app/api/follow/route';
import { GET as GET_REQUESTS, PATCH as PATCH_REQUESTS } from '@/app/api/follow-requests/route';
import { GET as GET_FOLLOWERS, DELETE as DELETE_FOLLOWERS } from '@/app/api/followers/route';
import { GET as GET_FOLLOWING } from '@/app/api/following/route';
import { getTestDb, resetTestDb, closeTestDb, TEST_USER_ID, TEST_USER2_ID, getAuthHeaders, createTestUser2 } from '@/lib/test-db';

jest.mock('../../lib/db', () => {
  return require('../../lib/test-db').getTestDb();
});

function makeReq(url: string, options?: RequestInit) {
  const headers = { 'Content-Type': 'application/json', ...getAuthHeaders(), ...(options?.headers as Record<string, string> || {}) };
  return new NextRequest(url, { ...options, headers });
}

function makeUser2Req(url: string, options?: RequestInit) {
  const { headers: user2Headers } = createTestUser2();
  const headers = { 'Content-Type': 'application/json', ...user2Headers, ...(options?.headers as Record<string, string> || {}) };
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

describe('Follow API', () => {
  beforeEach(() => {
    resetTestDb();
  });

  afterAll(() => {
    closeTestDb();
  });

  describe('POST /api/follow', () => {
    it('should create a pending follow request', async () => {
      setupProfiles();

      const response = await POST(makeReq('http://localhost/api/follow', {
        method: 'POST',
        body: JSON.stringify({ userId: TEST_USER2_ID }),
      }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ ok: true, status: 'pending' });
    });

    it('should reject self-follow', async () => {
      setupProfiles();

      const response = await POST(makeReq('http://localhost/api/follow', {
        method: 'POST',
        body: JSON.stringify({ userId: TEST_USER_ID }),
      }));
      expect(response.status).toBe(400);
    });

    it('should reject if target not discoverable', async () => {
      const db = getTestDb();
      createTestUser2();
      db.prepare(
        `INSERT INTO user_profiles (user_id, display_name, username, is_discoverable) VALUES (?, ?, ?, ?)`
      ).run(TEST_USER2_ID, 'Hidden', 'hidden', 0);

      const response = await POST(makeReq('http://localhost/api/follow', {
        method: 'POST',
        body: JSON.stringify({ userId: TEST_USER2_ID }),
      }));
      expect(response.status).toBe(404);
    });

    it('should reject if blocked', async () => {
      setupProfiles();
      const db = getTestDb();
      db.prepare('INSERT INTO blocks (blocker_id, blocked_id) VALUES (?, ?)').run(TEST_USER2_ID, TEST_USER_ID);

      const response = await POST(makeReq('http://localhost/api/follow', {
        method: 'POST',
        body: JSON.stringify({ userId: TEST_USER2_ID }),
      }));
      expect(response.status).toBe(404);
    });

    it('should reject duplicate follow', async () => {
      setupProfiles();
      const db = getTestDb();
      db.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)').run(TEST_USER_ID, TEST_USER2_ID);

      const response = await POST(makeReq('http://localhost/api/follow', {
        method: 'POST',
        body: JSON.stringify({ userId: TEST_USER2_ID }),
      }));
      expect(response.status).toBe(409);
    });
  });

  describe('DELETE /api/follow', () => {
    it('should unfollow a user', async () => {
      setupProfiles();
      const db = getTestDb();
      db.prepare('INSERT INTO follows (follower_id, following_id, status) VALUES (?, ?, ?)').run(TEST_USER_ID, TEST_USER2_ID, 'accepted');

      const response = await DELETE(makeReq('http://localhost/api/follow', {
        method: 'DELETE',
        body: JSON.stringify({ userId: TEST_USER2_ID }),
      }));
      expect(response.status).toBe(200);

      const follow = db.prepare('SELECT * FROM follows WHERE follower_id = ? AND following_id = ?').get(TEST_USER_ID, TEST_USER2_ID);
      expect(follow).toBeUndefined();
    });

    it('should return 404 if not following', async () => {
      const response = await DELETE(makeReq('http://localhost/api/follow', {
        method: 'DELETE',
        body: JSON.stringify({ userId: TEST_USER2_ID }),
      }));
      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/follow-requests', () => {
    it('should list pending requests to current user', async () => {
      setupProfiles();
      const db = getTestDb();
      db.prepare('INSERT INTO follows (follower_id, following_id, status) VALUES (?, ?, ?)').run(TEST_USER2_ID, TEST_USER_ID, 'pending');

      const response = await GET_REQUESTS(makeReq('http://localhost/api/follow-requests'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({
        follower_id: TEST_USER2_ID,
        display_name: 'User Two',
        username: 'usertwo',
      });
    });

    it('should not include accepted follows', async () => {
      setupProfiles();
      const db = getTestDb();
      db.prepare('INSERT INTO follows (follower_id, following_id, status) VALUES (?, ?, ?)').run(TEST_USER2_ID, TEST_USER_ID, 'accepted');

      const response = await GET_REQUESTS(makeReq('http://localhost/api/follow-requests'));
      const data = await response.json();

      expect(data).toHaveLength(0);
    });
  });

  describe('PATCH /api/follow-requests', () => {
    it('should accept a follow request', async () => {
      setupProfiles();
      const db = getTestDb();
      db.prepare('INSERT INTO follows (follower_id, following_id, status) VALUES (?, ?, ?)').run(TEST_USER2_ID, TEST_USER_ID, 'pending');

      const response = await PATCH_REQUESTS(makeReq('http://localhost/api/follow-requests', {
        method: 'PATCH',
        body: JSON.stringify({ userId: TEST_USER2_ID, action: 'accept' }),
      }));
      expect(response.status).toBe(200);

      const follow = db.prepare('SELECT status FROM follows WHERE follower_id = ? AND following_id = ?').get(TEST_USER2_ID, TEST_USER_ID) as any;
      expect(follow.status).toBe('accepted');
    });

    it('should reject a follow request', async () => {
      setupProfiles();
      const db = getTestDb();
      db.prepare('INSERT INTO follows (follower_id, following_id, status) VALUES (?, ?, ?)').run(TEST_USER2_ID, TEST_USER_ID, 'pending');

      const response = await PATCH_REQUESTS(makeReq('http://localhost/api/follow-requests', {
        method: 'PATCH',
        body: JSON.stringify({ userId: TEST_USER2_ID, action: 'reject' }),
      }));
      expect(response.status).toBe(200);

      const follow = db.prepare('SELECT * FROM follows WHERE follower_id = ? AND following_id = ?').get(TEST_USER2_ID, TEST_USER_ID);
      expect(follow).toBeUndefined();
    });

    it('should return 404 for non-existent request', async () => {
      const response = await PATCH_REQUESTS(makeReq('http://localhost/api/follow-requests', {
        method: 'PATCH',
        body: JSON.stringify({ userId: 999, action: 'accept' }),
      }));
      expect(response.status).toBe(404);
    });

    it('should reject invalid action', async () => {
      const response = await PATCH_REQUESTS(makeReq('http://localhost/api/follow-requests', {
        method: 'PATCH',
        body: JSON.stringify({ userId: TEST_USER2_ID, action: 'invalid' }),
      }));
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/followers', () => {
    it('should list accepted followers', async () => {
      setupProfiles();
      const db = getTestDb();
      db.prepare('INSERT INTO follows (follower_id, following_id, status) VALUES (?, ?, ?)').run(TEST_USER2_ID, TEST_USER_ID, 'accepted');

      const response = await GET_FOLLOWERS(makeReq('http://localhost/api/followers'));
      const data = await response.json();

      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({
        follower_id: TEST_USER2_ID,
        display_name: 'User Two',
      });
    });
  });

  describe('DELETE /api/followers', () => {
    it('should remove an accepted follower', async () => {
      setupProfiles();
      const db = getTestDb();
      db.prepare('INSERT INTO follows (follower_id, following_id, status) VALUES (?, ?, ?)').run(TEST_USER2_ID, TEST_USER_ID, 'accepted');

      const response = await DELETE_FOLLOWERS(makeReq('http://localhost/api/followers', {
        method: 'DELETE',
        body: JSON.stringify({ userId: TEST_USER2_ID }),
      }));
      expect(response.status).toBe(200);

      const follow = db.prepare('SELECT * FROM follows WHERE follower_id = ? AND following_id = ?').get(TEST_USER2_ID, TEST_USER_ID);
      expect(follow).toBeUndefined();
    });
  });

  describe('GET /api/following', () => {
    it('should list users the current user follows', async () => {
      setupProfiles();
      const db = getTestDb();
      db.prepare('INSERT INTO follows (follower_id, following_id, status) VALUES (?, ?, ?)').run(TEST_USER_ID, TEST_USER2_ID, 'accepted');

      const response = await GET_FOLLOWING(makeReq('http://localhost/api/following'));
      const data = await response.json();

      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({
        following_id: TEST_USER2_ID,
        display_name: 'User Two',
      });
    });

    it('should not include pending follows', async () => {
      setupProfiles();
      const db = getTestDb();
      db.prepare('INSERT INTO follows (follower_id, following_id, status) VALUES (?, ?, ?)').run(TEST_USER_ID, TEST_USER2_ID, 'pending');

      const response = await GET_FOLLOWING(makeReq('http://localhost/api/following'));
      const data = await response.json();

      expect(data).toHaveLength(0);
    });
  });
});
