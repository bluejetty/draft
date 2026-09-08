// TIER 2f — MODEL.html draws the DATUM MARKER through drawOrigin2D.
//
// Tier 2d anchored the grid to the datum but never drew the point itself, so
// the drafter got a grid whose origin could only be found by counting squares.
// This is the point Movie described: "that way he always first clicks on 0,0."
//
// The seam this file guards is a colour, and it guards it because wiring this
// painter turned up a defect. drawOrigin2D hardcoded `ctx.strokeStyle =
// '#557a46'` -- the one painter a skinned page could not re-colour. Measured
// against the skins that literal scores 2.94 over the NIGHT floor wash, under
// the 3.0 WCAG non-text floor. And of all the marks on the canvas this is the
// one most likely to be ON a slab: a datum is the drafter's FIRST CLICK, which
// normally lands on the building.
//
// So the painter now reads `env.colors.origin`, and the assertion below is
// that MODEL.html actually supplies it. A page that stopped supplying it would
// still draw a marker -- the old literal is the fallback -- and would look
// completely fine on the day skin. Only night shows the difference.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
// palette.js's two draw-origin values, hardcoded. Asking the page which colour
// it used and then checking it used that colour proves nothing.
const NIGHT_GREEN = [0x6a, 0x9a, 0x57];
const DAY_GREEN = [0x55, 0x7a, 0x46];
// Tight enough that the two greens cannot be confused for each other: their
// green channels differ by 32, so a +/-12 window around each is disjoint. Also
// disjoint from draw-shape's greens on both skins, which are the only other
// green ink on the canvas.
const TOL = 12;

// THE WHOLE CANVAS, BUT NOT AS 3.7 MILLION JSON NUMBERS.
//
// `Array.from(...data)` builds a 3,686,400-element JS array and Playwright
// serialises every element over CDP. Measured on 7 Sep: 19.4s per read, and
// four reads are the entire cost of this file. Base64 of the identical bytes
// is 526ms -- 37x -- because it crosses the wire as one string.
//
// The bytes are the same bytes. Buffer indexes and lengths exactly like the
// array did, so the statistics below are untouched; this changes the TRUCK,
// not the cargo.
const canvasPixels = async (page) => {
  const b64 = await page.evaluate(() => {
    const c = document.getElementById('plan');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    // Chunked: String.fromCharCode.apply blows the argument limit on a
    // 3.7MB array in one call.
    let s = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < d.length; i += CHUNK) {
      s += String.fromCharCode.apply(null, d.subarray(i, i + CHUNK));
    }
    return btoa(s);
  });
  return Buffer.from(b64, 'base64');
};

// CLEARLY GREEN, and everything else on this canvas is not. Grid ink, walls,
// the page and the floor wash are all grey or near-grey (r ~ g ~ b); the only
// green the datum can add is the marker. 15 is a wide margin, not a tuned one:
// both markers clear it by 20-plus (night 48, day 37) and grey ink scores 0.
const isGreen = (r, g, b) => g - Math.max(r, b) >= 15;

// THE PEAK GREEN CHANNEL AMONG THE PIXELS THE DATUM ADDED.
//
// Two decisions here, and the first version of this file got both wrong.
//
// DIFFERENCE, not the whole canvas: the datum drives the grid as well as the
// marker, so differencing datum against no-datum leaves grid ink and marker
// ink and nothing else. isGreen then drops the grid.
//
// GREENNESS, and it took two wrong statistics to get here. Both were the same
// error -- measuring the anti-aliased halo instead of the stroke.
//
//   1. Counting pixels near each skin's green, and asserting the crossover.
//      FAILED in the full suite, 44 against 75. #557a46 is almost exactly
//      #6a9a57 blended a quarter of the way to #1d1f20, so on the night skin
//      THE TWO GREENS SIT ON THE SAME BLEND RAY between marker and page. A
//      1.5px stroke is mostly edge, so the halo lands nearer the day green
//      than the core lands to the night green.
//
//   2. The peak GREEN CHANNEL. Correct on night -- it read 154, exactly
//      #6a9a57 -- and wrong on day, where it read 187 against a marker whose
//      green channel is 122. Blending toward a LIGHT page RAISES the green
//      channel while the pixel still reads green, so the statistic found the
//      halo again, in the other direction.
//
// Greenness -- how far the green channel stands above the other two -- falls
// monotonically toward zero as any colour blends toward a grey ground, on a
// dark page and a light one alike. So its maximum is the stroke's own colour
// whichever skin is up: 48 for #6a9a57, 37 for #557a46. The halo can only
// reduce it, never inflate it.
function peakGreen(before, after) {
  let peak = -1;
  for (let i = 0; i < after.length; i += 4) {
    if (before[i] === after[i] && before[i + 1] === after[i + 1]
      && before[i + 2] === after[i + 2]) continue;
    const r = after[i], g = after[i + 1], b = after[i + 2];
    const greenness = g - Math.max(r, b);
    if (greenness >= 15 && greenness > peak) peak = greenness;
  }
  return peak;
}

