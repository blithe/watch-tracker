import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUserIdFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const userId = getSessionUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const blocked = await db.prepare(`
    SELECT b.id, b.blocked_id, b.created_at,
           up.display_name, up.username
    FROM blocks b
    LEFT JOIN user_profiles up ON up.user_id = b.blocked_id
    WHERE b.blocker_id = ?
    ORDER BY b.created_at DESC
  `).all(userId);

  return NextResponse.json(blocked);
}
