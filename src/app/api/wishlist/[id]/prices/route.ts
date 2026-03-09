import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUserIdFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getSessionUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: wishlistId } = await params;

  if (!wishlistId) {
    return NextResponse.json({ error: 'Wishlist ID is required' }, { status: 400 });
  }

  const wishlistItem = await db.prepare('SELECT id FROM wishlist WHERE id = ? AND user_id = ?').get(wishlistId, userId);
  if (!wishlistItem) {
    return NextResponse.json({ error: 'Wishlist item not found' }, { status: 404 });
  }

  const priceHistory = await db.prepare(`
    SELECT * FROM price_history
    WHERE wishlist_id = ?
    ORDER BY recorded_at DESC, id DESC
  `).all(wishlistId);

  return NextResponse.json(priceHistory);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getSessionUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: wishlistId } = await params;
  const { price, source, url } = await req.json();

  if (!wishlistId) {
    return NextResponse.json({ error: 'Wishlist ID is required' }, { status: 400 });
  }

  if (!price || isNaN(Number(price))) {
    return NextResponse.json({ error: 'Valid price is required' }, { status: 400 });
  }

  const wishlistItem = await db.prepare('SELECT id FROM wishlist WHERE id = ? AND user_id = ?').get(wishlistId, userId);
  if (!wishlistItem) {
    return NextResponse.json({ error: 'Wishlist item not found' }, { status: 404 });
  }

  try {
    const result = await db.prepare(`
      INSERT INTO price_history (wishlist_id, price, source, url)
      VALUES (?, ?, ?, ?)
    `).run(
      wishlistId,
      Number(price),
      source || null,
      url || null
    );

    return NextResponse.json({
      id: result.lastInsertRowid,
      wishlist_id: Number(wishlistId),
      price: Number(price),
      source: source || null,
      url: url || null
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
