import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);

  const log = await db.prepare(`
    SELECT wl.*, w.brand, w.model, w.reference, w.image_url as watch_image
    FROM wear_log wl
    JOIN watches w ON w.id = wl.watch_id
    WHERE wl.id = ?
  `).get(id);

  if (!log) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }

  return NextResponse.json(log);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);

  const result = await db.prepare('DELETE FROM wear_log WHERE id = ?').run(id);

  if (result.changes === 0) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
