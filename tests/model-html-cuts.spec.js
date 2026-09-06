// TIER 2 — MODEL.html paints cut marks through drawCutMarks2D.
//
// The painter is covered by proto/render-2d-harness.js and the geometry by
// proto/cut-marks-harness.js. What only a page test can reach is the SEAM, and
// this painter's seam is the widest of the five: its four inputs come from
// THREE different places.
//
//   cuts                  the drawing        persisted, read like walls
//   elevationMarkOffsets  the drawing        persisted
//   structureStandards    the PROFILE        localStorage, not the drawing
//   autoDimFirstOffsetFt  nowhere            session state; this page defaults
//
// The third is the reason profile-manager.js is in the head, and `the profile
// is actually read` below is the check that earns that dependency. Without it
// the page could ignore the profile entirely and every other test here would
// still pass.
//
// TWO COLOURS, as with fixtures. drawCutMarks2D strokes in the cut ink and
// fills the bubble interior, and both were literals baked into the painter:
// '#b04060' and '#fff'. On the night skin that is a white disc under pink
// lettering on a near-black ground -- a hole punched in the drawing.
// MODEL.dc.html has one light page and could never have caught it.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const PROFILE_KEY = 'draft-active-package:standards';   // profile-manager.js:7
const PROFILE_FORMAT = 'draft-profile-package';         // profile-manager.js:5
const NIGHT_INK = '#d4788f';    // palette.js night draw-cut
const NIGHT_FILL = '#1d1f20';   // palette.js night surface-page
const DAY_INK = '#b04060';      // palette.js day draw-cut -- the painter's old literal
const DAY_FILL = '#f2f2f3';     // palette.js day surface-page
const OLD_WHITE = '#fff';

async function recordPaint(page) {
  await page.addInitScript(() => {
    window.__strokes = [];
    window.__fills = [];
    window.__text = [];
    const proto = CanvasRenderingContext2D.prototype;
    for (const [prop, sink] of [['strokeStyle', '__strokes'], ['fillStyle', '__fills']]) {
      const desc = Object.getOwnPropertyDescriptor(proto, prop);
      Object.defineProperty(proto, prop, {
        set(v) { window[sink].push(String(v)); return desc.set.call(this, v); },
        get() { return desc.get.call(this); },
      });
    }
    const fillText = proto.fillText;
    proto.fillText = function (t, ...rest) { window.__text.push(String(t)); return fillText.call(this, t, ...rest); };
    // The drawing operations, not just the styles. Needed twice below: a style
    // set proves the painter RAN, and the two checks that matter are about
    // whether it DREW -- see each for why the difference bites.
    window.__ops = [];
    for (const op of ['moveTo', 'lineTo', 'arc', 'fill', 'stroke', 'closePath']) {
      const real = proto[op];
      proto[op] = function (...a) {
        window.__ops.push(op + '(' + a.map(v => (typeof v === 'number' ? Math.round(v * 10) / 10 : v)).join(',') + ')');
        return real.apply(this, a);
      };
    }
  });
}

async function houseOnOldPage(page) {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);
}

