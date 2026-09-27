// THE RUBBER BAND ON THE WALL TOOL — the line that shows where the wall goes.
//
// Movie, 27 Sep: *"after the first point for wall is made a dotted line should
// show the line position as the user moves the cursor so the user can see where
// it will go when he pressed the button"*, and in the same breath, about the
// readout that was already there: *"i like the length showing there right by
// the cursor good idea"*.
//
// THOSE TWO SENTENCES TOGETHER ARE THE DIAGNOSIS. The length by the cursor is a
// DOM label and syncDrawLength runs on every pointermove; the band is CANVAS and
// paint() did not. So the page was telling him a live number about a line it
// never drew — which is the worst version of the defect, because the number
// moving is what proves the page is listening.
//
// ── WHY THIS SUITE IS A PIXEL SUITE, WHEN ALMOST NOTHING ELSE HERE IS ────────
//
// There is no record to read. A band is the one mark on this canvas that will
// never be in the drawing, so `stored()` cannot answer a single question in
// this file and neither can the readout. The only witness is the sheet.
//
// AND THE CHECK IS A MOVE, NOT A LOOK. "A band is drawn" was true of the floor
// and cut tools all along and they were still broken: painted once, then frozen
// until some unrelated repaint happened along. So every check here samples the
// SAME TWO PIXELS at two cursor positions and asserts BOTH answers change — ink
// arrives where the cursor now points AND leaves where it used to. A check that
// only looked for ink at the second position passes on a page whose band is
// nailed to the first press, which is the bug.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
const MAIN_FL = 3;

