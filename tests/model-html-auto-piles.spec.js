// AUTO PILES — what a garage's grade beam stands on.
//
// Movie, 25 Sep: "the piles for the Garage were AUTO-PILES ... when a garage
// is created from 'OUTLINE' this should be used to add the piles when grade
// beam is selected for attached or detached garage" ... "i pile per corner and
// then 1 every 9ft or less" ... "(even them out if its less than 9ft" ... "the
// pile should be located in the center of the wall" ... "place a P2 for garage
// as DEFAULT pile type".
//
// WHAT WAS THERE: NOTHING. raiseGarageConcrete built the beam walls and the
// slab and called footingRings only for a FROST WALL, so a grade-beam garage
// -- the default since 24 Sep -- hung on nothing at all.
//
// AND THE OLD PAGE DID NOT HAVE THIS EITHER, which is worth writing down so
// nobody goes looking for the port. MODEL.dc.html:23740's own BUILD HOUSE hint
// says it placed "10"ø piles at the two beam corners against the house (COLUMN
// or COPY places the rest along the beam)": two piles and a note telling the
// drafter to finish the job. tests/garage-piles.spec.js covers that behaviour
// -- on /MODEL.dc.html, the page the app cannot reach.
//
// THE SPACING ARITHMETIC IS NOT CHECKED HERE. That is pilePoints' and
// proto/auto-piles-harness.js pins it at twenty checks, including every case
// where the PACKED answer (9 then a stub) differs from the EVENED one. What is
// checked here is the wiring: which loop, which level and view, which mark,
// that the beam sweep leaves them alone, and that a re-run replaces its own.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';

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

// A DETACHED GARAGE: its own loop, no house to share an edge with, so every
// leg carries beam and every leg carries piles. 24 x 24 makes the arithmetic
// plain -- ceil(24/9) = 3 spans of 8 -- and the inset makes it 22.667 a side,
// which is still 3 spans, so the count does not depend on the rounding.
const garage = ({ id = 'outline-garage', x = 0, z = 0, w = 24, d = 24,
  detached = true, foundation = 'gradebeam' } = {}) => ({
  id, levelId: 3, garage: true, detached, foundation,
  points: [{ x, y: 0, z }, { x: x + w, y: 0, z },
    { x: x + w, y: 0, z: z + d }, { x, y: 0, z: z + d }],
});

