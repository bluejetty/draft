// THE SECOND WITNESS: THE SHEET CARRIES THE NUMBERS IT DREW.
//
// realestateplan-draws.spec.js proves this page draws AT ALL -- that its
// stairs reach the sheet and that the modules its painters ask for are
// loaded. It cannot see the defect below, and neither could a person looking
// at the page quickly: the plan is there, the walls are there, the strings
// are there. Some of the strings are simply not all there.
//
// WHAT WAS WRONG. drawSeat framed each plan over `wallBounds` -- where the
// WALLS are -- and then clipped the box to its own rectangle. A dimension
// string does not stand on the wall it measures; on Movie's own drawing they
// stand 3 to 4.5 ft outside it, and the overall runs furthest out of all. So
// the fit was computed over one shape and the ink drawn over a larger one,
// and the difference went under the clip. Nineteen strings on a two-plan
// sheet, including both overalls.
//
// AND WHY IT NEEDED TWO FIXES, WHICH IS WHY THIS SPEC MEASURES INK AND NOT
// BOUNDS. `planBounds` frames the dimension RECORDS and got most of it back.
// The rest is render-2d.js's drawDimension2D standing its line off those
// records by a CONSTANT 19 SCREEN PIXELS and centring the label on it -- a
// stand-off in device space, which no bounds in model feet can ever see. A
// test written against `planBounds` would have gone green with the top row of
// every plan still cut off.
//
// SO IT READS THE CANVAS. Every fillText is caught with the transform in
// force at the moment of the call, turned into the four corners of the text,
// and held against the clip rectangle the page itself pushed. That is the
// same question the eye asks of the paper, and the only one that stays true
// when a number in another file moves.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

// THE DRAWING MOVIE REPORTED ON, not a drawing built for this test. It carries
// 94 dimension records across two dimensioned levels, which is what makes the
// clip reachable -- a one-room fixture would fit inside any box and let this
// pass by having nothing to lose.
const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-movie-bands.draft'), 'utf8'));

// A FOOT-AND-INCH STRING AND NOTHING ELSE. The seat captions, the stair notes
// and the 3D placeholder are all drawn outside the clipped region on purpose
// -- the caption sits in the strip below the plan -- so a check that swept up
// every fillText would fail on ink that is exactly where it belongs.
const DIMENSION = /^\d+'-\d+(?: \d+\/\d+)?"$/;

async function sheetInk(page, paperId) {
  await h.suppressEntryCoach(page);
  await page.goto('/REALESTATEPLAN.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 15000 });
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: h.STORAGE_BUCKET, saved: REPRO });
  await page.goto('/REALESTATEPLAN.html');
  await page.evaluate(() => {
    window.__ink = [];
    window.__clips = [];
    const P = CanvasRenderingContext2D.prototype;
    const fillText = P.fillText;
    P.fillText = function (text, x, y) {
      // THE TRANSFORM AT THE MOMENT OF THE CALL. A dimension label is drawn
      // rotated to run along its own line, so its x and y are 0,0 in a frame
      // the page has already translated and turned. Reading them raw says
      // every string is at the origin, which is how a naive version of this
      // test passes on a page that is clipping everything.
      const m = this.getTransform();
      const w = this.measureText(String(text)).width;
      const left = this.textAlign === 'center' ? x - w / 2
        : this.textAlign === 'right' ? x - w : x;
      // 11px type on an alphabetic baseline: 8 up for the caps, 3 down for the
      // descenders and the label's backing box. Deliberately a little generous
      // -- this is the margin a reader would call "touching the edge".
      window.__ink.push({
        text: String(text),
        corners: [[left, y - 8], [left + w, y - 8], [left, y + 3], [left + w, y + 3]]
          .map(([px, py]) => ({ x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f })),
      });
      return fillText.apply(this, arguments);
    };
    // THE PAGE'S OWN CLIP, not a rectangle this test computes. drawSeat pushes
    // exactly one `rect` before its `clip`, and taking it from the page means
    // a change to how the boxes are laid out cannot quietly move the goalposts.
    const rect = P.rect;
    P.rect = function (x, y, w, hh) {
      window.__clips.push({ x, y, w, h: hh });
      return rect.apply(this, arguments);
    };
  });
  if (paperId) {
    await page.selectOption('#paper', paperId);
  }
  // FORCED, because the first paint can be over before the hook is installed.
  await page.setViewportSize({ width: 1360, height: 764 });
  await page.waitForFunction(() => (window.__ink || []).length > 0, null, { timeout: 20000 });
  return page.evaluate(() => ({ ink: window.__ink, clips: window.__clips }));
}

const clipped = ({ ink, clips }) => ink
  .filter(entry => DIMENSION.test(entry.text))
  .filter(entry => !clips.some(box => entry.corners.every(pt =>
    pt.x >= box.x && pt.x <= box.x + box.w && pt.y >= box.y && pt.y <= box.y + box.h)));

test('every dimension string the listing plan draws is on the paper', async ({ page }) => {
  const sheet = await sheetInk(page, null);

  // THE FIXTURE'S OWN REACH FIRST. Without these two lines a page that drew no
  // dimensions at all -- or a clip that was never pushed -- would satisfy the
  // check below by having nothing to measure, which is the exact disease
  // realestateplan-draws.spec.js was written to treat.
  expect(sheet.clips.length, 'the page clipped at least one plan box').toBeGreaterThan(0);
  const strings = sheet.ink.filter(entry => DIMENSION.test(entry.text));
  expect(strings.length, 'the sheet carries dimension strings at all').toBeGreaterThan(10);

  expect(clipped(sheet).map(entry => entry.text),
    'these strings were drawn outside the box that clips them, so they are not on '
    + 'the printed sheet: the plan is framed over something smaller than what it draws')
    .toEqual([]);
});

test('and on every paper the page offers, not just the one it opens on', async ({ page }) => {
  // THREE PAPERS, THREE BOX SHAPES. The fit is `Math.min` of the width and the
  // height term, so which of the two binds changes with the aspect ratio --
  // and a reserve that is only subtracted from the one that does not bind
  // would leave landscape green and portrait clipped. Letter portrait is the
  // one that catches that; tabloid is the widest box on offer.
  for (const paper of ['letter-port', 'tabloid-land']) {
    const sheet = await sheetInk(page, paper);
    expect(sheet.clips.length, `${paper}: the page clipped at least one plan box`)
      .toBeGreaterThan(0);
    expect(clipped(sheet).map(entry => entry.text),
      `${paper}: dimension strings drawn outside the clipped box`).toEqual([]);
  }
});
