// BREAK (Movie, 18 Oct).
//
// "'BREAK' the roof and deleted the 2 hip peices and move the GABLE part all
// the wal over to cover the existing roof" -- "can you place the BREAK
// command down near where UNDO COPY DELETE commands show up. that might be a
// good spot when the roof or other ASSEMBLIES are selected".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const EAVE = [[-8, -8], [68, -8], [68, 38], [-8, 38]];
const W = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center' });
const drawing = () => ({
  version: 1, planTurn: 0, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 1, nextDrawingItemId: 50, nextGroupId: 2,
  walls: [W('a', [0, 0], [6, 0]), W('b', [6, 0], [6, 6])],
  lines: [], floors: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [{ id: 'group-1', name: 'WC 1', fixed: true, stretchBehavior: 'rigid',
    members: [{ type: 'wall', id: 'a' }, { type: 'wall', id: 'b' }] }],
  levelLocks: [], underlays: [],
  roofs: [{ id: 'roof-1', levelId: 7, pitch: 4, overhang: 8,
    points: EAVE.map(([x, z]) => ({ x, y: 0, z })), edges: EAVE.map(() => 'eave'),
    edgeOverhang: EAVE.map(() => 8) }],
});

async function open(page, level = 7) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto(`/MODEL.html?level=${level}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
const click = async (page, at, x, z) => { await page.mouse.click(...at(x, z)); await page.waitForTimeout(100); };
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const r2 = n => Math.round(n * 100) / 100 + 0;
const xs = roof => roof.points.map(p => r2(p.x));

test('a roof selected: BREAK in the foot; two clicks edge to edge cut it in two along a flush gable', async ({ page }) => {
  const { at } = await open(page);
  await click(page, at, 30, 15);
  await expect(page.locator('#model-break')).toBeVisible();
  await expect(page.locator('#model-break')).toHaveText('BREAK');
  await page.locator('#model-break').click();
  await expect(page.locator('#model-break')).toHaveAttribute('aria-pressed', 'true');
  await click(page, at, 10, -7.9);
  await click(page, at, 10, 37.9);
  const { roofs } = await saved(page);
  expect(roofs).toHaveLength(2);
  const [left, right] = roofs.slice().sort((p, q) => Math.min(...xs(p)) - Math.min(...xs(q)));
  expect([Math.min(...xs(left)), Math.max(...xs(left))]).toEqual([-8, 10]);
  expect([Math.min(...xs(right)), Math.max(...xs(right))]).toEqual([10, 68]);
  // THE CUT IS A FLUSH GABLE on both: the edge along x = 10.
  for (const piece of [left, right]) {
    const cut = piece.points.findIndex((p, i) => {
      const q = piece.points[(i + 1) % piece.points.length];
      return r2(p.x) === 10 && r2(q.x) === 10;
    });
    expect(cut, 'each piece has the cut as an edge').toBeGreaterThanOrEqual(0);
    expect(piece.edges[cut]).toBe('gable');
    expect(piece.edgeOverhang[cut]).toBe(0);
  }
  // NO HIP AT THE CUT: the ridge runs out to it.
  const west = await page.evaluate(r => Math.min(...window.DraftGeometry2D.roofSkeleton(r)
    .flatMap(s => [s.a.x, s.b.x])), right);
  expect(west).toBeCloseTo(10, 6);
  expect(new Set(roofs.map(r => r.id)).size, 'two ids').toBe(2);
});

test('the piece not wanted is deleted, and UNDO joins the roof again', async ({ page }) => {
  const { at } = await open(page);
  await click(page, at, 30, 15);
  await page.locator('#model-break').click();
  await click(page, at, 10, -7.9);
  await click(page, at, 10, 37.9);
  await click(page, at, 0, 15);
  await page.locator('#delete').click();
  let { roofs } = await saved(page);
  expect(roofs).toHaveLength(1);
  expect(Math.min(...xs(roofs[0]))).toBe(10);
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  ({ roofs } = await saved(page));
  expect(roofs).toHaveLength(1);
  expect(roofs[0].points.map(p => [r2(p.x), r2(p.z)])).toEqual(EAVE);
});

test('Esc puts a roof BREAK down with nothing cut', async ({ page }) => {
  const { at } = await open(page);
  await click(page, at, 30, 15);
  await page.locator('#model-break').click();
  await click(page, at, 10, -7.9);
  await page.keyboard.press('Escape');
  await expect(page.locator('#model-break')).not.toHaveAttribute('aria-pressed', 'true');
  expect((await saved(page)).roofs).toHaveLength(1);
});

// ASSEMBLY GROUP / ASSEMBLY BUST (Movie, 18 Oct): "ASSEMBLY BREAK is
// different from ROOF EDGE BREAK" -- the same button says BUST for one.
test('an assembly selected: the foot button says BUST and busts it into its pieces; a roof\'s says BREAK', async ({ page }) => {
  const { at } = await open(page, 3);
  await click(page, at, 3, 0);
  await expect(page.locator('#model-break')).toBeVisible();
  await expect(page.locator('#model-break')).toHaveText('BUST');
  await expect(page.locator('[data-assembly-ungroup]')).toHaveText('ASSEMBLY BUST');
  await page.locator('#model-break').click();
  await expect(page.locator('#strip-message')).toContainText('ASSEMBLY BUST: broken into pieces');
  const d = await saved(page);
  expect(d.groups || []).toHaveLength(0);
  expect(d.walls.map(w => w.id).sort()).toEqual(['a', 'b']);
});
