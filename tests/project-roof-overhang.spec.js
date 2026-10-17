// THE ROOF TAKES THE PROJECT PAGE'S OVERHANG AND PITCH (Movie, 6 Oct): "i
// tried to make the 4ft overhang using the PROJECT area but didn't work ...
// after i pressed the bone it was still 2ft eave". And, of a house already
// drawn: "RESHAPE each time ... allow it to autoregenerate".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const empty = () => ({
  version: 1, board: 'drafting', planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

async function openProject(page, file) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  await page.goto('/PROJECT.html');
  await expect(page.locator('.type-card').first()).toBeVisible();
}

const buildFromBone = async page => {
  await page.locator('#bone').click();
  await page.locator('[data-build-ask="menu"]').click();
  await page.waitForURL(/MODEL\.html/);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(600);
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};

const stored = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await file.text());
}, BUCKET);

// How far the roof reaches past the body it was cut over, on the left side
// (an eave on every design here).
const leftReach = (roof, outline) =>
  Math.min(...outline.points.map(p => p.x)) - Math.min(...roof.points.map(p => p.x));

test('the BONE cuts the house roof at the PROJECT overhang, and a changed overhang reshapes it', async ({ page }) => {
  const file = empty();
  file.roofOverhang = 4;
  await openProject(page, file);
  await page.locator('.type-card[data-type="bungalow"]').click();
  await page.locator('[data-family-entry="bungalow"]').click();
  const built = await buildFromBone(page);
  const house = built.outlines.find(o => !o.garage);
  const roof = built.roofs.find(r => r.follows === 'house');
  expect(roof, 'the house roof is not marked as following the PROJECT row').toBeTruthy();
  expect(roof.overhang).toBe(4);
  expect(leftReach(roof, house)).toBeCloseTo(4, 3);

  // BACK ON PROJECT, 4 FT BECOMES 3 FT AND THE BUILT ROOF FOLLOWS.
  await page.goto('/PROJECT.html');
  const box = page.locator('[data-detail-input="overhang"]');
  await box.fill(`3'-0"`);
  await box.press('Enter');
  await expect.poll(async () => (await stored(page)).roofOverhang).toBe(3);
  const after = await stored(page);
  const moved = after.roofs.find(r => r.follows === 'house');
  expect(moved.overhang).toBe(3);
  expect(leftReach(moved, house)).toBeCloseTo(3, 3);
  expect(after.walls.length).toBe(built.walls.length);
});

test('a MOD BILEVEL takes its own row: house at the split overhang, garage at its own', async ({ page }) => {
  const file = empty();
  file.sectionTable = { rows: { modifiedBilevel: { roofOverhangFt: 4, roofPitch: 5 } } };
  await openProject(page, file);
  await page.locator('.type-card[data-type="bilevel"]').click();
  await page.locator('[data-family-entry="modifiedBilevel"]').click();
  const built = await buildFromBone(page);
  const house = built.roofs.filter(r => r.follows === 'house');
  const garage = built.roofs.filter(r => r.follows === 'attachedGarage');
  expect(house.length).toBeGreaterThan(0);
  // EVERY HOUSE PIECE TAKES THE ROW'S OVERHANG. The pitch too -- except a
  // piece gabled into the 2nd-floor wall, which the roof lowers to keep its
  // ridge under that wall (Movie, 17 Oct: "the back roof can have a lower
  // slope if it doesn't fit"); such a piece carries the row's pitch as its
  // designPitch and sits below it. The rest are at the row's 5, and there
  // must be some, or the row never reached the roof at all.
  house.forEach(r => {
    expect(r.overhang).toBe(4);
    if (r.designPitch !== undefined) {
      expect(r.designPitch).toBe(5);
      expect(r.pitch).toBeLessThan(5);
      expect(r.pitch).toBeGreaterThanOrEqual(2);
    } else {
      expect(r.pitch).toBe(5);
    }
  });
  expect(house.some(r => r.designPitch === undefined), 'no house piece is at the row\'s pitch').toBe(true);
  // The garage row is untouched, so it falls back to the drawing's 2 ft -- what
  // the PROJECT card shows beside it.
  garage.forEach(r => { expect(r.overhang).toBe(2); expect(r.pitch).toBe(4); });
});

