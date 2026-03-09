import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUserIdFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getSessionUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseInt(idStr);

  const watch = await db.prepare(`
    SELECT w.*, COUNT(wl.id) as wear_count
    FROM watches w
    LEFT JOIN wear_log wl ON w.id = wl.watch_id
    WHERE w.id = ? AND w.user_id = ?
    GROUP BY w.id
  `).get(id, userId);

  if (!watch) {
    return NextResponse.json({ error: 'Watch not found' }, { status: 404 });
  }

  const wearHistory = await db.prepare(`
    SELECT * FROM wear_log
    WHERE watch_id = ? AND user_id = ?
    ORDER BY date DESC
  `).all(id, userId);

  return NextResponse.json({ watch, wearHistory });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getSessionUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseInt(idStr);

  await db.prepare('DELETE FROM wear_log WHERE watch_id = ? AND user_id = ?').run(id, userId);
  const result = await db.prepare('DELETE FROM watches WHERE id = ? AND user_id = ?').run(id, userId);

  if (result.changes === 0) {
    return NextResponse.json({ error: 'Watch not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getSessionUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseInt(idStr);
  const data = await req.json();

  const allowedFields = ['brand', 'model', 'reference', 'image_url', 'purchase_date', 'purchase_price', 'sold_date', 'sold_price', 'status', 'notes'];
  const updates: string[] = [];
  const values: any[] = [];

  for (const field of allowedFields) {
    if (field in data) {
      updates.push(`${field} = ?`);
      if (data[field] === '' && ['reference', 'image_url', 'purchase_date', 'sold_date', 'notes'].includes(field)) {
        values.push(null);
      } else {
        values.push(data[field]);
      }
    }
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  values.push(id, userId);

  try {
    const result = await db.prepare(`
      UPDATE watches SET ${updates.join(', ')} WHERE id = ? AND user_id = ?
    `).run(...values);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Watch not found' }, { status: 404 });
    }

    const updatedWatch = await db.prepare('SELECT * FROM watches WHERE id = ?').get(id);
    return NextResponse.json(updatedWatch);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
