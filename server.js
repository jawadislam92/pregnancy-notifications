const express = require('express');
const path = require('path');
const { buildPages } = require('./src/dateEngine');
const { renderDocument, PAGE_W, PAGE_H } = require('./src/renderPage');
const { MONTHS } = require('./src/layout');
const weeks = require('./src/weeks');

const app = express();
const PORT = process.env.PORT || 4010;
// Changes every server start, so browsers/preview panels never serve stale
// artwork from a previous build (image URLs carry ?v=ASSET_VERSION).
const ASSET_VERSION = String(Date.now());

app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use(express.static(path.join(__dirname, 'public')));

function params(req) {
  const due = /^\d{4}-\d{2}-\d{2}$/.test(req.query.due || '') ? req.query.due : '2026-10-15';
  const lang = req.query.lang === 'de' ? 'de' : 'en';
  return { due, lang };
}

// Live HTML preview of all 10 pages (add &print=1 for print CSS)
app.get('/preview', (req, res) => {
  const { due, lang } = params(req);
  const forPrint = req.query.print === '1';
  const pages = buildPages(due);
  res.setHeader('Cache-Control', 'no-store');
  res.type('html').send(renderDocument({ dueDate: due, lang, weeks, pages, forPrint, assetVersion: ASSET_VERSION }));
});

// Page map: which week / month / fruit each of the 10 pages shows (for verification)
app.get('/plan', (req, res) => {
  const { due, lang } = params(req);
  const pages = buildPages(due);
  res.setHeader('Cache-Control', 'no-store');
  res.json(pages.map((p, i) => ({
    page: i + 1,
    week: weeks[i].week,
    month: MONTHS[lang][p.month],
    year: p.year,
    fruit: weeks[i].fruit[lang],
    highlight: p.markerStart === p.markerEnd ? `${p.markerStart}` : `${p.markerStart}–${p.markerEnd}`
  })));
});

// Print-ready 10-page PDF (drives a headless Chromium over the live preview URL)
app.get('/pdf', async (req, res) => {
  const { due, lang } = params(req);
  const url = `http://localhost:${PORT}/preview?due=${due}&lang=${lang}&print=1`;
  try {
    const { chromium } = require('playwright');
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    await browser.close();
    res.type('application/pdf')
       .setHeader('Content-Disposition', `attachment; filename="pregnancy-calendar-${due}-${lang}.pdf"`);
    res.send(pdf);
  } catch (e) {
    console.error(e);
    res.status(500).send('PDF generation failed: ' + e.message);
  }
});

app.listen(PORT, () => console.log(`Pregnancy Calendar Generator → http://localhost:${PORT}`));
