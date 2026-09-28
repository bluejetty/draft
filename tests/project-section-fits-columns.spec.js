// THE DRAWING IS AS TALL AS THE COLUMN BESIDE IT, AND STAYS THAT WAY.
//
// Movie, 28 Sep, with a screenshot of a 2 STOREY + GARAGE whose section ran
// off the bottom of the page while both schedules beside it finished halfway
// up: *"we should reduce the height of the section to match the tallest text
// columns here"*.
//
// The rule he is asking for was already there -- 236633c sized the bungalow's
// canvas to its tallest schedule column, and b9ade3c corrected which element
// that column is. What was missing is that it only ever ran AT A REPAINT, and
// nothing on this page repaints on a resize. So the height was right for the
// window the page was opened in and stale in every window after it.
//
//     opened at 1100, widened to 1366:  drawing 559, columns 317 and 321
//
// The columns pair two rows to a line as they get room, which halves their
// height; the drawing stayed at what the narrow window had asked for. That is
// his screenshot exactly, and it is why the page scrolled and the bottom bar
// cut the footings off.
//
// ── SO THE CHECK RESIZES, WHICH IS THE HALF THAT WOULD HAVE CAUGHT IT ──────
//
// A check that only opened the page at one size passed against the bug, every
// time -- the first repaint is always right. The fault only exists in the
// second window, so the second window is where this looks.
//
// ── AND IT ASKS ALL THREE BANDS ────────────────────────────────────────────
//
// The rule was wired to one canvas, #detail-canvas, while bilevel-canvas and
// detached-canvas stayed at the 500 they were born at. Asking every band by the same arithmetic is what stops the next band
// added from being the fourth one nobody wired up.
const { test, expect } = require('@playwright/test');

const WIDE = { width: 1366, height: 625 };
const NARROW = { width: 1100, height: 625 };

// SECTION_MIN_H in PROJECT.html: below this the drawing stops being readable,
// so a short pair of columns does not drag it down with them.
const MIN = 300;

// Read straight off the band rather than from a list of ids: a column is a
// child of the band that holds no canvas, which is the same rule the page
// itself sizes by. A list here could agree with the page while both were
// wrong about the markup.
const bands = page => page.evaluate(() =>
  [...document.querySelectorAll('.type-stage section:not([hidden]) .band')]
    .map(band => ({
      canvases: [...band.querySelectorAll('canvas')]
        .map(c => ({ id: c.id, h: c.height })),
      cols: [...band.children]
        .filter(el => !el.querySelector('canvas') && !el.hidden)
        .map(el => ({ id: el.id, h: Math.round(el.getBoundingClientRect().height) })),
    })));

const expectFits = (band, where) => {
  const want = Math.max(MIN, ...band.cols.map(c => c.h));
  band.canvases.forEach(c => {
    expect(c.h, `${where}: ${c.id} against columns ` +
      band.cols.map(col => `${col.id} ${col.h}`).join(', ')).toBe(want);
  });
};

const settle = async page => {
  await page.waitForTimeout(400);
};

test.describe('the section matches its tallest schedule column', () => {
  test('every bungalow variation, at the width it was opened in', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/PROJECT.html?type=bungalow');
    await page.waitForSelector('#sched-house .sched-row', { state: 'visible' });
    const names = await page.$$eval('#family-row button', bs => bs.map(b => b.textContent.trim()));
    expect(names.length).toBeGreaterThan(0);
    for (let i = 0; i < names.length; i += 1) {
      await page.click(`#family-row button >> nth=${i}`);
      await settle(page);
      (await bands(page)).forEach(band => expectFits(band, `bungalow / ${names[i]}`));
    }
  });

  // THE BILEVEL'S EAVE IS THE SECOND CANVAS IN ITS BAND and takes the same
  // height as the section beside it -- that is what keeps the two halves of
  // that band level with each other rather than one standing 130px taller.
  for (const type of ['bilevel', 'detached']) {
    test(`the ${type} band`, async ({ page }) => {
      await page.setViewportSize(WIDE);
      await page.goto(`/PROJECT.html?type=${type}`);
      await page.waitForSelector(`#stage-${type} .band`, { state: 'visible' });
      await settle(page);
      const found = await bands(page);
      expect(found.length).toBe(1);
      found.forEach(band => expectFits(band, type));
    });
  }

  // ── THE BUG ITSELF ────────────────────────────────────────────────────────
  test('and it follows the window rather than the window it was opened in',
    async ({ page }) => {
      await page.setViewportSize(NARROW);
      await page.goto('/PROJECT.html?type=bungalow');
      await page.waitForSelector('#sched-house .sched-row', { state: 'visible' });
      await page.click('#family-row button >> nth=3');   // 2 STOREY + GARAGE
      await settle(page);

      await page.setViewportSize(WIDE);
      await settle(page);
      (await bands(page)).forEach(band => expectFits(band, 'widened to 1366'));

      // AND BACK, because a fit that only ever grows is the same bug wearing
      // the other sign.
      await page.setViewportSize(NARROW);
      await settle(page);
      (await bands(page)).forEach(band => expectFits(band, 'back to 1100'));
    });
});
