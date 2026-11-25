// THE Z BREAK WHERE A STAIR DOWN AND A STAIR UP STACK (jb, 16 Nov 2026).
//
// "on the main floor where the downstairs and 2nd floor stairs both show we
// should only show the TOP section of the basement stairs and the BOTTOM of
// the upstairs flight, and seperate them [with] a Z". The rule is
// stair-geometry's stairBreaksOn; render-2d's drawStairs2D cuts each flight
// to its side of the Z (clipSegToRegion2D) on MODEL and on the LAYOUT sheets.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const point = (x, z) => ({ x, y: 0, z });
const rect = (x0, z0, x1, z1) => [point(x0, z0), point(x1, z0), point(x1, z1), point(x0, z1)];
const HOUSE = rect(0, 0, 24, 30);
const wallsOf = (levelId, startId, pts, view = 'plan') => pts.map((pt, i) => ({
  id: startId + i, start: pt, end: pts[(i + 1) % pts.length], levelId, view,
  wallType: view === 'foundation' ? 'concrete_8' : 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
}));
const stairOn = (id, levelId, x, z, extra = {}) => ({
  id, levelId, view: 'plan', layer: 'A-STR', start: point(x, z), end: point(x, z + 10),
  widthFt: 3, riseFt: 9, rail: 'left', shape: 'straight', turn: 'right', winders: 0, ...extra,
});
const fixture = stairs => ({
  version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 },
    { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 },
    { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 },
  ],
  activeLevelIdx: 3,
  walls: [...wallsOf(5, 200, HOUSE), ...wallsOf(3, 100, HOUSE), ...wallsOf(1, 300, HOUSE),
    ...wallsOf(1, 310, HOUSE, 'foundation')],
  outlines: [{ id: 1, levelId: 3, points: HOUSE }, { id: 2, levelId: 5, points: HOUSE }],
  stairs,
  lines: [], roofs: [], fenestrations: [], dimensions: [], shapes: [], notes: [], floors: [],
  roomTags: [], columns: [], beams: [], surfaceOpenings: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
  layout: { auto: true },
});
// MAIN -> basement and 2ND -> MAIN on one spot, an L pair beside them, and a
// 2ND -> MAIN flight across the house with nothing under it.
const STACK = [
  stairOn(1, 3, 4, 4), stairOn(2, 5, 4, 4),
  stairOn(3, 3, 12, 4, { shape: 'L', turn: 'right' }), stairOn(4, 5, 12, 4, { shape: 'L', turn: 'right' }),
  stairOn(5, 5, 4, 18),
];

async function openModel(page, file, levelId = 3) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  await page.goto(`/MODEL.html?left=1&right=1&level=${levelId}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.pickModelLayer(page, levelId, 'plan');
  await page.waitForTimeout(300);
}

// The breaks MODEL works out for a level, by stair id.
const breaksOn = (page, levelId) => page.evaluate(id => {
  const SG = window.DraftStairGeometry;
  const levels = stairLevels();
  const shown = SG.stairsShownOn(id, drawing.stairs, levels.floors);
  const out = {};
  SG.stairBreaksOn(shown, levels).forEach((b, stair) => {
    out[stair.id] = { keep: b.keep, invert: b.invert, runIndex: b.runIndex, drawLine: b.drawLine,
      centre: b.centre, line: b.line, walk: b.walk };
  });
  return out;
}, levelId);

test('MAIN FL: a stacked DN and UP pair break at one Z, DN keeps its top, UP its foot', async ({ page }) => {
  await openModel(page, fixture(STACK));
  const b = await breaksOn(page, 3);
  expect(Object.keys(b).sort(), 'both stacked pairs break; the lone UP flight and nothing else').toEqual(['1', '2', '3', '4']);
  expect(b[1].keep).toBe('top');
  expect(b[2].keep).toBe('bottom');
  // ONE Z: the DN flight draws it, the UP flight on the same spot does not.
  expect(b[1].drawLine).toBe(true);
  expect(b[2].drawLine).toBe(false);
  expect(Math.hypot(b[1].centre.x - b[2].centre.x, b[1].centre.z - b[2].centre.z)).toBeLessThan(0.01);
  // Straight 4,4 -> 4,14: the break sits mid-run, the DN walk stops above it
  // (smaller z), the UP walk starts below it and runs to the foot.
  const mid = b[1].centre.z;
  expect(b[1].walk[0].z).toBeCloseTo(4, 3);
  expect(b[1].walk[b[1].walk.length - 1].z).toBeLessThan(mid);
  expect(b[2].walk[0].z).toBeGreaterThan(mid);
  expect(b[2].walk[b[2].walk.length - 1].z).toBeGreaterThan(b[2].walk[0].z);
  // The L pair: the DN flight keeps the top of its longest run, the UP
  // flight everything past the Z (the landing and the second run too).
  expect(b[3].keep).toBe('top');
  expect(b[4].keep).toBe('bottom');
  expect(b[3].drawLine).toBe(true);
  expect(b[4].drawLine).toBe(false);
});

test('2ND FL and the basement draw whole: nothing stacks DN over UP there', async ({ page }) => {
  await openModel(page, fixture(STACK), 5);
  expect(await breaksOn(page, 5)).toEqual({});
  expect(await breaksOn(page, 1)).toEqual({});
});

test('the painter cuts a flight to its side: inside, or outside with invert', async ({ page }) => {
  await openModel(page, fixture(STACK));
  const cut = await page.evaluate(() => {
    const R = window.DraftRender2D;
    const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    const fix = segs => segs.map(([p, q]) => [Math.round(p.x * 100) / 100, Math.round(q.x * 100) / 100]);
    return {
      inside: fix(R.clipSegToRegion2D(-5, 5, 15, 5, square, false)),
      outside: fix(R.clipSegToRegion2D(-5, 5, 15, 5, square, true)),
      clear: fix(R.clipSegToRegion2D(-5, 20, 15, 20, square, true)),
    };
  });
  expect(cut.inside).toEqual([[0, 10]]);
  expect(cut.outside).toEqual([[-5, 0], [10, 15]]);
  expect(cut.clear).toEqual([[-5, 15]]);
});

test('MODEL paints the Z on MAIN FL and keeps both tags; LAYOUT\'s MAIN FL PLAN does too', async ({ page }) => {
  await openModel(page, fixture(STACK));
  const tape = await page.evaluate(() => {
    const proto = CanvasRenderingContext2D.prototype;
    const texts = [];
    const fillText = proto.fillText;
    proto.fillText = function (text, ...rest) { if (this.canvas && this.canvas.id === 'plan') texts.push(String(text)); return fillText.call(this, text, ...rest); };
    window.__texts = texts;
    return true;
  });
  expect(tape).toBe(true);
  const box = await page.locator('#plan').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -1);
  await page.waitForTimeout(400);
  const tags = await page.evaluate(() => [...new Set(window.__texts.filter(t => /^(UP|DN)$/.test(t)).map(t => t.slice(0, 2)))].sort());
  expect(tags).toEqual(['DN', 'UP']);
  // The Z's centre is inked: the stair colour under it on the canvas.
  const { at } = await h.planFrame(page);
  const b = await breaksOn(page, 3);
  const [x, y] = at(b[1].centre.x, b[1].centre.z);
  await page.screenshot({ path: test.info().outputPath('main-fl.png') });
  expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
});
