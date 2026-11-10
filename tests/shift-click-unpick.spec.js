// SHIFT-CLICK TAKES ONE ITEM OUT OF A BOX SELECTION, AND PUTS IT BACK (jb, 10
// Nov 2026: "press and hold SHIFT while clicking on items that will be un
// grouped from the package of items. or second click to add back"). The help
// line has always promised "Shift adds or removes", and a shift-click on a
// LONE picked item did remove it -- but a press on an item that is one of
// SEVERAL in hand armed a move drag (lines and notes move together; a wall
// moves by its body), and the release of a drag that never travelled, with
// Shift held, did nothing at all. So the one gesture the help promised for
// trimming a window's catch was the one gesture that failed.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
const line = (id, x1, z1, x2, z2) => ({
  id, start: V(x1, z1), end: V(x2, z2), levelId: 3, view: 'plan', layer: 'draft', bulge: 0,
});
const wall = (id, x1, z1, x2, z2) => ({
  id, start: V(x1, z1), end: V(x2, z2), levelId: 3, view: 'plan',
  wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
});

// SYMMETRIC ABOUT THE ORIGIN so fit() centres on (0,0) (see
// model-tool-select.spec.js on the coordinate trap). Three lines across the
// top half, a wall across the bottom half, and a square of walls round it all
// so the box has walls to leave out.
const FIXTURE = {
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  walls: [
    wall('w-n', -10, -10, 10, -10), wall('w-e', 10, -10, 10, 10),
    wall('w-s', 10, 10, -10, 10), wall('w-w', -10, 10, -10, -10),
    wall('w-a', -6, 4, 6, 4), wall('w-b', -6, 7, 6, 7),
  ],
  lines: [line('l-a', -6, -7, 6, -7), line('l-b', -6, -4, 6, -4), line('l-c', -6, -1, 6, -1)],
  floors: [], roofs: [], fenestrations: [], dimensions: [], outlines: [],
  shapes: [], surfaceOpenings: [], stairs: [], notes: [], roomTags: [],
  columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
  board: 'drafting',
};

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, file }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(file)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, file: FIXTURE });
  await page.goto('/MODEL.html?left=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect(page.locator('[data-sel-mode]').first()).toBeVisible();
  await page.keyboard.press('s');
}

const at = async (page, x, z) => {
  const box = await page.locator('#plan').boundingBox();
  const scale = await page.evaluate(() => Number(
    /scale ([\d.]+) px\/ft/.exec(document.getElementById('readout').textContent)[1]));
  return [box.x + box.width / 2 + x * scale, box.y + box.height / 2 + z * scale];
};

async function dragBox(page, from, to) {
  const a = await at(page, ...from);
  const b = await at(page, ...to);
  await page.mouse.move(...a);
  await page.mouse.down();
  await page.mouse.move((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  await page.mouse.move(...b);
  await page.mouse.up();
  await page.waitForTimeout(100);
}

async function shiftClick(page, x, z) {
  const p = await at(page, x, z);
  await page.keyboard.down('Shift');
  await page.mouse.move(...p);
  await page.mouse.down();
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await page.waitForTimeout(100);
}

const picked = page => page.evaluate(() => selection.map(e => e.item.id).sort());

test('with LINE engaged, Shift-click drops a boxed line and Shift-click again puts it back', async ({ page }) => {
  await open(page);
  await page.locator('[data-sel-filter="line"]').click();
  await dragBox(page, [-8, -9], [8, 1]);
  expect(await picked(page)).toEqual(['l-a', 'l-b', 'l-c']);

  await shiftClick(page, 0, -4);
  expect(await picked(page)).toEqual(['l-a', 'l-c']);

  await shiftClick(page, 0, -4);
  expect(await picked(page)).toEqual(['l-a', 'l-b', 'l-c']);
});

test('Shift-click drops one wall from a boxed pair and puts it back', async ({ page }) => {
  await open(page);
  await dragBox(page, [-8, 2], [8, 9]);
  expect(await picked(page)).toEqual(['w-a', 'w-b']);

  await shiftClick(page, 0, 7);
  expect(await picked(page)).toEqual(['w-a']);

  await shiftClick(page, 0, 7);
  expect(await picked(page)).toEqual(['w-a', 'w-b']);
});

test('a Shift-click on a boxed line while a Shift-drag starts a move still moves it', async ({ page }) => {
  // The fix is on the RELEASE of a drag that did not travel; a real drag with
  // Shift held must still move the pieces together.
  await open(page);
  await page.locator('[data-sel-filter="line"]').click();
  await dragBox(page, [-8, -9], [8, 1]);
  const a = await at(page, 0, -4), b = await at(page, 0, -2);
  await page.keyboard.down('Shift');
  await page.mouse.move(...a);
  await page.mouse.down();
  await page.mouse.move((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  await page.mouse.move(...b);
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await page.waitForTimeout(100);
  expect(await picked(page)).toEqual(['l-a', 'l-b', 'l-c']);
  const zs = await page.evaluate(() => selection.map(e => Math.round(e.item.start.z)).sort((p, q) => p - q));
  expect(zs).toEqual([-5, -2, 1]);
});
