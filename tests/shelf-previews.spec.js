// THE SHELF PREVIEWS ABOVE THE BONE (Movie, 23 Oct, with a mockup): "can we
// add little square preview windows showing the SHELF items. if only one
// make it centered above the bone, if more are added continue to center them
// above the bone" -- "make those SHELF squares retractable into a SHELFS tab
// that will be positioned just above the bone when closed (centered)" -- and
// "when a user enters a SHELF can the zoom go to center the item in the
// viewport and leave a little extra space on the sides".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b, levelId) => ({ id, levelId, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 9, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 },
  { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
const EMPTY = { walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [],
  beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [] };
// A house on MAIN FL; a 20 x 15 suite on SHELF 1, off to one side so a fit
// has to move; SHELF 2 empty.
const drawing = (shelfCount = 2) => ({ version: 1, board: 'drafting', levels: LEVELS, activeLevelIdx: 2, ...EMPTY,
  walls: [W('a', [0, 0], [60, 0], 3), W('b', [60, 0], [60, 30], 3),
    W('s1', [100, 40], [120, 40], -1), W('s2', [120, 40], [120, 55], -1), W('s3', [120, 55], [100, 55], -1), W('s4', [100, 55], [100, 40], -1)],
  boneyardShelves: [{ id: 1, name: 'SHELF 1' }, { id: 2, name: 'SHELF 2' }].slice(0, shelfCount),
  nextBoneyardShelfId: 3, activeBoneyardShelfId: 1 });

async function open(page, f = drawing()) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html?level=3&right=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
const strip = page => page.locator('#shelf-strip');
const previews = page => page.locator('.shelf-preview');
const centreX = async loc => { const b = await loc.boundingBox(); return b.x + b.width / 2; };
// How much of a canvas is drawn on: the share of pixels with any alpha.
const inked = screen => screen.evaluate(c => {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i]) n += 1;
  return n / (d.length / 4);
});

test('one square per shelf, the row centred above the bone, the suite drawn in its square', async ({ page }) => {
  await open(page);
  await expect(previews(page)).toHaveCount(2);
  await expect(previews(page).nth(0)).toContainText('SHELF 1');
  const bone = page.locator('#bone');
  expect(Math.abs(await centreX(strip(page)) - await centreX(bone)), 'centred on the bone').toBeLessThan(2);
  const stripBox = await strip(page).boundingBox(), trioBox = await page.locator('#dt-trio').boundingBox();
  expect(stripBox.y + stripBox.height, 'above the trio').toBeLessThanOrEqual(trioBox.y + 1);
  await expect.poll(() => inked(previews(page).nth(0).locator('canvas')), 'SHELF 1 is drawn').toBeGreaterThan(0.002);
  expect(await inked(previews(page).nth(1).locator('canvas')), 'SHELF 2 is empty').toBe(0);
});

test('one shelf: the lone square is centred above the bone', async ({ page }) => {
  await open(page, drawing(1));
  await expect(previews(page)).toHaveCount(1);
  expect(Math.abs(await centreX(previews(page).first()) - await centreX(page.locator('#bone')))).toBeLessThan(2);
});

test('a press on a square enters that shelf, framed with room at the sides; the square lights', async ({ page }) => {
  await open(page);
  await previews(page).nth(0).click();
  await expect(page.locator('#readout'), 'the shelf\'s four walls of the six').toContainText('walls 4/6');
  await expect(previews(page).nth(0)).toHaveAttribute('data-active', '');
  await expect(page.locator('[data-shelf="1"]')).toHaveAttribute('data-active', '');
  const { cx, cz, scale, box } = await h.planFrame(page);
  expect(Math.abs(cx - 110), 'centred on the suite').toBeLessThan(0.5);
  expect(Math.abs(cz - 47.5)).toBeLessThan(2);
  const across = 20 * scale / box.width;
  expect(across, 'the suite takes well under the whole width').toBeLessThan(0.8);
  expect(across, 'but is not lost in it').toBeGreaterThan(0.2);
});

test('the SHELVES tab puts the squares away and brings them back, and a reload remembers', async ({ page }) => {
  await open(page);
  await expect(page.locator('#shelf-previews')).toBeVisible();
  await page.locator('#shelf-tab').click();
  await expect(page.locator('#shelf-previews')).toBeHidden();
  await expect(strip(page)).toHaveAttribute('data-open', 'false');
  expect(Math.abs(await centreX(page.locator('#shelf-tab')) - await centreX(page.locator('#bone'))), 'the tab centred above the bone').toBeLessThan(2);
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect(page.locator('#shelf-previews')).toBeHidden();
  await page.locator('#shelf-tab').click();
  await expect(page.locator('#shelf-previews')).toBeVisible();
});

test('+ SHELF adds a square, and the row stays centred on the bone', async ({ page }) => {
  await open(page);
  await h.openModelRail(page);
  await page.getByRole('button', { name: '+ SHELF', exact: true }).click();
  await expect(previews(page)).toHaveCount(3);
  expect(Math.abs(await centreX(strip(page)) - await centreX(page.locator('#bone')))).toBeLessThan(2);
});
