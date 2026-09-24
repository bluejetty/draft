// The OUTLINE tool on MODEL.html — the parity rung's acceptance.
//
// PARITY-model-html-vs-dc.md has carried this row since #389: "Draw an outline
// — absent, must-have. BUILD HOUSE reads outlines." The build bar records a
// house type and stops there, because the old page's _pressBuildType does two
// things and only the first came across: it records the type AND arms the
// outline tool. This file is what says the second half arrived.
//
// WHAT IS BEING MEASURED IS THE PERSISTED SHAPE, not the pixels. An outline is
// stored twice over — a master on a BONEYARD shelf holding the common
// geometry, and a copy on every level linked back to it corner by corner — and
// the links are two identifiers, `masterId` on the copy and `srcId` on each of
// its points. An outline with neither renders EXACTLY like one with both.
// Nothing looks wrong until a drafter drags a master corner and the other
// floors do not follow, by which time the drawing is saved. So every assertion
// here that names an id is guarding that silence, and the round trip is the
// acceptance rather than a screenshot.
//
// PRESSES ARE AIMED THROUGH THE PUBLISHED CAMERA. h.planFrame reads the
// `data-view` the page writes on its canvas, so a press lands on the world
// point it names. Centre-of-canvas arithmetic assumes the view is centred on
// the origin, which is true at open and false the moment anything pans.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const readout = page => page.locator('#readout');

// A house saved by the old page, then MODEL.html opened on the same origin.
// Same origin is the point: IndexedDB is per-origin, so this is the real
// handover rather than a fixture handed to both.
async function newPageOnSavedHouse(page) {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);

  // THE FIRST BONE ALREADY DRAWS AN OUTLINE, which this file's first draft did
  // not expect -- the precondition below caught it on the first run, reporting
  // a master with four corners at x -25..24 that no test had drawn. So the
  // fixture is cleared of outlines before the new page opens: a test that
  // cannot tell the outline it drew from one that was already there is a test
  // that passes whether or not the tool works.
  //
  // The WALLS stay. They are what MODEL.html paints to prove it opened, and
  // leaving them makes the drawing an ordinary one being added to rather than
  // an empty sheet, which is the case the tool has to work in.
  await page.evaluate(async bucket => {
    const store = window.SharedFileStore;
    const at = await store.loadSharedFileAt(bucket);
    const drawing = JSON.parse(await at.file.text());
    drawing.boneyardOutlines = [];
    drawing.outlines = [];
    // ONE LEVEL IS EMPTIED, NOT ALL OF THEM, and both halves of that are
    // measured rather than assumed. BUILD HOUSE only fills levels that are
    // still empty (auto-house.spec.js:151), and the bone fixture leaves walls
    // on FOUNDATION, MAIN and 2ND -- so with all three full the old page's
    // bone is a no-op and the round trip proves nothing. Clearing ALL walls
    // was the first attempt and it broke the other two tests: the presses are
    // aimed through the published camera, and a drawing with no geometry gives
    // that camera nothing to frame. Emptying 2ND FL alone leaves the camera a
    // house to fit and the bone a floor to build.
    drawing.walls = (drawing.walls || []).filter(w => Number(w.levelId) !== 5);
    await store.saveSharedFile(
      new File([JSON.stringify(drawing)], 'd.json', { type: 'application/json' }),
      bucket, { ifRev: at.rev });
  }, h.STORAGE_BUCKET);

  await page.goto('/MODEL.html');
  await expect(readout(page)).toContainText('walls', { timeout: 6000 });
}

// Press a house type on the build bar, which is what arms the tracing on the
// old page and must arm it here.
async function pickHouseType(page, family = 'bungalow', entry = family) {
  await h.openDriveThru(page);
  await page.locator(`[data-build-family="${family}"]`).click();
  await page.locator(`[data-build-entry="${entry}"]`).click();
}

