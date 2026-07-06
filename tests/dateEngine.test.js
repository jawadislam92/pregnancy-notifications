const { test } = require('node:test');
const assert = require('node:assert');
const { buildPages, monthGrid, MILESTONES } = require('../src/dateEngine');

test('produces exactly 10 pages for weeks 4..40', () => {
  const p = buildPages('2026-10-15');
  assert.equal(p.length, 10);
  assert.deepEqual(p.map(x => x.week), MILESTONES);
});

test('week 40 milestone falls on the due date itself', () => {
  const p = buildPages('2026-10-15');
  const w40 = p[9];
  assert.equal(w40.week, 40);
  assert.equal(w40.year, 2026);
  assert.equal(w40.month, 9);            // October (0-based)
  assert.equal(w40.markerEnd, 15);       // due date is the end of week 40
  assert.deepEqual(w40.highlightDays, [9, 10, 11, 12, 13, 14, 15]);
  assert.equal(w40.milestoneISO, '2026-10-15');
});

test('demo due date maps week 4 to February with a partial-week highlight', () => {
  const p = buildPages('2026-10-15');
  const w4 = p[0];
  assert.equal(w4.month, 1);             // February
  assert.equal(w4.markerStart, 1);
  assert.equal(w4.markerEnd, 5);
  assert.equal(w4.highlightDays.length, 5); // week spans late Jan -> only Feb 1-5 shown
});

test('consecutive milestones are 4 weeks (28 days) apart', () => {
  const p = buildPages('2026-10-15');
  for (let i = 1; i < p.length; i++) {
    const a = new Date(p[i - 1].milestoneISO);
    const b = new Date(p[i].milestoneISO);
    assert.equal((b - a) / 86400000, 28);
  }
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

test('full-week highlights contain 7 consecutive days ending on the milestone', () => {
  const p = buildPages('2026-10-15');
  const w40 = p[9];
  for (let i = 1; i < w40.highlightDays.length; i++) {
    assert.equal(w40.highlightDays[i] - w40.highlightDays[i - 1], 1);
  }
  assert.equal(w40.highlightDays[w40.highlightDays.length - 1], w40.markerEnd);
});
