// A HOLOGRAM'S LAYERS (Movie, 26 Oct): "in the hologram area can we have a
// LAYERS area where the user can turn on and off different layers in the
// holograms .. make it the same as the layout strategy where they are all the
// SAME like the TB, but you can also check a box to delink it from the main
// LAYER SET and set up a 'special set' for a particual 'SUITE/SHELF/TYPE
// COLOR' or also can do it on the level of 1 specific suite" -- "basically i'd
// like to bring in the suites and turn off most or all of the text and
// dimension layers" -- then "try option A ... can we make option B a more
// advanced option they can turn on and off ?"
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const P = (x, z) => ({ x, y: 0, z });
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
  { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
const W = (id, a, b) => ({ id, start: P(...a), end: P(...b), levelId: 3, view: 'plan',
  wallType: 'stud_2x6', refLine: 'center', baseHeight: 0, topHeight: 8 });
// A small suite: four walls, one hand dimension, one room name.
const suiteFile = name => ({
  version: 1, levels: LEVELS, activeLevelIdx: 2,
  walls: [W('a', [0, 0], [20, 0]), W('b', [20, 0], [20, 14]), W('c', [20, 14], [0, 14]), W('d', [0, 14], [0, 0])],
  dimensions: [{ id: 1, start: P(0, -3), end: P(20, -3), levelId: 3, view: 'plan', auto: false, layer: 'A-DIMS-HAND' }],
  roomTags: [{ id: 1, levelId: 3, name: `${name} BEDROOM`, at: P(10, 7) }],
});
const holo = (id, name, x, colour) => ({ id, name, x, z: 0, angleDeg: 0, pivotX: 10, pivotZ: 7,
  hidden: false, flip: false, colour, source: suiteFile(name) });
const drawing = () => ({
  version: 1, board: 'drafting', planTurn: 0, levels: LEVELS, activeLevelIdx: 2,
  walls: [W(1, [-10, -10], [120, -10])], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], stairs: [], notes: [], roomTags: [], columns: [], beams: [],
  holograms: [holo('h1', '1BD', 0, 1), holo('h2', '1BD', 30, 1), holo('h3', '2BD', 60, 3)],
});

async function open(page) {
  await page.addInitScript(() => {
    // Every room name a suite writes: each suite has one, "<file> BEDROOM".
    const proto = CanvasRenderingContext2D.prototype;
    const real = proto.fillText;
    window.__names = 0;
    proto.fillText = function (text, ...rest) {
      if (/BEDROOM$/.test(String(text))) window.__names += 1;
      return real.call(this, text, ...rest);
    };
  });
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto('/MODEL.html?level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
// The suites' room names one paint writes.
const namesDrawn = page => page.evaluate(() => {
  window.__names = 0;
  paint();
  return window.__names;
});
const card = async page => {
  if (!await page.locator('#hologram-ask').isVisible()) await page.locator('[data-mode-hologram]').click();
  await expect(page.locator('#hologram-ask [data-hologram-layers]')).toBeVisible();
};
const target = (page, value) => page.locator('[data-hologram-layer-target]').selectOption(value);
async function saved(page) {
  if (await page.locator('#hologram-ask').isVisible()) await page.locator('[data-hologram-close]').click();
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}

test('one main set for every hologram; a type, or one copy, can take its own', async ({ page }) => {
  await open(page);
  expect(await namesDrawn(page), 'every suite writes its room name').toBe(3);
  await card(page);
  // THE FIVE GROUPS, all on.
  await expect(page.locator('[data-hologram-layer]')).toHaveCount(5);
  await expect(page.locator('[data-hologram-layer="text"]')).toHaveAttribute('aria-pressed', 'true');
  // TEXT OFF on the main set: no suite writes a word.
  await page.locator('[data-hologram-layers-quiet]').click();
  await expect(page.locator('[data-hologram-layer="text"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-hologram-layer="walls"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await namesDrawn(page)).toBe(0);
  // THIS TYPE ONLY on 2BD, its text back on: the one 2BD writes its name.
  await target(page, 'type:2BD');
  await expect(page.locator('[data-hologram-layer="text"]')).toBeDisabled();
  await page.locator('[data-hologram-layer-own]').check();
  await page.locator('[data-hologram-layer="text"]').click();
  expect(await namesDrawn(page)).toBe(1);
  // THIS ONE ONLY on the second 1BD: it writes its, the first 1BD still not.
  await target(page, 'copy:h2');
  await page.locator('[data-hologram-layer-own]').check();
  await page.locator('[data-hologram-layers-all]').click();
  expect(await namesDrawn(page)).toBe(2);
  // KEPT IN THE FILE, and through a reload.
  const d = await saved(page);
  expect(d.hologramLayers.off).toEqual(expect.arrayContaining(['HOLO-TEXT', 'ROOM-IDS-AREA']));
  expect(d.hologramLayers.files['2BD']).not.toContain('HOLO-TEXT');
  expect(d.holograms.find(x => x.id === 'h2')).toMatchObject({ layersOwn: true, layersOff: [] });
  expect(d.holograms.find(x => x.id === 'h1').layersOwn).toBeUndefined();
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  expect(await namesDrawn(page)).toBe(2);
  // Let go again, the copy wears its type's set: the main one, text off.
  await card(page);
  await target(page, 'copy:h2');
  await page.locator('[data-hologram-layer-own]').uncheck();
  expect(await namesDrawn(page)).toBe(1);
});

test('ADVANCED lists every layer by its own name, and FEWER LAYERS goes back to the five', async ({ page }) => {
  await open(page);
  await card(page);
  await page.locator('[data-hologram-layers-advanced]').click();
  await expect(page.locator('[data-hologram-layer="ROOM-IDS-AREA"]')).toBeVisible();
  await expect(page.locator('[data-hologram-layer="HOLO-TEXT"]')).toHaveText('ALL WORDS');
  expect(await page.locator('[data-hologram-layer]').count()).toBeGreaterThan(20);
  await page.locator('[data-hologram-layer="HOLO-TEXT"]').click();
  await expect(page.locator('[data-hologram-layer="HOLO-TEXT"]')).toHaveAttribute('aria-pressed', 'false');
  expect(await namesDrawn(page)).toBe(0);
  expect((await saved(page)).hologramLayers).toMatchObject({ advanced: true, off: ['HOLO-TEXT'] });
  await card(page);
  await page.locator('[data-hologram-layers-advanced]').click();
  await expect(page.locator('[data-hologram-layer]')).toHaveCount(5);
  // A group reads ON while any of its layers is: three of TEXT's four are.
  await expect(page.locator('[data-hologram-layer="text"]')).toHaveAttribute('aria-pressed', 'true');
});
