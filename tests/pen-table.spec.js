// THE PEN TABLE: walls heavy, dims light, hidden dashed -- and printed that way.
//
// jb, 9 Nov: "Line weights / a pen table. There is no way I could see to say
// 'walls heavy, dims light, hidden dashed' and have it print that way."
//
// The company standard's layer table carries a PEN WEIGHT and a LINETYPE for
// every layer (STANDARDS.html, profile-manager.js). A sheet on LAYOUT paints
// through pen-table.js, which listens for the layer plan-composition names
// before each piece and strokes it at that pen; the DXF a sheet saves
// carries the same pens in its LAYER table. A pen left at DEFAULT is the
// painter's own ink, so a standard from before the table prints unchanged.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BUCKET = 'model-drawing';
const point = (x, z) => ({ x, y: 0, z });

// A main floor over a foundation, one door, and ONE HAND-DRAWN LINE at
// XTRA-BOLD on the DRAFT layer, which must keep its own weight whatever the
// walls are set to.
function boneDrawing() {
  const wall = (id, levelId, view, sx, sz, ex, ez, top) => ({
    id, start: point(sx, sz), end: point(ex, ez), levelId, view,
    wallType: view === 'foundation' ? 'concrete_8' : 'stud_2x6',
    baseHeight: 0, topHeight: top, refLine: 'left',
  });
  const ring = (idBase, levelId, view, top) => [
    wall(idBase + 1, levelId, view, 0, 0, 36, 0, top),
    wall(idBase + 2, levelId, view, 36, 0, 36, 26, top),
    wall(idBase + 3, levelId, view, 36, 26, 0, 26, top),
    wall(idBase + 4, levelId, view, 0, 26, 0, 0, top),
  ];
  return {
    version: 1,
    levels: [
      { id: 8, name: 'SITE', elev: 0 },
      { id: 7, name: 'ROOF', elev: 9 },
      { id: 3, name: 'MAIN FL', elev: 0 },
      { id: 1, name: 'FOUNDATION', elev: -9 },
    ],
    walls: [...ring(0, 3, 'plan', 8.09), ...ring(10, 1, 'foundation', 8)],
    roofs: [{
      id: 1, levelId: 7, pitch: 4, overhang: 1.5,
      points: [{ x: -1.5, z: -1.5 }, { x: 37.5, z: -1.5 }, { x: 37.5, z: 27.5 }, { x: -1.5, z: 27.5 }],
      edges: ['eave', 'gable', 'eave', 'gable'],
    }],
    fenestrations: [{ id: 1, levelId: 3, wallId: 1, type: 'door', offset: 6, width: 3 }],
    lines: [{ id: 'L1', levelId: 3, view: 'plan', layer: 'draft', start: point(4, 4), end: point(30, 4), weight: 6, style: 'solid' }],
    dimensions: [{ id: 31, levelId: 3, view: 'plan', auto: true, layer: 'A-DIMS-OVR', start: point(0, -3), end: point(36, -3) }],
    layout: { auto: true },
  };
}

async function openLayout(page, drawing) {
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
  }, { bucket: BUCKET, saved: drawing });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
}
async function waitForCompose(page) {
  await page.waitForFunction(() => Number(document.body.dataset.layoutSaveSeq || 0) > 0
    && document.body.dataset.layoutSaveDirty !== '1');
}

// THE PENS UNDER TEST: exterior walls BOLD (3.5 px), the overall dimension
// string HAIR (0.5 px), the door DASHED, everything else as the painter has it.
const PENS = {
  'A-WALL-EXT': { weight: '5' },
  'A-DIMS-OVR': { weight: '1' },
  'A-DOOR': { linetype: 'dashed' },
};
const setPens = (page, pens) => page.evaluate(pens => {
  const m = window.DraftProfileManager;
  m.saveActive(m.createPackage('standards', 'pens', { model: { layerStandards: pens } }));
}, pens);

