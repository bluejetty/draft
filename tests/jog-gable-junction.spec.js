// WHERE THE SMALL GABLE'S BOARD MEETS THE BIG GABLE'S RAKE (jb, 26 Nov 2026).
//
// TIMBERHOUSE, E1 FRONT: a small front gable (roof-64, an 18" stucco board
// of its own) whose peak sits on the big gable's rake, the big gable's
// triangle standing behind it. "the new fascia is good, but small error where
// it meets the lower peak": two marks just past the small peak, between the
// big rake's board and the small gable's.
//  - The big gable's infill read its top station by station, half a foot
//    apart, and joined them: the station under the small roof's board and
//    the one clear of it were joined by a slanted chord, a tick showing
//    between the two boards. It now steps where the board starts covering
//    it, and the outline lifts its pen at the step (the board draws that
//    edge).
//  - With the chord's top under the big rake's foot there, the seam rule
//    (stucco board over stucco gable: no line) failed for the last stations
//    and left a short heavy stub of the big rake's foot, running on past the
//    small gable's rake.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');
const fs = require('fs');
const path = require('path');

const FILE = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'proto', 'repro-timberhouse-jog-fascia.draft'), 'utf8'));

// E1 painted in the page, on its own environment, into a recording context;
// every stroke handed back in feet (u along the view, e up).
async function paintE1(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async f => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), 'model-drawing');
  }, FILE);
  await page.goto('/MODEL.html?level=7&view=cut%3AE1');
  await page.waitForTimeout(800);
  return page.evaluate(() => {
    const CV = window.DraftCutView;
    const env = cutEnv();
    const cut = eMarksDrawn().find(c => c.id === 'E1' || c.name === 'E1');
    const stack = CV.sectionLevelStack(env);
    const extents = CV.cutViewExtents(env, cut);
    const dir = cut.dirVec;
    const axis = { x: dir.z, z: -dir.x };
    const pxPerFt = 40;
    const { uMin, uMax, yTop, yBottom } = extents;
    const w = Math.ceil((uMax - uMin) * pxPerFt) + 40, hgt = Math.ceil((yTop - yBottom) * pxPerFt) + 40;
    const x0 = (w - (uMax - uMin) * pxPerFt) / 2, y0 = (hgt - (yTop - yBottom) * pxPerFt) / 2;
    const toU = X => (X - 0.5 - x0) / pxPerFt + uMin, toE = Y => yTop - (Y - 0.5 - y0) / pxPerFt;
    const strokes = [];
    let cur = null;
    const ctx = {
      strokeStyle: '#000', fillStyle: '#000', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
      lineCap: 'butt', lineJoin: 'miter', globalAlpha: 1,
      beginPath() { cur = []; },
      moveTo(x, y) { (cur || (cur = [])).push({ u: toU(x), e: toE(y), move: true }); },
      lineTo(x, y) { (cur || (cur = [])).push({ u: toU(x), e: toE(y) }); },
      closePath() { if (cur && cur.length) cur.push({ ...cur[0], move: false }); },
      stroke() { if (cur && cur.length > 1) strokes.push({ ink: String(this.strokeStyle), w: this.lineWidth, pts: cur.slice() }); },
      fill() {}, fillRect() {}, strokeRect() {}, clearRect() {}, rect() {}, save() {}, restore() {},
      translate() {}, rotate() {}, scale() {}, setLineDash() {}, getLineDash() { return []; },
      fillText() {}, strokeText() {}, measureText: () => ({ width: 0 }),
      arc() {}, ellipse() {}, quadraticCurveTo() {}, bezierCurveTo() {}, clip() {},
      createLinearGradient: () => ({ addColorStop() {} }),
      createPattern: () => null, drawImage() {}, setTransform() {}, resetTransform() {},
    };
    CV.drawElevationView(env, ctx, w, hgt, cut, stack, axis, () => {}, { pxPerFt, extents,
      colors: CV.inksFromSkin(skin) });
    const segs = [];
    strokes.forEach(s => s.pts.forEach((b, i) => {
      if (!i || b.move) return;
      const a = s.pts[i - 1];
      segs.push({ ink: s.ink, w: s.w, a: { u: a.u, e: a.e }, b: { u: b.u, e: b.e } });
    }));
    return segs;
  });
}

test('E1 of TIMBERHOUSE: nothing drawn between the two boards past the small gable\'s peak', async ({ page }) => {
  const segs = await paintE1(page);
  // The small gable's peak: where its two 18"-board rake tops meet, the
  // highest point of the rake lines lower than the big ridge.
  const top = Math.max(...segs.flatMap(s => [s.a.e, s.b.e]));
  const rakes = segs.filter(s => s.w === 1.5 && Math.abs(Math.abs((s.b.e - s.a.e) / ((s.b.u - s.a.u) || 1e-9)) - 8 / 12) < 0.01);
  const peaks = rakes.flatMap(s => [s.a, s.b]).filter(p => p.e < top - 1 && p.e > top - 4);
  expect(peaks.length, 'the small gable\'s rakes are drawn').toBeGreaterThan(0);
  const peak = peaks.reduce((m, p) => (p.e > m.e ? p : m));
  // The small gable's rake running down from the peak AWAY from the big
  // ridge: the side the junction is on.
  const ridgeU = segs.flatMap(s => [s.a, s.b]).find(p => Math.abs(p.e - top) < 1e-6).u;
  const side = Math.sign(peak.u - ridgeU) || 1;
  // Look in the wedge just past the peak on the ridge side, between the
  // small rake's top (below) and the big rake's top (above), from 0.1 ft
  // to 1.5 ft along: only lines running at the roof's slope (the big
  // rake's board foot) may be there -- no tick, no stub across.
  const slope = 8 / 12;
  const smallTop = u => peak.e - Math.abs(u - peak.u) * slope;
  const inWedge = p => {
    const d = (p.u - peak.u) * -side;
    return d > 0.1 && d < 1.5 && p.e > smallTop(p.u) + 0.03 && p.e < peak.e + d * slope - 0.03;
  };
  const strays = segs.filter(s => {
    const mid = { u: (s.a.u + s.b.u) / 2, e: (s.a.e + s.b.e) / 2 };
    if (!inWedge(mid) && !inWedge(s.a) && !inWedge(s.b)) return false;
    return true;
  }).map(s => ({ ...s, k: (s.b.e - s.a.e) / ((s.b.u - s.a.u) || 1e-9), len: Math.hypot(s.b.u - s.a.u, s.b.e - s.a.e) }));
  // A tick: steeper than the roof. A stub: the heavy rake-foot pen.
  const ticks = strays.filter(s => Math.abs(s.k) > 1 && s.len > 0.03);
  const stubs = strays.filter(s => s.w >= 2);
  expect(ticks.map(s => [s.a, s.b, s.w]), 'no slanted tick between the boards').toEqual([]);
  expect(stubs.map(s => [s.a, s.b, s.w]), 'no heavy stub of the big rake\'s foot').toEqual([]);
});
