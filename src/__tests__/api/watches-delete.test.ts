/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { DELETE } from '@/app/api/watches/[id]/route';
import { getTestDb, resetTestDb, closeTestDb, seedTestData } from '@/lib/test-db';

jest.mock('../../lib/db', () => {
  return require('../../lib/test-db').getTestDb();
});

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('DELETE /api/watches/[id]', () => {
  beforeEach(() => {
    resetTestDb();
    seedTestData();
  });

  afterAll(() => {
    closeTestDb();
  });

  it('should delete a watch', async () => {
    const db = getTestDb();
    const watch = db.prepare('SELECT * FROM watches LIMIT 1').get() as any;

    const req = new NextRequest(`http://localhost/api/watches/${watch.id}`, { method: 'DELETE' });
    const response = await DELETE(req, makeParams(String(watch.id)));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true });

    const deleted = db.prepare('SELECT * FROM watches WHERE id = ?').get(watch.id);
    expect(deleted).toBeUndefined();
  });

  it('should return 404 for non-existent id', async () => {
    const req = new NextRequest('http://localhost/api/watches/99999', { method: 'DELETE' });
    const response = await DELETE(req, makeParams('99999'));

    expect(response.status).toBe(404);
  });
});
