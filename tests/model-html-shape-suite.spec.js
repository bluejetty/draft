// SHAPE, and the SECONDARY SUITE it can mark.
//
// Movie, 1 Oct: "a SUITE area will be a 2ndary suite that needs to be measure
// ... the user will need to determine the area by outlining the location of
// the suite (make a shape and use that shape for the area)", and "the suite
// will have its own AREA marker like MAIN FL, 2ND FL, FOUNDATION". The SHAPE
// key sat in the column doing nothing; it draws now, and a shape can be
// ticked as the suite.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3;

const wall = (id, x0, z0, x1, z1) => ({
  id, levelId: MAIN_FL, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 8, start: { x: x0, y: 0, z: z0 }, end: { x: x1, y: 0, z: z1 },
});
const HOUSE = (extra = {}) => ({
  format: 'draft-drawing', version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: MAIN_FL, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -10 },
  ],
  walls: [
    wall('w-n', -10, -8, 10, -8), wall('w-e', 10, -8, 10, 8),
    wall('w-s', 10, 8, -10, 8), wall('w-w', -10, 8, -10, -8),
  ],
  floors: [], lines: [], dimensions: [], shapes: [], outlines: [], notes: [], fenestrations: [],
  roomTags: [],
  board: 'drafting',
  ...extra,
});

async function open(page, saved = HOUSE()) {
  await page.goto('/MODEL.dc.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved });
  await page.goto(`/MODEL.html?mode=night&level=${MAIN_FL}`);
  await expect(page.locator('#readout')).toContainText('scale', { timeout: 10000 });
}

const stored = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await file.text());
}, BUCKET);

async function save(page) {
  await page.locator('[data-model-save]').click();
  await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });
  return stored(page);
}

// World -> page pixels off the readout's published scale; every level's
// drawing is centred on the origin, so world (0, 0) is the canvas centre.
async function worldToPage(page, x, z) {
  const hit = (await page.locator('#readout').textContent()).match(/scale ([\d.]+) px\/ft/);
  expect(hit, 'the readout publishes the scale').toBeTruthy();
  const scale = Number(hit[1]);
  const box = await page.locator('#plan').boundingBox();
  return { px: box.x + box.width / 2 + x * scale, py: box.y + box.height / 2 + z * scale, scale };
}
async function tapWorld(page, x, z) {
  const { px, py } = await worldToPage(page, x, z);
  const under = await page.evaluate(({ px, py }) => document.elementFromPoint(px, py)?.id, { px, py });
  expect(under, `world (${x}, ${z}) must land on the canvas`).toBe('plan');
  await page.mouse.click(px, py);
  await page.waitForTimeout(60);
}


// A 12 x 10 box, corner by corner, closed on the first corner.
async function drawBox(page, x0, z0, x1, z1) {
  await h.armFromRail(page, 'shape');
  for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]]) {
    await tapWorld(page, x, z);
  }
}

test('SHAPE draws a closed outline, selected, with its area in PROPERTIES', async ({ page }) => {
  await open(page);
  await drawBox(page, -6, -5, 6, 5);
  await expect(page.locator('#props-slot [data-prop-span]')).toHaveText(/AREA 120 SQ FT/);
  const saved = await save(page);
  expect(saved.shapes).toHaveLength(1);
  expect(saved.shapes[0].levelId).toBe(MAIN_FL);
  expect(saved.shapes[0].points).toHaveLength(4);
});

test('SECONDARY SUITE ticks on and off, and UNDO takes the tick back', async ({ page }) => {
  await open(page);
  await drawBox(page, -6, -5, 6, 5);
  const suite = page.locator('[data-shape-suite]');
  await expect(suite).toHaveAttribute('aria-pressed', 'false');
  await suite.click();
  await expect(page.locator('[data-shape-suite]')).toHaveAttribute('aria-pressed', 'true');
  let saved = await save(page);
  expect(saved.shapes[0].suite).toBe(true);
  await page.locator('[data-model-undo]').click();
  saved = await save(page);
  expect('suite' in saved.shapes[0], 'undo took the tick back').toBe(false);
});

test('a crossed shape is refused and its corners kept', async ({ page }) => {
  await open(page);
  await h.armFromRail(page, 'shape');
  for (const [x, z] of [[-6, -5], [6, 5], [6, -5], [-6, 5], [-6, -5]]) await tapWorld(page, x, z);
  await expect(page.locator('#strip-message')).toContainText('crosses itself');
  expect((await save(page)).shapes || []).toEqual([]);
});

test('the Real Estate area box lists the suite under the floor it is on', async ({ page }) => {
  const REPRO = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'proto', 'repro-movie-bands.draft'), 'utf8'));
  const square = (x, z, s) => [{ x, z }, { x: x + s, z }, { x: x + s, z: z + s }, { x, z: z + s }];
  const saved = {
    ...REPRO,
    shapes: [
      { id: 'shape-1', levelId: 1, points: square(0, 0, 20), suite: true, layer: 'SHAPE' },
      { id: 'shape-2', levelId: 5, points: square(0, 0, 10), suite: true, layer: 'SHAPE' },
      { id: 'shape-3', levelId: 3, points: square(0, 0, 10), layer: 'SHAPE' },
    ],
  };
  await h.suppressEntryCoach(page);
  await page.goto('/REALESTATEPLAN.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 15000 });
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: h.STORAGE_BUCKET, saved });
  await page.goto('/REALESTATEPLAN.html');
  await page.waitForFunction(() => Array.isArray(window.__rpAreas) && window.__rpAreas.length > 0,
    null, { timeout: 15000 });
  const rows = await page.evaluate(() => window.__rpAreas);
  expect(rows).toEqual([
    expect.stringMatching(/^2ND FL [\d,]+ SQ FT$/),
    '  SUITE (2ND FL) 100 SQ FT',
    expect.stringMatching(/^MAIN FL [\d,]+ SQ FT$/),
    expect.stringMatching(/^TOTAL HOUSE [\d,]+ SQ FT$/),
    expect.stringMatching(/^FOUNDATION [\d,]+ SQ FT$/),
    '  SUITE (FOUNDATION) 400 SQ FT',
  ]);
});
