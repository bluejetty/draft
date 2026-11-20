// DECKS ON THE ELEVATIONS AND ON THE WALLS PLAN (jb, 19 Nov 2026).
//
// jb: "i'm drawing in decks but they aren't showing on the elevations", and
// "when i draw it the outline edge of the floor should show on the
// corresponding 'floor plan'". A deck is a FLOOR drawn on a storey's FLOOR
// LAYOUT that stands out past that storey's walls (geometry-2d deckFloors).
// The elevation paints its edge band -- top of floor down by its thickness --
// across its width as that side sees it (cut-view.js deckBands, published on
// the canvas as data-decks); the walls plan of the same storey draws its
// outline (model/01 paintDeckEdges, data-deck-edges).
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const P = (x, z) => ({ x, y: 0, z });
const wall = (id, a, b, levelId, view) => ({ id, start: a, end: b, levelId, view,
  wallType: view === 'foundation' ? 'concrete_8' : 'stud_2x6', baseHeight: 0, topHeight: 8 });
const ring = (prefix, levelId, view) => {
  const c = [P(0, 0), P(-30, 0), P(-30, -20), P(0, -20)];
  return c.map((a, i) => wall(`${prefix}-${i}`, a, c[(i + 1) % 4], levelId, view));
};
const TH = 10 / 12;
const FIXTURE = {
  version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0, visible: true },
    { id: 7, name: 'ROOF', elev: 9, visible: true },
    { id: 3, name: 'MAIN FL', elev: 0, visible: true },
    { id: 1, name: 'FOUNDATION', elev: -10, visible: true },
  ],
  activeLevelIdx: 2,
  walls: [...ring('m', 3, 'plan'), ...ring('f', 1, 'foundation')],
  lines: [], outlines: [], groups: [], roofs: [], fenestrations: [], dimensions: [],
  shapes: [], surfaceOpenings: [], stairs: [], notes: [], roomTags: [],
  columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [], levelLocks: [], underlays: [],
  floors: [
    // The house's own floor, on the wall line: never a deck.
    { id: 'house', levelId: 3, view: 'floor', structure: 'floor', thickness: 1.0521,
      points: [P(0, 0), P(-30, 0), P(-30, -20), P(0, -20)] },
    // Off the +x end, 8 ft out, 12 ft wide.
    { id: 'deck-e', levelId: 3, view: 'floor', structure: 'floor', thickness: TH,
      points: [P(0, -16), P(8, -16), P(8, -4), P(0, -4)] },
  ],
};

