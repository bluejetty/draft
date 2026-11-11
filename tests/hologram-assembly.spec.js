// TWO HOLOGRAMS Y'd INTO ONE ASSEMBLY (jb, 11 Nov 2026: "when i tried to Y
// Assemble two holograms so they would stick together when i move them, it
// seems when i try to select them they don't light up and i can't select
// them"). The assembly took them by id but never found them again, so the
// Y left nothing picked and a click on either picked nothing. Now the Y
// leaves both lit, a click on one picks both, MOVE carries both, and the
// card's MOVE of one carries the other.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const BLANK = {
  version: 1, board: 'drafting', planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
};
const HOUSE = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'proto', 'repro-movie-corner-garage.draft'), 'utf8'));
HOUSE.walls = HOUSE.walls.slice(0, 3);
// wall-33 runs x -0.19 .. -29.19 at z -21.67 in the source; its middle, placed.
const MID = holo => ({ x: holo.x - 14.69, z: holo.z - 21.67 });
const ONE = { id: 'hologram-1', name: 'footprint', x: 4, z: -2, angleDeg: 0, pivotX: 0, pivotZ: 0, source: HOUSE };
const TWO = { id: 'hologram-2', name: 'footprint', x: 60, z: 6, angleDeg: 0, pivotX: 0, pivotZ: 0, source: HOUSE };

async function open(page, drawing) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    try { localStorage.removeItem('draft.trace.on'); } catch { /* fine */ }
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing });
  await page.goto('/MODEL.html?level=3&left=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('s');
}
const picked = page => page.evaluate(() => selection.map(e => `${e.type}:${e.item.id}`).sort());
const places = page => page.evaluate(() => drawing.holograms.map(o => [o.id, Math.round(o.x * 100) / 100, Math.round(o.z * 100) / 100]));
const clickAt = async (page, pt, mods) => {
  const f = await h.planFrame(page);
  const [x, y] = f.at(pt.x, pt.z);
  await page.mouse.click(x, y, mods ? { modifiers: mods } : {});
};

test('Y on two holograms makes an assembly that stays lit, and a click on one picks both', async ({ page }) => {
  await open(page, { ...BLANK, holograms: [ONE, TWO] });
  // Y first, a click on each, ENTER closes the assembly (the 18 Oct rule).
  await page.keyboard.press('y');
  await clickAt(page, MID(ONE));
  expect(await picked(page)).toEqual(['hologram:hologram-1']);
  await clickAt(page, MID(TWO));
  expect(await picked(page)).toEqual(['hologram:hologram-1', 'hologram:hologram-2']);
  await page.keyboard.press('Enter');
  await expect(page.locator('#strip-message')).toContainText('ASSEMBLY 1 made: 2 items');
  // Both are still lit after the Y.
  expect(await picked(page)).toEqual(['hologram:hologram-1', 'hologram:hologram-2']);
  const groups = await page.evaluate(() => drawing.groups);
  expect(groups).toHaveLength(1);
  expect(groups[0].fixed).toBe(true);
  expect(groups[0].members).toEqual([{ type: 'hologram', id: 'hologram-1' }, { type: 'hologram', id: 'hologram-2' }]);
  // Away, then a click on ONE picks the whole assembly.
  await page.keyboard.press('Escape');
  await page.evaluate(() => setSelection([]));
  expect(await picked(page)).toEqual([]);
  await clickAt(page, MID(ONE));
  expect(await picked(page)).toEqual(['hologram:hologram-1', 'hologram:hologram-2']);
  // And the assembly survives a save.
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const d = await h.savedDrawing(page);
  expect(d.groups[0].members.map(m => m.id)).toEqual(['hologram-1', 'hologram-2']);
});

test('MOVE of one carries the other, so does the card MOVE of one, and one UNDO puts both back', async ({ page }) => {
  await open(page, { ...BLANK, holograms: [ONE, TWO],
    groups: [{ id: 'group-1', name: 'PAIR', fixed: true, stretchBehavior: 'rigid',
      members: [{ type: 'hologram', id: 'hologram-1' }, { type: 'hologram', id: 'hologram-2' }] }] });
  // The MOVE verb: pick ONE (both come), M, a drag anywhere 10 ft east.
  await clickAt(page, MID(ONE));
  expect(await picked(page)).toEqual(['hologram:hologram-1', 'hologram:hologram-2']);
  await page.keyboard.press('m');
  await expect(page.locator('#strip-message')).toContainText('MOVE: drag anywhere');
  const f0 = await h.planFrame(page);
  const [mx, my] = f0.at(-40, -40);
  const [nx, ny] = f0.at(-30, -40);
  await page.mouse.move(mx, my);
  await page.mouse.down();
  await page.mouse.move(mx + 4, my);
  await page.mouse.move(nx, ny, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator('#strip-message')).toContainText('Moved');
  expect(await places(page)).toEqual([['hologram-1', 14, -2], ['hologram-2', 70, 6]]);
  await page.locator('#model-undo').click();
  expect(await places(page)).toEqual([['hologram-1', 4, -2], ['hologram-2', 60, 6]]);
  // The card's MOVE on ONE, dragged 10 ft east: TWO rides along.
  await page.keyboard.press('Escape');
  await page.evaluate(() => setSelection([]));
  await clickAt(page, MID(ONE));
  await page.locator('[data-mode-hologram]').click();
  await page.locator('.hologram-copy[data-lit] [data-hologram-move]').first().click();
  if (await page.locator('#hologram-ask').isVisible()) await page.locator('[data-hologram-close]').click();
  const f = await h.planFrame(page);
  const [ax, ay] = f.at(-40, -40);
  const [bx, by] = f.at(-30, -40);
  await page.mouse.move(ax, ay);
  await page.mouse.down();
  await page.mouse.move(ax + 4, ay);
  await page.mouse.move(bx, by, { steps: 6 });
  await page.mouse.up();
  expect(await places(page)).toEqual([['hologram-1', 14, -2], ['hologram-2', 70, 6]]);
  await page.locator('#model-undo').click();
  expect(await places(page)).toEqual([['hologram-1', 4, -2], ['hologram-2', 60, 6]]);
});
