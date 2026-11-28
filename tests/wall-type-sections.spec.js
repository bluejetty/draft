// CREATE WALL TYPE, PART TWO (jb, 16 Nov 2026): the made type in the cut
// views, on the WALL SECTION sheet, in the DXF and in ESTIMATES.
//
// The plan jb OK'd: "Sections and the WALL SECTION sheet show the full wall"
// (a foundation type's BASEMENT lining too, whatever the FDN / BSMT chips say
// about plans); "DXF gets slice lines"; "Estimates: per-type lines with
// length plus SF per slice".
//
// cut-view.js sectionSlices (the section), wall-section.js + project-page.js
// buildWallSection (the sheet), estimates.js madeWallTypeRows (6-C).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const SHOTS = process.env.WALL_TYPE_SHOTS || '';
const EXT = { id: 'wt_ext', name: '2X6 EXT W/ STONE', kind: 'floor', layers: [
  { name: 'LEDGESTONE', in: 3, fill: 'ledgestone' }, { name: 'AIR GAP', in: 1, fill: 'transparent' },
  { name: 'SHEATHING', in: 0.4375, fill: 'grey' }, { name: '2X6 + BATT', in: 5.5, fill: 'insulation' },
  { name: 'VB', in: 0, fill: 'stud' }, { name: 'GYP', in: 0.5, fill: 'white' }] };
const FDN = { id: 'wt_fdn', name: '8IN CONC + LINING', kind: 'foundation', layers: [
  { name: '8" CONC', in: 8, fill: 'concrete' },
  { name: 'AIR SPACE', in: 0.5, fill: 'transparent', fdn: false },
  { name: '2X4 + BATT', in: 3.5, fill: 'insulation', fdn: false },
  { name: 'VB', in: 0, fill: 'stud', fdn: false },
  { name: 'GYP', in: 0.5, fill: 'white', fdn: false }] };
const W = (id, a, b, extra) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: EXT.id, widthIn: 10.4375, refLine: 'left', baseHeight: 0, topHeight: 8, ...extra });
const F = (id, a, b) => W(id, a, b, { levelId: 1, view: 'foundation', wallType: FDN.id, widthIn: 12.5,
  baseHeight: -8, topHeight: 0 });
const drawing = (extra = {}) => ({
  version: 1, planTurn: 0, wallTypes: [EXT, FDN],
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 40,
  walls: [W('n', [0, 0], [16, 0]), W('e', [16, 0], [16, 12]), W('s', [16, 12], [0, 12]), W('w', [0, 12], [0, 0]),
    F('fn', [0, 0], [16, 0]), F('fe', [16, 0], [16, 12]), F('fs', [16, 12], [0, 12]), F('fw', [0, 12], [0, 0])],
  fenestrations: [{ id: 'win1', wallId: 'n', levelId: 3, view: 'plan', type: 'window', offset: 3, width: 4, sillHeight: 3, headHeight: 7 }],
  lines: [], floors: [], roofs: [], dimensions: [], fixtures: [],
  outlines: [], shapes: [], surfaceOpenings: [], notes: [], stairs: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], levelLocks: [], underlays: [],
  ...extra,
});
// A cut across the house, north to south through x = 8, looking east.
const CUT = { id: 9, name: 'S9', startPt: { x: 8, z: -6 }, endPt: { x: 8, z: 18 }, dirVec: { x: 1, z: 0 }, levelId: 3 };
const asStuds = d => ({ ...d, walls: d.walls.map(w => ({ ...w, wallType: w.view === 'foundation' ? 'concrete_8' : 'stud_2x6', widthIn: undefined })) });

// THE BATT'S PALE BLUE (205,228,248), counted on a canvas a section is drawn
// on through the page's own modules: cut-view-env (the sheets' env) and
// drawCutView.
const battInSection = (page, saved) => page.evaluate(({ saved, cut }) => {
  const env = window.DraftCutViewEnv.buildCutViewEnv(saved, saved.levels);
  const canvas = document.createElement('canvas');
  canvas.width = 1600; canvas.height = 1000;
  const ctx = canvas.getContext('2d');
  window.DraftCutView.drawCutView(env, ctx, 1600, 1000, cut, { pxPerFt: 40 });
  const d = ctx.getImageData(0, 0, 1600, 1000).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (Math.abs(d[i] - 205) < 16 && Math.abs(d[i + 1] - 228) < 16 && Math.abs(d[i + 2] - 248) < 12) n += 1;
  }
  return n;
}, { saved, cut: CUT });

