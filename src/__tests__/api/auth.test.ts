/**
 * @jest-environment node
 */

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/login/route';
import { getTestDb, resetTestDb, closeTestDb } from '@/lib/test-db';
import bcrypt from 'bcryptjs';

jest.mock('../../lib/db', () => {
  return require('../../lib/test-db').getTestDb();
});

describe('/api/auth/login', () => {
  beforeEach(() => {
    resetTestDb();
  });

  afterAll(() => {
    closeTestDb();
  });

  it('should return 400 when email or password missing', async () => {
    const req = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should return 401 for unknown email', async () => {
    const req = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@example.com', password: 'anything' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Invalid email or password');
  });

  it('should return 401 for wrong password', async () => {
    const db = getTestDb();
    const hash = bcrypt.hashSync('correct-password', 4);
    db.prepare('INSERT OR REPLACE INTO users (email, password_hash) VALUES (?, ?)').run('user@example.com', hash);

    const req = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'wrong-password' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('should return 200 and set session cookie for correct credentials', async () => {
    const db = getTestDb();
    const hash = bcrypt.hashSync('correct-password', 4);
    db.prepare('INSERT OR REPLACE INTO users (email, password_hash) VALUES (?, ?)').run('user@example.com', hash);

    const req = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'correct-password' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);

    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain('wt_session=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Path=/');
  });

  it('should normalize email to lowercase', async () => {
    const db = getTestDb();
    const hash = bcrypt.hashSync('password123', 4);
    db.prepare('INSERT OR REPLACE INTO users (email, password_hash) VALUES (?, ?)').run('user@example.com', hash);

    const req = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'USER@EXAMPLE.COM', password: 'password123' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
