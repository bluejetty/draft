// UPPER FLIGHTS WIDER BESIDE AN EXTERIOR WALL (jb, 19 + 23 Nov 2026).
//
// 19 Nov the basement flight was narrowed beside the wall (REDUCE BASEMENT).
// 23 Nov jb turned it round: "always place upstairs as 3-9W and basement as
// 3'W ... increase the upper floors by 9\" rather than reducing basement",
// one value per leg ("a 2nd for the 2nd leg (for L and U) and 3rd leg (for U
// only)"), each with its side LEFT or RIGHT "when walking DOWN".
//
// EXT. WALL (UPPER FLOORS WIDER) on the stair panel: LEG 1..3, each OFF /
// LEFT (compass) / RIGHT (compass) and inches (9 by default), written to the
// basement flight (`extLegs`), which keeps its width; every flight above
// carries `legWiden` and is that leg wider on the wall side only, so its
// other edge stays over the basement flight's.
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
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto(`/MODEL.html?left=1&right=1&level=${MAIN_FL}`);
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

test('LEG 1 LEFT (N): the flight above is 9" wider on the north (wall) side; the basement flight stays 3\'-0"', async ({ page }) => {
  await open(page);
  await pickBase(page);
  await expect(page.locator('[data-stair-ext-head]').first()).toHaveText('EXT. WALL (UPPER FLOORS WIDER)');
  const leg1 = row(page, 'ext leg 1');
  await expect(leg1).toBeVisible();
  await expect(row(page, 'ext leg 2')).toHaveCount(0);
  await expect(leg1.locator('[data-prop-value="off"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(leg1.locator('[data-stair-ext-in]')).toHaveValue('0');
  // Walking DOWN, east: the left hand is north, the right hand south.
  await expect(leg1.locator('[data-prop-value="left"]')).toHaveText('LEFT (N)');
  await expect(leg1.locator('[data-prop-value="right"]')).toHaveText('RIGHT (S)');

  const plain = await legsOf(page, UPPER_ID, true);
  await leg1.locator('[data-prop-value="left"]').click();
  const base = await live(page, BASE_ID);
  const upper = await live(page, UPPER_ID);
  expect(base.widthFt * 12, 'the basement flight keeps its 3\'-0"').toBeCloseTo(36, 4);
  expect(base.start.z).toBeCloseTo(-18, 6);
  expect(base.extLegs[0]).toEqual({ in: 9, side: 'left' });
  expect(upper.widthFt * 12, 'its own width is the same').toBeCloseTo(36, 4);
  expect(upper.legWiden[0]).toEqual({ in: 9, side: 'left' });
  const [drawn] = await legsOf(page, UPPER_ID);
  const [below] = await legsOf(page, BASE_ID);
  expect(drawn.w * 12, '3\'-9" as drawn').toBeCloseTo(45, 4);
  expect(drawn.right.z, 'the south (inside) edge stays over the basement flight').toBeCloseTo(below.right.z, 4);
  expect(drawn.left.z - plain[0].left.z, 'the 9" goes north').toBeCloseTo(-9 / 12, 4);
  await expect(row(page, 'ext leg 1').locator('[data-prop-value="left"]')).toHaveAttribute('aria-pressed', 'true');

  // ONE UNDO puts both back.
  await page.locator('#model-undo').click();
  expect((await live(page, BASE_ID)).extLegs).toBeUndefined();
  expect((await live(page, UPPER_ID)).legWiden).toBeUndefined();
});

test('the inches can change, the side can flip, OFF puts the flight above back to 3\'-0"', async ({ page }) => {
  await open(page);
  await pickBase(page);
  await row(page, 'ext leg 1').locator('[data-prop-value="left"]').click();
  await pickBase(page);
  const inch = row(page, 'ext leg 1').locator('[data-stair-ext-in]');
  await inch.fill('6');
  await inch.press('Enter');
  expect((await live(page, UPPER_ID)).legWiden[0]).toEqual({ in: 6, side: 'left' });
  expect((await legsOf(page, UPPER_ID))[0].w * 12).toBeCloseTo(42, 4);

  await row(page, 'ext leg 1').locator('[data-prop-value="right"]').click();
  const [drawn] = await legsOf(page, UPPER_ID);
  const [below] = await legsOf(page, BASE_ID);
  expect(drawn.left.z, 'now the north edges line up').toBeCloseTo(below.left.z, 4);
  expect(drawn.right.z - below.right.z, 'and the 6" goes south').toBeCloseTo(6 / 12, 4);

  await row(page, 'ext leg 1').locator('[data-prop-value="off"]').click();
  expect((await live(page, UPPER_ID)).legWiden).toBeUndefined();
  expect((await live(page, BASE_ID)).extLegs[0]).toEqual({ in: 6, side: 'off' });
  expect((await legsOf(page, UPPER_ID))[0].w * 12).toBeCloseTo(36, 4);
});

// THE OFF-KILTER L (jb's screenshot, 23 Nov 2026): one width for the whole
// stair narrowed BOTH legs, and the second leg slid off its inside line. Each
// leg now has its own width, and a leg not switched on is untouched.
test('an L: LEG 1 wider on the wall side leaves LEG 2 as it was; LEG 2 has its own switch', async ({ page }) => {
  const L = extra => ({ shape: 'L', turn: 'right', start: { x: -8, z: -18 }, end: { x: -3, z: -18 }, ...extra });
  await open(page, fixture([flight(BASE_ID, MAIN_FL, L()), flight(UPPER_ID, SECOND, L())]));
  await pickAt(page, -6, -18);
  await expect(row(page, 'ext leg 2')).toBeVisible();
  await expect(row(page, 'ext leg 3')).toHaveCount(0);
  const plain = await legsOf(page, UPPER_ID, true);
  await row(page, 'ext leg 1').locator('[data-prop-value="left"]').click();
  let legs = await legsOf(page, UPPER_ID);
  expect(legs[0].w * 12).toBeCloseTo(45, 4);
  expect(legs[0].right.z, 'leg 1 inside edge stays').toBeCloseTo(plain[0].right.z, 4);
  expect(legs[1].w * 12, 'leg 2 untouched').toBeCloseTo(36, 4);
  expect(legs[1].left.x).toBeCloseTo(plain[1].left.x, 4);
  expect(legs[1].right.x).toBeCloseTo(plain[1].right.x, 4);
  // LEG 2 runs south: walking down it, the left hand is east.
  await pickAt(page, -6, -18);
  await expect(row(page, 'ext leg 2').locator('[data-prop-value="left"]')).toHaveText('LEFT (E)');
  await row(page, 'ext leg 2').locator('[data-prop-value="left"]').click();
  legs = await legsOf(page, UPPER_ID);
  expect(legs[1].w * 12).toBeCloseTo(45, 4);
  expect(legs[1].right.x, 'leg 2 west edge stays').toBeCloseTo(plain[1].right.x, 4);
  expect(legs[1].left.x - plain[1].left.x, 'the 9" goes east').toBeCloseTo(9 / 12, 4);
  // The basement flight is 3'-0" on both legs throughout.
  const below = await legsOf(page, BASE_ID);
  expect(below.map(l => Math.round(l.w * 12))).toEqual([36, 36]);
});

test('a U: three legs, the return flight wider on its outer side keeps its inner edge', async ({ page }) => {
  const U = extra => ({ shape: 'U', turn: 'right', start: { x: -8, z: -18 }, end: { x: -3, z: -18 }, ...extra });
  await open(page, fixture([flight(BASE_ID, MAIN_FL, U()), flight(UPPER_ID, SECOND, U())]));
  await pickAt(page, -6, -18);
  await expect(row(page, 'ext leg 3')).toBeVisible();
  const plain = await legsOf(page, UPPER_ID, true);
  // LEG 3 runs back west, south of leg 1: walking down it, the left hand is south.
  await expect(row(page, 'ext leg 3').locator('[data-prop-value="left"]')).toHaveText('LEFT (S)');
  await row(page, 'ext leg 3').locator('[data-prop-value="left"]').click();
  const legs = await legsOf(page, UPPER_ID);
  expect(legs[0].w * 12, 'leg 1 untouched').toBeCloseTo(36, 4);
  expect(legs[2].w * 12).toBeCloseTo(45, 4);
  expect(legs[2].right.z, 'the inner (north) edge stays').toBeCloseTo(plain[2].right.z, 4);
  expect(legs[2].left.z - plain[2].left.z, 'the 9" goes south').toBeCloseTo(9 / 12, 4);
});

test('a file saved the old way (basement narrowed) opens with the flight above widened instead, nothing moved', async ({ page }) => {
  // REDUCE BASEMENT 8" on the north: the basement flight 28" against the
  // south edge of a 36" flight above. Old 'right' was the frame's -n side,
  // walking east: north.
  const f = fixture([
    flight(BASE_ID, MAIN_FL, { widthFt: 28 / 12, start: { x: -2, z: -18 + 4 / 12 }, end: { x: 8, z: -18 + 4 / 12 },
      extWall: true, extWallCutIn: 8, extWallSide: 'right' }),
    flight(UPPER_ID, SECOND)]);
  await open(page, f);
  const base = await live(page, BASE_ID);
  const upper = await live(page, UPPER_ID);
  expect(base.extWall).toBeUndefined();
  expect(base.extLegs[0]).toEqual({ in: 8, side: 'left' });
  expect(base.widthFt * 12).toBeCloseTo(28, 4);
  expect(upper.widthFt * 12).toBeCloseTo(28, 4);
  expect(upper.legWiden[0]).toEqual({ in: 8, side: 'left' });
  const [drawn] = await legsOf(page, UPPER_ID);
  expect(drawn.w * 12).toBeCloseTo(36, 4);
  expect(drawn.left.z, 'north edge where it was').toBeCloseTo(-19.5, 4);
  expect(drawn.right.z, 'south edge where it was').toBeCloseTo(-16.5, 4);
});

test('the switches survive a save and reload', async ({ page }) => {
  await open(page);
  await pickBase(page);
  await row(page, 'ext leg 1').locator('[data-prop-value="left"]').click();
  await expect(page.locator('#save')).toBeEnabled({ timeout: 4000 });
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
  const file = await page.evaluate(async bucket => {
    const f = await window.SharedFileStore.loadSharedFile(bucket);
    return JSON.parse(await f.text());
  }, BUCKET);
  expect(file.stairs.find(s => Number(s.id) === BASE_ID).extLegs[0]).toEqual({ in: 9, side: 'left' });
  expect(file.stairs.find(s => Number(s.id) === UPPER_ID).legWiden[0]).toEqual({ in: 9, side: 'left' });
  const norm = await page.evaluate(stairs => window.DraftDrawingFormat.stairs(stairs, new Set([3, 5])), file.stairs);
  expect(norm.find(s => Number(s.id) === UPPER_ID).legWiden[0]).toEqual({ in: 9, side: 'left' });
});

// THE 6" STOP AT THE HOUSE LINE IS GONE (jb, 23 Nov 2026: "i think we can
// remove the 'basement rule'"). It fought the corner snap: an L held by its
// corner and brought to a wall's inside corner was pulled 6" off it, or
// shoved out of the house through the far wall. REDUCE BASEMENT narrows the
// basement flight and nothing more; the stair goes where it is dragged.
const dragBy = async (page, fromX, fromZ, dxFt, dzFt) => {
  const { at, scale } = await h.planFrame(page);
  const [x, y] = at(fromX, fromZ);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dxFt * scale, y + dzFt * scale, { steps: 8 });
  await page.mouse.up();
};
test('a basement flight with LEG 1 on, dragged toward the wall, is not stopped 14" in from the house line', async ({ page }) => {
  await open(page);
  await pickBase(page);
  await row(page, 'ext leg 1').locator('[data-prop-value="left"]').click();
  const before = await live(page, BASE_ID);
  // Two feet north: the old rule held its edge 14" from the line (z = -20).
  await dragBy(page, 3, -17.7, 0, -1.2);
  const base = await live(page, BASE_ID);
  expect(base.start.z - base.widthFt / 2 - -20, 'past where the 14" stop held it').toBeLessThan(14 / 12 - 0.2);
  expect(base.start.z - before.start.z).toBeLessThan(-0.4);
  await expect(page.locator('#strip-message')).not.toContainText('HOUSE LINE');
});

// jb's case (#1085): an L flight with its EXT. WALL switch on, held by a
// corner and brought to the inside corner of two 2x6 exterior walls -- on
// either side, the corner lands exactly there.
for (const side of ['left', 'right']) {
  test(`held by a corner, a reduced L flight lands on the walls' inside corner (side ${side})`, async ({ page }) => {
    const Wl = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
      levelId: MAIN_FL, view: 'plan', wallType: 'stud_2x6', refLine: 'center', baseHeight: 0, topHeight: 8 });
    const f = fixture();
    f.walls = [Wl('n', [-20, -20], [20, -20]), Wl('e', [20, -20], [20, 20]), Wl('s', [20, 20], [-20, 20]), Wl('w', [-20, 20], [-20, -20])];
    f.stairs = [flight(BASE_ID, MAIN_FL, { start: { x: 2, z: -14 }, end: { x: 8, z: -14 }, widthFt: 3.5,
      shape: 'L', turn: 'right', extLegs: [{ in: 9, side }] })];
    await h.openModel(page, { webgl: false });
    await page.evaluate(async ({ bucket, f }) => {
      await window.SharedFileStore.saveSharedFile(
        new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
    }, { bucket: BUCKET, f });
    await page.goto(`/MODEL.html?level=${MAIN_FL}`);
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
    await page.evaluate(() => { view.cx = 12; view.cz = -14; view.scale = 24; paint(); });
    await page.waitForTimeout(150);
    const frame = await h.planFrame(page);
    const facts = await page.evaluate(() => ({ o: stairOutlineOf(drawing.stairs[0]).corners,
      fc: window.DraftGeometry2D.wallFaceCorners(walls(), openingThicknessFt()) }));
    await page.mouse.click(...frame.at(3, -14));
    await page.waitForTimeout(120);
    const ne = list => list.slice().sort((a, b) => (b.x - b.z) - (a.x - a.z))[0];
    const c = ne(facts.o);
    const t = ne(facts.fc.filter(p => p.x < 20 && p.z > -20));
    const [cx, cy] = frame.at(c.x, c.z);
    const [tx, ty] = frame.at(t.x, t.z);
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(tx + 3, ty + 3, { steps: 12 });
    await page.mouse.move(tx, ty, { steps: 3 });
    await page.mouse.up();
    await page.waitForTimeout(150);
    const landed = ne(await page.evaluate(() => stairOutlineOf(drawing.stairs[0]).corners));
    expect(landed.x, 'on the east wall\'s inside face').toBeCloseTo(t.x, 4);
    expect(landed.z, 'on the north wall\'s inside face').toBeCloseTo(t.z, 4);
  });
}