// A PRESS AIMED AT THE SHEET HAS TO LAND ON THE SHEET, and with the board up
// that is not free. The board is a PICTURE and passes presses through, but the
// cards on its shelf are controls and take their own -- so a corner that falls
// on a card is a corner the sheet never hears, and the loop never closes.
//
// WHERE A CORNER FALLS IS THE CAMERA'S BUSINESS, not this file's. These
// presses are aimed at world points; fit() frames whatever the fixture left
// standing, and the scale it picks moves from run to run -- 10.5 to 18.8 feet
// per pixel across four runs of this file, measured. So the same world square
// lands on the shelf some runs and clear of it others, which is exactly how
// this file behaved: green here, red on CI, and red on a different test each
// time. Movie ruled this class once already (model-html-fit-insets.spec.js,
// 15 Sep: give fit() the chrome's insets rather than shave the bar, "on the
// grounds that shaving moves the cliff to whichever control gets added next"),
// and shaving the cards to miss the square would be the same mistake.
//
// SO THE VIEW MOVES, NOT THE LOOP. Every corner below is named in an
// assertion -- x AND z, at -10 and -8 -- so a loop opened out to miss the
// shelf would be a loop the test then fails to recognise. Zooming changes
// where world points LAND without changing what they are, which is the whole
// reason planFrame reads the published camera instead of assuming one. A
// drafter does the same thing for the same reason: the board is over the
// drawing, so they zoom until they can see what they are tracing.
//
// The board cannot simply be shut instead. Once a type is chosen the foot bone
// BUILDS rather than re-opening the window (MODEL.html's boneFoot handler:
// `if (chosen()) return`), so a spec that shuts the board has no way back to
// the shelf -- and the DETACHED GARAGE test below needs it twice.
//
// THE BROWSER'S OWN HIT-TESTING IS WHAT SAYS WHEN IT IS CLEAR. Arithmetic
// against the shelf's box would be a second copy of the page's layout, free
// to disagree with it the next time the art changes; elementFromPoint asks
// the question the press itself asks.
const onSheet = (page, points) => page.evaluate(list => list.map(([cx, cy]) => {
  const el = document.elementFromPoint(cx, cy);
  return !!el && el.id === 'plan';
}), points);

async function clearOfTheShelf(page, corners) {
  const mid = k => corners.reduce((sum, corner) => sum + corner[k], 0) / corners.length;
  const middle = [mid(0), mid(1)];

  // ZOOM ABOUT THE LOOP'S OWN MIDDLE, so the corners open outward from where
  // they already are instead of sliding across the sheet. The wheel is only
  // heard by the canvas, so the point it is aimed at has to be canvas: if the
  // middle of the loop is itself under a card, the anchor walks up the sheet
  // until it is clear of the board altogether.
  let frame = await h.planFrame(page);
  for (let notch = 0; notch < 10; notch += 1) {
    const points = corners.map(([x, z]) => frame.at(x, z));
    if ((await onSheet(page, points)).every(Boolean)) return frame;

    const anchor = frame.at(middle[0], middle[1]);
    const candidates = [anchor, [frame.box.x + 120, anchor[1]],
      [frame.box.x + frame.box.width - 120, anchor[1]]];
    const live = await onSheet(page, candidates);
    const at = candidates[live.indexOf(true)];
    if (!at) throw new Error('nowhere to aim the wheel: the board covers the '
      + 'sheet from edge to edge');

    await page.mouse.move(at[0], at[1]);
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(80);
    frame = await h.planFrame(page);

    // OFF THE SHEET IS NOT CLEAR OF THE SHELF. Zoomed far enough, a corner
    // leaves the canvas -- which is a press on nothing, not a press on the
    // drawing -- so stop and say so rather than trade one swallowed press for
    // another.
    const opened = corners.map(([x, z]) => frame.at(x, z));
    if (opened.some(([x, y]) => x < frame.box.x || x > frame.box.x + frame.box.width
      || y < frame.box.y || y > frame.box.y + frame.box.height)) break;
  }
  throw new Error('no zoom puts every corner of this loop on the sheet — the '
    + 'board\'s shelf covers the drawing wherever the camera puts it');
}

// Press corners WITHOUT closing, which is the state the colour is about: a
// committed outline is a level copy in the scope colours, and the family's
// colour only ever shows while the loop is still in the drafter's hands.
async function traceCorners(page, corners) {
  const frame = await clearOfTheShelf(page, corners);
  for (const [x, z] of corners) {
    const at = frame.at(x, z);
    await page.mouse.click(at[0], at[1]);
    await page.waitForTimeout(120);
  }
  return frame;
}

