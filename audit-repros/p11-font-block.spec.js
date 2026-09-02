const { test } = require('@playwright/test');
test('P11: the Google Fonts stylesheet is render-blocking — abort it and compare', async ({ page }) => {
  const t0 = Date.now();
  await page.goto('/MODEL.dc.html');
  await page.waitForFunction(() => document.body.dataset.modelReady === '1');
  console.log('model-ready as shipped      :', Date.now() - t0, 'ms');

  await page.route('**fonts.googleapis.com**', r => r.abort());
  await page.route('**fonts.gstatic.com**', r => r.abort());
  const t1 = Date.now();
  await page.goto('/MODEL.dc.html');
  await page.waitForFunction(() => document.body.dataset.modelReady === '1');
  console.log('model-ready with fonts cut  :', Date.now() - t1, 'ms');
});
