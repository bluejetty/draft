// A LOOP PULLED ACROSS ITSELF IS TWO LOOPS (jb, 14 Nov 2026, from ArchiCAD:
// "on the roof i noticed if i have square and take one side and break it and
// pull it across and over the other side edge, with archicad it would split
// it into 2 shapes when i finish the command, but in my program it creates
// an inverted shape"; "for floors and shapes i think i'd also like this").
//
// A broken edge's half pushed past the far edge used to spring back on a
// SHAPE / FLOOR ("would cross itself") and leave a bow-tie on a roof. Now
// the ring is cut at the crossing when the drag lets go: each lobe is its
// own item of the same kind and properties, both picked, ONE UNDO joins
// them back. A corner dragged across does the same.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
const W = 8, D = 4;
const base = () => ({
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  walls: [], lines: [], outlines: [],
  floors: [], roofs: [], fenestrations: [], dimensions: [],
  shapes: [], surfaceOpenings: [], stairs: [], notes: [], roomTags: [],
  columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
  board: 'drafting',
});
const BOX = [V(-W, -D), V(W, -D), V(W, D), V(-W, D)];
const shapeFixture = () => ({ ...base(),
  shapes: [{ id: 'sa', levelId: 3, points: [V(-W, -D), V(W, -D), V(W, D), V(0, D), V(-W, D)].map(p => ({ x: p.x, z: p.z })), layer: 'SHAPE', hatch: 'dots', style: 'dashed', label: 'DECK' }],
  groups: [{ id: 'group-1', name: 'ASSEMBLY 1', fixed: false, stretchBehavior: 'item-geometry', members: [{ type: 'shape', id: 'sa' }], wallSettings: null }],
});
const floorFixture = () => ({ ...base(),
  floors: [{ id: 'fa', levelId: 3, view: 'floor', points: [V(-W, -D), V(W, -D), V(W, D), V(0, D), V(-W, D)], structure: 'floor', garage: false, slopeInPerFt: 0, thickness: 1, thickenedEdge: false, assembly: { joist: '2x10' } }],
});

async function open(page, saved, url = '/MODEL.html?left=1') {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, file }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(file)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, file: saved });
  await page.goto(url);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('s');
  await page.evaluate(() => { tsquareOn = true; footOn = true; });
}
const rounded = pts => pts.map(p => [Math.round(p.x * 100) / 100 + 0, Math.round(p.z * 100) / 100 + 0]);
const loops = (page, list) => page.evaluate(k => drawing[k].map(item => ({ id: item.id, points: item.points })), list);
const sel = page => page.evaluate(() => selection.map(e => `${e.type}:${e.item.id}`));
const strip = page => page.evaluate(() => stripNotice);
const sameRing = (got, want) => {
  if (got.length !== want.length) return false;
  const n = want.length;
  return [...Array(n).keys()].some(s => want.every((p, k) => {
    const q = got[(k + s) % n];
    return Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[1] - q[1]) < 1e-6;
  }));
};
const lobe = (list, want) => list.find(item => sameRing(rounded(item.points), want));

