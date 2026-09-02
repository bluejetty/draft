// A saved layer name survives a reload.
//
// The loader restored a line's layer through a hand-written chain: 'no-draft',
// 'S-FOOTING' and 'E-POWER' survived, and EVERY other layer name silently
// became 'draft'. Nothing logged, nothing failed. That is not cosmetic —
// layer-views.js deals a sheet BY LAYER NAME, so a line flattened to draft
// does not come back wrong-looking, it comes back missing from its sheet, and
// only after a save and reopen.
//
// There were two chains, not one: the loader, and _lineLayerConfig, which
// decides whether a line is visible and printable. A layer surviving the
// first was still looked up as 'draft' by the second. Both now check the one
// canonical table the app already ships — DEFAULT_LAYER_STANDARDS.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';

// S-BEAM is in the tested vocabulary and was NOT one of the surviving three.
const LAYER = 'S-BEAM';

test('a layer outside the old whitelist survives a save and reload', async ({ page }) => {
  await h.openModel(page);

  // Straight into the bucket the app loads from, then reopen it.
  await page.evaluate(async ({ bucket, json }) => {
    const file = new File([json], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(file, bucket);
  }, {
    bucket: h.STORAGE_BUCKET,
    json: JSON.stringify({
      version: 1,
      levels: [{ id: 3, name: 'MAIN FL', elev: 0, visible: true }],
      lines: [{
        id: 1, levelId: 3, view: 'plan', layer: LAYER,
        start: { x: 0, y: 0, z: 0 }, end: { x: 10, y: 0, z: 0 },
      }],
    }),
  });
  await page.reload();
  await h.waitForModelReady(page);

  // The app must WRITE the drawing back, or this reads the file the test
  // itself wrote and proves nothing — an earlier version passed on the
  // unfixed code for exactly that reason. An edit forces the re-serialise,
  // so what is asserted is what the LOAD PATH produced.
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, -6, 6);
  await h.clickWorld(page, 6, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  // Ids are reassigned on load, so find the seeded line by its geometry.
  const line = (saved.lines || []).find(l =>
    Math.abs(l.start.x - 0) < 0.01 && Math.abs(l.start.z - 0) < 0.01
    && Math.abs(l.end.x - 10) < 0.01 && Math.abs(l.end.z - 0) < 0.01);
  expect(line).toBeTruthy();
  // Before the fix this came back 'draft': the name was eaten on the way in
  // and written back flattened, so the original was gone for good.
  expect(line.layer).toBe(LAYER);
});
