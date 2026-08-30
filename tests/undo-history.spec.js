// The history, hardened (audit C4, slice 2).
//
// MODEL's undo has always worked, but it was only ever reached by keyboard —
// one Ctrl+Z at a time, by someone who knew it was there. Putting buttons on
// the strip invites hammering, and hammering finds the cases nobody drove:
// an undo that lands in the middle of a drag, one that crosses a BUILD HOUSE
// press, one taken on a different level from the snapshot it restores, and
// the moment the bounded stack starts throwing its oldest entry away.
//
// These specs pin the answers. They drive the KEYBOARD, so they hold whether
// or not the on-screen controls are in the build.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const lineShapes = drawing => (drawing.lines || []).map(line =>
  `${line.start.x.toFixed(1)},${line.start.z.toFixed(1)}->${line.end.x.toFixed(1)},${line.end.z.toFixed(1)}`);
const counts = drawing => ({
  walls: (drawing.walls || []).length,
  floors: (drawing.floors || []).length,
  roofs: (drawing.roofs || []).length,
  dimensions: (drawing.dimensions || []).length,
  outlines: (drawing.outlines || []).length,
});
const walletBalance = page => page.evaluate(() => {
  const stored = JSON.parse(localStorage.getItem('draft-bone-wallet') || 'null');
  return stored ? stored.balance : null;
});

function levelRow(page, name) {
  return page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: name }) });
}

async function drawLine(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

// The keyboard undo/redo, with the wait the save beacon gives us.
async function undo(page) {
  await page.keyboard.press('Control+z');
  await page.waitForFunction(() => document.body.dataset.saveDirty === '0');
}
async function redo(page) {
  await page.keyboard.press('Control+Shift+z');
  await page.waitForFunction(() => document.body.dataset.saveDirty === '0');
}

test('an undo that lands mid-drag applies cleanly, and the dropped drag never arrives', async ({ page }) => {
  // The case the buttons make reachable: on a tablet one finger can be
  // dragging a node while the other taps UNDO. The drag is in flight — its
  // save is deferred to mouseup, one snapshot per drag — so the danger is a
  // half-apply: the undo lands, then the release writes the moved vertex
  // back on top of the restored drawing.
  await h.openModel(page);
  await drawLine(page, -10, -6, 10, -6);
  await drawLine(page, -10, 6, 10, 6);
  expect(lineShapes(await h.savedDrawing(page))).toHaveLength(2);

  await h.selectTool(page, 'Select');
  const from = await h.worldToClient(page, 10, -6);
  const to = await h.worldToClient(page, 10, 2);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });

  await undo(page);
  // The last COMMITTED edit is what came back — the second line — and the
  // first line has not moved.
  expect(lineShapes(await h.savedDrawing(page))).toEqual(['-10.0,-6.0->10.0,-6.0']);

  await page.mouse.up();
  await page.waitForTimeout(400);
  expect(lineShapes(await h.savedDrawing(page)),
    'the release must not put the dragged vertex back on the restored drawing')
    .toEqual(['-10.0,-6.0->10.0,-6.0']);

  // And the history is still coherent afterwards, in both directions.
  await undo(page);
  expect(lineShapes(await h.savedDrawing(page))).toEqual([]);
  await redo(page);
  expect(lineShapes(await h.savedDrawing(page))).toEqual(['-10.0,-6.0->10.0,-6.0']);
});

test('an undo with a chain still open cancels the chain and undoes the last committed edit', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, -10, -6, 10, -6);
  // A wall chain left mid-flight: two points down, nothing committed.
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, -8, 2);
  await h.clickWorld(page, 0, 2);

  await undo(page);
  const after = await h.savedDrawing(page);
  expect(after.lines || [], 'the last committed edit is what came back').toHaveLength(0);
  expect(after.walls || [], 'and the open chain committed nothing on its way out').toHaveLength(0);

  // The app still takes work: the cancelled chain left no half-state behind.
  await drawLine(page, -10, 8, 10, 8);
  expect((await h.savedDrawing(page)).lines).toHaveLength(1);
});

