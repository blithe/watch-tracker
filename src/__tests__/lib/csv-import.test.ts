import {
  mapHeader,
  parseCSV,
  normalizePrice,
  normalizeDate,
  normalizeStatus,
  mapRow,
  WATCH_COLUMNS,
} from '@/lib/csv-import';

// ─── mapHeader ────────────────────────────────────────────────────────────────

describe('mapHeader', () => {
  it('maps exact DB column names (case-insensitive)', () => {
    for (const col of WATCH_COLUMNS) {
      expect(mapHeader(col)).toBe(col);
      expect(mapHeader(col.toUpperCase())).toBe(col);
    }
  });

  it('maps common aliases', () => {
    expect(mapHeader('make')).toBe('brand');
    expect(mapHeader('Make')).toBe('brand');
    expect(mapHeader('manufacturer')).toBe('brand');
    expect(mapHeader('name')).toBe('model');
    expect(mapHeader('ref')).toBe('reference');
    expect(mapHeader('ref#')).toBe('reference');
    expect(mapHeader('sku')).toBe('reference');
    expect(mapHeader('price')).toBe('purchase_price');
    expect(mapHeader('cost')).toBe('purchase_price');
    expect(mapHeader('paid')).toBe('purchase_price');
    expect(mapHeader('date purchased')).toBe('purchase_date');
    expect(mapHeader('Date Bought')).toBe('purchase_date');
    expect(mapHeader('acquired')).toBe('purchase_date');
    expect(mapHeader('sale price')).toBe('sold_price');
    expect(mapHeader('sold for')).toBe('sold_price');
    expect(mapHeader('date sold')).toBe('sold_date');
    expect(mapHeader('sale date')).toBe('sold_date');
    expect(mapHeader('description')).toBe('notes');
    expect(mapHeader('comments')).toBe('notes');
    expect(mapHeader('photo')).toBe('image_url');
    expect(mapHeader('photo url')).toBe('image_url');
  });

  it('normalizes spaces, hyphens, and special characters', () => {
    expect(mapHeader('purchase price')).toBe('purchase_price');
    expect(mapHeader('purchase-price')).toBe('purchase_price');
    expect(mapHeader('Purchase Price')).toBe('purchase_price');
  });

  it('returns null for unrecognized headers', () => {
    expect(mapHeader('color')).toBeNull();
    expect(mapHeader('dial_color')).toBeNull();
    expect(mapHeader('strap_material')).toBeNull();
    expect(mapHeader('')).toBeNull();
  });
});

// ─── parseCSV ─────────────────────────────────────────────────────────────────

describe('parseCSV', () => {
  it('parses a simple CSV', () => {
    const { headers, rows } = parseCSV('brand,model\nRolex,Submariner\nOmega,Speedmaster');
    expect(headers).toEqual(['brand', 'model']);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ brand: 'Rolex', model: 'Submariner' });
    expect(rows[1]).toEqual({ brand: 'Omega', model: 'Speedmaster' });
  });

  it('handles quoted fields with commas', () => {
    const { rows } = parseCSV('brand,notes\nRolex,"Black dial, ceramic bezel"');
    expect(rows[0].notes).toBe('Black dial, ceramic bezel');
  });

  it('handles escaped quotes inside fields', () => {
    const { rows } = parseCSV('brand,notes\nRolex,"He said ""nice watch"""');
    expect(rows[0].notes).toBe('He said "nice watch"');
  });

  it('handles CRLF line endings', () => {
    const { rows } = parseCSV('brand,model\r\nRolex,Sub\r\nOmega,Speedy');
    expect(rows).toHaveLength(2);
  });

  it('skips blank lines', () => {
    const { rows } = parseCSV('brand,model\nRolex,Sub\n\nOmega,Speedy\n');
    expect(rows).toHaveLength(2);
  });

  it('strips UTF-8 BOM', () => {
    const { headers } = parseCSV('\uFEFFbrand,model\nRolex,Sub');
    expect(headers[0]).toBe('brand');
  });

  it('fills missing cells with empty string', () => {
    const { rows } = parseCSV('brand,model,reference\nRolex,Sub');
    expect(rows[0].reference).toBe('');
  });
});

// ─── normalizePrice ────────────────────────────────────────────────────────────

