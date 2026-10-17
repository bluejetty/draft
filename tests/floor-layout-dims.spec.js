// THE FLOOR LAYOUT'S DIMENSIONS (Movie, 16 Oct, marked up in GIMP on the 2ND
// FL FLOOR LAYOUT): a string along the beam from the exterior wall to each
// column and on to the far wall; the stair opening's dimensions OUTSIDE the
// plan when the opening is within 3 ft of the exterior wall's outside
// perimeter line, INSIDE when farther; the FLUSH/DROPPED BEAM note and the
// beam's string on OPPOSITE sides of the beam, one note for a beam laid in
// pieces; and the FLOOR layouts dimension the FLOOR only, not out to the
// garage.
//
// THE ARITHMETIC IS THE MODULES' -- auto-dims.js computeColumnDimStrings
// (proto/dim-layers-harness.js) and render-2d.js beamTagSides
// (proto/render-2d-harness.js), each with its mutation rows. What this pins
// is the pages' link to them: that AUTO DIMS on a FLOOR view hands the
// column module the perimeter stack and keeps the garage out of the
// exterior strings, that MODEL paints the tag where the string is not, and
// that the LAYOUT floor sheet, which borrows the storey under's beams and
// rows, paints it the same way.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const point = (x, z) => ({ x, y: 0, z });
const rect = (x0, z0, x1, z1) => [point(x0, z0), point(x1, z0), point(x1, z1), point(x0, z1)];

// A 24 x 30 HOUSE WITH A 20 x 20 GARAGE ON ITS EAST SIDE, two storeys. The
// main floor's beam runs east-west at z 22 in two pieces, on two posts; the
// stairwell (x 8..11, z 24..28) is cut in both decks, 2 ft short of the
// south wall and 2 ft past the beam -- which puts its across string OUTSIDE
// the south wall and the beam's string on the beam's north side.
const HOUSE = rect(0, 0, 24, 30);
const GARAGE = rect(24, 0, 44, 20);
const WELL = [point(8, 24), point(11, 24), point(11, 28), point(8, 28)];
const wallsOf = (levelId, startId, pts) => pts.map((pt, i) => ({
  id: startId + i, start: pt, end: pts[(i + 1) % pts.length], levelId, view: 'plan',
  wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
}));
const fixture = () => ({
  version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 },
    { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 },
    { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 },
  ],
  activeLevelIdx: 3,
  walls: [...wallsOf(3, 100, HOUSE), ...wallsOf(3, 110, GARAGE), ...wallsOf(5, 200, HOUSE)],
  lines: [], roofs: [], fenestrations: [], dimensions: [], shapes: [], stairs: [], notes: [],
  roomTags: [], boneyardOutlines: [], boneyardShelves: [], groups: [], levelLocks: [], underlays: [],
  outlines: [
    { id: 1, levelId: 3, points: HOUSE, garage: false },
    { id: 2, levelId: 3, points: GARAGE, garage: true },
    { id: 3, levelId: 5, points: HOUSE, garage: false },
  ],
  floors: [
    { id: 'deck-3', levelId: 3, view: 'floor', structure: 'floor', points: HOUSE },
    { id: 'deck-5', levelId: 5, view: 'floor', structure: 'floor', points: HOUSE },
  ],
  surfaceOpenings: [
    { id: 'well-3', levelId: 3, hostType: 'floor', hostId: 'deck-3', points: WELL },
    { id: 'well-5', levelId: 5, hostType: 'floor', hostId: 'deck-5', points: WELL },
  ],
  beams: [
    { id: 1, start: point(0.5, 22), end: point(10, 22), levelId: 3, view: 'floor', mode: 'flush' },
    { id: 2, start: point(10, 22), end: point(23.5, 22), levelId: 3, view: 'floor', mode: 'flush' },
  ],
  columns: [
    { id: 1, point: point(10, 22), levelId: 3, view: 'floor', footing: 'pad36' },
    { id: 2, point: point(16, 22), levelId: 3, view: 'floor', footing: 'pad36' },
  ],
});

