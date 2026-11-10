// PUSH / PULL A BROKEN PIECE (jb, 10 Nov 2026): "i just broke the front of
// the garage wall into 2 pieces, now i would like to grab the left side or
// right side and either move it in a foot or out a foot, and allow for
// creation of a new wall that joins them and is perpendicular to them, and
// share the same properties, as a lines, or wall or other".
//
// A wall or line slid square (T-SQUARE lit) whose neighbour at an end runs
// IN LINE with it gets a JOG piece there -- same kind, same properties,
// square to both -- instead of tilting the neighbour into a diagonal. The
// far end stretches as it always did. Pushed back flush, the jog goes.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
const W = 8, D = 4;
const WALL = ([id, start, end]) => ({
  id, start, end, levelId: 3, view: 'plan',
  wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
});
const LINE = ([id, start, end]) => ({
  id, start, end, levelId: 3, view: 'plan', layer: 'draft', style: 'dashed', weight: 4, bulge: 0,
});
const BOX = [
  ['n', V(-W, -D), V(W, -D)],
  ['e', V(W, -D), V(W, D)],
  ['s', V(W, D), V(-W, D)],
  ['w', V(-W, D), V(-W, -D)],
];
const fixture = kind => ({
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  walls: kind === 'wall' ? BOX.map(([id, a, b]) => WALL([`w-${id}`, a, b])) : [],
  lines: kind === 'line' ? BOX.map(([id, a, b]) => LINE([`l-${id}`, a, b])) : [],
  // THE BONE under the walls, so the ring is seen to follow the jog.
  outlines: kind === 'wall'
    ? [{ id: 'o-1', levelId: 3, view: 'plan', points: [V(-W, -D), V(W, -D), V(W, D), V(-W, D)] }] : [],
  floors: [], roofs: [], fenestrations: [], dimensions: [],
  shapes: [], surfaceOpenings: [], stairs: [], notes: [], roomTags: [],
  columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
  board: 'drafting',
});

async function open(page, saved) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, file }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(file)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, file: saved });
  await page.goto('/MODEL.html?left=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect(page.locator('[data-sel-mode]').first()).toBeVisible();
  await page.keyboard.press('s');
  // THE T-SQUARE AND THE FOOT LIGHT, stated: the jog is the square drag's.
  await page.evaluate(() => { tsquareOn = true; footOn = true; });
  // LINES FROM A FILE STAND ON THEIR OWN POINTS; drawn ones share pooled
  // corners (commitDrawn pools a line's ends). Pooled here, as drawn.
  await page.evaluate(() => lines().forEach(l => {
    l.start = poolVertex(l.start, l.levelId, l.view); l.end = poolVertex(l.end, l.levelId, l.view);
  }));
}
const segs = (page, kind) => page.evaluate(k => (k === 'wall' ? walls() : lines())
  .map(s => ({ id: s.id, a: [s.start.x, s.start.z], b: [s.end.x, s.end.z] })), kind);
const ring = page => page.evaluate(() => drawing.outlines[0].points.map(p => [p.x, p.z]));
const near = (p, q) => Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[1] - q[1]) < 1e-6;
const findSeg = (list, a, b) => list.find(s => (near(s.a, a) && near(s.b, b)) || (near(s.a, b) && near(s.b, a)));

// BREAK the south run at x=0, then drag the east half by its body.
async function breakSouth(page) {
  const { at } = await h.planFrame(page);
  await page.mouse.click(...at(-4, D));
  await page.waitForTimeout(120);
  await page.locator('#model-break').click();
  await page.mouse.click(...at(0, D));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
}
async function dragEastHalf(page, toZ) {
  const { at } = await h.planFrame(page);
  const [gx, gy] = at(4, D);
  await page.mouse.click(gx, gy);
  await page.waitForTimeout(120);
  await page.mouse.move(gx, gy);
  await page.mouse.down();
  await page.mouse.move(gx + 1, gy + 8);
  const [tx, ty] = at(4, toZ);
  await page.mouse.move(tx, ty, { steps: 6 });
  await page.waitForTimeout(80);
  await page.mouse.up();
  await page.waitForTimeout(150);
}

