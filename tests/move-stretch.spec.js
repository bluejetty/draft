// MOVE (M) AND STRETCH (H) IN THE DRAFTING KEYS.
//
// Movie, 20 Oct: "add another command- 2 more - for the DRAFTING area - MOVE
// "M" and also STRETCH ... use it with the RECTAGULAR SELECT, so if they
// choose STRETCH automatically also glow the SELECT button and bring up the
// rectagle select ... let him just press for each corner" -- "click on the
// edge node of the existing suite and pull it up to te line, and all the
// ASSEMBLED units with even a small part withint the rectabgle should be FULLY
// dragged along 'in tact'". His answers: STRETCH is "HHHHHH"; doors and
// windows on a stretched wall "keep em put"; a suite hologram the box touches
// moves whole; "YES in drafting keys and keep move bottom too".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const P = (x, z) => ({ x, y: 0, z });
const W = (id, a, b) => ({ id, start: P(...a), end: P(...b), levelId: 3, view: 'plan',
  wallType: 'stud_2x4', refLine: 'center', baseHeight: 0, topHeight: 8 });
// A 10 x 10 ROOM, its top edge at z = 0. The east wall is drawn FROM the top,
// so its moving end is its START -- the case where an offset has to change
// for a window to stay put.
const ROOM = [W('n', [0, 0], [10, 0]), W('e', [10, 0], [10, 10]), W('s', [10, 10], [0, 10]), W('w', [0, 10], [0, 0])];
const drawing = extra => ({
  version: 1, board: 'drafting',
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0, nextDrawingItemId: 50,
  walls: ROOM,
  fenestrations: [{ id: 'win', wallId: 'e', levelId: 3, view: 'plan', type: 'window', layer: 'A-GLAZ',
    offset: 7, width: 2, sillHeight: 3, headHeight: 6.67, auto: false }],
  lines: [], fixtures: [], dimensions: [], floors: [], roofs: [], outlines: [], shapes: [],
  surfaceOpenings: [], notes: [], stairs: [], roomTags: [], columns: [], beams: [],
  boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
  ...extra,
});

// A THROW ANYWHERE FAILS THE TEST: the strip's refresh threw once after the
// base point and the stretch still landed, so only the stale sentence said so.
test.afterEach(async ({ page }) => {
  expect(page.__errors || [], 'no page errors').toEqual([]);
});