async function openModel(page, file) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  await page.goto('/MODEL.html?left=1&right=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

// EVERY BEAM TAG THE PAGE WRITES, with the side it was written on: the
// helper writes the text at -offset in the beam's own rotated frame (above a
// level beam), so a +y here is the tag on the beam's other side. Each
// canvas's clearRect marks the start of a paint, so the LAST paint can be
// read on its own.
const spyTags = page => page.evaluate(() => {
  const proto = CanvasRenderingContext2D.prototype;
  window.__tape = [];
  const fillText = proto.fillText;
  proto.fillText = function (text, x, y, ...rest) {
    if (/^(FLUSH|DROPPED) BEAM/.test(String(text))) {
      window.__tape.push({ op: 'tag', canvas: this.canvas && this.canvas.id, text, y, baseline: this.textBaseline });
    }
    return fillText.call(this, text, x, y, ...rest);
  };
  const clearRect = proto.clearRect;
  proto.clearRect = function (...args) {
    window.__tape.push({ op: 'clear', canvas: this.canvas && this.canvas.id });
    return clearRect.apply(this, args);
  };
});
const lastPaintTags = page => page.evaluate(() => {
  const tape = window.__tape || [];
  const tagged = tape.filter(e => e.op === 'tag');
  if (!tagged.length) return [];
  const canvas = tagged[tagged.length - 1].canvas;
  const mine = tape.filter(e => e.canvas === canvas);
  let start = 0;
  mine.forEach((e, i) => { if (e.op === 'clear') start = i; });
  return mine.slice(start).filter(e => e.op === 'tag');
});

const armDimension = async page => {
  await page.locator('[data-tool-key="dimension"]').click();
  await page.waitForTimeout(150);
};
async function autoDimsOn(page, levelId, view) {
  await h.pickModelLayer(page, levelId, view);
  await page.waitForTimeout(150);
  await page.locator('[data-auto-dims]').click();
  await page.waitForTimeout(250);
}
async function saveNow(page) {
  await expect(page.locator('#save')).toBeEnabled({ timeout: 4000 });
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
}
const savedFile = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return file ? JSON.parse(await file.text()) : null;
}, BUCKET);

const on = (dims, levelId, view, layer) => (dims || []).filter(d => d.auto === true
  && Number(d.levelId) === levelId && d.view === view && (!layer || d.layer === layer));
const level = segs => segs.filter(s => Math.abs(s.start.z - s.end.z) < 0.01);
const xsOf = segs => [...new Set(segs.flatMap(s => [s.start.x, s.end.x]).map(v => Math.round(v * 100) / 100))].sort((a, b) => a - b);

test('the stair opening is strung OUTSIDE the plan when it is within 3 ft of the wall, past the stack', async ({ page }) => {
  await openModel(page, fixture());
  await armDimension(page);
  await autoDimsOn(page, 3, 'floor');
  await autoDimsOn(page, 5, 'floor');
  await saveNow(page);
  const saved = await savedFile(page);
  for (const levelId of [3, 5]) {
    const well = level(on(saved.dimensions, levelId, 'floor', 'A-DIMS-INT'));
    expect(well.length, `level ${levelId}: the opening's across string`).toBe(3);
    // "the stair opening's dims OUTSIDE the plan when the opening is within
    // 3 ft of the exterior wall's outside perimeter line": 2 ft short of
    // the south wall (z 30), so past it, and past every perimeter row
    // already outside on that side.
    const rows = level(on(saved.dimensions, levelId, 'floor')).filter(s => s.layer !== 'A-DIMS-INT'
      && s.start.z > 30.01).map(s => s.start.z);
    well.forEach(s => {
      expect(s.start.z, `level ${levelId}: outside the south wall`).toBeGreaterThan(30);
      rows.forEach(at => expect(s.start.z, `level ${levelId}: past the row at ${at}`).toBeGreaterThan(at));
    });
    expect(xsOf(well), `level ${levelId}: wall, opening, opening, wall`).toEqual([0, 8, 11, 24]);
  }
});

