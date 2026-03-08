'use client';

import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <button
      onClick={handleLogout}
      className="ml-auto text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
    >
      Log out
    </button>
  );
}
