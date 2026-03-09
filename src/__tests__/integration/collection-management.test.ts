/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST as createWatch } from '@/app/api/watches/route';
import { PATCH as updateWatch } from '@/app/api/watches/[id]/route';
import { GET as getCollection } from '@/app/api/collection/route';
import { POST as logWear } from '@/app/api/wear-log/route';
import { getTestDb, resetTestDb, closeTestDb, getAuthHeaders } from '@/lib/test-db';

// Mock the main db module to use test database
jest.mock('../../lib/db', () => {
  return require('../../lib/test-db').getTestDb();
});

function makeReq(url: string, options?: RequestInit) {
  const headers = { 'Content-Type': 'application/json', ...getAuthHeaders(), ...(options?.headers as Record<string, string> || {}) };
  return new NextRequest(url, { ...options, headers });
}

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

    const createWatchRequest = makeReq('http://localhost/api/watches', {
      method: 'POST',
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
    const purchaseUpdateRequest = makeReq(`http://localhost/api/watches/${createdWatch.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        purchase_date: '2024-06-15',
        purchase_price: 15000
      })
    });

    await updateWatch(purchaseUpdateRequest, { params: Promise.resolve({ id: createdWatch.id.toString() }) });

    // Step 2: Verify it appears in collection as "owned"
    let collectionResponse = await getCollection(makeReq('http://localhost/api/collection'));
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

    const updateWatchRequest = makeReq(`http://localhost/api/watches/${createdWatch.id}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData)
    });

    const updateWatchResponse = await updateWatch(updateWatchRequest, {
      params: Promise.resolve({ id: createdWatch.id.toString() })
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

    const soldWatchRequest = makeReq(`http://localhost/api/watches/${createdWatch.id}`, {
      method: 'PATCH',
      body: JSON.stringify(soldData)
    });

    const soldWatchResponse = await updateWatch(soldWatchRequest, {
      params: Promise.resolve({ id: createdWatch.id.toString() })
    });
    expect(soldWatchResponse.status).toBe(200);

    const soldWatch = await soldWatchResponse.json();
    expect(soldWatch).toMatchObject({
      sold_date: '2026-01-15',
      sold_price: 18500,
      status: 'sold'
    });

    // Step 5: Verify it moves to "sold" section
    collectionResponse = await getCollection(makeReq('http://localhost/api/collection'));
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
    // Watch 1: Currently owned
    const watch1Request = makeReq('http://localhost/api/watches', {
      method: 'POST',
      body: JSON.stringify({ brand: 'Omega', model: 'Speedmaster', reference: '311.30.42.30.01.005' })
    });
    const watch1Response = await createWatch(watch1Request);
    const watch1 = await watch1Response.json();

    await updateWatch(makeReq(`http://localhost/api/watches/${watch1.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ purchase_date: '2025-01-01', purchase_price: 6000 })
    }), { params: Promise.resolve({ id: watch1.id.toString() }) });

    // Watch 2: Sold at profit
    const watch2Request = makeReq('http://localhost/api/watches', {
      method: 'POST',
      body: JSON.stringify({ brand: 'Rolex', model: 'Submariner', reference: '116610LN' })
    });
    const watch2Response = await createWatch(watch2Request);
    const watch2 = await watch2Response.json();

    await updateWatch(makeReq(`http://localhost/api/watches/${watch2.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ purchase_date: '2023-05-01', purchase_price: 12000 })
    }), { params: Promise.resolve({ id: watch2.id.toString() }) });

    await updateWatch(makeReq(`http://localhost/api/watches/${watch2.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ sold_date: '2025-12-01', sold_price: 15000, status: 'sold' })
    }), { params: Promise.resolve({ id: watch2.id.toString() }) });

    // Watch 3: Sold at loss
    const watch3Request = makeReq('http://localhost/api/watches', {
      method: 'POST',
      body: JSON.stringify({ brand: 'Tudor', model: 'Black Bay', reference: '79030N' })
    });
    const watch3Response = await createWatch(watch3Request);
    const watch3 = await watch3Response.json();

    await updateWatch(makeReq(`http://localhost/api/watches/${watch3.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ purchase_date: '2024-01-01', purchase_price: 3500 })
    }), { params: Promise.resolve({ id: watch3.id.toString() }) });

    await updateWatch(makeReq(`http://localhost/api/watches/${watch3.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ sold_date: '2025-11-01', sold_price: 2800, status: 'sold' })
    }), { params: Promise.resolve({ id: watch3.id.toString() }) });

    // Check collection stats
    const collectionResponse = await getCollection(makeReq('http://localhost/api/collection'));
    const collectionData = await collectionResponse.json();

    expect(collectionData.owned).toHaveLength(1); // Only watch1
    expect(collectionData.sold).toHaveLength(2); // watch2 and watch3

    expect(collectionData.owned[0]).toMatchObject({ id: watch1.id, brand: 'Omega', status: 'owned' });

    const soldWatches = collectionData.sold;
    const soldWatch2 = soldWatches.find((w: any) => w.id === watch2.id);
    const soldWatch3 = soldWatches.find((w: any) => w.id === watch3.id);

    expect(soldWatch2?.profit_loss).toBe(3000); // 15000 - 12000
    expect(soldWatch3?.profit_loss).toBe(-700); // 2800 - 3500

    expect(collectionData.stats).toMatchObject({
      totalWatches: 3,
      ownedCount: 1,
      soldCount: 2,
      totalCollectionValue: 6000,
      totalInvested: 21500,
      totalSoldFor: 17800,
      overallProfitLoss: 2300
    });
  });

  it('should handle watches without purchase/sold prices correctly', async () => {
    const watchRequest = makeReq('http://localhost/api/watches', {
      method: 'POST',
      body: JSON.stringify({ brand: 'Casio', model: 'F-91W', reference: 'F-91W-1DG' })
    });
    const watchResponse = await createWatch(watchRequest);
    const watch = await watchResponse.json();

    await updateWatch(makeReq(`http://localhost/api/watches/${watch.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'sold', sold_date: '2026-02-01' })
    }), { params: Promise.resolve({ id: watch.id.toString() }) });

    const collectionResponse = await getCollection(makeReq('http://localhost/api/collection'));
    const collectionData = await collectionResponse.json();

    expect(collectionData.sold).toHaveLength(1);
    const soldWatch = collectionData.sold[0];

    expect(soldWatch.profit_loss ?? null).toBeNull();
    expect(soldWatch.purchase_price ?? null).toBeNull();
    expect(soldWatch.sold_price ?? null).toBeNull();

    expect(collectionData.stats).toMatchObject({
      totalCollectionValue: 0,
      totalInvested: 0,
      totalSoldFor: 0,
      overallProfitLoss: 0
    });
  });

  it('should allow editing all watch fields', async () => {
    const createResponse = await createWatch(makeReq('http://localhost/api/watches', {
      method: 'POST',
      body: JSON.stringify({ brand: 'Seiko', model: 'SKX007' })
    }));
    const watch = await createResponse.json();

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

    const updateResponse = await updateWatch(makeReq(`http://localhost/api/watches/${watch.id}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData)
    }), { params: Promise.resolve({ id: watch.id.toString() }) });

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

    const db = getTestDb();
    const dbWatch = db.prepare('SELECT * FROM watches WHERE id = ?').get(watch.id);
    expect(dbWatch).toMatchObject(updateData);
  });

  it('should use first wear log photo as fallback when watch has no image_url', async () => {
    const createResponse = await createWatch(makeReq('http://localhost/api/watches', {
      method: 'POST',
      body: JSON.stringify({ brand: 'Seiko', model: 'SKX007' })
    }));
    const watch = await createResponse.json();

    await logWear(makeReq('http://localhost/api/wear-log', {
      method: 'POST',
      body: JSON.stringify({ watch_id: watch.id, date: '2025-01-10', image_url: '/uploads/first.jpg' })
    }));
    await logWear(makeReq('http://localhost/api/wear-log', {
      method: 'POST',
      body: JSON.stringify({ watch_id: watch.id, date: '2025-02-15', image_url: '/uploads/second.jpg' })
    }));

    const collectionData = await (await getCollection(makeReq('http://localhost/api/collection'))).json();
    const collectionWatch = collectionData.owned.find((w: any) => w.id === watch.id);

    expect(collectionWatch.image_url).toBe('/uploads/first.jpg');
  });

  it('should prefer watch image_url over wear log photo fallback', async () => {
    const createResponse = await createWatch(makeReq('http://localhost/api/watches', {
      method: 'POST',
      body: JSON.stringify({ brand: 'Omega', model: 'Seamaster' })
    }));
    const watch = await createResponse.json();

    await updateWatch(makeReq(`http://localhost/api/watches/${watch.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ image_url: '/uploads/watch-photo.jpg' })
    }), { params: Promise.resolve({ id: watch.id.toString() }) });

    await logWear(makeReq('http://localhost/api/wear-log', {
      method: 'POST',
      body: JSON.stringify({ watch_id: watch.id, date: '2025-03-01', image_url: '/uploads/wrist-shot.jpg' })
    }));

    const collectionData = await (await getCollection(makeReq('http://localhost/api/collection'))).json();
    const collectionWatch = collectionData.owned.find((w: any) => w.id === watch.id);

    expect(collectionWatch.image_url).toBe('/uploads/watch-photo.jpg');
  });

  it('should handle empty strings as null for optional fields', async () => {
    const createResponse = await createWatch(makeReq('http://localhost/api/watches', {
      method: 'POST',
      body: JSON.stringify({ brand: 'Test Brand', model: 'Test Model', reference: 'ABC123' })
    }));
    const watch = await createResponse.json();

    const updateData = {
      reference: '',
      image_url: '',
      notes: '',
      purchase_date: '',
      sold_date: ''
    };

    const updateResponse = await updateWatch(makeReq(`http://localhost/api/watches/${watch.id}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData)
    }), { params: Promise.resolve({ id: watch.id.toString() }) });

    expect(updateResponse.status).toBe(200);
    const updatedWatch = await updateResponse.json();

    expect(updatedWatch.reference).toBeNull();
    expect(updatedWatch.image_url).toBeNull();
    expect(updatedWatch.notes).toBeNull();
    expect(updatedWatch.purchase_date).toBeNull();
    expect(updatedWatch.sold_date).toBeNull();
  });
});
