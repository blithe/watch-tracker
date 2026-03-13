'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface NavBarProps {
  isAdmin: boolean;
  pendingRequestCount?: number;
}

const LINKS = [
  { href: '/feed', label: 'Feed' },
  { href: '/', label: 'Calendar' },
  { href: '/collection', label: 'Collection' },
  { href: '/wishlist', label: 'Wishlist' },
  { href: '/stats', label: 'Stats' },
  { href: '/log', label: '+ Log' },
  { href: '/settings/profile', label: 'Profile' },
  { href: '/feedback', label: 'Feedback' },
];

export default function NavBar({ isAdmin, pendingRequestCount = 0 }: NavBarProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const links = isAdmin ? [...LINKS, { href: '/admin', label: 'Admin' }] : LINKS;

  return (
    <nav className="border-b border-zinc-800 px-6 py-4">
      <div className="mx-auto max-w-5xl flex items-center justify-between">
        <a href="/" className="text-lg font-semibold tracking-tight shrink-0">⌚ Watch Tracker</a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6">
          {links.map(({ href, label }) => (
            <a key={href} href={href}
              className={`text-sm hover:text-zinc-200 relative ${label === 'Admin' ? 'text-amber-400 hover:text-amber-200' : 'text-zinc-400'}`}>
              {label}
              {label === 'Profile' && pendingRequestCount > 0 && (
                <span className="absolute -top-2 -right-3 bg-blue-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {pendingRequestCount > 9 ? '9+' : pendingRequestCount}
                </span>
              )}
            </a>
          ))}
          <button onClick={handleLogout} className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
            Log out
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-zinc-400 hover:text-white p-1 text-xl leading-none"
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden mx-auto max-w-5xl mt-3 flex flex-col border-t border-zinc-800 pt-3">
          {links.map(({ href, label }) => (
            <a key={href} href={href}
              className={`py-2.5 text-sm border-b border-zinc-900 ${label === 'Admin' ? 'text-amber-400' : 'text-zinc-300 hover:text-white'}`}>
              {label}
              {label === 'Profile' && pendingRequestCount > 0 && (
                <span className="ml-2 bg-blue-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                  {pendingRequestCount > 9 ? '9+' : pendingRequestCount}
                </span>
              )}
            </a>
          ))}
          <button onClick={handleLogout} className="text-left py-2.5 text-sm text-zinc-500 hover:text-zinc-300">
            Log out
          </button>
        </div>
      )}
    </nav>
  );
}