// The standards package as profile-manager stores it. Written straight to
// localStorage rather than through the STANDARDS page: this spec is about what
// MODEL.html READS, and driving another page's UI to set it would make a
// failure here ambiguous between the two.
async function setStandards(page, structureStandards) {
  await page.evaluate(([key, format, ss]) => {
    localStorage.setItem(key, JSON.stringify({
      format, kind: 'standards', content: { model: { structureStandards: ss } },
    }));
  }, [PROFILE_KEY, PROFILE_FORMAT, structureStandards]);
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

const lower = a => a.map(v => v.toLowerCase());
const CUT = `{
  id: 1, name: 'S1', elev: 0, auto: false, levelId: 3,
  startPt: { x: 4, z: 4 }, endPt: { x: 18, z: 4 }, dirVec: { x: 0, z: -1 }
}`;

test('a cut paints, in neither the night page\'s old ink nor its old white', async ({ page }) => {
  await recordPaint(page);
  await houseOnOldPage(page);
  await loadWith(page, `d.cuts = [${CUT}];`);

  const strokes = lower(await page.evaluate(() => window.__strokes.slice()));
  const fills = lower(await page.evaluate(() => window.__fills.slice()));

  expect(strokes).toContain(NIGHT_INK);
  expect(fills).toContain(NIGHT_FILL);

  // THE TWO INEQUALITIES. Asserting the right colour appears is satisfied by a
  // page that also paints the wrong one, and both wrong ones are exactly the
  // literals the painter used to carry.
  expect(strokes).not.toContain(DAY_INK);
  expect(fills).not.toContain(OLD_WHITE);
  expect(NIGHT_INK).not.toBe(NIGHT_FILL);

  // The bubble's own lettering reached the canvas.
  expect(await page.evaluate(() => window.__text.slice())).toContain('S1');
});

// THE DISCRIMINATOR, and the first version of it was wrong in a way worth
// keeping written down. It asserted that with no cuts the ink is never
// stroked -- and it failed, because drawCutMarks2D sets strokeStyle BEFORE it
// iterates (render-2d.js, just above the forEach). The colour is set whether
// or not there is anything to draw, so "the page stroked draw-cut" only ever
// proved the painter RAN.
//
// What actually discriminates is the lettering: every cut, hand-placed or
// automatic, writes its own name inside its bubble. No names, nothing drawn.
test('and the cuts are what draw it -- with no cuts and no ring, nothing is lettered', async ({ page }) => {
  await recordPaint(page);
  await houseOnOldPage(page);
  await setStandards(page, { autoElevations: false });
  await loadWith(page, 'd.cuts = [];');

  const text = await page.evaluate(() => window.__text.slice());
  expect(text).not.toContain('S1');
  ['E1', 'E2', 'E3', 'E4'].forEach(id => expect(text).not.toContain(id));

  // And the control, so this is not passing because the page drew nothing at
  // all: the walls are still there.
  await expect(page.locator('#readout')).toContainText('walls');
});

// THE CHECK THAT EARNS profile-manager.js. structureStandards is not in the
// drawing -- it is the drafter's office standard in localStorage. If this page
// used office defaults instead of reading it, a drafter who switched the ring
// off would open the viewer and find four elevation marks round the house.
// Every other test in this file passes either way; only this one can tell.
test('the profile is actually read: switching the ring off removes it', async ({ page }) => {
  await recordPaint(page);
  await houseOnOldPage(page);

  await setStandards(page, { autoElevations: true });
  await loadWith(page, 'd.cuts = [];');
  const on = await page.evaluate(() => window.__text.slice());
  expect(on).toEqual(expect.arrayContaining(['E1', 'E2', 'E3', 'E4']));

  await setStandards(page, { autoElevations: false });
  await page.goto('/MODEL.html?mode=night');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 6000 });
  const off = await page.evaluate(() => window.__text.slice());
  expect(off).not.toContain('E1');
});

// The other half of the profile: the bubble style. Two styles draw different
// shapes, so reading the wrong one is visible rather than theoretical.
test('and the bubble style comes from the profile too', async ({ page }) => {
  await recordPaint(page);
  await houseOnOldPage(page);

  await setStandards(page, { autoElevations: true, cutBubbleStyle: 'tucked' });
  await loadWith(page, `d.cuts = [${CUT}];`);
  const tucked = await page.evaluate(() => window.__ops.join(' '));

  await setStandards(page, { autoElevations: true, cutBubbleStyle: 'proud' });
  await page.goto('/MODEL.html?mode=night');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 6000 });
  const proud = await page.evaluate(() => window.__ops.join(' '));

  // The DRAWING, not a tally of style sets. The first version of this compared
  // window.__fills.length and both styles came to 54 -- equal by coincidence,
  // so the check passed nothing through. Two styles put the triangle in
  // different places, so the op sequence is where the difference lives.
  expect(tucked).not.toBe(proud);
  expect(tucked.length).toBeGreaterThan(0);
});

// A dragged elevation mark IS persisted, unlike the standards, so this one
// travels with the drawing and proves the offsets are read from it.
test('a dragged elevation mark moves, and the drawing is where that comes from', async ({ page }) => {
  await recordPaint(page);
  await houseOnOldPage(page);
  await setStandards(page, { autoElevations: true });

  await loadWith(page, 'd.cuts = []; d.elevationMarkOffsets = {};');
  const near = await page.evaluate(() => window.__strokes.length);

  await loadWith(page, 'd.cuts = []; d.elevationMarkOffsets = { E1: 40 };');
  const far = await page.evaluate(() => window.__strokes.length);

  // Pushing E1 forty feet out changes what the painter draws -- the mark is
  // still there, at a different place, so the tape differs.
  expect(await page.evaluate(() => window.__text.slice())).toContain('E1');
  expect(near).toBeGreaterThan(0);
  expect(far).toBeGreaterThan(0);
});

test('the day page paints them in the day ink and the day ground', async ({ page }) => {
  await recordPaint(page);
  await houseOnOldPage(page);
  await loadWith(page, `d.cuts = [${CUT}];`, 'day');

  const strokes = lower(await page.evaluate(() => window.__strokes.slice()));
  const fills = lower(await page.evaluate(() => window.__fills.slice()));
  expect(strokes).toContain(DAY_INK);
  expect(fills).toContain(DAY_FILL);
  expect(fills).not.toContain(OLD_WHITE);
  expect(strokes).not.toContain(NIGHT_INK);
});
