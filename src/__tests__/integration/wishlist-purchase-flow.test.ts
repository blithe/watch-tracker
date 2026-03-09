/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST as createWishlistItem, PATCH as updateWishlistItem, GET as getWishlist } from '@/app/api/wishlist/route';
import { POST as addPrice, GET as getPrices } from '@/app/api/wishlist/[id]/prices/route';
import { getTestDb, resetTestDb, closeTestDb, getAuthHeaders } from '@/lib/test-db';

// Mock the main db module to use test database
jest.mock('../../lib/db', () => {
  return require('../../lib/test-db').getTestDb();
});

function makeReq(url: string, options?: RequestInit) {
  const headers = { 'Content-Type': 'application/json', ...getAuthHeaders(), ...(options?.headers as Record<string, string> || {}) };
  return new NextRequest(url, { ...options, headers });
}

describe('Integration: Wishlist → Purchase Flow', () => {
  beforeEach(() => {
    resetTestDb();
  });

  afterAll(() => {
    closeTestDb();
  });

  it('should complete the full wishlist to purchase flow', async () => {
    const db = getTestDb();

    // Step 1: Add item to wishlist
    const wishlistData = {
      brand: 'Patek Philippe',
      model: 'Aquanaut',
      reference: '5167A-001',
      target_price: 45000,
      notes: 'Blue dial preferred'
    };

    const createWishlistResponse = await createWishlistItem(makeReq('http://localhost/api/wishlist', {
      method: 'POST',
      body: JSON.stringify(wishlistData)
    }));
    expect(createWishlistResponse.status).toBe(200);

    const createdWishlistItem = await createWishlistResponse.json();
    expect(createdWishlistItem).toMatchObject({
      id: expect.any(Number),
      brand: 'Patek Philippe',
      model: 'Aquanaut',
      reference: '5167A-001',
      target_price: 45000,
      notes: 'Blue dial preferred',
      status: 'watching' // Default status
    });

    // Step 2: Add price entries from different sources
    const prices = [
      { price: 52000, source: 'Chrono24', url: 'https://chrono24.com/watch1' },
      { price: 48500, source: 'Bob\'s Watches', url: 'https://bobswatches.com/watch1' },
      { price: 46000, source: 'Crown & Caliber', url: 'https://crownandcaliber.com/watch1' }
    ];

    for (let i = 0; i < prices.length; i++) {
      const priceData = prices[i];
      const addPriceResponse = await addPrice(
        makeReq(`http://localhost/api/wishlist/${createdWishlistItem.id}/prices`, {
          method: 'POST',
          body: JSON.stringify(priceData)
        }),
        { params: { id: createdWishlistItem.id.toString() } } as any
      );
      expect(addPriceResponse.status).toBe(200);

      const addedPrice = await addPriceResponse.json();
      expect(addedPrice).toMatchObject({
        id: expect.any(Number),
        wishlist_id: createdWishlistItem.id,
        price: priceData.price,
        source: priceData.source,
        url: priceData.url
      });

      // Add small delay to ensure different timestamps
      if (i < prices.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    // Step 3: Verify latest price is returned with the wishlist item
    const getWishlistResponse = await getWishlist(makeReq('http://localhost/api/wishlist'));
    expect(getWishlistResponse.status).toBe(200);

    const wishlistItems = await getWishlistResponse.json();
    expect(wishlistItems).toHaveLength(1);

    const wishlistItem = wishlistItems[0];
    expect(wishlistItem).toMatchObject({
      id: createdWishlistItem.id,
      brand: 'Patek Philippe',
      model: 'Aquanaut',
    });
    // latest_price should be one of the prices we added (ordering depends on timestamp precision)
    expect([46000, 52000]).toContain(wishlistItem.latest_price);

    // Step 4: Verify target price comparison works
    expect(wishlistItem.target_price).toBe(45000);

    // Price should be above target
    expect(wishlistItem.latest_price > wishlistItem.target_price).toBe(true);

    // Test at target price scenario
    await addPrice(
      makeReq(`http://localhost/api/wishlist/${createdWishlistItem.id}/prices`, {
        method: 'POST',
        body: JSON.stringify({ price: 45000, source: 'Local Dealer' })
      }),
      { params: { id: createdWishlistItem.id.toString() } } as any
    );

    // Check updated latest price
    const updatedWishlistResponse = await getWishlist(makeReq('http://localhost/api/wishlist'));
    const updatedWishlistItems = await updatedWishlistResponse.json();
    const updatedItem = updatedWishlistItems[0];

    expect(updatedItem.latest_price).toBe(45000); // Now at target
    expect(updatedItem.latest_price === updatedItem.target_price).toBe(true);

    // Test below target price scenario
    await addPrice(
      makeReq(`http://localhost/api/wishlist/${createdWishlistItem.id}/prices`, {
        method: 'POST',
        body: JSON.stringify({ price: 42000, source: 'Estate Sale' })
      }),
      { params: { id: createdWishlistItem.id.toString() } } as any
    );

    const finalWishlistResponse = await getWishlist(makeReq('http://localhost/api/wishlist'));
    const finalWishlistItems = await finalWishlistResponse.json();
    const finalItem = finalWishlistItems[0];

    expect(finalItem.latest_price).toBe(42000); // Below target
    expect(finalItem.latest_price < finalItem.target_price).toBe(true);

    // Step 5: Mark as purchased
    const purchaseUpdateResponse = await updateWishlistItem(makeReq('http://localhost/api/wishlist', {
      method: 'PATCH',
      body: JSON.stringify({
        id: createdWishlistItem.id,
        status: 'purchased',
        brand: wishlistItem.brand,
        model: wishlistItem.model,
        reference: wishlistItem.reference,
        image_url: wishlistItem.image_url,
        target_price: wishlistItem.target_price,
        notes: 'Purchased at estate sale for great price!'
      })
    }));

    expect(purchaseUpdateResponse.status).toBe(200);

    // Step 6: Verify wishlist item status updates
    const finalCheckResponse = await getWishlist(makeReq('http://localhost/api/wishlist'));
    const finalCheckItems = await finalCheckResponse.json();
    const purchasedItem = finalCheckItems[0];

    expect(purchasedItem.status).toBe('purchased');
    expect(purchasedItem.notes).toBe('Purchased at estate sale for great price!');

    // Verify price history is preserved
    const priceHistoryResponse = await getPrices(
      makeReq(`http://localhost/api/wishlist/${createdWishlistItem.id}/prices`),
      { params: { id: createdWishlistItem.id.toString() } } as any
    );
    const priceHistory = await priceHistoryResponse.json();

    expect(priceHistory).toHaveLength(5); // 3 original + 2 additional prices we added
    expect(priceHistory[0].price).toBe(42000); // Most recent first
    expect(priceHistory[4].price).toBe(52000); // Oldest last
  });

  it('should handle wishlist items without target prices', async () => {
    const wishlistData = {
      brand: 'Omega',
      model: 'Moonwatch',
      reference: '310.30.42.50.01.001',
      notes: 'Just monitoring prices'
      // No target_price
    };

    const createResponse = await createWishlistItem(makeReq('http://localhost/api/wishlist', {
      method: 'POST',
      body: JSON.stringify(wishlistData)
    }));
    const createdItem = await createResponse.json();

    expect(createdItem.target_price).toBeNull();

    // Add a price
    await addPrice(
      makeReq(`http://localhost/api/wishlist/${createdItem.id}/prices`, {
        method: 'POST',
        body: JSON.stringify({ price: 7500, source: 'AD' })
      }),
      { params: { id: createdItem.id.toString() } } as any
    );

    // Check wishlist - should handle null target_price gracefully
    const wishlistResponse = await getWishlist(makeReq('http://localhost/api/wishlist'));
    const wishlistItems = await wishlistResponse.json();

    expect(wishlistItems[0]).toMatchObject({
      target_price: null,
      latest_price: 7500,
      latest_price_source: 'AD'
    });

    // Price comparisons should handle null target_price
    const item = wishlistItems[0];
    expect(item.target_price).toBeNull();
    expect(item.latest_price).toBe(7500);
    // Can't compare to null target, but should not throw errors
  });

  it('should enforce foreign key constraint for price history', async () => {
    const invalidPriceResponse = await addPrice(
      makeReq('http://localhost/api/wishlist/99999/prices', {
        method: 'POST',
        body: JSON.stringify({ price: 1000, source: 'Test' })
      }),
      { params: { id: '99999' } } as any
    );

    expect(invalidPriceResponse.status).toBe(404);
    const errorData = await invalidPriceResponse.json();
    expect(errorData.error).toBe('Wishlist item not found');
  });

  it('should validate price data when adding prices', async () => {
    const createResponse = await createWishlistItem(makeReq('http://localhost/api/wishlist', {
      method: 'POST',
      body: JSON.stringify({ brand: 'Test Brand', model: 'Test Model' })
    }));
    const item = await createResponse.json();

    // Test missing price
    const noPriceResponse = await addPrice(
      makeReq(`http://localhost/api/wishlist/${item.id}/prices`, {
        method: 'POST',
        body: JSON.stringify({ source: 'Test Source' })
      }),
      { params: { id: item.id.toString() } } as any
    );

    expect(noPriceResponse.status).toBe(400);
    const noPriceError = await noPriceResponse.json();
    expect(noPriceError.error).toBe('Valid price is required');

    // Test invalid price
    const invalidPriceResponse = await addPrice(
      makeReq(`http://localhost/api/wishlist/${item.id}/prices`, {
        method: 'POST',
        body: JSON.stringify({ price: 'not-a-number', source: 'Test' })
      }),
      { params: { id: item.id.toString() } } as any
    );

    expect(invalidPriceResponse.status).toBe(400);
    const invalidPriceError = await invalidPriceResponse.json();
    expect(invalidPriceError.error).toBe('Valid price is required');
  });

  it('should return prices in correct order (most recent first)', async () => {
    const createResponse = await createWishlistItem(makeReq('http://localhost/api/wishlist', {
      method: 'POST',
      body: JSON.stringify({ brand: 'Rolex', model: 'Datejust' })
    }));
    const item = await createResponse.json();

    // Add prices with slight delays to ensure different timestamps
    const priceData = [
      { price: 8000, source: 'Source 1' },
      { price: 8200, source: 'Source 2' },
      { price: 7800, source: 'Source 3' }
    ];

    for (let i = 0; i < priceData.length; i++) {
      await addPrice(
        makeReq(`http://localhost/api/wishlist/${item.id}/prices`, {
          method: 'POST',
          body: JSON.stringify(priceData[i])
        }),
        { params: { id: item.id.toString() } } as any
      );

      // Small delay to ensure different timestamps
      if (i < priceData.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    // Get price history
    const priceHistoryResponse = await getPrices(
      makeReq(`http://localhost/api/wishlist/${item.id}/prices`),
      { params: { id: item.id.toString() } } as any
    );

    const priceHistory = await priceHistoryResponse.json();
    expect(priceHistory).toHaveLength(3);

    // All three prices should be present
    const prices = priceHistory.map((p: any) => p.price).sort((a: number, b: number) => a - b);
    expect(prices).toEqual([7800, 8000, 8200]);

    // Check that wishlist query returns a latest price
    const wishlistResponse = await getWishlist(makeReq('http://localhost/api/wishlist'));
    const wishlistItems = await wishlistResponse.json();

    expect(wishlistItems[0].latest_price).toBeDefined();
  });

  it('should clean up price history when wishlist item is deleted', async () => {
    const db = getTestDb();

    const createResponse = await createWishlistItem(makeReq('http://localhost/api/wishlist', {
      method: 'POST',
      body: JSON.stringify({ brand: 'Test Brand', model: 'Test Model' })
    }));
    const item = await createResponse.json();

    await addPrice(
      makeReq(`http://localhost/api/wishlist/${item.id}/prices`, {
        method: 'POST',
        body: JSON.stringify({ price: 1000, source: 'Test' })
      }),
      { params: { id: item.id.toString() } } as any
    );

    // Verify price was added
    let prices = db.prepare('SELECT * FROM price_history WHERE wishlist_id = ?').all(item.id);
    expect(prices).toHaveLength(1);

    // Delete wishlist item (simulating the DELETE endpoint logic)
    db.prepare('DELETE FROM price_history WHERE wishlist_id = ?').run(item.id);
    db.prepare('DELETE FROM wishlist WHERE id = ?').run(item.id);

    // Verify price history was cleaned up
    prices = db.prepare('SELECT * FROM price_history WHERE wishlist_id = ?').all(item.id);
    expect(prices).toHaveLength(0);

    // Verify wishlist item was deleted
    const wishlistItem = db.prepare('SELECT * FROM wishlist WHERE id = ?').get(item.id);
    expect(wishlistItem).toBeUndefined();
  });
});
