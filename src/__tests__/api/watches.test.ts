/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/watches/route';
import { getTestDb, resetTestDb, closeTestDb, seedTestData } from '@/lib/test-db';

// Mock the main db module to use test database
jest.mock('../../lib/db', () => {
  return require('../../lib/test-db').getTestDb();
});

describe('/api/watches', () => {
  beforeEach(() => {
    resetTestDb();
  });

  afterAll(() => {
    closeTestDb();
  });

  describe('GET /api/watches', () => {
    it('should return empty array when no watches exist', async () => {
      const response = await GET();
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(0);
    });

    it('should return all watches sorted by brand and model', async () => {
      seedTestData();
      
      const response = await GET();
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(3);
      
      // Should be sorted by brand, model
      expect(data[0].brand).toBe('Grand Seiko');
      expect(data[0].model).toBe('SBGW289');
      expect(data[1].brand).toBe('Omega');
      expect(data[1].model).toBe('Speedmaster');
      expect(data[2].brand).toBe('Rolex');
      expect(data[2].model).toBe('Submariner');
    });

    it('should include all watch properties', async () => {
      seedTestData();
      
      const response = await GET();
      const data = await response.json();
      
      const watch = data[0];
      expect(watch).toHaveProperty('id');
      expect(watch).toHaveProperty('brand');
      expect(watch).toHaveProperty('model');
      expect(watch).toHaveProperty('reference');
      expect(watch).toHaveProperty('image_url');
      expect(watch).toHaveProperty('created_at');
    });
  });

  describe('POST /api/watches', () => {
    it('should create a new watch with all fields', async () => {
      const requestBody = {
        brand: 'Seiko',
        model: 'SKX007',
        reference: 'SKX007K1'
      };

      const request = new NextRequest('http://localhost/api/watches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        id: expect.any(Number),
        brand: 'Seiko',
        model: 'SKX007',
        reference: 'SKX007K1'
      });

      // Verify it was actually inserted
      const db = getTestDb();
      const inserted = db.prepare('SELECT * FROM watches WHERE id = ?').get(data.id);
      expect(inserted).toMatchObject({
        brand: 'Seiko',
        model: 'SKX007',
        reference: 'SKX007K1'
      });
    });

    it('should create a watch without reference', async () => {
      const requestBody = {
        brand: 'Casio',
        model: 'F-91W'
      };

      const request = new NextRequest('http://localhost/api/watches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.reference).toBeNull();

      // Verify in database
      const db = getTestDb();
      const inserted = db.prepare('SELECT * FROM watches WHERE id = ?').get(data.id);
      expect(inserted?.reference).toBeNull();
    });

    it('should handle empty reference field', async () => {
      const requestBody = {
        brand: 'Apple',
        model: 'Watch',
        reference: ''
      };

      const request = new NextRequest('http://localhost/api/watches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.reference).toBeNull();
    });

    it('should require brand and model', async () => {
      // Test missing brand
      const requestWithoutBrand = new NextRequest('http://localhost/api/watches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'Test Model' })
      });

      // This should cause a database error due to NOT NULL constraint
      let errorCaught = false;
      try {
        await POST(requestWithoutBrand);
      } catch (err) {
        errorCaught = true;
        expect(err.message).toContain('NOT NULL constraint failed');
      }
      expect(errorCaught).toBe(true);

      // Test missing model
      const requestWithoutModel = new NextRequest('http://localhost/api/watches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: 'Test Brand' })
      });

      errorCaught = false;
      try {
        await POST(requestWithoutModel);
      } catch (err) {
        errorCaught = true;
        expect(err.message).toContain('NOT NULL constraint failed');
      }
      expect(errorCaught).toBe(true);
    });
  });
});