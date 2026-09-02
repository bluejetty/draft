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
  'sectionTable', 'boneyardShelves', 'activeBoneyardShelfId',
  'nextBoneyardShelfId', 'boneyardOutlines', 'outlines', 'levels',
  'activeLevelIdx', 'levelLayerViews', 'nextLevelId', 'backgroundLevelIds',
  'backgroundLevelViews', 'contextBackgrounds', 'backgroundMode', 'units',
  'drawingOrigin', 'siteRegistration', 'lineLayers', 'activeLineLayer',
  'activeWallType', 'wallRefLine', 'wallBaseHeight', 'wallTopHeight',
  'floorThickness', 'levelAssemblies', 'roofOverhang', 'roofPitch',
  'elevationDatum', 'elevationNames', 'elevationMarkOffsets', 'cuts',
  'nextCutId', 'groups', 'nextGroupId', 'nextDrawingItemId', 'underlays',
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
    const added = Object.keys(saved).filter(k => !PERSISTED_KEYS.includes(k) && k !== 'layout');
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
});
