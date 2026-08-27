// MOVE FLOOR — the pull ladder (board #230 slice 3): a tour floor's outline
// corner pulls past the support below on the drafter's exact ladder — free
// cantilever to 2', a snap across the 2'→4'-6" forbidden band, one pile
// riding the corner to 8' then parking, two matched piles past 10', and the
// 18' ceiling. Pile stubs land as auto columns on the FOUNDATION plan keyed
// to their corner, the pulled level carries the engineer notice, and
// pulling back in clears both. MOVE FLOOR itself is stairs-gated.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function traceHouse(page, w, d) {
  await page.locator('[data-select-house]').click();
  await page.keyboard.press('Enter');
  await h.clickWorld(page, -w / 2, -d / 2);
  await h.clickWorld(page, w / 2, -d / 2);
  await h.clickWorld(page, w / 2, d / 2);
  await h.clickWorld(page, -w / 2, d / 2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function reachMain(page, w, d) {
  await traceHouse(page, w, d);
  await page.locator('[data-tour-popup]').click(); // FOUNDATION DONE → MAIN
  await h.waitForSaved(page);
}

async function placeStairs(page, x = 2, z = -2) {
  await h.selectTool(page, 'Stair');
  await h.clickWorld(page, x, z);
  await h.clickWorld(page, x, z + 6);
  await h.waitForSaved(page);
}

async function dragCorner(page, fromX, fromZ, toX, toZ) {
  await h.selectTool(page, 'Select');
  const from = await h.worldToClient(page, fromX, fromZ);
  const to = await h.worldToClient(page, toX, toZ);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await h.waitForSaved(page);
}

// Positions that FOLLOW the mouse carry the real pointer's integer-pixel
// rounding (~0.07' at the default zoom) — ladder-snapped positions stay
// exact and keep the tight default.
const closeish = (received, expected) => expect(Math.abs(received - expected)).toBeLessThan(0.2);

const mainOutline = saved => saved.outlines.find(outline => outline.levelId === 3 && !outline.garage);
const pullPiles = saved => saved.columns
  .filter(column => column.auto && column.footing === 'pile8' && column.pullLevelId != null)
  .sort((a, b) => a.point.x - b.point.x);
const engineerNotes = saved => saved.notes.filter(note => /ENGINEER'S REVIEW AND STAMP/.test(note.body));

test('the ladder binds before the stairs too — a rule, never a cage', async ({ page }) => {
  // The stairs sequencing lives in the tour's popups and climb gate; node
  // editing stays free, so a pull made before the stairs still rides the
  // ladder and lands its piles — the structural rule is unconditional.
  await h.openModel(page);
  await reachMain(page, 16, 12);

  await dragCorner(page, 8, 6, 13, 6); // no stairs yet — 5' out
  const saved = await h.savedDrawing(page);
  const corner = mainOutline(saved).points.find(point => point.x > 10);
  closeish(corner.x, 13);
  const piles = pullPiles(saved);
  expect(piles).toHaveLength(1);
  closeish(piles[0].point.x, corner.x);
  expect(engineerNotes(saved).map(note => note.levelId)).toEqual([3]);
});

test('the pile rides the corner, and the forbidden band snaps the pull back', async ({ page }) => {
  await h.openModel(page);
  await reachMain(page, 16, 12);
  await placeStairs(page);

  // 5' past the foundation: one pile stub directly under the pulled corner.
  await dragCorner(page, 8, 6, 13, 6);
  await expect(page.locator('[data-model-drawing-message]')).toContainText('pile stub');
  let saved = await h.savedDrawing(page);
  let corner = mainOutline(saved).points.find(point => point.x > 10);
  closeish(corner.x, 13);
  closeish(corner.z, 6);
  let piles = pullPiles(saved);
  expect(piles).toHaveLength(1);
  expect(piles[0].levelId).toBe(1);
  expect(piles[0].pullLevelId).toBe(3);
  closeish(piles[0].point.x, corner.x); // rides directly under the corner
  closeish(piles[0].point.z, corner.z);
  expect(engineerNotes(saved).map(note => note.levelId)).toEqual([3]);

  // Pulling back to 3' lands in the forbidden band — the drag snaps across
  // to the 2' cantilever, and the corner's piles and notice clear.
  await dragCorner(page, 13, 6, 11, 6);
  saved = await h.savedDrawing(page);
  corner = mainOutline(saved).points.find(point => point.x > 8);
  expect(corner.x).toBeCloseTo(10, 1);
  expect(pullPiles(saved)).toHaveLength(0);
  expect(engineerNotes(saved)).toHaveLength(0);
});

test('the pile parks at 8 with a cantilever past it, then two piles split evenly', async ({ page }) => {
  await h.openModel(page);
  await reachMain(page, 16, 12);
  await placeStairs(page);

  // 9'-6" out: the single pile parks at 8' and the corner rides past it.
  await dragCorner(page, 8, 6, 17.5, 6);
  let saved = await h.savedDrawing(page);
  let piles = pullPiles(saved);
  expect(piles).toHaveLength(1);
  expect(piles[0].point.x).toBeCloseTo(16, 1); // 8' from the support at x=8
  let corner = mainOutline(saved).points.find(point => point.x > 12);
  closeish(corner.x, 17.5);

  // 12' out: two piles, the outer under the corner, the inner splitting the
  // run evenly — 6' and 12' from the support.
  await dragCorner(page, 17.5, 6, 20, 6);
  saved = await h.savedDrawing(page);
  piles = pullPiles(saved);
  expect(piles).toHaveLength(2);
  closeish(piles[0].point.x, 14);
  closeish(piles[1].point.x, 20);
  // Matched spacing: the inner pile splits the support→outer run evenly.
  expect(piles[0].point.x - 8).toBeCloseTo((piles[1].point.x - 8) / 2, 5);
  expect(engineerNotes(saved)).toHaveLength(1);
});

test('18 feet is the ceiling: the corner clamps and the piles park at 8 and 16', async ({ page }) => {
  await h.openModel(page);
  await reachMain(page, 16, 12);
  await placeStairs(page);

  await dragCorner(page, 8, 6, 28, 6); // asks for 20' — refused past 18'
  const saved = await h.savedDrawing(page);
  const corner = mainOutline(saved).points.find(point => point.x > 20);
  expect(corner.x).toBeCloseTo(26, 1); // support at 8 + the 18' maximum
  const piles = pullPiles(saved);
  expect(piles).toHaveLength(2);
  expect(piles[0].point.x).toBeCloseTo(16, 1);
  expect(piles[1].point.x).toBeCloseTo(24, 1);
});

test('a stair re-derive replaces teleposts but never the corner pile stubs', async ({ page }) => {
  await h.openModel(page);
  await reachMain(page, 24, 20); // 20' clear span — the tour landed a beam
  await placeStairs(page);

  await dragCorner(page, 12, 10, 18, 10);
  let saved = await h.savedDrawing(page);
  expect(pullPiles(saved)).toHaveLength(1);

  // A second stair re-runs the beam derivation — the pad-footing teleposts
  // re-land, the pull's pile stubs stay exactly where the ladder put them.
  await placeStairs(page, -6, -4);
  saved = await h.savedDrawing(page);
  const piles = pullPiles(saved);
  expect(piles).toHaveLength(1);
  closeish(piles[0].point.x, 18);
  expect(saved.columns.some(column => column.auto && column.footing === 'pad36')).toBe(true);
});