// EVERY STROKE OF THE MAIN FLOOR PLAN, with the layer it went out on, its
// width and its dash -- a spy in front of a real canvas context, which is
// what pen-table.js then sits in front of.
const strokesOf = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  const saved = JSON.parse(await file.text());
  const real = document.createElement('canvas').getContext('2d');
  const log = [];
  let layer = null;
  const spy = new Proxy(real, {
    has: (t, p) => p === 'dxfLayer' || p in t,
    get: (t, p) => {
      if (p === 'dxfLayer') return layer;
      if (p === 'stroke') return (...a) => { log.push({ layer, w: t.lineWidth, dash: t.getLineDash() }); return t.stroke(...a); };
      const v = t[p];
      return typeof v === 'function' ? v.bind(t) : v;
    },
    set: (t, p, v) => { if (p === 'dxfLayer') { layer = v; return true; } t[p] = v; return true; },
  });
  const toS = pt => ({ x: 100 + pt.x * 10, y: 100 + pt.z * 10 });
  window.DraftLayoutPlan.drawPlan(spy, toS, saved, 3, { view: null, inkScale: 1, paperColor: '#ffffff' });
  return log;
}, BUCKET);
const on = (log, layer) => log.filter(s => s.layer === layer);
const widths = rows => [...new Set(rows.map(s => s.w))].sort((a, b) => a - b);

test('a sheet strokes each layer at the pen the company standard gives it', async ({ page }) => {
  await openLayout(page, boneDrawing());
  await waitForCompose(page);

  // BEFORE: the painter's own ink. Exterior walls at 1.5 px, the overall
  // string at 1, the door solid, and the hand line at its own XTRA-BOLD.
  const before = await strokesOf(page);
  expect(widths(on(before, 'A-WALL-EXT'))).toEqual([1.5]);
  expect(widths(on(before, 'A-DIMS-OVR'))).toEqual([1]);
  expect(on(before, 'A-DOOR').length).toBeGreaterThan(0);
  expect(on(before, 'A-DOOR').every(s => s.dash.length === 0), 'the door strokes solid').toBe(true);
  expect(widths(on(before, 'draft'))).toEqual([4.5]);

  // AFTER: walls heavy, dims light, the door dashed -- and nothing else
  // moved. The DRAFT layer's pen is DEFAULT, so the hand line keeps the
  // XTRA-BOLD it was drawn with; the roof plan and the interior strokes
  // the pens never named are untouched.
  await setPens(page, PENS);
  const after = await strokesOf(page);
  expect(widths(on(after, 'A-WALL-EXT'))).toEqual([3.5]);
  expect(widths(on(after, 'A-DIMS-OVR'))).toEqual([0.5]);
  expect(on(after, 'A-DOOR').every(s => s.dash.length === 2 && s.dash[0] > s.dash[1]), 'the door strokes dashed').toBe(true);
  expect(widths(on(after, 'draft'))).toEqual([4.5]);
  const untouched = l => l.filter(s => !PENS[s.layer]).map(s => `${s.layer}:${s.w}:${s.dash.join(',')}`);
  expect(untouched(after)).toEqual(untouched(before));

  // AND THE INK SCALES WITH THE SHEET, as every other ink does: at twice the
  // zoom a BOLD wall is 7 px.
  const zoomed = await page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const saved = JSON.parse(await file.text());
    const real = document.createElement('canvas').getContext('2d');
    const seen = new Set();
    let layer = null;
    const spy = new Proxy(real, {
      has: (t, p) => p === 'dxfLayer' || p in t,
      get: (t, p) => {
        if (p === 'dxfLayer') return layer;
        if (p === 'stroke') return (...a) => { if (layer === 'A-WALL-EXT') seen.add(t.lineWidth); return t.stroke(...a); };
        const v = t[p];
        return typeof v === 'function' ? v.bind(t) : v;
      },
      set: (t, p, v) => { if (p === 'dxfLayer') { layer = v; return true; } t[p] = v; return true; },
    });
    window.DraftLayoutPlan.drawPlan(spy, pt => ({ x: 100 + pt.x * 20, y: 100 + pt.z * 20 }), saved, 3, { view: null, inkScale: 2 });
    return [...seen];
  }, BUCKET);
  expect(zoomed).toEqual([7]);
});