// ── AND THE SIDE EAVE, SEPARATELY (Movie, 13 Oct) ────────────────────────
//
// "make the MAIN OVERHANG (2'0) default, and then underneath it also have
// SIDE OVERHANG ... when they change that the side eaves will reduce (or
// increase) on all sides so its symetrical", and "add that for all the ROOFs
// not just the bilevels also bungalow and the garages too".
//
// THE DEFAULT IS ABSENCE, which is the whole of why every drawing written
// before this is unchanged: a roof cut with one number is symmetrical, and an
// absent side eave IS that number. So the box shows the main eave until
// somebody types, and emptying it puts it back.
test('SIDE OVERHANG follows the main eave until it is typed, and again when it is emptied',
  async ({ page }) => {
    const file = empty();
    file.roofOverhang = 3;
    await openProject(page, file);
    // A TYPE IS PICKED FIRST. The schedule is not on screen until one is --
    // every box in it measures zero -- so a test that typed straight into it
    // would be driving a card nobody has opened.
    await page.locator('.type-card[data-type="bungalow"]').click();
    await page.locator('[data-family-entry="bungalow"]').click();

    const main = page.locator('[data-detail-input="overhang"]');
    const side = page.locator('[data-detail-input="side overhang"]');
    await expect(main).toHaveValue(`3'-0"`);
    // NOT EMPTY. An empty box would say this roof has no side eave, which is a
    // different roof -- what absent means here is "the same as the main one".
    await expect(side, 'the side box starts blank instead of showing the main eave')
      .toHaveValue(`3'-0"`);

    await side.fill(`1'-0"`);
    await side.press('Enter');
    await expect.poll(async () => (await stored(page)).roofSideOverhang).toBe(1);
    // AND THE MAIN ONE IS UNTOUCHED, which is the point of a second number.
    expect((await stored(page)).roofOverhang, 'typing a side eave moved the main one').toBe(3);

    // EMPTIED, IT GOES BACK TO FOLLOWING -- stored as null rather than dropped,
    // or the last typed number would stay in the file.
    await side.fill('');
    await side.press('Enter');
    await expect.poll(async () => (await stored(page)).roofSideOverhang).toBe(null);
    await expect(side, 'an emptied side eave stops showing the main one').toHaveValue(`3'-0"`);
  });

// ASKED OF THE MODULE THAT READS IT, not of the box: a number that reaches
// the file and is not read by level-assembly is a control that does nothing.
test('and level-assembly reads the typed side eave, leaving the main one alone',
  async ({ page }) => {
    const file = empty();
    file.roofOverhang = 2;
    file.roofSideOverhang = 4;
    await openProject(page, file);
    const read = await page.evaluate(f => {
      const LA = window.DraftLevelAssembly;
      return [LA.projectRoofFor(f, 'house'), LA.projectRoofFor({ ...f, roofSideOverhang: null }, 'house')];
    }, file);
    expect(read[0].overhangFt, 'the main eave').toBe(2);
    expect(read[0].sideOverhangFt, 'the typed side eave').toBe(4);
    // AND WITHOUT ONE, the side eave IS the main one -- the fallback every
    // drawing written before today relies on.
    expect(read[1].sideOverhangFt, 'an absent side eave is the main one').toBe(2);
  });

// THE GARAGE CARRIES ITS OWN, and follows ITS OWN main eave rather than the
// house's -- which is the trap in reading the cell through cellValue, whose
// last resort is the house's live field.
test('the garage side eave follows the GARAGE main eave, not the house-s',
  async ({ page }) => {
    const file = empty();
    file.roofOverhang = 2;
    file.roofSideOverhang = 4;
    file.sectionTable = { rows: { attachedGarage: { roofOverhangFt: 1 } } };
    await openProject(page, file);
    await page.locator('.type-card[data-type="bungalow"]').click();
    await page.locator('[data-family-entry="bungalow-garage"]').click();
    await expect(page.locator('[data-detail-input="garageOverhang"]')).toHaveValue(`1'-0"`);
    await expect(page.locator('[data-detail-input="garageSideOverhang"]'),
      'the garage borrowed the house-s side eave instead of following its own')
      .toHaveValue(`1'-0"`);

    const box = page.locator('[data-detail-input="garageSideOverhang"]');
    await box.fill(`0'-6"`);
    await box.press('Enter');
    await expect.poll(async () => (await stored(page))
      .sectionTable?.rows?.attachedGarage?.roofSideOverhangFt).toBe(0.5);
    const after = await stored(page);
    expect(after.roofSideOverhang, 'the garage-s cell moved the house-s number').toBe(4);
  });
