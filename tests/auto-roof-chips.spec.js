// AUTO ROOF / HAND ROOF (jb, 13 Nov 2026).
//
// "the autoroof is really cool for doing the quick house but unless it is
// nearly perfect at the begining its hard to modify. i'd like the option to -
// kindof like the AUTODIMS on and HAND DIMS have a ability to TURN OFF THE
// AUTOROOF and do a HANDROOF."
//
// Two chips on the ROOF level's foot lane, left of the dims chips. HAND ROOF
// is the file's switch (`autoRoof: false`): the bone raises no roof, the
// PROJECT page reshapes none, and the ROOF plan still shows the top floor's
// wall tops ("the 'roof gables' ... ceiling lines of 2nd fl") to draw to.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const empty = () => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 2,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});
async function open(page, file = empty(), search = '') {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  await page.goto(`/MODEL.html${search}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
// A 1 STOREY traced on MAIN FL: closing the loop builds it (model-traced-build).
const HOUSE = [[-10, -8], [10, -8], [10, 8], [-10, 8]];
async function traceHouse(page) {
  await h.openDriveThru(page);
  await page.locator('[data-build-family="bungalow"]').click();
  await page.locator('[data-build-entry="bungalow"]').click();
  await page.locator('#dt-banner-outline').click();
  await expect(page.locator('#drivethru')).toBeHidden();
  await h.dropSeededCorner(page);
  const { at } = await h.planFrame(page);
  for (const [x, z] of [...HOUSE, HOUSE[0]]) await page.mouse.click(...at(x, z));
  await page.waitForTimeout(150);
  if (await page.locator('#corner-join').isVisible()) {
    await page.keyboard.press('Enter');
    await expect(page.locator('#corner-join')).toBeHidden();
  }
  await page.waitForTimeout(500);
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const chip = (page, kind) => page.locator(`[data-roof-mode="${kind}"]`);

test('AUTO ROOF / HAND ROOF chips stand on the ROOF level, and the file keeps the switch', async ({ page }) => {
  await open(page, empty(), '?level=3');
  await expect(page.locator('#roof-mode')).toBeHidden();
  await page.goto('/MODEL.html?level=7');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect(page.locator('#roof-mode')).toBeVisible();
  await expect(chip(page, 'auto')).toHaveAttribute('aria-pressed', 'true');
  await expect(chip(page, 'hand')).toHaveAttribute('aria-pressed', 'false');
  // On the foot lane, left of where the dims chips go: short of the clock.
  const [box, clock] = await Promise.all([page.locator('#roof-mode').boundingBox(),
    page.locator('#clock').boundingBox()]);
  expect(box.x + box.width).toBeLessThan(clock.x);
  expect(box.y + box.height).toBeGreaterThan(clock.y);

  await chip(page, 'hand').click();
  await expect(chip(page, 'hand')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => drawing.autoRoof)).toBe(false);
  await expect(page.locator('#strip-message')).toContainText('HAND ROOF');
  // UNDO takes the press back, and the key out of the file.
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => 'autoRoof' in drawing)).toBe(false);
  await expect(chip(page, 'auto')).toHaveAttribute('aria-pressed', 'true');
  // Saved with the drawing, and read back lit.
  await chip(page, 'hand').click();
  await page.locator('#save').click();
  await h.waitForSaved(page);
  expect((await h.savedDrawing(page)).autoRoof).toBe(false);
  await page.goto('/MODEL.html?level=7');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect(chip(page, 'hand')).toHaveAttribute('aria-pressed', 'true');
  // AUTO ROOF takes the key out again rather than writing `true`.
  await chip(page, 'auto').click();
  expect(await page.evaluate(() => 'autoRoof' in drawing)).toBe(false);
  await expect(chip(page, 'auto')).toHaveAttribute('aria-pressed', 'true');
});

test('with HAND ROOF on, the bone raises walls and floors but no roof', async ({ page }) => {
  await open(page, { ...empty(), autoRoof: false }, '?level=3');
  const saved = await traceHouse(page);
  expect(saved.walls.filter(w => Number(w.levelId) === 3).length).toBeGreaterThanOrEqual(4);
  expect(saved.floors.length).toBeGreaterThanOrEqual(1);
  expect(saved.roofs || []).toHaveLength(0);
  expect(saved.autoRoof).toBe(false);
  await expect(page.locator('#strip-message')).toContainText('HAND ROOF');
});

test('the ROOF plan shows the top floor\'s wall tops with no roof on them', async ({ page }) => {
  await open(page, { ...empty(), autoRoof: false }, '?level=3');
  await traceHouse(page);
  await page.goto('/MODEL.html?theme=rough&mode=day&level=7');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => drawing.roofs.length)).toBe(0);
  // Ink on the sheet along the north wall's line, none in the middle of the
  // room: the wall top is drawn, as it is under a roof.
  const { at } = await h.planFrame(page);
  const inkAt = async (x, z) => {
    const [cx, cy] = at(x, z);
    return page.evaluate(({ cx, cy }) => {
      const c = document.getElementById('plan');
      const r = c.getBoundingClientRect();
      const sx = c.width / r.width, sy = c.height / r.height;
      const d = c.getContext('2d').getImageData(Math.round((cx - r.left) * sx) - 6, Math.round((cy - r.top) * sy) - 6, 12, 12).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0 && d[i] < 170) n += 1;
      return n;
    }, { cx, cy });
  };
  expect(await inkAt(0, -8), 'ink on the wall line').toBeGreaterThan(0);
  expect(await inkAt(5, 3), 'ink in the room').toBe(0);
});

test('PROJECT leaves every roof alone while HAND ROOF is on', async ({ page }) => {
  await open(page);
  const got = await page.evaluate(() => {
    const LA = window.DraftLevelAssembly, G = window.DraftGeometry2D;
    const pts = [[-9, -7], [9, -7], [9, 7], [-9, 7]].map(([x, z]) => ({ x, y: 0, z }));
    const roof = { id: 'roof-1', levelId: 7, follows: 'house', pitch: 4, overhang: 1,
      points: pts, edges: pts.map(() => 'eave'), edgeOverhang: pts.map(() => 1),
      footprint: [[-8, -6], [8, -6], [8, 6], [-8, 6]].map(([x, z]) => ({ x, y: 0, z })) };
    const base = JSON.parse(JSON.stringify(drawing));
    const after = JSON.parse(JSON.stringify(drawing));
    after.levelAssemblies = after.levelAssemblies || {};
    const was = LA.projectRoofFor(base, 'house', base.buildType);
    // A steeper PROJECT pitch: the roof follows under AUTO ROOF, not under HAND ROOF.
    const bump = d => { d.roofPitch = was.pitch + 2; if (d.sectionTable?.rows?.house) delete d.sectionTable.rows.house.roofPitch; };
    bump(after);
    const now = LA.projectRoofFor(after, 'house', after.buildType);
    const auto = LA.roofsFollowingProject([roof], base, after, G.offsetOutlineVariable);
    const hand = LA.roofsFollowingProject([roof], { ...base, autoRoof: false }, { ...after, autoRoof: false }, G.offsetOutlineVariable);
    return { changed: now.pitch !== was.pitch, auto: auto ? auto[0].pitch : null, hand };
  });
  expect(got.changed, 'the PROJECT pitch moved').toBe(true);
  expect(got.auto).not.toBeNull();
  expect(got.hand).toBeNull();
});
