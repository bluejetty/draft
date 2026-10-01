// SELECT REACHES A CLOSET, A STAIR AND A ROOF, and LINE draws a line.
//
// Movie, 1 Oct: "when i try to SELECT a stair or the CLOSET or other stuff
// (ROOF) i can't select it. I can SELECT WALL". The hit chain stopped at five
// types, so a click on a closet took the wall behind it, a click on a stair
// took the floor under it, and a roof took nothing. And LINE could be armed
// but a press fell through to select-or-pan: no line was ever drawn.
//
// EACH CHECK IS A ROUND TRIP THROUGH THE FILE. A click, DELETE, SAVE, and the
// saved drawing has lost exactly that one thing -- not the wall, not the
// floor -- so a click that picked the neighbour fails by name. Then UNDO and
// SAVE, and it is back.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3, ROOF = 7;

// A 20 x 16 box on MAIN FL, a floor filling it, a closet on the north wall, a
// straight stair standing in the floor, and a roof over it all on ROOF. Every
// level's drawing is centred on the origin, so the fitted view puts world
// (0, 0) at the canvas centre and the readout's scale is the whole transform.
const wall = (id, x0, z0, x1, z1) => ({
  id, levelId: MAIN_FL, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 8, start: { x: x0, y: 0, z: z0 }, end: { x: x1, y: 0, z: z1 },
});
const HOUSE = {
  format: 'draft-drawing', version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 }, { id: ROOF, name: 'ROOF', elev: 18 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: MAIN_FL, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -10 },
  ],
  walls: [
    wall('w-n', -10, -8, 10, -8), wall('w-e', 10, -8, 10, 8),
    wall('w-s', 10, 8, -10, 8), wall('w-w', -10, 8, -10, -8),
  ],
  floors: [{ id: 'f1', levelId: MAIN_FL, view: 'floor',
    points: [{ x: -10, z: -8 }, { x: 10, z: -8 }, { x: 10, z: 8 }, { x: -10, z: 8 }] }],
  fixtures: [{ id: 'cl1', kind: 'closet', wallId: 'w-n', levelId: MAIN_FL,
    offset: 10, width: 6, depth: 2.2, side: 1 }],
  stairs: [{ id: 1, levelId: MAIN_FL, view: 'plan', start: { x: 4, z: -3 }, end: { x: 4, z: 3 },
    riseFt: 9, widthFt: 3, shape: 'straight' }],
  roofs: [{ id: 'r1', levelId: ROOF, pitch: 6, overhang: 1, edges: ['eave', 'eave', 'eave', 'eave'],
    points: [{ x: -11, z: -9 }, { x: 11, z: -9 }, { x: 11, z: 9 }, { x: -11, z: 9 }] }],
  lines: [], dimensions: [], shapes: [], outlines: [], notes: [], fenestrations: [],
  // DRAFTING, NAMED: the page opens on TOY, which puts LINE away. These
  // checks are about what the tools do, not which board offers them.
  board: 'drafting',
};

async function open(page, level = MAIN_FL) {
  await page.goto('/MODEL.dc.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: HOUSE });
  await page.goto(`/MODEL.html?mode=night&level=${level}`);
  await expect(page.locator('#readout')).toContainText('scale', { timeout: 10000 });
}

const stored = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await file.text());
}, BUCKET);

async function save(page) {
  await page.locator('[data-model-save]').click();
  await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });
  return stored(page);
}

// World -> page pixels off the readout's published scale, centred as above.
async function tapWorld(page, x, z) {
  const hit = (await page.locator('#readout').textContent()).match(/scale ([\d.]+) px\/ft/);
  expect(hit, 'the readout publishes the scale').toBeTruthy();
  const scale = Number(hit[1]);
  const box = await page.locator('#plan').boundingBox();
  const px = box.x + box.width / 2 + x * scale;
  const py = box.y + box.height / 2 + z * scale;
  const under = await page.evaluate(({ px, py }) => document.elementFromPoint(px, py)?.id, { px, py });
  expect(under, `world (${x}, ${z}) must land on the canvas`).toBe('plan');
  await page.mouse.click(px, py);
  await page.waitForTimeout(60);
}

