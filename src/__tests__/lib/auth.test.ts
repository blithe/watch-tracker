/**
 * @jest-environment node
 */

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

import { getSessionToken, verifyToken } from '@/lib/auth';

describe('auth', () => {
  describe('getSessionToken', () => {
    it('should return a hex string', async () => {
      const token = await getSessionToken('test');
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should return the same token for the same password', async () => {
      const token1 = await getSessionToken('password');
      const token2 = await getSessionToken('password');
      expect(token1).toBe(token2);
    });

    it('should return different tokens for different passwords', async () => {
      const token1 = await getSessionToken('password1');
      const token2 = await getSessionToken('password2');
      expect(token1).not.toBe(token2);
    });
  });

  describe('verifyToken', () => {
    it('should return true for matching tokens', () => {
      expect(verifyToken('abc123', 'abc123')).toBe(true);
    });

    it('should return false for non-matching tokens', () => {
      expect(verifyToken('abc123', 'xyz789')).toBe(false);
    });

    it('should return false for different length tokens', () => {
      expect(verifyToken('short', 'muchlongerstring')).toBe(false);
    });
  });
});
