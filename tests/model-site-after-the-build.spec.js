// THE SITE IS WHAT THE DRAFTER IS ASKED NEXT.
//
// Movie, 15 Oct: "basically after the house is AUTOBUILD, how about once they
// see it all pop up, after that directly go into asking them about the site
// popup ... don't use anything default", and again plainly: "just ask them
// about the SITE right after the AUTOHOUSE is built".
//
// It came out of a SITE PLAN sheet that had drawn the roof with no site under
// it. His first thought was to lay a default lot and ask later; his second
// was this one, and it is the better of the two -- a lot chosen for him and
// corrected afterwards is a lot he never chose.
//
// AFTER THE SHOW, NOT BEFORE IT. The build already owns a question that HOLDS
// the grow trip (presentBuild's note on the garage span). This is the
// opposite kind: "once they see it all pop up, AFTER THAT". So the flag is
// set when the curtain goes up and spent when it comes down -- and where
// there is no curtain, the question comes straight away.
//
// AND IT GOES TO THE SITE TO ASK, because the card's own answers assume the
// drafter is standing on the lot: DRAW IT MYSELF arms the OUTLINE tool "on
// the SITE level the drafter is already standing on", which over an elevation
// would offer a lot line drawn on E1.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const SITE_LEVEL_ID = 8;
const BUCKET = 'model-drawing';
const empty = () => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

// ON MODEL.html, WHICH IS WHERE THE CARD LIVES. h.openModel lands on
// MODEL.dc.html -- the old page -- and seeds the store; the drive-thru is
// how a premade house is ordered on this one.
async function openPlan(page, opts = {}) {
  await h.openModel(page, { webgl: false, ...opts });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

async function buildBungalow(page) {
  await h.openDriveThru(page);
  await page.locator('#dt-tiles [data-build-family="bungalow"]').click();
  await page.locator('#dt-tiles [data-build-entry="bungalow"]').click();
  await page.locator('#dt-bone').click();
}

const lotCard = page => page.locator('#lot-pick');

test('with no show to watch, the build asks about the site at once',
  async ({ page }) => {
    // BONE REVEAL is off by default for every drafter, so this is the path
    // most presses take.
    await openPlan(page);
    await expect(lotCard(page), 'nothing to ask before there is a house')
      .toBeHidden();

    await buildBungalow(page);
    await page.waitForTimeout(900);

    await expect(lotCard(page), 'the lot is the next question').toBeVisible();
    // THE LEVEL IS READ OFF THE URL, which goToLevel writes -- the card's
    // answers assume the drafter is standing on the lot, so where he is
    // standing is half the claim.
    expect(new URL(page.url()).searchParams.get('level'),
      'asked on the site, where its answers work').toBe(String(SITE_LEVEL_ID));
  });

test('and NOTHING is drawn for him before he answers', async ({ page }) => {
  // The whole of his second thought. A default AUTOSITE on the drawing would
  // make the question a correction.
  await openPlan(page);
  await buildBungalow(page);
  await page.waitForTimeout(900);
  await expect(lotCard(page)).toBeVisible();

  await page.locator('#save').click();
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);
  expect((saved.outlines || []).filter(o => o.site === true),
    'no lot until he picks one').toHaveLength(0);
  expect(saved.lot, 'and no size recorded either').toBeFalsy();
});

test('with the reveal on, the question waits for the curtain', async ({ page }) => {
  // "once they see it all pop up, AFTER THAT". A card over the house as it
  // climbs out of the ground is the show interrupted by the next question.
  await openPlan(page, { boneReveal: true });
  await buildBungalow(page);
  await expect(lotCard(page), 'not during the show').toBeHidden();

  await page.waitForTimeout(5000);   // the curtain hold + the ~2.5s reveal
  await expect(lotCard(page), 'and the question once it is over').toBeVisible();
  expect(new URL(page.url()).searchParams.get('level')).toBe(String(SITE_LEVEL_ID));
});

test('a house built on a drawing that already has its lot is not asked again',
  async ({ page }) => {
    await openPlan(page);
    await buildBungalow(page);
    await page.waitForTimeout(900);
    // Answer it once.
    await page.locator('#lot-pick [data-lot-tier]:not([disabled])').first().click();
    await page.locator('#lot-pick [data-lot-pick-draw]').click();
    await page.waitForTimeout(300);
    await expect(lotCard(page), 'answered and gone').toBeHidden();

    // A second press on a drawing that already has its shell builds nothing,
    // but the guard that matters is the LOT: a drawing carrying a site must
    // not be marched back to a card it has answered.
    await buildBungalow(page);
    await page.waitForTimeout(900);
    await expect(lotCard(page), 'it already has a lot').toBeHidden();
  });
