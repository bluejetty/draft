// THE LETTERING ON A SHEET IS AT ITS PRINTED SIZE, AT EVERY ZOOM.
//
// Movie, 16 Oct, looking at a CONSTRUCTION LAYOUT sheet: "i notice the text
// sizes on the title of the viewport and the elvation within the viewports
// changes when i zoom in and out, can you put it at the exact size that it
// will PRINT when the layout is PRINTED so the user can adjust it if they
// need too".
//
// THE SIZE WAS ALREADY IN PAPER INCHES. `zoom` is pixels per inch of paper and
// the caption was `Math.max(9, zoom * 0.14)` -- it was the FLOOR that broke
// it. Nine pixels bites below about 64 px/inch, which is roughly where a whole
// 11x17 sheet sits fitted to the window, so at the zoom he actually works at
// the caption had stopped shrinking with the sheet; zoom past that and it
// started scaling again.
//
// SO THE CHECK IS A RATIO, NOT A SIZE. Lettering at its printed size is
// lettering that grows exactly as fast as the sheet does: double the zoom and
// every letter doubles. A single measurement cannot tell a true preview from a
// floored one -- two at different zooms can, and the floor is exactly what
// makes the ratio come out wrong.
//
// MEASURED OFF THE CANVAS. The page could publish the font string it used and
// a check could read it back, but that is the painter grading its own work: a
// floor applied after the number is published would pass. The ink is what the
// drafter sees.
// THE GAP UNDER THE BOX MOVED WITH THE SIZE -- it was a flat 4 px and is now
// 4 px of PAPER -- and there is NO CHECK ON IT HERE, deliberately. The band
// this file measures starts a pixel under the viewport frame, and the frame is
// drawn at a quarter opacity in the same ink as the lettering: every way of
// measuring the gap that I tried was really measuring the frame. A check that
// reads 0 whatever the code does is worse than none, so the gap is argued for
// in LAYOUT.html and left unpinned rather than counted as covered.
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';
const PW = 17;
const PH = 11;
const FIT_MARGIN = 60;
// The caption's size in inches of paper, which is what LAYOUT.html now writes
// it at -- 0.14in is 10pt, the size it has always PRINTED at.
const TITLE_IN = 0.14;

const point = (x, z) => ({ x, y: 0, z });

function houseDrawing() {
  const wall = (id, sx, sz, ex, ez) => ({
    id, start: point(sx, sz), end: point(ex, ez),
    levelId: 1, view: 'plan', wallType: 'stud_2x6',
    baseHeight: 0, topHeight: 8, refLine: 'left',
  });
  return {
    version: 1,
    levels: [{ id: 0, name: 'FOUNDATION', elev: -8 }, { id: 1, name: 'MAIN FL', elev: 0 }],
    walls: [wall(1, 0, 0, 24, 0), wall(2, 24, 0, 24, 16),
      wall(3, 24, 16, 0, 16), wall(4, 0, 16, 0, 0)],
    fenestrations: [{ id: 1, levelId: 1, wallId: 1, type: 'door', offset: 6, width: 3 }],
    // ONE VIEWPORT ALREADY ON SHEET 2, SO SHEET 1 STAYS BLANK FOR THE PRESS
    // BELOW. Since 17 Oct a layout with nothing on it over a house is dealt
    // on entry (Movie: "if its blank and there is a house in the model space,
    // make a DEAL" -- layout-deal-on-entry.spec.js); a sheet with a hand on it
    // is left as saved, which is the ground these mechanics stand on.
    layout: {
      auto: false, nextViewportId: 2, sheets: [{ title: '' }, { title: '' }],
      viewports: [{ id: 1, kind: 'plan', levelId: 1, pif: 0.25, xIn: 8, yIn: 5, sheet: 2 }],
    },
  };
}

async function openLayout(page, drawing = null) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('draft-test-storage-cleared')) return;
    sessionStorage.setItem('draft-test-storage-cleared', '1');
    indexedDB.deleteDatabase('pdf-img-mgr-shared');
    localStorage.clear();
  });
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  if (drawing) {
    await page.evaluate(async ({ bucket, saved }) => {
      const file = new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' });
      await window.SharedFileStore.saveSharedFile(file, bucket);
    }, { bucket: BUCKET, saved: drawing });
    await page.reload();
    await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  }
}

const savedDrawing = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return file ? JSON.parse(await file.text()) : null;
}, BUCKET);

// The sheet transform the paint actually used, published by _draw.
const view = async page => {
  const [zoom, panX, panY] = (await page.evaluate(
    () => document.body.dataset.layoutView || '')).split(',').map(Number);
  return { zoom, panX, panY };
};

async function placeViewport(page, xIn, yIn) {
  const seq = await page.evaluate(() => Number(document.body.dataset.layoutSaveSeq || 0));
  await page.locator('[data-layout-add-viewport]').click();
  const box = await page.locator('[data-layout-canvas]').boundingBox();
  const zoom = Math.min((box.width - FIT_MARGIN * 2) / PW, (box.height - FIT_MARGIN * 2) / PH);
  const panX = (box.width - PW * zoom) / 2;
  const panY = (box.height - PH * zoom) / 2;
  await page.mouse.click(box.x + panX + xIn * zoom, box.y + panY + yIn * zoom);
  await page.waitForFunction(prev =>
    Number(document.body.dataset.layoutSaveSeq || 0) > prev, seq);
}

