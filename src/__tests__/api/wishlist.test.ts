/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET, POST, PATCH, DELETE } from '@/app/api/wishlist/route';
import { getTestDb, resetTestDb, closeTestDb, TEST_USER_ID, getAuthHeaders } from '@/lib/test-db';

// Mock the main db module to use test database
jest.mock('../../lib/db', () => {
  return require('../../lib/test-db').getTestDb();
});

function makeReq(url: string, options?: RequestInit) {
  const headers = { 'Content-Type': 'application/json', ...getAuthHeaders(), ...(options?.headers as Record<string, string> || {}) };
  return new NextRequest(url, { ...options, headers });
}

describe('/api/wishlist', () => {
  beforeEach(() => {
    resetTestDb();
  });

  afterAll(() => {
    closeTestDb();
  });

  describe('GET /api/wishlist', () => {
    it('should return empty array when no wishlist items exist', async () => {
      const response = await GET(makeReq('http://localhost/api/wishlist'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(0);
    });

    it('should return wishlist items with latest prices', async () => {
      const db = getTestDb();

      // Insert test wishlist item
      const result = db.prepare(`
        INSERT INTO wishlist (user_id, brand, model, reference, target_price, notes, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(TEST_USER_ID, 'Rolex', 'Submariner', '116610LN', 8500, 'Dream watch', 'watching');

      const wishlistId = result.lastInsertRowid;

      // Insert price history
      db.prepare(`
        INSERT INTO price_history (wishlist_id, price, source, recorded_at)
        VALUES (?, ?, ?, ?)
      `).run(wishlistId, 9000, 'Chrono24', '2026-02-08 10:00:00');

      db.prepare(`
        INSERT INTO price_history (wishlist_id, price, source, recorded_at)
        VALUES (?, ?, ?, ?)
      `).run(wishlistId, 8200, 'eBay', '2026-02-08 12:00:00');

      const response = await GET(makeReq('http://localhost/api/wishlist'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({
        brand: 'Rolex',
        model: 'Submariner',
        reference: '116610LN',
        target_price: 8500,
        latest_price: 8200, // Should be the most recent price
        latest_price_source: 'eBay'
      });
    });

    it('should return items ordered by created_at DESC', async () => {
      const db = getTestDb();

      db.prepare(`
        INSERT INTO wishlist (user_id, brand, model, created_at)
        VALUES (?, ?, ?, ?)
      `).run(TEST_USER_ID, 'Omega', 'Speedmaster', '2026-02-08 10:00:00');

      db.prepare(`
        INSERT INTO wishlist (user_id, brand, model, created_at)
        VALUES (?, ?, ?, ?)
      `).run(TEST_USER_ID, 'Rolex', 'Submariner', '2026-02-08 12:00:00');

      const response = await GET(makeReq('http://localhost/api/wishlist'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(data[0].brand).toBe('Rolex'); // Most recent first
      expect(data[1].brand).toBe('Omega');
    });
  });

  describe('POST /api/wishlist', () => {
    it('should create a new wishlist item with all fields', async () => {
      const requestBody = {
        brand: 'Grand Seiko',
        model: 'SBGW289',
        reference: 'SBGW289',
        image_url: 'https://example.com/watch.jpg',
        target_price: 3500,
        notes: 'Beautiful dress watch',
        status: 'watching'
      };

      const request = makeReq('http://localhost/api/wishlist', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        id: expect.any(Number),
        brand: 'Grand Seiko',
        model: 'SBGW289',
        reference: 'SBGW289',
        image_url: 'https://example.com/watch.jpg',
        target_price: 3500,
        notes: 'Beautiful dress watch',
        status: 'watching'
      });

      // Verify it was actually inserted
      const db = getTestDb();
      const inserted = db.prepare('SELECT * FROM wishlist WHERE id = ?').get(data.id);
      expect(inserted).toMatchObject({
        brand: 'Grand Seiko',
        model: 'SBGW289',
        reference: 'SBGW289',
        target_price: 3500,
        status: 'watching'
      });
    });

    it('should create item with minimal required fields', async () => {
      const requestBody = {
        brand: 'Casio',
        model: 'F-91W'
      };

      const request = makeReq('http://localhost/api/wishlist', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        brand: 'Casio',
        model: 'F-91W',
        reference: null,
        target_price: null,
        status: 'watching'
      });
    });

    it('should handle empty optional fields', async () => {
      const requestBody = {
        brand: 'Apple',
        model: 'Watch',
        reference: '',
        target_price: '',
        notes: ''
      };

      const request = makeReq('http://localhost/api/wishlist', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.reference).toBeNull();
      expect(data.target_price).toBeNull();
      expect(data.notes).toBeNull();
    });
  });

  describe('PATCH /api/wishlist', () => {
    it('should update an existing wishlist item', async () => {
      const db = getTestDb();
      const result = db.prepare(`
        INSERT INTO wishlist (user_id, brand, model, reference, target_price, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(TEST_USER_ID, 'Rolex', 'Submariner', '116610LN', 8500, 'watching');

      const updateBody = {
        id: result.lastInsertRowid,
        brand: 'Rolex',
        model: 'Submariner',
        reference: '116610LN',
        target_price: 8000, // Changed
        status: 'purchased', // Changed
        notes: 'Finally got it!'
      };

      const request = makeReq('http://localhost/api/wishlist', {
        method: 'PATCH',
        body: JSON.stringify(updateBody)
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ ok: true });

      // Verify the update
      const updated = db.prepare('SELECT * FROM wishlist WHERE id = ?').get(result.lastInsertRowid);
      expect(updated).toMatchObject({
        target_price: 8000,
        status: 'purchased',
        notes: 'Finally got it!'
      });
      // Check that updated_at is set to a valid datetime (the UPDATE trigger should set it)
      expect(updated.updated_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    it('should return 400 when id is missing', async () => {
      const request = makeReq('http://localhost/api/wishlist', {
        method: 'PATCH',
        body: JSON.stringify({ brand: 'Test' })
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('ID is required');
    });

    it('should return 404 when item does not exist', async () => {
      const request = makeReq('http://localhost/api/wishlist', {
        method: 'PATCH',
        body: JSON.stringify({ id: 999, brand: 'Test', model: 'Test' })
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Wishlist item not found');
    });
  });

  describe('DELETE /api/wishlist', () => {
    it('should delete a wishlist item and its price history', async () => {
      const db = getTestDb();

      // Create wishlist item
      const result = db.prepare(`
        INSERT INTO wishlist (user_id, brand, model) VALUES (?, ?, ?)
      `).run(TEST_USER_ID, 'Test', 'Watch');

      const wishlistId = result.lastInsertRowid;

      // Add price history
      db.prepare(`
        INSERT INTO price_history (wishlist_id, price) VALUES (?, ?)
      `).run(wishlistId, 1000);

      const response = await DELETE(makeReq(`http://localhost/api/wishlist?id=${wishlistId}`));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ ok: true });

      // Verify deletion
      const item = db.prepare('SELECT * FROM wishlist WHERE id = ?').get(wishlistId);
      const prices = db.prepare('SELECT * FROM price_history WHERE wishlist_id = ?').all(wishlistId);

      expect(item).toBeUndefined();
      expect(prices).toHaveLength(0);
    });

    it('should return 400 when id is missing', async () => {
      const response = await DELETE(makeReq('http://localhost/api/wishlist'));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('ID is required');
    });

    it('should return 404 when item does not exist', async () => {
      const response = await DELETE(makeReq('http://localhost/api/wishlist?id=999'));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Wishlist item not found');
    });
  });
});
