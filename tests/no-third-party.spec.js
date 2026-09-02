// The app asks nobody else for anything (audit M2).
//
// Every page used to pull its type from fonts.googleapis.com, on the critical
// path: a stylesheet link blocks first paint, so a slow or blocked route to
// Google held the whole page — measured at ~12.9s a load in this sandbox,
// where that route is blocked, and the same wait would land on a drafter in a
// locked-down office or on a job site with no signal. The fonts are served
// from vendor/ now.
//
// This spec asserts the RULE, not the timing: no page requests a host other
// than the one it was served from, and the model still comes up with every
// other origin cut off. A timing test would pass on a fast desk the day
// someone links a CDN back in; this one won't.
//
// One deliberate exception lives outside this suite's sight: the visit
// counter (traffic-counter.js) speaks to the GoatCounter host — async, off
// the critical path, fail-silent — but only when the page is served from a
// real domain. On localhost it says nothing at all, which is why these specs
// still see zero off-site requests: the rule for the critical path stands,
// and the counter may never grow into a blocking dependency without failing
// here.
const { test, expect } = require('@playwright/test');

const PAGES = [
  '/index.html',
  '/MODEL.dc.html',
  '/LAYOUT.dc.html',
  '/PROJECT.html',
  '/SPECS.html',
  '/SETTINGS.html',
  '/STANDARDS.html',
];

// data:, blob: and about: are the page's own bytes, not a request to anyone.
const isOffSite = (url, origin) =>
  /^https?:/i.test(url) && !url.startsWith(origin);

test('no page requests a third-party host', async ({ page, baseURL }) => {
  const offSite = [];
  page.on('request', request => {
    if (isOffSite(request.url(), baseURL)) offSite.push(request.url());
  });
  for (const path of PAGES) {
    await page.goto(path);
    await page.waitForLoadState('load');
  }
  expect(offSite, `off-site requests: ${offSite.join(', ')}`).toEqual([]);
});

test('the model comes up with every other origin cut off', async ({ page, baseURL }) => {
  // Not "Google blocked" — EVERYTHING but this server blocked, so a request
  // to some other CDN fails the same way rather than sneaking past.
  await page.route('**/*', route =>
    (isOffSite(route.request().url(), baseURL) ? route.abort() : route.continue()));
  await page.goto('/MODEL.dc.html');
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await page.waitForFunction(() => document.body.dataset.modelReady === '1');
  // And the type it draws with is the app's own, not a fallback: the local
  // faces really did load.
  const loaded = await page.evaluate(() => document.fonts.check('12px "Barlow Condensed"'));
  expect(loaded).toBe(true);
});
