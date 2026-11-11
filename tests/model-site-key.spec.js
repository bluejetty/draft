// THE LOT CARD OPENS ONLY WHEN ASKED FOR (jb, 9 Nov 2026): "can i only have
// this site plan menu pop up when they ask for it, maybe SITE PLAN button in
// build to open that (put it at the end make it look like a site plan" --
// and why: "that popup popuped up in bad placed too many times".
//
// This replaces model-site-after-the-build.spec.js, which held Movie's
// 15 Oct rule that the build marched the drafter to SITE and asked about the
// lot once the curtain fell. That rule is gone, and so is the older one that
// asked on arriving at SITE with no lot. What is left on a drawing with no
// lot is the SITE PLAN key, last of the BUILD keys, and the DRAW STANDALONE
// SITE PLAN tile on the drive-thru board (jb, 10 Nov 2026: "in the DrivThru
// i think we can leave it in there too"); over a lot already drawn, the
// double-click on the property line (model-site-lot-typed.spec.js). The
// SITE PLAN seat in LEVELS / LAYERS is not a door, pressed once or twice
// (jb, 10 Nov: "it should only popup when the SITE PLAN button in the BUILD
// menu is pressed... the user can also just draw a site plan with lines on
// the site plan layer without using our helpful guide").
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

test('the SITE PLAN seat in LEVELS / LAYERS asks nothing, pressed once or twice, on a site plan drawn with lines', async ({ page }) => {
  // jb's own SITEPLAN.draft: a standalone site plan, plain lines and hand
  // dims on SITE, no lot record at all. A missing lot is not a question.
  await openPlan(page, `?level=${SITE_LEVEL_ID}&right=1&pane=levels`, {});
  await page.evaluate(() => {
    drawing.standalone = 'site';
    drawing.lines.push({ id: 'l1', levelId: 8, view: 'plan', layer: 'draft',
      start: { x: -40, y: 0, z: -60 }, end: { x: 40, y: 0, z: -60 } });
  });
  await page.waitForTimeout(300);
  await expect(lotCard(page)).toBeHidden();
  const seat = page.locator(`[data-seat="${SITE_LEVEL_ID}:all"]`);
  await seat.click();
  await page.waitForTimeout(400);
  await expect(lotCard(page), 'one press on the seat').toBeHidden();
  await seat.dblclick();
  await page.waitForTimeout(400);
  await expect(lotCard(page), 'two presses on the seat').toBeHidden();
  await h.pickModelLevel(page, SITE_LEVEL_ID);
  await page.waitForTimeout(400);
  await expect(lotCard(page), 'the level row either').toBeHidden();
  expect(await page.evaluate(() => drawing.lot ?? null), 'and no lot appeared').toBeNull();
});

test('DRAW STANDALONE SITE PLAN on the drive-thru board opens the card on SITE', async ({ page }) => {
  await openPlan(page);
  await h.openDriveThru(page);
  await page.locator('[data-build-entry="site-standalone"]').click();
  await expect(page.locator('#drivethru'), 'the board goes down').toHaveAttribute('data-shut', '');
  expect(levelInUrl(page), 'on SITE').toBe(String(SITE_LEVEL_ID));
  await expect(lotCard(page), 'the card is up: the press ordered a site plan').toBeVisible();
  await lotCard(page).locator('[data-lot-pick-skip]').click();
  await expect(lotCard(page)).toBeHidden();
  // And it stays down on the way back: the tile asked once.
  await h.pickModelLevel(page, SITE_LEVEL_ID);
  await page.waitForTimeout(400);
  await expect(lotCard(page)).toBeHidden();
  expect(await page.evaluate(() => drawing.standalone)).toBe('site');
});
