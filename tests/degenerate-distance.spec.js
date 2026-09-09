// BOARD #346 — the outboard half of the distance-helper sweep.
//
// Four files kept their own point-to-segment helper, and board #351 records
// what they disagree about: a DEGENERATE segment, one whose two ends are the
// same point. Every outboard copy answers "distance to `a`". The shared export
// (geometry-2d.js:1059) answers `{ d: Infinity }` for anything shorter than
// 0.01ft, deliberately — the click-to-select sites need a zero-length wall to
// be un-hittable rather than infinitely attractive.
//
// So a blind swap flips behaviour exactly where nothing looks. These tests pin
// the CURRENT answers first, before any helper moves, so that the collapse has
// to argue with a red test rather than slide past a green suite.
//
// THE THREE CASES, per the work order: an ordinary segment (the answer nobody
// disputes), an exactly-zero segment (where the disagreement is total), and a
// 0.005ft segment (the residual band — ordinary to these callers, degenerate
// to the export). The third is the one that decides whether a file can be
// collapsed at all.
const { test, expect } = require('@playwright/test');

// Any page that loads the module under test. MODEL.html pulls geometry-2d,
// cut-view and closets in its own script block and needs no drawing to do it,
// so the modules are reachable the moment the document parses.
async function modules(page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('draft-test-storage-cleared')) return;
    sessionStorage.setItem('draft-test-storage-cleared', '1');
    indexedDB.deleteDatabase('pdf-img-mgr-shared');
    localStorage.clear();
  });
  await page.goto('/MODEL.html');
  await page.waitForFunction(() => !!window.DraftClosets && !!window.DraftGeometry2D,
    undefined, { timeout: 6000 });
}

test.describe('board #346 — the shared export, for reference', () => {
  test('the export answers Infinity below 0.01ft, and that is deliberate',
    async ({ page }) => {
      await modules(page);
      const out = await page.evaluate(() => {
        const G = window.DraftGeometry2D;
        const seg = (ax, az, bx, bz) => ({ start: { x: ax, z: az }, end: { x: bx, z: bz } });
        return {
          ordinary: G.pointToSegment({ x: 0, z: 5 }, seg(0, 0, 10, 0)).d,
          zero: G.pointToSegment({ x: 3, z: 4 }, seg(0, 0, 0, 0)).d,
          // 0.005ft is a twentieth of an inch: real geometry to a closet, and
          // under the export's floor.
          tiny: G.pointToSegment({ x: 1, z: 0 }, seg(0, 0, 0.005, 0)).d,
          // 0.02ft is above the floor and answered normally, which is what
          // makes the floor a floor rather than a rule about all short things.
          justAbove: G.pointToSegment({ x: 1, z: 0 }, seg(0, 0, 0.02, 0)).d,
        };
      });
      expect(out.ordinary, 'an ordinary segment is not in dispute').toBeCloseTo(5, 9);
      expect(out.zero, 'a zero-length segment is unreachable, not near').toBe(Infinity);
      expect(out.tiny, 'and so is anything under 0.01ft').toBe(Infinity);
      expect(out.justAbove, 'but 0.02ft is answered normally — the floor has an edge')
        .toBeCloseTo(0.98, 9);
    });
});

test.describe('board #346 — closets.js', () => {
  test('its helper answers distance-to-a where the export answers Infinity',
    async ({ page }) => {
      await modules(page);
      const out = await page.evaluate(() => {
        const C = window.DraftClosets;
        const p = (x, z) => ({ x, z });
        return {
          ordinary: C.pointToSegment(p(0, 5), p(0, 0), p(10, 0)),
          zero: C.pointToSegment(p(3, 4), p(0, 0), p(0, 0)),
          // THE RESIDUAL BAND, and the point is chosen to make it as large as
          // it can be: projected past the far end, so the perpendicular answer
          // and the distance-to-a answer differ by the whole segment length.
          tiny: C.pointToSegment(p(1, 0), p(0, 0), p(0.005, 0)),
          poly: C.polyToSegment(
            [p(0, 0), p(0, 0), p(4, 0), p(4, 4)],   // a duplicated corner: a zero-length edge
            p(0, 10), p(4, 10)),
        };
      });
      expect(out.ordinary, 'the ordinary answer matches the export').toBeCloseTo(5, 9);
      // THE DISAGREEMENT, stated as a number rather than described.
      expect(out.zero, 'a zero-length segment is its own point here, not unreachable')
        .toBeCloseTo(5, 9);
      // AND THE BAND. closets guards at 1e-12 — true zero — so 0.005ft is an
      // ORDINARY segment to it and gets the perpendicular answer: 0.995, the
      // distance to the far end. The export would answer Infinity, and a
      // caller-local fallback would answer 1.0. The gap is the segment's own
      // length, 0.005ft — 1/16", against closets' smallest threshold of
      // 0.29ft (WALL_FT). Far from mattering, but it is a real change and it
      // is written down here so the collapse argues with it.
      expect(out.tiny, 'a 0.005ft segment is ordinary to closets, not degenerate')
        .toBeCloseTo(0.995, 9);
      expect(out.tiny, 'and it is NOT the distance to the near end')
        .not.toBeCloseTo(1, 6);
      expect(out.poly, 'a duplicated polygon corner must not poison the minimum')
        .toBeCloseTo(6, 9);
    });
});

// ── auto-stair.js ──────────────────────────────────────────────────────────
// Its distPtSeg has two callers and NEITHER was covered. Breaking the helper
// completely — always Infinity, always 0, distance-to-the-start-point — left
// all eleven auto-stair and stair-rules specs green. That was found by
// mutating before trusting, after this file's author had already written down
// "the existing specs are the regression net". They were not.
//
// This is the net. `wallAdjacent` on the returned stair is computed straight
// from distToRing (auto-stair.js:518, surfaced at :575), so it moves when the
// helper moves, and it separates cleanly: a stair pulled into a corner is
// beside the ring, one left to find the centroid of a 40ft room is not.
const AUTO_STAIR = { points: [{ x: 0, z: 0 }, { x: 40, z: 0 }, { x: 40, z: 40 }, { x: 0, z: 40 }],
  insetFt: 0.5, runFt: 11, treads: 13 };

test.describe('board #346 — auto-stair.js', () => {
  test('wall adjacency tracks the ring, and says both yes and no',
    async ({ page }) => {
      await page.goto('/MODEL.dc.html');
      await page.waitForFunction(() => !!window.DraftAutoStair && !!window.DraftGeometry2D,
        undefined, { timeout: 10000 });

      const out = await page.evaluate(base => {
        const run = stamps => window.DraftAutoStair
          .suggestStair(Object.assign({}, base, { stamps })).stair;
        const pull = window.DraftAutoStair.PULL_STAMPS[0];
        return {
          middle: run([])?.wallAdjacent,
          corner: run([{ name: pull, x: 1, z: 1 }])?.wallAdjacent,
          edge: run([{ name: pull, x: 20, z: 0.5 }])?.wallAdjacent,
          placed: !!run([]),
        };
      }, AUTO_STAIR);

      expect(out.placed, 'the fixture must actually place a stair').toBe(true);
      // BOTH ANSWERS, from the same room. Either one alone passes for a helper
      // that always returns the same number, which is exactly how three broken
      // versions of it slipped through the existing specs.
      expect(out.middle, 'a stair left to find the centre of a 40ft room is not '
        + 'beside the ring').toBe(false);
      expect(out.corner, 'a stair pulled into a corner is').toBe(true);
      expect(out.edge, 'and so is one pulled against an edge').toBe(true);
    });
});
