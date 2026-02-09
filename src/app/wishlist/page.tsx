'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface WishlistItem {
  id: number;
  brand: string;
  model: string;
  reference: string | null;
  image_url: string | null;
  target_price: number | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  latest_price: number | null;
  latest_price_source: string | null;
  latest_price_date: string | null;
}

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchWishlistItems();
  }, []);

  async function fetchWishlistItems() {
    try {
      const response = await fetch('/api/wishlist');
      if (!response.ok) {
        throw new Error('Failed to fetch wishlist items');
      }
      const data = await response.json();
      setItems(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function markAsPurchased(item: WishlistItem) {
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

      // Refresh the list
      fetchWishlistItems();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function removeItem(id: number) {
    if (!confirm('Are you sure you want to remove this item from your wishlist?')) {
      return;
    }

    try {
      const response = await fetch(`/api/wishlist?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove item');
      }

      fetchWishlistItems();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const getStatusBadge = (status: string) => {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium';
    switch (status) {
      case 'watching':
        return `${baseClasses} bg-blue-500/20 text-blue-400`;
      case 'purchased':
        return `${baseClasses} bg-green-500/20 text-green-400`;
      case 'removed':
        return `${baseClasses} bg-zinc-500/20 text-zinc-400`;
      default:
        return `${baseClasses} bg-zinc-500/20 text-zinc-400`;
    }
  };

  const getPriceIndicator = (targetPrice: number | null, latestPrice: number | null) => {
    if (!targetPrice || !latestPrice) return null;
    return latestPrice <= targetPrice ? 'text-green-400' : 'text-zinc-400';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-zinc-400">Loading wishlist...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Wishlist</h1>
        <Link
          href="/wishlist/add"
          className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Add Watch
        </Link>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-12">
          <h2 className="text-lg font-medium text-zinc-300 mb-2">Your wishlist is empty</h2>
          <p className="text-zinc-500 mb-4">Add watches you&apos;re interested in buying to track their prices.</p>
          <Link
            href="/wishlist/add"
            className="inline-block bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Add Your First Watch
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <div key={item.id} className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-6">
              {item.image_url && (
                <div className="mb-4">
                  <img
                    src={item.image_url}
                    alt={`${item.brand} ${item.model}`}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                </div>
              )}
              
              <div className="mb-3">
                <h3 className="font-semibold text-lg">{item.brand} {item.model}</h3>
                {item.reference && (
                  <p className="text-sm text-zinc-400">{item.reference}</p>
                )}
              </div>

              <div className="space-y-2 mb-4">
                {item.latest_price && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-400">Current Price:</span>
                    <span className={`font-medium ${getPriceIndicator(item.target_price, item.latest_price)}`}>
                      ${item.latest_price.toLocaleString()}
                    </span>
                  </div>
                )}
                
                {item.target_price && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-400">Target Price:</span>
                    <span className="font-medium">${item.target_price.toLocaleString()}</span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-400">Status:</span>
                  <span className={getStatusBadge(item.status)}>{item.status}</span>
                </div>
              </div>

              {item.notes && (
                <p className="text-sm text-zinc-300 mb-4">{item.notes}</p>
              )}

              <div className="flex gap-2">
                <Link
                  href={`/wishlist/${item.id}`}
                  className="flex-1 bg-zinc-700 hover:bg-zinc-600 px-3 py-2 rounded-lg text-sm font-medium text-center transition-colors"
                >
                  View Details
                </Link>
                
                {item.status === 'watching' && (
                  <>
                    <button
                      onClick={() => markAsPurchased(item)}
                      className="bg-green-600 hover:bg-green-500 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                      title="Mark as purchased"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="bg-red-600 hover:bg-red-500 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                      title="Remove from wishlist"
                    >
                      ✕
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}