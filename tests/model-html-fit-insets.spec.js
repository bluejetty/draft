// FIT AND THE TWO DARK BARS — the band of the sheet that is not reachable.
//
// #plan is the full height of the page. #strip and #house-strip are
// `position:fixed` over its top and foot, so the canvas is TALLER than the
// part of it anybody can press. A fit computed against the whole canvas puts
// the top and bottom of the drawing under those bars: painted, visible in the
// sense that pixels exist, and impossible to grab.
//
// WHY THIS WAS NOT CAUGHT BY ANY EXISTING CHECK. At the 1280x720 the suite
// runs at, fit()'s 0.86 margin left the top edge at y=50 and the strip ended
// at y=45 -- the bug was real and five pixels wide. It only became a failure
// when the instrument strip grew from 34px to 44px (#401) and the five became
// minus five. Every check in the suite kept passing at 720 either way, which
// is the whole reason these are written against a SHORT viewport: 560px is an
// ordinary laptop window once browser chrome is taken off, and there the
// unfixed fit buries 13px of drawing under the strip.
//
// Gilligan, 15 Sep. Movie ruled option 1 -- "give fit() the chrome's insets"
// -- over shaving the 10px back off the bar, on the grounds that shaving moves
// the cliff to whichever control gets added next.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });

// WIDE AND DEEP, so the fit is bound by HEIGHT and the bars are what matters.
// A drawing bound by width is centred vertically with room to spare and could
// not show this bug at any viewport.
const plan = {
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  walls: [
    ['n', V(-30, -20), V(30, -20)], ['e', V(30, -20), V(30, 20)],
    ['s', V(30, 20), V(-30, 20)], ['w', V(-30, 20), V(-30, -20)],
  ].map(([id, start, end]) => ({ id, start, end, levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' })),
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
};

async function openShort(page) {
  await page.setViewportSize({ width: 1280, height: 560 });
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: plan });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

const barRects = page => page.evaluate(() => {
  const r = id => {
    const b = document.getElementById(id).getBoundingClientRect();
    return { top: b.top, bottom: b.bottom, height: b.height };
  };
  return { strip: r('strip'), house: r('house-strip') };
});

test('the fitted plan starts below the instrument strip and ends above the house strip',
  async ({ page }) => {
    await openShort(page);
    const { at } = await h.planFrame(page);
    const bars = await barRects(page);

    // The extreme edges of the drawn geometry, in client pixels.
    const topY = at(0, -20)[1];
    const botY = at(0, 20)[1];

    expect(bars.strip.height, 'the instrument strip is the 44px one this is about')
      .toBeGreaterThan(40);

    // THE CLAIM, both ends. Not "roughly centred" and not "on the canvas":
    // the drawing's own first and last foot have to be in the band nobody's
    // bar is over, because that is the band a drafter can press.
    expect(topY, `the top of the plan (y=${topY.toFixed(1)}) clears the `
      + `instrument strip (ends y=${bars.strip.bottom.toFixed(1)})`)
      .toBeGreaterThan(bars.strip.bottom);
    expect(botY, `the bottom of the plan (y=${botY.toFixed(1)}) clears the `
      + `house strip (starts y=${bars.house.top.toFixed(1)})`)
      .toBeLessThan(bars.house.top);
  });

test('the top wall of a fitted plan can actually be pressed',
  async ({ page }) => {
    // THE SAME FACT, AS A GESTURE. The check above is arithmetic on the
    // camera; this one asks the browser who would receive the press, which is
    // the thing the drafter actually experiences. Both, because the first
    // would survive a fit that is correct while something else covers the
    // canvas, and the second would survive a fit that is wrong in a way the
    // grab tolerance happens to absorb.
    await openShort(page);
    const { at } = await h.planFrame(page);
    const [x, y] = at(0, -20);

    const who = await page.evaluate(([cx, cy]) => {
      const el = document.elementFromPoint(cx, cy);
      return el ? (el.id || el.tagName) : null;
    }, [x, y]);
    expect(who, 'the press on the top wall reaches the canvas, not a bar')
      .toBe('plan');

    await page.mouse.click(x, y);
    await page.waitForTimeout(150);
    // SELECTED, not merely "the click landed". The readout names the
    // selection, so a press that reached the canvas but grabbed nothing is
    // still a failure here.
    await expect(page.locator('#readout')).toContainText('selected', { timeout: 3000 });
  });

test('a seat thumbnail is NOT inset — the bars are not over an 82x54 canvas',
  async ({ page }) => {
    // THE OTHER HALF OF THE GATE. paintPlanThumb borrows fit() to frame a
    // level into an offscreen seat, and no bar is over THAT, so insetting it
    // would shrink every thumbnail by a band which is not there.
    //
    // TWO WRONG VERSIONS OF THIS CHECK CAME FIRST, and both are worth the
    // lines because each looked exactly like a passing check:
    //
    //  1. Measure the seat's ink once, assert it is over 2%. It passed with
    //     the thumbTarget gate DELETED. chromeInsets has a second guard which
    //     refuses the inset when the bars would eat 60% of the canvas, and a
    //     seat is 54 css px against 86px of bars, so that guard fires first
    //     and returns zero either way. The gate was never being exercised.
    //  2. Shrink the bars below the 60% guard, repaint, compare. It passed
    //     with the gate deleted too — because seats repaint on a modelEpoch
    //     bump and nothing in that version bumped it. The two captures were
    //     the same bytes because they were the SAME PAINT.
    //
    // So the bars have to be small BEFORE the first paint, which means a
    // second page load rather than a restyle. Under the real code a seat is
    // independent of the bars and the two loads agree to the pixel; with the
    // gate removed the seat is inset by 12 of its 54 pixels and the picture
    // changes.
    //
    // The gate stays even though the 60% guard covers today's seat size: it is
    // the one that states the intent, and a seat grown past ~143px tall would
    // slip under the guard and start being framed around bars that are
    // nowhere near it.
    const readInk = () => page.evaluate(() => {
      const cs = [...document.querySelectorAll('.seat canvas')];
      return cs.map(c => {
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 8) n++;
        return n;
      });
    });

    // ONE SEAT PER FRAME, so the rail is not finished when the drawing is.
    // My first attempt at this comparison read the seats straight after load
    // and got [.., 0, ..] on one load and [.., 2226, ..] on the other -- an
    // elevation that had not had its frame yet, which reads EXACTLY like an
    // inset shrinking a thumbnail. Capturing a canvas mid-paint has already
    // cost this branch one wrong diagnosis; it is not doing it twice.
    //
    // Two signals, because either alone can lie: the page's own `rail N ms`
    // goes non-zero when a pass COMPLETES, and then the ink has to come back
    // the same twice running, in case an edit started a second pass.
    const seatInk = async () => {
      await expect(page.locator('#readout')).toContainText(/rail (?!0\.00)/,
        { timeout: 10000 });
      let prev = await readInk();
      for (let i = 0; i < 20; i++) {
        await page.waitForTimeout(120);
        const now = await readInk();
        if (now.length === prev.length && now.every((n, k) => n === prev[k])) return now;
        prev = now;
      }
      throw new Error('the seat rail never settled');
    };

    await openShort(page);
    await h.openRails(page);
    const tallBars = await seatInk();
    // NOT test.skip, and not a bare truthy check. A selector that quietly
    // matches nothing is the same defect as a threshold that quietly passes.
    expect(tallBars.length, 'there are seats to measure').toBeGreaterThan(0);
    expect(tallBars.some(n => n > 0), 'the seats carry the level').toBe(true);

    // SMALL FROM THE FIRST PAINT. 6px a side is well under the 60% guard, so
    // if the gate were gone the inset would apply and the seats would shrink.
    await page.addInitScript(() => {
      const put = () => {
        const st = document.createElement('style');
        st.textContent = '#strip{height:6px!important}'
          + '#house-strip{min-height:6px!important;height:6px!important}';
        document.head.appendChild(st);
      };
      if (document.head) put();
      else document.addEventListener('DOMContentLoaded', put);
    });
    await page.goto('/MODEL.html');
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
    await h.openRails(page);
    // The bars really are small on this load, or the comparison below is
    // comparing two identical situations and proving nothing.
    const bars = await barRects(page);
    expect(bars.strip.height, 'the instrument strip really did shrink')
      .toBeLessThan(12);
    const shortBars = await seatInk();

    expect(shortBars, 'the seats are the same pictures — no bar is over an '
      + 'offscreen canvas, so the bars\' heights are nothing to do with them')
      .toEqual(tallBars);
  });

// ── AND THE PRESENTATION IS NOT FRAMED AROUND THE BARS EITHER ────────────────
//
// wholePlanShot fits the plan and photographs the canvas for page two of the
// presentation (PRINTSCREEN). A canvas photograph contains canvas pixels; the
// two dark bars are DOM elements sitting ON TOP of the canvas, so they are not
// in the PNG and never were. Insetting that fit frames the printed plan around
// furniture that is not in the room, and the plan comes out smaller with a
// white band across the top and bottom of the sheet.
//
// Nothing in the printscreen spec can see it -- that file asserts page two
// differs from page one and that the pictures are daylight, neither of which
// changes -- and "the plan prints a bit smaller" is not a thing anyone spots
// by looking.
//
// MEASURED IN DARK INK, and the first version of this check was WRONG in a way
// worth keeping. It counted pixels with alpha above 8, which is every pixel:
// paint() opens with a fillRect over the whole canvas, so the capture is
// opaque corner to corner and the "span" was 100% of the height whatever the
// fit did. It passed with no gate at all. Counting pixels that merely DIFFER
// from the corner colour failed the same way for a different reason -- this
// fixture has no drawingOrigin, so the datum falls back to 0,0 and the grid
// draws across the whole sheet.
//
// The walls are the only dark thing in the picture. Luminance 240 is the
// ground and the grid; the wall ink sits at 32-64 with almost nothing between.
// So: rows containing a pixel under 64, top to bottom.
//
//     insets applied   walls span 76.4% of the page  (rows 87..636 of 720)
//     insets gated     walls span 86.7%              (rows 48..671 of 720)
//
// 86% is what fit()'s own margin is for. A tenth of the sheet was going to
// white bands.
test('the printed whole-plan page is not letterboxed by bars that are not in the picture',
  async ({ page }) => {
    await page.addInitScript(() => {
      window.__printCalls = 0;
      window.print = () => {
        window.__printCalls += 1;
        window.__printedHtml = document.getElementById('presentation')?.outerHTML || '';
      };
    });
    // THE ORDINARY VIEWPORT, not the short one the reach checks use. At
    // 1280x720 the reach bug was five pixels and arguable; the same insets
    // take a tenth of the printed page, which is a separate consequence
    // rather than the same one restated.
    await page.setViewportSize({ width: 1280, height: 720 });
    await h.openModel(page, { webgl: false });
    await page.evaluate(async ({ bucket, f }) => {
      await window.SharedFileStore.saveSharedFile(
        new File([JSON.stringify(f)], 'drawing.json',
          { type: 'application/json' }), bucket);
    }, { bucket: BUCKET, f: plan });
    await page.goto('/MODEL.html');
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });

    await page.locator('#printscreen').click();
    await expect.poll(() => page.evaluate(() => window.__printCalls || 0))
      .toBeGreaterThan(0);

    const span = await page.evaluate(() => new Promise((done, fail) => {
      const doc = new DOMParser().parseFromString(window.__printedHtml, 'text/html');
      const srcs = [...doc.querySelectorAll('.pres-art img')]
        .map(i => i.getAttribute('src'));
      if (srcs.length < 2) { fail(new Error('no page-two picture to measure')); return; }
      const img = new Image();
      img.onload = () => {
        const pad = document.createElement('canvas');
        pad.width = img.width; pad.height = img.height;
        const pen = pad.getContext('2d');
        pen.drawImage(img, 0, 0);
        const { data } = pen.getImageData(0, 0, img.width, img.height);
        let top = -1, bot = -1, dark = 0;
        for (let y = 0; y < img.height; y++) {
          let ink = false;
          for (let x = 0; x < img.width; x++) {
            const i = (y * img.width + x) * 4;
            const L = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            if (L < 64) { ink = true; dark++; }
          }
          if (ink) { if (top < 0) top = y; bot = y; }
        }
        done({ top, bot, dark, h: img.height,
          frac: top < 0 ? 0 : (bot - top + 1) / img.height });
      };
      img.src = srcs[1];                       // page 2: the whole plan
    }));

    // The picture has walls in it at all -- a blank capture would otherwise
    // report a span of 0 and sail past a "greater than" line.
    expect(span.dark, 'the printed page carries wall ink').toBeGreaterThan(500);
    // 0.86 is what an uninset fit gives; insetting drops it to 0.76. The line
    // sits between the two and near neither.
    expect(span.frac, `the plan fills ${(span.frac * 100).toFixed(1)}% of the `
      + `printed page's height (rows ${span.top}..${span.bot} of ${span.h}); `
      + 'uninset gives 86.7%, insetting gives 76.4%')
      .toBeGreaterThan(0.82);
  });
