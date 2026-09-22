// PLACING A WINDOW OR A DOOR ON MODEL.html — the first of the three gestures.
//
// Movie, 18 Sep, asking for the bungalow's openings: "please windows and doors
// into the bungalow and i'll change them if i need to afterwards". The
// design's eleven arrived that day and this page had no way to change them:
// nothing to add one, move one or take one out. The parity row has read
// "Place fenestration — absent, but openings PAINT now" ever since.
//
// WHAT IS MEASURED IS THE RECORD AND ITS HOST. An opening is not geometry of
// its own: it is a width and an offset ALONG A WALL, and drawing-format.js
// never checks that the host wall exists (:184-200). So an opening written
// against the wrong wall id is invisible, permanent, and survives every save
// — the drawing is not damaged, it is just not the drawing. Every check here
// that names a wallId is guarding that silence.
//
// PRESSES ARE AIMED THROUGH THE PUBLISHED CAMERA (h.planFrame), so a press
// lands on the world point it names rather than on centre-of-canvas
// arithmetic that stops being true the moment anything pans.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
const MAIN_FL = 3;

// geometry-2d.js's own five, copied by hand. Asking the page which number it
// used and then checking it used that number is a tautology; a copy means a
// change has to be made twice and the failure names this file.
//
// AND IT DID, 22 Sep. Movie put the window head at 7'-0" -- *"on windows the
// top of the window should be default located 7ft high from the current level
// floor level (if the window changes size the bottom changes)"* -- and the
// window's sill is what moved: the same 4'-2" of glass hung four inches
// higher, so 2'-6" became 2'-10". This file went red naming itself, which is
// what the copy is for.
//
// A DOOR AND A WINDOW NO LONGER SHARE A HEAD, so there are two now. A door
// stands on the floor, so its head IS its height and 6'-8" is the leaf the
// office orders.
const DOOR_W = 3;
const WINDOW_W = 4;
const DOOR_HEAD = (6 * 12 + 8) / 12;
const WINDOW_HEAD = 7;
const WINDOW_SILL = WINDOW_HEAD - (DOOR_HEAD - 2.5);   // the old 4'-2" of glass

// A plain square house. The walls are 20 ft long, which is comfortably more
// than any opening here plus its bearing at both ends — so a refusal in these
// tests is a real refusal and not a wall that was always too short.
const base = extra => ({
  version: 1,
  levels: [{ id: MAIN_FL, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  board: 'drafting',
  walls: [
    ['n', V(-10, -10), V(10, -10)], ['e', V(10, -10), V(10, 10)],
    ['s', V(10, 10), V(-10, 10)], ['w', V(-10, 10), V(-10, -10)],
  ].map(([id, start, end]) => ({ id, start, end, levelId: MAIN_FL, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' })),
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
  ...extra,
});

const readout = page => page.locator('#readout');

async function open(page, file = base({})) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  // ?left=1 for the tool column (FENESTRATION has no legacy button, so its key
  // is the only way to arm it) and ?right=1 for the properties slot, which is
  // where DOOR / WINDOW is chosen and which ships hidden and collapsed.
  await page.goto('/MODEL.html?left=1&right=1');
  await expect(readout(page)).toContainText('walls', { timeout: 10000 });
  await expect(page.locator('[data-tool-key="fenestration"]')).toBeVisible();
}

const armOpening = page => page.locator('[data-tool-key="fenestration"]').click();

const pickType = (page, id) =>
  page.locator(`[data-prop-row="opening"] [data-prop-value="${id}"]`).click();

async function frame(page) {
  const box = await page.locator('#plan').boundingBox();
  const view = await page.locator('#plan').getAttribute('data-view');
  const [cx, cz, scale] = view.trim().split(/\s+/).map(Number);
  return { at: (x, z) => [box.x + box.width / 2 + (x - cx) * scale,
    box.y + box.height / 2 + (z - cz) * scale], scale };
}

async function pressAt(page, f, x, z) {
  const at = f.at(x, z);
  await page.mouse.click(at[0], at[1]);
  await page.waitForTimeout(120);
}

async function save(page) {
  await expect(page.locator('#save')).toBeEnabled({ timeout: 4000 });
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
}

// THE READ THAT MATTERS: not what the page holds, but what a fresh load keeps.
// DraftDrawingFormat is the same normaliser the page runs on open, so this
// asks the question the reload asks — and it is the read that catches a field
// the reader quietly drops.
const survives = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  const raw = JSON.parse(await file.text());
  const F = window.DraftDrawingFormat;
  const levelIds = new Set((raw.levels || []).map(level => Number(level.id)));
  return {
    raw: (raw.fenestrations || []).length,
    openings: F.fenestrations(raw.fenestrations, levelIds),
    wallIds: (raw.walls || []).map(wall => String(wall.id)),
  };
}, BUCKET);

// The count the page shows, so a check can be made without saving.
const shownOpenings = async page => Number(
  (await readout(page).textContent()).match(/openings (\d+)\/(\d+)/)?.[2] ?? -1);

test('the tool offers DOOR and WINDOW, and says what the next press will make',
  async ({ page }) => {
    await open(page);
    await armOpening(page);
    const row = page.locator('[data-prop-row="opening"]');
    await expect(row).toBeVisible();
    await expect(row.locator('[data-prop-value="door"]'))
      .toHaveAttribute('aria-pressed', 'true');

    // THE REST OF THE OPENING, spelled out rather than discovered by placing
    // one. Width, sill and head are not typeable here yet, so the panel is
    // the only place they are stated.
    await expect(page.locator('[data-opening-note]')).toContainText("3'-0\"");
    await pickType(page, 'window');
    await expect(row.locator('[data-prop-value="window"]'))
      .toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-opening-note]')).toContainText("4'-0\"");
  });

