// The store must not eat work (audit C3, M10, M4, M5, 1.1, 1.5).
//
// MODEL and LAYOUT both hold a whole copy of the same drawing file and both
// write the whole thing back. Until this board that was last-writer-wins with
// no contest: the sheet's copy of the house was whatever it read when the tab
// opened, so moving a viewport reverted an afternoon's drawing, and the Model
// Space's copy of the sheet was equally stale in the other direction. The
// bucket carries a revision now — a write that would land on top of someone
// else's is refused, and the loser re-reads, merges its own keys, and tries
// again.
//
// The rest of this file is the same theme at load: a coordinate we cannot read
// rejects its entity instead of quietly becoming the origin, a level takes ALL
// of its geometry with it when it is deleted, and a failed write is something
// the drafter can see on both pages.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

function levelRow(page, name) {
  return page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: name }) });
}

async function traceHouse(page, points) {
  await h.selectTool(page, 'Outline');
  for (const [x, z] of points) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.climbTourToMain(page);
}

async function drawLine(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

// Writes a drawing straight into the bucket the app loads from.
async function seedDrawing(page, drawing) {
  await page.evaluate(async ({ bucket, json }) => {
    const file = new File([json], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(file, bucket);
  }, { bucket: h.STORAGE_BUCKET, json: JSON.stringify(drawing) });
}

const ONE_WALL = (overrides = {}) => ({
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0, visible: true }],
  walls: [{
    id: 'wall-1',
    start: { x: 10, y: 0, z: 10 },
    end: { x: 20, y: 0, z: 10 },
    levelId: 3, view: 'plan', wallType: 'stud_2x6',
    baseHeight: 0, topHeight: 8, refLine: 'left',
    ...overrides,
  }],
  nextDrawingItemId: 2,
});

test('two tabs on one drawing: neither the sheet nor the model erases the other', async ({ page, context }) => {
  await h.openModel(page);
  await traceHouse(page, [[-10, -8], [10, -8], [10, 8], [-10, 8]]);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  const built = await h.savedDrawing(page);
  expect(built.walls.length).toBeGreaterThan(0);

  // A second tab opens the sheet. It snapshots the drawing as it stands.
  const layout = await context.newPage();
  await layout.goto('/LAYOUT.dc.html');
  await layout.waitForFunction(() => document.body.dataset.layoutReady === '1');

  // ── the model edits while the sheet sits open ──────────────────────────
  await page.bringToFront();
  await drawLine(page, -20, -20, -20, 20);
  const afterEdit = await h.savedDrawing(page);
  expect(afterEdit.lines.length).toBe(built.lines.length + 1);

  // ── the sheet writes ───────────────────────────────────────────────────
  // Any sheet change persists. The line drawn a moment ago is NOT in the copy
  // this tab loaded, so an unguarded write would take it away.
  await layout.bringToFront();
  await layout.getByRole('button', { name: /8\.5 × 11/i }).click();
  await layout.waitForFunction(() => Number(document.body.dataset.layoutSaveSeq || 0) > 0);
  await layout.waitForFunction(() => document.body.dataset.layoutSaveDirty === '0');

  let stored = await h.savedDrawing(layout);
  expect(stored.lines.length, 'the model edit survives a sheet write').toBe(afterEdit.lines.length);
  expect(stored.walls.length).toBe(built.walls.length);
  expect(stored.layout.paperKey, 'and the sheet change really landed').toBe('8.5x11');

  // ── and the other way round ────────────────────────────────────────────
  // The model tab has been holding its own stale copy of `layout` since before
  // that paper change. Its next save must not put the old sheet back.
  await page.bringToFront();
  await drawLine(page, 20, -20, 20, 20);
  stored = await h.savedDrawing(page);
  expect(stored.layout.paperKey, 'the sheet change survives a model write').toBe('8.5x11');
  expect(stored.lines.length).toBe(afterEdit.lines.length + 1);

  // ── the third page ─────────────────────────────────────────────────────
  // PROJECT holds a whole copy of the same file too, and the bone's own
  // notice sends the drafter to it. It snapshots the drawing at load like the
  // other two, so it gets the same treatment: it may write its six keys and
  // nothing else.
  const project = await context.newPage();
  await project.goto('/PROJECT.html');
  await expect(project.locator('[data-project-name]')).toBeVisible();

  await page.bringToFront();
  await drawLine(page, -20, 20, 20, 20);
  const beforeProject = await h.savedDrawing(page);

  await project.bringToFront();
  await project.locator('[data-project-name]').fill('THE SMITH RESIDENCE');
  await project.locator('[data-project-name]').blur();
  await expect(project.locator('#status')).toContainText(/saved/i);

  stored = await h.savedDrawing(project);
  expect(stored.lines.length, 'the model edits survive a PROJECT write')
    .toBe(beforeProject.lines.length);
  expect(stored.walls.length).toBe(built.walls.length);
  expect(stored.layout.paperKey, 'and so does the sheet').toBe('8.5x11');
  expect(stored.projectInfo.name, 'and the project change really landed')
    .toBe('THE SMITH RESIDENCE');
});

