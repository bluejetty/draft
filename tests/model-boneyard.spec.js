// THE BONEYARD on MODEL.html — shelf storage that never prints.
//
// Work order: BONEYARD-WORKORDER.md, ruled 14 Sep:
//   "yes boneyard should be working so i can copy and paste stuff in there
//    that won't show on the plan (to save for later / reference)"
//   "check the dc version i liked that one" — "had addable shelves"
//
// THIS IS A PORT, NOT A DESIGN. MODEL.dc.html has the working boneyard;
// this page printed the shelf names as dead text and nothing pressed.
//
// THE CLAIM THE ORDER SAYS TO MEASURE FIRST -- "a shelf is already a level
// with a negative id, so parking a wall on a shelf needs no format change at
// all" -- was measured on 14 Sep and was HALF FALSE. drawing-format.js is
// sign-agnostic, but the OWNER SET is the caller's, and this page built it
// from levels alone, so a wall at levelId -1 was dropped on load. Fixed in
// c8654eb and merged; model-boneyard-shelf.spec.js is the check that holds
// it. Without that fix every check in this file would pass on screen and
// lose the drafter's parked geometry on the first reload.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
const MAIN = 3;

const wall = (id, levelId, start, end) => ({
  id, levelId, start, end, view: 'plan',
  wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
});

const base = extra => ({
  version: 1,
  levels: [
    { id: 1, name: 'FOUNDATION', elev: -10 },
    { id: MAIN, name: 'MAIN FL', elev: 0 },
  ],
  activeLevelIdx: 1,
  walls: [
    wall('m-n', MAIN, V(-10, -10), V(10, -10)),
    wall('m-e', MAIN, V(10, -10), V(10, 10)),
    wall('m-s', MAIN, V(10, 10), V(-10, 10)),
    wall('m-w', MAIN, V(-10, 10), V(-10, -10)),
  ],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  boneyardShelves: [{ id: 1, name: 'SHELF 1' }],
  groups: [], levelLocks: [], underlays: [],
  nextDrawingItemId: 50,
  ...extra,
});

async function open(page, file) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  await page.goto('/MODEL.html?right=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

const card = page => page.locator('[data-boneyard]');
const addShelf = page => page.locator('[data-add-shelf]');
const shelfRow = (page, id) => page.locator(`[data-shelf="${id}"]`);

// WHAT IS ON THE PAGE, read off the readout the page publishes rather than a
// test hook -- the same instrument every other spec here trusts. "walls 4/20"
// is shown/total, and SHOWN is the number that answers "is the level's
// geometry gone".
const shown = async page => {
  const text = await page.locator('#readout').textContent();
  const hit = /walls (\d+)\/(\d+)/.exec(text);
  expect(hit, 'the readout publishes the wall count').toBeTruthy();
  return { shown: Number(hit[1]), total: Number(hit[2]) };
};

const saved = page => page.evaluate(async bucket => {
  const f = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await f.text());
}, BUCKET);

const saveIt = async page => {
  await page.locator('[data-model-save]').click();
  await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });
  return saved(page);
};

test('ACCEPTANCE 1: the BONEYARD card selects, and the level geometry goes',
  async ({ page }) => {
    // A WALL PARKED ON SHELF 1 so the two halves are distinguishable. Without
    // it "the shelf's contents are what draws" is satisfied by drawing
    // NOTHING, which is also what a card that merely hides everything does.
    await open(page, base({
      walls: [...base({}).walls, wall('parked', -1, V(-4, -4), V(4, -4))],
    }));

    const before = await shown(page);
    expect(before.shown, 'the level shows its four walls to begin with').toBe(4);
    expect(before.total, 'and the parked wall is LOADED, not dropped -- c8654eb')
      .toBe(5);

    await card(page).click();
    await expect(card(page)).toHaveAttribute('data-active', '');

    const after = await shown(page);
    expect(after.shown,
      'on the boneyard only the shelf draws: one parked wall, and none of the '
      + "level's four").toBe(1);
  });