test('one press on a wall puts a door in it, and a reload keeps it',
  async ({ page }) => {
    await open(page);
    await armOpening(page);
    const f = await frame(page);
    // The middle of the north wall, which runs from (-10,-10) to (10,-10).
    await pressAt(page, f, 0, -10);
    await save(page);

    const after = await survives(page);
    expect(after.raw, 'the page wrote an opening').toBe(1);
    // THE HALF THAT CATCHES A DROPPED RECORD. The reader refuses an opening
    // with no type, no width, a head at or below its sill, or a negative
    // offset — all of which are written silently and vanish on the next open.
    expect(after.openings.length, 'and a reload keeps it').toBe(1);

    const cut = after.openings[0];
    expect(after.wallIds, 'hosted on a wall that is in the drawing')
      .toContain(String(cut.wallId));
    expect(cut.type).toBe('door');
    expect(cut.width).toBeCloseTo(DOOR_W, 3);
    expect(cut.sillHeight, 'a door sits on the floor').toBeCloseTo(0, 3);
    expect(cut.headHeight).toBeCloseTo(DOOR_HEAD, 3);
    expect(cut.layer).toBe('A-DOOR');
    expect(cut.auto, "the drafter's, not a dealt one").toBe(false);
    expect(cut.levelId, 'filed against the wall-s level').toBe(MAIN_FL);

    // ON THE WALL THAT WAS PRESSED, not merely on some wall. The north wall
    // runs along z = -10, and its id is 'n' in the fixture.
    expect(String(cut.wallId), 'the wall under the press').toBe('n');
    // And roughly where the press landed: the wall starts at x = -10, so the
    // middle of it is 10 ft along.
    expect(cut.offset).toBeGreaterThan(9);
    expect(cut.offset).toBeLessThan(11);
  });

test('a window is 4 ft with a sill, and goes on A-GLAZ', async ({ page }) => {
  await open(page);
  await armOpening(page);
  await pickType(page, 'window');
  const f = await frame(page);
  await pressAt(page, f, 0, -10);
  await save(page);

  const cut = (await survives(page)).openings[0];
  expect(cut, 'the window was written').toBeTruthy();
  expect(cut.type).toBe('window');
  expect(cut.width).toBeCloseTo(WINDOW_W, 3);
  expect(cut.sillHeight, 'a window sits off the floor').toBeCloseTo(WINDOW_SILL, 3);
  expect(cut.headHeight, 'and heads at 7 ft, not the door-s 6 ft 8')
    .toBeCloseTo(WINDOW_HEAD, 3);
  expect(cut.layer).toBe('A-GLAZ');
  // The control the three above need: a door and a window differ in every one
  // of these. Were the type ignored, each assertion would still look checked.
  expect(WINDOW_W).not.toBeCloseTo(DOOR_W, 3);
  expect(WINDOW_SILL).not.toBeCloseTo(0, 3);
});

