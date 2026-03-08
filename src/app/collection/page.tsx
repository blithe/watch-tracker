'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface CollectionWatch {
  id: number;
  brand: string;
  model: string;
  reference: string | null;
  image_url: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  sold_date: string | null;
  sold_price: number | null;
  status: string;
  notes: string | null;
  wear_count: number;
  days_owned?: number;
  profit_loss?: number;
}

interface CollectionStats {
  totalCollectionValue: number;
  totalInvested: number;
  totalSoldFor: number;
  overallProfitLoss: number;
  totalWatches: number;
  ownedCount: number;
  soldCount: number;
}

interface CollectionData {
  owned: CollectionWatch[];
  sold: CollectionWatch[];
  stats: CollectionStats;
}

export default function CollectionPage() {
  const [data, setData] = useState<CollectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCollection();
  }, []);

  async function fetchCollection() {
    try {
      const response = await fetch('/api/collection');
      if (!response.ok) {
        throw new Error('Failed to fetch collection');
      }
      const collectionData = await response.json();
      setData(collectionData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString();
  };

  async function handleDeleteWatch(id: number) {
    if (!confirm('Delete this watch? This cannot be undone.')) return;
    await fetch(`/api/watches/${id}`, { method: 'DELETE' });
    fetchCollection();
  }

  const WatchCard = ({ watch, isSold = false }: { watch: CollectionWatch; isSold?: boolean }) => (
    <div className={`bg-zinc-800/50 border border-zinc-700 rounded-xl p-6 transition-all hover:bg-zinc-800/70 ${isSold ? 'opacity-75' : ''}`}>
      {watch.image_url && (
        <div className="mb-4">
          <img
            src={watch.image_url}
            alt={`${watch.brand} ${watch.model}`}
            className="w-full h-48 object-cover rounded-lg"
          />
        </div>
      )}
      
      <div className="mb-3">
        <h3 className="font-semibold text-lg">{watch.brand} {watch.model}</h3>
        {watch.reference && (
          <p className="text-sm text-zinc-400">{watch.reference}</p>
        )}
      </div>

      <div className="space-y-2 mb-4 text-sm">
        {watch.purchase_date && (
          <div className="flex justify-between">
            <span className="text-zinc-400">Purchased:</span>
            <span>{formatDate(watch.purchase_date)}</span>
          </div>
        )}
        
        {watch.purchase_price && (
          <div className="flex justify-between">
            <span className="text-zinc-400">Purchase Price:</span>
            <span>{formatCurrency(watch.purchase_price)}</span>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-zinc-400">Total Wears:</span>
          <span className="font-medium">{watch.wear_count}</span>
        </div>

        {isSold && (
          <>
            {watch.sold_date && (
              <div className="flex justify-between">
                <span className="text-zinc-400">Sold:</span>
                <span>{formatDate(watch.sold_date)}</span>
              </div>
            )}
            
            {watch.sold_price && (
              <div className="flex justify-between">
                <span className="text-zinc-400">Sold Price:</span>
                <span>{formatCurrency(watch.sold_price)}</span>
              </div>
            )}

            {typeof watch.profit_loss === 'number' && (
              <div className="flex justify-between">
                <span className="text-zinc-400">Profit/Loss:</span>
                <span className={watch.profit_loss >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {watch.profit_loss >= 0 ? '+' : ''}{formatCurrency(watch.profit_loss)}
                </span>
              </div>
            )}

            {watch.days_owned && (
              <div className="flex justify-between">
                <span className="text-zinc-400">Days Owned:</span>
                <span>{watch.days_owned}</span>
              </div>
            )}
          </>
        )}
      </div>

      {watch.notes && (
        <p className="text-sm text-zinc-300 mb-4">{watch.notes}</p>
      )}

      <div className="flex gap-2">
        <Link
          href={`/collection/${watch.id}`}
          className="flex-1 bg-zinc-700 hover:bg-zinc-600 px-3 py-2 rounded-lg text-sm font-medium text-center transition-colors"
        >
          View Details
        </Link>
        <Link
          href={`/collection/${watch.id}/edit`}
          className="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Edit
        </Link>
        <button
          onClick={() => handleDeleteWatch(watch.id)}
          className="bg-red-600/20 hover:bg-red-600/40 text-red-400 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-zinc-400">Loading collection...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Collection</h1>
        <Link
          href="/collection/add"
          className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Add Watch
        </Link>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
          <h3 className="text-sm text-zinc-400 mb-1">Collection Value</h3>
          <p className="text-xl font-bold text-blue-400">{formatCurrency(data.stats.totalCollectionValue)}</p>
        </div>
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
          <h3 className="text-sm text-zinc-400 mb-1">Total Invested</h3>
          <p className="text-xl font-bold">{formatCurrency(data.stats.totalInvested)}</p>
        </div>
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
          <h3 className="text-sm text-zinc-400 mb-1">Total Sold For</h3>
          <p className="text-xl font-bold">{formatCurrency(data.stats.totalSoldFor)}</p>
        </div>
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
          <h3 className="text-sm text-zinc-400 mb-1">Overall P/L</h3>
          <p className={`text-xl font-bold ${data.stats.overallProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {data.stats.overallProfitLoss >= 0 ? '+' : ''}{formatCurrency(data.stats.overallProfitLoss)}
          </p>
        </div>
      </div>

      {/* Current Collection */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">
          Current Collection ({data.stats.ownedCount})
        </h2>
        {data.owned.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-zinc-400 mb-4">No watches in your collection yet.</p>
            <Link
              href="/collection/add"
              className="inline-block bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Add Your First Watch
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.owned.map((watch) => (
              <WatchCard key={watch.id} watch={watch} />
            ))}
          </div>
        )}
      </div>

      {/* Past Watches */}
      {data.sold.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">
            Past Watches ({data.stats.soldCount})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.sold.map((watch) => (
              <WatchCard key={watch.id} watch={watch} isSold />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}