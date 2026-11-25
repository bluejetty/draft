// EVERY CORNER A STAIR DRAWS IS A NODE, INSIDE ONES TOO (jb, 25 Nov 2026:
// "the interior corner of the stair don't SNAP NODES can you make them
// snap?"). The outline corners caught already; now the handrail turning
// across a landing, the U's middle flight, its second landing and its gap
// line, winder ends, and every spot one drawn edge meets another. And on the
// FLOOR LAYOUT, where the stair is the walls plan's drawn behind (BG), its
// corners catch too.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const MAIN_FL = 3;
const base = () => ({
  version: 1, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], roofs: [], fenestrations: [], dimensions: [], floors: [], lines: [],
  outlines: [], shapes: [], notes: [], roomTags: [], columns: [], beams: [],
  boneyardOutlines: [], boneyardShelves: [], groups: [], levelLocks: [], underlays: [], surfaceOpenings: [],
  stairs: [
    { id: 7501, levelId: MAIN_FL, view: 'plan', layer: 'A-STR', start: { x: -2, z: -4 }, end: { x: 4, z: -4 },
      widthFt: 3, riseFt: 9, rail: 'left', shape: 'L', turn: 'right', winders: 0, auto: false },
    { id: 7502, levelId: MAIN_FL, view: 'plan', layer: 'A-STR', start: { x: 14, z: -4 }, end: { x: 20, z: -4 },
      widthFt: 3, riseFt: 9, rail: 'left', shape: 'U', turn: 'right', winders: 0, auto: false },
  ],
});

async function open(page, viewId, bg) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ f, bg }) => {
    localStorage.setItem('draft-bg-layers', JSON.stringify(bg));
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), 'model-drawing');
  }, { f: base(), bg });
  await page.goto(`/MODEL.html?level=${MAIN_FL}&view=${viewId}`);
  await page.waitForFunction(() => typeof drawing !== 'undefined' && drawing?.stairs?.length === 2, null, { timeout: 10000 });
  await page.evaluate(() => { view.cx = 9; view.cz = -1; view.scale = 30; paint(); });
  await page.waitForTimeout(150);
  await page.keyboard.press('l');
  expect(await page.evaluate(() => activeTool)).toBe('line');
  // What the painter draws, read off the stair's own parts.
  return page.evaluate(() => {
    const SG = window.DraftStairGeometry;
    const levels = stairLevels();
    const partsOf = st => SG.stairPlanParts(st, SG.stairCurrentLayout(st, levels));
    const [L, U] = drawing.stairs.map(partsOf);
    return {
      outline: drawing.stairs.flatMap(st => stairOutlineOf(st).corners),
      lRail: L.rails.flat(),
      uMiddle: SG.stairFootprintRings(U, drawing.stairs[1]).flat(),
      uLandings: (U.landings || []).flatMap(l => l.poly),
      uGap: U.gap || [],
      nodes: stairSnapNodes(),
    };
  });
}
const has = (nodes, p) => nodes.some(n => Math.abs(n.x - p.x) < 1e-4 && Math.abs(n.z - p.z) < 1e-4);
const attr = async (page, name) => JSON.parse(await page.locator('#plan').getAttribute(name) || 'null');
const r4 = n => Number(n.toFixed(4)) + 0;

test('walls plan: every outline corner, and the inside ones, are nodes', async ({ page }) => {
  const f = await open(page, 'plan', []);
  f.outline.forEach(p => expect(has(f.nodes, p), `outline ${p.x},${p.z}`).toBe(true));
  expect(f.lRail.length, 'the L has a rail').toBeGreaterThan(2);
  f.lRail.forEach(p => expect(has(f.nodes, p), `L rail ${p.x},${p.z}`).toBe(true));
  f.uMiddle.forEach(p => expect(has(f.nodes, p), `U run/middle ${p.x},${p.z}`).toBe(true));
  expect(f.uLandings.length, 'the U has its two landings').toBeGreaterThanOrEqual(8);
  f.uLandings.forEach(p => expect(has(f.nodes, p), `U landing ${p.x},${p.z}`).toBe(true));
  f.uGap.forEach(p => expect(has(f.nodes, p), `U gap ${p.x},${p.z}`).toBe(true));
  // More than the outline had: the inside corners are new.
  expect(f.nodes.length).toBeGreaterThan(new Set(f.outline.map(p => `${p.x},${p.z}`)).size);
});

test('LINE starts on the L\'s rail corner, inside the stair', async ({ page }) => {
  const f = await open(page, 'plan', []);
  // The rail's turn: a vertex that is not one of its ends.
  const c = f.lRail[1];
  expect(has(f.outline, c), 'the rail corner is inside the outline, not on it').toBe(false);
  const [x, y] = (await h.planFrame(page)).at(c.x, c.z);
  await page.mouse.move(x + 2, y + 2);
  await page.waitForTimeout(150);
  expect(await attr(page, 'data-snap-node')).toEqual([r4(c.x), r4(c.z)]);
});

test('FLOOR LAYOUT: the stair drawn from the walls plan (BG) has its nodes', async ({ page }) => {
  const f = await open(page, 'floor', [`${MAIN_FL}:plan`]);
  f.outline.forEach(p => expect(has(f.nodes, p), `outline ${p.x},${p.z}`).toBe(true));
  f.lRail.forEach(p => expect(has(f.nodes, p), `L rail ${p.x},${p.z}`).toBe(true));
  const c = f.outline[0];
  const [x, y] = (await h.planFrame(page)).at(c.x, c.z);
  await page.mouse.move(x + 2, y + 2);
  await page.waitForTimeout(150);
  expect(await attr(page, 'data-snap-node')).toEqual([r4(c.x), r4(c.z)]);
});

test('FLOOR LAYOUT with the walls plan not lit behind it draws no stair, and has no stair nodes', async ({ page }) => {
  const f = await open(page, 'floor', []);
  expect(f.nodes).toEqual([]);
});
