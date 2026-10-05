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

test('E3: the main roof peak stands in front of the upper eave, not behind its fascia line', async ({ page }) => {
  await openE3(page);
  // The fascia's bottom line runs at rows 274-275 at this viewport. x 700 and
  // 770 are either side of the main roof's peak, x 734 is the peak itself.
  const FOOT = [274, 275];
  const beside = [...await darkRows(page, 700, 262, 280), ...await darkRows(page, 770, 262, 280)];
  expect(FOOT.every(y => beside.includes(y)), `either side of the peak: ${beside}`).toBe(true);
  for (const x of [730, 734, 738]) {
    const over = await darkRows(page, x, 262, 280);
    expect(FOOT.some(y => over.includes(y)), `over the peak at x ${x}: ${over}`).toBe(false);
    // And the peak itself is drawn there, above where the line was.
    expect(over.some(y => y > 267 && y < 274), `the peak's own lines at x ${x}: ${over}`).toBe(true);
  }
});
