// Select picks a whole outline by clicking one of its dashed edges, and
// Delete on a level takes off only that level's copy: the BONEYARD master
// and the other floors' copies stay. Escape clears the pick first, so a
// Delete after it removes nothing.
//
// Moved from the old page (MODEL.dc.html) to MODEL.html, 28 Nov 2026. The
// old page's master delete and its "carries built geometry" refusal were
// old-page only and went with it.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const MASTER = {
  id: 'master-1', shelfId: 1,
  points: [{ id: 'p1', x: -8, z: -6 }, { id: 'p2', x: 8, z: -6 },
    { id: 'p3', x: 8, z: 6 }, { id: 'p4', x: -8, z: 6 }],
};
const copyOn = levelId => ({
  id: `copy-${levelId}`, levelId, masterId: 'master-1', overriddenSrcIds: [],
  points: MASTER.points.map(pt => ({ x: pt.x, z: pt.z, srcId: pt.id, offX: 0, offZ: 0 })),
});
const house = () => ({
  version: 1,
  levels: [{ id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 1,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [copyOn(5), copyOn(3), copyOn(1)], shapes: [], surfaceOpenings: [],
  stairs: [], notes: [], roomTags: [], columns: [], beams: [],
  boneyardOutlines: [MASTER], boneyardShelves: [{ id: 1, name: 'SHELF 1' }],
  groups: [], levelLocks: [], underlays: [], nextDrawingItemId: 50,
});

async function save(page) {
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
  return h.savedDrawing(page);
}

test('clicking an outline edge selects it and Delete removes the level copy locally', async ({ page }) => {
  await h.openEditor(page, { drawing: house(), webgl: false });
  const { at } = await h.planFrame(page);

  await page.mouse.click(...at(0, -6)); // middle of the bottom edge
  await page.waitForTimeout(150);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(150);

  const after = await save(page);
  expect(after.outlines.map(o => o.levelId).sort()).toEqual([1, 5]);
  // The master and the other level copies survive a local delete.
  expect(after.boneyardOutlines).toHaveLength(1);
});

test('Escape clears an outline selection', async ({ page }) => {
  await h.openEditor(page, { drawing: house(), webgl: false });
  const { at } = await h.planFrame(page);

  await page.mouse.click(...at(0, -6));
  await page.waitForTimeout(150);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Delete');
  await page.waitForTimeout(150);

  const saved = await save(page);
  expect(saved.outlines).toHaveLength(3);
  expect(saved.boneyardOutlines).toHaveLength(1);
});
