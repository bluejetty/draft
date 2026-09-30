// THE SELECTION BAND FOLLOWS A SKIN SWITCH THAT DOES NOT RELOAD THE PAGE.
//
// This is the check the trace roles were built for, and it was owed. When
// MODEL's nine trace and selection literals became palette roles, three of
// them were module-level `const`s -- SELECT_INK, SELECT_HANDLE and BAND_INK --
// and the careless conversion is to leave them consts reading `skin[...]` once
// at boot. The page re-applies the palette on a NIGHT/DAY press without
// reloading (:7022), so a captured value survives the switch and the selection
// alone stays on the old skin. Nothing in the suite showed that, because
// nothing in it switched skins with a band on screen: the reads were at call
// time by construction, and construction is not evidence.
//
// WHY THE BAND AND NOT THE TRACE. Three of the nine roles hold different
// values on night and day -- draw-trace-boneyard, draw-trace-garage-boneyard
// and draw-selected-all. Of the three former consts, only BAND_INK reads one
// of those three, through bandInk('window-all') -> draw-selected-all. So the
// ALL LEVELS band is the one place on this page where a freeze is VISIBLE.
//
// AND WHAT THIS STILL CANNOT SEE, said out loud rather than implied:
// selectInk() and selectHandle() read draw-selected, which is #5980a6 on both
// modes AND both themes. No live check can tell a captured const from a
// call-time read there, because there is no switch that would move the answer.
// They are covered by construction only. The day draw-selected differs from
// draw-selected-all on any axis, this file should grow a second leg.
//
// THE INSTRUMENT IS THE VALUE MODEL HANDS THE CANVAS, not a pixel, and that is
// a departure from this suite's rule worth defending. The band is a 1px dashed
// strokeRect, so every pixel it lays down is a BLEND of the band colour and
// the ground behind it -- and the ground moves with the skin too. A pixel read
// therefore cannot separate "the band followed the skin" from "the sheet did",
// which is the only question here. strokeRect appears exactly ONCE in
// MODEL.html, at :7415 inside paintBand, so every strokeRect on the plan
// context IS a band ink and the recording needs no filtering. It is scoped to
// the plan canvas's own context object, which is why a rail seat repainting
// through cut-view.js (which strokeRects plenty) cannot contaminate it.
// RED TWICE, EACH FOR A DIFFERENT REASON, because one red would not have been
// enough. A check that fails for the wrong reason is a check nobody has read.
//
//   1. MODEL.html with 88282b5 reverted -- the page as it was before the roles
//      landed, where BAND_INK was `{ 'window-all': '#b04050' }`, a literal and
//      not a role. RED on the night leg: #b04050 where #c86876 is wanted.
//      That is Devin's condition, and it proves the roles reached the band.
//      It does NOT prove anything about the freeze: it stops before the switch.
//
//   2. Current MODEL.html with `bandInk` mutated back into a captured const --
//      `const FROZEN_ALL = skin['draw-selected-all']` read once at module
//      level. The night leg PASSES (#c86876 is the right night value) and the
//      switch assertion is the one that goes RED. That is the freeze itself,
//      isolated, with the value question already answered.
//
// Neither red is reachable by the other, which is why both are recorded here.

const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';

// Hardcoded, for the reason NIGHT_GRID and DAY_GRID in model-html-skins are:
// reading these off palette.js and then checking the page used them would be a
// tautology. If palette.js moves draw-selected-all, this constant moves with
// it, and that is the point.
const NIGHT_ALL_LEVELS = '#c86876';
const DAY_ALL_LEVELS = '#b04050';

// SYMMETRIC ABOUT THE ORIGIN, the coordinate trap model-tool-select.spec.js
// wrote down: MODEL has no fixed scale, fit() centres on the midpoint of the
// drawn bounds, so a fixture that is not centred makes `screen centre is world
// (0,0)` false and every tap lands somewhere it did not mean to.
const V = (x, z) => ({ x, y: 0, z });
const WALL = 10;

