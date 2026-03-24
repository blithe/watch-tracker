/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/feed/route';
import { getTestDb, resetTestDb, closeTestDb, TEST_USER_ID, getAuthHeaders } from '@/lib/test-db';

jest.mock('../../lib/db', () => {
  return require('../../lib/test-db').getTestDb();
});

function makeReq(url: string) {
  const headers = { ...getAuthHeaders() };
  return new NextRequest(url, { headers });
}

function setupFeedData() {
  const db = getTestDb();

  // Create watch
  const w1 = db.prepare('INSERT INTO watches (user_id, brand, model) VALUES (?, ?, ?)').run(TEST_USER_ID, 'Rolex', 'Sub');

  // Create wear logs with images
  db.prepare('INSERT INTO wear_log (user_id, watch_id, date, image_url) VALUES (?, ?, ?, ?)').run(TEST_USER_ID, w1.lastInsertRowid, '2026-03-01', '/img/1.jpg');
  db.prepare('INSERT INTO wear_log (user_id, watch_id, date, image_url) VALUES (?, ?, ?, ?)').run(TEST_USER_ID, w1.lastInsertRowid, '2026-03-02', '/img/2.jpg');

  // Wear log without image (should not appear in feed)
  db.prepare('INSERT INTO wear_log (user_id, watch_id, date) VALUES (?, ?, ?)').run(TEST_USER_ID, w1.lastInsertRowid, '2026-03-03');

  return { w1Id: w1.lastInsertRowid };
}

describe('GET /api/feed', () => {
  beforeEach(() => {
    resetTestDb();
  });

  afterAll(() => {
    closeTestDb();
  });

  it('should return own posts with images', async () => {
    setupFeedData();

    const response = await GET(makeReq('http://localhost/api/feed'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(2);
    expect(data.items[0].brand).toBe('Rolex');
    expect(data.items[0].image_url).toBe('/img/2.jpg');
  });

  it('should support cursor pagination', async () => {
    setupFeedData();

    const res1 = await GET(makeReq('http://localhost/api/feed?limit=1'));
    const data1 = await res1.json();

    expect(data1.items).toHaveLength(1);
    expect(data1.nextCursor).toBeDefined();

    const res2 = await GET(makeReq(`http://localhost/api/feed?cursor=${data1.nextCursor}&limit=1`));
    const data2 = await res2.json();

    expect(data2.items).toHaveLength(1);
    expect(data2.items[0].id).not.toBe(data1.items[0].id);
  });

  it('should return nextCursor as null when no more items', async () => {
    setupFeedData();

    const response = await GET(makeReq('http://localhost/api/feed'));
    const data = await response.json();

    expect(data.nextCursor).toBeNull();
  });
});
