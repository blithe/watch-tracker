'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function FeedbackPage() {
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, email }),
    });

    if (res.ok) {
      setSent(true);
    } else {
      const data = await res.json();
      setError(data.error || 'Failed to send feedback');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">⌚</div>
          <h1 className="text-2xl font-bold text-white">Send Feedback</h1>
          <p className="text-zinc-400 text-sm mt-1">Help improve Watch Tracker</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8">
          {sent ? (
            <div className="text-center">
              <p className="text-green-400 mb-2">Thanks for your feedback!</p>
              <Link href="/login" className="text-blue-400 hover:text-blue-300 text-sm">Back to sign in</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Your feedback, feature request, or bug report..."
                required
                rows={5}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-none"
                autoFocus
              />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email (optional, for replies)"
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send feedback'}
              </button>
            </form>
          )}
        </div>
        <div className="text-center mt-4">
          <Link href="/login" className="text-zinc-500 hover:text-zinc-400 text-sm">← Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
