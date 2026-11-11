// A ROOM TAG ON THE SITE PLAN IS ON ITS SHEET.
//
// jb, 10 Nov 2026: "it isn't showing the room tag on the construction plan".
// His standalone site plan had a note (HIHI) and a ROOM tag with an area
// shape, the name dragged clear of the shape with a leader back to it. The
// sheet printed the note and not the tag: the SITE and ROOF sheets paint a
// level's own marks through drawLevelMarks, which handed the composer the
// level's lines, notes, dims and shapes and an EMPTY roomTags list.
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';
const point = (x, z) => ({ x, y: 0, z });
const SITE = 8;

function siteWithTag() {
  return {
    version: 1,
    units: 'metric',
    levels: [
      { id: 8, name: 'SITE', elev: 0 },
      { id: 7, name: 'ROOF', elev: 9 },
      { id: 3, name: 'MAIN FL', elev: 0 },
      { id: 1, name: 'FOUNDATION', elev: -9 },
    ],
    walls: [],
    lines: [{ id: 1, start: point(0, 0), end: point(60, 0), levelId: SITE, view: 'plan', layer: 'draft', color: '#ff0000', weight: 6 }],
    notes: [{ id: 1, levelId: SITE, view: 'plan', anchor: point(30, 20), text: point(40, 30), body: 'HIHI', end: 'line' }],
    roomTags: [{ id: 1, at: point(70, 50), levelId: SITE, view: 'plan', name: 'ROOM', areaSqFt: 0, stamped: true,
      points: [point(10, 10), point(50, 10), point(50, 40), point(10, 40)] }],
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
  await page.waitForTimeout(400);
}

const savedLayout = page => page.evaluate(async () => {
  const at = await window.SharedFileStore.loadSharedFileAt('model-drawing');
  return JSON.parse(await at.file.text()).layout || {};
});

// The painter is watched rather than the pixels: a tag is 13px of dark
// lettering on a sheet full of dark lettering. The composer reads
// window.DraftRender2D on every pass, so a wrapped copy sees each tag.
const watchTags = page => page.evaluate(() => {
  const R = window.DraftRender2D;
  window.__tagPaints = [];
  window.DraftRender2D = Object.freeze({
    ...R,
    drawRoomTag2D(ctx, toS, tag, options, env) {
      const hit = R.drawRoomTag2D(ctx, toS, tag, options, env);
      window.__tagPaints.push({ name: tag.name, lines: R.roomTagLines(tag, env), leader: Boolean(R.roomTagLeader(tag, toS, { x: hit.x, y: hit.y, w: hit.w, h: 20 })) });
      return hit;
    },
  });
});

test('the SITE PLAN sheet prints the level\'s room tag, its area in the drawing\'s units, and the leader to its shape', async ({ page }) => {
  await openLayout(page, siteWithTag());
  await page.waitForFunction(() => Number(document.body.dataset.layoutSaveSeq || 0) > 0
    && document.body.dataset.layoutSaveDirty !== '1');
  const layout = await savedLayout(page);
  const site = (layout.sheets || []).findIndex(s => /SITE/i.test(s.title || ''));
  expect(site, 'a SITE PLAN sheet is dealt').toBeGreaterThanOrEqual(0);
  await watchTags(page);
  await page.locator(`[data-layout-sheet="${site + 1}"]`).click();
  // A turn of the wheel over the sheet repaints it, whichever sheet was up.
  const box = await page.locator('[data-layout-canvas]').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(400);
  const paints = await page.evaluate(() => window.__tagPaints);
  expect(paints.map(p => p.name), 'the ROOM tag reached the sheet').toContain('ROOM');
  const room = paints.find(p => p.name === 'ROOM');
  // 40 x 30 ft = 1200 sq ft = 111.5 m² on a metric drawing, not "1,200 SQ FT".
  expect(room.lines, 'the area line in metres').toEqual(['111.5 m²']);
  expect(room.leader, 'and the leader back to the shape, the name being outside it').toBe(true);
});
