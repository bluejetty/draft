// A SUITE'S CORNERS IN ITS UNIT'S COLOUR (Movie, 23 Oct, with his plan of five
// suites): "make the AQUA corner NODES on the imported suite/shelfs ... match
// the chart for each unit type" (the HOLOGRAM panel's colour per file) --
// "will be easier for a user to identify them" -- and "in the little SHELF
// layout in the middle above the bone can you show the corner colors so they
// can easily identify each suite type (right now its just grey)". The gold
// registration corner stays gold.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const P = (x, z) => ({ x, y: 0, z });
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 },
  { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
const EMPTY = { walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [],
  beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [] };
const W = (id, a, b, levelId = 3) => ({ id, start: P(...a), end: P(...b), levelId, view: 'plan',
  wallType: 'stud_2x4', refLine: 'center', baseHeight: 0, topHeight: 8 });
const box = (id, x, z, w, d, levelId = 3) => [W(`${id}n`, [x, z], [x + w, z], levelId), W(`${id}e`, [x + w, z], [x + w, z + d], levelId),
  W(`${id}s`, [x + w, z + d], [x, z + d], levelId), W(`${id}w`, [x, z + d], [x, z], levelId)];
// A suite file: a 20 x 12 box on its MAIN FL.
const suiteFile = () => ({ version: 1, board: 'drafting', planTurn: 0, levels: LEVELS, activeLevelIdx: 2,
  ...EMPTY, walls: box('u', 0, 0, 20, 12), suiteKind: 'residential' });
const holo = (id, name, x, colour) => ({ id, name, mode: 'suite', x, z: 20, angleDeg: 0, pivotX: 0, pivotZ: 0,
  layer: 'HOLOGRAM', colour, source: suiteFile() });
// The house: two suites on the plan, 1BDEN (green, colour 2) and 2BD
// (magenta, colour 3); four shelves, the first two the suites' own, the
// third a box no copy has come from, the fourth empty (so its square has no
// gold corner to count, which is what shows the squares' paint keeping its
// hands off the sheet's count).
const drawing = () => ({ version: 1, board: 'drafting', planTurn: 0, levels: LEVELS, activeLevelIdx: 2, ...EMPTY,
  walls: [W('a', [0, 0], [80, 0]), W('b', [80, 0], [80, 40]),
    ...box('s1', 100, 40, 20, 12, -1), ...box('s2', 0, 0, 24, 12, -2), ...box('s3', 0, 0, 16, 12, -3)],
  holograms: [holo('h1', '1BDEN', 10, 2), holo('h2', '2BD', 40, 3)],
  boneyardShelves: [{ id: 1, name: '1BDEN' }, { id: 2, name: '2BD' }, { id: 3, name: 'SHELF 3' }, { id: 4, name: 'SHELF 4' }],
  nextBoneyardShelfId: 5, activeBoneyardShelfId: 1, nextDrawingItemId: 60 });

async function open(page, f = drawing()) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html?level=3&right=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(200);
}
const rgb = s => (String(s).match(/\d+/g) || []).slice(0, 3).map(Number);
const near = (a, b, tol = 24) => a.length === 3 && a.every((v, i) => Math.abs(v - b[i]) <= tol);
const inks = page => page.evaluate(() => ({
  green: window.DraftHologram.COLOURS[2].ink, magenta: window.DraftHologram.COLOURS[3].ink,
  gold: (() => { const d = document.createElement('div'); d.style.color = 'var(--draw-origin)'; document.body.append(d);
    const c = getComputedStyle(d).color; d.remove(); return c; })(),
}));
const AQUA = [30, 242, 255];
// The ink on a node's RING: its stroke stands 6px off the point, 2px wide.
// The darkest-to-brightest of three samples across it is the stroke.
const ringInk = (page, sx, sy) => page.evaluate(({ sx, sy }) => {
  const c = document.getElementById('plan'), r = c.getBoundingClientRect(), k = c.width / r.width;
  const g = c.getContext('2d');
  return [5, 6, 7].map(dx => Array.from(g.getImageData(Math.round((sx + dx - r.left) * k), Math.round((sy - r.top) * k), 1, 1).data).slice(0, 3));
}, { sx, sy });
const hasInk = (samples, ink) => samples.some(s => near(s, ink));
// How many of a canvas's pixels are within reach of a colour.
const count = (loc, ink) => loc.evaluate((c, ink) => {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] > 200 && Math.abs(d[i] - ink[0]) <= 24 && Math.abs(d[i + 1] - ink[1]) <= 24 && Math.abs(d[i + 2] - ink[2]) <= 24) n += 1;
  }
  return n;
}, ink);

