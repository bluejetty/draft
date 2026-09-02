const { test } = require('@playwright/test');
const timing = async (page, url) => {
  await page.goto(url);
  await page.waitForFunction(() => document.readyState === 'complete');
  return page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0];
    return { domInteractive: Math.round(n.domInteractive), load: Math.round(n.loadEventEnd) };
  });
};
test('P9: isolate the startup cost', async ({ page }) => {
  console.log('head-only (vendor+modules, no template):', JSON.stringify(await timing(page, '/_probe-head.html')));
  console.log('full page minus the inline dc script  :', JSON.stringify(await timing(page, '/_probe-nodc.html')));
  console.log('real MODEL.dc.html                     :', JSON.stringify(await timing(page, '/MODEL.dc.html')));
});
