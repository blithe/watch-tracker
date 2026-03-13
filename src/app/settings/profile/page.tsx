'use client';

import { useState, useEffect } from 'react';

interface UserEntry {
  id: number;
  follower_id?: number;
  following_id?: number;
  blocked_id?: number;
  display_name: string;
  username: string;
}

export default function SettingsProfile() {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [isDiscoverable, setIsDiscoverable] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  // Followers state
  const [tab, setTab] = useState<'requests' | 'followers' | 'following' | 'blocked'>('requests');
  const [requests, setRequests] = useState<UserEntry[]>([]);
  const [followers, setFollowers] = useState<UserEntry[]>([]);
  const [following, setFollowing] = useState<UserEntry[]>([]);
  const [blocked, setBlocked] = useState<UserEntry[]>([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/profile').then(r => r.json()),
      fetch('/api/follow-requests').then(r => r.json()),
      fetch('/api/followers').then(r => r.json()),
      fetch('/api/following').then(r => r.json()),
      fetch('/api/blocks').then(r => r.json()),
    ]).then(([profile, req, fol, fing, blk]) => {
      setDisplayName(profile.display_name || '');
      setUsername(profile.username || '');
      setBio(profile.bio || '');
      setIsDiscoverable(!!profile.is_discoverable);
      setRequests(req);
      setFollowers(fol);
      setFollowing(fing);
      setBlocked(blk);
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

  async function handleAccept(userId: number) {
    await fetch('/api/follow-requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action: 'accept' }),
    });
    setRequests(prev => prev.filter(r => r.follower_id !== userId));
    const fol = await fetch('/api/followers').then(r => r.json());
    setFollowers(fol);
  }

  async function handleReject(userId: number) {
    await fetch('/api/follow-requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action: 'reject' }),
    });
    setRequests(prev => prev.filter(r => r.follower_id !== userId));
  }

  async function handleRemoveFollower(userId: number) {
    await fetch('/api/followers', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    setFollowers(prev => prev.filter(f => f.follower_id !== userId));
  }

  async function handleUnfollow(userId: number) {
    await fetch('/api/follow', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    setFollowing(prev => prev.filter(f => f.following_id !== userId));
  }

  async function handleUnblock(userId: number) {
    await fetch('/api/block', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    setBlocked(prev => prev.filter(b => b.blocked_id !== userId));
  }

  async function handleSearch(q: string) {
    setSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    const res = await fetch(`/api/search/users?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setSearchResults(data);
  }

  const tabs = [
    { key: 'requests' as const, label: 'Requests', count: requests.length },
    { key: 'followers' as const, label: 'Followers', count: followers.length },
    { key: 'following' as const, label: 'Following', count: following.length },
    { key: 'blocked' as const, label: 'Blocked', count: blocked.length },
  ];

  if (loading) return <div className="text-zinc-400">Loading...</div>;

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">Profile</h1>

      {/* Profile form */}
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

      {/* Followers & Following */}
      <div className="mt-10 border-t border-zinc-800 pt-6">
        <h2 className="text-lg font-semibold mb-4">Followers & Following</h2>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search users..."
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-zinc-100 text-sm"
          />
          {searchResults.length > 0 && (
            <div className="mt-2 bg-zinc-900 border border-zinc-700 rounded divide-y divide-zinc-800">
              {searchResults.map((u: any) => (
                <a key={u.user_id} href={`/user/${u.username}`} className="block px-3 py-2 hover:bg-zinc-800">
                  <span className="text-sm text-zinc-200">{u.display_name}</span>
                  <span className="text-xs text-zinc-500 ml-2">@{u.username}</span>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 mb-4">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm border-b-2 -mb-px ${
                tab === t.key
                  ? 'border-blue-500 text-zinc-100'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t.label} {t.count > 0 && <span className="text-xs ml-1">({t.count})</span>}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'requests' && (
          <div className="space-y-2">
            {requests.length === 0 && <p className="text-zinc-500 text-sm">No pending requests</p>}
            {requests.map(r => (
              <div key={r.id} className="flex items-center justify-between bg-zinc-900 rounded px-3 py-2">
                <a href={`/user/${r.username}`} className="text-sm text-zinc-200 hover:text-white">
                  {r.display_name} <span className="text-zinc-500">@{r.username}</span>
                </a>
                <div className="flex gap-2">
                  <button onClick={() => handleAccept(r.follower_id!)} className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded">Accept</button>
                  <button onClick={() => handleReject(r.follower_id!)} className="text-xs px-3 py-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded">Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'followers' && (
          <div className="space-y-2">
            {followers.length === 0 && <p className="text-zinc-500 text-sm">No followers</p>}
            {followers.map(f => (
              <div key={f.id} className="flex items-center justify-between bg-zinc-900 rounded px-3 py-2">
                <a href={`/user/${f.username}`} className="text-sm text-zinc-200 hover:text-white">
                  {f.display_name} <span className="text-zinc-500">@{f.username}</span>
                </a>
                <button onClick={() => handleRemoveFollower(f.follower_id!)} className="text-xs px-3 py-1 text-red-400 hover:text-red-300">Remove</button>
              </div>
            ))}
          </div>
        )}

        {tab === 'following' && (
          <div className="space-y-2">
            {following.length === 0 && <p className="text-zinc-500 text-sm">Not following anyone</p>}
            {following.map(f => (
              <div key={f.id} className="flex items-center justify-between bg-zinc-900 rounded px-3 py-2">
                <a href={`/user/${f.username}`} className="text-sm text-zinc-200 hover:text-white">
                  {f.display_name} <span className="text-zinc-500">@{f.username}</span>
                </a>
                <button onClick={() => handleUnfollow(f.following_id!)} className="text-xs px-3 py-1 text-red-400 hover:text-red-300">Unfollow</button>
              </div>
            ))}
          </div>
        )}

        {tab === 'blocked' && (
          <div className="space-y-2">
            {blocked.length === 0 && <p className="text-zinc-500 text-sm">No blocked users</p>}
            {blocked.map(b => (
              <div key={b.id} className="flex items-center justify-between bg-zinc-900 rounded px-3 py-2">
                <span className="text-sm text-zinc-200">
                  {b.display_name || 'Unknown'} <span className="text-zinc-500">@{b.username || '—'}</span>
                </span>
                <button onClick={() => handleUnblock(b.blocked_id!)} className="text-xs px-3 py-1 text-blue-400 hover:text-blue-300">Unblock</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
