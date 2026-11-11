// PAN THE DRAWING INSIDE A VIEWPORT (jb, 10 Nov): "when you grab the outside
// line it allows you to move the viewport ... if you put the hand on the
// inside where not touching the edge ... the user can move the image 'within'
// the viewport, and the viewport stays in the same position."
//
// So a viewport answers a press three ways: a GRIP crops (the window spec),
// the BORDER BAND moves the window, and the BODY pans the drawing. A pan is
// kept in the fields the file already has -- the frame centre moves with the
// hand and the crop moves the same distance the other way -- so the window
// on the sheet does not stir, prints read it as drawn, and FIT WINDOW still
// centres the drawing again.
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
      auto: false, nextViewportId: 2, sheets: [{ title: '' }, { title: '' }],
      viewports: [{ id: 1, kind: 'plan', levelId: 1, pif: 0.25, xIn: 8, yIn: 5, sheet: 2 }],
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

const savedViewport = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await file.text()).layout.viewports.at(-1);
}, BUCKET);

async function withLayoutSave(page, action) {
  const seq = await page.evaluate(() => Number(document.body.dataset.layoutSaveSeq || 0));
  await action();
  await page.waitForFunction(prev => Number(document.body.dataset.layoutSaveSeq || 0) > prev, seq);
}

async function sheetMetrics(page) {
  const box = await page.locator('[data-layout-canvas]').boundingBox();
  const zoom = Math.min((box.width - FIT_MARGIN * 2) / PW, (box.height - FIT_MARGIN * 2) / PH);
  return { box, zoom, panX: (box.width - PW * zoom) / 2, panY: (box.height - PH * zoom) / 2 };
}

async function sheetToClient(page, xIn, yIn) {
  const m = await sheetMetrics(page);
  return { x: m.box.x + m.panX + xIn * m.zoom, y: m.box.y + m.panY + yIn * m.zoom };
}

const windowOf = page => page.evaluate(() => {
  const app = globalThis.eval('page');
  return app._viewportRectIn(app.state.viewports.at(-1));
});

async function placeViewport(page) {
  await page.locator('[data-layout-add-viewport]').click();
  await expect(page.locator('[data-layout-add-viewport]')).toContainText('CLICK THE SHEET');
  const p = await sheetToClient(page, 8, 5);
  await withLayoutSave(page, () => page.mouse.click(p.x, p.y));
  return windowOf(page);
}

async function dragSheet(page, from, to) {
  const a = await sheetToClient(page, from.xIn, from.yIn);
  const b = await sheetToClient(page, to.xIn, to.yIn);
  await withLayoutSave(page, async () => {
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 8 });
    await page.mouse.up();
  });
}

const cursorAt = async (page, xIn, yIn) => {
  const p = await sheetToClient(page, xIn, yIn);
  await page.mouse.move(p.x, p.y);
  return page.evaluate(() => document.querySelector('[data-layout-canvas]').style.cursor);
};

test('the hand over the body, the move arrow over the border, the resize arrow over a grip', async ({ page }) => {
  await openLayout(page, houseDrawing());
  const r = await placeViewport(page);
  await page.mouse.click(...Object.values(await sheetToClient(page, 8, 5)));
  expect(await cursorAt(page, r.xIn + r.wIn / 2, r.yIn + r.hIn / 2)).toBe('grab');
  expect(await cursorAt(page, r.xIn, r.yIn + r.hIn / 4)).toBe('move');
  expect(await cursorAt(page, r.xIn + r.wIn, r.yIn + r.hIn / 2)).toBe('ew-resize');
  expect(await cursorAt(page, 1, 1), 'bare paper').toBe('');
});

test('a drag inside pans the drawing; the window stays where it was', async ({ page }) => {
  await openLayout(page, houseDrawing());
  const before = await placeViewport(page);
  const centre = { xIn: before.xIn + before.wIn / 2, yIn: before.yIn + before.hIn / 2 };
  await dragSheet(page, centre, { xIn: centre.xIn + 1, yIn: centre.yIn - 0.5 });

  const after = await windowOf(page);
  expect(after.xIn, 'the window did not move').toBeCloseTo(before.xIn, 3);
  expect(after.yIn).toBeCloseTo(before.yIn, 3);
  expect(after.wIn).toBeCloseTo(before.wIn, 3);
  expect(after.hIn).toBeCloseTo(before.hIn, 3);

  // The drawing's frame went with the hand, and the crop the other way.
  const vp = await savedViewport(page);
  expect(vp.xIn).toBeCloseTo(9, 1);
  expect(vp.yIn).toBeCloseTo(4.5, 1);
  expect(vp.crop.l).toBeCloseTo(-1, 1);
  expect(vp.crop.r).toBeCloseTo(1, 1);
  expect(vp.crop.t).toBeCloseTo(0.5, 1);
  expect(vp.crop.b).toBeCloseTo(-0.5, 1);

  // UNDO takes the pan back; FIT WINDOW centres the drawing again.
  await withLayoutSave(page, () => page.locator('[data-undo]').click());
  expect((await savedViewport(page)).xIn).toBeCloseTo(8, 3);
  await withLayoutSave(page, () => page.locator('[data-redo]').click());
  expect((await savedViewport(page)).xIn).toBeCloseTo(9, 1);
  // History drops the selection; a click on the body (no drag) picks the
  // viewport again without panning it.
  await page.mouse.click(...Object.values(await sheetToClient(page, centre.xIn, centre.yIn)));
  await expect(page.locator('[data-fit-window]')).toBeVisible();
  expect((await savedViewport(page)).xIn, 'a click is not a pan').toBeCloseTo(9, 1);
  await withLayoutSave(page, () => page.locator('[data-fit-window]').click());
  const fitted = await savedViewport(page);
  expect('crop' in fitted).toBe(false);
  const fittedWindow = await windowOf(page);
  expect(fittedWindow.xIn, 'the window is centred on the frame again').toBeCloseTo(before.xIn + 1, 1);
});

test('a drag on the border still moves the whole viewport, drawing and all', async ({ page }) => {
  await openLayout(page, houseDrawing());
  const before = await placeViewport(page);
  const edge = { xIn: before.xIn + before.wIn / 4, yIn: before.yIn + before.hIn };
  await dragSheet(page, edge, { xIn: edge.xIn + 2, yIn: edge.yIn + 1 });
  const after = await windowOf(page);
  expect(after.xIn).toBeCloseTo(before.xIn + 2, 1);
  expect(after.yIn).toBeCloseTo(before.yIn + 1, 1);
  const vp = await savedViewport(page);
  expect(vp.xIn).toBeCloseTo(10, 1);
  expect(vp.crop, 'a move is not a pan').toBeUndefined();
});
