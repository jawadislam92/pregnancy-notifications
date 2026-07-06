const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1 });
  const url = process.argv[2];
  const out = process.argv[3];
  const idxs = (process.argv[4] || '0').split(',').map(Number);
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  const pages = await p.$$('.page');
  for (const i of idxs) {
    await pages[i].screenshot({ path: out + '\\render-p' + (i + 1) + '.png' });
    console.log('shot page', i + 1);
  }
  await b.close();
})();
