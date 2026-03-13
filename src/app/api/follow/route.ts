import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUserIdFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const userId = getSessionUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId: targetId } = await req.json();
  if (!targetId || targetId === userId) {
    return NextResponse.json({ error: 'Invalid user' }, { status: 400 });
  }

  // Check target exists and is discoverable
  const target = await db.prepare(
    'SELECT user_id, is_discoverable FROM user_profiles WHERE user_id = ?'
  ).get(targetId) as any;
  if (!target || !target.is_discoverable) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Check not blocked (bidirectional)
  const blocked = await db.prepare(
    `SELECT id FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)`
  ).get(userId, targetId, targetId, userId);
  if (blocked) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Check not already following
  const existing = await db.prepare(
    'SELECT id, status FROM follows WHERE follower_id = ? AND following_id = ?'
  ).get(userId, targetId) as any;
  if (existing) {
    return NextResponse.json({ error: 'Already following or request pending', status: existing.status }, { status: 409 });
  }

  await db.prepare(
    'INSERT INTO follows (follower_id, following_id, status) VALUES (?, ?, ?)'
  ).run(userId, targetId, 'pending');

  return NextResponse.json({ ok: true, status: 'pending' });
}

export async function DELETE(req: NextRequest) {
  const userId = getSessionUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId: targetId } = await req.json();
  if (!targetId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const result = await db.prepare(
    'DELETE FROM follows WHERE follower_id = ? AND following_id = ?'
  ).run(userId, targetId);

  if (result.changes === 0) {
    return NextResponse.json({ error: 'Not following this user' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
