'use client';

import { useState, useEffect } from 'react';

interface FeedItem {
  id: number;
  date: string;
  image_url: string;
  notes: string | null;
  created_at: string;
  brand: string;
  model: string;
  reference: string | null;
  display_name: string;
  username: string;
  user_id: number;
}

export default function FeedPage() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  async function loadFeed(cursor?: number) {
    const url = cursor ? `/api/feed?cursor=${cursor}` : '/api/feed';
    const res = await fetch(url);
    const data = await res.json();
    return data;
  }

  useEffect(() => {
    // Ensure profile exists (auto-creates on first GET) before loading feed
    fetch('/api/profile')
      .then(() => loadFeed())
      .then(data => {
        setItems(data.items);
        setNextCursor(data.nextCursor);
        setLoading(false);
      });
  }, []);

  async function handleLoadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const data = await loadFeed(nextCursor);
    setItems(prev => [...prev, ...data.items]);
    setNextCursor(data.nextCursor);
    setLoadingMore(false);
  }

  if (loading) return <div className="text-zinc-400">Loading feed...</div>;

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-400 mb-4">No wrist shots yet.</p>
        <p className="text-zinc-500 text-sm">
          Follow other collectors or <a href="/log" className="text-blue-400 hover:text-blue-300">log a wear</a> with a photo to see it here.
        </p>
        <a href="/profile/setup" className="inline-block mt-4 text-sm text-blue-400 hover:text-blue-300">
          Set up your profile
        </a>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Feed</h1>

      <div className="space-y-6">
        {items.map(item => (
          <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <img
              src={item.image_url}
              alt={`${item.brand} ${item.model}`}
              className="w-full aspect-square object-cover"
            />
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <a
                  href={`/user/${item.username}`}
                  className="text-sm font-medium text-zinc-200 hover:text-white"
                >
                  {item.display_name}
                </a>
                <span className="text-xs text-zinc-500">@{item.username}</span>
              </div>
              <p className="text-zinc-300 text-sm">
                {item.brand} {item.model}
                {item.reference && <span className="text-zinc-500"> {item.reference}</span>}
              </p>
              {item.notes && (
                <p className="text-zinc-400 text-sm mt-1">{item.notes}</p>
              )}
              <p className="text-xs text-zinc-600 mt-2">{item.date}</p>
            </div>
          </div>
        ))}
      </div>

      {nextCursor && (
        <div className="text-center py-6">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-sm"
          >
            {loadingMore ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
