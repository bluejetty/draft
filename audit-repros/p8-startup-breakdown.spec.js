const { test } = require('@playwright/test');
test('P8: where the 12 seconds of startup go', async ({ page }) => {
  await page.goto('/MODEL.dc.html');
  await page.waitForFunction(() => document.body.dataset.modelReady === '1');
  const t = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0];
    const r = performance.getEntriesByType('resource');
    const scriptEnd = Math.max(...r.filter(e => e.name.endsWith('.js')).map(e => e.responseEnd));
    return {
      responseEnd: Math.round(n.responseEnd),
      domInteractive: Math.round(n.domInteractive),
      domContentLoaded: Math.round(n.domContentLoadedEventEnd),
      loadEvent: Math.round(n.loadEventEnd),
      lastScriptDownloaded: Math.round(scriptEnd),
      docBytes: Math.round(n.transferSize / 1024),
      longTasks: performance.getEntriesByType('longtask')?.length ?? 'n/a',
    };
  });
  console.log('navigation timing (ms from navigationStart):', JSON.stringify(t, null, 1));
  // How long does the dc template compile itself take? Time a second compile
  // of the same template body.
  const compile = await page.evaluate(() => {
    const node = document.querySelector('script[type="text/x-dc"]');
    const src = node ? node.textContent.length : 0;
    const tpl = document.querySelector('x-dc');
    return { dcScriptChars: src, templateChars: tpl ? tpl.innerHTML.length : 0,
      htmlChars: document.documentElement.outerHTML.length };
  });
  console.log('inline sizes:', JSON.stringify(compile));
});
