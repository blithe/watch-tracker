'use client';

import { useRef, useState } from 'react';
import { parseCSV, mapHeader, mapRow, WATCH_COLUMNS, WatchColumn } from '@/lib/csv-import';

const COLUMN_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '— skip —' },
  ...WATCH_COLUMNS.map(c => ({ value: c, label: c })),
];

interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
  unknownColumns: string[];
}

interface Preview {
  headers: string[];
  mapping: Record<string, WatchColumn | null>;
  sampleRows: Record<string, string>[];
  totalRows: number;
  file: File;
}

export default function ImportCSV({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [apiError, setApiError] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function toggle() {
    setOpen(v => !v);
    setResult(null);
    setApiError('');
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handlePreview() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setApiError('Please choose a CSV file.');
      return;
    }
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setApiError('Please choose a .csv file.');
      return;
    }

    setApiError('');
    setResult(null);

    try {
      const text = await file.text();
      const { headers, rows } = parseCSV(text);

      if (!headers.some(h => h.trim())) {
        setApiError('CSV file is empty or has no headers.');
        return;
      }

      // Build default mapping using auto-detection
      const mapping: Record<string, WatchColumn | null> = {};
      for (const h of headers) {
        mapping[h] = mapHeader(h);
      }

      setPreview({
        headers,
        mapping,
        sampleRows: rows.slice(0, 5),
        totalRows: rows.length,
        file,
      });
    } catch {
      setApiError('Could not read the file.');
    }
  }

  function updateMapping(header: string, value: string) {
    if (!preview) return;
    setPreview({
      ...preview,
      mapping: {
        ...preview.mapping,
        [header]: (value || null) as WatchColumn | null,
      },
    });
  }

  async function handleImport() {
    if (!preview) return;

    setLoading(true);
    setApiError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', preview.file);
      formData.append('mapping', JSON.stringify(preview.mapping));

      const res = await fetch('/api/watches/import', { method: 'POST', body: formData });
      const body = await res.json();

      if (!res.ok) {
        setApiError(body.error ?? 'Import failed.');
        return;
      }

      setResult(body);
      setPreview(null);
      if (body.imported > 0) onImported();
    } catch {
      setApiError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Build preview rows using the current mapping
  function getPreviewMapped(): Array<Record<string, string | null>> {
    if (!preview) return [];
    return preview.sampleRows.map(row => {
      const { data } = mapRow(row, preview.mapping);
      return data as Record<string, string | null>;
    });
  }

  // Which DB columns are actually mapped (for preview table headers)
  function getMappedColumns(): WatchColumn[] {
    if (!preview) return [];
    const cols = new Set<WatchColumn>();
    for (const val of Object.values(preview.mapping)) {
      if (val) cols.add(val);
    }
    // Return in schema order
    return WATCH_COLUMNS.filter(c => cols.has(c));
  }

  // Detect conflicts: multiple CSV headers mapped to the same DB column
  function getConflicts(): Record<string, string[]> {
    if (!preview) return {};
    const byCol: Record<string, string[]> = {};
    for (const [header, col] of Object.entries(preview.mapping)) {
      if (!col) continue;
      if (!byCol[col]) byCol[col] = [];
      byCol[col].push(header);
    }
    const conflicts: Record<string, string[]> = {};
    for (const [col, headers] of Object.entries(byCol)) {
      if (headers.length > 1) conflicts[col] = headers;
    }
    return conflicts;
  }

  const conflicts = getConflicts();
  const hasConflicts = Object.keys(conflicts).length > 0;
  const hasBrandAndModel = preview
    ? Object.values(preview.mapping).includes('brand') && Object.values(preview.mapping).includes('model')
    : false;

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
          {/* Step 1: File picker */}
          {!preview && !result && (
            <>
              <h2 className="font-semibold mb-1">Import watches from CSV</h2>
              <p className="text-sm text-zinc-400 mb-4">
                Upload a CSV file and we'll show you a preview before importing.
                Common column names and aliases are auto-detected.
              </p>

              <div className="flex items-center gap-3 mb-4">
                <input
                  ref={fileRef}
                  type="file"
                  onChange={() => { setApiError(''); setResult(null); }}
                  className="text-sm text-zinc-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-zinc-700 file:text-zinc-200 hover:file:bg-zinc-600 file:cursor-pointer"
                />
                <button
                  onClick={handlePreview}
                  className="bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                >
                  Preview
                </button>
              </div>
            </>
          )}

          {/* Step 2: Preview with editable mapping */}
          {preview && !result && (
            <>
              <h2 className="font-semibold mb-3">Review column mapping</h2>

              {/* Column mapping table */}
              <div className="mb-4 space-y-2">
                {preview.headers.filter(h => h.trim()).map(header => {
                  const mapped = preview.mapping[header];
                  const isAutoAlias = mapped && mapHeader(header) === mapped && header.toLowerCase().replace(/[\s\-#]+/g, '_').replace(/[^a-z0-9_]/g, '') !== mapped;
                  const conflictCols = mapped ? Object.entries(conflicts).find(([col]) => col === mapped) : null;

                  return (
                    <div key={header} className="flex items-center gap-3 text-sm">
                      <span className="font-mono text-zinc-300 w-36 truncate" title={header}>"{header}"</span>
                      <span className="text-zinc-500">→</span>
                      <select
                        value={mapped ?? ''}
                        onChange={e => updateMapping(header, e.target.value)}
                        className={`bg-zinc-800 border rounded px-2 py-1 text-sm ${
                          conflictCols ? 'border-red-500' : mapped ? 'border-zinc-600' : 'border-zinc-700 text-zinc-500'
                        }`}
                      >
                        {COLUMN_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      {isAutoAlias && (
                        <span className="text-xs text-amber-400">auto-detected alias</span>
                      )}
                      {!mapped && (
                        <span className="text-xs text-zinc-500">will be skipped</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Conflict warnings */}
              {hasConflicts && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4 text-sm">
                  <p className="font-medium text-red-400 mb-1">Column conflict:</p>
                  {Object.entries(conflicts).map(([col, headers]) => (
                    <p key={col} className="text-zinc-300">
                      Multiple columns map to <span className="font-mono text-red-300">{col}</span>: {headers.map(h => `"${h}"`).join(', ')}
                    </p>
                  ))}
                </div>
              )}

              {/* Missing required columns warning */}
              {!hasBrandAndModel && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-4 text-sm">
                  <p className="text-amber-400">
                    Both <span className="font-mono">brand</span> and <span className="font-mono">model</span> must be mapped for import to work.
                  </p>
                </div>
              )}

              {/* Data preview table */}
              {getMappedColumns().length > 0 && preview.sampleRows.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-zinc-500 mb-2">
                    Preview ({Math.min(5, preview.sampleRows.length)} of {preview.totalRows} rows):
                  </p>
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full border-collapse">
                      <thead>
                        <tr>
                          {getMappedColumns().map(col => (
                            <th key={col} className="text-left font-mono text-zinc-400 border-b border-zinc-700 px-2 py-1.5">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {getPreviewMapped().map((row, i) => (
                          <tr key={i}>
                            {getMappedColumns().map(col => (
                              <td key={col} className="text-zinc-300 border-b border-zinc-800 px-2 py-1.5 max-w-[200px] truncate">
                                {row[col] ?? <span className="text-zinc-600">—</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setPreview(null)}
                  className="bg-zinc-700 hover:bg-zinc-600 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={loading || hasConflicts || !hasBrandAndModel}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                >
                  {loading ? 'Importing…' : `Import ${preview.totalRows} row${preview.totalRows !== 1 ? 's' : ''}`}
                </button>
              </div>
            </>
          )}

          {/* Step 3: Results */}
          {result && (
            <div className="space-y-3 text-sm">
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

              {result.errors.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                  <p className="font-medium text-amber-400 mb-2">Rows skipped due to errors:</p>
                  <ul className="space-y-1 text-zinc-300">
                    {result.errors.slice(0, 10).map(e => (
                      <li key={e.row}>
                        <span className="text-zinc-500">Row {e.row}:</span> {e.message}
                      </li>
                    ))}
                    {result.errors.length > 10 && (
                      <li className="text-zinc-500">...and {result.errors.length - 10} more</li>
                    )}
                  </ul>
                </div>
              )}

              {result.unknownColumns.length > 0 && (
                <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3">
                  <p className="font-medium text-zinc-300 mb-1">Unrecognized columns — not imported:</p>
                  <p className="text-zinc-400">
                    {result.unknownColumns.map(c => (
                      <span key={c} className="inline-block font-mono text-xs bg-zinc-700 rounded px-1.5 py-0.5 mr-1 mb-1">{c}</span>
                    ))}
                  </p>
                </div>
              )}

              <button
                onClick={toggle}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {apiError && (
            <p className="text-sm text-red-400 mt-3">{apiError}</p>
          )}
        </div>
      )}
    </div>
  );
}
