// THE JOIST ARROWS IN A LAYOUT SEAT ARE SMALL (jb, 28 Nov 2026: "can your
// reduce the arrow end size for the layout views ... they are too big in
// those little viewports"). A seat is 82 px across and the sheet's open V
// heads are 11 px; the seat draws them at SEAT_JOIST_INK of that. The main
// view keeps its 11 px heads.
//
// A seat paints the floor's picked-up callouts (LINES with `joist`); the
// callouts seeded off the beams are drawn on the main view only.
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
const FILE = {
  version: 1,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [...wallsOf(3, 100, HOUSE), ...wallsOf(1, 300, HOUSE, 'foundation')],
  // A JOIST CALLOUT THE DRAFTER PICKED UP: a LINE of his own, which the
  // seat paints (the seeded callouts are the main view's only).
  lines: [{ id: 1, start: point(12, 0.5), end: point(12, 21.5), levelId: 3, view: 'floor',
    joist: { text: 'ENGINEERED OWJ 19-1/4"', side: 'above' } }],
  roofs: [], fenestrations: [], dimensions: [], shapes: [], stairs: [], notes: [],
  roomTags: [], boneyardOutlines: [], boneyardShelves: [], groups: [], levelLocks: [], underlays: [],
  outlines: [{ id: 1, levelId: 3, points: HOUSE, garage: false }],
  floors: [{ id: 'deck-3', levelId: 3, view: 'floor', structure: 'floor', points: HOUSE }],
  surfaceOpenings: [],
  beams: [{ id: 1, start: point(0.5, 22), end: point(23.5, 22), levelId: 3, view: 'floor', mode: 'flush' }],
  columns: [], layout: { auto: true },
};

// Every open V stroked (three points, two equal arms, ~0.9 rad apart):
// the arm length in CSS px, filed under the seat it was drawn in.
const recordHeads = () => {
  const proto = CanvasRenderingContext2D.prototype;
  const paths = new WeakMap();
  window.__heads = {};
  const { beginPath, moveTo, lineTo, stroke } = proto;
  proto.beginPath = function () { paths.set(this, []); return beginPath.apply(this, arguments); };
  proto.moveTo = function (x, y) { paths.set(this, [[x, y]]); return moveTo.apply(this, arguments); };
  proto.lineTo = function (x, y) { (paths.get(this) || []).push([x, y]); return lineTo.apply(this, arguments); };
  proto.stroke = function () {
    const p = paths.get(this) || [];
    if (p.length === 3) {
      const a = Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]);
      const b = Math.hypot(p[2][0] - p[1][0], p[2][1] - p[1][1]);
      const gap = Math.hypot(p[0][0] - p[2][0], p[0][1] - p[2][1]);
      // Equal arms and the V's opening (2 * 0.45 rad: gap = 2 a sin 0.45).
      if (a > 0.5 && Math.abs(a - b) < 0.01 && Math.abs(gap - 2 * a * Math.sin(0.45)) < 0.05) {
        const seat = this.canvas.closest && this.canvas.closest('.seat');
        const key = seat ? seat.textContent.trim() : this.canvas.id || 'other';
        (window.__heads[key] = window.__heads[key] || []).push(a);
      }
    }
    return stroke.apply(this, arguments);
  };
};

test('the joist arrowheads in a LAYOUT (FLOOR) seat are drawn small', async ({ page }) => {
  await page.addInitScript(recordHeads);
  await h.openEditor(page, { drawing: FILE, bucket: BUCKET, url: '/MODEL.html?left=1&right=1', webgl: false });
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.pickModelLayer(page, 3, 'floor');
  await page.waitForTimeout(800);
  const heads = await page.evaluate(() => window.__heads);
  const seatKey = Object.keys(heads).find(k => /MAIN FL LAYOUT \(FLOOR\)/.test(k));
  expect(seatKey, 'the MAIN FL LAYOUT (FLOOR) seat drew its joist arrow').toBeTruthy();
  // 11 px on the sheet; in the seat about 4 px.
  expect(Math.max(...heads[seatKey])).toBeLessThan(5);
  // The main view's heads are as they were.
  expect(Math.max(...(heads.plan || [0]))).toBeCloseTo(11, 1);
});
