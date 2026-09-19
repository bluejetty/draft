// AUTO DIMS ON THE NEW PAGE — the strings a built house arrives with.
//
// Movie, 19 Sep: "we will need to get the autodimensioning from the
// model.dc.html too". Almost none of it was ported: auto-dims.js was already
// extracted pure out of the old page -- plain data in, segments out, no THREE
// and no DOM -- and had exactly one caller. MODEL.html is the second, and it
// hands the same function the same arguments. What is new here is the shell
// the module deliberately does not own: filtering the collections, resolving
// opening centres, allocating ids, and writing the records.
//
// SO THIS FILE DOES NOT CHECK THE STRING ARITHMETIC. That belongs to the
// module and to whatever tests it. What is checked here is everything between
// the module and the file: that a press dimensions every level it built on,
// that the records survive a reload, that ids cannot collide, that re-running
// replaces its own strings and nothing else, and that one Ctrl+Z takes them
// back with the building.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';

// THE WHOLE LEVEL STACK. A build files records across the levels, and
// drawing-format.js drops any record whose levelId the drawing does not list
// -- so a fixture missing a level would write dimensions the next open loses,
// and every count below would measure the page's memory rather than the file.
const empty = (extra = {}) => ({
  version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 },
    { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 },
    { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 },
  ],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
  ...extra,
});

async function open(page, file = empty()) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

