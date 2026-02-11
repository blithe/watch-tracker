import { NextRequest, NextResponse } from 'next/server';
import { getSessionToken, verifyToken, COOKIE_NAME } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const expected = process.env.AUTH_PASSWORD;

  if (!expected) {
    return NextResponse.json({ error: 'No password configured' }, { status: 500 });
  }

  // Timing-safe comparison of password hashes
  const inputHash = await getSessionToken(password);
  const expectedHash = await getSessionToken(expected);
  if (!verifyToken(inputHash, expectedHash)) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const token = await getSessionToken(password);
  const response = NextResponse.json({ ok: true });

  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });

  return response;
}
