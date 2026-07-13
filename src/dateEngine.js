// Date engine: from a single due date, derive everything the 37 pages need.
//
// Model (per the client's brief):
//   - Pregnancy is counted week 4 -> week 40; the due date is the end of week 40.
//   - Week N is "reached" (40 - N) weeks before the due date, i.e. its 7-day
//     gestational span ends on dueDate - (40 - N)*7.
//   - Each pregnancy week 4..40 (37 in total) gets its own page, showing the
//     calendar month in which that week mostly falls.
//   - The week is anchored by the MIDPOINT of its 7-day span (span end - 3): the
//     page month and the highlighted Mon–Sun row are chosen from the midpoint, so
//     the highlight holds the majority of the span and "today" lands on the
//     correctly-numbered page. (Anchoring to the span END rounded a day ahead.)
//
// All maths is done in UTC to avoid timezone/DST drift.

const MILESTONES = Array.from({ length: 37 }, (_, i) => i + 4); // weeks 4,5,...,40
const DAY = 86400000;
const WEEK_SPAN_DAYS = 7; // length of the highlighted gestational week

function toUTC(dateStr) {
  // Accepts 'YYYY-MM-DD'
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function addDays(date, n) { return new Date(date.getTime() + n * DAY); }
function ymd(date) {
  return { y: date.getUTCFullYear(), m: date.getUTCMonth(), d: date.getUTCDate() };
}
// Weekday index with Monday = 0 ... Sunday = 6
function mondayIndex(date) { return (date.getUTCDay() + 6) % 7; }

// Build a month grid (array of weeks; each week is 7 cells, cell = day number or null)
function monthGrid(year, month /*0-11*/) {
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const startCol = mondayIndex(first);
  const cells = [];
  for (let i = 0; i < startCol; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { weeks, daysInMonth, startCol };
}

// For a given due date, produce the 37 page descriptors (one per week 4..40).
function buildPages(dueDateStr) {
  const due = toUTC(dueDateStr);
  return MILESTONES.map((week) => {
    const milestoneDate = addDays(due, -(40 - week) * 7); // last day of the week's 7-day span
    const anchor = addDays(milestoneDate, -3);            // span midpoint (span = md-6 .. md)
    const { y, m } = ymd(anchor);                         // page month = month holding the majority of the span
    const grid = monthGrid(y, m);

    // Highlight the whole CALENDAR WEEK (one Mon–Sun grid row) that the span's
    // MIDPOINT falls in. Anchoring to the midpoint (rather than the span end)
    // keeps the highlight a single contiguous band holding the majority of the
    // gestational week, and makes "today" land on the correctly-numbered page.
    const weekMonday = addDays(anchor, -mondayIndex(anchor));
    const highlightDays = [];
    for (let i = 0; i < 7; i++) {
      const p = ymd(addDays(weekMonday, i));
      if (p.y === y && p.m === m) highlightDays.push(p.d);
    }
    const markerStart = highlightDays.length ? highlightDays[0] : null;
    const markerEnd = highlightDays.length ? highlightDays[highlightDays.length - 1] : null;

    return {
      week,
      year: y,
      month: m, // 0-11
      grid: grid.weeks,
      rows: grid.weeks.length,
      highlightDays,
      markerStart,
      markerEnd,
      milestoneISO: milestoneDate.toISOString().slice(0, 10)
    };
  });
}

module.exports = { buildPages, monthGrid, MILESTONES, WEEK_SPAN_DAYS, toUTC, addDays };