test('ACCEPTANCE 2: + SHELF adds a shelf, selects it, and its contents are its own',
  async ({ page }) => {
    // GEOMETRY AT THE SAME COORDINATES ON BOTH SHELVES, which is the tooltip's
    // own stated reason for shelves existing: "park geometry at the same spot
    // on different shelves without overlap". Two walls at identical points
    // make "the shelves are independent" a claim a merge would break.
    await open(page, base({
      boneyardShelves: [{ id: 1, name: 'SHELF 1' }, { id: 2, name: 'SHELF 2' }],
      walls: [...base({}).walls,
        wall('on-1', -1, V(-4, -4), V(4, -4)),
        wall('on-2', -2, V(-4, -4), V(4, -4))],
    }));

    await card(page).click();
    expect((await shown(page)).shown, 'SHELF 1 shows its one wall').toBe(1);

    await shelfRow(page, 2).click();
    expect((await shown(page)).shown,
      'SHELF 2 shows its own one wall, not both and not none').toBe(1);

    // AND THE PAGE SAYS WHICH SHELF IT IS SHOWING, on the row itself rather
    // than through a test hook -- the panel is the drafter's own readout and
    // a `window.__` global would let the two disagree without anything red.
    await expect(shelfRow(page, 2)).toHaveAttribute('data-active', '');
    await expect(shelfRow(page, 1)).not.toHaveAttribute('data-active', '');
  });

test('+ SHELF creates the next shelf and makes it active', async ({ page }) => {
  await open(page, base({}));
  await card(page).click();
  await addShelf(page).click();

  await expect(shelfRow(page, 2), 'a second shelf row arrived').toHaveCount(1);
  await expect(shelfRow(page, 2)).toHaveAttribute('data-active', '');
  expect((await shown(page)).shown, 'a fresh shelf is empty').toBe(0);
});

test('ACCEPTANCE 6: shelves and the active shelf survive save and reload',
  async ({ page }) => {
    await open(page, base({}));
    await card(page).click();
    await addShelf(page).click();
    await addShelf(page).click();          // SHELF 2 and SHELF 3, 3 active

    const file = await saveIt(page);
    expect((file.boneyardShelves || []).map(s => s.id),
      'both new shelves reached the file').toEqual([1, 2, 3]);
    expect(file.activeBoneyardShelfId, 'and which one was active').toBe(3);
    expect(file.nextBoneyardShelfId, 'and the allocator, so ids are not reused')
      .toBe(4);

    await page.reload();
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
    await expect(shelfRow(page, 3), 'the third shelf came back').toHaveCount(1);
  });

test('a drawing saved before shelves existed loads with the single default',
  async ({ page }) => {
    const old = base({});
    delete old.boneyardShelves;
    await open(page, old);
    await card(page).click();
    await expect(shelfRow(page, 1), 'the default SHELF 1, and no error')
      .toHaveCount(1);
  });

test('ACCEPTANCE 7: the boneyard row stays pinned last in the panel',
  async ({ page }) => {
    // ADD A BASEMENT BENEATH THE FOUNDATION and it must land ABOVE the
    // boneyard. Asserted by vertical position rather than by DOM order: the
    // panel is what a drafter reads, and a row that sorts last in the markup
    // but paints halfway up is still wrong.
    await open(page, base({
      levels: [
        { id: 0, name: 'BASEMENT', elev: -20 },
        { id: 1, name: 'FOUNDATION', elev: -10 },
        { id: MAIN, name: 'MAIN FL', elev: 0 },
      ],
    }));

    const boneBox = await card(page).boundingBox();
    for (const id of [0, 1, MAIN]) {
      const box = await page.locator(`[data-level="${id}"]`).boundingBox();
      expect(box.y, `level ${id} sits above the boneyard`)
        .toBeLessThan(boneBox.y);
    }
  });

test('leaving the boneyard puts the level geometry back', async ({ page }) => {
  // THE WAY BACK, which a card that only ever switches ONE way would fail
  // while passing acceptance 1.
  await open(page, base({
    walls: [...base({}).walls, wall('parked', -1, V(-4, -4), V(4, -4))],
  }));
  await card(page).click();
  expect((await shown(page)).shown).toBe(1);

  await page.locator(`[data-level="${MAIN}"]`).click();
  await expect(card(page)).not.toHaveAttribute('data-active', '');
  expect((await shown(page)).shown, 'MAIN FL has its four walls again').toBe(4);
});
