// THE HOLOGRAMS IN THE BONEYARD (Movie, 25 Oct): "at the bottom of the 2 main
// viewports in that column area place the different HOLOGRAM types - if there
// are multiples of each type - allow the user to turn on or off the types ...
// and put them in the same color as their card colors in the model area" --
// "and then show them if they are turned on", "start off and don't allow them
// to be edited in this area", "only allw them to go on or off".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
  { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
  { id: 1, name: 'FOUNDATION', elev: -8 }];
const empty = () => ({
  version: 1, planTurn: 0, levels: LEVELS, activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});
const W = (id, levelId, a, b) => ({ id, levelId, view: 'plan', wallType: 'stud_2x4', refLine: 'center',
  baseHeight: 0, topHeight: 8, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
// A 10' SQUARE SUITE ON MAIN FL, a file brought in twice; and a SHED file on
// 2ND FL, brought in once.
const box = (pre, levelId) => [W(`${pre}1`, levelId, [0, 0], [10, 0]), W(`${pre}2`, levelId, [10, 0], [10, 10]),
  W(`${pre}3`, levelId, [10, 10], [0, 10]), W(`${pre}4`, levelId, [0, 10], [0, 0])];
const holo = (id, name, x, walls, colour) => ({ id, name, x, z: 0, angleDeg: 0, pivotX: 0, pivotZ: 0, colour,
  source: { version: 1, levels: LEVELS, walls } });
const HOLOS = [holo('hologram-1', 'SUITE A', -6, box('a', 3), 1), holo('hologram-2', 'SUITE A', 6, box('a', 3), 1),
  holo('hologram-3', 'SHED', 0, box('s', 5), 2)];

async function open(page) {
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
  // THE HOLOGRAMS PUT INTO THE SAVED FILE, as the model would have saved them.
  await page.evaluate(async ({ bucket, holos }) => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const d = JSON.parse(await file.text());
    d.holograms = holos;
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(d)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, holos: HOLOS });
  await page.goto('/BONEYARD.html');
  await expect(page.locator('body')).toHaveAttribute('data-boneyard-ready', '1', { timeout: 10000 });
}
const shown = async (page, canvas) => JSON.parse(await page.locator(canvas).getAttribute('data-holograms') || '[]');
const fileText = page => page.evaluate(async bucket => {
  const f = await window.SharedFileStore.loadSharedFile(bucket);
  return f.text();
}, BUCKET);

test('one button per hologram file at the foot of the levels column, in its card colour, its copies counted, all OFF', async ({ page }) => {
  await open(page);
  const buttons = page.locator('[data-bone-holo]');
  await expect(buttons).toHaveCount(2);
  await expect(page.locator('[data-bone-holo="SUITE A"]')).toContainText('×2');
  await expect(page.locator('[data-bone-holo="SHED"]')).not.toContainText('×');
  for (const b of await buttons.all()) await expect(b, 'off at the start').toHaveAttribute('aria-pressed', 'false');
  // IN ITS CARD COLOUR: hologram.js colourOf, which the model's cards use.
  const inks = await page.evaluate(() => {
    const H = window.DraftHologram;
    return [H.COLOURS[1].ink, H.COLOURS[2].ink].map(c => c.replace(/\s+/g, ''));
  });
  const swatch = name => page.locator(`[data-bone-holo="${name}"] .swatch`)
    .evaluate(el => getComputedStyle(el).backgroundColor.replace(/\s+/g, ''));
  expect(await swatch('SUITE A')).toBe(inks[0]);
  expect(await swatch('SHED')).toBe(inks[1]);
  // AT THE FOOT OF THE COLUMN, under the levels.
  const levelBottom = await page.locator('#legend').boundingBox();
  const holoBox = await page.locator('#holo-legend').boundingBox();
  expect(holoBox.y, 'below the levels').toBeGreaterThan(levelBottom.y + levelBottom.height);
  const pane = await page.locator('#bones2d').boundingBox();
  expect(holoBox.y + holoBox.height, 'down at the foot of the viewports').toBeGreaterThan(pane.y + pane.height - 80);
  expect(await shown(page, '#bones3d'), 'nothing drawn while off').toEqual([]);
});

test('ON draws the file in the 3D and on its own level flat; OFF takes it away; nothing is saved', async ({ page }) => {
  await open(page);
  const before = await fileText(page);
  await page.locator('[data-bone-holo="SUITE A"]').click();
  await expect(page.locator('[data-bone-holo="SUITE A"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await shown(page, '#bones3d'), 'both copies, eight walls').toEqual([{ name: 'SUITE A', walls: 8 }]);
  await page.locator('[data-bone-level="MAIN FL"]').click();
  expect(await shown(page, '#bones2d')).toEqual([{ name: 'SUITE A', walls: 8 }]);
  await page.locator('[data-bone-level="2ND FL"]').click();
  expect(await shown(page, '#bones2d'), 'not on 2ND FL').toEqual([{ name: 'SUITE A', walls: 0 }]);
  await page.locator('[data-bone-holo="SHED"]').click();
  expect(await shown(page, '#bones2d')).toEqual([{ name: 'SUITE A', walls: 0 }, { name: 'SHED', walls: 4 }]);
  await page.locator('[data-bone-holo="SUITE A"]').click();
  await page.locator('[data-bone-holo="SHED"]').click();
  expect(await shown(page, '#bones3d')).toEqual([]);
  expect(await fileText(page), 'only looked at: the file is as it was').toBe(before);
});

test('they start OFF again on the next opening', async ({ page }) => {
  await open(page);
  await page.locator('[data-bone-holo="SUITE A"]').click();
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-boneyard-ready', '1', { timeout: 10000 });
  await expect(page.locator('[data-bone-holo="SUITE A"]')).toHaveAttribute('aria-pressed', 'false');
  expect(await shown(page, '#bones3d')).toEqual([]);
});
