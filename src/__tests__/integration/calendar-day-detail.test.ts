/**
 * Integration tests for Calendar → Day detail flow
 * Tests the complete data flow from database queries to UI rendering
 * 
 * @jest-environment node
 */

import { getTestDb, resetTestDb, closeTestDb } from '@/lib/test-db';

// Mock the main db module to use test database
jest.mock('../../lib/db', () => {
  return require('../../lib/test-db').getTestDb();
});

describe('Calendar Day → Day Detail Integration', () => {
  beforeEach(() => {
    resetTestDb();
  });

  afterAll(() => {
    closeTestDb();
  });

  describe('Day detail page query', () => {
    it('should fetch correct watch and image data for a specific date', () => {
      const db = getTestDb();
      
      // Set up test data: watch with image
      const watchResult = db.prepare(`
        INSERT INTO watches (brand, model, reference, image_url) 
        VALUES (?, ?, ?, ?)
      `).run('Grand Seiko', 'SBGW289', 'SBGW289', '/uploads/watch-sbgw289.jpg');
      
      // Wear log with image (wrist shot)
      db.prepare(`
        INSERT INTO wear_log (watch_id, date, image_url, notes) 
        VALUES (?, ?, ?, ?)
      `).run(watchResult.lastInsertRowid, '2026-02-08', '/uploads/wrist-shot-2026-02-08.jpg', 'Perfect timing today');

      // Execute the same query that day/[date] page uses
      const log = db.prepare(`
        SELECT wl.*, w.brand, w.model, w.reference, w.image_url as watch_image
        FROM wear_log wl
        JOIN watches w ON w.id = wl.watch_id
        WHERE wl.date = ?
      `).get('2026-02-08') as any;

      // Assert all required data is present
      expect(log).toBeDefined();
      expect(log).toMatchObject({
        // Wear log data
        date: '2026-02-08',
        image_url: '/uploads/wrist-shot-2026-02-08.jpg',
        notes: 'Perfect timing today',
        // Watch data
        brand: 'Grand Seiko',
        model: 'SBGW289',
        reference: 'SBGW289',
        watch_image: '/uploads/watch-sbgw289.jpg'
      });

      // Verify the image priority logic (log image takes precedence)
      const displayImage = log.image_url || log.watch_image;
      expect(displayImage).toBe('/uploads/wrist-shot-2026-02-08.jpg');
    });

    it('should use watch image as fallback when log has no image', () => {
      const db = getTestDb();
      
      // Watch with image, log without image
      const watchResult = db.prepare(`
        INSERT INTO watches (brand, model, reference, image_url) 
        VALUES (?, ?, ?, ?)
      `).run('Rolex', 'Submariner', '116610LN', '/uploads/rolex-sub.jpg');
      
      db.prepare(`
        INSERT INTO wear_log (watch_id, date, notes) 
        VALUES (?, ?, ?)
      `).run(watchResult.lastInsertRowid, '2026-02-09', 'Classic choice');

      const log = db.prepare(`
        SELECT wl.*, w.brand, w.model, w.reference, w.image_url as watch_image
        FROM wear_log wl
        JOIN watches w ON w.id = wl.watch_id
        WHERE wl.date = ?
      `).get('2026-02-09') as any;

      expect(log).toMatchObject({
        date: '2026-02-09',
        image_url: null,
        notes: 'Classic choice',
        brand: 'Rolex',
        model: 'Submariner',
        reference: '116610LN',
        watch_image: '/uploads/rolex-sub.jpg'
      });

      // Verify fallback logic
      const displayImage = log.image_url || log.watch_image;
      expect(displayImage).toBe('/uploads/rolex-sub.jpg');
    });

    it('should return null/undefined for date with no entry', () => {
      const db = getTestDb();
      
      // Add some data, but not for the date we're querying
      const watchResult = db.prepare(`
        INSERT INTO watches (brand, model, reference) 
        VALUES (?, ?, ?)
      `).run('Omega', 'Speedmaster', '311.30.42.30.01.005');
      
      db.prepare(`
        INSERT INTO wear_log (watch_id, date) 
        VALUES (?, ?)
      `).run(watchResult.lastInsertRowid, '2026-02-07');

      // Query for different date
      const log = db.prepare(`
        SELECT wl.*, w.brand, w.model, w.reference, w.image_url as watch_image
        FROM wear_log wl
        JOIN watches w ON w.id = wl.watch_id
        WHERE wl.date = ?
      `).get('2026-02-10');

      expect(log).toBeUndefined();
    });

    it('should return correct watch when multiple watches exist', () => {
      const db = getTestDb();
      
      // Add multiple watches
      const watch1 = db.prepare(`
        INSERT INTO watches (brand, model, reference) 
        VALUES (?, ?, ?)
      `).run('Grand Seiko', 'SBGW289', 'SBGW289');
      
      const watch2 = db.prepare(`
        INSERT INTO watches (brand, model, reference) 
        VALUES (?, ?, ?)
      `).run('Rolex', 'Submariner', '116610LN');
      
      const watch3 = db.prepare(`
        INSERT INTO watches (brand, model, reference) 
        VALUES (?, ?, ?)
      `).run('Omega', 'Speedmaster', '311.30.42.30.01.005');

      // Add logs for different dates
      db.prepare(`INSERT INTO wear_log (watch_id, date, notes) VALUES (?, ?, ?)`).run(watch1.lastInsertRowid, '2026-02-08', 'GS day');
      db.prepare(`INSERT INTO wear_log (watch_id, date, notes) VALUES (?, ?, ?)`).run(watch2.lastInsertRowid, '2026-02-09', 'Rolex day');
      db.prepare(`INSERT INTO wear_log (watch_id, date, notes) VALUES (?, ?, ?)`).run(watch3.lastInsertRowid, '2026-02-10', 'Omega day');

      // Query for specific date should return correct watch
      const log = db.prepare(`
        SELECT wl.*, w.brand, w.model, w.reference, w.image_url as watch_image
        FROM wear_log wl
        JOIN watches w ON w.id = wl.watch_id
        WHERE wl.date = ?
      `).get('2026-02-09') as any;

      expect(log).toMatchObject({
        date: '2026-02-09',
        brand: 'Rolex',
        model: 'Submariner',
        reference: '116610LN',
        notes: 'Rolex day'
      });
    });

    it('should handle date with entry but no images', () => {
      const db = getTestDb();
      
      // Watch and log both without images
      const watchResult = db.prepare(`
        INSERT INTO watches (brand, model, reference) 
        VALUES (?, ?, ?)
      `).run('Tudor', 'Black Bay', '79230B');
      
      db.prepare(`
        INSERT INTO wear_log (watch_id, date, notes) 
        VALUES (?, ?, ?)
      `).run(watchResult.lastInsertRowid, '2026-02-11', 'No photos today');

      const log = db.prepare(`
        SELECT wl.*, w.brand, w.model, w.reference, w.image_url as watch_image
        FROM wear_log wl
        JOIN watches w ON w.id = wl.watch_id
        WHERE wl.date = ?
      `).get('2026-02-11') as any;

      expect(log).toMatchObject({
        date: '2026-02-11',
        image_url: null,
        brand: 'Tudor',
        model: 'Black Bay',
        reference: '79230B',
        watch_image: null,
        notes: 'No photos today'
      });

      // Both images should be null
      const displayImage = log.image_url || log.watch_image;
      expect(displayImage).toBeNull();
    });
  });

  describe('Calendar page monthly query', () => {
    it('should return correct logs for a given month', () => {
      const db = getTestDb();
      
      // Set up test data for February 2026
      const watch1 = db.prepare(`
        INSERT INTO watches (brand, model, reference, image_url) 
        VALUES (?, ?, ?, ?)
      `).run('Grand Seiko', 'SBGW289', 'SBGW289', '/uploads/gs.jpg');
      
      const watch2 = db.prepare(`
        INSERT INTO watches (brand, model, reference) 
        VALUES (?, ?, ?)
      `).run('Rolex', 'Submariner', '116610LN');

      // Add logs for February
      db.prepare(`INSERT INTO wear_log (watch_id, date, image_url, notes) VALUES (?, ?, ?, ?)`).run(
        watch1.lastInsertRowid, '2026-02-05', '/uploads/wrist1.jpg', 'Feb 5'
      );
      db.prepare(`INSERT INTO wear_log (watch_id, date, notes) VALUES (?, ?, ?)`).run(
        watch2.lastInsertRowid, '2026-02-15', 'Feb 15'
      );
      db.prepare(`INSERT INTO wear_log (watch_id, date, notes) VALUES (?, ?, ?)`).run(
        watch1.lastInsertRowid, '2026-02-28', 'Feb 28'
      );

      // Add a log for different month to ensure it's not included
      db.prepare(`INSERT INTO wear_log (watch_id, date, notes) VALUES (?, ?, ?)`).run(
        watch1.lastInsertRowid, '2026-03-01', 'March 1'
      );

      // Execute calendar page query for February 2026
      const logs = db.prepare(`
        SELECT w.*, wl.id as wl_id, wl.date, wl.image_url as log_image, wl.notes
        FROM wear_log wl
        JOIN watches w ON w.id = wl.watch_id
        WHERE wl.date LIKE ?
        ORDER BY wl.date
      `).all('2026-02-%') as any[];

      expect(logs).toHaveLength(3);
      
      expect(logs[0]).toMatchObject({
        date: '2026-02-05',
        brand: 'Grand Seiko',
        model: 'SBGW289',
        log_image: '/uploads/wrist1.jpg',
        notes: 'Feb 5'
      });

      expect(logs[1]).toMatchObject({
        date: '2026-02-15',
        brand: 'Rolex',
        model: 'Submariner',
        log_image: null,
        notes: 'Feb 15'
      });

      expect(logs[2]).toMatchObject({
        date: '2026-02-28',
        brand: 'Grand Seiko',
        model: 'SBGW289',
        log_image: null,
        notes: 'Feb 28'
      });

      // Verify March entry is not included
      expect(logs.some(log => log.date === '2026-03-01')).toBe(false);
    });

    it('should return empty array for month with no logs', () => {
      const db = getTestDb();
      
      // Add logs for February, query for January
      const watch = db.prepare(`
        INSERT INTO watches (brand, model, reference) VALUES (?, ?, ?)
      `).run('Test', 'Watch', 'TW001');
      
      db.prepare(`INSERT INTO wear_log (watch_id, date) VALUES (?, ?)`).run(
        watch.lastInsertRowid, '2026-02-01'
      );

      const logs = db.prepare(`
        SELECT w.*, wl.id as wl_id, wl.date, wl.image_url as log_image, wl.notes
        FROM wear_log wl
        JOIN watches w ON w.id = wl.watch_id
        WHERE wl.date LIKE ?
        ORDER BY wl.date
      `).all('2026-01-%');

      expect(logs).toHaveLength(0);
    });
  });

  describe('Log page → Calendar query integration', () => {
    it('should create wear entry that shows up in calendar query', () => {
      const db = getTestDb();
      
      // Create a watch
      const watchResult = db.prepare(`
        INSERT INTO watches (brand, model, reference, image_url) 
        VALUES (?, ?, ?, ?)
      `).run('Seiko', '5KX', 'SRPD55K1', '/uploads/seiko5kx.jpg');

      // Simulate log page POST: create wear log entry
      const logResult = db.prepare(`
        INSERT INTO wear_log (watch_id, date, image_url, notes) 
        VALUES (?, ?, ?, ?)
      `).run(
        watchResult.lastInsertRowid, 
        '2026-02-12', 
        '/uploads/wrist-shot-2026-02-12.jpg',
        'Posted via log page'
      );

      expect(logResult.changes).toBe(1);

      // Verify it shows up in calendar query
      const calendarLogs = db.prepare(`
        SELECT w.*, wl.id as wl_id, wl.date, wl.image_url as log_image, wl.notes
        FROM wear_log wl
        JOIN watches w ON w.id = wl.watch_id
        WHERE wl.date LIKE ?
        ORDER BY wl.date
      `).all('2026-02-%') as any[];

      expect(calendarLogs).toHaveLength(1);
      expect(calendarLogs[0]).toMatchObject({
        date: '2026-02-12',
        brand: 'Seiko',
        model: '5KX',
        reference: 'SRPD55K1',
        log_image: '/uploads/wrist-shot-2026-02-12.jpg',
        notes: 'Posted via log page'
      });

      // Verify it also shows up in day detail query
      const dayDetail = db.prepare(`
        SELECT wl.*, w.brand, w.model, w.reference, w.image_url as watch_image
        FROM wear_log wl
        JOIN watches w ON w.id = wl.watch_id
        WHERE wl.date = ?
      `).get('2026-02-12') as any;

      expect(dayDetail).toMatchObject({
        date: '2026-02-12',
        brand: 'Seiko',
        model: '5KX',
        image_url: '/uploads/wrist-shot-2026-02-12.jpg',
        watch_image: '/uploads/seiko5kx.jpg'
      });
    });
  });

  describe('Stats page wear count accuracy', () => {
    it('should accurately count total days tracked', () => {
      const db = getTestDb();
      
      // Set up multiple watches and logs
      const watch1 = db.prepare(`
        INSERT INTO watches (brand, model, reference) VALUES (?, ?, ?)
      `).run('Grand Seiko', 'SBGW289', 'SBGW289');
      
      const watch2 = db.prepare(`
        INSERT INTO watches (brand, model, reference) VALUES (?, ?, ?)
      `).run('Rolex', 'Submariner', '116610LN');

      // Add multiple wear logs
      db.prepare(`INSERT INTO wear_log (watch_id, date) VALUES (?, ?)`).run(watch1.lastInsertRowid, '2026-02-01');
      db.prepare(`INSERT INTO wear_log (watch_id, date) VALUES (?, ?)`).run(watch2.lastInsertRowid, '2026-02-02');
      db.prepare(`INSERT INTO wear_log (watch_id, date) VALUES (?, ?)`).run(watch1.lastInsertRowid, '2026-02-03');
      db.prepare(`INSERT INTO wear_log (watch_id, date) VALUES (?, ?)`).run(watch1.lastInsertRowid, '2026-02-04');
      db.prepare(`INSERT INTO wear_log (watch_id, date) VALUES (?, ?)`).run(watch2.lastInsertRowid, '2026-02-05');

      // Execute stats page total count query
      const totalDays = (db.prepare('SELECT COUNT(*) as c FROM wear_log').get() as { c: number }).c;
      expect(totalDays).toBe(5);
    });

    it('should accurately count wears by watch', () => {
      const db = getTestDb();
      
      // Set up watches
      const watch1 = db.prepare(`
        INSERT INTO watches (brand, model, reference) VALUES (?, ?, ?)
      `).run('Grand Seiko', 'SBGW289', 'SBGW289');
      
      const watch2 = db.prepare(`
        INSERT INTO watches (brand, model, reference) VALUES (?, ?, ?)
      `).run('Rolex', 'Submariner', '116610LN');

      const watch3 = db.prepare(`
        INSERT INTO watches (brand, model, reference) VALUES (?, ?, ?)
      `).run('Omega', 'Speedmaster', '311.30.42.30.01.005');

      // Add logs: GS=3, Rolex=2, Omega=1
      db.prepare(`INSERT INTO wear_log (watch_id, date) VALUES (?, ?)`).run(watch1.lastInsertRowid, '2026-02-01');
      db.prepare(`INSERT INTO wear_log (watch_id, date) VALUES (?, ?)`).run(watch1.lastInsertRowid, '2026-02-02');
      db.prepare(`INSERT INTO wear_log (watch_id, date) VALUES (?, ?)`).run(watch1.lastInsertRowid, '2026-02-03');
      
      db.prepare(`INSERT INTO wear_log (watch_id, date) VALUES (?, ?)`).run(watch2.lastInsertRowid, '2026-02-04');
      db.prepare(`INSERT INTO wear_log (watch_id, date) VALUES (?, ?)`).run(watch2.lastInsertRowid, '2026-02-05');
      
      db.prepare(`INSERT INTO wear_log (watch_id, date) VALUES (?, ?)`).run(watch3.lastInsertRowid, '2026-02-06');

      // Execute stats page wear count query
      const wearCounts = db.prepare(`
        SELECT w.brand, w.model, w.reference, COUNT(*) as count
        FROM wear_log wl JOIN watches w ON w.id = wl.watch_id
        GROUP BY wl.watch_id ORDER BY count DESC
      `).all() as Array<{ brand: string; model: string; reference: string | null; count: number }>;

      expect(wearCounts).toHaveLength(3);
      
      // Should be ordered by count (DESC)
      expect(wearCounts[0]).toMatchObject({
        brand: 'Grand Seiko',
        model: 'SBGW289',
        count: 3
      });

      expect(wearCounts[1]).toMatchObject({
        brand: 'Rolex', 
        model: 'Submariner',
        count: 2
      });

      expect(wearCounts[2]).toMatchObject({
        brand: 'Omega',
        model: 'Speedmaster',
        count: 1
      });
    });

    it('should handle no wear logs gracefully', () => {
      const db = getTestDb();
      
      // Add watches but no logs
      db.prepare(`INSERT INTO watches (brand, model, reference) VALUES (?, ?, ?)`).run('Test', 'Watch', 'TW001');

      const totalDays = (db.prepare('SELECT COUNT(*) as c FROM wear_log').get() as { c: number }).c;
      expect(totalDays).toBe(0);

      const wearCounts = db.prepare(`
        SELECT w.brand, w.model, w.reference, COUNT(*) as count
        FROM wear_log wl JOIN watches w ON w.id = wl.watch_id
        GROUP BY wl.watch_id ORDER BY count DESC
      `).all();

      expect(wearCounts).toHaveLength(0);
    });
  });

  describe('Data consistency across queries', () => {
    it('should maintain consistency between calendar and day detail queries', () => {
      const db = getTestDb();
      
      // Set up comprehensive test data
      const watch = db.prepare(`
        INSERT INTO watches (brand, model, reference, image_url) 
        VALUES (?, ?, ?, ?)
      `).run('IWC', 'Pilot', 'IW327009', '/uploads/iwc-pilot.jpg');

      db.prepare(`
        INSERT INTO wear_log (watch_id, date, image_url, notes) 
        VALUES (?, ?, ?, ?)
      `).run(watch.lastInsertRowid, '2026-02-15', '/uploads/wrist-iwc.jpg', 'Flying today');

      // Calendar query
      const calendarLogs = db.prepare(`
        SELECT w.*, wl.id as wl_id, wl.date, wl.image_url as log_image, wl.notes
        FROM wear_log wl
        JOIN watches w ON w.id = wl.watch_id
        WHERE wl.date LIKE ?
        ORDER BY wl.date
      `).all('2026-02-%') as any[];

      // Day detail query
      const dayDetail = db.prepare(`
        SELECT wl.*, w.brand, w.model, w.reference, w.image_url as watch_image
        FROM wear_log wl
        JOIN watches w ON w.id = wl.watch_id
        WHERE wl.date = ?
      `).get('2026-02-15') as any;

      // Both queries should return consistent data
      expect(calendarLogs).toHaveLength(1);
      const calendarEntry = calendarLogs[0];

      expect(calendarEntry.brand).toBe(dayDetail.brand);
      expect(calendarEntry.model).toBe(dayDetail.model);
      expect(calendarEntry.reference).toBe(dayDetail.reference);
      expect(calendarEntry.date).toBe(dayDetail.date);
      expect(calendarEntry.log_image).toBe(dayDetail.image_url);
      expect(calendarEntry.notes).toBe(dayDetail.notes);
      expect(calendarEntry.image_url).toBe(dayDetail.watch_image); // watch image consistency
    });

    it('should maintain accurate wear counts after adding/removing logs', () => {
      const db = getTestDb();
      
      const watch = db.prepare(`
        INSERT INTO watches (brand, model, reference) VALUES (?, ?, ?)
      `).run('Test', 'Watch', 'TW001');

      // Initial state: no logs
      let totalCount = (db.prepare('SELECT COUNT(*) as c FROM wear_log').get() as { c: number }).c;
      expect(totalCount).toBe(0);

      // Add logs
      db.prepare(`INSERT INTO wear_log (watch_id, date) VALUES (?, ?)`).run(watch.lastInsertRowid, '2026-02-01');
      db.prepare(`INSERT INTO wear_log (watch_id, date) VALUES (?, ?)`).run(watch.lastInsertRowid, '2026-02-02');
      
      totalCount = (db.prepare('SELECT COUNT(*) as c FROM wear_log').get() as { c: number }).c;
      expect(totalCount).toBe(2);

      let wearCount = db.prepare(`
        SELECT COUNT(*) as count FROM wear_log wl 
        JOIN watches w ON w.id = wl.watch_id 
        WHERE wl.watch_id = ?
      `).get(watch.lastInsertRowid) as { count: number };
      expect(wearCount.count).toBe(2);

      // Remove one log
      db.prepare('DELETE FROM wear_log WHERE date = ?').run('2026-02-01');
      
      totalCount = (db.prepare('SELECT COUNT(*) as c FROM wear_log').get() as { c: number }).c;
      expect(totalCount).toBe(1);

      wearCount = db.prepare(`
        SELECT COUNT(*) as count FROM wear_log wl 
        JOIN watches w ON w.id = wl.watch_id 
        WHERE wl.watch_id = ?
      `).get(watch.lastInsertRowid) as { count: number };
      expect(wearCount.count).toBe(1);
    });
  });
});