'use client';

import { useRef, useState } from 'react';

interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
  unknownColumns: string[];
}

export default function ImportCSV({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [apiError, setApiError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function clearResults() {
    setResult(null);
    setApiError('');
  }

  function toggle() {
    setOpen(v => !v);
    setResult(null);
    setApiError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setApiError('Please choose a CSV file.');
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setApiError('Please choose a .csv file.');
      return;
    }

    setLoading(true);
    setApiError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/watches/import', { method: 'POST', body: formData });
      const body = await res.json();

      if (!res.ok) {
        setApiError(body.error ?? 'Import failed.');
        return;
      }

      setResult(body);
      if (body.imported > 0) onImported();
    } catch {
      setApiError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={toggle}
        className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        {open ? 'Cancel Import' : 'Import CSV'}
      </button>

      {open && (
        <div className="mt-4 bg-zinc-900 border border-zinc-700 rounded-xl p-5">
          <h2 className="font-semibold mb-1">Import watches from CSV</h2>
          <p className="text-sm text-zinc-400 mb-4">
            Columns recognized:{' '}
            <span className="font-mono text-xs text-zinc-300">
              brand, model, reference, purchase_date, purchase_price, sold_date, sold_price, status, notes
            </span>
            <br />
            Common aliases like <span className="font-mono text-xs">make</span>,{' '}
            <span className="font-mono text-xs">name</span>,{' '}
            <span className="font-mono text-xs">price</span>,{' '}
            <span className="font-mono text-xs">ref</span>,{' '}
            <span className="font-mono text-xs">date purchased</span>, etc. are also accepted.
            Dates can be YYYY-MM-DD or MM/DD/YYYY. Prices can include $ and commas.
            Duplicate watches (same brand + model + reference) are skipped.
          </p>

          <div className="flex items-center gap-3 mb-4">
            <input
              ref={fileRef}
              type="file"
              onChange={clearResults}
              className="text-sm text-zinc-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-zinc-700 file:text-zinc-200 hover:file:bg-zinc-600 file:cursor-pointer"
            />
            <button
              onClick={handleUpload}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? 'Importing…' : 'Upload'}
            </button>
          </div>

          {apiError && (
            <p className="text-sm text-red-400 mb-3">{apiError}</p>
          )}

          {result && (
            <div className="space-y-3 text-sm">
              {/* Summary */}
              <div className="flex flex-wrap gap-3">
                <span className="text-green-400 font-medium">
                  {result.imported} watch{result.imported !== 1 ? 'es' : ''} imported
                </span>
                {result.skipped > 0 && (
                  <span className="text-zinc-400">
                    {result.skipped} duplicate{result.skipped !== 1 ? 's' : ''} skipped
                  </span>
                )}
                {result.errors.length > 0 && (
                  <span className="text-amber-400">
                    {result.errors.length} row{result.errors.length !== 1 ? 's' : ''} with errors
                  </span>
                )}
              </div>

              {/* Row errors */}
              {result.errors.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                  <p className="font-medium text-amber-400 mb-2">Rows skipped due to errors:</p>
                  <ul className="space-y-1 text-zinc-300">
                    {result.errors.map(e => (
                      <li key={e.row}>
                        <span className="text-zinc-500">Row {e.row}:</span> {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Unknown columns */}
              {result.unknownColumns.length > 0 && (
                <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3">
                  <p className="font-medium text-zinc-300 mb-1">
                    Unrecognized columns — not imported:
                  </p>
                  <p className="text-zinc-400">
                    {result.unknownColumns.map(c => (
                      <span key={c} className="inline-block font-mono text-xs bg-zinc-700 rounded px-1.5 py-0.5 mr-1 mb-1">{c}</span>
                    ))}
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    These fields aren't tracked by the app yet. If you'd like them added, send feedback!
                  </p>
                </div>
              )}

              {result.imported > 0 && (
                <button
                  onClick={toggle}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
