import db, { WearLogWithWatch } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; year?: string }> }) {
  const { month: monthParam, year: yearParam } = await searchParams;
  const now = new Date();
  const year = yearParam ? parseInt(yearParam) : now.getFullYear();
  const month = monthParam ? parseInt(monthParam) - 1 : now.getMonth();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const monthStr = String(month + 1).padStart(2, '0');

  const logs = db.prepare(`
    SELECT w.*, wl.id as wl_id, wl.date, wl.image_url as log_image, wl.notes
    FROM wear_log wl
    JOIN watches w ON w.id = wl.watch_id
    WHERE wl.date LIKE ?
    ORDER BY wl.date
  `).all(`${year}-${monthStr}-%`) as Array<{ id: number; brand: string; model: string; reference: string; image_url: string | null; date: string; log_image: string | null; notes: string | null }>;

  const logMap = new Map<number, typeof logs[0]>();
  for (const log of logs) {
    const day = parseInt(log.date.split('-')[2]);
    logMap.set(day, log);
  }

  const prevMonth = month === 0 ? 12 : month;
  const prevYear = month === 0 ? year - 1 : year;
  const nextMonth = month === 11 ? 1 : month + 2;
  const nextYear = month === 11 ? year + 1 : year;

  const monthName = new Date(year, month).toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Link href={`/?year=${prevYear}&month=${prevMonth}`} className="text-zinc-400 hover:text-white px-3 py-1 rounded bg-zinc-800">←</Link>
        <h1 className="text-2xl font-bold">{monthName}</h1>
        <Link href={`/?year=${nextYear}&month=${nextMonth}`} className="text-zinc-400 hover:text-white px-3 py-1 rounded bg-zinc-800">→</Link>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map(d => <div key={d} className="text-center text-xs text-zinc-500 py-2">{d}</div>)}
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const log = logMap.get(day);
          const dateStr = `${year}-${monthStr}-${String(day).padStart(2, '0')}`;
          const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
          const isToday = dateStr === todayStr;
          return (
            <Link
              key={day}
              href={`/day/${dateStr}`}
              className={`aspect-square rounded-lg border flex flex-col items-center justify-center gap-1 text-xs transition-colors
                ${isToday ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-800 hover:border-zinc-600'}
                ${log ? 'bg-zinc-800/50' : ''}`}
            >
              <span className={`${isToday ? 'text-blue-400 font-bold' : 'text-zinc-400'}`}>{day}</span>
              {log && (
                log.log_image || log.image_url ? (
                  <img src={log.log_image || log.image_url || ''} alt="" className="w-8 h-8 rounded object-cover" />
                ) : (
                  <span className="text-[10px] text-zinc-500 text-center leading-tight">{log.brand}</span>
                )
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
