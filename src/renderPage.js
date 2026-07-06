// Renders the 10-page calendar to a single self-contained HTML document.
// Background = the Canva "plate" (all artwork, no text); everything dynamic is
// overlaid in the original 1440x810 coordinate space.

const { MONTHS, WEEKDAYS, UI, ROLES, MAMA, CAL, NEUTRAL } = require('./layout');

const PAGE_W = 1440, PAGE_H = 810;

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function hexToRgba(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function colorFor(role, theme) { return role.color === 'primary' ? theme.primary : theme.grey; }

// One absolutely-positioned text element from a ROLES entry.
function roleDiv(role, content, theme) {
  const s = [`position:absolute`, `left:${role.x}px`, `top:${role.y}px`,
    `font-family:${role.font}`, `font-size:${role.size}px`, `color:${colorFor(role, theme)}`,
    `line-height:${role.lh || 1.15}`];
  if (role.w) s.push(`width:${role.w}px`);
  if (role.align) s.push(`text-align:${role.align}`);
  if (role.ls) s.push(`letter-spacing:${role.ls}`);
  return `<div style="${s.join(';')}">${content}</div>`;
}

function renderCalendar(page, theme, ver) {
  const parts = [];
  // Grid lines (subtle, matching the original)
  // Compress rows to fit the fixed band so a 6-row month never overlaps the callout.
  const rowH = Math.min(CAL.rowH, (CAL.gridBottom - CAL.rowTop) / page.rows);
  const gridBottom = CAL.rowTop + page.rows * rowH;
  const right = CAL.left + 7 * CAL.colW;
  const LINE = 'rgba(120,100,80,.16)';
  parts.push(`<div style="position:absolute;left:${CAL.left}px;top:${CAL.top}px;width:${right - CAL.left}px;height:${gridBottom - CAL.top}px;border:1.5px solid ${LINE};border-radius:16px"></div>`);
  for (let c = 1; c < 7; c++) {
    const x = CAL.left + c * CAL.colW;
    parts.push(`<div style="position:absolute;left:${x}px;top:${CAL.top}px;width:1px;height:${gridBottom - CAL.top}px;background:${LINE}"></div>`);
  }
  for (let r = 0; r <= page.rows; r++) {
    const y = r === 0 ? CAL.rowTop : CAL.rowTop + r * rowH;
    if (y > gridBottom + 0.5) break;
    parts.push(`<div style="position:absolute;left:${CAL.left}px;top:${y}px;width:${right - CAL.left}px;height:1px;background:${LINE}"></div>`);
  }
  // Weekday header
  WEEKDAYS._lang.forEach((wd, c) => {
    const x = CAL.left + c * CAL.colW;
    parts.push(`<div style="position:absolute;left:${x}px;top:${CAL.top + CAL.hdrDy}px;width:${CAL.colW}px;text-align:center;font-family:var(--f-sans);font-weight:600;font-size:${CAL.hdrSize}px;color:${NEUTRAL};letter-spacing:1px">${wd}</div>`);
  });
  const hl = new Set(page.highlightDays);
  page.grid.forEach((weekRow, r) => {
    weekRow.forEach((day, c) => {
      if (!day) return;
      const cx = CAL.left + c * CAL.colW;
      const cy = CAL.rowTop + r * rowH;
      const isHl = hl.has(day);
      if (isHl) {
        // highlight cell tint
        parts.push(`<div style="position:absolute;left:${cx + 1}px;top:${cy}px;width:${CAL.colW - 2}px;height:${rowH - 4}px;background:${hexToRgba(theme.accent, 0.32)}"></div>`);
      }
      const col = isHl ? theme.primary : NEUTRAL;
      const wt = isHl ? 700 : 700;
      parts.push(`<div style="position:absolute;left:${cx + CAL.numDx}px;top:${cy + CAL.numDy}px;font-family:var(--f-sans);font-weight:${wt};font-size:${CAL.numSize}px;color:${col}">${String(day).padStart(2, '0')}</div>`);
      // flower markers on first & last highlighted day
      if (day === page.markerStart || day === page.markerEnd) {
        parts.push(`<img src="/assets/deco/flower.png?v=${ver}" style="position:absolute;left:${cx + CAL.colW - 40}px;top:${cy + 2}px;width:30px;height:30px;object-fit:contain">`);
      }
    });
  });
  return parts.join('\n');
}

function renderPage(pageDesc, week, theme, lang, ver) {
  const ui = UI[lang];
  WEEKDAYS._lang = WEEKDAYS[lang];
  const parts = [];
  // Left column
  parts.push(roleDiv(ROLES.month, esc(MONTHS[lang][pageDesc.month]), theme));
  parts.push(roleDiv(ROLES.year, pageDesc.year, theme));
  parts.push(roleDiv(ROLES.badge, esc(ui.weekOf(week.week)), theme));
  parts.push(roleDiv(ROLES.sizeOf, esc(ui.sizeOf), theme));
  parts.push(roleDiv(ROLES.fruitName, esc(week.fruit[lang]), theme));
  parts.push(roleDiv(ROLES.babySizeLbl, esc(ui.babySize), theme));
  parts.push(roleDiv(ROLES.babySizeVal, esc(week.length), theme));
  parts.push(roleDiv(ROLES.babyWeightLbl, esc(ui.babyWeight), theme));
  parts.push(roleDiv(ROLES.babyWeightVal, esc(week.weight), theme));
  // Right column
  parts.push(roleDiv(ROLES.tiny, esc(ui.tiny), theme));
  parts.push(roleDiv(ROLES.devHdr, esc(ui.dev), theme));
  parts.push(roleDiv(ROLES.devBody, esc(week.babyDev[lang]), theme));
  parts.push(roleDiv(ROLES.mamaHdr, esc(ui.mama), theme));
  parts.push(roleDiv(ROLES.notesHdr, esc(ui.notes), theme));
  // Mama bullets
  let by = MAMA.y;
  week.mama[lang].forEach((b) => {
    parts.push(`<div style="position:absolute;left:${MAMA.markerX}px;top:${by + 1}px;color:${theme.primary};font-size:11px">&#10084;</div>`);
    parts.push(`<div style="position:absolute;left:${MAMA.x}px;top:${by}px;width:${MAMA.w}px;font-family:${MAMA.font};font-size:${MAMA.size}px;line-height:${MAMA.lh};color:${NEUTRAL}">${esc(b)}</div>`);
    const lines = Math.max(1, Math.ceil(b.length / 26));
    by += lines * (MAMA.size * MAMA.lh) + MAMA.gap;
  });
  // Callout (label + text flow inline so long labels never overlap the text)
  parts.push(
    `<div style="position:absolute;left:522px;top:684px;width:482px;height:62px;display:flex;align-items:center;` +
    `font-family:var(--f-serif);font-size:17px;line-height:1.22;color:${NEUTRAL}">` +
    `<div><span style="font-family:var(--f-script);font-size:21px;color:${theme.primary}">` +
    `${esc(week.callout.label[lang])}:&nbsp;</span>${esc(week.callout.text[lang])}</div></div>`
  );
  // Calendar
  parts.push(renderCalendar(pageDesc, theme, ver));

  const bg = `/assets/base/week-${String(week.week).padStart(2, '0')}.png?v=${ver}`;
  return `<section class="page" data-week="${week.week}" style="background-image:url('${bg}')">${parts.join('\n')}</section>`;
}

function renderCover(name, lang, pages, ver) {
  const t = lang === 'de'
    ? { for: 'Ein Schwangerschaftskalender für', sub: 'Schwangerschaftsreise', weeks: 'Woche 4–40' }
    : { for: 'A pregnancy calendar for', sub: 'Pregnancy Journey', weeks: 'Weeks 4–40' };
  const start = `${MONTHS[lang][pages[0].month]} ${pages[0].year}`;
  const end = `${MONTHS[lang][pages[9].month]} ${pages[9].year}`;
  const primary = '#b267a3', grey = NEUTRAL;
  // Shrink the name for long entries so it never runs off the page.
  const nameSize = Math.max(46, Math.min(120, Math.floor(1340 / Math.max(9, name.length * 0.52))));
  const bg = `radial-gradient(60% 52% at 13% 10%, rgba(178,103,163,.20), transparent 60%),`
           + `radial-gradient(58% 48% at 87% 90%, rgba(255,153,85,.17), transparent 60%),`
           + `radial-gradient(40% 40% at 92% 12%, rgba(66,130,170,.10), transparent 60%), #fbf7f2`;
  return `<section class="page cover" style="background:${bg}">
    <img src="/assets/deco/flower.png?v=${ver}" style="position:absolute;left:120px;top:150px;width:64px;opacity:.9;transform:rotate(-12deg)">
    <img src="/assets/deco/flower.png?v=${ver}" style="position:absolute;right:150px;bottom:170px;width:52px;opacity:.85;transform:rotate(18deg)">
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 60px">
      <div style="font-family:var(--f-serif);font-size:20px;letter-spacing:.32em;text-transform:uppercase;color:${grey}">${esc(t.for)}</div>
      <div style="font-family:var(--f-script);font-size:${nameSize}px;line-height:1.05;color:${primary};margin:6px 0 2px;max-width:100%;white-space:nowrap">${esc(name)}</div>
      <div style="font-family:var(--f-serif);font-size:30px;letter-spacing:.06em;color:${grey}">${esc(t.sub)}</div>
      <div style="width:120px;height:2px;background:${primary};opacity:.55;margin:26px 0"></div>
      <div style="font-family:var(--f-now);font-size:19px;letter-spacing:.05em;color:${grey}">${esc(t.weeks)} · ${start} – ${end}</div>
    </div>
  </section>`;
}

function renderDocument({ dueDate, lang, weeks, pages, forPrint, assetVersion, name }) {
  const ver = assetVersion || '1';
  const cover = name && name.trim() ? renderCover(name.trim(), lang, pages, ver) : '';
  const body = cover + pages.map((p, i) => {
    const week = weeks[i];
    const theme = { primary: week.primary, accent: week.accent, grey: NEUTRAL };
    return renderPage(p, week, theme, lang, ver);
  }).join('\n');

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<style>
  /* Self-hosted so fonts render identically every time (no CDN dependency). */
  @font-face{ font-family:'ScriptGV'; src:url('/fonts/greatvibes.woff2') format('woff2'); font-display:block; }
  @font-face{ font-family:'ScriptAL'; src:url('/fonts/allura.woff2') format('woff2'); font-display:block; }
  @font-face{ font-family:'ScriptDA'; src:url('/fonts/dancing-700.woff2') format('woff2'); font-display:block; }
  @font-face{ font-family:'Geo'; src:url('/fonts/poppins-500.woff2') format('woff2'); font-weight:500; font-display:block; }
  @font-face{ font-family:'BodySerif'; src:url('/fonts/spectral-400.woff2') format('woff2'); font-weight:400; font-style:normal; font-display:block; }
  @font-face{ font-family:'BodySerif'; src:url('/fonts/spectral-italic.woff2') format('woff2'); font-weight:400; font-style:italic; font-display:block; }
  @font-face{ font-family:'Sans'; src:url('/fonts/nunito-600.woff2') format('woff2'); font-weight:600; font-display:block; }
  @font-face{ font-family:'Sans'; src:url('/fonts/nunito-700.woff2') format('woff2'); font-weight:700; font-display:block; }
  :root{ --f-script:'ScriptGV',cursive; --f-now:'Geo',sans-serif; --f-serif:'BodySerif',serif; --f-sans:'Sans',sans-serif; }
  *{ box-sizing:border-box; margin:0; padding:0; }
  html,body{ background:#e9e4dc; }
  .page{ position:relative; width:${PAGE_W}px; height:${PAGE_H}px; background-size:cover; background-repeat:no-repeat; overflow:hidden; }
  ${forPrint ? `
    @page{ size:${PAGE_W}px ${PAGE_H}px; margin:0; }
    html,body{ background:#fff; }
    .page{ break-after:page; }
    .page:last-child{ break-after:auto; }
  ` : `
    body{ display:flex; flex-direction:column; align-items:center; gap:22px; padding:20px; }
    .page{ box-shadow:0 10px 34px rgba(0,0,0,.16); border-radius:6px; }
  `}
</style></head><body>${body}${forPrint ? '' : `
<script>
  function fit(){ document.body.style.zoom = Math.min(1,(window.innerWidth-40)/${PAGE_W}); }
  window.addEventListener('resize', fit); fit();
</script>`}</body></html>`;
}

module.exports = { renderDocument, renderPage, PAGE_W, PAGE_H };
