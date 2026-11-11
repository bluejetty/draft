// A SHAPE'S EDGE SLID CATCHES THE OTHER SHAPE'S NODE, AND A CLICK AGAIN
// ON STACKED SHAPES STEPS DOWN (jb, 11 Nov 2026): "i'm sliding this wall
// over and want to snap to a node on the other one .. not creating the
// circle or snapping. also if one shape is overtop i wasn't able to press
// twice to select the 2nd (below) item".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
const W = 8, D = 4;
const SHAPE = (id, pts) => ({ id, levelId: 3, points: pts, layer: 'SHAPE' });
const fixture = shapes => ({
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  walls: [], lines: [], outlines: [],
  floors: [], roofs: [], fenestrations: [], dimensions: [],
  shapes, surfaceOpenings: [], stairs: [], notes: [], roomTags: [],
  columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
  board: 'drafting',
});
// THE BIG BOX and, to its east, a second shape whose west corner stands
// 2.3 ft past the big box's east edge: no foot lands on it, only a catch.
const BIG = SHAPE('big', [V(-W, -D), V(W, -D), V(W, D), V(-W, D)]);
const EAST = SHAPE('east', [V(W + 2.3, -2), V(W + 6, -2), V(W + 6, 2), V(W + 2.3, 2)]);
// A SMALL SHAPE ON TOP OF THE BIG ONE, listed after it so it paints over.
const OVER = SHAPE('over', [V(1, -2), V(6, -2), V(6, 2), V(1, 2)]);

async function open(page, saved) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, file }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(file)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, file: saved });
  await page.goto('/MODEL.html?left=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect(page.locator('[data-sel-mode]').first()).toBeVisible();
  // ZOOMED IN, so a foot is a good many pixels and the handles stand clear
  // of the presses below (the one snap rule: 2" on the plan, 4-16 px). The
  // fit (0) measures walls, lines and floors, not shapes, so it is set here.
  await page.evaluate(() => { view.cx = 4; view.cz = 0; view.scale = 30; paint(); });
  await page.waitForTimeout(100);
  expect((await h.planFrame(page)).scale).toBeGreaterThan(20);
  await page.keyboard.press('s');
  await page.evaluate(() => { tsquareOn = true; footOn = true; snapOn = true; });
}
const pts = (page, id) => page.evaluate(i => drawing.shapes.find(s => s.id === i).points.map(p => [p.x, p.z]), id);
const picked = page => page.evaluate(() => selection.map(s => `${s.type}:${s.item.id}`));
const lit = page => page.evaluate(() => (moveDrag?.lit ? { x: moveDrag.lit.pt.x, z: moveDrag.lit.pt.z, node: !!moveDrag.lit.node } : null));

test('a picked shape\'s edge slid toward another shape\'s corner lights the ring and lands on it', async ({ page }) => {
  await open(page, fixture([BIG, EAST]));
  const { at } = await h.planFrame(page);
  await page.mouse.click(...at(0, 0));
  await page.waitForTimeout(120);
  expect(await picked(page)).toEqual(['shape:big']);
  // THE EAST EDGE, held 2 ft below its midpoint handle, pulled east past
  // the other shape's west corner (x = W + 2.3) by a tenth of a foot: the
  // foot alone would put the edge at W + 2; the node catch puts it on the
  // corner, at W + 2.3, and the ring says so while it is held.
  const [gx, gy] = at(W, 2.5);
  await page.mouse.move(gx, gy);
  await page.mouse.down();
  await page.mouse.move(gx + 8, gy + 1);
  await page.mouse.move(...at(W + 2.3 + 0.1, 2.5), { steps: 8 });
  await page.waitForTimeout(80);
  const ring = await lit(page);
  expect(ring, 'the orange ring on the corner being caught').toEqual({ x: W + 2.3, z: 2, node: true });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const after = await pts(page, 'big');
  expect(after.length, 'no jog on a whole edge').toBe(4);
  expect(after[1][0], 'the edge on the corner, not on the foot').toBeCloseTo(W + 2.3, 6);
  expect(after[2][0]).toBeCloseTo(W + 2.3, 6);
  // AWAY FROM THE CORNER, THE FOOT RULES AGAIN: a pull to W + 1.4 lands on W + 1.
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(120);
  await page.mouse.move(gx, gy);
  await page.mouse.down();
  await page.mouse.move(gx + 8, gy + 1);
  await page.mouse.move(...at(W + 1.4, 2.5), { steps: 8 });
  expect(await lit(page), 'nothing in reach, no ring').toBeNull();
  await page.mouse.up();
  await page.waitForTimeout(150);
  expect((await pts(page, 'big'))[1][0]).toBeCloseTo(W + 1, 6);
});

test('a click again inside two stacked shapes takes the one under, from its edge too', async ({ page }) => {
  await open(page, fixture([BIG, OVER]));
  const { at } = await h.planFrame(page);
  // INSIDE BOTH: the top one first, the big one under it on the click again.
  await page.mouse.click(...at(3.5, 0.5));
  await page.waitForTimeout(120);
  expect(await picked(page)).toEqual(['shape:over']);
  await page.mouse.click(...at(3.5, 0.5));
  await page.waitForTimeout(120);
  expect(await picked(page), 'click again: the shape under').toEqual(['shape:big']);
  await page.mouse.click(...at(3.5, 0.5));
  await page.waitForTimeout(120);
  expect(await picked(page), 'and round again').toEqual(['shape:over']);
  // ON THE TOP SHAPE'S EDGE, a hair inside it and clear of its handles (the
  // press that arms the edge push): a click that never travelled is still
  // the click again.
  const { scale } = await h.planFrame(page);
  const edge = at(6 - 2 / scale, 1.2);
  await page.mouse.click(...edge);
  await page.waitForTimeout(120);
  expect(await picked(page)).toEqual(['shape:over']);
  await page.mouse.click(...edge);
  await page.waitForTimeout(120);
  expect(await picked(page), 'click again on the edge: the shape under').toEqual(['shape:big']);
  expect(await page.evaluate(() => stripNotice)).toMatch(/2 OF 2 HERE/i);
  await page.mouse.click(...edge);
  await page.waitForTimeout(120);
  expect(await picked(page), 'and round again, from the edge').toEqual(['shape:over']);
});
