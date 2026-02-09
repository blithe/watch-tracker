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

describe('Integration: Daily Wear Logging Journey', () => {
  beforeEach(() => {
    resetTestDb();
  });

  afterAll(() => {
    closeTestDb();
  });

  it('should complete the full daily wear logging flow', async () => {
    const db = getTestDb();

    // Step 1: Add a watch to the collection
    const watchData = {
      brand: 'Omega',
      model: 'Speedmaster',
      reference: '311.30.42.30.01.005'
    };

    const createWatchRequest = new NextRequest('http://localhost/api/watches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(watchData)
    });

    const createWatchResponse = await createWatch(createWatchRequest);
    expect(createWatchResponse.status).toBe(200);
    
    const createdWatch = await createWatchResponse.json();
    expect(createdWatch).toMatchObject({
      id: expect.any(Number),
      brand: 'Omega',
      model: 'Speedmaster',
      reference: '311.30.42.30.01.005'
    });

    // Step 2: Log wearing it on a specific date
    const wearDate = '2026-02-15';
    const wearData = {
      watch_id: createdWatch.id,
      date: wearDate,
      notes: 'Great wear for the day!'
    };

    const logWearRequest = new NextRequest('http://localhost/api/wear-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(wearData)
    });

    const logWearResponse = await logWear(logWearRequest);
    expect(logWearResponse.status).toBe(200);
    
    const logResult = await logWearResponse.json();
    expect(logResult).toEqual({ ok: true });

    // Step 3: Verify it appears in the calendar month query (simulate page.tsx query)
    const logs = db.prepare(`
      SELECT w.*, wl.id as wl_id, wl.date, wl.image_url as log_image, wl.notes
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date LIKE ?
      ORDER BY wl.date
    `).all('2026-02-%');

    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      brand: 'Omega',
      model: 'Speedmaster',
      reference: '311.30.42.30.01.005',
      date: wearDate,
      notes: 'Great wear for the day!'
    });

    // Step 4: Verify the day detail query returns the correct watch + image (simulate day/[date]/page.tsx query)
    const dayLog = db.prepare(`
      SELECT wl.*, w.brand, w.model, w.reference, w.image_url as watch_image
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date = ?
    `).get(wearDate);

    expect(dayLog).toMatchObject({
      date: wearDate,
      notes: 'Great wear for the day!',
      brand: 'Omega',
      model: 'Speedmaster',
      reference: '311.30.42.30.01.005',
      image_url: null, // No wear image uploaded
      watch_image: null // No watch image set
    });

    // Step 5: Verify stats reflect the new wear (collection API includes wear count)
    const collectionResponse = await getCollection();
    expect(collectionResponse.status).toBe(200);
    
    const collectionData = await collectionResponse.json();
    
    // Check the owned watches include our watch with correct wear count
    expect(collectionData.owned).toHaveLength(1);
    expect(collectionData.owned[0]).toMatchObject({
      id: createdWatch.id,
      brand: 'Omega',
      model: 'Speedmaster',
      reference: '311.30.42.30.01.005',
      wear_count: 1,
      status: 'owned'
    });

    // Check stats
    expect(collectionData.stats).toMatchObject({
      totalWatches: 1,
      ownedCount: 1,
      soldCount: 0
    });
  });

  it('should handle wear logging with an image', async () => {
    const db = getTestDb();

    // Create a watch first
    const createWatchRequest = new NextRequest('http://localhost/api/watches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand: 'Rolex',
        model: 'Submariner',
        reference: '116610LN'
      })
    });

    const createWatchResponse = await createWatch(createWatchRequest);
    const createdWatch = await createWatchResponse.json();

    // Log wear with image
    const wearDate = '2026-02-16';
    const imageUrl = '/uploads/test-wear-123.jpg';
    const wearData = {
      watch_id: createdWatch.id,
      date: wearDate,
      image_url: imageUrl,
      notes: 'Wore to dinner'
    };

    const logWearRequest = new NextRequest('http://localhost/api/wear-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(wearData)
    });

    const logWearResponse = await logWear(logWearRequest);
    expect(logWearResponse.status).toBe(200);

    // Verify the day detail query returns the correct image
    const dayLog = db.prepare(`
      SELECT wl.*, w.brand, w.model, w.reference, w.image_url as watch_image
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date = ?
    `).get(wearDate);

    expect(dayLog).toMatchObject({
      date: wearDate,
      image_url: imageUrl, // This is the wear-specific image
      notes: 'Wore to dinner',
      brand: 'Rolex',
      model: 'Submariner'
    });

    // Verify calendar query includes the image
    const logs = db.prepare(`
      SELECT w.*, wl.id as wl_id, wl.date, wl.image_url as log_image, wl.notes
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date LIKE ?
      ORDER BY wl.date
    `).all('2026-02-%');

    expect(logs[0]).toMatchObject({
      log_image: imageUrl,
      date: wearDate
    });
  });

  it('should enforce the unique date constraint (one wear per day)', async () => {
    const db = getTestDb();

    // Create two watches
    const watch1Request = new NextRequest('http://localhost/api/watches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand: 'Brand1', model: 'Model1' })
    });
    const watch1Response = await createWatch(watch1Request);
    const watch1 = await watch1Response.json();

    const watch2Request = new NextRequest('http://localhost/api/watches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand: 'Brand2', model: 'Model2' })
    });
    const watch2Response = await createWatch(watch2Request);
    const watch2 = await watch2Response.json();

    // Log the first watch
    const wearDate = '2026-02-17';
    const logWear1Request = new NextRequest('http://localhost/api/wear-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        watch_id: watch1.id,
        date: wearDate,
        notes: 'First wear'
      })
    });

    const logWear1Response = await logWear(logWear1Request);
    expect(logWear1Response.status).toBe(200);

    // Try to log a second watch on the same date - should fail
    const logWear2Request = new NextRequest('http://localhost/api/wear-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        watch_id: watch2.id,
        date: wearDate, // Same date!
        notes: 'Second wear'
      })
    });

    const logWear2Response = await logWear(logWear2Request);
    expect(logWear2Response.status).toBe(400);
    
    const errorData = await logWear2Response.json();
    expect(errorData).toEqual({ error: 'Already logged a watch for this date' });

    // Verify only the first wear exists in the database
    const logs = db.prepare('SELECT * FROM wear_log WHERE date = ?').all(wearDate);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      watch_id: watch1.id,
      notes: 'First wear'
    });
  });
});