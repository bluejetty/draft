// THE HOLOGRAM CARD AS A LIST, AND A HOLOGRAM'S OWN HOLOGRAMS ON AND OFF.
//
// Movie, 21 Oct: "can it just LIST the items and show all the button for only
// the one the user has selected so it won't be as tall, and this menu could
// also go to 2 or 3 columns and be wider too"; "when a HOLOGRAM is brought in
// that has HOLOGRAMS within it - can we put a little button to show a list of
// the HOLOGRAMS within a HOLOGRAM and a checkbox beside all of them and allow
// the user to turn on and off the other holograms"; "can there also be a
// button on an imported hologram card where ALL its attached HOLOGRAMS can be
// NOT SHOWN / SHOWN".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const W = (id, a, b, levelId = 3) => ({ id, levelId, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 9, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 },
  { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
const EMPTY = { walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [],
  beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [] };
const SUITE = { version: 1, levels: LEVELS, activeLevelIdx: 2, ...EMPTY, suiteKind: 'residential',
  walls: [W('s1', [0, 30], [20, 30]), W('s2', [20, 30], [20, 15]), W('s3', [20, 15], [0, 15]), W('s4', [0, 15], [0, 30])] };
const inner = (id, x) => ({ id, name: `suite-${id}`, mode: 'suite', x, z: 0, angleDeg: 0, pivotX: 10, pivotZ: 22.5, source: SUITE });
const PHASE1 = { version: 1, levels: LEVELS, activeLevelIdx: 2, ...EMPTY,
  walls: [W('a', [0, 0], [60, 0]), W('b', [60, 0], [60, 30]), W('c', [60, 30], [0, 30]), W('d', [0, 30], [0, 0])],
  holograms: [inner('h1', 0), inner('h2', 20), inner('h3', 40)] };
const drawing = holograms => ({ version: 1, board: 'drafting', levels: LEVELS, activeLevelIdx: 2, ...EMPTY,
  walls: [W('x', [-30, 0], [-5, 0]), W('y', [-30, 30], [-5, 30])], holograms });
const PHASE = { id: 'p1', name: 'PHASE 1', x: 0, z: 0, angleDeg: 0, pivotX: 30, pivotZ: 15, source: PHASE1 };

async function open(page, holograms) {
  page.__errors = [];
  page.on('pageerror', err => page.__errors.push(String(err)));
  await h.openModel(page, { webgl: false });
  await page.evaluate(async f => window.SharedFileStore.saveSharedFile(
    new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), 'model-drawing'), drawing(holograms));
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.locator('[data-mode-hologram]').click();
  await expect(page.locator('#hologram-ask')).toBeVisible();
}
test.afterEach(async ({ page }) => { expect(page.__errors || [], 'no page errors').toEqual([]); });
async function saved(page) {
  await page.locator('[data-hologram-close]').click();
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const row = (page, id) => page.locator(`[data-hologram-row="${id}"]`);

test('two copies: each a one-line row, and only the picked one opens its buttons', async ({ page }) => {
  const copy = { ...PHASE, id: 'p2', x: 80 };
  await open(page, [PHASE, copy]);
  await expect(row(page, 'p1').locator('[data-hologram-mirror]')).toHaveCount(0);
  await expect(row(page, 'p2').locator('[data-hologram-mirror]')).toHaveCount(0);
  await row(page, 'p2').locator('[data-hologram-number]').click();
  await expect(row(page, 'p2')).toHaveAttribute('data-hologram-open', '');
  await expect(row(page, 'p2').locator('[data-hologram-mirror]')).toBeVisible();
  await expect(row(page, 'p1').locator('[data-hologram-mirror]')).toHaveCount(0);
  // PICKING THE OTHER MOVES THE BUTTONS.
  await row(page, 'p1').locator('[data-hologram-number]').click();
  await expect(row(page, 'p1').locator('[data-hologram-mirror]')).toBeVisible();
  await expect(row(page, 'p2').locator('[data-hologram-mirror]')).toHaveCount(0);
});

test('the card is wide, its file cards side by side', async ({ page }) => {
  const other = { ...PHASE, id: 'q1', name: 'PHASE 2', source: { ...PHASE1, holograms: [] }, x: 80 };
  await open(page, [PHASE, other]);
  const boxes = await page.locator('[data-hologram-file-card]').evaluateAll(els => els.map(el => el.getBoundingClientRect().top));
  expect(boxes.length).toBe(2);
  expect(Math.abs(boxes[0] - boxes[1]), 'two files on one row').toBeLessThan(2);
});

test('INSIDE lists its own holograms with a tick each; unticking one hides it, on every copy', async ({ page }) => {
  await open(page, [PHASE]);
  const inside = page.locator('[data-hologram-inside]');
  await expect(inside).toContainText('INSIDE (3/3)');
  await expect(page.locator('[data-hologram-inside-row]')).toHaveCount(0);
  await inside.click();
  await expect(page.locator('[data-hologram-inside-row]')).toHaveCount(3);
  await page.locator('[data-hologram-inside-row="h2"] input').uncheck();
  await expect(inside).toContainText('INSIDE (2/3)');
  const d = await saved(page);
  expect(d.holograms[0].hiddenInside).toEqual(['h2']);
  // NOT DRAWN: PHASE 1 and two of its suites.
  const drawn = await page.evaluate(d => window.DraftHologram.drawn(d).map(x => x.id), d);
  expect(drawn).toEqual(['p1', 'p1/h1', 'p1/h3']);
  // KEPT IN THE FILE: a reload still has it off.
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.locator('[data-mode-hologram]').click();
  await expect(page.locator('[data-hologram-inside]')).toContainText('INSIDE (2/3)');
});

test('HIDE ALL INSIDE takes every one away, SHOW ALL INSIDE brings them back, and UNDO takes the press back', async ({ page }) => {
  await open(page, [PHASE]);
  const all = page.locator('[data-hologram-inside-all]');
  await expect(all).toHaveText('HIDE ALL INSIDE');
  await all.click();
  await expect(all).toHaveText('SHOW ALL INSIDE');
  let d = await saved(page);
  expect([...d.holograms[0].hiddenInside].sort()).toEqual(['h1', 'h2', 'h3']);
  expect(await page.evaluate(d => window.DraftHologram.drawn(d).map(x => x.id), d)).toEqual(['p1']);
  // ONE UNDO TAKES THE PRESS BACK, and only it: the hologram hidden just
  // before stays hidden (with an empty undo list the key would step a
  // version instead, which proves nothing about this press).
  await page.keyboard.press('Control+z');
  await page.locator('[data-mode-hologram]').click();
  await expect(page.locator('[data-hologram-inside-all]')).toHaveText('HIDE ALL INSIDE');
  await page.locator('[data-hologram-show="p1"]').click();
  await page.locator('[data-hologram-inside-all]').click();
  await page.locator('[data-hologram-close]').click();
  await page.keyboard.press('Control+z');
  await page.locator('[data-mode-hologram]').click();
  await expect(page.locator('[data-hologram-inside-all]')).toHaveText('HIDE ALL INSIDE');
  await expect(page.locator('[data-hologram-show="p1"]'), 'still hidden').toHaveText('SHOW');
  await page.locator('[data-hologram-show="p1"]').click();
  // AND HIDE, THEN SHOW: all on again.
  await page.locator('[data-hologram-inside-all]').click();
  await page.locator('[data-hologram-inside-all]').click();
  d = await saved(page);
  expect(d.holograms[0].hiddenInside).toBeUndefined();
});

test('a hologram with nothing inside it has no INSIDE buttons', async ({ page }) => {
  await open(page, [{ ...PHASE, source: { ...PHASE1, holograms: [] } }]);
  await expect(page.locator('[data-hologram-inside]')).toHaveCount(0);
  await expect(page.locator('[data-hologram-inside-all]')).toHaveCount(0);
});
