const express = require('express');
const path = require('path');
const { buildPages } = require('./src/dateEngine');
const { renderDocument, PAGE_W, PAGE_H } = require('./src/renderPage');
const { MONTHS } = require('./src/layout');
const weeks = require('./src/weeks');
const customers = require('./src/db');

const app = express();
const PORT = process.env.PORT || 4010;
// Changes every server start, so browsers/preview panels never serve stale
// artwork from a previous build (image URLs carry ?v=ASSET_VERSION).
const ASSET_VERSION = String(Date.now());

app.use(express.json());
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use(express.static(path.join(__dirname, 'public')));

function params(req) {
  const due = /^\d{4}-\d{2}-\d{2}$/.test(req.query.due || '') ? req.query.due : '2026-10-15';
  const lang = req.query.lang === 'de' ? 'de' : 'en';
  const name = (req.query.name || '').toString().slice(0, 60);
  return { due, lang, name };
}
const slug = (s) => (s || 'calendar').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'calendar';

// ---- Calendar rendering -----------------------------------------------------

// Live HTML preview (add &print=1 for print CSS, &name=... for a cover page)
app.get('/preview', (req, res) => {
  const { due, lang, name } = params(req);
  const forPrint = req.query.print === '1';
  const pages = buildPages(due);
  res.setHeader('Cache-Control', 'no-store');
  res.type('html').send(renderDocument({ dueDate: due, lang, weeks, pages, forPrint, assetVersion: ASSET_VERSION, name }));
});

// Page map JSON (verification strip)
app.get('/plan', (req, res) => {
  const { due, lang } = params(req);
  const pages = buildPages(due);
  res.setHeader('Cache-Control', 'no-store');
  res.json(pages.map((p, i) => ({
    page: i + 1, week: weeks[i].week, month: MONTHS[lang][p.month], year: p.year,
    fruit: weeks[i].fruit[lang],
    highlight: p.markerStart === p.markerEnd ? `${p.markerStart}` : `${p.markerStart}–${p.markerEnd}`
  })));
});

// Data table (the 10 weeks as a spreadsheet-like view)
app.get('/data', (req, res) => {
  const { due, lang, name } = params(req);
  const pages = buildPages(due);
  const rows = pages.map((p, i) => {
    const w = weeks[i];
    const hl = p.markerStart === p.markerEnd ? `${p.markerStart}` : `${p.markerStart}–${p.markerEnd}`;
    return `<tr>
      <td class="c">${i + 1}</td><td class="c"><b>${w.week}</b></td>
      <td>${MONTHS[lang][p.month]} ${p.year}</td>
      <td>${w.fruit[lang]}</td><td class="c">${w.length}</td><td class="c">${w.weight}</td>
      <td class="c">${hl}</td><td>${w.babyDev[lang]}</td></tr>`;
  }).join('');
  const title = (name ? `${name} — ` : '') + (lang === 'de' ? 'Kalenderdaten' : 'Calendar data');
  const h = lang === 'de'
    ? ['Seite', 'SSW', 'Monat', 'Größe (Obst)', 'Länge', 'Gewicht', 'Markierte Tage', 'Entwicklung']
    : ['Page', 'Week', 'Month', 'Baby size', 'Length', 'Weight', 'Highlighted', 'Development'];
  res.setHeader('Cache-Control', 'no-store');
  res.type('html').send(`<!doctype html><meta charset="utf-8"><title>${title}</title>
  <style>
    body{font-family:'Segoe UI',system-ui,sans-serif;color:#4a4458;margin:0;background:#efe9e1;padding:22px}
    h1{font-size:18px;margin:0 0 14px}
    table{border-collapse:collapse;width:100%;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 6px 20px rgba(0,0,0,.08)}
    th,td{padding:9px 12px;border-bottom:1px solid #eee;font-size:13px;text-align:left;vertical-align:top}
    th{background:#b267a3;color:#fff;font-weight:600;position:sticky;top:0}
    td.c{text-align:center;white-space:nowrap}
    tr:last-child td{border-bottom:0}
  </style>
  <h1>${title}</h1>
  <table><thead><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`);
});

// Print-ready PDF (cover + 10 pages). Drives headless Chromium over the preview URL.
app.get('/pdf', async (req, res) => {
  const { due, lang, name } = params(req);
  const q = `due=${due}&lang=${lang}&print=1${name ? `&name=${encodeURIComponent(name)}` : ''}`;
  const url = `http://localhost:${PORT}/preview?${q}`;
  try {
    const { chromium } = require('playwright');
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    await browser.close();
    res.type('application/pdf')
       .setHeader('Content-Disposition', `attachment; filename="${slug(name)}-pregnancy-calendar-${lang}.pdf"`);
    res.send(pdf);
  } catch (e) {
    console.error(e);
    res.status(500).send('PDF generation failed: ' + e.message);
  }
});

// ---- Customer CRUD ----------------------------------------------------------

app.get('/api/customers', (req, res) => res.json(customers.list()));

app.post('/api/customers', (req, res) => {
  try {
    res.status(201).json(customers.create(req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/customers/:id', (req, res) => {
  customers.remove(Number(req.params.id));
  res.status(204).end();
});

app.listen(PORT, () => console.log(`Pregnancy Calendar Studio → http://localhost:${PORT}`));
