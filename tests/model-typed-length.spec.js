// TYPE THE LENGTH WITHOUT CLICKING THE BOX.
//
// Movie, 16 Oct: "when they get to this position and they are pointed a
// direction, can we allow them to start entering numbers and it will start
// entering into the LENGTH texbox without having to click on the texbox, just
// put it straight in there, unless they press A where they will ... enter the
// ANGLE textbox and enter and angle".
//
// THE RULE: while a run is in hand with a direction to measure along -- the
// moment stripRefresh enables the LENGTH box -- a digit pressed anywhere on
// the page is the first character of a length. Focus follows that keystroke
// and the rest of the number lands in the box by itself. Enter commits
// through the same commitTypedLength a click-then-type uses, so the TOY
// promotion of #746 is reached the same way whichever way the digits arrived.
//
// NOT A. A is SHAPE on the default key profile and P on the office one, so a
// letter would arm a tool mid-run. TAB steps from LENGTH to ANGLE, as the
// dynamic input in AutoCAD and Revit does; it is a tool letter in no profile.
//
// AND THE PAGE'S OWN KEYS STEP ASIDE ONLY WHILE A RUN IS LIVE. 0 refits the
// sheet at any other time; mid-run it is a digit. W is a tool letter at every
// time, run or no run.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
// THE SAME SQUARE model-toy-board.spec.js draws on, for the same reason: a
// symmetric fixture puts fit()'s centre on (0,0), so a screen point is centre
// plus world times scale and the clicks below land where they say.
const base = extra => ({
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  walls: [
    ['n', V(-10, -10), V(10, -10)], ['e', V(10, -10), V(10, 10)],
    ['s', V(10, 10), V(-10, 10)], ['w', V(-10, 10), V(-10, -10)],
  ].map(([id, start, end]) => ({ id, start, end, levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' })),
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
  nextDrawingItemId: 20,
  ...extra,
});

async function open(page, file) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

const lengthBox = page => page.locator('[data-frozen-length]');
const angleBox = page => page.locator('[data-frozen-angle]');
const focusedId = page => page.evaluate(() => document.activeElement && document.activeElement.id);
const boardOf = page => page.evaluate(() => document.body.getAttribute('data-board'));
const scaleOf = page => page.evaluate(() => Number(
  /scale ([\d.]+) px\/ft/.exec(document.getElementById('readout').textContent)[1]));
const wallCount = page => page.evaluate(() => Number(
  /walls (\d+)\/(\d+)/.exec(document.getElementById('readout').textContent)[2]));

const frame = async page => {
  const box = await page.locator('#plan').boundingBox();
  const scale = await scaleOf(page);
  return (x, z) => [box.x + box.width / 2 + x * scale, box.y + box.height / 2 + z * scale];
};

// A RUN IN HAND, POINTED EAST: first point down at (0,4), the hand six feet
// to the right of it. The live reading in the box is 6'-0", which is what a
// typed digit has to replace rather than extend.
async function startARun(page) {
  const at = await frame(page);
  await h.armWall(page);
  await page.mouse.click(...at(0, 4));
  await page.mouse.move(...at(6, 4));
  await page.waitForTimeout(60);
  await expect(lengthBox(page), 'a run in hand makes the box live').toBeEnabled({ timeout: 4000 });
}

const saveAndRead = async page => {
  await page.locator('[data-model-save]').click();
  await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });
  return page.evaluate(async bucket => {
    const f = await window.SharedFileStore.loadSharedFile(bucket);
    return JSON.parse(await f.text());
  }, BUCKET);
};
const FIXTURE_IDS = ['n', 'e', 's', 'w'];
const drawnWall = saved => (saved.walls || []).find(w => !FIXTURE_IDS.includes(w.id));
const lengthOf = w => Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z);

test('a digit pressed on the sheet is the first character of a LENGTH, and Enter makes the wall that long',
  async ({ page }) => {
    await open(page, base({ board: 'drafting' }));
    await startARun(page);
    expect(await focusedId(page), 'nothing has been clicked').not.toBe('frozen-length');

    // Typed with the hand on the sheet, never a click on the box. The hyphen
    // after the 7 proves the focus moved on the FIRST key: typed into the
    // page it would be nothing, typed into the box it is 7'-6".
    await page.keyboard.type('7-6');
    expect(await focusedId(page), 'focus followed the first digit').toBe('frozen-length');
    await expect(lengthBox(page)).toHaveValue('7-6');

    const before = await wallCount(page);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    expect(await wallCount(page), 'Enter committed the run').toBe(before + 1);
    expect(await focusedId(page), 'and let go of the box, as the click-then-type commit does')
      .not.toBe('frozen-length');
    const drawn = drawnWall(await saveAndRead(page));
    expect(drawn, 'the wall reached the file').toBeTruthy();
    expect(lengthOf(drawn), 'seven and a half feet, the number he typed').toBeCloseTo(7.5, 6);
  });

