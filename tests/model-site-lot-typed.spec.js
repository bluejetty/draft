// THE LOT, TYPED TO THE SIXTEENTH, AND OPENED AGAIN (Movie, 18 Oct).
//
// "i'd like it if the site creater popup for the LENGTH and HEIGHT site
// option (for rectangular sites) for allow 3/8" 11/16" etc as well as 50-6"
// 50'6" 50.5' etc" -- "looks like it only allowing full ft dimensions". And:
// "i accidentally put the site the wrong direction, how about if a user
// double clicks on the site property line or the site layout view window in
// the LEVELS LAYERS tab, bring up the in initial SITE PLAN loading
// information popup so they can reload or change the info".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const SITE = 8;
const HOUSE = [[-20, -13], [20, -13], [20, 13], [-20, 13]];
const file = () => ({
  version: 1, planTurn: 0, board: 'drafting',
  levels: [{ id: SITE, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 2,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [{ id: 'house', levelId: 3, closed: true, points: HOUSE.map(([x, z]) => ({ x, y: 0, z })) }],
  shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});
async function openOnSite(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, drawing }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(drawing)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, drawing: file() });
  await page.goto(`/MODEL.html?level=${SITE}&right=1&pane=levels`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect(page.locator('#lot-pick')).toBeVisible();
}
const card = page => page.locator('#lot-pick');
async function lotOf(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const d = await h.savedDrawing(page);
  const lot = (d.outlines || []).filter(o => Number(o.levelId) === SITE);
  const xs = lot[0].points.map(p => p.x), zs = lot[0].points.map(p => p.z);
  return { count: lot.length, w: Math.max(...xs) - Math.min(...xs), d: Math.max(...zs) - Math.min(...zs), lot: d.lot };
}
async function typeLot(page, w, d) {
  await card(page).locator('[data-lot-tier="custom"]').click();
  await card(page).locator('[data-lot-width]').fill(w);
  await card(page).locator('[data-lot-depth]').fill(d);
}

test('the lot boxes take feet and inches -- 895-2 3/8, 50\'6", 50-6", 50.5\' -- to the sixteenth', async ({ page }) => {
  await openOnSite(page);
  await typeLot(page, '895-2 3/8', "349'-0 11/16\"");
  await card(page).locator('[data-lot-pick-draw]').click();
  const got = await lotOf(page);
  expect(got.w).toBeCloseTo(895 + 2.375 / 12, 6);
  expect(got.d).toBeCloseTo(349 + 0.6875 / 12, 6);
  // The other ways of writing it read the same.
  for (const [w, want] of [["50'6\"", 50.5], ['50-6"', 50.5], ["50.5'", 50.5], ['50', 50]]) {
    const ft = await page.evaluate(v => {
      const p = window.DraftFormatters.parseArchitecturalLength(v);
      return p.ok ? p.inches / 12 : null;
    }, w);
    expect(ft, w).toBe(want);
  }
});

test('a double-click on the property line opens the card on the lot\'s own size; swapped and redrawn it REPLACES the lot; one UNDO puts it back', async ({ page }) => {
  await openOnSite(page);
  await typeLot(page, '60', '150');
  await card(page).locator('[data-lot-pick-draw]').click();
  await expect(card(page)).toBeHidden();
  // The lot's left line, x = -30 about the house's middle.
  const { at } = await h.planFrame(page);
  await page.mouse.dblclick(...at(-30, 0));
  await expect(card(page)).toBeVisible();
  await expect(card(page).locator('[data-lot-width]')).toHaveValue("60'-0\"");
  await expect(card(page).locator('[data-lot-depth]')).toHaveValue("150'-0\"");
  // Turned round.
  await card(page).locator('[data-lot-width]').fill('150');
  await card(page).locator('[data-lot-depth]').fill('60');
  await card(page).locator('[data-lot-pick-draw]').click();
  let got = await lotOf(page);
  expect(got.count, 'one lot, not two').toBe(1);
  expect([Math.round(got.w), Math.round(got.d)]).toEqual([150, 60]);
  expect(got.lot.widthFt).toBe(150);
  await page.keyboard.press('Control+z');
  got = await lotOf(page);
  expect(got.count).toBe(1);
  expect([Math.round(got.w), Math.round(got.d)]).toEqual([60, 150]);
  expect(got.lot.widthFt).toBe(60);
});

test('a double-click on the SITE PLAN seat opens it too, and NOT NOW leaves the lot as it was', async ({ page }) => {
  await openOnSite(page);
  await typeLot(page, '60', '150');
  await card(page).locator('[data-lot-pick-draw]').click();
  await expect(card(page)).toBeHidden();
  await page.locator(`[data-seat="${SITE}:all"]`).dblclick();
  await expect(card(page)).toBeVisible();
  await card(page).locator('[data-lot-pick-skip]').click();
  await expect(card(page)).toBeHidden();
  const got = await lotOf(page);
  expect([got.count, Math.round(got.w), Math.round(got.d)]).toEqual([1, 60, 150]);
});