// The south edge is broken at x=0: grab the east half 2 ft east of the
// node (clear of the midpoint handle) and pull it to `toZ`.
async function pullEastHalf(page, toZ) {
  const { at } = await h.planFrame(page);
  await page.mouse.click(...at(0, 0)); // picked from inside
  await page.waitForTimeout(120);
  // The fixtures carry the BREAK node already (BREAK itself is
  // push-pull-jog.spec.js's; on a picked assembly the key is BUST).
  const [gx, gy] = at(2, D);
  await page.mouse.move(gx, gy);
  await page.mouse.down();
  await page.mouse.move(gx + 1, gy - 8);
  await page.mouse.move(...at(2, toZ), { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(150);
}
const EAST_LOBE = [[0, -D], [W, -D], [W, -W], [0, -W]];
const WEST_LOBE = [[0, -D], [0, D], [-W, D], [-W, -D]];

for (const [kind, list, fixture, url] of [['shape', 'shapes', shapeFixture, undefined], ['floor', 'floors', floorFixture, '/MODEL.html?left=1&level=3&view=floor']]) {
  test(`${kind}: the east half pulled past the north edge splits it in two of the same kind and properties; UNDO joins them`, async ({ page }) => {
    await open(page, fixture(), url);
    await pullEastHalf(page, -W);
    const after = await loops(page, list);
    expect(after.length, 'two now').toBe(2);
    const east = lobe(after, EAST_LOBE), west = lobe(after, WEST_LOBE);
    expect(east, 'the pulled half is its own loop beyond the north edge').toBeTruthy();
    expect(west, 'what stayed is the other').toBeTruthy();
    expect(east.id).not.toBe(west.id);
    expect(after.every(item => item.id !== (kind === 'shape' ? 'sa' : 'fa')), 'fresh ids').toBe(true);
    expect(await sel(page), 'both picked').toEqual(expect.arrayContaining([`${kind}:${east.id}`, `${kind}:${west.id}`]));
    const props = await page.evaluate(k => drawing[k].map(item => (k === 'shapes'
      ? [item.hatch, item.style, item.label, item.layer, item.levelId]
      : [item.structure, item.thickness, item.assembly.joist, item.view, item.levelId, item.points.every(p => p.y === 0)])), list);
    expect(props[0], 'same properties').toEqual(props[1]);
    expect(props[0]).toEqual(kind === 'shape' ? ['dots', 'dashed', 'DECK', 'SHAPE', 3] : ['floor', 1, '2x10', 'floor', 3, true]);
    if (kind === 'shape') {
      expect(await page.evaluate(() => drawing.groups[0].members.map(m => `${m.type}:${m.id}`)), 'both took the one shape’s place in its assembly')
        .toEqual([`shape:${after[0].id}`, `shape:${after[1].id}`]);
    }
    expect(await strip(page)).toMatch(/now 2 (shapes|floors)/);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(150);
    const back = await loops(page, list);
    expect(back.length, 'UNDO: one again').toBe(1);
    expect(back[0].id).toBe(kind === 'shape' ? 'sa' : 'fa');
    expect(sameRing(rounded(back[0].points), [[-W, -D], [W, -D], [W, D], [0, D], [-W, D]]), 'UNDO: the broken box as it stood').toBe(true);
    if (kind === 'shape') expect(await page.evaluate(() => drawing.groups[0].members.map(m => m.id))).toEqual(['sa']);
  });
}

test('shape: a corner dragged across the far edge splits it too', async ({ page }) => {
  await open(page, shapeFixture());
  const { at } = await h.planFrame(page);
  await page.mouse.click(...at(0, 0));
  await page.waitForTimeout(120);
  // The south-east corner (W, D) dragged to (-W - 4, -D - 4): the ring
  // (-W,-D) (W,-D) (-12,-8) (-W,D) crosses itself once.
  await page.mouse.move(...at(W, D));
  await page.mouse.down();
  await page.mouse.move(...at(W - 1, D - 1));
  await page.mouse.move(...at(-W - 4, -D - 8), { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const after = await loops(page, 'shapes');
  expect(after.length, 'two shapes').toBe(2);
  expect(await sel(page)).toHaveLength(2);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  expect((await loops(page, 'shapes')).length, 'UNDO').toBe(1);
});

test('shape: a loop with an arc corner still springs back rather than split', async ({ page }) => {
  const f = shapeFixture();
  f.shapes[0].points[1].bulge = 0.3;
  await open(page, f);
  await pullEastHalf(page, -W);
  const after = await loops(page, 'shapes');
  expect(after.length).toBe(1);
  expect(await strip(page)).toMatch(/cross itself, so it goes back/);
});

// ── A ROOF PIECE UNDER MOVE ───────────────────────────────────────────────
const EAVE = [[-W, -W], [0, -W], [W, -W], [W, W], [-W, W]];
const roofFixture = () => ({ ...base(),
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 1, planTurn: 0,
  roofs: [{ id: 'roof-1', levelId: 7, follows: 'none', pitch: 4, overhang: 1, fascia: 10, fasciaFinish: 'stucco',
    points: EAVE.map(([x, z]) => ({ x, y: 0, z })), edges: ['eave', 'eave', 'gable', 'gable', 'gable'],
    edgeOverhang: [1, 1, 1, 1, 1], footprint: EAVE.map(([x, z]) => ({ x: x * 0.875, y: 0, z: z * 0.875 })) }],
  groups: [{ id: 'group-1', name: 'ROOF PIECES 1', fixed: false, stretchBehavior: 'item-geometry', members: [{ type: 'roof', id: 'roof-1' }], wallSettings: null }],
});

test('roof: the top eave is broken at x=0; its east half pulled past the bottom edge splits the roof in two, edge kinds kept; UNDO joins them', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, file }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(file)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, file: roofFixture() });
  await page.goto('/MODEL.html?level=7');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  await page.evaluate(() => { tsquareOn = true; footOn = true; });
  const { at } = await h.planFrame(page);
  await page.mouse.click(...at(0, 0));
  await page.waitForTimeout(120);
  expect(await sel(page)).toEqual(['roof:roof-1']);
  await page.locator('#model-move').click();
  await expect(page.locator('#model-move')).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.move(...at(4, -W));
  await page.mouse.down();
  await page.mouse.move(...at(4, W + 4), { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => drawing.roofs.map(r => ({ id: r.id, points: r.points, edges: r.edges, over: r.edgeOverhang,
    pitch: r.pitch, fascia: r.fascia, fasciaFinish: r.fasciaFinish, follows: r.follows, footprint: r.footprint, levelId: r.levelId })));
  expect(after.length, 'two roofs').toBe(2);
  const west = lobe(after, [[0, W], [-W, W], [-W, -W], [0, -W]]);
  const east = lobe(after, [[0, W], [0, W + 4], [W, W + 4], [W, W]]);
  expect(west, 'the lobe that stayed').toBeTruthy();
  expect(east, 'the pulled half, beyond the bottom edge').toBeTruthy();
  // EDGE KINDS FOLLOW THE EDGE EACH NEW EDGE LIES ALONG: the west lobe runs
  // (0,W)->(-W,W) along the old bottom gable, up the west gable, along the
  // top eave to the node, then the jog back down -- the jog took the moved
  // eave's own kind.
  const kindsAt = (item, want) => { const r = rounded(item.points); const s = r.findIndex(p => p[0] === want[0] && p[1] === want[1]); return item.edges.slice(s).concat(item.edges.slice(0, s)); };
  expect(kindsAt(west, [0, W])).toEqual(['gable', 'gable', 'eave', 'eave']);
  expect(kindsAt(east, [0, W])).toEqual(['eave', 'eave', 'gable', 'gable']);
  after.forEach(r => {
    expect(r.over.every(o => o === 1), 'every edge keeps its overhang').toBe(true);
    expect([r.pitch, r.fascia, r.fasciaFinish, r.follows, r.levelId]).toEqual([4, 10, 'stucco', 'none', 7]);
    expect(r.footprint, 'the wall line is worked out again').toBeUndefined();
    expect(r.id).not.toBe('roof-1');
  });
  expect(await sel(page)).toEqual(expect.arrayContaining([`roof:${west.id}`, `roof:${east.id}`]));
  expect(await page.evaluate(() => drawing.groups[0].members.map(m => m.id))).toEqual(after.map(r => r.id));
  expect(await strip(page)).toMatch(/now 2 roofs/);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  const back = await loops(page, 'roofs');
  expect(back.length, 'UNDO: one roof').toBe(1);
  expect(back[0].id).toBe('roof-1');
  expect(rounded(back[0].points), 'UNDO: the broken square as it stood').toEqual([[-W, -W], [0, -W], [W, -W], [W, W], [-W, W]]);
  expect(await page.evaluate(() => drawing.groups[0].members.map(m => m.id))).toEqual(['roof-1']);
});
