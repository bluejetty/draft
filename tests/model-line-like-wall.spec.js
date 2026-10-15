// LINE DRAWS THE WAY WALL DOES, AND THE PROTRACTOR HOLDS A RUN TO AN ANGLE.
//
// Movie, 5 Oct: "make the line act like the WALL everything the same WALL
// works good", then "can we press the protractor and enter a number into the
// ANGLE textbox and force the line to travel in that angle" -- "for LINE
// WALLS and other similar commands (Outline)" -- with "allow them to enter an
// angle but don't engage unless they light up the protractor", "when the
// protractor is lit the T square should be UNLIT" and "only ... if not in TOY
// mode".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3;
const EMPTY = {
  version: 1, planTurn: 0, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: MAIN_FL, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
};

async function open(page) {
  await page.goto('/MODEL.dc.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: EMPTY });
  await page.goto(`/MODEL.html?mode=night&level=${MAIN_FL}`);
  await expect(page.locator('#readout')).toContainText('scale', { timeout: 10000 });
}

async function save(page) {
  await page.locator('[data-model-save]').click();
  await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });
  return page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    return JSON.parse(await file.text());
  }, BUCKET);
}

const pixelOf = async (page, x, z) => {
  const scale = Number((await page.locator('#readout').textContent()).match(/scale ([\d.]+) px\/ft/)[1]);
  const box = await page.locator('#plan').boundingBox();
  return { px: box.x + box.width / 2 + x * scale, py: box.y + box.height / 2 + z * scale };
};
async function tapWorld(page, x, z) {
  const { px, py } = await pixelOf(page, x, z);
  await page.mouse.move(px, py);
  await page.mouse.click(px, py);
  await page.waitForTimeout(60);
}
async function hover(page, x, z) {
  const { px, py } = await pixelOf(page, x, z);
  await page.mouse.move(px, py);
  await page.waitForTimeout(60);
}
const bearing = l => {
  const deg = Math.atan2(-(l.end.z - l.start.z), l.end.x - l.start.x) * 180 / Math.PI;
  return deg <= -90 ? deg + 180 : (deg > 90 ? deg - 180 : deg);
};

test('LINE chains like WALL: each press starts the next line, Escape ends the run', async ({ page }) => {
  await open(page);
  await h.armFromRail(page, 'line');
  await tapWorld(page, 2, 2);
  await tapWorld(page, 8, 2);
  await tapWorld(page, 8, 6);
  await page.keyboard.press('Escape');
  await tapWorld(page, 12, 6);   // a fresh start, not a third line
  const saved = await save(page);
  expect(saved.lines, 'two pieces of one run').toHaveLength(2);
  const [a, b] = saved.lines;
  expect(Math.hypot(a.end.x - b.start.x, a.end.z - b.start.z), 'the corner is shared').toBeLessThan(1e-6);
  expect(saved.walls, 'a LINE writes lines, not walls').toHaveLength(0);
});

test('LINE takes a typed LENGTH the way WALL does', async ({ page }) => {
  await open(page);
  await h.armFromRail(page, 'line');
  await tapWorld(page, 2, 2);
  await hover(page, 9, 2);
  const box = page.locator('#frozen-length');
  await expect(box).toBeEnabled();
  await box.fill(`12'`);
  await box.press('Enter');
  const saved = await save(page);
  expect(saved.lines).toHaveLength(1);
  const [l] = saved.lines;
  expect(Math.hypot(l.end.x - l.start.x, l.end.z - l.start.z)).toBeCloseTo(12, 3);
});

test('a typed ANGLE is kept, and only a lit PROTRACTOR holds the run to it', async ({ page }) => {
  await open(page);
  await h.armFromRail(page, 'line');
  const angle = page.locator('#frozen-angle');
  await expect(angle, 'an angle can be typed before the first press').toBeEnabled();
  await angle.fill('30');
  await angle.press('Enter');
  // Unlit: the angle is kept and engages nothing.
  await tapWorld(page, 0, 0);
  await tapWorld(page, 6, 0);
  await page.keyboard.press('Escape');
  // Lit: the T-square goes out, and the run travels at 30°.
  await page.locator('[data-mode-tsquare]').click();
  await expect(page.locator('[data-mode-tsquare]')).toHaveClass(/lit/);
  await page.locator('[data-mode-protractor]').click();
  await expect(page.locator('[data-mode-protractor]')).toHaveClass(/lit/);
  await expect(page.locator('[data-mode-tsquare]'), 'one instrument holds the run').not.toHaveClass(/lit/);
  await tapWorld(page, 0, 4);
  await tapWorld(page, 6, 4);   // straight across, but the lock turns it
  await page.keyboard.press('Escape');
  const saved = await save(page);
  expect(saved.lines).toHaveLength(2);
  expect(bearing(saved.lines[0]), 'unlit: drawn where pressed').toBeCloseTo(0, 3);
  expect(bearing(saved.lines[1]), 'lit: held to the typed 30°').toBeCloseTo(30, 3);
  // And the T-square lit again puts the protractor out.
  await page.locator('[data-mode-tsquare]').click();
  await expect(page.locator('[data-mode-protractor]')).not.toHaveClass(/lit/);
});

