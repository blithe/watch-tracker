import db from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const user = await db.prepare('SELECT is_admin FROM users WHERE id = ?').get(userId) as any;
  if (!user?.is_admin) redirect('/');

  const users = await db.prepare(`
    SELECT u.id, u.email, u.is_admin, u.created_at,
      COUNT(DISTINCT w.id) as watch_count,
      COUNT(DISTINCT wl.id) as wear_count,
      MAX(wl.date) as last_wear
    FROM users u
    LEFT JOIN watches w ON w.user_id = u.id
    LEFT JOIN wear_log wl ON wl.user_id = u.id
    GROUP BY u.id, u.email, u.is_admin, u.created_at
    ORDER BY u.created_at ASC
  `).all() as Array<{
    id: number;
    email: string;
    is_admin: number;
    created_at: string;
    watch_count: number;
    wear_count: number;
    last_wear: string | null;
  }>;

  const totals = await db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM users) as user_count,
      (SELECT COUNT(*) FROM watches) as watch_count,
      (SELECT COUNT(*) FROM wear_log) as wear_count,
      (SELECT COUNT(*) FROM feedback) as feedback_count
  `).get() as { user_count: number; watch_count: number; wear_count: number; feedback_count: number };

  const recentFeedback = await db.prepare(`
    SELECT f.message, f.created_at, u.email as user_email, f.email as contact_email
    FROM feedback f
    LEFT JOIN users u ON u.id = f.user_id
    ORDER BY f.created_at DESC
    LIMIT 5
  `).all() as Array<{ message: string; created_at: string; user_email: string | null; contact_email: string | null }>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Admin</h1>
        <Link href="/admin/feedback" className="text-sm text-zinc-400 hover:text-white">
          View all feedback →
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Users', value: Number(totals.user_count) },
          { label: 'Watches', value: Number(totals.watch_count) },
          { label: 'Wear Logs', value: Number(totals.wear_count) },
          { label: 'Feedback', value: Number(totals.feedback_count) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-400 text-sm">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* User table */}
      <h2 className="text-lg font-semibold mb-3">Users</h2>
      <div className="overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500 border-b border-zinc-800">
              <th className="pb-2 pr-4 font-medium">Email</th>
              <th className="pb-2 pr-4 font-medium">Joined</th>
              <th className="pb-2 pr-4 font-medium text-right">Watches</th>
              <th className="pb-2 pr-4 font-medium text-right">Wears</th>
              <th className="pb-2 font-medium">Last Wear</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-zinc-900 hover:bg-zinc-900/50">
                <td className="py-3 pr-4">
                  {u.email}
                  {u.is_admin ? <span className="ml-2 text-xs text-amber-400">admin</span> : null}
                </td>
                <td className="py-3 pr-4 text-zinc-400">
                  {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
                <td className="py-3 pr-4 text-right tabular-nums">{Number(u.watch_count)}</td>
                <td className="py-3 pr-4 text-right tabular-nums">{Number(u.wear_count)}</td>
                <td className="py-3 text-zinc-400">{u.last_wear ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent feedback */}
      <h2 className="text-lg font-semibold mb-3">Recent Feedback</h2>
      {recentFeedback.length === 0 ? (
        <p className="text-zinc-500 text-sm">No feedback yet.</p>
      ) : (
        <div className="space-y-3">
          {recentFeedback.map((f, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <p className="text-zinc-100 whitespace-pre-wrap text-sm">{f.message}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
                <span>{f.user_email ?? f.contact_email ?? 'Anonymous'}</span>
                <span>{new Date(f.created_at).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
