// SAVE DXF ON LAYOUT: EVERY SHEET AS ITS OWN AUTOCAD FILE.
//
// Movie, 9 Oct: "exactly for engineers to have autocad version to manipulate
// as they need too" -- "put all as individual autocad files with each
// layout" -- "all the layers that show on the specific layer should show" --
// "leave out the TB". One ZIP, a DXF a sheet that has a drawing on it, full
// size in inches, on CAD layers, no titleblock. Each file is read back here
// with dxf-reader.js, the same reader TRACE opens a DXF with.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BUCKET = 'model-drawing';
const point = (x, z) => ({ x, y: 0, z });
function boneDrawing({ auto = true, layout = undefined } = {}) {
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
      points: [
        { x: -1.5, z: -1.5 }, { x: 37.5, z: -1.5 },
        { x: 37.5, z: 27.5 }, { x: -1.5, z: 27.5 },
      ],
      edges: ['eave', 'gable', 'eave', 'gable'],
    }],
    cuts: [{
      id: 1, name: 'S1', elev: 0, levelId: 3,
      startPt: { x: 18, z: -4 }, endPt: { x: 18, z: 30 },
      dirVec: { x: 1, z: 0 },
    }],
    fenestrations: [
      { id: 1, levelId: 3, wallId: 1, type: 'door', offset: 6, width: 3 },
    ],
    layout: layout !== undefined ? layout : { auto },
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

test('SAVE DXF hands over one ZIP: a full-size DXF a drawn sheet, on CAD layers, no titleblock', async ({ page }, info) => {
  await openLayout(page, boneDrawing());
  await waitForCompose(page);
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-layout-dxf]').click()]);
  expect(download.suggestedFilename()).toBe('NEW HOME DXF.zip');
  const file = info.outputPath('sheets.zip');
  await download.saveAs(file);
  const files = unzipStored(fs.readFileSync(file));
  const names = Object.keys(files);

  expect(names.some(n => /SITE PLAN/.test(n)), 'an empty sheet is left out').toBe(false);
  const plan = names.find(n => / MAIN FL PLAN\.dxf$/.test(n));
  expect(plan, `a MAIN FL PLAN among ${names.join(', ')}`).toBeTruthy();
  expect(names.filter(n => /ELEVATIONS\.dxf$/.test(n)).length).toBe(2);

  names.forEach(name => {
    const text = files[name];
    expect(text, `${name} is an R12 DXF`).toContain('$ACADVER\r\n1\r\nAC1009');
    expect(text, `${name} reads in architectural units`).toContain('$LUNITS\r\n70\r\n4');
    expect(text, `${name} carries no titleblock`).not.toMatch(/BUILDING ADDRESS|DRAFT BY/);
    expect(() => reader.parse(text), `${name} reads back`).not.toThrow();
  });

  const geo = reader.parse(files[plan]);
  const layers = geo.layers.filter(l => l.count > 0).map(l => l.name);
  expect(layers).toEqual(expect.arrayContaining(['A-WALL-EXT', 'A-DOOR', 'A-ANNO-TITL']));
  // FULL SIZE: the 36' house is 432 inches across its walls, at its own
  // coordinates -- x from 0, the drawing's y north (z south, so negative).
  const walls = geo.paths.filter(p => p.layer === 'A-WALL-EXT');
  const xs = walls.flatMap(p => [p.box[0], p.box[2]]), ys = walls.flatMap(p => [p.box[1], p.box[3]]);
  expect(Math.round(Math.max(...xs) - Math.min(...xs))).toBeGreaterThanOrEqual(432);
  expect(Math.round(Math.max(...xs) - Math.min(...xs))).toBeLessThanOrEqual(436);
  expect(Math.round(Math.min(...xs))).toBeGreaterThanOrEqual(-2);
  expect(Math.round(Math.max(...ys))).toBeLessThanOrEqual(2);
  // The door's swing goes out as an ARC, not a run of little lines.
  expect(files[plan]).toMatch(/\r\nARC\r\n8\r\nA-DOOR\r\n/);
  // And its title under it, in inches a printed 1/8" would be at 1/4" = 1'.
  const title = geo.texts.find(t => /MAIN FL PLAN/.test(t.lines.join(' ')));
  expect(title, 'the drawing\'s title').toBeTruthy();
  expect(title.h).toBeCloseTo(0.125 * 48 * 0.7, 1);

  const foundation = names.find(n => /FOUNDATION\.dxf$/.test(n));
  expect(reader.parse(files[foundation]).layers.map(l => l.name),
    'the concrete hatch on its own layer').toContain('A-WALL-PATT');
});
