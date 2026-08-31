// The visit counter: one hit reported per page load, the running count worn
// lower-left — and never a word on localhost or when the counter host is
// unreachable (the deliberate exception documented in no-third-party.spec.js).
//
// The counter only speaks from a real domain, so these specs serve the app
// under a stand-in host (https://draft.test) by proxying every request back
// to the local server, and answer for the GoatCounter host themselves.
const { test, expect } = require('@playwright/test');

const GC_HOST = 'https://roughdrafter.goatcounter.com';

// Serve https://draft.test/* from the local test server.
const proxyApp = (page, baseURL) =>
  page.route('https://draft.test/**', async route => {
    const url = new URL(route.request().url());
    const response = await page.request.get(baseURL + url.pathname);
    await route.fulfill({ response });
  });

test('a page load reports a hit and wears the public count', async ({ page, baseURL }) => {
  await proxyApp(page, baseURL);
  const hits = [];
  await page.route(`${GC_HOST}/**`, async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/count') {
      hits.push(url.searchParams.get('p'));
      return route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAAAAACw=', 'base64') });
    }
    if (url.pathname.endsWith('.json')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: '1 234' }) });
    }
    return route.fulfill({ status: 404, body: '' });
  });

  await page.goto('https://draft.test/index.html');
  const counter = page.locator('[data-traffic-counter]');
  await expect(counter).toHaveText('1 234 VISITS');
  expect(hits).toEqual(['/index.html']);
});

test('the count sits to the right of PROJECT where a strip has one', async ({ page, baseURL }) => {
  await proxyApp(page, baseURL);
  await page.route(`${GC_HOST}/**`, route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('.json')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: '7' }) });
    }
    return route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAAAAACw=', 'base64') });
  });

  await page.goto('https://draft.test/MODEL.dc.html');
  const counter = page.locator('[data-traffic-counter]');
  await expect(counter).toHaveText('7 VISITS');
  // Immediate next sibling of the lower-left PROJECT button, inside the strip.
  const isNextSibling = await page.evaluate(() => {
    const project = document.querySelector('[data-project-corner-bl]');
    return !!project && !!project.nextElementSibling
      && project.nextElementSibling.hasAttribute('data-traffic-counter');
  });
  expect(isNextSibling).toBe(true);
});

test('a blocked counter host leaves the page complete and quiet', async ({ page, baseURL }) => {
  await proxyApp(page, baseURL);
  await page.route(`${GC_HOST}/**`, route => route.abort());

  await page.goto('https://draft.test/index.html');
  await page.waitForLoadState('load');
  // The entry page is the new logo above the bone, and nothing else — the
  // name text span this used to assert on came off with that change
  // (the logo carries its own lettering now). What still has to be true is
  // that the way in is THERE and still goes where it went: both images
  // resolve, and both links point at the model space.
  const logo = page.locator('.enter-logo');
  const bone = page.locator('.enter-bone');
  await expect(logo).toBeVisible();
  await expect(bone).toBeVisible();
  for (const image of [logo, bone]) {
    // naturalWidth is 0 for an image that 404'd, so this catches a missing
    // or misnamed asset rather than merely a present <img> tag.
    await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
  }
  const targets = await page.locator('.enter-link').evaluateAll(
    links => links.map(link => new URL(link.href).pathname.split('/').pop()));
  expect(targets).toEqual(['MODEL.dc.html', 'MODEL.dc.html']);

  // The logo must PAINT bigger than the bone, not merely occupy a wider
  // box. With object-fit: contain the two differ: a height attribute pins
  // the box, aspect-ratio stops applying, and the art is letterboxed
  // inside a box it never fills — which is how the entry page once shipped
  // with a 231px bone beside a 225px logo while every box measurement
  // looked right. Measure what the eye sees.
  const painted = await page.evaluate(() => {
    const art = el => {
      const r = el.getBoundingClientRect();
      const scale = Math.min(r.width / el.naturalWidth, r.height / el.naturalHeight);
      return el.naturalWidth * scale;
    };
    return {
      logo: art(document.querySelector('.enter-logo')),
      bone: art(document.querySelector('.enter-bone')),
    };
  });
  expect(painted.logo).toBeGreaterThan(painted.bone * 2);

  // And the mark must not be UPSCALED. #200 doubled the painted logo to
  // 450px without checking its source, which was 225x225 — so the brand
  // painted at 2x upscale on the first page anyone sees, and at 4x on a
  // retina iPad. Box measurements all looked right; only the source
  // resolution said otherwise. The file has to carry at least the pixels
  // it paints.
  const upscale = await page.locator('.enter-logo').evaluate(el => ({
    natural: el.naturalWidth,
    painted: el.getBoundingClientRect().width,
  }));
  expect(upscale.natural).toBeGreaterThanOrEqual(upscale.painted);
  await expect(page.locator('[data-traffic-counter]')).toHaveCount(0);
});

test('the counter says nothing at all on localhost', async ({ page, baseURL }) => {
  const offSite = [];
  page.on('request', request => {
    if (/^https?:/i.test(request.url()) && !request.url().startsWith(baseURL)) offSite.push(request.url());
  });
  await page.goto('/index.html');
  await page.waitForLoadState('load');
  await page.waitForTimeout(500);
  expect(offSite).toEqual([]);
  await expect(page.locator('[data-traffic-counter]')).toHaveCount(0);
});
