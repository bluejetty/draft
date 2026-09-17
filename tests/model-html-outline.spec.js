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

// Press corners WITHOUT closing, which is the state the colour is about: a
// committed outline is a level copy in the scope colours, and the family's
// colour only ever shows while the loop is still in the drafter's hands.
async function traceCorners(page, corners) {
  const frame = await h.planFrame(page);
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
async function traceLoop(page, corners) {
  const frame = await h.planFrame(page);
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
  await expect(page.locator('#strip-message'))
    .toContainText('Detached garages are not on this page yet');

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
