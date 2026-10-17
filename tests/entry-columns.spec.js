// THE TWO SIDE COLUMNS OF THE ENTRY PAGE, TITLED AND HUNG FROM THE TOP OF
// THE LOGO (Movie, 17 Oct, drawn in GIMP over the page):
//
//   "can you change the entry to like this (move the side columns down and
//    switch the sides (put the books on the right and reference (span
//    tables, codes etc) on the left"
//
//   "add the titles (keep the titles aligned with approx the top of the logo
//    in the middle like in the image upload"
//
// His picture: REFERENCES over the code link on the LEFT of the logo, BOOKS
// over the three eBay books on the RIGHT, both titles level with the top of
// the logo, the errands (PDF MANAGER, DXF CONVERTER) still along the bottom,
// and the eBay partner note under the books in the bottom-right corner.
//
// AND A PHONE STILL GETS A PAGE. The ring's clockwise cell numbers are for the
// square; on a 390-wide phone the ring is two columns, and the first cut of
// this page left box 7 (the note, the third book) asking for a column 4 that
// is not there -- the browser made one, the two real columns shrank to
// nothing and the logo stood 153px off the left of the screen. So the phone
// is measured too: the logo on the screen, every book a readable width, and
// the page's standing rule, that it never scrolls to show a way in.
const { test, expect } = require('@playwright/test');

const box = async (page, selector) => page.locator(selector).first().boundingBox();

test('REFERENCES stands left of the logo and BOOKS right of it, both level with its top',
  async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`${baseURL}/index.html`);
    await expect(page.locator('a.ring-book').first()).toBeVisible();

    const logo = await box(page, '.enter-logo');
    const refs = page.locator('.ring-title', { hasText: /references/i });
    const books = page.locator('.ring-title', { hasText: /^books$/i });
    await expect(refs).toBeVisible();
    await expect(books).toBeVisible();
    const refsBox = await refs.boundingBox();
    const booksBox = await books.boundingBox();

    // SWITCHED SIDES: references left, books right, each clear of the logo.
    expect(refsBox.x + refsBox.width).toBeLessThanOrEqual(logo.x + 1);
    expect(booksBox.x).toBeGreaterThanOrEqual(logo.x + logo.width - 1);

    // "ALIGNED WITH APPROX THE TOP OF THE LOGO": the logo art has a margin
    // of air inside its square, so the title sits a little way down from the
    // box's top edge -- never above it, and never as far as a quarter of the
    // way down, which is where the ink of the scroll begins.
    for (const [name, title] of [['REFERENCES', refsBox], ['BOOKS', booksBox]]) {
      expect(title.y, `${name} is above the logo's top`).toBeGreaterThanOrEqual(logo.y - 1);
      expect(title.y, `${name} is not at the logo's top`).toBeLessThan(logo.y + logo.height * 0.25);
    }
    expect(Math.abs(refsBox.y - booksBox.y), 'the two titles are not level').toBeLessThan(2);

    // EACH TITLE HEADS ITS OWN COLUMN: the code link under REFERENCES, the
    // three books under BOOKS, every one below its title and on its side.
    const codes = await box(page, 'a[href="CODES.html"]');
    expect(codes.y).toBeGreaterThan(refsBox.y + refsBox.height - 1);
    expect(codes.x + codes.width).toBeLessThanOrEqual(logo.x + 1);
    const bookBoxes = await page.locator('a.ring-book').evaluateAll(
      els => els.map(el => el.getBoundingClientRect().toJSON()));
    expect(bookBoxes.length).toBe(3);
    for (const b of bookBoxes) {
      expect(b.y).toBeGreaterThan(booksBox.y + booksBox.height - 1);
      expect(b.x).toBeGreaterThanOrEqual(logo.x + logo.width - 1);
    }

    // THE PARTNER NOTE IS UNDER THE BOOKS, bottom-right; the errands stay
    // along the bottom under the logo (12 Oct: "the other stuff below").
    const note = await box(page, '[data-book-note]');
    expect(note.x).toBeGreaterThanOrEqual(logo.x + logo.width - 1);
    expect(note.y).toBeGreaterThan(logo.y + logo.height - 1);
    for (const href of ['https://pdf.bluejetty.ca/', 'DXF/']) {
      const errand = await box(page, `a[href="${href}"]`);
      expect(errand.y, `${href} left the bottom row`).toBeGreaterThan(logo.y + logo.height - 1);
      expect(errand.x + errand.width / 2).toBeGreaterThan(logo.x);
      expect(errand.x + errand.width / 2).toBeLessThan(logo.x + logo.width);
    }
    expect(await page.evaluate(
      () => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
  });

test('a phone lists both columns under the logo, titled, with the logo on the screen',
  async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseURL}/index.html`);
    await expect(page.locator('a.ring-book').first()).toBeVisible();

    const logo = await box(page, '.enter-logo');
    // ON THE SCREEN, not 153px off the left of it.
    expect(logo.x).toBeGreaterThanOrEqual(0);
    expect(logo.x + logo.width).toBeLessThanOrEqual(390);

    const refs = await page.locator('.ring-title', { hasText: /references/i }).boundingBox();
    const books = await page.locator('.ring-title', { hasText: /^books$/i }).boundingBox();
    const codes = await box(page, 'a[href="CODES.html"]');
    const bookBoxes = await page.locator('a.ring-book').evaluateAll(
      els => els.map(el => el.getBoundingClientRect().toJSON()));
    // Below the logo, in reading order: REFERENCES, its link, BOOKS, the books.
    expect(refs.y).toBeGreaterThan(logo.y + logo.height - 1);
    expect(codes.y).toBeGreaterThan(refs.y);
    expect(books.y).toBeGreaterThan(codes.y);
    expect(bookBoxes.length).toBe(3);
    for (const b of bookBoxes) {
      expect(b.y).toBeGreaterThan(books.y);
      // A READABLE WIDTH: half the ring less the gap, not the 16px sliver the
      // phantom fourth column left the third book with.
      expect(b.width).toBeGreaterThan(150);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(390);
    }
    expect(await page.evaluate(
      () => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
  });
