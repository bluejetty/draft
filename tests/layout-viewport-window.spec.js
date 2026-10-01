// THE VIEWPORT WINDOW: cropped or grown by its grips, the drawing left alone.
//
// Movie, 1 Oct: "the user should be allowed to adjust the window size and
// position of the layouts on the page", and on the scale: "the scale should
// stay the same unless they decide to change the scale". So a grip moves the
// frame's edge and nothing else -- not the drawing, not its scale.
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';

// Landscape 11x17 sheet dimensions in paper inches, and the canvas margin the
// fit uses — the specs recompute the sheet transform from these.
const PW = 17;
const PH = 11;
const FIT_MARGIN = 60;

const point = (x, z) => ({ x, y: 0, z });

// A saved drawing the way MODEL writes it: a 24' x 16' four-wall main floor
// with one door, plus an empty foundation level.
function houseDrawing() {
  const wall = (id, sx, sz, ex, ez) => ({
    id,
    start: point(sx, sz),
    end: point(ex, ez),
    levelId: 1,
    view: 'plan',
    wallType: 'stud_2x6',
    baseHeight: 0,
    topHeight: 8,
    refLine: 'left',
  });
  return {
    version: 1,
    levels: [
      { id: 0, name: 'FOUNDATION', elev: -8 },
      { id: 1, name: 'MAIN FL', elev: 0 },
    ],
    walls: [
      wall(1, 0, 0, 24, 0),
      wall(2, 24, 0, 24, 16),
      wall(3, 24, 16, 0, 16),
      wall(4, 0, 16, 0, 0),
    ],
    fenestrations: [
      { id: 1, levelId: 1, wallId: 1, type: 'door', offset: 6, width: 3 },
    ],
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
  return page.locator('[data-layout-canvas]');
}

async function savedDrawing(page) {
  return page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    return file ? JSON.parse(await file.text()) : null;
  }, BUCKET);
}

// The layout page stamps data-layout-save-seq up once each persisted write
// lands; actions that save are wrapped so the read-back never races the write.
async function withLayoutSave(page, action) {
  const seq = await page.evaluate(() => Number(document.body.dataset.layoutSaveSeq || 0));
  await action();
  await page.waitForFunction(
    prev => Number(document.body.dataset.layoutSaveSeq || 0) > prev,
    seq,
  );
}

// The sheet transform the page computes in _fitPaper, rebuilt from the canvas
// box: zoom (pixels per paper inch) and the paper's top-left corner.
async function sheetMetrics(page) {
  const box = await page.locator('[data-layout-canvas]').boundingBox();
  const zoom = Math.min((box.width - FIT_MARGIN * 2) / PW, (box.height - FIT_MARGIN * 2) / PH);
  return {
    box,
    zoom,
    panX: (box.width - PW * zoom) / 2,
    panY: (box.height - PH * zoom) / 2,
  };
}

async function sheetToClient(page, xIn, yIn) {
  const m = await sheetMetrics(page);
  return { x: m.box.x + m.panX + xIn * m.zoom, y: m.box.y + m.panY + yIn * m.zoom };
}

async function clickSheet(page, xIn, yIn) {
  const p = await sheetToClient(page, xIn, yIn);
  await page.mouse.click(p.x, p.y);
}

// Ink counter on the layout canvas: non-white pixels in a square around a
// sheet point — enough to tell a drawn plan from bare paper.
async function inkAround(page, xIn, yIn, radiusIn = 0.5) {
  const m = await sheetMetrics(page);
  return page.evaluate(({ cx, cy, r }) => {
    const canvas = document.querySelector('[data-layout-canvas]');
    const data = canvas.getContext('2d').getImageData(
      Math.round(cx - r), Math.round(cy - r), Math.round(r * 2), Math.round(r * 2),
    ).data;
    let ink = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 240 || data[i + 1] < 240 || data[i + 2] < 240) ink += 1;
    }
    return ink;
  }, { cx: m.panX + xIn * m.zoom, cy: m.panY + yIn * m.zoom, r: radiusIn * m.zoom });
}

