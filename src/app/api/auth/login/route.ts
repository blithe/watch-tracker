import { NextRequest, NextResponse } from 'next/server';
import { getSessionToken, verifyToken, COOKIE_NAME } from '@/lib/auth';

// Simple in-memory rate limiter: max 10 attempts per IP per 15 minutes
const attempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return false;
  }
  entry.count++;
  return entry.count > 10;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many attempts, try again later' }, { status: 429 });
  }

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
