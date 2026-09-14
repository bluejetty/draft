// PLACING A BEAM AND A COLUMN — #392's other half.
//
// THE FIRST CHECK IS THE ROUND TRIP, and that is not the usual ordering out of
// tidiness. drawing-format.js:512 and :549 read a column's and a beam's id
// with `Number(id)` and drop the record when it is not an integer. The page's
// own allocator, newDrawingItemId, returns the STRING "column-7" -- which is
// what commitWall uses and what walls accept. So a placement written the
// obvious way puts a column on the canvas, saves a file that looks correct,
// and loses it on the next load, with no error at either end. Measured before
// any of this was built:
//
//   F.columns([{ id: 'column-7', point, levelId: 3, view: 'plan' }])  ->  []
//   F.columns([{ id: 7,          point, levelId: 3, view: 'plan' }])  ->  [ ... ]
//
// A check that asserts "a column appeared" passes straight through that. Only
// place -> save -> reload sees it, so that is the first thing written here and
// the first thing every other check in the file leans on.
//
// DRAFTING THROUGHOUT. §6 puts COLUMN and BEAM down on the TOY board, so the
// board these gestures live on is the only one they can be tested on.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });

const base = extra => ({
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  board: 'drafting',
  walls: [
    ['n', V(-10, -10), V(10, -10)], ['e', V(10, -10), V(10, 10)],
    ['s', V(10, 10), V(-10, 10)], ['w', V(-10, 10), V(-10, -10)],
  ].map(([id, start, end]) => ({ id, start, end, levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' })),
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
  ...extra,
});

async function open(page, file) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  // ?left=1 for the tool column: COLUMN and BEAM have no legacy button, so the
  // key in the rail is the only way to arm them.
  await page.goto('/MODEL.html?left=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect(page.locator('[data-tool-key="column"]')).toBeVisible();
}

const stored = page => page.evaluate(async bucket => {
  const f = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await f.text());
}, BUCKET);

async function frame(page) {
  const box = await page.locator('#plan').boundingBox();
  const scale = await page.evaluate(() => Number(
    /scale ([\d.]+) px\/ft/.exec(document.getElementById('readout').textContent)[1]));
  return { at: (x, z) => [box.x + box.width / 2 + x * scale,
    box.y + box.height / 2 + z * scale] };
}

async function save(page) {
  await page.locator('#save').click();
  await page.waitForTimeout(400);
}

// THE READ THAT MATTERS: not what the page is holding, but what a fresh load
// of the saved file keeps. window.DraftDrawingFormat is the same normaliser
// the page runs on load, so this asks the question the reload asks.
const survives = page => page.evaluate(async bucket => {
  const f = await window.SharedFileStore.loadSharedFile(bucket);
  const raw = JSON.parse(await f.text());
  const F = window.DraftDrawingFormat;
  const levelIds = new Set((raw.levels || []).map(l => Number(l.id)));
  return {
    columns: F.columns(raw.columns, levelIds).length,
    beams: F.beams(raw.beams, levelIds).length,
    rawColumns: (raw.columns || []).length,
    rawBeams: (raw.beams || []).length,
  };
}, BUCKET);

test('a placed column survives save and reload', async ({ page }) => {
  await open(page, base({}));
  const { at } = await frame(page);
  await page.locator('[data-tool-key="column"]').click();
  await page.mouse.click(...at(2, 3));
  await page.waitForTimeout(120);
  await save(page);

  const s = await survives(page);
  expect(s.rawColumns, 'the page wrote a column').toBe(1);
  // THE HALF THAT CATCHES THE ID TYPE. A string id gets written and then
  // dropped by the reader, so rawColumns is 1 and columns is 0.
  expect(s.columns, 'and a reload keeps it').toBe(1);
});

test('a placed beam survives save and reload', async ({ page }) => {
  await open(page, base({}));
  const { at } = await frame(page);
  await page.locator('[data-tool-key="beam"]').click();
  await page.mouse.click(...at(-6, 2));
  await page.waitForTimeout(80);
  await page.mouse.click(...at(6, 2));
  await page.waitForTimeout(120);
  await save(page);

  const s = await survives(page);
  expect(s.rawBeams, 'the page wrote a beam').toBe(1);
  expect(s.beams, 'and a reload keeps it').toBe(1);
});

test('two columns get two ids, not one id twice', async ({ page }) => {
  // The format dedupes on id: a second column carrying the first one's id is
  // dropped on load, so an allocator that returns a constant would pass the
  // round trip above and lose every column after the first.
  await open(page, base({}));
  const { at } = await frame(page);
  await page.locator('[data-tool-key="column"]').click();
  await page.mouse.click(...at(2, 3));
  await page.waitForTimeout(80);
  await page.mouse.click(...at(-2, -3));
  await page.waitForTimeout(120);
  await save(page);
  expect((await survives(page)).columns, 'both survive the reload').toBe(2);
});

test('a beam of no length is not written at all', async ({ page }) => {
  // The format drops a beam shorter than 0.001, so a double-click would write
  // a record that vanishes on load -- the same silent loss as the id, by a
  // different route. The page must refuse it rather than write it.
  //
  // THIS ONE PASSED ON THE RED RUN, and that is not good news. With no
  // placement gesture built, nothing is written for any gesture, so "nothing
  // was written" was true for a reason that has nothing to do with the rule.
  // It only starts meaning something once the other three are green -- noted
  // here because a check that passes before its feature exists is the same
  // shape as a check whose broken state looks like its passing state, and the
  // mutation gate is the only thing that will tell the difference.
  await open(page, base({}));
  const { at } = await frame(page);
  await page.locator('[data-tool-key="beam"]').click();
  await page.mouse.click(...at(2, 2));
  await page.waitForTimeout(80);
  await page.mouse.click(...at(2, 2));
  await page.waitForTimeout(120);
  await save(page);
  const s = await survives(page);
  expect(s.rawBeams, 'nothing was written').toBe(0);
  expect(s.beams).toBe(0);
});
