// Renders the 10-page calendar to a single self-contained HTML document.
// Background = the Canva "plate" (all artwork, no text); everything dynamic is
// overlaid in the original 1440x810 coordinate space.
//
// All positions/sizes come from src/design.js — geometry harvested from the
// approved Canva PDF itself (scripts/gen_design.py) — so the overlay lands
// exactly where the original designer placed each element, per page.

const { MONTHS, WEEKDAYS, UI, NEUTRAL, THEME, DATE_DIM } = require('./layout');
const DESIGN = require('./design');
const fs = require('fs');
const path = require('path');

const PAGE_W = 1440, PAGE_H = 810;

// Weeks that have extracted sprites of the design's own artwork
const hasDeco = (name) => new Set(
  [4, 8, 12, 16, 20, 24, 28, 32, 36, 40].filter(w =>
    fs.existsSync(path.join(__dirname, '..', 'assets', 'deco', `${name}-${String(w).padStart(2, '0')}.png`))));
const HEART_SPRITES = hasDeco('bullet-heart');
const CELL_SPRIGS = hasDeco('cellsprig');
const FLOWERS = hasDeco('flower');

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hexToRgba(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }
function darken(hex, f) { const [r, g, b] = hexToRgb(hex); return `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`; }
const pad = (w) => String(w).padStart(2, '0');

// The design was drawn as 10 monthly templates (the milestone weeks). Every
// week 4..40 reuses the NEAREST milestone's background / geometry / colours /
// decor, and overlays its own fruit + content. `template(n)` picks that donor.
const MILESTONES = [4, 8, 12, 16, 20, 24, 28, 32, 36, 40];
const isMilestone = (n) => MILESTONES.includes(n);
const template = (n) => MILESTONES.reduce((b, m) => Math.abs(m - n) < Math.abs(b - n) ? m : b, MILESTONES[0]);
// Fruit-illustration box per template (design coords), harvested by extract_assets.py
// One uniform fruit box for every week (design coords), so the fruit sits at the
// same size/position on every page. object-fit:contain preserves each aspect.
const FRUIT_BOX = { x: 48, y: 402, w: 284, h: 246 };

// -- positioned text helpers (design-space coordinates) ----------------------
// PDF span boxes are glyph-box anchored; line-height:1 + top anchoring puts CSS
// text in the same place when the same font renders it.
function atLeft(p, font, color, content, extra = '') {
  return `<div style="position:absolute;left:${p.x}px;top:${p.y}px;font-family:${font};` +
         `font-size:${p.sz}px;line-height:normal;color:${color};white-space:nowrap;${extra}">${content}</div>`;
}
function atCenter(p, font, color, content, extra = '') {
  return `<div style="position:absolute;left:${p.cx}px;top:${p.y}px;transform:translateX(-50%);` +
         `font-family:${font};font-size:${p.sz}px;line-height:normal;color:${color};white-space:nowrap;${extra}">${content}</div>`;
}
function atBlock(x, y, w, sz, lh, font, color, content, extra = '') {
  return `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;font-family:${font};` +
         `font-size:${sz}px;line-height:${lh};color:${color};${extra}">${content}</div>`;
}

const F = { script: 'var(--f-script)', serif: 'var(--f-serif)', cal: 'var(--f-cal)',
            now: 'var(--f-now)', nunito: 'var(--f-nunito)' };

// Font-metric corrections (measured by ink-position diff against the PDF):
// Brittany's TTF ascent exceeds the PDF subset's, sinking text ~0.23em —
// same for Poppins standing in for "Now". CMU / Open Sauce align exactly.
const yFix = (p, em) => ({ ...p, y: Math.round((p.y - em * p.sz) * 10) / 10 });
const SCRIPT_EM = 0.23, NOW_EM = 0.24;

