/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST as createWatch } from '@/app/api/watches/route';
import { PATCH as updateWatch } from '@/app/api/watches/[id]/route';
import { GET as getCollection } from '@/app/api/collection/route';
import { POST as logWear } from '@/app/api/wear-log/route';
import { getTestDb, resetTestDb, closeTestDb } from '@/lib/test-db';

// Mock the main db module to use test database
jest.mock('../../lib/db', () => {
  return require('../../lib/test-db').getTestDb();
});

describe('Integration: Collection Management Journey', () => {
  beforeEach(() => {
    resetTestDb();
  });

  afterAll(() => {
    closeTestDb();
  });

  it('should complete the full collection management flow', async () => {
    const db = getTestDb();

    // Step 1: Add a watch with purchase date and price
    const basicWatchData = {
      brand: 'Rolex',
      model: 'GMT-Master II',
      reference: '126710BLRO'
    };

    const createWatchRequest = new NextRequest('http://localhost/api/watches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(basicWatchData)
    });

    const createWatchResponse = await createWatch(createWatchRequest);
    expect(createWatchResponse.status).toBe(200);
    
    const createdWatch = await createWatchResponse.json();
    expect(createdWatch).toMatchObject({
      id: expect.any(Number),
      brand: 'Rolex',
      model: 'GMT-Master II',
      reference: '126710BLRO'
    });

    // Update with purchase details
    const purchaseUpdateRequest = new NextRequest(`http://localhost/api/watches/${createdWatch.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        purchase_date: '2024-06-15',
        purchase_price: 15000
      })
    });

    await updateWatch(purchaseUpdateRequest, { params: { id: createdWatch.id.toString() }});

    // Step 2: Verify it appears in collection as "owned"
    let collectionResponse = await getCollection();
    expect(collectionResponse.status).toBe(200);
    
    let collectionData = await collectionResponse.json();
    expect(collectionData.owned).toHaveLength(1);
    expect(collectionData.sold).toHaveLength(0);
    
    const ownedWatch = collectionData.owned[0];
    expect(ownedWatch).toMatchObject({
      id: createdWatch.id,
      brand: 'Rolex',
      model: 'GMT-Master II',
      reference: '126710BLRO',
      status: 'owned',
      wear_count: 0 // No wears yet
    });

    // Step 3: Edit the watch details
    const updateData = {
      notes: 'Purchased from AD in Switzerland',
      image_url: '/uploads/rolex-gmt-123.jpg'
    };

    const updateWatchRequest = new NextRequest(`http://localhost/api/watches/${createdWatch.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });

    const updateWatchResponse = await updateWatch(updateWatchRequest, { 
      params: { id: createdWatch.id.toString() }
    });
    expect(updateWatchResponse.status).toBe(200);

    const updatedWatch = await updateWatchResponse.json();
    expect(updatedWatch).toMatchObject({
      id: createdWatch.id,
      notes: 'Purchased from AD in Switzerland',
      image_url: '/uploads/rolex-gmt-123.jpg',
      brand: 'Rolex',
      model: 'GMT-Master II'
    });

    // Step 4: Mark it as sold with sold_date and sold_price
    const soldData = {
      sold_date: '2026-01-15',
      sold_price: 18500,
      status: 'sold'
    };

    const soldWatchRequest = new NextRequest(`http://localhost/api/watches/${createdWatch.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(soldData)
    });

    const soldWatchResponse = await updateWatch(soldWatchRequest, { 
      params: { id: createdWatch.id.toString() }
    });
    expect(soldWatchResponse.status).toBe(200);

    const soldWatch = await soldWatchResponse.json();
    expect(soldWatch).toMatchObject({
      sold_date: '2026-01-15',
      sold_price: 18500,
      status: 'sold'
    });

    // Step 5: Verify it moves to "sold" section
    collectionResponse = await getCollection();
    collectionData = await collectionResponse.json();
    
    expect(collectionData.owned).toHaveLength(0); // No longer in owned
    expect(collectionData.sold).toHaveLength(1); // Now in sold
    
    const soldWatchInCollection = collectionData.sold[0];
    expect(soldWatchInCollection.status).toBe('sold');

    // Step 6: Verify profit/loss calculation is correct
    expect(soldWatchInCollection.profit_loss).toBe(3500); // 18500 - 15000
    
    // Calculate days owned: from 2024-06-15 to 2026-01-15
    const purchaseDate = new Date('2024-06-15');
    const soldDate = new Date('2026-01-15');
    const expectedDaysOwned = Math.ceil((soldDate.getTime() - purchaseDate.getTime()) / (1000 * 3600 * 24));
    expect(soldWatchInCollection.days_owned).toBe(expectedDaysOwned);

    // Step 7: Verify collection summary stats update
    expect(collectionData.stats).toMatchObject({
      totalWatches: 1,
      ownedCount: 0, // No owned watches
      soldCount: 1, // One sold watch
      totalCollectionValue: 0, // No current collection value (all sold)
      totalInvested: 15000, // Total ever invested
      totalSoldFor: 18500, // Total sold for
      overallProfitLoss: 3500 // Overall profit
    });
  });

  it('should handle multiple watches with different statuses', async () => {
    // Add three watches: one owned, one sold at profit, one sold at loss
    
    // Watch 1: Currently owned
    const watch1Request = new NextRequest('http://localhost/api/watches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand: 'Omega',
        model: 'Speedmaster',
        reference: '311.30.42.30.01.005'
      })
    });

    const watch1Response = await createWatch(watch1Request);
    const watch1 = await watch1Response.json();

    // Update with purchase details
    await updateWatch(new NextRequest(`http://localhost/api/watches/${watch1.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        purchase_date: '2025-01-01',
        purchase_price: 6000
      })
    }), { params: { id: watch1.id.toString() }});

    // Watch 2: Sold at profit
    const watch2Request = new NextRequest('http://localhost/api/watches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand: 'Rolex',
        model: 'Submariner',
        reference: '116610LN'
      })
    });

    const watch2Response = await createWatch(watch2Request);
    const watch2 = await watch2Response.json();

    // Update with purchase details
    await updateWatch(new NextRequest(`http://localhost/api/watches/${watch2.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        purchase_date: '2023-05-01',
        purchase_price: 12000
      })
    }), { params: { id: watch2.id.toString() }});

    // Sell watch2 for profit
    const sellWatch2Request = new NextRequest(`http://localhost/api/watches/${watch2.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sold_date: '2025-12-01',
        sold_price: 15000,
        status: 'sold'
      })
    });

    await updateWatch(sellWatch2Request, { params: { id: watch2.id.toString() }});

    // Watch 3: Sold at loss
    const watch3Request = new NextRequest('http://localhost/api/watches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand: 'Tudor',
        model: 'Black Bay',
        reference: '79030N'
      })
    });

    const watch3Response = await createWatch(watch3Request);
    const watch3 = await watch3Response.json();

    // Update with purchase details
    await updateWatch(new NextRequest(`http://localhost/api/watches/${watch3.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        purchase_date: '2024-01-01',
        purchase_price: 3500
      })
    }), { params: { id: watch3.id.toString() }});

    // Sell watch3 for loss
    const sellWatch3Request = new NextRequest(`http://localhost/api/watches/${watch3.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sold_date: '2025-11-01',
        sold_price: 2800,
        status: 'sold'
      })
    });

    await updateWatch(sellWatch3Request, { params: { id: watch3.id.toString() }});

    // Check collection stats
    const collectionResponse = await getCollection();
    const collectionData = await collectionResponse.json();

    expect(collectionData.owned).toHaveLength(1); // Only watch1
    expect(collectionData.sold).toHaveLength(2); // watch2 and watch3

    // Check owned watch
    expect(collectionData.owned[0]).toMatchObject({
      id: watch1.id,
      brand: 'Omega',
      status: 'owned'
    });

    // Check sold watches and their P&L
    const soldWatches = collectionData.sold;
    const soldWatch2 = soldWatches.find(w => w.id === watch2.id);
    const soldWatch3 = soldWatches.find(w => w.id === watch3.id);

    expect(soldWatch2?.profit_loss).toBe(3000); // 15000 - 12000
    expect(soldWatch3?.profit_loss).toBe(-700); // 2800 - 3500

    // Check overall stats
    expect(collectionData.stats).toMatchObject({
      totalWatches: 3,
      ownedCount: 1,
      soldCount: 2,
      totalCollectionValue: 6000, // Only watch1 current value
      totalInvested: 21500, // 6000 + 12000 + 3500
      totalSoldFor: 17800, // 15000 + 2800
      overallProfitLoss: 2300 // 3000 + (-700)
    });
  });

  it('should handle watches without purchase/sold prices correctly', async () => {
    // Add a watch without purchase price
    const watchRequest = new NextRequest('http://localhost/api/watches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand: 'Casio',
        model: 'F-91W',
        reference: 'F-91W-1DG'
        // No purchase price/date
      })
    });

    const watchResponse = await createWatch(watchRequest);
    const watch = await watchResponse.json();

    // Mark as sold without prices
    const soldRequest = new NextRequest(`http://localhost/api/watches/${watch.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'sold',
        sold_date: '2026-02-01'
        // No sold price
      })
    });

    await updateWatch(soldRequest, { params: { id: watch.id.toString() }});

    // Check collection - should handle null values gracefully
    const collectionResponse = await getCollection();
    const collectionData = await collectionResponse.json();

    expect(collectionData.sold).toHaveLength(1);
    const soldWatch = collectionData.sold[0];
    
    expect(soldWatch.profit_loss ?? null).toBeNull(); // Can't calculate without prices
    expect(soldWatch.purchase_price ?? null).toBeNull();
    expect(soldWatch.sold_price ?? null).toBeNull();

    // Stats should handle null values
    expect(collectionData.stats).toMatchObject({
      totalCollectionValue: 0,
      totalInvested: 0, // No purchase prices to sum
      totalSoldFor: 0, // No sold prices to sum
      overallProfitLoss: 0 // No P&L to calculate
    });
  });

  it('should allow editing all watch fields', async () => {
    // Create a basic watch
    const createRequest = new NextRequest('http://localhost/api/watches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand: 'Seiko',
        model: 'SKX007'
      })
    });

    const createResponse = await createWatch(createRequest);
    const watch = await createResponse.json();

    // Update all possible fields
    const updateData = {
      brand: 'Grand Seiko',
      model: 'SBGW289',
      reference: 'SBGW289',
      image_url: '/uploads/gs-123.jpg',
      purchase_date: '2024-03-15',
      purchase_price: 8500,
      notes: 'Heritage Collection piece',
      status: 'owned'
    };

    const updateRequest = new NextRequest(`http://localhost/api/watches/${watch.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });

    const updateResponse = await updateWatch(updateRequest, { 
      params: { id: watch.id.toString() }
    });

    expect(updateResponse.status).toBe(200);
    const updatedWatch = await updateResponse.json();

    expect(updatedWatch).toMatchObject({
      id: watch.id,
      brand: 'Grand Seiko',
      model: 'SBGW289',
      reference: 'SBGW289',
      image_url: '/uploads/gs-123.jpg',
      purchase_date: '2024-03-15',
      purchase_price: 8500,
      notes: 'Heritage Collection piece',
      status: 'owned'
    });

    // Verify in database
    const db = getTestDb();
    const dbWatch = db.prepare('SELECT * FROM watches WHERE id = ?').get(watch.id);
    expect(dbWatch).toMatchObject(updateData);
  });

  it('should use first wear log photo as fallback when watch has no image_url', async () => {
    const createResponse = await createWatch(new NextRequest('http://localhost/api/watches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand: 'Seiko', model: 'SKX007' })
    }));
    const watch = await createResponse.json();

    // Log two wears with photos — earliest should win
    await logWear(new NextRequest('http://localhost/api/wear-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ watch_id: watch.id, date: '2025-01-10', image_url: '/uploads/first.jpg' })
    }));
    await logWear(new NextRequest('http://localhost/api/wear-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ watch_id: watch.id, date: '2025-02-15', image_url: '/uploads/second.jpg' })
    }));

    const collectionData = await (await getCollection()).json();
    const collectionWatch = collectionData.owned.find((w: any) => w.id === watch.id);

    // Should show the first (earliest) wear log photo
    expect(collectionWatch.image_url).toBe('/uploads/first.jpg');
  });

  it('should prefer watch image_url over wear log photo fallback', async () => {
    const createResponse = await createWatch(new NextRequest('http://localhost/api/watches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand: 'Omega', model: 'Seamaster' })
    }));
    const watch = await createResponse.json();

    // Set a dedicated watch photo
    await updateWatch(new NextRequest(`http://localhost/api/watches/${watch.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: '/uploads/watch-photo.jpg' })
    }), { params: { id: watch.id.toString() } });

    // Log a wear with a different photo
    await logWear(new NextRequest('http://localhost/api/wear-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ watch_id: watch.id, date: '2025-03-01', image_url: '/uploads/wrist-shot.jpg' })
    }));

    const collectionData = await (await getCollection()).json();
    const collectionWatch = collectionData.owned.find((w: any) => w.id === watch.id);

    // Watch's own image_url takes priority over the wear log photo
    expect(collectionWatch.image_url).toBe('/uploads/watch-photo.jpg');
  });

  it('should handle empty strings as null for optional fields', async () => {
    const createRequest = new NextRequest('http://localhost/api/watches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand: 'Test Brand',
        model: 'Test Model',
        reference: 'ABC123'
      })
    });

    const createResponse = await createWatch(createRequest);
    const watch = await createResponse.json();

    // Update with empty strings for optional fields
    const updateData = {
      reference: '', // Should become null
      image_url: '', // Should become null
      notes: '', // Should become null
      purchase_date: '', // Should become null
      sold_date: '' // Should become null
    };

    const updateRequest = new NextRequest(`http://localhost/api/watches/${watch.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });

    const updateResponse = await updateWatch(updateRequest, { 
      params: { id: watch.id.toString() }
    });

    expect(updateResponse.status).toBe(200);
    const updatedWatch = await updateResponse.json();

    expect(updatedWatch.reference).toBeNull();
    expect(updatedWatch.image_url).toBeNull();
    expect(updatedWatch.notes).toBeNull();
    expect(updatedWatch.purchase_date).toBeNull();
    expect(updatedWatch.sold_date).toBeNull();
  });
});