import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let testDb: Database.Database;

export function getTestDb() {
  if (!testDb) {
    // Create a unique test database for each test run
    const testDbPath = path.join(process.cwd(), `test-${Date.now()}-${Math.random().toString(36)}.db`);
    testDb = new Database(testDbPath);
    
    // Enable foreign keys and WAL mode
    testDb.pragma('journal_mode = WAL');
    testDb.pragma('foreign_keys = ON');
    
    // Create the same tables as the main database
    testDb.exec(`
      CREATE TABLE IF NOT EXISTS watches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    `);
  }
  return testDb;
}

export function resetTestDb() {
  if (testDb) {
    // Clear all data (order matters due to foreign keys)
    testDb.exec('DELETE FROM price_history');
    testDb.exec('DELETE FROM wear_log');
    testDb.exec('DELETE FROM wishlist');
    testDb.exec('DELETE FROM watches');
    testDb.exec('DELETE FROM sqlite_sequence'); // Reset auto-increment
  }
}

export function closeTestDb() {
  if (testDb) {
    const dbPath = testDb.name;
    testDb.close();
    // Clean up the test database file
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    testDb = null as any;
  }
}

// Seed test data function
export function seedTestData() {
  const db = getTestDb();
  
  // Insert test watches
  const watchInsert = db.prepare('INSERT INTO watches (brand, model, reference) VALUES (?, ?, ?)');
  const watch1 = watchInsert.run('Grand Seiko', 'SBGW289', 'SBGW289');
  const watch2 = watchInsert.run('Rolex', 'Submariner', '116610LN');
  const watch3 = watchInsert.run('Omega', 'Speedmaster', '311.30.42.30.01.005');
  
  // Insert test wear logs
  const wearInsert = db.prepare('INSERT INTO wear_log (watch_id, date, notes) VALUES (?, ?, ?)');
  wearInsert.run(watch1.lastInsertRowid, '2026-02-08', 'Test log 1');
  wearInsert.run(watch2.lastInsertRowid, '2026-02-07', 'Test log 2');
  
  return {
    watch1Id: watch1.lastInsertRowid,
    watch2Id: watch2.lastInsertRowid,
    watch3Id: watch3.lastInsertRowid,
  };
}

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

export interface WearLog {
  id: number;
  watch_id: number;
  date: string;
  image_url: string | null;
  notes: string | null;
  created_at: string;
}