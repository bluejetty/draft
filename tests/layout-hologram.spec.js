// HOLOGRAM ON THE LAYOUT SHEETS (hologram PR 4).
//
// Movie, 8 Oct, on where a hologram shows: "all locations". On a sheet it is
// the existing house in light blue under the new work, what comes out of it
// dashed, and each plan viewport chooses which of EXISTING, DEMO and NEW it
// shows -- so one drawing deals an existing plan, a demo plan and a new plan.
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';
const point = (x, z) => ({ x, y: 0, z });
const wall = (id, sx, sz, ex, ez) => ({
  id, start: point(sx, sz), end: point(ex, ez), levelId: 1, view: 'plan',
  wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
});
const LEVELS = [{ id: 0, name: 'FOUNDATION', elev: -8 }, { id: 1, name: 'MAIN FL', elev: 0 }];
// The addition (this drawing's own) beside the existing house (the hologram),
// one existing wall marked DEMO.
function drawing() {
  return {
    version: 1,
    levels: LEVELS,
    walls: [wall('n1', 0, 0, 16, 0), wall('n2', 16, 0, 16, 16), wall('n3', 16, 16, 0, 16), wall('n4', 0, 16, 0, 0)],
    holograms: [{
      id: 'hologram-1', name: 'existing', x: 0, z: 0, angleDeg: 0, pivotX: 0, pivotZ: 0,
      demo: { walls: ['e2'] },
      source: { version: 1, levels: LEVELS,
        walls: [wall('e1', 16, 0, 40, 0), wall('e2', 40, 0, 40, 16), wall('e3', 40, 16, 16, 16), wall('e4', 16, 16, 16, 0)] },
    }],
  };
}

async function openLayout(page, saved) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('draft-test-storage-cleared')) return;
    sessionStorage.setItem('draft-test-storage-cleared', '1');
    indexedDB.deleteDatabase('pdf-img-mgr-shared');
    localStorage.clear();
  });
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.evaluate(async ({ bucket, s }) => {
    const file = new File([JSON.stringify(s)], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(file, bucket);
  }, { bucket: BUCKET, s: saved });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
}
const savedDrawing = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return file ? JSON.parse(await file.text()) : null;
}, BUCKET);
async function withLayoutSave(page, action) {
  const seq = await page.evaluate(() => Number(document.body.dataset.layoutSaveSeq || 0));
  await action();
  await page.waitForFunction(prev => Number(document.body.dataset.layoutSaveSeq || 0) > prev, seq);
}
// The sheet transform, rebuilt the way layout-viewport-window.spec.js does.
async function sheetToClient(page, xIn, yIn) {
  const box = await page.locator('[data-layout-canvas]').boundingBox();
  const zoom = Math.min((box.width - 120) / 17, (box.height - 120) / 11);
  return { x: box.x + (box.width - 17 * zoom) / 2 + xIn * zoom, y: box.y + (box.height - 11 * zoom) / 2 + yIn * zoom };
}
const clickSheet = async (page, xIn, yIn) => {
  const p = await sheetToClient(page, xIn, yIn);
  await page.mouse.click(p.x, p.y);
};
// Blue (the hologram) and black (this drawing's own ink) inside the first
// viewport's window -- not the desk round the sheet, and clear of the frame,
// which is blue while the viewport is selected.
const ink = page => page.evaluate(() => {
  const app = globalThis.eval('page');
  const c = document.querySelector('[data-layout-canvas]');
  const k = c.width / c.getBoundingClientRect().width;
  const { zoom, panX, panY } = app.state;
  const r = app._viewportRectIn(app.state.viewports[0]);
  const x0 = Math.round((panX + r.xIn * zoom) * k) + 4, y0 = Math.round((panY + r.yIn * zoom) * k) + 4;
  const w = Math.round(r.wIn * zoom * k) - 8, h = Math.round(r.hIn * zoom * k) - 8;
  const d = c.getContext('2d').getImageData(x0, y0, w, h).data;
  let blue = 0, black = 0;
  for (let i = 0; i < d.length; i += 4) {
    // Blue: the hologram's lines, and its pale faces on white paper.
    if (d[i + 2] > 150 && d[i + 2] - d[i] > 25) blue += 1;
    if (d[i] < 90 && d[i + 1] < 90 && d[i + 2] < 90 && d[i + 3] > 200) black += 1;
  }
  return { blue, black };
});

