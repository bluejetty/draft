// THE LOT CARD OPENS ONLY WHEN ASKED FOR (jb, 9 Nov 2026): "can i only have
// this site plan menu pop up when they ask for it, maybe SITE PLAN button in
// build to open that (put it at the end make it look like a site plan" --
// and why: "that popup popuped up in bad placed too many times".
//
// This replaces model-site-after-the-build.spec.js, which held Movie's
// 15 Oct rule that the build marched the drafter to SITE and asked about the
// lot once the curtain fell. That rule is gone, and so is the older one that
// asked on arriving at SITE with no lot. What is left is one door on a
// drawing with no lot -- the SITE PLAN key, last of the BUILD keys -- and the
// double-click on a lot already drawn (model-site-lot-typed.spec.js).
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

async function openPlan(page, query = '', opts = {}) {
  await h.openModel(page, { webgl: false, ...opts });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty() });
  await page.goto(`/MODEL.html${query}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

async function buildBungalow(page) {
  await h.openDriveThru(page);
  await page.locator('#dt-tiles [data-build-family="bungalow"]').click();
  await page.locator('#dt-tiles [data-build-entry="bungalow"]').click();
  await page.locator('#dt-bone').click();
}

const lotCard = page => page.locator('#lot-pick');
const key = page => page.locator('[data-site-plan-key]');
const levelInUrl = page => new URL(page.url()).searchParams.get('level');

test('arriving at SITE with no lot asks nothing', async ({ page }) => {
  await openPlan(page, `?level=${SITE_LEVEL_ID}`);
  await page.waitForTimeout(600);
  await expect(lotCard(page), 'no pop-up on arrival').toBeHidden();
  // Nor on coming back to it.
  await h.pickModelLevel(page, 3);
  await h.pickModelLevel(page, SITE_LEVEL_ID);
  await page.waitForTimeout(400);
  await expect(lotCard(page)).toBeHidden();
});

test('a build asks nothing either, with or without the show', async ({ page }) => {
  await openPlan(page);
  await buildBungalow(page);
  await page.waitForTimeout(1200);
  await expect(lotCard(page), 'no question after the build').toBeHidden();
  expect(levelInUrl(page), 'and the drafter is not marched to SITE')
    .not.toBe(String(SITE_LEVEL_ID));
  // NOTHING DRAWN FOR HIM EITHER: an AUTOSITE laid unasked would be a lot he
  // never chose (Movie's own second thought, still standing).
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);
  expect((saved.outlines || []).filter(o => o.site === true)).toHaveLength(0);
  expect(saved.lot).toBeFalsy();
});

test('with the reveal on, the curtain falls and still nothing is asked', async ({ page }) => {
  await openPlan(page, '', { boneReveal: true });
  await buildBungalow(page);
  await page.waitForTimeout(5000);   // the curtain hold + the ~2.5s reveal
  await expect(lotCard(page)).toBeHidden();
});

test('the SITE PLAN key is the last of the BUILD keys and wears a drawing, not a letter',
  async ({ page }) => {
    await openPlan(page, '?lpane=build&left=1');
    const keys = page.locator('[data-tool-group="build"] .tool-key');
    await expect(keys.last()).toHaveAttribute('data-site-plan-key', '');
    await expect(key(page).locator('[data-tool-name]')).toHaveText('SITE PLAN');
    await expect(key(page).locator('[data-tool-letter]')).toHaveText('');
    await expect(key(page).locator('[data-tool-icon] svg')).toHaveCount(1);
    expect(await key(page).getAttribute('title')).toMatch(/^SITE PLAN/);
    // NOT A TOOL: the roster's keys set activeTool; this one does not.
    await expect(key(page)).not.toHaveAttribute('data-tool-key', /.*/);
  });

test('pressing it from another level goes to SITE and opens the card', async ({ page }) => {
  await openPlan(page, '?lpane=build&left=1');
  await expect(lotCard(page)).toBeHidden();
  await key(page).click();
  await expect(lotCard(page), 'the card is up').toBeVisible();
  expect(levelInUrl(page), 'on SITE, where its answers work').toBe(String(SITE_LEVEL_ID));
  // NOT NOW puts it away, and it stays away: a repaint must not bring it
  // back, which is the whole of the complaint.
  await lotCard(page).locator('[data-lot-pick-skip]').click();
  await expect(lotCard(page)).toBeHidden();
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(300);
  await expect(lotCard(page)).toBeHidden();
});

test('leaving SITE with the card up puts it down, and coming back does not raise it',
  async ({ page }) => {
    await openPlan(page, `?level=${SITE_LEVEL_ID}`);
    await h.openLotCard(page);
    await h.pickModelLevel(page, 3);
    await h.pickModelLevel(page, SITE_LEVEL_ID);
    await page.waitForTimeout(400);
    await expect(lotCard(page)).toBeHidden();
  });

test('over a lot already drawn the key reopens the card on the lot\'s own size', async ({ page }) => {
  await openPlan(page, `?level=${SITE_LEVEL_ID}`);
  await h.openLotCard(page);
  await lotCard(page).locator('[data-lot-pick-ok]').click();
  await expect(lotCard(page)).toBeHidden();
  const lot = await page.evaluate(() => drawing.lot);
  expect(lot, 'OK drew a lot').toBeTruthy();
  await h.openLotCard(page);
  await expect(lotCard(page).locator('[data-lot-tier="custom"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(lotCard(page).locator('[data-lot-width]')).not.toHaveValue('');
});
