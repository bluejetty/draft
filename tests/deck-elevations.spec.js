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

async function open(page, view) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async file => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(file)], 'drawing.json', { type: 'application/json' }), 'model-drawing');
  }, FIXTURE);
  await page.goto(`/MODEL.html?left=1&level=3&view=${encodeURIComponent(view)}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
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
    // Top of MAIN FL's floor, down by the deck's own 10".
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
