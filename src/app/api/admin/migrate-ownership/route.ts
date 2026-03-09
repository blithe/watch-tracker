import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// One-time migration: associate all orphaned records with a specific user.
// DELETE THIS FILE after running once.
export async function POST(req: NextRequest) {
  const { email, secret } = await req.json();

  if (secret !== process.env.SESSION_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const userResult = await sql`SELECT id FROM users WHERE email = ${email}`;
  if (!userResult.rows.length) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const userId = userResult.rows[0].id;

  const watches = await sql`UPDATE watches SET user_id = ${userId} WHERE user_id IS NULL`;
  const wearLog = await sql`UPDATE wear_log SET user_id = ${userId} WHERE user_id IS NULL`;
  const wishlist = await sql`UPDATE wishlist SET user_id = ${userId} WHERE user_id IS NULL`;

  return NextResponse.json({
    ok: true,
    userId,
    updated: {
      watches: watches.rowCount,
      wear_log: wearLog.rowCount,
      wishlist: wishlist.rowCount,
    },
  });
}
