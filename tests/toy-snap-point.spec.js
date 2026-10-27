// TOY TAKES THE POINT IT LIGHTS.
//
// Movie, 27 Oct: "i'm trying to snap onto the end of the line, but it is
// snapping me couple inches over from it" -- on TOY, without knowing it: "it
// was probably to the 1ft". The orange ring lit on the line's end, and the
// press landed where the hand was (the first point) or a whole foot along
// from the start (the second). A lit node now beats the foot on TOY too.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3;
const drawingOn = board => ({
  version: 1, planTurn: 0, board,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: MAIN_FL, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 1,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

async function open(page, board) {
  await page.goto('/MODEL.dc.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: drawingOn(board) });
  await page.goto(`/MODEL.html?mode=night&level=${MAIN_FL}`);
  await expect(page.locator('#readout')).toContainText('scale', { timeout: 10000 });
  expect(await page.evaluate(() => board)).toBe(board);
}
const pixelOf = async (page, x, z) => {
  const scale = Number((await page.locator('#readout').textContent()).match(/scale ([\d.]+) px\/ft/)[1]);
  const box = await page.locator('#plan').boundingBox();
  return { px: box.x + box.width / 2 + x * scale, py: box.y + box.height / 2 + z * scale };
};
async function hover(page, x, z) {
  const { px, py } = await pixelOf(page, x, z);
  await page.mouse.move(px, py);
  await page.waitForTimeout(60);
  return { px, py };
}
async function tapWorld(page, x, z) {
  const { px, py } = await hover(page, x, z);
  await page.mouse.click(px, py);
  await page.waitForTimeout(60);
}
const startOf = page => page.evaluate(() => drawStart && [drawStart.x, drawStart.z]);
const near = (got, want, tol = 1e-6) => {
  expect(got).not.toBeNull();
  expect(Math.abs(got[0] - want[0])).toBeLessThan(tol);
  expect(Math.abs(got[1] - want[1])).toBeLessThan(tol);
};

// A 10' line from (0,0) to (10,0), then the LINE tool still in hand.
async function lineToTen(page) {
  await h.armFromRail(page, 'line');
  await tapWorld(page, 0, 0);
  await tapWorld(page, 10, 0);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => activeTool)).toBe('line');
}

test('TOY: a first point pressed beside a line end, inside its ring, lands on the end', async ({ page }) => {
  await open(page, 'toy');
  await lineToTen(page);
  await hover(page, 10.15, 0.12);
  await expect(page.locator('#plan')).toHaveAttribute('data-snap-node', '[10,0]');
  await tapWorld(page, 10.15, 0.12);
  near(await startOf(page), [10, 0]);
});

test('TOY: a run held square ends on the lit line end, not on the whole foot past it', async ({ page }) => {
  await open(page, 'toy');
  await lineToTen(page);
  // 3.6' below the end: the foot would round the run to 4' and miss by 4.8".
  await tapWorld(page, 10, -3.6);
  near(await startOf(page), [10, -3.6], 1e-3);
  await hover(page, 10.12, -0.1);
  await expect(page.locator('#plan')).toHaveAttribute('data-snap-node', '[10,0]');
  near(await page.evaluate(() => { const p = drawPoint(cursorWorld); return [p.x, p.z]; }), [10, 0]);
  // With nothing lit, TOY still lands on the whole foot.
  await hover(page, 10.1, -1.5);
  await expect(page.locator('#plan')).not.toHaveAttribute('data-snap-node', /./);
  near(await page.evaluate(() => { const p = drawPoint(cursorWorld); return [p.x, p.z]; }), [10, -1.6], 1e-3);
  // A run an inch off the end's line stays square and ends level with it.
  await page.keyboard.press('Escape');
  await tapWorld(page, 10.1, -3.6);
  near(await startOf(page), [10.1, -3.6], 1e-3);
  await hover(page, 10.05, -0.05);
  await expect(page.locator('#plan')).toHaveAttribute('data-snap-node', '[10,0]');
  const end = await page.evaluate(() => { const p = drawPoint(cursorWorld); return [p.x, p.z]; });
  near(end, [10.1, 0], 1e-3);
  expect(end[1]).toBe(0);
});
