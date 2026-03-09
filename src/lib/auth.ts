import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

export const COOKIE_NAME = 'wt_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSecret(): string {
  return process.env.SESSION_SECRET || 'dev-secret-change-in-production';
}

// ─── Session token ────────────────────────────────────────────────────────────
// Format: base64(userId:iat).HMAC-SHA256(base64(userId:iat), secret)

export function createSessionToken(userId: number): string {
  const payload = Buffer.from(`${userId}:${Date.now()}`).toString('base64url');
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): number | null {
  const dot = token.lastIndexOf('.');
  if (dot === -1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
  if (!timingSafeEqual(sig, expected)) return null;

  const decoded = Buffer.from(payload, 'base64url').toString();
  const [userIdStr, iatStr] = decoded.split(':');
  if (!userIdStr || !iatStr) return null;
  if (Date.now() - parseInt(iatStr) > SESSION_TTL_MS) return null;

  const userId = parseInt(userIdStr);
  return isNaN(userId) ? null : userId;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────

export function setSessionCookie(response: { cookies: any }, userId: number) {
  const token = createSessionToken(userId);
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
}

/** Get the authenticated userId from a server component (uses next/headers) */
export async function getSessionUserId(): Promise<number | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** Get the authenticated userId from an API route request */
export function getSessionUserIdFromRequest(req: NextRequest): number | null {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

// ─── Legacy compat (kept for tests that import these) ────────────────────────
/** @deprecated use verifySessionToken */
export async function getSessionToken(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode('watch-tracker-session-v1:' + password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** @deprecated use timingSafeEqual */
export function verifyToken(actual: string, expected: string): boolean {
  return timingSafeEqual(actual, expected);
}
