// HOLOGRAM: ANOTHER .draft SHOWN UNDER THIS ONE, ON MODEL.html.
//
// Movie, 8 Oct: "can we keep that [the neighborhood program] and also allow
// users to bring DRAFT 'HOLOGRAM' into another file" -- "will use it to bring
// existing house onto a property that has another house being added or an
// addition to a house". Light blue, a copy kept on the file with REFRESH to
// pick the newer one, and nothing on it can be edited.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const BLANK = {
  version: 1, board: 'drafting', planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
};
const HOUSE = fs.readFileSync(path.join(__dirname, '..', 'proto', 'repro-movie-corner-garage.draft'));
const houseWalls = JSON.parse(HOUSE.toString('utf8')).walls.filter(w => w.levelId === 3);

async function open(page, drawing = BLANK) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    try { localStorage.removeItem('draft.trace.on'); } catch { /* fine */ }
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing });
  await page.goto('/MODEL.html?level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
const chip = page => page.locator('[data-mode-trace]');
// The card covers SAVE and UNDO while it is up, as it does for images.
const closeCard = async page => {
  if (await page.locator('#trace-ask').isVisible()) await page.locator('[data-trace-later]').click();
};
const undo = async page => {
  await closeCard(page);
  await page.locator('#model-undo').click();
};
const saved = async page => {
  await closeCard(page);
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};
const bringIn = async page => {
  await chip(page).click();
  await page.locator('[data-hologram-upload]').click();
  await page.locator('[data-hologram-file]').setInputFiles(
    { name: 'existing-house.draft', mimeType: 'application/json', buffer: HOUSE });
  await expect.poll(async () => (await saved(page)).holograms?.length || 0).toBe(1);
};
// Pixels the hologram's blue puts on the plan, centred on the house.
const bluePixels = page => page.evaluate(() => {
  const c = document.getElementById('plan');
  const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 2] > 150 && data[i + 2] - data[i] > 50) n += 1;
  }
  return n;
});

test('BRING IN keeps a copy of the other drawing, where its own file has it', async ({ page }) => {
  await open(page);
  await bringIn(page);
  const d = await saved(page);
  const [holo] = d.holograms;
  expect(holo.name).toBe('existing-house');
  expect([holo.x, holo.z, holo.angleDeg]).toEqual([0, 0, 0]);
  expect(holo.source.walls.filter(w => w.levelId === 3)).toHaveLength(houseWalls.length);
  // The house is drawn, in blue -- and it is not this drawing's.
  expect(d.walls).toHaveLength(0);
  expect(await bluePixels(page)).toBeGreaterThan(500);
  // And it is still there after the page is opened again.
  await page.goto('/MODEL.html?level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  expect(await bluePixels(page)).toBeGreaterThan(500);
});

test('HIDE takes the blue off, SHOW puts it back', async ({ page }) => {
  await open(page);
  await bringIn(page);
  await chip(page).click();
  await chip(page).click();
  await page.locator('[data-hologram-show]').click();
  await page.locator('[data-trace-later]').click();
  expect(await bluePixels(page)).toBeLessThan(50);
  expect((await saved(page)).holograms[0].hidden).toBe(true);
  await chip(page).click();
  await chip(page).click();
  await page.locator('[data-hologram-show]').click();
  await page.locator('[data-trace-later]').click();
  expect(await bluePixels(page)).toBeGreaterThan(500);
});

test('MOVE drags it, the arrows and [ ] turn it, and UNDO undoes each', async ({ page }) => {
  await open(page);
  await bringIn(page);
  await chip(page).click();
  await chip(page).click();
  await page.locator('[data-hologram-right]').click();
  expect((await saved(page)).holograms[0].angleDeg).toBe(90);
  await chip(page).click();
  await chip(page).click();
  await page.locator('[data-hologram-move]').click();
  // Turned while it is in hand; the drag that follows puts it down.
  await page.keyboard.press(']');
  await page.keyboard.press('Shift+BracketLeft');
  const box = await page.locator('#plan').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 60, cy + 30, { steps: 4 });
  await page.mouse.up();
  let holo = (await saved(page)).holograms[0];
  expect(holo.x).toBeGreaterThan(0.5);
  expect(Math.abs(holo.x / holo.z - 2)).toBeLessThan(0.05);
  expect(holo.angleDeg).toBe(104);
  // UNDO: the drag, the 1, the 15, the quarter -- one at a time.
  await undo(page);
  holo = (await saved(page)).holograms[0];
  expect([holo.x, holo.z]).toEqual([0, 0]);
  for (const angle of [105, 90]) {
    await undo(page);
    expect((await saved(page)).holograms[0].angleDeg).toBe(angle);
  }
  await undo(page);
  expect((await saved(page)).holograms[0].angleDeg).toBe(0);
});

test('REFRESH swaps in the newer file and keeps where it sits', async ({ page }) => {
  const placed = JSON.parse(HOUSE.toString('utf8'));
  placed.walls = placed.walls.slice(0, 3);
  await open(page, { ...BLANK, holograms: [{ id: 'hologram-1', name: 'old', x: 4, z: -2,
    angleDeg: 90, pivotX: 0, pivotZ: 0, source: placed }] });
  await chip(page).click();
  await page.locator('[data-hologram-refresh]').click();
  await page.locator('[data-hologram-file]').setInputFiles(
    { name: 'existing-house.draft', mimeType: 'application/json', buffer: HOUSE });
  await expect.poll(async () => (await saved(page)).holograms[0].name).toBe('existing-house');
  const holo = (await saved(page)).holograms[0];
  expect([holo.x, holo.z, holo.angleDeg]).toEqual([4, -2, 90]);
  expect(holo.source.walls.length).toBeGreaterThan(3);
  await undo(page);
  expect((await saved(page)).holograms[0].source.walls).toHaveLength(3);
});

test('DELETE takes it off, UNDO brings it back, and its own holograms never come in', async ({ page }) => {
  const nested = { ...JSON.parse(HOUSE.toString('utf8')),
    holograms: [{ id: 'hologram-1', source: JSON.parse(HOUSE.toString('utf8')) }] };
  await open(page);
  await chip(page).click();
  await page.locator('[data-hologram-upload]').click();
  await page.locator('[data-hologram-file]').setInputFiles(
    { name: 'nested.draft', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(nested)) });
  await expect.poll(async () => (await saved(page)).holograms?.length || 0).toBe(1);
  expect((await saved(page)).holograms[0].source.holograms).toBeUndefined();
  await chip(page).click();
  await chip(page).click();
  await page.locator('[data-hologram-delete]').click();
  await expect(page.locator('[data-hologram-row]')).toHaveCount(0);
  expect((await saved(page)).holograms).toHaveLength(0);
  await undo(page);
  expect((await saved(page)).holograms).toHaveLength(1);
});

test('a file that is not a drawing is refused, and nothing is added', async ({ page }) => {
  await open(page);
  await chip(page).click();
  await page.locator('[data-hologram-upload]').click();
  await page.locator('[data-hologram-file]').setInputFiles(
    { name: 'notes.draft', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await expect(page.locator('body')).toContainText('is not a drawing this page can read');
  expect((await saved(page)).holograms).toBeUndefined();
});
