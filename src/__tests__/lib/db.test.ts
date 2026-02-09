/**
 * @jest-environment node
 */

import { getTestDb, resetTestDb, closeTestDb, seedTestData } from '@/lib/test-db';

describe('Database initialization and schema', () => {
  beforeEach(() => {
    resetTestDb();
  });

  afterAll(() => {
    closeTestDb();
  });

  describe('Database initialization', () => {
    it('should initialize database correctly', () => {
      const db = getTestDb();
      expect(db).toBeDefined();
      expect(typeof db.prepare).toBe('function');
    });

    it('should enable foreign keys', () => {
      const db = getTestDb();
      const result = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number };
      expect(result.foreign_keys).toBe(1);
    });

    it('should enable WAL mode', () => {
      const db = getTestDb();
      const result = db.prepare('PRAGMA journal_mode').get() as { journal_mode: string };
      expect(result.journal_mode).toBe('wal');
    });

    it('should create watches table with correct schema', () => {
      const db = getTestDb();
      const tableInfo = db.prepare('PRAGMA table_info(watches)').all() as Array<{
        cid: number;
        name: string;
        type: string;
        notnull: number;
        dflt_value: any;
        pk: number;
      }>;

      expect(tableInfo).toHaveLength(6);
      
      const columns = tableInfo.reduce((acc, col) => {
        acc[col.name] = col;
        return acc;
      }, {} as Record<string, any>);

      // Check id column
      expect(columns.id).toMatchObject({
        name: 'id',
        type: 'INTEGER',
        pk: 1, // Primary key
      });

      // Check required text columns
      expect(columns.brand).toMatchObject({
        name: 'brand',
        type: 'TEXT',
        notnull: 1, // NOT NULL
      });

      expect(columns.model).toMatchObject({
        name: 'model',
        type: 'TEXT',
        notnull: 1, // NOT NULL
      });

      // Check optional columns
      expect(columns.reference).toMatchObject({
        name: 'reference',
        type: 'TEXT',
        notnull: 0, // Nullable
      });

      expect(columns.image_url).toMatchObject({
        name: 'image_url',
        type: 'TEXT',
        notnull: 0, // Nullable
      });

      // Check created_at with default
      expect(columns.created_at).toMatchObject({
        name: 'created_at',
        type: 'TEXT',
        notnull: 0,
      });
    });

    it('should create wear_log table with correct schema', () => {
      const db = getTestDb();
      const tableInfo = db.prepare('PRAGMA table_info(wear_log)').all() as Array<{
        cid: number;
        name: string;
        type: string;
        notnull: number;
        dflt_value: any;
        pk: number;
      }>;

      expect(tableInfo).toHaveLength(6);
      
      const columns = tableInfo.reduce((acc, col) => {
        acc[col.name] = col;
        return acc;
      }, {} as Record<string, any>);

      // Check primary key
      expect(columns.id).toMatchObject({
        name: 'id',
        type: 'INTEGER',
        pk: 1,
      });

      // Check required columns
      expect(columns.watch_id).toMatchObject({
        name: 'watch_id',
        type: 'INTEGER',
        notnull: 1,
      });

      expect(columns.date).toMatchObject({
        name: 'date',
        type: 'TEXT',
        notnull: 1,
      });

      // Check optional columns
      expect(columns.image_url).toMatchObject({
        name: 'image_url',
        type: 'TEXT',
        notnull: 0,
      });

      expect(columns.notes).toMatchObject({
        name: 'notes',
        type: 'TEXT',
        notnull: 0,
      });
    });

    it('should enforce foreign key constraint on wear_log', () => {
      const db = getTestDb();
      const foreignKeys = db.prepare('PRAGMA foreign_key_list(wear_log)').all() as Array<{
        id: number;
        seq: number;
        table: string;
        from: string;
        to: string;
        on_update: string;
        on_delete: string;
      }>;

      expect(foreignKeys).toHaveLength(1);
      expect(foreignKeys[0]).toMatchObject({
        table: 'watches',
        from: 'watch_id',
        to: 'id',
      });
    });

    it('should enforce unique constraint on date in wear_log', () => {
      const db = getTestDb();
      const indices = db.prepare('PRAGMA index_list(wear_log)').all() as Array<{
        seq: number;
        name: string;
        unique: number;
        origin: string;
        partial: number;
      }>;

      // Look for unique index on date column
      const uniqueIndices = indices.filter(idx => idx.unique === 1);
      expect(uniqueIndices.length).toBeGreaterThan(0);
    });
  });

  describe('Seed data functionality', () => {
    it('should seed test data correctly', () => {
      const { watch1Id, watch2Id, watch3Id } = seedTestData();
      
      expect(typeof watch1Id).toBe('number');
      expect(typeof watch2Id).toBe('number');
      expect(typeof watch3Id).toBe('number');

      const db = getTestDb();
      
      // Check watches were inserted
      const watches = db.prepare('SELECT * FROM watches ORDER BY id').all();
      expect(watches).toHaveLength(3);
      
      expect(watches[0]).toMatchObject({
        id: watch1Id,
        brand: 'Grand Seiko',
        model: 'SBGW289',
        reference: 'SBGW289',
      });

      expect(watches[1]).toMatchObject({
        id: watch2Id,
        brand: 'Rolex',
        model: 'Submariner',
        reference: '116610LN',
      });

      expect(watches[2]).toMatchObject({
        id: watch3Id,
        brand: 'Omega',
        model: 'Speedmaster',
        reference: '311.30.42.30.01.005',
      });

      // Check wear logs were inserted
      const wearLogs = db.prepare('SELECT * FROM wear_log ORDER BY date').all();
      expect(wearLogs).toHaveLength(2);
      
      expect(wearLogs[0]).toMatchObject({
        watch_id: watch2Id,
        date: '2026-02-07',
        notes: 'Test log 2',
      });

      expect(wearLogs[1]).toMatchObject({
        watch_id: watch1Id,
        date: '2026-02-08',
        notes: 'Test log 1',
      });
    });

    it('should reset database correctly', () => {
      // First seed data
      seedTestData();
      
      const db = getTestDb();
      let count = (db.prepare('SELECT COUNT(*) as c FROM watches').get() as { c: number }).c;
      expect(count).toBe(3);

      // Reset and check it's empty
      resetTestDb();
      count = (db.prepare('SELECT COUNT(*) as c FROM watches').get() as { c: number }).c;
      expect(count).toBe(0);

      count = (db.prepare('SELECT COUNT(*) as c FROM wear_log').get() as { c: number }).c;
      expect(count).toBe(0);
    });

    it('should reset auto-increment counters', () => {
      // Seed data
      const { watch1Id } = seedTestData();
      expect(watch1Id).toBe(1);

      // Reset
      resetTestDb();

      // Add new data - should start from 1 again
      const db = getTestDb();
      const result = db.prepare('INSERT INTO watches (brand, model, reference) VALUES (?, ?, ?)').run('Test', 'Watch', null);
      expect(result.lastInsertRowid).toBe(1);
    });
  });

  describe('Foreign key constraints', () => {
    it('should prevent inserting wear_log with invalid watch_id', () => {
      const db = getTestDb();
      
      expect(() => {
        db.prepare('INSERT INTO wear_log (watch_id, date) VALUES (?, ?)').run(999, '2026-02-15');
      }).toThrow(/FOREIGN KEY constraint failed/);
    });

    it('should allow inserting wear_log with valid watch_id', () => {
      const { watch1Id } = seedTestData();
      const db = getTestDb();
      
      expect(() => {
        db.prepare('INSERT INTO wear_log (watch_id, date) VALUES (?, ?)').run(watch1Id, '2026-02-15');
      }).not.toThrow();

      const inserted = db.prepare('SELECT * FROM wear_log WHERE date = ?').get('2026-02-15');
      expect(inserted).toMatchObject({
        watch_id: watch1Id,
        date: '2026-02-15',
      });
    });

    it('should enforce unique date constraint', () => {
      const { watch1Id, watch2Id } = seedTestData();
      const db = getTestDb();
      
      // Try to insert duplicate date
      expect(() => {
        db.prepare('INSERT INTO wear_log (watch_id, date) VALUES (?, ?)').run(watch2Id, '2026-02-08');
      }).toThrow(/UNIQUE constraint failed/);
    });
  });

  describe('Data types and constraints', () => {
    it('should require brand and model for watches', () => {
      const db = getTestDb();
      
      expect(() => {
        db.prepare('INSERT INTO watches (model) VALUES (?)').run('Model Only');
      }).toThrow(/NOT NULL constraint failed/);

      expect(() => {
        db.prepare('INSERT INTO watches (brand) VALUES (?)').run('Brand Only');
      }).toThrow(/NOT NULL constraint failed/);
    });

    it('should allow null values for optional fields', () => {
      const db = getTestDb();
      
      const result = db.prepare('INSERT INTO watches (brand, model) VALUES (?, ?)').run('Test Brand', 'Test Model');
      
      const inserted = db.prepare('SELECT * FROM watches WHERE id = ?').get(result.lastInsertRowid);
      expect(inserted?.reference).toBeNull();
      expect(inserted?.image_url).toBeNull();
    });

    it('should set created_at timestamps automatically', () => {
      const { watch1Id } = seedTestData();
      const db = getTestDb();
      
      const watch = db.prepare('SELECT created_at FROM watches WHERE id = ?').get(watch1Id) as { created_at: string };
      expect(watch.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      
      // Should be recent
      const createdDate = new Date(watch.created_at);
      const now = new Date();
      const diffMs = now.getTime() - createdDate.getTime();
      expect(diffMs).toBeLessThan(5000); // Within 5 seconds
    });
  });
});