test('the first keystroke replaces the live reading rather than appending to it',
  async ({ page }) => {
    await open(page, base({ board: 'drafting' }));
    await startARun(page);
    // The box is showing the run under the hand. A 1 pressed now is the start
    // of a number, not a seventh character on the end of 6'-0".
    await expect(lengthBox(page)).toHaveValue(/6'-0"/);
    await page.keyboard.press('1');
    await expect(lengthBox(page)).toHaveValue('1');
  });

test('"14 6" typed straight in is 14\'-6"', async ({ page }) => {
  // The sixth of his six forms, the one the parser refused until today.
  // Through the page rather than the parser alone, because the space is
  // also a key the page binds (finishAlt: Space) and it has to reach the
  // box, not the page, once a digit has opened the box.
  await open(page, base({ board: 'drafting' }));
  await startARun(page);
  await page.keyboard.type('14 6');
  await expect(lengthBox(page)).toHaveValue('14 6');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  const drawn = drawnWall(await saveAndRead(page));
  expect(drawn, 'the wall reached the file').toBeTruthy();
  expect(lengthOf(drawn)).toBeCloseTo(14.5, 6);
});

test('a length a whole foot cannot hold still turns the TOY light off when typed straight in',
  async ({ page }) => {
    // THE HOLE #746 CLOSED MUST STAY CLOSED. The typed number is what moves
    // the board; a second way of typing it that skipped promoteForNumber
    // would leave the lamp lit over a drawing TOY cannot hold.
    await open(page, base({ board: 'toy' }));
    await startARun(page);
    const before = await wallCount(page);
    await page.keyboard.type('8 6');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    expect(await boardOf(page), 'promoted by the number itself').toBe('drafting');
    await expect(page.locator('#strip-message')).toContainText('DRAFTING now');
    expect(await wallCount(page), 'and the wall he typed was made').toBe(before + 1);
  });

test('with no run in hand the digits are the page\'s own keys: 0 refits the sheet and the box stays dead',
  async ({ page }) => {
    await open(page, base({ board: 'drafting' }));
    await h.armWall(page);
    // No first point, so no run: the box is dead and 0 is the fit.
    await expect(lengthBox(page)).toBeDisabled();
    await page.keyboard.press('0');
    const fitted = await scaleOf(page);
    const box = await page.locator('#plan').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(60);
    expect(await scaleOf(page), 'the wheel zoomed').not.toBeCloseTo(fitted, 2);
    await page.keyboard.press('0');
    await page.waitForTimeout(60);
    expect(await scaleOf(page), '0 is still the fit').toBeCloseTo(fitted, 2);
    await expect(lengthBox(page)).toBeDisabled();
    await expect(lengthBox(page)).toHaveValue('');
  });

test('while a run is live, 0 is a digit and not a fit', async ({ page }) => {
  await open(page, base({ board: 'drafting' }));
  await startARun(page);
  const box = await page.locator('#plan').boundingBox();
  // Zoom away from the fit with the run still in hand, so a fit would be
  // visible as a change of scale.
  await page.mouse.wheel(0, -400);
  await page.waitForTimeout(60);
  await expect(lengthBox(page), 'the run survived the wheel').toBeEnabled();
  const zoomed = await scaleOf(page);
  await page.keyboard.press('0');
  await page.waitForTimeout(60);
  expect(await scaleOf(page), 'the sheet did not refit under his hands').toBeCloseTo(zoomed, 2);
  await expect(lengthBox(page)).toHaveValue('0');
  expect(await focusedId(page)).toBe('frozen-length');
  void box;
});

test('a letter is still a key: W mid-run puts the WALL tool down, as it always did',
  async ({ page }) => {
    // Only digits and the point open the box. A letter typed on the sheet
    // reaches the tool column exactly as before -- W is the wall tool's own
    // letter and pressing it returns to SELECT.
    await open(page, base({ board: 'drafting' }));
    await startARun(page);
    await page.keyboard.press('w');
    await page.waitForTimeout(60);
    expect(await h.wallArmed(page), 'the letter reached the tool column').toBe(false);
    await expect(lengthBox(page), 'no run, no box').toBeDisabled();
    await expect(lengthBox(page)).toHaveValue('');
  });

test('TAB steps into the ANGLE box, from the box and from the sheet; Shift+Tab steps back',
  async ({ page }) => {
    await open(page, base({ board: 'drafting' }));
    await startARun(page);
    // FROM THE SHEET FIRST, before any box has had the focus. The browser's
    // own Tab would start from the canvas the run was clicked on and land on
    // whatever control follows it in the page; only the page's route lands
    // on ANGLE. Asked after a visit to the LENGTH box this check could not
    // tell the two apart, because the browser's Tab from a just-blurred box
    // steps to the next control, and the next control after LENGTH is ANGLE.
    expect(await focusedId(page), 'nothing has the focus').not.toMatch(/^frozen-/);
    await page.keyboard.press('Tab');
    expect(await focusedId(page), 'Tab from the sheet is ANGLE').toBe('frozen-angle');
    await expect(angleBox(page)).toBeEnabled();
    await page.keyboard.press('Shift+Tab');
    expect(await focusedId(page), 'Shift+Tab from ANGLE is LENGTH').toBe('frozen-length');
    await page.keyboard.press('7');
    await expect(lengthBox(page), 'the box took the digit as its text').toHaveValue('7');
    await page.keyboard.press('Tab');
    expect(await focusedId(page), 'Tab from LENGTH is ANGLE').toBe('frozen-angle');
    // Escape in a box lets go of the box, not the run (the box's own
    // handler), and the run is still in hand for the next Tab.
    await page.keyboard.press('Escape');
    expect(await focusedId(page)).not.toMatch(/^frozen-/);
    await expect(lengthBox(page), 'the run is still in hand').toBeEnabled();
  });

test('Escape lets go of the box without letting go of the run; a second Escape cancels the run',
  async ({ page }) => {
    await open(page, base({ board: 'drafting' }));
    await startARun(page);
    await page.keyboard.press('7');
    await page.keyboard.press('Escape');
    expect(await focusedId(page), 'the box is let go').not.toBe('frozen-length');
    await expect(lengthBox(page), 'the run is still in hand').toBeEnabled();
    await expect(lengthBox(page), 'and the box reads the run again').toHaveValue(/6'-0"/);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(60);
    await expect(lengthBox(page), 'the page\'s Escape cancelled the run').toBeDisabled();
  });
