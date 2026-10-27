// THE VIEW KEYS (Movie, 27 Oct -- the ARCHICAD keys he ticked): Ctrl+' fits,
// Ctrl+[ / Ctrl+] step back and on through the zooms, Shift+F2 / Ctrl+F2 and
// Page Up / Page Down change level, F3 opens the 3D WIREFRAME, and the arrows
// nudge what is picked as MOVE carries it -- an inch, a foot with Ctrl --
// each press one UNDO.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const W = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center' });
const house = () => ({
  version: 1, planTurn: 0, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 20,
  walls: [W('wall-1', [0, 0], [20, 0]), W('wall-2', [20, 0], [20, 14]),
    W('wall-3', [20, 14], [0, 14]), W('wall-4', [0, 14], [0, 0])],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
});
async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'd.json', { type: 'application/json' }), bucket);
  }, { bucket: h.STORAGE_BUCKET, f: house() });
  await page.goto('/MODEL.html?level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  return h.planFrame(page);
}
const viewOf = page => page.evaluate(() => Math.round(view.scale * 1000) / 1000);
const levelOf = page => page.evaluate(() => activeLevelId());
const wallEnds = (page, id) => page.evaluate(wid => {
  const w = drawing.walls.find(x => x.id === wid);
  const r = v => Math.round(v * 1e4) / 1e4 + 0;
  return [r(w.start.x), r(w.start.z), r(w.end.x), r(w.end.z)];
}, id);

test("CTRL+' fits; CTRL+[ steps back to the zoom before it and CTRL+] on again", async ({ page }) => {
  const { at } = await open(page);
  await page.keyboard.press('0');
  const fitted = await viewOf(page);
  await page.mouse.move(...at(10, 7));
  for (let i = 0; i < 4; i += 1) await page.mouse.wheel(0, -200);
  const zoomed = await viewOf(page);
  expect(zoomed).toBeGreaterThan(fitted);
  await page.keyboard.press("Control+'");
  expect(await viewOf(page), "CTRL+' fits").toBe(fitted);
  await page.keyboard.press('Control+[');
  expect(await viewOf(page), 'back to the zoom').toBe(zoomed);
  await page.keyboard.press('Control+[');
  expect(await viewOf(page), 'and back to the fit before the wheel').toBe(fitted);
  await page.keyboard.press('Control+]');
  expect(await viewOf(page), 'on again').toBe(zoomed);
});

test('PAGE UP / PAGE DOWN and SHIFT+F2 / CTRL+F2 go up and down a level', async ({ page }) => {
  await open(page);
  expect(await levelOf(page)).toBe(3);
  await page.keyboard.press('PageUp');
  expect(await levelOf(page), 'up to 2ND FL').toBe(5);
  await page.keyboard.press('PageDown');
  expect(await levelOf(page)).toBe(3);
  await page.keyboard.press('Control+F2');
  expect(await levelOf(page), 'down to FOUNDATION').toBe(1);
  await page.keyboard.press('Shift+F2');
  expect(await levelOf(page)).toBe(3);
});

test('the arrows nudge a picked wall an inch, CTRL+arrow a foot, as MOVE does, and each press is one UNDO', async ({ page }) => {
  const { at } = await open(page);
  await page.mouse.click(...at(20, 7));
  await page.waitForTimeout(100);
  await page.keyboard.press('ArrowRight');
  expect(await wallEnds(page, 'wall-2')).toEqual([20 + 1 / 12, 0, 20 + 1 / 12, 14].map(v => Math.round(v * 1e4) / 1e4));
  // MOVE's rule: what is picked goes on its own, the walls it met stay put.
  expect(await wallEnds(page, 'wall-1'), 'the wall it met stays where it was').toEqual([0, 0, 20, 0]);
  await page.keyboard.press('Control+ArrowLeft');
  expect(await wallEnds(page, 'wall-2')).toEqual([19.0833, 0, 19.0833, 14]);
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  expect(await wallEnds(page, 'wall-2'), 'two UNDOs, two presses back').toEqual([20, 0, 20, 14]);
});

test('F3 opens the 3D WIREFRAME', async ({ page }) => {
  await open(page);
  await Promise.all([page.waitForURL(/BONEYARD\.html/, { timeout: 10000 }), page.keyboard.press('F3')]);
});
