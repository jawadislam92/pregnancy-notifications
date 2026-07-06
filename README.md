# Pregnancy Calendar Studio

Turns **one due date** into a personalized **pregnancy wall calendar** (a cover page
+ 10 months) that matches the approved Canva design — rendered in the browser and
exported as a print-ready PDF. English 🇬🇧 / German 🇩🇪.

Manage customers in a simple table: add their details once, then **View calendar**,
**Download PDF**, or **View data** per customer.

Route 1 (full code, no Canva at runtime). Runs entirely on your PC; ready to deploy
to a small VPS (see below).

---

## Quick start

```bash
npm install
npx playwright install chromium   # first time only
npm start                         # -> http://localhost:4010
```

Open http://localhost:4010, pick a due date, choose a language, and hit **Update
preview**. **Download PDF** gives you the print-ready 10-page file.

> Node lives in Laragon at `C:\laragon\bin\nodejs\node-v22\node.exe`. The
> included `.claude/launch.json` points at it.

---

## How it works

A pregnancy is counted week 4 → week 40. The **due date is the end of week 40**,
so every milestone is derived from it:

```
week N is reached on:  dueDate − (40 − N) × 7 days
```

Each of the 10 milestone weeks (4, 8, 12 … 40) becomes one page, showing the
calendar **month** that milestone falls in, with the **exact 7 days of that
gestational week highlighted** and a flower marker on the first and last day.
(The original Canva sample highlighted the same dates on every page — a static
placeholder. This build computes the real days, and also fixes an off-by-one
weekday error in the hand-made sample.)

### Architecture

| Piece | File | Responsibility |
|---|---|---|
| Date engine | `src/dateEngine.js` | due date → 10 months, grids, highlight ranges. Pure, unit-tested. |
| Content | `src/weeks.js` | per-week bilingual copy, fruit, size/weight, colours. **Edit here.** |
| Layout / i18n | `src/layout.js` | exact text positions (from the design), month & weekday names. |
| Renderer | `src/renderPage.js` | composes the cover + 10 pages: art background + overlaid text + calendar. |
| Storage | `src/db.js` | customer records in SQLite (`node:sqlite`, no native build). |
| Server | `server.js` | `/preview`, `/pdf`, `/data`, `/plan`, `/api/customers` (CRUD). |
| UI | `public/index.html` | the Studio: add-customer form + customer table with per-row actions. |

### The Studio (customer flow)

The home page is a customer table. Add a customer (name, due date, language, email,
order ref, notes) and each row gives you:

- **👁 View** — the calendar in the browser (`/preview?due=…&lang=…&name=…`)
- **⬇ PDF** — the print-ready file (cover + 10 months)
- **📋 Data** — a spreadsheet-style table of the 10 weeks (`/data`)

Customers persist in `data/customers.db` (created automatically; not committed).
Passing `&name=` adds a personalized cover page (“A pregnancy calendar for …”).

### The artwork

We keep the original Canva art pixel-for-pixel. `scripts/extract_assets.py`
takes the Canva PDF + data workbook and produces, per page, a **text-free base
image** (`assets/base/week-XX.png`) — all watercolours, the fruit, washi tape,
icons, cards and badge pill, with the text and calendar removed. The app then
overlays the dynamic text and calendar in the original coordinate space, so the
output looks identical to the design in either language.

Re-run the pipeline only if the design changes:
```bash
python scripts/extract_assets.py
```

---

## Editing content

All copy is in `src/weeks.js` — one entry per milestone week, `en` + `de`. Change
a fruit name, a tip, the size/weight, or the theme colours there; no code changes
needed. Month and weekday names and the UI labels live in `src/layout.js`.

## Tests

```bash
npm test
```
Covers the date logic: 10 pages, 28-day spacing, leap February, year-crossing
pregnancies, month grids, and highlight ranges.

---

## Deploy to a VPS

A small Ubuntu box (~$6–12/mo) is enough. Rough steps:

```bash
# 1. Node 22 + build essentials
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
# 2. app + deps + the Chromium the PDF step needs (with system libs)
git clone <repo> && cd pregnancy-notifications && npm ci
npx playwright install --with-deps chromium
# 3. keep it running
sudo npm i -g pm2 && pm2 start server.js --name calendar && pm2 save
# 4. Nginx reverse proxy on your domain + free SSL (certbot) -> proxy_pass http://127.0.0.1:4010
```

Storage is just the `data/customers.db` file on the same box — no extra services.

## Roadmap (next)

- **Bulk import** — paste/upload a CSV of customers → generate all at once.
- **Shopify** — order webhook → auto-create customer → email the PDF.
- **Auth** — a simple login before deploying publicly.

## Demo notes

- Free substitute fonts stand in for the commercial *Brittany Signature* + *Now*
  (swap the CSS vars in `src/renderPage.js` when licensed files arrive).
- "Mama may notice" bullets were authored to match the design; edit in `src/weeks.js`.
- Highlighted-week span is one config value (`WEEK_SPAN_DAYS` in `src/dateEngine.js`).

**Notes / to confirm with the client:**
- Fonts use close free substitutes (Sacramento / Quicksand / PT Serif / Nunito)
  in place of the commercial *Brittany Signature* + *Now*. Swap the four CSS vars
  in `src/renderPage.js` once licensed files are provided.
- The "Mama may notice" bullet lists were authored to match the design (the
  original data source only had a single sentence). Review/adjust in `weeks.js`.
- The highlighted-week span (7 days, marker on first & last) is a single config
  value (`WEEK_SPAN_DAYS` in `src/dateEngine.js`) — easy to match exact intent.
