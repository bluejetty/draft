// THE X THAT CLOSES A SHELF (Movie, 23 Oct): "on the SHELF layout views (and
// also in the layout level area on the left side where it says SHELF 1) can
// we have a little X (top right corner of the SHELF viewports centered above
// the bone. if they close one ask them if they want to save first or close
// without save".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const P = (x, z) => ({ x, y: 0, z });
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 },
  { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
const EMPTY = { walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [],
  beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [], holograms: [] };
const W = (id, a, b, levelId) => ({ id, start: P(...a), end: P(...b), levelId, view: 'plan',
  wallType: 'stud_2x4', refLine: 'center', baseHeight: 0, topHeight: 8 });
const box = (id, x, z, w, d, levelId) => [W(`${id}n`, [x, z], [x + w, z], levelId), W(`${id}e`, [x + w, z], [x + w, z + d], levelId),
  W(`${id}s`, [x + w, z + d], [x, z + d], levelId), W(`${id}w`, [x, z + d], [x, z], levelId)];
// The house on MAIN FL; a suite on each of two shelves.
const drawing = () => ({ version: 1, board: 'drafting', planTurn: 0, levels: LEVELS, activeLevelIdx: 2, ...EMPTY,
  walls: [...box('h', 0, 0, 60, 40, 3), ...box('s1', 100, 40, 20, 12, -1), ...box('s2', 0, 0, 24, 12, -2)],
  boneyardShelves: [{ id: 1, name: '1BDEN' }, { id: 2, name: '2BD' }],
  nextBoneyardShelfId: 3, activeBoneyardShelfId: 1, nextDrawingItemId: 60 });

async function open(page, url = '/MODEL.html?level=3&right=1') {
  page.__errors = [];
  page.on('pageerror', err => page.__errors.push(String(err)));
  await h.openModel(page, { webgl: false });
  // NO FILE PICKER, so a save is a download the test can read.
  await page.addInitScript(() => { try { delete window.showSaveFilePicker; } catch { window.showSaveFilePicker = undefined; } });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto(url);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  if (await page.locator('#shelf-previews').isHidden()) await page.locator('#shelf-tab').click();
  await expect(page.locator('.shelf-preview')).toHaveCount(2);
}
test.afterEach(async ({ page }) => { expect(page.__errors || [], 'no page errors').toEqual([]); });
const saved = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};
const card = page => page.locator('#shelf-close');
const squareX = (page, id) => page.locator(`.shelf-preview [data-shelf-close="${id}"]`);
const rowX = (page, id) => page.locator(`[data-shelf="${id}"] [data-shelf-close="${id}"]`);
const onShelf = d => id => d.walls.filter(w => w.levelId === -id).length;

test('an X sits top right of every square and at the end of every LEVELS shelf row; it asks, naming the shelf, and CANCEL keeps everything; the press neither enters the shelf nor drags it', async ({ page }) => {
  await open(page);
  for (const id of [1, 2]) {
    await expect(squareX(page, id)).toBeVisible();
    await expect(rowX(page, id)).toBeVisible();
    const sq = await page.locator(`[data-shelf-preview="${id}"]`).boundingBox();
    const x = await squareX(page, id).boundingBox();
    expect(x.x + x.width, 'at the square\'s right edge').toBeGreaterThan(sq.x + sq.width - 4);
    expect(x.y, 'at the square\'s top').toBeLessThan(sq.y + 4);
  }
  await squareX(page, 2).click();
  await expect(card(page)).toBeVisible();
  await expect(card(page)).toContainText('CLOSE 2BD?');
  await card(page).locator('[data-shelf-close-cancel]').click();
  await expect(card(page)).toBeHidden();
  // Still on MAIN FL: nothing entered the shelf.
  await expect(page.locator('.shelf-preview[data-active]')).toHaveCount(0);
  await expect(page.locator('[data-shelf][data-active]')).toHaveCount(0);
  const d = await saved(page);
  expect(d.boneyardShelves.map(s => s.name)).toEqual(['1BDEN', '2BD']);
  expect(onShelf(d)(2)).toBe(4);
  // The row's X asks too.
  await rowX(page, 1).click();
  await expect(card(page)).toContainText('CLOSE 1BDEN?');
  await card(page).locator('[data-shelf-close-cancel]').click();
  await expect(page.locator('[data-shelf][data-active]')).toHaveCount(0);
});

