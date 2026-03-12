import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUserIdFromRequest } from '@/lib/auth';
import { parseCSV, mapHeader, mapRow, WATCH_COLUMNS, WatchColumn } from '@/lib/csv-import';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 1_000_000; // 1 MB
const MAX_ROWS = 1_000;

export async function POST(req: NextRequest) {
  const userId = getSessionUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File too large (max 1 MB)' }, { status: 400 });
  }

  const text = await file.text();
  const { headers, rows } = parseCSV(text);

  if (!headers.some(h => h.trim())) {
    return NextResponse.json({ error: 'CSV file is empty or has no headers' }, { status: 400 });
  }

  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `Too many rows (max ${MAX_ROWS})` }, { status: 400 });
  }

  // Parse optional column mapping override from client preview step
  const mappingStr = formData.get('mapping');
  let customMapping: Record<string, WatchColumn | null> | undefined;
  if (mappingStr && typeof mappingStr === 'string') {
    try {
      const parsed = JSON.parse(mappingStr);
      // Validate: values must be valid WatchColumn or null
      const allowed = new Set<string>(WATCH_COLUMNS);
      customMapping = {};
      for (const [key, val] of Object.entries(parsed)) {
        if (val === null || (typeof val === 'string' && allowed.has(val))) {
          customMapping[key] = val as WatchColumn | null;
        }
      }
    } catch {
      return NextResponse.json({ error: 'Invalid mapping' }, { status: 400 });
    }
  }

  // Identify which headers are recognized and which are not
  const resolveHeader = customMapping
    ? (h: string) => customMapping![h] ?? null
    : (h: string) => mapHeader(h);
  const unknownColumns = headers.filter(h => resolveHeader(h) === null);

  let imported = 0;
  let skipped = 0;
  const errors: Array<{ row: number; message: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // 1-based, accounting for header row
    const { data, error } = mapRow(rows[i], customMapping);

    if (error) {
      errors.push({ row: rowNum, message: error });
      continue;
    }

    const { brand, model, reference } = data;
    const normalizedRef = reference || null;

    // Skip duplicates (same brand + model + reference for this user)
    const existing = normalizedRef === null
      ? await db.prepare('SELECT id FROM watches WHERE user_id = ? AND brand = ? AND model = ? AND reference IS NULL').get(userId, brand, model)
      : await db.prepare('SELECT id FROM watches WHERE user_id = ? AND brand = ? AND model = ? AND reference = ?').get(userId, brand, model, normalizedRef);

    if (existing) {
      skipped++;
      continue;
    }

    // Build parameterized INSERT with only the columns present in data
    const writableColumns = WATCH_COLUMNS.filter(col => col in data && data[col] !== undefined);
    const allColumns = ['user_id', ...writableColumns];
    const placeholders = allColumns.map(() => '?').join(', ');
    const values = [userId, ...writableColumns.map(col => data[col] ?? null)];

    await db.prepare(
      `INSERT INTO watches (${allColumns.join(', ')}) VALUES (${placeholders})`
    ).run(...values);

    imported++;
  }

  return NextResponse.json({ imported, skipped, errors, unknownColumns });
}
