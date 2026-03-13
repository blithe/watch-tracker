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
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month'); // YYYY-MM

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month param required (YYYY-MM)' }, { status: 400 });
  }

  try {
    // Look up the target user
    const profile = await db.prepare(
      'SELECT user_id, is_discoverable FROM user_profiles WHERE username = ?'
    ).get(username) as any;

    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const targetId = profile.user_id;

    // Check blocked
    const blocked = await db.prepare(
      `SELECT id FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)`
    ).get(userId, targetId, targetId, userId);
    if (blocked) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Must be own profile, or following (accepted), or discoverable
    const isOwn = targetId === userId;
    let canView = isOwn;

    if (!canView) {
      const follow = await db.prepare(
        `SELECT id FROM follows WHERE follower_id = ? AND following_id = ? AND status = 'accepted'`
      ).get(userId, targetId);
      canView = !!follow;
    }

    if (!canView && !profile.is_discoverable) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // For non-followers of discoverable users, show the calendar but without details
    const logs = await db.prepare(`
      SELECT wl.date, wl.image_url as log_image, w.brand, w.model, w.image_url as watch_image
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date LIKE ? AND wl.user_id = ?
      ORDER BY wl.date, wl.id
    `).all(`${month}-%`, targetId);

    return NextResponse.json({ logs, canView });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
