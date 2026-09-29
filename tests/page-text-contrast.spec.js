// THE TEXT A PAGE SAYS BACK, MEASURED ON EVERY PAGE THAT SAYS ANY.
//
// Began as SETTINGS alone: three of its colours never joined the skin, and
// the saved/warning sentence sat on #1d1f20 at 3.36 and 3.32, under the 4.5
// AA wants for body text, on the one sentence that exists to be noticed.
//
// IT WAS NEVER ONE PAGE'S DEFECT. STANDARDS carried the identical pair in the
// identical #status rule, and so did SPECS -- three pages, one literal, and
// the check written for it named SETTINGS in all seven of its cases. A
// page-shaped check that hardcodes its page finds the instance and leaves the
// class.
//
// SO THE POPULATION IS DERIVED, NOT LISTED. It is the skin roster (see
// palette-pages.js) narrowed to the pages that actually have a status line,
// read off each page's own markup. A hand-written table here would be the
// same hand-kept list this file was widened to replace, one layer up.
//
// DERIVING ON THE ELEMENT IS SOUND, where deriving on the colour would not
// be. palette-pages.js refuses to derive its roster from "pages that load
// palette.js" because that is the thing being proven -- a page dropping the
// script would drop off the roster with it. Here the thing being proven is
// that the status line is READABLE; a page deleting its status element has
// removed the sentence, not hidden an unreadable one. What must never be
// derived from the page is the COLOUR, and none of it is.
//
// EACH PAGE IS ASKED ONLY WHAT IT HAS. Warning is asserted only where the
// page defines a #status.warning rule -- SPECS has one state and never sets
// the class, so asserting a warning there would measure a class the page does
// not use. The intro link is asserted only where .intro a exists. Both are
// floored below, because a selector that matches nothing is a case that
// passes without reading anything.
//
// A RATIO, NOT A HEX. Asserting the expected colour would pass for ever while
// the ground moved out from under it -- the SPECS.html defect exactly, where
// a pair that read like ink and page was mapped to roles that made near-white
// lettering on a near-white chip. So this composites what the browser
// actually resolved and measures it against the ground it is painted on;
// whatever the palette becomes, the reading has to hold.
//
// BOTH MODES, because a colour picked for one is the way this class of defect
// is born. SETTINGS' link literal failed on day too (3.71), which nothing
// noticed while the page was judged by night alone.
const fs = require('fs');
const path = require('path');
const { SKINNED_PAGES } = require('./palette-pages.js');

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


// -- The population, read off the disk ---------------------------------
const ROOT = path.join(__dirname, '..');

const SUBJECTS = SKINNED_PAGES
  .map(p => ({ p, src: fs.readFileSync(path.join(ROOT, p), 'utf8') }))
  .filter(({ src }) => /id=["']status["']/.test(src))
  .map(({ p, src }) => ({
    name: p.replace('.html', ''),
    path: `/${p}`,
    // Only a page that defines the rule has a warning state to measure.
    warning: /#status\.warning\b/.test(src),
  }));

// THE COMPANIONS THE DERIVATION NEEDS. Every case below is of the shape "this
// page reads at 4.5 or better", which is triumphantly true of a population
// that has gone empty and of a state nobody has. A rename, a moved file or a
// dropped rule fails here, loudly, instead of quietly measuring less.
test('the subjects are derived and sound', () => {
  expect(SUBJECTS.length).toBeGreaterThanOrEqual(6);
  const names = SUBJECTS.map(s => s.name);
  // The six carrying a status line on 29 Sep, named because a count alone
  // survives a swap -- the fault landscape-guard-pages.js was written for.
  for (const n of ['SETTINGS', 'STANDARDS', 'SPECS', 'PROJECT',
    'EXTFINISH', 'REALESTATEPLAN']) {
    expect(names, `${n} has a status line and must be measured`).toContain(n);
  }
  // At least one page must exercise each optional shape, or the `if` and the
  // skip guarding it silently remove the assertion from the whole file.
  expect(SUBJECTS.filter(s => s.warning).map(s => s.name).length,
    'no page defines #status.warning — the warning cases are all skipped')
    .toBeGreaterThanOrEqual(1);
});

for (const { name, path: pagePath, warning } of SUBJECTS) {
  for (const mode of ['night', 'day']) {
    test(`${name}: the saved sentence is readable on ${mode}`, async ({ page }) => {
      await page.goto(`${pagePath}?mode=${mode}`);
      await speak(page, { warning: false });
      expect(await ratio(page, '#status')).toBeGreaterThanOrEqual(AA_BODY);
    });

    if (warning) {
      test(`${name}: the warning sentence is readable on ${mode}`, async ({ page }) => {
        await page.goto(`${pagePath}?mode=${mode}`);
        await speak(page, { warning: true });
        expect(await ratio(page, '#status.warning')).toBeGreaterThanOrEqual(AA_BODY);
      });
    }

    test(`${name}: any intro link is readable on ${mode}`, async ({ page }) => {
      await page.goto(`${pagePath}?mode=${mode}`);
      const links = await page.locator('.intro a').count();
      test.skip(links === 0, 'no brand-coloured text in this intro');
      expect(await ratio(page, '.intro a')).toBeGreaterThanOrEqual(AA_BODY);
    });
  }

  // THE INSTRUMENT, CHECKED ON A PAIR WHOSE ANSWER IS KNOWN. A measurement
  // that silently returns a comfortable number for everything passes this
  // file without reading the page at all: body ink on the page ground is
  // 13.16 on night by palette.js's own published figure, and the page against
  // itself is 1.00. Run per page, because "the measurement reads the real
  // page" is a claim about a page, not about the helper.
  test(`${name}: the measurement reads the real page`, async ({ page }) => {
    await page.goto(`${pagePath}?mode=night`);
    const body = await inkAndGround(page, 'body');
    expect(contrast(body.ink, body.ground)).toBeGreaterThan(12);
    expect(contrast(body.ground, body.ground)).toBeCloseTo(1, 5);
  });
}

// AND A LINK IS REALLY BEING READ SOMEWHERE. Every intro-link case above
// skips on a page without one, so all of them skipping would be a green file
// that never measured a link at all -- which is the shape of the defect the
// SETTINGS link was.
test('at least one page has an intro link, and it is measured', async ({ page }) => {
  const withLink = [];
  for (const { name, path: pagePath } of SUBJECTS) {
    await page.goto(`${pagePath}?mode=night`);
    if (await page.locator('.intro a').count() > 0) withLink.push(name);
  }
  expect(withLink.length,
    'no page has an .intro a — every intro-link case skipped')
    .toBeGreaterThanOrEqual(1);
});
