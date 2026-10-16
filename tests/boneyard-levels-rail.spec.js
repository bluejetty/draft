// THE LEVELS STAND BETWEEN THE TWO WINDOWS.
//
// Movie, 16 Oct: "in the BONEYARD can we decrease the 3D model side on the
// left and squeeze in between the 2 windows the LEVELS (take them off the
// upper right area and move those so they are stacked between the 2 windows)
// the 3D Model area can get smaller and the 3D model smaller as well to
// alllow for the extra space needed".
//
// FOUR THINGS, AND THEY ARE ALL GEOMETRY, so they are all measured off the
// rendered page rather than read out of the markup: a check that the legend's
// parent is called `levels-rail` passes on a rail stacked under the panes, or
// squeezed to nothing, or sitting on top of the 3D. Where the box actually
// lands is the feature.
//
//   1. the levels are BETWEEN the panes -- past the right edge of the 3D,
//      short of the left edge of the editing window, and out of the head they
//      used to share with the title and two verbs
//   2. they are STACKED -- one under the next, same left edge, same width,
//      and none of them clipped by the rail that holds them
//   3. the 3D side is the one that gave up the room
//   4. the model inside it came down with it, and nothing of it fell off the
//      narrower window
//
// And none of that is worth anything if a chip stops picking its level, so
// the last test walks the rail.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const empty = () => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

// A 2 STOREY + GARAGE off the drive-thru, saved, then the boneyard opened on
// it -- four levels, which is what crowded the head in the first place.
async function boneyardOfTwoStorey(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.openDriveThru(page);
  await page.locator('#dt-tiles [data-build-family="bungalow"]').click();
  await page.locator('#dt-tiles [data-build-entry="twoStorey-garage"]').click();
  await page.locator('#dt-bone').click();
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  await page.goto('/BONEYARD.html');
  await expect(page.locator('body')).toHaveAttribute('data-boneyard-ready', '1', { timeout: 10000 });
  await expect(page.locator('#legend button')).toHaveCount(4);
}

const boxes = locator => locator.evaluateAll(els => els.map(el => {
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height,
    clipped: el.scrollWidth > el.clientWidth + 1 };
}));
const box = async locator => (await boxes(locator))[0];

test('the levels sit between the two windows, not in the right one\'s head',
  async ({ page }) => {
    await boneyardOfTwoStorey(page);
    // OUT OF THE HEAD. They shared it with the title, BREAK, UNDO and the
    // rest, where a fourth level squeezed everything else along.
    expect(await page.locator('#legend').evaluate(el => !!el.closest('.pane-head')),
      'the legend left the pane head').toBe(false);
    const rail = await box(page.locator('.levels-rail'));
    const three = await box(page.locator('.pane-3d'));
    const edit = await box(page.locator('.pane:not(.pane-3d)'));
    expect(await page.locator('#legend').evaluate(el => el.parentElement.classList.contains('levels-rail')),
      'and stands in the rail').toBe(true);
    // BETWEEN, measured: clear of the 3D's right edge and clear of the
    // editing window's left.
    expect(rail.x, 'past the right edge of the 3D').toBeGreaterThanOrEqual(three.x + three.w - 1);
    expect(rail.x + rail.w, 'short of the left edge of the editing window')
      .toBeLessThanOrEqual(edit.x + 1);
    expect(edit.x, 'and the two windows really are either side of it')
      .toBeGreaterThan(three.x + three.w);
    // A RAIL, NOT A THIRD PANE: it takes only what the names need.
    expect(rail.w, 'it is a rail, not a window').toBeLessThan(edit.w / 3);
  });

test('they are stacked, top-aligned, and none of them is clipped', async ({ page }) => {
  await boneyardOfTwoStorey(page);
  const chips = await boxes(page.locator('#legend button'));
  expect(chips.length, 'four levels on this house').toBe(4);
  const order = [...chips].sort((a, b) => a.y - b.y);
  order.slice(1).forEach((chip, i) => {
    // ONE UNDER THE NEXT. Left in a row they would be the same four chips
    // that crowded the head, only stood somewhere narrower.
    expect(chip.y, 'each one below the one before').toBeGreaterThanOrEqual(
      order[i].y + order[i].h - 1);
    expect(Math.abs(chip.x - order[i].x), 'all on one left edge').toBeLessThan(1);
    expect(Math.abs(chip.w - order[i].w), 'and all one width').toBeLessThan(1);
  });
  // TOP-ALIGNED, so the first level is level with the two heads rather than
  // floating in the middle of a rail as tall as the page.
  const three = await box(page.locator('.pane-3d'));
  expect(order[0].y - three.y, 'the first level starts with the windows')
    .toBeLessThan(6);
  expect(order[0].y - three.y).toBeGreaterThanOrEqual(-1);
  // AND NOTHING SQUEEZED. A rail allowed to shrink cuts 'FOUNDATION' off.
  chips.forEach(chip => expect(chip.clipped, 'the name fits on its chip').toBe(false));
});

test('the 3D side is the one that gave up the room, model and all', async ({ page }) => {
  await boneyardOfTwoStorey(page);
  const three = await box(page.locator('.pane-3d'));
  const edit = await box(page.locator('.pane:not(.pane-3d)'));
  // "the 3D Model area can get smaller": materially smaller than the window
  // it used to split the page with, not a few pixels off even.
  expect(three.w, 'the 3D window is the narrower one').toBeLessThan(edit.w * 0.75);
  expect(three.w, 'but it is still a window').toBeGreaterThan(200);
  // "and the 3D model smaller as well": the picture is laid out to the box it
  // is in, so a narrower box is a smaller model -- and the whole of it is
  // still on the canvas. A model that kept its old size would hang off.
  const canvas = await box(page.locator('#bones3d'));
  expect(Math.abs(canvas.w - (three.w - 2)), 'the canvas took the pane\'s width')
    .toBeLessThan(2);
  const bones = JSON.parse(await page.locator('#bones3d').getAttribute('data-bones'));
  expect(bones.length, 'there are bones to look at').toBeGreaterThan(0);
  bones.forEach(bone => {
    expect(bone.at, `${bone.name} was drawn`).toBeTruthy();
    expect(bone.at[0], `${bone.name} is on the canvas`).toBeGreaterThanOrEqual(0);
    expect(bone.at[0]).toBeLessThanOrEqual(canvas.w);
    expect(bone.at[1]).toBeGreaterThanOrEqual(0);
    expect(bone.at[1]).toBeLessThanOrEqual(canvas.h);
  });
});

test('every chip in the rail still picks its level', async ({ page }) => {
  await boneyardOfTwoStorey(page);
  const names = await page.locator('#legend button').evaluateAll(
    els => els.map(el => el.dataset.boneLevel));
  expect(names).toEqual(['FOUNDATION', 'MAIN FL', '2ND FL', 'ROOF']);
  for (const name of names) {
    await page.locator(`.levels-rail [data-bone-level="${name}"]`).click();
    await expect(page.locator('#bones2d'), `${name} came up flat`)
      .toHaveAttribute('data-level', name);
    await expect(page.locator('#level-title')).toHaveText(name);
    // AND THE RAIL SAYS WHICH ONE, which is the other half of its job: with
    // the levels out of the head, this is the only place it is written.
    const pressed = await page.locator('#legend button[aria-pressed="true"]').evaluateAll(
      els => els.map(el => el.dataset.boneLevel));
    expect(pressed, 'one level marked, the one picked').toEqual([name]);
  }
});