test('a coordinate that cannot be read refuses its entity instead of moving it to the origin', async ({ page }) => {
  await h.openModel(page);
  // Exactly what JSON.stringify writes when a coordinate has gone NaN.
  await seedDrawing(page, ONE_WALL({ end: { x: null, y: 0, z: 10 } }));
  await page.reload();
  await h.waitForModelReady(page);

  // The drafter is told the file had something wrong with it. (Read before
  // the edit below: any edit clears the message.)
  await expect(page.locator('[data-model-drawing-message]')).toContainText(/incomplete/i);
  // And the wall is gone, not silently re-pointed at x = 0.
  await drawLine(page, -20, -20, -20, -18);
  const loaded = await h.savedDrawing(page);
  expect(loaded.walls).toHaveLength(0);
});

test('coerced junk — empty string, false, an array — is refused the same way', async ({ page }) => {
  await h.openModel(page);
  const drawing = ONE_WALL();
  drawing.walls.push(
    { ...drawing.walls[0], id: 'wall-2', start: { x: '', y: 0, z: 12 }, end: { x: 20, y: 0, z: 12 } },
    { ...drawing.walls[0], id: 'wall-3', start: { x: false, y: 0, z: 14 }, end: { x: [], y: 0, z: 14 } },
    // Zero length: no direction, so it cannot be drawn, dimensioned or offset.
    { ...drawing.walls[0], id: 'wall-4', start: { x: 4, y: 0, z: 16 }, end: { x: 4, y: 0, z: 16 } },
  );
  await seedDrawing(page, drawing);
  await page.reload();
  await h.waitForModelReady(page);

  await drawLine(page, -20, -20, -20, -18);
  const loaded = await h.savedDrawing(page);
  // Only the one real wall survives.
  expect(loaded.walls.map(wall => Math.round(wall.start.z))).toEqual([10]);
});

test('deleting a level takes ALL of its geometry with it', async ({ page }) => {
  await h.openModel(page);
  await traceHouse(page, [[-14, -10], [14, -10], [14, 10], [-14, 10]]);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);

  // Give 2ND FL something from each of the collections this method used to
  // forget: an opening, a note, and its room tags.
  await levelRow(page, '2ND FL').locator('.level-name').click();
  await page.waitForTimeout(300);
  await h.selectTool(page, 'Fenestration');
  await h.clickWorld(page, 0, -10);
  await h.waitForSaved(page).catch(() => {});
  await h.selectTool(page, 'Annotation');
  await page.locator('[data-room-tags]').click();
  await h.waitForSaved(page);

  const before = await h.savedDrawing(page);
  const secondId = before.levels.find(level => level.name === '2ND FL').id;
  // Every collection LEVEL_OWNED_COLLECTIONS carries, underlays included:
  // this list and that one have to stay the same length, or a collection can
  // be forgotten in the method AND in the test that guards it.
  const owned = drawing => ['walls', 'lines', 'floors', 'shapes', 'roofs', 'outlines',
    'surfaceOpenings', 'dimensions', 'columns', 'beams', 'fenestrations', 'fixtures',
    'stairs', 'notes', 'roomTags', 'underlays']
    .reduce((count, key) => count + (drawing[key] || [])
      .filter(item => item.levelId === secondId).length, 0);
  expect(owned(before), 'the level really owns geometry to lose').toBeGreaterThan(0);

  page.on('dialog', dialog => dialog.accept());
  await levelRow(page, '2ND FL').locator('text=×').first().click();
  await page.waitForTimeout(400);
  await h.waitForSaved(page);

  const after = await h.savedDrawing(page);
  expect(after.levels.some(level => level.id === secondId)).toBe(false);
  expect(owned(after), 'nothing may reference a level that no longer exists').toBe(0);

  // And a reload is clean: no leftovers means no "incomplete items" warning on
  // a drawing the drafter never damaged.
  await page.reload();
  await h.waitForModelReady(page);
  await expect(page.locator('[data-model-drawing-message]')).not.toContainText(/incomplete/i);
});

test('an orphan from an older build is cleared and reported as its own thing, not as damage', async ({ page }) => {
  await h.openModel(page);
  const drawing = ONE_WALL();
  // A wall on a level that is not in the file: what the old _deleteLevel left
  // behind. It is not damage, and saying so is the point.
  drawing.walls.push({ ...drawing.walls[0], id: 'wall-orphan', levelId: 99 });
  await seedDrawing(page, drawing);
  await page.reload();
  await h.waitForModelReady(page);

  const message = page.locator('[data-model-drawing-message]');
  await expect(message).toContainText(/no longer in the drawing/i);
  await expect(message).not.toContainText(/incomplete/i);
  // Cleared, not carried: the next save writes the drawing without it. (Any
  // edit clears the message, so it is read above, before this.)
  await drawLine(page, -20, -20, -20, -18);
  const loaded = await h.savedDrawing(page);
  expect(loaded.walls).toHaveLength(1);
});