// WHAT IS ACTUALLY ON THE GLASS around a world point.
//
// The colour assertions read the canvas rather than recording strokeStyle,
// which this suite does elsewhere and which would have been easier. A
// recorded strokeStyle says the painter was TOLD a colour; it passes just as
// happily when the colour is set on a context that then strokes nothing, and
// "the pending loop is invisible" is the exact defect this rung is fixing.
//
// A PLACED CORNER IS THE TARGET, not the middle of a leg: the legs are dashed
// (5 on, 4 off) and hairline, while every placed corner is a filled 6x6 block
// of the trace colour. Sampling solid ink is the difference between an
// assertion about colour and an assertion about anti-aliasing.
async function inkAround(page, frame, x, z, radius = 10) {
  const [clientX, clientY] = frame.at(x, z);
  return page.evaluate(({ clientX, clientY, radius }) => {
    const canvas = document.getElementById('plan');
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    const px = Math.round((clientX - rect.left) * sx);
    const py = Math.round((clientY - rect.top) * sy);
    const size = Math.max(2, Math.round(radius * 2 * sx));
    const data = canvas.getContext('2d').getImageData(
      Math.max(0, px - size / 2), Math.max(0, py - size / 2), size, size,
    ).data;
    return Array.from(data);
  }, { clientX, clientY, radius });
}

// The two family colours, as MODEL.html declares them. Written out in RGB
// because that is what comes back off the canvas.
const HOUSE_RED = [192, 57, 43];    // #c0392b -- the old page's own traceHouse
const SPLIT_BLUE = [63, 127, 214];  // #3f7fd6 -- the order's "blue split"

// Press a list of world corners, closing on the first. The close IS the
// gesture's ending — no Enter, no FINISH — because that is the old page's
// contract and a tool that needs a keyboard is not one an iPad can use.
//
// The view is zoomed clear of the board's shelf first -- see clearOfTheShelf.
async function traceLoop(page, corners) {
  const frame = await clearOfTheShelf(page, corners);
  for (const [x, z] of corners) {
    const at = frame.at(x, z);
    await page.mouse.click(at[0], at[1]);
    await page.waitForTimeout(120);
  }
  const first = frame.at(corners[0][0], corners[0][1]);
  await page.mouse.click(first[0], first[1]);
  await page.waitForTimeout(200);
}

// THIS PAGE DOES NOT AUTOSAVE, and the first draft of this file assumed it
// did: every assertion timed out waiting for the dirty flag to clear while the
// outline sat correctly in memory. MODEL.html has a SAVE button and the
// drafter presses it -- h.waitForSaved is the OLD page's contract, not this
// one's.
async function saveOnNewPage(page) {
  await expect(page.locator('#save')).toBeEnabled({ timeout: 4000 });
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
}

const savedFile = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return file ? JSON.parse(await file.text()) : null;
}, h.STORAGE_BUCKET);

const houseMaster = saved =>
  (saved?.boneyardOutlines || []).find(outline => !outline.garage) || null;

const SQUARE = [[-10, -8], [10, -8], [10, 8], [-10, 8]];

test('a house type arms the outline tool, and a closed loop becomes a master', async ({ page }) => {
  await newPageOnSavedHouse(page);
  const before = houseMaster(await savedFile(page));
  expect(before, 'the bone fixture must not already carry a house master, '
    + 'or this test cannot tell a new one from the old').toBeNull();

  await pickHouseType(page);
  await traceLoop(page, SQUARE);
  await saveOnNewPage(page);

  const saved = await savedFile(page);
  const master = houseMaster(saved);
  expect(master, 'the closed loop became a master on the boneyard shelf').not.toBeNull();
  expect(master.points).toHaveLength(4);

  // THE CORNERS ARE WHERE THEY WERE PRESSED, in world feet, not near enough.
  const xs = master.points.map(p => p.x).sort((a, b) => a - b);
  const zs = master.points.map(p => p.z).sort((a, b) => a - b);
  expect(xs[0]).toBeCloseTo(-10, 1);
  expect(xs[3]).toBeCloseTo(10, 1);
  expect(zs[0]).toBeCloseTo(-8, 1);
  expect(zs[3]).toBeCloseTo(8, 1);

  // EVERY MASTER POINT HAS ITS OWN ID, spelled the way storage spells it.
  // MODEL.dc.html's loader renames this to `pointId` in memory; a file that
  // wrote `pointId` instead would load as a master whose points have no id.
  const ids = master.points.map(p => p.id);
  expect(ids.every(id => id !== undefined && id !== null && id !== ''),
    'every master point carries a storage-spelled id').toBe(true);
  expect(new Set(ids).size, 'and they are distinct').toBe(4);
});

