// DOORS AND WINDOWS STAY PUT WHEN A WALL'S END IS DRAGGED (Movie, 23 Oct,
// with three screenshots of D30 and D57 sliding along with the start of the
// wall they sit on): "when a wall is stretched/shrunk lengthwise, can the
// doors stay in the same position and if the wall is squeezed smaller than
// where the door is, delete that door". An opening's offset is measured from
// its wall's start; now the end dragged re-reads every opening's offset so
// its centre stays where it stood, and one the wall no longer wholly holds
// is deleted on release. One UNDO puts the offsets and the deleted back.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
const base = () => ({
  version: 1, board: 'drafting',
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }], activeLevelIdx: 0,
  walls: [
    ['n', V(-10, -10), V(10, -10)], ['e', V(10, -10), V(10, 10)],
    ['s', V(10, 10), V(-10, 10)], ['w', V(-10, 10), V(-10, -10)],
  ].map(([id, start, end]) => ({
    id, start, end, levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
  })),
  // ON THE NORTH WALL: a window centred 4 ft from its start (x = -6) and a
  // door centred 12 ft from it (x = 2).
  fenestrations: [
    { id: 'win', wallId: 'n', levelId: 3, view: 'plan', type: 'window', offset: 4, width: 3, sillHeight: 3, headHeight: 6.67 },
    { id: 'door', wallId: 'n', levelId: 3, view: 'plan', type: 'door', offset: 12, width: 3, sillHeight: 0, headHeight: 6.67 },
  ],
  lines: [], floors: [], roofs: [], dimensions: [], outlines: [], shapes: [], surfaceOpenings: [],
  stairs: [], notes: [], roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [], nextDrawingItemId: 20,
});
async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: base() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
const saved = async page => {
  await page.locator('[data-model-save]').click();
  await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });
  return page.evaluate(async bucket => {
    const f = await window.SharedFileStore.loadSharedFile(bucket);
    return JSON.parse(await f.text());
  }, BUCKET);
};
const opening = (d, id) => (d.fenestrations || []).find(o => o.id === id) || null;
const r2 = n => Math.round(n * 100) / 100;
// Select the north wall by its body, then drag one of its ends.
async function dragEnd(page, at, from, to) {
  await page.mouse.click(...at(0, -10));
  await page.waitForTimeout(80);
  await page.mouse.move(...at(...from));
  await page.mouse.down();
  await page.mouse.move(...at(...to), { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(120);
}

test('the start dragged in 4 ft: the door stays where it stood, the window the wall no longer holds is deleted; UNDO puts both back', async ({ page }) => {
  const { at } = await open(page);
  await dragEnd(page, at, [-10, -10], [-6, -10]);
  await expect(page.locator('#strip-message')).toContainText('deleted');
  let d = await saved(page);
  expect(r2(d.walls.find(w => w.id === 'n').start.x), 'the wall starts at -6 now').toBe(-6);
  expect(r2(opening(d, 'door').offset), 'the door is still centred on x = 2: 8 ft from the new start').toBe(8);
  expect(opening(d, 'win'), 'the window, centred on x = -6, half off the wall: gone').toBeNull();
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(120);
  d = await saved(page);
  expect(r2(d.walls.find(w => w.id === 'n').start.x)).toBe(-10);
  expect(r2(opening(d, 'door').offset), "the door's offset back").toBe(12);
  expect(r2(opening(d, 'win')?.offset), 'the window back').toBe(4);
});

test('the end dragged in 7 ft: the window keeps its offset, the door whose edge now hangs off the wall is deleted', async ({ page }) => {
  const { at } = await open(page);
  // The NE corner is shared with the east wall; both stretch, only the north wall has openings.
  await dragEnd(page, at, [10, -10], [3, -10]);
  const d = await saved(page);
  expect(r2(d.walls.find(w => w.id === 'n').end.x)).toBe(3);
  expect(r2(opening(d, 'win').offset), 'measured from the start that stayed').toBe(4);
  expect(opening(d, 'door'), 'centred at 12 with 1.5 ft each side on a 13 ft wall: gone').toBeNull();
});

test('the end dragged out 4 ft: both stay exactly where they were', async ({ page }) => {
  const { at } = await open(page);
  await dragEnd(page, at, [10, -10], [14, -10]);
  await expect(page.locator('#strip-message')).not.toContainText('deleted');
  const d = await saved(page);
  expect(r2(opening(d, 'win').offset)).toBe(4);
  expect(r2(opening(d, 'door').offset)).toBe(12);
});
