// SINK CABINET (jb, 27 Nov 2026): "can we make one with a smaller sink size
// that will be dropped into a CABINET - but call it SINK CABINET ... show a
// sink hole with a sink. and for OBJ PROP allow the user to either ADD a sink
// to a CABINET or REMOVE a sink from a SINK CABINET". The old SINK BASE is the
// SINK CABINET (its id, 'sinkbase', kept so saved files open), and the
// farmhouse SINK with no cabinet is the SINK APRON.
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

test('one SINK chip: a press places a SINK CABINET, hover offers the four sinks', async ({ page }) => {
  const { at, z } = await open(page);
  const K = await page.evaluate(() => Object.fromEntries(window.DraftFixtureKinds.FIXTURE_KINDS.map(k => [k.id, k.label])));
  expect([K.sinkbase, K.sink, K.laundrysink, K.mopsink]).toEqual(['SINK CABINET', 'SINK APRON', 'SINK LAUNDRY', 'SINK MOP']);
  const chip = page.locator('#tool-slot [data-fixture-pop="sink"]');
  await expect(chip).toHaveText('SINK');
  await expect(chip, 'one chip for every sink').toHaveCount(1);
  for (const id of ['sinkbase', 'sink', 'laundrysink', 'mopsink']) {
    await expect(page.locator(`#tool-slot [data-fixture-kind="${id}"]`), `${id} has no chip of its own`).toHaveCount(0);
  }
  const pop = page.locator('#sink-pop');
  await expect(pop).toBeHidden();
  await chip.hover();
  await expect(pop).toBeVisible();
  await expect(pop.locator('button')).toHaveText(['SINK CABINET', 'SINK APRON', 'SINK LAUNDRY', 'SINK MOP']);
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/4-sink-button-hover.png` });
  // Off the chip and the pop-up both, it goes.
  await page.mouse.move(700, 600);
  await expect(pop).toBeHidden();
  // THE DEFAULT: a press on SINK itself arms the SINK CABINET.
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => fixtureKindId)).toBe('sinkbase');
  // A pick in the pop-up arms that sink, and the chip stays lit for it.
  await chip.hover();
  await pop.locator('[data-fixture-kind="mopsink"]').click();
  await expect(pop).toBeHidden();
  expect(await page.evaluate(() => fixtureKindId)).toBe('mopsink');
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
});

test('SINK LAUNDRY and SINK MOP save, open, and draw their own pictures', async ({ page }) => {
  await open(page);
  const got = await page.evaluate(() => {
    const R = window.DraftRender2D;
    const strokes = kind => {
      const c = document.createElement('canvas'); c.width = 200; c.height = 200;
      const ctx = c.getContext('2d'); let n = 0;
      const s = ctx.stroke.bind(ctx); ctx.stroke = (...a) => { n += 1; return s(...a); };
      const walls = [{ id: 'w', start: { x: 0, y: 0, z: 0 }, end: { x: 10, y: 0, z: 0 }, wallType: 'stud_2x4', refLine: 'center' }];
      const fx = { id: 'f', wallId: 'w', kind, offset: 5, width: 2, depth: 2, side: 1 };
      R.drawFixture2D(ctx, p => ({ x: p.x * 15, y: p.z * 15 + 50 }), fx, {}, walls[0], {
        fixtureGeometry: f => window.DraftFixtureGeometry.fixtureGeometry(walls, f), FIXTURE_COLOR: '#000', fixtureFill: '#fff', COUNTER_OVERHANG_FT: 0.125 });
      return n;
    };
    return { ids: window.DraftFixtureKinds.STORABLE_KIND_IDS.filter(id => /sink/.test(id)),
      laundry: strokes('laundrysink'), mop: strokes('mopsink'), plain: strokes('washer') };
  });
  expect(got.ids).toEqual(expect.arrayContaining(['laundrysink', 'mopsink']));
  expect(got.laundry, 'a bowl and a drain inside the box').toBeGreaterThan(2);
  expect(got.mop, 'a basin, a drain and the fall lines').toBeGreaterThan(got.laundry);
});

test('OBJ / PROP: SINK TYPE turns any sink into any other, in place', async ({ page }) => {
  const { at, z } = await open(page);
  await page.mouse.click(...at(11, z));
  const win = page.locator('#objprop');
  await expect(win.locator('[data-objprop-title]')).toHaveText('SINK APRON');
  const type = win.locator('[data-prop-select="sink type"]');
  await expect(type).toHaveValue('sink');
  await type.selectOption('laundrysink');
  await expect(win.locator('[data-objprop-title]')).toHaveText('SINK LAUNDRY');
  await expect(win.locator('[data-prop-select="bowls"]'), 'a laundry tub has one bowl, no choice').toHaveCount(0);
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const saved = (await h.savedDrawing(page)).fixtures.find(f => f.id === 's');
  expect([saved.kind, saved.width, saved.offset]).toEqual(['laundrysink', 3, 11]);
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/5-sink-type-on-objprop.png` });
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

test('the SINK APRON has no ADD / REMOVE SINK button', async ({ page }) => {
  const { at, z } = await open(page);
  await page.mouse.click(...at(11, z));
  const win = page.locator('#objprop');
  await expect(win.locator('[data-objprop-title]')).toHaveText('SINK APRON');
  await expect(win.locator('[data-sink-toggle]')).toHaveCount(0);
});
