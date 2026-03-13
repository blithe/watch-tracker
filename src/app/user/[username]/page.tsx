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
}

interface WristShot {
  id: number;
  date: string;
  image_url: string;
  brand: string;
  model: string;
}

export default function UserProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [shots, setShots] = useState<WristShot[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/profile/${username}`)
      .then(r => {
        if (!r.ok) throw new Error('User not found');
        return r.json();
      })
      .then(data => {
        setProfile(data);
        // Load wrist shots if following or own profile
        if (data.is_own_profile || data.follow_status === 'accepted') {
          return fetch(`/api/feed?limit=50`).then(r => r.json()).then(feed => {
            setShots(feed.items.filter((i: any) => i.user_id === data.user_id));
          });
        }
      })
      .catch(() => setError('User not found'))
      .finally(() => setLoading(false));
  }, [username]);

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
    setShots([]);
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

  if (loading) return <div className="text-zinc-400">Loading...</div>;
  if (error) return <div className="text-zinc-400 text-center py-12">{error}</div>;
  if (!profile) return null;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">{profile.display_name}</h1>
        <p className="text-zinc-500">@{profile.username}</p>
        {profile.bio && <p className="text-zinc-400 mt-2">{profile.bio}</p>}

        {!profile.is_own_profile && (
          <div className="flex items-center gap-3 mt-4">
            {profile.follow_status === null && (
              <button
                onClick={handleFollow}
                disabled={actionLoading}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm"
              >
                Follow
              </button>
            )}
            {profile.follow_status === 'pending' && (
              <button
                onClick={handleUnfollow}
                disabled={actionLoading}
                className="px-4 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded text-sm"
              >
                Requested
              </button>
            )}
            {profile.follow_status === 'accepted' && (
              <button
                onClick={handleUnfollow}
                disabled={actionLoading}
                className="px-4 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded text-sm"
              >
                Following
              </button>
            )}
            <button
              onClick={handleBlock}
              disabled={actionLoading}
              className="px-4 py-1.5 text-red-400 hover:text-red-300 text-sm"
            >
              Block
            </button>
          </div>
        )}

        {profile.is_own_profile && (
          <a
            href="/settings/profile"
            className="inline-block mt-4 px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-sm"
          >
            Edit profile
          </a>
        )}
      </div>

      {shots.length > 0 ? (
        <div>
          <h2 className="text-lg font-semibold mb-4">Wrist Shots</h2>
          <div className="grid grid-cols-3 gap-2">
            {shots.map(shot => (
              <div key={shot.id} className="aspect-square relative group">
                <img
                  src={shot.image_url}
                  alt={`${shot.brand} ${shot.model}`}
                  className="w-full h-full object-cover rounded"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-end p-2">
                  <span className="text-xs text-white">{shot.brand} {shot.model}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : profile.follow_status === 'accepted' || profile.is_own_profile ? (
        <p className="text-zinc-500 text-center py-8">No wrist shots yet</p>
      ) : (
        <p className="text-zinc-500 text-center py-8">Follow this user to see their wrist shots</p>
      )}
    </div>
  );
}
