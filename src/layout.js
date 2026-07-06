// Layout map + localisation. Coordinates are in the original design space
// (1440 x 810), harvested from the Canva PDF, so overlaid text lands exactly
// where it sat in the approved design. renderPage.js consumes this.

const NEUTRAL = '#67698e'; // shared body/label grey (constant across pages)

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
  month:        { x: 74,  y: 34,  size: 62, font: F.script, color: 'primary', lh: 1.0 },
  year:         { x: 150, y: 128, size: 21, font: F.now,    color: 'grey', ls: '2px' },
  badge:        { x: 28,  y: 214, w: 324, size: 22, font: F.script, color: 'primary', align: 'center' },
  sizeOf:       { x: 66,  y: 296, w: 330, size: 19, font: F.serif, color: 'grey', align: 'center' },
  fruitName:    { x: 40,  y: 330, w: 380, size: 40, font: F.script, color: 'primary', align: 'center' },
  babySizeLbl:  { x: 60,  y: 668, w: 110, size: 20, font: F.serif, color: 'grey', align: 'center' },
  babySizeVal:  { x: 55,  y: 758, w: 120, size: 15, font: F.sans,  color: 'grey', align: 'center' },
  babyWeightLbl:{ x: 205, y: 668, w: 130, size: 20, font: F.serif, color: 'grey', align: 'center' },
  babyWeightVal:{ x: 205, y: 758, w: 130, size: 15, font: F.sans,  color: 'grey', align: 'center' },
  tiny:         { x: 1186, y: 74, size: 21, font: F.script, color: 'primary' },
  devHdr:       { x: 1236, y: 137, size: 16, font: F.serif, color: 'grey' },
  devBody:      { x: 1201, y: 174, w: 188, size: 12.5, font: F.serif, color: 'grey', lh: 1.32 },
  mamaHdr:      { x: 1186, y: 310, size: 21, font: F.script, color: 'primary' },
  notesHdr:     { x: 1226, y: 588, size: 15, font: F.script, color: 'primary' },
  calloutLabel: { x: 560, y: 700, size: 22, font: F.script, color: 'primary' },
  calloutText:  { x: 661, y: 700, w: 360, size: 17, font: F.serif, color: 'grey', lh: 1.22 }
};

// Mama bullet list block
const MAMA = { x: 1220, markerX: 1194, y: 372, w: 168, size: 12.5, lh: 1.3, gap: 9, font: F.serif };

// Callout block vertical centring band (label + text share this y region)
// Calendar geometry (design space)
const CAL = {
  left: 366, top: 110, colW: 108.7, headerH: 46, rowTop: 158, rowH: 90,
  numDx: 15, numDy: 8, numSize: 22, hdrSize: 17, hdrDy: 12
};

function derive(primary) {
  return { primary, grey: NEUTRAL };
}

module.exports = { MONTHS, WEEKDAYS, UI, ROLES, MAMA, CAL, NEUTRAL, derive };
