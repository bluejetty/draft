// THE COLUMNS AND THE BEAMS THEY CARRY, ON THE SECTIONS.
//
// jb, 26 Nov 2026, on S2 of a house with a basement: "we should show the
// columns on the sections". Before this a section drew only the posts on
// piles out in the open; a basement telepost, its pad, and the beam over it
// never drew. Now (cut-view.js framingPieces / drawSectionFraming): a post
// the line passes through is drawn cut, one beyond it is seen, a beam the
// line crosses is its cross-section, and a FLUSH beam beyond is hidden in
// the floor while a DROPPED one is seen under it.
//
// Read back off the painter's own report (canvas data-section-framing).
const { test, expect } = require('@playwright/test');

const point = (x, z) => ({ x, y: 0, z });
const wall = (id, levelId, view, sx, sz, ex, ez) => ({
  id, start: point(sx, sz), end: point(ex, ez), levelId, view,
  wallType: view === 'foundation' ? 'concrete_8' : 'stud_2x6',
  refLine: 'left', baseHeight: 0, topHeight: 8,
});
const box = (base, levelId, view) => [
  wall(base + 1, levelId, view, 0, 0, 30, 0),
  wall(base + 2, levelId, view, 30, 0, 30, 20),
  wall(base + 3, levelId, view, 30, 20, 0, 20),
  wall(base + 4, levelId, view, 0, 20, 0, 0),
];
const outline = [point(0, 0), point(30, 0), point(30, 20), point(0, 20)];
const house = (mode = 'flush') => ({
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'BASEMENT', elev: -9 }],
  walls: [...box(100, 3, 'plan'), ...box(200, 1, 'foundation')],
  floors: [{ id: 'f1', levelId: 1, view: 'foundation', points: outline },
    { id: 'f3', levelId: 3, view: 'floor', points: outline }],
  // The basement beam line down the middle on two teleposts.
  beams: [{ id: 1, start: point(0, 10), end: point(30, 10), levelId: 1, view: 'foundation', mode }],
  columns: [
    { id: 1, point: point(10, 10), levelId: 1, view: 'foundation', footing: 'pad36' },
    { id: 2, point: point(20, 10), levelId: 1, view: 'foundation', footing: 'pad42' },
  ],
});

async function framing(page, doc, cut) {
  return page.evaluate(({ doc: d, cut: c }) => {
    const F = window.DraftDrawingFormat;
    const CV = window.DraftCutView;
    const env = window.DraftCutViewEnv.buildCutViewEnv(d, F.levels(d.levels));
    const stack = CV.sectionLevelStack(env);
    const canvas = document.createElement('canvas');
    canvas.width = 1200; canvas.height = 800;
    CV.drawCutView(env, canvas.getContext('2d'), 1200, 800, c,
      { frame: { pxPerFt: 10, x0: 0, y0: 0, uMin: -5, yTop: 20 } });
    return { said: JSON.parse(canvas.getAttribute('data-section-framing') || 'null'), fdn: stack.foundation,
      main: stack.floors.find(l => l.id === 3) };
  }, { doc, cut });
}

async function ready(page) {
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
}

test('a cut through a telepost draws it cut, the one beyond seen, and the beam as its cross-section', async ({ page }) => {
  await ready(page);
  // Across the house at x = 10, looking toward x = 20.
  const cut = { id: 1, name: 'S1', levelId: 3,
    startPt: { x: 10, z: -5 }, endPt: { x: 10, z: 25 }, dirVec: { x: -1, z: 0 } };
  const { said, fdn, main } = await framing(page, house(), cut);
  expect(said, 'the section reports its framing').not.toBeNull();
  const cutPost = said.posts.find(p => p.cut);
  const seenPost = said.posts.find(p => !p.cut);
  expect(cutPost, 'the telepost on the line').toBeTruthy();
  expect(seenPost, 'the telepost beyond, in the same spot on the sheet').toBeTruthy();
  expect(cutPost.u).toBeCloseTo(10, 3);
  expect(seenPost.u).toBeCloseTo(10, 3);
  [cutPost, seenPost].forEach(p => {
    expect(p.kind).toBe('telepost');
    expect(p.foot, 'stands on the slab').toBeCloseTo(fdn.slabTop, 3);
    expect(p.top, 'up to the underside of the beam, inside the main floor').toBeLessThan(main.floorTop);
    expect(p.top).toBeGreaterThan(main.floorBottom - 0.01);
    expect(p.padBottom, 'its pad under the slab').toBeLessThan(fdn.wallBottom);
  });
  // The 36" pad is 8" deep, the 42" one 10".
  expect(fdn.wallBottom - cutPost.padBottom).toBeCloseTo(8 / 12, 3);
  expect(fdn.wallBottom - seenPost.padBottom).toBeCloseTo(10 / 12, 3);
  const beam = said.beams.find(b => b.cut);
  expect(beam, 'the beam crossing the cut').toBeTruthy();
  expect(beam.u1 - beam.u0, 'its 4 1/2" width').toBeCloseTo(4.5 / 12, 3);
  expect((beam.u0 + beam.u1) / 2).toBeCloseTo(10, 2);
  expect(beam.top, 'a flush beam sits in the main floor').toBeCloseTo(main.floorTop - 0.75 / 12, 3);
});

test('looking along the beam line: posts seen, a flush beam hidden in the floor, a dropped one seen', async ({ page }) => {
  await ready(page);
  // Along the house at z = 5, looking toward the beam line at z = 10.
  const cut = { id: 1, name: 'S2', levelId: 3,
    startPt: { x: -5, z: 5 }, endPt: { x: 35, z: 5 }, dirVec: { x: 0, z: -1 } };
  const flush = (await framing(page, house('flush'), cut)).said;
  expect(flush.posts.map(p => p.cut)).toEqual([false, false]);
  // u runs along the cut, here -x.
  expect(flush.posts.map(p => Math.abs(p.u)).sort((a, b) => a - b)).toEqual([10, 20]);
  expect(flush.beams, 'a flush beam beyond is inside the floor').toEqual([]);

  const { said: dropped, main } = await framing(page, house('dropped'), cut);
  expect(dropped.beams.length).toBe(1);
  expect(dropped.beams[0].cut).toBe(false);
  expect(dropped.beams[0].top, 'hung under the joists').toBeCloseTo(main.floorBottom, 3);
  // Seen from the inside face of one wall to the other.
  expect(dropped.beams[0].u0).toBeLessThan(-29);
  expect(dropped.beams[0].u1).toBeGreaterThan(-1);
  // The posts stop under the dropped beam.
  dropped.posts.forEach(p => expect(p.top).toBeCloseTo(dropped.beams[0].bottom, 3));
});

test('a wall between the cut and a post hides it', async ({ page }) => {
  await ready(page);
  const doc = house();
  // A basement partition at z = 7.5, between the cut and the beam line.
  doc.walls.push(wall(300, 1, 'plan', 0, 7.5, 30, 7.5));
  const cut = { id: 1, name: 'S2', levelId: 3,
    startPt: { x: -5, z: 5 }, endPt: { x: 35, z: 5 }, dirVec: { x: 0, z: -1 } };
  const { said } = await framing(page, doc, cut);
  expect(said.posts).toEqual([]);
});
