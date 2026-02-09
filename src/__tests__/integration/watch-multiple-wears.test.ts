/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST as createWatch } from '@/app/api/watches/route';
import { POST as logWear } from '@/app/api/wear-log/route';
import { GET as getCollection } from '@/app/api/collection/route';
import { getTestDb, resetTestDb, closeTestDb } from '@/lib/test-db';

// Mock the main db module to use test database
jest.mock('../../lib/db', () => {
  return require('../../lib/test-db').getTestDb();
});

describe('Integration: Watch with Multiple Wears', () => {
  beforeEach(() => {
    resetTestDb();
  });

  afterAll(() => {
    closeTestDb();
  });

  it('should handle multiple wear entries for the same watch correctly', async () => {
    const db = getTestDb();

    // Step 1: Add a watch
    const watchData = {
      brand: 'Grand Seiko',
      model: 'SBGW289',
      reference: 'SBGW289'
    };

    const createWatchRequest = new NextRequest('http://localhost/api/watches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(watchData)
    });

    const createWatchResponse = await createWatch(createWatchRequest);
    expect(createWatchResponse.status).toBe(200);
    
    const createdWatch = await createWatchResponse.json();

    // Step 2: Log it on multiple different dates
    const wearDates = [
      { date: '2026-01-15', notes: 'First wear of the year' },
      { date: '2026-01-28', notes: 'Wore to a meeting' },
      { date: '2026-02-03', notes: 'Weekend casual wear' },
      { date: '2026-02-14', notes: 'Valentine\'s Day' },
      { date: '2026-03-01', notes: 'Start of spring' },
      { date: '2026-03-15', notes: 'Mid-month wear' }
    ];

    for (const { date, notes } of wearDates) {
      const wearData = {
        watch_id: createdWatch.id,
        date: date,
        notes: notes
      };

      const logWearRequest = new NextRequest('http://localhost/api/wear-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wearData)
      });

      const logWearResponse = await logWear(logWearRequest);
      expect(logWearResponse.status).toBe(200);
    }

    // Step 3: Verify all entries appear in respective calendar months
    
    // January 2026 should have 2 entries
    const janLogs = db.prepare(`
      SELECT w.*, wl.id as wl_id, wl.date, wl.image_url as log_image, wl.notes
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date LIKE ?
      ORDER BY wl.date
    `).all('2026-01-%');

    expect(janLogs).toHaveLength(2);
    expect(janLogs[0]).toMatchObject({
      date: '2026-01-15',
      notes: 'First wear of the year',
      brand: 'Grand Seiko',
      model: 'SBGW289'
    });
    expect(janLogs[1]).toMatchObject({
      date: '2026-01-28',
      notes: 'Wore to a meeting',
      brand: 'Grand Seiko'
    });

    // February 2026 should have 2 entries
    const febLogs = db.prepare(`
      SELECT w.*, wl.id as wl_id, wl.date, wl.image_url as log_image, wl.notes
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date LIKE ?
      ORDER BY wl.date
    `).all('2026-02-%');

    expect(febLogs).toHaveLength(2);
    expect(febLogs[0]).toMatchObject({
      date: '2026-02-03',
      notes: 'Weekend casual wear'
    });
    expect(febLogs[1]).toMatchObject({
      date: '2026-02-14',
      notes: 'Valentine\'s Day'
    });

    // March 2026 should have 2 entries
    const marLogs = db.prepare(`
      SELECT w.*, wl.id as wl_id, wl.date, wl.image_url as log_image, wl.notes
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date LIKE ?
      ORDER BY wl.date
    `).all('2026-03-%');

    expect(marLogs).toHaveLength(2);
    expect(marLogs[0]).toMatchObject({
      date: '2026-03-01',
      notes: 'Start of spring'
    });
    expect(marLogs[1]).toMatchObject({
      date: '2026-03-15',
      notes: 'Mid-month wear'
    });

    // Step 4: Verify wear count in stats/collection is accurate
    const collectionResponse = await getCollection();
    expect(collectionResponse.status).toBe(200);
    
    const collectionData = await collectionResponse.json();
    expect(collectionData.owned).toHaveLength(1);
    
    const watchInCollection = collectionData.owned[0];
    expect(watchInCollection).toMatchObject({
      id: createdWatch.id,
      brand: 'Grand Seiko',
      model: 'SBGW289',
      wear_count: 6 // All 6 wears should be counted
    });

    // Verify total stats
    expect(collectionData.stats).toMatchObject({
      totalWatches: 1,
      ownedCount: 1,
      soldCount: 0
    });
  });

  it('should enforce UNIQUE constraint on wear_log.date', async () => {
    const db = getTestDb();

    // Create two watches
    const watch1Request = new NextRequest('http://localhost/api/watches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand: 'Watch1', model: 'Model1' })
    });
    const watch1Response = await createWatch(watch1Request);
    const watch1 = await watch1Response.json();

    const watch2Request = new NextRequest('http://localhost/api/watches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand: 'Watch2', model: 'Model2' })
    });
    const watch2Response = await createWatch(watch2Request);
    const watch2 = await watch2Response.json();

    // Log first watch on a date
    const firstWearRequest = new NextRequest('http://localhost/api/wear-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        watch_id: watch1.id,
        date: '2026-02-25',
        notes: 'First wear on this date'
      })
    });

    const firstWearResponse = await logWear(firstWearRequest);
    expect(firstWearResponse.status).toBe(200);

    // Step 5: Verify the UNIQUE constraint works - can't log two watches same day
    const secondWearRequest = new NextRequest('http://localhost/api/wear-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        watch_id: watch2.id,
        date: '2026-02-25', // Same date!
        notes: 'Attempted second wear on same date'
      })
    });

    const secondWearResponse = await logWear(secondWearRequest);
    expect(secondWearResponse.status).toBe(400);
    
    const errorData = await secondWearResponse.json();
    expect(errorData).toEqual({ error: 'Already logged a watch for this date' });

    // Verify only the first wear exists in the database
    const wearLogs = db.prepare('SELECT * FROM wear_log WHERE date = ?').all('2026-02-25');
    expect(wearLogs).toHaveLength(1);
    expect(wearLogs[0]).toMatchObject({
      watch_id: watch1.id,
      notes: 'First wear on this date'
    });

    // Verify the same watch CAN be logged on different dates
    const differentDateRequest = new NextRequest('http://localhost/api/wear-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        watch_id: watch1.id,
        date: '2026-02-26', // Different date
        notes: 'Same watch, different day'
      })
    });

    const differentDateResponse = await logWear(differentDateRequest);
    expect(differentDateResponse.status).toBe(200);

    // Verify both entries exist for the same watch
    const watch1Logs = db.prepare('SELECT * FROM wear_log WHERE watch_id = ? ORDER BY date').all(watch1.id);
    expect(watch1Logs).toHaveLength(2);
    expect(watch1Logs[0].date).toBe('2026-02-25');
    expect(watch1Logs[1].date).toBe('2026-02-26');
  });

  it('should handle many wears across different years', async () => {
    const db = getTestDb();

    // Create a watch
    const watchRequest = new NextRequest('http://localhost/api/watches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand: 'Rolex',
        model: 'Submariner',
        reference: '116610LN'
      })
    });
    const watchResponse = await createWatch(watchRequest);
    const watch = await watchResponse.json();

    // Log wears across multiple years
    const multiYearWears = [
      '2024-06-15',
      '2024-12-31', // End of 2024
      '2025-01-01', // Start of 2025
      '2025-06-15',
      '2025-12-25',
      '2026-01-01', // Start of 2026
      '2026-07-04',
      '2026-12-31'  // End of 2026
    ];

    for (let i = 0; i < multiYearWears.length; i++) {
      const date = multiYearWears[i];
      const wearRequest = new NextRequest('http://localhost/api/wear-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          watch_id: watch.id,
          date: date,
          notes: `Wear #${i + 1} on ${date}`
        })
      });

      const wearResponse = await logWear(wearRequest);
      expect(wearResponse.status).toBe(200);
    }

    // Verify total wear count
    const collectionResponse = await getCollection();
    const collectionData = await collectionResponse.json();
    
    expect(collectionData.owned[0]).toMatchObject({
      id: watch.id,
      wear_count: multiYearWears.length // All 8 wears
    });

    // Test year-specific queries
    const year2024Logs = db.prepare(`
      SELECT COUNT(*) as count FROM wear_log WHERE date LIKE ?
    `).get('2024-%');
    expect(year2024Logs.count).toBe(2);

    const year2025Logs = db.prepare(`
      SELECT COUNT(*) as count FROM wear_log WHERE date LIKE ?
    `).get('2025-%');
    expect(year2025Logs.count).toBe(3);

    const year2026Logs = db.prepare(`
      SELECT COUNT(*) as count FROM wear_log WHERE date LIKE ?
    `).get('2026-%');
    expect(year2026Logs.count).toBe(3);

    // Test specific month queries across years
    const january2025Logs = db.prepare(`
      SELECT * FROM wear_log WHERE date LIKE ?
    `).all('2025-01-%');
    expect(january2025Logs).toHaveLength(1);
    expect(january2025Logs[0].date).toBe('2025-01-01');

    const january2026Logs = db.prepare(`
      SELECT * FROM wear_log WHERE date LIKE ?
    `).all('2026-01-%');
    expect(january2026Logs).toHaveLength(1);
    expect(january2026Logs[0].date).toBe('2026-01-01');
  });

  it('should maintain correct wear counts with multiple watches', async () => {
    const db = getTestDb();

    // Create three watches
    const watches = [];
    for (let i = 1; i <= 3; i++) {
      const watchRequest = new NextRequest('http://localhost/api/watches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: `Brand${i}`,
          model: `Model${i}`,
          reference: `REF${i}`
        })
      });
      const watchResponse = await createWatch(watchRequest);
      watches.push(await watchResponse.json());
    }

    // Log different numbers of wears for each watch
    const wearPlans = [
      { watchIndex: 0, wearCount: 1, dates: ['2026-03-01'] },
      { watchIndex: 1, wearCount: 3, dates: ['2026-03-02', '2026-03-04', '2026-03-06'] },
      { watchIndex: 2, wearCount: 5, dates: ['2026-03-03', '2026-03-05', '2026-03-07', '2026-03-09', '2026-03-11'] }
    ];

    for (const { watchIndex, dates } of wearPlans) {
      for (const date of dates) {
        const wearRequest = new NextRequest('http://localhost/api/wear-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            watch_id: watches[watchIndex].id,
            date: date,
            notes: `Wear for ${watches[watchIndex].brand} on ${date}`
          })
        });

        const wearResponse = await logWear(wearRequest);
        expect(wearResponse.status).toBe(200);
      }
    }

    // Verify each watch has the correct wear count
    const collectionResponse = await getCollection();
    const collectionData = await collectionResponse.json();
    
    expect(collectionData.owned).toHaveLength(3);

    // Sort by brand to ensure consistent order
    const sortedWatches = collectionData.owned.sort((a, b) => a.brand.localeCompare(b.brand));

    expect(sortedWatches[0]).toMatchObject({
      brand: 'Brand1',
      wear_count: 1
    });

    expect(sortedWatches[1]).toMatchObject({
      brand: 'Brand2', 
      wear_count: 3
    });

    expect(sortedWatches[2]).toMatchObject({
      brand: 'Brand3',
      wear_count: 5
    });

    // Verify total wear count across all watches
    const totalWearLogs = db.prepare('SELECT COUNT(*) as count FROM wear_log').get();
    expect(totalWearLogs.count).toBe(1 + 3 + 5); // 9 total wears

    // Verify March 2026 contains all wear entries
    const marchLogs = db.prepare(`
      SELECT w.*, wl.id as wl_id, wl.date, wl.image_url as log_image, wl.notes
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date LIKE ?
      ORDER BY wl.date
    `).all('2026-03-%');

    expect(marchLogs).toHaveLength(9); // All 9 wears in March
    
    // Check that dates are unique (since each wear is on a different date)
    const uniqueDates = new Set(marchLogs.map(log => log.date));
    expect(uniqueDates.size).toBe(9); // All dates should be unique
  });

  it('should handle wear log deletions correctly (wear count updates)', async () => {
    const db = getTestDb();

    // Create a watch
    const watchRequest = new NextRequest('http://localhost/api/watches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand: 'Test', model: 'Deletion' })
    });
    const watchResponse = await createWatch(watchRequest);
    const watch = await watchResponse.json();

    // Log multiple wears
    const dates = ['2026-04-01', '2026-04-02', '2026-04-03'];
    for (const date of dates) {
      const wearRequest = new NextRequest('http://localhost/api/wear-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          watch_id: watch.id,
          date: date,
          notes: `Wear on ${date}`
        })
      });
      await logWear(wearRequest);
    }

    // Verify initial wear count
    let collectionResponse = await getCollection();
    let collectionData = await collectionResponse.json();
    expect(collectionData.owned[0].wear_count).toBe(3);

    // Manually delete one wear log (simulating deletion functionality)
    db.prepare('DELETE FROM wear_log WHERE date = ?').run('2026-04-02');

    // Verify updated wear count
    collectionResponse = await getCollection();
    collectionData = await collectionResponse.json();
    expect(collectionData.owned[0].wear_count).toBe(2);

    // Verify the remaining wears are correct
    const remainingLogs = db.prepare('SELECT date FROM wear_log WHERE watch_id = ? ORDER BY date').all(watch.id);
    expect(remainingLogs).toHaveLength(2);
    expect(remainingLogs[0].date).toBe('2026-04-01');
    expect(remainingLogs[1].date).toBe('2026-04-03');
  });

  it('should handle edge case of same watch worn on consecutive days', async () => {
    const db = getTestDb();

    // Create a watch
    const watchRequest = new NextRequest('http://localhost/api/watches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand: 'Consecutive', model: 'Days' })
    });
    const watchResponse = await createWatch(watchRequest);
    const watch = await watchResponse.json();

    // Log the same watch on consecutive days
    const consecutiveDates = [
      '2026-05-01',
      '2026-05-02',
      '2026-05-03',
      '2026-05-04',
      '2026-05-05'
    ];

    for (const date of consecutiveDates) {
      const wearRequest = new NextRequest('http://localhost/api/wear-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          watch_id: watch.id,
          date: date,
          notes: `Consecutive wear on ${date}`
        })
      });

      const wearResponse = await logWear(wearRequest);
      expect(wearResponse.status).toBe(200);
    }

    // Verify all consecutive wears were logged
    const mayLogs = db.prepare(`
      SELECT w.*, wl.id as wl_id, wl.date, wl.image_url as log_image, wl.notes
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date LIKE ?
      ORDER BY wl.date
    `).all('2026-05-%');

    expect(mayLogs).toHaveLength(5);
    
    // Verify they are all for the same watch
    mayLogs.forEach(log => {
      expect(log.brand).toBe('Consecutive');
      expect(log.model).toBe('Days');
    });

    // Verify dates are consecutive
    for (let i = 0; i < mayLogs.length; i++) {
      expect(mayLogs[i].date).toBe(consecutiveDates[i]);
    }

    // Verify total wear count
    const collectionResponse = await getCollection();
    const collectionData = await collectionResponse.json();
    expect(collectionData.owned[0].wear_count).toBe(5);
  });
});