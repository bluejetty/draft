// Checklist 10: run every generator twice with no edits between and diff the
// saved drawing. Anything that grows on the second run compounds over a work
// session and can reach paper (doubled ink, doubled dims).
const { test, expect } = require('@playwright/test');
const h = require('../tests/helpers.js');

async function traceHouse(page, pts) {
  await h.selectTool(page, 'Outline');
  for (const [x, z] of pts) await h.clickWorld(page, x, z);
  await h.climbTourToMain(page);
}

function counts(d) {
  return Object.fromEntries(['lines', 'walls', 'floors', 'shapes', 'roofs', 'fenestrations',
    'fixtures', 'surfaceOpenings', 'dimensions', 'columns', 'beams', 'stairs', 'notes', 'roomTags']
    .map(k => [k, (d[k] || []).length]));
}

test('R2: BUILD HOUSE twice — collections and ids', async ({ page }) => {
  await h.openModel(page);
  await traceHouse(page, [[-14, -10], [14, -10], [14, 10], [-14, 10], [-14, -10]]);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  const first = await h.savedDrawing(page);
  await page.locator('[data-build-house]').click();
  await page.waitForTimeout(800);
  const second = await h.savedDrawing(page);
  console.log('BUILD 1:', JSON.stringify(counts(first)));
  console.log('BUILD 2:', JSON.stringify(counts(second)));
  console.log('nextIds 1/2:', first.nextDrawingItemId, second.nextDrawingItemId,
    '| dims', first.nextDimensionId, second.nextDimensionId);
  const a = JSON.stringify(first), b = JSON.stringify(second);
  console.log('byte-identical:', a === b, '| bytes', a.length, b.length);
  expect(counts(second)).toEqual(counts(first));
});

test('R2b: AUTO DIMS twice', async ({ page }) => {
  await h.openModel(page);
  await traceHouse(page, [[-14, -10], [14, -10], [14, 10], [-14, 10], [-14, -10]]);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  await h.selectTool(page, 'Dimension');
  await page.getByRole('button', { name: 'AUTO DIMS' }).click();
  await h.waitForSaved(page);
  const first = await h.savedDrawing(page);
  await page.getByRole('button', { name: 'AUTO DIMS' }).click();
  await h.waitForSaved(page);
  const second = await h.savedDrawing(page);
  console.log('dims 1:', (first.dimensions || []).length, 'dims 2:', (second.dimensions || []).length,
    '| nextDimensionId', first.nextDimensionId, second.nextDimensionId);
  const strip = d => (d.dimensions || []).map(x => `${x.start.x},${x.start.z}->${x.end.x},${x.end.z}`).sort();
  console.log('geometry identical:', JSON.stringify(strip(first)) === JSON.stringify(strip(second)));
  expect(JSON.stringify(strip(second))).toBe(JSON.stringify(strip(first)));
});

test('R2c: ROOM TAGS twice', async ({ page }) => {
  await h.openModel(page);
  await traceHouse(page, [[-14, -10], [14, -10], [14, 10], [-14, 10], [-14, -10]]);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  await h.selectTool(page, 'Annotation');
  await page.locator('[data-room-tags]').click();
  await h.waitForSaved(page);
  const first = await h.savedDrawing(page);
  await page.locator('[data-room-tags]').click();
  await h.waitForSaved(page);
  const second = await h.savedDrawing(page);
  console.log('tags 1:', (first.roomTags || []).length, 'tags 2:', (second.roomTags || []).length,
    '| nextRoomTagId', first.nextRoomTagId, second.nextRoomTagId);
  console.log('tags1:', JSON.stringify((first.roomTags || []).map(t => [t.id, t.name, t.at.x, t.at.z])));
  console.log('tags2:', JSON.stringify((second.roomTags || []).map(t => [t.id, t.name, t.at.x, t.at.z])));
  expect((second.roomTags || []).length).toBe((first.roomTags || []).length);
});
