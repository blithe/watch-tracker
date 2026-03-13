/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { DELETE } from '@/app/api/collection/route';
import { getTestDb, resetTestDb, closeTestDb, TEST_USER_ID, seedTestData, getAuthHeaders } from '@/lib/test-db';

jest.mock('../../lib/db', () => {
  return require('../../lib/test-db').getTestDb();
});

function makeReq(url: string, options?: RequestInit) {
  const headers = { 'Content-Type': 'application/json', ...getAuthHeaders(), ...(options?.headers as Record<string, string> || {}) };
  return new NextRequest(url, { ...options, headers });
}

describe('DELETE /api/collection', () => {
  beforeEach(() => {
    resetTestDb();
  });

  afterAll(() => {
    closeTestDb();
  });

  it('should delete all watches and wear logs when confirmed', async () => {
    seedTestData();
    const db = getTestDb();

    // Verify data exists
    const watchesBefore = db.prepare('SELECT * FROM watches WHERE user_id = ?').all(TEST_USER_ID);
    const logsBefore = db.prepare('SELECT * FROM wear_log WHERE user_id = ?').all(TEST_USER_ID);
    expect(watchesBefore.length).toBeGreaterThan(0);
    expect(logsBefore.length).toBeGreaterThan(0);

    const response = await DELETE(makeReq('http://localhost/api/collection', {
      method: 'DELETE',
      body: JSON.stringify({ confirm: 'DELETE_ALL' }),
    }));
    expect(response.status).toBe(200);

    // Verify everything is gone
    const watchesAfter = db.prepare('SELECT * FROM watches WHERE user_id = ?').all(TEST_USER_ID);
    const logsAfter = db.prepare('SELECT * FROM wear_log WHERE user_id = ?').all(TEST_USER_ID);
    expect(watchesAfter).toHaveLength(0);
    expect(logsAfter).toHaveLength(0);
  });

  it('should reject without confirmation string', async () => {
    seedTestData();

    const response = await DELETE(makeReq('http://localhost/api/collection', {
      method: 'DELETE',
      body: JSON.stringify({ confirm: 'wrong' }),
    }));
    expect(response.status).toBe(400);

    // Data should still exist
    const db = getTestDb();
    const watches = db.prepare('SELECT * FROM watches WHERE user_id = ?').all(TEST_USER_ID);
    expect(watches.length).toBeGreaterThan(0);
  });

  it('should not affect other users data', async () => {
    seedTestData();
    const db = getTestDb();

    // Add a watch for a different user
    db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(99, 'other@test.com', 'hash');
    db.prepare('INSERT INTO watches (user_id, brand, model) VALUES (?, ?, ?)').run(99, 'Casio', 'F-91W');

    await DELETE(makeReq('http://localhost/api/collection', {
      method: 'DELETE',
      body: JSON.stringify({ confirm: 'DELETE_ALL' }),
    }));

    // Other user's watch should still exist
    const otherWatches = db.prepare('SELECT * FROM watches WHERE user_id = ?').all(99);
    expect(otherWatches).toHaveLength(1);
  });
});