test('a failed write is visible on the sheet, and it recovers on the next good one', async ({ page }) => {
  await h.openModel(page);
  await traceHouse(page, [[-10, -8], [10, -8], [10, 8], [-10, 8]]);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);

  await page.goto('/LAYOUT.dc.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');

  // Every write fails from here, the way a full quota does.
  await page.evaluate(() => {
    window.__realSave = window.SharedFileStore.saveSharedFile;
    window.SharedFileStore.saveSharedFile = async () => {
      const error = new Error('QuotaExceededError');
      error.name = 'QuotaExceededError';
      throw error;
    };
  });
  await page.getByRole('button', { name: /8\.5 × 11/i }).click();
  // It used to be a console.warn: the sheet looked saved and was not.
  await expect(page.locator('[data-layout-status]')).toContainText(/save failed/i);
  await expect(page.locator('[data-layout-status]')).toContainText('UNSAVED');
  expect(await page.evaluate(() => document.body.dataset.layoutSaveDirty)).toBe('1');

  // The page keeps working, and the next write that lands clears it.
  await page.evaluate(() => { window.SharedFileStore.saveSharedFile = window.__realSave; });
  await page.getByRole('button', { name: /11 × 17/i }).click();
  await page.waitForFunction(() => document.body.dataset.layoutSaveDirty === '0');
  await expect(page.locator('[data-layout-status]')).toHaveText('SAVED');
  const stored = await h.savedDrawing(page);
  expect(stored.layout.paperKey).toBe('11x17');
  expect(stored.walls.length).toBeGreaterThan(0);
});

test('an underlay goes with its level, like everything else the level owns', async ({ page }) => {
  await h.openModel(page);
  const drawing = ONE_WALL();
  drawing.levels.push({ id: 5, name: '2ND FL', elev: 9, visible: true });
  // A traced PDF page on the 2ND floor. Underlays are level-owned by the
  // format's own rule, and _deleteLevel forgot them.
  drawing.underlays = [{
    id: 'underlay-1', levelId: 5, kind: 'image', x: 0, z: 0,
    widthFt: 20, heightFt: 15, page: 1, opacity: 0.5, scaleRatio: 1,
  }];
  await seedDrawing(page, drawing);
  await page.reload();
  await h.waitForModelReady(page);
  let loaded = await h.savedDrawing(page);
  expect(loaded.underlays, 'the underlay loaded').toHaveLength(1);

  page.on('dialog', dialog => dialog.accept());
  await levelRow(page, '2ND FL').locator('text=×').first().click();
  await page.waitForTimeout(400);
  await h.waitForSaved(page);

  loaded = await h.savedDrawing(page);
  expect(loaded.underlays || [], 'the underlay went with its level').toHaveLength(0);

  // And the reload is clean — no leftover to report as a loss.
  await page.reload();
  await h.waitForModelReady(page);
  await expect(page.locator('[data-model-drawing-message]')).not.toContainText(/no longer in the drawing/i);
});

test('orphans do not cancel damage: a file with both reports both', async ({ page }) => {
  await h.openModel(page);
  const drawing = ONE_WALL({ end: { x: null, y: 0, z: 10 } });   // one damaged wall
  // Two cuts on a level that is not in the file. A foreign-level cut is KEPT
  // (its levelId nulls by design), so it is not a dropped orphan at all —
  // counting it as one used to subtract two from the damage total and report
  // a genuinely broken file as routine leftovers.
  drawing.cuts = [
    { id: 1, name: 'S1', startPt: { x: -5, z: 0 }, endPt: { x: 5, z: 0 },
      dirVec: { x: 0, z: 1 }, elev: 0, levelId: 99 },
    { id: 2, name: 'S2', startPt: { x: -5, z: 2 }, endPt: { x: 5, z: 2 },
      dirVec: { x: 0, z: 1 }, elev: 0, levelId: 99 },
  ];
  // And a wall on a level that is gone: a real orphan, from an older build.
  drawing.walls.push({ ...ONE_WALL().walls[0], id: 'wall-orphan', levelId: 99 });
  await seedDrawing(page, drawing);
  await page.reload();
  await h.waitForModelReady(page);

  const message = page.locator('[data-model-drawing-message]');
  // BOTH clauses. The damaged wall is the one that must not go unmentioned.
  await expect(message).toContainText(/incomplete/i);
  await expect(message).toContainText(/no longer in the drawing/i);
  // The cuts were kept, so they are not among the items reported as dropped.
  // (Read after an edit: nothing is written back until one, and the message
  // above has to be read before it — any edit clears it.)
  await drawLine(page, -20, -20, -20, -18);
  const loaded = await h.savedDrawing(page);
  expect(loaded.cuts, 'a cut whose level is unknown is kept, not dropped').toHaveLength(2);
  expect(loaded.walls, 'the damaged wall and the orphan are both gone').toHaveLength(0);
});
