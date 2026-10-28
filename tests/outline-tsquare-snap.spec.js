// THE OUTLINE'S SQUARED CORNER LANDS ON THE LINE IT LIGHTS (Movie, 27 Oct).
//
// "the lines for the outline house aren't landing on the proper spot
// perpendicular to the point selected (i'm selecting a point along the line)
// and the node appears in the wrong spot still even with the T on". With the
// T-square lit the outline's next corner was squared and took no snap, so the
// neon ring lit on the line and the press landed where the hand was. Now the
// square holds one coordinate and the line it crosses sets the other, and the
// ring is the squared one.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const empty = withLine => ({
  version: 1, board: 'drafting',
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  walls: [], floors: [],
  lines: withLine ? [{ id: 'ln', start: { x: -10, y: 0, z: 0 }, end: { x: 20, y: 0, z: 0 },
    levelId: 3, view: 'plan', layer: 'draft' }] : [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

async function open(page, withLine = false) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty(withLine) });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  return h.planFrame(page);
}
const lastCorner = page => page.evaluate(() => {
  const c = outlineCorners[outlineCorners.length - 1];
  return [Math.round(c.x * 1e4) / 1e4 + 0, Math.round(c.z * 1e4) / 1e4 + 0];
});

test('T-square lit: an outline corner pressed beside a line lands square on the line, and the ring shows where', async ({ page }) => {
  // The line along z = 0, fitted to the view.
  await open(page, true);
  await page.keyboard.press('0');
  await page.waitForTimeout(100);
  const { at, scale } = await h.planFrame(page);
  await h.selectTool(page, 'outline');
  await page.locator('[data-mode-tsquare]').click();
  await page.mouse.click(...at(3, 4));
  // Down to the line, the hand a couple of pixels past it and off to the side.
  const off = 2 / scale;
  await page.mouse.move(...at(3 + 3 * off, off));
  await page.waitForTimeout(80);
  const ring = JSON.parse(await page.locator('#plan').getAttribute('data-snap-magnet'));
  expect(ring.at.map(v => Math.round(v * 1e4) / 1e4 + 0), 'the ring sits on the square, on the line').toEqual([3, 0]);
  await page.mouse.click(...at(3 + 3 * off, off));
  expect(await lastCorner(page)).toEqual([3, 0]);
});

test('T-square lit, nothing in reach: the corner is square to the last and wherever the hand set it', async ({ page }) => {
  const { at } = await open(page);
  await h.selectTool(page, 'outline');
  await page.locator('[data-mode-tsquare]').click();
  await page.mouse.click(...at(3, 10));
  await page.mouse.click(...at(3.4, 4));
  const [x, z] = await lastCorner(page);
  expect(x, 'square to the first corner').toBe(3);
  expect(Math.abs(z - 4)).toBeLessThan(0.1);
});

// "my OUTLINE for the house isn't connecting to the line i drew its off a bit
// still not snapping to the node" -- the first corner, pressed beside the
// line, took no catch but a node, so it sat 7/16" off and the T-square
// carried that round. And "can we make it so if something is scolled over and
// is CIRCLED --- THAT is what will be connected too".
test('the first corner pressed beside a line lands on the line', async ({ page }) => {
  await open(page, true);
  await page.keyboard.press('0');
  await page.waitForTimeout(100);
  const { at, scale } = await h.planFrame(page);
  await h.selectTool(page, 'outline');
  await page.locator('[data-mode-tsquare]').click();
  await page.mouse.click(...at(5, 3 / scale));
  expect(await lastCorner(page)).toEqual([5, 0]);
});

test('T-square lit: a circled node off the square is where the corner goes, and the ring is on it', async ({ page }) => {
  await open(page, true);
  await page.keyboard.press('0');
  // Back a little, so the line's end is clear of the panels.
  const fit = await h.planFrame(page);
  await page.mouse.move(...fit.at(5, 0));
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(150);
  const { at, scale } = await h.planFrame(page);
  await h.selectTool(page, 'outline');
  await page.locator('[data-mode-tsquare]').click();
  // A corner 7/16" right of the line's end, then down to the end.
  const off = 7 / 16 / 12;
  // CTRL held, so nothing catches it and it stays 7/16" off.
  await page.keyboard.down('Control');
  await page.mouse.click(...at(20 + off, 4));
  await page.keyboard.up('Control');
  expect(await lastCorner(page)).toEqual([Math.round((20 + off) * 1e4) / 1e4, 4]);
  await page.mouse.move(...at(20 + 2 / scale, 2 / scale));
  await page.waitForTimeout(80);
  const ring = JSON.parse(await page.locator('#plan').getAttribute('data-snap-magnet'));
  expect(ring.at, 'the ring is on the node').toEqual([20, 0]);
  await page.mouse.click(...at(20 + 2 / scale, 2 / scale));
  expect(await lastCorner(page), 'and the corner is on it').toEqual([20, 0]);
});

test('T-square lit: a wall run ends on the circled node, not square beside it', async ({ page }) => {
  await open(page, true);
  const end = await page.evaluate(() => {
    tsquareOn = true;
    drawStart = { x: 20 + 7 / 16 / 12, y: 0, z: 4 };
    activeTool = 'wall';
    const p = drawPoint({ x: 20.01, y: 0, z: 0.01 });
    drawStart = null;
    return [Math.round(p.x * 1e4) / 1e4 + 0, Math.round(p.z * 1e4) / 1e4 + 0];
  });
  expect(end).toEqual([20, 0]);
});
