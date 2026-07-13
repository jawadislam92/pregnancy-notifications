const { test } = require('node:test');
const assert = require('node:assert');
const { buildPages, monthGrid, MILESTONES } = require('../src/dateEngine');

test('produces exactly 37 pages, one per week 4..40', () => {
  const p = buildPages('2026-10-15');
  assert.equal(p.length, 37);
  assert.deepEqual(p.map(x => x.week), MILESTONES);
  assert.deepEqual(MILESTONES, Array.from({ length: 37 }, (_, i) => i + 4));
});

test('week 40 milestone is the due date; highlight is its calendar week', () => {
  const p = buildPages('2026-10-15');
  const w40 = p[36];
  assert.equal(w40.week, 40);
  assert.equal(w40.month, 9);            // October (0-based)
  assert.equal(w40.milestoneISO, '2026-10-15');
  assert.deepEqual(w40.highlightDays, [12, 13, 14, 15, 16, 17, 18]); // Mon–Sun week of Oct 15 (Thu)
  assert.ok(w40.highlightDays.includes(15)); // the milestone day itself
});

test('demo due date maps week 4 to February; highlight is a full calendar week', () => {
  const p = buildPages('2026-10-15');
  const w4 = p[0];
  assert.equal(w4.month, 1);             // February
  assert.deepEqual(w4.highlightDays, [2, 3, 4, 5, 6, 7, 8]); // Mon–Sun week of Feb 5 (Thu)
  assert.ok(w4.highlightDays.includes(5)); // the milestone day
});

test('consecutive weekly pages are 7 days apart', () => {
  const p = buildPages('2026-10-15');
  for (let i = 1; i < p.length; i++) {
    const a = new Date(p[i - 1].milestoneISO);
    const b = new Date(p[i].milestoneISO);
    assert.equal((b - a) / 86400000, 7);
  }
});

test('client scenario: due 2027-01-11, the page highlighting 2026-07-14 is week 15', () => {
  const p = buildPages('2027-01-11');
  const w15 = p.find(x => x.week === 15);
  assert.equal(w15.year, 2026);
  assert.equal(w15.month, 6);                              // July (0-based)
  assert.deepEqual(w15.highlightDays, [13, 14, 15, 16, 17, 18, 19]);
  assert.ok(w15.highlightDays.includes(14));               // today falls on the week-15 page
});

test('monthGrid: February 2026 has 28 days and starts on Sunday (col 6)', () => {
  const g = monthGrid(2026, 1);
  assert.equal(g.daysInMonth, 28);
  assert.equal(g.startCol, 6);            // Monday=0 ... Sunday=6
});

test('monthGrid: leap February 2028 has 29 days', () => {
  assert.equal(monthGrid(2028, 1).daysInMonth, 29);
});

test('monthGrid: every real day appears exactly once and grid is full weeks', () => {
  for (let m = 0; m < 12; m++) {
    const g = monthGrid(2027, m);
    const flat = g.weeks.flat();
    assert.equal(flat.length % 7, 0);
    const nums = flat.filter(Boolean);
    assert.equal(nums.length, g.daysInMonth);
    assert.deepEqual(nums, Array.from({ length: g.daysInMonth }, (_, i) => i + 1));
  }
});

test('year-crossing: an early due date pushes week 4 into the previous year', () => {
  const p = buildPages('2026-02-20');
  assert.ok(p[0].year < 2026, `expected week-4 year < 2026, got ${p[0].year}`);
});

test('every page: highlight is a contiguous band containing the span midpoint', () => {
  for (const pg of buildPages('2026-10-15')) {
    for (let i = 1; i < pg.highlightDays.length; i++) {
      assert.equal(pg.highlightDays[i] - pg.highlightDays[i - 1], 1); // one contiguous band
    }
    assert.ok(pg.highlightDays.length >= 1 && pg.highlightDays.length <= 7);
    // midpoint = span end (milestoneISO) - 3 days; always inside the page month → in the band
    const mid = new Date(pg.milestoneISO); mid.setUTCDate(mid.getUTCDate() - 3);
    assert.ok(pg.highlightDays.includes(mid.getUTCDate()),
      `midpoint ${mid.getUTCDate()} within highlight [${pg.highlightDays}]`);
  }
});
