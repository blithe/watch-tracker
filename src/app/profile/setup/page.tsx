'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProfileSetup() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then(data => {
        setDisplayName(data.display_name || '');
        setUsername(data.username || '');
        setLoading(false);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: displayName,
        username,
        is_discoverable: true,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Something went wrong');
      return;
    }

    router.push('/feed');
  }

  if (loading) return <div className="text-zinc-400">Loading...</div>;

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-2">Set up your profile</h1>
      <p className="text-zinc-400 mb-6">Choose a display name and username to get started with the social feed.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-zinc-100"
            required
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Username</label>
          <div className="flex items-center">
            <span className="text-zinc-500 mr-1">@</span>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-zinc-100"
              required
              minLength={3}
              maxLength={30}
            />
          </div>
          <p className="text-xs text-zinc-500 mt-1">3-30 characters: letters, numbers, underscores</p>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded px-4 py-2 font-medium"
        >
          Save & Continue
        </button>
      </form>
    </div>
  );
}
