// SUITES ON A SHELL (Movie, 18 Oct).
//
// "this is the outer building SHELL - i will start to create the SUITES, that
// i will save as DRAFT file and we will bring in as a HOLOGRAM" -- "can we
// have an option where it is shaded the normal colors but NOT editable from
// the 'SHELL BUILDING' file except to MOVE, COPY or FLIP etc" -- "CUT THE
// HOLES for the WINDOWS in the SUITES in the proper locations on the SHELL"
// -- "as long as it will look normal without having the 2 walls overlapping"
// -- "when they go close to lining them up it snaps".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b, extra = {}) => ({ id, levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 9, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] }, ...extra });
const WIN = (id, wallId, offset, width = 4) => ({ id, wallId, levelId: 3, view: 'plan', type: 'window',
  offset, width, sillHeight: 3, headHeight: 6.67 });
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 },
  { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
const EMPTY = { walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [],
  beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [] };
// A 20 x 15 suite in the corner of a 60 x 30 shell: its bottom and left
// walls lie in the shell's, and one window on its bottom wall.
const SUITE = { version: 1, levels: LEVELS, activeLevelIdx: 2, ...EMPTY,
  walls: [W('s1', [0, 0], [20, 0]), W('s2', [20, 0], [20, 15]), W('s3', [20, 15], [0, 15]), W('s4', [0, 15], [0, 0])],
  fenestrations: [WIN('w1', 's1', 8), WIN('w2', 's2', 5)] };
const shell = (holo = {}, fens = []) => ({ version: 1, board: 'drafting', planTurn: 0, levels: LEVELS,
  activeLevelIdx: 2, ...EMPTY,
  walls: [W('a', [0, 0], [60, 0]), W('b', [60, 0], [60, 30]), W('c', [60, 30], [0, 30]), W('d', [0, 30], [0, 0])],
  fenestrations: [WIN('pub', 'a', 40), ...fens],
  holograms: [{ id: 'h1', name: 'suite-a', mode: 'suite', x: 0, z: 0, angleDeg: 0, pivotX: 10, pivotZ: 7.5,
    source: SUITE, ...holo }] });

async function open(page, drawing) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing });
  await page.goto('/MODEL.html?level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
const saved = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};
// What the shell's walls carry from the suites, off the drawing as saved.
const hostOpenings = (page, d) => page.evaluate(d => window.DraftHologram.hostOpenings(d)
  .map(o => [o.wallId, Math.round(o.offset * 100) / 100, o.width, o.id]), d);

test('a SUITE keeps its mode through a save, and its shared wall hands its window to the shell wall', async ({ page }) => {
  await open(page, shell());
  const d = await saved(page);
  expect(d.holograms[0].mode).toBe('suite');
  // w1 (8' along the suite's bottom wall) lands 8' along the shell's bottom
  // wall; w2 is on an inside wall and stays the suite's own.
  expect(await hostOpenings(page, d)).toEqual([['a', 8, 4, 'h1:w1']]);
  // The suite's copies of the two shared walls are not drawn.
  const hidden = await page.evaluate(d => [...(window.DraftHologram.shared(d).hidden.get('h1') || [])].sort(), d);
  expect(hidden).toEqual(['s1', 's4']);
});

test('moved, turned over, the window follows: a mirrored suite in the far corner', async ({ page }) => {
  // Mirrored about its own middle and slid 40' along: the suite's bottom
  // wall still lies in the shell's, from x = 40 to 60, and w1 (8'-12' from
  // the suite's left) is now 8'-12' from its RIGHT: 48'-52' along the shell.
  await open(page, shell({ flip: true, x: 40 }));
  const d = await saved(page);
  expect(await hostOpenings(page, d)).toEqual([['a', 48, 4, 'h1:w1']]);
  // A quarter turn off the walls' line shares nothing.
  expect(await hostOpenings(page, { ...d, holograms: [{ ...d.holograms[0], angleDeg: 45 }] })).toEqual([]);
});

