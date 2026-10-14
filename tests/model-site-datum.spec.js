// THE LOT'S OWN REGISTRATION MARK — the green target on the site plan.
//
// Movie, 13 Oct: "the SITE PLAN will need a seperate registration mark make it
// a GREEN TARGET - it should be located at the corne were E1 and E2 are front
// and left side corner".
//
// WHERE it stands is lot-sizes' siteDatumOf, and proto/lot-sizes-harness.js
// pins that arithmetic -- the corner E1 and E2 share, re-read after the lot is
// dragged out of square. WHAT COLOUR it is is palette.js's draw-site-datum,
// and the palette harness measures it. What neither can see is whether the
// page PAINTS it, which is this file's whole job: a mark that is computed,
// coloured, and never drawn is three correct parts and no target.
//
// COUNTED IN PIXELS, because that is the only honest question here. Asking
// the page whether it "would" paint the mark is asking it to agree with
// itself; asking the canvas how many pixels came out the site-datum colour is
// asking the drawing.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const empty = () => ({
  version: 1,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
});

async function openSite(page, file = empty()) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  await page.goto('/MODEL.html?level=8');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(400);
}

// HOW MANY PIXELS CAME OUT THE MARK'S OWN COLOUR -- taken from the palette
// rather than typed, so the day/night pair and any later retune are the
// page's business and this stays a question about the PAINTER.
const markPixels = page => page.evaluate(() => {
  // READ OFF THE DOCUMENT, which is the colour actually in force: palette.js
  // apply() writes every role as a custom property, so this follows a skin
  // change or a retune without the spec resolving a theme of its own.
  const want = getComputedStyle(document.documentElement)
    .getPropertyValue('--draw-site-datum').trim();
  const hex = String(want).replace('#', '');
  const to = i => parseInt(hex.slice(i, i + 2), 16);
  const [wr, wg, wb] = [to(0), to(2), to(4)];
  const canvas = document.querySelector('canvas');
  const { data } = canvas.getContext('2d')
    .getImageData(0, 0, canvas.width, canvas.height);
  let hits = 0;
  for (let i = 0; i < data.length; i += 4) {
    // A STROKE IS ANTI-ALIASED, so an exact match would count only the few
    // pixels at the centre of a 1.5px line. Near enough is the question: no
    // other role on this page is this green.
    if (Math.abs(data[i] - wr) < 24 && Math.abs(data[i + 1] - wg) < 24
      && Math.abs(data[i + 2] - wb) < 24) hits += 1;
  }
  return hits;
});

const drawLot = async page => {
  await expect(page.locator('#lot-pick')).toBeVisible({ timeout: 6000 });
  await page.locator('[data-lot-tiles] button').nth(2).click();
  await page.locator('[data-lot-pick-draw]').click();
  await page.waitForTimeout(600);
};

test('a site with no lot has no second target', async ({ page }) => {
  await openSite(page);
  // THE CARD IS UP AND NOTHING IS DRAWN YET. A mark at 0,0 "ready for a lot"
  // would be a registration point for a lot nobody has.
  expect(await markPixels(page), 'something painted the site datum with no lot on the page')
    .toBe(0);
});

test('drawing the AUTOSITE paints the lot its own target', async ({ page }) => {
  await openSite(page);
  await drawLot(page);
  expect(await markPixels(page), 'the lot was drawn and its target never appeared')
    .toBeGreaterThan(0);

  // WHERE it stands is not asked here, and deliberately. The corner rule is
  // arithmetic -- min x, max z, re-read after the lot is dragged out of square
  // -- and proto/lot-sizes-harness.js asks it of siteDatumOf directly, over
  // four lot shapes, in milliseconds. Re-deriving the world-to-screen map in
  // here to find the same corner in pixels would be a second copy of the
  // page's own projection, and the first thing to rot. What only the browser
  // can answer is whether the painter runs at all, and that is what this is.
  //
  // AND THE LOT IS STILL THERE AFTERWARDS, so the count above is a mark on a
  // drawn lot rather than a mark on a page that threw halfway through.
  await expect(page.locator('#readout')).toContainText('walls');
});

test('and the mark is not the drawing-s own gold datum', async ({ page }) => {
  // TWO MARKS, TWO MEANINGS. The drawing's datum is the drafter's first click
  // and went GOLD on 17 Sep; the site's is a corner of the lot. A sheet
  // carrying both has to say which is which, so the two colours are asserted
  // to be different rather than assumed.
  await openSite(page);
  const pair = await page.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    return [css.getPropertyValue('--draw-origin').trim(),
      css.getPropertyValue('--draw-site-datum').trim()];
  });
  expect(pair[0], 'the site mark wears the drawing datum-s colour').not.toBe(pair[1]);
});
