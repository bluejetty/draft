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

// ── MODEL.html PUTS IT WHERE MOVIE ASKED, AND HAD NOWHERE TO PUT IT FROM ──
//
// Movie, 19 Sep: "i need the viewcounter lets put it on lower left (2nd row
// from bottom to the left of 'STATUS READOUT'". The slot went in that day,
// the module learned to prefer a named home over the PROJECT corner, and the
// count still never appeared -- because MODEL.html never loaded the module.
// A socket, wired, with no lamp in it.
//
// AND NOTHING COULD SEE IT. The module says nothing on localhost by design,
// so the slot is empty on every desk and in every test that serves the app
// the ordinary way; "the count is missing" and "the count is correctly
// silent" look identical from there. This file already solved that for the
// other pages -- serve the app under a stand-in domain and answer for the
// counter host -- and the page the feature was actually for was the one page
// not asked the question.
test('MODEL.html wears the count on the instruments row, left of STATUS READOUT',
  async ({ page, baseURL }) => {
    await proxyApp(page, baseURL);
    const hits = [];
    await page.route(`${GC_HOST}/**`, async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/count') {
        hits.push(url.searchParams.get('p'));
        return route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAAAAACw=', 'base64') });
      }
      if (url.pathname.endsWith('.json')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: '42' }) });
      }
      return route.fulfill({ status: 404, body: '' });
    });

    await page.goto('https://draft.test/MODEL.html');
    const counter = page.locator('[data-traffic-counter]');
    await expect(counter).toHaveText('42 VISITS');
    expect(hits, 'and the page reported its own hit').toEqual(['/MODEL.html']);

    // INSIDE THE NAMED HOME, not after the PROJECT corner. The two are
    // different rules in the module -- a named home means append, the corner
    // means insert after -- and this page has both, so landing in the wrong
    // one would put the count on the row of page links a floor below.
    const where = await page.evaluate(() => {
      const el = document.querySelector('[data-traffic-counter]');
      const home = document.querySelector('[data-visit-counter-home]');
      const readout = document.querySelector('[data-readout-tab]');
      return {
        inHome: !!home && home.contains(el),
        row: !!readout && readout.parentElement === home.parentElement,
        // LEFT OF IT IN PIXELS, which is what Movie actually asked for --
        // DOM order and screen order are the same here only because nothing
        // in this row is reversed, and that is a fact worth asserting rather
        // than assuming.
        leftOf: el.getBoundingClientRect().right
          <= readout.getBoundingClientRect().left + 0.5,
      };
    });
    expect(where.inHome, 'it goes in the slot the page named').toBe(true);
    expect(where.row, 'which is the row STATUS READOUT is on').toBe(true);
    expect(where.leftOf, 'and it sits to the left of it').toBe(true);
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
  // The entry page is the logo, and nothing else. The name text span this
  // used to assert on came off when the logo took its own lettering, and
  // the bone beneath it came off on 4 Sep (nobody sees a bone until model
  // space). What still has to be true is that the way in is THERE and
  // still goes where it went: the image resolves, and the one link points
  // at the model space. Exactly one -- a bone that crept back would be a
  // second link, and this would say so.
  const logo = page.locator('.enter-logo');
  await expect(logo).toBeVisible();
  await expect(page.locator('.enter-bone')).toHaveCount(0);
  // naturalWidth is 0 for an image that 404'd, so this catches a missing
  // or misnamed asset rather than merely a present <img> tag.
  await expect.poll(() => logo.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
  // MODEL.html SINCE 20 Sep (Movie: "can you make the main page link to the
  // model.html"). The claim is unchanged -- exactly one link, and it goes to
  // the model space -- only which model space is the product moved.
  const targets = await page.locator('.enter-link').evaluateAll(
    links => links.map(link => new URL(link.href).pathname.split('/').pop()));
  expect(targets).toEqual(['MODEL.html']);

  // The logo must PAINT the width of its box, not merely occupy it. With
  // object-fit: contain the two differ: a height attribute pins the box,
  // aspect-ratio stops applying, and the art is letterboxed inside a box
  // it never fills — which is how the entry page once shipped with a 231px
  // bone beside a 225px logo while every box measurement looked right.
  // The bone is gone, so the comparison is the logo against its own box:
  // measure what the eye sees, and it has to fill what it was given.
  const painted = await page.locator('.enter-logo').evaluate(el => {
    const r = el.getBoundingClientRect();
    const scale = Math.min(r.width / el.naturalWidth, r.height / el.naturalHeight);
    return { art: el.naturalWidth * scale, box: r.width };
  });
  expect(painted.art).toBeGreaterThan(painted.box * 0.95);

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
