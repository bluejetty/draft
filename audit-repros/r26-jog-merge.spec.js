// M7: mergeJogs replaces an interior cluster with its arithmetic MEAN, so the
// dimension is strung to a coordinate where no wall stands.
const { test } = require('@playwright/test');
const h = require('../tests/helpers.js');

test('R26: an interior jog dimension lands between the two walls', async ({ page }) => {
  await h.openModel(page);
  const out = await page.evaluate(() => {
    const g = window.DraftGeometry2D;
    const fmt = window.DraftFormatters.formatArchitecturalInches;
    // A north wall that steps 1.5" at x = 2: the two faces stand at 2.000 and
    // 2.125 feet. Both are real walls the framer will build.
    const pts = [
      { x: -10, z: -8 }, { x: 2, z: -8 }, { x: 2, z: -7 },
      { x: 2.125, z: -7 }, { x: 2.125, z: -8 }, { x: 10, z: -8 },
      { x: 10, z: 8 }, { x: -10, z: 8 },
    ];
    const segs = window.DraftAutoDims.computeAutoDimStrings({
      walls: [], outlines: [{ points: pts, garage: false }], roofs: [], openings: [],
      offsetOutline: (p, d) => g.offsetOutline(p, d),
      firstOffset: 1.5, jogMergeFt: 2 / 12, stringSpacingFt: 1.5,
    }) || [];
    // North strings only (z below the plan), horizontal.
    const north = segs.filter(s => Math.abs(s.start.z - s.end.z) < 1e-9 && s.start.z < -8);
    const xs = [...new Set(north.flatMap(s => [s.start.x, s.end.x]))].sort((a, b) => a - b);
    return {
      wallFaces: [2, 2.125],
      strungCoordinates: xs.map(x => +x.toFixed(6)),
      printedFromWest: xs.filter(x => x > -10 && x < 10).map(x => fmt((x - -10) * 12)),
    };
  });
  console.log('the two real wall faces sit at x =', JSON.stringify(out.wallFaces));
  console.log('coordinates the strings actually use:', JSON.stringify(out.strungCoordinates));
  console.log('printed distance from the west wall to the jog:', JSON.stringify(out.printedFromWest));
});
