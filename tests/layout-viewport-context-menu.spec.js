// THE RIGHT-CLICK MENU ON A VIEWPORT (jb, 10 Nov): "can we add more
// 'commands' onto the right click on viewport menu?" -- the menu he had was
// the browser's own. Now a right click over a viewport selects it and brings
// up the app's commands, and over bare paper PASTE and ADD VIEWPORT. SHOW
// LAYERS, his own idea ("sometimes i'd like to turn off a 'layer' ... for
// that specific viewport"), writes the viewport's `layersOff` list, which the
// sheet painter already honours for a hologram -- so print, PDF and DXF
// follow it for free.
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';
const PW = 17;
const PH = 11;
const FIT_MARGIN = 60;

const point = (x, z) => ({ x, y: 0, z });

function houseDrawing() {
  const wall = (id, sx, sz, ex, ez) => ({
    id, start: point(sx, sz), end: point(ex, ez), levelId: 1, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
  });
  return {
    version: 1,
    levels: [{ id: 0, name: 'FOUNDATION', elev: -8 }, { id: 1, name: 'MAIN FL', elev: 0 }],
    walls: [wall(1, 0, 0, 24, 0), wall(2, 24, 0, 24, 16), wall(3, 24, 16, 0, 16), wall(4, 0, 16, 0, 0)],
    fenestrations: [{ id: 1, levelId: 1, wallId: 1, type: 'door', offset: 6, width: 3 }],
    layout: {
      auto: false, nextViewportId: 3, sheets: [{ title: '' }],
      viewports: [
        { id: 1, kind: 'plan', levelId: 1, pif: 0.25, xIn: 6, yIn: 5, sheet: 1 },
        { id: 2, kind: 'plan', levelId: 1, pif: 0.25, xIn: 13, yIn: 5, sheet: 1 },
      ],
    },
  };
}

async function openLayout(page, drawing) {
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
  }, { bucket: BUCKET, saved: drawing });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
}

const savedViewports = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await file.text()).layout.viewports;
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

const rectOf = (page, id) => page.evaluate(id =>
  JSON.parse(document.body.dataset.layoutRects).find(r => r.id === id), id);

// A spot inside viewport 1 that viewport 2 does not cover: its left edge
// band is the border, so a third of the way in, a third of the way down.
async function rightClickViewport(page, id) {
  const r = await rectOf(page, id);
  const p = await sheetToClient(page, r.xIn + r.wIn * 0.2, r.yIn + r.hIn * 0.3);
  await page.mouse.click(p.x, p.y, { button: 'right' });
}

const menu = page => page.locator('[data-context-menu]');
const item = (page, key) => page.locator(`[data-context-item="${key}"]`);
const selectedId = page => page.evaluate(() => globalThis.eval('page').state.selectedViewportId);

// Dark ink inside a viewport's window, to see a layer go.
async function inkInside(page, id) {
  const r = await rectOf(page, id);
  return page.evaluate(r => {
    const canvas = document.querySelector('[data-layout-canvas]');
    const [zoom, panX, panY] = document.body.dataset.layoutView.split(',').map(Number);
    const dpr = canvas.width / canvas.clientWidth;
    const x = Math.round((panX + (r.xIn + 0.05) * zoom) * dpr), y = Math.round((panY + (r.yIn + 0.3) * zoom) * dpr);
    const w = Math.round((r.wIn - 0.1) * zoom * dpr), h = Math.round((r.hIn - 0.4) * zoom * dpr);
    const data = canvas.getContext('2d').getImageData(x, y, w, h).data;
    let dark = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120) dark += 1;
    return dark;
  }, r);
}

test('a right click over a viewport selects it and opens the app menu, not the browser one', async ({ page }) => {
  await openLayout(page, houseDrawing());
  await expect(menu(page)).toBeHidden();
  await rightClickViewport(page, 1);
  await expect(menu(page)).toBeVisible();
  expect(await selectedId(page)).toBe(1);
  for (const key of ['show-layers', 'edit-in-model', 'change-scale', 'fit-window', 'copy', 'paste', 'delete', 'to-front', 'to-back']) {
    await expect(item(page, key), key).toHaveCount(1);
  }
  await expect(item(page, 'show-layers')).toBeEnabled();
  await expect(item(page, 'edit-in-model')).toBeEnabled();
  await expect(item(page, 'fit-window'), 'nothing cropped yet').toBeDisabled();
  await expect(item(page, 'paste'), 'nothing copied yet').toBeDisabled();
  await expect(item(page, 'to-front'), 'viewport 1 is under viewport 2').toBeEnabled();
  await expect(item(page, 'to-back'), 'viewport 1 is already at the back').toBeDisabled();
  // Escape closes it and keeps the selection.
  await page.keyboard.press('Escape');
  await expect(menu(page)).toBeHidden();
  expect(await selectedId(page)).toBe(1);
});

test('bare paper offers PASTE and ADD VIEWPORT', async ({ page }) => {
  await openLayout(page, houseDrawing());
  const p = await sheetToClient(page, 1, 1);
  await page.mouse.click(p.x, p.y, { button: 'right' });
  await expect(menu(page)).toBeVisible();
  await expect(item(page, 'add-viewport')).toBeEnabled();
  await expect(item(page, 'paste')).toBeDisabled();
  await expect(item(page, 'show-layers')).toHaveCount(0);
  await item(page, 'add-viewport').click();
  await expect(menu(page)).toBeHidden();
  await expect(page.locator('[data-layout-add-viewport]')).toContainText('CLICK THE SHEET');
});

