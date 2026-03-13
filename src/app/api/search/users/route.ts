import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUserIdFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const userId = getSessionUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  const pattern = `%${q}%`;

  const users = await db.prepare(`
    SELECT up.user_id, up.display_name, up.username, up.bio
    FROM user_profiles up
    WHERE up.is_discoverable = 1
      AND up.user_id != ?
      AND (up.username LIKE ? OR up.display_name LIKE ?)
      AND up.user_id NOT IN (
        SELECT blocked_id FROM blocks WHERE blocker_id = ?
        UNION SELECT blocker_id FROM blocks WHERE blocked_id = ?
      )
    ORDER BY up.username
    LIMIT 20
  `).all(userId, pattern, pattern, userId, userId);

  return NextResponse.json(users);
}
