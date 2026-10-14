// A HALF FLOOR IS PART OF ITS STOREY'S CARD, NOT A CARD OF ITS OWN.
//
// Movie, 14 Oct: "in the layout viewports, let show all the info in the 2nd
// floor from both 1.5 and 2nd fl and then DON'T show the 1.5 layout view at
// all in the layout menu on right side, and also do the same thing with the
// 0.5 and 1st floor and if there are any 3rd floors added in the future i
// will also want to present it that way for all the layouts, when a user
// scrolls down to the text area they will see the 1.5 floor and 0.5 floors.
// i may want to to allow the user to click on that 'floor level' and then go
// into that level to edit the floor or whatever they need to edit on that
// level" -- and, asked how the folded-in half should read against its full
// floor, "Distinct, lighter or tagged".
//
// THE SHEETS ALREADY DID THIS. LAYOUT deals 2ND FL one sheet with the 1.5
// floor drawn lighter on it (layout-plan's ridesOnFullFloor, pinned offline
// in proto/layout-plan-harness.js); it was the PREVIEW RAIL that still seated
// four cards for the pair, so the two disagreed about how many drawings a
// split house has. Every check below is about the rail and the list beneath
// it; none re-asks what the harness already pins about the sheets.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const BUNGALOW = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'perf-bungalow.draft'), 'utf8'));
const ENTRY = { id: 2, name: 'ENTRY', elev: -4 };
const HALF = 2;
const MAIN = 3;

// THE HALF FLOOR STANDS CLEAR OF ITS FULL FLOOR, 30 ft east. That is not
// decoration: a 1.5 floor over a garage reaches past the storey's own walls,
// and a thumbnail framed on the full floor alone would crop exactly the part
// the fold exists to show. Drawn on top of MAIN FL there would be nothing to
// measure either way.
const asideWalls = (BUNGALOW.walls || []).filter(w => w.levelId === MAIN)
  .map((w, i) => ({ ...w, id: 81000 + i, levelId: HALF,
    start: { ...w.start, x: (w.start?.x || 0) + 30 },
    end: { ...w.end, x: (w.end?.x || 0) + 30 } }));
const SPLIT = {
  ...BUNGALOW,
  levels: [...BUNGALOW.levels, ENTRY],
  walls: [...(BUNGALOW.walls || []), ...asideWalls],
};
// The same drawing with nothing on the half floor, which is the "before" for
// every ink count below.
const FLAT = { ...SPLIT, walls: (BUNGALOW.walls || []).slice() };

