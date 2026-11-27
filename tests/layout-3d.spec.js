// THE 3D VIEW VIEWPORT ON CONSTRUCTION LAYOUT (jb, 27 Nov 2026: "i guess
// the user can put them in Construction plans too").
//
// + ADD VIEWPORT offers 3D VIEW; placed, it shows the house as the 3D viewer
// draws it (a frame on viewer/, view3d-host.js), double-click turns it, DONE
// keeps the camera on the viewport in the saved layout, and PRINT draws it
// sharp on the sheet.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BUCKET = 'model-drawing';
const PW = 17;
const PH = 11;
const FIT_MARGIN = 60;
const HOUSE = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-timberhouse-jog-fascia.draft'), 'utf8'));

function drawing(viewports = []) {
  return { ...HOUSE, layout: { paperKey: 'arch-b', orientation: 'landscape', auto: false,
    nextViewportId: viewports.length + 1, viewports } };
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
  await page.evaluate(async ({ bucket, saved }) => {
    const file = new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(file, bucket);
  }, { bucket: BUCKET, saved });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
}

const storedLayout = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await file.text()).layout;
}, BUCKET);

async function withLayoutSave(page, action) {
  const seq = await page.evaluate(() => Number(document.body.dataset.layoutSaveSeq || 0));
  await action();
  await page.waitForFunction(prev => Number(document.body.dataset.layoutSaveSeq || 0) > prev, seq);
}

async function sheetToClient(page, xIn, yIn) {
  const box = await page.locator('[data-layout-canvas]').boundingBox();
  const zoom = Math.min((box.width - FIT_MARGIN * 2) / PW, (box.height - FIT_MARGIN * 2) / PH);
  const panX = (box.width - PW * zoom) / 2, panY = (box.height - PH * zoom) / 2;
  return { x: box.x + panX + xIn * zoom, y: box.y + panY + yIn * zoom };
}

const frames = page => page.evaluate(() =>
  JSON.parse(document.querySelector('[data-layout-canvas]').getAttribute('data-layout-frames') || '[]'));
const pictures = page => page.evaluate(() => Number(document.body.dataset.view3dPictures || 0));

test('+ ADD VIEWPORT places a 3D VIEW that draws the house, with no scale under it', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await openLayout(page, drawing());
  await page.click('[data-layout-add-viewport]');
  await expect(page.locator('[data-add-pick="view3d"]')).toBeVisible();
  await page.click('[data-add-pick="view3d"]');
  const at = await sheetToClient(page, 7, 5);
  await withLayoutSave(page, () => page.mouse.click(at.x, at.y));
  // (An empty layout is dealt the default set first: the 3D VIEW joins it.)
  const f = (await frames(page)).find(fr => fr.kind === 'view3d');
  expect(f, 'a 3D VIEW window on the sheet').toBeTruthy();
  expect(f.wIn).toBeGreaterThan(1.9);
  expect(f.hIn / f.wIn).toBeCloseTo(0.75, 2);
  await page.waitForFunction(() => Number(document.body.dataset.view3dPictures || 0) > 0, null, { timeout: 30000 });
  // The house is in the window: the canvas there is not bare paper.
  const centre = await sheetToClient(page, f.xIn + f.wIn / 2, f.yIn + f.hIn / 2);
  const inked = await page.evaluate(({ x, y }) => {
    const canvas = document.querySelector('[data-layout-canvas]');
    const r = canvas.getBoundingClientRect();
    const k = canvas.width / r.width;
    const cx = Math.round((x - r.left) * k), cy = Math.round((y - r.top) * k), half = Math.round(30 * k);
    const d = canvas.getContext('2d').getImageData(cx - half, cy - half, half * 2, half * 2).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 200 || d[i + 1] < 200 || d[i + 2] < 200) n += 1;
    return n / (d.length / 4);
  }, centre);
  expect(inked, 'the house drawn in the window').toBeGreaterThan(0.1);
  const layout = await storedLayout(page);
  const mine = layout.viewports.filter(v => v.kind === 'view3d');
  expect(mine).toHaveLength(1);
  expect(mine[0]).toMatchObject({ pif: 1 });
  expect(mine[0].camera).toBeUndefined();
  expect(errors).toEqual([]);
});

