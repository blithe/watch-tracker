import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

export const COOKIE_NAME = 'wt_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSecret(): string {
  return process.env.SESSION_SECRET || 'dev-secret-change-in-production';
}

// ─── Web Crypto helpers (work in Edge Runtime AND Node.js 18+) ────────────────

async function hmacSha256Hex(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function b64urlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64urlDecode(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return atob(base64 + '='.repeat((4 - base64.length % 4) % 4));
}

// ─── Session token ────────────────────────────────────────────────────────────
// Format: base64url(userId:iat).HMAC-SHA256(payload, secret)

export async function createSessionToken(userId: number): Promise<string> {
  const payload = b64urlEncode(`${userId}:${Date.now()}`);
  const sig = await hmacSha256Hex(payload, getSecret());
  return `${payload}.${sig}`;
}

/** Full verification (HMAC + expiry). Async — works in Edge Runtime. */
export async function verifySessionToken(token: string): Promise<number | null> {
  const dot = token.lastIndexOf('.');
  if (dot === -1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = await hmacSha256Hex(payload, getSecret());

  // Timing-safe compare
  if (expected.length !== sig.length) return null;
  const enc = new TextEncoder();
  const a = enc.encode(expected);
  const b = enc.encode(sig);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  if (diff !== 0) return null;

  return decodePayload(payload);
}

/** Decode payload only — no HMAC verify. Safe to call in route handlers
 *  because middleware has already verified the signature for all protected paths. */
function decodePayload(payload: string): number | null {
  try {
    const decoded = b64urlDecode(payload);
    const [userIdStr, iatStr] = decoded.split(':');
    if (!userIdStr || !iatStr) return null;
    if (Date.now() - parseInt(iatStr) > SESSION_TTL_MS) return null;
    const userId = parseInt(userIdStr);
    return isNaN(userId) ? null : userId;
  } catch { return null; }
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────

/** Get the authenticated userId from a server component (uses next/headers) */
export async function getSessionUserId(): Promise<number | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** Get the authenticated userId from an API route request.
 *  Decodes the payload without re-verifying HMAC (middleware already did that). */
export function getSessionUserIdFromRequest(req: NextRequest): number | null {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot === -1) return null;
  return decodePayload(token.slice(0, dot));
}

