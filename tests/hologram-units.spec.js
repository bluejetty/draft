// A HOLOGRAM PICKED LIKE AN ASSEMBLY UNIT (Movie, 20 Oct).
//
// "would it be possible to SELECT the HOLOGRAM UNITS as like selecting a
// ASSEMBLY unit - and allow the user to copy, flip rotate etc in the way they
// can do it with a selected ASSEMBLY unit (or units) id like to pick all 4 of
// these suites with a rectagular select and then copy / flip them". A click
// on a suite's wall picks the whole suite; the box catches suites; the foot's
// MOVE, ROTATE, FLIP, COPY / PASTE and DELETE act on them, several at once.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b) => ({ id, levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 9, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 },
  { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
const EMPTY = { walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [],
  beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [] };
// A 20 x 15 SUITE drawn from (0,0); two of it in a 60 x 30 shell, side by
// side along the bottom wall, the second 30' along.
const SUITE = { version: 1, levels: LEVELS, activeLevelIdx: 2, ...EMPTY,
  walls: [W('s1', [0, 0], [20, 0]), W('s2', [20, 0], [20, 15]), W('s3', [20, 15], [0, 15]), W('s4', [0, 15], [0, 0])] };
const holo = (id, x) => ({ id, name: 'suite-a', mode: 'suite', x, z: 0, angleDeg: 0, pivotX: 10, pivotZ: 7.5, source: SUITE });
const shell = () => ({ version: 1, board: 'drafting', planTurn: 0, levels: LEVELS, activeLevelIdx: 2, ...EMPTY,
  walls: [W('a', [0, 0], [60, 0]), W('b', [60, 0], [60, 30]), W('c', [60, 30], [0, 30]), W('d', [0, 30], [0, 0])],
  holograms: [holo('h1', 0), holo('h2', 30)] });

async function open(page, f = shell()) {
  page.__errors = [];
  page.on('pageerror', err => page.__errors.push(String(err)));
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html?level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
test.afterEach(async ({ page }) => { expect(page.__errors || [], 'no page errors').toEqual([]); });
const click = async (page, at, x, z) => { await page.mouse.click(...at(x, z)); await page.waitForTimeout(100); };
async function drag(page, at, from, to) {
  await page.mouse.move(...at(...from));
  await page.mouse.down();
  await page.mouse.move(...at(...to), { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(120);
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const r2 = n => Math.round(n * 100) / 100 + 0;
const placeOf = holo => [r2(holo.x), r2(holo.z), r2(Number(holo.angleDeg) || 0), holo.flip === true];

test('a click on a suite\'s own wall picks the whole suite; DELETE takes it, UNDO brings it back', async ({ page }) => {
  const { at } = await open(page);
  // s2, the first suite's inside wall at x = 20, not on the shell's.
  await click(page, at, 20, 7);
  await page.locator('#delete').click();
  let d = await saved(page);
  expect(d.holograms.map(x => x.id)).toEqual(['h2']);
  expect(d.walls, 'the shell is untouched').toHaveLength(4);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  d = await saved(page);
  expect(d.holograms.map(x => x.id).sort()).toEqual(['h1', 'h2']);
});

test('the box catches suites: a blue box round both, DELETE takes both', async ({ page }) => {
  const { at } = await open(page);
  // LEFT TO RIGHT, from open sheet inside the shell, round both suites.
  await drag(page, at, [-3, -3], [53, 17]);
  await page.locator('#delete').click();
  const d = await saved(page);
  expect(d.holograms, 'both suites went').toHaveLength(0);
});

test('MOVE carries the picked suite by its offset; UNDO puts it back', async ({ page }) => {
  const { at } = await open(page);
  await click(page, at, 20, 7);
  await page.locator('#model-move').click();
  await drag(page, at, [10, 7], [10, 12]);
  let d = await saved(page);
  const h1 = d.holograms.find(x => x.id === 'h1');
  expect(r2(h1.x)).toBe(0);
  expect(h1.z, 'five feet down').toBeCloseTo(5, 0);
  expect(placeOf(d.holograms.find(x => x.id === 'h2')), 'the other stays').toEqual([30, 0, 0, false]);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  d = await saved(page);
  expect(placeOf(d.holograms.find(x => x.id === 'h1'))).toEqual([0, 0, 0, false]);
});

test('ROTATE a quarter: a lone suite turns on its own middle', async ({ page }) => {
  const { at } = await open(page);
  await click(page, at, 20, 7);
  await page.locator('#model-rotate').click();
  await page.locator('[data-rotate-by="90"]').click();
  const d = await saved(page);
  expect(placeOf(d.holograms.find(x => x.id === 'h1'))).toEqual([0, 0, 90, false]);
});

test('FLIP left for right, both suites: the pair mirrors about its middle -- they swap places and turn over', async ({ page }) => {
  const { at } = await open(page);
  await drag(page, at, [-3, -3], [53, 17]);
  await page.locator('#model-flip').click();
  await page.locator('[data-flip-axis="x"]').click();
  let d = await saved(page);
  // THE PAIR RUNS x 0 TO 50, ITS MIDDLE 25: h1's middle at 10 goes to 40
  // (offset 30), h2's at 40 to 10 (offset 0). Both turned over.
  expect(placeOf(d.holograms.find(x => x.id === 'h1'))).toEqual([30, 0, 0, true]);
  expect(placeOf(d.holograms.find(x => x.id === 'h2'))).toEqual([0, 0, 0, true]);
  // ONE UNDO TAKES THE FLIP BACK.
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  d = await saved(page);
  expect(placeOf(d.holograms.find(x => x.id === 'h1'))).toEqual([0, 0, 0, false]);
  expect(placeOf(d.holograms.find(x => x.id === 'h2'))).toEqual([30, 0, 0, false]);
});

test('FLIP top for bottom turns a suite over with a half turn', async ({ page }) => {
  const { at } = await open(page);
  await click(page, at, 20, 7);
  await page.locator('#model-flip').click();
  await page.locator('[data-flip-axis="z"]').click();
  const d = await saved(page);
  expect(placeOf(d.holograms.find(x => x.id === 'h1'))).toEqual([0, 0, 180, true]);
});

test('COPY and PASTE a suite: another of the same file where it stood, its own id, no level of ours', async ({ page }) => {
  const { at } = await open(page);
  await click(page, at, 20, 7);
  await page.locator('#copy').click();
  await page.locator('#paste').click();
  // AND MOVE IT, since it lands selected.
  await page.locator('#model-move').click();
  await drag(page, at, [10, 7], [10, 22]);
  const d = await saved(page);
  expect(d.holograms).toHaveLength(3);
  const copy = d.holograms.find(x => !['h1', 'h2'].includes(x.id));
  expect(copy.name).toBe('suite-a');
  expect(copy.mode).toBe('suite');
  expect(copy.levelId ?? null).toBeNull();
  expect(copy.z, 'moved down 15 ft').toBeCloseTo(15, 0);
  expect(placeOf(d.holograms.find(x => x.id === 'h1')), 'the first stayed').toEqual([0, 0, 0, false]);
});

test('a double-click on a suite still opens the HOLOGRAM card', async ({ page }) => {
  const { at } = await open(page);
  await page.mouse.dblclick(...at(20, 7));
  await expect(page.locator('#hologram-ask')).toBeVisible();
});

// ── THE LIST: ONE CARD PER FILE, A NUMBERED ROW PER COPY ───────────────
// Movie, 20 Oct: "can we do 1 per file (and 1 color per file) and then a
// list within that of each copy, with a number assigned and when they click
// it or scroll past it it will light up and its' suite will also light up"
// -- "and it would need to update the HOLOGRAM list with the new ones".
const OTHER = { ...SUITE, walls: SUITE.walls.map(w => ({ ...w })) };
const twoFiles = () => ({ ...shell(), holograms: [holo('h1', 0), holo('h2', 30),
  { id: 'h3', name: 'suite-b', mode: 'suite', x: 0, z: 15, angleDeg: 0, pivotX: 10, pivotZ: 7.5, source: OTHER }] });
const openList = async page => {
  await page.locator('[data-mode-hologram]').click();
  await expect(page.locator('#hologram-ask')).toBeVisible();
};

test('the list: one card per file in its own colour, a numbered row per copy', async ({ page }) => {
  await open(page, twoFiles());
  await openList(page);
  const cards = page.locator('#hologram-ask [data-hologram-file-card]');
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0).locator('[data-hologram-name]')).toHaveText('suite-a');
  await expect(cards.nth(0).locator('[data-hologram-copies]')).toHaveText('2 copies');
  await expect(cards.nth(0).locator('[data-hologram-number]')).toHaveText(['#1', '#2']);
  await expect(cards.nth(1).locator('[data-hologram-number]')).toHaveText(['#1']);
  const swatches = await page.locator('#hologram-ask [data-hologram-swatch]').evaluateAll(els => els.map(e => e.dataset.hologramSwatch));
  expect(swatches[0], 'the first file keeps the blue').toBe('rgb(82,151,218)');
  expect(swatches[1], 'the second file has a colour of its own').not.toBe(swatches[0]);
});

test('a row clicked picks its suite on the plan; a suite picked on the plan lights its row', async ({ page }) => {
  const { at } = await open(page, twoFiles());
  await openList(page);
  await page.locator('#hologram-ask [data-hologram-row="h2"] [data-hologram-number]').click();
  await expect(page.locator('#hologram-ask [data-hologram-row="h2"]')).toHaveAttribute('data-lit', '');
  // PICKED: DELETE takes that one.
  await page.locator('#hologram-ask [data-hologram-close]').click();
  await page.locator('#delete').click();
  let d = await saved(page);
  expect(d.holograms.map(x => x.id).sort()).toEqual(['h1', 'h3']);
  // AND THE OTHER WAY: picked on the plan, its row lights.
  await click(page, at, 20, 7);
  await openList(page);
  await expect(page.locator('#hologram-ask [data-hologram-row="h1"]')).toHaveAttribute('data-lit', '');
  await expect(page.locator('#hologram-ask [data-hologram-row="h3"]')).not.toHaveAttribute('data-lit', '');
});

test('the pointer passing a row lights its suite on the plan', async ({ page }) => {
  const { at } = await open(page, twoFiles());
  await openList(page);
  // ON h2's OWN RIGHT WALL (x = 50), clear of the card: its ink there, before
  // and after the pointer passes its row.
  const [px, py] = at(50, 4);
  const ink = () => page.evaluate(({ x, y }) => {
    const c = document.getElementById('plan');
    const r = c.getBoundingClientRect();
    const k = c.width / r.width;
    const d = c.getContext('2d').getImageData(Math.round((x - r.left) * k), Math.round((y - r.top) * k), 1, 1).data;
    return [d[0], d[1], d[2]];
  }, { x: px, y: py });
  const before = await ink();
  await page.locator('#hologram-ask [data-hologram-row="h2"] [data-hologram-number]').hover();
  await page.waitForTimeout(150);
  expect(await ink(), 'its wall lit').not.toEqual(before);
  await page.mouse.move(5, 300);
  await page.waitForTimeout(150);
  expect(await ink(), 'and dark again when the pointer leaves').toEqual(before);
});

test('a paste on the plan shows in the list as the next copy', async ({ page }) => {
  const { at } = await open(page, twoFiles());
  await click(page, at, 20, 7);
  await page.locator('#copy').click();
  await page.locator('#paste').click();
  await openList(page);
  await expect(page.locator('#hologram-ask [data-hologram-file-card="suite-a"] [data-hologram-number]'))
    .toHaveText(['#1', '#2', '#3']);
});

test('a new file brought in takes a colour no file here has, and keeps it', async ({ page }) => {
  await open(page, twoFiles());
  await page.locator('[data-mode-trace]').click();
  await page.locator('[data-hologram-upload]').click();
  await page.locator('[data-hologram-file]').setInputFiles(
    { name: 'suite-c.draft', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(SUITE)) });
  await page.keyboard.press('Escape');
  const d = await saved(page);
  const c = d.holograms.find(x => x.name === 'suite-c');
  expect(c.colour, 'blue and the second colour are taken').toBe(2);
});
