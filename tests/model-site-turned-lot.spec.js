// A TURNED HOUSE IS OFFERED A LOT IT FITS IN.
//
// Movie, 16 Oct, with his bungalow and garage turned a quarter on the site:
// "it selected a site plan not wide enough this time". The card read the
// house along x (32) and offered the 45 ft lot; the lot, laid on the turned
// axes, put its 45 ft of frontage along z, where the house runs 50.
//
// proto/lot-sizes-harness.js proves the measure; this is the card on the
// page, and proto/site-turned-lot-mutants.js is its gate.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');
const BUCKET = 'model-drawing';
const SITE = 8;
// 32 along x, 50 along z -- and turned a quarter, so the front faces +x and
// the lot's frontage runs along z.
const HOUSE = [[0, 0], [32, 0], [32, 50], [0, 50]];
const file = ({ planTurn = 1 } = {}) => ({
  version: 1, planTurn, board: 'drafting',
  levels: [{ id: SITE, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 2,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [{ id: 'house', levelId: 3, closed: true, points: HOUSE.map(([x, z]) => ({ x, y: 0, z })) }],
  shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});
async function openOnSite(page, f) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, drawing }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(drawing)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, drawing: f });
  await page.goto(`/MODEL.html?level=${SITE}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect(page.locator('#lot-pick')).toBeVisible();
  await page.waitForTimeout(300);
}
const lotOf = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const d = await h.savedDrawing(page);
  return (d.outlines || []).find(o => Number(o.levelId) === SITE) || null;
};
const extents = pts => {
  const xs = pts.map(p => p.x), zs = pts.map(p => p.z);
  return { x: Math.max(...xs) - Math.min(...xs), z: Math.max(...zs) - Math.min(...zs),
    x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
};

test('turned a quarter, the card reads the house across its front and OK draws a lot it fits in',
  async ({ page }) => {
    await openOnSite(page, file({ planTurn: 1 }));
    const card = page.locator('#lot-pick');
    // "50'-0" of building", not 32: the width across the front.
    await expect(card.locator('[data-lot-note]')).toContainText("50'-0\" of building");
    await expect(card.locator('[data-lot-note]')).toContainText('needs at least 58\'-0"');
    await card.locator('[data-lot-pick-ok]').click();
    const lot = await lotOf(page);
    expect(lot, 'OK drew the autosite').toBeTruthy();
    const e = extents(lot.points);
    // The frontage runs along z on a quarter turn, and it is the 65 ft XXL,
    // the first on the list past 58 -- not the 45 ft L the x-reading gave.
    expect(Math.round(e.z), 'the frontage along z is the XXL\'s 65').toBe(65);
    expect(Math.round(e.x), 'and its depth along x').toBe(150);
    // AND THE HOUSE IS INSIDE IT, every corner, which is the whole point.
    const house = extents(HOUSE.map(([x, z]) => ({ x, z })));
    expect(e.z0, 'the lot reaches past the house\'s near side').toBeLessThan(house.z0);
    expect(e.z1, 'and past its far side').toBeGreaterThan(house.z1);
    expect(e.x0).toBeLessThan(house.x0);
    expect(e.x1).toBeGreaterThan(house.x1);
  });

test('unturned, the same house reads 32 and takes the 45 ft lot as before', async ({ page }) => {
  await openOnSite(page, file({ planTurn: 0 }));
  await expect(page.locator('#lot-pick [data-lot-note]')).toContainText("32'-0\" of building");
  await page.locator('#lot-pick [data-lot-pick-ok]').click();
  const lot = await lotOf(page);
  const e = extents(lot.points);
  expect([Math.round(e.x), Math.round(e.z)]).toEqual([45, 120]);
});
