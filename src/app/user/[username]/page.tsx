'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface Profile {
  user_id: number;
  display_name: string;
  username: string;
  bio: string | null;
  is_own_profile: boolean;
  follow_status: 'pending' | 'accepted' | null;
  follower_count: number;
  following_count: number;
}

interface CalendarLog {
  date: string;
  log_image: string | null;
  brand: string;
  model: string;
  watch_image: string | null;
}

interface UserEntry {
  id: number;
  follower_id?: number;
  following_id?: number;
  blocked_id?: number;
  display_name: string;
  username: string;
}

export default function UserProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Calendar state
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calLogs, setCalLogs] = useState<CalendarLog[]>([]);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Followers state (own profile only)
  const [socialTab, setSocialTab] = useState<'requests' | 'followers' | 'following' | 'blocked'>('followers');
  const [requests, setRequests] = useState<UserEntry[]>([]);
  const [followers, setFollowers] = useState<UserEntry[]>([]);
  const [following, setFollowing] = useState<UserEntry[]>([]);
  const [blocked, setBlocked] = useState<UserEntry[]>([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/profile/${username}`)
      .then(r => {
        if (!r.ok) throw new Error('User not found');
        return r.json();
      })
      .then(data => setProfile(data))
      .catch(() => setError('User not found'))
      .finally(() => setLoading(false));
  }, [username]);

  // Load social data for own profile
  useEffect(() => {
    if (!profile?.is_own_profile) return;
    Promise.all([
      fetch('/api/follow-requests').then(r => r.json()),
      fetch('/api/followers').then(r => r.json()),
      fetch('/api/following').then(r => r.json()),
      fetch('/api/blocks').then(r => r.json()),
    ]).then(([req, fol, fing, blk]) => {
      setRequests(req);
      setFollowers(fol);
      setFollowing(fing);
      setBlocked(blk);
    });
  }, [profile?.is_own_profile]);

  useEffect(() => {
    if (!profile) return;
    const monthStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`;
    fetch(`/api/profile/${username}/calendar?month=${monthStr}`)
      .then(r => r.json())
      .then(data => setCalLogs(data.logs || []))
      .catch(() => setCalLogs([]));
  }, [profile, calYear, calMonth, username]);

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  }

  async function handleFollow() {
    if (!profile) return;
    setActionLoading(true);
    await fetch('/api/follow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: profile.user_id }),
    });
    setProfile({ ...profile, follow_status: 'pending' });
    setActionLoading(false);
  }

  async function handleUnfollow() {
    if (!profile) return;
    setActionLoading(true);
    await fetch('/api/follow', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: profile.user_id }),
    });
    setProfile({ ...profile, follow_status: null });
    setActionLoading(false);
  }

  async function handleBlock() {
    if (!profile || !confirm('Block this user? This will also remove any follow relationships.')) return;
    setActionLoading(true);
    await fetch('/api/block', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: profile.user_id }),
    });
    setError('User not found');
    setProfile(null);
    setActionLoading(false);
  }

  // Social management handlers (own profile)
  async function handleAccept(userId: number) {
    await fetch('/api/follow-requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action: 'accept' }),
    });
    setRequests(prev => prev.filter(r => r.follower_id !== userId));
    const fol = await fetch('/api/followers').then(r => r.json());
    setFollowers(fol);
    setProfile(p => p ? { ...p, follower_count: p.follower_count + 1 } : p);
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
    setProfile(p => p ? { ...p, follower_count: Math.max(0, p.follower_count - 1) } : p);
  }

  async function handleUnfollowUser(userId: number) {
    await fetch('/api/follow', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    setFollowing(prev => prev.filter(f => f.following_id !== userId));
    setProfile(p => p ? { ...p, following_count: Math.max(0, p.following_count - 1) } : p);
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

  if (loading) return <div className="text-zinc-400">Loading...</div>;
  if (error) return <div className="text-zinc-400 text-center py-12">{error}</div>;
  if (!profile) return null;

  // Build calendar grid
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const monthStr = String(calMonth + 1).padStart(2, '0');
  const monthName = new Date(calYear, calMonth).toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const logMap = new Map<number, CalendarLog[]>();
  for (const log of calLogs) {
    const day = parseInt(log.date.split('-')[2]);
    const existing = logMap.get(day);
    if (existing) existing.push(log);
    else logMap.set(day, [log]);
  }

  const tabs = [
    { key: 'requests' as const, label: 'Requests', count: requests.length },
    { key: 'followers' as const, label: 'Followers', count: followers.length },
    { key: 'following' as const, label: 'Following', count: following.length },
    { key: 'blocked' as const, label: 'Blocked', count: blocked.length },
  ];

  return (
    <div>
      {/* Profile header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">@{profile.username}</h1>
        {profile.bio && <p className="text-zinc-400 mt-2">{profile.bio}</p>}

        <div className="flex items-center gap-6 mt-3 text-sm">
          <span className="text-zinc-300"><strong>{profile.follower_count}</strong> <span className="text-zinc-500">followers</span></span>
          <span className="text-zinc-300"><strong>{profile.following_count}</strong> <span className="text-zinc-500">following</span></span>
        </div>

        {!profile.is_own_profile && (
          <div className="flex items-center gap-3 mt-4">
            {profile.follow_status === null && (
              <button onClick={handleFollow} disabled={actionLoading}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm">
                Follow
              </button>
            )}
            {profile.follow_status === 'pending' && (
              <button onClick={handleUnfollow} disabled={actionLoading}
                className="px-4 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded text-sm">
                Requested
              </button>
            )}
            {profile.follow_status === 'accepted' && (
              <button onClick={handleUnfollow} disabled={actionLoading}
                className="px-4 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded text-sm">
                Following
              </button>
            )}
            <button onClick={handleBlock} disabled={actionLoading}
              className="px-4 py-1.5 text-red-400 hover:text-red-300 text-sm">
              Block
            </button>
          </div>
        )}

        {profile.is_own_profile && (
          <a href="/settings/profile"
            className="inline-block mt-4 px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-sm">
            Edit profile
          </a>
        )}
      </div>

      {/* Calendar */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="text-zinc-400 hover:text-white px-3 py-1 rounded bg-zinc-800">←</button>
          <h2 className="text-lg font-semibold">{monthName}</h2>
          <button onClick={nextMonth} className="text-zinc-400 hover:text-white px-3 py-1 rounded bg-zinc-800">→</button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {dayNames.map(d => <div key={d} className="text-center text-xs text-zinc-500 py-2">{d}</div>)}
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayLogs = logMap.get(day) ?? [];
            const firstLog = dayLogs[0];
            const cellImage = firstLog?.log_image || firstLog?.watch_image || null;
            const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
            const dateStr = `${calYear}-${monthStr}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;

            return (
              <div
                key={day}
                className={`aspect-square flex flex-col items-center justify-center rounded text-xs relative overflow-hidden
                  ${isToday ? 'ring-2 ring-blue-500' : ''}
                  ${dayLogs.length > 0 ? 'bg-zinc-800' : 'bg-zinc-900/50'}
                `}
              >
                {cellImage ? (
                  <button
                    onClick={() => setLightboxSrc(cellImage)}
                    className="absolute inset-0 w-full h-full cursor-zoom-in"
                  >
                    <img src={cellImage} alt="" className="w-full h-full object-cover" />
                    <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[10px] text-zinc-300 px-1 truncate">
                      {firstLog?.brand}
                    </span>
                    {dayLogs.length > 1 && (
                      <span className="absolute top-0.5 right-1 text-[9px] text-zinc-300 bg-black/50 rounded px-0.5">
                        +{dayLogs.length - 1}
                      </span>
                    )}
                  </button>
                ) : dayLogs.length > 0 ? (
                  <div className="text-center">
                    <span className="text-zinc-400">{day}</span>
                    <span className="block text-[9px] text-zinc-500 truncate px-1">{firstLog?.brand}</span>
                  </div>
                ) : (
                  <span className="text-zinc-600">{day}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Own profile: followers management */}
      {profile.is_own_profile && (
        <div className="mt-10 border-t border-zinc-800 pt-6">
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
                onClick={() => setSocialTab(t.key)}
                className={`px-4 py-2 text-sm border-b-2 -mb-px ${
                  socialTab === t.key
                    ? 'border-blue-500 text-zinc-100'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {t.label} {t.count > 0 && <span className="text-xs ml-1">({t.count})</span>}
              </button>
            ))}
          </div>

          {socialTab === 'requests' && (
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

          {socialTab === 'followers' && (
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

          {socialTab === 'following' && (
            <div className="space-y-2">
              {following.length === 0 && <p className="text-zinc-500 text-sm">Not following anyone</p>}
              {following.map(f => (
                <div key={f.id} className="flex items-center justify-between bg-zinc-900 rounded px-3 py-2">
                  <a href={`/user/${f.username}`} className="text-sm text-zinc-200 hover:text-white">
                    {f.display_name} <span className="text-zinc-500">@{f.username}</span>
                  </a>
                  <button onClick={() => handleUnfollowUser(f.following_id!)} className="text-xs px-3 py-1 text-red-400 hover:text-red-300">Unfollow</button>
                </div>
              ))}
            </div>
          )}

          {socialTab === 'blocked' && (
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
      )}

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <img
            src={lightboxSrc}
            alt=""
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl font-light leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
