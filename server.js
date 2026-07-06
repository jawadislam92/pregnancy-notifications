const express = require('express');
const path = require('path');
const { buildPages } = require('./src/dateEngine');
const { renderDocument, PAGE_W, PAGE_H } = require('./src/renderPage');
const weeks = require('./src/weeks');

const app = express();
const PORT = process.env.PORT || 4010;

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
  res.type('html').send(renderDocument({ dueDate: due, lang, weeks, pages, forPrint }));
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
