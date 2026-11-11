// + ADD ANOTHER ... HOLOGRAM TO PLAN (jb, 10 Nov 2026): the last row of every
// file's list on the HOLOGRAM card is a slot wearing the next number; a press
// puts one more copy of that file on the plan, ten feet over from the last
// copy, picked, and UNDO takes it off.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const BLANK = {
  version: 1, board: 'drafting', planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
};
const HOUSE = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'proto', 'repro-movie-corner-garage.draft'), 'utf8'));
HOUSE.walls = HOUSE.walls.slice(0, 3);

async function open(page, drawing) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    try { localStorage.removeItem('draft.trace.on'); } catch { /* fine */ }
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing });
  await page.goto('/MODEL.html?level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
const closeCard = async page => {
  if (await page.locator('#hologram-ask').isVisible()) await page.locator('[data-hologram-close]').click();
};
const saved = async page => {
  await closeCard(page);
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};

test('the slot after #2 says + ADD ANOTHER footprint HOLOGRAM TO PLAN, and a press puts #3 on the plan, 10 ft over, picked', async ({ page }) => {
  await open(page, { ...BLANK, holograms: [
    { id: 'hologram-1', name: 'footprint', x: 4, z: -2, angleDeg: 0, pivotX: 0, pivotZ: 0, source: HOUSE },
    { id: 'hologram-2', name: 'footprint', x: 40, z: 6, angleDeg: 90, pivotX: 0, pivotZ: 0, source: HOUSE }] });
  await page.locator('[data-mode-hologram]').click();
  const card = page.locator('#hologram-ask');
  const slot = card.locator('[data-hologram-add-slot]');
  await expect(slot).toHaveCount(1);
  await expect(slot.locator('[data-hologram-next]')).toHaveText('#3');
  await expect(slot.locator('[data-hologram-add]')).toHaveText('+ ADD ANOTHER footprint HOLOGRAM TO PLAN');
  // The slot is the last row of the file's list.
  const rows = await card.locator('.hologram-file .hologram-copy').evaluateAll(els => els.map(e => e.dataset.hologramRow || 'slot'));
  expect(rows).toEqual(['hologram-1', 'hologram-2', 'slot']);
  await slot.locator('[data-hologram-add]').click();
  // Three rows now, the slot at #4, the new one lit (picked) with its buttons open.
  await expect(card.locator('[data-hologram-row]')).toHaveCount(3);
  await expect(card.locator('[data-hologram-copies]')).toHaveText('3 copies');
  await expect(slot.locator('[data-hologram-next]')).toHaveText('#4');
  const third = card.locator('[data-hologram-row]').nth(2);
  await expect(third).toHaveAttribute('data-lit', '');
  await expect(third.locator('[data-hologram-move]')).toBeVisible();
  await expect(page.locator('#strip-message')).toContainText('#3 of footprint is on the plan');
  let d = await saved(page);
  expect(d.holograms).toHaveLength(3);
  const [, last, copy] = d.holograms;
  expect(copy.id).not.toBe(last.id);
  expect(copy.name).toBe('footprint');
  expect([copy.x, copy.z, copy.angleDeg]).toEqual([50, 6, 90]);
  expect(copy.source.walls).toHaveLength(3);
  // UNDO takes it off.
  await page.locator('#model-undo').click();
  d = await saved(page);
  expect(d.holograms.map(x => x.id)).toEqual(['hologram-1', 'hologram-2']);
});

// A SUITE lands on the level being looked at: #1 stands on MAIN FL, the
// drafter is on 2ND FL, so #2 goes onto 2ND FL.
test('ADD ANOTHER on a suite puts the copy on the level being looked at', async ({ page }) => {
  await open(page, { ...BLANK, holograms: [
    { id: 'hologram-1', name: 'suite', mode: 'suite', x: 4, z: -2, angleDeg: 0, pivotX: 0, pivotZ: 0, source: HOUSE }] });
  await page.goto('/MODEL.html?level=5');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.locator('[data-mode-hologram]').click();
  await page.locator('[data-hologram-add]').click();
  await expect(page.locator('#hologram-ask [data-hologram-row]')).toHaveCount(2);
  await expect(page.locator('#hologram-ask [data-hologram-row]').nth(1).locator('[data-hologram-where]')).toContainText('2ND FL');
  const d = await saved(page);
  expect(d.holograms).toHaveLength(2);
  expect(d.holograms[1].levelMap).toEqual({ 3: 5 });
  expect(d.holograms[0].levelMap).toBeUndefined();
});
