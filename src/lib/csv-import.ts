// ─── Watch CSV import utilities ──────────────────────────────────────────────

export const WATCH_COLUMNS = [
  'brand', 'model', 'reference', 'image_url',
  'purchase_date', 'purchase_price',
  'sold_date', 'sold_price',
  'status', 'notes',
] as const;

export type WatchColumn = typeof WATCH_COLUMNS[number];

/** Aliases: normalized header string → DB column */
const ALIASES: Record<string, WatchColumn> = {
  // brand
  make: 'brand',
  manufacturer: 'brand',
  brand_name: 'brand',
  // model
  name: 'model',
  watch_model: 'model',
  model_name: 'model',
  // reference
  ref: 'reference',
  ref_: 'reference',   // "ref#" normalizes to "ref_"
  reference_: 'reference',
  ref_number: 'reference',
  reference_number: 'reference',
  sku: 'reference',
  // image_url
  image: 'image_url',
  photo: 'image_url',
  photo_url: 'image_url',
  image_link: 'image_url',
  // purchase_date
  bought: 'purchase_date',
  date_purchased: 'purchase_date',
  date_bought: 'purchase_date',
  acquired: 'purchase_date',
  acquisition_date: 'purchase_date',
  // purchase_price
  price: 'purchase_price',
  cost: 'purchase_price',
  paid: 'purchase_price',
  bought_for: 'purchase_price',
  cost_price: 'purchase_price',
  // sold_date
  date_sold: 'sold_date',
  sale_date: 'sold_date',
  // sold_price
  sold_for: 'sold_price',
  sale_price: 'sold_price',
  selling_price: 'sold_price',
  // notes
  description: 'notes',
  comments: 'notes',
  comment: 'notes',
  remarks: 'notes',
};

const ALLOWED = new Set<string>(WATCH_COLUMNS);

/** Normalize a raw CSV header to a canonical lookup key. */
function normalizeKey(raw: string): string {
  return raw.toLowerCase().trim()
    .replace(/[\s\-#]+/g, '_')   // spaces/hyphens/# → _
    .replace(/[^a-z0-9_]/g, ''); // strip remaining non-alphanum
}

/**
 * Map a raw CSV header to a DB column name.
 * Returns null if the header is not recognized.
 */
export function mapHeader(raw: string): WatchColumn | null {
  const key = normalizeKey(raw);
  if (ALLOWED.has(key)) return key as WatchColumn;
  return ALIASES[key] ?? null;
}

// ─── CSV parser ──────────────────────────────────────────────────────────────

/** Parse a CSV string (handles quoted fields, escaped quotes, CRLF). */
export function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  // Strip UTF-8 BOM (Excel exports)
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = clean.split('\n');

  const headers = splitCSVLine(lines[0] ?? '');
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = splitCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = cells[idx] ?? ''; });
    rows.push(row);
  }

  return { headers, rows };
}

function splitCSVLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      i++; // skip opening quote
      let field = '';
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          field += '"'; i += 2;
        } else if (line[i] === '"') {
          i++; break;
        } else {
          field += line[i++];
        }
      }
      fields.push(field);
      if (line[i] === ',') i++;
    } else {
      const end = line.indexOf(',', i);
      if (end === -1) {
        fields.push(line.slice(i));
        break;
      }
      fields.push(line.slice(i, end));
      i = end + 1;
    }
  }
  return fields;
}

// ─── Value normalizers ────────────────────────────────────────────────────────

/** "$1,234.56" or "1234.56" → 1234.56, empty string → null, invalid → null */
export function normalizePrice(s: string): number | null {
  if (!s.trim()) return null;
  const cleaned = s.replace(/[$,\s]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/**
 * Normalize date strings to YYYY-MM-DD.
 * Accepts: YYYY-MM-DD, MM/DD/YYYY, M/D/YYYY, MM-DD-YYYY.
 * Returns null for empty or unrecognized formats.
 */
export function normalizeDate(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const mdy = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
  const mdy2 = t.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (mdy2) return `${mdy2[3]}-${mdy2[1].padStart(2, '0')}-${mdy2[2].padStart(2, '0')}`;
  return null;
}

const VALID_STATUSES = new Set(['owned', 'sold']);

export function normalizeStatus(s: string): string {
  const t = s.trim().toLowerCase();
  return VALID_STATUSES.has(t) ? t : 'owned';
}

// ─── Row validator ────────────────────────────────────────────────────────────

export type WatchRow = Partial<Record<WatchColumn, string | number | null>>;

export interface ParsedRow {
  data: WatchRow;
  error: string | null;
}

/**
 * Map a raw CSV row (with original headers) to a typed WatchRow.
 * Returns an error string if required fields are missing or values are invalid.
 */
export function mapRow(raw: Record<string, string>): ParsedRow {
  const data: WatchRow = {};
  const fieldErrors: string[] = [];

  for (const [header, rawValue] of Object.entries(raw)) {
    const col = mapHeader(header);
    if (!col) continue; // unknown columns are filtered here

    const v = rawValue.trim();

    if (col === 'purchase_price' || col === 'sold_price') {
      const price = normalizePrice(v);
      if (v && price === null) fieldErrors.push(`"${header}" is not a valid price`);
      else data[col] = price;
    } else if (col === 'purchase_date' || col === 'sold_date') {
      const date = normalizeDate(v);
      if (v && date === null) fieldErrors.push(`"${header}" is not a valid date (use YYYY-MM-DD or MM/DD/YYYY)`);
      else data[col] = date ?? null;
    } else if (col === 'status') {
      data[col] = normalizeStatus(v);
    } else {
      data[col] = v || null;
    }
  }

  // Required fields
  if (!data.brand) fieldErrors.push('"brand" is required');
  if (!data.model) fieldErrors.push('"model" is required');

  // Default status
  if (!data.status) data.status = 'owned';

  return {
    data,
    error: fieldErrors.length > 0 ? fieldErrors.join('; ') : null,
  };
}