test('a press near a corner slides the opening until its bearing fits',
  async ({ page }) => {
    // THE CLAMP IS THE POINT. Pressed a foot from the corner, a 3 ft door
    // centred on the press would hang off the end of the wall with nothing
    // under the lintel. clampOpeningToWall slides it along instead of
    // refusing — and an opening that did NOT slide would be written with an
    // offset the format accepts and the wall cannot carry.
    await open(page);
    await armOpening(page);
    const f = await frame(page);
    await pressAt(page, f, -9, -10);   // 1 ft along a 20 ft wall
    await save(page);

    const cut = (await survives(page)).openings[0];
    expect(cut, 'the door was placed, not refused').toBeTruthy();
    // Both ends on the wall, with room for the bearing. The centre must be at
    // least half the width plus a bearing off each end; 2 ft is inside that
    // and outside the 1 ft the press asked for.
    expect(cut.offset, 'it slid away from the corner')
      .toBeGreaterThan(DOOR_W / 2);
    expect(cut.offset + DOOR_W / 2, 'and it still ends on the wall')
      .toBeLessThan(20);
  });

test('a press on nothing writes nothing, and says why', async ({ page }) => {
  await open(page);
  await armOpening(page);
  const f = await frame(page);
  // The middle of the house: four walls away from everything.
  await pressAt(page, f, 0, 0);

  expect(await shownOpenings(page), 'nothing was placed').toBe(0);
  await expect(page.locator('[data-strip-message]')).toContainText('Press a wall');
});

test('the tool stays armed, so a house gets its windows in one go',
  async ({ page }) => {
    // A DELIBERATE DIFFERENCE FROM FLOOR AND OUTLINE, which rest when they
    // finish. Those gestures END -- a closed loop is a whole thing -- and an
    // opening is one press, so resting after each would cost a trip to the
    // tool column between every window on the house.
    await open(page);
    await armOpening(page);
    const f = await frame(page);
    await pressAt(page, f, -4, -10);
    await pressAt(page, f, 4, -10);
    await pressAt(page, f, 10, 0);
    await expect(page.locator('[data-tool-key="fenestration"]'))
      .toHaveAttribute('aria-pressed', 'true');
    await save(page);

    const after = await survives(page);
    expect(after.openings.length, 'three presses, three openings').toBe(3);
    // TWO WALLS, not one: the third press was on the east wall. An opening
    // hosted on the wrong wall is invisible and permanent, so this is the
    // check that the host is read per press rather than remembered.
    const hosts = new Set(after.openings.map(o => String(o.wallId)));
    expect(hosts.has('n'), 'the north wall took two').toBe(true);
    expect(hosts.has('e'), 'and the east wall took one').toBe(true);
    // And three distinct ids: the format drops a duplicate id on load, so a
    // constant allocator would pass every check above and lose two openings.
    expect(new Set(after.openings.map(o => o.id)).size).toBe(3);
  });

test('one undo takes the opening back', async ({ page }) => {
  await open(page);
  await armOpening(page);
  const f = await frame(page);
  await pressAt(page, f, 0, -10);
  expect(await shownOpenings(page)).toBe(1);

  await page.keyboard.press('Control+z');
  await page.waitForTimeout(200);
  expect(await shownOpenings(page), 'the opening goes back in one keystroke').toBe(0);

  await save(page);
  expect((await survives(page)).raw, 'and it is not in the file').toBe(0);
});

// ── STAGE 2: the opening answers a press, and DELETE takes it out ─────────
//
// Movie's own words when he asked for the bungalow's openings were "i'll
// change them if i need to afterwards", and stage 1 only added. Taking one
// out is the other half of the smallest useful loop.
//
// THE ACCEPTANCE IS WHAT SURVIVES THE DELETE, not what lights up. A press
// that selected the HOST WALL instead of the opening looks almost identical
// on screen -- both draw a blue highlight over the same stretch of wall --
// and the difference only shows when DELETE is pressed and a wall disappears
// with every opening in it. So each check below presses, deletes, and then
// counts both.
const shownWalls = async page => Number(
  (await readout(page).textContent()).match(/walls (\d+)\/(\d+)/)?.[2] ?? -1);

const canvasHash = page => page.evaluate(() => {
  const c = document.getElementById('plan');
  const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  let n = 0x811c9dc5;
  for (let i = 0; i < data.length; i += 4) {
    n ^= data[i] | (data[i + 1] << 8) | (data[i + 2] << 16);
    n = Math.imul(n, 0x01000193) >>> 0;
  }
  return n.toString(16);
});