test('every level carries a copy linked back to the master, corner by corner', async ({ page }) => {
  await newPageOnSavedHouse(page);
  await pickHouseType(page);
  await traceLoop(page, SQUARE);
  await saveOnNewPage(page);

  const saved = await savedFile(page);
  const master = houseMaster(saved);
  expect(master).not.toBeNull();

  const levelIds = (saved.levels || []).map(level => Number(level.id));
  expect(levelIds.length, 'the fixture must have levels, or this asserts nothing')
    .toBeGreaterThan(0);

  const copies = (saved.outlines || []).filter(o => o.masterId === master.id);
  expect(copies.map(c => Number(c.levelId)).sort((a, b) => a - b),
    'one copy per level, and no level missed')
    .toEqual(levelIds.slice().sort((a, b) => a - b));

  // THE LINK IS THE WHOLE FEATURE. Each copy point names the master point it
  // came from; without srcId the outline draws the same and follows nothing.
  const masterIds = master.points.map(p => String(p.id)).sort();
  for (const copy of copies) {
    expect(copy.points.map(p => String(p.srcId)).sort(),
      `copy on level ${copy.levelId} links every corner back to the master`)
      .toEqual(masterIds);
  }
});

test('the old page reads the outline the new page drew, and its bone builds from it',
  async ({ page }) => {
    await newPageOnSavedHouse(page);
    await pickHouseType(page);
    await traceLoop(page, SQUARE);
    await saveOnNewPage(page);

    const drawn = houseMaster(await savedFile(page));
    expect(drawn, 'the new page wrote a master to hand over').not.toBeNull();

    // BACK TO THE OLD PAGE, same origin, no fixture in between. This is the
    // handover the parity row is about: the old page is the one that shows the
    // BONEYARD and builds houses, and it has to find what this page wrote.
    await page.goto('/MODEL.dc.html');
    await page.waitForFunction(() => document.body.dataset.modelReady === '1');

    // THE BONE IS THE ACCEPTANCE, not a render check. BUILD HOUSE reads
    // outlines -- that is the sentence the parity row has carried since #389 --
    // so a bone that raises walls on the traced rectangle is the old page
    // saying it understood every part of what the new page wrote: the master,
    // the per-level copies, and the ids linking them.
    // THE WALLS THAT WERE ALREADY THERE ARE NOT THE MEASUREMENT. The fixture
    // carries the first bone's own house out at x -25..24, and the first draft
    // of this assertion read every wall in the drawing and reported -22 for a
    // loop traced at -10. Name the new ones, or the old house answers for them.
    const before = new Set(h.allWalls(await h.savedDrawing(page)).map(w => w.id));

    await page.locator('[data-build-house]').click();
    await h.waitForSaved(page);

    const walls = h.allWalls(await h.savedDrawing(page)).filter(w => !before.has(w.id));
    expect(walls.length, 'the old page-s bone raised walls from the traced loop')
      .toBeGreaterThan(0);

    // AND ON THE LOOP THAT WAS TRACED, not merely somewhere. A bone building
    // from a different outline -- or from a default -- would pass a bare count.
    const xs = walls.flatMap(w => [w.start.x, w.end.x]);
    const zs = walls.flatMap(w => [w.start.z, w.end.z]);
    expect(Math.min(...xs)).toBeCloseTo(-10, 0);
    expect(Math.max(...xs)).toBeCloseTo(10, 0);
    expect(Math.min(...zs)).toBeCloseTo(-8, 0);
    expect(Math.max(...zs)).toBeCloseTo(8, 0);
  });

test('a part-drawn loop is on the glass, in the bungalow family-s red', async ({ page }) => {
  await newPageOnSavedHouse(page);
  await pickHouseType(page);

  // TWO CORNERS AND NO CLOSE. The loop is unfinished on purpose: this is the
  // state that had nothing drawn in it at all before this change -- the tool
  // took the presses, held the corners and showed the drafter a blank sheet.
  const frame = await traceCorners(page, [[-10, -8], [10, -8]]);

  const ink = await inkAround(page, frame, 10, -8);
  expect(h.countColor(ink, HOUSE_RED),
    'the corner the drafter just placed is drawn, in the house red')
    .toBeGreaterThan(0);
  expect(h.countColor(ink, SPLIT_BLUE),
    'and not in the other family-s colour').toBe(0);
});

