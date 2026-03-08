'use client';

import { useRouter } from 'next/navigation';

export default function DeleteLogButton({ id }: { id: number }) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm('Delete this wear log entry?')) return;
    await fetch(`/api/wear-log/${id}`, { method: 'DELETE' });
    router.push('/');
  }

  return (
    <button onClick={handleDelete} className="text-sm text-red-400 hover:text-red-300">
      Delete
    </button>
  );
}