test('a section cuts a made wall through every slice, the foundation lining too', async ({ page }) => {
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  const made = await battInSection(page, drawing());
  const plain = await battInSection(page, asStuds(drawing()));
  expect(plain, 'a 2x6 wall has no batt slice').toBe(0);
  expect(made, 'the made walls show their batt slice').toBeGreaterThan(1500);
  // THE FOUNDATION LINING ALONE (the main floor plain): its BSMT-only batt
  // is in the section though the FOUNDATION plan leaves it out.
  const lining = await battInSection(page, { ...drawing(), walls: drawing().walls.map(w =>
    (w.view === 'foundation' ? w : { ...w, wallType: 'stud_2x6', widthIn: undefined })) });
  expect(lining, 'the foundation type\'s lining is cut').toBeGreaterThan(500);
});

test('MODEL\'s own section view draws the slices', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing({ cuts: [{ ...CUT, elev: 4 }] }) });
  await page.goto('/MODEL.html?theme=rough&mode=day&view=cut:9');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(600);
  const shot = await page.screenshot();
  if (SHOTS) fs.writeFileSync(path.join(SHOTS, '8-section-made-walls.png'), shot);
  const blue = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll('canvas')].filter(c => c.width > 300 && c.height > 300);
    let n = 0;
    canvases.forEach(c => {
      const ctx = c.getContext('2d');
      if (!ctx) return;
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      for (let i = 0; i < d.length; i += 4) {
        if (Math.abs(d[i] - 205) < 16 && Math.abs(d[i + 1] - 228) < 16 && Math.abs(d[i + 2] - 248) < 12) n += 1;
      }
    });
    return n;
  });
  expect(blue, 'the batt slice shows in MODEL\'s section').toBeGreaterThan(200);
});

// ── THE WALL SECTION SHEET ─────────────────────────────────────────────────
const REPRO = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'proto', 'repro-movie-bands.draft'), 'utf8'));
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
  await page.waitForFunction(() => page.state.sheets.length > 1);
}
// AN OLD FILE'S WALL SECTION: the typical section on a sheet of its own,
// placed the way + ADD VIEWPORT used to before jb took PROJECT's section
// off the layouts (28 Nov 2026). Returns the sheet.
async function seatOldWallSection(page) {
  const seq = await page.evaluate(() => Number(document.body.dataset.layoutSaveSeq || 0));
  const sheet = await page.evaluate(() => new Promise(done => {
    page._addSheet();
    page.setState({ addingViewport: { kind: 'detail', detail: 'wallsection' } }, () => {
      const r = page._composeRegionIn();
      page._placeViewport({ xIn: r.x + r.w / 2, yIn: r.y + r.h / 2 });
      done(page.state.activeSheet);
    });
  }));
  await page.waitForFunction(prev => Number(document.body.dataset.layoutSaveSeq || 0) > prev, seq);
  return sheet;
}
const reproWith = (floorType, fdnType) => {
  const saved = JSON.parse(JSON.stringify(REPRO));
  delete saved.layout;
  saved.wallTypes = [EXT, FDN];
  saved.walls.forEach(w => {
    if (Number(w.levelId) === 3 && (w.view || 'plan') === 'plan' && floorType) { w.wallType = floorType.id; w.widthIn = 10.4375; }
    if (Number(w.levelId) === 1 && w.view === 'foundation' && fdnType) { w.wallType = fdnType.id; w.widthIn = 12.5; }
  });
  return saved;
};

