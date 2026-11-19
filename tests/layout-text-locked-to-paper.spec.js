// SHEET TEXT HOLDS ITS PRINTED SIZE AS THE SHEET ZOOMS.
//
// jb, 19 Nov 2026: "when i zoom in and out the annotation and rm size text
// changes size. it should be locked to the size it will print" -- on the
// CONSTRUCTION LAYOUT, a SCREEN-size note (LEGAL LAND DESCRIPTION) and a
// room tag with its area (SITE 122,382 SQ FT) kept their screen pixels
// while the paper under them grew and shrank, so zoomed out they ran over
// the plan. They now take the sheet's `inkScale` (zoom over print zoom), as
// the dimensions do: the lettering is a fixed size on the PAPER.
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';
const point = (x, z) => ({ x, y: 0, z });
const SITE = 8;

function siteWithText() {
  return {
    version: 1,
    units: 'imperial',
    levels: [
      { id: 8, name: 'SITE', elev: 0 },
      { id: 7, name: 'ROOF', elev: 9 },
      { id: 3, name: 'MAIN FL', elev: 0 },
      { id: 1, name: 'FOUNDATION', elev: -9 },
    ],
    walls: [],
    lines: [
      { id: 1, start: point(0, 0), end: point(200, 0), levelId: SITE, view: 'plan', layer: 'draft' },
      { id: 2, start: point(200, 0), end: point(200, 300), levelId: SITE, view: 'plan', layer: 'draft' },
      { id: 3, start: point(200, 300), end: point(0, 300), levelId: SITE, view: 'plan', layer: 'draft' },
      { id: 4, start: point(0, 300), end: point(0, 0), levelId: SITE, view: 'plan', layer: 'draft' },
    ],
    notes: [{ id: 1, levelId: SITE, view: 'plan', anchor: point(120, 200), text: point(120, 200), end: 'none',
      body: 'LEGAL LAND DESCRIPTION\nPLAN NO. 102314854\nN.E. 1/2 SEC. 7\nTWP. 41, RGE. 3, W. 3RD MER, HAGUE\nSASKATCHEWAN', caps: true }],
    roomTags: [{ id: 1, at: point(140, 250), levelId: SITE, view: 'plan', name: 'SITE', areaSqFt: 0, stamped: true,
      points: [point(0, 0), point(200, 0), point(200, 300), point(0, 300)] }],
    layout: { auto: true },
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
  await page.evaluate(async ({ bucket, saved }) => {
    const file = new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(file, bucket);
  }, { bucket: BUCKET, saved });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.waitForFunction(() => Number(document.body.dataset.layoutSaveSeq || 0) > 0
    && document.body.dataset.layoutSaveDirty !== '1');
}

// Each paint of the note and the tag, with the sheet's ink scale and the
// lettering's size in px, read through the painters' own metrics.
const watchText = page => page.evaluate(() => {
  const R = window.DraftRender2D;
  window.__paints = [];
  window.DraftRender2D = Object.freeze({
    ...R,
    drawNoteScreen2D(ctx, a, t, note, options, env) {
      const box = R.noteBoxScreen2D(ctx, a, t, note, options && options.pxPerFt, env && env.inkScale);
      window.__paints.push({ kind: 'note', ink: env && env.inkScale, px: box.fontPx });
      return R.drawNoteScreen2D(ctx, a, t, note, options, env);
    },
    drawRoomTag2D(ctx, toS, tag, options, env) {
      const m = R.roomTagMetrics(ctx, toS(tag.at), tag, env, options && options.pxPerFt);
      window.__paints.push({ kind: 'tag', ink: env && env.inkScale, px: m.namePx, sub: m.subPx });
      return R.drawRoomTag2D(ctx, toS, tag, options, env);
    },
    drawShape2D: R.drawShape2D,
  });
});

// One step of the wheel is one 1.1x zoom, whatever its delta.
async function wheelAndRead(page, steps) {
  const box = await page.locator('[data-layout-canvas]').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.evaluate(() => { window.__paints = []; });
  for (let i = 0; i < Math.abs(steps); i++) {
    await page.mouse.wheel(0, steps > 0 ? 120 : -120);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(400);
  return page.evaluate(() => window.__paints.slice());
}

test('a SCREEN note and a room tag on a sheet keep their size on the paper at every zoom', async ({ page }) => {
  await openLayout(page, siteWithText());
  await watchText(page);
  const out = await wheelAndRead(page, 3);
  const inn = await wheelAndRead(page, -10);
  const last = (paints, kind) => paints.filter(p => p.kind === kind).pop();
  for (const kind of ['note', 'tag']) {
    const a = last(out, kind), b = last(inn, kind);
    expect(a, `${kind} painted zoomed out`).toBeTruthy();
    expect(b, `${kind} painted zoomed in`).toBeTruthy();
    expect(b.ink, 'the two zooms really differ').toBeGreaterThan(a.ink * 1.5);
    // Px over ink scale is the printed size: the same at both zooms.
    const printed = kind === 'note' ? 12 : 13;
    expect(a.px / a.ink).toBeCloseTo(printed, 6);
    expect(b.px / b.ink).toBeCloseTo(printed, 6);
  }
});

test('MODEL space (no inkScale) and print (inkScale 1) keep the 12px note and 13px tag', async ({ page }) => {
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  const sizes = await page.evaluate(() => {
    const R = window.DraftRender2D;
    const ctx = document.createElement('canvas').getContext('2d');
    const note = { body: 'HI' };
    const tag = { name: 'ROOM', at: { x: 0, y: 0, z: 0 } };
    return {
      noteModel: R.noteBoxScreen2D(ctx, { x: 0, y: 0 }, { x: 10, y: 0 }, note, 4).fontPx,
      notePrint: R.noteBoxScreen2D(ctx, { x: 0, y: 0 }, { x: 10, y: 0 }, note, 4, 1).fontPx,
      noteHalf: R.noteBoxScreen2D(ctx, { x: 0, y: 0 }, { x: 10, y: 0 }, note, 4, 0.5).fontPx,
      noteSized: R.noteBoxScreen2D(ctx, { x: 0, y: 0 }, { x: 10, y: 0 }, { ...note, heightFt: 2 }, 4, 0.5).fontPx,
      tagModel: R.roomTagMetrics(ctx, { x: 0, y: 0 }, tag, { areaFor: () => '' }, 4).namePx,
      tagHalf: R.roomTagMetrics(ctx, { x: 0, y: 0 }, tag, { areaFor: () => '', inkScale: 0.5 }, 4).namePx,
    };
  });
  expect(sizes.noteModel).toBe(12);
  expect(sizes.notePrint).toBe(12);
  expect(sizes.noteHalf).toBe(6);
  // A note lettered in feet already zooms with the drawing; ink scale leaves it be.
  expect(sizes.noteSized).toBeCloseTo(2 * 4 * 1.4, 6);
  expect(sizes.tagModel).toBe(13);
  expect(sizes.tagHalf).toBe(6.5);
});