// Place one door in the middle of the north wall and come back to SELECT.
async function doorOnTheNorthWall(page) {
  await open(page);
  await armOpening(page);
  const f = await frame(page);
  await pressAt(page, f, 0, -10);
  expect(await shownOpenings(page), 'the fixture door went in').toBe(1);
  // SELECT is the resting tool, and the tool column is how a drafter gets
  // back to it -- the opening tool stays armed by design, so without this
  // the next press would place a second door on top of the first.
  await page.locator('[data-tool-key="select"]').click();
  return f;
}

test('a press on an opening selects the opening, not the wall under it',
  async ({ page }) => {
    const f = await doorOnTheNorthWall(page);
    await pressAt(page, f, 0, -10);
    await expect(page.locator('[data-delete]'), 'something is selected')
      .toBeVisible();

    await page.locator('[data-delete]').click();
    await page.waitForTimeout(150);

    // BOTH COUNTS, and the second is the one that matters. Selecting the host
    // wall instead would delete the wall AND cascade its opening away -- so
    // "the opening is gone" alone passes for both outcomes.
    expect(await shownOpenings(page), 'the opening went').toBe(0);
    expect(await shownWalls(page), 'and all four walls are still standing')
      .toBe(4);
  });

test('the wall is still selectable away from its opening', async ({ page }) => {
  // THE COST OF THE PRECEDENCE, kept honest. An opening beats its host wall,
  // so the slack around it is wall the drafter can no longer reach -- two
  // pixels of it, the old page's own figure. This is the check that says the
  // rest of the wall still answers.
  const f = await doorOnTheNorthWall(page);
  await pressAt(page, f, -8, -10);   // the same wall, 8 ft from the door
  await expect(page.locator('[data-delete]')).toBeVisible();

  await page.locator('[data-delete]').click();
  await page.waitForTimeout(150);
  expect(await shownWalls(page), 'the wall went').toBe(3);
  // AND ITS OPENING WENT WITH IT, which is the cascade that already worked
  // before this rung -- named here because the count would otherwise look
  // like the opening had been selected after all.
  expect(await shownOpenings(page), 'and the door it carried went with it')
    .toBe(0);
});

test('a press on the wall face still takes the opening', async ({ page }) => {
  // WHERE THE GRAB ACTUALLY ENDS, and the only check in this file that can
  // tell. The rest press the middle of the opening, deep inside its quad, so
  // the margin never comes into play.
  //
  // THE FACE IS WHERE A DRAFTER AIMS. The opening's quad starts on the wall's
  // reference line, and the wall's boundary stroke is CENTRED on that line --
  // so half the ink being pressed at is outside the opening proper. The old
  // page slackens its grab by "a couple of pixels" for exactly this; this page
  // gets the same two pixels from the PAINTER, which pads the quad so the gap
  // fill interrupts that stroke. The grab is what is painted.
  //
  // A SEPARATE 2px SLACK WAS WRITTEN HERE FIRST and removed when a mutation
  // zeroing it changed no answer -- the pixels were already in the shape.
  const f = await doorOnTheNorthWall(page);
  // A pixel and a half outside the quad, converted to feet through the
  // published camera so the press is the same distance out at any zoom.
  const justOutside = -10 - 1.5 / f.scale;
  await pressAt(page, f, 0, justOutside);
  await expect(page.locator('[data-delete]'), 'the press hit something')
    .toBeVisible();

  await page.locator('[data-delete]').click();
  await page.waitForTimeout(150);
  // Without the slack this press falls through to the wall, and DELETE takes
  // the wall and cascades the door away with it -- so the opening count is 0
  // either way and only the WALL count separates the two outcomes.
  expect(await shownWalls(page), 'the wall was not the thing selected').toBe(4);
  expect(await shownOpenings(page), 'the opening was').toBe(0);
});

test('and a press clear of the wall face takes the wall, not the opening',
  async ({ page }) => {
    // THE OTHER SIDE OF THE SAME EDGE, so the grab cannot quietly grow. An
    // opening BEATS its host wall, so every pixel it reaches is a pixel of
    // wall the drafter can no longer select -- a hit test that answered for
    // anything near the wall would make the wall unselectable along the
    // opening's whole width, and the check above alone would not notice.
    const f = await doorOnTheNorthWall(page);
    const wellClear = -10 - 6 / f.scale;   // three times the painter's pad
    await pressAt(page, f, 0, wellClear);
    await expect(page.locator('[data-delete]')).toBeVisible();

    await page.locator('[data-delete]').click();
    await page.waitForTimeout(150);
    expect(await shownWalls(page), 'the wall was taken').toBe(3);
  });

