// WALL OFF (Movie, 18 Oct).
//
// "on the WC and the KITCHENS. when a user clicks on a wall and is offered the
// BREAK or MOVE it, can you also offer to TURN OFF that wall (on one or two
// sides would be easier to use the HOUSE wall rather than the 'WC wall" --
// "the ones behind the shower and sink too, but each plan will be different".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const T6 = 5.5 / 12, T4 = 3.5 / 12;
const ZB = T6 / 2 + T4 / 2;                       // the WC's back wall, face on the house wall's face
const W = (id, a, b, t = 'stud_2x4') => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: t, refLine: 'center' });
const house = () => ({
  version: 1, planTurn: 0, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 20,
  walls: [W('wall-1', [-6, 0], [20, 0], 'stud_2x6'),
    W('wcb', [2, ZB], [10, ZB]), W('wcl', [2, ZB], [2, 6]), W('wcr', [10, ZB], [10, 6])],
  fixtures: [{ id: 'loo', wallId: 'wcb', levelId: 3, view: 'plan', kind: 'toilet', offset: 4, width: 1.7, depth: 2.4, side: 1 }],
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
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const pt = p => [Math.round(p.x * 1000) / 1000 + 0, Math.round(p.z * 1000) / 1000 + 0];

test('WALL OFF takes the WC wall away; the toilet hangs on the house wall where it stood; the side walls run on to its face; one UNDO', async ({ page }) => {
  const { at } = await open(page);
  await page.mouse.click(...at(4, ZB));
  await page.waitForTimeout(100);
  await expect(page.locator('#model-wall-off')).toBeVisible();
  await page.locator('#model-wall-off').click();
  let d = await saved(page);
  expect(d.walls.map(w => w.id)).not.toContain('wcb');
  const loo = d.fixtures.find(f => f.id === 'loo');
  expect([loo.wallId, Math.round(loo.offset * 1000) / 1000, loo.side]).toEqual(['wall-1', 12, 1]);   // x 6, from the house wall's start at -6
  expect(pt(d.walls.find(w => w.id === 'wcl').start), 'the side wall runs on to the house wall\'s face').toEqual([2, Math.round(T6 / 2 * 1000) / 1000]);
  expect(pt(d.walls.find(w => w.id === 'wcr').start)).toEqual([10, Math.round(T6 / 2 * 1000) / 1000]);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+z');
  d = await saved(page);
  expect(d.walls.map(w => w.id)).toContain('wcb');
  expect(d.fixtures.find(f => f.id === 'loo')).toMatchObject({ wallId: 'wcb', offset: 4 });
  expect(pt(d.walls.find(w => w.id === 'wcl').start)).toEqual([2, Math.round(ZB * 1000) / 1000]);
});

test('a wall with no house wall behind it is not offered WALL OFF', async ({ page }) => {
  const { at } = await open(page);
  await page.mouse.click(...at(2, 4));
  await page.waitForTimeout(100);
  await expect(page.locator('#delete')).toBeVisible();
  await expect(page.locator('#model-wall-off')).toBeHidden();
});
