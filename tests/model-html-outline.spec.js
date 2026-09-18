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

test("the sign's bone takes the board down and hands over the trace",
  async ({ page }) => {
    await newPageOnSavedHouse(page);
    const before = houseMaster(await savedFile(page));
    expect(before, 'no house master to start with').toBeNull();

    await pickHouseType(page);
    const sign = page.locator('#drivethru');
    await expect(sign, 'the tile does not shut the board').not.toHaveAttribute('data-shut', '');

    await page.locator('#dt-bone').click();

    // THE BOARD GETS OUT OF THE WAY. Before this rung the bone's only listener
    // was the garage builder, whose first line is
    // `if (!drawing || !order?.entry?.needsSize || !order.size) return null`
    // -- and no house entry carries needsSize, so a house order fell out of it
    // before building anything AND before taking the sign down. The drafter
    // pressed the bone and got a board still standing in front of the drawing.
    await expect(sign, 'the board comes down on a house order').toHaveAttribute('data-shut', '');
    await expect(page.locator('#strip-message')).toContainText('Trace your 1 STOREY');

    // AND THE TRACE IS REALLY THERE, which is the half a message cannot prove:
    // a page that printed the sentence and armed nothing would pass every
    // assertion above. This one draws the house.
    await traceLoop(page, SQUARE);
    await saveOnNewPage(page);

    const master = houseMaster(await savedFile(page));
    expect(master, 'the loop the bone handed over became a master').not.toBeNull();
    expect(master.points).toHaveLength(4);
  });

test('a house order does not spend the tile, because nothing was built',
  async ({ page }) => {
    await newPageOnSavedHouse(page);
    await pickHouseType(page);
    await page.locator('#dt-bone').click();
    await expect(page.locator('#drivethru')).toHaveAttribute('data-shut', '');

    // orderServed() means "the geometry side BUILT it", and nothing was built
    // -- the drafter is about to build it himself. Spent, the board would
    // re-open with no tile pressed under a drafter who is plainly mid-house,
    // and the foot bone would stop recognising the choice and pop the sign
    // back up over the trace in progress. THE FOOT BONE IS THE WITNESS: with a
    // type still chosen it builds and returns; with the choice spent it falls
    // through to callSign.
    await page.locator('#bone').click();

    // THE LIT PRESS IS THE IMMEDIATE TELL, and the reason this assertion is
    // here rather than the board check alone: callSign LIGHTS THE BUTTON AND
    // THEN WAITS TWO SECONDS before the sign rises (SIGN_LIGHT_MS). The first
    // draft of this test read `data-shut` the moment the press landed, which
    // is inside that glow -- so it passed with the order spent and the board
    // already on its way up. Found by mutation.
    await expect(page.locator('#bone'),
      'the foot bone did not start calling the board back').not.toHaveAttribute('data-lit', '');

    // AND THEN PAST THE GLOW, because the tell above is about the mechanism
    // and this is about what the drafter sees.
    await page.waitForTimeout(2600);
    await expect(page.locator('#drivethru'),
      'the choice still stands, so the foot bone does not call the board back '
      + 'over a trace in progress').toHaveAttribute('data-shut', '');
  });

test('the bone re-arms the trace, so a tool picked in between does not eat it',
  async ({ page }) => {
    await newPageOnSavedHouse(page);
    await pickHouseType(page);

    // THE WANDER. The tile armed the trace; the drafter then reaches for a
    // tool, changes his mind and goes back to the window to press the bone.
    // Without the re-arm the board comes down over whatever he was last
    // holding and his corners are drawn as WALLS -- a wrong drawing rather
    // than a missing feature, and a worse answer than the silence this rung
    // replaced.
    await h.armWall(page);
    expect(await h.wallArmed(page), 'the wall tool really is holding the '
      + 'presses before the bone').toBe(true);

    await page.locator('#dt-bone').click();
    await expect(page.locator('#drivethru')).toHaveAttribute('data-shut', '');

    await traceLoop(page, SQUARE);
    await saveOnNewPage(page);

    const master = houseMaster(await savedFile(page));
    expect(master, 'the loop became an outline master, not four walls')
      .not.toBeNull();
    expect(master.points).toHaveLength(4);
  });

// ── U, THE OLD PAGE'S OWN KEY ─────────────────────────────────────────────
//
// Movie, 18 Sep: "check the model.dc file it has a tool was U before". It is
// U (profile-manager.js, `outline: 'U'`), and the old page has no OUTLINE
// button to go with it -- its column is the same seventeen keys this page
// draws. So the drafter's way to a trace that is not a house-type press is
// the letter, and on this page the letters were painted and dead.

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
