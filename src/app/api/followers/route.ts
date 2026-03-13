import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUserIdFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const userId = getSessionUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const followers = await db.prepare(`
    SELECT f.id, f.follower_id, f.created_at,
           up.display_name, up.username
    FROM follows f
    JOIN user_profiles up ON up.user_id = f.follower_id
    WHERE f.following_id = ? AND f.status = 'accepted'
    ORDER BY f.created_at DESC
  `).all(userId);

  return NextResponse.json(followers);
}

export async function DELETE(req: NextRequest) {
  const userId = getSessionUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId: followerId } = await req.json();
  if (!followerId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const result = await db.prepare(
    `DELETE FROM follows WHERE follower_id = ? AND following_id = ? AND status = 'accepted'`
  ).run(followerId, userId);

  if (result.changes === 0) {
    return NextResponse.json({ error: 'Follower not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