describe('normalizePrice', () => {
  it('parses plain numbers', () => {
    expect(normalizePrice('1234.56')).toBe(1234.56);
    expect(normalizePrice('1000')).toBe(1000);
  });

  it('strips dollar signs and commas', () => {
    expect(normalizePrice('$1,234.56')).toBe(1234.56);
    expect(normalizePrice('$10,000')).toBe(10000);
  });

  it('returns null for empty string', () => {
    expect(normalizePrice('')).toBeNull();
    expect(normalizePrice('  ')).toBeNull();
  });

  it('returns null for non-numeric strings', () => {
    expect(normalizePrice('n/a')).toBeNull();
    expect(normalizePrice('unknown')).toBeNull();
  });
});

// ─── normalizeDate ─────────────────────────────────────────────────────────────

describe('normalizeDate', () => {
  it('accepts YYYY-MM-DD unchanged', () => {
    expect(normalizeDate('2023-01-15')).toBe('2023-01-15');
  });

  it('converts MM/DD/YYYY', () => {
    expect(normalizeDate('01/15/2023')).toBe('2023-01-15');
    expect(normalizeDate('1/5/2023')).toBe('2023-01-05');
  });

  it('converts MM-DD-YYYY', () => {
    expect(normalizeDate('01-15-2023')).toBe('2023-01-15');
  });

  it('returns null for empty string', () => {
    expect(normalizeDate('')).toBeNull();
    expect(normalizeDate('  ')).toBeNull();
  });

  it('returns null for unrecognized formats', () => {
    expect(normalizeDate('Jan 15 2023')).toBeNull();
    expect(normalizeDate('not-a-date')).toBeNull();
  });
});

// ─── normalizeStatus ──────────────────────────────────────────────────────────

describe('normalizeStatus', () => {
  it('accepts owned and sold (case-insensitive)', () => {
    expect(normalizeStatus('owned')).toBe('owned');
    expect(normalizeStatus('Owned')).toBe('owned');
    expect(normalizeStatus('sold')).toBe('sold');
    expect(normalizeStatus('SOLD')).toBe('sold');
  });

  it('defaults unknown values to owned', () => {
    expect(normalizeStatus('')).toBe('owned');
    expect(normalizeStatus('for sale')).toBe('owned');
  });
});

// ─── mapRow ───────────────────────────────────────────────────────────────────

describe('mapRow', () => {
  it('maps a complete row with exact headers', () => {
    const { data, error } = mapRow({
      brand: 'Rolex',
      model: 'Submariner',
      reference: '126610LN',
      purchase_date: '2022-03-01',
      purchase_price: '9500',
      status: 'owned',
      notes: 'Bought new',
    });
    expect(error).toBeNull();
    expect(data.brand).toBe('Rolex');
    expect(data.model).toBe('Submariner');
    expect(data.reference).toBe('126610LN');
    expect(data.purchase_price).toBe(9500);
    expect(data.purchase_date).toBe('2022-03-01');
    expect(data.notes).toBe('Bought new');
  });

  it('maps aliased headers', () => {
    const { data, error } = mapRow({ make: 'Omega', name: 'Speedmaster', price: '$3,500' });
    expect(error).toBeNull();
    expect(data.brand).toBe('Omega');
    expect(data.model).toBe('Speedmaster');
    expect(data.purchase_price).toBe(3500);
  });

  it('returns error when brand is missing', () => {
    const { error } = mapRow({ model: 'Submariner' });
    expect(error).toContain('"brand" is required');
  });

  it('returns error when model is missing', () => {
    const { error } = mapRow({ brand: 'Rolex' });
    expect(error).toContain('"model" is required');
  });

  it('returns error for invalid price', () => {
    const { error } = mapRow({ brand: 'Rolex', model: 'Sub', price: 'expensive' });
    expect(error).toContain('not a valid price');
  });

  it('returns error for invalid date', () => {
    const { error } = mapRow({ brand: 'Rolex', model: 'Sub', purchase_date: 'Jan 2022' });
    expect(error).toContain('not a valid date');
  });

  it('ignores unknown columns', () => {
    const { data, error } = mapRow({ brand: 'Rolex', model: 'Sub', dial_color: 'black' });
    expect(error).toBeNull();
    expect((data as any).dial_color).toBeUndefined();
  });

  it('converts empty string values to null', () => {
    const { data } = mapRow({ brand: 'Rolex', model: 'Sub', reference: '', notes: '' });
    expect(data.reference).toBeNull();
    expect(data.notes).toBeNull();
  });

  it('defaults status to owned when not provided', () => {
    const { data } = mapRow({ brand: 'Rolex', model: 'Sub' });
    expect(data.status).toBe('owned');
  });
});
