import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUserIdFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const userId = getSessionUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const wishlistItems = await db.prepare(`
    SELECT
      w.*,
      ph.price as latest_price,
      ph.source as latest_price_source,
      ph.recorded_at as latest_price_date
    FROM wishlist w
    LEFT JOIN (
      SELECT
        wishlist_id,
        price,
        source,
        recorded_at,
        ROW_NUMBER() OVER (PARTITION BY wishlist_id ORDER BY recorded_at DESC, id DESC) as rn
      FROM price_history
    ) ph ON w.id = ph.wishlist_id AND ph.rn = 1
    WHERE w.user_id = ?
    ORDER BY w.created_at DESC
  `).all(userId);

  return NextResponse.json(wishlistItems);
}

export async function POST(req: NextRequest) {
  const userId = getSessionUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { brand, model, reference, image_url, source_url, target_price, notes, status } = await req.json();

  const result = await db.prepare(`
    INSERT INTO wishlist (user_id, brand, model, reference, image_url, source_url, target_price, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    brand,
    model,
    reference || null,
    image_url || null,
    source_url || null,
    target_price || null,
    notes || null,
    status || 'watching'
  );

  return NextResponse.json({
    id: result.lastInsertRowid,
    brand,
    model,
    reference: reference || null,
    image_url: image_url || null,
    source_url: source_url || null,
    target_price: target_price || null,
    notes: notes || null,
    status: status || 'watching'
  });
}

export async function PATCH(req: NextRequest) {
  const userId = getSessionUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, brand, model, reference, image_url, source_url, target_price, notes, status } = await req.json();

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  const result = await db.prepare(`
    UPDATE wishlist
    SET brand = ?, model = ?, reference = ?, image_url = ?, source_url = ?, target_price = ?, notes = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(
    brand,
    model,
    reference || null,
    image_url || null,
    source_url || null,
    target_price || null,
    notes || null,
    status,
    id,
    userId
  );

  if (result.changes === 0) {
    return NextResponse.json({ error: 'Wishlist item not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const userId = getSessionUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  const result = await db.prepare('DELETE FROM wishlist WHERE id = ? AND user_id = ?').run(id, userId);

  if (result.changes === 0) {
    return NextResponse.json({ error: 'Wishlist item not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
