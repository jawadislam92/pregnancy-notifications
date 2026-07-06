const express = require('express');
const path = require('path');
const fs = require('fs');

// Load .env from the app's own folder (robust regardless of the working dir
// pm2/systemd launches us from). Existing environment always wins.
(() => {
  try {
    for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* no .env — fine */ }
})();

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
app.use(express.urlencoded({ extended: false }));

// ---- Auth: a branded login page backed by a signed session cookie ----------
const crypto = require('crypto');
const AUTH_USER = process.env.STUDIO_USER || 'admin';
const AUTH_PASS = process.env.STUDIO_PASSWORD || ''; // gate is off unless this is set
const SESSION_SECRET = crypto.createHash('sha256').update((AUTH_PASS || 'dev') + '::pcs').digest();
const INTERNAL_TOKEN = crypto.randomBytes(16).toString('hex'); // lets the PDF renderer reach /preview

function makeToken(user) {
  const body = user + '|' + (Date.now() + 7 * 864e5);
  return Buffer.from(body).toString('base64url') + '.' +
    crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
}
function verifyToken(tok) {
  if (!tok || tok.indexOf('.') < 0) return null;
  const [b64, sig] = tok.split('.');
  let body; try { body = Buffer.from(b64, 'base64url').toString(); } catch { return null; }
  const good = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  const [user, exp] = body.split('|');
  return Date.now() < Number(exp) ? user : null;
}
function cookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
  return out;
}
const loginPage = (err) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in · Pregnancy Calendar Studio</title>
<style>
 @font-face{font-family:'Script';src:url('/fonts/greatvibes.woff2') format('woff2');font-display:swap}
 *{box-sizing:border-box} body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
  font-family:'Segoe UI',system-ui,sans-serif;color:#4a4458;
  background:radial-gradient(60% 55% at 15% 12%,rgba(178,103,163,.18),transparent 60%),radial-gradient(55% 50% at 85% 88%,rgba(255,153,85,.15),transparent 60%),#fbf7f2}
 .card{background:#fff;border:1px solid #ece3ea;border-radius:18px;box-shadow:0 18px 50px rgba(74,68,88,.12);padding:34px 32px;width:340px;text-align:center}
 .emoji{font-size:30px} .brand{font-family:'Script',cursive;font-size:42px;color:#b267a3;line-height:1;margin:4px 0 0}
 .sub{font-size:12.5px;color:#8a8397;margin-bottom:20px}
 label{display:block;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#8a8397;margin:12px 0 5px}
 input{width:100%;padding:11px 12px;border:1px solid #e7ddd2;border-radius:10px;font-size:15px;background:#fdfbf9}
 input:focus{outline:2px solid #d8a9cd;border-color:#d8a9cd}
 button{margin-top:22px;width:100%;padding:12px;border:0;border-radius:10px;background:#b267a3;color:#fff;font-size:15px;font-weight:600;cursor:pointer}
 button:hover{background:#9d5590} .err{color:#b34b4b;font-size:13px;margin-top:14px;min-height:16px}
</style></head><body>
 <form class="card" method="post" action="/login">
   <div class="emoji">🤰</div><div class="brand">Pregnancy Calendar</div><div class="sub">Studio — please sign in</div>
   <label>Username</label><input name="user" autocomplete="username" autofocus>
   <label>Password</label><input name="pass" type="password" autocomplete="current-password">
   <button type="submit">Sign in</button>
   <div class="err">${err || ''}</div>
 </form></body></html>`;

if (AUTH_PASS) {
  app.get('/login', (req, res) => verifyToken(cookies(req).sid) ? res.redirect('/') : res.type('html').send(loginPage('')));
  app.post('/login', (req, res) => {
    const { user, pass } = req.body || {};
    if (user === AUTH_USER && pass === AUTH_PASS) {
      res.setHeader('Set-Cookie', `sid=${makeToken(user)}; HttpOnly; Path=/; Max-Age=${7 * 86400}; SameSite=Lax`);
      return res.redirect('/');
    }
    res.status(401).type('html').send(loginPage('Wrong username or password.'));
  });
  app.get('/logout', (req, res) => {
    res.setHeader('Set-Cookie', 'sid=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
    res.redirect('/login');
  });
  app.use((req, res, next) => {
    // Static art + fonts are non-sensitive and are fetched as subresources by
    // the PDF renderer (which can't attach the cookie/token to them).
    if (req.path.startsWith('/fonts') || req.path.startsWith('/assets')) return next();
    if (req.query._it && req.query._it === INTERNAL_TOKEN) return next();
    if (verifyToken(cookies(req).sid)) return next();
    const apiish = req.path.startsWith('/api') || ['/pdf', '/data', '/plan'].includes(req.path);
    if (req.method === 'GET' && !apiish) return res.redirect('/login');
    res.status(401).json({ error: 'Authentication required' });
  });
}

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
  const q = `due=${due}&lang=${lang}&print=1${name ? `&name=${encodeURIComponent(name)}` : ''}` +
            (AUTH_PASS ? `&_it=${INTERNAL_TOKEN}` : '');
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

app.listen(PORT, '0.0.0.0', () =>
  console.log(`Pregnancy Calendar Studio → http://localhost:${PORT}${AUTH_PASS ? ' (password protected)' : ''}`));