test('a suite wall that does not line up face for face shares nothing', async ({ page }) => {
  await open(page, shell({ z: 0.25 }));
  const d = await saved(page);
  expect(await hostOpenings(page, d)).toEqual([]);
  // A thinner suite wall in the shell's line is not the shell's either.
  const thin = JSON.parse(JSON.stringify(d));
  thin.holograms[0].z = 0;
  thin.holograms[0].source.walls[0].wallType = 'stud_2x4';
  expect(await hostOpenings(page, thin)).toEqual([]);
});

test('a suite dragged within 6" of lining up snaps onto the shell, both ways in a corner', async ({ page }) => {
  await open(page, shell({ x: 0.3, z: -0.4 }));
  const d = await saved(page);
  const got = await page.evaluate(d => window.DraftHologram.suiteSnap(d, d.holograms[0], 3, 0.5), d);
  expect(got.x).toBeCloseTo(-0.3, 6);
  expect(got.z).toBeCloseTo(0.4, 6);
  // Out of reach, nothing.
  const far = await page.evaluate(d => window.DraftHologram.suiteSnap(d,
    { ...d.holograms[0], x: 2, z: 2 }, 3, 0.5), d);
  expect([far.x, far.z]).toEqual([0, 0]);
  // And MOVE on the card drags it there.
  await page.locator('[data-mode-hologram]').click();
  await page.locator('#hologram-ask [data-hologram-move="h1"]').click();
  const { at } = await h.planFrame(page);
  await page.mouse.move(...at(10, 7.5));
  await page.mouse.down();
  await page.mouse.move(...at(10.1, 7.6), { steps: 4 });
  await page.mouse.up();
  const after = (await saved(page)).holograms[0];
  expect(after.x).toBeCloseTo(0, 6);
  expect(after.z).toBeCloseTo(0, 6);
});

test('the HOLOGRAM chip lists what is loaded; a SUITE row has no DEMO and switches back to HOLOGRAM', async ({ page }) => {
  await open(page, shell());
  const chip = page.locator('[data-mode-hologram]');
  await expect(chip).toHaveClass(/lit/);
  await chip.click();
  const card = page.locator('#hologram-ask');
  await expect(card).toBeVisible();
  await expect(card.locator('[data-hologram-row="h1"]')).toContainText('suite-a');
  await expect(card.locator('[data-hologram-mode="h1"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(card.locator('[data-hologram-demo="h1"]')).toHaveCount(0);
  await expect(card.locator('[data-hologram-move="h1"]')).toBeVisible();
  await expect(card.locator('[data-hologram-mirror="h1"]')).toBeVisible();
  await expect(card.locator('[data-hologram-copy="h1"]')).toBeVisible();
  await card.locator('[data-hologram-mode="h1"]').click();
  await expect(card.locator('[data-hologram-demo="h1"]')).toBeVisible();
  await card.locator('[data-hologram-close]').click();
  expect((await saved(page)).holograms[0].mode).toBeUndefined();
});

test('a suite draws in the normal colours, not the hologram blue', async ({ page }) => {
  const blue = () => page.evaluate(() => {
    const c = document.getElementById('plan');
    const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i + 2] > 150 && data[i + 2] - data[i] > 50) n += 1;
    return n;
  });
  await open(page, shell());
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  expect(await blue()).toBeLessThan(50);
  await open(page, shell({ mode: undefined }));
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  expect(await blue()).toBeGreaterThan(500);
});

test('a shell window where a suite window lands: both drawn, and the card warns', async ({ page }) => {
  await open(page, shell({}, [WIN('clash', 'a', 9)]));
  const d = await saved(page);
  expect(await page.evaluate(d => window.DraftHologram.clashes(d).length, d)).toBe(1);
  await page.locator('[data-mode-hologram]').click();
  await expect(page.locator('#hologram-ask [data-hologram-count]')).toContainText('1 window clash');
});

test('the elevations and sheets read the suite windows on the shell', async ({ page }) => {
  await open(page, shell());
  const d = await saved(page);
  const fens = await page.evaluate(d => window.DraftCutViewEnv.buildCutViewEnv(d,
    window.DraftDrawingFormat.levels(d.levels)).fenestrations().map(o => o.id).sort(), d);
  expect(fens).toEqual(['h1:w1', 'pub']);
});
