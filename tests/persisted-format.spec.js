// THE SAVED FORMAT'S KEY NAMES, PINNED ON PURPOSE.
//
// Deep-clean item 6. Twenty spec files read `saved.boneyardOutlines` today and
// would fail if that key were renamed -- but they guard it BY ACCIDENT, testing
// garages and build links and happening to name it along the way. The guard
// disappears the day someone rewrites garage.spec.js. This file turns the
// accident into a guarantee, and says so.
//
// Three separate things are pinned here, in rising order of what they cost if
// they break:
//
//   1. THE FULL KEY SET -- a tripwire. Renaming or dropping a key fails here
//      first, so it becomes a deliberate act with a diff to argue about rather
//      than a silent format change.
//
//   2. THE CROSS-PAGE KEYS -- fifteen of the sixty-three are read by a page
//      OTHER than MODEL. Renaming one of those does not break MODEL at all; it
//      breaks LAYOUT, or PROJECT, or SPECS, quietly, on a drawing that still
//      opens fine. Each is listed with its reader.
//
//   3. THE `layout` ROUND TRIP -- the one that can cost a drafter real work,
//      and the reason this file exists rather than a comment. LAYOUT does not
//      have its own store: it merges a `layout` key INTO MODEL's drawing
//      (LAYOUT.dc.html, `{ ...base, layout: this._layoutKey() }`) and writes it
//      back to the model-drawing bucket. MODEL's _serializeDrawing builds a
//      fresh object from its own fields and does NOT spread what it loaded, so
//      that key survives only because two lines deliberately carry it:
//
//        MODEL.dc.html  this._layoutData = saved.layout ? format.layout(...)
//        MODEL.dc.html  ...(this._layoutData ? { layout: this._layoutData } : {})
//
//      Delete either and MODEL still passes every test it has, while silently
//      deleting the drafter's entire sheet set the next time they save a wall.
//      Nothing named that contract until this spec.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// Every top-level key _serializeDrawing writes, plus `layout`, which LAYOUT
// writes and MODEL only passes through. Read off the running app, not typed
// from memory.
const PERSISTED_KEYS = [
  'version', 'lines', 'walls', 'floors', 'shapes', 'roofs', 'fenestrations',
  'electricDevices', 'fixtures', 'surfaceOpenings', 'dimensions',
  'nextDimensionId', 'columns', 'nextColumnId', 'beams', 'nextBeamId',
  'stairs', 'nextStairId', 'notes', 'nextNoteId', 'roomTags', 'nextRoomTagId',
  'roomAreasOn', 'projectInfo', 'tour', 'roofIntent', 'zoneHeights',
  'sectionTable', 'buildType', 'autoDimFirstOffsetFt',
  'boneyardShelves', 'activeBoneyardShelfId',
  'nextBoneyardShelfId', 'boneyardOutlines', 'outlines', 'levels',
  'activeLevelIdx', 'levelLayerViews', 'nextLevelId', 'backgroundLevelIds',
  'backgroundLevelViews', 'contextBackgrounds', 'backgroundMode', 'units',
  'drawingOrigin', 'siteRegistration', 'lineLayers', 'activeLineLayer',
  'activeWallType', 'wallRefLine', 'wallBaseHeight', 'wallTopHeight',
  'floorThickness', 'levelAssemblies', 'roofOverhang', 'roofPitch',
  'elevationDatum', 'elevationNames', 'elevationMarkOffsets', 'cuts',
  'nextCutId', 'groups', 'nextGroupId', 'nextDrawingItemId', 'underlays',
  // Board #315, the second tier of grouping: assemblies on different
  // floors that hold the same plan position. See
  // RD-DOCUMENTS/RULES-persisted-keys.md.
  'levelLocks', 'nextLevelLockId',
];

