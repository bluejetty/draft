// THE LANDING'S SIZE (jb, 24 Nov 2026).
//
// "can we make the landing 3\" wider than the stairs and on the interior
// corner, don't 'poke' into the corner ... a little square 3\"x3\" taken out
// of the corner of the landing on int. side", then "offer a choice in the
// OBJ PROP - where the user can change 3\" to wider for each edge of the
// landing ... or less wide ... 3\" default ... each side to change
// differently", and "allow the user to change the width and length of the U
// landing".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3;
const SECOND = 5;
const BASE_ID = 7601;   // MAIN -> basement, along the NORTH wall
const UPPER_ID = 7602;  // 2ND -> MAIN, over it

const flight = (id, levelId, extra = {}) => ({
  id, levelId, view: 'plan', layer: 'A-STR',
  start: { x: -2, z: -18 }, end: { x: 8, z: -18 },
  widthFt: 3, riseFt: 9, rail: 'left', shape: 'straight', turn: 'right', winders: 0, auto: false, ...extra,
});
const square = { id: 'OUT-1', levelId: MAIN_FL, view: 'plan',
  points: [{ x: -20, z: -20 }, { x: 20, z: -20 }, { x: 20, z: 20 }, { x: -20, z: 20 }] };
const fixture = (stairs = [flight(BASE_ID, MAIN_FL), flight(UPPER_ID, SECOND)]) => ({
  version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: SECOND, name: '2ND FL', elev: 9 }, { id: MAIN_FL, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 },
  ],
  activeLevelIdx: 3,
  walls: [], lines: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [square], shapes: [], notes: [], roomTags: [], columns: [], beams: [],
  boneyardOutlines: [], boneyardShelves: [], groups: [], levelLocks: [], underlays: [],
  floors: [], surfaceOpenings: [],
  stairs,
});

async function open(page, f = fixture()) {
  await h.openEditor(page, { drawing: f, bucket: BUCKET, url: `/MODEL.html?left=1&right=1&level=${MAIN_FL}`, webgl: false });
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(300);
}
const live = (page, id) => page.evaluate(id => {
  const st = drawing.stairs.find(s => Number(s.id) === id);
  return JSON.parse(JSON.stringify(st));
}, id);
// EACH LEG AS DRAWN, top to bottom: its two edges in world space, `right`
// and `left` walking down. `plain` draws it as if no leg were widened.
const legsOf = (page, id, plain = false) => page.evaluate(({ id, plain }) => {
  const SG = window.DraftStairGeometry;
  const st = { ...drawing.stairs.find(s => Number(s.id) === id) };
  if (plain) delete st.legWiden;
  const parts = SG.stairPlanParts(st, SG.stairCurrentLayout(st, stairLevels()));
  const legs = parts.runs.map(r => ({ r, w: r.widthFt }));
  if (parts.shape === 'U') legs.splice(1, 0, null);
  return legs.map(leg => {
    if (!leg) return null;
    const { r, w } = leg;
    const n = { x: -r.dir.z, z: r.dir.x };
    const mid = { x: r.start.x + r.dir.x * r.lenFt / 2, z: r.start.z + r.dir.z * r.lenFt / 2 };
    return { w,
      right: { x: mid.x + n.x * w / 2, z: mid.z + n.z * w / 2 },
      left: { x: mid.x - n.x * w / 2, z: mid.z - n.z * w / 2 } };
  });
}, { id, plain });
async function pickAt(page, x, z) {
  const { at } = await h.planFrame(page);
  const [sx, sy] = at(x, z);
  await page.mouse.move(sx, sy);
  await expect(page.locator('#hover-name')).toHaveText('STAIR', { timeout: 4000 });
  await page.mouse.click(sx, sy);
}
const pickBase = page => pickAt(page, 3, -18);
const row = (page, name) => page.locator(`[data-prop-row="${name}"]`).first();


// The landing as drawn: its ring, bounding size in inches, and area.
const landingOf = (page, id) => page.evaluate(id => {
  const SG = window.DraftStairGeometry;
  const st = drawing.stairs.find(s => Number(s.id) === id);
  const parts = SG.stairPlanParts(st, SG.stairCurrentLayout(st, stairLevels()));
  const poly = parts.landing.poly;
  const xs = poly.map(p => p.x), zs = poly.map(p => p.z);
  let a = 0;
  poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length]; a += p.x * q.z - q.x * p.z; });
  return { n: poly.length, ew: (Math.max(...xs) - Math.min(...xs)) * 12, ns: (Math.max(...zs) - Math.min(...zs)) * 12,
    area: Math.abs(a / 2) * 144, poly };
}, id);
const L = extra => ({ shape: 'L', turn: 'right', start: { x: -8, z: -18 }, end: { x: -3, z: -18 }, ...extra });
const U = extra => ({ shape: 'U', turn: 'right', start: { x: -8, z: -18 }, end: { x: -3, z: -18 }, ...extra });
const typeInto = async (page, key, v) => {
  const box = page.locator(`[data-stair-landing="${key}"]`).first();
  await box.fill(String(v));
  await box.press('Enter');
};

