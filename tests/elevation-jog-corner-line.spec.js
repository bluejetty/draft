// A JOG'S CORNER LINE CROSSES THE FLOOR BAND AND THE SILL.
//
// Movie, 6 Oct, on E4 of his traced MOD BILEVEL (proto/repro-movie-modbilevel-
// corner-line.draft is that drawing), marking two gaps in green: the corner
// line where the house's face jogs stopped under 0'-0" -- across MAIN's floor
// package -- and again at the sill plate. "that is the wall lines that are
// missing". Each floor band is recorded flat at its run's NEAREST face, so it
// stood in front of the deeper face's corner and hid its own line.
//
// Read off the painted canvas, at the fixed viewport, in DAY.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-movie-modbilevel-corner-line.draft'), 'utf8'));

async function openView(page, view) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, saved }) => {
    const f = new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(f, bucket);
  }, { bucket: h.STORAGE_BUCKET, saved: REPRO });
  await page.goto(`/MODEL.html?theme=rough&mode=day&pane=previews&right=1&level=7&lpane=build&left=1&view=cut%3A${view}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(1500);
}

// The rows y0..y1 down one screen column that are NOT inked.
const lightRows = (page, x, y0, y1) => page.evaluate(({ x, y0, y1 }) => {
  const c = document.getElementById('plan');
  const r = c.getBoundingClientRect();
  const sx = c.width / r.width, sy = c.height / r.height;
  const g = c.getContext('2d');
  const out = [];
  for (let y = y0; y <= y1; y++) {
    const v = g.getImageData(Math.round((x - r.left) * sx), Math.round((y - r.top) * sy), 1, 1).data[0];
    if (v >= 120) out.push(y);
  }
  return out;
}, { x, y0, y1 });

test('E4: the jog\'s corner line runs on through the floor band and the sill', async ({ page }) => {
  await openView(page, 'E4');
  // Rows 424..430 are MAIN's floor package, 451..455 the sill plate. (Row 431,
  // the band's own bottom line, is drawn light either side of it.)
  const gaps = (await lightRows(page, 774, 410, 468)).filter(y => y !== 431);
  expect(gaps, 'no break in the corner line').toEqual([]);
});

test('E2: the same, and no stray stubs where two faces meet flush', async ({ page }) => {
  await openView(page, 'E2');
  const gaps = (await lightRows(page, 544, 410, 468)).filter(y => y !== 431);
  expect(gaps, 'no break in the corner line').toEqual([]);
  // Two wall pieces meeting in one plane in front of a deeper wall's end:
  // the band still hides that end.
  const band = await lightRows(page, 631, 424, 430);
  expect(band.length, 'nothing drawn across the floor band here').toBe(7);
});
