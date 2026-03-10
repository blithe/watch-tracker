import db from '@/lib/db';
import { getSessionUserIdFast as getSessionUserId } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminFeedbackPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const user = await db.prepare('SELECT is_admin FROM users WHERE id = ?').get(userId) as any;
  if (!user?.is_admin) redirect('/');

  const feedback = await db.prepare(`
    SELECT f.*, u.email as user_email
    FROM feedback f
    LEFT JOIN users u ON u.id = f.user_id
    ORDER BY f.created_at DESC
  `).all() as Array<{
    id: number;
    user_id: number | null;
    user_email: string | null;
    email: string | null;
    message: string;
    created_at: string;
  }>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Feedback</h1>
      {feedback.length === 0 ? (
        <p className="text-zinc-500">No feedback yet.</p>
      ) : (
        <div className="space-y-4">
          {feedback.map(f => (
            <div key={f.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <p className="text-zinc-100 whitespace-pre-wrap">{f.message}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                <span>
                  {f.user_email ? `From: ${f.user_email}` : f.email ? `Contact: ${f.email}` : 'Anonymous'}
                </span>
                <span>{new Date(f.created_at).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
