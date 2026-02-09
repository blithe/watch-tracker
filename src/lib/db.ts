import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'watch-tracker.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS watches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    reference TEXT,
    image_url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS wear_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    watch_id INTEGER NOT NULL,
    date TEXT NOT NULL UNIQUE,
    image_url TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (watch_id) REFERENCES watches(id)
  );

  CREATE TABLE IF NOT EXISTS wishlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    reference TEXT,
    image_url TEXT,
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
    FOREIGN KEY (wishlist_id) REFERENCES wishlist(id)
  );
`);

// Add collection-related columns to watches table if they don't exist
function addColumnIfNotExists(tableName: string, columnName: string, columnDef: string) {
  try {
    const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
    const columnExists = tableInfo.some((col: any) => col.name === columnName);
    if (!columnExists) {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
    }
  } catch (error) {
    // Column might already exist, ignore error
  }
}

addColumnIfNotExists('watches', 'purchase_date', 'TEXT');
addColumnIfNotExists('watches', 'purchase_price', 'REAL');
addColumnIfNotExists('watches', 'sold_date', 'TEXT');
addColumnIfNotExists('watches', 'sold_price', 'REAL');
addColumnIfNotExists('watches', 'status', 'TEXT DEFAULT "owned"');
addColumnIfNotExists('watches', 'notes', 'TEXT');

// Seed if empty
const count = db.prepare('SELECT COUNT(*) as c FROM watches').get() as { c: number };
if (count.c === 0) {
  const insert = db.prepare('INSERT INTO watches (brand, model, reference) VALUES (?, ?, ?)');
  const result = insert.run('Grand Seiko', 'SBGW289', 'SBGW289');
  db.prepare('INSERT INTO wear_log (watch_id, date, notes) VALUES (?, ?, ?)').run(
    result.lastInsertRowid,
    '2026-02-08',
    'First day tracking!'
  );
}

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
