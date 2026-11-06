// DRAW STANDALONE SITE PLAN — a site plan with no house, and nothing else
// offered.
//
// Movie, 6 Nov: "when the AUTOHOUSE options is brought up at the begining -
// above it can we have an option - DRAW STANDALONE SITE PLAN. put it like
// the RESIDENTIAL SUITES and COMMERCIAL SUITE - half size but put the
// STANDALONE SITE PLAN in a box on the right side of DETACHED GARAGE. leave
// a spot below i will want to ad somthing else there probably" -- and then:
// "and then that plan will be only for the SITE PLAN layer - no other layers
// offered".
//
// THREE THINGS, and each is checked where it would quietly go wrong:
//
//   1. THE TILE ON THE BOARD: half a card, left of DETACHED GARAGE, with the
//      empty half under it. Measured against the family cards rather than in
//      pixels, because the board scales with the window and a tile that was
//      merely "about half" would read as full-size on a wider screen.
//   2. THE PRESS: the board goes down, no house is built, the drafter is on
//      SITE, and the file says `standalone: 'site'` -- the file's word, so
//      the sheet set agrees with the screen (the HOUSE FOOTPRINT switch's
//      own rule, site-footprint-optional.spec.js).
//   3. NO OTHER LAYERS OFFERED: the LEVELS panel lists SITE and no other
//      level, no elevation, no section and no + ADD; the view rail seats
//      one card; LAYOUT deals one sheet and + ADD VIEWPORT offers one view.
//      And ordering a house off the board gives the levels back, because
//      the house is about to need them.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const SITE = 8;
const ring = ([w, d]) => [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]
  .map(([x, z]) => ({ x, y: 0, z }));

