// THE BONEYARD'S LOCKS (Movie, 27 Oct).
//
// "in the middle top part with the floor levels add a checkbox area so the
// user who is controlling one outline on one floor can select the other floor
// with lines that overlap to move locked with how they move the layer they
// are on" -- "maybe on the right side left side will be for BG" -- "lets go
// ALL CHECKED first when they get in there and can uncheck them". And "move
// the BREAK and UNDO ... down to a similar location as we have it for model
// space ... to the left of the bone ... bottom bar area".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const empty = () => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

// A bungalow off the drive-thru, opened in the BONEYARD: FOUNDATION and
// MAIN FL on one 32' x 40' line, x -16..16, z -20..20, the eave 2' out.
async function bungalow(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.openDriveThru(page);
  await page.locator('#dt-tiles [data-build-family="bungalow"]').click();
  await page.locator('#dt-tiles [data-build-entry="bungalow"]').click();
  await page.locator('#dt-bone').click();
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  await page.goto('/BONEYARD.html');
  await expect(page.locator('body')).toHaveAttribute('data-boneyard-ready', '1', { timeout: 10000 });
}
async function tapWorld(page, x, z) {
  const canvas = page.locator('#bones2d');
  const frame = JSON.parse(await canvas.getAttribute('data-frame'));
  const box = await canvas.boundingBox();
  await page.mouse.click(box.x + frame.ox + x * frame.s, box.y + frame.oy + z * frame.s);
}
async function dragWorld(page, from, to) {
  const canvas = page.locator('#bones2d');
  const frame = JSON.parse(await canvas.getAttribute('data-frame'));
  const box = await canvas.boundingBox();
  const at = p => [box.x + frame.ox + p.x * frame.s, box.y + frame.oy + p.z * frame.s];
  await page.mouse.move(...at(from));
  await page.mouse.down();
  await page.mouse.move(...at({ x: (from.x + to.x) / 2, z: (from.z + to.z) / 2 }), { steps: 4 });
  await page.mouse.move(...at(to), { steps: 4 });
  await page.mouse.up();
}
const saved = async (page, n) => {
  await expect(page.locator('body')).toHaveAttribute('data-boneyard-saves', String(n), { timeout: 5000 });
  return h.savedDrawing(page);
};
const span = pts => ({
  x0: Math.min(...pts.map(p => p.x)), x1: Math.max(...pts.map(p => p.x)),
  z0: Math.min(...pts.map(p => p.z)), z1: Math.max(...pts.map(p => p.z)),
});
const mainOf = d => d.outlines.find(o => Number(o.levelId) === 3 && !o.garage);
const fdnX0 = d => Math.min(...d.walls.filter(w => Number(w.levelId) === 1 && w.view === 'foundation')
  .flatMap(w => [w.start.x, w.end.x]));

test('each level row is its LOCK box, the level, then BG -- every box checked, the picked level\'s not a question', async ({ page }) => {
  await bungalow(page);
  await page.locator('[data-bone-level="MAIN FL"]').click();
  const rows = await page.locator('.level-row').evaluateAll(rs => rs.map(r => [...r.children].map(c =>
    c.dataset.boneBg ? 'BG' : c.dataset.boneLevel ? 'LEVEL' : c.querySelector('[data-bone-lock]') ? 'LOCK' : '?')));
  expect(rows.length).toBeGreaterThan(1);
  rows.forEach(r => expect(r).toEqual(['LOCK', 'LEVEL', 'BG']));
  const boxes = page.locator('[data-bone-lock]');
  for (let i = 0; i < await boxes.count(); i += 1) await expect(boxes.nth(i)).toBeChecked();
  await expect(page.locator('[data-bone-lock="MAIN FL"]')).toBeDisabled();
  await expect(page.locator('[data-bone-lock="FOUNDATION"]')).toBeEnabled();
});