const FIXTURE = {
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  walls: [
    ['w-n', V(-WALL, -WALL), V(WALL, -WALL)],
    ['w-e', V(WALL, -WALL), V(WALL, WALL)],
    ['w-s', V(WALL, WALL), V(-WALL, WALL)],
    ['w-w', V(-WALL, WALL), V(-WALL, -WALL)],
  ].map(([id, start, end]) => ({
    id, start, end, levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
  })),
  lines: [], floors: [],
  roofs: [], fenestrations: [], dimensions: [], outlines: [],
  shapes: [], surfaceOpenings: [], stairs: [], notes: [], roomTags: [],
  columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
  // STATED, NOT INHERITED. The page defaults to TOY, whose tool column puts
  // the selection chips away -- so every open() here would wait three minutes
  // on a button that is correctly absent.
  board: 'drafting',
};

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, file }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(file)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, file: FIXTURE });
  await page.goto('/MODEL.html?left=1&mode=night');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 15000 });
  await expect(page.locator('[data-sel-mode]').first()).toBeVisible();
}

// The plan canvas's own strokeRect, recording what strokeStyle was in force
// when MODEL called it. An own property on the context instance shadows the
// prototype method; getContext('2d') hands back the same object every time, so
// this survives as long as the page does -- which is the whole point, because
// the page must NOT be reloaded between the two readings.
async function recordBandInk(page) {
  await page.evaluate(() => {
    const ctx = document.getElementById('plan').getContext('2d');
    window.__bandInks = [];
    const real = CanvasRenderingContext2D.prototype.strokeRect;
    ctx.strokeRect = function (...args) {
      window.__bandInks.push(String(ctx.strokeStyle));
      return real.apply(this, args);
    };
  });
}

const at = async (page, x, z) => {
  const box = await page.locator('#plan').boundingBox();
  const scale = await page.evaluate(() => Number(
    /scale ([\d.]+) px\/ft/.exec(document.getElementById('readout').textContent)[1]));
  return [box.x + box.width / 2 + x * scale, box.y + box.height / 2 + z * scale];
};

// A PRESS, A MOVE, AND A READING WHILE THE BUTTON IS STILL DOWN. paintBand
// returns early unless bandDrag.active, so the band exists only between the
// press and the release -- a drag that completes first leaves nothing to read.
async function bandInkDuringDrag(page, from, to) {
  const a = await at(page, ...from);
  const b = await at(page, ...to);
  await page.evaluate(() => { window.__bandInks = []; });
  await page.mouse.move(...a);
  await page.mouse.down();
  // Past the 4px the band arms at, then to the corner, then a frame to paint.
  await page.mouse.move((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  await page.mouse.move(...b);
  await page.waitForTimeout(250);
  const inks = await page.evaluate(() => window.__bandInks.slice());
  await page.mouse.up();
  await page.waitForTimeout(100);
  return [...new Set(inks)];
}

test('the ALL LEVELS band follows a NIGHT to DAY switch without a reload',
  async ({ page }) => {
    await open(page);
    await recordBandInk(page);
    await page.locator('[data-sel-mode="window-all"]').click();

    const night = await bandInkDuringDrag(page, [-6, -6], [6, 6]);
    expect(night.length, 'no band was painted, so this proves nothing')
      .toBeGreaterThan(0);
    expect(night, 'the ALL LEVELS band is not the night draw-selected-all')
      .toEqual([NIGHT_ALL_LEVELS]);

    // THE SWITCH ITSELF, and it must be this and not a reload or an outside
    // call to DraftPalette.apply(). A reload lets a captured const re-evaluate
    // correctly and the test passes on the bug; apply() from here skips
    // MODEL's own onSkin callback, which is the code under test.
    await page.locator('[data-skin-mode="day"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'day');
    await page.waitForTimeout(500);

    const day = await bandInkDuringDrag(page, [-6, -6], [6, 6]);
    expect(day.length, 'the band went missing after the switch').toBeGreaterThan(0);

    // THE ASSERTION THAT SURVIVES A REPAINT OF THE PALETTE. A frozen value
    // cannot change, whatever hex it holds -- so this one goes red for any
    // freeze without naming a colour, and stays true if the two modes are
    // ever given different reds than these.
    expect(day, 'the band kept its night colour across the switch, which is '
      + 'the captured-const bug the roles exist to prevent').not.toEqual(night);
    expect(day, 'the ALL LEVELS band is not the day draw-selected-all')
      .toEqual([DAY_ALL_LEVELS]);
  });