test('the lock holds a WALL too', async ({ page }) => {
  await open(page);
  await h.armFromRail(page, 'wall');
  const angle = page.locator('#frozen-angle');
  await angle.fill('45');
  await angle.press('Enter');
  await page.locator('[data-mode-protractor]').click();
  await tapWorld(page, 0, 0);
  await tapWorld(page, 8, 0);
  await page.keyboard.press('Escape');
  const saved = await save(page);
  expect(saved.walls).toHaveLength(1);
  expect(bearing(saved.walls[0])).toBeCloseTo(45, 3);
});

// ── AND A LINE IS EDITED THE WAY A WALL IS ────────────────────────────────
//
// The same ruling as the drawing half -- "make the line act like the WALL
// everything the same WALL works good" -- and the LINE panel has been saying
// so since it was written: "A LINE IS TWO POINTS. DRAG AN END TO CHANGE IT."
// The page had no path for it. cornerAt offered the selected WALL's ends and
// nothing else, and the multi-item drag wants two things selected, so a press
// on a single selected line's end slid the sheet. A panel describing a gesture
// the page has not got reads as the gesture failing.
async function dragWorld(page, from, to) {
  const a = await pixelOf(page, from[0], from[1]);
  const b = await pixelOf(page, to[0], to[1]);
  await page.mouse.move(a.px, a.py);
  await page.mouse.down();
  await page.mouse.move(b.px, b.py, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(120);
}

test('a selected LINE drags by an end, as a wall does', async ({ page }) => {
  await open(page);
  await h.armFromRail(page, 'line');
  await tapWorld(page, 2, 2);
  await tapWorld(page, 10, 2);
  await page.keyboard.press('Escape');
  await h.selectTool(page, 'Select');

  // SELECTION FIRST, THEN THE DRAG -- the wall corner's own rule, and the
  // reason a pan begun near a line end still pans.
  await tapWorld(page, 6, 2);
  await dragWorld(page, [10, 2], [13, 5]);

  const saved = await save(page);
  expect(saved.lines, 'still one line').toHaveLength(1);
  const [line] = saved.lines;
  const moved = [line.start, line.end].find(p => p.x > 11);
  expect(moved, 'the end went where it was dragged').toBeTruthy();
  expect(moved.x).toBeCloseTo(13, 1);
  expect(moved.z).toBeCloseTo(5, 1);
  // AND ONLY THAT END: the other is where it was drawn.
  const stayed = [line.start, line.end].find(p => p !== moved);
  expect(stayed.x).toBeCloseTo(2, 3);
  expect(stayed.z).toBeCloseTo(2, 3);
});

test('an UNSELECTED line is not dragged by a press on its end', async ({ page }) => {
  // The rule the wall corner keeps: without it every pan begun near any end
  // anywhere in the drawing would move it instead of sliding the sheet.
  await open(page);
  await h.armFromRail(page, 'line');
  await tapWorld(page, 2, 2);
  await tapWorld(page, 10, 2);
  await page.keyboard.press('Escape');
  await h.selectTool(page, 'Select');

  await dragWorld(page, [10, 2], [13, 5]);
  const saved = await save(page);
  const [line] = saved.lines;
  expect([line.start.x, line.end.x].sort((a, b) => a - b), 'the line did not move')
    .toEqual([2, 10]);
});

test('one Ctrl+Z puts a dragged end back', async ({ page }) => {
  await open(page);
  await h.armFromRail(page, 'line');
  await tapWorld(page, 2, 2);
  await tapWorld(page, 10, 2);
  await page.keyboard.press('Escape');
  await h.selectTool(page, 'Select');
  await tapWorld(page, 6, 2);
  await dragWorld(page, [10, 2], [13, 5]);

  await page.locator('#model-undo').click();
  await page.waitForTimeout(150);
  const saved = await save(page);
  const [line] = saved.lines;
  expect([line.start.x, line.end.x].sort((a, b) => a - b), 'back where it was drawn')
    .toEqual([2, 10]);
});

// ── AND BY ITS BODY, WHICH IS THE OTHER HALF OF THE SAME GESTURE ──────────
//
// The ends came first (above). The BODY was left on the wall-only question:
// wallBodyAt asked selectedWall(), so a press in the middle of a selected
// line slid the sheet while a press on either end moved the point. One
// record, two grabs, two answers -- and a drafter reads the one that does
// nothing as the line being stuck.
//
// IT NEEDED NOTHING ELSE, for the ends' own reasons: a line's ends are
// POOLED VERTICES like a wall's, movingEnds reads the two points any segment
// has, the 'move' undo step restores points whatever record holds them, and
// splitRunCorners leaves early on anything but a TOY wall. What the two
// callers of the grab needed was to stop assuming the answer is a wall.

test('a selected LINE drags by its BODY, moving whole', async ({ page }) => {
  await open(page);
  await h.armFromRail(page, 'line');
  // LONG ENOUGH THAT ITS MIDDLE IS NOT AN END. The corner grab reaches
  // CORNER_GRAB_PX in feet, which at this scale is several of them, so on a
  // short line every press is inside one end's zone and a "body" drag is an
  // end drag wearing its coat. 28 ft puts the middle 14 from either end.
  await tapWorld(page, 2, 2);
  await tapWorld(page, 30, 2);
  await page.keyboard.press('Escape');
  await h.selectTool(page, 'Select');

  // Selection first, then the press on the middle -- the body grab's rule,
  // the same one the ends keep.
  await tapWorld(page, 16, 2);
  await dragWorld(page, [16, 2], [16, 8]);

  const saved = await save(page);
  expect(saved.lines, 'still one line').toHaveLength(1);
  const [line] = saved.lines;
  // BOTH ENDS TRAVELLED THE SAME 6 FT, which is what makes it a body drag
  // rather than an end drag that caught the wrong point: a line dragged by
  // its middle keeps its length and its angle.
  expect(line.start.z, 'the near end came down').toBeCloseTo(8, 1);
  expect(line.end.z, 'and so did the far one').toBeCloseTo(8, 1);
  expect([line.start.x, line.end.x].sort((a, b) => a - b),
    'and neither moved along the line').toEqual([2, 30]);
});

test('an UNSELECTED line is not dragged by a press on its body', async ({ page }) => {
  // The same rule the ends keep, and the reason: a press anywhere near any
  // line in the drawing would otherwise move it instead of sliding the sheet.
  await open(page);
  await h.armFromRail(page, 'line');
  // LONG ENOUGH THAT ITS MIDDLE IS NOT AN END. The corner grab reaches
  // CORNER_GRAB_PX in feet, which at this scale is several of them, so on a
  // short line every press is inside one end's zone and a "body" drag is an
  // end drag wearing its coat. 28 ft puts the middle 14 from either end.
  await tapWorld(page, 2, 2);
  await tapWorld(page, 30, 2);
  await page.keyboard.press('Escape');
  await h.selectTool(page, 'Select');

  await dragWorld(page, [16, 2], [16, 8]);
  const saved = await save(page);
  const [line] = saved.lines;
  expect([line.start.z, line.end.z], 'the line did not move').toEqual([2, 2]);
});

test('one Ctrl+Z puts a body-dragged line back', async ({ page }) => {
  await open(page);
  await h.armFromRail(page, 'line');
  // LONG ENOUGH THAT ITS MIDDLE IS NOT AN END. The corner grab reaches
  // CORNER_GRAB_PX in feet, which at this scale is several of them, so on a
  // short line every press is inside one end's zone and a "body" drag is an
  // end drag wearing its coat. 28 ft puts the middle 14 from either end.
  await tapWorld(page, 2, 2);
  await tapWorld(page, 30, 2);
  await page.keyboard.press('Escape');
  await h.selectTool(page, 'Select');
  await tapWorld(page, 16, 2);
  await dragWorld(page, [16, 2], [16, 8]);

  await page.locator('#model-undo').click();
  await page.waitForTimeout(150);
  const saved = await save(page);
  const [line] = saved.lines;
  expect([line.start.z, line.end.z], 'both ends are back').toEqual([2, 2]);
});