for (const kind of ['wall', 'line']) {
  test(`${kind}: the east half pulled out 1 ft gets a jog at the break, the far end stretches, UNDO takes both`, async ({ page }) => {
    await open(page, fixture(kind));
    await breakSouth(page);
    let list = await segs(page, kind);
    expect(list.length, 'BREAK made two of the south run').toBe(5);
    await dragEastHalf(page, D + 1);
    list = await segs(page, kind);
    expect(list.length, 'three pieces on the south now: west half, jog, east half').toBe(6);
    const east = findSeg(list, [W, D + 1], [0, D + 1]);
    const jog = findSeg(list, [0, D], [0, D + 1]);
    const west = findSeg(list, [0, D], [-W, D]);
    expect(east, 'the east half slid out a foot, parallel').toBeTruthy();
    expect(jog, 'a jog square to both joins the node to the moved half').toBeTruthy();
    expect(west, 'the west half stayed on its line').toBeTruthy();
    expect(findSeg(list, [W, -D], [W, D + 1]), 'the east run stretched along its own line').toBeTruthy();
    // SAME KIND, SAME PROPERTIES.
    const props = await page.evaluate(({ k, id }) => {
      const s = (k === 'wall' ? walls() : lines()).find(x => x.id === id);
      return k === 'wall' ? [s.wallType, s.refLine, s.topHeight] : [s.style, s.weight];
    }, { k: kind, id: jog.id });
    expect(props).toEqual(kind === 'wall' ? ['stud_2x6', 'left', 8] : ['dashed', 4]);
    // THE JOG SHARES ITS CORNERS: one pooled point with the west half at the
    // node, one with the east half at the new corner.
    const shared = await page.evaluate(({ k, j, e, w }) => {
      const L = k === 'wall' ? walls() : lines();
      const J = L.find(x => x.id === j), E = L.find(x => x.id === e), Wst = L.find(x => x.id === w);
      const ends = s => [s.start, s.end];
      return [ends(J).some(p => ends(Wst).includes(p)), ends(J).some(p => ends(E).includes(p))];
    }, { k: kind, j: jog.id, e: east.id, w: west.id });
    expect(shared).toEqual([true, true]);
    if (kind === 'wall') {
      const pts = await ring(page);
      expect(pts.length, 'the bone gained the jog corner').toBe(6);
      expect(pts.some(p => near(p, [0, D + 1])), 'the ring has the moved corner').toBe(true);
      expect(pts.some(p => near(p, [W, D + 1])), 'the ring’s far corner slid with the wall').toBe(true);
      expect(pts.some(p => near(p, [0, D])), 'the node stays on the ring').toBe(true);
    }
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(150);
    list = await segs(page, kind);
    expect(list.length, 'UNDO: the jog is gone').toBe(5);
    expect(findSeg(list, [W, D], [0, D]), 'UNDO: the east half is back on its line').toBeTruthy();
    expect(findSeg(list, [W, -D], [W, D]), 'UNDO: the east run is its old length').toBeTruthy();
    if (kind === 'wall') {
      const pts = await ring(page);
      expect(pts.length, 'UNDO: the ring is back to the break alone').toBe(5);
      expect(pts.some(p => near(p, [W, D])), 'UNDO: the far corner is back').toBe(true);
    }
  });
}

test('wall: pushed in a foot and pulled back flush, no jog is left behind', async ({ page }) => {
  await open(page, fixture('wall'));
  await breakSouth(page);
  await dragEastHalf(page, D - 1);
  let list = await segs(page, 'wall');
  expect(list.length).toBe(6);
  expect(findSeg(list, [0, D], [0, D - 1]), 'pushed in: the jog runs inward').toBeTruthy();
  // AND BACK OUT TO THE LINE IT CAME FROM: the jog is nothing and goes.
  const { at } = await h.planFrame(page);
  const [gx, gy] = at(4, D - 1);
  await page.mouse.move(gx, gy);
  await page.mouse.down();
  await page.mouse.move(gx + 1, gy + 8);
  await page.mouse.move(...at(4, D), { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  list = await segs(page, 'wall');
  expect(list.length, 'flush again: the jog is gone').toBe(5);
  expect(findSeg(list, [W, D], [0, D])).toBeTruthy();
  expect((await ring(page)).length, 'the ring is back to five').toBe(5);
  const joined = await page.evaluate(() => {
    const e = walls().find(w => w.start.x === 8 && w.start.z === 4), ww = walls().find(w => w.end.x === -8 && w.end.z === 4);
    return e && ww && (e.end === ww.start || e.start === ww.start);
  });
  expect(joined, 'the two halves share the node again').toBe(true);
  // AND UNDO BRINGS THE JOG BACK, then the first UNDO takes it away.
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  list = await segs(page, 'wall');
  expect(list.length, 'UNDO: the inward jog is back').toBe(6);
  expect(findSeg(list, [0, D], [0, D - 1])).toBeTruthy();
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  expect((await segs(page, 'wall')).length, 'UNDO again: flush, four walls and the break').toBe(5);
});

test('wall: a typed length after the drag lands the jog exactly', async ({ page }) => {
  await open(page, fixture('wall'));
  await breakSouth(page);
  await dragEastHalf(page, D + 1);
  await page.locator('#frozen-length').fill("2'6");
  await page.locator('#frozen-length').press('Enter');
  await page.waitForTimeout(150);
  const list = await segs(page, 'wall');
  expect(list.length).toBe(6);
  expect(findSeg(list, [W, D + 2.5], [0, D + 2.5]), 'the east half sits 2’-6" out').toBeTruthy();
  expect(findSeg(list, [0, D], [0, D + 2.5]), 'the jog is 2’-6"').toBeTruthy();
  const pts = await ring(page);
  expect(pts.some(p => near(p, [0, D + 2.5])) && pts.some(p => near(p, [W, D + 2.5])), 'the ring followed').toBe(true);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  expect((await segs(page, 'wall')).length, 'one UNDO takes the typed move and the jog').toBe(5);
});
