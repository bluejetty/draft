// DORMER, THE BUILD TOOL (Movie, 18 Oct).
//
// "can we make a DORMER command in the BUILD tab?" -- "i will need to refine
// it because there are different dormer looks and ways to build" -- "we will
// start with the full dormer with only front wall like on the NORTH POINT
// roof plan". And on the roof sheet: the main roof 3/12, the dormers 4/12,
// 40' wide (20' + 20' either side of grid 15).
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
// A 60 x 30 house, roofed at 8' at 3/12: its front eave at z = 38, its back
// (z = -8) a gable.
const EAVE = [[-8, -8], [68, -8], [68, 38], [-8, 38]];
const drawing = () => ({
  version: 1, planTurn: 0, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 1,
  walls: [], lines: [], floors: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
  roofs: [{ id: 'roof-1', levelId: 7, follows: 'none', pitch: 3, overhang: 8,
    points: EAVE.map(([x, z]) => ({ x, y: 0, z })),
    edges: ['gable', 'eave', 'eave', 'eave'], edgeOverhang: [0, 8, 8, 8],
    footprint: [[0, 0], [60, 0], [60, 30], [0, 30]].map(([x, z]) => ({ x, y: 0, z })) }],
});

async function open(page, level = 7) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto(`/MODEL.html?level=${level}&left=1&lpane=build`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
const click = async (page, at, x, z) => { await page.mouse.click(...at(x, z)); await page.waitForTimeout(100); };
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const key = page => page.locator('[data-tool-key="dormer"]');
async function arm(page) {
  await key(page).click();
  await expect(key(page)).toHaveAttribute('aria-pressed', 'true');
}

test('DORMER is a key in the BUILD tab; armed, its panel has the type, a 40\' width and 4/12', async ({ page }) => {
  await open(page);
  await expect(key(page)).toBeVisible();
  await expect(key(page)).toContainText('DORMER');
  await arm(page);
  await expect(page.locator('[data-dormer-type="full-gable"]')).toHaveText('FULL GABLE — FRONT WALL ONLY');
  await expect(page.locator('[data-dormer-type="full-gable"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-prop-field="dormer width"]')).toHaveValue("40'-0\"");
  await expect(page.locator('[data-roof-field="dormer pitch"]')).toHaveValue('4');
});

test('a click on the front eave puts a 40\' 4/12 dormer there, on the wall line; the next takes the width typed; one UNDO each', async ({ page }) => {
  const { at } = await open(page);
  await arm(page);
  await click(page, at, 30, 37.9);
  await expect(page.locator('#strip-message')).toContainText("DORMER 40'-0\" wide at 4/12");
  let [roof] = (await saved(page)).roofs;
  expect(roof.crossGables).toEqual([{ at: { x: 30, z: 30 }, widthFt: 40, pitch: 4 }]);
  // ITS FRONT WALL ON THE WALL LINE, and it runs back to meet the 3/12 roof:
  // 20' x 4/3 = 26'-8" in from the wall line.
  const P = await page.evaluate(r => window.DraftGeometry2D.crossGableShapes(r)[0].P, roof);
  expect(P.x).toBeCloseTo(30, 6);
  expect(P.z).toBeCloseTo(30 - 20 * 4 / 3, 6);
  // The width and pitch typed are the next one's; kept on its wall, a 16'
  // dormer clicked at x = 56 slides back to stand on it.
  await page.locator('[data-prop-field="dormer width"]').fill('16');
  await page.locator('[data-prop-field="dormer width"]').press('Enter');
  await page.locator('[data-roof-field="dormer pitch"]').fill('6');
  await page.locator('[data-roof-field="dormer pitch"]').press('Enter');
  await click(page, at, 56, 37.9);
  [roof] = (await saved(page)).roofs;
  expect(roof.crossGables[1]).toEqual({ at: { x: 52, z: 30 }, widthFt: 16, pitch: 6 });
  await page.keyboard.press('Control+z');
  [roof] = (await saved(page)).roofs;
  expect(roof.crossGables).toHaveLength(1);
});

test('a GABLE edge and the open sheet are refused, nothing placed', async ({ page }) => {
  const { at } = await open(page);
  await arm(page);
  await click(page, at, 30, -7.9);
  await expect(page.locator('#strip-message')).toContainText('GABLE');
  await click(page, at, 30, 15);
  await expect(page.locator('#strip-message')).toContainText('click ON an eave');
  const [roof] = (await saved(page)).roofs;
  expect(roof.crossGables).toBeUndefined();
});

test('from the SITE plan too', async ({ page }) => {
  const { at } = await open(page, 8);
  await arm(page);
  await click(page, at, 30, 37.9);
  const [roof] = (await saved(page)).roofs;
  expect(roof.crossGables).toHaveLength(1);
});
