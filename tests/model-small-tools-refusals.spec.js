// TIER 3J: REFUSING A RECORD IS NOT DELETING IT.
//
// The load block now normalises beams, columns, shapes and fixtures, so a
// malformed one stops reaching the page's own logic. That is only safe if the
// SAVE puts it back: a drafter's file must not lose geometry because this page
// declined to act on it. `withRefused()` is the mechanism; this is the proof,
// end to end through the real store rather than through the format alone.
//
// RD-DOCUMENTS/BOARD-tier3j-normalise-before-you-edit.md
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test('a refused beam is dropped from the drawing and kept in the file', async ({ page }) => {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  const levelId = saved.levels[0].id;

  // One good beam and one the format refuses -- a non-integer id, which is
  // the mutation proto/small-tools-harness.js pins.
  await page.evaluate(async ({ bucket, levelId }) => {
    const store = window.SharedFileStore;
    const at = await store.loadSharedFileAt(bucket);
    const drawing = JSON.parse(await at.file.text());
    drawing.beams = [
      { id: 'not-an-integer', start: { x: 0, y: 0, z: 0 }, end: { x: 10, y: 0, z: 0 },
        levelId, view: 'plan' },
      { id: 41, start: { x: 0, y: 0, z: 4 }, end: { x: 10, y: 0, z: 4 },
        levelId, view: 'plan' },
    ];
    const file = new File([JSON.stringify(drawing)], 'model-drawing.json',
      { type: 'application/json' });
    await store.saveSharedFile(file, bucket, { ifRev: at.rev });
  }, { bucket: h.STORAGE_BUCKET, levelId });

  // MODEL.html, NOT a reload: h.openModel drives MODEL.dc.html, and the load
  // block under test is this page's. Reloading the other page would have
  // proved nothing about either.
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });

  // THE PAGE DECLINED TO ACT ON IT: the working drawing holds the good beam
  // only, so nothing downstream can read an id that is not an id.
  const inHand = await page.evaluate(() =>
    (window.__drawingForTest?.beams || []).map(b => b.id));
  if (inHand.length) {
    expect(inHand, 'the refused beam reached the working drawing').toEqual([41]);
  }

  // AND THE FILE STILL HAS BOTH. This is the half that matters: refusing is
  // declining to act, not deleting a drafter's geometry.
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const after = await h.savedDrawing(page);
  const ids = (after.beams || []).map(b => String(b.id)).sort();
  expect(ids, 'the refused beam was deleted from the file, not merely refused')
    .toEqual(['41', 'not-an-integer']);
});