// THE GAP AT THE LANDING (jb, 24 Nov 2026: "gap at landing to bottom
// stairs" ... "the extra gap can be added to opposite side"). An L's landing
// is 37 1/2" (36" clear of the nosing above); its second flight, 36", ran
// centred on it, 3/4" short of the landing's far edge -- the wall. It now
// runs flush to that edge, the 1 1/2" on the inside of the turn.
test('an L\'s second flight runs flush to the landing\'s far edge; the extra goes to the inside of the turn', async ({ page }) => {
  const L = extra => ({ shape: 'L', turn: 'right', start: { x: -8, z: -18 }, end: { x: -3, z: -18 }, ...extra });
  await open(page, fixture([flight(BASE_ID, MAIN_FL, L()), flight(UPPER_ID, SECOND, L())]));
  const facts = await page.evaluate(id => {
    const SG = window.DraftStairGeometry;
    const st = drawing.stairs.find(s => Number(s.id) === id);
    const parts = SG.stairPlanParts(st, SG.stairCurrentLayout(st, stairLevels()));
    const r = parts.runs[1];
    const xs = parts.landing.poly.map(p => p.x);
    return { east: r.start.x + r.widthFt / 2, west: r.start.x - r.widthFt / 2,
      landEast: Math.max(...xs), landWest: Math.min(...xs) };
  }, BASE_ID);
  expect(facts.east, 'flush to the landing\'s far (east) edge').toBeCloseTo(facts.landEast, 6);
  expect((facts.west - facts.landWest) * 12, 'the extra on the inside of the turn').toBeGreaterThan(0.5);
  // ...and the corner node is where it is drawn: a straight flight widened
  // 9" has its corners 9" out on that side.
  await pickAt(page, -6, -18);
  await row(page, 'ext leg 1').locator('[data-prop-value="left"]').click();
});

