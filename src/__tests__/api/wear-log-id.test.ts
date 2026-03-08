/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET, DELETE } from '@/app/api/wear-log/[id]/route';
import { getTestDb, resetTestDb, closeTestDb, seedTestData } from '@/lib/test-db';

jest.mock('../../lib/db', () => {
  return require('../../lib/test-db').getTestDb();
});

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('/api/wear-log/[id]', () => {
  beforeEach(() => {
    resetTestDb();
    seedTestData();
  });

  afterAll(() => {
    closeTestDb();
  });

  describe('GET /api/wear-log/[id]', () => {
    it('should return a wear log entry with watch info', async () => {
      const db = getTestDb();
      const log = db.prepare('SELECT * FROM wear_log LIMIT 1').get() as any;

      const req = new NextRequest(`http://localhost/api/wear-log/${log.id}`);
      const response = await GET(req, makeParams(String(log.id)));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('id', log.id);
      expect(data).toHaveProperty('brand');
      expect(data).toHaveProperty('model');
      expect(data).toHaveProperty('date');
    });

    it('should return 404 for non-existent id', async () => {
      const req = new NextRequest('http://localhost/api/wear-log/99999');
      const response = await GET(req, makeParams('99999'));

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/wear-log/[id]', () => {
    it('should delete a wear log entry', async () => {
      const db = getTestDb();
      const log = db.prepare('SELECT * FROM wear_log LIMIT 1').get() as any;

      const req = new NextRequest(`http://localhost/api/wear-log/${log.id}`, { method: 'DELETE' });
      const response = await DELETE(req, makeParams(String(log.id)));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ ok: true });

      const deleted = db.prepare('SELECT * FROM wear_log WHERE id = ?').get(log.id);
      expect(deleted).toBeUndefined();
    });

    it('should return 404 for non-existent id', async () => {
      const req = new NextRequest('http://localhost/api/wear-log/99999', { method: 'DELETE' });
      const response = await DELETE(req, makeParams('99999'));

      expect(response.status).toBe(404);
    });
  });
});