async function open(page, file = empty()) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  await page.goto('/MODEL.html?left=1&right=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

async function armTool(page, id) {
  await page.locator('[data-board-switch] [data-board="drafting"]').click();
  await page.waitForTimeout(150);
  await page.locator(`[data-tool-key="${id}"]`).click();
  await page.waitForTimeout(150);
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

const pilesOf = saved => (saved.columns || [])
  .filter(column => String(column.footing || '').startsWith('pile'));
const padsOf = saved => (saved.columns || [])
  .filter(column => !String(column.footing || '').startsWith('pile'));

const button = page => page.locator('[data-auto-piles]');

test('a built garage arrives on its piles, marked and on the foundation',
  async ({ page }) => {
    await open(page);
    await h.openDriveThru(page);
    await page.locator('[data-build-family="bungalow"]').click();
    await page.locator('[data-build-entry="bungalow-garage"]').click();
    await page.locator('#dt-bone').click();
    await page.waitForTimeout(500);
    await saveNow(page);
    const saved = await savedFile(page);

    const piles = pilesOf(saved);
    expect(piles.length, 'the garage was built and left standing on nothing')
      .toBeGreaterThan(0);
    piles.forEach(pile => {
      expect(pile.levelId, 'a pile filed off the foundation').toBe(1);
      expect(pile.view, 'a pile filed on a view that does not draw it')
        .toBe('foundation');
      // P2 IS THE 12" ROW (spec-master.js:202), so the drawn diameter and the
      // schedule mark have to be the same answer. A pile10 marked P2 would put
      // two numbers on one hole.
      expect(pile.pileMark, 'the pile carries no schedule mark').toBe('P2');
      expect(pile.footing, 'the drawn diameter disagrees with the mark')
        .toBe('pile12');
      expect(pile.auto, 'a generated pile came back unmarked, so a re-run '
        + 'could not sweep it').toBe(true);
    });

    // AND THE BEAM'S OWN TELEPOSTS SURVIVED. placeAutoBeam sweeps every auto
    // column on this level and view before laying fresh ones, and it runs
    // AFTER the garage is poured in the same press -- so without its pile
    // exception (MODEL.dc.html:4826, ported late) this count is zero and the
    // garage is back on nothing with nothing said.
    expect(padsOf(saved).length, 'the beam swept the piles it runs beside')
      .toBeGreaterThan(0);
  });

test('the piles ride the beam centreline, not the outline', async ({ page }) => {
  // "the pile should be located in the center of the wall". An outline is a
  // wall FACE -- footingRings offsets from 0 and -(wallFt + projFt), so the
  // concrete hangs inboard -- and concrete_8 is 8", so the centreline is 4"
  // in: a 24 ft loop at x = 0..24 piles at x = 0.333 .. 23.667.
  await open(page, empty({ outlines: [garage({ x: 0, z: 0, w: 24, d: 24 })] }));
  await armTool(page, 'column');
  await expect(button(page)).toBeEnabled();
  await button(page).click();
  await saveNow(page);

  const piles = pilesOf(await savedFile(page));
  const xs = piles.map(pile => pile.point.x);
  const zs = piles.map(pile => pile.point.z);
  expect(Math.min(...xs), 'the piles sit on the outline, not the centreline')
    .toBeCloseTo(1 / 3, 4);
  expect(Math.max(...xs), 'the piles sit on the outline, not the centreline')
    .toBeCloseTo(24 - 1 / 3, 4);
  expect(Math.min(...zs)).toBeCloseTo(1 / 3, 4);
  expect(Math.max(...zs)).toBeCloseTo(24 - 1 / 3, 4);

  // FOUR CORNERS AND TWO PER SIDE. The inset run is 23.333, ceil(23.333/9) = 3
  // spans, so each side adds two piles between its corners: 4 + 4 * 2 = 12.
  expect(piles.length, 'the spacing rule did not walk every leg').toBe(12);
});

test('a frost wall gets none, and the button says why', async ({ page }) => {
  // A frost wall stands on its own strip footing and a thickened edge is its
  // own, so piles under either would be concrete that is not there -- the same
  // rule raiseGarageConcrete's footing rings follow in the other direction.
  await open(page, empty({
    outlines: [garage({ foundation: 'frostwall' })],
  }));
  await armTool(page, 'column');
  await expect(button(page), 'the panel did not come up at all').toBeVisible();
  await expect(button(page),
    'the button offered to pile a garage that stands on a footing')
    .toBeDisabled();
});

test('re-running replaces its own piles and leaves a drafter’s column alone',
  async ({ page }) => {
    await open(page, empty({
      outlines: [garage()],
      columns: [
        // HIS OWN PILE, moved or placed by hand: no `auto`, so it stays.
        { id: 900, point: { x: 5, y: 0, z: 5 }, levelId: 1, view: 'foundation',
          footing: 'pile10', pileMark: 'P1' },
        // AND A TELEPOST, which is AUTO BEAM's and not this button's. It
        // carries `auto` and sits on the same level and view, so only the
        // FOOTING tells the two apart.
        { id: 901, point: { x: 7, y: 0, z: 7 }, levelId: 1, view: 'foundation',
          footing: 'pad36', auto: true },
      ],
    }));
    await armTool(page, 'column');
    await button(page).click();
    await button(page).click();
    await button(page).click();
    await saveNow(page);
    const saved = await savedFile(page);

    const his = (saved.columns || []).find(column => column.id === 900);
    expect(his, 'a hand-placed pile was swept by a re-run').toBeTruthy();
    expect(his.pileMark, 'and it kept the mark he gave it').toBe('P1');
    expect((saved.columns || []).some(column => column.footing === 'pad36'),
      'the pile sweep took a telepost with it').toBe(true);

    // THREE PRESSES, ONE SET. Without the sweep this is 36 piles in a heap.
    const mine = pilesOf(saved).filter(pile => pile.auto === true);
    expect(mine.length, 'three presses stacked three sets of piles').toBe(12);
    const ids = mine.map(pile => pile.id);
    expect(new Set(ids).size, 'a re-run handed out an id twice').toBe(ids.length);
  });

test('every pile survives the reload, mark and all', async ({ page }) => {
  // `pileMark` is additive, so the question is whether the reader keeps it --
  // a field the format drops is present on screen, in the save file, and gone
  // one reload later with no error at either end.
  await open(page, empty({ outlines: [garage()] }));
  await armTool(page, 'column');
  await button(page).click();
  await saveNow(page);

  const kept = await page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const raw = JSON.parse(await file.text());
    const F = window.DraftDrawingFormat;
    const levelIds = new Set((raw.levels || []).map(level => Number(level.id)));
    const back = F.columns(raw.columns, levelIds, {});
    return {
      wrote: (raw.columns || []).length,
      keeps: back.length,
      marked: back.filter(column => column.pileMark === 'P2').length,
      // A PAD HAS NO ROW IN THAT SCHEDULE, so a mark on one points at nothing.
      padMarked: F.columns([{ id: 5, point: { x: 0, z: 0 }, levelId: 1,
        view: 'foundation', footing: 'pad36', pileMark: 'P2' }], levelIds, {})
        .filter(column => column.pileMark !== undefined).length,
      // And a mark the schedule does not carry is not a mark.
      bogus: F.columns([{ id: 6, point: { x: 0, z: 0 }, levelId: 1,
        view: 'foundation', footing: 'pile12', pileMark: 'P9' }], levelIds, {})
        .filter(column => column.pileMark !== undefined).length,
    };
  }, BUCKET);

  expect(kept.keeps, 'piles were written that the reload loses').toBe(kept.wrote);
  expect(kept.marked, 'the mark did not survive the reader').toBe(kept.wrote);
  expect(kept.padMarked, 'a pad was allowed a pile schedule mark').toBe(0);
  expect(kept.bogus, 'a mark with no row in the schedule was kept').toBe(0);
});

