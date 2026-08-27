// While an OUTLINE is being drawn, R freezes the segment so an exact length
// can be typed — same flow as Line / Wall. A finished outline edge edits like
// Node / Arc: a dead-centre press drops a new node there, a press beside the
// edge pulls the segment into an arc. Master edits reach every level copy,
// level edits become local overrides.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function dragWorld(page, fromX, fromZ, toX, toZ) {
  const from = await h.worldToClient(page, fromX, fromZ);
  const to = await h.worldToClient(page, toX, toZ);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await h.waitForSaved(page);
}

async function drawOutlineRect(page) {
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.climbTourToMain(page);
}

test('R types an exact segment length while an outline is being drawn', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Outline');

  await h.clickWorld(page, 0, 0);
  await h.clickWorld(page, 10, 0);

  // Typed segment: aim north, freeze, type 10 ft.
  await h.moveTo(page, 10, -5);
  await page.keyboard.press('r');
  await page.keyboard.type('10');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);

  // The outline is still in progress — close it back onto the first point.
  await h.clickWorld(page, 0, -10);
  await h.clickWorld(page, 0, 0);
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.boneyardOutlines).toHaveLength(1);
  const master = saved.boneyardOutlines[0];
  expect(master.points).toHaveLength(4);
  expect(master.points.some(p => h.near(p.x, 10) && h.near(p.z, -10))).toBe(true);
});

test('arcing a master edge on the BONEYARD curves every level copy and survives a reload', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);

  await page.locator('.level-name', { hasText: 'BONEYARD' }).click();
  await page.waitForTimeout(300);
  await h.selectTool(page, 'Outline');
  await dragWorld(page, 0, -5.4, 0, -2); // grab beside the bottom edge → arc

  let saved = await h.savedDrawing(page);
  const master = saved.boneyardOutlines[0];
  const arced = master.points.find(p => Math.abs(p.bulge || 0) > 0.5);
  expect(arced).toBeTruthy();
  saved.outlines.forEach(outline => {
    const copy = outline.points.find(p => p.srcId === arced.id);
    expect(copy.bulge).toBeCloseTo(arced.bulge, 3);
  });

  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await h.waitForModelReady(page);

  saved = await h.savedDrawing(page);
  const restored = saved.boneyardOutlines[0].points.find(p => p.id === arced.id);
  expect(restored.bulge).toBeCloseTo(arced.bulge, 3);
  saved.outlines.forEach(outline => {
    expect(outline.points.find(p => p.srcId === arced.id).bulge).toBeCloseTo(arced.bulge, 3);
  });
});

test('arcing a level edge stays local and survives a later master edit', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page); // drawn on MAIN FL

  // Arc the level copy's bottom edge on MAIN FL — grabbed beside the edge.
  await h.selectTool(page, 'Outline');
  await dragWorld(page, 0, -5.4, 0, -2);

  let saved = await h.savedDrawing(page);
  // The master stays straight; only the MAIN FL copy is arced and overridden.
  saved.boneyardOutlines[0].points.forEach(p => expect(p.bulge || 0).toBe(0));
  const main = saved.outlines.find(o => o.levelId === 3);
  const arced = main.points.find(p => Math.abs(p.bulge || 0) > 0.5);
  expect(arced).toBeTruthy();
  expect(main.overriddenSrcIds).toContain(arced.srcId);
  saved.outlines.filter(o => o.levelId !== 3).forEach(outline => {
    outline.points.forEach(p => expect(p.bulge || 0).toBe(0));
  });

  // A master edit elsewhere still reaches MAIN FL without flattening the arc.
  await page.locator('.level-name', { hasText: 'BONEYARD' }).click();
  await page.waitForTimeout(300);
  await h.selectTool(page, 'Select');
  await dragWorld(page, 8, 6, 12, 10);

  saved = await h.savedDrawing(page);
  const after = saved.outlines.find(o => o.levelId === 3);
  expect(after.points.some(p => h.near(p.x, 12) && h.near(p.z, 10))).toBe(true);
  expect(after.points.find(p => p.srcId === arced.srcId).bulge).toBeCloseTo(arced.bulge, 3);
});

test('a dead-centre press on a master edge drops a node onto every level copy', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);

  await page.locator('.level-name', { hasText: 'BONEYARD' }).click();
  await page.waitForTimeout(300);
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, 0, -6); // dead-centre on the bottom edge
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  const master = saved.boneyardOutlines[0];
  expect(master.points).toHaveLength(5);
  const added = master.points.find(p => h.near(p.x, 0) && h.near(p.z, -6));
  expect(added).toBeTruthy();
  saved.outlines.forEach(outline => {
    expect(outline.points).toHaveLength(5);
    const copy = outline.points.find(p => p.srcId === added.id);
    expect(copy).toBeTruthy();
    expect(h.near(copy.x, 0) && h.near(copy.z, -6)).toBe(true);
  });
});

test('a node dropped on a level edge is draggable right away and stays local', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page); // drawn on MAIN FL

  // Press dead-centre on the bottom edge and drag: the new node follows.
  await h.selectTool(page, 'Outline');
  await dragWorld(page, 0, -6, 0, -3);

  const saved = await h.savedDrawing(page);
  // The master keeps its four corners; only the MAIN FL copy gained the node.
  expect(saved.boneyardOutlines[0].points).toHaveLength(4);
  const main = saved.outlines.find(o => o.levelId === 3);
  expect(main.points).toHaveLength(5);
  const added = main.points.find(p => h.near(p.x, 0) && h.near(p.z, -3));
  expect(added).toBeTruthy();
  expect(added.srcId).toBe(null);
  saved.outlines.filter(o => o.levelId !== 3).forEach(outline => {
    expect(outline.points).toHaveLength(4);
  });
});
