'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface Watch {
  id: number;
  brand: string;
  model: string;
  reference: string | null;
}

interface ExistingLog {
  id: number;
  watch_id: number;
  image_url: string | null;
  notes: string | null;
}

export default function LogPage() {
  return <Suspense fallback={<div>Loading...</div>}><LogForm /></Suspense>;
}

function LogForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const defaultDate = searchParams.get('date') || todayStr;

  const [watches, setWatches] = useState<Watch[]>([]);
  const [date, setDate] = useState(defaultDate);
  const [watchId, setWatchId] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newRef, setNewRef] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [existingLog, setExistingLog] = useState<ExistingLog | null>(null);

  useEffect(() => {
    fetch('/api/watches').then(r => r.json()).then(setWatches);
  }, []);

  useEffect(() => {
    if (!date) return;
    fetch(`/api/wear-log?date=${date}`)
      .then(r => r.json())
      .then((log: ExistingLog | null) => {
        if (log) {
          setExistingLog(log);
          setWatchId(String(log.watch_id));
          setNotes(log.notes || '');
          setMode('existing');
        } else {
          setExistingLog(null);
          setWatchId('');
          setNotes('');
        }
      });
  }, [date]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let selectedWatchId = watchId;

      if (mode === 'new') {
        if (!newBrand || !newModel) { setError('Brand and model required'); setLoading(false); return; }
        const res = await fetch('/api/watches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brand: newBrand, model: newModel, reference: newRef }),
        });
        const w = await res.json();
        selectedWatchId = w.id;
      }

      if (!selectedWatchId) { setError('Select or create a watch'); setLoading(false); return; }

      let imageUrl = existingLog?.image_url || '';
      if (photo) {
        const fd = new FormData();
        fd.append('file', photo);
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const data = await res.json();
        imageUrl = data.url;
      }

      if (existingLog) {
        // Update existing entry
        const res = await fetch(`/api/wear-log/${existingLog.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ watch_id: Number(selectedWatchId), image_url: imageUrl, notes }),
        });
        if (!res.ok) {
          const d = await res.json();
          setError(d.error || 'Failed to update');
          setLoading(false);
          return;
        }
      } else {
        // Create new entry
        const res = await fetch('/api/wear-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ watch_id: Number(selectedWatchId), date, image_url: imageUrl, notes }),
        });
        if (!res.ok) {
          const d = await res.json();
          setError(d.error || 'Failed to log');
          setLoading(false);
          return;
        }
      }

      router.push(`/day/${date}`);
    } catch (err) {
      setError('Something went wrong');
      setLoading(false);
    }
  }

  const inputCls = "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500";

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-2">{existingLog ? 'Edit Log Entry' : 'Log a Watch'}</h1>
      {existingLog && <p className="text-sm text-zinc-400 mb-6">Updating existing entry — change the photo, notes, or watch.</p>}
      {!existingLog && <div className="mb-6" />}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} required />
        </div>

        <div className="flex gap-2 mb-2">
          <button type="button" onClick={() => setMode('existing')} className={`text-sm px-3 py-1 rounded ${mode === 'existing' ? 'bg-blue-600' : 'bg-zinc-800'}`}>Existing Watch</button>
          <button type="button" onClick={() => setMode('new')} className={`text-sm px-3 py-1 rounded ${mode === 'new' ? 'bg-blue-600' : 'bg-zinc-800'}`}>New Watch</button>
        </div>

        {mode === 'existing' ? (
          <select value={watchId} onChange={e => setWatchId(e.target.value)} className={inputCls} required>
            <option value="">Select a watch...</option>
            {watches.map(w => <option key={w.id} value={w.id}>{w.brand} {w.model} {w.reference ? `(${w.reference})` : ''}</option>)}
          </select>
        ) : (
          <div className="space-y-2">
            <input placeholder="Brand" value={newBrand} onChange={e => setNewBrand(e.target.value)} className={inputCls} />
            <input placeholder="Model" value={newModel} onChange={e => setNewModel(e.target.value)} className={inputCls} />
            <input placeholder="Reference (optional)" value={newRef} onChange={e => setNewRef(e.target.value)} className={inputCls} />
          </div>
        )}

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Photo (optional)</label>
          {existingLog?.image_url && !photo && (
            <img src={existingLog.image_url} alt="" className="w-20 h-20 rounded-lg object-cover mb-2" />
          )}
          <input type="file" accept="image/*" onChange={e => setPhoto(e.target.files?.[0] || null)} className="text-sm text-zinc-400" />
          {existingLog?.image_url && <p className="text-xs text-zinc-500 mt-1">Upload a new photo to replace the current one.</p>}
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} rows={3} />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg py-2 text-sm font-medium transition-colors">
          {loading ? 'Saving...' : existingLog ? 'Update Entry' : 'Log Watch'}
        </button>
      </form>
    </div>
  );
}
