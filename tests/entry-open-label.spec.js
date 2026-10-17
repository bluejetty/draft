// THE DOOR SAYS WHAT IT IS (Movie, 12 Oct): "when my MOM goes to the Rough
// Drafter Entry page - she doesn't realize she should click the logo, so under
// the logo in the 2 spaces below (in the 'table') fill those with text: OPEN
// (next line centered) ROUGH DRAFTER (next line centered) RESIDENTIAL DRAFTING
// PROGRAM".
//
// OVER THE LOGO, NOT UNDER IT, since he saw it on screen: "lets put the OPEN
// ROUGH DRAFTER part up top and the other stuff below". The words took the two
// cells above the logo and the three utility links went down to the bottom
// row. Both halves are checked, because the complaint was about the ORDER of
// the page and not about the words alone -- a build that moved the words up
// and left the errands above them would read the same way round as the one he
// rejected.
//
// THE ONE THING THAT COULD GO QUIETLY WRONG, and what most of this spec is
// about: the words are a LABEL ON THE DOOR, not a caption beside it. A block
// that reads OPEN ROUGH DRAFTER and does nothing when it is pressed is worse
// than no block at all — the person it was written for would press the words
// first, get nothing, and conclude the page is broken. So the words live
// inside the same <a> as the logo, and that is asserted structurally AND by
// pressing them.
//
// AND IT STAYS ONE DOOR. front-door.spec.js pins that there is no second,
// quieter way into the model space (the "preview" link, removed 20 Sep). This
// could have reopened that by making the caption its own link; it does not,
// and the count is checked here too so the two specs cannot drift apart.
const { test, expect } = require('@playwright/test');

// MODEL.html is stubbed rather than loaded: the claim is which door the press
// opens, and starting the whole model space to read a URL is a minute of CI
// for a string. The stub stamps the body so "we got there" is a fact about the
// loaded document.
async function stubModelSpace(page) {
  await page.route('**/MODEL.html*', route => route.fulfill({
    status: 200, contentType: 'text/html',
    body: '<!doctype html><title>stub</title><body data-model-stub="1">',
  }));
}

test('the logo carries its own label: OPEN / ROUGH DRAFTER / RESIDENTIAL DRAFTING PROGRAM',
  async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/index.html`);

    const call = page.locator('.enter-call');
    await expect(call).toBeVisible();
    // His three lines, in his order. Read off the block as one string so the
    // ORDER is pinned and not just the presence of three phrases.
    expect((await call.innerText()).split('\n').map(s => s.trim()).filter(Boolean))
      .toEqual(['OPEN', 'ROUGH DRAFTER', 'RESIDENTIAL DRAFTING PROGRAM']);

    // CENTRED, each line, which is the only thing he said about how they sit.
    for (const part of ['.enter-open', '.enter-name', '.enter-what']) {
      const box = await page.locator(part).boundingBox();
      const logo = await page.locator('.enter-logo').boundingBox();
      expect(Math.abs((box.x + box.width / 2) - (logo.x + logo.width / 2)),
        `${part} is off the logo's centre line`).toBeLessThan(2);
    }
  });

test('the words are inside the one door, so pressing them opens the model space',
  async ({ page, baseURL }) => {
    await stubModelSpace(page);
    await page.goto(`${baseURL}/index.html`);

    // STILL EXACTLY ONE WAY IN. A caption given its own <a> would read the
    // same on screen and quietly undo the 20 Sep ruling.
    await expect(page.locator('a.enter-link')).toHaveCount(1);
    expect(await page.locator('.enter-call').evaluate(
      el => Boolean(el.closest('a.enter-link'))),
    'the label is not inside the link, so pressing the words does nothing').toBe(true);

    // And pressing the WORDS — not the logo — arrives.
    await page.locator('.enter-open').click();
    await page.waitForFunction(() => document.body?.dataset.modelStub === '1', null, { timeout: 5000 });
    const url = new URL(page.url());
    expect(url.pathname.endsWith('/MODEL.html')).toBe(true);
    expect(url.searchParams.get('from')).toBe('entry');
  });

test('OPEN is the biggest line, and the block sits over the logo without reaching past it',
  async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/index.html`);

    // "make open a bit bigger" — the hierarchy, not a pixel count, because
    // the sizes are clamped off --logo-w and move with the viewport.
    const px = sel => page.locator(sel).evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    const [open, name, what] = await Promise.all([px('.enter-open'), px('.enter-name'), px('.enter-what')]);
    expect(open).toBeGreaterThan(name);
    expect(name).toBeGreaterThan(what);

    const logo = await page.locator('.enter-logo').boundingBox();
    const call = await page.locator('.enter-call').boundingBox();
    // OVER the logo, not overlapping it.
    expect(call.y + call.height).toBeLessThanOrEqual(logo.y + 1);

    // AND THE ERRANDS ARE UNDER IT -- the ones along the BOTTOM. "the other
    // stuff below" (Movie, 12 Oct) was said of the three utility links that
    // had been sitting along the TOP of the sheet, above the thing the page
    // is for; it is still true of them.
    //
    // THE SIDE COLUMNS ARE NEW AND ARE BESIDE IT (Movie, 14 Oct, drawn in
    // GIMP over the page): a red box down the LEFT for the book links and a
    // blue one down the RIGHT for "the building code / span stuff. i will add
    // more building code stuff". (17 Oct swapped the sides and gave each a
    // title -- entry-columns.spec.js -- which changes nothing here.) A column
    // that may only start below the logo is not a column. So the rule this
    // holds is the one he actually set: the
    // BOTTOM ROW stays under the logo, and nothing on either side reaches
    // into the logo's own two columns.
    const boxes = await page.locator('a.ring-link').evaluateAll(
      els => els.map(el => ({ box: Number(el.dataset.box),
        ...el.getBoundingClientRect().toJSON() })));
    expect(boxes.length).toBeGreaterThan(0);
    const BOTTOM_ROW = [8, 9, 10];
    for (const link of boxes) {
      if (BOTTOM_ROW.includes(link.box)) {
        expect(link.y, `box ${link.box} left the bottom row`)
          .toBeGreaterThan(logo.y + logo.height - 1);
      } else {
        // A SIDE LINK CLEARS THE LOGO SIDEWAYS, which is what keeps the
        // middle column the logo's own: entirely left of it, or entirely
        // right of it.
        const clearsLeft = link.x + link.width <= logo.x + 1;
        const clearsRight = link.x >= logo.x + logo.width - 1;
        expect(clearsLeft || clearsRight,
          `box ${link.box} stands over the logo`).toBe(true);
      }
    }
    // AND NO WIDER. The two ring cells it fills are columns 2 and 3, together
    // exactly one logo wide; past that it would reach into the cells where
    // boxes 11/12 and 5/6 live.
    expect(call.width).toBeLessThanOrEqual(logo.width + 1);
  });

test('a phone shows the label over the logo and still does not scroll',
  async ({ page, baseURL }) => {
    // The entry page's standing rule: never scroll to show a way in that
    // should be the first thing you see. The label makes the column taller,
    // so this is the size it had to stay inside of.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseURL}/index.html`);

    await expect(page.locator('.enter-call')).toBeVisible();
    const logo = await page.locator('.enter-logo').boundingBox();
    const call = await page.locator('.enter-call').boundingBox();
    expect(call.y).toBeLessThan(logo.y);
    expect(await page.evaluate(
      () => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
  });
