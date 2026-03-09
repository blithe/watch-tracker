import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUserIdFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { message, email } = await req.json();

  if (!message || message.trim().length === 0) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  const userId = getSessionUserIdFromRequest(req);

  await db.prepare(
    'INSERT INTO feedback (user_id, email, message) VALUES (?, ?, ?)'
  ).run(userId || null, email?.trim() || null, message.trim());

  return NextResponse.json({ ok: true });
}
