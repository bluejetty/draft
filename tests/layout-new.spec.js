// NEW ON LAYOUT: SAVE CURRENT OR DISCARD, THEN A BLANK FILE, STILL ON LAYOUT.
//
// Movie, 11 Oct: "when a user is in LAYOUT area and they press NEW, can you
// give them a popup to SAVE CURRENT, or DISCARD? and then open a new blank
// file for them clean layouts and model area, but stay in layout area until
// they decide to move or do something else".
//
// MODEL owns what a blank drawing is, so the clearing is its `?new=1`;
// `then=layout&asked=1` brings the drafter straight back here without MODEL
// asking the question a second time.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const HOUSE = {
  version: 1, board: 'drafting', planTurn: 0, buildType: 'bungalow',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 2,
  walls: [
    { id: 'w1', levelId: 3, view: 'plan', start: { x: 0, z: 0 }, end: { x: 20, z: 0 }, baseHeight: 0, topHeight: 8, thickness: 0.5 },
    { id: 'w2', levelId: 3, view: 'plan', start: { x: 20, z: 0 }, end: { x: 20, z: 20 }, baseHeight: 0, topHeight: 8, thickness: 0.5 },
  ],
  layout: { auto: true },
};

const stored = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return file ? JSON.parse(await file.text()) : null;
}, BUCKET);

async function openLayout(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: HOUSE });
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await expect(page.locator('#file-new')).toBeEnabled();
}

test('NEW asks SAVE CURRENT or DISCARD, and Cancel leaves everything', async ({ page }) => {
  await openLayout(page);
  await page.locator('#file-new').click();
  const ask = page.locator('#lay-new-scrim');
  await expect(ask).toBeVisible();
  await expect(ask.locator('[data-new-save]')).toHaveText('SAVE CURRENT');
  await expect(ask.locator('[data-new-discard]')).toHaveText('DISCARD');
  await ask.locator('[data-new-cancel]').click();
  await expect(ask).toBeHidden();
  await expect(page).toHaveURL(/LAYOUT\.html$/);
  expect((await stored(page)).walls).toHaveLength(2);
});

test('DISCARD clears the drawing and its sheets and comes back to LAYOUT', async ({ page }) => {
  await openLayout(page);
  await page.locator('#file-new').click();
  await page.locator('#lay-new-scrim [data-new-discard]').click();
  await page.waitForURL(/MODEL\.html/, { timeout: 10000 });
  await page.waitForURL(/LAYOUT\.html$/, { timeout: 15000 });
  // NOT ASKED A SECOND TIME on the way through MODEL.
  const d = await stored(page);
  expect(d.walls || []).toHaveLength(0);
  expect(d.layout?.viewports || []).toHaveLength(0);
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
});

test('SAVE CURRENT hands over a copy of the drawing first', async ({ page }) => {
  await openLayout(page);
  await page.locator('#file-new').click();
  const download = page.waitForEvent('download');
  await page.locator('#lay-new-scrim [data-new-save]').click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.draft$/);
  const copy = JSON.parse(require('fs').readFileSync(await file.path(), 'utf8'));
  expect(copy.walls).toHaveLength(2);
  await page.waitForURL(/MODEL\.html/, { timeout: 10000 });
  await page.waitForURL(/LAYOUT\.html$/, { timeout: 15000 });
  expect((await stored(page)).walls || []).toHaveLength(0);
});
