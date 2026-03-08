import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const watches = await db.prepare('SELECT * FROM watches ORDER BY brand, model').all();
  return NextResponse.json(watches);
}

export async function POST(req: NextRequest) {
  const { brand, model, reference } = await req.json();
  const normalizedReference = reference === undefined || reference === '' ? null : reference;

  // Use separate queries for null/non-null reference — IS ? is SQLite-only syntax
  const existing = normalizedReference === null
    ? await db.prepare('SELECT id FROM watches WHERE brand = ? AND model = ? AND reference IS NULL').get(brand, model)
    : await db.prepare('SELECT id FROM watches WHERE brand = ? AND model = ? AND reference = ?').get(brand, model, normalizedReference);

  if (existing) {
    return NextResponse.json({ id: existing.id, brand, model, reference: normalizedReference });
  }

  const result = await db.prepare('INSERT INTO watches (brand, model, reference) VALUES (?, ?, ?)').run(brand, model, normalizedReference);
  return NextResponse.json({ id: result.lastInsertRowid, brand, model, reference: normalizedReference });
}
