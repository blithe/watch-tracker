import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUserIdFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ username: string }> }
) {
  const userId = getSessionUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { username } = await props.params;

  const profile = await db.prepare(
    'SELECT * FROM user_profiles WHERE username = ?'
  ).get(username) as any;

  if (!profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Check if blocked (bidirectional)
  const blocked = await db.prepare(
    `SELECT id FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)`
  ).get(userId, profile.user_id, profile.user_id, userId);

  if (blocked) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Check if discoverable (own profile always visible)
  if (profile.user_id !== userId && !profile.is_discoverable) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Check follow status
  const followStatus = await db.prepare(
    'SELECT status FROM follows WHERE follower_id = ? AND following_id = ?'
  ).get(userId, profile.user_id) as any;

  // Get follower/following counts
  const followerCount = await db.prepare(
    `SELECT COUNT(*) as cnt FROM follows WHERE following_id = ? AND status = 'accepted'`
  ).get(profile.user_id) as any;
  const followingCount = await db.prepare(
    `SELECT COUNT(*) as cnt FROM follows WHERE follower_id = ? AND status = 'accepted'`
  ).get(profile.user_id) as any;

  return NextResponse.json({
    user_id: profile.user_id,
    display_name: profile.display_name,
    username: profile.username,
    bio: profile.bio,
    is_own_profile: profile.user_id === userId,
    follow_status: followStatus?.status || null,
    follower_count: Number(followerCount?.cnt || 0),
    following_count: Number(followingCount?.cnt || 0),
  });
}
