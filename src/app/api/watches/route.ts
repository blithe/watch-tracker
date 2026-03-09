import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUserIdFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const userId = getSessionUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const watches = await db.prepare('SELECT * FROM watches WHERE user_id = ? ORDER BY brand, model').all(userId);
  return NextResponse.json(watches);
}

export async function POST(req: NextRequest) {
  const userId = getSessionUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { brand, model, reference } = await req.json();
  const normalizedReference = reference === undefined || reference === '' ? null : reference;

  // Use separate queries for null/non-null reference — IS ? is SQLite-only syntax
  const existing = normalizedReference === null
    ? await db.prepare('SELECT id FROM watches WHERE user_id = ? AND brand = ? AND model = ? AND reference IS NULL').get(userId, brand, model)
    : await db.prepare('SELECT id FROM watches WHERE user_id = ? AND brand = ? AND model = ? AND reference = ?').get(userId, brand, model, normalizedReference);

  if (existing) {
    return NextResponse.json({ id: existing.id, brand, model, reference: normalizedReference });
  }

  const result = await db.prepare('INSERT INTO watches (user_id, brand, model, reference) VALUES (?, ?, ?, ?)').run(userId, brand, model, normalizedReference);
  return NextResponse.json({ id: result.lastInsertRowid, brand, model, reference: normalizedReference });
}
