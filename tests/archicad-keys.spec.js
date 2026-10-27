// SHIFT HOLDS SQUARE, T LATCHES THE T-SQUARE, CTRL+G GROUPS (Movie, 27 Oct).
//
// "i was using ARCHICAD again this morning. it has the SHIFT for the 90
// degree lines (like our T SQUARE) i think i'd like to try to get it working
// fairly similar to ARCHICAD, but also change it so it s a little better" --
// the plan he ticked: Shift held = square; T latches the T-square and Shift
// then frees it; lining up on a node and a wall's corners letting go move to
// Alt; and "i use CTL-G to group and CTL SHIFT G to ungroup".
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
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  return h.planFrame(page);
}
const chip = page => page.locator('#strip-tsquare');
// Where the run in hand would land with the hand at (x, z), from (2, 4).
const landing = (page, x, z) => page.evaluate(([px, pz]) => {
  drawStart = { x: 2, y: 0, z: 4 };
  const p = drawPoint({ x: px, y: 0, z: pz });
  drawStart = null;
  return [Math.round(p.x * 1000) / 1000, Math.round(p.z * 1000) / 1000];
}, [x, z]);

test('SHIFT held squares the run and lights the T-square; let go, the run is free again', async ({ page }) => {
  await open(page);
  await h.armFromRail(page, 'line');
  expect(await landing(page, 9, 5.3)).toEqual([9, 5.3]);
  await expect(chip(page)).not.toHaveClass(/\blit\b/);
  await page.keyboard.down('Shift');
  expect(await landing(page, 9, 5.3)).toEqual([9, 4]);
  await expect(chip(page)).toHaveClass(/\blit\b/);
  await page.keyboard.up('Shift');
  expect(await landing(page, 9, 5.3)).toEqual([9, 5.3]);
  await expect(chip(page)).not.toHaveClass(/\blit\b/);
});

test('T latches the T-square down; SHIFT then frees the run while held; T again lifts it', async ({ page }) => {
  await open(page);
  await h.armFromRail(page, 'line');
  await page.keyboard.press('t');
  await expect(chip(page)).toHaveClass(/\blit\b/);
  expect(await landing(page, 9, 5.3)).toEqual([9, 4]);
  await page.keyboard.down('Shift');
  expect(await landing(page, 9, 5.3), 'SHIFT frees a latched T-square').toEqual([9, 5.3]);
  await expect(chip(page)).not.toHaveClass(/\blit\b/);
  await page.keyboard.up('Shift');
  expect(await landing(page, 9, 5.3)).toEqual([9, 4]);
  await page.keyboard.press('t');
  await expect(chip(page)).not.toHaveClass(/\blit\b/);
  expect(await landing(page, 9, 5.3)).toEqual([9, 5.3]);
});

test('SHIFT-dragging a wall by its middle slides it straight across, its corners still joined', async ({ page }) => {
  const { at } = await open(page);
  await page.mouse.click(...at(10, 0));
  await page.waitForTimeout(100);
  await page.mouse.move(...at(10, 0));
  await page.mouse.down();
  await page.keyboard.down('Shift');
  await page.mouse.move(...at(11, 0.5), { steps: 5 });
  await page.mouse.move(...at(12.5, 1), { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  const ends = await page.evaluate(() => {
    const w = id => drawing.walls.find(x => x.id === id);
    const r = p => [Math.round(p.x * 100) / 100 + 0, Math.round(p.z * 100) / 100 + 0];
    return { moved: [r(w('wall-1').start), r(w('wall-1').end)], side: r(w('wall-2').start) };
  });
  expect(ends.moved, 'across only: the 2.5\' along the hand went nowhere').toEqual([[0, 1], [20, 1]]);
  expect(ends.side, 'the side wall kept the corner and stretched').toEqual([20, 1]);
});

test('CTRL+G makes what is picked one assembly; CTRL+SHIFT+G ungroups it', async ({ page }) => {
  const { at } = await open(page);
  await page.mouse.click(...at(10, 0));
  await page.keyboard.down('Shift');
  await page.mouse.click(...at(20, 7));
  await page.keyboard.up('Shift');
  await page.keyboard.press('Control+g');
  const made = await page.evaluate(() => drawing.groups.map(g => g.members.map(m => m.id).sort()));
  expect(made).toEqual([['wall-1', 'wall-2']]);
  await page.keyboard.press('Control+Shift+g');
  expect(await page.evaluate(() => drawing.groups.length)).toBe(0);
  // Nothing picked: the strip says so and nothing is made.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+g');
  expect(await page.evaluate(() => drawing.groups.length)).toBe(0);
});
