// ESTIMATES (Movie, 23 Oct): "i guess we should start the ESTIMATION area"
// -- "will be easier to estimate directly from the file rather than from the
// PDF" -- "our estimation area should follow the ORDER and numbering of the
// SPECIFICATION area if we can". The quantities off the drawing, under the
// spec's numbers, with a waste percent per category and a unit price per
// line, saved in the .draft.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const P = (x, z) => ({ x, y: 0, z });
const W = (id, a, b, wallType, more = {}) => ({ id, levelId: 3, view: 'plan', wallType, refLine: 'center',
  baseHeight: 0, topHeight: 9, start: P(...a), end: P(...b), ...more });
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
// The harness's house: 20 x 12 of 2x6, a partition, a window, three doors
// and a garage door, a tiled WC and a laminate bedroom, a 6/12 asphalt roof.
const drawing = (estimates = undefined) => ({
  version: 1, board: 'drafting', levels: LEVELS, activeLevelIdx: 2, nextDrawingItemId: 50,
  walls: [
    W('n', [0, 0], [20, 0], 'stud_2x6', { finish: 'siding_h' }),
    W('e', [20, 0], [20, 12], 'stud_2x6', { finish: 'siding_h' }),
    W('s', [20, 12], [0, 12], 'stud_2x6', { finish: 'stucco' }),
    W('w', [0, 12], [0, 0], 'stud_2x6'),
    W('p', [10, 0], [10, 12], 'stud_2x4'),
  ],
  fenestrations: [
    { id: 'win1', wallId: 'n', levelId: 3, view: 'plan', type: 'window', offset: 3, width: 3, sillHeight: 3, headHeight: 7 },
    { id: 'door1', wallId: 'n', levelId: 3, view: 'plan', type: 'door', offset: 14, width: 3, sillHeight: 0, headHeight: 80 / 12, doorType: 'ext', doorStyle: 'single' },
    { id: 'door2', wallId: 'p', levelId: 3, view: 'plan', type: 'door', offset: 3, width: 32 / 12, sillHeight: 0, headHeight: 80 / 12, doorType: 'int', doorStyle: 'pocket' },
    { id: 'door3', wallId: 'p', levelId: 3, view: 'plan', type: 'door', offset: 8, width: 32 / 12, sillHeight: 0, headHeight: 80 / 12, doorType: 'int', doorStyle: 'single' },
    { id: 'gar', wallId: 's', levelId: 3, view: 'plan', type: 'door', offset: 2, width: 16, sillHeight: 0, headHeight: 7, garage: true },
  ],
  roomTags: [
    { id: 1, at: { x: 4, z: 3 }, levelId: 3, view: 'plan', name: 'WC', stamped: true, flooring: { type: 'tile' },
      points: [{ x: 0, z: 0 }, { x: 8, z: 0 }, { x: 8, z: 6 }, { x: 0, z: 6 }] },
    { id: 2, at: { x: 15, z: 4 }, levelId: 3, view: 'plan', name: 'BEDROOM', stamped: true, flooring: { type: 'laminate' },
      points: [{ x: 10, z: 0 }, { x: 20, z: 0 }, { x: 20, z: 8 }, { x: 10, z: 8 }] },
  ],
  roofs: [{ id: 'r1', levelId: 7, pitch: 6, roofing: 'asphalt', overhang: 2, edges: ['eave', 'eave', 'eave', 'eave'], points: [P(-2, -2), P(22, -2), P(22, 14), P(-2, 14)] }],
  outlines: [], floors: [], lines: [], dimensions: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  columns: [], beams: [], boneyardOutlines: [], levelLocks: [], underlays: [], fixtures: [],
  ...(estimates ? { estimates } : {}),
});

async function open(page, d = drawing()) {
  page.__errors = [];
  page.on('pageerror', err => page.__errors.push(String(err)));
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: d });
  await page.goto('/ESTIMATES.html');
  await expect(page.locator('[data-section="9-A"]')).toBeVisible();
}
test.afterEach(async ({ page }) => { expect(page.__errors || [], 'no page errors').toEqual([]); });
const stored = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await file.text());
}, BUCKET);
const row = (page, key) => page.locator(`[data-row="${key}"]`);

