/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET as getAdminFeedback } from '@/app/api/admin/feedback/route';
import { getTestDb, resetTestDb, closeTestDb, getAuthHeaders, TEST_USER_ID } from '@/lib/test-db';

jest.mock('../../lib/db', () => {
  return require('../../lib/test-db').getTestDb();
});

function makeReq(url: string, options?: RequestInit) {
  const headers = { 'Content-Type': 'application/json', ...getAuthHeaders(), ...(options?.headers as Record<string, string> || {}) };
  return new NextRequest(url, { ...options, headers });
}

describe('Admin: access control', () => {
  beforeEach(() => resetTestDb());
  afterAll(() => closeTestDb());

  it('blocks non-admin users from the feedback API', async () => {
    // Test user is seeded as admin (is_admin=1) in test-db; temporarily make non-admin
    const db = getTestDb();
    db.prepare('UPDATE users SET is_admin = 0 WHERE id = ?').run(TEST_USER_ID);

    const res = await getAdminFeedback(makeReq('http://localhost/api/admin/feedback'));
    expect(res.status).toBe(403);
  });

  it('allows admin users to access the feedback API', async () => {
    const db = getTestDb();
    db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(TEST_USER_ID);

    const res = await getAdminFeedback(makeReq('http://localhost/api/admin/feedback'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('returns feedback entries for admin', async () => {
    const db = getTestDb();
    db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(TEST_USER_ID);
    db.prepare('INSERT INTO feedback (user_id, message) VALUES (?, ?)').run(TEST_USER_ID, 'Great app!');

    const res = await getAdminFeedback(makeReq('http://localhost/api/admin/feedback'));
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].message).toBe('Great app!');
  });
});
