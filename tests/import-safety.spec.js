// OPENING A FILE MUST NOT EAT THE DRAWING (audit, moved onto MODEL.html
// 28 Nov 2026). A file that is not a drawing, or one from a newer version,
// is refused with a notice and the drawing on screen is left alone; a file
// with broken items opens with those items held back (RULING-a-rejected-
// item-is-still-the-drafters: refused items are not drawn, and not deleted
// either); a good file opens whole.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const P = (x, z) => ({ x, y: 0, z });
const SQUARE = [P(0, 0), P(20, 0), P(20, 16), P(0, 16)];
const drawing = (extra = {}) => ({
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 0,
  walls: SQUARE.map((pt, i) => ({
    id: 100 + i, start: pt, end: SQUARE[(i + 1) % 4], levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
  })),
  lines: [{ id: 1, levelId: 3, view: 'plan', layer: 'draft', start: P(2, 2), end: P(12, 2) }],
  floors: [], roofs: [], fenestrations: [], dimensions: [], outlines: [], shapes: [], stairs: [],
  notes: [], roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
  ...extra,
});

const onScreen = page => page.evaluate(() => ({
  walls: drawing.walls.length, lines: drawing.lines.length, floors: (drawing.floors || []).length,
}));

async function openFile(page, name, contents) {
  await page.locator('#file-input').setInputFiles({
    name, mimeType: 'application/json', buffer: Buffer.from(contents),
  });
  await page.waitForTimeout(600);
}

async function open(page) {
  await h.openEditor(page, { drawing: drawing() });
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  expect(await onScreen(page)).toEqual({ walls: 4, lines: 1, floors: 0 });
}

test('a file that is not a drawing is refused, says so, and changes nothing', async ({ page }) => {
  await open(page);
  const stored = await h.savedDrawing(page);
  await openFile(page, 'notes.draft', 'this is not json');
  await expect(page.locator('#notice')).toHaveClass(/show/);
  await expect(page.locator('#notice-body')).toContainText('could not be parsed');
  expect(await onScreen(page)).toEqual({ walls: 4, lines: 1, floors: 0 });
  expect(await h.savedDrawing(page)).toEqual(stored);
});

test('a newer format version is refused, not partly applied', async ({ page }) => {
  await open(page);
  const stored = await h.savedDrawing(page);
  await openFile(page, 'future.draft', JSON.stringify({ version: 99, levels: [] }));
  await expect(page.locator('#notice-body')).toContainText('not one this page can read');
  await expect(page.locator('#notice-body')).toContainText('newer');
  expect(await onScreen(page)).toEqual({ walls: 4, lines: 1, floors: 0 });
  expect(await h.savedDrawing(page)).toEqual(stored);
});

test('broken items are held back from the drawing, and a SAVE keeps them in the file', async ({ page }) => {
  await open(page);
  const partly = drawing({
    lines: [
      ...drawing().lines,
      { id: 900, levelId: 3, view: 'plan', start: P(0, 0), end: null },             // no endpoint
      { id: 901, levelId: 9999, view: 'plan', start: P(0, 0), end: P(5, 5) },        // no such level
    ],
    floors: [{ id: 'floor-900', levelId: 3, view: 'floor', points: [P(0, 0), P(4, 0)] }], // too few points
  });
  await openFile(page, 'partly-broken.draft', JSON.stringify(partly));
  // Only the good line is drawn; the walls came in whole.
  await expect.poll(() => onScreen(page)).toEqual({ walls: 4, lines: 1, floors: 0 });
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
  // NOT DELETED: what was refused goes back into the file untouched, so
  // opening a drawing and pressing SAVE never loses geometry.
  const saved = await h.savedDrawing(page);
  const ids = (saved.lines || []).map(l => Number(l.id) || l.id);
  expect(saved.lines).toHaveLength(3);
  expect(ids).toEqual(expect.arrayContaining([900, 901]));
  expect((saved.floors || []).some(f => f.id === 'floor-900')).toBe(true);
});

test('a good drawing opens whole', async ({ page }) => {
  await open(page);
  const other = drawing({
    lines: [
      { id: 1, levelId: 3, view: 'plan', layer: 'draft', start: P(2, 2), end: P(12, 2) },
      { id: 2, levelId: 3, view: 'plan', layer: 'draft', start: P(2, 4), end: P(12, 4) },
      { id: 3, levelId: 3, view: 'plan', layer: 'draft', start: P(2, 6), end: P(12, 6) },
    ],
  });
  await openFile(page, 'good.draft', JSON.stringify(other));
  await expect.poll(() => onScreen(page)).toEqual({ walls: 4, lines: 3, floors: 0 });
});
