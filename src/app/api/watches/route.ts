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
  const result = await db.prepare('INSERT INTO watches (brand, model, reference) VALUES (?, ?, ?)').run(brand, model, normalizedReference);
  return NextResponse.json({ id: result.lastInsertRowid, brand, model, reference: normalizedReference });
}