test('a straight flight widened 9" has its corner nodes at the corners drawn', async ({ page }) => {
  await open(page);
  await pickBase(page);
  await row(page, 'ext leg 1').locator('[data-prop-value="left"]').click();
  const zs = await page.evaluate(id => stairCorners(drawing.stairs.find(s => Number(s.id) === id)).map(c => c.z), UPPER_ID);
  const [drawn] = await legsOf(page, UPPER_ID);
  expect(Math.min(...zs)).toBeCloseTo(drawn.left.z, 6);
  expect(Math.max(...zs)).toBeCloseTo(drawn.right.z, 6);
});

// THE BOX SAYS WHAT THE PLAN DRAWS (jb, 25 Nov 2026: "it said it was 9\" but
// it actually wasn't adjusted on the plan. it was 0 on the plan, i change it
// to 8\" and it changes drastically (not just 1\")"). An OFF leg read 9 while
// nothing was widened, so typing 8 put on the whole 8". OFF now reads 0, and
// each inch typed moves the plan one inch.
test('an OFF leg reads 0; typing 8 then 9 widens the flight above 8" then 1" more, nothing else moves', async ({ page }) => {
  const L = extra => ({ shape: 'L', turn: 'right', start: { x: -8, z: -18 }, end: { x: -3, z: -18 }, ...extra });
  await open(page, fixture([flight(BASE_ID, MAIN_FL, L()), flight(UPPER_ID, SECOND, L())]));
  await pickAt(page, -6, -18);
  for (const n of ['ext leg 1', 'ext leg 2']) {
    await expect(row(page, n).locator('[data-prop-value="off"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(row(page, n).locator('[data-stair-ext-in]'), `${n} OFF draws nothing`).toHaveValue('0');
  }
  const plain = await legsOf(page, UPPER_ID, true);
  // 0 typed into an OFF leg leaves it off.
  let inch = row(page, 'ext leg 1').locator('[data-stair-ext-in]');
  await inch.fill('0');
  await inch.press('Enter');
  expect((await live(page, UPPER_ID)).legWiden).toBeUndefined();

  await pickAt(page, -6, -18);
  inch = row(page, 'ext leg 1').locator('[data-stair-ext-in]');
  await inch.fill('8');
  await inch.press('Enter');
  const at8 = await legsOf(page, UPPER_ID);
  expect(at8[0].w * 12, 'leg 1 is 8" wider').toBeCloseTo(44, 4);
  await pickAt(page, -6, -18);
  await expect(row(page, 'ext leg 1').locator('[data-stair-ext-in]')).toHaveValue('8');
  inch = row(page, 'ext leg 1').locator('[data-stair-ext-in]');
  await inch.fill('9');
  await inch.press('Enter');
  const at9 = await legsOf(page, UPPER_ID);
  expect(at9[0].w * 12, 'one inch more').toBeCloseTo(45, 4);
  // The inside edge and leg 2 stay put: only the wall edge moves the inch.
  expect(at9[0].right.z).toBeCloseTo(at8[0].right.z, 4);
  expect(at9[0].right.z).toBeCloseTo(plain[0].right.z, 4);
  expect(Math.abs(at9[0].left.z - at8[0].left.z) * 12).toBeCloseTo(1, 4);
  expect(at9[1].left.x).toBeCloseTo(at8[1].left.x, 4);
  expect(at9[1].right.x).toBeCloseTo(at8[1].right.x, 4);
  // A side picked on a leg at 0" puts the 9" on.
  await pickAt(page, -6, -18);
  inch = row(page, 'ext leg 1').locator('[data-stair-ext-in]');
  await inch.fill('0');
  await inch.press('Enter');
  expect((await legsOf(page, UPPER_ID))[0].w * 12).toBeCloseTo(36, 4);
  await pickAt(page, -6, -18);
  await row(page, 'ext leg 1').locator('[data-prop-value="right"]').click();
  expect((await live(page, BASE_ID)).extLegs[0]).toEqual({ in: 9, side: 'right' });
  await pickAt(page, -6, -18);
  await expect(row(page, 'ext leg 1').locator('[data-stair-ext-in]')).toHaveValue('9');
});
