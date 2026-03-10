/**
 * @jest-environment node
 */

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

import { createSessionToken, verifySessionToken } from '@/lib/auth';

describe('session tokens', () => {
  beforeAll(() => {
    process.env.SESSION_SECRET = 'test-secret-for-auth-tests';
  });

  it('createSessionToken returns a payload.signature string', async () => {
    const token = await createSessionToken(42);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[0-9a-f]{64}$/);
  });

  it('verifySessionToken returns the userId for a valid token', async () => {
    const token = await createSessionToken(7);
    const userId = await verifySessionToken(token);
    expect(userId).toBe(7);
  });

  it('verifySessionToken returns null for a tampered token', async () => {
    const token = await createSessionToken(1);
    const tampered = token.slice(0, -4) + 'aaaa';
    expect(await verifySessionToken(tampered)).toBeNull();
  });

  it('verifySessionToken returns null for a token signed with a different secret', async () => {
    const token = await createSessionToken(1);
    process.env.SESSION_SECRET = 'different-secret';
    expect(await verifySessionToken(token)).toBeNull();
    process.env.SESSION_SECRET = 'test-secret-for-auth-tests';
  });

  it('verifySessionToken returns null for a malformed token', async () => {
    expect(await verifySessionToken('notavalidtoken')).toBeNull();
    expect(await verifySessionToken('')).toBeNull();
  });
});
