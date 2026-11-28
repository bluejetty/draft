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

// S-BEAM is in the tested vocabulary and was NOT one of the surviving three.
const LAYER = 'S-BEAM';

// ON MODEL.html (moved off the old page, 28 Nov 2026): the editor drafters
// use has its own loader and saver, so it is the one this pins.
const drawing = () => ({
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0, visible: true }],
  activeLevelIdx: 0,
  walls: [], floors: [], roofs: [], fenestrations: [], dimensions: [], outlines: [],
  shapes: [], stairs: [], notes: [], roomTags: [], columns: [], beams: [],
  boneyardOutlines: [], boneyardShelves: [], groups: [], levelLocks: [], underlays: [],
  lines: [{
    id: 1, levelId: 3, view: 'plan', layer: LAYER,
    start: { x: 0, y: 0, z: 0 }, end: { x: 10, y: 0, z: 0 },
  }],
});

test('a layer outside the old whitelist survives a save and reload', async ({ page }) => {
  await h.openEditor(page, { drawing: drawing(), url: '/MODEL.html?left=1&lpane=drafting&level=3' });
  await page.waitForTimeout(300);
  const { at } = await h.planFrame(page);

  // The app must WRITE the drawing back, or this reads the file the test
  // itself wrote and proves nothing -- an earlier version passed on the
  // unfixed code for exactly that reason. A second line forces the
  // re-serialise, so what is asserted is what the LOAD PATH produced.
  await page.keyboard.press('l');
  await page.mouse.click(...at(2, 1)); await page.waitForTimeout(60);
  await page.mouse.click(...at(8, 1)); await page.waitForTimeout(60);
  await page.keyboard.press('Escape');
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });

  const saved = await h.savedDrawing(page);
  expect((saved.lines || []).length, 'the drawn line landed, so the file was rewritten').toBe(2);
  const line = saved.lines.find(l =>
    Math.abs(l.start.x - 0) < 0.01 && Math.abs(l.start.z - 0) < 0.01
    && Math.abs(l.end.x - 10) < 0.01 && Math.abs(l.end.z - 0) < 0.01);
  expect(line).toBeTruthy();
  // Flattened, this comes back 'draft': the name eaten on the way in and
  // written back, so the original is gone for good.
  expect(line.layer).toBe(LAYER);
});
