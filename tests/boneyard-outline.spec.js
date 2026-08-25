// The BONEYARD is shelf storage below the level stack — not a level. The
// OUTLINE tool draws a bright, never-printing building outline: the first one
// completed becomes the master on the active shelf and is copied to every
// level. Master edits move the common points everywhere; a level's own edits
// are locked RELATIVE — they ride their master point at the offset measured
// when they were adjusted, so master edits carry them along.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

function levelRow(page, name) {
  return page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: name }) });
}

async function switchLevel(page, name) {
  await levelRow(page, name).locator('.level-name').click();
  await page.waitForTimeout(300);
}

async function drawOutlineRect(page) {
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function dragWorld(page, fromX, fromZ, toX, toZ) {
  const from = await h.worldToClient(page, fromX, fromZ);
  const to = await h.worldToClient(page, toX, toZ);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await h.waitForSaved(page);
}

test('the first outline becomes the shelf master with a copy on every level', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);

  const saved = await h.savedDrawing(page);
  expect(saved.boneyardShelves).toEqual([{ id: 1, name: 'SHELF 1' }]);
  expect(saved.boneyardOutlines).toHaveLength(1);
  const master = saved.boneyardOutlines[0];
  expect(master.shelfId).toBe(1);
  expect(master.sourceLevelId).toBe(3); // drawn on MAIN FL
  expect(master.points).toHaveLength(4);
  master.points.forEach(p => expect(p.id).toBeTruthy());

  // One linked copy per level, on the OUTLINE layer, at exact coordinates.
  expect(saved.outlines).toHaveLength(saved.levels.length);
  saved.outlines.forEach(outline => {
    expect(outline.masterId).toBe(master.id);
    expect(outline.layer).toBe('OUTLINE');
    expect(outline.points).toHaveLength(4);
    expect(outline.points.some(p => h.near(p.x, -8) && h.near(p.z, -6))).toBe(true);
    expect(outline.points.some(p => h.near(p.x, 8) && h.near(p.z, 6))).toBe(true);
    outline.points.forEach(p => expect(master.points.some(mp => mp.id === p.srcId)).toBe(true));
  });
  expect(new Set(saved.outlines.map(o => o.levelId)).size).toBe(saved.levels.length);
});

test('a second outline on a level stays local to that level', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);

  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, 12, 8);
  await h.clickWorld(page, 16, 8);
  await h.clickWorld(page, 16, 12);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.boneyardOutlines).toHaveLength(1); // still one master
  const locals = saved.outlines.filter(o => !o.masterId);
  expect(locals).toHaveLength(1);
  expect(locals[0].levelId).toBe(3);
  expect(locals[0].points).toHaveLength(3);
});

test('editing the master on the BONEYARD moves the common points on every level', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);

  await page.locator('.level-name', { hasText: 'BONEYARD' }).click();
  await page.waitForTimeout(300);
  await h.selectTool(page, 'Select');
  await dragWorld(page, 8, 6, 12, 10);

  const saved = await h.savedDrawing(page);
  const master = saved.boneyardOutlines[0];
  expect(master.points.some(p => h.near(p.x, 12) && h.near(p.z, 10))).toBe(true);
  saved.outlines.forEach(outline => {
    expect(outline.points.some(p => h.near(p.x, 12) && h.near(p.z, 10))).toBe(true);
    expect(outline.points.some(p => h.near(p.x, 8) && h.near(p.z, 6))).toBe(false);
  });
});

test('a level edit stays local and survives a later master edit', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);

  // Local edit on 2ND FL: pull one corner out.
  await switchLevel(page, '2ND FL');
  await h.selectTool(page, 'Select');
  await dragWorld(page, 8, 6, 14, 11);

  let saved = await h.savedDrawing(page);
  const master = saved.boneyardOutlines[0];
  // The master did not move.
  expect(master.points.some(p => h.near(p.x, 14) && h.near(p.z, 11))).toBe(false);
  const second = saved.outlines.find(o => o.levelId === 5);
  expect(second.points.some(p => h.near(p.x, 14) && h.near(p.z, 11))).toBe(true);
  expect(second.overriddenSrcIds).toHaveLength(1);

  // Master edit to a DIFFERENT corner still reaches 2ND FL...
  await page.locator('.level-name', { hasText: 'BONEYARD' }).click();
  await page.waitForTimeout(300);
  await dragWorld(page, -8, -6, -12, -10);

  saved = await h.savedDrawing(page);
  const after = saved.outlines.find(o => o.levelId === 5);
  expect(after.points.some(p => h.near(p.x, -12) && h.near(p.z, -10))).toBe(true);
  // ...while the local override is untouched.
  expect(after.points.some(p => h.near(p.x, 14) && h.near(p.z, 11))).toBe(true);

  // Now drag the master's corner under the override: the override rides
  // along at its remembered offset (6, 5) — locked relative, not pinned.
  await dragWorld(page, 8, 6, 4, 2);
  saved = await h.savedDrawing(page);
  const final = saved.outlines.find(o => o.levelId === 5);
  expect(final.points.some(p => h.near(p.x, 10) && h.near(p.z, 7))).toBe(true);
  expect(final.points.some(p => h.near(p.x, 4) && h.near(p.z, 2))).toBe(false);
  // Levels without a local edit follow the master everywhere.
  const main = saved.outlines.find(o => o.levelId === 3);
  expect(main.points.some(p => h.near(p.x, 4) && h.near(p.z, 2))).toBe(true);
});

