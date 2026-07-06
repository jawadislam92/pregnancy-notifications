# Pregnancy Calendar Generator

Turns **one due date** into a personalized **10-page pregnancy wall calendar** that
matches the approved Canva design — rendered in the browser and exported as a
print-ready PDF. English 🇬🇧 / German 🇩🇪.

This is the local demo build (Route 1: full code, no Canva at runtime). It runs
entirely on your PC.

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
| Renderer | `src/renderPage.js` | composes the 10 pages: art background + overlaid text + calendar. |
| Server | `server.js` | `/preview` (live HTML) and `/pdf` (Playwright → PDF). |
| UI | `public/index.html` | due-date form, language toggle, preview, download. |

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

## Demo scope & next steps

**In this build:** single due date → preview + print-ready PDF, EN/DE, pixel-faithful.

**Ready to add (clean seams already in place):**
- **Bulk** — feed a customer list (name + due date + language) and generate all
  calendars in one run; the engine + renderer are already list-friendly.
- **Shopify** — order webhook → generate PDF → email/deliver.
- **Hosting** — currently local; a small always-on box (≈ $6–12/mo, headless
  Chromium) is the natural home for production.

**Notes / to confirm with the client:**
- Fonts use close free substitutes (Sacramento / Quicksand / PT Serif / Nunito)
  in place of the commercial *Brittany Signature* + *Now*. Swap the four CSS vars
  in `src/renderPage.js` once licensed files are provided.
- The "Mama may notice" bullet lists were authored to match the design (the
  original data source only had a single sentence). Review/adjust in `weeks.js`.
- The highlighted-week span (7 days, marker on first & last) is a single config
  value (`WEEK_SPAN_DAYS` in `src/dateEngine.js`) — easy to match exact intent.
