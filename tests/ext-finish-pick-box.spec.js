// THE BOX ROUND A FACE MUST SIT WHERE THE CLADDING DOES.
//
// Movie, 27 Sep, twice, with screenshots: *"the main floor and garage should
// go down to the bottom of sill plate and 2nd floor should go to main fl
// ceiling line"* — and then, after I measured the paint and said it already
// did, *"doesn't seem to do it yet"*.
//
// HE WAS RIGHT AND SO WAS THE MEASUREMENT. The cladding was painted correctly
// the whole time. What was wrong was the dashed box this page draws round the
// face you click, which had its own arithmetic for where a wall starts:
//
//     EXTFINISH  wallFootFt = level.floorTop + baseHeight     the FINISHED FLOOR
//     cut-view   faceLines  = level.floorBottom - sillPlate   the BOTTOM OF THE PLATE
//
// Measured on repro-garage-house, E1: the box sat 1'-2 1/8" high on MAIN FL
// and 1'-0 5/8" high on 2ND FL. A drafter has no way to tell a wrong box from
// wrong paint — so he reported the paint, and every check I had agreed with
// the paint, and the disagreement went on being invisible.
//
// ── WHY THIS IS MEASURED IN PIXELS ──────────────────────────────────────────
//
// Both things under test end up as marks on ONE canvas: the finish is a box
// handed to DraftFinishPatterns.drawFinish, the outline is a ctx.strokeRect.
// Comparing them there needs no elevation datum, no feet, no framing
// arithmetic and no number this file computed — which matters, because a
// check that recomputes the rule is a check that can agree with a wrong rule.
// It asks only: does the line land where the paint stops?
//
// THE OLD BUG PUTS THIS 1'-2 1/8" APART, which at the page's own scale is
// tens of pixels — far outside the 2px the comparison allows for stroke width.
// ── WHAT THIS CHECKS, AND WHAT IT DELIBERATELY CANNOT ───────────────────────
//
// THE BOX AND THE PAINT NOW READ ONE FUNCTION -- cut-view's faceSillFt -- so
// a mutation of the RULE moves both together and this file stays green. That
// is the point rather than a hole in it: this asks "does the line land where
// the paint stops", and two things reading one number cannot disagree.
//
// WHERE THE RULE ITSELF IS CHECKED IS proto/elevation-harness.js, against the
// painted boxes: 'the cladding runs down to the bottom of the sill plate' and
// 'the storey above clads from the CEILING BELOW'. Four mutants, two
// instruments, and each pair is invisible to the other file:
//
//     the box goes back to the finished floor (THE BUG)   killed HERE
//     the head goes back to the wall's own top            killed HERE
//     no plate deducted on MAIN FL                        killed by the harness
//     a plate deducted on EVERY floor                     killed by the harness
//
// Reading the two survivors here as a gap and "fixing" them would mean
// recomputing the rule in this file -- which is the duplicate that caused the
// bug in the first place.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-garage-house.draft'), 'utf8'));