// THE HEIGHT OF THE CAPTION'S INK, in canvas pixels, read out of the band
// under a viewport. Dark pixels only: the sheet is white and the frame around
// the viewport is a quarter-opacity grey, so a threshold well under the
// caption's own ink picks out lettering and nothing else.
const captionHeight = (page, band) => page.locator('[data-layout-canvas]')
  .evaluate((canvas, b) => {
    const dpr = window.devicePixelRatio || 1;
    const x0 = Math.max(0, Math.round(b.x * dpr));
    const y0 = Math.max(0, Math.round(b.y * dpr));
    const w = Math.min(canvas.width - x0, Math.round(b.w * dpr));
    const h = Math.min(canvas.height - y0, Math.round(b.h * dpr));
    if (w <= 0 || h <= 0) return null;
    const px = canvas.getContext('2d').getImageData(x0, y0, w, h).data;
    let top = Infinity, bottom = -Infinity, ink = 0;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4;
        const dark = px[i + 3] > 40 && (px[i] + px[i + 1] + px[i + 2]) / 3 < 170;
        if (!dark) continue;
        ink += 1;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
    return ink ? { h: (bottom - top + 1) / dpr, top: top / dpr, ink } : null;
  }, band);

// Where the caption sits: centred under the viewport's paper rectangle. Taken
// from the saved viewport and the transform the paint published, so it follows
// the sheet wherever a zoom puts it.
const captionBand = (r, v) => ({
  x: v.panX + r.xIn * v.zoom - 20,
  y: v.panY + (r.yIn + r.hIn) * v.zoom + 1,
  w: r.wIn * v.zoom + 40,
  h: Math.max(14, v.zoom * 0.5),
});

// The viewport's box on the paper, as the paint worked it out: computed from
// the plan's extents and the scale, never stored, so it is published rather
// than rebuilt here out of numbers this file would have to keep in step.
const rects = async page => JSON.parse(
  await page.evaluate(() => document.body.dataset.layoutRects || '[]'));

test('the viewport caption grows exactly as fast as the sheet', async ({ page }) => {
  await openLayout(page, houseDrawing());
  await placeViewport(page, 8, 5);
  const saved = await savedDrawing(page);
  const vp = saved.layout.viewports.at(-1);
  expect(vp, 'a viewport to caption').toBeTruthy();

  const box = await page.locator('[data-layout-canvas]').boundingBox();
  const fitted = await view(page);
  const [rect] = await rects(page);
  expect(rect, 'the paint published where the box landed').toBeTruthy();
  const before = await captionHeight(page, captionBand(rect, fitted));
  expect(before, 'the caption was drawn at the fitted zoom').toBeTruthy();

  // ZOOM IN THE WAY A DRAFTER DOES. The wheel is the only zoom this page
  // offers, and it zooms toward the pointer, which is why the band is
  // recomputed from the transform afterwards rather than guessed.
  for (let i = 0; i < 6; i += 1) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -200);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(150);
  const zoomed = await view(page);
  expect(zoomed.zoom, 'the wheel zoomed in').toBeGreaterThan(fitted.zoom * 1.3);

  const [rect2] = await rects(page);
  const after = await captionHeight(page, captionBand(rect2, zoomed));
  expect(after, 'the caption is still drawn').toBeTruthy();

  // THE WHOLE RULE IN ONE NUMBER. Lettering at its printed size grows with
  // the paper: the ink is that many times taller because the sheet is that
  // many times bigger. A floor would hold the first measurement up and make
  // this ratio come out short.
  const grew = after.h / before.h;
  const sheetGrew = zoomed.zoom / fitted.zoom;
  expect(grew, `caption ${before.h}px -> ${after.h}px while the sheet grew ${sheetGrew.toFixed(2)}x`)
    .toBeGreaterThan(sheetGrew * 0.8);
  expect(grew).toBeLessThan(sheetGrew * 1.25);
});

test('and it is drawn at the size it will print', async ({ page }) => {
  await openLayout(page, houseDrawing());
  await placeViewport(page, 8, 5);
  const v = await view(page);
  const [rect] = await rects(page);
  expect(rect, 'a viewport to caption').toBeTruthy();
  const got = await captionHeight(page, captionBand(rect, v));
  expect(got, 'the caption was drawn').toBeTruthy();

  // 0.14in of paper at `zoom` pixels to the inch. A font's em box is taller
  // than the ink inside it -- capitals and digits in this face measure about
  // two thirds of the size -- so the claim is a band around that, not an
  // equality. What it rules out is the thing he reported: a caption held at a
  // floor, which at the fitted zoom is more than half as big again.
  const em = v.zoom * TITLE_IN;
  expect(got.h, `ink ${got.h.toFixed(1)}px against an em of ${em.toFixed(1)}px`)
    .toBeGreaterThan(em * 0.5);
  expect(got.h).toBeLessThan(em * 1.1);
});
