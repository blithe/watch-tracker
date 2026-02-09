'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Watch {
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
}

interface WearLogEntry {
  id: number;
  watch_id: number;
  date: string;
  image_url: string | null;
  notes: string | null;
  created_at: string;
}

interface WatchDetailData {
  watch: Watch;
  wearHistory: WearLogEntry[];
}

export default function WatchDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<WatchDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      fetchWatchDetail();
    }
  }, [id]);

  async function fetchWatchDetail() {
    try {
      const response = await fetch(`/api/watches/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch watch details');
      }
      const watchData = await response.json();
      setData(watchData);
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

  const calculateDaysOwned = (purchaseDate: string | null, soldDate: string | null) => {
    if (!purchaseDate) return null;
    const endDate = soldDate ? new Date(soldDate) : new Date();
    const startDate = new Date(purchaseDate);
    const timeDiff = endDate.getTime() - startDate.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  };

  const calculateProfitLoss = (purchasePrice: number | null, soldPrice: number | null) => {
    if (!purchasePrice || !soldPrice) return null;
    return soldPrice - purchasePrice;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-zinc-400">Loading watch details...</div>
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

  const { watch, wearHistory } = data;
  const daysOwned = calculateDaysOwned(watch.purchase_date, watch.sold_date);
  const profitLoss = calculateProfitLoss(watch.purchase_price, watch.sold_price);

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/collection"
          className="text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          ← Back to Collection
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Watch Details */}
        <div>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-6 mb-6">
            {watch.image_url && (
              <div className="mb-6">
                <img
                  src={watch.image_url}
                  alt={`${watch.brand} ${watch.model}`}
                  className="w-full h-64 object-cover rounded-lg"
                />
              </div>
            )}

            <div className="mb-4">
              <h1 className="text-2xl font-bold">{watch.brand} {watch.model}</h1>
              {watch.reference && (
                <p className="text-lg text-zinc-400">{watch.reference}</p>
              )}
              <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-2 ${
                watch.status === 'sold' 
                  ? 'bg-zinc-500/20 text-zinc-400' 
                  : 'bg-green-500/20 text-green-400'
              }`}>
                {watch.status === 'sold' ? 'Sold' : 'Owned'}
              </div>
            </div>

            <div className="space-y-3">
              {watch.purchase_date && (
                <div className="flex justify-between">
                  <span className="text-zinc-400">Purchase Date:</span>
                  <span>{formatDate(watch.purchase_date)}</span>
                </div>
              )}

              {watch.purchase_price && (
                <div className="flex justify-between">
                  <span className="text-zinc-400">Purchase Price:</span>
                  <span>{formatCurrency(watch.purchase_price)}</span>
                </div>
              )}

              {watch.status === 'sold' && (
                <>
                  {watch.sold_date && (
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Sold Date:</span>
                      <span>{formatDate(watch.sold_date)}</span>
                    </div>
                  )}

                  {watch.sold_price && (
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Sold Price:</span>
                      <span>{formatCurrency(watch.sold_price)}</span>
                    </div>
                  )}

                  {profitLoss !== null && (
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Profit/Loss:</span>
                      <span className={profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {profitLoss >= 0 ? '+' : ''}{formatCurrency(profitLoss)}
                      </span>
                    </div>
                  )}
                </>
              )}

              {daysOwned && (
                <div className="flex justify-between">
                  <span className="text-zinc-400">
                    {watch.status === 'sold' ? 'Days Owned:' : 'Days Since Purchase:'}
                  </span>
                  <span>{daysOwned}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-zinc-400">Total Wears:</span>
                <span className="font-medium">{watch.wear_count}</span>
              </div>
            </div>

            {watch.notes && (
              <div className="mt-4 pt-4 border-t border-zinc-700">
                <h3 className="text-sm font-medium text-zinc-400 mb-2">Notes</h3>
                <p className="text-zinc-300">{watch.notes}</p>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <Link
                href={`/collection/${watch.id}/edit`}
                className="flex-1 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-center font-medium transition-colors"
              >
                Edit Watch
              </Link>
            </div>
          </div>
        </div>

        {/* Wear History */}
        <div>
          <h2 className="text-xl font-semibold mb-4">
            Wear History ({wearHistory.length})
          </h2>
          
          {wearHistory.length === 0 ? (
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-6 text-center">
              <p className="text-zinc-400">No wear entries for this watch yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {wearHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4"
                >
                  <div className="flex items-start gap-4">
                    {entry.image_url && (
                      <img
                        src={entry.image_url}
                        alt="Wear entry"
                        className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium">{formatDate(entry.date)}</span>
                        <Link
                          href={`/day/${entry.date}`}
                          className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                        >
                          View Day →
                        </Link>
                      </div>
                      {entry.notes && (
                        <p className="text-sm text-zinc-300">{entry.notes}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}