async function order(page, family, entry) {
  await h.openDriveThru(page);
  await page.locator(`[data-build-family="${family}"]`).click();
  await page.locator(`[data-build-entry="${entry}"]`).click();
  await page.locator('#dt-bone').click();
  await page.waitForTimeout(300);
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

const byLevelView = dims => (dims || []).reduce((tally, d) => {
  const key = `${d.levelId}:${d.view}`;
  tally[key] = (tally[key] || 0) + 1;
  return tally;
}, {});

test('a built house arrives dimensioned, on every level it was built on',
  async ({ page }) => {
    await open(page);
    await order(page, 'bungalow', 'bungalow-garage');
    await saveNow(page);
    const saved = await savedFile(page);

    const tally = byLevelView(saved.dimensions);
    // THE LEVELS THE PRESS ACTUALLY TOUCHED, and each on the view its own
    // geometry went to: the storey's walls are on the plan, the concrete on
    // the foundation set, the roofs on the ROOF level's plan. A string filed
    // against the view the drafter happened to be standing in would be
    // invisible on the plan it measures.
    expect(Object.keys(tally).sort(), 'a level with geometry was left unmeasured')
      .toEqual(['1:foundation', '3:plan', '7:plan']);
    Object.entries(tally).forEach(([key, count]) => {
      expect(count, `${key} got a string stack with nothing in it`).toBeGreaterThan(0);
    });

    // AND NOTHING ON A LEVEL THAT GOT NOTHING. 2ND FL is in the stack and a
    // bungalow does not use it, so dimensions there would be strings around
    // an empty sheet.
    expect(tally['5:plan'], 'an empty level was dimensioned').toBe(undefined);

    // EVERY ONE OF THEM SURVIVES THE RELOAD. This page has no serializer
    // between the push and the file, so what it wrote and what a reload keeps
    // must be the same -- and drawing-format.js refuses a dimension whose id
    // is not an integer, which is not this page's usual kind of id.
    const kept = await page.evaluate(async bucket => {
      const file = await window.SharedFileStore.loadSharedFile(bucket);
      const raw = JSON.parse(await file.text());
      const F = window.DraftDrawingFormat;
      const levelIds = new Set((raw.levels || []).map(l => Number(l.id)));
      const back = F.dimensions(raw.dimensions, levelIds, {});
      return { wrote: (raw.dimensions || []).length, keeps: back.length,
        auto: back.filter(d => d.auto === true).length };
    }, BUCKET);
    expect(kept.keeps, 'dimensions were written that the reload loses').toBe(kept.wrote);
    expect(kept.auto, 'and every one came back marked generated').toBe(kept.wrote);
  });

test('the ids are integers, unique, and cannot land on one already in the file',
  async ({ page }) => {
    // THE COLLISION IS THE POINT. Walls wear `wall-3`; a dimension must carry
    // an integer or the loader drops it. The counter is the old page's
    // `nextDimensionId`, and a file can arrive with dimensions and NO counter
    // -- hand-edited, or written by something older than the key. Trusting
    // the counter alone then starts at 1 and overwrites what is already there.
    const withDims = empty({
      nextDimensionId: undefined,
      dimensions: [
        { id: 500, start: { x: -60, y: 0, z: -60 }, end: { x: -40, y: 0, z: -60 },
          levelId: 3, view: 'plan' },
      ],
    });
    delete withDims.nextDimensionId;
    await open(page, withDims);
    await order(page, 'bungalow', 'bungalow');
    await saveNow(page);
    const saved = await savedFile(page);

    const ids = (saved.dimensions || []).map(d => d.id);
    expect(ids.every(Number.isInteger), 'a dimension carried a non-integer id').toBe(true);
    expect(new Set(ids).size, 'two dimensions share an id').toBe(ids.length);
    // THE ONE THAT WAS ALREADY THERE IS STILL THERE, unchanged and unclaimed.
    expect(ids).toContain(500);
    const generated = (saved.dimensions || []).filter(d => d.auto === true);
    expect(generated.length, 'the press placed nothing').toBeGreaterThan(0);
    expect(generated.every(d => d.id > 500),
      'a generated id landed on or below one the file already held').toBe(true);
  });

test('a hand-drawn dimension survives a rebuild; the generated ones are replaced',
  async ({ page }) => {
    // `auto: true` IS THE WHOLE SEPARATION. A drafter's own dimension must
    // outlive a re-press, and the generated strings must not pile up one stack
    // on top of another every time the bone is pressed.
    const mine = {
      id: 900, start: { x: -60, y: 0, z: -60 }, end: { x: -40, y: 0, z: -60 },
      levelId: 3, view: 'plan',
    };
    await open(page, empty({ dimensions: [mine] }));
    await order(page, 'bungalow', 'bungalow');
    await saveNow(page);
    const once = await savedFile(page);
    const firstAuto = (once.dimensions || []).filter(d => d.auto === true).length;
    expect(firstAuto, 'the first press placed nothing').toBeGreaterThan(0);

    // PRESSED AGAIN on the same drawing. The one-house cap refuses a second
    // building, so this is the honest way to re-run the strings: undo the
    // build and press again, which is what a drafter correcting a design does.
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    await order(page, 'bungalow', 'bungalow');
    await saveNow(page);
    const twice = await savedFile(page);

    const secondAuto = (twice.dimensions || []).filter(d => d.auto === true).length;
    expect(secondAuto, 'the strings piled up instead of replacing').toBe(firstAuto);
    // AND MINE IS UNTOUCHED, by id and by both its ends.
    const kept = (twice.dimensions || []).find(d => d.id === 900);
    expect(kept, 'a hand-drawn dimension was swept away by the rebuild').toBeTruthy();
    expect([kept.start.x, kept.start.z, kept.end.x, kept.end.z])
      .toEqual([mine.start.x, mine.start.z, mine.end.x, mine.end.z]);
    expect(kept.auto, 'and it was not quietly marked generated').not.toBe(true);
  });

test('one Ctrl+Z takes the dimensions back with the building', async ({ page }) => {
  // ONE PRESS, ONE UNDO. Left out of the undo step, the strings would stay
  // behind measuring a house that is no longer there -- and on the next press
  // they would be replaced anyway, so the drafter would never see the stale
  // ones long enough to report them.
  await open(page);
  await order(page, 'bungalow', 'bungalow-garage');
  await saveNow(page);
  const built = await savedFile(page);
  expect((built.dimensions || []).length, 'nothing was placed to undo')
    .toBeGreaterThan(0);

  await page.keyboard.press('Control+z');
  await page.waitForTimeout(250);
  await saveNow(page);
  const after = await savedFile(page);

  expect((after.dimensions || []).length, 'the strings outlived the house').toBe(0);
  // THE CONTROL: the building went too, so this is one undo taking the whole
  // press rather than an undo that happened to take only the dimensions.
  expect((after.walls || []).length, 'the building survived its own undo').toBe(0);
  expect((after.outlines || []).length).toBe(0);
});

test('the tuning comes from the module, not from a copy in the page',
  async ({ page }) => {
    // auto-dims.js owns STRING_SPACING_FT and JOG_MERGE_FT now: each had
    // exactly one use on the old page and lived at the top of it, which is a
    // number kept away from the thing it tunes. This asserts the page reads
    // them from there -- measured by MOVING the module's number and watching
    // the strings move, because a page holding its own copy would not care.
    await open(page);
    await order(page, 'bungalow', 'bungalow');
    await saveNow(page);
    const normal = await savedFile(page);

    const spread = dims => {
      const plan = (dims || []).filter(d => Number(d.levelId) === 3);
      const zs = plan.flatMap(d => [d.start.z, d.end.z]);
      return Math.max(...zs) - Math.min(...zs);
    };
    const before = spread(normal.dimensions);
    expect(before, 'the plan has a stack with some depth to it').toBeGreaterThan(1);

    // The module is the only thing changed, and only in this page's memory.
    await page.evaluate(() => {
      const AD = window.DraftAutoDims;
      window.DraftAutoDims = Object.freeze({
        computeAutoDimStrings: AD.computeAutoDimStrings,
        STRING_SPACING_FT: AD.STRING_SPACING_FT * 3,
        JOG_MERGE_FT: AD.JOG_MERGE_FT,
      });
    });
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    await order(page, 'bungalow', 'bungalow');
    await saveNow(page);
    const widened = await savedFile(page);

    expect(spread(widened.dimensions),
      'the page ignored the module and used a spacing of its own')
      .toBeGreaterThan(before + 0.5);
  });
