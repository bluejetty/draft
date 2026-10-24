// UPPERS ON OR OFF OVER EACH LOWER PIECE (Movie, 24 Oct): "in the kitchen can
// we have ability to click on each peice to adjust properties, and allow the
// lower cabinets to turn on or off upper cabinet that would match the width.
// oh ya also above the fridge too, but the fridge upper cabinet should be 18"
// deep (rather than typical 12 ")". Asked which start ON: "All lowers, all
// ON"; and where: "Everywhere" -- the plan and the LAYOUT sheets, which both
// draw through render-2d.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const W = (id, a, b) => ({ id, levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center',
  baseHeight: 0, topHeight: 9, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
const FX = (id, kind, offset, width, depth, more = {}) => ({ id, wallId: 'a', levelId: 3, view: 'plan', kind, offset, width, depth, side: 1, ...more });
const drawing = () => ({
  version: 1, board: 'drafting', levels: [{ id: 3, name: 'MAIN FL', elev: 0 }], activeLevelIdx: 0, nextDrawingItemId: 50,
  walls: [W('a', [0, 0], [20, 0])],
  fixtures: [FX('cab', 'cabinet', 2, 3, 2), FX('sb', 'sinkbase', 5.5, 4, 2), FX('dw', 'dish', 8.5, 2, 2),
    FX('fr', 'fridge', 11.5, 3, 2.5),
    // An island 8' out, its sink on it.
    FX('isl', 'island', 16, 6, 3, { standoff: 8 }), FX('isk', 'sink', 16, 2.5, 2, { standoff: 8 })],
  fenestrations: [], lines: [], floors: [], roofs: [], dimensions: [], outlines: [], shapes: [], groups: [],
  surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [], beams: [], boneyardOutlines: [], levelLocks: [], underlays: [],
});
async function open(page) {
  page.__errors = [];
  page.on('pageerror', err => page.__errors.push(String(err)));
  await h.openModel(page, { webgl: false });
  await page.evaluate(async f => window.SharedFileStore.saveSharedFile(
    new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), 'model-drawing'), drawing());
  await page.goto('/MODEL.html?level=3&left=1&lpane=build');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(250);
  return h.planFrame(page);
}
test.afterEach(async ({ page }) => { expect(page.__errors || [], 'no page errors').toEqual([]); });
const uppersSaid = page => page.evaluate(() => (window.__sizeMarks || []).filter(m => m.what === 'upper').map(m => `${m.id}:${m.label}`).sort());
const saved = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};

test('every lower piece hangs uppers as wide as it, the sink base and the DW too; none over an island', async ({ page }) => {
  await open(page);
  expect(await uppersSaid(page)).toEqual(['cab:36', 'dw:24', 'fr:36', 'sb:48']);
});

test('PROPERTIES: UPPERS OFF on the sink base takes its uppers away; one UNDO puts them back', async ({ page }) => {
  const { at } = await open(page);
  const z = await page.evaluate(d => window.DraftFixtureGeometry.fixtureGeometry(d.walls, d.fixtures[1]).center.z, drawing());
  await page.keyboard.press('s');
  await page.mouse.click(...at(5.5, z));
  const uppers = page.locator('#props-slot [data-prop-select="uppers"]');
  await expect(uppers).toBeVisible();
  await expect(uppers).toHaveValue('on');
  await uppers.selectOption('off');
  expect((await saved(page)).fixtures.find(f => f.id === 'sb').uppers).toBe(false);
  await expect.poll(() => uppersSaid(page)).toEqual(['cab:36', 'dw:24', 'fr:36']);
  await page.keyboard.press('Control+z');
  await expect(page.locator('#strip-message')).not.toContainText('version from');
  expect('uppers' in (await saved(page)).fixtures.find(f => f.id === 'sb'), 'back ON, no key').toBe(false);
  await expect.poll(() => uppersSaid(page)).toEqual(['cab:36', 'dw:24', 'fr:36', 'sb:48']);
});

test('the fridge\'s upper is 18" deep, a cabinet\'s 12"; a piece on an island takes no switch; the file keeps only OFF', async ({ page }) => {
  await open(page);
  const got = await page.evaluate(d => {
    const FG = window.DraftFixtureGeometry, R = window.DraftRender2D, K = window.DraftFixtureKinds, F = window.DraftDrawingFormat;
    const deep = id => {
      const fx = d.fixtures.find(f => f.id === id);
      const g = FG.fixtureGeometry(d.walls, fx);
      return Math.round(Math.abs(R.upperFrontOff2D(g, fx) - g.backOff) * 12);
    };
    const kept = F.fixtures([{ ...d.fixtures[1], uppers: false }, { ...d.fixtures[2], id: 'on', uppers: true }], new Set([3]));
    return { fridge: deep('fr'), cab: deep('cab'), islandSink: K.takesUppers(d.fixtures[5]), sinkBase: K.takesUppers(d.fixtures[1]),
      kept: kept.map(f => f.uppers) };
  }, drawing());
  expect(got).toEqual({ fridge: 18, cab: 12, islandSink: false, sinkBase: true, kept: [false, undefined] });
});
