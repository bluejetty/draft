// Checklist 15: is a 1/4" = 1'-0" viewport actually 1/4" = 1'-0" on the sheet?
// Measured in sheet inches, on the LAYOUT canvas, today.
const { test, expect } = require('@playwright/test');
const h = require('../tests/helpers.js');

test('P5: viewport scale vs true paper inches', async ({ page, context }) => {
  await h.openModel(page);
  // A house whose outside face dimensions are known: 36'-0" x 24'-0" outline.
  await h.selectTool(page, 'Outline');
  for (const [x, z] of [[-18, -12], [18, -12], [18, 12], [-18, 12], [-18, -12]]) await h.clickWorld(page, x, z);
  await h.climbTourToMain(page);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  const drawing = await h.savedDrawing(page);
  const main = drawing.levels.find(l => l.name === 'MAIN FL').id;
  const walls = drawing.walls.filter(w => w.levelId === main);
  const xs = walls.flatMap(w => [w.start.x, w.end.x]);
  const zs = walls.flatMap(w => [w.start.z, w.end.z]);
  const refW = Math.max(...xs) - Math.min(...xs);
  const refH = Math.max(...zs) - Math.min(...zs);
  console.log(`model reference-line footprint: ${refW.toFixed(4)} ft x ${refH.toFixed(4)} ft`);

  const layout = await context.newPage();
  await layout.goto('/LAYOUT.dc.html');
  await layout.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await layout.getByRole('button', { name: /1\/4" = 1'-0"/ }).click();
  await layout.getByRole('button', { name: /ADD VIEWPORT/i }).click();
  const canvas = layout.locator('canvas').first();
  const box = await canvas.boundingBox();
  await layout.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.45);
  await layout.waitForTimeout(600);

  const geom = await layout.evaluate(() => {
    // Read the component's own numbers off the DOM-independent globals the
    // page exposes: paper size + zoom are the only bridge to paper inches.
    const c = document.querySelector('canvas');
    return { w: c.width, h: c.height, cssW: c.getBoundingClientRect().width };
  });
  // The sheet outline is drawn at pw*zoom px; recover px-per-paper-inch by
  // measuring the white sheet rectangle in the pixel buffer.
  const sheet = await layout.evaluate(() => {
    const c = document.querySelector('canvas');
    const ctx = c.getContext('2d');
    const row = ctx.getImageData(0, Math.floor(c.height / 2), c.width, 1).data;
    let first = -1, last = -1;
    for (let x = 0; x < c.width; x++) {
      const i = x * 4;
      const white = row[i] > 250 && row[i + 1] > 250 && row[i + 2] > 250;
      if (white) { if (first < 0) first = x; last = x; }
    }
    return { first, last, width: c.width };
  });
  const sheetPx = sheet.last - sheet.first + 1;
  const pxPerPaperInch = sheetPx / 17; // landscape 11x17 => 17" wide
  console.log(`sheet spans ${sheetPx} device px => ${pxPerPaperInch.toFixed(3)} px per paper inch`);

  // Plan ink only: find the white sheet box, inset past the drawn border
  // frame, then take the black-pixel bounding box of what is left.
  const measure = ({ first, last }) => {
    const c = document.querySelector('canvas');
    const ctx = c.getContext('2d');
    const col = ctx.getImageData(Math.floor((first + last) / 2), 0, 1, c.height).data;
    let top = -1, bot = -1;
    for (let y = 0; y < c.height; y++) {
      const i = y * 4;
      if (col[i] > 250 && col[i + 1] > 250 && col[i + 2] > 250) { if (top < 0) top = y; bot = y; }
    }
    const pad = Math.round((last - first + 1) / 17 * 0.9); // 0.9 paper inch inset
    const ppi = (last - first + 1) / 17;
    // Exclude the titleblock strip (1.15") on the right and its label band.
    const x0 = first + pad, x1 = last - pad - Math.round(1.35 * ppi), y0 = top + pad, y1 = bot - pad;
    const img = ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
    let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        const i = (y * img.width + x) * 4;
        if (img.data[i] < 90 && img.data[i + 1] < 90 && img.data[i + 2] < 90) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    return { w: maxX - minX + 1, h: maxY - minY + 1 };
  };
  const ink = await layout.evaluate(measure, sheet);
  console.log('plan ink bbox px:', JSON.stringify(ink));
  const wIn = ink.w / pxPerPaperInch, hIn = ink.h / pxPerPaperInch;
  console.log(`plan ink measures ${wIn.toFixed(4)} x ${hIn.toFixed(4)} paper inches`);
  console.log(`=> ${(wIn * 4).toFixed(3)} ft x ${(hIn * 4).toFixed(3)} ft at 1/4"=1'-0"`);
  console.log(`reference-line footprint at 1/4" should measure exactly ${(refW / 4).toFixed(4)} x ${(refH / 4).toFixed(4)} paper inches`);

  // Same viewport at 1/8": a correct scale halves every measured length.
  await layout.getByRole('button', { name: /1\/8" = 1'-0"/ }).click();
  await layout.waitForTimeout(600);
  const ink2 = await layout.evaluate(measure, sheet);
  const w2 = ink2.w / pxPerPaperInch, h2 = ink2.h / pxPerPaperInch;
  console.log(`at 1/8": ${w2.toFixed(4)} x ${h2.toFixed(4)} paper inches  (ratio ${(wIn / w2).toFixed(4)} / ${(hIn / h2).toFixed(4)}, expected 2.0000)`);
});
