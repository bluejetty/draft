// AN OLD PAGE AGAINST NEW SCRIPTS RELOADS ITSELF ONCE (jb, 10 Nov).
//
// "i can't do anything this keeps poping up": ROUGH-DRAFTER HIT A PROBLEM on
// every load of roughdrafter.com, "H is not defined" in model/13. The
// browser had kept an old MODEL.html and run it against the new scripts.
// build-id.js now compares the page's stamp with its own and fetches a fresh
// copy of the page ONCE when they differ; error-report.js gives a fault
// during boot on the live site the same one retry before it opens the card.
//
// The server here is the repo, where both stamps say 'dev'. The live site is
// stood in for with routes: the page is served with one build in its meta,
// build-id.js with another, and the asserted thing is the navigation --
// MODEL.html?draft-fresh=... -- and that it happens exactly once.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const FRESH = /MODEL\.html\?draft-fresh=/;
const card = page => page.locator('[data-error-report]');
const BUCKET = 'model-drawing';
const drawing = () => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [], notepad: '',
});
// A drawing on the shelf, so MODEL.html boots to its readout rather than a
// starter card. Routes go on AFTER this, so the old dc page is not stood in.
async function seeded(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
}

// The page says build `pageBuild`; build-id.js says `scriptBuild`.
async function liveSite(page, { pageBuild, scriptBuild, breakModel13 = false }) {
  const fetches = { page: 0, fresh: 0, buildId: 0 };
  await page.route(/\/MODEL\.html(\?.*)?$/, async route => {
    fetches.page += 1;
    if (FRESH.test(route.request().url())) fetches.fresh += 1;
    const res = await route.fetch();
    const html = (await res.text()).replace('<meta name="draft-build" content="dev">',
      `<meta name="draft-build" content="${pageBuild}">`);
    await route.fulfill({ response: res, body: html, headers: { ...res.headers(), 'content-type': 'text/html' } });
  });
  await page.route(/\/build-id\.js(\?.*)?$/, async route => {
    fetches.buildId += 1;
    const res = await route.fetch();
    const js = (await res.text()).replace("const BUILD = 'dev';", `const BUILD = '${scriptBuild}';`);
    await route.fulfill({ response: res, body: js });
  });
  if (breakModel13) {
    await page.route(/\/model\/13-suites-trim-follow\.js(\?.*)?$/, async route => {
      const res = await route.fetch();
      await route.fulfill({ response: res, body: `oldPageHook();\n${await res.text()}` });
    });
  }
  return fetches;
}

test('a page stamped for one build that gets scripts of another fetches itself fresh, once', async ({ page }) => {
  await seeded(page);
  const fetches = await liveSite(page, { pageBuild: 'old1111', scriptBuild: 'new2222' });
  await page.goto('/MODEL.html');
  // The reload: the fresh address was asked for, the retry was remembered,
  // and the page then carried on (the stand-in keeps serving the mismatch,
  // which is what a host inside its cache window does).
  await expect.poll(() => fetches.fresh).toBe(1);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 15000 });
  expect(fetches.fresh).toBe(1);
  // The retry param is taken off the address bar once the page is here.
  expect(page.url()).not.toMatch(FRESH);
  const build = await page.evaluate(() => ({ ...window.DraftBuild, retried: sessionStorage.getItem('draft-build-retried') }));
  expect(build).toMatchObject({ id: 'new2222', page: 'old1111', live: true, matches: false });
  expect(Number(build.retried)).toBeGreaterThan(0);
  // A second visit inside the hold does not reload again.
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 15000 });
  expect(fetches.fresh).toBe(1);
});

test('matching stamps on the live site load straight through', async ({ page }) => {
  await seeded(page);
  const fetches = await liveSite(page, { pageBuild: 'same3333', scriptBuild: 'same3333' });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 15000 });
  expect(fetches.fresh).toBe(0);
  expect(await page.evaluate(() => ({ ...window.DraftBuild }))).toMatchObject({ id: 'same3333', page: 'same3333', live: true, matches: true });
});

test("on the desk both sides say 'dev' and build-id.js is quiet", async ({ page }) => {
  await seeded(page);
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 15000 });
  expect(await page.evaluate(() => ({ ...window.DraftBuild }))).toMatchObject({ id: 'dev', page: 'dev', live: false, matches: true });
  expect(page.url()).toBe(new URL('/MODEL.html', page.url()).href);
  // Not even a fault retries on the desk: a crash here is a crash to report.
  expect(await page.evaluate(() => window.DraftBuild.retryFresh('spec'))).toBe(false);
});

test('a crash while booting on the live site gets one fresh fetch before the HIT A PROBLEM card', async ({ page }) => {
  // Stamps agree (an old copy of build-id.js beside new scripts looks like
  // this), but model/13 trips on a name that is not defined, the way jb's
  // did on H.
  await seeded(page);
  const fetches = await liveSite(page, { pageBuild: 'live4444', scriptBuild: 'live4444', breakModel13: true });
  await page.goto('/MODEL.html');
  await expect.poll(() => fetches.fresh).toBe(1);
  // The fresh fetch is still broken (the host is inside its window), so the
  // second load is a genuine crash and the card opens as before.
  await expect(card(page)).toBeVisible({ timeout: 15000 });
  await expect(card(page)).toContainText('oldPageHook is not defined');
  expect(fetches.fresh).toBe(1);
});
