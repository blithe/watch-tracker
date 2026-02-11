import { sql } from '@vercel/postgres';

function convertParams(query: string): string {
  let i = 1;
  return query.replace(/\?/g, () => `$${i++}`);
}

function prepareStatement(query: string) {
  const pgQuery = convertParams(query);
  return {
    async all(...params: any[]) {
      const result = await sql.query(pgQuery, params);
      return result.rows;
    },
    async get(...params: any[]) {
      const result = await sql.query(pgQuery, params);
      return result.rows[0] || undefined;
    },
    async run(...params: any[]) {
      let q = pgQuery;
      // Auto-append RETURNING id for INSERT so lastInsertRowid works
      if (/^\s*INSERT\s/i.test(q) && !/RETURNING/i.test(q)) {
        q += ' RETURNING id';
      }
      const result = await sql.query(q, params);
      return {
        changes: result.rowCount ?? 0,
        lastInsertRowid: result.rows[0]?.id ?? null,
      };
    },
  };
}

const db = {
  prepare(query: string) {
    return prepareStatement(query);
  },
};

export default db;

export interface Watch {
  id: number;
  brand: string;
  model: string;
  reference: string | null;
  image_url: string | null;
  created_at: string;
  purchase_date: string | null;
  purchase_price: number | null;
  sold_date: string | null;
  sold_price: number | null;
  status: string;
  notes: string | null;
}

export interface CollectionWatch extends Watch {
  wear_count: number;
  days_owned?: number;
  profit_loss?: number;
}

export interface WearLog {
  id: number;
  watch_id: number;
  date: string;
  image_url: string | null;
  notes: string | null;
  created_at: string;
}

export interface WearLogWithWatch extends WearLog {
  brand: string;
  model: string;
  reference: string | null;
  watch_image_url: string | null;
}

export interface Wishlist {
  id: number;
  brand: string;
  model: string;
  reference: string | null;
  image_url: string | null;
  target_price: number | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PriceHistory {
  id: number;
  wishlist_id: number;
  price: number;
  source: string | null;
  url: string | null;
  recorded_at: string;
}

export interface WishlistWithLatestPrice extends Wishlist {
  latest_price: number | null;
  latest_price_source: string | null;
  latest_price_date: string | null;
}
