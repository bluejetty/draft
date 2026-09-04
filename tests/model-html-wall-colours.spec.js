// MODEL.html paints WALLS through the skin, not through two literals.
//
// drawWallSeg2D hardcoded '#ffffff' for the body and '#1d1f20' for every
// boundary line, end cap and endpoint dot. On the day page those are right.
// On the night page '#1d1f20' IS the page colour -- contrast 1.00 -- so every
// end cap that crossed bare paper was drawn in invisible ink, and the wall
// read as a bare white slab on a black ground.
//
// The painter now reads env.colors.wall / .wallEdge with those literals as
// fallbacks, which means a page that STOPS supplying them still draws walls,
// still looks perfect on day, and is wrong only at night. That is precisely
// the failure a single-skin test cannot see, so both skins are measured here
// and the assertion is which way they differ.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';

const canvasPixels = page => page.evaluate(() => {
  const c = document.getElementById('plan');
  return Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data);
});

// EXACT white, not near-white. The first version of this file counted pixels
// at or above 240 on every channel and called that "the wall body, and nothing
// else on the canvas comes close". It was wrong twice over, and it PASSED on a
// deliberately broken page, which is the only reason the error was found:
//
//   * the DAY page is #f2f2f3 -- 242 on every channel. The statistic was
//     counting the paper, ~900k pixels of it, so day's number said nothing
//     about walls at all.
//   * against a number that large, `night < day` is true whatever night does.
//     Unskinned night walls scored 12106 and the assertion still passed.
//
// 255/255/255 is exact and no skin's ground is that. Day's wall body is
// #ffffff so it lands there; night's #2f3335 cannot; and a solid fill has a
// core the anti-aliasing does not reach.
const pureWhite = pixels => {
  let n = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] === 255 && pixels[i + 1] === 255 && pixels[i + 2] === 255) n += 1;
  }
  return n;
};

// THE BRIGHTEST INK THE WALLS THEMSELVES PUT ON THE PAGE.
//
// Differenced against the same canvas with the walls removed, so grid,
// dimensions, floors and the datum marker all cancel and what is left is wall
// ink only -- the shape drawOrigin2D's spec uses for the same reason.
//
// Brightness is the right statistic because it is MONOTONE under the only
// distortion here: anti-aliasing blends wall ink toward the page, and on night
// the page is darker than either wall colour, so a halo can only lower this
// number. Its maximum is therefore the lightest colour the walls actually
// paint -- draw-wall-edge #a7aeb1, peak channel 177, when the page supplies
// the skin, and #ffffff, peak 255, when it does not.
function peakWallInk(before, after) {
  let peak = -1;
  for (let i = 0; i < after.length; i += 4) {
    if (before[i] === after[i] && before[i + 1] === after[i + 1]
      && before[i + 2] === after[i + 2]) continue;
    const brightest = Math.max(after[i], after[i + 1], after[i + 2]);
    if (brightest > peak) peak = brightest;
  }
  return peak;
}

async function houseOnOldPage(page) {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);
}

// Reload the saved drawing with an edit applied, then open MODEL.html on one
// skin. Same mechanism as the datum spec's loadWith.
async function loadWith(page, src, mode) {
  await page.evaluate(async ({ bucket, src: t }) => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const drawing = JSON.parse(await file.text());
    // eslint-disable-next-line no-new-func
    const out = new Function('d', t)(drawing) || drawing;
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(out)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, src });
  await page.goto(`/MODEL.html?mode=${mode}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 6000 });
}

// STRIPPED, not hidden: a level or view filter would leave the painter still
// deciding, and the point of the baseline is that no wall ink reaches the
// canvas at all.
//
// ORDER IS LOAD-BEARING, and getting it wrong is what the first run caught.
// loadWith SAVES the edited drawing back to the store, so the strip is
// permanent -- a pass-through afterwards reloads a drawing that has no walls
// left, both renders come out identical, and the difference is empty. So both
// walls-present renders happen FIRST, on one generated house, and the strip
// happens once at the end. (The datum spec has the mirror image of this note:
// there a pass-through failed to CLEAR state that the previous call had left
// behind. Same hazard, opposite direction.)
const NO_WALLS = 'd.walls = []; return d;';
const KEEP = 'return d;';

async function inkOnBothSkins(page) {
  await houseOnOldPage(page);
  await loadWith(page, KEEP, 'night');
  const afterNight = await canvasPixels(page);
  await loadWith(page, KEEP, 'day');
  const afterDay = await canvasPixels(page);

  await loadWith(page, NO_WALLS, 'night');
  await expect(page.locator('#readout')).toContainText('walls 0/');
  const beforeNight = await canvasPixels(page);
  await loadWith(page, KEEP, 'day');
  const beforeDay = await canvasPixels(page);

  return {
    night: { peak: peakWallInk(beforeNight, afterNight), white: pureWhite(afterNight) },
    day: { peak: peakWallInk(beforeDay, afterDay), white: pureWhite(afterDay) },
  };
}

test.describe('MODEL.html wall colours', () => {
  // NO THRESHOLD, by design: one statistic, two skins, and only the direction
  // is asserted. draw-wall-edge is #a7aeb1 on night and the wall body is
  // #ffffff on day, so a page that supplies the colours paints DARKER ink at
  // night than by day. A page that stops supplying them falls back to the
  // literals -- which are the day values -- and the two peaks become equal.
  test('the walls are painted in the SKIN\'s colours, not the hardcoded pair',
    async ({ page }) => {
      const { night, day } = await inkOnBothSkins(page);

      expect(night.peak, 'the walls must put ink on the night canvas').toBeGreaterThan(0);
      expect(day.peak, 'and on the day canvas').toBeGreaterThan(0);
      expect(night.peak,
        `night peak ${night.peak} vs day peak ${day.peak} -- night wall ink must `
        + 'be DARKER. Equal peaks mean the page stopped supplying env.colors and '
        + 'both skins fell back to the #ffffff literal')
        .toBeLessThan(day.peak);
    });

  // The same fact stated the other way round, and the reason it earns a second
  // test: it is an absolute claim rather than a comparison. There is no white
  // in the night palette, so one white pixel on that canvas is a painter
  // ignoring the skin -- no baseline, no differencing, nothing to get subtly
  // wrong. Day is the control: it proves the counter can see a white wall.
  test('night paints no white at all; day still does', async ({ page }) => {
    const { night, day } = await inkOnBothSkins(page);
    expect(day.white, 'day fills walls #ffffff, so the counter must find them')
      .toBeGreaterThan(0);
    expect(night.white,
      `${night.white} pure-white pixels on the night canvas. Nothing in the `
      + 'night skin is white, so this is drawWallSeg2D painting the literal')
      .toBe(0);
  });
});
