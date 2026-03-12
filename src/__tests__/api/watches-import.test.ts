/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/watches/import/route';
import { getTestDb, resetTestDb, closeTestDb, getAuthHeaders } from '@/lib/test-db';

jest.mock('../../lib/db', () => {
  return require('../../lib/test-db').getTestDb();
});

function makeCSVRequest(csv: string, extraHeaders: Record<string, string> = {}, mapping?: Record<string, string | null>) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const formData = new FormData();
  formData.append('file', blob, 'watches.csv');
  if (mapping) formData.append('mapping', JSON.stringify(mapping));

  return new NextRequest('http://localhost/api/watches/import', {
    method: 'POST',
    headers: { ...getAuthHeaders(), ...extraHeaders },
    body: formData,
  });
}

describe('POST /api/watches/import', () => {
  beforeEach(() => resetTestDb());
  afterAll(() => closeTestDb());

  it('returns 401 without auth', async () => {
    const formData = new FormData();
    formData.append('file', new Blob(['brand,model\nRolex,Sub']), 'w.csv');
    const req = new NextRequest('http://localhost/api/watches/import', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when no file is uploaded', async () => {
    const formData = new FormData();
    const req = new NextRequest('http://localhost/api/watches/import', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/no file/i);
  });

  it('imports a simple CSV with exact column names', async () => {
    const csv = 'brand,model,reference\nRolex,Submariner,126610LN\nOmega,Speedmaster,311.30.42.30.01.005';
    const res = await POST(makeCSVRequest(csv));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.imported).toBe(2);
    expect(body.skipped).toBe(0);
    expect(body.errors).toHaveLength(0);
    expect(body.unknownColumns).toHaveLength(0);

    // Verify records in DB
    const db = getTestDb();
    const watches = db.prepare('SELECT * FROM watches WHERE user_id = 1 ORDER BY brand').all() as any[];
    expect(watches).toHaveLength(2);
    expect(watches[0].brand).toBe('Omega');
    expect(watches[1].brand).toBe('Rolex');
    expect(watches[1].reference).toBe('126610LN');
  });

  it('maps aliased headers (make, name, price)', async () => {
    const csv = 'make,name,price\nOmega,Speedmaster,3500';
    const res = await POST(makeCSVRequest(csv));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.imported).toBe(1);

    const db = getTestDb();
    const w = db.prepare('SELECT * FROM watches WHERE user_id = 1').get() as any;
    expect(w.brand).toBe('Omega');
    expect(w.model).toBe('Speedmaster');
    expect(w.purchase_price).toBe(3500);
  });

  it('skips duplicate brand+model+reference for same user', async () => {
    const csv = 'brand,model\nRolex,Submariner';
    // First import
    await POST(makeCSVRequest(csv));
    // Second import — same watch
    const res = await POST(makeCSVRequest(csv));
    const body = await res.json();

    expect(body.imported).toBe(0);
    expect(body.skipped).toBe(1);

    const db = getTestDb();
    const count = (db.prepare('SELECT COUNT(*) as c FROM watches WHERE user_id = 1').get() as any).c;
    expect(count).toBe(1);
  });

  it('reports row errors for missing required fields', async () => {
    const csv = 'brand,model\n,Submariner\nOmega,';
    const res = await POST(makeCSVRequest(csv));
    const body = await res.json();

    expect(body.imported).toBe(0);
    expect(body.errors).toHaveLength(2);
    expect(body.errors[0].row).toBe(2);
    expect(body.errors[0].message).toContain('"brand" is required');
    expect(body.errors[1].row).toBe(3);
    expect(body.errors[1].message).toContain('"model" is required');
  });

  it('reports row errors for invalid price', async () => {
    const csv = 'brand,model,purchase_price\nRolex,Sub,expensive';
    const res = await POST(makeCSVRequest(csv));
    const body = await res.json();

    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].message).toContain('not a valid price');
  });

  it('reports row errors for invalid date', async () => {
    const csv = 'brand,model,purchase_date\nRolex,Sub,March 2022';
    const res = await POST(makeCSVRequest(csv));
    const body = await res.json();

    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].message).toContain('not a valid date');
  });

  it('identifies unknown columns in the response', async () => {
    const csv = 'brand,model,dial_color,strap_material\nRolex,Sub,black,rubber';
    const res = await POST(makeCSVRequest(csv));
    const body = await res.json();

    expect(body.imported).toBe(1);
    expect(body.unknownColumns).toEqual(expect.arrayContaining(['dial_color', 'strap_material']));
  });

  it('handles mixed success and error rows', async () => {
    const csv = 'brand,model\nRolex,Submariner\n,DateJust\nOmega,Speedmaster';
    const res = await POST(makeCSVRequest(csv));
    const body = await res.json();

    expect(body.imported).toBe(2);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].row).toBe(3);
  });

  it('handles price with dollar sign and commas', async () => {
    const csv = 'brand,model,purchase_price\nRolex,Sub,"$9,500.00"';
    const res = await POST(makeCSVRequest(csv));
    const body = await res.json();

    expect(body.imported).toBe(1);
    const db = getTestDb();
    const w = db.prepare('SELECT purchase_price FROM watches WHERE user_id = 1').get() as any;
    expect(w.purchase_price).toBe(9500);
  });

  it('normalizes MM/DD/YYYY dates to YYYY-MM-DD', async () => {
    const csv = 'brand,model,purchase_date\nRolex,Sub,03/15/2022';
    const res = await POST(makeCSVRequest(csv));
    const body = await res.json();

    expect(body.imported).toBe(1);
    const db = getTestDb();
    const w = db.prepare('SELECT purchase_date FROM watches WHERE user_id = 1').get() as any;
    expect(w.purchase_date).toBe('2022-03-15');
  });

  it('returns 400 for empty CSV', async () => {
    const res = await POST(makeCSVRequest(''));
    expect(res.status).toBe(400);
  });

  it('uses custom mapping override instead of auto-detection', async () => {
    // "name" normally auto-maps to model, but user reassigns "name" to notes via preview
    const csv = 'brand,name,model\nRolex,My daily driver,GMT Master';
    const mapping = { brand: 'brand', name: 'notes', model: 'model' };
    const res = await POST(makeCSVRequest(csv, {}, mapping));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.imported).toBe(1);

    const db = getTestDb();
    const w = db.prepare('SELECT * FROM watches WHERE user_id = 1').get() as any;
    expect(w.brand).toBe('Rolex');
    expect(w.model).toBe('GMT Master');
    expect(w.notes).toBe('My daily driver');
  });

  it('custom mapping can reassign columns', async () => {
    // Map "name" to notes instead of model, "ref" to model
    const csv = 'brand,name,ref\nOmega,My favorite watch,Speedmaster';
    const mapping = { brand: 'brand', name: 'notes', ref: 'model' };
    const res = await POST(makeCSVRequest(csv, {}, mapping));
    const body = await res.json();

    expect(body.imported).toBe(1);

    const db = getTestDb();
    const w = db.prepare('SELECT * FROM watches WHERE user_id = 1').get() as any;
    expect(w.brand).toBe('Omega');
    expect(w.model).toBe('Speedmaster');
    expect(w.notes).toBe('My favorite watch');
  });
});