async function open(page, view, file = FIXTURE) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async file => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(file)], 'drawing.json', { type: 'application/json' }), 'model-drawing');
  }, file);
  await page.goto(`/MODEL.html?left=1&level=3&view=${encodeURIComponent(view)}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
const S1 = { id: 'S1', name: 'S1', elev: 0, levelId: null,
  startPt: { x: -36, z: -10 }, endPt: { x: 14, z: -10 }, dirVec: { x: 0, z: 1 } };
const attr = (page, name) => page.evaluate(n => JSON.parse(document.getElementById('plan').getAttribute(n) || 'null'), name);
const decks = page => page.evaluate(() => JSON.parse(document.getElementById('plan').getAttribute('data-decks') || 'null'));

test('a floor out past the walls draws as a deck band on every elevation that sees it, the house floor never does', async ({ page }) => {
  const seen = {};
  for (const id of ['E1', 'E2', 'E3', 'E4']) {
    await open(page, `cut:${id}`);
    await expect.poll(() => decks(page)).not.toBeNull();
    seen[id] = await decks(page);
  }
  for (const id of ['E1', 'E2', 'E3', 'E4']) {
    // One band, the deck's: the house floor sits on the wall line.
    expect(seen[id].map(b => b.id), id).toEqual(['deck-e']);
    const [band] = seen[id];
    // THE DECK TYPE (jb, 20 Nov): 2x10 + 3/4" = 10", its top 2" under
    // MAIN FL's floor -- the step down out of the door.
    expect(band.top, id).toBeCloseTo(-2 / 12, 3);
    expect(band.top - band.bottom, id).toBeCloseTo(TH, 3);
    // The whole band shows inside the window, never clipped at the marks.
    const width = band.hi - band.lo;
    expect([8, 12].some(w => Math.abs(w - width) < 0.01), `${id} width ${width}`).toBe(true);
  }
  // Seen from the long sides it is 8 ft out; end on, 12 ft across.
  const widths = Object.values(seen).map(([b]) => Math.round(b.hi - b.lo)).sort((a, b) => a - b);
  expect(widths).toEqual([8, 8, 12, 12]);
});

test('the deck draws its outline on its storey\'s walls plan, and only there', async ({ page }) => {
  await open(page, 'plan');
  await expect.poll(() => page.locator('#plan').getAttribute('data-deck-edges')).toBe('deck-e');
  await page.goto('/MODEL.html?left=1&level=3&view=floor');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect.poll(() => page.locator('#plan').getAttribute('data-deck-edges')).toBe('');
});

test('a DECK is its own band on a section, 2" down and ending at the wall; the house floor stops at the wall', async ({ page }) => {
  await open(page, 'cut:S1', { ...FIXTURE, cuts: [S1] });
  await expect.poll(() => attr(page, 'data-section-decks')).not.toBeNull();
  const [deck, ...rest] = await attr(page, 'data-section-decks');
  expect(rest).toEqual([]);
  expect(deck.id).toBe('deck-e');
  expect(deck.hi - deck.lo).toBeCloseTo(8, 2);
  expect(deck.top).toBeCloseTo(-2 / 12, 3);
  expect(deck.top - deck.bottom).toBeCloseTo(TH, 3);
});

test('the DECK DROP box moves a deck\'s top, and FLOOR on the type chips makes it a plain floor again', async ({ page }) => {
  const file = { ...FIXTURE, floors: FIXTURE.floors.map(f => (f.id === 'deck-e' ? { ...f, deckDropIn: 3 } : f)) };
  await open(page, 'cut:E1', file);
  await expect.poll(async () => (await decks(page))?.[0]?.top).toBeCloseTo(-3 / 12, 3);
  // Off the drawing itself: deck:false says FLOOR wherever it sits.
  const plain = { ...FIXTURE, floors: FIXTURE.floors.map(f => (f.id === 'deck-e' ? { ...f, deck: false } : f)) };
  await open(page, 'cut:E1', plain);
  await expect.poll(() => decks(page)).toEqual([]);
});

test('picking a deck on the FLOOR LAYOUT says DECK on the panel; DECK DROP and the FLOOR chip write the floor', async ({ page }) => {
  await open(page, 'floor');
  // Into the clear: the right rail stands over the deck's end of the plan.
  await page.goto('/MODEL.html?level=3&view=floor&right=0');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('s');
  const { at } = await h.planFrame(page);
  const [x, y] = at(6, -10);
  await page.mouse.click(x, y);
  await expect.poll(() => page.evaluate(() => selection.map(s => s.item.id))).toEqual(['deck-e']);
  await expect(page.locator('[data-prop-deck-assembly]')).toHaveText('DECK 9 1/4" 2x10 + 3/4" SHTG');
  const drop = page.locator('input[data-roof-field="deck drop in"]');
  await expect(drop).toHaveValue('2');
  // The OBJ / PROP pane may be folded; the box's own change is what commits.
  await drop.evaluate(input => { input.value = '3'; input.dispatchEvent(new Event('change')); });
  await expect.poll(() => page.evaluate(() => drawing.floors.find(f => f.id === 'deck-e').deckDropIn)).toBe(3);
  await page.locator('[data-prop-row="type"] [data-prop-value="floor"]').evaluate(btn => btn.click());
  await expect.poll(() => page.evaluate(() => drawing.floors.find(f => f.id === 'deck-e').deck)).toBe(false);
  await expect(page.locator('[data-prop-deck-assembly]')).toHaveCount(0);
});
