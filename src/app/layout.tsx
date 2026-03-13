import type { Metadata } from 'next'
import './globals.css'
import NavBar from './NavBar'
import db from '@/lib/db'
import { getSessionUserIdFast as getSessionUserId } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Watch Tracker',
  description: 'Track your daily watch wear',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let isAdmin = false;
  let pendingRequestCount = 0;
  let profileUsername: string | null = null;
  try {
    const userId = await getSessionUserId();
    if (userId) {
      const user = await db.prepare('SELECT is_admin FROM users WHERE id = ?').get(userId) as any;
      isAdmin = !!user?.is_admin;

      const pendingResult = await db.prepare(
        `SELECT COUNT(*) as cnt FROM follows WHERE following_id = ? AND status = 'pending'`
      ).get(userId) as any;
      pendingRequestCount = Number(pendingResult?.cnt || 0);

      const profile = await db.prepare(
        'SELECT username FROM user_profiles WHERE user_id = ?'
      ).get(userId) as any;
      profileUsername = profile?.username || null;
    }
  } catch {}

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100">
        <NavBar isAdmin={isAdmin} pendingRequestCount={pendingRequestCount} profileUsername={profileUsername} />
        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
      </body>
    </html>
  )
}
