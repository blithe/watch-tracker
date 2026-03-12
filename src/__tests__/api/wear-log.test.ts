/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/wear-log/route';
import { getTestDb, resetTestDb, closeTestDb, seedTestData, getAuthHeaders } from '@/lib/test-db';

// Mock the main db module to use test database
jest.mock('../../lib/db', () => {
  return require('../../lib/test-db').getTestDb();
});

function makeReq(url: string, options?: RequestInit) {
  const headers = { 'Content-Type': 'application/json', ...getAuthHeaders(), ...(options?.headers as Record<string, string> || {}) };
  return new NextRequest(url, { ...options, headers });
}

describe('/api/wear-log', () => {
  beforeEach(() => {
    resetTestDb();
  });

  afterAll(() => {
    closeTestDb();
  });

  describe('GET /api/wear-log', () => {
    it('should return logs for a specific date', async () => {
      const { watch1Id } = seedTestData();

      const req = makeReq('http://localhost/api/wear-log?date=2026-02-08');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({
        date: '2026-02-08',
        watch_id: watch1Id,
      });
      expect(data[0]).toHaveProperty('brand');
      expect(data[0]).toHaveProperty('model');
    });

    it('should return empty array for a date with no log', async () => {
      seedTestData();

      const req = makeReq('http://localhost/api/wear-log?date=2000-01-01');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });

    it('should return logs for a given month', async () => {
      seedTestData();

      const req = makeReq('http://localhost/api/wear-log?month=2026-02');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty('date');
      expect(data[0]).toHaveProperty('brand');
    });

    it('should return empty array for month with no logs', async () => {
      seedTestData();

      const req = makeReq('http://localhost/api/wear-log?month=2000-01');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });

    it('should return all logs when no params provided', async () => {
      seedTestData();

      const req = makeReq('http://localhost/api/wear-log');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/wear-log', () => {
    it('should create a new wear log entry', async () => {
      const { watch1Id } = seedTestData();

      const requestBody = {
        watch_id: watch1Id,
        date: '2026-02-09',
        notes: 'Great watch today!'
      };

      const request = makeReq('http://localhost/api/wear-log', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ ok: true });

      // Verify it was actually inserted
      const db = getTestDb();
      const inserted = db.prepare('SELECT * FROM wear_log WHERE date = ?').get('2026-02-09');
      expect(inserted).toMatchObject({
        watch_id: watch1Id,
        date: '2026-02-09',
        notes: 'Great watch today!',
        image_url: null
      });
    });

    it('should create a wear log with image_url', async () => {
      const { watch1Id } = seedTestData();

      const requestBody = {
        watch_id: watch1Id,
        date: '2026-02-10',
        image_url: '/uploads/test.jpg',
        notes: 'With photo!'
      };

      const request = makeReq('http://localhost/api/wear-log', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ ok: true });

      // Verify in database
      const db = getTestDb();
      const inserted = db.prepare('SELECT * FROM wear_log WHERE date = ?').get('2026-02-10');
      expect(inserted?.image_url).toBe('/uploads/test.jpg');
    });

    it('should handle missing optional fields', async () => {
      const { watch1Id } = seedTestData();

      const requestBody = {
        watch_id: watch1Id,
        date: '2026-02-11'
      };

      const request = makeReq('http://localhost/api/wear-log', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ ok: true });

      // Verify nulls are stored correctly
      const db = getTestDb();
      const inserted = db.prepare('SELECT * FROM wear_log WHERE date = ?').get('2026-02-11');
      expect(inserted?.image_url).toBeNull();
      expect(inserted?.notes).toBeNull();
    });

    it('should handle empty strings as null', async () => {
      const { watch1Id } = seedTestData();

      const requestBody = {
        watch_id: watch1Id,
        date: '2026-02-12',
        image_url: '',
        notes: ''
      };

      const request = makeReq('http://localhost/api/wear-log', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);

      // Verify empty strings become null
      const db = getTestDb();
      const inserted = db.prepare('SELECT * FROM wear_log WHERE date = ?').get('2026-02-12');
      expect(inserted?.image_url).toBeNull();
      expect(inserted?.notes).toBeNull();
    });

    it('should allow multiple watches on the same date', async () => {
      const { watch1Id, watch2Id } = seedTestData();

      const requestBody = {
        watch_id: watch2Id,
        date: '2026-02-08' // This date already exists from seedTestData
      };

      const request = makeReq('http://localhost/api/wear-log', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Verify both entries exist
      const db = getTestDb();
      const logs = db.prepare('SELECT * FROM wear_log WHERE date = ?').all('2026-02-08');
      expect(logs).toHaveLength(2);
    });

    it('should return 404 for a watch_id that does not belong to the user', async () => {
      const requestBody = { watch_id: 99999, date: '2026-02-13' };
      const request = makeReq('http://localhost/api/wear-log', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      const response = await POST(request);
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Watch not found');
    });

    it('should return 400 for missing required fields', async () => {
      const request = makeReq('http://localhost/api/wear-log', {
        method: 'POST',
        body: JSON.stringify({ date: '2026-02-14' }) // missing watch_id
      });
      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should allow logging the same watch on the same date twice', async () => {
      const { watch1Id } = seedTestData();

      const request = makeReq('http://localhost/api/wear-log', {
        method: 'POST',
        body: JSON.stringify({ watch_id: watch1Id, date: '2026-02-08' })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const db = getTestDb();
      const logs = db.prepare('SELECT * FROM wear_log WHERE date = ?').all('2026-02-08');
      expect(logs).toHaveLength(2);
    });
  });
});