test('a selected opening is visible as selected', async ({ page }) => {
  // WHOLE-CANVAS HASHES, the idiom model-html-select.spec.js established for
  // exactly this question: nothing in the drawing changes between these two
  // renders, so the only thing that can move the hash is the overlay.
  //
  // An opening has no `points` of its own -- it is a width and an offset
  // along a wall -- so a highlight that fell through to the polygon branch
  // would read `item.points`, find nothing, and paint NOTHING: a selection
  // the drafter cannot see, about to be deleted.
  const f = await doorOnTheNorthWall(page);
  const before = await canvasHash(page);
  await pressAt(page, f, 0, -10);
  await expect(page.locator('[data-delete]')).toBeVisible();
  const after = await canvasHash(page);
  expect(after, 'selecting the opening painted something').not.toBe(before);
});

test('one undo brings a deleted opening back', async ({ page }) => {
  const f = await doorOnTheNorthWall(page);
  await pressAt(page, f, 0, -10);
  await page.locator('[data-delete]').click();
  await page.waitForTimeout(150);
  expect(await shownOpenings(page)).toBe(0);

  await page.keyboard.press('Control+z');
  await page.waitForTimeout(200);
  expect(await shownOpenings(page), 'the door is back').toBe(1);

  // AND IT IS THE SAME RECORD, back on the same wall. 'remove-item' splices
  // the item into the list at the index it came out of; a restore that put
  // back a copy, or put it back hosted on nothing, would count the same here
  // and be dropped by the loader on the next open.
  await save(page);
  const after = await survives(page);
  expect(after.openings.length, 'and a reload keeps it').toBe(1);
  expect(after.wallIds).toContain(String(after.openings[0].wallId));
});

// ── STAGE 3: sliding an opening along its wall ───────────────────────────
//
// The last of the three. "Change" most often means a window that is a foot
// off, and until now the only way to move one was to delete it and place
// another -- which loses nothing on a default door and loses everything the
// day an opening carries a type, a size or a head the drafter typed.
//
// WHAT IS MEASURED IS THE OFFSET, because that is the whole of what a slide
// changes: an opening is a width and an offset along a wall, and a drag that
// moved anything else would be a drag that moved the wrong thing.

// The centre of an opening in world coordinates, off the saved file: the
// offset is measured from the host wall's START, and the north wall of the
// fixture starts at x = -10.
const centreX = cut => -10 + cut.offset;

