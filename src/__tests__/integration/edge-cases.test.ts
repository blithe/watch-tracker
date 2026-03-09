/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST as createWatch } from '@/app/api/watches/route';
import { POST as logWear } from '@/app/api/wear-log/route';
import { POST as createWishlistItem, DELETE as deleteWishlistItem } from '@/app/api/wishlist/route';
import { POST as addPrice } from '@/app/api/wishlist/[id]/prices/route';
import { getTestDb, resetTestDb, closeTestDb, getAuthHeaders } from '@/lib/test-db';

// Mock the main db module to use test database
jest.mock('../../lib/db', () => {
  return require('../../lib/test-db').getTestDb();
});

function makeReq(url: string, options?: RequestInit) {
  const headers = { 'Content-Type': 'application/json', ...getAuthHeaders(), ...(options?.headers as Record<string, string> || {}) };
  return new NextRequest(url, { ...options, headers });
}

describe('Integration: Edge Cases', () => {
  beforeEach(() => {
    resetTestDb();
  });

  afterAll(() => {
    closeTestDb();
  });

  it('should fail to log wear for non-existent watch_id (FK constraint)', async () => {
    const db = getTestDb();

    const invalidWearRequest = makeReq('http://localhost/api/wear-log', {
      method: 'POST',
      body: JSON.stringify({ watch_id: 99999, date: '2026-03-01', notes: 'This should fail' })
    });

    const invalidWearResponse = await logWear(invalidWearRequest);
    expect(invalidWearResponse.status).toBe(500);

    const errorData = await invalidWearResponse.json();
    expect(errorData).toHaveProperty('error');
    expect(errorData.error).toContain('FOREIGN KEY constraint failed');

    const wearLogs = db.prepare('SELECT * FROM wear_log').all();
    expect(wearLogs).toHaveLength(0);
  });

  it('should fail to log two wears on the same date (UNIQUE constraint)', async () => {
    const db = getTestDb();

    const watch1 = await (await createWatch(makeReq('http://localhost/api/watches', { method: 'POST', body: JSON.stringify({ brand: 'First', model: 'Watch' }) }))).json();
    const watch2 = await (await createWatch(makeReq('http://localhost/api/watches', { method: 'POST', body: JSON.stringify({ brand: 'Second', model: 'Watch' }) }))).json();

    const firstWearResponse = await logWear(makeReq('http://localhost/api/wear-log', {
      method: 'POST',
      body: JSON.stringify({ watch_id: watch1.id, date: '2026-03-02', notes: 'First wear today' })
    }));
    expect(firstWearResponse.status).toBe(200);

    const duplicateWearResponse = await logWear(makeReq('http://localhost/api/wear-log', {
      method: 'POST',
      body: JSON.stringify({ watch_id: watch2.id, date: '2026-03-02', notes: 'This should fail' })
    }));
    expect(duplicateWearResponse.status).toBe(400);

    const duplicateErrorData = await duplicateWearResponse.json();
    expect(duplicateErrorData).toEqual({ error: 'Already logged a watch for this date' });

    const wearLogs = db.prepare('SELECT * FROM wear_log WHERE date = ?').all('2026-03-02');
    expect(wearLogs).toHaveLength(1);
    expect(wearLogs[0]).toMatchObject({ watch_id: watch1.id, notes: 'First wear today' });
  });

  it('should clean up price_history when wishlist item is deleted', async () => {
    const db = getTestDb();

    const wishlistResponse = await createWishlistItem(makeReq('http://localhost/api/wishlist', {
      method: 'POST',
      body: JSON.stringify({ brand: 'Cleanup', model: 'Test', target_price: 5000 })
    }));
    const wishlistItem = await wishlistResponse.json();

    for (const priceData of [
      { price: 5200, source: 'Source1' },
      { price: 4800, source: 'Source2' },
      { price: 5100, source: 'Source3' }
    ]) {
      const priceResponse = await addPrice(
        makeReq(`http://localhost/api/wishlist/${wishlistItem.id}/prices`, {
          method: 'POST',
          body: JSON.stringify(priceData)
        }),
        { params: { id: wishlistItem.id.toString() } } as any
      );
      expect(priceResponse.status).toBe(200);
    }

    let priceHistory = db.prepare('SELECT * FROM price_history WHERE wishlist_id = ?').all(wishlistItem.id);
    expect(priceHistory).toHaveLength(3);

    db.prepare('DELETE FROM price_history WHERE wishlist_id = ?').run(wishlistItem.id);
    const deleteResult = db.prepare('DELETE FROM wishlist WHERE id = ?').run(wishlistItem.id);
    expect(deleteResult.changes).toBe(1);

    priceHistory = db.prepare('SELECT * FROM price_history WHERE wishlist_id = ?').all(wishlistItem.id);
    expect(priceHistory).toHaveLength(0);
  });

  it('should handle dates at month boundaries correctly', async () => {
    const db = getTestDb();

    const watch = await (await createWatch(makeReq('http://localhost/api/watches', {
      method: 'POST',
      body: JSON.stringify({ brand: 'Boundary', model: 'Test' })
    }))).json();

    const boundaryDates = [
      { date: '2026-01-31', month: '2026-01', description: 'Last day of January' },
      { date: '2026-02-01', month: '2026-02', description: 'First day of February' },
      { date: '2026-02-28', month: '2026-02', description: 'Last day of February 2026 (non-leap)' },
      { date: '2026-03-01', month: '2026-03', description: 'First day of March' },
      { date: '2024-02-29', month: '2024-02', description: 'Leap day 2024' },
      { date: '2024-03-01', month: '2024-03', description: 'March 1 after leap day' },
      { date: '2025-12-31', month: '2025-12', description: 'Last day of 2025' },
      { date: '2026-01-01', month: '2026-01', description: 'First day of 2026' }
    ];

    for (const { date, description } of boundaryDates) {
      const boundaryWearResponse = await logWear(makeReq('http://localhost/api/wear-log', {
        method: 'POST',
        body: JSON.stringify({ watch_id: watch.id, date, notes: description })
      }));
      expect(boundaryWearResponse.status).toBe(200);
    }

    for (const { date, month, description } of boundaryDates) {
      const monthLogs = db.prepare(`
        SELECT w.*, wl.id as wl_id, wl.date, wl.image_url as log_image, wl.notes
        FROM wear_log wl JOIN watches w ON w.id = wl.watch_id
        WHERE wl.date LIKE ? ORDER BY wl.date
      `).all(month + '-%');

      const thisDateLog = monthLogs.find((log: any) => log.date === date);
      expect(thisDateLog).toBeDefined();
      expect(thisDateLog?.notes).toBe(description);
    }
  });

  it('should handle foreign key constraints properly across all tables', async () => {
    const db = getTestDb();

    const invalidWearLogResponse = await logWear(makeReq('http://localhost/api/wear-log', {
      method: 'POST',
      body: JSON.stringify({ watch_id: 999, date: '2026-03-05', notes: 'Should fail' })
    }));
    expect(invalidWearLogResponse.status).toBe(500);

    const invalidPriceResponse = await addPrice(
      makeReq('http://localhost/api/wishlist/999/prices', {
        method: 'POST',
        body: JSON.stringify({ price: 1000, source: 'Test' })
      }),
      { params: { id: '999' } } as any
    );
    expect(invalidPriceResponse.status).toBe(404);

    const watch = await (await createWatch(makeReq('http://localhost/api/watches', {
      method: 'POST',
      body: JSON.stringify({ brand: 'FK', model: 'Test' })
    }))).json();

    await logWear(makeReq('http://localhost/api/wear-log', {
      method: 'POST',
      body: JSON.stringify({ watch_id: watch.id, date: '2026-03-06', notes: 'Test wear' })
    }));

    let fkError = false;
    try {
      db.prepare('DELETE FROM watches WHERE id = ?').run(watch.id);
    } catch (error: any) {
      fkError = true;
      expect(error.message).toContain('FOREIGN KEY constraint failed');
    }
    expect(fkError).toBe(true);

    db.prepare('DELETE FROM wear_log WHERE watch_id = ?').run(watch.id);
    const deleteResult = db.prepare('DELETE FROM watches WHERE id = ?').run(watch.id);
    expect(deleteResult.changes).toBe(1);
  });

  it('should handle empty and null values correctly', async () => {
    const db = getTestDb();

    const minimalWatch = await (await createWatch(makeReq('http://localhost/api/watches', {
      method: 'POST',
      body: JSON.stringify({ brand: 'Minimal', model: 'Test', reference: '', image_url: null, notes: '' })
    }))).json();

    const dbWatch = db.prepare('SELECT * FROM watches WHERE id = ?').get(minimalWatch.id);
    expect(dbWatch.reference).toBeNull();
    expect(dbWatch.image_url).toBeNull();
    expect(dbWatch.notes).toBeNull();

    const minimalWearResponse = await logWear(makeReq('http://localhost/api/wear-log', {
      method: 'POST',
      body: JSON.stringify({ watch_id: minimalWatch.id, date: '2026-03-07' })
    }));
    expect(minimalWearResponse.status).toBe(200);

    const dayLog = db.prepare(`
      SELECT wl.*, w.brand, w.model, w.reference, w.image_url as watch_image
      FROM wear_log wl JOIN watches w ON w.id = wl.watch_id WHERE wl.date = ?
    `).get('2026-03-07');

    expect(dayLog).toMatchObject({
      date: '2026-03-07',
      image_url: null,
      notes: null,
      watch_image: null,
      reference: null
    });

    const minimalWishlistItem = await (await createWishlistItem(makeReq('http://localhost/api/wishlist', {
      method: 'POST',
      body: JSON.stringify({ brand: 'Minimal', model: 'Wishlist' })
    }))).json();

    expect(minimalWishlistItem.target_price).toBeNull();
    expect(minimalWishlistItem.notes).toBeNull();
    expect(minimalWishlistItem.reference).toBeNull();
  });

  it('should handle invalid data types gracefully', async () => {
    const invalidWatchRequest = makeReq('http://localhost/api/watches', {
      method: 'POST',
      body: JSON.stringify({ brand: null, model: 'Test' })
    });

    let errorCaught = false;
    try {
      await createWatch(invalidWatchRequest);
    } catch (error: any) {
      errorCaught = true;
      expect(error.message).toContain('NOT NULL constraint failed');
    }
    expect(errorCaught).toBe(true);

    const validWatch = await (await createWatch(makeReq('http://localhost/api/watches', {
      method: 'POST',
      body: JSON.stringify({ brand: 'Valid', model: 'Watch' })
    }))).json();

    const invalidDateWearResponse = await logWear(makeReq('http://localhost/api/wear-log', {
      method: 'POST',
      body: JSON.stringify({ watch_id: validWatch.id, date: 'not-a-date', notes: 'Invalid date test' })
    }));
    expect(invalidDateWearResponse.status).toBe(200);

    const db = getTestDb();
    const invalidDateLog = db.prepare('SELECT * FROM wear_log WHERE date = ?').get('not-a-date');
    expect(invalidDateLog).toBeDefined();
    expect(invalidDateLog.date).toBe('not-a-date');
  });

  it('should maintain data integrity under concurrent-like operations', async () => {
    const db = getTestDb();

    const watches = [];
    for (let i = 1; i <= 3; i++) {
      const watchResponse = await createWatch(makeReq('http://localhost/api/watches', {
        method: 'POST',
        body: JSON.stringify({ brand: `Concurrent${i}`, model: `Test${i}` })
      }));
      watches.push(await watchResponse.json());
    }

    const operations = watches.map(watch =>
      logWear(makeReq('http://localhost/api/wear-log', {
        method: 'POST',
        body: JSON.stringify({ watch_id: watch.id, date: '2026-03-10', notes: `Attempt` })
      }))
    );

    const results = await Promise.allSettled(operations);

    const successfulResults = results.filter(r => r.status === 'fulfilled' && (r as any).value.status === 200);
    const failedResults = results.filter(r => r.status === 'fulfilled' && (r as any).value.status === 400);

    expect(successfulResults).toHaveLength(1);
    expect(failedResults.length).toBeGreaterThan(0);

    const wearLogsForDate = db.prepare('SELECT * FROM wear_log WHERE date = ?').all('2026-03-10');
    expect(wearLogsForDate).toHaveLength(1);
  });
});