test('on the plan, each suite\'s corner rings wear its file\'s colour, and the registration corner stays gold', async ({ page }) => {
  await open(page);
  const { green, magenta, gold } = await inks(page);
  const { at } = await h.planFrame(page);
  const f = drawing();
  for (const [hg, ink] of [[f.holograms[0], rgb(green)], [f.holograms[1], rgb(magenta)]]) {
    const nodes = await page.evaluate(hg => window.DraftHologram.suiteSuperNodes(hg, 3), hg);
    expect(nodes).toHaveLength(4);
    expect(nodes.filter(n => n.registration)).toHaveLength(1);
    for (const n of nodes) {
      const samples = await ringInk(page, ...at(n.point.x, n.point.z));
      if (n.registration) expect(hasInk(samples, rgb(gold)), `${hg.name} registration corner gold`).toBe(true);
      else expect(hasInk(samples, ink), `${hg.name} corner in its colour, got ${JSON.stringify(samples)}`).toBe(true);
      expect(hasInk(samples, AQUA), 'no aqua left').toBe(false);
    }
  }
});

test('the shelf squares above the bone paint each shelf\'s corners in its copies\' colour; a shelf no copy came from keeps aqua', async ({ page }) => {
  await open(page);
  if (await page.locator('#shelf-previews').isHidden()) await page.locator('#shelf-tab').click();
  await expect(page.locator('.shelf-preview')).toHaveCount(4);
  const { green, magenta } = await inks(page);
  const square = i => page.locator('.shelf-preview').nth(i).locator('canvas');
  await expect.poll(() => count(square(0), rgb(green)), '1BDEN in green').toBeGreaterThan(4);
  expect(await count(square(0), AQUA), 'and not aqua').toBe(0);
  await expect.poll(() => count(square(1), rgb(magenta)), '2BD in magenta').toBeGreaterThan(4);
  await expect.poll(() => count(square(2), AQUA), 'SHELF 3 in the plain aqua').toBeGreaterThan(4);
  expect(await count(square(2), rgb(green))).toBe(0);
  // THE SHEET'S COUNT IS THE SHEET'S: the squares paint after it, the empty
  // SHELF 4 last of all with no gold corner, and the sheet still says two
  // (one registration corner per suite on the plan).
  await page.waitForTimeout(300);
  expect(await page.locator('#plan').getAttribute('data-gold-super-nodes')).toBe('2');
});

test('on the shelf itself the corners wear the same colour, and its registration corner is gold', async ({ page }) => {
  await open(page);
  if (await page.locator('#shelf-previews').isHidden()) await page.locator('#shelf-tab').click();
  await page.locator('.shelf-preview').nth(0).click();
  await expect(page.locator('#readout')).toContainText('walls 4/');
  await page.waitForTimeout(200);
  const { green, gold } = await inks(page);
  const { at } = await h.planFrame(page);
  const nodes = await page.evaluate(walls => window.DraftHologram.shelfSuperNodes(walls, -1), drawing().walls);
  expect(nodes).toHaveLength(4);
  expect(nodes.filter(n => n.registration), 'one of the four is the registration corner').toHaveLength(1);
  for (const n of nodes) {
    const samples = await ringInk(page, ...at(n.point.x, n.point.z));
    expect(hasInk(samples, n.registration ? rgb(gold) : rgb(green)), `corner ${n.id}: ${JSON.stringify(samples)}`).toBe(true);
  }
  expect(await page.locator('#plan').getAttribute('data-gold-super-nodes')).toBe('1');
});

