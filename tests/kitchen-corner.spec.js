// THE KITCHEN CORNER AND ONE COUNTER.
//
// Movie, 21 Oct: "can you make a 'corner peice that is 28" x 28" - 24" deep
// counter that will allow 4" space in the corner before the first drawers or
// doors start (not a lazy suzan or anything in the corner just dead space";
// then "when you draw the counter can make it all join up (and not hang in to
// the wall... and make the cabinet lines very lightweight but visible, meld
// the COUNTER".
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
const LEG = 28 / 12;

test('CORNER sits tight in the corner; the next drawers start 28" out on either wall', async ({ page }) => {
  const { at } = await open(page);
  await place(page, at, 'cornerbase', 1.2, 1.2);
  let d = await saved(page);
  const corner = d.fixtures.find(f => f.kind === 'cornerbase');
  expect(corner, 'a CORNER was placed').toBeTruthy();
  expect(corner.width).toBeCloseTo(LEG, 3);
  expect(corner.depth).toBe(2);
  // ITS CORNER END AGAINST THE OTHER WALL'S FACE.
  const geo = await page.evaluate(d => {
    const fx = d.fixtures.find(f => f.kind === 'cornerbase');
    const g = window.DraftFixtureGeometry.fixtureGeometry(d.walls, fx);
    const pts = [...g.corners, ...g.decks[0]];
    return { xs: pts.map(p => p.x), zs: pts.map(p => p.z) };
  }, d);
  expect(Math.min(...geo.xs), 'tight to the side wall').toBeCloseTo(FACE, 2);
  expect(Math.min(...geo.zs), 'tight to the back wall').toBeCloseTo(FACE, 2);
  expect(Math.max(...geo.xs), '28" out along one wall').toBeCloseTo(FACE + LEG, 2);
  expect(Math.max(...geo.zs), '28" out along the other').toBeCloseTo(FACE + LEG, 2);
  // DRAWERS PRESSED NEAR EACH LEG'S END land against it.
  await place(page, at, 'drawerbase', FACE + LEG + 1.3, 1);
  await place(page, at, 'drawerbase', 1, FACE + LEG + 1.3);
  d = await saved(page);
  const spans = await page.evaluate(d => d.fixtures.filter(f => f.kind === 'drawerbase').map(fx => {
    const g = window.DraftFixtureGeometry.fixtureGeometry(d.walls, fx);
    return { x: Math.min(...g.corners.map(p => p.x)), z: Math.min(...g.corners.map(p => p.z)), wall: fx.wallId };
  }), d);
  const onBack = spans.find(s => s.wall === 'back'), onSide = spans.find(s => s.wall === 'side');
  expect(onBack && onBack.x, 'on the back wall, from 28" out').toBeCloseTo(FACE + LEG, 2);
  expect(onSide && onSide.z, 'on the side wall, from 28" out').toBeCloseTo(FACE + LEG, 2);
});

test('CORNER pressed away from any corner is refused', async ({ page }) => {
  const { at } = await open(page);
  await place(page, at, 'cornerbase', 8, 1);
  await expect(page.locator('#strip-message')).toContainText('near where two walls meet');
  expect((await saved(page)).fixtures || []).toEqual([]);
});

// WHAT drawCounters2D STROKES, in plan feet.
const counterLines = (page, d) => page.evaluate(d => {
  const FG = window.DraftFixtureGeometry, R = window.DraftRender2D, K = window.DraftFixtureKinds;
  const segs = [];
  let dashed = false;
  const ctx = new Proxy({}, { get: (o, k) => {
    if (k === 'setLineDash') return a => { dashed = a.length > 0; };
    if (k === 'moveTo') return (x, y) => { segs.push({ a: [x, y], dashed }); };
    if (k === 'lineTo') return (x, y) => { segs[segs.length - 1].b = [x, y]; };
    if (k === 'save' || k === 'restore') return () => { if (k === 'restore') dashed = false; };
    return o[k] || (() => {});
  }, set: (o, k, v) => { o[k] = v; return true; } });
  R.drawCounters2D(ctx, p => ({ x: p.x, y: p.z }), d.fixtures, {
    fixtureGeometry: fx => FG.fixtureGeometry(d.walls, fx), wallFrame: w => FG.wallFrame(w), walls: d.walls,
    COUNTER_OVERHANG_FT: FG.COUNTER_OVERHANG_FT, FIXTURE_COLOR: '#000', hasUppers: fx => K.hasUppers(fx),
  });
  return segs.map(s => ({ a: s.a.map(v => Number(v.toFixed(3))), b: s.b.map(v => Number(v.toFixed(3))), dashed: s.dashed }));
}, d);
const FX = (id, wallId, kind, offset, width, more = {}) => ({ id, wallId, levelId: 3, view: 'plan', kind, offset, width, depth: 2, side: 1, ...more });

