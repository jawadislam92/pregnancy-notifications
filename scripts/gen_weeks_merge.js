// Merge step: keep the 10 hand-authored milestone entries from src/weeks.js
// verbatim, build the 27 in-between weeks from scripts/weeks_parsed.json, and
// emit a 37-entry src/weeks.js (sorted by week).
//
//   node scripts/gen_weeks_merge.js
//
// The in-between weeks take their primary/accent from the nearest milestone
// (their reused "template"); colours are actually resolved per-template at
// render time, but these keep the data self-consistent as a fallback.

const fs = require('fs');
const path = require('path');

const existing = require('../src/weeks');            // 10 milestones (authoritative)
const parsed = require('./weeks_parsed.json');       // all 37, machine-parsed
const MILESTONES = [4, 8, 12, 16, 20, 24, 28, 32, 36, 40];

const byWeek = new Map(existing.map((e) => [e.week, e]));
const parsedByWeek = new Map(parsed.map((e) => [e.week, e]));

function template(n) {
  return MILESTONES.reduce((best, m) =>
    Math.abs(m - n) < Math.abs(best - n) ? m : best, MILESTONES[0]);
}

const merged = [];
for (let w = 4; w <= 40; w++) {
  if (byWeek.has(w)) { merged.push(byWeek.get(w)); continue; }   // milestone: verbatim
  const p = parsedByWeek.get(w);
  if (!p) throw new Error('no parsed content for week ' + w);
  const donor = byWeek.get(template(w));
  const e = {
    week: w,
    fruit: p.fruit,
    length: p.length,
    weight: p.weight,
    primary: donor.primary,
    accent: donor.accent,
    babyDev: p.babyDev,
    mama: { en: [p.mama.en], de: [p.mama.de] },   // single sentence → one bullet
    callout: p.callout,
  };
  if (p.tip && (p.tip.en || p.tip.de)) e.tip = p.tip;
  merged.push(e);
}

// ---- serialize as readable JS (unquoted keys, JSON-escaped string values) ----
const s = (v) => JSON.stringify(v);
const ende = (o) => `{ en: ${s(o.en)}, de: ${s(o.de)} }`;
const block = (o) => `{\n      en: ${s(o.en)},\n      de: ${s(o.de)}\n    }`;
const mama = (o) => `{\n      en: [${o.en.map(s).join(', ')}],\n      de: [${o.de.map(s).join(', ')}]\n    }`;
const callout = (c) =>
  `{\n      label: ${ende(c.label)},\n      text: {\n        en: ${s(c.text.en)},\n        de: ${s(c.text.de)}\n      }\n    }`;

function entry(e) {
  const L = [];
  L.push('  {');
  L.push(`    week: ${e.week}, fruit: ${ende(e.fruit)},`);
  L.push(`    length: ${s(e.length)}, weight: ${s(e.weight)},`);
  L.push(`    primary: ${s(e.primary)}, accent: ${s(e.accent)},`);
  L.push(`    babyDev: ${block(e.babyDev)},`);
  L.push(`    mama: ${mama(e.mama)},`);
  L.push(`    callout: ${callout(e.callout)}${e.tip ? ',' : ''}`);
  if (e.tip) L.push(`    tip: ${block(e.tip)}`);
  L.push('  }');
  return L.join('\n');
}

const header = `// Per-week content for the 37 calendar pages (weeks 4..40 inclusive).
// Bilingual (English / German). GENERATED — do not hand-edit:
//   the 10 milestone weeks (4,8,...,40) are hand-authored and preserved;
//   the 27 in-between weeks are parsed from "Pregnancy Calendar Overview.xlsx"
//   by scripts/gen_weeks.py + scripts/gen_weeks_merge.js.
//
// Colours: \`primary\`/\`accent\` are fallbacks; the live theme is resolved per
// reused month-template at render time. Body copy uses the neutral grey.

module.exports = [
`;

fs.writeFileSync(path.join(__dirname, '..', 'src', 'weeks.js'),
  header + merged.map(entry).join(',\n') + '\n];\n', 'utf8');
console.log(`wrote src/weeks.js with ${merged.length} weeks`);
