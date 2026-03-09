import db from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function StatsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const totalDaysRow = await db.prepare('SELECT COUNT(*) as c FROM wear_log WHERE user_id = ?').get(userId) as { c: number };
  const totalDays = totalDaysRow.c;

  const wearCounts = await db.prepare(`
    SELECT w.brand, w.model, w.reference, COUNT(*) as wear_count
    FROM wear_log wl JOIN watches w ON w.id = wl.watch_id
    WHERE wl.user_id = ?
    GROUP BY wl.watch_id, w.brand, w.model, w.reference ORDER BY wear_count DESC
  `).all(userId) as Array<{ brand: string; model: string; reference: string | null; wear_count: number }>;

  const mostWorn = wearCounts[0] || null;

  const allDates = await db.prepare('SELECT date FROM wear_log WHERE user_id = ? ORDER BY date DESC').all(userId) as Array<{ date: string }>;
  let streak = 0;
  if (allDates.length > 0) {
    let expected = new Date(allDates[0].date + 'T12:00:00');
    for (const row of allDates) {
      const d = new Date(row.date + 'T12:00:00');
      if (d.getTime() === expected.getTime()) {
        streak++;
        expected = new Date(expected.getTime() - 86400000);
      } else {
        break;
      }
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Stats</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-zinc-400 text-sm">Total Days Tracked</p>
          <p className="text-3xl font-bold mt-1">{totalDays}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-zinc-400 text-sm">Current Streak</p>
          <p className="text-3xl font-bold mt-1">{streak} day{streak !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-zinc-400 text-sm">Most Worn</p>
          <p className="text-xl font-bold mt-1">{mostWorn ? `${mostWorn.brand} ${mostWorn.model}` : '—'}</p>
          {mostWorn && <p className="text-zinc-500 text-sm">{mostWorn.wear_count} day{Number(mostWorn.wear_count) !== 1 ? 's' : ''}</p>}
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-3">Wear Count by Watch</h2>
      <div className="space-y-2">
        {wearCounts.map((w, i) => (
          <div key={i} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
            <span>{w.brand} {w.model} {w.reference ? `(${w.reference})` : ''}</span>
            <span className="text-zinc-400 font-mono">{w.wear_count}</span>
          </div>
        ))}
        {wearCounts.length === 0 && <p className="text-zinc-500">No data yet.</p>}
      </div>
    </div>
  );
}