test('the sections stand in the specification\'s order under its numbers, with the counted ones filled', async ({ page }) => {
  await open(page);
  const ids = await page.locator('[data-section]').evaluateAll(els => els.map(el => el.dataset.section));
  const spec = await page.evaluate(() => window.DraftSpecMaster.sections().map(s => s.id));
  expect(ids).toEqual(spec);
  const divs = await page.locator('[data-division]').evaluateAll(els => els.map(el => el.dataset.division));
  expect(divs.slice(0, 3)).toEqual(['1', '2', '3']);
  await expect(page.locator('[data-section="3-A"]')).toContainText('—');
  // 9-A: the WC's tile and the bedroom's laminate, with 15% waste.
  await expect(row(page, '9-A:tile').locator('[data-qty]')).toHaveText('55.2 SQ FT');
  await expect(row(page, '9-A:tile')).toContainText('WC 48');
  await expect(row(page, '9-A:laminate').locator('[data-qty]')).toHaveText('92 SQ FT');
  // 7-B: the roof by its pitch, in squares too.
  await expect(row(page, '7-B:asphalt:6').locator('[data-qty]')).toHaveText('493.7 SQ FT');
  await expect(row(page, '7-B:asphalt:6')).toContainText('4.94 squares');
  // 9-B: the shell less its openings; the west wall has no finish set.
  await expect(row(page, '9-B:siding_h').locator('[data-qty]')).toHaveText('294.4 SQ FT');
  await expect(row(page, '9-B:none')).toHaveClass(/unassigned/);
  await expect(row(page, '9-B:none')).toContainText('NO FINISH SET');
  await expect(row(page, '9-B:none').locator('[data-price]'), 'a line still to be given a finish takes no price').toHaveCount(0);
  await expect(row(page, '9-B:siding_h').locator('[data-price]')).toHaveCount(1);
  // 8-A, 8-B: counted by size, the garage door on its own.
  await expect(row(page, '8-A:ext:single:36').locator('[data-qty]')).toHaveText('1 EA');
  await expect(row(page, '8-A:int:pocket:32').locator('[data-qty]')).toHaveText('1 EA');
  await expect(row(page, '8-A:garage:192x84')).toContainText('OVERHEAD DOOR 192" x 84"');
  await expect(row(page, '8-B:36x48').locator('[data-qty]')).toHaveText('1 EA');
  await expect(page.locator('[data-grand-total]')).toHaveText('—');
});

test('a unit price typed against a line totals it, the section and the whole; it is saved in the file', async ({ page }) => {
  await open(page);
  // MEANWHILE, IN ANOTHER TAB, a sixth wall is drawn: the price must land on
  // that drawing, not on the copy this page read when it opened.
  await page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const d = JSON.parse(await file.text());
    d.walls.push({ ...d.walls[0], id: 'later', start: { x: 0, y: 0, z: 20 }, end: { x: 20, y: 0, z: 20 } });
    await window.SharedFileStore.saveSharedFile(new File([JSON.stringify(d)], 'drawing.json', { type: 'application/json' }), bucket);
  }, BUCKET);
  await row(page, '9-A:tile').locator('[data-price]').fill('2.5');
  await row(page, '9-A:tile').locator('[data-price]').press('Enter');
  await expect(row(page, '9-A:tile').locator('[data-amount]')).toHaveText('$138.00');
  await expect(page.locator('[data-section="9-A"] [data-section-total]')).toHaveText('$138.00');
  await expect(page.locator('[data-grand-total]')).toHaveText('138.00');
  await expect(page.locator('#status')).toContainText('priced');
  await row(page, '8-B:36x48').locator('[data-price]').fill('450');
  await row(page, '8-B:36x48').locator('[data-price]').press('Enter');
  await expect(page.locator('[data-grand-total]')).toHaveText('588.00');
  await expect(page.locator('[data-division="8"] .div-title .total')).toHaveText('$450.00');
  await expect(page.locator('#status')).toContainText('priced');
  const d = await stored(page);
  expect(d.estimates.prices).toEqual({ '9-A:tile': 2.5, '8-B:36x48': 450 });
  expect(d.walls.map(w => w.id), 'the drawing itself is untouched, the other tab\'s wall with it').toContain('later');
  expect(d.walls).toHaveLength(6);
  // Reopened, the prices are still there.
  await page.reload();
  await expect(row(page, '9-A:tile').locator('[data-amount]')).toHaveText('$138.00');
});

test('the waste percent per category rides every area in it and is saved; a blank goes back to 15', async ({ page }) => {
  await open(page, drawing({ prices: { '9-A:tile': 2 } }));
  const waste = page.locator('[data-waste="flooring"]');
  await expect(waste).toHaveValue('15');
  await waste.fill('10');
  await waste.press('Enter');
  await expect(row(page, '9-A:tile').locator('[data-qty]')).toHaveText('52.8 SQ FT');
  await expect(row(page, '9-A:laminate').locator('[data-qty]')).toHaveText('88 SQ FT');
  await expect(row(page, '9-A:tile').locator('[data-amount]')).toHaveText('$105.60');
  await expect(row(page, '7-B:asphalt:6').locator('[data-qty]'), 'roofing keeps its own').toHaveText('493.7 SQ FT');
  await expect(page.locator('#status')).toContainText('flooring waste 10%');
  let d = await stored(page);
  expect(d.estimates.waste).toEqual({ flooring: 10 });
  await waste.fill('');
  await waste.press('Enter');
  await expect(row(page, '9-A:tile').locator('[data-qty]')).toHaveText('55.2 SQ FT');
  d = await stored(page);
  expect(d.estimates.waste).toEqual({});
});

test('the foot\'s ESTIMATES is a link to the page, and the page marks itself as where you are', async ({ page }) => {
  await open(page);
  await expect(page.locator('[data-page="estimates"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-page="specs"]')).toHaveAttribute('href', './SPECS.html');
  await page.goto('/MODEL.html?level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect(page.locator('[data-page="estimates"]')).toHaveAttribute('href', './ESTIMATES.html');
});
