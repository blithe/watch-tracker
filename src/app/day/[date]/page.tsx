import db from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function DayPage({ params }: { params: { date: string } }) {
  const { date } = params;

  const log = db.prepare(`
    SELECT wl.*, w.brand, w.model, w.reference, w.image_url as watch_image
    FROM wear_log wl
    JOIN watches w ON w.id = wl.watch_id
    WHERE wl.date = ?
  `).get(date) as { id: number; date: string; image_url: string | null; notes: string | null; brand: string; model: string; reference: string | null; watch_image: string | null } | undefined;

  return (
    <div>
      <Link href="/" className="text-zinc-400 hover:text-white text-sm mb-4 inline-block">← Back to Calendar</Link>
      <h1 className="text-2xl font-bold mb-6">{new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h1>

      {log ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex gap-6">
            {(log.image_url || log.watch_image) && (
              <img src={log.image_url || log.watch_image || ''} alt="" className="w-32 h-32 rounded-lg object-cover" />
            )}
            <div>
              <h2 className="text-xl font-semibold">{log.brand} {log.model}</h2>
              {log.reference && <p className="text-zinc-400 text-sm">Ref. {log.reference}</p>}
              {log.notes && <p className="mt-3 text-zinc-300">{log.notes}</p>}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-zinc-500">
          <p>No watch logged for this day.</p>
          <Link href={`/log?date=${date}`} className="text-blue-400 hover:text-blue-300 text-sm mt-2 inline-block">+ Log a watch</Link>
        </div>
      )}
    </div>
  );
}