// The files in a stored ZIP, by walking its local headers.
function unzipStored(buf) {
  const files = {};
  let at = 0;
  while (buf.readUInt32LE(at) === 0x04034b50) {
    const size = buf.readUInt32LE(at + 18);
    const nameLen = buf.readUInt16LE(at + 26), extra = buf.readUInt16LE(at + 28);
    const name = buf.slice(at + 30, at + 30 + nameLen).toString('utf8');
    const start = at + 30 + nameLen + extra;
    files[name] = buf.slice(start, start + size).toString('utf8');
    at = start + size;
  }
  return files;
}
const reader = (() => {
  const win = {};
  const sandbox = { window: win, Math, Number, String, Object, Array, JSON, Map, Set, parseFloat, parseInt, isFinite };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'dxf-reader.js'), 'utf8'), sandbox);
  return win.DraftDxfReader;
})();
// The LAYER table entries of a DXF, each as its group-code pairs.
const layerTableOf = text => {
  const codes = text.split('\r\n');
  const out = {};
  let inLayers = false;
  for (let i = 0; i + 1 < codes.length; i += 2) {
    const code = Number(codes[i]), value = codes[i + 1];
    if (code === 2 && value === 'LAYER' && codes[i - 2] === '0' && codes[i - 1] === 'TABLE') inLayers = true;
    else if (inLayers && code === 0 && value === 'ENDTAB') break;
    else if (inLayers && code === 0 && value === 'LAYER') {
      const entry = {};
      for (let j = i + 2; j + 1 < codes.length && codes[j] !== '0'; j += 2) entry[codes[j]] = codes[j + 1];
      out[entry['2']] = entry;
    }
  }
  return out;
};

test('the DXF a sheet saves carries the pens in its LAYER table', async ({ page }, info) => {
  await openLayout(page, boneDrawing());
  await waitForCompose(page);
  await setPens(page, PENS);
  // SAVE DXF costs bones (tests/layout-print-bone-cost.spec.js); fund the seed wallet.
  await page.evaluate(() => localStorage.setItem('draft-bone-wallet',
    JSON.stringify({ balance: 20, lastDripAt: Date.now(), createdAt: Date.now() })));
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-layout-dxf]').click()]);
  const file = info.outputPath('sheets.zip');
  await download.saveAs(file);
  const files = unzipStored(fs.readFileSync(file));
  const plan = Object.keys(files).find(n => / MAIN FL PLAN\.dxf$/.test(n));
  expect(plan).toBeTruthy();
  const text = files[plan];
  const layers = layerTableOf(text);
  // BOLD is 3.5 paper pixels at 72 to the inch, 1.23 mm, and AutoCAD's
  // nearest listed weight is 1.20 mm -- 120 in its hundredths. HAIR, 0.18
  // mm, is its 0.18. The door's layer names the DASHED linetype; a layer
  // with no pen goes out CONTINUOUS with no weight, as it always did.
  expect(layers['A-WALL-EXT']).toMatchObject({ 6: 'CONTINUOUS', 370: '120' });
  expect(layers['A-DIMS-OVR']).toMatchObject({ 370: '18' });
  expect(layers['A-DOOR']).toMatchObject({ 6: 'DASHED' });
  expect(layers['A-DOOR']['370']).toBeUndefined();
  expect(layers['A-WALL-INT']).toMatchObject({ 6: 'CONTINUOUS' });
  expect(layers['A-WALL-INT']['370']).toBeUndefined();
  // Still an R12 file the TRACE reader opens.
  expect(text).toContain('$ACADVER\r\n1\r\nAC1009');
  expect(() => reader.parse(text)).not.toThrow();
  expect(reader.parse(text).paths.some(p => p.layer === 'A-WALL-EXT')).toBe(true);
});

