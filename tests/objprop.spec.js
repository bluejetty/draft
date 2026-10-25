// OBJ / PROP (Movie, 24 Oct): "i'd like to be able to click on the FIXTURES /
// CABINETS and items like that in a different window, maybe an additional one
// the has a tab ... (make it similar to the 'SHELF' tabs but upside down ...
// then open up the window with the to and side views and properties to change
// down below" -- "can you call that tab OBJ / PROP".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const W = (id, a, b) => ({ id, levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center',
  baseHeight: 0, topHeight: 9, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
const FX = (id, kind, offset, width, depth) => ({ id, wallId: 'a', levelId: 3, view: 'plan', kind, offset, width, depth, side: 1 });
const drawing = () => ({
  version: 1, board: 'drafting', levels: [{ id: 3, name: 'MAIN FL', elev: 0 }], activeLevelIdx: 0, nextDrawingItemId: 50,
  walls: [W('a', [0, 0], [16, 0])],
  fixtures: [FX('c', 'cabinet', 3, 4, 2), FX('sb', 'sinkbase', 7, 4, 2), FX('fr', 'fridge', 11, 3, 2.5)],
  fenestrations: [], lines: [], floors: [], roofs: [], dimensions: [], outlines: [], shapes: [], groups: [],
  surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [], beams: [], boneyardOutlines: [], levelLocks: [], underlays: [],
});
async function open(page) {
  page.__errors = [];
  page.on('pageerror', err => page.__errors.push(String(err)));
  await page.setViewportSize({ width: 1366, height: 700 });
  await h.openModel(page, { webgl: false });
  await page.evaluate(async f => window.SharedFileStore.saveSharedFile(
    new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), 'model-drawing'), drawing());
  await page.goto('/MODEL.html?level=3&right=1&left=1&lpane=build&pane=levels');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(250);
  const frame = await h.planFrame(page);
  const z = await page.evaluate(d => window.DraftFixtureGeometry.fixtureGeometry(d.walls, d.fixtures[1]).center.z, drawing());
  await page.keyboard.press('s');
  return { ...frame, z };
}
test.afterEach(async ({ page }) => { expect(page.__errors || [], 'no page errors').toEqual([]); });
const inked = page => page.evaluate(() => [...document.querySelectorAll('#objprop [data-objprop-view]')].map(cv => {
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n += 1;
  return [cv.dataset.objpropView, n > 50];
}));

test('the tab hangs under the top bar; a click on a sink base opens the window on it: four views and its properties', async ({ page }) => {
  const { at, z } = await open(page);
  const tab = page.locator('#objprop-tab');
  await expect(tab).toBeVisible();
  await expect(tab).toContainText('OBJ / PROP');
  await expect(page.locator('#objprop')).toBeHidden();
  const tabBox = await tab.boundingBox();
  const bar = await page.locator('#strip').boundingBox();
  expect(Math.abs(tabBox.y - (bar.y + bar.height)), 'hung from the top bar').toBeLessThan(3);
  await page.mouse.click(...at(7, z));
  const win = page.locator('#objprop');
  await expect(win).toBeVisible();
  await expect(win.locator('[data-objprop-title]')).toHaveText('SINK BASE');
  expect(await inked(page)).toEqual([['top', true], ['front', true], ['left', true], ['right', true]]);
  for (const field of ['width', 'depth']) await expect(win.locator(`[data-prop-field="${field}"]`)).toBeVisible();
  for (const pick of ['bowls', 'uppers']) await expect(win.locator(`[data-prop-select="${pick}"]`)).toBeVisible();
});

test('UPPERS OFF in the window saves on the piece; the tab shuts it; nothing picked says to pick a fixture', async ({ page }) => {
  const { at, z } = await open(page);
  await page.mouse.click(...at(7, z));
  const win = page.locator('#objprop');
  await win.locator('[data-prop-select="uppers"]').selectOption('off');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  expect((await h.savedDrawing(page)).fixtures.find(f => f.id === 'sb').uppers).toBe(false);
  await expect(win.locator('[data-prop-select="uppers"]'), 'the window shows what it saved').toHaveValue('off');
  // Empty sheet in front of the run, clear of both panes.
  await page.mouse.click(...at(7, 3.2));
  await expect(win.locator('[data-objprop-title]')).toHaveText('PICK A FIXTURE, CABINET OR STAIR');
  await page.locator('#objprop-tab').click();
  await expect(win).toBeHidden();
});

test('the faces: a run tiled in 24" bays, the sides mirrored, a kind with no trace a plain box', async ({ page }) => {
  await open(page);
  const got = await page.evaluate(() => {
    const V = window.DraftObjViews, FP = window.DraftFixtureProfiles;
    const run = V.faceOf({ kind: 'cabinet', width: 8, depth: 2 }, 'front', FP);
    const right = V.faceOf({ kind: 'sinkbase', width: 4, depth: 2 }, 'right', FP);
    const left = V.faceOf({ kind: 'sinkbase', width: 4, depth: 2 }, 'left', FP);
    const xs = f => f.polys.flatMap(p => p.filter((v, i) => i % 2 === 0));
    const plain = V.faceOf({ kind: 'shower', width: 5, depth: 3 }, 'front', FP);
    return {
      runWide: Math.round(Math.max(...xs(run)) - Math.min(...xs(run))), runBays: run.polys.length / FP.profileFor('cabinet', 'front').polys.length,
      // Each point of LEFT is the same point of RIGHT turned about the depth.
      mirrored: right.polys.every((p, i) => p.every((v, j) => j % 2 === 1 || Math.abs(v + left.polys[i][j] - 24) < 1e-6)),
      deep: right.widthIn,
      plain: [plain.traced, plain.widthIn, plain.heightIn],
    };
  });
  expect(got).toEqual({ runWide: 96, runBays: 4, mirrored: true, deep: 24, plain: [false, 60, 80] });
});
