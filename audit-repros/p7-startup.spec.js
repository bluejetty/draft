const { test } = require('@playwright/test');
const h = require('../tests/helpers.js');
test('P7: what loads before first interaction', async ({ page }) => {
  const res = [];
  page.on('response', r => res.push([r.url().split('/').pop(), r.status()]));
  const t0 = Date.now();
  await page.goto('/MODEL.dc.html');
  await page.waitForFunction(() => document.body.dataset.modelReady === '1');
  const ready = Date.now() - t0;
  const sizes = await page.evaluate(() => performance.getEntriesByType('resource')
    .map(e => [e.name.split('/').pop(), Math.round(e.transferSize / 1024), Math.round(e.duration)])
    .sort((a, b) => b[1] - a[1]).slice(0, 14));
  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0];
    return { domContentLoaded: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) };
  });
  console.log('model-ready in', ready, 'ms | nav', JSON.stringify(nav));
  console.log('heaviest resources (name, KB, ms):');
  sizes.forEach(s => console.log('  ', s.join('  ')));
  console.log('non-200 responses:', JSON.stringify(res.filter(r => r[1] >= 400)));
  const total = await page.evaluate(() => Math.round(performance.getEntriesByType('resource')
    .reduce((s, e) => s + e.transferSize, 0) / 1024));
  console.log('total transferred KB:', total, '| requests:', res.length);
  const mem = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null);
  console.log('JS heap after ready (MB):', mem);
});