async function open(page, f = drawing()) {
  page.__errors = page.__errors || [];
  page.on('pageerror', err => page.__errors.push(String(err)));
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html?left=1&lpane=drafting');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  const box = await page.locator('#plan').boundingBox();
  for (let i = 0; i < 12; i++) {
    const { scale } = await h.planFrame(page);
    if (scale >= 18 && scale <= 26) break;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, scale > 26 ? 120 : -120);
    await page.waitForTimeout(120);
  }
  // NO MAGNET OR T-SQUARE in the way of the presses, unless a test asks.
  return h.planFrame(page);
}
async function press(page, at, x, z) {
  await page.mouse.click(...at(x, z));
  await page.waitForTimeout(80);
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const wall = (d, id) => d.walls.find(w => w.id === id);
const key = (page, id) => page.locator(`[data-tool-key="${id}"]`);
// THE BOX ROUND THE TOP EDGE, the base on its west corner, 5 ft up.
async function stretchTopUp(page, at, upFt = 5) {
  const strip = page.locator('#strip-message');
  await press(page, at, -2, -2);
  await expect(strip).toContainText('opposite corner');
  await press(page, at, 12, 2);
  await expect(strip).toContainText('BASE POINT');
  await press(page, at, 0, 0);
  await expect(strip).toContainText('press where it goes');
  await press(page, at, 0, -upFt);
}

test('MOVE and STRETCH are in the DRAFTING keys, M and H', async ({ page }) => {
  await open(page);
  await expect(key(page, 'move')).toBeVisible();
  await expect(key(page, 'stretch')).toBeVisible();
  await expect(key(page, 'move').locator('[data-tool-letter]')).toHaveText('M');
  await expect(key(page, 'stretch').locator('[data-tool-letter]')).toHaveText('H');
  // H ARMS STRETCH, and SELECT glows with it.
  await page.keyboard.press('h');
  await expect(key(page, 'stretch')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-bar-key="select"]')).toHaveAttribute('data-stretch-glow', '');
  await expect(page.locator('#strip-message')).toContainText('STRETCH');
  await page.keyboard.press('h');
  await expect(page.locator('[data-bar-key="select"]')).not.toHaveAttribute('data-stretch-glow', '');
});

test('M with nothing picked says to pick first; with a wall picked it is the foot\'s MOVE', async ({ page }) => {
  const { at } = await open(page);
  await page.keyboard.press('m');
  await expect(page.locator('#strip-message')).toContainText('pick what to move first');
  await press(page, at, 5, 10);
  await page.keyboard.press('m');
  await expect(page.locator('#model-move')).toHaveAttribute('aria-pressed', 'true');
  await expect(key(page, 'move')).toHaveAttribute('aria-pressed', 'true');
  // THE FOOT'S MOVE IS STILL THERE AND STILL ITS OWN.
  await page.locator('#model-move').click();
  await expect(key(page, 'move')).toHaveAttribute('aria-pressed', 'false');
});

test('STRETCH: the top edge pulled up 5 ft -- the side walls stretch, the top moves, the bottom stays', async ({ page }) => {
  const { at } = await open(page);
  await key(page, 'stretch').click();
  await stretchTopUp(page, at);
  await expect(page.locator('#strip-message')).toContainText('STRETCHED');
  const d = await saved(page);
  expect(wall(d, 'n').start.z).toBeCloseTo(-5, 6);
  expect(wall(d, 'n').end.z).toBeCloseTo(-5, 6);
  expect(wall(d, 'e').start.z, 'the east wall\'s top end').toBeCloseTo(-5, 6);
  expect(wall(d, 'e').end.z, 'its bottom end stays').toBeCloseTo(10, 6);
  expect(wall(d, 'w').end.z).toBeCloseTo(-5, 6);
  expect(wall(d, 's').start.z, 'the bottom wall stays').toBeCloseTo(10, 6);
  // THE WINDOW KEEPS ITS PLACE, measured from the end that stayed: 3 ft up
  // from the bottom, which on the longer wall is offset 12.
  expect(d.fenestrations[0].offset, '"keep em put"').toBeCloseTo(12, 6);
  await expect(key(page, 'stretch'), 'one stretch and the tool goes down').toHaveAttribute('aria-pressed', 'false');
});

test('one UNDO puts the whole stretch back, window and all', async ({ page }) => {
  const { at } = await open(page);
  await key(page, 'stretch').click();
  await stretchTopUp(page, at);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  const d = await saved(page);
  expect(wall(d, 'n').start.z).toBeCloseTo(0, 6);
  expect(wall(d, 'e').start.z).toBeCloseTo(0, 6);
  expect(d.fenestrations[0].offset).toBeCloseTo(7, 6);
});

test('a window inside the box rides the end that moves', async ({ page }) => {
  const f = drawing();
  f.fenestrations[0].offset = 1.5;
  const { at } = await open(page, f);
  await key(page, 'stretch').click();
  await stretchTopUp(page, at);
  const d = await saved(page);
  expect(d.fenestrations[0].offset, 'it stays 1\'-6" from the top it went up with').toBeCloseTo(1.5, 6);
});

test('an ASSEMBLY with a small part in the box moves whole', async ({ page }) => {
  const f = drawing({
    lines: [{ id: 'l1', start: P(3, -1), end: P(3, 4), levelId: 3, view: 'plan' },
      { id: 'l2', start: P(3, 4), end: P(7, 4), levelId: 3, view: 'plan' }],
    groups: [{ id: 'g1', name: 'BOX', members: [{ type: 'line', id: 'l1' }, { type: 'line', id: 'l2' }] }],
  });
  const { at } = await open(page, f);
  await key(page, 'stretch').click();
  // A BOX ROUND THE TOP EDGE THAT CATCHES ONLY THE TIP OF l1.
  await press(page, at, -2, -2);
  await press(page, at, 12, 0.5);
  await press(page, at, 0, 0);
  await press(page, at, 0, -5);
  const d = await saved(page);
  const l1 = d.lines.find(l => l.id === 'l1'), l2 = d.lines.find(l => l.id === 'l2');
  expect([l1.start.z, l1.end.z, l2.start.z, l2.end.z], 'every point 5 ft up -- intact').toEqual([-6, -1, -1, -1].map(z => expect.closeTo(z, 6)));
});

test('a SUITE hologram the box touches moves whole', async ({ page }) => {
  const suite = { version: 1, levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
    walls: [W('s1', [2, 1], [8, 1]), W('s2', [8, 1], [8, 6])] };
  const f = drawing({ holograms: [{ id: 'hologram-1', name: 'suite', x: 0, z: 0, angleDeg: 0, pivotX: 0, pivotZ: 0,
    mode: 'suite', source: suite }] });
  const { at } = await open(page, f);
  await key(page, 'stretch').click();
  await stretchTopUp(page, at);
  const d = await saved(page);
  expect(d.holograms[0].x).toBeCloseTo(0, 6);
  expect(d.holograms[0].z, 'the suite went up with the edge').toBeCloseTo(-5, 6);
});

test('a typed length finishes it, along the way the cursor points', async ({ page }) => {
  const { at } = await open(page);
  await key(page, 'stretch').click();
  await press(page, at, -2, -2);
  await press(page, at, 12, 2);
  await press(page, at, 0, 0);
  await page.mouse.move(...at(0, -3));
  await page.waitForTimeout(100);
  const box = page.locator('#frozen-length');
  await expect(box).toBeEnabled();
  await expect(box, 'it reads the pull so far').toHaveValue(/^3'/);
  await box.fill("7'6");
  await box.press('Enter');
  const d = await saved(page);
  expect(wall(d, 'n').start.z).toBeCloseTo(-7.5, 6);
  expect(wall(d, 'e').start.z).toBeCloseTo(-7.5, 6);
});

test('Esc puts a half-made box down and STRETCH stays up', async ({ page }) => {
  const { at } = await open(page);
  await key(page, 'stretch').click();
  await press(page, at, -2, -2);
  await press(page, at, 12, 2);
  await page.keyboard.press('Escape');
  await expect(key(page, 'stretch')).toHaveAttribute('aria-pressed', 'true');
  // A FRESH BOX FROM HERE STILL WORKS.
  await stretchTopUp(page, at);
  const d = await saved(page);
  expect(wall(d, 'n').start.z).toBeCloseTo(-5, 6);
});
