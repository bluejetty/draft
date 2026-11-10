// NODES INSIDE AN ASSEMBLY (10 Nov).
//
// "can we make it so the nodes within the assembly can be edited but the
// items all stay together ... the connected nodes will move to the same
// location ... in the Y keep everything all nodes together and move as one,
// if they need to unlock a node they will need to break the assembly".
//
// A fixed assembly is picked whole, and until now a press on one of its
// corners slid the lot (lines) or moved the assembly (walls): the corners
// took no grab at all. Now the nearest end of any picked wall or line is a
// handle, every corner of the assembly standing on that spot rides with it,
// the grouping survives, and one UNDO puts the corner back.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const seg = (id, a, b, extra) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', ...extra });
const L = (id, a, b) => seg(id, a, b, { layer: 'draft', weight: 4, style: 'solid' });
const W = (id, a, b) => seg(id, a, b, { wallType: 'stud_2x4', refLine: 'center' });
// A lot of three lines, and a WC of two walls, each a fixed assembly.
const drawing = () => ({
  version: 1, board: 'drafting',
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0, nextDrawingItemId: 20, nextGroupId: 3,
  walls: [W('w1', [0, -14], [6, -14]), W('w2', [6, -14], [6, -8])],
  lines: [L('l1', [0, 0], [10, 0]), L('l2', [10, 0], [10, 10]), L('l3', [10, 10], [0, 0])],
  floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [
    { id: 'group-1', name: 'LOT', fixed: true, stretchBehavior: 'rigid',
      members: [{ type: 'line', id: 'l1' }, { type: 'line', id: 'l2' }, { type: 'line', id: 'l3' }] },
    { id: 'group-2', name: 'WC', fixed: true, stretchBehavior: 'rigid',
      members: [{ type: 'wall', id: 'w1' }, { type: 'wall', id: 'w2' }] },
  ],
  levelLocks: [], underlays: [],
});

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto('/MODEL.html?left=1&lpane=drafting');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  await page.keyboard.press('s');
  return h.planFrame(page);
}
const click = async (page, at, x, z) => { await page.mouse.click(...at(x, z)); await page.waitForTimeout(80); };
const drag = async (page, at, from, to) => {
  const [sx, sy] = at(...from); const [ex, ey] = at(...to);
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 6, sy + 6);
  await page.mouse.move(ex, ey, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(120);
};
const ends = page => page.evaluate(() => {
  const pt = p => [Math.round(p.x * 100) / 100, Math.round(p.z * 100) / 100];
  const rec = s => ({ start: pt(s.start), end: pt(s.end) });
  return {
    lines: Object.fromEntries(drawing.lines.map(l => [l.id, rec(l)])),
    walls: Object.fromEntries(drawing.walls.map(w => [w.id, rec(w)])),
    groups: drawing.groups.map(g => g.name),
    picked: selection.length,
  };
});

test('a corner of a lot of lines held whole drags; both lines meeting there go with it; the lot stays an assembly', async ({ page }) => {
  const { at } = await open(page);
  await click(page, at, 10, 5);
  expect((await ends(page)).picked).toBe(3);
  await drag(page, at, [10, 10], [10, 14]);
  const d = await ends(page);
  expect(d.lines.l2.end).toEqual([10, 14]);
  expect(d.lines.l3.start).toEqual([10, 14]);
  expect(d.lines.l1).toEqual({ start: [0, 0], end: [10, 0] });
  expect(d.lines.l2.start).toEqual([10, 0]);
  expect(d.groups).toEqual(['LOT', 'WC']);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(100);
  const back = await ends(page);
  expect(back.lines.l2.end).toEqual([10, 10]);
  expect(back.lines.l3.start).toEqual([10, 10]);
});

test('a corner of a WC held whole drags, and the two walls meeting there stay joined', async ({ page }) => {
  const { at } = await open(page);
  await click(page, at, 3, -14);
  expect((await ends(page)).picked).toBe(2);
  await drag(page, at, [6, -14], [9, -14]);
  const d = await ends(page);
  expect(d.walls.w1.end).toEqual([9, -14]);
  expect(d.walls.w2.start).toEqual([9, -14]);
  expect(d.walls.w1.start).toEqual([0, -14]);
  expect(d.walls.w2.end).toEqual([6, -8]);
  expect(d.groups).toEqual(['LOT', 'WC']);
});

test('a press on the body of a held lot still slides the whole lot', async ({ page }) => {
  const { at } = await open(page);
  await click(page, at, 10, 5);
  await drag(page, at, [10, 5], [10, 9]);
  const d = await ends(page);
  expect(d.lines.l1.start).toEqual([0, 4]);
  expect(d.lines.l2.end).toEqual([10, 14]);
  expect(d.lines.l3.start).toEqual([10, 14]);
});