test('an attached garage takes no piles along the leg it shares with the house',
  async ({ page }) => {
    // There is no grade beam on that leg -- the house wall is there -- so
    // there is nothing to hold up. Its two ENDS still carry one, because they
    // are the ends of the runs that remain: MODEL.dc.html's "two piles at the
    // beam corners against the house" arrived at by the general rule.
    //
    // House 0..20 in x; garage 20..44, so the garage's west leg (x = 20) lies
    // on the house's east wall.
    await open(page, empty({
      outlines: [
        { id: 'outline-house', levelId: 3,
          points: [{ x: 0, y: 0, z: 0 }, { x: 20, y: 0, z: 0 },
            { x: 20, y: 0, z: 24 }, { x: 0, y: 0, z: 24 }] },
        garage({ id: 'outline-garage', x: 20, z: 0, w: 24, d: 24,
          detached: false }),
      ],
    }));
    await armTool(page, 'column');
    await button(page).click();
    await saveNow(page);

    const piles = pilesOf(await savedFile(page));
    expect(piles.length, 'no pile was placed at all').toBeGreaterThan(0);
    // The shared leg's centreline is at x = 20.333. Nothing may sit along it
    // between its ends.
    const onShared = piles.filter(pile => Math.abs(pile.point.x - (20 + 1 / 3)) < 0.01);
    const between = onShared.filter(pile => pile.point.z > 1 / 3 + 0.01
      && pile.point.z < 24 - 1 / 3 - 0.01);
    expect(between.length,
      'piles were poured along the wall the house already carries').toBe(0);
    expect(onShared.length, 'the beam corners against the house lost their piles')
      .toBe(2);
  });
