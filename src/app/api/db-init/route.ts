import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS watches (
        id SERIAL PRIMARY KEY,
        brand TEXT NOT NULL,
        model TEXT NOT NULL,
        reference TEXT,
        image_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        purchase_date TEXT,
        purchase_price REAL,
        sold_date TEXT,
        sold_price REAL,
        status TEXT DEFAULT 'owned',
        notes TEXT
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS wear_log (
        id SERIAL PRIMARY KEY,
        watch_id INTEGER NOT NULL REFERENCES watches(id),
        date TEXT NOT NULL UNIQUE,
        image_url TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS wishlist (
        id SERIAL PRIMARY KEY,
        brand TEXT NOT NULL,
        model TEXT NOT NULL,
        reference TEXT,
        image_url TEXT,
        source_url TEXT,
        target_price REAL,
        notes TEXT,
        status TEXT DEFAULT 'watching',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`ALTER TABLE wishlist ADD COLUMN IF NOT EXISTS source_url TEXT`;

    await sql`
      CREATE TABLE IF NOT EXISTS price_history (
        id SERIAL PRIMARY KEY,
        wishlist_id INTEGER NOT NULL REFERENCES wishlist(id) ON DELETE CASCADE,
        price REAL NOT NULL,
        source TEXT,
        url TEXT,
        recorded_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    return NextResponse.json({ ok: true, message: 'All tables created' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