// A house well clear of where the band will be drawn. The band runs from the
// origin out to the east and to the south, and the walls stand at ±14 — so a
// pixel that changes inside the band's reach changed because of the band, and
// not because a committed wall happens to cross there.
const base = extra => ({
  version: 1,
  levels: [{ id: 1, name: 'FOUNDATION', elev: -8 }, { id: MAIN_FL, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 1,
  board: 'drafting',
  walls: [
    ['n', V(-14, -14), V(14, -14)], ['e', V(14, -14), V(14, 14)],
    ['s', V(14, 14), V(-14, 14)], ['w', V(-14, 14), V(-14, -14)],
  ].map(([id, start, end]) => ({ id, start, end, levelId: MAIN_FL, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' })),
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
  ...extra,
});

const readout = page => page.locator('#readout');

async function open(page, { file = base({}), view = 'plan' } = {}) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  // ?left=1 for the tool column — the rail key is how WALL is armed here.
  await page.goto(`/MODEL.html?level=${MAIN_FL}&view=${view}&left=1`);
  await expect(readout(page)).toContainText('walls', { timeout: 10000 });
  await expect(page.locator('[data-tool-key="wall"]')).toBeVisible();
}

const armWall = page => page.locator('[data-tool-key="wall"]').click();

// ONE PIXEL, READ OFF THE CANVAS BUFFER rather than off a screenshot: the
// buffer is device pixels and the canvas is scaled by dpr, so the same world
// point has to go through the same factor the painter used.
//
// A 3x3 BLOCK, NOT A SINGLE PIXEL, and that is not slack. A dashed line has
// GAPS in it by construction — 6 on, 4 off — so a single pixel on the band's
// path is ink or paper depending on where in the dash it fell, which would make
// this whole suite a coin toss. The block is smaller than the dash period, so
// it cannot span two gaps, and the ghost body under the dash means an on-band
// block is never bare paper even mid-gap.
const inkAt = (page, cx, cy) => page.evaluate(({ x, y }) => {
  const canvas = document.getElementById('plan');
  const box = canvas.getBoundingClientRect();
  const dpr = canvas.width / box.width;
  const px = Math.round((x - box.x) * dpr);
  const py = Math.round((y - box.y) * dpr);
  const { data } = canvas.getContext('2d').getImageData(px - 1, py - 1, 3, 3);
  // The page's own ground, sampled from a corner the drawing never reaches, so
  // "changed" is measured against what this skin actually paints rather than
  // against a colour this file guessed at.
  const g = canvas.getContext('2d').getImageData(2, 2, 1, 1).data;
  let worst = 0;
  for (let i = 0; i < data.length; i += 4) {
    worst = Math.max(worst, Math.abs(data[i] - g[0])
      + Math.abs(data[i + 1] - g[1]) + Math.abs(data[i + 2] - g[2]));
  }
  return worst;
}, { x: cx, y: cy });

// THE THRESHOLDS, MEASURED RATHER THAN PICKED, on the page's own night skin at
// its opening zoom (17.1 px/ft against this fixture):
//
//   bare paper, clear of everything ........   3 –   7
//   the grid line along the drawn axis .....  17 –  23
//   the wall band, ghost body and dash ..... 239 – 376
//   the floor trace's edge ................. 187 – 291
//   the floor trace's WASH .................  30, flat
//
// So 30 separates the wall's band from the grid by a factor of ten in each
// direction — and is exactly the floor's wash, which is why the floor check
// below carries its own number instead of this one. Both are stated here
// together because the difference between them IS the reason there are two:
// the wall's ghost is a body and the floor's is a tint.
const INK = 30;
// ABOVE THE WASH, BELOW THE EDGE. The floor's trace has no solid body under it
// the way the wall's ghost does, so "inked" there has to mean the EDGE and not
// the tint the edge encloses.
const TRACE_INK = 120;

// THE MOST INK ALONG A RUN, which is how a DASHED line has to be read. A block
// on a 6-on-4-off dash is paper roughly one time in ten — measured: one of
// fourteen samples along the floor's band came back at the wash. Asking a
// single point whether a dashed line is there is a coin toss weighted 9:1, and
// a suite that fails one run in ten is a suite that gets its failures ignored.
// The wall's band needs none of this (its ghost body fills the gaps), which is
// itself worth knowing: it is why the ghost is not just a tidier centreline.
const maxInkAlong = async (page, f, [ax, az], [bx, bz]) => {
  let worst = 0;
  for (let t = 0.25; t <= 0.75 + 1e-9; t += 0.0625) {
    const [px, py] = f.at(ax + (bx - ax) * t, az + (bz - az) * t);
    worst = Math.max(worst, await inkAt(page, px, py));
  }
  return worst;
};

test.describe('MODEL.html — the wall in hand', () => {
  test('the band follows the cursor, and leaves where the cursor left',
    async ({ page }) => {
      await open(page);
      await armWall(page);

      const f = await h.planFrame(page);
      // THE ANCHOR AT THE ORIGIN, then two aims a right angle apart: east and
      // south. A right angle is deliberate — two aims along the same bearing
      // would share most of their band, and a check that cannot tell the two
      // bands apart cannot tell a moving band from a frozen one.
      const [ax, ay] = f.at(0, 0);
      await page.mouse.move(ax, ay);
      await page.mouse.click(ax, ay);
      await expect(page.locator('#strip-message')).toContainText('second point');

      const [ex, ey] = f.at(9, 0);      // the east aim
      const [sx, sy] = f.at(0, 9);      // the south aim
      // The two sample points: halfway along each band, so neither sits under
      // the anchor ring (which is drawn at the origin whatever the cursor does,
      // and would report ink for both aims).
      const [eSampleX, eSampleY] = f.at(4.5, 0);
      const [sSampleX, sSampleY] = f.at(0, 4.5);

      await page.mouse.move(ex, ey);
      await page.waitForTimeout(60);
      const eastAimed = {
        onEast: await inkAt(page, eSampleX, eSampleY),
        onSouth: await inkAt(page, sSampleX, sSampleY),
      };

      await page.mouse.move(sx, sy);
      await page.waitForTimeout(60);
      const southAimed = {
        onEast: await inkAt(page, eSampleX, eSampleY),
        onSouth: await inkAt(page, sSampleX, sSampleY),
      };

      // ALL FOUR, AS ONE OBJECT, so a failure reads as a picture of what the
      // sheet did rather than as four separate near-misses.
      expect({
        eastBandWhileAimingEast: eastAimed.onEast > INK,
        southBandWhileAimingEast: southAimed.onSouth > INK,
        // THE TWO THAT CATCH A FROZEN BAND. Aiming east there must be nothing
        // on the south line, and once the cursor has gone south the east line
        // must be CLEAR again. A band painted once and never repainted fails
        // exactly here: both stay inked.
        southBandWhileAimingEastIsClear: eastAimed.onSouth <= INK,
        eastBandWhileAimingSouthIsClear: southAimed.onEast <= INK,
      }).toEqual({
        eastBandWhileAimingEast: true,
        southBandWhileAimingEast: true,
        southBandWhileAimingEastIsClear: true,
        eastBandWhileAimingSouthIsClear: true,
      });

      // AND NOTHING WAS COMMITTED BY LOOKING. The band is a preview, and a
      // preview that quietly pushed a wall would pass every check above.
      expect(await readout(page).textContent()).toContain('walls 4/4');
    });

  test('the band goes out when the run does, and comes back on the next anchor',
    async ({ page }) => {
      await open(page);
      await armWall(page);

      const f = await h.planFrame(page);
      const [ax, ay] = f.at(0, 0);
      const [ex, ey] = f.at(9, 0);
      const [mx, my] = f.at(4.5, 0);

      await page.mouse.move(ax, ay);
      await page.mouse.click(ax, ay);
      await page.mouse.move(ex, ey);
      await page.waitForTimeout(60);
      const inHand = await inkAt(page, mx, my);

      // ESCAPE PUTS THE RUN DOWN. A band still on the sheet after the gesture
      // is over is the same fault as a length still in the readout, which the
      // strip's own note calls the one thing a drafter should never be able to
      // misread — worse here, because a line on a drawing reads as geometry.
      await page.keyboard.press('Escape');
      await page.waitForTimeout(60);
      const afterEscape = await inkAt(page, mx, my);

      expect({ inHand: inHand > INK, afterEscape: afterEscape > INK })
        .toEqual({ inHand: true, afterEscape: false });
    });

  test('the band lands where the wall lands — the T-square squares both',
    async ({ page }) => {
      await open(page);
      await armWall(page);
      // THE T-SQUARE IS THE SHARPEST TEST OF THE BAND'S FAR END, because it is
      // the one instrument that makes the cursor and the commit DIFFERENT
      // points. Aim off-axis with it lit and the wall goes to the axis; a band
      // drawn to the raw cursor would show a diagonal and then build a
      // straight wall, and the drafter aims by the line.
      await page.locator('[data-mode-tsquare]').click();

      const f = await h.planFrame(page);
      const [ax, ay] = f.at(0, 0);
      await page.mouse.move(ax, ay);
      await page.mouse.click(ax, ay);

      // 9 east, 2 south: mostly along x, so the square fixes z and the run
      // goes straight east. Two feet is enough to miss by and not so much that
      // the square picks the other axis.
      const [ox, oy] = f.at(9, 2);
      await page.mouse.move(ox, oy);
      await page.waitForTimeout(60);

      const onAxis = await inkAt(page, ...f.at(4.5, 0));
      const onRawAim = await inkAt(page, ...f.at(4.5, 1));

      expect({ squaredBandIsDrawn: onAxis > INK, rawAimIsBare: onRawAim <= INK })
        .toEqual({ squaredBandIsDrawn: true, rawAimIsBare: true });
    });

  // ── THE GHOST IS THE WALL, MEASURED AGAINST THE WALL ─────────────────────
  //
  // The band could have been three lines: a dashed centreline and nothing
  // else. It is not, and this is the check that makes that a claim rather than
  // a preference. The ghost goes through drawWallSeg2D with the assembly and
  // the reference line the COMMIT will use, so it has the wall's real WIDTH
  // and sits on the real SIDE of the drawn line -- which for a drafter aiming
  // an 11¼" ICF at an existing corner is the whole question. A centreline
  // preview would put the wall up to a foot from where the line said.
  //
  // COMPARED AGAINST THE PAGE ITSELF, not against a thickness this file
  // computed. Asking what stud_2x6's totalIn is and then checking the page
  // used it would be this suite grading its own arithmetic -- and worse, it
  // would be SCALE-BOUND, which is the expectation that cost the last branch
  // two CI shards. So the profile of the PREVIEW is measured across the band,
  // then the very same wall is committed and the SAME profile measured again.
  // Two paintings of one wall, and the only claim is that they cover the same
  // ground. It holds at any zoom, on either skin, for every assembly.
  test('the ghost covers the same ground the committed wall covers',
    async ({ page }) => {
      await open(page);
      await armWall(page);
      const f = await h.planFrame(page);
      const [ax, ay] = f.at(0, 0);
      const [ex, ey] = f.at(9, 0);

      // A CUT ACROSS THE RUN, a foot and a half either side of the drawn line
      // in tenth-foot steps. Wide enough to contain the thickest assembly the
      // page offers (13¼") with clear paper showing on both sides, so the
      // measurement is an INTERVAL inside the cut rather than a count that
      // could be clipped by the cut's own ends.
      const STEP = 0.1;
      const SPAN = 1.5;
      const profile = async () => {
        const out = [];
        for (let z = -SPAN; z <= SPAN + 1e-9; z += STEP) {
          const [px, py] = f.at(4.5, Number(z.toFixed(4)));
          out.push(await inkAt(page, px, py) > INK);
        }
        // FIRST AND LAST INKED, not the raw list. The committed wall is drawn
        // at full alpha with 1.5px edges and the ghost at 0.45 with 1px, so a
        // pixel exactly on an edge can fall either side of the gate on one and
        // not the other. The EXTENT is the claim; the crispness is not.
        return { from: out.indexOf(true), to: out.lastIndexOf(true) };
      };

      await page.mouse.move(ax, ay);
      await page.mouse.click(ax, ay);
      await page.mouse.move(ex, ey);
      await page.waitForTimeout(60);
      const ghost = await profile();

      // PUT THE RUN DOWN, then draw the same wall for real. Escape after the
      // commit too: it clears the chain's anchor and the selection the commit
      // makes, both of which paint marks of their own that would land in the
      // cut and be read as the wall.
      await page.keyboard.press('Escape');
      await page.mouse.move(ax, ay);
      await page.mouse.click(ax, ay);
      await page.mouse.move(ex, ey);
      await page.mouse.click(ex, ey);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(60);
      expect(await readout(page).textContent()).toContain('walls 5/5');
      const built = await profile();

      // WITHIN ONE STEP, which is a tenth of a foot -- a fifth of a 2×6's own
      // thickness. A ghost drawn on the wrong side of the line misses by a
      // WHOLE thickness and a ghost drawn as a bare centreline has almost no
      // extent at all, so the tolerance has an order of magnitude of air under
      // both failures it is there to catch.
      expect(ghost.from, 'the ghost is drawn at all').toBeGreaterThanOrEqual(0);
      expect(Math.abs(ghost.from - built.from),
        `ghost starts at ${ghost.from}, the wall at ${built.from}`).toBeLessThanOrEqual(1);
      expect(Math.abs(ghost.to - built.to),
        `ghost ends at ${ghost.to}, the wall at ${built.to}`).toBeLessThanOrEqual(1);
    });

  // ── AND THE FOUR TOOLS THAT ALREADY HAD A BAND ───────────────────────────
  //
  // THE WALL WAS NOT THE ONLY ONE FROZEN, and that is the part of this work
  // Movie could not have seen. The floor, the outline, the cut and the ruler
  // all painted a mark that reads the cursor, correctly, inside paint() -- and
  // paint() is not what runs on a pointermove. They tracked the cursor only
  // when a repaint happened along for some unrelated reason, which on this page
  // means crossing a corner's grab zone. So all four have been stuttering since
  // the day they were built.
  //
  // THE FIX IS ONE GATE FOR ALL FIVE (previewTracksCursor), and this check is
  // what keeps that true. Without it, narrowing the gate to the wall alone --
  // which is all Movie asked for -- passes every check above and leaves the
  // other four exactly as broken as they were. The FLOOR stands for the four:
  // it is the one whose trace a drafter watches for the longest, four presses
  // or more, and it is the one where a frozen band is most easily read as the
  // press not landing.
  test('the floor trace follows the cursor too — the gate is shared',
    async ({ page }) => {
      // THE FLOOR VIEW, because that is the layer set FLOOR draws on. Its own
      // suite opens the same way.
      await open(page, { view: 'floor' });
      await page.locator('[data-tool-key="floor"]').click();

      // TWO CORNERS DOWN, not one, and that is drawFloor2D's rule rather than a
      // preference: under three points it returns before drawing an edge at
      // all, so one placed corner plus the cursor gives nothing to read.
      await page.mouse.click(...(await h.planFrame(page)).at(0, 0));
      await page.waitForTimeout(60);
      const f = await h.planFrame(page);
      await page.mouse.click(...f.at(0, -9));
      await page.waitForTimeout(60);

      // AIM EAST, THEN WEST, so the band from the second corner to the cursor
      // swings across the placed edge. The run sampled is that band, which is
      // the mark that MOVES; the wash it encloses is measured by nobody here,
      // because at 30 it is the threshold rather than a signal.
      const eastBand = [[0, -9], [9, -4.5]];
      const westBand = [[0, -9], [-9, -4.5]];

      await page.mouse.move(...f.at(9, -4.5));
      await page.waitForTimeout(60);
      const aimedEast = { east: await maxInkAlong(page, f, ...eastBand),
        west: await maxInkAlong(page, f, ...westBand) };

      await page.mouse.move(...f.at(-9, -4.5));
      await page.waitForTimeout(60);
      const aimedWest = { east: await maxInkAlong(page, f, ...eastBand),
        west: await maxInkAlong(page, f, ...westBand) };

      expect({
        bandRunsEastWhenAimedEast: aimedEast.east > TRACE_INK,
        bandRunsWestWhenAimedWest: aimedWest.west > TRACE_INK,
        eastClearsWhenTheCursorLeaves: aimedWest.east <= TRACE_INK,
      }).toEqual({
        bandRunsEastWhenAimedEast: true,
        bandRunsWestWhenAimedWest: true,
        eastClearsWhenTheCursorLeaves: true,
      });
    });
});
