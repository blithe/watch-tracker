import path from 'path';

interface PreparedStatement {
  all(...params: any[]): any;
  get(...params: any[]): any;
  run(...params: any[]): any;
}

interface DB {
  prepare(query: string): PreparedStatement;
}

function createSqliteDb(): DB {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3');
  const dbPath = path.join(process.cwd(), 'watch-tracker.db');
  const sqlite = new Database(dbPath);

  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      reset_token TEXT,
      reset_token_expires TEXT
    );

    CREATE TABLE IF NOT EXISTS watches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      reference TEXT,
      image_url TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      purchase_date TEXT,
      purchase_price REAL,
      sold_date TEXT,
      sold_price REAL,
      status TEXT DEFAULT 'owned',
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS wear_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      watch_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      image_url TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (watch_id) REFERENCES watches(id)
    );

    CREATE TABLE IF NOT EXISTS wishlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      reference TEXT,
      image_url TEXT,
      source_url TEXT,
      target_price REAL,
      notes TEXT,
      status TEXT DEFAULT 'watching',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wishlist_id INTEGER NOT NULL,
      price REAL NOT NULL,
      source TEXT,
      url TEXT,
      recorded_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (wishlist_id) REFERENCES wishlist(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      email TEXT,
      message TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

  `);

  // Migrate existing databases: add columns added after initial schema
  try { sqlite.exec(`ALTER TABLE wishlist ADD COLUMN source_url TEXT`); } catch {}
  try { sqlite.exec(`ALTER TABLE watches ADD COLUMN user_id INTEGER REFERENCES users(id)`); } catch {}
  try { sqlite.exec(`ALTER TABLE wear_log ADD COLUMN user_id INTEGER REFERENCES users(id)`); } catch {}
  try { sqlite.exec(`ALTER TABLE wishlist ADD COLUMN user_id INTEGER REFERENCES users(id)`); } catch {}

  return sqlite;
}

function createPostgresDb(): DB {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { sql } = require('@vercel/postgres');

  function convertParams(query: string): string {
    let i = 1;
    return query.replace(/\?/g, () => `$${i++}`);
  }

  return {
    prepare(query: string) {
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
          if (/^\s*INSERT\s/i.test(q) && !/RETURNING/i.test(q)) {
            q += ' RETURNING *';
          }
          const result = await sql.query(q, params);
          return {
            changes: result.rowCount ?? 0,
            lastInsertRowid: result.rows[0]?.id ?? result.rows[0]?.user_id ?? null,
          };
        },
      };
    },
  };
}

const db: DB = process.env.POSTGRES_URL ? createPostgresDb() : createSqliteDb();

export default db;

export interface User {
  id: number;
  email: string;
  password_hash: string;
  is_admin: boolean | number;
  created_at: string;
  reset_token: string | null;
  reset_token_expires: string | null;
}

export interface Watch {
  id: number;
  user_id: number | null;
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
  user_id: number | null;
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
  user_id: number | null;
  brand: string;
  model: string;
  reference: string | null;
  image_url: string | null;
  source_url: string | null;
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

export interface Feedback {
  id: number;
  user_id: number | null;
  email: string | null;
  message: string;
  created_at: string;
}

