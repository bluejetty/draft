// A FOUNDATION WALL SEEN END ON SHOWS ITS END.
//
// jb, 16 Nov 2026, on E1 of the stepped-front house with the foundation
// walls run out past the front at the step: "the front edge of the
// FOUNDATION wall isn't showing (like the upper walls earlier)". The same
// sliver drop tests/wall-end-on.spec.js pins for the storeys, one list over:
// a concrete wall running straight at the viewer was dropped, and the strip
// of its free end, standing proud of the face it leaves, went with it.
//
// cut-view.js elevationFaces now hands the free near end of such a wall to
// the foundation pass as a face of its own, across the concrete's two faces.
const { test, expect } = require('@playwright/test');
const H = require('../proto/harness-env.js');

const W = (id, levelId, a, b, view = 'plan', wallType = 'stud_2x6') => ({ id,
  start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId, view, wallType, baseHeight: 0, topHeight: 8, refLine: 'left' });
// jb's house: 19'-6" deep, the front (z 0) stepped back a foot for its last
// 6'-6". The foundation carries the hand wall: x 13, from the front out 2 ft.
const ring = (lv, view, type) => [
  W(`w${lv}a`, lv, [0, 0], [0, -41.5], view, type), W(`w${lv}b`, lv, [0, -41.5], [19.5, -41.5], view, type),
  W(`w${lv}c`, lv, [19.5, -41.5], [19.5, -1], view, type), W(`w${lv}d`, lv, [19.5, -1], [13, -1], view, type),
  W(`w${lv}e`, lv, [13, -1], [13, 0], view, type), W(`w${lv}f`, lv, [13, 0], [0, 0], view, type)];
const house = (fin = true) => ({
  version: 1, board: 'drafting', planTurn: 0, buildType: 'twoStorey', autoRoof: false,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 }, { id: 5, name: '2ND FL', elev: 9 },
    { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -10 }],
  activeLevelIdx: 2, nextDrawingItemId: 50,
  walls: [...ring(3), ...ring(5), ...ring(1, 'foundation', 'concrete_8'),
    ...(fin ? [W('fin', 1, [13, 0], [13, 2], 'foundation', 'concrete_8')] : [])],
  lines: [], floors: [], fenestrations: [], dimensions: [], outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [], roofs: [],
});

// Plumb lines on E1 (the front, z 0 side) between u 12 and 13, below the
// main floor: solid (the exposed concrete) or dashed (buried, lighter ink).
const plumbs = saved => {
  const win = H.loadDraftModules();
  const env = H.buildEnv(win, saved);
  const cut = H.standardElevationCuts(env).find(c => c.id === 'E1');
  const v = H.paintElevation(win, env, cut, {});
  const out = [];
  v.strokes.forEach(s => s.pts.forEach((p, i) => {
    if (!i || p.move || s.ink === '#fff') return;
    const q = s.pts[i - 1];
    if (Math.abs(q.u - p.u) < 0.01 && q.u > 12 && q.u < 12.99 && Math.max(q.e, p.e) < 0)
      out.push({ u: q.u, lo: Math.min(q.e, p.e), hi: Math.max(q.e, p.e), ink: s.ink });
  }));
  return out;
};

test('E1: the foundation wall standing out of the front draws its inside corner down the concrete', () => {
  const lines = plumbs(house());
  // 8" concrete: the wall's other face, which meets the front at the inside
  // corner, a wall thickness off the step.
  const at = lines.filter(l => Math.abs(l.u - 12.325) < 0.05);
  expect(at.length, JSON.stringify(lines)).toBeGreaterThan(0);
  // Up the exposed concrete in full ink, to the top of the foundation...
  const exposed = at.find(l => l.ink === '#1d1f20');
  expect(exposed, JSON.stringify(at)).toBeTruthy();
  expect(exposed.hi).toBeGreaterThan(-1.4);
  // ...and on down below grade, dashed, to the footing.
  expect(Math.min(...at.map(l => l.lo))).toBeLessThan(-9);
  // And without the hand wall, nothing there.
  expect(plumbs(house(false))).toEqual([]);
});
