// SINK CABINET (jb, 27 Nov 2026): "can we make one with a smaller sink size
// that will be dropped into a CABINET - but call it SINK CABINET ... show a
// sink hole with a sink. and for OBJ PROP allow the user to either ADD a sink
// to a CABINET or REMOVE a sink from a SINK CABINET". The old SINK BASE is the
// SINK CABINET (its id, 'sinkbase', kept so saved files open), and the
// farmhouse SINK with no cabinet is the APRON SINK.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const W = (id, a, b) => ({ id, levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center',
  baseHeight: 0, topHeight: 9, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
const FX = (id, kind, offset, width, depth, more) => ({ id, wallId: 'a', levelId: 3, view: 'plan', kind, offset, width, depth, side: 1, ...more });
const drawing = () => ({
  version: 1, board: 'drafting', levels: [{ id: 3, name: 'MAIN FL', elev: 0 }], activeLevelIdx: 0, nextDrawingItemId: 50,
  walls: [W('a', [0, 0], [16, 0])],
  fixtures: [FX('c', 'cabinet', 2, 3, 2), FX('sb', 'sinkbase', 6.5, 4, 2), FX('s', 'sink', 11, 3, 2)],
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
  const z = await page.evaluate(d => window.DraftFixtureGeometry.fixtureGeometry(d.walls, d.fixtures[0]).center.z, drawing());
  await page.keyboard.press('s');
  return { ...frame, z };
}
test.afterEach(async ({ page }) => { expect(page.__errors || [], 'no page errors').toEqual([]); });

test('the chips say APRON SINK and SINK CABINET', async ({ page }) => {
  await open(page);
  const K = await page.evaluate(() => Object.fromEntries(window.DraftFixtureKinds.FIXTURE_KINDS.map(k => [k.id, k.label])));
  expect(K.sink).toBe('APRON SINK');
  expect(K.sinkbase).toBe('SINK CABINET');
  await expect(page.locator('#tool-slot button', { hasText: /^APRON SINK$/ })).toBeVisible();
  await expect(page.locator('#tool-slot button', { hasText: /^SINK CABINET$/ })).toBeVisible();
});

test('the sink cabinet draws a drop-in sink smaller than the cabinet: 33" rim on a 48" double, 25" on a single, 3" clear of a narrow cabinet ends', async ({ page }) => {
  await open(page);
  const got = await page.evaluate(() => {
    const R = window.DraftRender2D;
    const dbl = R.sinkBowlSpans(0, 4, 'double', true), one = R.sinkBowlSpans(0, 4, 'single', true);
    const narrow = R.sinkBowlSpans(0, 2, 'double', true);
    return { dbl: dbl.rim, one: one.rim, narrow: narrow.rim, inside: dbl.spans.every(([a, b]) => a > dbl.rim[0] && b < dbl.rim[1]) };
  });
  expect((got.dbl[1] - got.dbl[0]) * 12).toBeCloseTo(33, 5);
  expect((got.one[1] - got.one[0]) * 12).toBeCloseTo(25, 5);
  expect((got.dbl[0] + got.dbl[1]) / 2).toBeCloseTo(2, 5);
  expect(got.narrow[0] * 12, 'a narrow cabinet keeps 3" each end').toBeCloseTo(3, 5);
  expect(got.inside, 'the bowls sit inside the rim').toBe(true);
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/2-after-cabinet-sinkcabinet-apron.png` });
});

test('OBJ / PROP: ADD SINK makes a CABINET a SINK CABINET in place, REMOVE SINK takes it out, UNDO steps back', async ({ page }) => {
  const { at, z } = await open(page);
  await page.mouse.click(...at(2, z));
  const win = page.locator('#objprop');
  await expect(win).toBeVisible();
  await expect(win.locator('[data-objprop-title]')).toHaveText('CABINET');
  await win.locator('[data-sink-toggle="add"]').click();
  await expect(win.locator('[data-objprop-title]')).toHaveText('SINK CABINET');
  await expect(win.locator('[data-prop-select="bowls"]')).toBeVisible();
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/3-add-sink-on-cabinet.png` });
  await win.locator('[data-prop-select="bowls"]').selectOption('single');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  let saved = (await h.savedDrawing(page)).fixtures.find(f => f.id === 'c');
  expect([saved.kind, saved.width, saved.offset, saved.bowls]).toEqual(['sinkbase', 3, 2, 'single']);
  await win.locator('[data-sink-toggle="remove"]').click();
  await expect(win.locator('[data-objprop-title]')).toHaveText('CABINET');
  await expect(win.locator('[data-sink-toggle="add"]')).toBeVisible();
  await page.locator('#save').click();
  await h.waitForSaved(page);
  saved = (await h.savedDrawing(page)).fixtures.find(f => f.id === 'c');
  expect([saved.kind, saved.width, saved.offset, 'bowls' in saved]).toEqual(['cabinet', 3, 2, false]);
  // UNDO puts the sink back, bowls and all.
  await page.keyboard.press('Control+z');
  await expect(win.locator('[data-objprop-title]')).toHaveText('SINK CABINET');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  saved = (await h.savedDrawing(page)).fixtures.find(f => f.id === 'c');
  expect([saved.kind, saved.bowls]).toEqual(['sinkbase', 'single']);
});

test('the APRON SINK has no ADD / REMOVE SINK button', async ({ page }) => {
  const { at, z } = await open(page);
  await page.mouse.click(...at(11, z));
  const win = page.locator('#objprop');
  await expect(win.locator('[data-objprop-title]')).toHaveText('APRON SINK');
  await expect(win.locator('[data-sink-toggle]')).toHaveCount(0);
});