test('an L\'s landing is 3" past the stairs each way, its inside corner a 3" square short', async ({ page }) => {
  await open(page, fixture([flight(BASE_ID, MAIN_FL, L()), flight(UPPER_ID, SECOND, L())]));
  const land = await landingOf(page, BASE_ID);
  expect(land.ew).toBeCloseTo(39, 4);
  expect(land.ns).toBeCloseTo(39, 4);
  expect(land.n, 'six corners: the notch').toBe(6);
  expect(land.area).toBeCloseTo(39 * 39 - 9, 3);
  // The square comes out of the inside corner of the turn: north-west of
  // the second flight, south of the first.
  const facts = await page.evaluate(id => {
    const SG = window.DraftStairGeometry;
    const st = drawing.stairs.find(s => Number(s.id) === id);
    const parts = SG.stairPlanParts(st, SG.stairCurrentLayout(st, stairLevels()));
    const [r1, r2] = parts.runs;
    return { r1South: r1.start.z + r1.widthFt / 2, r2West: r2.start.x - r2.widthFt / 2, r2Top: r2.start.z };
  }, BASE_ID);
  const inside = land.poly.filter(p => Math.abs(p.z - facts.r1South) < 1e-6 || Math.abs(p.z - facts.r2Top) < 1e-6);
  expect(inside.some(p => Math.abs(p.x - facts.r2West) < 1e-6 && Math.abs(p.z - facts.r2Top) < 1e-6),
    'the notch meets the second flight\'s inside corner').toBe(true);
  expect((facts.r2Top - facts.r1South) * 12, '3" past the first flight').toBeCloseTo(3, 4);
});

test('the two L boxes change each way on its own, wider or less wide, one UNDO each', async ({ page }) => {
  await open(page, fixture([flight(BASE_ID, MAIN_FL, L()), flight(UPPER_ID, SECOND, L())]));
  await pickAt(page, -6, -18);
  await expect(row(page, 'landing u').locator('.props-title')).toHaveText('LANDING E\u2013W');
  await expect(row(page, 'landing v').locator('.props-title')).toHaveText('LANDING N\u2013S');
  await expect(page.locator('[data-stair-landing="landing u"]').first()).toHaveValue('3');
  await typeInto(page, 'landing u', 9);
  let land = await landingOf(page, BASE_ID);
  expect(land.ew).toBeCloseTo(45, 4);
  expect(land.ns).toBeCloseTo(39, 4);
  expect(land.area).toBeCloseTo(45 * 39 - 6 * 3 - 9, 3);
  await typeInto(page, 'landing v', 1);
  land = await landingOf(page, BASE_ID);
  expect(land.ns).toBeCloseTo(37, 4);
  expect(land.ew).toBeCloseTo(45, 4);
  expect((await live(page, BASE_ID)).landExtraV).toBe(1);
  // 0 is a plain square past the flights: no notch to cut.
  await typeInto(page, 'landing v', 0);
  land = await landingOf(page, BASE_ID);
  expect(land.n).toBe(4);
  await page.keyboard.press('Control+z');
  expect((await live(page, BASE_ID)).landExtraV).toBe(1);
  // ...and the format keeps it.
  const norm = await page.evaluate(st => window.DraftDrawingFormat.stairs([st], new Set([3, 5])),
    await live(page, BASE_ID));
  expect(norm[0].landExtraU).toBe(9);
  expect(norm[0].landExtraV).toBe(1);
});

test('a U\'s landing LENGTH and WIDTH boxes size it', async ({ page }) => {
  await open(page, fixture([flight(BASE_ID, MAIN_FL, U()), flight(UPPER_ID, SECOND, U())]));
  await pickAt(page, -6, -18);
  await expect(row(page, 'landing length').locator('.props-title')).toHaveText('LANDING LENGTH (E\u2013W)');
  await expect(row(page, 'landing width').locator('.props-title')).toHaveText('LANDING WIDTH (N\u2013S)');
  await expect(page.locator('[data-stair-landing="landing length"]').first()).toHaveValue('39');
  await expect(page.locator('[data-stair-landing="landing width"]').first()).toHaveValue('76.5');
  await typeInto(page, 'landing length', 48);
  let land = await landingOf(page, BASE_ID);
  expect(land.ew).toBeCloseTo(48, 4);
  expect((await live(page, BASE_ID)).landExtraU).toBe(12);
  await typeInto(page, 'landing width', 84);
  land = await landingOf(page, BASE_ID);
  expect(land.ns).toBeCloseTo(84, 4);
  expect((await live(page, BASE_ID)).uGapIn).toBe(12);
  await expect(page.locator('[data-stair-landing="landing width"]').first()).toHaveValue('84');
});