test('CLOSE WITHOUT SAVING takes the shelf and what is on it, and nothing else', async ({ page }) => {
  await open(page);
  await squareX(page, 2).click();
  await card(page).locator('[data-shelf-close-discard]').click();
  await expect(card(page)).toBeHidden();
  await expect(page.locator('#strip-message')).toContainText('2BD closed');
  await expect(page.locator('.shelf-preview')).toHaveCount(1);
  await expect(page.locator('[data-shelf]')).toHaveCount(1);
  const d = await saved(page);
  expect(d.boneyardShelves).toEqual([{ id: 1, name: '1BDEN' }]);
  expect(onShelf(d)(2), 'the closed shelf\'s walls went').toBe(0);
  expect(onShelf(d)(1), 'the other shelf\'s stayed').toBe(4);
  expect(d.walls.filter(w => w.levelId === 3), 'the house stayed').toHaveLength(4);
});

test('SAVE AS SUITE FIRST writes the shelf as a suite and then closes it; the kind question cancelled closes nothing', async ({ page }) => {
  await open(page);
  await rowX(page, 2).click();
  await card(page).locator('[data-shelf-close-save]').click();
  await expect(card(page)).toBeHidden();
  const kind = page.locator('#shelf-suite');
  await expect(kind).toBeVisible();
  await expect(kind).toContainText('SAVE 2BD AS A SUITE');
  await kind.locator('[data-shelf-suite-cancel]').click();
  await expect(kind).toBeHidden();
  await expect(page.locator('.shelf-preview'), 'nothing closed').toHaveCount(2);
  // Again, and through: the file lands, then the shelf goes.
  await rowX(page, 2).click();
  await card(page).locator('[data-shelf-close-save]').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    kind.locator('[data-shelf-suite-kind="residential"]').click(),
  ]);
  expect(download.suggestedFilename()).toBe('2BD.draft');
  const file = JSON.parse(require('fs').readFileSync(await download.path(), 'utf8'));
  expect(file.walls.map(w => w.id).sort()).toEqual(['s2e', 's2n', 's2s', 's2w']);
  expect(file.suiteKind).toBe('residential');
  await expect(page.locator('.shelf-preview')).toHaveCount(1);
  const d = await saved(page);
  expect(d.boneyardShelves.map(s => s.id)).toEqual([1]);
  expect(onShelf(d)(2)).toBe(0);
});

test('closing the shelf you stand on lands you on the other; the last shelf is emptied, not closed', async ({ page }) => {
  await open(page);
  await page.locator('[data-shelf-preview="2"]').click();
  await expect(page.locator('[data-shelf="2"]')).toHaveAttribute('data-active', '');
  await squareX(page, 2).click();
  await card(page).locator('[data-shelf-close-discard]').click();
  await expect(page.locator('#strip-message')).toContainText('you are on 1BDEN');
  await expect(page.locator('[data-shelf="1"]')).toHaveAttribute('data-active', '');
  let d = await saved(page);
  expect(d.activeBoneyardShelfId).toBe(1);
  // THE LAST ONE.
  await squareX(page, 1).click();
  await card(page).locator('[data-shelf-close-discard]').click();
  await expect(page.locator('#strip-message')).toContainText('last shelf');
  await expect(page.locator('.shelf-preview')).toHaveCount(1);
  d = await saved(page);
  expect(d.boneyardShelves).toEqual([{ id: 1, name: '1BDEN' }]);
  expect(onShelf(d)(1), 'emptied').toBe(0);
});
