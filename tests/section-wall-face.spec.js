// A SECTION STANDS A WALL ON ITS REFERENCE LINE, NOT ACROSS IT (Movie, 17
// Oct, on an S1 cut): "look at the wall it looks like the section is showing
// the OUTLINE as the center of the EXT wall - it should be the EXT of the EXT
// wall and line up with the GRADE BEAM edge below - all in line with the
// OUTLINE line".
//
// A wall record keeps one line and a `refLine` saying which face that line is
// (geometry-2d wallFaceOffsets). cut-view.js's section already honours it --
// sectionWallCrossings stands the band half its thickness inside a 'left' or
// 'right' line -- and MODEL hands it the raw walls. The shared environment
// the SHEETS build it through (cut-view-env.js, read by LAYOUT and the Real
// Estate Layout) rebuilt each wall field by field and left `refLine` out, so
// on a sheet every wall read 'center': the framed storey stood a thickness
// and a quarter off the concrete under it. Pinned here through the page's
// own module, as geometry rather than ink: two walls on one line, one framed
// and one concrete, both 'right', must share their exterior face.
const { test, expect } = require('@playwright/test');

const point = (x, z) => ({ x, y: 0, z });
const wall = (id, levelId, view, wallType, refLine) => ({
  id, start: point(0, 0), end: point(0, 20), levelId, view, wallType, refLine,
  baseHeight: 0, topHeight: 8,
});
const SAVED = {
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }],
  walls: [
    wall(1, 3, 'plan', 'stud_2x6', 'right'),
    wall(2, 1, 'foundation', 'concrete_8', 'right'),
    wall(3, 3, 'plan', 'stud_2x4', 'center'),
  ],
};
const CUT = { id: 1, name: 'S1', startPt: { x: -10, z: 10 }, endPt: { x: 10, z: 10 },
  dirVec: { x: 0, z: -1 }, levelId: 3 };

async function facesThroughTheSheetEnv(page) {
  return page.evaluate(({ saved, cut }) => {
    const F = window.DraftDrawingFormat;
    const env = window.DraftCutViewEnv.buildCutViewEnv(saved, F.levels(saved.levels));
    const crossings = window.DraftCutView.sectionWallCrossings(env, cut, { x: 1, z: 0 });
    const faces = {};
    crossings.forEach(c => { faces[c.wall.id] = [c.u - c.width / 2, c.u + c.width / 2]; });
    return { faces, refLines: env.walls().map(w => w.refLine) };
  }, { saved: SAVED, cut: CUT });
}

test('on a sheet, a framed wall and the concrete under it share their exterior face', async ({ page }) => {
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  const { faces, refLines } = await facesThroughTheSheetEnv(page);
  // The environment carries the face the line is, for every wall.
  expect(refLines).toEqual(['right', 'right', 'center']);
  // Both 'right' walls run 0,0 -> 0,20, so their body lies at x > 0 and the
  // line IS the exterior face: the two bands start at u = 0 together, and
  // the thicker concrete reaches further in.
  expect(faces['1'][0]).toBeCloseTo(0, 3);
  expect(faces['2'][0]).toBeCloseTo(0, 3);
  expect(faces['1'][1]).toBeCloseTo(5.5 / 12, 3);
  expect(faces['2'][1]).toBeCloseTo(8 / 12, 3);
  // AND A CENTRED WALL IS STILL CENTRED: the rule is the record's, not
  // "always flush".
  expect(faces['3'][0]).toBeCloseTo(-3.5 / 24, 3);
  expect(faces['3'][1]).toBeCloseTo(3.5 / 24, 3);
});
