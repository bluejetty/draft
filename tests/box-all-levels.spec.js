// @ts-check
// CTRL OR SHIFT HELD MAKES ANY SELECT BOX ALL LEVELS (jb, 25 Nov 2026: "is
// there a way to use the rectagle select to select ALL LEVELS so everything
// in a certain area can be deleted?" -- "yes everything", "all levels all
// layers too", "either ctl or shift ... make the rectangle glow brighter and
// show along top SELECT ALL LEVELS").
//
// The fixture puts one of each kind upstairs (2ND FL) inside the box, plus a
// line on MAIN FL, so a box on MAIN FL with nothing held takes the one line
// and with Ctrl held takes the lot. DELETE then takes all of them and one
// UNDO brings all of them back.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
const sq = (cx, cz, r) => [V(cx - r, cz - r), V(cx + r, cz - r), V(cx + r, cz + r), V(cx - r, cz + r)];

const UP = 5;
const FIXTURE = {
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }, { id: UP, name: '2ND FL', elev: 9 }],
  activeLevelIdx: 0,
  // The square on MAIN FL frames the view (fit() centres on it), outside the box.
  walls: [
    ['w-n', V(-10, -10), V(10, -10)], ['w-e', V(10, -10), V(10, 10)],
    ['w-s', V(10, 10), V(-10, 10)], ['w-w', V(-10, 10), V(-10, -10)],
    // An upstairs wall inside the box, so its window rides along.
  ].map(([id, start, end]) => ({ id, start, end, levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' }))
    .concat([{ id: 'w-up', start: V(-4, 4), end: V(4, 4), levelId: UP, view: 'plan',
      wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' }]),
  lines: [
    { id: 'l-main', start: V(-4, 0), end: V(4, 0), levelId: 3, view: 'plan', layer: 'draft', bulge: 0 },
    { id: 'l-up', start: V(-3, -3), end: V(3, -3), levelId: UP, view: 'plan', layer: 'draft', bulge: 0 },
  ],
  floors: [],
  shapes: [{ id: 'sh-up', levelId: UP, points: sq(-4, -6, 1) }],
  beams: [{ id: 901, levelId: UP, view: 'plan', start: V(-5, 2), end: V(5, 2) }],
  columns: [{ id: 902, levelId: UP, view: 'plan', point: V(5, -5) }],
  notes: [{ id: 'n-up', levelId: UP, view: 'plan', anchor: V(2, -6), text: V(3, -6.5),
    body: 'UP', end: 'none' }],
  // A HAND DIM, with HAND DIMS put out of sight on the screen (the chip by
  // the north arrow): "all layers too" takes it all the same.
  dimensions: [{ id: 903, levelId: UP, view: 'plan', layer: 'A-DIMS-HAND',
    start: V(-6, 6), end: V(6, 6) }],
  roomTags: [{ id: 904, levelId: UP, at: V(-5, -1), name: 'BED' }],
  roofs: [], fenestrations: [], outlines: [],
  surfaceOpenings: [], stairs: [],
  boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
  board: 'drafting',
};

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, file }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(file)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, file: FIXTURE });
  await page.evaluate(() => localStorage.setItem('model.dimsHidden', JSON.stringify({ hand: true })));
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

// A left-to-right box from (-8,-8) to (8,8), with `key` held through it.
async function boxWith(page, key, { letGoBeforeRelease = false } = {}) {
  const a = await at(page, -8, -8);
  const b = await at(page, 8, 8);
  await page.mouse.move(...a);
  await page.mouse.down();
  await page.mouse.move((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  if (key) await page.keyboard.down(key);
  await page.mouse.move(...b);
  const glow = await page.locator('#plan').getAttribute('data-box-all-levels');
  if (key && letGoBeforeRelease) {
    await page.keyboard.up(key);
  }
  const calm = await page.locator('#plan').getAttribute('data-box-all-levels');
  await page.mouse.up();
  if (key && !letGoBeforeRelease) await page.keyboard.up(key);
  await page.waitForTimeout(100);
  return { glow, calm };
}

const picked = page => page.evaluate(() => selection.map(e => `${e.type}:${e.item.id}`).sort());

const UPSTAIRS = ['beam:901', 'column:902', 'dimension:903', 'line:l-main', 'line:l-up', 'note:n-up',
  'roomtag:904', 'shape:sh-up', 'wall:w-up'].sort();

test('a plain box takes this level; Ctrl held takes every kind on every level', async ({ page }) => {
  await open(page);
  const plain = await boxWith(page, null);
  expect(plain.glow, 'no key, no glow').toBe('off');
  expect(await picked(page)).toEqual(['line:l-main']);

  const held = await boxWith(page, 'Control');
  expect(held.glow, 'Ctrl held: the box glows').toBe('on');
  expect(await picked(page)).toEqual(UPSTAIRS);
  await expect(page.locator('#strip, [data-strip], body').first()).toContainText('SELECT ALL LEVELS');
});

test('Ctrl let go before the release goes back to a normal box', async ({ page }) => {
  await open(page);
  const r = await boxWith(page, 'Control', { letGoBeforeRelease: true });
  expect(r.glow).toBe('on');
  expect(r.calm, 'let go: the glow goes').toBe('off');
  expect(await picked(page)).toEqual(['line:l-main']);
});

test('Shift held is all levels too, and adds to what is picked', async ({ page }) => {
  await open(page);
  // A wall picked first, outside the box, stays picked.
  await page.mouse.click(...await at(page, 0, -10));
  await page.waitForTimeout(80);
  expect(await picked(page)).toEqual(['wall:w-n']);
  await boxWith(page, 'Shift');
  expect(await picked(page)).toEqual([...UPSTAIRS, 'wall:w-n'].sort());
});

test('DELETE takes every level in one press, and one UNDO brings it all back', async ({ page }) => {
  await open(page);
  const count = () => page.evaluate(() => ['walls', 'lines', 'shapes', 'beams', 'columns', 'notes', 'dimensions', 'roomTags']
    .reduce((n, k) => n + (drawing[k] || []).length, 0));
  const before = await count();
  await boxWith(page, 'Control');
  expect(await picked(page)).toEqual(UPSTAIRS);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(100);
  expect(await count(), 'every one gone').toBe(before - UPSTAIRS.length);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(100);
  expect(await count(), 'one UNDO, all back').toBe(before);
});

// THE BOX SAYS WHAT IT TAKES (jb, 25 Nov 2026): solid blue left to right is
// SELECT FULLY WITHIN BOX, green dotted right to left SELECT ALL IN AND
// PARTIALLY WITHIN BOX, and the red one leads with SELECT ALL LEVELS.
test('each box wears its label along the top', async ({ page }) => {
  await open(page);
  const plan = page.locator('#plan');
  const labelOf = async (from, to, key) => {
    const a = await at(page, ...from);
    const b = await at(page, ...to);
    await page.mouse.move(...a);
    await page.mouse.down();
    await page.mouse.move((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    if (key) await page.keyboard.down(key);
    await page.mouse.move(...b);
    const label = await plan.getAttribute('data-box-label');
    await page.mouse.up();
    if (key) await page.keyboard.up(key);
    await page.waitForTimeout(80);
    return label;
  };
  expect(await labelOf([-8, -8], [8, 8])).toBe('SELECT FULLY WITHIN BOX');
  expect(await labelOf([8, -8], [-8, 8])).toBe('SELECT ALL IN AND PARTIALLY WITHIN BOX');
  expect(await labelOf([-8, -8], [8, 8], 'Control')).toBe('SELECT ALL LEVELS — SELECT FULLY WITHIN BOX');
  expect(await labelOf([8, -8], [-8, 8], 'Control')).toBe('SELECT ALL LEVELS — SELECT ALL IN AND PARTIALLY WITHIN BOX');
});
