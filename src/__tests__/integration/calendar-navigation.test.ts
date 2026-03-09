/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST as createWatch } from '@/app/api/watches/route';
import { POST as logWear } from '@/app/api/wear-log/route';
import { getTestDb, resetTestDb, closeTestDb, getAuthHeaders } from '@/lib/test-db';

// Mock the main db module to use test database
jest.mock('../../lib/db', () => {
  return require('../../lib/test-db').getTestDb();
});

function makeReq(url: string, options?: RequestInit) {
  const headers = { 'Content-Type': 'application/json', ...getAuthHeaders(), ...(options?.headers as Record<string, string> || {}) };
  return new NextRequest(url, { ...options, headers });
}

describe('Integration: Calendar Navigation & Display', () => {
  beforeEach(() => {
    resetTestDb();
  });

  afterAll(() => {
    closeTestDb();
  });

  it('should filter wear logs by month correctly', async () => {
    const db = getTestDb();

    const watch1 = await (await createWatch(makeReq('http://localhost/api/watches', { method: 'POST', body: JSON.stringify({ brand: 'Watch1', model: 'Model1' }) }))).json();
    const watch2 = await (await createWatch(makeReq('http://localhost/api/watches', { method: 'POST', body: JSON.stringify({ brand: 'Watch2', model: 'Model2' }) }))).json();

    // Insert wear logs across multiple months
    const wearLogs = [
      // January 2026
      { watch_id: watch1.id, date: '2026-01-15', notes: 'January wear 1' },
      { watch_id: watch2.id, date: '2026-01-28', notes: 'January wear 2' },

      // February 2026
      { watch_id: watch1.id, date: '2026-02-03', notes: 'February wear 1' },
      { watch_id: watch2.id, date: '2026-02-14', notes: 'February wear 2' },
      { watch_id: watch1.id, date: '2026-02-28', notes: 'February wear 3' },

      // March 2026
      { watch_id: watch2.id, date: '2026-03-10', notes: 'March wear 1' },

      // December 2025 (different year)
      { watch_id: watch1.id, date: '2025-12-25', notes: 'December wear' }
    ];

    for (const wearData of wearLogs) {
      const logResponse = await logWear(makeReq('http://localhost/api/wear-log', { method: 'POST', body: JSON.stringify(wearData) }));
      expect(logResponse.status).toBe(200);
    }

    // Test: Query for February 2026 (same query as page.tsx uses)
    const year = 2026;
    const month = 2; // 1-based
    const monthStr = String(month).padStart(2, '0');

    const febLogs = db.prepare(`
      SELECT w.*, wl.id as wl_id, wl.date, wl.image_url as log_image, wl.notes
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date LIKE ?
      ORDER BY wl.date
    `).all(`${year}-${monthStr}-%`);

    expect(febLogs).toHaveLength(3); // Only February logs
    expect(febLogs[0]).toMatchObject({ date: '2026-02-03', notes: 'February wear 1', brand: 'Watch1' });
    expect(febLogs[1]).toMatchObject({ date: '2026-02-14', notes: 'February wear 2', brand: 'Watch2' });
    expect(febLogs[2]).toMatchObject({ date: '2026-02-28', notes: 'February wear 3', brand: 'Watch1' });

    // Test: Query for January 2026
    const janLogs = db.prepare(`
      SELECT w.*, wl.id as wl_id, wl.date, wl.image_url as log_image, wl.notes
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date LIKE ?
      ORDER BY wl.date
    `).all('2026-01-%');

    expect(janLogs).toHaveLength(2); // Only January logs
    expect(janLogs[0].date).toBe('2026-01-15');
    expect(janLogs[1].date).toBe('2026-01-28');

    // Test: Query for March 2026
    const marLogs = db.prepare(`
      SELECT w.*, wl.id as wl_id, wl.date, wl.image_url as log_image, wl.notes
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date LIKE ?
      ORDER BY wl.date
    `).all('2026-03-%');

    expect(marLogs).toHaveLength(1); // Only March log
    expect(marLogs[0]).toMatchObject({ date: '2026-03-10', notes: 'March wear 1' });

    // Test: Query for December 2025 (different year)
    const decLogs = db.prepare(`
      SELECT w.*, wl.id as wl_id, wl.date, wl.image_url as log_image, wl.notes
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date LIKE ?
      ORDER BY wl.date
    `).all('2025-12-%');

    expect(decLogs).toHaveLength(1);
    expect(decLogs[0]).toMatchObject({ date: '2025-12-25', notes: 'December wear' });
  });

  it('should return empty result for months with no logs', async () => {
    const db = getTestDb();

    await createWatch(makeReq('http://localhost/api/watches', { method: 'POST', body: JSON.stringify({ brand: 'Unused', model: 'Watch' }) }));

    // Query for a month with no logs (April 2026)
    const emptyMonthLogs = db.prepare(`
      SELECT w.*, wl.id as wl_id, wl.date, wl.image_url as log_image, wl.notes
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date LIKE ?
      ORDER BY wl.date
    `).all('2026-04-%');

    expect(emptyMonthLogs).toHaveLength(0);
    expect(Array.isArray(emptyMonthLogs)).toBe(true);
  });

  it('should verify calendar today logic uses correct date format', async () => {
    const db = getTestDb();

    const watch = await (await createWatch(makeReq('http://localhost/api/watches', { method: 'POST', body: JSON.stringify({ brand: 'Today', model: 'Watch' }) }))).json();

    // Test with today's date in local format (not UTC)
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

    const todayWearResponse = await logWear(makeReq('http://localhost/api/wear-log', {
      method: 'POST',
      body: JSON.stringify({ watch_id: watch.id, date: todayStr, notes: 'Today wear' })
    }));
    expect(todayWearResponse.status).toBe(200);

    // Test calendar today detection logic (from page.tsx)
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthStr = String(month).padStart(2, '0');

    const todayLogs = db.prepare(`
      SELECT w.*, wl.id as wl_id, wl.date, wl.image_url as log_image, wl.notes
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date LIKE ?
      ORDER BY wl.date
    `).all(`${year}-${monthStr}-%`);

    expect(todayLogs).toHaveLength(1);
    expect(todayLogs[0].date).toBe(todayStr);

    // Verify the date format matches what the calendar component expects
    const logMap = new Map();
    for (const log of todayLogs) {
      const day = parseInt(log.date.split('-')[2]);
      logMap.set(day, log);
    }

    const todayDay = now.getDate();
    expect(logMap.has(todayDay)).toBe(true);
    expect(logMap.get(todayDay)).toMatchObject({ brand: 'Today', model: 'Watch', notes: 'Today wear' });
  });

  it('should handle dates at month boundaries correctly', async () => {
    const db = getTestDb();

    const watch = await (await createWatch(makeReq('http://localhost/api/watches', { method: 'POST', body: JSON.stringify({ brand: 'Boundary', model: 'Test' }) }))).json();

    // Test month boundary dates
    const boundaryDates = [
      { date: '2026-01-31', description: 'Last day of January' },
      { date: '2026-02-01', description: 'First day of February' },
      { date: '2026-02-28', description: 'Last day of February (non-leap year)' },
      { date: '2026-03-01', description: 'First day of March' },
      { date: '2026-12-31', description: 'Last day of year' }
    ];

    for (const { date, description } of boundaryDates) {
      const boundaryWearResponse = await logWear(makeReq('http://localhost/api/wear-log', {
        method: 'POST',
        body: JSON.stringify({ watch_id: watch.id, date, notes: description })
      }));
      expect(boundaryWearResponse.status).toBe(200);
    }

    // Test January query includes Jan 31 but not Feb 1
    const janLogs = db.prepare(`
      SELECT w.*, wl.id as wl_id, wl.date, wl.image_url as log_image, wl.notes
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date LIKE ?
      ORDER BY wl.date
    `).all('2026-01-%');

    expect(janLogs).toHaveLength(1);
    expect(janLogs[0]).toMatchObject({ date: '2026-01-31', notes: 'Last day of January' });

    // Test February query includes Feb 1 and Feb 28 but not Jan 31 or Mar 1
    const febLogs = db.prepare(`
      SELECT w.*, wl.id as wl_id, wl.date, wl.image_url as log_image, wl.notes
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date LIKE ?
      ORDER BY wl.date
    `).all('2026-02-%');

    expect(febLogs).toHaveLength(2);
    expect(febLogs[0]).toMatchObject({ date: '2026-02-01', notes: 'First day of February' });
    expect(febLogs[1]).toMatchObject({ date: '2026-02-28', notes: 'Last day of February (non-leap year)' });

    // Test March query includes Mar 1 but not Feb 28
    const marLogs = db.prepare(`
      SELECT w.*, wl.id as wl_id, wl.date, wl.image_url as log_image, wl.notes
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date LIKE ?
      ORDER BY wl.date
    `).all('2026-03-%');

    expect(marLogs).toHaveLength(1);
    expect(marLogs[0]).toMatchObject({ date: '2026-03-01', notes: 'First day of March' });

    // Test December query
    const decLogs = db.prepare(`
      SELECT w.*, wl.id as wl_id, wl.date, wl.image_url as log_image, wl.notes
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date LIKE ?
      ORDER BY wl.date
    `).all('2026-12-%');

    expect(decLogs).toHaveLength(1);
    expect(decLogs[0]).toMatchObject({ date: '2026-12-31', notes: 'Last day of year' });
  });

  it('should handle leap year February correctly', async () => {
    const db = getTestDb();

    const watch = await (await createWatch(makeReq('http://localhost/api/watches', { method: 'POST', body: JSON.stringify({ brand: 'Leap', model: 'Year' }) }))).json();

    const leapYearDates = [
      { date: '2024-02-28', description: 'Feb 28 in leap year' },
      { date: '2024-02-29', description: 'Leap day' },
      { date: '2024-03-01', description: 'Mar 1 after leap day' }
    ];

    for (const { date, description } of leapYearDates) {
      const leapWearResponse = await logWear(makeReq('http://localhost/api/wear-log', {
        method: 'POST',
        body: JSON.stringify({ watch_id: watch.id, date, notes: description })
      }));
      expect(leapWearResponse.status).toBe(200);
    }

    // Test February 2024 query includes Feb 29
    const feb2024Logs = db.prepare(`
      SELECT w.*, wl.id as wl_id, wl.date, wl.image_url as log_image, wl.notes
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date LIKE ?
      ORDER BY wl.date
    `).all('2024-02-%');

    expect(feb2024Logs).toHaveLength(2);
    expect(feb2024Logs[0].date).toBe('2024-02-28');
    expect(feb2024Logs[1].date).toBe('2024-02-29');

    // Test March 2024 query excludes Feb 29
    const mar2024Logs = db.prepare(`
      SELECT w.*, wl.id as wl_id, wl.date, wl.image_url as log_image, wl.notes
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date LIKE ?
      ORDER BY wl.date
    `).all('2024-03-%');

    expect(mar2024Logs).toHaveLength(1);
    expect(mar2024Logs[0].date).toBe('2024-03-01');
  });

  it('should sort logs by date within a month correctly', async () => {
    const db = getTestDb();

    const watch1 = await (await createWatch(makeReq('http://localhost/api/watches', { method: 'POST', body: JSON.stringify({ brand: 'Sort', model: 'Test1' }) }))).json();
    const watch2 = await (await createWatch(makeReq('http://localhost/api/watches', { method: 'POST', body: JSON.stringify({ brand: 'Sort', model: 'Test2' }) }))).json();

    // Add wears in non-chronological order
    const unorderedWears = [
      { watch_id: watch2.id, date: '2026-05-15', notes: 'Middle' },
      { watch_id: watch1.id, date: '2026-05-01', notes: 'First' },
      { watch_id: watch1.id, date: '2026-05-31', notes: 'Last' },
      { watch_id: watch2.id, date: '2026-05-10', notes: 'Second' }
    ];

    for (const wearData of unorderedWears) {
      const wearResponse = await logWear(makeReq('http://localhost/api/wear-log', { method: 'POST', body: JSON.stringify(wearData) }));
      expect(wearResponse.status).toBe(200);
    }

    // Query with ORDER BY wl.date (same as page.tsx)
    const sortedLogs = db.prepare(`
      SELECT w.*, wl.id as wl_id, wl.date, wl.image_url as log_image, wl.notes
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date LIKE ?
      ORDER BY wl.date
    `).all('2026-05-%');

    expect(sortedLogs).toHaveLength(4);

    // Should be sorted chronologically
    expect(sortedLogs[0]).toMatchObject({ date: '2026-05-01', notes: 'First' });
    expect(sortedLogs[1]).toMatchObject({ date: '2026-05-10', notes: 'Second' });
    expect(sortedLogs[2]).toMatchObject({ date: '2026-05-15', notes: 'Middle' });
    expect(sortedLogs[3]).toMatchObject({ date: '2026-05-31', notes: 'Last' });

    // Verify the date parsing for day display (calendar component logic)
    const logMap = new Map();
    for (const log of sortedLogs) {
      const day = parseInt(log.date.split('-')[2]);
      logMap.set(day, log);
    }

    expect(logMap.get(1)?.notes).toBe('First');
    expect(logMap.get(10)?.notes).toBe('Second');
    expect(logMap.get(15)?.notes).toBe('Middle');
    expect(logMap.get(31)?.notes).toBe('Last');
  });
});