test('a BILEVEL trace draws in the split blue instead', async ({ page }) => {
  await newPageOnSavedHouse(page);
  await pickHouseType(page, 'bilevel', 'bilevel');
  const frame = await traceCorners(page, [[-10, -8], [10, -8]]);

  const ink = await inkAround(page, frame, 10, -8);
  expect(h.countColor(ink, SPLIT_BLUE),
    'the trace wears the family that armed it').toBeGreaterThan(0);
  // THE NEGATIVE IS THE HALF THAT CAN FAIL. A colour keyed off nothing still
  // paints something red here; only "and it is not the house red" tells the
  // two families apart.
  expect(h.countColor(ink, HOUSE_RED),
    'a bilevel trace is not the house red').toBe(0);
});

test('a DETACHED GARAGE press arms no house trace, and says why', async ({ page }) => {
  await newPageOnSavedHouse(page);

  // THE HOUSE LOOP FIRST, and it is not scene-setting: it is what proves the
  // presses in the second half are real. An absence after a press is also
  // what a dead page shows, so the test needs the SAME gesture, on the same
  // canvas, known to draw -- and then counts.
  await pickHouseType(page);
  await traceLoop(page, SQUARE);

  // THE BOARD IS STILL UP -- pressing an entry does not shut it -- so the
  // garage press is the drafter's next press, with nothing reset in between.
  await pickHouseType(page, 'detachedGarage', 'detached-thickened');
  // WHAT IT SAYS NOW POINTS AT THE GESTURE THAT WORKS. This assertion used to
  // read 'Detached garages are not on this page yet', which was true when it
  // was written and stopped being true when buildOrderedGarage landed -- the
  // sign's bone sets one on the lot. Movie read that sentence on 18 Sep,
  // believed the page, and only found the working gesture by pressing the
  // bone anyway. What the trace refuses is still exactly what it refused:
  // arming a HOUSE trace for a garage tile. Only the sentence changed.
  await expect(page.locator('#strip-message')).toContainText('press the bone');
  await expect(page.locator('#strip-message'),
    'and it no longer argues the drafter out of a gesture that works')
    .not.toContainText('not on this page yet');

  await traceLoop(page, SQUARE);
  await saveOnNewPage(page);

  const masters = (await savedFile(page)).boneyardOutlines || [];
  expect(masters.filter(outline => !outline.garage).length,
    'exactly one house master -- the garage press armed nothing, because the '
    + 'old page sends those entries to its garage mode and this page has none '
    + 'yet, so a house master would be a wrong drawing rather than a missing '
    + 'feature')
    .toBe(1);
});

// ── THE WAY IN: THE TILE, AND THE BONE AT THE WINDOW ─────────────────────
//
// Movie, 18 Sep, at the drive-thru with 1 STOREY picked and Gruff saying
// "press the bone and I'll build it": "outline command doesn't work". The
// trace WAS armed -- the tile armed it the moment it was pressed -- and the
// page said nothing about it, behind a board that did not come down. Both
// halves of that are measured here.

test('a house tile says what to trace, in the words of the thing picked',
  async ({ page }) => {
    await newPageOnSavedHouse(page);
    await pickHouseType(page);

    // THE ENTRY'S OWN LABEL, not "house". A sentence that named the family
    // would read the same for 1 STOREY and 2 STOREY, and a drafter who picked
    // the wrong tile would have nothing to notice it by.
    await expect(page.locator('#strip-message')).toContainText('Trace your 1 STOREY');
  });

