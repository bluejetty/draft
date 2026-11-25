// A PASTE THAT RUNS OFF THE SCREEN IS BROUGHT INTO VIEW.
//
// jb, 25 Nov 2026: site lines copied from one file and pasted into another
// landed, but were bigger than the screen, so the paste looked like nothing.
// "when the paste happens can it autozoom to show the object if it isn't
// within the screen". model/08 showPasted: all in view, the view is left
// alone; any point out, it centres on the paste and zooms OUT to hold it.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const W = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'left', baseHeight: 0, topHeight: 8 });
const drawing = () => ({
  version: 1, board: 'drafting', planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 20,
  walls: [W('long', [0, 0], [120, 0]), W('short', [0, 10], [6, 10])],
  lines: [], floors: [], roofs: [], dimensions: [], fenestrations: [], fixtures: [],
  outlines: [], shapes: [], surfaceOpenings: [], notes: [], stairs: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
});
async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), 'model-drawing');
  }, { f: drawing() });
  await page.goto('/MODEL.html?right=1&pane=levels&level=3&view=plan');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
}
const pick = (page, id) => page.evaluate(id => {
  setSelection([{ type: 'wall', item: drawing.walls.find(w => w.id === id) }]); paint();
}, id);
// Every end of every picked wall inside the canvas.
const allOnScreen = page => page.evaluate(() => selection.every(({ item }) => [item.start, item.end].every(p => {
  const s = toS(p);
  return s.x >= 0 && s.x <= cssW && s.y >= 0 && s.y <= cssH;
})));

test('a paste that runs off the screen zooms out to show it all', async ({ page }) => {
  await open(page);
  await pick(page, 'long');
  await page.locator('#copy').click();
  // Zoomed right in on the short wall: the 120 ft wall is far off both sides.
  await page.evaluate(() => { view.cx = 3; view.cz = 10; view.scale = 60; paint(); });
  await page.locator('#paste').click();
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => selection.length)).toBe(1);
  expect(await allOnScreen(page)).toBe(true);
  expect(await page.evaluate(() => view.scale)).toBeLessThan(60);
});

test('a paste already on the screen leaves the view where it was', async ({ page }) => {
  await open(page);
  await pick(page, 'short');
  await page.locator('#copy').click();
  await page.evaluate(() => { view.cx = 3; view.cz = 10; view.scale = 20; paint(); });
  const before = await page.evaluate(() => ({ cx: view.cx, cz: view.cz, scale: view.scale }));
  await page.keyboard.press('Control+v');
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => selection.length)).toBe(1);
  expect(await page.evaluate(() => ({ cx: view.cx, cz: view.cz, scale: view.scale }))).toEqual(before);
});