// The blank the page itself opens on: five levels, nothing drawn.
const blank = (extra = {}) => ({
  version: 1, planTurn: 0, board: 'drafting',
  levels: [{ id: SITE, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -10 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
  ...extra,
});
// A standalone site plan as saved: the mark, and a lot on SITE.
const standaloneWithLot = () => blank({
  standalone: 'site',
  outlines: [{ id: 'lot', levelId: SITE, site: true, garage: false, detached: false, masterId: null,
    foundation: null, closed: true, points: ring([60, 120]), overriddenSrcIds: [] }],
});

async function seed(page, file) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, drawing }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(drawing)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, drawing: file });
}
async function openModel(page, file = blank(), query = '') {
  await seed(page, file);
  await page.goto(`/MODEL.html${query}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(300);
}
const saved = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};
// NOT NOW on the lot card, where SITE asks it: the question is right, and it
// is not what these checks are about.
async function dismissLotCard(page) {
  const later = page.locator('#lot-pick [data-lot-pick-ok]');
  if (await later.isVisible().catch(() => false)) await later.click();
}
const levelRows = page => page.locator('#levels-panel [data-level-row]')
  .evaluateAll(rows => rows.map(row => row.dataset.levelRow));
const panelHasText = (page, re) => page.locator('#levels-panel').locator(`text=${re}`).count();

test('the tile stands left of DETACHED GARAGE, half a card high, with its empty half under it', async ({ page }) => {
  await openModel(page);
  await h.openDriveThru(page);
  const tile = page.locator('#build-families [data-build-entry="site-standalone"]');
  await expect(tile).toHaveText('DRAW STANDALONE SITE PLAN');
  const stack = page.locator('#build-families [data-build-stack="sitePlan"]');
  await expect(stack.locator('.dt-stack-spare'), 'the spot kept under it').toHaveCount(1);

  const tileBox = await tile.boundingBox();
  const garage = await page.locator('[data-build-family="detachedGarage"]').boundingBox();
  const suite = await page.locator('[data-build-entry="suite-residential"]').boundingBox();
  // TO THE LEFT OF DETACHED GARAGE, first on the shelf ("oops i meant to the
  // left of detached garage"), and the board's order is the module's.
  expect(tileBox.x + tileBox.width, 'left of DETACHED GARAGE').toBeLessThan(garage.x + 1);
  await expect(page.locator('#build-families > *').first(), 'first on the shelf')
    .toHaveAttribute('data-build-stack', 'sitePlan');
  // HALF SIZE, LIKE THE SUITE PAIR: within a line's worth of the
  // RESIDENTIAL SUITE tile's height (its two-line label makes it a few px
  // taller than its empty half), and no more than ~55% of the card beside it.
  expect(Math.abs(tileBox.height - suite.height), 'the SUITE tile\'s height').toBeLessThan(8);
  expect(tileBox.height, 'half the card').toBeLessThan(garage.height * 0.56);
  // AND THE EMPTY HALF IS BELOW IT, not beside it: the tile sits in the
  // card's top half.
  expect(tileBox.y, 'the tile is the top half').toBeLessThan(garage.y + garage.height / 2);
});

test('the press drops the board, builds nothing, lands on SITE and marks the file standalone', async ({ page }) => {
  await openModel(page);
  await h.openDriveThru(page);
  await page.locator('[data-build-entry="site-standalone"]').click();
  await expect(page.locator('#drivethru'), 'the board goes down').toHaveAttribute('data-shut', '');
  await dismissLotCard(page);
  expect(await h.modelLevelId(page), 'standing on SITE').toBe(String(SITE));
  expect(await page.evaluate(() => drawing.standalone)).toBe('site');
  expect(await page.evaluate(() => drawing.walls.length + drawing.roofs.length), 'no house was built').toBe(0);
  // THE BONE DOES NOT PULSE FOR AN ORDER THAT IS NOT ONE.
  await expect(page.locator('#bone')).not.toHaveAttribute('data-ready', '');
  const d = await saved(page);
  expect(d.standalone, 'the mark is the file\'s, so LAYOUT reads it too').toBe('site');
  expect(d.buildType ?? null, 'a site plan is not a house type').toBeNull();
});

test('a standalone file offers SITE PLAN and no other level, elevation, section or + ADD, on the panel and the rail', async ({ page }) => {
  await openModel(page, standaloneWithLot(), `?level=${SITE}`);
  await h.openModelRail(page);
  expect(await levelRows(page), 'one level row, SITE').toEqual([String(SITE)]);
  await expect(page.locator('#levels-panel [data-add-level]'), 'no + ADD').toHaveCount(0);
  await expect(page.locator('#levels-panel [data-add-cut]'), 'no + CUT').toHaveCount(0);
  await expect(page.locator('#levels-panel [data-view-row]'), 'no elevation or section rows').toHaveCount(0);
  expect(await panelHasText(page, /Elevations|Sections/), 'nor their headings').toBe(0);
  // THE VIEW RAIL SEATS ONE CARD, the site plan's.
  await expect(page.locator('#view-rail .seat')).toHaveCount(1);
  await expect(page.locator('#view-rail .seat .seat-label')).toHaveText(/SITE PLAN/);
});

test('ordering a house off the board gives the levels back', async ({ page }) => {
  await openModel(page, standaloneWithLot(), `?level=${SITE}`);
  await dismissLotCard(page);
  await h.openDriveThru(page);
  await page.locator('[data-build-family="bungalow"]').click();
  await page.locator('[data-build-entry="bungalow"]').click();
  expect(await page.evaluate(() => drawing.standalone ?? null), 'the mark is gone').toBeNull();
  await h.openModelRail(page);
  expect((await levelRows(page)).length, 'every level is listed again').toBeGreaterThan(1);
  expect(await panelHasText(page, /Elevations/)).toBeGreaterThan(0);
});

test('LAYOUT deals the SITE PLAN alone and + ADD VIEWPORT offers nothing else', async ({ page }) => {
  await seed(page, standaloneWithLot());
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.evaluate(() => page._composeDefaultSet());
  await page.waitForTimeout(500);
  const titles = await page.evaluate(() => page.state.sheets.map(sheet => sheet.title));
  expect(titles, 'one sheet').toEqual(['SITE PLAN']);
  const offered = await page.evaluate(() => page._addChoices()
    .map(([head, list]) => [head, list.map(view => view.label)]));
  expect(offered).toEqual([['PLANS', ['SITE PLAN']]]);
});
