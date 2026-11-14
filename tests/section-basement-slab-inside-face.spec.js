// THE BASEMENT SLAB IS POURED TO THE INSIDE FACE OF THE FOUNDATION WALL.
//
// jb, 14 Nov 2026, on S1 through a basement: "can we make the conc floor slab
// in the basement get poured to the INSIDE edge of the foundation wall". The
// house slab's polygon is the foundation outline -- the walls' OUTER face --
// so the section drew the slab band the whole way through the concrete it is
// poured against. The garage slabs already stopped at the inside face
// (cut-view.js insideFace, Movie 14 Oct); the house slab now asks the same.
//
// Measured as geometry through the page's own painter: a pinned frame puts
// one foot at 10px with u = 0 at x = 0, so every fillRect reads back in feet.
const { test, expect } = require('@playwright/test');

const point = (x, z) => ({ x, y: 0, z });
const wall = (id, levelId, view, sx, sz, ex, ez) => ({
  id, start: point(sx, sz), end: point(ex, ez), levelId, view,
  wallType: view === 'foundation' ? 'concrete_8' : 'stud_2x6',
  // Wound clockwise in plan with 'left' lines: each line is the OUTER face,
  // which is how a built house stands its walls on the outline.
  refLine: 'left', baseHeight: 0, topHeight: 8,
});
const box = (base, levelId, view) => [
  wall(base + 1, levelId, view, 0, 0, 30, 0),
  wall(base + 2, levelId, view, 30, 0, 30, 20),
  wall(base + 3, levelId, view, 30, 20, 0, 20),
  wall(base + 4, levelId, view, 0, 20, 0, 0),
];
const outline = [point(0, 0), point(30, 0), point(30, 20), point(0, 20)];
const saved = withSlabPolygon => ({
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'BASEMENT', elev: -9 }],
  walls: [...box(100, 3, 'plan'), ...box(200, 1, 'foundation')],
  floors: withSlabPolygon
    ? [{ id: 'f1', levelId: 1, view: 'foundation', points: outline }]
    : [],
});
const CUT = { id: 1, name: 'S1', levelId: 3,
  startPt: { x: -5, z: 10 }, endPt: { x: 35, z: 10 }, dirVec: { x: 0, z: -1 } };

async function slabAndWalls(page, doc) {
  return page.evaluate(({ doc: d, cut }) => {
    const F = window.DraftDrawingFormat;
    const CV = window.DraftCutView;
    const env = window.DraftCutViewEnv.buildCutViewEnv(d, F.levels(d.levels));
    const stack = CV.sectionLevelStack(env);
    const PX = 10;
    const rects = [];
    const ctx = new Proxy({}, {
      get(target, key) {
        if (key === 'fillRect') return (x, y, w, h) => rects.push({ x, y, w, h, fill: target.fillStyle });
        if (key in target) return target[key];
        if (key === 'measureText') return () => ({ width: 0 });
        if (key === 'getLineDash') return () => [];
        if (key === 'createPattern' || key === 'createLinearGradient') return () => ({ addColorStop() {} });
        return () => {};
      },
      set(target, key, value) { target[key] = value; return true; },
    });
    CV.drawCutView(env, ctx, 2000, 1000, cut,
      { frame: { pxPerFt: PX, x0: 0, y0: 0, uMin: 0, yTop: 0 } });
    const axis = { x: cut.dirVec.z, z: -cut.dirVec.x };
    const faces = CV.sectionWallCrossings(env, cut, axis)
      .filter(c => (c.wall.view || 'plan') === 'foundation')
      .map(c => ({ lo: c.u - c.width / 2, hi: c.u + c.width / 2 }))
      .sort((a, b) => a.lo - b.lo);
    // The house slab: the band whose top is the foundation's slab top.
    const slabTopPx = -stack.foundation.slabTop * PX;
    const slabs = rects.filter(r => Math.abs(r.y - slabTopPx) < 0.01
      && Math.abs(r.h - (stack.foundation.slabIn / 12) * PX) < 0.01)
      .map(r => ({ lo: r.x / PX, hi: (r.x + r.w) / PX }));
    return { faces, slabs };
  }, { doc, cut: CUT });
}

for (const withSlabPolygon of [true, false]) {
  test(`the basement slab stops at the inside face of the foundation walls (${withSlabPolygon ? 'slab polygon' : 'walls only'})`, async ({ page }) => {
    await page.goto('/LAYOUT.html');
    await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
    const { faces, slabs } = await slabAndWalls(page, saved(withSlabPolygon));
    expect(faces.length).toBe(2);
    expect(slabs.length).toBe(1);
    const [west, east] = faces;
    // Poured against both walls: from the west wall's inside face to the
    // east wall's, and no further.
    expect(slabs[0].lo).toBeCloseTo(west.hi, 3);
    expect(slabs[0].hi).toBeCloseTo(east.lo, 3);
    // And so it overlaps no wall band.
    faces.forEach(f => expect(slabs[0].lo >= f.hi - 1e-6 || slabs[0].hi <= f.lo + 1e-6).toBe(true));
  });
}