test('one bone press is one undo, and the bone it spent is not refunded', async ({ page }) => {
  test.setTimeout(120000);
  await h.openModel(page);
  await h.selectTool(page, 'Outline');
  for (const [x, z] of [[-12, -9], [12, -9], [12, 9], [-12, 9]]) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.climbTourToMain(page);

  const before = counts(await h.savedDrawing(page));
  const walletBefore = await walletBalance(page);
  expect(before.walls).toBe(0);

  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  const built = counts(await h.savedDrawing(page));
  expect(built.walls).toBeGreaterThan(0);
  expect(built.roofs).toBeGreaterThan(0);
  expect(await walletBalance(page), 'the press spent a bone').toBe(walletBefore - 1);

  // ONE undo takes the whole shell — walls, floors, roof and the dimension
  // stack all went in on one press and come out on one.
  await undo(page);
  expect(counts(await h.savedDrawing(page)),
    'the bone and everything it grew is a single history entry').toEqual(before);

  // THE RULE: the wallet is not drawing state. Undo does not refund the
  // bone, and redo does not spend a second one — the spend happened outside
  // the history on purpose, and TOO BAD is the policy.
  expect(await walletBalance(page), 'undo does not refund the bone').toBe(walletBefore - 1);
  await redo(page);
  expect(counts(await h.savedDrawing(page))).toEqual(built);
  expect(await walletBalance(page), 'and redo does not spend another').toBe(walletBefore - 1);
});

test('an undo taken on another level lands the drafter where the change was', async ({ page }) => {
  test.setTimeout(120000);
  await h.openModel(page);
  await drawLine(page, -10, -6, 10, -6);
  await expect(page.locator('.level-row.active .level-name')).toHaveText(/MAIN FL/);

  // The active level rides in the snapshot, so switching floors is itself a
  // recorded change: the first undo returns the VIEW, and the drawing is
  // untouched. Worth knowing before pressing undo twice and wondering why
  // the geometry did not move.
  await levelRow(page, '2ND FL').locator('.level-name').click();
  await page.waitForTimeout(300);
  await expect(page.locator('.level-row.active .level-name')).toHaveText(/2ND FL/);

  await undo(page);
  await expect(page.locator('.level-row.active .level-name'),
    'the undo brought the view back with the snapshot').toHaveText(/MAIN FL/);
  expect((await h.savedDrawing(page)).lines, 'and the geometry is untouched').toHaveLength(1);

  // The next undo is the geometry, and the drafter is looking at the level it
  // happened on — never undoing something off-screen.
  await undo(page);
  expect((await h.savedDrawing(page)).lines).toHaveLength(0);
  await expect(page.locator('.level-row.active .level-name')).toHaveText(/MAIN FL/);

  // And from the BONEYARD, a redo still lands on the level it belongs to.
  await page.locator('.level-name', { hasText: 'BONEYARD' }).click();
  await page.waitForTimeout(300);
  await redo(page);
  expect((await h.savedDrawing(page)).lines).toHaveLength(1);
  await expect(page.locator('.level-row.active .level-name')).toHaveText(/MAIN FL/);
});

test('past the bound the oldest entry is dropped, and nothing is corrupted', async ({ page }) => {
  // The stack is bounded by count and by size. Overflow the count and the
  // oldest snapshot goes: undo walks back as far as the bound allows, stops,
  // and leaves a coherent drawing — not a half-restored one.
  test.setTimeout(600000);
  const EDITS = 63;                 // HISTORY_LIMIT is 60
  await h.openModel(page);
  await h.selectTool(page, 'Line');
  for (let i = 0; i < EDITS; i++) {
    await h.clickWorld(page, -22 + i * 0.5, -20);
    await h.clickWorld(page, -22 + i * 0.5, -14);
    await page.keyboard.press('Enter');
    await h.waitForSaved(page);
  }
  expect((await h.savedDrawing(page)).lines).toHaveLength(EDITS);

  // Walk back further than the bound allows.
  for (let i = 0; i < EDITS + 3; i++) {
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(120);
  }
  await page.waitForFunction(() => document.body.dataset.saveDirty === '0');

  const floor = (await h.savedDrawing(page)).lines.length;
  // Sixty entries kept means sixty edits undone: the three oldest states are
  // gone, so the walk stops with those lines still standing.
  expect(floor, 'undo stopped at the bound instead of emptying the drawing').toBe(EDITS - 60);
  expect(floor).toBeGreaterThan(0);

  // What is left is a real drawing, not a torn one: every line intact, and
  // the app still records new work on top.
  const remaining = (await h.savedDrawing(page)).lines;
  remaining.forEach(line => {
    expect(Number.isFinite(line.start.x) && Number.isFinite(line.end.x)).toBe(true);
    expect(Math.hypot(line.end.x - line.start.x, line.end.z - line.start.z)).toBeGreaterThan(0);
  });
  await drawLine(page, 14, -20, 14, -14);
  expect((await h.savedDrawing(page)).lines).toHaveLength(floor + 1);
  await undo(page);
  expect((await h.savedDrawing(page)).lines).toHaveLength(floor);
});