test('BREAK and UNDO stand in the foot, left of the middle, where MODEL keeps its verbs', async ({ page }) => {
  await bungalow(page);
  const box = await page.locator('#dt-verbs').boundingBox();
  const foot = await page.locator('#house-strip').boundingBox();
  const vw = page.viewportSize().width;
  for (const id of ['#break', '#undo']) {
    const b = await page.locator(`#dt-verbs ${id}`).boundingBox();
    expect(b, `${id} is on screen in the foot`).not.toBeNull();
    expect(b.y).toBeGreaterThanOrEqual(foot.y - 1);
    expect(b.x + b.width, `${id} left of the middle`).toBeLessThan(vw / 2);
  }
  expect(box.x, 'clear of the page chips').toBeGreaterThan(0);
  await expect(page.locator('.pane-head #break')).toHaveCount(0);
});

test('locked, the foundation goes out with MAIN FL on the same line -- nothing hangs over, no piles', async ({ page }) => {
  await bungalow(page);
  await page.locator('[data-bone-level="MAIN FL"]').click();
  await tapWorld(page, -16, 0);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  const d = await saved(page, 2);
  expect(span(mainOf(d).points).x0).toBeCloseTo(-18, 4);
  expect(fdnX0(d), 'the foundation came with it').toBeCloseTo(-18, 4);
  expect(d.columns.filter(c => c.pileMark === 'P1'), 'no overhang, no piles').toHaveLength(0);
  // A 3' drag lands 3' out, both of them: no ladder to jump it to 4'-6".
  await dragWorld(page, { x: -18, z: 0 }, { x: -21, z: 0 });
  const e = await saved(page, 3);
  expect(span(mainOf(e).points).x0).toBeCloseTo(-21, 4);
  expect(fdnX0(e)).toBeCloseTo(-21, 4);
  expect(e.columns.filter(c => c.pileMark === 'P1')).toHaveLength(0);
});

test('unlocked, MAIN FL stays put when the foundation under it is pushed', async ({ page }) => {
  await bungalow(page);
  await page.locator('[data-bone-level="FOUNDATION"]').click();
  await page.locator('[data-bone-lock="MAIN FL"]').uncheck();
  await tapWorld(page, -16, 0);
  await page.keyboard.press('ArrowLeft');
  const d = await saved(page, 1);
  expect(fdnX0(d)).toBeCloseTo(-17, 4);
  expect(span(mainOf(d).points).x0, 'MAIN FL did not follow').toBeCloseTo(-16, 4);
});

test('unlocked, the ROOF stays put when the wall under it goes out', async ({ page }) => {
  await bungalow(page);
  await page.locator('[data-bone-level="FOUNDATION"]').click();
  await page.locator('[data-bone-lock="ROOF"]').uncheck();
  await tapWorld(page, 0, -20);
  await page.keyboard.press('ArrowUp');
  const d = await saved(page, 1);
  expect(span(mainOf(d).points).z0, 'MAIN FL still follows').toBeCloseTo(-21, 4);
  expect(span(d.roofs.find(r => !r.garage).points).z0, 'the eave did not move').toBeCloseTo(-22, 4);
});

test('BREAK puts the corner on the locked levels on the same line too, and not on an unlocked one', async ({ page }) => {
  await bungalow(page);
  await page.locator('[data-bone-level="FOUNDATION"]').click();
  await page.locator('#break').click();
  await tapWorld(page, -16, 0.3);
  let d = await saved(page, 1);
  expect(mainOf(d).points.map(p => `${p.x},${p.z}`), 'MAIN FL broke at the same foot')
    .toContain('-16,0');
  await expect(page.locator('#status')).toContainText('MAIN FL');
  // MAIN FL unlocked: the next break is the foundation's alone.
  await page.locator('[data-bone-lock="MAIN FL"]').uncheck();
  const before = mainOf(d).points.length;
  await tapWorld(page, -16, 6.2);
  d = await saved(page, 2);
  expect(mainOf(d).points.length).toBe(before);
});