test('double-click turns the 3D VIEW in place; DONE keeps the camera in the saved layout', async ({ page }) => {
  await openLayout(page, drawing([{ id: 1, kind: 'view3d', pif: 1, xIn: 8, yIn: 5, sheet: 1, frameW: 6, frameH: 4.5 }]));
  await page.waitForFunction(() => Number(document.body.dataset.view3dPictures || 0) > 0, null, { timeout: 30000 });
  const at = await sheetToClient(page, 8, 5);
  await page.mouse.dblclick(at.x, at.y);
  const frame = page.locator('[data-view3d-frame]');
  await expect(frame).toBeVisible();
  const inside = page.frameLocator('[data-view3d-frame]');
  await inside.locator('[data-preset="back"]').click();
  const before = await pictures(page);
  await withLayoutSave(page, () => inside.locator('#embed-done').click());
  await expect(frame).toBeHidden();
  const layout = await storedLayout(page);
  // BACK is 215 degrees round from the front; this house's front (E1) is
  // to the east, yaw 90.
  expect(layout.viewports[0].camera.yaw).toBe((90 + 215) % 360);
  // A new picture for the new camera.
  await page.waitForFunction(n => Number(document.body.dataset.view3dPictures || 0) > n, before, { timeout: 30000 });

  // The camera survives a reload, and RESET 3D VIEW on the right-click menu
  // takes it off.
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  expect((await storedLayout(page)).viewports[0].camera.yaw).toBe(305);
  await page.mouse.click(at.x, at.y, { button: 'right' });
  const reset = page.locator('[data-context-item="reset-3d"]');
  await expect(reset).toBeVisible();
  await withLayoutSave(page, () => reset.click());
  expect((await storedLayout(page)).viewports[0].camera).toBeUndefined();
});

test('PRINT draws the 3D VIEW on the sheet', async ({ page }) => {
  await openLayout(page, drawing([{ id: 1, kind: 'view3d', pif: 1, xIn: 8, yIn: 5, sheet: 1, frameW: 6, frameH: 4.5 }]));
  await page.waitForFunction(() => Number(document.body.dataset.view3dPictures || 0) > 0, null, { timeout: 30000 });
  await page.evaluate(() => {
    localStorage.setItem('draft-bone-wallet', JSON.stringify({ balance: 9, lastDripAt: Date.now(), createdAt: Date.now() }));
    window.dispatchEvent(new CustomEvent('draft-bones-changed'));
    window.__captured = null;
    // Read while the package is still held: done() lets its pictures go.
    window.__draftPrintCapture = async ({ doc, done }) => {
      const img = new Image();
      await new Promise(resolve => { img.onload = resolve; img.onerror = resolve; img.src = doc.querySelector('img').src; });
      const dpi = img.naturalWidth / 17;
      const c = document.createElement('canvas');
      c.width = Math.round(2 * dpi); c.height = Math.round(2 * dpi);
      const ctx = c.getContext('2d');
      ctx.drawImage(img, -Math.round(7 * dpi), -Math.round(4 * dpi));
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] < 200 || d[i + 1] < 200 || d[i + 2] < 200) n += 1;
      window.__captured = { share: n / (d.length / 4), dpi };
      done();
    };
  });
  await page.locator('#bone').click();
  await page.locator('[data-print-go]').click();
  await page.waitForFunction(() => window.__captured, null, { timeout: 60000 });
  // The window's middle on the printed sheet (300 dpi) is inked.
  const inked = await page.evaluate(() => window.__captured);
  expect(inked.dpi).toBeGreaterThan(250);
  expect(inked.share, 'the house printed in its window').toBeGreaterThan(0.1);
});