// The closet's own middle, from the same module the page paints it with.
const closetCentre = page => page.evaluate(saved => {
  const geo = window.DraftFixtureGeometry.fixtureGeometry(saved.walls, saved.fixtures[0]);
  return geo.center;
}, HOUSE);

test.describe('SELECT picks what it could not', () => {
  test('a click on the closet picks the closet, not the wall behind it', async ({ page }) => {
    await open(page);
    const c = await closetCentre(page);
    await tapWorld(page, c.x, c.z);
    await expect(page.locator('[data-delete]')).toBeVisible();
    await page.locator('[data-delete]').click();
    let saved = await save(page);
    expect(saved.fixtures.map(f => f.id)).toEqual([]);
    expect(saved.walls).toHaveLength(4);

    await page.locator('[data-model-undo]').click();
    saved = await save(page);
    expect(saved.fixtures.map(f => f.id)).toEqual(['cl1']);
  });

  test('a click in the stair picks the stair, not the floor under it', async ({ page }) => {
    await open(page);
    await tapWorld(page, 4, -1.5);
    await expect(page.locator('[data-delete]')).toBeVisible();
    await page.locator('[data-delete]').click();
    let saved = await save(page);
    expect(saved.stairs).toEqual([]);
    expect(saved.floors.map(f => f.id)).toEqual(['f1']);

    await page.locator('[data-model-undo]').click();
    saved = await save(page);
    expect(saved.stairs.map(s => s.id)).toEqual([1]);
  });

  test('a roof is picked on the ROOF level, and only there', async ({ page }) => {
    // On MAIN FL the roof is not painted, so a click inside its footprint
    // picks nothing: nothing selected, nothing to delete.
    await open(page);
    await tapWorld(page, -6, 4);
    await expect(page.locator('[data-delete]')).toBeHidden();
    let saved;

    await open(page, ROOF);
    await tapWorld(page, -6, 4);
    await expect(page.locator('[data-delete]')).toBeVisible();
    await page.locator('[data-delete]').click();
    saved = await save(page);
    expect(saved.roofs).toEqual([]);
    await page.locator('[data-model-undo]').click();
    saved = await save(page);
    expect(saved.roofs.map(r => r.id)).toEqual(['r1']);
  });

  test('deleting a stair takes the hole cut for it, and undo puts both back', async ({ page }) => {
    const withHole = {
      ...HOUSE,
      surfaceOpenings: [{ id: 'so1', levelId: 5, hostType: 'floor', hostId: 'f2', stairId: 1,
        points: [{ x: 2.5, z: -3 }, { x: 5.5, z: -3 }, { x: 5.5, z: 3 }, { x: 2.5, z: 3 }] }],
    };
    await page.goto('/MODEL.dc.html');
    await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
    await page.evaluate(async ({ bucket, saved }) => {
      await window.SharedFileStore.saveSharedFile(
        new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
    }, { bucket: BUCKET, saved: withHole });
    await page.goto(`/MODEL.html?mode=night&level=${MAIN_FL}`);
    await expect(page.locator('#readout')).toContainText('scale', { timeout: 10000 });
    const before = (await stored(page)).surfaceOpenings || [];
    expect(before.map(o => o.stairId), 'the hole is in the file to begin with').toEqual([1]);

    await tapWorld(page, 4, -1.5);
    await page.locator('[data-delete]').click();
    let saved = await save(page);
    expect(saved.stairs).toEqual([]);
    expect((saved.surfaceOpenings || []).filter(o => o.stairId === 1)).toEqual([]);

    await page.locator('[data-model-undo]').click();
    saved = await save(page);
    expect(saved.stairs.map(s => s.id)).toEqual([1]);
    expect(saved.surfaceOpenings.map(o => o.stairId)).toEqual([1]);
  });
});

test('LINE: two presses draw one line, and it is saved', async ({ page }) => {
  await open(page);
  await h.armFromRail(page, 'line');
  // On the right of the sheet, clear of the left rail now standing open.
  await tapWorld(page, 5, 5);
  await tapWorld(page, 8.5, 5);
  const saved = await save(page);
  expect(saved.lines).toHaveLength(1);
  const [line] = saved.lines;
  expect(line.levelId).toBe(MAIN_FL);
  expect(Math.hypot(line.end.x - line.start.x, line.end.z - line.start.z)).toBeGreaterThan(3);
});