test('a relative override survives a reload and keeps riding the master', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);

  // A 2' cantilever off the master corner on 2ND FL.
  await switchLevel(page, '2ND FL');
  await h.selectTool(page, 'Select');
  await dragWorld(page, 8, 6, 10, 8);

  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await h.waitForModelReady(page);

  // Grow the master 4' east: the cantilever keeps its (2, 2) offset.
  await switchLevel(page, 'BONEYARD');
  await h.selectTool(page, 'Select');
  await dragWorld(page, 8, 6, 12, 6);

  const saved = await h.savedDrawing(page);
  const second = saved.outlines.find(o => o.levelId === 5);
  expect(second.points.some(p => h.near(p.x, 14) && h.near(p.z, 8))).toBe(true);
  const main = saved.outlines.find(o => o.levelId === 3);
  expect(main.points.some(p => h.near(p.x, 12) && h.near(p.z, 6))).toBe(true);
});

test('the BONEYARD card sits in the level stack with + SHELF in its head', async ({ page }) => {
  await h.openModel(page);

  // No standalone Boneyard heading outside the card — the card's own
  // BONEYARD name is the only label, and + SHELF lives inside the head row.
  await expect(page.locator('text=/^Boneyard$/')).toHaveCount(0);
  const card = page.locator('.level-body', { has: page.locator('.level-name', { hasText: 'BONEYARD' }) });
  await expect(card.locator('.level-head').getByRole('button', { name: '+ SHELF' })).toBeVisible();
});

test('the BONEYARD starts with one shelf and + SHELF adds and activates another', async ({ page }) => {
  await h.openModel(page);

  const shelves = page.locator('.level-layer', { hasText: 'SHELF' });
  await expect(shelves).toHaveCount(1);
  await page.getByRole('button', { name: '+ SHELF' }).click();
  await page.waitForTimeout(300);
  await expect(page.locator('.level-layer', { hasText: 'SHELF' })).toHaveCount(2);
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.boneyardShelves).toEqual([
    { id: 1, name: 'SHELF 1' },
    { id: 2, name: 'SHELF 2' },
  ]);
  expect(saved.activeBoneyardShelfId).toBe(2);
});

test('each shelf keeps its own master; only the active shelf gets the first outline', async ({ page }) => {
  await h.openModel(page);
  await page.getByRole('button', { name: '+ SHELF' }).click();
  await page.waitForTimeout(300);
  await switchLevel(page, 'MAIN FL');
  await drawOutlineRect(page);

  const saved = await h.savedDrawing(page);
  expect(saved.boneyardOutlines).toHaveLength(1);
  expect(saved.boneyardOutlines[0].shelfId).toBe(2);
});

test('outlines draw blue on a level, red on the BONEYARD, and survive a reload', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);

  // Blue #5980a6 on a floor level — edits there stay local to the level.
  const edge = await h.worldToClient(page, 0, -6);
  expect(h.countColor(await h.overlayPixels(page, edge.x, edge.y), [0x59, 0x80, 0xa6])).toBeGreaterThan(0);

  // Red #b04050 on the BONEYARD — edits there change every level.
  await switchLevel(page, 'BONEYARD');
  const masterEdge = await h.worldToClient(page, 0, -6);
  expect(h.countColor(await h.overlayPixels(page, masterEdge.x, masterEdge.y), [0xb0, 0x40, 0x50])).toBeGreaterThan(0);
  await switchLevel(page, 'MAIN FL');

  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await h.waitForModelReady(page);

  const saved = await h.savedDrawing(page);
  expect(saved.boneyardOutlines).toHaveLength(1);
  expect(saved.outlines).toHaveLength(saved.levels.length);
});

test('every drawing tool is available on the BONEYARD; Outline still makes a master', async ({ page }) => {
  await h.openModel(page);
  await page.locator('.level-name', { hasText: 'BONEYARD' }).click();
  await page.waitForTimeout(300);

  for (const name of ['Wall', 'Line', 'Floor', 'Shape', 'Roof', 'Dim']) {
    await expect(page.getByRole('button', { name: new RegExp(`\\b${name}`, 'i') }).first()).toBeEnabled();
  }

  // Outline drawn on the BONEYARD becomes a shelf master directly.
  await drawOutlineRect(page);
  const saved = await h.savedDrawing(page);
  expect(saved.boneyardOutlines).toHaveLength(1);
  expect(saved.boneyardOutlines[0].sourceLevelId).toBe(null);
});
