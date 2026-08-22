// The ANNOTATION tool places leader notes: click the object of interest, click
// where the text goes, and type it. Ends are ARROW (default), LINE, or NO
// POINTER (one click, standalone box). Text is transparent by default with
// FILL (opacity %), OUTLINE, and CORNER BULLNOSE as style options. Notes work
// in every drafting context — including the locked STAIR workspace, where they
// store pane-local coordinates.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const NOTE_STROKE = [29, 31, 32]; // #1d1f20

function levelRow(page, name) {
  return page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: name }) });
}

async function useLayerView(page, level, view) {
  await levelRow(page, level).locator('.level-body').click();
  await levelRow(page, level).locator('.level-layer', { hasText: view }).first().click();
}

async function typeNote(page, text) {
  const input = page.locator('[data-note-editor-input]');
  await expect(input).toBeVisible();
  await input.fill(text);
  await input.press('Enter');
}

test('two clicks anchor a leader note; the text persists across a reload', async ({ page }) => {
  await h.openModel(page);
  await useLayerView(page, 'MAIN FL', 'PLAN');

  await h.selectTool(page, 'Annotation');
  await h.clickWorld(page, 0, 0);      // the object of interest
  await h.clickWorld(page, 12, -8);    // where the text goes
  await typeNote(page, 'BEAM POCKET HERE');
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.notes).toHaveLength(1);
  const note = saved.notes[0];
  expect(note.layer).toBe('A-ANNO-NOTE');
  expect(note.body).toBe('BEAM POCKET HERE');
  expect(note.end).toBe('arrow');
  expect(note.view).toBe('plan');
  expect(note.levelId).toBe(3);
  expect(note.fill).toBe(false);
  expect(note.outline).toBe(false);
  expect(Math.abs(note.anchor.x)).toBeLessThan(0.5);
  expect(Math.abs(note.text.x - 12)).toBeLessThan(0.5);

  // The note text draws near its text point in the note colour.
  const p = await h.worldToClient(page, 12, -8);
  const pixels = await h.overlayPixels(page, p.x + 20, p.y, 20);
  expect(h.countColor(pixels, NOTE_STROKE)).toBeGreaterThan(0);

  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await page.waitForTimeout(500);
  const reloaded = await h.savedDrawing(page);
  expect(reloaded.notes).toHaveLength(1);
  expect(reloaded.notes[0].body).toBe('BEAM POCKET HERE');
});

test('style options: LINE END with FILL, opacity, OUTLINE, and a bullnose radius', async ({ page }) => {
  await h.openModel(page);
  await useLayerView(page, 'MAIN FL', 'PLAN');
  await h.selectTool(page, 'Annotation');

  await page.getByRole('button', { name: 'LINE END', exact: true }).click();
  await page.getByRole('button', { name: 'FILL', exact: true }).click();
  await page.getByRole('button', { name: 'OUTLINE', exact: true }).click();
  await page.locator('[data-note-fill-opacity]').fill('60');
  await page.locator('[data-note-fill-opacity]').press('Enter');
  await page.locator('[data-note-bullnose]').fill('8');
  await page.locator('[data-note-bullnose]').press('Enter');

  await h.clickWorld(page, -5, 5);
  await h.clickWorld(page, 6, 9);
  await typeNote(page, 'SLOPE 1/8" PER FT');
  await h.waitForSaved(page);

  const note = (await h.savedDrawing(page)).notes[0];
  expect(note.end).toBe('line');
  expect(note.fill).toBe(true);
  expect(Math.abs(note.fillOpacity - 0.6)).toBeLessThan(0.001);
  expect(note.outline).toBe(true);
  expect(note.bullnose).toBe(8);
});

test('NO POINTER drops a standalone note box with a single click', async ({ page }) => {
  await h.openModel(page);
  await useLayerView(page, 'MAIN FL', 'PLAN');
  await h.selectTool(page, 'Annotation');

  await page.getByRole('button', { name: 'NO POINTER', exact: true }).click();
  await h.clickWorld(page, 4, 4);
  await typeNote(page, 'LEGAL LAND DESCRIPTION');
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.notes).toHaveLength(1);
  const note = saved.notes[0];
  expect(note.end).toBe('none');
  expect(note.body).toBe('LEGAL LAND DESCRIPTION');
  expect(note.anchor.x).toBe(note.text.x);
  expect(note.anchor.z).toBe(note.text.z);
});

test('empty text is rejected; Escape cancels the pending note', async ({ page }) => {
  await h.openModel(page);
  await useLayerView(page, 'MAIN FL', 'PLAN');
  await h.selectTool(page, 'Annotation');

  await h.clickWorld(page, 0, 0);
  await h.clickWorld(page, 8, 4);
  const input = page.locator('[data-note-editor-input]');
  await expect(input).toBeVisible();
  await input.press('Enter'); // empty — rejected, editor stays open
  await expect(input).toBeVisible();
  await expect(page.locator('[data-model-drawing-message]')).toContainText('needs text');
  await input.press('Escape'); // cancels the note outright
  await expect(input).toBeHidden();

  const saved = await h.savedDrawing(page);
  expect(saved?.notes || []).toHaveLength(0);
});

test('annotations work inside the locked STAIR workspace with pane-local points', async ({ page }) => {
  await h.openModel(page);
  await useLayerView(page, 'MAIN FL', 'PLAN');
  await h.selectTool(page, 'Stair');
  await h.clickWorld(page, 0, 0);
  await h.clickWorld(page, 5, 0);
  await h.waitForSaved(page);

  await useLayerView(page, 'MAIN FL', 'STAIR');
  // Annotation stays enabled in the locked workspace; drawing tools don't.
  await expect(page.getByRole('button', { name: /\bAnnotation\b/i }).first()).toBeEnabled();
  await expect(page.getByRole('button', { name: /\bWall\b/i }).first()).toBeDisabled();

  await h.selectTool(page, 'Annotation');
  const box = await page.locator('[data-model-canvas]').boundingBox();
  // Two clicks in the section pane (top half). With the annotation tool active
  // the pane click must annotate, not maximize the pane.
  await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.25);
  await page.waitForTimeout(400);
  await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.15);
  await page.waitForTimeout(400);
  await typeNote(page, '17 TOTAL RISERS');
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  const stairNotes = saved.notes.filter(note => note.view === 'stair');
  expect(stairNotes).toHaveLength(1);
  expect(stairNotes[0].pane).toBe('section');
  expect(stairNotes[0].body).toBe('17 TOTAL RISERS');

  // The note survives a reload and still renders in the section pane.
  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await page.waitForTimeout(500);
  expect((await h.savedDrawing(page)).notes.filter(n => n.view === 'stair')).toHaveLength(1);
});
