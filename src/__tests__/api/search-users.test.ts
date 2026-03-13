/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/search/users/route';
import { getTestDb, resetTestDb, closeTestDb, TEST_USER_ID, TEST_USER2_ID, getAuthHeaders, createTestUser2 } from '@/lib/test-db';

jest.mock('../../lib/db', () => {
  return require('../../lib/test-db').getTestDb();
});

function makeReq(url: string) {
  const headers = { ...getAuthHeaders() };
  return new NextRequest(url, { headers });
}

describe('GET /api/search/users', () => {
  beforeEach(() => {
    resetTestDb();
    createTestUser2();
  });

  afterAll(() => {
    closeTestDb();
  });

  it('should find discoverable users by username', async () => {
    const db = getTestDb();
    db.prepare(
      `INSERT INTO user_profiles (user_id, display_name, username, is_discoverable) VALUES (?, ?, ?, ?)`
    ).run(TEST_USER2_ID, 'User Two', 'usertwo', 1);

    const response = await GET(makeReq('http://localhost/api/search/users?q=usert'));
    const data = await response.json();

    expect(data).toHaveLength(1);
    expect(data[0].username).toBe('usertwo');
  });

  it('should find by display name', async () => {
    const db = getTestDb();
    db.prepare(
      `INSERT INTO user_profiles (user_id, display_name, username, is_discoverable) VALUES (?, ?, ?, ?)`
    ).run(TEST_USER2_ID, 'Alice Watch', 'alice', 1);

    const response = await GET(makeReq('http://localhost/api/search/users?q=Alice'));
    const data = await response.json();

    expect(data).toHaveLength(1);
    expect(data[0].display_name).toBe('Alice Watch');
  });

  it('should exclude non-discoverable users', async () => {
    const db = getTestDb();
    db.prepare(
      `INSERT INTO user_profiles (user_id, display_name, username, is_discoverable) VALUES (?, ?, ?, ?)`
    ).run(TEST_USER2_ID, 'Hidden', 'hidden', 0);

    const response = await GET(makeReq('http://localhost/api/search/users?q=hidden'));
    const data = await response.json();

    expect(data).toHaveLength(0);
  });

  it('should exclude blocked users', async () => {
    const db = getTestDb();
    db.prepare(
      `INSERT INTO user_profiles (user_id, display_name, username, is_discoverable) VALUES (?, ?, ?, ?)`
    ).run(TEST_USER2_ID, 'Blocked', 'blockeduser', 1);
    db.prepare('INSERT INTO blocks (blocker_id, blocked_id) VALUES (?, ?)').run(TEST_USER_ID, TEST_USER2_ID);

    const response = await GET(makeReq('http://localhost/api/search/users?q=blocked'));
    const data = await response.json();

    expect(data).toHaveLength(0);
  });

  it('should exclude self from results', async () => {
    const db = getTestDb();
    db.prepare(
      `INSERT INTO user_profiles (user_id, display_name, username, is_discoverable) VALUES (?, ?, ?, ?)`
    ).run(TEST_USER_ID, 'Me', 'myself', 1);

    const response = await GET(makeReq('http://localhost/api/search/users?q=myself'));
    const data = await response.json();

    expect(data).toHaveLength(0);
  });

  it('should return empty for short queries', async () => {
    const response = await GET(makeReq('http://localhost/api/search/users?q=a'));
    const data = await response.json();
    expect(data).toHaveLength(0);
  });
});
