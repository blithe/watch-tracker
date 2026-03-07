import { NextRequest, NextResponse } from 'next/server';
import { getSessionToken, verifyToken, COOKIE_NAME } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  const password = process.env.AUTH_PASSWORD;
  // No password configured = no auth required
  if (!password) return NextResponse.next();

  const { pathname } = req.nextUrl;

  // Allow login page and login API
  if (pathname === '/login' || pathname === '/api/auth/login') {
    return NextResponse.next();
  }

  // Allow db-init route (needed for first deploy)
  if (pathname === '/api/db-init') {
    return NextResponse.next();
  }

  // Check session cookie
  const session = req.cookies.get(COOKIE_NAME);
  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Verify token matches using shared auth logic
  const expected = await getSessionToken(password);

  if (!verifyToken(session.value, expected)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
