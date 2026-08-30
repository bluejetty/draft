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
  await expect(page.locator('.enter-name')).toHaveText('Rough Drafter');
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
