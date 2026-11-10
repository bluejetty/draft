// THE HOUSE ON THE SITE PLAN IS OPTIONAL.
//
// Movie, 6 Nov: "i decided not to AUTOBUILD a house, i just want to draw a
// site plan, but this GREY BOX appears and i can't seem to delete it ...
// think it might have something to do with the AUTOBUILD HOUSE not being
// used but not sure. the AUTOHOUSE should be optional, NOT required for a
// user to choose".
//
// THE GREY BOX IS THE BUILDING'S FOOTPRINT. The SITE level paints the house
// as its roof plan, shaded, over the ground storey's outline (layout-plan.js
// drawSitePlan) -- and painted it as context only: the outline lives on
// MAIN FL, outlines() offers this level's own, and the roof alone could be
// picked. So a drafter standing on the site could see the box and reach no
// part of it that would make it go. Two ways out now, and he asked for both:
//
//   1. PRESS INSIDE IT AND DELETE. The press picks the ground storey's
//      outline from inside its shading, and DELETE takes it AND the roof
//      over it in one press, one UNDO. The walls on the storeys stay.
//   2. HOUSE FOOTPRINT, a chip beside AUTO DIMS on this level, hides the
//      building on the site plan without touching it -- the file's own
//      switch, so LAYOUT's SITE PLAN sheet agrees with the screen.
//
// The fixture is the smallest file that shows the box: a lot, a footprint
// on MAIN FL, a roof over it on ROOF. No walls, because the box appears
// without them -- which is what he found.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const SITE = 8, ROOF = 7, MAIN = 3;
const ring = ([w, d]) => [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]
  .map(([x, z]) => ({ x, y: 0, z }));

