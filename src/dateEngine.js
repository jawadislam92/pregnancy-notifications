// Date engine: from a single due date, derive everything the 10 pages need.
//
// Model (per the client's brief):
//   - Pregnancy is counted week 4 -> week 40; the due date is the end of week 40.
//   - Milestone week N is "reached" N weeks before... i.e. dueDate - (40 - N) weeks.
//   - Each of the 10 milestone weeks (4,8,...,40) gets one page, showing the
//     calendar month in which that milestone falls.
//   - The gestational week is a 7-day span ending on the milestone date; those
//     days are highlighted, with a flower marker on the first and last day.
//
// All maths is done in UTC to avoid timezone/DST drift.

const MILESTONES = [4, 8, 12, 16, 20, 24, 28, 32, 36, 40];
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

// For a given due date, produce the 10 page descriptors.
function buildPages(dueDateStr) {
  const due = toUTC(dueDateStr);
  return MILESTONES.map((week) => {
    const milestoneDate = addDays(due, -(40 - week) * 7);
    const { y, m } = ymd(milestoneDate);
    const grid = monthGrid(y, m);

    // Highlighted gestational week: the WEEK_SPAN_DAYS ending on the milestone date.
    const hlEnd = milestoneDate;
    const hlStart = addDays(hlEnd, -(WEEK_SPAN_DAYS - 1));

    // Which day-numbers of THIS month are highlighted, and where the markers go.
    const highlightDays = [];
    for (let i = 0; i < WEEK_SPAN_DAYS; i++) {
      const day = addDays(hlStart, i);
      const p = ymd(day);
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
