const { test } = require('@playwright/test');
test('P10: CPU profile of the 12s startup', async ({ page, context }) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
  await cdp.send('Profiler.start');
  await page.goto('/MODEL.dc.html');
  await page.waitForFunction(() => document.body.dataset.modelReady === '1');
  const { profile } = await cdp.send('Profiler.stop');
  const byId = new Map(profile.nodes.map(n => [n.id, n]));
  const self = new Map();
  profile.nodes.forEach(n => { if (n.hitCount) self.set(n.id, n.hitCount); });
  const total = [...self.values()].reduce((a, b) => a + b, 0);
  const dur = (profile.endTime - profile.startTime) / 1000;
  const rows = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([id, hits]) => {
    const n = byId.get(id).callFrame;
    return `${((hits / total) * 100).toFixed(1)}%  ${n.functionName || '(anonymous)'}  ${(n.url || '').split('/').pop()}:${n.lineNumber + 1}`;
  });
  console.log(`profile span ${dur.toFixed(0)} ms, ${total} samples`);
  rows.forEach(r => console.log('  ' + r));
});
