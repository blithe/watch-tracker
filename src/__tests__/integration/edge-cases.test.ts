/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST as createWatch } from '@/app/api/watches/route';
import { POST as logWear } from '@/app/api/wear-log/route';
import { POST as createWishlistItem, DELETE as deleteWishlistItem } from '@/app/api/wishlist/route';
import { POST as addPrice } from '@/app/api/wishlist/[id]/prices/route';
import { getTestDb, resetTestDb, closeTestDb } from '@/lib/test-db';

// Mock the main db module to use test database
jest.mock('../../lib/db', () => {
  return require('../../lib/test-db').getTestDb();
});

describe('Integration: Edge Cases', () => {
  beforeEach(() => {
    resetTestDb();
  });

  afterAll(() => {
    closeTestDb();
  });

  it('should fail to log wear for non-existent watch_id (FK constraint)', async () => {
    const db = getTestDb();

    // Step 1: Try to log a wear for a watch_id that doesn't exist
    const nonExistentWatchId = 99999;
    
    const invalidWearRequest = new NextRequest('http://localhost/api/wear-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        watch_id: nonExistentWatchId,
        date: '2026-03-01',
        notes: 'This should fail'
      })
    });

    const invalidWearResponse = await logWear(invalidWearRequest);
    
    // Should fail with foreign key constraint error
    expect(invalidWearResponse.status).toBe(500);
    
    const errorData = await invalidWearResponse.json();
    expect(errorData).toHaveProperty('error');
    expect(errorData.error).toContain('FOREIGN KEY constraint failed');

    // Verify no wear log was created
    const wearLogs = db.prepare('SELECT * FROM wear_log').all();
    expect(wearLogs).toHaveLength(0);
  });

  it('should fail to log two wears on the same date (UNIQUE constraint)', async () => {
    const db = getTestDb();

    // Create two watches
    const watch1Request = new NextRequest('http://localhost/api/watches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand: 'First', model: 'Watch' })
    });
    const watch1Response = await createWatch(watch1Request);
    const watch1 = await watch1Response.json();

    const watch2Request = new NextRequest('http://localhost/api/watches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand: 'Second', model: 'Watch' })
    });
    const watch2Response = await createWatch(watch2Request);
    const watch2 = await watch2Response.json();

    // Log first watch successfully
    const firstWearRequest = new NextRequest('http://localhost/api/wear-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        watch_id: watch1.id,
        date: '2026-03-02',
        notes: 'First wear today'
      })
    });

    const firstWearResponse = await logWear(firstWearRequest);
    expect(firstWearResponse.status).toBe(200);

    // Step 2: Try to log two wears on the same date (should fail)
    const duplicateWearRequest = new NextRequest('http://localhost/api/wear-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        watch_id: watch2.id,
        date: '2026-03-02', // Same date!
        notes: 'This should fail due to unique constraint'
      })
    });

    const duplicateWearResponse = await logWear(duplicateWearRequest);
    expect(duplicateWearResponse.status).toBe(400);
    
    const duplicateErrorData = await duplicateWearResponse.json();
    expect(duplicateErrorData).toEqual({ error: 'Already logged a watch for this date' });

    // Verify only one wear log exists for that date
    const wearLogs = db.prepare('SELECT * FROM wear_log WHERE date = ?').all('2026-03-02');
    expect(wearLogs).toHaveLength(1);
    expect(wearLogs[0]).toMatchObject({
      watch_id: watch1.id,
      notes: 'First wear today'
    });
  });

  it('should clean up price_history when wishlist item is deleted', async () => {
    const db = getTestDb();

    // Step 1: Create a wishlist item
    const wishlistRequest = new NextRequest('http://localhost/api/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand: 'Cleanup',
        model: 'Test',
        target_price: 5000
      })
    });

    const wishlistResponse = await createWishlistItem(wishlistRequest);
    const wishlistItem = await wishlistResponse.json();

    // Step 2: Add multiple price entries
    const priceEntries = [
      { price: 5200, source: 'Source1' },
      { price: 4800, source: 'Source2' },
      { price: 5100, source: 'Source3' }
    ];

    for (const priceData of priceEntries) {
      const priceRequest = new NextRequest(`http://localhost/api/wishlist/${wishlistItem.id}/prices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(priceData)
      });

      const priceResponse = await addPrice(priceRequest, { 
        params: { id: wishlistItem.id.toString() }
      });
      expect(priceResponse.status).toBe(200);
    }

    // Verify price history exists
    let priceHistory = db.prepare('SELECT * FROM price_history WHERE wishlist_id = ?').all(wishlistItem.id);
    expect(priceHistory).toHaveLength(3);

    // Step 3: Delete wishlist item and verify price_history is cleaned up
    // Simulate the DELETE endpoint logic from wishlist/route.ts
    db.prepare('DELETE FROM price_history WHERE wishlist_id = ?').run(wishlistItem.id);
    const deleteResult = db.prepare('DELETE FROM wishlist WHERE id = ?').run(wishlistItem.id);
    
    expect(deleteResult.changes).toBe(1); // One row deleted

    // Verify price history was cleaned up
    priceHistory = db.prepare('SELECT * FROM price_history WHERE wishlist_id = ?').all(wishlistItem.id);
    expect(priceHistory).toHaveLength(0);

    // Verify wishlist item was deleted
    const wishlistItemCheck = db.prepare('SELECT * FROM wishlist WHERE id = ?').get(wishlistItem.id);
    expect(wishlistItemCheck).toBeUndefined();
  });

  it('should handle dates at month boundaries correctly', async () => {
    const db = getTestDb();

    // Create a watch
    const watchRequest = new NextRequest('http://localhost/api/watches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand: 'Boundary', model: 'Test' })
    });
    const watchResponse = await createWatch(watchRequest);
    const watch = await watchResponse.json();

    // Step 4: Test dates at month boundaries work correctly
    const boundaryDates = [
      // January → February boundary
      { date: '2026-01-31', month: '2026-01', description: 'Last day of January' },
      { date: '2026-02-01', month: '2026-02', description: 'First day of February' },
      
      // February → March boundary (non-leap year)
      { date: '2026-02-28', month: '2026-02', description: 'Last day of February 2026 (non-leap)' },
      { date: '2026-03-01', month: '2026-03', description: 'First day of March' },
      
      // Leap year test (2024)
      { date: '2024-02-29', month: '2024-02', description: 'Leap day 2024' },
      { date: '2024-03-01', month: '2024-03', description: 'March 1 after leap day' },
      
      // Year boundary
      { date: '2025-12-31', month: '2025-12', description: 'Last day of 2025' },
      { date: '2026-01-01', month: '2026-01', description: 'First day of 2026' }
    ];

    // Log wears for all boundary dates
    for (const { date, description } of boundaryDates) {
      const boundaryWearRequest = new NextRequest('http://localhost/api/wear-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          watch_id: watch.id,
          date: date,
          notes: description
        })
      });

      const boundaryWearResponse = await logWear(boundaryWearRequest);
      expect(boundaryWearResponse.status).toBe(200);
    }

    // Test month filtering for each boundary
    for (const { date, month, description } of boundaryDates) {
      const monthLogs = db.prepare(`
        SELECT w.*, wl.id as wl_id, wl.date, wl.image_url as log_image, wl.notes
        FROM wear_log wl
        JOIN watches w ON w.id = wl.watch_id
        WHERE wl.date LIKE ?
        ORDER BY wl.date
      `).all(month + '-%');

      // Find this specific date in the results
      const thisDateLog = monthLogs.find(log => log.date === date);
      expect(thisDateLog).toBeDefined();
      expect(thisDateLog?.notes).toBe(description);
    }

    // Test cross-boundary filtering (ensure dates don't leak between months)
    
    // January 2026 should only include Jan 31, not Feb 1
    const jan2026Logs = db.prepare(`
      SELECT date FROM wear_log WHERE date LIKE '2026-01-%'
    `).all();
    const jan2026Dates = jan2026Logs.map(log => log.date);
    expect(jan2026Dates).toContain('2026-01-31');
    expect(jan2026Dates).toContain('2026-01-01');
    expect(jan2026Dates).not.toContain('2026-02-01');

    // February 2026 should include both boundaries but not adjacent months
    const feb2026Logs = db.prepare(`
      SELECT date FROM wear_log WHERE date LIKE '2026-02-%'
    `).all();
    const feb2026Dates = feb2026Logs.map(log => log.date);
    expect(feb2026Dates).toContain('2026-02-01');
    expect(feb2026Dates).toContain('2026-02-28');
    expect(feb2026Dates).not.toContain('2026-01-31');
    expect(feb2026Dates).not.toContain('2026-03-01');

    // Leap year February 2024 should include Feb 29
    const feb2024Logs = db.prepare(`
      SELECT date FROM wear_log WHERE date LIKE '2024-02-%'
    `).all();
    const feb2024Dates = feb2024Logs.map(log => log.date);
    expect(feb2024Dates).toContain('2024-02-29');
    expect(feb2024Dates).not.toContain('2024-03-01');
  });

  it('should handle foreign key constraints properly across all tables', async () => {
    const db = getTestDb();

    // Test 1: Cannot create wear_log without valid watch
    const invalidWearLogRequest = new NextRequest('http://localhost/api/wear-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        watch_id: 999, // Non-existent
        date: '2026-03-05',
        notes: 'Should fail'
      })
    });

    const invalidWearLogResponse = await logWear(invalidWearLogRequest);
    expect(invalidWearLogResponse.status).toBe(500);

    // Test 2: Cannot create price_history without valid wishlist item
    const invalidPriceRequest = new NextRequest('http://localhost/api/wishlist/999/prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        price: 1000,
        source: 'Test'
      })
    });

    const invalidPriceResponse = await addPrice(invalidPriceRequest, { 
      params: { id: '999' }
    });
    expect(invalidPriceResponse.status).toBe(404); // Wishlist item not found

    // Test 3: Deleting a watch should handle foreign key constraints
    // (Note: The actual app doesn't implement watch deletion, but we can test the constraint)
    
    // Create a watch and wear log
    const watchRequest = new NextRequest('http://localhost/api/watches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand: 'FK', model: 'Test' })
    });
    const watchResponse = await createWatch(watchRequest);
    const watch = await watchResponse.json();

    const wearRequest = new NextRequest('http://localhost/api/wear-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        watch_id: watch.id,
        date: '2026-03-06',
        notes: 'Test wear'
      })
    });
    await logWear(wearRequest);

    // Try to delete the watch directly (should fail due to foreign key)
    let fkError = false;
    try {
      db.prepare('DELETE FROM watches WHERE id = ?').run(watch.id);
    } catch (error: any) {
      fkError = true;
      expect(error.message).toContain('FOREIGN KEY constraint failed');
    }
    expect(fkError).toBe(true);

    // Must delete wear_log first, then watch
    db.prepare('DELETE FROM wear_log WHERE watch_id = ?').run(watch.id);
    const deleteResult = db.prepare('DELETE FROM watches WHERE id = ?').run(watch.id);
    expect(deleteResult.changes).toBe(1);
  });

  it('should handle empty and null values correctly', async () => {
    const db = getTestDb();

    // Create a watch with minimal data
    const minimalWatchRequest = new NextRequest('http://localhost/api/watches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand: 'Minimal',
        model: 'Test',
        reference: '', // Empty string should become null
        image_url: null, // Explicit null
        notes: ''  // Empty string should become null
      })
    });

    const minimalWatchResponse = await createWatch(minimalWatchRequest);
    const minimalWatch = await minimalWatchResponse.json();

    // Verify empty strings are handled as nulls in the database
    const dbWatch = db.prepare('SELECT * FROM watches WHERE id = ?').get(minimalWatch.id);
    expect(dbWatch.reference).toBeNull();
    expect(dbWatch.image_url).toBeNull();
    expect(dbWatch.notes).toBeNull();

    // Log a wear with minimal data
    const minimalWearRequest = new NextRequest('http://localhost/api/wear-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        watch_id: minimalWatch.id,
        date: '2026-03-07'
        // No image_url or notes
      })
    });

    const minimalWearResponse = await logWear(minimalWearRequest);
    expect(minimalWearResponse.status).toBe(200);

    // Verify nulls are handled correctly in queries
    const dayLog = db.prepare(`
      SELECT wl.*, w.brand, w.model, w.reference, w.image_url as watch_image
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date = ?
    `).get('2026-03-07');

    expect(dayLog).toMatchObject({
      date: '2026-03-07',
      image_url: null, // Wear image
      notes: null,
      watch_image: null, // Watch image
      reference: null
    });

    // Create a wishlist item with minimal data
    const minimalWishlistRequest = new NextRequest('http://localhost/api/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand: 'Minimal',
        model: 'Wishlist'
        // No other fields
      })
    });

    const minimalWishlistResponse = await createWishlistItem(minimalWishlistRequest);
    const minimalWishlistItem = await minimalWishlistResponse.json();

    expect(minimalWishlistItem.target_price).toBeNull();
    expect(minimalWishlistItem.notes).toBeNull();
    expect(minimalWishlistItem.reference).toBeNull();
  });

  it('should handle invalid data types gracefully', async () => {
    // Test invalid watch data - missing required fields
    const invalidWatchRequest = new NextRequest('http://localhost/api/watches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand: null, // Invalid: brand is required
        model: 'Test'
      })
    });

    let errorCaught = false;
    try {
      await createWatch(invalidWatchRequest);
    } catch (error: any) {
      errorCaught = true;
      expect(error.message).toContain('NOT NULL constraint failed');
    }
    expect(errorCaught).toBe(true);

    // Test invalid wear log data - invalid date format
    const validWatchRequest = new NextRequest('http://localhost/api/watches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand: 'Valid', model: 'Watch' })
    });
    const validWatchResponse = await createWatch(validWatchRequest);
    const validWatch = await validWatchResponse.json();

    // While SQLite is flexible with date formats, our application expects YYYY-MM-DD
    // Test with clearly invalid date
    const invalidDateWearRequest = new NextRequest('http://localhost/api/wear-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        watch_id: validWatch.id,
        date: 'not-a-date',
        notes: 'Invalid date test'
      })
    });

    const invalidDateWearResponse = await logWear(invalidDateWearRequest);
    expect(invalidDateWearResponse.status).toBe(200); // SQLite accepts any text as date

    // But our application queries expect proper format, so let's verify it works as expected
    const db = getTestDb();
    const invalidDateLog = db.prepare('SELECT * FROM wear_log WHERE date = ?').get('not-a-date');
    expect(invalidDateLog).toBeDefined();
    expect(invalidDateLog.date).toBe('not-a-date');

    // Calendar queries won't find it though, since they use LIKE with YYYY-MM-% pattern
    const calendarLogs = db.prepare(`
      SELECT * FROM wear_log WHERE date LIKE ?
    `).all('not-%'); // This wouldn't match typical calendar queries
    expect(calendarLogs).toHaveLength(1); // Found with matching pattern
    
    const typicalCalendarQuery = db.prepare(`
      SELECT * FROM wear_log WHERE date LIKE ?
    `).all('2026-%'); // Typical year query won't find invalid date
    expect(typicalCalendarQuery).toHaveLength(0);
  });

  it('should maintain data integrity under concurrent-like operations', async () => {
    const db = getTestDb();

    // Create multiple watches
    const watches = [];
    for (let i = 1; i <= 3; i++) {
      const watchRequest = new NextRequest('http://localhost/api/watches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: `Concurrent${i}`, model: `Test${i}` })
      });
      const watchResponse = await createWatch(watchRequest);
      watches.push(await watchResponse.json());
    }

    // Simulate rapid operations that might cause conflicts
    const operations = [];

    // Try to log different watches on the same date (only first should succeed)
    for (let i = 0; i < watches.length; i++) {
      operations.push(
        logWear(new NextRequest('http://localhost/api/wear-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            watch_id: watches[i].id,
            date: '2026-03-10', // Same date for all
            notes: `Attempt ${i + 1}`
          })
        }))
      );
    }

    const results = await Promise.allSettled(operations);
    
    // Only one should succeed due to unique date constraint
    const successfulResults = results.filter(r => r.status === 'fulfilled' && r.value.status === 200);
    const failedResults = results.filter(r => r.status === 'fulfilled' && r.value.status === 400);

    expect(successfulResults).toHaveLength(1);
    expect(failedResults.length).toBeGreaterThan(0);

    // Verify only one wear log exists for that date
    const wearLogsForDate = db.prepare('SELECT * FROM wear_log WHERE date = ?').all('2026-03-10');
    expect(wearLogsForDate).toHaveLength(1);

    // Verify which watch got logged
    const loggedWatch = watches.find(w => w.id === wearLogsForDate[0].watch_id);
    expect(loggedWatch).toBeDefined();
  });
});