test('a tile with no design yet says so, and builds nothing', async ({ page }) => {
  await newPageOnSavedHouse(page);
  const before = (await savedFile(page)).outlines?.length || 0;

  // A TILE THE CATALOGUE HAS NO DESIGN FOR, asked of the page rather than
  // named. Movie, 18 Sep: "have those tiles say 'not ready yet' and build
  // nothing".
  //
  // THIS NAMED A TILE TWICE AND ROTTED TWICE: 1 STOREY, then 2 STOREY when
  // 1 STOREY got a design, then broken again the day 2 STOREY got one. Every
  // design that lands claims one more name, so the test asks which tiles are
  // still undesigned instead of betting on one.
  //
  // THIS REPLACED A HANDOVER. For one rung the bone answered an undesigned
  // tile by taking the board down and handing over the armed outline trace,
  // which was better than the silence it replaced and still the wrong answer:
  // "we shouldn't put it in the drivethru window yet, i'd just like to offer
  // them premade designs in there at the beginning". A board that answers a
  // press by quietly arming a tool somewhere else teaches the drafter that its
  // button means something other than what it says.
  const tile = await h.undesignedTile(page);
  // THE DAY THE LAST DESIGN LANDS, this check has nothing to be about and says
  // so rather than pressing something that builds.
  test.skip(!tile, 'every tile on the board now has a design');
  await pickHouseType(page, tile.family, tile.entry);
  await page.locator('#dt-bone').click();
  await page.waitForTimeout(250);

  await expect(page.locator('[data-drivethru-line]'),
    'the board says why rather than doing nothing').toContainText('NOT READY YET');

  // THE BOARD STAYS UP, unlike a served order. Nothing was built, so the
  // drafter has not been answered and the tiles are still in front of him --
  // 1 STOREY is one press away.
  await expect(page.locator('#drivethru')).not.toHaveAttribute('data-shut', '');

  await saveOnNewPage(page);
  expect((await savedFile(page)).outlines?.length || 0,
    'and not one record was written').toBe(before);
});

test('U arms the trace, and the loop it takes becomes a master', async ({ page }) => {
  await newPageOnSavedHouse(page);
  expect(houseMaster(await savedFile(page)), 'no master to start with').toBeNull();

  await page.keyboard.press('U');
  await expect(page.locator('#strip-message')).toContainText('Trace your house');

  // THE DRAWING IS THE ACCEPTANCE, not the strip. A page that printed the
  // sentence and armed nothing passes the line above and fails here.
  await traceLoop(page, SQUARE);
  await saveOnNewPage(page);

  const master = houseMaster(await savedFile(page));
  expect(master, 'the letter armed a real trace').not.toBeNull();
  expect(master.points).toHaveLength(4);
});

test('putting the tool down drops the corners, the way every other gesture is dropped',
  async ({ page }) => {
    await newPageOnSavedHouse(page);

    await page.keyboard.press('U');
    await traceCorners(page, [[-10, -8], [10, -8]]);

    // SELECT, and back. setTool clears the wall's anchor and the beam's for
    // the reason its own comment gives -- a half-finished gesture belongs to
    // the tool being put down, and an anchor carried across is how a chain
    // commits into the next tool's first tap. The outline's pending corners
    // are a third of exactly that kind and nothing cleared them: walk away
    // mid-house, come back, and the next press continued a loop the drafter
    // had abandoned.
    await page.keyboard.press('S');
    await page.keyboard.press('U');

    await traceLoop(page, SQUARE);
    await saveOnNewPage(page);

    const master = houseMaster(await savedFile(page));
    expect(master, 'the second trace committed').not.toBeNull();
    // FOUR, NOT SIX. The two abandoned corners are the whole measurement: they
    // sit at the same x as two of the square-s own, so a master that kept them
    // is a six-cornered house nothing on screen distinguishes from a bad trace.
    expect(master.points, 'the abandoned corners did not join the new loop')
      .toHaveLength(4);
  });

test('and a house-type press drops them too, because it goes through the register',
  async ({ page }) => {
    await newPageOnSavedHouse(page);

    await page.keyboard.press('U');
    await traceCorners(page, [[-10, -8], [10, -8]]);

    // THE SECOND DOOR TO THE SAME TOOL. armOutline used to set `activeTool`
    // by hand, because outline was not in the roster and setTool would have
    // refused it on every board. Now that it is a tool, arming it around the
    // register would make the board a look rather than a rule -- and would
    // skip the clearing this checks, leaving a house-type press to inherit
    // corners from a trace the drafter had walked away from.
    await pickHouseType(page);
    await traceLoop(page, SQUARE);
    await saveOnNewPage(page);

    const master = houseMaster(await savedFile(page));
    expect(master, 'the traced loop committed').not.toBeNull();
    expect(master.points, 'the abandoned corners did not join it').toHaveLength(4);
  });

