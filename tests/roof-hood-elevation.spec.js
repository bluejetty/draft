// A MOD BILEVEL whose upper (OVER GARAGE) roof was pushed out over the main
// roof in BONEYARD, with the walls BONEYARD hangs under it (`hoodOf`).
//
// Movie, 5 Oct, on E2: "we should see the wall below the 2nd floor roof
// (bottom of this wall should allign with the main floor ceiling)" -- the
// main roof's eave is nearer than that wall, so paint order alone buried it.
// And: "the sill plate is getting better but the garage line is grey the
// house line is black ... they should match in shade of line" -- the
// garage's wall fill took half the pixel row its plate line was drawn on.
//
// Both read off the painted canvas, at the fixed viewport, in DAY.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-modbilevel-roof-hood.draft'), 'utf8'));

async function openE2(page) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, saved }) => {
    const f = new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(f, bucket);
  }, { bucket: h.STORAGE_BUCKET, saved: REPRO });
  await page.goto('/MODEL.html?theme=rough&mode=day&pane=previews&right=1&level=7&lpane=build&left=1&view=cut%3AE2');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(1500);
}

// The red channel down one screen column, rows y0..y1, off the sheet canvas.
async function column(page, x, y0, y1) {
  return page.evaluate(({ x, y0, y1 }) => {
    const c = [...document.querySelectorAll('canvas')]
      .sort((a, b) => b.width * b.height - a.width * a.height)
      .find(cv => cv.getBoundingClientRect().width > 500);
    const r = c.getBoundingClientRect();
    const sx = c.width / r.width, sy = c.height / r.height;
    const g = c.getContext('2d');
    const out = [];
    for (let y = y0; y < y1; y++) {
      out.push(g.getImageData(Math.round((x - r.left) * sx), Math.round((y - r.top) * sy), 1, 1).data[0]);
    }
    return out;
  }, { x, y0, y1 });
}

const darkRows = (col, y0) => col.map((v, i) => (v < 80 ? y0 + i : null)).filter(y => y != null);

test('E2: the wall under the upper roof shows above the main roof', async ({ page }) => {
  await openE2(page);
  // x 700 is over the hung wall, x 560 over the main roof alone; both are
  // under the upper roof's soffit at the top of the band read.
  const under = darkRows(await column(page, 700, 285, 340), 285);
  const beside = darkRows(await column(page, 560, 285, 340), 285);
  // The soffit's line, then the wall's foot where it meets the main roof.
  expect(under.length, `dark rows over the wall: ${under}`).toBeGreaterThanOrEqual(2);
  expect(under[under.length - 1] - under[0]).toBeGreaterThan(6);
  // Beside it, only the main roof's own top line.
  expect(beside.length, `dark rows beside it: ${beside}`).toBe(1);
});

test('E2: the garage sill plate line is as dark as the house\'s', async ({ page }) => {
  await openE2(page);
  // Each column's first dark row above the grade band is the top of the
  // plate: x 500 through the house, x 950 through the garage.
  const firstDark = async x => {
    const col = await column(page, x, 500, 545);
    return Math.min(...col.slice(0, 40));
  };
  const house = await firstDark(500);
  const garage = await firstDark(950);
  expect(house).toBeLessThan(80);
  expect(Math.abs(garage - house), `house ${house}, garage ${garage}`).toBeLessThan(20);
});

// LAYOUT draws its elevations through cut-view-env.js, and that env dropped
// `hoodOf`: the walls hung under the room's roof went down as ordinary
// walls, each with the OVER GARAGE floor band under it, in front of the main
// wall and over its window (Movie, 9 Oct, on E3: "the lines look like they
// are effected by the 2nd floor").
test('LAYOUT\'s elevation env keeps the walls hung under a roof', async ({ page }) => {
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => window.DraftCutViewEnv && window.DraftDrawingFormat);
  const got = await page.evaluate(saved => {
    const env = window.DraftCutViewEnv.buildCutViewEnv(saved, saved.levels.map(l => ({ ...l })));
    return env.walls().filter(w => w.hoodOf).map(w => w.hoodOf);
  }, REPRO.drawing || REPRO);
  const want = (REPRO.drawing || REPRO).walls.filter(w => w.hoodOf).map(w => String(w.hoodOf));
  expect(want.length).toBeGreaterThan(0);
  expect(got).toEqual(want);
});
