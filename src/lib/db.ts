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
`);

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
