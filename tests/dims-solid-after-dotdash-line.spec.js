// DIMENSION LINES ARE ALWAYS SOLID on a LAYOUT sheet, whatever the line
// drawn before them was.
//
// jb, 10 Nov: "the dim lines are showing as dashed dotted they should
// always be solid line ... only on the layout construction plan its showing
// dashed dot its solid on the model space."
//
// The pen table's proxy (pen-table.js) remembers the dash a painter asked
// for so a layer with no pen gets it back. strokeLines set a lot line's
// DOT-DASH inside a save/restore pair; the canvas forgot it on restore, the
// proxy did not, and the dimensions painted next took it back on their
// first lineWidth. The proxy's memory now follows save/restore.
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';
const point = (x, z) => ({ x, y: 0, z });
const SITE = 8;

// A standalone site plan the way jb draws one: no lot record, a DOT-DASH
// property line by hand and a hand dimension along it.
const drawing = () => ({
  version: 1,
  standalone: 'site',
  levels: [{ id: SITE, name: 'SITE', elev: 0 }],
  walls: [], roofs: [], outlines: [], fenestrations: [],
  lines: [
    { id: 'L1', levelId: SITE, view: 'plan', layer: 'draft', start: point(0, 0), end: point(100, 0), style: 'dotdash' },
    { id: 'L2', levelId: SITE, view: 'plan', layer: 'draft', start: point(100, 0), end: point(100, 60), style: 'dotdash' },
  ],
  dimensions: [
    { id: 1, levelId: SITE, view: 'plan', layer: 'A-DIMS-HAND', start: point(0, 0), end: point(100, 0) },
    { id: 2, levelId: SITE, view: 'plan', layer: 'A-DIMS-HAND', start: point(100, 0), end: point(100, 60) },
  ],
  layout: { auto: true },
});

async function openLayout(page, saved) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('draft-test-storage-cleared')) return;
    sessionStorage.setItem('draft-test-storage-cleared', '1');
    indexedDB.deleteDatabase('pdf-img-mgr-shared');
    localStorage.clear();
  });
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.evaluate(async ({ bucket, saved }) => {
    const file = new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(file, bucket);
  }, { bucket: BUCKET, saved });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
}

// Every stroke of the SITE sheet with its layer and the dash the real
// canvas had when it went out.
const strokesOf = page => page.evaluate(async ({ bucket, level }) => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  const saved = JSON.parse(await file.text());
  const real = document.createElement('canvas').getContext('2d');
  const log = [];
  let layer = null;
  const spy = new Proxy(real, {
    has: (t, p) => p === 'dxfLayer' || p in t,
    get: (t, p) => {
      if (p === 'dxfLayer') return layer;
      if (p === 'stroke') return (...a) => { log.push({ layer, dash: t.getLineDash() }); return t.stroke(...a); };
      const v = t[p];
      return typeof v === 'function' ? v.bind(t) : v;
    },
    set: (t, p, v) => { if (p === 'dxfLayer') { layer = v; return true; } t[p] = v; return true; },
  });
  const toS = pt => ({ x: 100 + pt.x * 4, y: 100 + pt.z * 4 });
  window.DraftLayoutPlan.drawPlan(spy, toS, saved, level, { view: null, inkScale: 1, paperColor: '#ffffff' });
  return log;
}, { bucket: BUCKET, level: SITE });

test('dimensions stroke solid on the sheet after a dot-dash hand line', async ({ page }) => {
  await openLayout(page, drawing());
  const log = await strokesOf(page);
  const lines = log.filter(s => s.layer === 'draft');
  const dims = log.filter(s => s.layer === 'A-DIMS-HAND');
  expect(lines.length, 'the property lines drew').toBe(2);
  expect(lines.every(s => s.dash.length >= 4), 'the property lines are dot-dash').toBe(true);
  expect(dims.length, 'the dimensions drew').toBeGreaterThan(0);
  expect(dims.filter(s => s.dash.length).map(s => s.dash), 'every dimension stroke is solid').toEqual([]);
});