// ---------------------------------------------------------------------------
function renderCalendar(page, D, theme, lang, ver, week, t) {
  const parts = [];
  const [fx0, fy0, fx1, fy1] = D.frame;
  const bounds = [fx0, ...D.cols, fx1];              // 8 column boundaries
  const stroke = D.stroke;
  const LINE_W = 2;                                   // matches the design's stroke
  const line = (x, y, w, h) =>
    `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;background:${stroke}"></div>`;

  // Row lines. 5-row months use the design's exact lines; other row counts
  // divide the date area evenly so no row looks squat or stretched.
  const rowTops = [D.rows[0]];
  if (page.rows === 5) {
    rowTops.push(...D.rows.slice(1), fy1);
  } else {
    const rh = (fy1 - D.rows[0]) / page.rows;
    for (let r = 1; r <= page.rows; r++) rowTops.push(D.rows[0] + r * rh);
    rowTops[page.rows] = fy1;
  }

  // z-order, matching the design: column separators UNDER the highlight bands,
  // then bands, then row lines and the outer frame ON TOP of the bands.

  // 1. Column separators. In the first date row the design merges the leading
  //    empty cells — separators start at the first date cell's LEFT wall.
  const firstDateCol = page.grid[0].findIndex(d => !!d);
  for (let c = 1; c < 7; c++) {
    const x = D.cols[c - 1] - LINE_W / 2;
    const startY = c >= Math.max(firstDateCol, 1) ? rowTops[0] : rowTops[1];
    parts.push(line(x, fy0, LINE_W, rowTops[0] - fy0));       // header band tick
    parts.push(line(x, startY, LINE_W, fy1 - startY));        // date rows
  }

  // 2. Highlight bands: one contiguous rect per row, boundary to boundary,
  //    painted with the design's own fill colour AND opacity — translucent on
  //    most pages (separators show through), opaque on others, exactly like
  //    the original. Corners round off when the band meets the frame corners.
  const hl = new Set(page.highlightDays);
  const bandBg = D.band ? hexToRgba(D.band.c, D.band.a) : theme.tint;
  page.grid.forEach((weekRow, r) => {
    let c0 = null, c1 = null;
    weekRow.forEach((day, c) => {
      if (day && hl.has(day)) { if (c0 === null) c0 = c; c1 = c; }
    });
    if (c0 === null) return;
    const top = rowTops[r], bot = rowTops[r + 1];
    const lastRow = r === page.rows - 1;
    const radii = [
      r === 0 && c0 === 0 ? '13px' : '0',      // top-left
      r === 0 && c1 === 6 ? '13px' : '0',      // top-right
      lastRow && c1 === 6 ? '13px' : '0',      // bottom-right
      lastRow && c0 === 0 ? '13px' : '0',      // bottom-left
    ].join(' ');
    parts.push(`<div style="position:absolute;left:${bounds[c0]}px;top:${top}px;` +
      `width:${bounds[c1 + 1] - bounds[c0]}px;height:${bot - top}px;background:${bandBg};` +
      `border-radius:${radii}"></div>`);
  });

  // 3. Row lines over the bands (the design keeps row rules visible).
  for (let r = 0; r < page.rows; r++) {
    parts.push(line(fx0, rowTops[r] - LINE_W / 2, fx1 - fx0, LINE_W));
  }

  // 4. Outer frame over everything. The TOP edge (and its rounded corners) is
  //    baked artwork — drawing it again would cut across the washi tape — so
  //    only the sides and rounded bottom are drawn here.
  parts.push(`<div style="position:absolute;left:${fx0 - LINE_W / 2}px;top:${fy0 + 14}px;` +
    `width:${fx1 - fx0 + LINE_W}px;height:${fy1 - fy0 - 14 + LINE_W / 2}px;` +
    `border:${LINE_W}px solid ${stroke};border-top:none;border-radius:0 0 14px 14px"></div>`);

  // Weekday header, centered per column
  WEEKDAYS[lang].forEach((wd, c) => {
    const cx = (bounds[c] + bounds[c + 1]) / 2;
    parts.push(`<div style="position:absolute;left:${cx}px;top:${D.weekdayY}px;transform:translateX(-50%);` +
      `font-family:${F.cal};font-weight:400;font-size:17px;color:${NEUTRAL}">${wd}</div>`);
  });

  // Date numbers (design: Open Sauce One Bold, zero-padded; non-highlighted
  // dates render dimmed, exactly like the design's lighter numerals)
  page.grid.forEach((weekRow, r) => {
    weekRow.forEach((day, c) => {
      if (!day) return;
      const isHl = hl.has(day);
      const col = isHl ? theme.date : 'rgba(103,105,142,.62)';   // design dims plain dates
      parts.push(`<div style="position:absolute;left:${bounds[c] + D.num.dx}px;top:${rowTops[r] + D.num.dy}px;` +
        `font-family:${F.cal};font-weight:700;font-size:${D.num.sz}px;line-height:1.15;color:${col}">${String(day).padStart(2, '0')}</div>`);
      if (day === page.markerStart || day === page.markerEnd) {
        const fl = FLOWERS.has(t) ? `flower-${pad(t)}` : 'flower';
        parts.push(`<img src="/assets/deco/${fl}.png?v=${ver}" style="position:absolute;` +
          `left:${bounds[c + 1] - 44}px;top:${rowTops[r] + 6}px;width:32px;height:32px;object-fit:contain">`);
      }
    });
  });

  // The design tucks a little leaf sprig into the trailing empty cell of the
  // last row (when the sprite exists for this week and the cell is empty).
  if (CELL_SPRIGS.has(t)) {
    const lastRow = page.grid[page.rows - 1];
    const lastDateIdx = lastRow.reduce((a, d, i) => (d ? i : a), -1);
    if (lastDateIdx >= 0 && lastDateIdx < 6) {
      const c = lastDateIdx + 1;
      const wk2 = pad(t);
      parts.push(`<img src="/assets/deco/cellsprig-${wk2}.png?v=${ver}" style="position:absolute;` +
        `left:${(bounds[c] + bounds[c + 1]) / 2 - 26}px;top:${(rowTops[page.rows - 1] + rowTops[page.rows]) / 2 - 22}px;` +
        `width:52px;height:46px;object-fit:contain">`);
    }
  }
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
function renderPage(pageDesc, week, theme, lang, ver, forPrint) {
  const ui = UI[lang];
  const t = template(week.week);          // the month-template this week reuses
  const D = DESIGN[t];
  const parts = [];

  // Fruit zone — identical on every page: a soft themed wash, then the week's own
  // fruit centered in one fixed box (object-fit:contain preserves each aspect).
  // The template background here is cleaned to plain cream, so nothing floats.
  const fb = FRUIT_BOX;
  const wax = theme.tint || hexToRgba(theme.fruit, 0.2);
  parts.push(`<div style="position:absolute;left:${fb.x - 8}px;top:${fb.y + 34}px;` +
    `width:${fb.w + 16}px;height:${fb.h - 26}px;border-radius:50%;filter:blur(15px);` +
    `background:radial-gradient(ellipse at 50% 52%, ${wax} 0%, ${wax} 48%, transparent 78%)"></div>`);
  parts.push(`<img src="/assets/fruit/week-${pad(week.week)}.png?v=${ver}" style="position:absolute;` +
    `left:${fb.x}px;top:${fb.y}px;width:${fb.w}px;height:${fb.h}px;object-fit:contain">`);

  // ---- left column ----
  const monthName = MONTHS[lang][pageDesc.month];
  // Long month names shrink like the design does (September/October pages)
  const mSz = monthName.length <= 7 ? D.month.sz : monthName.length === 8 ? Math.min(D.month.sz, 64) : 61;
  const mP = yFix({ cx: D.month.cx, y: D.month.y + (D.month.sz - mSz) * 0.55, sz: mSz }, SCRIPT_EM);
  parts.push(`<div class="m-month" style="position:absolute;left:${mP.cx}px;top:${mP.y}px;` +
    `transform:translateX(-50%);font-family:${F.script};font-size:${mP.sz}px;line-height:normal;` +
    `color:${theme.month};white-space:nowrap">${esc(monthName)}</div>`);
  // Year: centered under the month like the design (its own per-page colour);
  // a small in-page script slides it sideways if the month's script tails
  // would strike through it.
  const yrP = yFix({ cx: 172, y: D.year.y, sz: D.year.sz }, NOW_EM);
  parts.push(`<div class="m-year" data-cx="172" style="position:absolute;left:${yrP.cx}px;top:${yrP.y}px;` +
    `transform:translateX(-50%);font-family:${F.now};font-size:${yrP.sz}px;line-height:normal;` +
    `color:${D.year.c || NEUTRAL};letter-spacing:.5px;white-space:nowrap">${pageDesc.year}</div>`);
  // Week badge: the NUMBER stays in the design's Brittany script but is made
  // noticeably LARGER and a strong dark contrasting colour so it reads at a
  // glance. (Synthetic bold / text-stroke are avoided: Chromium exports those as
  // Type3 glyphs, which print/zoom blurry — size + colour keep it crisp vector.)
  const bP = yFix(D.badge, SCRIPT_EM);
  const numCol = darken(theme.badge, 0.42);
  const num = `<span style="font-family:${F.script};` +
    `font-size:${Math.round(D.badge.sz * 1.34)}px;` +
    `color:${numCol};margin:0 4px">${week.week}</span>`;
  const scr = (txt) => `<span style="font-family:${F.script};color:${theme.badge}">${esc(txt)}</span>`;
  const badgeHtml = lang === 'de'
    ? `${num}${scr('. Schwangerschaftswoche')}`
    : `${scr('Week')}${num}${scr('of Pregnancy')}`;
  parts.push(`<div style="position:absolute;left:${D.badge.cx}px;top:${bP.y}px;transform:translateX(-50%);` +
    `font-size:${D.badge.sz}px;line-height:normal;white-space:nowrap">${badgeHtml}</div>`);
  parts.push(atCenter(D.sizeOf, F.serif, D.sizeOf.c || NEUTRAL, esc(ui.sizeOf)));
  parts.push(atCenter(yFix(D.fruit, SCRIPT_EM), F.script, theme.fruit, esc(week.fruit[lang])));
  // localized measurement values (German: 1.5 cm -> 1,5 cm; 3,500 g -> 3.500 g)
  const locVal = (v) => lang === 'de' ? v.replace(/[.,]/g, (m) => m === ',' ? '.' : ',') : v;
  parts.push(atCenter(D.babySizeLbl, F.serif, D.babySizeLbl.c || NEUTRAL, esc(ui.babySize)));
  parts.push(atCenter(D.babyWeightLbl, F.serif, D.babyWeightLbl.c || NEUTRAL, esc(ui.babyWeight)));
  if (D.babySizeVal) parts.push(atCenter(D.babySizeVal, F.nunito, D.babySizeVal.c || NEUTRAL, esc(locVal(week.length))));
  if (D.babyWeightVal) parts.push(atCenter(D.babyWeightVal, F.nunito, D.babyWeightVal.c || NEUTRAL, esc(locVal(week.weight))));

  // ---- right column (per-week card positions + colours from the design) ----
  parts.push(atLeft(yFix(D.tiny, SCRIPT_EM), F.script, D.tiny.c || theme.header, esc(ui.tiny)));
  parts.push(atLeft(D.devHdr, F.serif, D.devHdr.c || NEUTRAL, esc(ui.dev)));
  if (D.devBody) {
    parts.push(atBlock(D.devBody.x, D.devBody.y, D.devBody.w || 182, 12, (D.devBody.lh || 16.5) / 12,
      F.serif, NEUTRAL, esc(week.babyDev[lang])));
  }
  parts.push(atLeft(yFix(D.mamaHdr, SCRIPT_EM), F.script, D.mamaHdr.c || theme.header, esc(ui.mama)));
  parts.push(atLeft(yFix(D.notes, SCRIPT_EM), F.script, D.notes.c || theme.header, esc(ui.notes)));

  // Tip block between the Mama card and the Notes clipboard (design has one on
  // some pages — Preparation Tip / Reminder / a little question)
  if (week.tip && D.tipPos) {
    parts.push(atBlock(D.tipPos.x, D.tipPos.y, D.tipPos.w || 182, 12.4, 1.36,
      F.serif, theme.tip || NEUTRAL, esc(week.tip[lang])));
  }

  // Mama bullets: 12px serif, 16.5px line step, ~11.75px gap between items.
  // Bullet markers are the design's own heart sprites where available.
  if (D.bullets) {
    let by = D.bullets.y;
    const bw = 168, lineStep = 16.5, gap = 11.75;
    const wk2 = pad(t);
    week.mama[lang].forEach((b) => {
      if (HEART_SPRITES.has(t)) {
        parts.push(`<img src="/assets/deco/bullet-heart-${wk2}.png?v=${ver}" style="position:absolute;` +
          `left:${D.bullets.x - 28}px;top:${by - 1}px;width:18px;height:18px;object-fit:contain">`);
      } else {
        parts.push(`<div style="position:absolute;left:${D.bullets.x - 26}px;top:${by + 1}px;color:${hexToRgba(theme.header, 0.55)};font-size:11px">&#10084;</div>`);
      }
      parts.push(atBlock(D.bullets.x, by, bw, 12, lineStep / 12, F.serif, NEUTRAL, esc(b)));
      const lines = Math.max(1, Math.ceil(b.length / 27));
      by += lines * lineStep + gap;
    });
  }

  // ---- callout: label + text flow in one row, vertically centered in the
  // bar, so long labels or languages can never collide with the text ----
  const CL = D.calloutLabel, CT = D.calloutText;
  const rawLabel = week.callout.label[lang];
  const label = /[?:!]$/.test(rawLabel) ? rawLabel : rawLabel + ':';
  // grey body copy renders dimmed in the design (overlay layer); accents don't
  const ctColor = (CT.c || '#67698e') === '#67698e' ? 'rgba(103,105,142,.66)' : CT.c;
  // riddle answers sit on their own line (wk12 in its own accent colour)
  let ctHtml = esc(week.callout.text[lang]);
  const m2 = week.callout.text[lang].match(/^(.*?)\s*((?:Answer|Antwort):.*)$/);
  if (m2) {
    ctHtml = `${esc(m2[1])}<br><span style="color:${D.answerC || ctColor}">${esc(m2[2])}</span>`;
  }
  parts.push(
    `<div style="position:absolute;left:${CL.x}px;top:663px;width:${1036 - CL.x}px;height:71px;` +
    `display:flex;align-items:center;gap:26px">` +
    `<div style="flex:0 0 auto;font-family:${F.script};font-size:${CL.sz}px;line-height:normal;` +
    `color:${CL.c || theme.header};white-space:nowrap">${esc(label)}</div>` +
    `<div style="flex:0 1 auto;max-width:330px;font-family:${F.serif};font-size:${CT.sz}px;` +
    `line-height:1.12;color:${ctColor}">${ctHtml}</div></div>`);

  // ---- calendar ----
  parts.push(renderCalendar(pageDesc, D, theme, lang, ver, week, t));

  // Background: every week uses its month-template with a cleaned fruit zone
  // (`tmpl-<t>`); the fruit + soft wash are overlaid above, uniformly.
  // Print uses the 300dpi JPEG set; the web preview uses the lighter 2x PNGs.
  const bgSlug = `tmpl-${pad(t)}`;
  const bg = forPrint
    ? `/assets/print/${bgSlug}.jpg?v=${ver}`
    : `/assets/base/${bgSlug}.png?v=${ver}`;
  return `<section class="page" data-week="${week.week}" style="background-image:url('${bg}')">${parts.join('\n')}</section>`;
}

// ---------------------------------------------------------------------------
function renderCover(name, lang, pages, ver) {
  const t = lang === 'de'
    ? { for: 'Ein Schwangerschaftskalender für', sub: 'Schwangerschaftsreise', weeks: 'Woche 4–40' }
    : { for: 'A pregnancy calendar for', sub: 'Pregnancy Journey', weeks: 'Weeks 4–40' };
  const last = pages[pages.length - 1];   // the week-40 page (due-date month)
  const start = `${MONTHS[lang][pages[0].month]} ${pages[0].year}`;
  const end = `${MONTHS[lang][last.month]} ${last.year}`;
  const primary = '#b267a3', grey = NEUTRAL;
  // Shrink the name for long entries so it never runs off the page, and give
  // it breathing room scaled to its size — Brittany's swashes reach far above
  // and below the line box.
  const nameSize = Math.max(46, Math.min(104, Math.floor(1340 / Math.max(9, name.length * 0.58))));
  const nameGap = Math.round(nameSize * 0.34);
  const bg = `radial-gradient(60% 52% at 13% 10%, rgba(178,103,163,.20), transparent 60%),`
           + `radial-gradient(58% 48% at 87% 90%, rgba(255,153,85,.17), transparent 60%),`
           + `radial-gradient(40% 40% at 92% 12%, rgba(66,130,170,.10), transparent 60%), #fbf7f2`;
  return `<section class="page cover" style="background:${bg}">
    <img src="/assets/deco/flower.png?v=${ver}" style="position:absolute;left:120px;top:150px;width:64px;opacity:.9;transform:rotate(-12deg)">
    <img src="/assets/deco/flower.png?v=${ver}" style="position:absolute;right:150px;bottom:170px;width:52px;opacity:.85;transform:rotate(18deg)">
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 60px">
      <div style="font-family:var(--f-serif);font-size:20px;letter-spacing:.32em;text-transform:uppercase;color:${grey}">${esc(t.for)}</div>
      <div style="font-family:var(--f-script);font-size:${nameSize}px;line-height:1.35;color:${primary};margin:${nameGap}px 0 ${Math.round(nameGap * 0.4)}px;max-width:100%;white-space:nowrap">${esc(name)}</div>
      <div style="font-family:var(--f-serif);font-size:30px;letter-spacing:.06em;color:${grey}">${esc(t.sub)}</div>
      <div style="width:120px;height:2px;background:${primary};opacity:.55;margin:26px 0"></div>
      <div style="font-family:var(--f-now);font-size:19px;letter-spacing:.05em;color:${grey}">${esc(t.weeks)} · ${start} – ${end}</div>
    </div>
  </section>`;
}

// ---------------------------------------------------------------------------
function renderDocument({ dueDate, lang, weeks, pages, forPrint, assetVersion, name }) {
  const ver = assetVersion || '1';
  const cover = name && name.trim() ? renderCover(name.trim(), lang, pages, ver) : '';
  const body = cover + pages.map((p, i) => {
    const week = weeks[i];
    // Colours come from the reused month-template (the nearest milestone).
    const c = THEME[template(week.week)] || {};
    const theme = {
      grey: NEUTRAL,
      month: c.month || week.primary, badge: c.badge || week.primary,
      fruit: c.fruit || week.primary, header: c.header || week.primary,
      date: c.date || week.primary, tint: c.tint || hexToRgba(week.accent, 0.32),
      tip: c.tip || null
    };
    return renderPage(p, week, theme, lang, ver, forPrint);
  }).join('\n');

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<style>
  /* The design's own fonts, self-hosted (no CDN):
     Brittany Signature (script) · CMU Serif (body) · Open Sauce One (calendar)
     Poppins stands in for "Now" (year figures); Nunito for size/weight values. */
  @font-face{ font-family:'Script'; src:url('/fonts/brittany.ttf') format('truetype'); font-display:block; }
  @font-face{ font-family:'BodySerif'; src:url('/fonts/cmunrm.ttf') format('truetype'); font-weight:400; font-display:block; }
  @font-face{ font-family:'CalSans'; src:url('/fonts/opensauce-regular.ttf') format('truetype'); font-weight:400; font-display:block; }
  @font-face{ font-family:'CalSans'; src:url('/fonts/opensauce-bold.ttf') format('truetype'); font-weight:700; font-display:block; }
  @font-face{ font-family:'Geo'; src:url('/fonts/poppins-500.woff2') format('woff2'); font-weight:500; font-display:block; }
  @font-face{ font-family:'Sans'; src:url('/fonts/nunito-600.woff2') format('woff2'); font-weight:600; font-display:block; }
  :root{ --f-script:'Script',cursive; --f-serif:'BodySerif',serif; --f-cal:'CalSans',sans-serif;
         --f-now:'Geo',sans-serif; --f-nunito:'Sans',sans-serif; }
  *{ box-sizing:border-box; margin:0; padding:0; }
  html,body{ background:#e9e4dc; }
  .page{ position:relative; width:${PAGE_W}px; height:${PAGE_H}px; background-size:cover; background-repeat:no-repeat; overflow:hidden; }
  ${forPrint ? `
    /* The design's physical trim size (matches the Canva print export:
       1440x810pt = 20x11.25in). page.pdf() scales content 4/3 so the
       1440px layout fills it exactly; converters rasterizing at 300dpi
       get the full 6000x3375. */
    @page{ size:20in 11.25in; margin:0; }
    html,body{ background:#fff; }
    .page{ break-after:page; }
    .page:last-child{ break-after:auto; }
  ` : `
    body{ display:flex; flex-direction:column; align-items:center; gap:22px; padding:20px; }
    .page{ box-shadow:0 10px 34px rgba(0,0,0,.16); border-radius:6px; }
  `}
</style></head><body>${body}
<script>
  // The design hand-places the year per page; with dynamic month names a script
  // descender (April's "p", July's "y") can strike through it. Scan the month's
  // actual ink at the year's height and slide the year to the nearest clear spot.
  function fixYears(){
    document.querySelectorAll('.page').forEach(function(pg){
      var m = pg.querySelector('.m-month'), y = pg.querySelector('.m-year');
      if (!m || !y) return;
      var fs = parseFloat(m.style.fontSize), text = m.textContent;
      var cv = document.createElement('canvas'), PAD = Math.ceil(fs);
      var ctx = cv.getContext('2d');
      ctx.font = fs + 'px Script';
      var tw = Math.ceil(ctx.measureText(text).width);
      var mt = ctx.measureText(text);
      var asc = mt.fontBoundingBoxAscent || fs, desc = mt.fontBoundingBoxDescent || fs * 0.5;
      cv.width = tw + 2 * PAD; cv.height = Math.ceil(asc + desc + fs * 0.8);
      ctx = cv.getContext('2d'); ctx.font = fs + 'px Script'; ctx.fillStyle = '#000';
      ctx.fillText(text, PAD, asc);
      var mTop = parseFloat(m.style.top), mCx = parseFloat(m.style.left);
      var mLeft = mCx - tw / 2;
      var yTop = parseFloat(y.style.top), yH = y.offsetHeight, yW = y.offsetWidth;
      // test only the middle rows of the year's band: a tail PASSING NEAR the
      // year (like the design's own) is fine, striking THROUGH it is not
      var r0 = Math.max(0, Math.floor(yTop - mTop + yH * 0.22)), r1 = Math.min(cv.height, Math.ceil(yTop - mTop + yH * 0.8));
      if (r1 <= r0) return;
      var img = ctx.getImageData(0, r0, cv.width, r1 - r0).data;
      var ink = new Array(cv.width);
      for (var i = 0; i < img.length; i += 4) if (img[i + 3] > 40) ink[(i / 4) % cv.width] = true;
      function clearAt(cx){
        var a = Math.floor(cx - yW / 2 - 2 - (mLeft - PAD)), b = Math.ceil(cx + yW / 2 + 2 - (mLeft - PAD));
        for (var x = Math.max(0, a); x <= Math.min(cv.width - 1, b); x++) if (ink[x]) return false;
        return true;
      }
      var base = parseFloat(y.dataset.cx);
      var cands = [base, base + 14, base - 14, base + 28, base - 28, base + 44, base - 44, base + 60];
      for (var k = 0; k < cands.length; k++){
        if (clearAt(cands[k])){ y.style.left = cands[k] + 'px'; return; }
      }
      y.style.top = (yTop + 14) + 'px';   // no clear column: drop below the tails
    });
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fixYears); else fixYears();
</script>${forPrint ? '' : `
<script>
  function fit(){ document.body.style.zoom = Math.min(1,(window.innerWidth-40)/${PAGE_W}); }
  window.addEventListener('resize', fit); fit();
</script>`}</body></html>`;
}

module.exports = { renderDocument, renderPage, PAGE_W, PAGE_H };
