'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface NavBarProps {
  isAdmin: boolean;
}

const LINKS = [
  { href: '/', label: 'Calendar' },
  { href: '/collection', label: 'Collection' },
  { href: '/wishlist', label: 'Wishlist' },
  { href: '/stats', label: 'Stats' },
  { href: '/log', label: '+ Log' },
  { href: '/feedback', label: 'Feedback' },
];

export default function NavBar({ isAdmin }: NavBarProps) {
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
              className={`text-sm hover:text-zinc-200 ${label === 'Admin' ? 'text-amber-400 hover:text-amber-200' : 'text-zinc-400'}`}>
              {label}
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
