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

// ── THE CORNER LINE IS FOUND, NOT TYPED ──────────────────────────────────
//
// This file used to name its columns outright -- 774 on E4, 544 on E2 -- and
// those numbers were true of one window: 1366x768 with a 195px seat rail. The
// rail grew 15px to make room for its own scrollbar (Movie, 14 Oct: "can you
// widen this menu so the RIGHT/LEFT scroll won't be needed") and the elevation
// re-fitted into the narrower space: E4's corner moved to 772, E2's to 550,
// the whole drawing shrank about 2%, and both tests went red saying "no break
// in the corner line" when the truth was THERE IS NO LINE AT THIS COLUMN. A
// probe aimed at bare canvas reads exactly like the bug it was written for,
// which is the worst way for a check to fail.
//
// So the column is searched for, within 80px of where it has historically
// been: the corner line is the one column in that stretch that is inked
// essentially all the way down. If the bug comes back the line breaks, no
// column scores low, and the search comes back with the break in its hand.
// Nothing here is tied to a pane width any more.
async function cornerLine(page, near, y0, y1) {
  return page.evaluate(({ near, y0, y1 }) => {
    const c = document.getElementById('plan');
    const r = c.getBoundingClientRect();
    const sx = c.width / r.width, sy = c.height / r.height;
    const g = c.getContext('2d');
    const lightAt = x => {
      const out = [];
      for (let y = y0; y <= y1; y++) {
        const v = g.getImageData(Math.round((x - r.left) * sx), Math.round((y - r.top) * sy), 1, 1).data[0];
        if (v >= 120) out.push(y);
      }
      return out;
    };
    let best = null;
    for (let x = near - 80; x <= near + 80; x++) {
      const light = lightAt(x);
      if (!best || light.length < best.light.length) best = { x, light };
    }
    return best;
  }, { near, y0, y1 });
}

// 410..462 CROSSES BOTH THE THINGS THE BUG ATE -- MAIN's floor package and the
// sill plate below it -- and stops short of the wall's foot, which the 2%
// re-fit moved. The one light row left inside it is the band's OWN bottom
// line, drawn light either side of the corner.
// RE-SEATED ON 23 Oct, when the elevations took a tenth of the drawing of
// sky above them (cut-view.js screenCushion, Movie: "about 10% extra
// cushion"): the drawing sits lower and smaller, the floor band's rows are
// 449..458 at this window, and its bottom line is the one light row at 429
// above it. Found by reading the column, as the note above says to.
const SPAN = [400, 459];

test('E4: the jog\'s corner line runs on through the floor band and the sill', async ({ page }) => {
  await openView(page, 'E4');
  const line = await cornerLine(page, 774, ...SPAN);
  expect(line.light.length,
    `the best column (x=${line.x}) breaks at ${line.light.join(', ') || 'nothing'}`)
    .toBeLessThanOrEqual(1);
});

test('E2: the same, and no stray stubs where two faces meet flush', async ({ page }) => {
  await openView(page, 'E2');
  const line = await cornerLine(page, 544, ...SPAN);
  expect(line.light.length,
    `the best column (x=${line.x}) breaks at ${line.light.join(', ') || 'nothing'}`)
    .toBeLessThanOrEqual(1);

  // Two wall pieces meeting in one plane in front of a deeper wall's end: the
  // band still hides that end.
  //
  // MEASURED OFF THE CORNER LINE, both ways. The stub would stand 87px to its
  // right, and MAIN's floor package is the seven rows immediately above the
  // band's own bottom line -- which is the single light row the search just
  // handed back. Two offsets instead of two more window-bound constants.
  expect(line.light.length, 'no band line to measure the floor package from').toBe(1);
  const floor = line.light[0];
  const band = await lightRows(page, line.x + 87, floor - 7, floor - 1);
  expect(band.length, 'nothing drawn across the floor band here').toBe(7);
});
