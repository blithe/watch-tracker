import { cookies } from 'next/headers';
import { timingSafeEqual } from 'crypto';

const COOKIE_NAME = 'wt_session';

const SALT = 'watch-tracker-session-v1';

export async function getSessionToken(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(SALT + ':' + password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function verifyToken(actual: string, expected: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(actual);
  const b = encoder.encode(expected);
  if (a.byteLength !== b.byteLength) {
    // Compare expected against itself to consume constant time, then return false
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE_NAME);
  if (!session) return false;

  const password = process.env.AUTH_PASSWORD;
  if (!password) return true; // No password set = no auth required

  const expected = await getSessionToken(password);
  return verifyToken(session.value, expected);
}

export { COOKIE_NAME };
