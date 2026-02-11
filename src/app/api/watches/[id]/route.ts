import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);

  // Get watch with wear count
  const watch = await db.prepare(`
    SELECT w.*,
           COUNT(wl.id) as wear_count
    FROM watches w
    LEFT JOIN wear_log wl ON w.id = wl.watch_id
    WHERE w.id = ?
    GROUP BY w.id
  `).get(id);

  if (!watch) {
    return NextResponse.json({ error: 'Watch not found' }, { status: 404 });
  }

  // Get wear history for this watch
  const wearHistory = await db.prepare(`
    SELECT * FROM wear_log
    WHERE watch_id = ?
    ORDER BY date DESC
  `).all(id);

  return NextResponse.json({
    watch,
    wearHistory
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  const data = await req.json();

  // Build update query dynamically based on provided fields
  const allowedFields = ['brand', 'model', 'reference', 'image_url', 'purchase_date', 'purchase_price', 'sold_date', 'sold_price', 'status', 'notes'];
  const updates: string[] = [];
  const values: any[] = [];

  for (const field of allowedFields) {
    if (field in data) {
      updates.push(`${field} = ?`);
      // Handle empty strings as null for optional fields
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

  values.push(id); // Add ID for WHERE clause

  try {
    const result = await db.prepare(`
      UPDATE watches
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Watch not found' }, { status: 404 });
    }

    // Return updated watch
    const updatedWatch = await db.prepare('SELECT * FROM watches WHERE id = ?').get(id);
    return NextResponse.json(updatedWatch);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
