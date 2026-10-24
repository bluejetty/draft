// A FLOOR'S CORNERS TAKE THE T-SQUARE, AND A FIXTURE'S CORNERS ARE NODES TO IT
// (Movie, 23 Oct: "and the FLOORING , the T and NODES don't seem to work can
// you fix that so the TSQuare will work and make the corners of tub and sink
// mini- snap nodes if possible for connecting the flooring").
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center', baseHeight: 0, topHeight: 8 });
const drawing = (extra = {}) => ({
  version: 1, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 20,
  walls: [W('n', [0, 0], [16, 0]), W('e', [16, 0], [16, 12]), W('s', [16, 12], [0, 12]), W('w', [0, 12], [0, 0])],
  lines: [], floors: [], roofs: [], dimensions: [], fenestrations: [], fixtures: [],
  outlines: [], shapes: [], surfaceOpenings: [], notes: [], stairs: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
  ...extra,
});
async function open(page, f) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    try { localStorage.removeItem('draft-skin'); } catch { /* fine */ }
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html?level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  const levels = page.getByRole('button', { name: 'LEVELS / LAYERS' });
  if (await levels.count() && await levels.getAttribute('aria-expanded') === 'true') await levels.click();
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
const saved = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};
const press = async (page, at, x, z, dx = 0, dy = 0) => {
  const [px, py] = at(x, z);
  await page.mouse.move(px + dx, py + dy);
  await page.waitForTimeout(50);
  await page.mouse.click(px + dx, py + dy);
  await page.waitForTimeout(80);
};
const r3 = n => Math.round(n * 1000) / 1000;
async function tsquare(page, on) {
  const chip = page.locator('[data-mode-tsquare]');
  const lit = /\blit\b/.test(await chip.getAttribute('class') || '');
  if (lit !== on) await chip.click();
}

test('T-square lit: each floor corner is squared to the one before it', async ({ page }) => {
  const { at } = await open(page, drawing());
  await tsquare(page, true);
  await h.armFromRail(page, 'floor');
  // Off square by half a foot each time; the square takes it out.
  await press(page, at, 3, 3);
  await press(page, at, 9, 3.5);
  await press(page, at, 9.5, 8);
  await press(page, at, 3, 8.4);
  await press(page, at, 3, 3);
  const d = await saved(page);
  expect(d.floors, 'one floor').toHaveLength(1);
  const pts = d.floors[0].points.map(p => [r3(p.x), r3(p.z)]);
  // Every edge runs straight across or straight down.
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    expect(p[0] === q[0] || p[1] === q[1], `edge ${i} square: ${p} -> ${q}`).toBe(true);
  });
});

test('a vanity\'s corners are nodes to a floor: a corner pressed a few pixels off lands on it exactly', async ({ page }) => {
  const vanity = { id: 'v1', wallId: 'n', levelId: 3, view: 'plan', kind: 'vanity', layer: 'A-FIXT',
    offset: 8, width: 3, depth: 2, side: 1 };
  const { at } = await open(page, drawing({ fixtures: [vanity] }));
  await tsquare(page, false);
  // The vanity's own box, worked out by the page's own geometry.
  const box = await page.evaluate(f => {
    const walls = [{ id: 'n', start: { x: 0, y: 0, z: 0 }, end: { x: 16, y: 0, z: 0 }, levelId: 3, view: 'plan',
      wallType: 'stud_2x4', refLine: 'center' }];
    return window.DraftFixtureGeometry.fixtureGeometry(walls, f).corners.map(c => ({ x: c.x, z: c.z }));
  }, vanity);
  const front = box[2];
  await h.armFromRail(page, 'floor');
  await press(page, at, front.x, front.z, 3, 2);
  await press(page, at, 12, 9);
  await press(page, at, 6, 9);
  await press(page, at, front.x, front.z, 3, 2);
  const d = await saved(page);
  expect(d.floors, 'one floor').toHaveLength(1);
  const first = d.floors[0].points[0];
  expect([r3(first.x), r3(first.z)], 'on the vanity\'s corner').toEqual([r3(front.x), r3(front.z)]);
});
