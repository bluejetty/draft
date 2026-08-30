const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const CUT_RED = [176, 64, 96];

async function drawOutlineRect(page) {
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await h.clickWorld(page, -8, -6);
  await page.waitForTimeout(300);
}

async function buildHouse(page) {
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(300);
}

// The outermost dimension endpoints on the south and east sides — the lines
// the standard elevation marks measure their 2' clearance from (board #263).
async function dimEdges(page) {
  const saved = await h.savedDrawing(page);
  return {
    south: Math.max(...saved.dimensions.flatMap(d => [d.start.z, d.end.z])),
    east: Math.max(...saved.dimensions.flatMap(d => [d.start.x, d.end.x])),
  };
}

// Press-drag-release with synthetic pointer events, matching the canvas
// listeners the way helpers.clickWorld does: hover + down on the canvas,
// moves and up on the window (the app listens globally while dragging).
async function dragWorld(page, from, to) {
  const a = await h.worldToClient(page, from.x, from.z);
  const b = await h.worldToClient(page, to.x, to.z);
  await page.evaluate(({ a, b }) => {
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    const canvas = document.querySelector('[data-model-canvas]');
    const opts = {
      bubbles: true, cancelable: true, view: window,
      button: 0, pointerId: 1, isPrimary: true,
    };
    canvas.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: a.x, clientY: a.y, buttons: 0 }));
    canvas.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientX: a.x, clientY: a.y, buttons: 1 }));
    const steps = 8;
    for (let i = 1; i <= steps; i++) {
      const x = a.x + (b.x - a.x) * i / steps, y = a.y + (b.y - a.y) * i / steps;
      window.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: x, clientY: y, buttons: 1 }));
    }
    window.dispatchEvent(new PointerEvent('pointerup', { ...opts, clientX: b.x, clientY: b.y, buttons: 0 }));
  }, { a, b });
  await page.waitForTimeout(400);
}

async function redAt(page, x, z, radius = 8) {
  const p = await h.worldToClient(page, x, z);
  const pixels = await h.overlayPixels(page, p.x, p.y, radius);
  return h.countColor(pixels, CUT_RED);
}

test.describe('E-mark grab handles (board #263)', () => {
  test('the handle slides E1 along its own axis only, and the clearance survives a reload', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await drawOutlineRect(page);
    await buildHouse(page);
    await h.waitForSaved(page);
    const { south } = await dimEdges(page);

    // The mark starts 2' outside the outermost south dimension string.
    expect(await redAt(page, 0, south + 2)).toBeGreaterThan(0);

    // Under SELECT the handle sits at the line's midpoint. A diagonal drag
    // must move the mark along z only — the sideways pull is ignored.
    await h.selectTool(page, 'Select');
    await page.waitForTimeout(300);
    await dragWorld(page, { x: 0, z: south + 2 }, { x: 4, z: south + 5 });
    await h.waitForSaved(page);

    expect(await redAt(page, 0, south + 5)).toBeGreaterThan(0);
    expect(await redAt(page, 0, south + 2, 4)).toBe(0);

    const saved = await h.savedDrawing(page);
    expect(Math.abs(saved.elevationMarkOffsets.E1 - 5)).toBeLessThan(0.3);

    // The dragged clearance rides the drawing through a reload.
    await page.reload();
    await h.waitForModelReady(page);
    expect(await redAt(page, 0, south + 5)).toBeGreaterThan(0);
    expect(await redAt(page, 0, south + 2, 4)).toBe(0);
  });

  test('E4 slides on the x axis; an inward drag stops at the minimum clearance', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await drawOutlineRect(page);
    await buildHouse(page);
    await h.waitForSaved(page);
    const { east, south } = await dimEdges(page);

    await h.selectTool(page, 'Select');
    await page.waitForTimeout(300);

    // E4's handle rides the vertical line right of the plan — drag it out.
    await dragWorld(page, { x: east + 2, z: 0 }, { x: east + 6, z: 0 });
    await h.waitForSaved(page);
    expect(await redAt(page, east + 6, 0)).toBeGreaterThan(0);
    let saved = await h.savedDrawing(page);
    expect(Math.abs(saved.elevationMarkOffsets.E4 - 6)).toBeLessThan(0.3);

    // Dragging E1 inward through the dimension strings clamps at 6" out —
    // the mark never crosses onto the plan.
    await dragWorld(page, { x: 0, z: south + 2 }, { x: 0, z: south - 6 });
    await h.waitForSaved(page);
    saved = await h.savedDrawing(page);
    expect(saved.elevationMarkOffsets.E1).toBe(0.5);
    expect(await redAt(page, 0, south + 0.5, 4)).toBeGreaterThan(0);
  });
});
