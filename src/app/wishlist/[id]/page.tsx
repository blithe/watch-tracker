'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface WishlistItem {
  id: number;
  brand: string;
  model: string;
  reference: string | null;
  image_url: string | null;
  source_url: string | null;
  target_price: number | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface PriceEntry {
  id: number;
  wishlist_id: number;
  price: number;
  source: string | null;
  url: string | null;
  recorded_at: string;
}

export default function WishlistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();
  const [item, setItem] = useState<WishlistItem | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddPrice, setShowAddPrice] = useState(false);
  const [priceForm, setPriceForm] = useState({
    price: '',
    source: '',
    url: ''
  });
  const [addingPrice, setAddingPrice] = useState(false);

  useEffect(() => {
    fetchItem();
    fetchPriceHistory();
  }, [id]);

  async function fetchItem() {
    try {
      const response = await fetch('/api/wishlist');
      if (!response.ok) {
        throw new Error('Failed to fetch wishlist items');
      }
      const items = await response.json();
      const foundItem = items.find((i: WishlistItem) => i.id === Number(id));
      
      if (!foundItem) {
        throw new Error('Wishlist item not found');
      }
      
      setItem(foundItem);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPriceHistory() {
    try {
      const response = await fetch(`/api/wishlist/${id}/prices`);
      if (!response.ok) {
        throw new Error('Failed to fetch price history');
      }
      const data = await response.json();
      setPriceHistory(data);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleAddPrice(e: React.FormEvent) {
    e.preventDefault();
    setAddingPrice(true);

    if (!priceForm.price || isNaN(Number(priceForm.price))) {
      setError('Valid price is required');
      setAddingPrice(false);
      return;
    }

    try {
      const response = await fetch(`/api/wishlist/${id}/prices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price: Number(priceForm.price),
          source: priceForm.source || null,
          url: priceForm.url || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add price entry');
      }

      // Reset form and refresh data
      setPriceForm({ price: '', source: '', url: '' });
      setShowAddPrice(false);
      fetchPriceHistory();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAddingPrice(false);
    }
  }

  async function markAsPurchased() {
    if (!item) return;

    try {
      // Update wishlist item status
      const updateResponse = await fetch('/api/wishlist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...item, status: 'purchased' }),
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to update wishlist item');
      }

      // Add to watches collection
      const watchResponse = await fetch('/api/watches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: item.brand,
          model: item.model,
          reference: item.reference,
        }),
      });

      if (!watchResponse.ok) {
        throw new Error('Failed to add to watch collection');
      }

      // Refresh the item
      fetchItem();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const getLowestPrice = () => {
    if (priceHistory.length === 0) return null;
    return Math.min(...priceHistory.map(p => p.price));
  };

  const getLatestPrice = () => {
    if (priceHistory.length === 0) return null;
    return priceHistory[0]?.price; // Already sorted by recorded_at DESC
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const inputClasses = "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-medium text-zinc-300 mb-2">Wishlist item not found</h2>
        <Link href="/wishlist" className="text-blue-400 hover:text-blue-300">
          ← Back to Wishlist
        </Link>
      </div>
    );
  }

  const lowestPrice = getLowestPrice();
  const latestPrice = getLatestPrice();

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/wishlist"
          className="text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          ← Back to Wishlist
        </Link>
        <Link
          href={`/wishlist/${id}/edit`}
          className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Edit
        </Link>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Watch Details */}
        <div className="lg:col-span-1">
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-6">
            {item.image_url && (
              <div className="mb-4">
                <img
                  src={item.image_url}
                  alt={`${item.brand} ${item.model}`}
                  className="w-full h-64 object-cover rounded-lg"
                />
              </div>
            )}
            
            <h1 className="text-2xl font-bold mb-2">{item.brand} {item.model}</h1>
            {item.reference && (
              <p className="text-zinc-400 mb-4">{item.reference}</p>
            )}

            <div className="space-y-3 mb-6">
              {item.target_price && (
                <div className="flex justify-between">
                  <span className="text-sm text-zinc-400">Target Price:</span>
                  <span className="font-medium">${item.target_price.toLocaleString()}</span>
                </div>
              )}
              
              {latestPrice && (
                <div className="flex justify-between">
                  <span className="text-sm text-zinc-400">Latest Price:</span>
                  <span className={`font-medium ${item.target_price && latestPrice <= item.target_price ? 'text-green-400' : 'text-zinc-300'}`}>
                    ${latestPrice.toLocaleString()}
                  </span>
                </div>
              )}
              
              {lowestPrice && (
                <div className="flex justify-between">
                  <span className="text-sm text-zinc-400">Lowest Seen:</span>
                  <span className="font-medium text-blue-400">${lowestPrice.toLocaleString()}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-sm text-zinc-400">Status:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  item.status === 'watching' ? 'bg-blue-500/20 text-blue-400' :
                  item.status === 'purchased' ? 'bg-green-500/20 text-green-400' :
                  'bg-zinc-500/20 text-zinc-400'
                }`}>
                  {item.status}
                </span>
              </div>
            </div>

            {item.notes && (
              <div className="mb-6">
                <h3 className="font-medium mb-2">Notes</h3>
                <p className="text-sm text-zinc-300">{item.notes}</p>
              </div>
            )}

            {item.source_url && (
              <div className="mb-6">
                <a
                  href={item.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-sm underline"
                >
                  View source →
                </a>
              </div>
            )}

            {item.status === 'watching' && (
              <button
                onClick={markAsPurchased}
                className="w-full bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Mark as Purchased
              </button>
            )}
          </div>
        </div>

        {/* Price History */}
        <div className="lg:col-span-2">
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Price History</h2>
              <button
                onClick={() => setShowAddPrice(!showAddPrice)}
                className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Add Price
              </button>
            </div>

            {showAddPrice && (
              <form onSubmit={handleAddPrice} className="mb-6 p-4 bg-zinc-900/50 rounded-lg border border-zinc-600">
                <h3 className="font-medium mb-4">Add Price Entry</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Price ($) *</label>
                    <input
                      type="number"
                      value={priceForm.price}
                      onChange={(e) => setPriceForm(prev => ({ ...prev, price: e.target.value }))}
                      className={inputClasses}
                      placeholder="8500"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Source</label>
                    <input
                      type="text"
                      value={priceForm.source}
                      onChange={(e) => setPriceForm(prev => ({ ...prev, source: e.target.value }))}
                      className={inputClasses}
                      placeholder="e.g. Chrono24, eBay"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">URL</label>
                    <input
                      type="url"
                      value={priceForm.url}
                      onChange={(e) => setPriceForm(prev => ({ ...prev, url: e.target.value }))}
                      className={inputClasses}
                      placeholder="https://..."
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    type="submit"
                    disabled={addingPrice}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    {addingPrice ? 'Adding...' : 'Add Price'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddPrice(false)}
                    className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {priceHistory.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-zinc-400 mb-4">No price history yet</p>
                <p className="text-sm text-zinc-500">
                  Add price entries manually to track this watch&apos;s value over time.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {priceHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-4 bg-zinc-900/30 rounded-lg"
                  >
                    <div>
                      <div className="font-medium">${entry.price.toLocaleString()}</div>
                      <div className="text-sm text-zinc-400">
                        {formatDate(entry.recorded_at)}
                        {entry.source && <span> • {entry.source}</span>}
                      </div>
                    </div>
                    {entry.url && (
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-sm"
                      >
                        View →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}