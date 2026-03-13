/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET, PATCH } from '@/app/api/profile/route';
import { GET as GET_PUBLIC } from '@/app/api/profile/[username]/route';
import { getTestDb, resetTestDb, closeTestDb, TEST_USER_ID, TEST_USER2_ID, getAuthHeaders, createTestUser2 } from '@/lib/test-db';

jest.mock('../../lib/db', () => {
  return require('../../lib/test-db').getTestDb();
});

function makeReq(url: string, options?: RequestInit) {
  const headers = { 'Content-Type': 'application/json', ...getAuthHeaders(), ...(options?.headers as Record<string, string> || {}) };
  return new NextRequest(url, { ...options, headers });
}

describe('/api/profile', () => {
  beforeEach(() => {
    resetTestDb();
  });

  afterAll(() => {
    closeTestDb();
  });

  describe('GET /api/profile', () => {
    it('should auto-create profile from email prefix on first GET', async () => {
      const response = await GET(makeReq('http://localhost/api/profile'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        user_id: TEST_USER_ID,
        display_name: 'test',
        username: 'test',
        is_discoverable: 0,
      });
    });

    it('should return existing profile on subsequent GETs', async () => {
      const db = getTestDb();
      db.prepare(
        `INSERT INTO user_profiles (user_id, display_name, username, bio) VALUES (?, ?, ?, ?)`
      ).run(TEST_USER_ID, 'My Name', 'myname', 'Hello!');

      const response = await GET(makeReq('http://localhost/api/profile'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        display_name: 'My Name',
        username: 'myname',
        bio: 'Hello!',
      });
    });
  });

  describe('PATCH /api/profile', () => {
    it('should update profile fields', async () => {
      const db = getTestDb();
      db.prepare(
        `INSERT INTO user_profiles (user_id, display_name, username) VALUES (?, ?, ?)`
      ).run(TEST_USER_ID, 'Old Name', 'oldname');

      const response = await PATCH(makeReq('http://localhost/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          display_name: 'New Name',
          username: 'newname',
          bio: 'Updated bio',
          is_discoverable: true,
        }),
      }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        display_name: 'New Name',
        username: 'newname',
        bio: 'Updated bio',
        is_discoverable: 1,
      });
    });

    it('should reject invalid username format', async () => {
      const response = await PATCH(makeReq('http://localhost/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          display_name: 'Test',
          username: 'ab', // too short
        }),
      }));
      expect(response.status).toBe(400);
    });

    it('should reject taken username', async () => {
      const db = getTestDb();
      createTestUser2();
      db.prepare(
        `INSERT INTO user_profiles (user_id, display_name, username) VALUES (?, ?, ?)`
      ).run(TEST_USER_ID, 'User 1', 'user1');
      db.prepare(
        `INSERT INTO user_profiles (user_id, display_name, username) VALUES (?, ?, ?)`
      ).run(TEST_USER2_ID, 'User 2', 'taken');

      const response = await PATCH(makeReq('http://localhost/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          display_name: 'User 1',
          username: 'taken',
        }),
      }));
      expect(response.status).toBe(409);
    });

    it('should require display_name and username', async () => {
      const response = await PATCH(makeReq('http://localhost/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ display_name: 'Test' }),
      }));
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/profile/[username]', () => {
    it('should return public profile for discoverable user', async () => {
      const db = getTestDb();
      createTestUser2();
      db.prepare(
        `INSERT INTO user_profiles (user_id, display_name, username, bio, is_discoverable) VALUES (?, ?, ?, ?, ?)`
      ).run(TEST_USER2_ID, 'User Two', 'usertwo', 'Hi there', 1);

      const response = await GET_PUBLIC(
        makeReq('http://localhost/api/profile/usertwo'),
        { params: Promise.resolve({ username: 'usertwo' }) }
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        display_name: 'User Two',
        username: 'usertwo',
        bio: 'Hi there',
        is_own_profile: false,
        follow_status: null,
      });
    });

    it('should return 404 for non-discoverable user', async () => {
      const db = getTestDb();
      createTestUser2();
      db.prepare(
        `INSERT INTO user_profiles (user_id, display_name, username, is_discoverable) VALUES (?, ?, ?, ?)`
      ).run(TEST_USER2_ID, 'Hidden', 'hidden', 0);

      const response = await GET_PUBLIC(
        makeReq('http://localhost/api/profile/hidden'),
        { params: Promise.resolve({ username: 'hidden' }) }
      );
      expect(response.status).toBe(404);
    });

    it('should return 404 for blocked user', async () => {
      const db = getTestDb();
      createTestUser2();
      db.prepare(
        `INSERT INTO user_profiles (user_id, display_name, username, is_discoverable) VALUES (?, ?, ?, ?)`
      ).run(TEST_USER2_ID, 'Blocked', 'blocked', 1);
      db.prepare(
        `INSERT INTO blocks (blocker_id, blocked_id) VALUES (?, ?)`
      ).run(TEST_USER_ID, TEST_USER2_ID);

      const response = await GET_PUBLIC(
        makeReq('http://localhost/api/profile/blocked'),
        { params: Promise.resolve({ username: 'blocked' }) }
      );
      expect(response.status).toBe(404);
    });

    it('should show own profile even if not discoverable', async () => {
      const db = getTestDb();
      db.prepare(
        `INSERT INTO user_profiles (user_id, display_name, username, is_discoverable) VALUES (?, ?, ?, ?)`
      ).run(TEST_USER_ID, 'Me', 'me', 0);

      const response = await GET_PUBLIC(
        makeReq('http://localhost/api/profile/me'),
        { params: Promise.resolve({ username: 'me' }) }
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.is_own_profile).toBe(true);
    });

    it('should include follow status', async () => {
      const db = getTestDb();
      createTestUser2();
      db.prepare(
        `INSERT INTO user_profiles (user_id, display_name, username, is_discoverable) VALUES (?, ?, ?, ?)`
      ).run(TEST_USER2_ID, 'User Two', 'usertwo', 1);
      db.prepare(
        `INSERT INTO follows (follower_id, following_id, status) VALUES (?, ?, ?)`
      ).run(TEST_USER_ID, TEST_USER2_ID, 'pending');

      const response = await GET_PUBLIC(
        makeReq('http://localhost/api/profile/usertwo'),
        { params: Promise.resolve({ username: 'usertwo' }) }
      );
      const data = await response.json();

      expect(data.follow_status).toBe('pending');
    });
  });
});
