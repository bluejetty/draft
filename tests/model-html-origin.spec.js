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
// still draw a marker -- the literal is the fallback -- and would look
// completely fine on the day skin. Only night shows the difference.
//
// THE MARKER IS GOLD NOW (Movie, 17 Sep: "can you make the green target in the
// model space that GOLD color instead of Green"), and the literal moved with
// the day value, as the comment in drawOrigin2D says it must. The seam this
// file guards did not move: it is still "does the page supply the colour", and
// the statistic below is the old one rotated to the new hue.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';

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

// CLEARLY GOLD, and everything else on this canvas is not. Grid ink, walls,
// the page and the floor wash are all grey or near-grey (r ~ g ~ b), which
// scores 0 here; the only warm ink the datum can add is the marker. 15 is a
// wide margin, not a tuned one: both markers clear it by 80-plus (night 140,
// day 96) and grey ink scores 0.
const isGold = (r, g, b) => Math.min(r, g) - b >= 15;

// THE PEAK GOLDNESS AMONG THE PIXELS THE DATUM ADDED.
//
// Two decisions here, and the first version of this file got both wrong.
//
// DIFFERENCE, not the whole canvas: the datum drives the grid as well as the
// marker, so differencing datum against no-datum leaves grid ink and marker
// ink and nothing else. isGold then drops the grid.
//
// CHROMA, NOT A CHANNEL, and it took two wrong statistics to get here. Both
// were the same error -- measuring the anti-aliased halo instead of the
// stroke. Both were measured on the green marker this one replaced, and both
// would be just as wrong in gold.
//
//   1. Counting pixels near each skin's own value, and asserting the
//      crossover. FAILED in the full suite, 44 against 75. The day value was
//      almost exactly the night value blended a quarter of the way to the
//      night page, so ON THE NIGHT SKIN THE TWO SAT ON THE SAME BLEND RAY
//      between marker and page. A 1.5px stroke is mostly edge, so the halo
//      landed nearer the day value than the core landed to the night one.
//
//   2. One channel on its own -- then the green channel, 154 on night and
//      exactly right, and 187 on day against a marker whose green channel is
//      122. Blending toward a LIGHT page RAISES a channel while the pixel
//      still reads as the marker, so the statistic found the halo again, in
//      the other direction.
//
// What survives both is CHROMA: how far the marker's strong channels stand
// above its weak one. Blending toward a grey ground scales such a statistic by
// the blend factor exactly, whatever the ground's level, because
// min(t*r+k, t*g+k) - (t*b+k) = t*(min(r,g)-b). So it falls monotonically to
// zero toward grey on a dark page and a light one alike, and its maximum over
// stroke plus halo is the stroke's own colour. Measured: 96 for #966b0b, which
// is that colour exactly, and 140 for #f0b429 against a nominal 139 -- one
// count of rasterising a 1.5px stroke, not the halo, which can only reduce the
// statistic and never inflate it.
//
// IT WAS GREENNESS -- g - max(r, b) -- UNTIL THE MARKER WENT GOLD. The
// rotation is the only edit the hue change needed here, because the argument
// above is about the SHAPE of the statistic and not about which hue it points
// at: any zero-sum combination of the channels has the same blending law.
function peakGold(before, after) {
  let peak = -1;
  for (let i = 0; i < after.length; i += 4) {
    if (before[i] === after[i] && before[i + 1] === after[i + 1]
      && before[i + 2] === after[i + 2]) continue;
    const r = after[i], g = after[i + 1], b = after[i + 2];
    const goldness = Math.min(r, g) - b;
    if (goldness >= 15 && goldness > peak) peak = goldness;
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
  return { peak: peakGold(before, after), before, after };
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
  // two skins. draw-origin is #f0b429 on night and #966b0b on day, so a page
  // that supplies the colour paints a BRIGHTER gold on night than on day. A
  // page that does not supply it falls back to the literal -- which is the day
  // value -- so both skins paint #966b0b and the two peaks become equal.
  // Nothing here has to know what the numbers are, only which is bigger.
  test('the marker is painted in the SKIN\'s gold, not the hardcoded one',
    async () => {

      expect(night.peak, 'the datum must add gold ink to the night canvas')
        .toBeGreaterThan(0);
      expect(day.peak, 'and to the day canvas').toBeGreaterThan(0);
      expect(night.peak,
        `night gold ${night.peak} vs day gold ${day.peak} -- the night skin's `
        + 'marker must be the BRIGHTER gold. Equal peaks mean the page stopped '
        + 'supplying env.colors.origin and both skins fell back to the literal')
        .toBeGreaterThan(day.peak);
    });

  test('no datum, no marker -- the same three states as the grid',
    async () => {
      const { before, after } = night;
      const gold = pixels => {
        let n = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (isGold(pixels[i], pixels[i + 1], pixels[i + 2])) n += 1;
        }
        return n;
      };
      expect(gold(after),
        'a datum puts a marker on the canvas, and the no-datum render of the '
        + 'same drawing must carry strictly less gold ink than it does')
        .toBeGreaterThan(gold(before));
    });
});
