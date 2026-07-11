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

function makeToken(user, role) {
  const body = user + '|' + (role || 'staff') + '|' + (Date.now() + 7 * 864e5);
  return Buffer.from(body).toString('base64url') + '.' +
    crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
}
function verifyToken(tok) {
  if (!tok || tok.indexOf('.') < 0) return null;
  const [b64, sig] = tok.split('.');
  let body; try { body = Buffer.from(b64, 'base64url').toString(); } catch { return null; }
  const good = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  const [user, role, exp] = body.split('|');
  return Date.now() < Number(exp) ? { user, role } : null;
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
    // The env admin is the bootstrap account; extra team members live in the DB.
    const envOk = user === AUTH_USER && pass === AUTH_PASS && !!AUTH_PASS;
    const dbUser = envOk ? null : customers.verifyUser(user, pass);
    if (envOk || dbUser) {
      const uname = envOk ? AUTH_USER : dbUser.username;
      const role = envOk ? 'admin' : dbUser.role;
      res.setHeader('Set-Cookie', `sid=${makeToken(uname, role)}; HttpOnly; Path=/; Max-Age=${7 * 86400}; SameSite=Lax`);
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
    // Public surfaces: the intake form and a customer's own result/download page.
    if (req.path === '/form' || req.path.startsWith('/c/')) return next();
    if (req.query.ct && customers.getByToken(req.query.ct)) return next();
    if (req.query._it && req.query._it === INTERNAL_TOKEN) return next();
    if (verifyToken(cookies(req).sid)) return next();
    const apiish = req.path.startsWith('/api') || ['/pdf', '/data', '/plan'].includes(req.path);
    if (req.method === 'GET' && !apiish) return res.redirect('/login');
    res.status(401).json({ error: 'Authentication required' });
  });
}
// Current signed-in user (or null). Works whether or not the gate is enabled.
function currentUser(req) { return AUTH_PASS ? verifyToken(cookies(req).sid) : { user: 'local', role: 'admin' }; }
function requireAdmin(req, res, next) {
  const u = currentUser(req);
  if (u && u.role === 'admin') return next();
  res.status(403).json({ error: 'Admin access required' });
}

app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use(express.static(path.join(__dirname, 'public')));

