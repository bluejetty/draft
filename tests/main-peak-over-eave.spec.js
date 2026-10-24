// THE MAIN ROOF'S PEAK IN FRONT OF THE 2ND FLOOR ROOF'S EAVE.
//
// Movie, 5 Oct, on E3 of his MOD BILEVEL (proto/repro-movie-modbilevel-e3-peak
// is that drawing): "the top peak of the roof should extend up above the eave
// of the 2nd floor roof (main fl roof peak it is in front)". The main roof's
// hip end rises to about 1 1/2" above the bottom of the upper roof's fascia,
// and it is nearer. The fascia's heavy bottom line was drawn the full length
// of the eave anyway, straight across the peak. Now the line stops where the
// peak stands in front of it, and carries on either side.
//
// Read off the painted canvas, at the fixed viewport, in DAY.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-movie-modbilevel-e3-peak.draft'), 'utf8'));

async function openE3(page) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, saved }) => {
    const f = new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(f, bucket);
  }, { bucket: h.STORAGE_BUCKET, saved: REPRO });
  await page.goto('/MODEL.html?theme=rough&mode=day&pane=previews&right=1&level=7&lpane=build&left=1&view=cut%3AE3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(1500);
}

// The dark rows down one screen column, rows y0..y1, off the drawing canvas.
const darkRows = (page, x, y0, y1) => page.evaluate(({ x, y0, y1 }) => {
  const c = document.getElementById('plan');
  const r = c.getBoundingClientRect();
  const sx = c.width / r.width, sy = c.height / r.height;
  const g = c.getContext('2d');
  const out = [];
  for (let y = y0; y < y1; y++) {
    const v = g.getImageData(Math.round((x - r.left) * sx), Math.round((y - r.top) * sy), 1, 1).data[0];
    if (v < 120) out.push(y);
  }
  return out;
}, { x, y0, y1 });

// IN FEET THROUGH THE FRAME, since 23 Oct. This read rows 274-275 and
// columns 700..770 at the fixed viewport, which was true of one fit; the
// elevations then took the painter's cushion (a tenth of air each side and
// sky above, Movie: "about 10% extra cushion") and every pixel moved. MODEL
// hands the frame it painted with to `window.__elevFrame`, so the fascia's
// bottom line is named by its elevation and the peak by its place along the
// view, and the rows and columns are worked out from those each time.
const FOOT_E = 15.37;   // the upper roof's fascia bottom, feet
const PEAK_U = 0;       // the main roof's peak along E3, feet
const frameOf = page => page.evaluate(() => {
  const f = window.__elevFrame;
  const c = document.getElementById('plan');
  const r = c.getBoundingClientRect();
  return { ...f, left: r.left, top: r.top };
});

test('E3: the main roof peak stands in front of the upper eave, not behind its fascia line', async ({ page }) => {
  await openE3(page);
  const f = await frameOf(page);
  const X = u => Math.round(f.left + f.x0 + (u - f.uMin) * f.pxPerFt);
  const Y = e => Math.round(f.top + f.y0 + (f.yTop - e) * f.pxPerFt);
  // The band of rows round the fascia's bottom line, and the line itself:
  // the rows dark in BOTH columns 2.3 ft either side of the peak.
  const y0 = Y(FOOT_E + 0.35), y1 = Y(FOOT_E - 0.35);
  const left = await darkRows(page, X(PEAK_U - 2.3), y0, y1);
  const right = await darkRows(page, X(PEAK_U + 2.3), y0, y1);
  const foot = left.filter(y => right.includes(y));
  expect(foot.length, `the fascia line either side of the peak: ${left} / ${right}`).toBeGreaterThanOrEqual(1);
  for (const u of [PEAK_U - 0.2, PEAK_U, PEAK_U + 0.2]) {
    const over = await darkRows(page, X(u), Y(FOOT_E + 1.2), y1);
    expect(foot.some(y => over.includes(y)), `over the peak at u ${u}: ${over}`).toBe(false);
    // And the peak itself is drawn there, above where the line was.
    expect(over.some(y => y > Y(FOOT_E + 0.9) && y < Math.min(...foot)),
      `the peak's own lines at u ${u}: ${over}`).toBe(true);
  }
});