async function placeViewport(page, xIn, yIn) {
  await page.locator('[data-layout-add-viewport]').click();
  await expect(page.locator('[data-layout-add-viewport]')).toContainText('CLICK THE SHEET');
  await withLayoutSave(page, () => clickSheet(page, xIn, yIn));
}

// The page's own answer for where a viewport's window is, in sheet inches.
const windowOf = (page, i = 0) => page.evaluate(n => {
  const app = globalThis.eval('page');
  return app._viewportRectIn(app.state.viewports[n]);
}, i);

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

async function placedAndSelected(page) {
  await openLayout(page, houseDrawing());
  await placeViewport(page, 8, 5);
  // A click on the body selects it, which is what puts the grips up.
  await clickSheet(page, 8, 5);
  return windowOf(page);
}

test('the east grip crops the window; the drawing and its scale stay put', async ({ page }) => {
  const before = await placedAndSelected(page);
  const east = { xIn: before.xIn + before.wIn, yIn: before.yIn + before.hIn / 2 };
  await dragSheet(page, east, { xIn: east.xIn - 1, yIn: east.yIn });
  const [vp] = (await savedDrawing(page)).layout.viewports;
  expect(vp.crop.r).toBeCloseTo(1, 1);
  expect(vp.crop.l).toBe(0);
  expect(vp.xIn, 'the drawing did not move').toBeCloseTo(8, 3);
  const after = await windowOf(page);
  expect(after.wIn).toBeCloseTo(before.wIn - 1, 1);
  expect(after.xIn, 'the west edge stayed').toBeCloseTo(before.xIn, 3);

  // AND UNDO PUTS THE WINDOW BACK, like any other sheet change.
  await withLayoutSave(page, () => page.locator('[data-undo]').click());
  expect((await windowOf(page)).wIn).toBeCloseTo(before.wIn, 3);
});

test('a corner grip dragged outward grows the window past its drawing', async ({ page }) => {
  const before = await placedAndSelected(page);
  const nw = { xIn: before.xIn, yIn: before.yIn };
  await dragSheet(page, nw, { xIn: nw.xIn - 0.75, yIn: nw.yIn - 0.5 });
  const [vp] = (await savedDrawing(page)).layout.viewports;
  expect(vp.crop.l).toBeCloseTo(-0.75, 1);
  expect(vp.crop.t).toBeCloseTo(-0.5, 1);
  const after = await windowOf(page);
  expect(after.wIn).toBeCloseTo(before.wIn + 0.75, 1);
  expect(after.hIn).toBeCloseTo(before.hIn + 0.5, 1);
});

test('the crop survives a reload, moves with the viewport, and FIT WINDOW takes it off', async ({ page }) => {
  const before = await placedAndSelected(page);
  const south = { xIn: before.xIn + before.wIn / 2, yIn: before.yIn + before.hIn };
  await dragSheet(page, south, { xIn: south.xIn, yIn: south.yIn - 0.6 });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  const reloaded = await windowOf(page);
  expect(reloaded.hIn).toBeCloseTo(before.hIn - 0.6, 1);

  // MOVED WHOLE: the window keeps its crop wherever the viewport goes.
  await dragSheet(page, { xIn: 8, yIn: 5 }, { xIn: 10, yIn: 5 });
  const moved = await windowOf(page);
  expect(moved.hIn).toBeCloseTo(before.hIn - 0.6, 1);
  expect(moved.xIn).toBeCloseTo(before.xIn + 2, 1);

  await expect(page.locator('[data-fit-window]')).toBeVisible();
  await withLayoutSave(page, () => page.locator('[data-fit-window]').click());
  const [vp] = (await savedDrawing(page)).layout.viewports;
  expect('crop' in vp, 'FIT WINDOW took the crop off').toBe(false);
  expect((await windowOf(page)).hIn).toBeCloseTo(before.hIn, 3);
  await expect(page.locator('[data-fit-window]')).toBeHidden();
});