test('the WALL SECTION sheet names the made type and lists its slices; the foundation pour and its lining apart', async ({ page }) => {
  await openLayout(page, reproWith(EXT, FDN));
  const built = await page.evaluate(() => {
    const ws = page._wallSection();
    return { labels: ws.labels.map(l => l.text) };
  });
  const labels = built.labels;
  expect(labels).toContain('2X6 EXT W/ STONE');
  ['3" LEDGESTONE', '1" AIR GAP', '5 1/2" 2X6 + BATT', '1/2" GYP'].forEach(t => expect(labels, t).toContain(t));
  expect(labels).toContain('8IN CONC + LINING');
  ['3 1/2" 2X4 + BATT', '1/2" AIR SPACE'].forEach(t => expect(labels, t).toContain(t));
  // An old file's sheet still prints in every window (the deal and + ADD
  // VIEWPORT stopped offering it on 28 Nov 2026, jb).
  const sheet = await seatOldWallSection(page);
  const inks = await page.evaluate(sheet => {
    const { canvas } = page._printSheetCanvas(sheet, 72);
    const ctx = canvas.getContext('2d');
    return page.state.viewports.filter(v => v.sheet === sheet).map(v => {
      const r = page._viewportRectIn(v);
      const data = ctx.getImageData(Math.round(r.xIn * 72), Math.round(r.yIn * 72),
        Math.round(r.wIn * 72), Math.round(r.hIn * 72)).data;
      let ink = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i] < 128 && data[i + 3] > 0) ink += 1;
      return [v.detail, ink];
    });
  }, sheet);
  expect(inks.length).toBeGreaterThan(0);
  inks.forEach(([detail, ink]) => expect(ink, `${detail} draws`).toBeGreaterThan(200));
  if (SHOTS) {
    const png = await page.evaluate(sheet => page._printSheetCanvas(sheet, 150).canvas.toDataURL('image/png'), sheet);
    fs.writeFileSync(path.join(SHOTS, '9-wall-section-sheet.png'), Buffer.from(png.split(',')[1], 'base64'));
  }
});

