import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        is_admin INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        reset_token TEXT,
        reset_token_expires TEXT
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS watches (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
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
        user_id INTEGER REFERENCES users(id),
        watch_id INTEGER NOT NULL REFERENCES watches(id),
        date TEXT NOT NULL,
        image_url TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS wishlist (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
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

    await sql`
      CREATE TABLE IF NOT EXISTS feedback (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        email TEXT,
        message TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Migrations for existing databases
    await sql`ALTER TABLE watches ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)`;
    await sql`ALTER TABLE wear_log ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)`;
    await sql`ALTER TABLE wishlist ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)`;
    await sql`ALTER TABLE wishlist ADD COLUMN IF NOT EXISTS source_url TEXT`;

    // Drop unique constraints on wear_log date — users can log multiple watches per day
    await sql`ALTER TABLE wear_log DROP CONSTRAINT IF EXISTS wear_log_date_key`;
    await sql`ALTER TABLE wear_log DROP CONSTRAINT IF EXISTS wear_log_user_date_key`;

    // Social feed tables
    await sql`
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id INTEGER PRIMARY KEY REFERENCES users(id),
        display_name TEXT NOT NULL,
        username TEXT UNIQUE NOT NULL,
        bio TEXT,
        is_discoverable INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS follows (
        id SERIAL PRIMARY KEY,
        follower_id INTEGER NOT NULL REFERENCES users(id),
        following_id INTEGER NOT NULL REFERENCES users(id),
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(follower_id, following_id)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS blocks (
        id SERIAL PRIMARY KEY,
        blocker_id INTEGER NOT NULL REFERENCES users(id),
        blocked_id INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(blocker_id, blocked_id)
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON blocks(blocker_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks(blocked_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username)`;

    return NextResponse.json({ ok: true, message: 'All tables created/migrated' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
