import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUserIdFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const userId = getSessionUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const following = await db.prepare(`
    SELECT f.id, f.following_id, f.created_at,
           up.display_name, up.username
    FROM follows f
    JOIN user_profiles up ON up.user_id = f.following_id
    WHERE f.follower_id = ? AND f.status = 'accepted'
    ORDER BY f.created_at DESC
  `).all(userId);

  return NextResponse.json(following);
}
