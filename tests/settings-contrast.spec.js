// SETTINGS ON A NIGHT SHEET, MEASURED.
//
// The page takes the skin now (it loads palette.js and follows the choice
// MODEL wrote), but three of its colours never joined: the saved/warning
// sentence beside the buttons and the STANDARDS link in the intro were typed
// in as literals picked against a white page. On night they sit on #1d1f20
// at 3.36, 3.32 and 3.99 — every one of them under the 4.5 AA wants for body
// text, and the status line is the one sentence on the page that exists to be
// noticed.
//
// A RATIO, NOT A HEX. Asserting the expected colour would pass for ever while
// the ground moved out from under it — the SPECS.html defect exactly, where a
// pair that read like ink and page was mapped to roles that made near-white
// lettering on a near-white chip. So this composites what the browser
// actually resolved and measures it against the ground it is painted on;
// whatever the palette becomes, the reading has to hold.
//
// BOTH MODES, because a colour picked for one is the way this class of defect
// is born. The link literal fails on day too (3.71), which nothing noticed
// while the page was judged by night alone.
const { test, expect } = require('@playwright/test');

// WCAG 2.1: relative luminance, then the ratio. Same arithmetic palette.js
// runs, written out here rather than imported — a test that asks the module
// under test what the answer should be agrees with itself and passes.
const AA_BODY = 4.5;

const contrast = ([r1, g1, b1], [r2, g2, b2]) => {
  const lum = (r, g, b) => {
    const ch = v => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
  };
  const a = lum(r1, g1, b1);
  const b = lum(r2, g2, b2);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

// The ink as the browser resolved it, and the ground it is really on: an
// element's own background is usually transparent, so the ground is whichever
// ancestor last painted one, composited in the order it is stacked.
async function inkAndGround(page, selector) {
  return page.evaluate(sel => {
    const rgb = css => {
      const parts = String(css).match(/[\d.]+/g) || [];
      const [r, g, b, a = 1] = parts.map(Number);
      return { r, g, b, a };
    };
    const over = (top, base) => ({
      r: top.r * top.a + base.r * (1 - top.a),
      g: top.g * top.a + base.g * (1 - top.a),
      b: top.b * top.a + base.b * (1 - top.a),
      a: 1,
    });
    const el = document.querySelector(sel);
    if (!el) throw new Error(`no element for ${sel}`);
    const stack = [];
    for (let node = el; node; node = node.parentElement) {
      stack.push(rgb(getComputedStyle(node).backgroundColor));
    }
    stack.push({ r: 255, g: 255, b: 255, a: 1 });
    let ground = stack.pop();
    while (stack.length) ground = over(stack.pop(), ground);
    const ink = rgb(getComputedStyle(el).color);
    return {
      ink: [ink.r, ink.g, ink.b],
      ground: [ground.r, ground.g, ground.b],
    };
  }, selector);
}

async function ratio(page, selector) {
  const { ink, ground } = await inkAndGround(page, selector);
  return contrast(ink, ground);
}

// The status line only has a colour worth measuring once it has said
// something, and its two states are two different colours.
async function speak(page, { warning }) {
  await page.evaluate(warn => {
    const status = document.querySelector('#status');
    status.textContent = warn ? 'Key already used by another command' : 'Saved';
    status.classList.toggle('warning', warn);
  }, warning);
}

for (const mode of ['night', 'day']) {
  test(`SETTINGS: the saved sentence is readable on ${mode}`, async ({ page }) => {
    await page.goto(`/SETTINGS.html?mode=${mode}`);
    await speak(page, { warning: false });
    expect(await ratio(page, '#status')).toBeGreaterThanOrEqual(AA_BODY);
  });

  test(`SETTINGS: the warning sentence is readable on ${mode}`, async ({ page }) => {
    await page.goto(`/SETTINGS.html?mode=${mode}`);
    await speak(page, { warning: true });
    expect(await ratio(page, '#status.warning')).toBeGreaterThanOrEqual(AA_BODY);
  });

  test(`SETTINGS: the standards link is readable on ${mode}`, async ({ page }) => {
    await page.goto(`/SETTINGS.html?mode=${mode}`);
    expect(await ratio(page, '.intro a')).toBeGreaterThanOrEqual(AA_BODY);
  });
}

// THE INSTRUMENT, CHECKED ON A PAIR WHOSE ANSWER IS KNOWN. A measurement that
// silently returns a comfortable number for everything passes this file
// without reading the page at all: body ink on the page ground is 13.16 on
// night by palette.js's own published figure, and the page against itself is
// 1.00.
test('SETTINGS: the measurement reads the real page', async ({ page }) => {
  await page.goto('/SETTINGS.html?mode=night');
  const body = await inkAndGround(page, 'body');
  expect(contrast(body.ink, body.ground)).toBeGreaterThan(12);
  expect(contrast(body.ground, body.ground)).toBeCloseTo(1, 5);
});
