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

  // Check target user exists
  const target = await db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Check not already blocked
  const existing = await db.prepare(
    'SELECT id FROM blocks WHERE blocker_id = ? AND blocked_id = ?'
  ).get(userId, targetId);
  if (existing) {
    return NextResponse.json({ error: 'Already blocked' }, { status: 409 });
  }

  // Block and remove all follow relationships in both directions
  await db.prepare('INSERT INTO blocks (blocker_id, blocked_id) VALUES (?, ?)').run(userId, targetId);
  await db.prepare('DELETE FROM follows WHERE (follower_id = ? AND following_id = ?) OR (follower_id = ? AND following_id = ?)').run(userId, targetId, targetId, userId);

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const userId = getSessionUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId: targetId } = await req.json();
  if (!targetId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const result = await db.prepare(
    'DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?'
  ).run(userId, targetId);

  if (result.changes === 0) {
    return NextResponse.json({ error: 'Block not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