test('STANDARDS offers a pen weight and a linetype per layer and keeps them in the package', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('draft-test-storage-cleared')) return;
    sessionStorage.setItem('draft-test-storage-cleared', '1');
    localStorage.clear();
  });
  await page.goto('/STANDARDS.html');
  const weight = page.locator('[data-layer-pen="weight"][data-layer-id="A-WALL-EXT"]');
  const linetype = page.locator('[data-layer-pen="linetype"][data-layer-id="A-DOOR"]');
  await expect(weight).toHaveValue('default');
  await expect(linetype).toHaveValue('default');
  expect(await weight.locator('option').allTextContents()).toEqual(['DEFAULT', 'HAIR', 'FINE', 'MEDIUM', 'HEAVY', 'BOLD', 'XTRA-BOLD']);
  expect(await linetype.locator('option').allTextContents()).toEqual(['DEFAULT', 'SOLID', 'DASHED', 'DOT DASH', 'DOTTED']);
  await weight.selectOption('5');
  await expect(page.locator('#status')).toHaveText('A-WALL-EXT prints at BOLD.');
  await linetype.selectOption('dashed');
  await expect(page.locator('#status')).toHaveText('A-DOOR prints as DASHED.');
  const kept = () => page.evaluate(() => {
    const t = window.DraftProfileManager.getActive('standards').content.model.layerStandards;
    return [t['A-WALL-EXT'].weight, t['A-WALL-EXT'].linetype, t['A-DOOR'].weight, t['A-DOOR'].linetype, t['A-WALL-INT'].weight];
  });
  expect(await kept()).toEqual(['5', 'default', 'default', 'dashed', 'default']);
  // Survives a reload, and the row's × puts the layer back to DEFAULT.
  await page.reload();
  await expect(page.locator('[data-layer-pen="weight"][data-layer-id="A-WALL-EXT"]')).toHaveValue('5');
  await page.locator('[data-layer-reset="A-WALL-EXT"]').click();
  await expect(page.locator('[data-layer-pen="weight"][data-layer-id="A-WALL-EXT"]')).toHaveValue('default');
  expect(await kept()).toEqual(['default', 'default', 'default', 'dashed', 'default']);
});

// THE PEN DOES NOT LEAK. plan-composition's strokeLines sets a hand line's
// own ink and THEN names its layer; a dashed BOLD pen on the layer named
// before it must not ride onto a line whose layer's pen is DEFAULT, and a
// layer named with no ink set after it must still get its pen.
test('naming a layer re-inks the context: a pen never leaks onto the next layer', async ({ page }) => {
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  const log = await page.evaluate(() => {
    const table = { 'A-DOOR': { weight: '5', linetype: 'dashed' }, draft: { weight: 'default', linetype: 'default' } };
    const real = document.createElement('canvas').getContext('2d');
    const log = [];
    const spy = new Proxy(real, {
      get: (t, p) => {
        if (p === 'stroke') return () => { log.push([t.lineWidth, t.getLineDash().join(',')]); };
        const v = t[p];
        return typeof v === 'function' ? v.bind(t) : v;
      },
      set: (t, p, v) => { t[p] = v; return true; },
    });
    const ctx = window.DraftPenTable.wrap(spy, { lookup: id => table[id] || null, inkScale: 1 });
    // The door: its layer named first, then its ink -- BOLD and dashed.
    ctx.dxfLayer = 'A-DOOR'; ctx.lineWidth = 1.25; ctx.setLineDash([]); ctx.stroke();
    // A hand line at XTRA-BOLD solid, its layer named after its ink.
    ctx.lineWidth = 4.5; ctx.setLineDash([]); ctx.dxfLayer = 'draft'; ctx.stroke();
    // Back to the door with no ink set at all: the pen alone.
    ctx.dxfLayer = 'A-DOOR'; ctx.stroke();
    return log;
  });
  expect(log[0][0]).toBe(3.5);
  expect(log[0][1]).toBe('28,17.5');
  expect(log[1]).toEqual([4.5, '']);
  expect(log[2][0]).toBe(3.5);
  expect(log[2][1]).toBe('28,17.5');
});
