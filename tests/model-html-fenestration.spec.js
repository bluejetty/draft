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

// geometry-2d.js's own four, copied by hand. Asking the page which number it
// used and then checking it used that number is a tautology; a copy means a
// change has to be made twice and the failure names this file.
const DOOR_W = 3;
const WINDOW_W = 4;
const WINDOW_SILL = 2.5;
const HEAD = (6 * 12 + 8) / 12;

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
    expect(cut.headHeight).toBeCloseTo(HEAD, 3);
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
