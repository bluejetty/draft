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

  // Write a drawing carrying one line on that layer, then open it.
  await page.evaluate(async ({ bucket, layer }) => {
    const drawing = {
      version: 1,
      levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
      lines: [{
        id: 1, levelId: 3, view: 'plan', layer,
        start: { x: 0, y: 0, z: 0 }, end: { x: 10, y: 0, z: 0 },
      }],
    };
    const file = new File([JSON.stringify(drawing)], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(file, bucket);
  }, { bucket: BUCKET, layer: LAYER });

  await page.reload();
  await page.waitForFunction(() => document.body.dataset.modelReady === '1');
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  const line = (saved.lines || [])[0];
  expect(line).toBeTruthy();
  // Before the fix this read 'draft': the name was eaten on the way in and
  // written back flattened, so the original was gone for good.
  expect(line.layer).toBe(LAYER);
});
