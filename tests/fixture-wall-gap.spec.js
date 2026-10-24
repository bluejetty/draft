// HALF AN INCH OFF THE WALLS A PIECE STANDS AGAINST (Movie, 23 Oct).
//
// "for the BATHRUB / SHOWER / and SINK / KITCHEN CABINETS.. can you add 1/2"
// to the sides of the item (for example a 60X30 bathtub show it 60x30 but add
// 1/2" on back and sides (not on front)" -- "the corner at the extra 1/2"
// point will be the important point i need to attached to the corner of
// wall"; "anything that is 'against' a wall", "not the toilet", "only when
// against a wall", "faint line", "update all the stuff", and the ready-made
// rooms too.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const W = (id, a, b) => ({ id, levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 9, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 },
  { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
// A ROOM 16 x 12, its back wall along z = 0 and its side wall along x = 0.
const drawing = (fixtures = []) => ({
  version: 1, board: 'drafting', levels: LEVELS, activeLevelIdx: 2, nextDrawingItemId: 50,
  walls: [W('back', [0, 0], [16, 0]), W('side', [0, 0], [0, 12]), W('right', [16, 0], [16, 12]), W('front', [16, 12], [0, 12])],
  fixtures, lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [], outlines: [], shapes: [],
  surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [], beams: [],
  boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
});

async function open(page, fixtures) {
  page.__errors = [];
  page.on('pageerror', err => page.__errors.push(String(err)));
  await h.openModel(page, { webgl: false });
  await page.evaluate(async f => window.SharedFileStore.saveSharedFile(
    new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), 'model-drawing'), drawing(fixtures));
  await page.goto('/MODEL.html?level=3&left=1&lpane=build');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
test.afterEach(async ({ page }) => { expect(page.__errors || [], 'no page errors').toEqual([]); });
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
async function place(page, at, kind, x, z) {
  const chip = page.locator(`[data-fixture-kind="${kind}"]`);
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.move(...at(x, z));
  await page.mouse.click(...at(x, z));
  await page.waitForTimeout(120);
}
const FACE = 0.229;          // a 2x6's face off its line, to the 1/1000 ft
const GAP = 0.5 / 12;
const FX = (id, wallId, kind, offset, width, more = {}) => ({ id, wallId, levelId: 3, view: 'plan', kind, offset, width, depth: 2, side: 1, ...more });
const box = (page, d, id) => page.evaluate(({ d, id }) => {
  const g = window.DraftFixtureGeometry.fixtureGeometry(d.walls, d.fixtures.find(f => f.id === id));
  return { x0: Math.min(...g.corners.map(p => p.x)), x1: Math.max(...g.corners.map(p => p.x)),
    z0: Math.min(...g.corners.map(p => p.z)), z1: Math.max(...g.corners.map(p => p.z)) };
}, { d, id });

test('a shower pressed by the corner stands half an inch off both walls, its size its own', async ({ page }) => {
  const { at } = await open(page);
  await place(page, at, 'shower', 1.8, 1.5);
  const d = await saved(page);
  const v = d.fixtures.find(f => f.kind === 'shower');
  expect(v, 'a shower was placed').toBeTruthy();
  const b = await box(page, d, v.id);
  expect(b.x0, 'half an inch off the side wall').toBeCloseTo(FACE + GAP, 3);
  expect(b.z0, 'half an inch off the back wall').toBeCloseTo(FACE + GAP, 3);
  expect(b.x1 - b.x0, 'its own width').toBeCloseTo(v.width, 3);
});

test('a vanity run pressed from the corner starts its half inch off the side wall', async ({ page }) => {
  const { at } = await open(page);
  // From 3 ft along, back to within a couple of inches of the side wall.
  await place(page, at, 'vanity', 3, 0.5);
  await page.mouse.move(...at(0.45, 0.4));
  await page.mouse.click(...at(0.45, 0.4));
  await page.waitForTimeout(120);
  const d = await saved(page);
  const v = d.fixtures.find(f => f.kind === 'vanity');
  expect(v, 'a vanity was placed').toBeTruthy();
  const b = await box(page, d, v.id);
  expect(b.x0, 'half an inch off the side wall').toBeCloseTo(FACE + GAP, 3);
});

test('a drawing opened with a run tight in the corner: the run stands its half inch off, still tight end to end', async ({ page }) => {
  await open(page, [FX('a', 'back', 'drawerbase', FACE + 1, 2), FX('b', 'back', 'doorbase', FACE + 3, 2)]);
  const d = await saved(page);
  const a = await box(page, d, 'a'), b = await box(page, d, 'b');
  expect(a.x0, 'the run off the side wall').toBeCloseTo(FACE + GAP, 3);
  expect(b.x0, 'and its next piece still against the first').toBeCloseTo(a.x1, 3);
  expect(a.z0, 'off the back wall').toBeCloseTo(FACE + GAP, 3);
});

test('a toilet takes no half inch', async ({ page }) => {
  await open(page, [FX('t', 'back', 'toilet', 3, 1.5, { depth: 2.4 })]);
  const d = await saved(page);
  const t = await box(page, d, 't');
  expect(t.z0, 'its back on the wall face').toBeCloseTo(FACE, 3);
});

test('the half inch is drawn as a light line round the back and sides, none across the front', async ({ page }) => {
  await open(page, [FX('s', 'back', 'sinkbase', 6, 3)]);
  const d = await saved(page);
  const segs = await page.evaluate(d => {
    const FG = window.DraftFixtureGeometry, R = window.DraftRender2D;
    const out = [];
    let alpha = 1;
    const stack = [];
    const ctx = new Proxy({}, { get: (o, k) => {
      if (k === 'save') return () => stack.push(alpha);
      if (k === 'restore') return () => { alpha = stack.pop() ?? 1; };
      if (k === 'moveTo') return (x, y) => out.push({ a: [x, y], alpha });
      if (k === 'lineTo') return (x, y) => { const s = out[out.length - 1]; if (s && !s.b) s.b = [x, y]; else out.push({ a: s ? s.b : [x, y], b: [x, y], alpha }); };
      return o[k] || (() => {});
    }, set: (o, k, v) => { if (k === 'globalAlpha') alpha = v; o[k] = v; return true; } });
    const fx = d.fixtures[0];
    R.drawFixture2D(ctx, p => ({ x: p.x, y: p.z }), fx, {}, undefined, {
      fixtureGeometry: (f, w) => FG.fixtureGeometry(d.walls, f, w), wallFrame: w => FG.wallFrame(w),
      fixtures: d.fixtures, COUNTER_OVERHANG_FT: FG.COUNTER_OVERHANG_FT, FIXTURE_COLOR: '#000', fixtureFill: '#fff',
    });
    return out.filter(s => s.b && s.alpha < 0.5).map(s => ({ a: s.a.map(v => +v.toFixed(3)), b: s.b.map(v => +v.toFixed(3)) }));
  }, d);
  const r = v => +v.toFixed(3);
  const back = segs.find(s => s.a[1] === r(FACE) && s.b[1] === r(FACE));
  expect(back, 'a light line along the wall face').toBeTruthy();
  expect(Math.abs(back.b[0] - back.a[0]), 'the piece and a half inch each side').toBeCloseTo(3 + 2 * GAP, 2);
  expect(segs.filter(s => s.a[0] === s.b[0]).length, 'and down both sides').toBe(2);
  expect(segs.filter(s => s.a[1] === s.b[1] && s.a[1] > r(FACE + 1)), 'none across the front').toEqual([]);
});
