/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/wishlist/[id]/prices/route';
import { getTestDb, resetTestDb, closeTestDb } from '@/lib/test-db';

// Mock the main db module to use test database
jest.mock('../../lib/db', () => {
  return require('../../lib/test-db').getTestDb();
});

describe('/api/wishlist/[id]/prices', () => {
  beforeEach(() => {
    resetTestDb();
  });

  afterAll(() => {
    closeTestDb();
  });

  describe('GET /api/wishlist/[id]/prices', () => {
    it('should return empty array when no price history exists', async () => {
      const db = getTestDb();
      const result = db.prepare(`
        INSERT INTO wishlist (brand, model) VALUES (?, ?)
      `).run('Rolex', 'Submariner');

      const response = await GET(
        new NextRequest('http://localhost'),
        { params: { id: String(result.lastInsertRowid) } }
      );
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(0);
    });

    it('should return price history sorted by recorded_at DESC', async () => {
      const db = getTestDb();
      
      // Create wishlist item
      const wishlistResult = db.prepare(`
        INSERT INTO wishlist (brand, model) VALUES (?, ?)
      `).run('Rolex', 'Submariner');
      
      const wishlistId = wishlistResult.lastInsertRowid;
      
      // Insert price history entries
      db.prepare(`
        INSERT INTO price_history (wishlist_id, price, source, recorded_at) 
        VALUES (?, ?, ?, ?)
      `).run(wishlistId, 8500, 'Chrono24', '2026-02-08 10:00:00');
      
      db.prepare(`
        INSERT INTO price_history (wishlist_id, price, source, recorded_at) 
        VALUES (?, ?, ?, ?)
      `).run(wishlistId, 8200, 'eBay', '2026-02-08 12:00:00');
      
      db.prepare(`
        INSERT INTO price_history (wishlist_id, price, source, recorded_at) 
        VALUES (?, ?, ?, ?)
      `).run(wishlistId, 8800, 'Official', '2026-02-08 08:00:00');

      const response = await GET(
        new NextRequest('http://localhost'),
        { params: { id: String(wishlistId) } }
      );
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveLength(3);
      
      // Should be sorted by recorded_at DESC (most recent first)
      expect(data[0].price).toBe(8200);
      expect(data[0].source).toBe('eBay');
      expect(data[1].price).toBe(8500);
      expect(data[1].source).toBe('Chrono24');
      expect(data[2].price).toBe(8800);
      expect(data[2].source).toBe('Official');
    });

    it('should return 404 when wishlist item does not exist', async () => {
      const response = await GET(
        new NextRequest('http://localhost'),
        { params: { id: '999' } }
      );
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Wishlist item not found');
    });

    it('should return 400 when id is missing', async () => {
      const response = await GET(
        new NextRequest('http://localhost'),
        { params: { id: '' } }
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Wishlist ID is required');
    });

    it('should include all price history properties', async () => {
      const db = getTestDb();
      
      const wishlistResult = db.prepare(`
        INSERT INTO wishlist (brand, model) VALUES (?, ?)
      `).run('Test', 'Watch');
      
      const wishlistId = wishlistResult.lastInsertRowid;
      
      db.prepare(`
        INSERT INTO price_history (wishlist_id, price, source, url) 
        VALUES (?, ?, ?, ?)
      `).run(wishlistId, 1500.50, 'Test Source', 'https://example.com');

      const response = await GET(
        new NextRequest('http://localhost'),
        { params: { id: String(wishlistId) } }
      );
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      
      const entry = data[0];
      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('wishlist_id');
      expect(entry).toHaveProperty('price');
      expect(entry).toHaveProperty('source');
      expect(entry).toHaveProperty('url');
      expect(entry).toHaveProperty('recorded_at');
      
      expect(entry.price).toBe(1500.5);
      expect(entry.source).toBe('Test Source');
      expect(entry.url).toBe('https://example.com');
    });
  });

  describe('POST /api/wishlist/[id]/prices', () => {
    it('should create a new price entry with all fields', async () => {
      const db = getTestDb();
      const wishlistResult = db.prepare(`
        INSERT INTO wishlist (brand, model) VALUES (?, ?)
      `).run('Rolex', 'Submariner');
      
      const wishlistId = String(wishlistResult.lastInsertRowid);
      
      const requestBody = {
        price: 8500.75,
        source: 'Chrono24',
        url: 'https://chrono24.com/rolex/submariner'
      };

      const request = new NextRequest('http://localhost/api/wishlist/1/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request, { params: { id: wishlistId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        id: expect.any(Number),
        wishlist_id: Number(wishlistId),
        price: 8500.75,
        source: 'Chrono24',
        url: 'https://chrono24.com/rolex/submariner'
      });

      // Verify it was actually inserted
      const inserted = db.prepare('SELECT * FROM price_history WHERE id = ?').get(data.id);
      expect(inserted).toMatchObject({
        wishlist_id: Number(wishlistId),
        price: 8500.75,
        source: 'Chrono24',
        url: 'https://chrono24.com/rolex/submariner'
      });
    });

    it('should create entry with minimal required fields', async () => {
      const db = getTestDb();
      const wishlistResult = db.prepare(`
        INSERT INTO wishlist (brand, model) VALUES (?, ?)
      `).run('Test', 'Watch');
      
      const wishlistId = String(wishlistResult.lastInsertRowid);
      
      const requestBody = {
        price: 1000
      };

      const request = new NextRequest('http://localhost/api/wishlist/1/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request, { params: { id: wishlistId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        wishlist_id: Number(wishlistId),
        price: 1000,
        source: null,
        url: null
      });
    });

    it('should return 400 when price is missing', async () => {
      const db = getTestDb();
      const wishlistResult = db.prepare(`
        INSERT INTO wishlist (brand, model) VALUES (?, ?)
      `).run('Test', 'Watch');
      
      const wishlistId = String(wishlistResult.lastInsertRowid);
      
      const request = new NextRequest('http://localhost/api/wishlist/1/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'Test' })
      });

      const response = await POST(request, { params: { id: wishlistId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Valid price is required');
    });

    it('should return 400 when price is invalid', async () => {
      const db = getTestDb();
      const wishlistResult = db.prepare(`
        INSERT INTO wishlist (brand, model) VALUES (?, ?)
      `).run('Test', 'Watch');
      
      const wishlistId = String(wishlistResult.lastInsertRowid);
      
      const request = new NextRequest('http://localhost/api/wishlist/1/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: 'not-a-number' })
      });

      const response = await POST(request, { params: { id: wishlistId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Valid price is required');
    });

    it('should return 404 when wishlist item does not exist', async () => {
      const request = new NextRequest('http://localhost/api/wishlist/999/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: 1000 })
      });

      const response = await POST(request, { params: { id: '999' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Wishlist item not found');
    });

    it('should return 400 when wishlist id is missing', async () => {
      const request = new NextRequest('http://localhost/api/wishlist//prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: 1000 })
      });

      const response = await POST(request, { params: { id: '' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Wishlist ID is required');
    });

    it('should handle empty optional fields correctly', async () => {
      const db = getTestDb();
      const wishlistResult = db.prepare(`
        INSERT INTO wishlist (brand, model) VALUES (?, ?)
      `).run('Test', 'Watch');
      
      const wishlistId = String(wishlistResult.lastInsertRowid);
      
      const requestBody = {
        price: 2000,
        source: '',
        url: ''
      };

      const request = new NextRequest('http://localhost/api/wishlist/1/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request, { params: { id: wishlistId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.source).toBeNull();
      expect(data.url).toBeNull();
    });
  });
});