// ── THE BONE BUILDS WHAT WAS DRAWN ───────────────────────────────────────
//
// Movie, 18 Sep: "when they draw the U outline, they should still press the
// BONE or blue house to cause the house to be created." The seam for it was
// declared when the build bar was written -- onBuild, "build what the drafter
// drew" -- and nothing had ever registered on it, so the foot bone fired into
// an empty list and then called the drive-thru up over the loop.

// ── THE FOOT BONE ASKS NOW, AND ITS BUILD IS ON THE CARD ────────────────
//
// Movie ruled it 19 Sep, against his own earlier instruction: "go with the
// 19 sep rule, on 1st press go to drivethru questions and on 2nd always offer
// choice between drivetrhu or house build". So a traced loop is no longer
// raised by the press itself -- the press asks, and the card's BUILD raises
// it. The loop is still what gets built, which is the half of his 18 Sep rule
// that survives.
//
// THE TYPE IS PICKED FIRST, because the card is the SECOND press and there is
// no second press until the drafter has been through the window once. That is
// also the order a drafter works in: he tells Gruff what he is building
// before he traces it.
//
// AND TWO OF THESE CHECKS WENT ON PASSING WITHOUT IT, which is why every one
// of them was changed and not just the two that went red. With no type picked
// the press opens the BOARD and builds nothing -- so "the second press built
// nothing" and "one undo takes the house back" were both true of a page that
// had never built anything at all. An assertion two worlds satisfy.
async function armedTypeAndLoop(page, corners = SQUARE) {
  await pickHouseType(page);
  await page.locator('#dt-close').click();
  await page.waitForTimeout(150);
  // NO `U` HERE. Picking a type at the window already ARMS the trace -- the
  // old page's _pressBuildType "does two things, records the type AND arms
  // the outline tool" -- and pressing the armed key again puts it DOWN, which
  // is the register's own rule. An earlier draft of this helper pressed it
  // and traced with SELECT in hand.
  await traceLoop(page, corners);
}

async function boneBuild(page) {
  await page.locator('#bone').click();
  await expect(page.locator('#build-choice'),
    'the foot press did not offer the choice').toBeVisible();
  await page.locator('[data-build-choice-build]').click();
  await page.waitForTimeout(200);
}

const wallsOf = (saved, levelId = 3) =>
  (saved?.walls || []).filter(wall => Number(wall.levelId) === Number(levelId));

test('the foot bone raises walls around the loop that was traced', async ({ page }) => {
  await newPageOnSavedHouse(page);
  await armedTypeAndLoop(page);

  const before = wallsOf(await savedFile(page)).length;
  await boneBuild(page);
  await saveOnNewPage(page);

  const after = wallsOf(await savedFile(page));
  expect(after.length - before, 'a wall on each of the square-s four sides')
    .toBe(4);

  // ON THE CORNERS THAT WERE PRESSED, in world feet. A build that raised four
  // walls somewhere else passes a count and nothing else.
  const corners = new Set(after.flatMap(wall => [wall.start, wall.end])
    .map(pt => `${Math.round(pt.x)},${Math.round(pt.z)}`));
  for (const [x, z] of SQUARE) {
    expect(corners, `a wall corner at ${x},${z}`).toContain(`${x},${z}`);
  }

  // AND THE BOARD STAYS DOWN. The press was answered by the house going up;
  // before this rung it fell through to NOTHING TO BUILD YET and called the
  // drive-thru over the drafter-s own walls. callSign lights the button and
  // waits two seconds before the sign rises, so the lit press is the immediate
  // tell -- reading the board alone would read it from inside that glow.
  await expect(page.locator('#bone'),
    'the bone did not start calling the board back over the new house')
    .not.toHaveAttribute('data-lit', '');
});

