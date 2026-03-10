import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUserIdFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const userId = getSessionUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const date = searchParams.get('date');
  const month = searchParams.get('month');

  if (date) {
    const log = await db.prepare(`
      SELECT wl.*, w.brand, w.model, w.reference, w.image_url as watch_image
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date = ? AND wl.user_id = ?
    `).get(date, userId);
    return NextResponse.json(log || null);
  }

  if (month) {
    const logs = await db.prepare(`
      SELECT wl.*, w.brand, w.model, w.reference, w.image_url as watch_image
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date LIKE ? AND wl.user_id = ?
      ORDER BY wl.date
    `).all(`${month}-%`, userId);
    return NextResponse.json(logs);
  }

  const logs = await db.prepare(`
    SELECT wl.*, w.brand, w.model, w.reference, w.image_url as watch_image
    FROM wear_log wl
    JOIN watches w ON w.id = wl.watch_id
    WHERE wl.user_id = ?
    ORDER BY wl.date DESC
  `).all(userId);
  return NextResponse.json(logs);
}

export async function POST(req: NextRequest) {
  const userId = getSessionUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { watch_id, date, image_url, notes } = await req.json();

  if (!watch_id || !date) {
    return NextResponse.json({ error: 'watch_id and date are required' }, { status: 400 });
  }

  // Verify the watch belongs to this user
  const watch = await db.prepare('SELECT id FROM watches WHERE id = ? AND user_id = ?').get(watch_id, userId);
  if (!watch) {
    return NextResponse.json({ error: 'Watch not found' }, { status: 404 });
  }

  // Check if user already has a log for this date
  const existing = await db.prepare(
    'SELECT id FROM wear_log WHERE user_id = ? AND date = ?'
  ).get(userId, date);
  if (existing) {
    return NextResponse.json({ error: 'Already logged a watch for this date' }, { status: 400 });
  }

  try {
    await db.prepare(
      'INSERT INTO wear_log (user_id, watch_id, date, image_url, notes) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, watch_id, date, image_url || null, notes || null);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.message?.includes('UNIQUE constraint failed') || e.code === '23505') {
      return NextResponse.json({ error: 'Already logged a watch for this date' }, { status: 400 });
    }
    if (e.message?.includes('FOREIGN KEY') || e.code === '23503') {
      return NextResponse.json({ error: 'Watch not found' }, { status: 400 });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
