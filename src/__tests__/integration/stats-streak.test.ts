/**
 * @jest-environment node
 */

import { getTestDb, resetTestDb, closeTestDb, TEST_USER_ID } from '@/lib/test-db';

jest.mock('../../lib/db', () => {
  return require('../../lib/test-db').getTestDb();
});

const TOTAL_DAYS_QUERY = 'SELECT COUNT(DISTINCT date) as c FROM wear_log WHERE user_id = ?';
const STREAK_QUERY = 'SELECT DISTINCT date FROM wear_log WHERE user_id = ? ORDER BY date DESC';

function computeStreak(allDates: Array<{ date: string }>): number {
  let streak = 0;
  if (allDates.length > 0) {
    let expected = new Date(allDates[0].date + 'T12:00:00');
    for (const row of allDates) {
      const d = new Date(row.date + 'T12:00:00');
      if (d.getTime() === expected.getTime()) {
        streak++;
        expected = new Date(expected.getTime() - 86400000);
      } else {
        break;
      }
    }
  }
  return streak;
}

describe('Stats: streak and total days with multiple wears per day', () => {
  beforeEach(() => resetTestDb());
  afterAll(() => closeTestDb());

  it('counts each day once even with multiple wears', () => {
    const db = getTestDb();
    const w1 = db.prepare('INSERT INTO watches (user_id, brand, model) VALUES (?, ?, ?)').run(TEST_USER_ID, 'Rolex', 'Sub');
    const w2 = db.prepare('INSERT INTO watches (user_id, brand, model) VALUES (?, ?, ?)').run(TEST_USER_ID, 'Omega', 'Speed');

    // Two watches worn on the same day
    db.prepare('INSERT INTO wear_log (user_id, watch_id, date) VALUES (?, ?, ?)').run(TEST_USER_ID, w1.lastInsertRowid, '2026-03-20');
    db.prepare('INSERT INTO wear_log (user_id, watch_id, date) VALUES (?, ?, ?)').run(TEST_USER_ID, w2.lastInsertRowid, '2026-03-20');

    const row = db.prepare(TOTAL_DAYS_QUERY).get(TEST_USER_ID) as { c: number };
    expect(row.c).toBe(1);
  });

  it('streak is not broken by multiple wears on the same day', () => {
    const db = getTestDb();
    const w1 = db.prepare('INSERT INTO watches (user_id, brand, model) VALUES (?, ?, ?)').run(TEST_USER_ID, 'Rolex', 'Sub');
    const w2 = db.prepare('INSERT INTO watches (user_id, brand, model) VALUES (?, ?, ?)').run(TEST_USER_ID, 'Omega', 'Speed');

    // 3 consecutive days, day 2 has two wears
    db.prepare('INSERT INTO wear_log (user_id, watch_id, date) VALUES (?, ?, ?)').run(TEST_USER_ID, w1.lastInsertRowid, '2026-03-20');
    db.prepare('INSERT INTO wear_log (user_id, watch_id, date) VALUES (?, ?, ?)').run(TEST_USER_ID, w1.lastInsertRowid, '2026-03-21');
    db.prepare('INSERT INTO wear_log (user_id, watch_id, date) VALUES (?, ?, ?)').run(TEST_USER_ID, w2.lastInsertRowid, '2026-03-21');
    db.prepare('INSERT INTO wear_log (user_id, watch_id, date) VALUES (?, ?, ?)').run(TEST_USER_ID, w1.lastInsertRowid, '2026-03-22');

    const allDates = db.prepare(STREAK_QUERY).all(TEST_USER_ID) as Array<{ date: string }>;
    expect(computeStreak(allDates)).toBe(3);
  });

  it('streak breaks on a gap', () => {
    const db = getTestDb();
    const w1 = db.prepare('INSERT INTO watches (user_id, brand, model) VALUES (?, ?, ?)').run(TEST_USER_ID, 'Rolex', 'Sub');

    db.prepare('INSERT INTO wear_log (user_id, watch_id, date) VALUES (?, ?, ?)').run(TEST_USER_ID, w1.lastInsertRowid, '2026-03-18');
    // gap on 03-19
    db.prepare('INSERT INTO wear_log (user_id, watch_id, date) VALUES (?, ?, ?)').run(TEST_USER_ID, w1.lastInsertRowid, '2026-03-20');
    db.prepare('INSERT INTO wear_log (user_id, watch_id, date) VALUES (?, ?, ?)').run(TEST_USER_ID, w1.lastInsertRowid, '2026-03-21');

    const allDates = db.prepare(STREAK_QUERY).all(TEST_USER_ID) as Array<{ date: string }>;
    expect(computeStreak(allDates)).toBe(2);
  });

  it('returns zero streak with no wear logs', () => {
    const db = getTestDb();
    const allDates = db.prepare(STREAK_QUERY).all(TEST_USER_ID) as Array<{ date: string }>;
    expect(computeStreak(allDates)).toBe(0);
  });
});