function params(req) {
  // A customer token (?ct=) resolves to that customer's own details.
  if (req.query.ct) {
    const c = customers.getByToken(req.query.ct);
    if (c) return { due: c.due_date, lang: c.lang, name: c.name, ct: req.query.ct };
  }
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

// ---- Public intake form + customer result page -----------------------------
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const shell = (title, inner) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>
 @font-face{font-family:'Script';src:url('/fonts/greatvibes.woff2') format('woff2');font-display:swap}
 *{box-sizing:border-box} body{margin:0;min-height:100vh;font-family:'Segoe UI',system-ui,sans-serif;color:#4a4458;
  background:radial-gradient(60% 55% at 15% 12%,rgba(178,103,163,.16),transparent 60%),radial-gradient(55% 50% at 85% 88%,rgba(255,153,85,.14),transparent 60%),#fbf7f2;
  display:flex;align-items:flex-start;justify-content:center;padding:40px 24px}
 .card{background:#fff;border:1px solid #ece3ea;border-radius:18px;box-shadow:0 18px 50px rgba(74,68,88,.12);padding:30px 28px;width:440px;max-width:100%}
 .brand{font-family:'Script',cursive;font-size:34px;color:#b267a3;line-height:1;text-align:center}
 .sub{font-size:13px;color:#8a8397;margin:2px 0 18px;text-align:center}
 label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#8a8397;margin:12px 0 5px}
 input,select{width:100%;padding:11px 12px;border:1px solid #e7ddd2;border-radius:10px;font-size:15px;background:#fdfbf9}
 input:focus,select:focus{outline:2px solid #d8a9cd;border-color:#d8a9cd}
 .btn{margin-top:20px;display:block;width:100%;padding:12px;border:0;border-radius:10px;background:#b267a3;color:#fff;font-size:15px;font-weight:600;cursor:pointer;text-align:center;text-decoration:none}
 .btn:hover{background:#9d5590} .err{color:#b34b4b;font-size:13px;margin-top:12px;min-height:16px}
</style></head><body>${inner}</body></html>`;

function formPage(err, v = {}) {
  return shell('Create your Pregnancy Calendar', `<form class="card" method="post" action="/form" autocomplete="off">
   <div class="brand">Pregnancy Calendar</div><div class="sub">Enter your details to create your personalized calendar</div>
   <label>Your name</label><input name="name" value="${esc(v.name || '')}" required placeholder="e.g. Emma Schmidt">
   <label>Due date</label><input name="due_date" type="date" value="${esc(v.due_date || '')}" required>
   <label>Language</label><select name="lang"><option value="en"${v.lang !== 'de' ? ' selected' : ''}>English</option><option value="de"${v.lang === 'de' ? ' selected' : ''}>Deutsch</option></select>
   <label>Email (optional)</label><input name="email" type="email" value="${esc(v.email || '')}" placeholder="you@example.com">
   <button class="btn" type="submit">Create my calendar</button>
   <div class="err">${esc(err || '')}</div>
 </form>`);
}
function resultPage(c) {
  return shell(`${c.name} — Pregnancy Calendar`, `<div class="card" style="width:680px">
    <div class="brand">${esc(c.name)}</div><div class="sub">Your personalized pregnancy calendar is ready</div>
    <a class="btn" href="/pdf?ct=${c.token}">Download PDF (cover + 10 months)</a>
    <div style="margin-top:16px;border:1px solid #ece3ea;border-radius:12px;overflow:hidden;height:380px;background:#efe9e1">
      <iframe src="/preview?ct=${c.token}" style="width:100%;height:100%;border:0"></iframe>
    </div>
  </div>`);
}

app.get('/form', (req, res) => res.type('html').send(formPage('')));
app.post('/form', (req, res) => {
  try { const c = customers.create({ ...(req.body || {}), source: 'form' }); res.redirect('/c/' + c.token); }
  catch (e) { res.status(400).type('html').send(formPage(e.message, req.body || {})); }
});
app.get('/c/:token', (req, res) => {
  const c = customers.getByToken(req.params.token);
  if (!c) return res.status(404).type('html').send(shell('Not found', `<div class="card"><div class="brand">Pregnancy Calendar</div><div class="sub">Sorry, this link isn’t valid.</div></div>`));
  res.type('html').send(resultPage(c));
});

// ---- Team / user management (admin only) -----------------------------------
app.get('/api/users', requireAdmin, (req, res) => res.json(customers.listUsers()));
app.post('/api/users', requireAdmin, (req, res) => {
  try { res.status(201).json(customers.createUser(req.body || {})); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.delete('/api/users/:id', requireAdmin, (req, res) => { customers.removeUser(Number(req.params.id)); res.status(204).end(); });
app.get('/team', (req, res) => res.type('html').send(teamPage(currentUser(req))));
function teamPage(u) {
  const admin = !!(u && u.role === 'admin');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Team · Pregnancy Calendar Studio</title>
<style>
 :root{--pink:#b267a3;--line:#e7ddd2;--muted:#8a8397;--ink:#4a4458}
 *{box-sizing:border-box} body{margin:0;font-family:'Segoe UI',system-ui,sans-serif;color:var(--ink);background:#efe9e1}
 header{background:#fbf7f2;border-bottom:1px solid var(--line);padding:16px 26px;display:flex;align-items:center;justify-content:space-between}
 header h1{font-size:19px;margin:0} a{color:var(--pink)}
 .wrap{max-width:760px;margin:0 auto;padding:24px 26px}
 .card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:18px 20px;margin-bottom:20px;box-shadow:0 4px 16px rgba(0,0,0,.05)}
 h2{font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:0 0 14px}
 form.add{display:grid;grid-template-columns:1.3fr 1.3fr .9fr auto;gap:12px;align-items:end}
 .field{display:flex;flex-direction:column;gap:4px}.field label{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
 input,select{padding:8px 10px;border:1px solid var(--line);border-radius:8px;font-size:14px;background:#fff}
 .btn{border:0;border-radius:8px;padding:9px 16px;font-size:14px;font-weight:600;cursor:pointer;background:var(--pink);color:#fff}
 table{width:100%;border-collapse:collapse}th,td{padding:10px 12px;border-bottom:1px solid var(--line);font-size:13.5px;text-align:left}
 th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
 .link.danger{color:#b34b4b;background:none;border:0;cursor:pointer;font-weight:600}
 .pill{background:#f3e8f0;color:var(--pink);border-radius:20px;padding:2px 9px;font-size:11.5px;font-weight:600}
 .err{color:#b34b4b;font-size:13px;min-height:16px;margin-top:8px}.empty{color:var(--muted);text-align:center;padding:22px}
</style></head><body>
<header><h1>👥 Team</h1><div><a href="/">← Dashboard</a> &nbsp;·&nbsp; <a href="/logout">Log out</a></div></header>
<div class="wrap">
 ${admin ? `<div class="card"><h2>Add team member</h2>
   <form class="add" id="addForm" autocomplete="off">
     <div class="field"><label>Username</label><input name="username" required></div>
     <div class="field"><label>Password</label><input name="password" type="text" required placeholder="min 6 characters"></div>
     <div class="field"><label>Role</label><select name="role"><option value="staff">Staff</option><option value="admin">Admin</option></select></div>
     <button class="btn" type="submit">Add</button>
   </form><div class="err" id="err"></div></div>` : `<div class="card"><h2>Team</h2><p style="color:var(--muted);font-size:14px;margin:0">Only admins can add or remove team members.</p></div>`}
 <div class="card"><h2>Members</h2><div id="tableWrap"></div></div>
</div>
<script>
 const admin=${admin};
 const esc=s=>(s==null?'':String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 async function load(){
   const wrap=document.getElementById('tableWrap');
   const res=await fetch('/api/users'); if(!res.ok){ wrap.innerHTML='<div class="empty">You need admin access to view the team.</div>'; return; }
   const list=await res.json();
   let rows='<tr><td colspan="4" class="empty">No extra members yet. The main admin account always works.</td></tr>';
   if(list.length) rows=list.map(x=>'<tr><td>'+esc(x.username)+'</td><td><span class="pill">'+esc(x.role)+'</span></td><td style="color:#8a8397">'+new Date(x.created_at).toLocaleDateString()+'</td><td style="text-align:right">'+(admin?'<button class="link danger" data-del="'+x.id+'">Remove</button>':'')+'</td></tr>').join('');
   wrap.innerHTML='<table><thead><tr><th>Username</th><th>Role</th><th>Added</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>';
   wrap.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{ if(!confirm('Remove this member?'))return; await fetch('/api/users/'+b.dataset.del,{method:'DELETE'}); load(); });
 }
 const f=document.getElementById('addForm');
 if(f) f.onsubmit=async e=>{ e.preventDefault(); const b={username:f.username.value,password:f.password.value,role:f.role.value};
   const r=await fetch('/api/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
   if(!r.ok){ document.getElementById('err').textContent=(await r.json()).error||'Could not add'; return; }
   document.getElementById('err').textContent=''; f.reset(); load(); };
 load();
</script></body></html>`;
}

app.listen(PORT, '0.0.0.0', () =>
  console.log(`Pregnancy Calendar Studio → http://localhost:${PORT}${AUTH_PASS ? ' (password protected)' : ''}`));
