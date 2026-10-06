// DIMENSIONS ARE PICKED, SLID A ROW AT A TIME, AND DELETED.
//
// Movie, 6 Oct: "with the DIMENSION lines, can they be selectable so i can
// move some if there is a better position". His answers: grabbing one slides
// its WHOLE ROW in or out from the house, staying straight and lined up; a
// moved row KEEPS ITS PLACE when AUTO DIMS runs again (only the measurements
// are new); and a selected dimension DELETES, but is not copied.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const empty = () => ({
  version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 },
  ],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
});

async function openBuilt(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty() });
  await page.goto('/MODEL.html?left=1&right=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.openDriveThru(page);
  await page.locator('[data-build-family="bungalow"]').click();
  await page.locator('[data-build-entry="bungalow"]').click();
  await page.locator('#dt-bone').click();
  await page.waitForTimeout(300);
  await save(page);
  // ON MAIN FL's PLAN, where the strings were laid.
  await page.goto('/MODEL.html?left=1&right=1&level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(300);
}

async function save(page) {
  await expect(page.locator('#save')).toBeEnabled({ timeout: 4000 });
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
}
const saved = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return file ? JSON.parse(await file.text()) : null;
}, BUCKET);

const planDims = file => file.dimensions.filter(d => Number(d.levelId) === 3 && d.view === 'plan');
// A front row of several strings: of the horizontal rows below the house,
// the one holding the most strings.
const frontRow = file => {
  const flat = planDims(file).filter(d => Math.abs(d.start.z - d.end.z) < 1e-6 && d.start.z > 0);
  const rows = new Map();
  flat.forEach(d => { const k = d.start.z.toFixed(4); rows.set(k, [...(rows.get(k) || []), d]); });
  return [...rows.values()].sort((a, b) => b.length - a.length || b[0].start.z - a[0].start.z)[0];
};

// Where the painter draws a dimension's line: 19px off its two points.
async function onLine(page, d) {
  const { at } = await h.planFrame(page);
  const [ax, ay] = at(d.start.x, d.start.z), [bx, by] = at(d.end.x, d.end.z);
  const len = Math.hypot(bx - ax, by - ay);
  const nx = -(by - ay) / len, ny = (bx - ax) / len;
  return [(ax + bx) / 2 + nx * 19, (ay + by) / 2 + ny * 19];
}

test('a dimension is picked off its line and its whole row slides out, square to it', async ({ page }) => {
  await openBuilt(page);
  const before = await saved(page);
  const row = frontRow(before);
  expect(row.length, 'a front row of more than one string').toBeGreaterThan(1);
  const others = planDims(before).filter(d => !row.some(r => r.id === d.id));
  const [x, y] = await onLine(page, row[0]);
  await page.mouse.click(x, y);
  // Selected, then dragged 3 ft further out (down the screen is +z).
  const { scale } = await h.planFrame(page);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 3 * scale, { steps: 6 });
  await page.mouse.up();
  await save(page);
  const after = await saved(page);
  const byId = id => after.dimensions.find(d => d.id === id);
  row.forEach(d => {
    expect(byId(d.id).start.z - d.start.z, `row string ${d.id} moved 3 ft out`).toBeCloseTo(3, 3);
    expect(byId(d.id).start.x, 'and not along itself').toBeCloseTo(d.start.x, 3);
    expect(byId(d.id).moved, 'and remembers the move').toEqual({ axis: 'z', from: d.start.z, by: 3 });
  });
  others.forEach(d => expect(byId(d.id).start, `string ${d.id} off the row stayed put`).toEqual(d.start));

  // ONE UNDO PUTS THE ROW BACK.
  await page.locator('#model-undo').click();
  await save(page);
  const undone = await saved(page);
  row.forEach(d => expect(undone.dimensions.find(u => u.id === d.id).start).toEqual(d.start));
});

test('AUTO DIMS run again keeps a moved row where it was left', async ({ page }) => {
  await openBuilt(page);
  const row = frontRow(await saved(page));
  const [x, y] = await onLine(page, row[0]);
  await page.mouse.click(x, y);
  const { scale } = await h.planFrame(page);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 2 * scale, { steps: 6 });
  await page.mouse.up();
  await page.locator('[data-board-switch] [data-board="drafting"]').click();
  await page.locator('[data-tool-key="dimension"]').click();
  await page.locator('[data-auto-dims]').click();
  await page.waitForTimeout(250);
  await save(page);
  const again = await saved(page);
  const z0 = row[0].start.z;
  const moved = planDims(again).filter(d => Math.abs(d.start.z - (z0 + 2)) < 1e-6);
  expect(moved.length, 'the fresh front row is still 2 ft out').toBe(row.length);
  expect(planDims(again).some(d => Math.abs(d.start.z - z0) < 1e-6 && Math.abs(d.end.z - z0) < 1e-6),
    'nothing left on the old line').toBe(false);
});

test('a selected dimension deletes', async ({ page }) => {
  await openBuilt(page);
  const before = await saved(page);
  const row = frontRow(before);
  const [x, y] = await onLine(page, row[0]);
  await page.mouse.click(x, y);
  await page.keyboard.press('Delete');
  await save(page);
  const after = await saved(page);
  expect(after.dimensions.length).toBe(before.dimensions.length - 1);
  expect(after.dimensions.some(d => d.id === row[0].id), 'the picked one went').toBe(false);
});