async function placed(page) {
  await openLayout(page, drawing());
  await page.locator('[data-layout-add-viewport]').click();
  await withLayoutSave(page, () => clickSheet(page, 8.5, 5.5));
  await clickSheet(page, 8.5, 5.5);
}

test('a plan viewport draws the hologram in blue under the sheet\'s own work', async ({ page }) => {
  await placed(page);
  const both = await ink(page);
  expect(both.blue).toBeGreaterThan(300);
  expect(both.black).toBeGreaterThan(300);
  // The frame takes in the existing house: the viewport is wider than the
  // 16 ft addition alone would make it.
  const wide = await page.evaluate(() => {
    const app = globalThis.eval('page');
    const b = app._planBounds(1);
    return b.maxX - b.minX;
  });
  expect(wide).toBeGreaterThan(39);
});

test('EXISTING, DEMO and NEW switch per viewport, and the sheet keeps the choice', async ({ page }) => {
  await placed(page);
  const section = page.locator('[data-hologram-section]');
  await expect(section).toBeVisible();
  const pick = key => page.locator(`[data-layout-hologram="${key}"]`);
  for (const key of ['existing', 'demo', 'new']) await expect(pick(key)).toHaveClass(/\bon\b/);
  const all = await ink(page);

  await withLayoutSave(page, () => pick('new').click());
  await expect(pick('new')).not.toHaveClass(/\bon\b/);
  const existingOnly = await ink(page);
  expect(existingOnly.black).toBeLessThan(all.black * 0.3);
  expect(existingOnly.blue).toBeGreaterThan(all.blue * 0.8);

  await withLayoutSave(page, () => pick('existing').click());
  const demoOnly = await ink(page);
  expect(demoOnly.blue).toBeGreaterThan(10);
  expect(demoOnly.blue).toBeLessThan(existingOnly.blue * 0.5);

  const saved = await savedDrawing(page);
  expect(saved.layout.viewports[0].hologram).toEqual({ existing: false, new: false });
  // Opened again, the sheet is the demo plan it was left as.
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  const again = await ink(page);
  expect(Math.abs(again.blue - demoOnly.blue)).toBeLessThan(demoOnly.blue * 0.2 + 20);
});

test('no hologram, no section', async ({ page }) => {
  const plain = drawing();
  delete plain.holograms;
  await openLayout(page, plain);
  await page.locator('[data-layout-add-viewport]').click();
  await withLayoutSave(page, () => clickSheet(page, 8.5, 5.5));
  await clickSheet(page, 8.5, 5.5);
  await expect(page.locator('[data-hologram-section]')).toBeHidden();
  expect((await ink(page)).blue).toBeLessThan(50);
});

// ── ELEVATION VIEWPORTS (hologram PR 5) ─────────────────────────────────────
// An elevation wants the whole level stack the Model Space writes.
const STACK = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
  { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
const onMain = list => list.map(item => ({ ...item, levelId: 3 }));
test('an elevation viewport shows the existing house, and its switches are its own', async ({ page }) => {
  const saved = drawing();
  saved.levels = STACK;
  saved.walls = onMain(saved.walls);
  saved.holograms[0].source = { ...saved.holograms[0].source, levels: STACK,
    walls: onMain(saved.holograms[0].source.walls) };
  saved.layout = { paperKey: '11x17', orientation: 'landscape', auto: false, nextViewportId: 2,
    viewports: [{ id: 1, kind: 'elevation', elevId: 'E1', pif: 0.25, xIn: 8.5, yIn: 5.5, sheet: 1 }] };
  await openLayout(page, saved);
  const on = await ink(page);
  expect(on.blue).toBeGreaterThan(300);
  await clickSheet(page, 8.5, 5.5);
  await expect(page.locator('[data-hologram-section]')).toBeVisible();
  await withLayoutSave(page, () => page.locator('[data-layout-hologram="existing"]').click());
  await withLayoutSave(page, () => page.locator('[data-layout-hologram="demo"]').click());
  expect((await ink(page)).blue).toBeLessThan(on.blue * 0.3);
  expect((await savedDrawing(page)).layout.viewports[0].hologram).toEqual({ existing: false, demo: false });
});
