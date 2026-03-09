/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET, PATCH, DELETE } from '@/app/api/wear-log/[id]/route';
import { getTestDb, resetTestDb, closeTestDb, seedTestData, getAuthHeaders } from '@/lib/test-db';

jest.mock('../../lib/db', () => {
  return require('../../lib/test-db').getTestDb();
});

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeReq(url: string, options?: RequestInit) {
  const headers = { 'Content-Type': 'application/json', ...getAuthHeaders(), ...(options?.headers as Record<string, string> || {}) };
  return new NextRequest(url, { ...options, headers });
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

      const req = makeReq(`http://localhost/api/wear-log/${log.id}`);
      const response = await GET(req, makeParams(String(log.id)));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('id', log.id);
      expect(data).toHaveProperty('brand');
      expect(data).toHaveProperty('model');
      expect(data).toHaveProperty('date');
    });

    it('should return 404 for non-existent id', async () => {
      const req = makeReq('http://localhost/api/wear-log/99999');
      const response = await GET(req, makeParams('99999'));

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/wear-log/[id]', () => {
    it('should update notes on a wear log entry', async () => {
      const db = getTestDb();
      const log = db.prepare('SELECT * FROM wear_log LIMIT 1').get() as any;

      const req = makeReq(`http://localhost/api/wear-log/${log.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ notes: 'Updated notes' }),
      });
      const response = await PATCH(req, makeParams(String(log.id)));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ ok: true });

      const updated = db.prepare('SELECT * FROM wear_log WHERE id = ?').get(log.id) as any;
      expect(updated.notes).toBe('Updated notes');
    });

    it('should update image_url on a wear log entry', async () => {
      const db = getTestDb();
      const log = db.prepare('SELECT * FROM wear_log LIMIT 1').get() as any;

      const req = makeReq(`http://localhost/api/wear-log/${log.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ image_url: '/uploads/new-photo.jpg' }),
      });
      const response = await PATCH(req, makeParams(String(log.id)));

      expect(response.status).toBe(200);
      const updated = db.prepare('SELECT * FROM wear_log WHERE id = ?').get(log.id) as any;
      expect(updated.image_url).toBe('/uploads/new-photo.jpg');
    });

    it('should set image_url to null when empty string is passed', async () => {
      const db = getTestDb();
      const log = db.prepare('SELECT * FROM wear_log LIMIT 1').get() as any;

      const req = makeReq(`http://localhost/api/wear-log/${log.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ image_url: '' }),
      });
      const response = await PATCH(req, makeParams(String(log.id)));

      expect(response.status).toBe(200);
      const updated = db.prepare('SELECT * FROM wear_log WHERE id = ?').get(log.id) as any;
      expect(updated.image_url).toBeNull();
    });

    it('should update watch_id on a wear log entry', async () => {
      const db = getTestDb();
      const watches = db.prepare('SELECT id FROM watches ORDER BY id').all() as any[];
      const watch2Id = watches[1].id;
      const log = db.prepare('SELECT * FROM wear_log LIMIT 1').get() as any;

      const req = makeReq(`http://localhost/api/wear-log/${log.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ watch_id: watch2Id }),
      });
      const response = await PATCH(req, makeParams(String(log.id)));

      expect(response.status).toBe(200);
      const updated = db.prepare('SELECT * FROM wear_log WHERE id = ?').get(log.id) as any;
      expect(updated.watch_id).toBe(watch2Id);
    });

    it('should return 400 when no valid fields provided', async () => {
      const db = getTestDb();
      const log = db.prepare('SELECT * FROM wear_log LIMIT 1').get() as any;

      const req = makeReq(`http://localhost/api/wear-log/${log.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ invalid_field: 'value' }),
      });
      const response = await PATCH(req, makeParams(String(log.id)));

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent id', async () => {
      const req = makeReq('http://localhost/api/wear-log/99999', {
        method: 'PATCH',
        body: JSON.stringify({ notes: 'test' }),
      });
      const response = await PATCH(req, makeParams('99999'));

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/wear-log/[id]', () => {
    it('should delete a wear log entry', async () => {
      const db = getTestDb();
      const log = db.prepare('SELECT * FROM wear_log LIMIT 1').get() as any;

      const req = makeReq(`http://localhost/api/wear-log/${log.id}`, { method: 'DELETE' });
      const response = await DELETE(req, makeParams(String(log.id)));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ ok: true });

      const deleted = db.prepare('SELECT * FROM wear_log WHERE id = ?').get(log.id);
      expect(deleted).toBeUndefined();
    });

    it('should return 404 for non-existent id', async () => {
      const req = makeReq('http://localhost/api/wear-log/99999', { method: 'DELETE' });
      const response = await DELETE(req, makeParams('99999'));

      expect(response.status).toBe(404);
    });
  });
});