// A TURNED DRAWING (Movie, 23 Oct: "how come the lower left corner is gold?
// ... only the TARGET node should be gold"): the target the sheet draws on
// a shelf follows the HOUSE turn, and the registration was read at turn 0,
// so the two sat on different corners and both were gold. The gold corner
// is the one the target names, at the drawing's own turn.
test('on a turned drawing the shelf\'s gold corner is the one under the target, and it alone', async ({ page }) => {
  const f = drawing();
  f.planTurn = 1;
  await open(page, f);
  if (await page.locator('#shelf-previews').isHidden()) await page.locator('#shelf-tab').click();
  await page.locator('.shelf-preview').nth(0).click();
  await expect(page.locator('#readout')).toContainText('walls 4/');
  await page.waitForTimeout(200);
  const { green, gold } = await inks(page);
  const { at } = await h.planFrame(page);
  const { nodes, target } = await page.evaluate(walls => {
    const WT = window.DraftWallTypes;
    const thicknessFt = w => (WT.WALL_TYPES.find(t => t.id === w.wallType)?.totalIn || 0) / 12;
    const own = walls.filter(w => w.levelId === -1).map(w => ({ ...w, levelId: 3 }));
    return { nodes: window.DraftHologram.shelfSuperNodes(walls, -1, 1),
      target: window.DraftCutMarks.siteDatum(own, { turn: 1, thicknessFt }) };
  }, drawing().walls);
  const atTurn0 = await page.evaluate(walls => window.DraftHologram.shelfSuperNodes(walls, -1).find(n => n.registration).point, drawing().walls);
  const reg = nodes.find(n => n.registration);
  expect(reg, 'one corner is the registration').toBeTruthy();
  expect(Math.hypot(reg.point.x - target.x, reg.point.z - target.z), 'and it is the corner under the target').toBeLessThan(1);
  expect(Math.hypot(reg.point.x - atTurn0.x, reg.point.z - atTurn0.z), 'not the corner turn 0 would pick').toBeGreaterThan(1);
  for (const n of nodes) {
    const samples = await ringInk(page, ...at(n.point.x, n.point.z));
    expect(hasInk(samples, n.registration ? rgb(gold) : rgb(green)), `corner ${n.id}: ${JSON.stringify(samples)}`).toBe(true);
  }
  expect(await page.locator('#plan').getAttribute('data-gold-super-nodes')).toBe('1');
});

test('a shelf with super nodes of its own shows those, not the four corners', async ({ page }) => {
  // The same rule a suite has: its own super nodes replace the corners. The
  // 1BDEN shelf gets one of its own on its target corner; its square draws
  // that one gold and no green ring, and the sheet, standing on the shelf,
  // counts one gold node, not two.
  const f = drawing();
  f.superNodes = [{ id: 'sn1', levelId: -1, view: 'plan', point: P(100 - 1.75 / 12, 52 + 1.75 / 12) }];
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html?level=3&right=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  if (await page.locator('#shelf-previews').isHidden()) await page.locator('#shelf-tab').click();
  const { green } = await inks(page);
  await page.waitForTimeout(300);
  expect(await count(page.locator('.shelf-preview').nth(0).locator('canvas'), rgb(green)), 'no green corner in its square').toBe(0);
  await page.locator('.shelf-preview').nth(0).click();
  await expect(page.locator('#readout')).toContainText('walls 4/');
  await page.waitForTimeout(300);
  expect(await page.locator('#plan').getAttribute('data-gold-super-nodes')).toBe('1');
});
