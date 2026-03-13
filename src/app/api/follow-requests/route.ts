import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUserIdFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const userId = getSessionUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const requests = await db.prepare(`
    SELECT f.id, f.follower_id, f.created_at,
           up.display_name, up.username
    FROM follows f
    JOIN user_profiles up ON up.user_id = f.follower_id
    WHERE f.following_id = ? AND f.status = 'pending'
    ORDER BY f.created_at DESC
  `).all(userId);

  return NextResponse.json(requests);
}

export async function PATCH(req: NextRequest) {
  const userId = getSessionUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId: requesterId, action } = await req.json();

  if (!requesterId || !['accept', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'userId and action (accept|reject) are required' }, { status: 400 });
  }

  if (action === 'accept') {
    const result = await db.prepare(
      `UPDATE follows SET status = 'accepted' WHERE follower_id = ? AND following_id = ? AND status = 'pending'`
    ).run(requesterId, userId);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'No pending request found' }, { status: 404 });
    }
  } else {
    const result = await db.prepare(
      `DELETE FROM follows WHERE follower_id = ? AND following_id = ? AND status = 'pending'`
    ).run(requesterId, userId);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'No pending request found' }, { status: 404 });
    }
  }

  return NextResponse.json({ ok: true });
}
