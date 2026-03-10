/**
 * @jest-environment node
 */

import { getTestDb, resetTestDb, closeTestDb, TEST_USER_ID } from '@/lib/test-db';

jest.mock('../../lib/db', () => {
  return require('../../lib/test-db').getTestDb();
});

const NEGLECTED_QUERY = `
  SELECT w.brand, w.model, w.reference, MAX(wl.date) as last_worn
  FROM watches w
  LEFT JOIN wear_log wl ON wl.watch_id = w.id AND wl.user_id = ?
  WHERE w.user_id = ? AND w.status = 'owned'
  GROUP BY w.id, w.brand, w.model, w.reference
  ORDER BY MAX(wl.date) IS NOT NULL, MAX(wl.date) ASC
  LIMIT 3
`;

describe('Stats: neglected watches query', () => {
  beforeEach(() => resetTestDb());
  afterAll(() => closeTestDb());

  it('returns never-worn watches first', () => {
    const db = getTestDb();
    const ins = db.prepare('INSERT INTO watches (user_id, brand, model) VALUES (?, ?, ?)');
    const w1 = ins.run(TEST_USER_ID, 'Grand Seiko', 'SBGW289');
    const w2 = ins.run(TEST_USER_ID, 'Rolex', 'Submariner');

    // Wear w1, leave w2 never worn
    db.prepare('INSERT INTO wear_log (user_id, watch_id, date) VALUES (?, ?, ?)').run(TEST_USER_ID, w1.lastInsertRowid, '2026-01-01');

    const rows = db.prepare(NEGLECTED_QUERY).all(TEST_USER_ID, TEST_USER_ID) as any[];
    expect(rows[0].brand).toBe('Rolex'); // never worn → first
    expect(rows[0].last_worn).toBeNull();
    expect(rows[1].brand).toBe('Grand Seiko');
    expect(rows[1].last_worn).toBe('2026-01-01');
  });

  it('orders by oldest last_worn date when no never-worn watches', () => {
    const db = getTestDb();
    const ins = db.prepare('INSERT INTO watches (user_id, brand, model) VALUES (?, ?, ?)');
    const w1 = ins.run(TEST_USER_ID, 'A', 'Recent');
    const w2 = ins.run(TEST_USER_ID, 'B', 'Old');
    const wl = db.prepare('INSERT INTO wear_log (user_id, watch_id, date) VALUES (?, ?, ?)');
    wl.run(TEST_USER_ID, w1.lastInsertRowid, '2026-03-01');
    wl.run(TEST_USER_ID, w2.lastInsertRowid, '2026-01-01');

    const rows = db.prepare(NEGLECTED_QUERY).all(TEST_USER_ID, TEST_USER_ID) as any[];
    expect(rows[0].model).toBe('Old');    // older date first
    expect(rows[1].model).toBe('Recent');
  });

  it('excludes sold watches', () => {
    const db = getTestDb();
    db.prepare('INSERT INTO watches (user_id, brand, model, status) VALUES (?, ?, ?, ?)').run(TEST_USER_ID, 'Sold', 'Watch', 'sold');
    db.prepare('INSERT INTO watches (user_id, brand, model, status) VALUES (?, ?, ?, ?)').run(TEST_USER_ID, 'Owned', 'Watch', 'owned');

    const rows = db.prepare(NEGLECTED_QUERY).all(TEST_USER_ID, TEST_USER_ID) as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0].brand).toBe('Owned');
  });

  it('returns at most 3 watches', () => {
    const db = getTestDb();
    const ins = db.prepare('INSERT INTO watches (user_id, brand, model) VALUES (?, ?, ?)');
    for (let i = 1; i <= 5; i++) ins.run(TEST_USER_ID, `Brand${i}`, `Model${i}`);

    const rows = db.prepare(NEGLECTED_QUERY).all(TEST_USER_ID, TEST_USER_ID) as any[];
    expect(rows).toHaveLength(3);
  });

  it('returns empty list when user has no owned watches', () => {
    const rows = db.prepare(NEGLECTED_QUERY).all(TEST_USER_ID, TEST_USER_ID) as any[];
    expect(rows).toHaveLength(0);
  });
});

// top-level db for the last test (no watches seeded)
const db = getTestDb();
