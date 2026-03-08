import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const date = searchParams.get('date');
  const month = searchParams.get('month');

  if (date) {
    const log = await db.prepare(`
      SELECT wl.*, w.brand, w.model, w.reference, w.image_url as watch_image
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date = ?
    `).get(date);
    return NextResponse.json(log || null);
  }

  if (month) {
    const logs = await db.prepare(`
      SELECT wl.*, w.brand, w.model, w.reference, w.image_url as watch_image
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date LIKE ?
      ORDER BY wl.date
    `).all(`${month}-%`);
    return NextResponse.json(logs);
  }

  const logs = await db.prepare(`
    SELECT wl.*, w.brand, w.model, w.reference, w.image_url as watch_image
    FROM wear_log wl
    JOIN watches w ON w.id = wl.watch_id
    ORDER BY wl.date DESC
  `).all();
  return NextResponse.json(logs);
}

export async function POST(req: NextRequest) {
  const { watch_id, date, image_url, notes } = await req.json();
  try {
    await db.prepare('INSERT INTO wear_log (watch_id, date, image_url, notes) VALUES (?, ?, ?, ?)').run(
      watch_id, date, image_url || null, notes || null
    );
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.message?.includes('UNIQUE') || e.code === '23505') {
      return NextResponse.json({ error: 'Already logged a watch for this date' }, { status: 400 });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