// The subset another page reads. Renaming one of these leaves MODEL working
// and breaks somebody else.
const CROSS_PAGE = {
  lines: ['MODEL.html'],
  walls: ['LAYOUT', 'PROJECT', 'MODEL.html'],
  floors: ['LAYOUT', 'MODEL.html'],
  roofs: ['LAYOUT'],
  fenestrations: ['LAYOUT'],
  projectInfo: ['SPECS'],
  boneyardShelves: ['LAYOUT'],
  boneyardOutlines: ['LAYOUT'],
  outlines: ['LAYOUT'],
  levels: ['LAYOUT', 'PROJECT', 'MODEL.html'],
  units: ['LAYOUT'],
  activeWallType: ['PROJECT'],
  levelAssemblies: ['LAYOUT', 'PROJECT'],
  elevationDatum: ['LAYOUT'],
  cuts: ['LAYOUT'],
};

async function houseAndSave(page) {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);
  // BUILD HOUSE pulls the outline down to FOUNDATION and offers the tour
  // popup; it covers the tools until it is climbed.
  await h.climbTourToMain(page);
  return h.savedDrawing(page);
}

test.describe('the saved format', () => {
  test('writes every key this app and its sister pages depend on', async ({ page }) => {
    const saved = await houseAndSave(page);

    // Missing is the failure that matters; a key that vanished is a page that
    // silently lost a feature.
    const missing = PERSISTED_KEYS.filter(k => !(k in saved));
    expect(missing, 'keys _serializeDrawing stopped writing').toEqual([]);

    // Added is not a failure -- the format grows -- but it must be deliberate,
    // so a new key fails here once and gets added to the list with a reason.
    // `layout` and `specs` are the two conditional passthroughs -- MODEL
    // re-emits them but does not author them, so neither belongs in
    // PERSISTED_KEYS and both have to be excused here. Only `layout` was, and
    // `specs` stayed green solely because this flow never loads SPECS data:
    // populate it and this line would have failed for the wrong reason.
    const PASSTHROUGH = ['layout', 'specs'];
    const added = Object.keys(saved)
      .filter(k => !PERSISTED_KEYS.includes(k) && !PASSTHROUGH.includes(k));
    expect(added, 'new persisted keys: add to PERSISTED_KEYS with a note').toEqual([]);
  });

  test('the fifteen cross-page keys are spelled exactly as their readers expect', async ({ page }) => {
    const saved = await houseAndSave(page);
    // Listed one at a time so a failure names the key AND who breaks.
    for (const [key, readers] of Object.entries(CROSS_PAGE)) {
      expect(saved, `${key} is read by ${readers.join(', ')}`).toHaveProperty(key);
    }
  });

  test("MODEL saving does not delete LAYOUT's sheets", async ({ page }) => {
    const saved = await houseAndSave(page);
    const levelId = saved.levels[0].id;
    const linesBefore = (saved.lines || []).length;

    // Stand in for LAYOUT: merge a layout key into the drawing exactly as
    // LAYOUT.dc.html does, with one plan viewport that survives validation.
    await page.evaluate(async ({ bucket, levelId }) => {
      const store = window.SharedFileStore;
      const at = await store.loadSharedFileAt(bucket);
      const drawing = JSON.parse(await at.file.text());
      drawing.layout = {
        paperKey: '11x17', orientation: 'landscape', titleblock: 'bluejetty-band',
        northArrow: false, auto: true, nextViewportId: 2,
        viewports: [{ id: 1, kind: 'plan', pif: 1 / 8, xIn: 4, yIn: 3, sheet: 1, levelId }],
      };
      const file = new File([JSON.stringify(drawing)], 'model-drawing.json',
        { type: 'application/json' });
      await store.saveSharedFile(file, bucket, { ifRev: at.rev });
    }, { bucket: h.STORAGE_BUCKET, levelId });

    // Come back to MODEL as a drafter would, and draw one line.
    await page.reload();
    await h.waitForModelReady(page);
    // Enter COMMITS the line; Escape cancels it. The first version of this
    // pressed Escape, drew nothing, and -- with the swallowed catches -- still
    // reported a pass.
    await h.selectTool(page, 'Line');
    await h.clickWorld(page, -20, -20);
    await h.clickWorld(page, -10, -20);
    await page.keyboard.press('Enter');
    await h.waitForSaved(page);

    const after = await h.savedDrawing(page);

    // THE CONTROL, AND THE WHOLE REASON THIS TEST IS WORTH ANYTHING.
    //
    // The first version of this spec asserted `after.layout` and passed with
    // MODEL's re-emit line DELETED -- proven by mutation. It had three
    // swallowed `.catch(() => {})` calls around the edit, so when the edit did
    // not happen nothing was saved, the stored drawing was still the one this
    // test injected, and the layout key it read back was its own.
    //
    // Asserting the end state proves nothing unless the operation ran. This
    // line proves MODEL rewrote the bucket: a line exists now that did not
    // before, and it can only have got there through _serializeDrawing.
    expect((after.lines || []).length,
      'MODEL never saved, so this test is not measuring a round trip')
      .toBeGreaterThan(linesBefore);

    // NOW the assertion means something: MODEL wrote the drawing, and the
    // sheet set LAYOUT put there survived it.
    expect(after.layout, "LAYOUT's layout key was dropped by a MODEL save").toBeTruthy();
    expect(after.layout.viewports.length,
      'the viewport LAYOUT placed is gone').toBe(1);
    expect(after.layout.viewports[0].levelId).toBe(levelId);
    expect(after.layout.paperKey).toBe('11x17');
    expect(after.layout.titleblock, 'the titleblock id LAYOUT chose').toBe('bluejetty-band');
    // `auto` is the flag Movie's composition contract raises and a manual touch
    // clears; it has to survive the round trip or the composer re-deals a
    // hand-arranged sheet.
    expect(after.layout.auto).toBe(true);
  });

  // W0 FINDING C. `specs` is `layout`'s twin and had no test of any kind.
  //
  // Same three-site passthrough shape -- read at load (MODEL.dc.html:5402),
  // restored from history (:6135), re-emitted at save (:3436) -- and the same
  // consequence if the re-emit line goes: the drafter's saved work disappears
  // the next time they touch a wall, with nothing red.
  //
  // What is in there matters for how bad that is. drawing-format.js only
  // persists a project's DIFFERENCES from the office master: a section this
  // job switched off, a section it reworded, a section it added that the
  // master has no idea about. A project that agrees with the master stores
  // nothing at all. So the specs key holds exactly the part of the
  // specification that is this job's and exists nowhere else -- there is no
  // master to fall back on for it, which is the whole point of the shape.
  //
  // Mirrors the layout round trip above, including its control. The control is
  // the load-bearing half: asserting `after.specs` proves nothing unless MODEL
  // actually rewrote the bucket, or the test reads back its own injection and
  // passes with the re-emit deleted.
  test("MODEL saving does not delete SPECS' project sections", async ({ page }) => {
    const saved = await houseAndSave(page);
    const linesBefore = (saved.lines || []).length;

    // Stand in for SPECS: one section switched off, one reworded, one added.
    // All three survive drawing-format's normaliser -- an added section needs
    // a division or it loads and never prints, so 6 is real, not filler.
    await page.evaluate(async ({ bucket }) => {
      const store = window.SharedFileStore;
      const at = await store.loadSharedFileAt(bucket);
      const drawing = JSON.parse(await at.file.text());
      drawing.specs = {
        sections: [
          { id: '06-10-00', off: true },
          { id: '07-21-00', body: 'Batt insulation to R-24 in all exterior walls.' },
          { id: '99-01-00', added: true, div: 6, kind: 'notes',
            title: 'SITE-SPECIFIC CARPENTRY', body: 'Stair stringers cut on site.' },
        ],
      };
      const file = new File([JSON.stringify(drawing)], 'model-drawing.json',
        { type: 'application/json' });
      await store.saveSharedFile(file, bucket, { ifRev: at.rev });
    }, { bucket: h.STORAGE_BUCKET });

    // Come back to MODEL as a drafter would, and draw one line. Enter COMMITS.
    await page.reload();
    await h.waitForModelReady(page);
    await h.selectTool(page, 'Line');
    await h.clickWorld(page, -20, -20);
    await h.clickWorld(page, -10, -20);
    await page.keyboard.press('Enter');
    await h.waitForSaved(page);

    const after = await h.savedDrawing(page);

    // THE CONTROL. Without it this test passes on a MODEL that never saved.
    expect((after.lines || []).length,
      'MODEL never saved, so this test is not measuring a round trip')
      .toBeGreaterThan(linesBefore);

    expect(after.specs, "SPECS' project sections were dropped by a MODEL save")
      .toBeTruthy();
    const sections = after.specs.sections || [];
    expect(sections.length, 'a project section went missing').toBe(3);

    const byId = Object.fromEntries(sections.map(section => [section.id, section]));

    // Each of the three shapes checked on its own terms -- they are stored
    // differently and a normaliser can lose one while keeping the others.
    expect(byId['06-10-00'], 'the section this job switched off').toBeTruthy();
    expect(byId['06-10-00'].off).toBe(true);

    expect(byId['07-21-00'], 'the section this job reworded').toBeTruthy();
    expect(byId['07-21-00'].body, "the drafter's wording, not the master's")
      .toContain('R-24');

    const addedSection = byId['99-01-00'];
    expect(addedSection, 'the section this job added -- it exists nowhere else')
      .toBeTruthy();
    expect(addedSection.added).toBe(true);
    // Division and title are what decide where an added section prints. A
    // survivor that lost either one loads into the file and never appears.
    expect(addedSection.div, 'an added section with no division cannot print').toBe(6);
    expect(addedSection.title).toBe('SITE-SPECIFIC CARPENTRY');
    expect(addedSection.body).toContain('Stair stringers');
  });

  // NEW-5: `buildType` is exactly bungalow / twoStorey / bilevel /
  // modifiedBilevel, and the reader normalises anything else to "not
  // chosen" rather than guessing. The two translations beside it are what
  // the PROJECT page and the tour read, so a rename there breaks a page.
  test('buildType: the reader normalises what it does not know, and the writer never emits it', async ({ page }) => {
    const saved = await houseAndSave(page);
    // The entry coach's first press stores no type — it is the starter
    // house, not a choice — so a fresh file says "not chosen".
    expect(saved.buildType).toBeNull();

    expect(await page.evaluate(() => {
      const f = window.DraftDrawingFormat;
      return {
        vocabulary: f.BUILD_TYPES,
        unknown: ['castle', 'HOUSE', 'split', 0, {}].map(v => f.buildType(v)),
        rows: f.BUILD_TYPES.map(t => f.sectionRowForBuildType(t)),
        upper: f.BUILD_TYPES.map(t => f.upperFloorForBuildType(t)),
        none: [f.sectionRowForBuildType(null), f.upperFloorForBuildType(null)],
      };
    })).toEqual({
      vocabulary: ['bungalow', 'twoStorey', 'bilevel', 'modifiedBilevel'],
      unknown: [null, null, null, null, null],
      // A bungalow or two-storey is the live HOUSE row; the split family
      // reads its own stored row.
      rows: ['house', 'house', 'bilevel', 'modifiedBilevel'],
      // The tour's climb-or-roof answer: only the bungalow pair says.
      upper: [false, true, null, null],
      none: [null, null],
    });

    // A hand-edited file with a type the app does not know loads as "not
    // chosen", and the next save writes that rather than echoing the word.
    await page.evaluate(async () => {
      const file = await window.SharedFileStore.loadSharedFile('model-drawing');
      const d = JSON.parse(await file.text());
      d.buildType = 'castle';
      await window.SharedFileStore.saveSharedFile(
        new File([JSON.stringify(d)], 'drawing.json', { type: 'application/json' }),
        'model-drawing');
    });
    await page.reload();
    await h.waitForModelReady(page);
    // THE FAMILY BUTTONS, not the type buttons. Since the row became a menu
    // (6 Sep) the types are one press in, so [data-select-build] matches
    // nothing on a closed row -- and a filter over nothing is zero whatever
    // the drawing says. Reading the families keeps this able to fail.
    expect(await page.evaluate(() => [...document.querySelectorAll('[data-build-menu]')]
      .filter(el => el.style.background === 'rgb(29, 31, 32)').length)).toBe(0);
    expect(await page.locator('[data-build-menu]').count()).toBe(3);
    // A units toggle is the cheapest edit that goes through the writer.
    await page.locator('[data-unit-toggle] button').first().click();
    await h.waitForSaved(page);
    expect((await h.savedDrawing(page)).buildType).toBeNull();
  });

  // autoDimFirstOffsetFt LIVED NOWHERE until 6 Sep: the page kept it for the
  // session and never wrote it, so a drafter moved the first auto string,
  // saved, and the viewer drew a different gap than the page they saved from.
  // Commander Devin ruled the shape -- positive(), null means derive -- and
  // this is the spec that makes the ruling true rather than intended.
  test('autoDimFirstOffsetFt: null means derive, a pick round-trips, and a re-normalise never invents', async ({ page }) => {
    await h.openModel(page);

    // A drawing nobody has chosen an offset on stores NULL, not 1.5. This is
    // the half that matters: store the derived value and moving the default
    // later would silently miss every drawing that never chose.
    await page.locator('[data-unit-toggle] button').first().click();
    await h.waitForSaved(page);
    expect((await h.savedDrawing(page)).autoDimFirstOffsetFt).toBeNull();

    // The normaliser keeps null and refuses everything that is not a positive
    // number -- including 0, which is a typed answer that means "no gap" and
    // must not be storable as one.
    expect(await page.evaluate(() => {
      const f = window.DraftDrawingFormat;
      return {
        derived: f.AUTO_DIM_FIRST_OFFSET_FT,
        keeps: f.autoDimFirstOffsetFt(2.5),
        // A QUOTED NUMBER IS NOT A NUMBER, and that is the contract rather
        // than a gap. `num()` requires typeof 'number' throughout this
        // format, so a hand-edited file carrying "2.5" reads as NOT CHOSEN
        // and the page derives -- it does not silently adopt a string as a
        // measurement. Written down because the expectation here originally
        // said 2.5 and the run said null: the code was right and the spec was
        // wrong, and the tempting fix was to delete the line rather than
        // learn what it had found.
        quoted: f.autoDimFirstOffsetFt('2.5'),
        rejects: [null, undefined, 0, -1, 'wide', {}, NaN].map(v => f.autoDimFirstOffsetFt(v)),
      };
    })).toEqual({
      derived: 1.5,
      keeps: 2.5,
      quoted: null,
      rejects: [null, null, null, null, null, null, null],
    });

    // A PICK IS STORED AND SURVIVES A RELOAD, which is the defect this key
    // exists to close.
    // THE PICKER LIVES UNDER THE DIMENSION TOOL (MODEL.dc.html:1246,
    // `dimensionToolActive`), so it has to be selected before the buttons
    // exist. The first version of this assertion was written as "if these
    // buttons exist" and would have skipped here forever, reporting a pass
    // for a round trip it never made -- the same shape as the emptiness
    // assertion found elsewhere in this file today.
    await h.selectTool(page, 'Dimension');
    const offsets = page.locator('[data-auto-dim-offset]');
    await expect(offsets).not.toHaveCount(0);
    const wanted = Number(await offsets.last().getAttribute('data-auto-dim-offset'));
    expect(wanted).toBeGreaterThan(0);
    await offsets.last().click();
    await h.waitForSaved(page);
    expect((await h.savedDrawing(page)).autoDimFirstOffsetFt).toBe(wanted);
    await page.reload();
    await h.waitForModelReady(page);
    expect((await h.savedDrawing(page)).autoDimFirstOffsetFt).toBe(wanted);

    // A hand-edited file with an impossible offset loads as "not chosen" and
    // the next save writes that, rather than echoing the number back.
    await page.evaluate(async () => {
      const file = await window.SharedFileStore.loadSharedFile('model-drawing');
      const d = JSON.parse(await file.text());
      d.autoDimFirstOffsetFt = -4;
      await window.SharedFileStore.saveSharedFile(
        new File([JSON.stringify(d)], 'drawing.json', { type: 'application/json' }),
        'model-drawing');
    });
    await page.reload();
    await h.waitForModelReady(page);
    await page.locator('[data-unit-toggle] button').first().click();
    await h.waitForSaved(page);
    expect((await h.savedDrawing(page)).autoDimFirstOffsetFt).toBeNull();
  });
});
