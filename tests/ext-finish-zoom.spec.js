// ZOOM AND PAN ON EXT. FINISH.
//
// jb, 27 Nov 2026: "i have a hard time zooming in and out of the EXT FINISH.
// it seems it only wants to show the entire house, doesn't want to zoom to a
// smaller section of the house". The page had no wheel and no drag at all:
// every paint was the painter's own fit.
//
// THE CLAIMS:
//   THE WHEEL ZOOMS ABOUT THE CURSOR   the foot under the pointer stays put
//   A DRAG PANS, AND DOES NOT PICK     the frame moves by the drag, no pick
//   A PICK KEEPS THE ZOOM              clicking a wall leaves the frame alone
//   THE ZOOM IS KEPT PER ELEVATION     E2 opens fitted, E1 comes back zoomed
//   0 AND FIT BRING THE WHOLE HOUSE    the fit's scale again, FIT hidden
//   THE CANVAS IS NOT STRETCHED        backing store = the box it shows in
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const FIXTURE = path.join(__dirname, '..', 'proto', 'repro-garage-house.draft');
const REPRO = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));

async function openPage(page) {
  await h.suppressEntryCoach(page);
  await page.goto('/EXTFINISH.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
  await page.evaluate(async ({ bucket, drawing }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(drawing)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, drawing: REPRO });
  await page.goto('/EXTFINISH.html');
  await page.waitForFunction(() => !!window.__extFinishFrame, null, { timeout: 10000 });
}

const frameOf = page => page.evaluate(() => {
  const f = window.__extFinishFrame;
  return { x0: f.x0, y0: f.y0, pxPerFt: f.pxPerFt, uMin: f.uMin, yTop: f.yTop };
});
// The pointer in the canvas's own pixels, the ones the frame is in.
const toCanvas = async (page, x, y) => page.evaluate(([x, y]) => {
  const c = document.getElementById('elev'); const r = c.getBoundingClientRect();
  return { x: x * c.width / r.width, y: y * c.height / r.height };
}, [x, y]);
const feetAt = (f, x, y) => ({ u: f.uMin + (x - f.x0) / f.pxPerFt, e: f.yTop - (y - f.y0) / f.pxPerFt });

test('the wheel zooms in about the cursor, a drag pans without picking, 0 fits again',
  async ({ page }) => {
    await openPage(page);
    const box = await page.locator('#elev').boundingBox();
    const fit = await frameOf(page);
    await expect(page.locator('#elev-fit')).toBeHidden();

    // THE WHEEL, a third of the way in from the left.
    const sx = Math.round(box.width * 0.4), sy = Math.round(box.height * 0.5);
    await page.mouse.move(box.x + sx, box.y + sy);
    await page.mouse.wheel(0, -400);
    await page.waitForFunction(px => window.__extFinishFrame.pxPerFt > px * 1.5, fit.pxPerFt);
    const zoomed = await frameOf(page);
    const at = await toCanvas(page, sx, sy);
    const before = feetAt(fit, at.x, at.y), after = feetAt(zoomed, at.x, at.y);
    expect(Math.abs(after.u - before.u)).toBeLessThan(0.05);
    expect(Math.abs(after.e - before.e)).toBeLessThan(0.05);
    await expect(page.locator('#elev-fit')).toBeVisible();

    // A DRAG PANS by the drag and picks nothing.
    const note = await page.locator('#status').textContent();
    await page.mouse.move(box.x + sx, box.y + sy);
    await page.mouse.down();
    await page.mouse.move(box.x + sx + 60, box.y + sy + 30, { steps: 6 });
    await page.mouse.up();
    const panned = await frameOf(page);
    expect(panned.pxPerFt).toBeCloseTo(zoomed.pxPerFt, 6);
    const moved = await toCanvas(page, 60, 30);
    expect(Math.abs(panned.x0 - zoomed.x0 - moved.x)).toBeLessThan(1);
    expect(Math.abs(panned.y0 - zoomed.y0 - moved.y)).toBeLessThan(1);
    expect(await page.locator('#status').textContent()).toBe(note);

    // A PICK (a plain click) KEEPS THE ZOOM.
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    const afterPick = await frameOf(page);
    expect(afterPick).toEqual(panned);

    // ANOTHER ELEVATION OPENS FITTED; THE FIRST COMES BACK AS IT WAS LEFT.
    await page.locator('#elev-list [data-elev="E2"]').click();
    await expect(page.locator('#elev-fit')).toBeHidden();
    await page.locator('#elev-list [data-elev="E1"]').click();
    expect(await frameOf(page)).toEqual(panned);

    // 0 BRINGS THE WHOLE HOUSE BACK.
    await page.keyboard.press('0');
    expect(Math.abs((await frameOf(page)).pxPerFt / fit.pxPerFt - 1)).toBeLessThan(0.02);
    await expect(page.locator('#elev-fit')).toBeHidden();

    // AND SO DOES FIT.
    await page.mouse.move(box.x + sx, box.y + sy);
    await page.mouse.wheel(0, -400);
    await expect(page.locator('#elev-fit')).toBeVisible();
    await page.locator('#elev-fit').click();
    expect(Math.abs((await frameOf(page)).pxPerFt / fit.pxPerFt - 1)).toBeLessThan(0.02);
  });

test('zooming out stops at half the fit', async ({ page }) => {
  await openPage(page);
  const box = await page.locator('#elev').boundingBox();
  const fit = await frameOf(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 6; i += 1) await page.mouse.wheel(0, 600);
  await page.waitForTimeout(100);
  expect((await frameOf(page)).pxPerFt).toBeCloseTo(fit.pxPerFt * 0.5, 4);
});

test('the canvas is drawn at the size it is shown, so the house is not stretched', async ({ page }) => {
  await openPage(page);
  const m = await page.evaluate(() => {
    const c = document.getElementById('elev');
    return { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight };
  });
  expect(Math.abs(m.w - m.cw)).toBeLessThanOrEqual(1);
  expect(Math.abs(m.h - m.ch)).toBeLessThanOrEqual(1);
});
