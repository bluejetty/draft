// THE OUTLINE TAKES A 45 ON DRAFTING.
//
// Movie, 17 Oct, tracing the North Point building -- one chamfered corner,
// 10' x 10' on its grid lines -- with an OUTLINE tool that only turned
// square: "the 45 angle i need it too". So on DRAFTING the outline turns in
// eighth turns, square or 45 and nothing between, and the edge home may land
// within an eighth of an inch of the first corner, because a 45 on a real
// building is never a whole number and no typed sixteenth closes it exactly.
// TOY keeps the quarter turn.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const empty = board => ({
  version: 1, board,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

async function open(page, board) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty(board) });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

async function typeEdge(page, at, aim, said) {
  await page.mouse.move(...at(...aim));
  await page.waitForTimeout(60);
  await page.keyboard.type(said);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
}

// The loop as saved, measured from its first corner, unrounded.
async function savedLoop(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const d = await h.savedDrawing(page);
  const [master] = d.boneyardOutlines || [];
  if (!master) return null;
  const [o] = master.points;
  return master.points.map(p => [p.x - o.x, p.z - o.z]);
}
// `+ 0` so a corner a hair west of the first reads 0, not -0.
const rounded = loop => loop.map(pt => pt.map(v => Math.round(v * 1e4) / 1e4 + 0));

test('on DRAFTING a typed 45 lays the chamfer, says its legs, and the typed edge home closes square within the eighth', async ({ page }) => {
  await open(page, 'drafting');
  const { at } = await h.planFrame(page);
  await h.selectTool(page, 'outline');
  await page.mouse.click(...at(0, 0));
  await typeEdge(page, at, [40, 0], '30');
  await typeEdge(page, at, [30, 30], '20');
  await typeEdge(page, at, [5, 20], '20');
  // The chamfer, aimed on the diagonal: 10' each way is a diagonal of
  // 14.1421', and the nearest sixteenth is 14'-1 11/16" -- just short.
  await typeEdge(page, at, [0, 10], '14-1 11/16');
  await expect(page.locator('#strip-message')).toContainText('45° edge 14\'-1 11/16"');
  await expect(page.locator('#strip-message')).toContainText('10\'-0" each way');
  // Home by a typed 10: it lands a sixty-fourth of an inch off the first
  // corner, and closes.
  await typeEdge(page, at, [0, -5], '10');
  const loop = await savedLoop(page);
  expect(loop).not.toBeNull();
  expect(rounded(loop)).toEqual([[0, 0], [30, 0], [30, 20], [10, 20], [0, 10]]);
  // THE LAST CORNER SLID ALONG THE CHAMFER, so the edge home is square
  // exactly -- not leaning by the sixty-fourth it missed by.
  expect(Math.abs(loop[4][0] - loop[0][0])).toBeLessThan(1e-9);
});

test('TOY still turns square: a press aimed near the diagonal lands on the axis', async ({ page }) => {
  await open(page, 'toy');
  const { at } = await h.planFrame(page);
  await h.selectTool(page, 'outline');
  for (const pt of [[0, 0], [10, 9], [10, 10], [0, 10]]) {
    await page.mouse.move(...at(...pt));
    await page.waitForTimeout(60);
    await page.mouse.click(...at(...pt));
  }
  await page.mouse.move(...at(0, 0));
  await page.waitForTimeout(60);
  await page.mouse.click(...at(0, 0));
  const loop = await savedLoop(page);
  expect(rounded(loop)).toEqual([[0, 0], [10, 0], [10, 10], [0, 10]]);
});
