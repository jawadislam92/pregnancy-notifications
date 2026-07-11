// Layout map + localisation. Coordinates are in the original design space
// (1440 x 810), harvested from the Canva PDF, so overlaid text lands exactly
// where it sat in the approved design. renderPage.js consumes this.

const NEUTRAL = '#67698e'; // shared body/label grey (constant across pages)

// Exact per-element colours harvested from the approved Canva PDF, keyed by
// gestational week. The original designer hand-coloured each page, so the month
// title, week badge, fruit name, section headers and highlighted dates each use
// their own hue — this map reproduces that instead of a single colour per page.
//   month  – big script month title            badge – "Week N of Pregnancy"
//   fruit  – fruit-name script                 header – Tiny/Mama/Notes + callout label
//   date   – highlighted date numbers          tint  – highlighted-week band fill
const THEME = {
  4:  { month: '#b267a3', badge: '#b267a3', fruit: '#67698e', header: '#a4709a', date: '#4282aa', tint: '#ffe3e9', tip: null },
  8:  { month: '#b267a3', badge: '#b267a3', fruit: '#f37521', header: '#a4709a', date: '#f37521', tint: '#f8e0ce', tip: null },
  12: { month: '#4282aa', badge: '#4282aa', fruit: '#c6b638', header: '#4282aa', date: '#145da0', tint: '#e0e6e7', tip: '#4282aa' },
  16: { month: '#4f6815', badge: '#4f6815', fruit: '#f37521', header: '#4f6815', date: '#ff5757', tint: '#e2e3d2', tip: '#4f6815' },
  20: { month: '#632713', badge: '#632713', fruit: '#ff9955', header: '#632713', date: '#4f6815', tint: '#e5dad2', tip: '#4f6815' },
  24: { month: '#67698e', badge: '#67698e', fruit: '#ff9955', header: '#67698e', date: '#f37521', tint: '#fae9db', tip: null },
  28: { month: '#67698e', badge: '#ffaadc', fruit: '#ffaadc', header: '#67698e', date: '#32620e', tint: '#faeced', tip: '#4f6815' },
  32: { month: '#4f6815', badge: '#4f6815', fruit: '#58355e', header: '#67698e', date: '#145da0', tint: '#e4dcdc', tip: '#58355e' },
  36: { month: '#4f6815', badge: '#4f6815', fruit: '#58355e', header: '#67698e', date: '#ff1fa9', tint: '#f2f2e8', tip: '#58355e' },
  40: { month: '#58355e', badge: '#ff9955', fruit: '#f37521', header: '#67698e', date: '#ff1fa9', tint: '#fae9db', tip: null }
};
// Non-highlighted calendar dates render at ~62% ink in the design
// (#67698e over the cream cells flattens to this).
const DATE_DIM = '#9f9fb4';

const MONTHS = {
  en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  de: ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
};
const WEEKDAYS = {
  en: ['MON','TUE','WED','THU','FRI','SAT','SUN'],
  de: ['MO','DI','MI','DO','FR','SA','SO']
};
const UI = {
  en: { sizeOf: 'Baby is the size of', babySize: 'Baby Size', babyWeight: 'Baby Weight',
        tiny: 'Tiny moments', dev: 'Baby Development', mama: 'Mama may notice', notes: 'Notes & Memories',
        weekOf: (n) => `Week ${n} of Pregnancy` },
  de: { sizeOf: 'Dein Baby ist so groß wie', babySize: 'Größe', babyWeight: 'Gewicht',
        tiny: 'Kleine Momente', dev: 'Entwicklung', mama: 'Mama spürt vielleicht', notes: 'Notizen & Erinnerungen',
        weekOf: (n) => `${n}. Schwangerschaftswoche` }
};

// Fonts (CSS families defined in the template). role -> family.
const F = { script: 'var(--f-script)', now: 'var(--f-now)', serif: 'var(--f-serif)', sans: 'var(--f-sans)' };

// Text roles. x/y are top-left in design space; size in px; `w` optional wrap width;
// `align` optional; `color` role resolved at render (primary | grey).
const ROLES = {
  month:        { x: 74,  y: 44,  size: 54, font: F.script, color: 'month', lh: 1.0 },
  year:         { x: 150, y: 128, size: 21, font: F.now,    color: 'grey', ls: '2px' },
  badge:        { x: 28,  y: 214, w: 324, size: 22, font: F.script, color: 'badge', align: 'center' },
  sizeOf:       { x: 66,  y: 296, w: 330, size: 19, font: F.serif, color: 'grey', align: 'center' },
  fruitName:    { x: 40,  y: 334, w: 380, size: 34, font: F.script, color: 'fruit', align: 'center' },
  babySizeLbl:  { x: 60,  y: 668, w: 110, size: 20, font: F.serif, color: 'grey', align: 'center' },
  babySizeVal:  { x: 55,  y: 758, w: 120, size: 15, font: F.sans,  color: 'grey', align: 'center' },
  babyWeightLbl:{ x: 205, y: 668, w: 130, size: 20, font: F.serif, color: 'grey', align: 'center' },
  babyWeightVal:{ x: 205, y: 758, w: 130, size: 15, font: F.sans,  color: 'grey', align: 'center' },
  tiny:         { x: 1186, y: 74, size: 21, font: F.script, color: 'header' },
  devHdr:       { x: 1236, y: 137, size: 16, font: F.serif, color: 'grey' },
  devBody:      { x: 1201, y: 174, w: 188, size: 12.5, font: F.serif, color: 'grey', lh: 1.32 },
  mamaHdr:      { x: 1186, y: 310, size: 21, font: F.script, color: 'header' },
  notesHdr:     { x: 1226, y: 588, size: 15, font: F.script, color: 'header' },
  calloutLabel: { x: 560, y: 700, size: 22, font: F.script, color: 'header' },
  calloutText:  { x: 661, y: 700, w: 360, size: 17, font: F.serif, color: 'grey', lh: 1.22 }
};

// Mama bullet list block
const MAMA = { x: 1220, markerX: 1194, y: 372, w: 168, size: 12.5, lh: 1.3, gap: 9, font: F.serif };

// Callout block vertical centring band (label + text share this y region)
// Calendar geometry (design space)
const CAL = {
  left: 366, top: 110, colW: 108.7, headerH: 46, rowTop: 158, rowH: 90,
  gridBottom: 664, // rows compress to fit within [rowTop, gridBottom] so a 6-row month never hits the callout
  numDx: 15, numDy: 8, numSize: 22, hdrSize: 17, hdrDy: 12
};

function derive(primary) {
  return { primary, grey: NEUTRAL };
}

module.exports = { MONTHS, WEEKDAYS, UI, ROLES, MAMA, CAL, NEUTRAL, THEME, DATE_DIM, derive };