test('a FLOOR layout dimensions the floor only, not out to the garage', async ({ page }) => {
  await openModel(page, fixture());
  await armDimension(page);
  await autoDimsOn(page, 3, 'plan');
  await autoDimsOn(page, 3, 'floor');
  await saveNow(page);
  const saved = await savedFile(page);
  const reach = segs => Math.max(...segs.flatMap(s => [s.start.x, s.end.x]));
  const plan = level(on(saved.dimensions, 3, 'plan', 'A-DIMS-OVR'));
  const floor = level(on(saved.dimensions, 3, 'floor', 'A-DIMS-OVR'));
  expect(plan.length).toBeGreaterThan(0);
  expect(floor.length).toBeGreaterThan(0);
  expect(reach(plan), 'the walls plan still strings the whole building').toBeCloseTo(44, 1);
  expect(reach(floor), 'the floor layout stops at the floor').toBeCloseTo(24, 1);
  // AND THE BEAM'S STRING: from the exterior wall to each column and on to
  // the far wall, on the side of the beam the stairwell is not.
  const along = level(on(saved.dimensions, 3, 'floor', 'A-DIMS-COLS')).filter(s => Math.abs(s.start.z - 21) < 0.01);
  expect(xsOf(along), 'wall, post, post, wall').toEqual([0, 10, 16, 24]);
});

test('the FLUSH BEAM note goes on the side opposite the string, once per beam line', async ({ page }) => {
  await openModel(page, fixture());
  await armDimension(page);
  await spyTags(page);
  await autoDimsOn(page, 3, 'floor');
  const box = await page.locator('#plan').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -1);
  await page.waitForTimeout(300);
  const tags = await lastPaintTags(page);
  // The string sits north of the beam (z 21, away from the well), so the
  // note goes SOUTH: written at +offset in the beam's frame, hung from its
  // top. And the two pieces of the one line share one note.
  expect(tags.map(t => t.text), 'one note for the two pieces').toEqual(['FLUSH BEAM']);
  expect(tags[0].y, 'on the other side of the beam from the string').toBeGreaterThan(0);
  expect(tags[0].baseline).toBe('top');
  await saveNow(page);

  // THE LAYOUT SHEET PAINTS IT THE SAME WAY. The 2ND FLOOR sheet borrows
  // the main floor's beams and their rows (layout-plan structureUnder).
  const saved = await savedFile(page);
  // THE SHEETS ARE DEALT FRESH: the composer deals only a file that asks.
  saved.layout = { auto: true };
  await page.addInitScript(() => {
    if (sessionStorage.getItem('draft-test-storage-cleared')) return;
    sessionStorage.setItem('draft-test-storage-cleared', '1');
    localStorage.clear();
  });
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'model-drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: saved });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.waitForFunction(() => Number(document.body.dataset.layoutSaveSeq || 0) > 0
    && document.body.dataset.layoutSaveDirty !== '1');
  const layout = await page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    return file ? JSON.parse(await file.text()).layout : null;
  }, BUCKET);
  const sheet = layout.sheets.findIndex(s => s.title === '2ND FLOOR') + 1;
  expect(sheet, 'the 2ND FLOOR sheet was dealt').toBeGreaterThan(0);
  await spyTags(page);
  await page.locator(`[data-layout-sheet="${sheet}"]`).click();
  await page.waitForTimeout(400);
  const onSheet = await lastPaintTags(page);
  expect(onSheet.map(t => t.text), 'one note on the sheet too').toEqual(['FLUSH BEAM']);
  expect(onSheet[0].y, 'and on the same side of the beam').toBeGreaterThan(0);
});
