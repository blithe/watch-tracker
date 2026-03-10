/**
 * @jest-environment node
 */

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

import { createSessionToken, verifySessionToken, getSessionUserIdFast } from '@/lib/auth';

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

describe('getSessionUserIdFast', () => {
  const mockCookies = jest.requireMock('next/headers').cookies;

  it('returns userId from a valid token without re-verifying HMAC', async () => {
    process.env.SESSION_SECRET = 'test-secret-for-auth-tests';
    const token = await createSessionToken(99);
    mockCookies.mockResolvedValue({ get: () => ({ value: token }) });
    expect(await getSessionUserIdFast()).toBe(99);
  });

  it('returns null when no cookie is present', async () => {
    mockCookies.mockResolvedValue({ get: () => undefined });
    expect(await getSessionUserIdFast()).toBeNull();
  });

  it('returns null for a malformed token', async () => {
    mockCookies.mockResolvedValue({ get: () => ({ value: 'notvalid' }) });
    expect(await getSessionUserIdFast()).toBeNull();
  });
});