test('one counter: it turns the corner with no joint across it, and nothing runs into a wall', async ({ page }) => {
  const LEG_END = FACE + LEG;
  // THE CORNER ON THE BACK WALL, DRAWERS ON EACH LEG, A DW BESIDE THE ONE.
  const fixtures = [
    FX('c', 'back', 'cornerbase', FACE + LEG / 2, LEG, { corner: -1 }),
    FX('d1', 'back', 'drawerbase', LEG_END + 1, 2),
    FX('dw', 'back', 'dish', LEG_END + 3, 2),
    // (THE SIDE WALL RUNS +z, so the room is its side -1.)
    FX('d2', 'side', 'drawerbase', LEG_END + 1, 2, { side: -1 }),
  ];
  await open(page, fixtures);
  const d = await saved(page);
  const segs = (await counterLines(page, d)).filter(s => !s.dashed);
  expect(segs.length, 'a counter was drawn').toBeGreaterThan(0);
  const across = (s, axis, v) => Math.abs(s.a[axis] - v) < 0.01 && Math.abs(s.b[axis] - v) < 0.01;
  // NO LINE ACROSS THE COUNTER AT A JOINT: x = 28" out on the back wall,
  // the DW's joint, z = 28" out on the side wall.
  for (const x of [LEG_END, LEG_END + 2]) {
    expect(segs.filter(s => across(s, 0, x) && Math.min(s.a[1], s.b[1]) < 2), `no joint line at x = ${x}`).toEqual([]);
  }
  expect(segs.filter(s => across(s, 1, LEG_END) && Math.min(s.a[0], s.b[0]) < 2), 'no joint line on the side wall').toEqual([]);
  // NOTHING AT OR INSIDE A WALL: every line stands off both wall faces.
  segs.forEach(s => {
    const mx = (s.a[0] + s.b[0]) / 2, mz = (s.a[1] + s.b[1]) / 2;
    expect(mx > FACE - 0.001 && mz > FACE - 0.001 && !(Math.abs(mx - FACE) < 0.01 && Math.abs(s.a[0] - s.b[0]) < 0.01)
      && !(Math.abs(mz - FACE) < 0.01 && Math.abs(s.a[1] - s.b[1]) < 0.01), `a line on or in a wall: ${JSON.stringify(s)}`).toBe(true);
  });
  // THE FRONT TURNS THE CORNER: an inside corner of the counter at 25" off both walls.
  const o = 1 / 12, frontZ = FACE + 2 + o, frontX = FACE + 2 + o;
  const hasPoint = (x, z) => segs.some(s => [s.a, s.b].some(p => Math.abs(p[0] - x) < 0.01 && Math.abs(p[1] - z) < 0.01));
  expect(hasPoint(frontX, frontZ), 'the counter\'s inside corner').toBe(true);
  // AND THE UPPERS ARE ONE RUN TOO, dashed, with no joint across them.
  const uppers = (await counterLines(page, d)).filter(s => s.dashed);
  expect(uppers.length).toBeGreaterThan(0);
  expect(uppers.filter(s => across(s, 0, LEG_END) && Math.min(s.a[1], s.b[1]) < 1.5), 'no joint in the uppers').toEqual([]);
});

test('an island landing on a wall: its overhang stops at the wall face', async ({ page }) => {
  // A PENINSULA off the side wall, its end against the back wall.
  const island = { id: 'is', wallId: 'side', levelId: 3, view: 'plan', kind: 'island', offset: FACE + 3, width: 6, depth: 3, side: -1, standoff: 4 };
  await open(page, [island]);
  const d = await saved(page);
  const segs = (await counterLines(page, d)).filter(s => !s.dashed);
  expect(segs.length).toBeGreaterThan(0);
  segs.forEach(s => {
    expect(Math.min(s.a[1], s.b[1]), 'nothing past the back wall\'s face').toBeGreaterThan(FACE - 0.001);
  });
});

test('melded, a cabinet\'s own box is drawn light', async ({ page }) => {
  await open(page, [FX('d1', 'back', 'drawerbase', 4, 2)]);
  const widths = await page.evaluate(() => {
    const FG = window.DraftFixtureGeometry, R = window.DraftRender2D;
    const d = { walls: [{ id: 'back', levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center', start: { x: 0, y: 0, z: 0 }, end: { x: 16, y: 0, z: 0 } }] };
    const fx = { id: 'd1', wallId: 'back', levelId: 3, view: 'plan', kind: 'drawerbase', offset: 4, width: 2, depth: 2, side: 1 };
    const out = [];
    const ctx = new Proxy({ lineWidth: 1, globalAlpha: 1 }, { get: (o, k) => {
      if (k === 'stroke') return () => out.push(o.lineWidth);
      if (k === 'save') return () => { o.__s = [...(o.__s || []), [o.lineWidth, o.globalAlpha]]; };
      if (k === 'restore') return () => { const [w, a] = o.__s.pop(); o.lineWidth = w; o.globalAlpha = a; };
      return k in o ? o[k] : () => {};
    }, set: (o, k, v) => { o[k] = v; return true; } });
    R.drawFixture2D(ctx, p => ({ x: p.x * 10, y: p.z * 10 }), fx, {}, undefined, {
      fixtureGeometry: (f, w) => FG.fixtureGeometry(d.walls, f, w), wallFrame: w => FG.wallFrame(w), walls: d.walls,
      COUNTER_OVERHANG_FT: FG.COUNTER_OVERHANG_FT, FIXTURE_COLOR: '#000', fixtureFill: '#fff', fixtures: [fx], meldCounters: true,
    });
    return out;
  });
  expect(widths[0], 'its box, light').toBe(0.5);
});
