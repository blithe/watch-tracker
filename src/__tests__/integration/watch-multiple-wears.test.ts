/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST as createWatch } from '@/app/api/watches/route';
import { POST as logWear } from '@/app/api/wear-log/route';
import { GET as getCollection } from '@/app/api/collection/route';
import { getTestDb, resetTestDb, closeTestDb, getAuthHeaders } from '@/lib/test-db';

// Mock the main db module to use test database
jest.mock('../../lib/db', () => {
  return require('../../lib/test-db').getTestDb();
});

function makeReq(url: string, options?: RequestInit) {
  const headers = { 'Content-Type': 'application/json', ...getAuthHeaders(), ...(options?.headers as Record<string, string> || {}) };
  return new NextRequest(url, { ...options, headers });
}

describe('Integration: Watch with Multiple Wears', () => {
  beforeEach(() => {
    resetTestDb();
  });

  afterAll(() => {
    closeTestDb();
  });

  it('should handle multiple wear entries for the same watch correctly', async () => {
    const db = getTestDb();

    const createWatchRequest = makeReq('http://localhost/api/watches', {
      method: 'POST',
      body: JSON.stringify({ brand: 'Grand Seiko', model: 'SBGW289', reference: 'SBGW289' })
    });

    const createWatchResponse = await createWatch(createWatchRequest);
    expect(createWatchResponse.status).toBe(200);

    const createdWatch = await createWatchResponse.json();

    const wearDates = [
      { date: '2026-01-15', notes: 'First wear of the year' },
      { date: '2026-01-28', notes: 'Wore to a meeting' },
      { date: '2026-02-03', notes: 'Weekend casual wear' },
      { date: '2026-02-14', notes: "Valentine's Day" },
      { date: '2026-03-01', notes: 'Start of spring' },
      { date: '2026-03-15', notes: 'Mid-month wear' }
    ];

    for (const { date, notes } of wearDates) {
      const logWearRequest = makeReq('http://localhost/api/wear-log', {
        method: 'POST',
        body: JSON.stringify({ watch_id: createdWatch.id, date, notes })
      });
      const logWearResponse = await logWear(logWearRequest);
      expect(logWearResponse.status).toBe(200);
    }

    const janLogs = db.prepare(`
      SELECT w.*, wl.id as wl_id, wl.date, wl.image_url as log_image, wl.notes
      FROM wear_log wl JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date LIKE ? ORDER BY wl.date
    `).all('2026-01-%');

    expect(janLogs).toHaveLength(2);
    expect(janLogs[0]).toMatchObject({ date: '2026-01-15', notes: 'First wear of the year', brand: 'Grand Seiko' });

    const collectionResponse = await getCollection(makeReq('http://localhost/api/collection'));
    expect(collectionResponse.status).toBe(200);

    const collectionData = await collectionResponse.json();
    expect(collectionData.owned).toHaveLength(1);

    const watchInCollection = collectionData.owned[0];
    expect(watchInCollection).toMatchObject({
      id: createdWatch.id,
      brand: 'Grand Seiko',
      model: 'SBGW289',
      wear_count: 6
    });
  });

  it('should allow multiple watches on the same date', async () => {
    const db = getTestDb();

    const watch1 = await (await createWatch(makeReq('http://localhost/api/watches', { method: 'POST', body: JSON.stringify({ brand: 'Watch1', model: 'Model1' }) }))).json();
    const watch2 = await (await createWatch(makeReq('http://localhost/api/watches', { method: 'POST', body: JSON.stringify({ brand: 'Watch2', model: 'Model2' }) }))).json();

    const firstWearResponse = await logWear(makeReq('http://localhost/api/wear-log', {
      method: 'POST',
      body: JSON.stringify({ watch_id: watch1.id, date: '2026-02-25', notes: 'First wear on this date' })
    }));
    expect(firstWearResponse.status).toBe(200);

    const secondWearResponse = await logWear(makeReq('http://localhost/api/wear-log', {
      method: 'POST',
      body: JSON.stringify({ watch_id: watch2.id, date: '2026-02-25', notes: 'Second wear on same date' })
    }));
    expect(secondWearResponse.status).toBe(200);

    const wearLogs = db.prepare('SELECT * FROM wear_log WHERE date = ?').all('2026-02-25');
    expect(wearLogs).toHaveLength(2);
  });

  it('should handle many wears across different years', async () => {
    const db = getTestDb();

    const watch = await (await createWatch(makeReq('http://localhost/api/watches', {
      method: 'POST',
      body: JSON.stringify({ brand: 'Rolex', model: 'Submariner', reference: '116610LN' })
    }))).json();

    const multiYearWears = [
      '2024-06-15', '2024-12-31', '2025-01-01', '2025-06-15',
      '2025-12-25', '2026-01-01', '2026-07-04', '2026-12-31'
    ];

    for (let i = 0; i < multiYearWears.length; i++) {
      const date = multiYearWears[i];
      const wearResponse = await logWear(makeReq('http://localhost/api/wear-log', {
        method: 'POST',
        body: JSON.stringify({ watch_id: watch.id, date, notes: `Wear #${i + 1}` })
      }));
      expect(wearResponse.status).toBe(200);
    }

    const collectionData = await (await getCollection(makeReq('http://localhost/api/collection'))).json();
    expect(collectionData.owned[0]).toMatchObject({ id: watch.id, wear_count: multiYearWears.length });
  });

  it('should maintain correct wear counts with multiple watches', async () => {
    const db = getTestDb();

    const watches = [];
    for (let i = 1; i <= 3; i++) {
      const watchResponse = await createWatch(makeReq('http://localhost/api/watches', {
        method: 'POST',
        body: JSON.stringify({ brand: `Brand${i}`, model: `Model${i}`, reference: `REF${i}` })
      }));
      watches.push(await watchResponse.json());
    }

    const wearPlans = [
      { watchIndex: 0, dates: ['2026-03-01'] },
      { watchIndex: 1, dates: ['2026-03-02', '2026-03-04', '2026-03-06'] },
      { watchIndex: 2, dates: ['2026-03-03', '2026-03-05', '2026-03-07', '2026-03-09', '2026-03-11'] }
    ];

    for (const { watchIndex, dates } of wearPlans) {
      for (const date of dates) {
        const wearResponse = await logWear(makeReq('http://localhost/api/wear-log', {
          method: 'POST',
          body: JSON.stringify({ watch_id: watches[watchIndex].id, date, notes: `Wear for ${watches[watchIndex].brand}` })
        }));
        expect(wearResponse.status).toBe(200);
      }
    }

    const collectionData = await (await getCollection(makeReq('http://localhost/api/collection'))).json();
    expect(collectionData.owned).toHaveLength(3);

    const sortedWatches = collectionData.owned.sort((a: any, b: any) => a.brand.localeCompare(b.brand));
    expect(sortedWatches[0]).toMatchObject({ brand: 'Brand1', wear_count: 1 });
    expect(sortedWatches[1]).toMatchObject({ brand: 'Brand2', wear_count: 3 });
    expect(sortedWatches[2]).toMatchObject({ brand: 'Brand3', wear_count: 5 });

    const totalWearLogs = db.prepare('SELECT COUNT(*) as count FROM wear_log').get();
    expect(totalWearLogs.count).toBe(9);
  });

  it('should handle wear log deletions correctly (wear count updates)', async () => {
    const db = getTestDb();

    const watch = await (await createWatch(makeReq('http://localhost/api/watches', {
      method: 'POST',
      body: JSON.stringify({ brand: 'Test', model: 'Deletion' })
    }))).json();

    for (const date of ['2026-04-01', '2026-04-02', '2026-04-03']) {
      await logWear(makeReq('http://localhost/api/wear-log', {
        method: 'POST',
        body: JSON.stringify({ watch_id: watch.id, date, notes: `Wear on ${date}` })
      }));
    }

    let collectionData = await (await getCollection(makeReq('http://localhost/api/collection'))).json();
    expect(collectionData.owned[0].wear_count).toBe(3);

    db.prepare('DELETE FROM wear_log WHERE date = ?').run('2026-04-02');

    collectionData = await (await getCollection(makeReq('http://localhost/api/collection'))).json();
    expect(collectionData.owned[0].wear_count).toBe(2);
  });

  it('should handle edge case of same watch worn on consecutive days', async () => {
    const db = getTestDb();

    const watch = await (await createWatch(makeReq('http://localhost/api/watches', {
      method: 'POST',
      body: JSON.stringify({ brand: 'Consecutive', model: 'Days' })
    }))).json();

    const consecutiveDates = ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05'];

    for (const date of consecutiveDates) {
      const wearResponse = await logWear(makeReq('http://localhost/api/wear-log', {
        method: 'POST',
        body: JSON.stringify({ watch_id: watch.id, date, notes: `Consecutive wear on ${date}` })
      }));
      expect(wearResponse.status).toBe(200);
    }

    const mayLogs = db.prepare(`
      SELECT w.*, wl.id as wl_id, wl.date FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date LIKE ? ORDER BY wl.date
    `).all('2026-05-%');

    expect(mayLogs).toHaveLength(5);

    const collectionData = await (await getCollection(makeReq('http://localhost/api/collection'))).json();
    expect(collectionData.owned[0].wear_count).toBe(5);
  });
});
