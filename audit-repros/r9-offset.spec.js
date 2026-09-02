// geometry-2d offsetOutline: miter offset with no self-intersection cleanup
// and no zero-length-edge guard. Both feed roof footprints and the ROOF-level
// auto-dimension strings, so both reach paper.
const { test, expect } = require('@playwright/test');
const h = require('../tests/helpers.js');

test('R9: offsetOutline on a narrow neck and on a duplicated point', async ({ page }) => {
  await h.openModel(page);
  const out = await page.evaluate(() => {
    const g = window.DraftGeometry2D;
    const fmt = pts => pts.map(p => `(${p.x.toFixed(2)},${p.z.toFixed(2)})`).join(' ');
    const area = pts => Math.abs(pts.reduce((s, p, i) => {
      const n = pts[(i + 1) % pts.length]; return s + (p.x * n.z - n.x * p.z); }, 0) / 2);
    // 1. A 3'-wide neck on an otherwise 20' house, offset inward 2' (a normal
    //    roof overhang). The two sides of the neck cross.
    const neck = [
      { x: 0, z: 0 }, { x: 20, z: 0 }, { x: 20, z: 10 },
      { x: 11.5, z: 10 }, { x: 11.5, z: 20 }, { x: 8.5, z: 20 }, { x: 8.5, z: 10 },
      { x: 0, z: 10 },
    ];
    const neckIn = g.offsetOutline(neck, -2);
    // 2. Same square, but with one point repeated (a double-tap while tracing).
    const dupe = [{ x: 0, z: 0 }, { x: 20, z: 0 }, { x: 20, z: 20 }, { x: 20, z: 20 }, { x: 0, z: 20 }];
    const dupeOut = g.offsetOutline(dupe, 2);
    const clean = g.offsetOutline([{ x: 0, z: 0 }, { x: 20, z: 0 }, { x: 20, z: 20 }, { x: 0, z: 20 }], 2);
    return {
      neckArea: area(neck), neckInArea: area(neckIn), neckIn: fmt(neckIn),
      dupeOut: fmt(dupeOut), dupeArea: area(dupeOut),
      cleanOut: fmt(clean), cleanArea: area(clean),
    };
  });
  console.log('narrow-neck footprint area', out.neckArea.toFixed(2), '-> inward 2ft area', out.neckInArea.toFixed(2));
  console.log('  offset ring:', out.neckIn);
  console.log('square+duplicate point, outward 2ft: area', out.dupeArea.toFixed(2), '(clean square gives', out.cleanArea.toFixed(2) + ')');
  console.log('  dupe ring :', out.dupeOut);
  console.log('  clean ring:', out.cleanOut);
});
