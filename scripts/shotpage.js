const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1100, height: 720 } });
  await p.goto(process.argv[2], { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(200);
  await p.screenshot({ path: process.argv[3] });
  await b.close(); console.log('shot', process.argv[3]);
})();