test('pressing it twice does not build the house twice', async ({ page }) => {
  await newPageOnSavedHouse(page);
  await armedTypeAndLoop(page);

  await boneBuild(page);
  await saveOnNewPage(page);
  const once = wallsOf(await savedFile(page)).length;
  expect(once, 'the first press built nothing, so "not twice" proves nothing')
    .toBeGreaterThan(0);

  // ALREADY BUILT IS DERIVED FROM THE DRAWING, not stored on the outline: a
  // loop whose first edge carries a wall has been built. A second press on a
  // house that is already up would otherwise lay a second wall along every
  // side -- four records exactly on top of four others, which looks like one
  // house until something is dragged.
  //
  // AND SINCE 24 SEP THE SECOND PRESS IS ANSWERED OUT LOUD, by a route worth
  // naming because it is easy to miss: the choice card's BUILD tries
  // fireBuild FIRST, which answers false here -- the traced loop is already
  // built, so there is nothing to raise from it -- and then FALLS THROUGH to
  // orderAtWindow(). What waits there is a premade bungalow about to be laid
  // onto a file that already holds a house, which is precisely the case ONE
  // BUILDING PER DRAFT FILE exists for, so the press is met by "save this
  // drawing and start a clean one?".
  //
  // CANCEL IS WHAT KEEPS THIS TEST'S SUBJECT. The offer is a different thing
  // from the silence that used to answer this press, but the property is the
  // same one and still worth pinning: say no, and no second house is laid
  // over the first.
  await page.locator('#bone').click();
  await expect(page.locator('#build-choice'),
    'the second press did not offer the choice').toBeVisible();
  await page.locator('[data-build-choice-build]').click();
  await expect(page.locator('#file-guard'),
    'the second press was answered by neither a build nor an offer')
    .toBeVisible();
  await page.locator('[data-guard-cancel]').click();
  await expect(page.locator('#file-guard')).toBeHidden();
  await page.waitForTimeout(200);
  await saveOnNewPage(page);

  expect(wallsOf(await savedFile(page)).length,
    'the second press built nothing').toBe(once);
});

test('one Ctrl+Z takes the house back, and leaves the outline standing',
  async ({ page }) => {
    // AN EXCEPTION IN THE UNDO HANDLER IS INVISIBLE FROM THE OUTSIDE, which is
    // how the first version of this test passed against a mutation that threw.
    // The walls are spliced before the outline is, so a throw on the outline
    // still leaves the drawing looking undone -- and takes the repaint and the
    // rail rebuild that come after it. Nothing on the page says so. This is
    // the witness.
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await newPageOnSavedHouse(page);
    await armedTypeAndLoop(page);
    await saveOnNewPage(page);
    const before = wallsOf(await savedFile(page)).length;

    await boneBuild(page);
    await saveOnNewPage(page);
    expect(wallsOf(await savedFile(page)).length,
      'nothing was built, so "one undo takes it back" proves nothing')
      .toBeGreaterThan(before);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(150);
    await saveOnNewPage(page);

    const saved = await savedFile(page);
    expect(wallsOf(saved).length, 'ONE undo took the whole house -- the runs- '
      + 'own add steps are dropped for the single built one').toBe(before);

    // THE LOOP IS THE DRAFTER-S AND IT STAYS. An ordered garage mints its own
    // outline and takes it back with the walls; he drew this one, and an undo
    // that swallowed it would take back a gesture nobody asked to undo.
    expect(houseMaster(saved), 'his trace survived the undo of the build')
      .not.toBeNull();
    expect(errors, 'and the undo handler ran to its end rather than throwing '
      + 'part way and skipping the repaint').toEqual([]);
  });

test('the walls sit inside the loop whichever way it was walked', async ({ page }) => {
  await newPageOnSavedHouse(page);

  // THE SAME SQUARE, WALKED THE OTHER WAY. A freehand loop is wound whichever
  // way the drafter went round it, and the wall BODY has to land inside it
  // either way -- the traced line is the exterior face. build-house.js's
  // outlineInteriorRef reads the winding and answers 'left' or 'right'.
  //
  // THIS TEST EXISTS BECAUSE THE FORWARD SQUARE CANNOT FAIL. Walked as SQUARE
  // is written, the answer is 'left' -- which is also the page's default wall
  // setting, so a build that ignored the outline entirely would agree with it
  // and prove nothing. Reversed, the two answers part.
  await armedTypeAndLoop(page, [...SQUARE].reverse());
  await boneBuild(page);
  await saveOnNewPage(page);

  const walls = wallsOf(await savedFile(page)).slice(-4);
  expect(walls, 'four walls went up').toHaveLength(4);
  for (const wall of walls) {
    expect(wall.refLine, 'a clockwise loop puts the body on the right of each '
      + 'run, not on the drafter-s default').toBe('right');
  }
});