async function load(page, drawing, level = MAIN) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing });
  await page.goto(`/MODEL.html?level=${level}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  // The rail starts OPEN on the LEVELS pane (Movie, 10 Oct), so there is no
  // tab to press; the thumbnails land a frame or more after the page does,
  // one seat per frame, deliberately.
  await expect(page.locator('#view-rail')).toBeVisible();
  await page.waitForTimeout(600);
}

const seat = (page, id) => page.locator(`#view-rail .seat[data-seat="${id}"]`);

// WHAT A SEAT HAS ON IT, counted rather than looked at: every pixel of the
// 164x108 thumbnail that is not the paper it was cleared to.
const seatInk = (page, id) => page.evaluate(seatId => {
  const el = document.querySelector(`#view-rail .seat[data-seat="${seatId}"] canvas`);
  if (!el) return -1;
  const d = el.getContext('2d').getImageData(0, 0, el.width, el.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 8) n += 1;
  return n;
}, id);

test('the half floor takes no seat of its own, and its full floor still does',
  async ({ page }) => {
    await load(page, SPLIT);
    await expect(seat(page, `${MAIN}:plan`), 'MAIN FL lost its own card').toHaveCount(1);
    await expect(seat(page, `${MAIN}:floor`)).toHaveCount(1);
    // THE WHOLE OF THE COMPLAINT: four cards for one storey.
    await expect(seat(page, `${HALF}:plan`), 'the 0.5 floor still has a card').toHaveCount(0);
    await expect(seat(page, `${HALF}:floor`)).toHaveCount(0);
  });

test('but a half floor with no full floor drawn keeps its own', async ({ page }) => {
  // FOLDING IS NOT HIDING. With MAIN FL undrawn there is no card to fold
  // into, and a drafter working a level with no preview anywhere is the one
  // outcome this must not produce -- the same rule the sheet set follows.
  const lone = { ...SPLIT, walls: asideWalls.concat(
    (BUNGALOW.walls || []).filter(w => w.levelId !== MAIN)) };
  await load(page, lone, HALF);
  await expect(seat(page, `${HALF}:plan`), 'the lone half floor was folded away')
    .toHaveCount(1);
});

test('the storey\'s card says which half floor it is carrying', async ({ page }) => {
  await load(page, SPLIT);
  // "Distinct, lighter or tagged". Lighter alone cannot say WHOSE the faint
  // walls are, so the seat wears the storey number it has folded in -- 0.5,
  // off level-assembly's own ladder rather than spelled out here.
  await expect(seat(page, `${MAIN}:plan`)).toHaveAttribute('data-seat-fold', '0.5');
  await expect(seat(page, `${MAIN}:plan`).locator('.seat-fold')).toHaveText('+0.5');
  // AND ONLY WHEN THERE IS ONE. A tag over an empty level is a question a
  // drafter cannot answer.
  await load(page, FLAT);
  await expect(seat(page, `${MAIN}:plan`)).not.toHaveAttribute('data-seat-fold', /.*/);
});

test('and draws it, inside the frame rather than off the edge', async ({ page }) => {
  await load(page, FLAT);
  const alone = await seatInk(page, `${MAIN}:plan`);
  expect(alone, 'MAIN FL\'s card drew nothing at all').toBeGreaterThan(50);
  await load(page, SPLIT);
  const folded = await seatInk(page, `${MAIN}:plan`);
  // MORE INK, because the half floor's walls are now on this card too.
  expect(folded, `${folded} ink against ${alone} with the half floor empty`)
    .toBeGreaterThan(alone + 50);

  // AND THE FRAME GREW TO HOLD IT. The half floor stands 30 ft east of the
  // house; a thumbnail still framed on MAIN FL alone would draw those walls
  // somewhere past the right edge of the canvas and lose them, so the test
  // is not "is there more ink" but "is there ink in the right-hand half".
  const rightHalf = await page.evaluate(seatId => {
    const el = document.querySelector(`#view-rail .seat[data-seat="${seatId}"] canvas`);
    const d = el.getContext('2d').getImageData(Math.floor(el.width / 2), 0,
      el.width - Math.floor(el.width / 2), el.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 8) n += 1;
    return n;
  }, `${MAIN}:plan`);
  expect(rightHalf, 'the half floor was drawn off the side of the card')
    .toBeGreaterThan(20);
});

test('the LEVELS list still carries it, and the name is still the way in',
  async ({ page }) => {
    await load(page, SPLIT);
    // "when a user scrolls down to the text area they will see the 1.5 floor
    // and 0.5 floors" -- the list below the rail is untouched by the fold.
    const row = page.locator(`[data-level-row="${HALF}"]`);
    await expect(row, 'the half floor left the levels list too').toHaveCount(1);
    // AND IT SAYS WHERE ITS PICTURE WENT. A level in this list with no card
    // in the rail above reads as something missing rather than folded.
    await expect(page.locator(`.lv-card[data-level="${HALF}"]`))
      .toHaveAttribute('data-rides-on', String(MAIN));
    await expect(page.locator(`.lv-card[data-level="${HALF}"] .lv-rides`))
      .toContainText('1 MAIN FL');

    // "i may want to to allow the user to click on that 'floor level' and
    // then go into that level to edit the floor".
    await row.click();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => new URL(location.href).searchParams.get('level')))
      .toBe(String(HALF));
    await expect(page.locator(`.lv-card[data-level="${HALF}"]`))
      .toHaveAttribute('data-active', '');
    // AND THE RAIL SAYS WHERE HE IS. With no card of its own, an unlit rail
    // would tell a drafter standing on the 0.5 floor that he is nowhere; the
    // card that is DRAWING that level is MAIN FL's, so that is the one lit.
    await expect(seat(page, `${MAIN}:plan`)).toHaveClass(/active/);
  });