const file = ({ footprint = true, roof = true, siteFootprint } = {}) => ({
  version: 1, planTurn: 0, board: 'drafting',
  ...(siteFootprint === undefined ? {} : { siteFootprint }),
  levels: [{ id: SITE, name: 'SITE', elev: 0 }, { id: ROOF, name: 'ROOF', elev: 0 },
    { id: MAIN, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 2,
  walls: [], lines: [], floors: [], fenestrations: [], dimensions: [],
  roofs: roof ? [{
    id: 'roof-1', levelId: ROOF, sourceLevelId: MAIN, sourceShapeId: null,
    points: ring([44, 30]), edges: ['eave', 'eave', 'eave', 'eave'],
    overhang: 2, edgeOverhang: [2, 2, 2, 2], pitch: 4, fascia: 5.5,
    garage: false, follows: 'none', layer: 'A-ROOF',
  }] : [],
  outlines: [
    { id: 'lot', levelId: SITE, site: true, garage: false, detached: false, masterId: null,
      foundation: null, closed: true, points: ring([60, 120]), overriddenSrcIds: [] },
    ...(footprint ? [{ id: 'house', levelId: MAIN, closed: true, masterId: null,
      garage: false, detached: false, foundation: null, points: ring([40, 26]), overriddenSrcIds: [] }] : []),
  ],
  shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

async function openOnSite(page, f = file()) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, drawing }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(drawing)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, drawing: f });
  await page.goto(`/MODEL.html?level=${SITE}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(400);
}

const saved = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};

// WHAT THE SITE PLAN IS PAINTING, asked of the painter's own reader rather
// than counted in pixels: the parts it would shade are the parts the
// drafter sees as the grey box.
const painted = async page => {
  const d = await saved(page);
  return page.evaluate(d => {
    const parts = window.DraftLayoutPlan.sitePlanParts(d);
    return { bodies: parts.bodies.length, roofs: parts.roofs.length, lot: !!parts.lot };
  }, d);
};

const chip = page => page.locator('[data-site-footprint]');

// A PRESS ON THE PLAN, where the page says a world point is (planFrame reads
// the camera the page publishes). The LEVELS panel stands over the right of
// the plan and is folded away first, as the other MODEL.html specs do.
async function pressPlan(page, x, z) {
  const levels = page.getByRole('button', { name: 'LEVELS / LAYERS' });
  if (await levels.getAttribute('aria-expanded') === 'true') await levels.click();
  const { at } = await h.planFrame(page);
  await page.mouse.click(...at(x, z));
  await page.waitForTimeout(200);
}

test('a site plan with no house has no grey box and no chip', async ({ page }) => {
  // THE CASE HE WANTS: a lot and nothing else. Nothing is shaded, and the
  // switch for a building that is not there is not offered.
  await openOnSite(page, file({ footprint: false, roof: false }));
  expect(await painted(page)).toEqual({ bodies: 0, roofs: 0, lot: true });
  await expect(chip(page)).toBeHidden();
});

test('a press inside the grey box picks the footprint, and DELETE takes it and its roof', async ({ page }) => {
  await openOnSite(page);
  expect(await painted(page), 'the fixture must show the box before it can be deleted')
    .toEqual({ bodies: 1, roofs: 1, lot: true });

  // INSIDE THE SHADING, not on an edge: the footprint is a filled shape on
  // this level, and the middle of it is where a drafter presses on a box.
  await pressPlan(page, 3, 2);
  await expect(page.locator('#readout')).toContainText('1 selected');

  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);
  const after = await saved(page);
  expect((after.outlines || []).map(o => o.id), 'the house outline is gone and the lot stays')
    .toEqual(['lot']);
  expect(after.roofs || [], 'the roof over the footprint went with it').toEqual([]);
  expect(await painted(page)).toEqual({ bodies: 0, roofs: 0, lot: true });

  // ONE UNDO PUTS BOTH BACK.
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);
  const back = await saved(page);
  expect((back.outlines || []).map(o => o.id).sort()).toEqual(['house', 'lot']);
  expect((back.roofs || []).map(r => r.id)).toEqual(['roof-1']);
});

test('HOUSE FOOTPRINT hides the building on the site plan without touching it', async ({ page }) => {
  await openOnSite(page);
  await expect(chip(page)).toBeVisible();
  await expect(chip(page)).toHaveAttribute('aria-pressed', 'true');

  await chip(page).click();
  await page.waitForTimeout(300);
  await expect(chip(page)).toHaveAttribute('aria-pressed', 'false');
  // THE CHIP STAYS UP while the footprint is hidden, or there is no way back.
  await expect(chip(page)).toBeVisible();
  const hidden = await saved(page);
  expect(hidden.siteFootprint, 'the switch is the file\'s, so the LAYOUT sheet reads it too').toBe(false);
  expect((hidden.outlines || []).map(o => o.id).sort(), 'hiding deletes nothing').toEqual(['house', 'lot']);
  expect((hidden.roofs || []).length).toBe(1);
  expect(await painted(page), 'nothing of the building is painted on the site').toEqual({ bodies: 0, roofs: 0, lot: true });

  // AND NOTHING TO PICK UNDER AN EMPTY LOT: a press where the box was takes
  // nothing, so DELETE cannot reach a building that is out of sight.
  await pressPlan(page, 3, 2);
  await expect(page.locator('#readout')).not.toContainText('selected');

  await chip(page).click();
  await page.waitForTimeout(300);
  await expect(chip(page)).toHaveAttribute('aria-pressed', 'true');
  expect(await painted(page)).toEqual({ bodies: 1, roofs: 1, lot: true });
});

test('the switch is read by the sheet painter, not only the screen', async ({ page }) => {
  // LAYOUT's SITE PLAN sheet and the screen paint with the same reader, so a
  // file carrying the switch off shades nothing wherever it is drawn.
  await openOnSite(page, file({ siteFootprint: false }));
  expect(await painted(page)).toEqual({ bodies: 0, roofs: 0, lot: true });
  await expect(chip(page)).toBeVisible();
  await expect(chip(page)).toHaveAttribute('aria-pressed', 'false');
});

// ── A SHADOW CAN ALWAYS BE PRESSED (Movie, 9 Nov) ─────────────────────────
//
// "i'm trying to draw the site plan ... then the box with shading was
// created and i can't select or delete it, what is it?" It was a three-point
// sliver on 2ND FL: once MAIN FL's footprint came off the site, 2ND FL was
// the lowest storey and the site plan shaded ITS outline -- a shape too thin
// to have an inside a hand could land in, and the press only ever asked
// inside. So on SITE a press on a shadow's EDGE picks it too, for bodies and
// for roofs, and every roof the site plan paints is a roof that can be
// picked there, not only ROOF level's.
const sliver = ({ roofOnStorey = false } = {}) => ({
  ...file({ footprint: false, roof: false }),
  levels: [{ id: SITE, name: 'SITE', elev: 0 }, { id: ROOF, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: MAIN, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  outlines: [
    { id: 'lot', levelId: SITE, site: true, garage: false, detached: false, masterId: null,
      foundation: null, closed: true, points: ring([60, 120]), overriddenSrcIds: [] },
    // A SLIVER ON 2ND FL: 30 ft long, a tenth of a foot wide at its widest.
    { id: 'sliver', levelId: 5, closed: true, masterId: null, garage: false, detached: false,
      foundation: null, points: [{ x: -15, y: 0, z: 0 }, { x: 15, y: 0, z: -0.1 }, { x: 15, y: 0, z: 0.1 }], overriddenSrcIds: [] },
  ],
  roofs: roofOnStorey ? [{
    id: 'roof-storey', levelId: MAIN, sourceLevelId: null, sourceShapeId: null,
    points: [{ x: -20, y: 0, z: 20 }, { x: 20, y: 0, z: 20 }, { x: 20, y: 0, z: 20.1 }], edges: ['eave', 'eave', 'eave'],
    overhang: 2, edgeOverhang: [2, 2, 2], pitch: 4, fascia: 5.5,
    garage: false, follows: 'none', layer: 'A-ROOF',
  }] : [],
});

test('a sliver shaded on SITE is picked on its edge, and DELETE takes it off', async ({ page }) => {
  await openOnSite(page, sliver());
  expect(await painted(page), 'the sliver is the body the site plan shades').toEqual({ bodies: 1, roofs: 0, lot: true });
  await pressPlan(page, 0, 0);
  await expect(page.locator('#readout')).toContainText('1 selected');
  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);
  const after = await saved(page);
  expect((after.outlines || []).map(o => o.id), 'the sliver is gone and the lot stays').toEqual(['lot']);
  expect(await painted(page)).toEqual({ bodies: 0, roofs: 0, lot: true });
});

test('a roof the site plan paints is picked there whatever level it is filed on, edge or inside', async ({ page }) => {
  await openOnSite(page, sliver({ roofOnStorey: true }));
  expect(await painted(page)).toEqual({ bodies: 1, roofs: 1, lot: true });
  await pressPlan(page, 0, 20);
  await expect(page.locator('#readout')).toContainText('1 selected');
  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);
  const after = await saved(page);
  expect(after.roofs || [], 'the roof is gone').toEqual([]);
  expect((after.outlines || []).map(o => o.id).sort(), 'and nothing else went with it').toEqual(['lot', 'sliver']);
});