async function houseOnOldPage(page) {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);
}

async function loadWith(page, src, mode = 'night') {
  await page.evaluate(async ({ bucket, src: s }) => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const drawing = JSON.parse(await file.text());
    // eslint-disable-next-line no-new-func
    const out = new Function('d', s)(drawing) || drawing;
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(out)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, src });
  await page.goto(`/MODEL.html?mode=${mode}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 6000 });
}

// A datum ON the house, which is where a real one is: the drafter's first
// click lands on the building, not out in the empty page.
// NULL, not absent, and not merely "unchanged". markerOn runs twice in one
// test and the first run leaves a datum in the store, so passing the drawing
// through would carry it into the second. null is also the state the generated
// house is really in -- it is never clicked into place -- while DELETING the
// key would mean something else entirely: a drawing older than the datum,
// back-filled to the world origin, which draws a grid and a marker.
const NO_DATUM = 'd.drawingOrigin = null; return d;';
const AT_DATUM = 'd.drawingOrigin = { x: 0, z: 0 }; return d;';

// The marker's pixels on one skin: render without a datum, render with one,
// and keep what changed.
async function markerOn(page, mode) {
  await loadWith(page, NO_DATUM, mode);
  await expect(page.locator('#readout')).toContainText('datum none');
  const before = await canvasPixels(page);
  await loadWith(page, AT_DATUM, mode);
  await expect(page.locator('#readout')).toContainText('datum 0.00,0.00');
  const after = await canvasPixels(page);
  return { peak: peakGreen(before, after), before, after };
}

// MEASURED FIRST, THEN HOISTED -- the same finding as
// model-html-wall-colours.spec.js, and this file is the second worst in the
// group. Timed with the JSON reporter on 7 Sep: 111.2s over two tests, 72.7s
// and 38.6s, against a 180s per-test budget. The next slowest test outside
// these two files is 3.8s.
//
// Both tests build the house and run markerOn('night'); one of them also runs
// markerOn('day'). Every one of those is a page load plus a full canvas read,
// and the answers are deterministic -- the same drawing, the same skins, the
// same pixels. So the work happens once for the file.
//
// THIS IS THE SPEC THAT FAILED ON PR #313 with a diff that could not reach it
// (BOARD-test-budget.md: "a change confined to LAYOUT.dc.html ... a spec whose
// diff cannot reach it"). It was never on that board's list of heavy specs; it
// turned up only when the group was actually timed.
test.describe.configure({ mode: 'serial' });

test.describe('MODEL.html datum marker', () => {
  // One page for the file. The tests assert on captured numbers and pixels and
  // touch neither the page nor the store.
  let night, day;
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await houseOnOldPage(page);
      night = await markerOn(page, 'night');
      day = await markerOn(page, 'day');
    } finally { await page.close(); }
  });

  // NO THRESHOLD, and none is needed: this is the same statistic measured on
  // two skins. draw-origin is #6a9a57 on night and #557a46 on day, so a page
  // that supplies the colour paints a LIGHTER green on night than on day. A
  // page that does not supply it falls back to the literal -- which is the day
  // value -- so both skins paint #557a46 and the two peaks become equal.
  // Nothing here has to know what the numbers are, only which is bigger.
  test('the marker is painted in the SKIN\'s green, not the hardcoded one',
    async () => {

      expect(night.peak, 'the datum must add green ink to the night canvas')
        .toBeGreaterThan(0);
      expect(day.peak, 'and to the day canvas').toBeGreaterThan(0);
      expect(night.peak,
        `night green ${night.peak} vs day green ${day.peak} -- the night skin's `
        + 'marker must be the LIGHTER green. Equal peaks mean the page stopped '
        + 'supplying env.colors.origin and both skins fell back to the literal')
        .toBeGreaterThan(day.peak);
    });

  test('no datum, no marker -- the same three states as the grid',
    async () => {
      const { before, after } = night;
      const green = pixels => {
        let n = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (isGreen(pixels[i], pixels[i + 1], pixels[i + 2])) n += 1;
        }
        return n;
      };
      expect(green(after),
        'a datum puts a marker on the canvas; without one the page has no '
        + 'green ink on it at all')
        .toBeGreaterThan(green(before));
    });
});