// jb, 25 Nov: two 2 ft gable stubs in a made 1FT WALL beside the house's
// stud walls took the whole WALL SECTION ("1FT WALL / 11 1/4\" WALL"). A
// made type draws only when it is the level's longest run of wall.
test('a few short walls in a made type do not take the WALL SECTION from the stud walls', async ({ page }) => {
  const STUB = { id: 'wt_stub', name: '1FT WALL', kind: 'floor', layers: [
    { name: 'SHEATHING', in: 0.375, fill: 'siding_h' }, { name: 'WALL', in: 11.25, fill: 'lightgrey' },
    { name: 'SHEATHING', in: 0.375, fill: 'white' }] };
  const saved = reproWith(null, null);
  saved.wallTypes = [STUB];
  saved.walls = saved.walls.map(w => (Number(w.levelId) === 3 && (w.view || 'plan') === 'plan'
    ? { ...w, wallType: 'stud_2x6', widthIn: undefined } : w));
  saved.walls.push(
    W('stub1', [0, 0], [2, 0], { wallType: STUB.id, widthIn: 12 }),
    W('stub2', [0, 4], [2, 4], { wallType: STUB.id, widthIn: 12 }));
  await openLayout(page, saved);
  const labels = await page.evaluate(() => page._wallSection().labels.map(l => l.text));
  expect(labels).not.toContain('1FT WALL');
  expect(labels.some(t => /11 1\/4" WALL/.test(t)), labels.join(' | ')).toBe(false);
  // Made the level's main wall, the same type does draw.
  saved.walls = saved.walls.map(w => (Number(w.levelId) === 3 && (w.view || 'plan') === 'plan'
    ? { ...w, wallType: STUB.id, widthIn: 12 } : w));
  await openLayout(page, saved);
  const made = await page.evaluate(() => page._wallSection().labels.map(l => l.text));
  expect(made).toContain('1FT WALL');
});

test('the WALL SECTION draws a line between each slice of the wall, and the lining stands inside the pour', async ({ page }) => {
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  const xs = await page.evaluate(saved => {
    window.DraftWallTypes.adoptDrawing(saved);
    const parts = window.DraftWallSection.buildWallSection(saved).section.parts;
    return parts.filter(p => p.kind === 'line' && Math.abs(p.x1 - p.x2) < 1e-9 && Math.abs(p.y1 - p.y2) > 0.5)
      .map(p => Math.round(p.x1 * 12 * 1000) / 1000);
  }, reproWith(EXT, FDN));
  // The framed wall, from its exterior face (x = 0): 3", 4", 4 7/16",
  // 9 15/16" (the VB has no thickness).
  [3, 4, 4.438, 9.938].forEach(x => expect(xs, `a slice line ${x}" in`).toContain(x));
  // The lining stands inside the 8" pour: 8 1/2", 12", 12 1/2".
  [8.5, 12, 12.5].forEach(x => expect(xs, `a lining line ${x}" in`).toContain(x));
  // The same house in plain walls has none of them.
  const plainXs = await page.evaluate(saved => window.DraftWallSection.buildWallSection(saved).section.parts
    .filter(p => p.kind === 'line' && Math.abs(p.x1 - p.x2) < 1e-9).map(p => Math.round(p.x1 * 12 * 1000) / 1000),
  reproWith(null, null));
  [3, 4, 12.5].forEach(x => expect(plainXs, `no line ${x}" in on plain walls`).not.toContain(x));
});

// ── THE DXF ────────────────────────────────────────────────────────────────
test('the DXF carries a line at every slice face, the hatch on the wall pattern layer', async ({ page }) => {
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  const out = await page.evaluate(() => {
    const saved = { version: 1, levels: [{ id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }],
      wallTypes: [{ id: 'wt_a', name: 'A', kind: 'floor', layers: [{ name: 'S', in: 1, fill: 'siding_h' },
        { name: 'B', in: 4, fill: 'insulation' }, { name: 'G', in: 1, fill: 'white' }] }],
      walls: [{ id: 'a', start: { x: 0, y: 0, z: 0 }, end: { x: 10, y: 0, z: 0 }, levelId: 3, view: 'plan',
        wallType: 'wt_a', widthIn: 6, refLine: 'center', baseHeight: 0, topHeight: 8 }] };
    window.DraftWallTypes.adoptDrawing(saved);
    const rec = window.DraftDxfWriter.recorder({ width: 1e6, height: 1e6, layer: 'A-PLAN' });
    window.DraftLayoutPlan.drawPlan(rec, p => ({ x: 50 + p.x * 40, y: 50 + p.z * 40 }), saved, 3, { view: 'plan' });
    const long = rec.entities.filter(e => e.type === 'poly' && e.layer !== 'A-WALL-PATT'
      && Math.abs(e.pts[1] - e.pts[3]) < 0.01 && Math.abs(e.pts[2] - e.pts[0]) > 300);
    return { faces: long.map(e => Math.round(e.pts[1] * 100) / 100).sort((a, b) => a - b),
      patt: rec.entities.filter(e => e.layer === 'A-WALL-PATT').length };
  });
  // 6" centred on z = 0 at 40 px a foot: faces at -3, -2, +2, +3 inches.
  expect(out.faces).toEqual([40, 43.33, 56.67, 60]);
  expect(out.patt, 'the hatches ride the wall pattern layer, to freeze in CAD').toBeGreaterThan(0);
});

// ── ESTIMATES ──────────────────────────────────────────────────────────────
test('ESTIMATES 6-C: a line per made type in lineal feet, then a line per slice in square feet less openings', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto('/ESTIMATES.html');
  await expect(page.locator('[data-section="6-C"]')).toBeVisible();
  const row = key => page.locator(`[data-row="${key}"]`);
  // Four walls of 16, 12, 16, 12 ft = 56 LF; the foundation the same.
  await expect(row('6-C:wt_ext').locator('[data-qty]')).toHaveText('56 LF');
  await expect(row('6-C:wt_ext')).toContainText('2X6 EXT W/ STONE WALL');
  await expect(row('6-C:wt_fdn').locator('[data-qty]')).toHaveText('56 LF');
  // 56 x 8 = 448 SQ FT gross, less the 4 x 4 window = 432.
  await expect(row('6-C:wt_ext:3').locator('[data-qty]')).toHaveText('432 SQ FT');
  await expect(row('6-C:wt_ext:3')).toContainText('2X6 + BATT');
  await expect(row('6-C:wt_ext:5')).toContainText('GYP');
  await expect(row('6-C:wt_fdn:2').locator('[data-qty]')).toHaveText('448 SQ FT');
  expect(await page.locator('[data-section="6-C"] [data-row]').count(), '2 type lines + 6 + 5 slice lines').toBe(13);
  // A price on a slice line totals it.
  await row('6-C:wt_ext:5').locator('[data-price]').fill('2');
  await row('6-C:wt_ext:5').locator('[data-price]').press('Tab');
  await expect(row('6-C:wt_ext:5')).toContainText('864');
  if (SHOTS) await page.locator('[data-section="6-C"]').screenshot({ path: path.join(SHOTS, '10-estimates-6c.png') });
});
