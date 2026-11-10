// THE FIRST FRAME WEARS THE RIGHT SKIN, NOT THE DEFAULT ONE.
//
// Movie, 9 Nov 2026 (screenshot off draft.bluejetty.ca): "when i go into
// ROUGHDRAFTER.com model area it flashes the RUFFDRAFTER site really quick".
// home-theme.spec.js proved every page SETTLES on the door's brand, and it
// was right -- but it read the attribute after load, and a page that paints
// RUFF/NIGHT for a few hundred milliseconds and then repaints ROUGH/DAY
// passes that check exactly as a page that never flashed.
//
// WHY MODEL FLASHED AND THE OTHERS DID NOT. Every other dashboard loads
// palette.js in the <head> and applies the skin before <body> is parsed.
// MODEL.html loaded palette.js at its FOOT (after ~1,000 lines of body and
// a hundred modules) and applied the skin in model/01-skin-view.js, the
// first page script -- so the browser painted the whole shell off
// model.css's fallbacks (the night skin) and shell-bars' RUFF labels, then
// recoloured it. Off a desk the fallbacks ARE the first skin, which is why
// 784 specs never saw it.
//
// MEASURED, NOT EYEBALLED. An init script runs before any page script and
// records every value <html data-theme> ever takes. The first value must be
// the door's brand, and nothing else may ever be set; the attribute must
// already be there when <body> starts to exist, which is the earliest moment
// the browser can paint anything.
const { test, expect } = require('@playwright/test');

const PUBLIC = /^https:\/\/(ruffdrafter|roughdrafter)\.com\//;

async function playPublicNames(page, baseURL) {
  await page.route(/goatcounter\.com/, route => route.abort());
  await page.route(PUBLIC, async route => {
    const u = new URL(route.request().url());
    const response = await route.fetch({ url: baseURL + u.pathname + u.search });
    await route.fulfill({ response });
  });
}

async function watchTheme(page) {
  await page.addInitScript(() => {
    // <html> does not exist yet when an init script runs, so the observer
    // sits on the document and watches the subtree for the root's attributes.
    window.__themeHistory = [];
    const skinOf = root => [root.getAttribute('data-theme'), root.getAttribute('data-mode')].join('/');
    const note = records => {
      const root = document.documentElement;
      if (!root) return;
      // THE MOMENT THE BODY STARTS TO EXIST is the moment the browser can
      // first paint something; whatever skin the root wears then is the
      // one the first frame is painted in. (DOMContentLoaded is too late:
      // classic scripts at the page's foot run before it fires.)
      if (document.body && window.__themeWhenBodyAppeared === undefined) {
        window.__themeWhenBodyAppeared = skinOf(root);
      }
      if (!records.some(r => r.type === 'attributes' && r.target === root)) return;
      const v = skinOf(root);
      const last = window.__themeHistory[window.__themeHistory.length - 1];
      if (v !== last) window.__themeHistory.push(v);
    };
    new MutationObserver(note).observe(document,
      { attributes: true, childList: true, subtree: true, attributeFilter: ['data-theme', 'data-mode'] });
  });
}

const PAGES = ['MODEL.html', 'LAYOUT.html', 'PROJECT.html', 'SETTINGS.html', 'STANDARDS.html',
  'SPECS.html', 'ESTIMATES.html', 'EXTFINISH.html', 'REALESTATEPLAN.html', 'BONEYARD.html'];

for (const [door, want] of [['roughdrafter.com', 'rough/day'], ['ruffdrafter.com', 'ruff/night']]) {
  test(`off ${door} every dashboard's first skin is ${want}, with no other skin before it`, async ({ page, baseURL }) => {
    await playPublicNames(page, baseURL);
    await watchTheme(page);
    for (const file of PAGES) {
      await page.goto(`https://${door}/${file}`);
      const seen = await page.evaluate(() => window.__themeHistory);
      expect(seen, `${file}: every skin the page ever wore`).toEqual([want]);
      expect(await page.evaluate(() => window.__themeWhenBodyAppeared),
        `${file}: skinned before the body started to parse`).toBe(want);
    }
  });
}

test('MODEL loads palette.js in the head, before the shell bars mount', async () => {
  const fs = require('fs');
  const path = require('path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'MODEL.html'), 'utf8');
  const head = html.indexOf('</head>');
  const palette = html.indexOf('<script src="./palette.js"></script>');
  const bars = html.indexOf('<script src="./shell-bars.js"></script>');
  expect(palette, 'palette.js is loaded once').toBe(html.lastIndexOf('<script src="./palette.js"></script>'));
  expect(palette).toBeGreaterThan(-1);
  expect(palette).toBeLessThan(bars);
  expect(bars).toBeLessThan(head);
});