test('CHANGE SCALE opens the scale card with the list in hand', async ({ page }) => {
  await openLayout(page, houseDrawing());
  await rightClickViewport(page, 1);
  await item(page, 'change-scale').click();
  await expect(page.locator('#lay-edit-scrim')).toBeVisible();
  await expect(page.locator('[data-edit-scale-list]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#lay-edit-scrim')).toBeHidden();
});

// EDIT IN MODEL SPACE GOES, IT DOES NOT ASK (jb, 11 Nov: "they just go
// straight to model space instead of asking about scale"). MODEL.html is
// stubbed so the browser's own URL is the evidence.
test('EDIT IN MODEL SPACE goes straight to the viewport\'s drawing', async ({ page }) => {
  await page.route('**/MODEL.html*', route => route.fulfill({
    status: 200, contentType: 'text/html',
    body: '<!doctype html><title>stub</title><body data-model-stub="1">',
  }));
  await openLayout(page, houseDrawing());
  await rightClickViewport(page, 1);
  await item(page, 'edit-in-model').click();
  await page.waitForFunction(() => document.body?.dataset.modelStub === '1', null, { timeout: 5000 });
  const url = new URL(page.url());
  expect(url.pathname.endsWith('/MODEL.html')).toBe(true);
  expect(url.searchParams.get('level')).toBe('1');
});

test('COPY then PASTE, DELETE, and TO FRONT / TO BACK through the menu', async ({ page }) => {
  await openLayout(page, houseDrawing());
  await rightClickViewport(page, 1);
  await withLayoutSave(page, () => item(page, 'to-front').click());
  await expect(menu(page)).toBeHidden();
  expect((await savedViewports(page)).map(v => v.id), 'viewport 1 now paints last').toEqual([2, 1]);
  await rightClickViewport(page, 1);
  await expect(item(page, 'to-front')).toBeDisabled();
  await withLayoutSave(page, () => item(page, 'to-back').click());
  expect((await savedViewports(page)).map(v => v.id)).toEqual([1, 2]);

  await rightClickViewport(page, 1);
  await item(page, 'copy').click();
  const p = await sheetToClient(page, 1, 1);
  await page.mouse.click(p.x, p.y, { button: 'right' });
  await expect(item(page, 'paste')).toBeEnabled();
  await withLayoutSave(page, () => item(page, 'paste').click());
  expect((await savedViewports(page)).length).toBe(3);

  await rightClickViewport(page, 2);
  await withLayoutSave(page, () => item(page, 'delete').click());
  expect((await savedViewports(page)).map(v => v.id)).toEqual([1, 3]);
});

test('SHOW LAYERS switches a group off for that viewport only, and UNDO puts it back', async ({ page }) => {
  await openLayout(page, houseDrawing());
  const inkBefore1 = await inkInside(page, 1);
  const inkBefore2 = await inkInside(page, 2);
  expect(inkBefore1).toBeGreaterThan(50);

  await rightClickViewport(page, 1);
  await item(page, 'show-layers').click();
  const card = page.locator('[data-layers-card]');
  await expect(card).toBeVisible();
  await expect(card).toContainText('SHOW LAYERS');
  await expect(card.locator('[data-layer-group="walls"]')).toHaveAttribute('aria-pressed', 'false');

  await withLayoutSave(page, () => card.locator('[data-layer-group="walls"]').click());
  await expect(card.locator('[data-layer-group="walls"]')).toHaveAttribute('aria-pressed', 'true');
  const saved = await savedViewports(page);
  expect(saved.find(v => v.id === 1).layersOff).toEqual(['A-WALL-EXT', 'A-WALL-INT', 'A-WALL-PATT']);
  expect(saved.find(v => v.id === 2).layersOff, 'the other viewport is untouched').toBeUndefined();
  expect(await inkInside(page, 1), 'the walls are gone from the window').toBeLessThan(inkBefore1 * 0.5);
  expect(await inkInside(page, 2)).toBeGreaterThan(inkBefore2 * 0.8);

  // ADVANCED lists every standard layer; one chip takes one layer.
  await card.locator('[data-layers-advanced]').click();
  await expect(card.locator('[data-layer-id="A-DOOR"]')).toBeVisible();
  await withLayoutSave(page, () => card.locator('[data-layer-id="A-DOOR"]').click());
  expect((await savedViewports(page)).find(v => v.id === 1).layersOff).toContain('A-DOOR');
  await expect(card.locator('[data-layer-group="openings"]')).toContainText('PART');

  // RESET puts everything back and the field goes away.
  await withLayoutSave(page, () => card.locator('[data-layers-reset]').click());
  expect((await savedViewports(page)).find(v => v.id === 1).layersOff).toBeUndefined();
  expect(await inkInside(page, 1)).toBeGreaterThan(inkBefore1 * 0.8);

  // And UNDO is one step back: the A-DOOR + walls set returns.
  await withLayoutSave(page, () => page.keyboard.press('Control+z'));
  expect((await savedViewports(page)).find(v => v.id === 1).layersOff).toContain('A-WALL-EXT');
  await page.keyboard.press('Escape');
  await expect(card).toBeHidden();
});