// ONE WALL CLAD AT A TIME, which is what makes the comparison unambiguous:
// with several clad there is no way to say which painted box belongs to the
// face that was clicked, and "the lowest box on the sheet" would quietly be
// answering about a different wall — the same mistake the cladding-start
// harness check made and had to be fixed for.
async function openWith(page, pick) {
  await h.suppressEntryCoach(page);
  await page.goto('/EXTFINISH.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 15000 });
  await page.evaluate(async ({ bucket, file, which }) => {
    const d = JSON.parse(JSON.stringify(file));
    // OFF env.floorLevels(), NOT OFF THE WALLS' OWN levelIds. `levelId > 0`
    // still admits the FOUNDATION -- its walls are a view, not a body -- so
    // sorting them handed back level 1 as "the main floor". Every fixture
    // change below then landed on the concrete, and the checks passed anyway
    // because an unclad wall still paints the whole-wall default. Two checks
    // green for the wrong reason, found by a mutant that should have died and
    // did not.
    const framed = window.DraftCutViewEnv.buildCutViewEnv(d, d.levels)
      .floorLevels().map(l => Number(l.id));
    const on = id => d.walls.filter(w => Number(w.levelId) === id && !w.body);
    const levels = framed;
    const wanted = which === 'main' || which === 'short' ? on(levels[0])
      : which === 'upper' ? on(levels[1])
        : d.walls.filter(w => !!w.body);
    wanted.forEach(w => { w.finish = 'brick'; });
    // A WALL SHORTER THAN ITS STOREY, for the head check below. Nothing else
    // uses it, and no other fixture in the repo has one.
    if (which === 'short') on(levels[0]).forEach(w => { w.topHeight = 6; });
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(d)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, file: REPRO, which: pick });
  await page.goto('/EXTFINISH.html');
  await page.waitForSelector('#elev-list [data-elev]', { timeout: 15000 });
  await page.waitForTimeout(300);
}

// Record what the painter was asked to fill, and what the page stroked. The
// pick mark is the LAST strokeRect of a repaint — paintElevation ends with
// `if (picked) paintPickMark(ctx)` — so the recorder is cleared immediately
// before the click and the last entry read after it.
const armRecorders = page => page.evaluate(() => {
  const canvas = document.getElementById('elev');
  const ctx = canvas.getContext('2d');
  window.__finishBoxes = [];
  window.__rects = [];
  const FP = window.DraftFinishPatterns;
  const realDraw = FP.drawFinish;
  window.DraftFinishPatterns = { ...FP,
    drawFinish: (c, box, finish, inks) => {
      window.__finishBoxes.push({ id: finish && finish.id, x0: box.x0, x1: box.x1,
        yTop: box.yTop, yBottom: box.yBottom });
      return realDraw(c, box, finish, inks);
    } };
  const realRect = ctx.strokeRect.bind(ctx);
  ctx.strokeRect = (x, y, w, hh) => { window.__rects.push({ x, y, w, h: hh }); return realRect(x, y, w, hh); };
});

async function clickFaceAndCompare(page, fx, fy) {
  await armRecorders(page);
  const box = await page.locator('#elev').boundingBox();
  await page.evaluate(() => { window.__finishBoxes = []; window.__rects = []; });
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
  await page.waitForTimeout(200);
  return page.evaluate(() => {
    const rect = window.__rects[window.__rects.length - 1] || null;
    // WHICH PAINTED BOX BELONGS TO THE FACE THAT WAS CLICKED, and this took
    // two goes. EVERY face paints -- an unclad wall still takes the whole-wall
    // default, which is Stucco -- so cladding one wall isolates nothing, and
    // "the lowest box in this x-range" read the MAIN FL paint underneath a
    // 2ND FL box and reported the two storeys 151px apart.
    //
    // MATCHED BY VERTICAL OVERLAP, WHICH IS NOT THE SAME AS MATCHING BY THE
    // ANSWER. The storeys are ~150px apart on the sheet and a face is ~90px
    // tall, so overlap picks the right storey outright. It stays a real check
    // because the OLD bug moved the box only ~30px within its own storey: the
    // box still overlapped its own face far more than its neighbour's, so this
    // would have matched the same face and then caught the gap.
    const boxes = window.__finishBoxes;
    if (!rect || !boxes.length) return { rect, boxes: boxes.length };
    const mid = rect.x + rect.w / 2;
    const overlap = b => Math.max(0,
      Math.min(rect.y + rect.h, b.yBottom) - Math.max(rect.y, b.yTop));
    const mine = boxes.filter(b => b.x0 - 2 <= mid && mid <= b.x1 + 2)
      .sort((a, b) => overlap(b) - overlap(a))[0] || null;
    return { rectBottom: rect ? rect.y + rect.h : null,
      rectTop: rect ? rect.y : null,
      paintBottom: mine ? mine.yBottom : null,
      paintTop: mine ? mine.yTop : null,
      status: document.getElementById('status').textContent };
  });
}

test.describe('EXT. FINISH — the pick box sits on the cladding', () => {
  test('MAIN FL: the box bottom is where the brick stops', async ({ page }) => {
    await openWith(page, 'main');
    const m = await clickFaceAndCompare(page, 0.5, 0.62);
    expect(m.status, 'a wall was picked').toMatch(/ft on E1/);
    expect(m.paintBottom, 'the clad face painted under the click').not.toBeNull();
    // 2px for the stroke's own width. The bug this replaces was tens of pixels.
    expect(Math.abs(m.rectBottom - m.paintBottom),
      `box bottom ${m.rectBottom}px vs cladding bottom ${m.paintBottom}px`)
      .toBeLessThan(2);
  });

  test('2ND FL: and there too, on the storey with no sill plate under it',
    async ({ page }) => {
      // THE SECOND HALF OF MOVIE'S RULE — *"2nd floor should go to main fl
      // ceiling line"* — and a different branch of the same expression: an
      // upper storey takes its own floorBottom with NO plate deducted, which
      // is exactly the ceiling line of the storey below. A check on MAIN FL
      // alone passes on a painter that deducts a plate from every floor.
      await openWith(page, 'upper');
      const m = await clickFaceAndCompare(page, 0.5, 0.38);
      expect(m.status, 'a wall was picked').toMatch(/ft on E1/);
      expect(m.paintBottom, 'the clad face painted under the click').not.toBeNull();
      expect(Math.abs(m.rectBottom - m.paintBottom),
        `box bottom ${m.rectBottom}px vs cladding bottom ${m.paintBottom}px`)
        .toBeLessThan(2);
    });

  test('the box TOP follows the cladding too, on a wall shorter than its storey',
    async ({ page }) => {
      // MUTATION ASKED FOR THIS ONE. The head was changed from the wall's own
      // top (`floorTop + topHeight`) to the storey's plate (`level.wallTop`)
      // because the painter clads to the plate -- and putting the old formula
      // back killed nothing, because every wall in every fixture in this repo
      // is exactly as tall as its storey. The two agreed by coincidence, which
      // is the same trap as the foot: one fixture away from being found.
      //
      // So this fixture makes one wall 6 ft in an 8'-1 1/8" storey. The
      // painter's face still reaches the plate; the box must follow the PAINT
      // rather than the wall's own number. That is the whole claim of this
      // change -- the outline reports what was drawn, not what it recomputes.
      await openWith(page, 'short');
      const m = await clickFaceAndCompare(page, 0.5, 0.62);
      expect(m.status, 'a wall was picked').toMatch(/ft on E1/);
      expect(m.paintTop, 'the clad face painted under the click').not.toBeNull();
      expect(Math.abs(m.rectTop - m.paintTop),
        `box top ${m.rectTop}px vs cladding top ${m.paintTop}px`)
        .toBeLessThan(2);
    });

  test('and the two storeys are not the same line, so neither check is empty',
    async ({ page }) => {
      // WITHOUT THIS, both checks above could pass on a page that drew every
      // box and every finish at one height. They are only two checks if the
      // two answers differ.
      await openWith(page, 'main');
      const lower = await clickFaceAndCompare(page, 0.5, 0.62);
      await openWith(page, 'upper');
      const upper = await clickFaceAndCompare(page, 0.5, 0.38);
      expect(Math.abs(lower.rectBottom - upper.rectBottom),
        'the two storeys sit at different heights on the sheet')
        .toBeGreaterThan(20);
    });
});