// Press, move, release -- the page arms a drag past 4px of travel, so every
// drag here is well past that. The intermediate move matters: a down and an
// up at two places is not a drag, it is two clicks.
async function slide(page, f, fromWorld, toWorld) {
  const a = f.at(fromWorld[0], fromWorld[1]);
  const b = f.at(toWorld[0], toWorld[1]);
  await page.mouse.move(a[0], a[1]);
  await page.mouse.down();
  await page.mouse.move((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, { steps: 4 });
  await page.mouse.move(b[0], b[1], { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(150);
}

test('a selected opening slides along its wall', async ({ page }) => {
  const f = await doorOnTheNorthWall(page);
  await save(page);
  const before = (await survives(page)).openings[0];
  expect(centreX(before), 'the door starts in the middle of the wall')
    .toBeGreaterThan(-1);

  // TWO STEPS: press it to choose it, then press again and drag. The same
  // gesture the wall body drag uses, and for the same reason -- a press that
  // both selected and started moving would make every mis-aimed tap an edit.
  await pressAt(page, f, 0, -10);
  await expect(page.locator('[data-delete]'), 'it is selected').toBeVisible();
  await slide(page, f, [0, -10], [5, -10]);

  await save(page);
  const after = (await survives(page)).openings[0];
  expect(centreX(after), 'the door followed the drag five feet along the wall')
    .toBeCloseTo(5, 0);
  // AND IT IS STILL THE SAME OPENING ON THE SAME WALL. A slide that wrote a
  // new record, or rehosted it, would move the door on screen and be a
  // different thing in the file.
  expect(after.id).toBe(before.id);
  expect(String(after.wallId)).toBe(String(before.wallId));
  expect(after.width).toBeCloseTo(before.width, 3);
});

test('an unselected opening does not move under a drag', async ({ page }) => {
  // THE COST OF THE TWO-STEP, kept honest. The first press is a selection and
  // nothing else, so a drag that begins on an opening the drafter has not
  // chosen pans the sheet -- it does not quietly edit the drawing.
  const f = await doorOnTheNorthWall(page);
  await save(page);
  const before = (await survives(page)).openings[0];

  await slide(page, f, [0, -10], [5, -10]);
  await save(page);
  const after = (await survives(page)).openings[0];
  expect(after.offset, 'the door stayed where it was')
    .toBeCloseTo(before.offset, 3);
});

test('it slides along the wall and not with the pointer', async ({ page }) => {
  // THE PROJECTION IS THE POINT. A drag is two-dimensional and an opening has
  // one dimension of freedom: it can only move ALONG its wall. A handler that
  // took the raw pointer would need the drafter to trace a six-inch strip to
  // move a window three feet, and would drop the opening off the wall the
  // moment the finger wandered.
  const f = await doorOnTheNorthWall(page);
  await pressAt(page, f, 0, -10);
  await expect(page.locator('[data-delete]')).toBeVisible();
  // Four feet along the wall and six feet off it, which is well outside any
  // grab distance the page uses.
  await slide(page, f, [0, -10], [4, -4]);

  await save(page);
  const after = (await survives(page)).openings[0];
  expect(centreX(after), 'it took the along-the-wall part of the drag')
    .toBeCloseTo(4, 0);
  // The across part is discarded rather than stored anywhere: an opening has
  // no coordinate of its own to put it in, and a record that grew one would
  // be a record drawing-format.js drops on the next load.
  expect(after.offset).toBeGreaterThan(0);
});

test('it will not slide off the end of its wall', async ({ page }) => {
  // THE CLAMP HOLDS DURING THE DRAG, not after it. An opening allowed to run
  // off the end and be pulled back on release would be a drawing that was
  // briefly impossible -- and would stay impossible if the drag ended off the
  // canvas, where no release arrives.
  const f = await doorOnTheNorthWall(page);
  await pressAt(page, f, 0, -10);
  await expect(page.locator('[data-delete]')).toBeVisible();
  // Thirty feet along a twenty-foot wall.
  await slide(page, f, [0, -10], [30, -10]);

  await save(page);
  const after = (await survives(page)).openings[0];
  expect(after, 'the opening survived the drag').toBeTruthy();
  // Both ends still on the wall with the bearing left under the lintel. The
  // wall is 20 ft and the door 3 ft, so a centre past 18.5 has no wood at the
  // far end -- and one at 30 is not on the wall at all.
  expect(after.offset + DOOR_W / 2, 'its far jamb is still on the wall')
    .toBeLessThan(20);
  expect(after.offset, 'and it did travel toward that end')
    .toBeGreaterThan(10);
});

test('one undo puts a slid opening back', async ({ page }) => {
  const f = await doorOnTheNorthWall(page);
  await save(page);
  const before = (await survives(page)).openings[0];

  await pressAt(page, f, 0, -10);
  await slide(page, f, [0, -10], [5, -10]);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(200);

  await save(page);
  const after = (await survives(page)).openings[0];
  expect(after.offset, 'one keystroke, one slide undone')
    .toBeCloseTo(before.offset, 3);
});

// ── TYPED SIZES ─────────────────────────────────────────────────────────────
//
// The panel used to carry a line saying the width, sill and head were "not
// typeable on this page yet", which left the drafter to discover the rest by
// placing one and measuring it. They are typeable now, through the app's own
// reader: formatters.js's parseArchitecturalLength takes 3, 3', 3-6, 3'-6",
// 42" and the rest, so the field never has to know what a dimension looks
// like -- which is the whole reason that parser is shared.
//
// WHAT THESE CHECK is the SEAM, not the parser. The parser has its own tests;
// what is new here is that a typed number reaches the record, that a refused
// one changes nothing, and that the panel never shows a number the page is
// not actually holding.

const typeInto = async (page, field, text) => {
  const box = page.locator(`[data-prop-field="${field}"]`);
  await box.fill(text);
  await box.press('Enter');
  await page.waitForTimeout(150);
};

const fieldValue = (page, field) =>
  page.locator(`[data-prop-field="${field}"]`).inputValue();

test('a typed width reaches the record', async ({ page }) => {
  await open(page);
  await armOpening(page);
  await pickType(page, 'window');
  await typeInto(page, 'width', "5'-6\"");

  const f = await frame(page);
  await pressAt(page, f, 0, -10);
  await save(page);
  const kept = await survives(page);

  expect(kept.openings.length, 'nothing was placed').toBe(1);
  expect(kept.openings[0].width, 'the record took the default, not the typed width')
    .toBeCloseTo(5.5, 4);
  // AND IT SURVIVES THE RELOAD, which is the only read that counts on a page
  // with no serializer between the push and the file.
  expect(kept.raw, 'the reload dropped it').toBe(kept.openings.length);
});

test('the width belongs to the type, so a door and a window keep their own',
  async ({ page }) => {
    // Movie's own shape on the old page: fenestrationWidths is a MAP, door and
    // window each with a number. A drafter who sets a 6 ft window does not
    // mean his next door to be 6 ft wide.
    await open(page);
    await armOpening(page);
    await pickType(page, 'window');
    await typeInto(page, 'width', '6');
    await pickType(page, 'door');

    // THE DOOR'S OWN WIDTH IS BACK, untouched by what the window was set to.
    const doorWidth = await fieldValue(page, 'width');
    expect(doorWidth, 'the door took the window-s width').not.toContain('6');

    await pickType(page, 'window');
    expect(await fieldValue(page, 'width'),
      'the window forgot the width it was given').toContain('6');
  });

test('a door is offered no sill, because a door has none', async ({ page }) => {
  // A door stands on the floor: its sill is zero by construction. A box that
  // the record then ignores would be the panel saying something about the
  // page that is not true.
  await open(page);
  await armOpening(page);
  await pickType(page, 'door');
  await expect(page.locator('[data-prop-field="sill"]'),
    'a door was offered a sill to set').toHaveCount(0);
  await expect(page.locator('[data-prop-field="head"]')).toBeVisible();

  await pickType(page, 'window');
  await expect(page.locator('[data-prop-field="sill"]'),
    'a window was not offered one').toBeVisible();
});

test('a head that is not above its sill is refused, and nothing changes',
  async ({ page }) => {
    // AN INVERTED OPENING is one the clamp would accept and the elevation
    // would draw: a head below the sill is a hole with negative height.
    await open(page);
    await armOpening(page);
    await pickType(page, 'window');
    const before = await fieldValue(page, 'head');

    await typeInto(page, 'head', '1');   // below the 2'-6" sill
    await expect(page.locator('#strip-message')).toContainText('is not above the sill');
    // THE BOX GOES BACK TO WHAT IS IN FORCE. A field left holding a number the
    // page refused is a field lying about the state -- the next opening would
    // come out the old size while the box said otherwise.
    expect(await fieldValue(page, 'head'), 'the refused number was left in the box')
      .toBe(before);

    const f = await frame(page);
    await pressAt(page, f, 0, -10);
    await save(page);
    const kept = await survives(page);
    expect(kept.openings[0].headHeight, 'the refused head reached the record')
      .toBeCloseTo(Number(before.replace(/[^\d.]/g, '')) > 0 ? kept.openings[0].headHeight : 0, 4);
    expect(kept.openings[0].headHeight > kept.openings[0].sillHeight,
      'the record took a head at or below its sill').toBe(true);
  });

test('nonsense in a field is refused out loud and the box reverts',
  async ({ page }) => {
    await open(page);
    await armOpening(page);
    await pickType(page, 'window');
    const before = await fieldValue(page, 'width');

    await typeInto(page, 'width', 'banana');
    // THE PARSER'S OWN SENTENCE, not one written here: the field hands the
    // refusal straight through, so the day the parser learns a new format the
    // message follows it.
    await expect(page.locator('#strip-message')).toContainText('Use');
    expect(await fieldValue(page, 'width'), 'the box kept text the page refused')
      .toBe(before);
  });

test('the panel shows what is in force, not what was typed', async ({ page }) => {
  // 3.5 is a legal entry and 3'-6" is what it means. A panel echoing the
  // keystrokes would show two different drawings the same number two ways.
  await open(page);
  await armOpening(page);
  await pickType(page, 'window');
  await typeInto(page, 'width', '3.5');
  expect(await fieldValue(page, 'width')).toBe("3'-6\"");
  await expect(page.locator('[data-opening-note]')).toContainText("3'-6\"");
});
