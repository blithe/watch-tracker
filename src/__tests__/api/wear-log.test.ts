/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/wear-log/route';
import { getTestDb, resetTestDb, closeTestDb, seedTestData } from '@/lib/test-db';

// Mock the main db module to use test database
jest.mock('../../lib/db', () => {
  return require('../../lib/test-db').getTestDb();
});

describe('/api/wear-log', () => {
  beforeEach(() => {
    resetTestDb();
  });

  afterAll(() => {
    closeTestDb();
  });

  describe('POST /api/wear-log', () => {
    it('should create a new wear log entry', async () => {
      const { watch1Id } = seedTestData();
      
      const requestBody = {
        watch_id: watch1Id,
        date: '2026-02-09',
        notes: 'Great watch today!'
      };

      const request = new NextRequest('http://localhost/api/wear-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      const request = new NextRequest('http://localhost/api/wear-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      const request = new NextRequest('http://localhost/api/wear-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      const request = new NextRequest('http://localhost/api/wear-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

    it('should return 400 for duplicate date', async () => {
      const { watch1Id } = seedTestData();
      
      const requestBody = {
        watch_id: watch1Id,
        date: '2026-02-08' // This date already exists from seedTestData
      };

      const request = new NextRequest('http://localhost/api/wear-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: 'Already logged a watch for this date' });
    });

    it('should return 500 for invalid watch_id (foreign key constraint)', async () => {
      const requestBody = {
        watch_id: 99999, // Non-existent watch ID
        date: '2026-02-13'
      };

      const request = new NextRequest('http://localhost/api/wear-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      
      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('FOREIGN KEY constraint failed');
    });

    it('should enforce foreign key constraint', async () => {
      // Try to create a wear log without any watches in the database
      const requestBody = {
        watch_id: 1,
        date: '2026-02-14'
      };

      const request = new NextRequest('http://localhost/api/wear-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      
      const data = await response.json();
      expect(data.error).toContain('FOREIGN KEY constraint failed');
    });

    it('should enforce unique date constraint', async () => {
      const { watch1Id, watch2Id } = seedTestData();
      
      // Try to log a different watch on the same date
      const requestBody = {
        watch_id: watch2Id,
        date: '2026-02-08' // Same date as existing entry
      };

      const request = new NextRequest('http://localhost/api/wear-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      expect(response).toMatchObject({
        status: 400
      });
    });
  });
});