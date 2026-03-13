'use client';

import { useState, useEffect } from 'react';

export default function SettingsProfile() {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [isDiscoverable, setIsDiscoverable] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then(data => {
        setDisplayName(data.display_name || '');
        setUsername(data.username || '');
        setBio(data.bio || '');
        setIsDiscoverable(!!data.is_discoverable);
        setLoading(false);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: displayName,
        username,
        bio,
        is_discoverable: isDiscoverable,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Something went wrong');
      return;
    }

    setSuccess('Profile updated');
  }

  if (loading) return <div className="text-zinc-400">Loading...</div>;

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">Edit Profile</h1>

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
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Bio</label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-zinc-100 h-24 resize-none"
            maxLength={200}
          />
          <p className="text-xs text-zinc-500 mt-1">{bio.length}/200</p>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isDiscoverable}
            onChange={e => setIsDiscoverable(e.target.checked)}
            className="w-4 h-4 rounded border-zinc-600 bg-zinc-900"
          />
          <div>
            <span className="text-sm text-zinc-200">Discoverable</span>
            <p className="text-xs text-zinc-500">Allow others to find and follow you</p>
          </div>
        </label>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {success && <p className="text-green-400 text-sm">{success}</p>}

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded px-4 py-2 font-medium"
        >
          Save Changes
        </button>
      </form>
    </div>
  );
}
