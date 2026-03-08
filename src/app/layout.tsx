import type { Metadata } from 'next'
import './globals.css'
import LogoutButton from './LogoutButton'

export const metadata: Metadata = {
  title: 'Watch Tracker',
  description: 'Track your daily watch wear',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100">
        <nav className="border-b border-zinc-800 px-6 py-4">
          <div className="mx-auto max-w-5xl flex items-center gap-6">
            <a href="/" className="text-lg font-semibold tracking-tight">⌚ Watch Tracker</a>
            <a href="/" className="text-sm text-zinc-400 hover:text-zinc-200">Calendar</a>
            <a href="/collection" className="text-sm text-zinc-400 hover:text-zinc-200">Collection</a>
            <a href="/wishlist" className="text-sm text-zinc-400 hover:text-zinc-200">Wishlist</a>
            <a href="/stats" className="text-sm text-zinc-400 hover:text-zinc-200">Stats</a>
            <a href="/log" className="text-sm text-zinc-400 hover:text-zinc-200">+ Log</a>
            <LogoutButton />
          </div>
        </nav>
        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
      </body>
    </html>
  )
}
