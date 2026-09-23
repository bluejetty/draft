// The PROJECT page's build defaults and zones (boards #158/#187/#221): the
// live typical wall-section detail redraws as numbers change, ZONE HEIGHTS
// edit both ways (local elevation vs offset from MAIN FL) and persist, and
// the sidebar level cards keep showing the SAME values the page sets — one
// source of truth, no forked data.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// The module's own constants, loaded the way proto/ loads it: from source,
// under a stub window. Asserting a derive against numbers typed into this
// file would only prove the two agree today.
const P = (() => {
  const saved = global.window;
  global.window = {};
  delete require.cache[require.resolve('../project-page.js')];
  require('../project-page.js');
  const api = global.window.DraftProjectPage;
  global.window = saved;
  return api;
})();

// Switching the open type the way a drafter does -- the small card, not a
// reload -- so a test that has to touch two bands crosses between them on the
// page's own mechanism.
const selectType = (page, type) =>
  page.locator(`.type-card[data-type="${type}"]`).click();

// ONE TYPE IS OPEN AT A TIME NOW. The PROJECT page opens on the first card
// in Movie's order -- DETACHED GARAGE -- so a test that drives the bungalow's
// detail has to select it, exactly as a drafter would. Arriving through
// MODEL's button carries no ?type=, which is why this is a click and not a
// query string: it is the same path a person takes.
async function openProjectPage(page) {
  await page.locator('[data-project-open]').click();
  await page.waitForURL(/PROJECT\.html/);
  await page.locator('.type-card[data-type="bungalow"]').click();
  await expect(page.locator('[data-detail-input="pitch"]')).toBeVisible();
}

async function commitDetail(page, name, value) {
  const input = page.locator(`[data-detail-input="${name}"]`);
  await input.fill(value);
  await input.dispatchEvent('change');
}

test('a build-default edit redraws the detail — the anchors move with the parts', async ({ page }) => {
  await h.openModel(page);
  await openProjectPage(page);

  // MEASURE WHAT STILL RIDES AN ANCHOR. The word columns are gone (Movie,
  // 17 Sep): the schedule names every number, so no grey margin label is
  // left to measure -- except the beside-the-line annotations, and (PILE)
  // rides the garage pile, which hangs off the house footing. Same claim as
  // before: change a number and the drawing re-anchors.
  const tagY = async name => (await page
    .locator(`.detail-tag`, { hasText: name }).first().boundingBox()).y;
  const pileBefore = await tagY('(PILE)');

  // A much shorter foundation wall: the footing climbs and the garage's
  // grade beam and piles climb with it. The detail is drawn small beside the
  // section table, so a few pixels of travel is the whole four feet.
  await commitDetail(page, 'fdnHeight', `4'-0"`);
  await expect(page.locator('#status')).toContainText('saved');

  expect(Math.abs(await tagY('(PILE)') - pileBefore)).toBeGreaterThan(2);

  // Garbage never sticks: the box snaps back to the stored number.
  await commitDetail(page, 'pitch', 'steep');
  await expect(page.locator('[data-detail-input="pitch"]')).toHaveValue('4');
});

// THE POUR AND THE PLATE ARE TWO NUMBERS. Movie, 16 Sep, reading the label
// off his own section: "i noticed it says foundation 8'1.5\" the foundation
// should be 8' and then the sill plat is 1.5\" (in that area with ATTACHEMENT
// TYPES and the LADDER is an option we should put in ATTACHMENT HEIGHT 1.5\"
// default and allow them to change it)".
//
// WHAT THE STORED NUMBER STILL IS: the bearing line, 8'-1 1/2". MODEL.dc.html
// stands its foundation walls at levelAssemblies[1].wallHeightFt with no plate
// of its own, and a stair's rise is measured to it -- lowering it to the pour
// drops every modelled main floor 1 1/2" and shortens the stair reaching it,
// which is what build-stair-openings.spec.js said when this was tried that
// way. So the split is in what PROJECT SHOWS, and this test pins both halves
// at once: the box says 8'-0", the file says 8'-1 1/2".
test('FDN WALL HT is the pour and the attachment is its own typed number', async ({ page }) => {
  await h.openModel(page);
  await openProjectPage(page);

  await expect(page.locator('[data-detail-input="fdnHeight"]')).toHaveValue(`8'-0"`);
  await expect(page.locator('[data-detail-input="attachmentHeight"]')).toHaveValue('1 1/2"');

  // TYPED BACK AT ITS OWN VALUE, because a fresh page has saved nothing and
  // the claim is about the WRITE as much as the read: 8'-0" in the box has
  // to store the bearing line, not the pour.
  await commitDetail(page, 'fdnHeight', `8'-0"`);
  await expect(page.locator('#status')).toContainText('saved');

  const saved = await h.savedDrawing(page);
  expect(saved.levelAssemblies['1'].wallHeightFt)
    .toBeCloseTo(8 + 1.5 / 12, 5);
});

// A TALLER PLATE RAISES THE FLOOR, IT DOES NOT EAT THE CONCRETE. Written as
// the pair -- pour unchanged, bearing line up by the difference -- because
// either half alone passes on the arithmetic that gets the other one wrong.
test('a typed attachment height keeps the pour and lifts the bearing line', async ({ page }) => {
  await h.openModel(page);
  await openProjectPage(page);

  await commitDetail(page, 'attachmentHeight', '3"');
  await expect(page.locator('#status')).toContainText('saved');
  await expect(page.locator('[data-detail-input="fdnHeight"]')).toHaveValue(`8'-0"`);

  const saved = await h.savedDrawing(page);
  expect(saved.foundationAttachmentIn).toBeCloseTo(3, 5);
  expect(saved.levelAssemblies['1'].wallHeightFt).toBeCloseTo(8 + 3 / 12, 5);

  // And it survives the reload, in both boxes.
  await page.reload();
  await expect(page.locator('[data-detail-input="attachmentHeight"]')).toHaveValue('3"');
  await expect(page.locator('[data-detail-input="fdnHeight"]')).toHaveValue(`8'-0"`);
});

test('a wall height set on the PROJECT page lands in the saved assembly', async ({ page }) => {
  await h.openModel(page);
  await openProjectPage(page);

  await commitDetail(page, 'wallHeight-3', `9'-2"`);
  await expect(page.locator('#status')).toContainText('saved');

  const saved = await h.savedDrawing(page);
  expect(saved.levelAssemblies['3'].wallHeightFt).toBeCloseTo((9 * 12 + 2) / 12, 5);
});

// AND THE WALLS ALREADY STANDING ON THAT HEIGHT COME UP WITH IT.
//
// Movie, 19 Sep: "if the floor or ceiling is the same height as the DEFAULT,
// if they change the PROJECT DEFAULT, also change those heights to match",
// and in the same breath, about the rest: "(the user may need to manually
// change the 'previously adjusted' height".
//
// UNTIL NOW THE NUMBER WENT ONE WAY. A wall's top is copied in at the moment
// it is drawn, from its storey's wallHeightFt, and never looked at again --
// on BOTH pages -- so raising MAIN FL moved nothing already on the sheet and
// the drafter's only remedy was to redraw the house.
//
// THE ARITHMETIC IS NOT TESTED HERE. wallsFollowingHeights is a pure function
// in level-assembly.js with proto/wall-height-follow-harness.js on it: twelve
// checks, seven mutations, including the one that caught the first draft
// dragging the walls of a storey this page has never heard of. What THIS
// measures is the wiring -- that PROJECT's save actually calls it, against
// the file it just re-read, and that the result reaches the store.
test('the walls that were standing on the storey-s height come up with it',
  async ({ page }) => {
    await h.openModel(page);

    // A FIXTURE, NOT THE STARTER HOUSE, and the heights are written out
    // rather than read off the office default: the claim is "8 became 9'-2"
    // and 10 did not", and a fixture that borrowed whatever the module
    // currently defaults to would make the check depend on a number it is
    // not about. ONE WALL AT 10 so "they all moved" and "the ones on the
    // storey-s height moved" cannot be the same measurement.
    const FIXTURE = {
      version: 1,
      levels: [
        { id: 7, name: 'ROOF', elev: 0 },
        { id: 5, name: '2ND FL', elev: 9 },
        { id: 3, name: 'MAIN FL', elev: 0 },
        { id: 1, name: 'FOUNDATION', elev: -8 },
      ],
      activeLevelIdx: 3,
      levelAssemblies: { 3: { wallHeightFt: 8 }, 5: { wallHeightFt: 8 } },
      walls: [
        { id: 1, levelId: 3, view: 'plan', wallType: 'stud_2x6',
          baseHeight: 0, topHeight: 8, refLine: 'center',
          start: { x: 0, z: 0 }, end: { x: 20, z: 0 } },
        { id: 2, levelId: 3, view: 'plan', wallType: 'stud_2x6',
          baseHeight: 0, topHeight: 8, refLine: 'center',
          start: { x: 20, z: 0 }, end: { x: 20, z: 20 } },
        { id: 3, levelId: 3, view: 'plan', wallType: 'stud_2x6',
          baseHeight: 0, topHeight: 10, refLine: 'center',
          start: { x: 20, z: 20 }, end: { x: 0, z: 20 } },
        { id: 4, levelId: 5, view: 'plan', wallType: 'stud_2x6',
          baseHeight: 0, topHeight: 8, refLine: 'center',
          start: { x: 0, z: 0 }, end: { x: 20, z: 0 } },
      ],
      lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
      outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
      roomTags: [], columns: [], beams: [], boneyardOutlines: [],
      boneyardShelves: [], groups: [], levelLocks: [], underlays: [],
    };
    await page.evaluate(async ({ bucket, d }) => {
      await window.SharedFileStore.saveSharedFile(
        new File([JSON.stringify(d)], 'drawing.json',
          { type: 'application/json' }), bucket);
    }, { bucket: 'model-drawing', d: FIXTURE });

    await page.goto('/PROJECT.html?type=bungalow');
    await expect(page.locator('[data-detail-input="pitch"]')).toBeVisible();
    await commitDetail(page, 'wallHeight-3', `9'-2"`);
    await expect(page.locator('#status')).toContainText('saved');

    const after = await h.savedDrawing(page);
    const wantFt = (9 * 12 + 2) / 12;
    expect(after.levelAssemblies['3'].wallHeightFt).toBeCloseTo(wantFt, 5);

    const top = id => after.walls.find(w => Number(w.id) === id).topHeight;
    expect(top(1), 'a wall standing on the storey-s height did not come up')
      .toBeCloseTo(wantFt, 5);
    expect(top(2)).toBeCloseTo(wantFt, 5);
    expect(top(3),
      'a wall the drafter set himself is his -- the default leaves it behind, '
      + 'which is what WALL PROPERTIES is for')
      .toBe(10);
    expect(top(4), 'a storey nobody touched keeps every wall on it').toBe(8);

    // AND NOTHING ELSE IN THE FILE MOVED. This page writes its own keys onto
    // a freshly re-read file precisely so a house drawn in the Model Space
    // beside an open PROJECT tab is not flattened; the walls are the first
    // thing it has ever touched outside those keys, so the rest is asserted.
    expect(after.walls.map(w => `${w.id}:${w.start.x},${w.end.x}:${w.wallType}`))
      .toEqual(FIXTURE.walls.map(w => `${w.id}:${w.start.x},${w.end.x}:${w.wallType}`));
    expect(after.levels).toEqual(FIXTURE.levels);
  });

// THE GARAGE'S DROP BRANCHES ON THE BUILD TYPE, and until NEW-5 landed it
// could not. Movie, 4 Sep: a BILEVEL puts the garage sill LEVEL with the
// house's; a BUNGALOW or 2 STOREY drops it 2'-0". Neither is a rule -- "on
// bilevel could change but not often, 95% inline", "on bungalow 95% not
// inline (opposite)" -- so both are defaults and both stay typeable. What
// this pins is which default a drawing starts from.
//
// Written as a DIFFERENTIAL rather than two absolute readings. Each branch on
// its own would pass against a build that ignored buildType entirely, since
// one of them is what the derive did before; the claim is that the two come
// out a garage drop apart, and only a real branch does that.
//
// AND THE FOUNDATION IS THE SECOND INPUT, since 16 Sep. Movie, on the
// bungalow's own section: "move the sill plate for grade beam inline with
// house". A grade beam is cast at one level on its piles -- there is no stem
// to step down -- so the 2'-0" belongs to the FROST WALL. The differential
// below therefore reads the frost wall, and a second test says a grade beam
// is inline on both build types, which is what the drawing now does.
async function attachedOffsetWithType(page, type, foundation = 'frostwall') {
  await page.evaluate(async ([bucket, buildType, garageFoundation]) => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const drawing = file ? JSON.parse(await file.text())
      : { version: 1, levels: [{ id: 3, name: 'MAIN FL', elev: 0 }] };
    drawing.buildType = buildType;
    // WRITTEN IN, NOT WRITTEN OVER. A fresh drawing has no section table at
    // all, so guarding this on the row existing would silently leave every
    // case on the default foundation and the two branches below would read
    // the same number and agree for the wrong reason.
    drawing.sectionTable = drawing.sectionTable || {};
    drawing.sectionTable.rows = drawing.sectionTable.rows || {};
    drawing.sectionTable.rows.attachedGarage = {
      ...drawing.sectionTable.rows.attachedGarage,
      garageFoundation,
    };
    // The zone must be UNSET, or a stored override would answer instead of
    // the derive and the test would pass on any build at all.
    if (drawing.zoneHeights?.zones?.attachedGarage) {
      drawing.zoneHeights.zones.attachedGarage.offsetFt = null;
    }
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(drawing)], file?.name || 'model-drawing.json',
        { type: 'application/json' }), bucket);
  }, [h.STORAGE_BUCKET, type, foundation]);
  await page.goto('/PROJECT.html?type=bungalow');
  // THE ZONE CARD IS GONE (Movie, 23 Sep) and this box is what is left. It
  // reads SILL TO SILL -- against the house's foundation sill -- where the
  // zone row read against MAIN FL, one main-floor package higher. Both
  // assertions below are DIFFERENCES between two of these, so the datum
  // cancels and they are unchanged; the one absolute expectation moved with
  // the datum and says so.
  return page.locator('[data-detail-input="garageOffset"]').inputValue();
}

const offsetFt = text => {
  const m = /^(-?)(\d+)'-(\d+)(?:\s+(\d+)\/(\d+))?"/.exec(text.trim());
  if (!m) throw new Error(`unparsed offset: ${text}`);
  const inches = Number(m[3]) + (m[4] ? Number(m[4]) / Number(m[5]) : 0);
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) + inches / 12);
};

test('over a frost wall a bilevel sits level with the house and a bungalow drops', async ({ page }) => {
  await h.openModel(page);

  const bungalow = await attachedOffsetWithType(page, 'bungalow', 'frostwall');
  const bilevel = await attachedOffsetWithType(page, 'bilevel', 'frostwall');

  // The two must differ, and by exactly the garage drop: the bilevel sits
  // level with the house sill, the bungalow a GARAGE_SILL_BELOW_HOUSE_FT
  // below it. Parsed from the feet-and-inches the box shows.
  expect(offsetFt(bungalow)).toBeCloseTo(offsetFt(bilevel) - P.GARAGE_SILL_BELOW_HOUSE_FT, 5);
});

// A GRADE BEAM IS INLINE WHATEVER THE HOUSE IS. Movie, 16 Sep, on the
// bungalow band: "move the sill plate for grade beam inline with house".
// Paired with the frost-wall test above deliberately -- either one alone
// would pass on a build that had dropped the branch it does not exercise,
// and the claim is that BOTH inputs are read.
test('on a grade beam the garage sill is inline on either build type', async ({ page }) => {
  await h.openModel(page);

  const bungalow = await attachedOffsetWithType(page, 'bungalow', 'gradebeam');
  const bilevel = await attachedOffsetWithType(page, 'bilevel', 'gradebeam');

  expect(offsetFt(bungalow)).toBeCloseTo(offsetFt(bilevel), 5);
  // And inline means the HOUSE SILL, not merely "the same as each other".
  // Sill to sill that is ZERO -- which is the same claim the old MAIN-FL
  // datum made as -(11.875 + 0.75)/12, said in the datum the box now uses.
  expect(offsetFt(bungalow)).toBeCloseTo(0, 5);
});

// THE GARAGE'S TYPED NUMBER READS SILL TO SILL. Movie, 16 Sep: "lets make it
// garage sill off foundation sill (its usually to the ft and makes more
// sense)" — so the one visible offset row measures against the HOUSE's
// foundation sill, and the two MAIN FL rows (sill and the floor row that
// never held a floor) retired with the datum change.
test('the garage sill reads off the foundation sill and the MAIN FL rows are gone', async ({ page }) => {
  await page.goto('/PROJECT.html?type=bungalow');
  const rows = label => page.locator('#sched-garage .sched-row')
    .filter({ has: page.locator('.sched-name', { hasText: label }) });
  await expect(rows('Garage sill off foundation sill')).toHaveCount(1);
  await expect(rows('Garage sill off main fl')).toHaveCount(0);
  await expect(rows('Garage floor off main fl')).toHaveCount(0);

  // NOT BLANK: the number is the drafter's, so the box has to show it.
  const box = rows('Garage sill off foundation sill').locator('.sched-value');
  expect((await box.inputValue()).trim()).not.toBe('');
});

// AND THE STORE DID NOT MOVE. The box converts at the boundary: a typed 0
// means "on the house's foundation sill", which off MAIN FL is one main-floor
// package down — the persisted key stays MAIN-FL-relative so the section and
// every older reader keep the datum they had.
test('a typed 0 lands the sill on the house sill, stored off MAIN FL', async ({ page }) => {
  await h.openModel(page);
  await openProjectPage(page);

  const box = page.locator('[data-detail-input="garageOffset"]');
  await box.fill(`0'-0"`);
  await box.dispatchEvent('change');

  const house = -(11.875 + 0.75) / 12;   // main joists + sheathing, in feet
  await expect.poll(async () =>
    (await h.savedDrawing(page)).zoneHeights?.zones?.attachedGarage?.offsetFt)
    .toBeCloseTo(house, 5);
  // The box still shows the number the drafter typed, in its own datum.
  expect(offsetFt(await box.inputValue())).toBeCloseTo(0, 5);
});

// THE BUILDING METHOD, owned by the family buttons now. The Building method
// radios retired 16 Sep — "they can select below" — so the family rows on
// the section cards are this page's one door onto buildType, the same key
// the drive-thru sets. One at a time, and it reaches the file.
test('a family press sets the building method, one at a time, and it saves',
  async ({ page }) => {
    await h.openModel(page);
    await openProjectPage(page);

    // NOTHING GLOWS YET, AND THE CARD CLICK ABOVE DOES NOT CHANGE THAT.
    // Since 23 Sep a card press chooses the TYPE (Movie: "AND CHOOSE it
    // too") -- but only the type. A button lights when the type AND the
    // garage plan match an entry, and the card says nothing about a garage,
    // so the row stays dark until the drafter presses in it. That is the
    // rule the row's own comment asks for: "a bare type lights nothing
    // until somebody presses".
    await expect(page.locator('.family-button[aria-pressed="true"]')).toHaveCount(0);

    // THE BILEVEL FAMILY LIVES IN THE BILEVEL SECTION, so this press needs
    // that section open. Crossing over and back is the point of the test as
    // much as the press is: "one at a time" is a claim about two bands, and
    // it is now also a claim that the choice survives the switch between them.
    await selectType(page, 'bilevel');
    await page.locator('[data-family-entry="bilevel-garage"]').click();
    await expect(page.locator('[data-family-entry="bilevel-garage"]'))
      .toHaveAttribute('aria-pressed', 'true');

    // IT REACHED THE FILE, not just the button. This page's save merges its
    // own keys onto the stored drawing, so a key it does not own is dropped
    // silently -- exactly what happened to buildType before this landed.
    await expect.poll(async () => (await h.savedDrawing(page)).buildType,
      { message: 'the chosen method never reached the drawing' })
      .toBe('bilevel');

    // And the choice is not merely recorded: the garage sill derive branches
    // on it, so a page that stored the word and carried on deriving the
    // bungalow rule fails here.
    //
    // OVER A FROST WALL, since 16 Sep: a grade beam is inline whichever the
    // house is, so the build type only moves the sill on the wall that has a
    // stem to step down. Set here rather than in the fixture so the change
    // goes through the page's own control.
    // BACK TO THE BUNGALOW SECTION WITHOUT CHOOSING IT, which is the whole
    // point of the distinction the page draws: a card press switches a type
    // it can switch, a URL visit only shows one. Crossing back by pressing
    // the BUNGALOW card would land the type on `bungalow` here -- and then
    // the press below could not move the sill, because the sill would
    // already be the bungalow's. The controls beneath live in band 1; the
    // TYPE has to still be bilevel when they are read.
    await page.goto('/PROJECT.html?type=bungalow');
    await expect(page.locator('[data-family-entry="bilevel-garage"]'))
      .toHaveAttribute('aria-pressed', 'true');

    const foundation = page.locator('[data-detail-input="garageFoundationType"]');
    await foundation.selectOption('frostwall');
    await foundation.dispatchEvent('change');
    const offset = await page.locator('[data-detail-input="garageOffset"]').inputValue();

    await page.locator('[data-family-entry="bungalow-garage"]').click();
    await expect(page.locator('[data-family-entry="bilevel-garage"]'))
      .toHaveAttribute('aria-pressed', 'false');
    expect(await page.locator('[data-detail-input="garageOffset"]').inputValue(),
      'the garage sill did not follow the method change')
      .not.toBe(offset);

    // Survives the reload, which is the whole claim of "project data".
    await expect.poll(async () => (await h.savedDrawing(page)).buildType)
      .toBe('bungalow');
    await page.reload();
    await expect(page.locator('[data-family-entry="bungalow-garage"]'))
      .toHaveAttribute('aria-pressed', 'true');
  });

// THE TWO DOORS, AND WHICH ONE WINS. Last press, and the trap it avoids is
// the one the old omission was there to prevent: a PROJECT tab open on a
// stale read must not flatten a method chosen in MODEL meanwhile. It cannot,
// because the save re-reads the stored file and merges -- so the method only
// changes when someone presses one HERE.
test('a method chosen elsewhere is not clobbered by an unrelated PROJECT save',
  async ({ page }) => {
    await h.openModel(page);
    await openProjectPage(page);
    await expect(page.locator('.family-button[aria-pressed="true"]')).toHaveCount(0);

    // MODEL's press, arriving underneath the open page. A drawing nobody has
    // saved yet has no file at all -- MODEL writes one on its first edit --
    // so this plants the skeleton the press would have written.
    await page.evaluate(async bucket => {
      const file = await window.SharedFileStore.loadSharedFile(bucket);
      const drawing = file ? JSON.parse(await file.text())
        : { version: 1, levels: [{ id: 3, name: 'MAIN FL', elev: 0 }] };
      drawing.buildType = 'twoStorey';
      await window.SharedFileStore.saveSharedFile(
        new File([JSON.stringify(drawing)], file?.name || 'model-drawing.json',
          { type: 'application/json' }), bucket);
    }, h.STORAGE_BUCKET);

    // An edit on this page that has nothing to do with the method.
    //
    // THE FIELD IS IN THE PROJECT INFO RAIL NOW (23 Sep), shut by default, so
    // the tab comes first. This file has its OWN openProjectPage -- the one
    // that picks a bungalow and waits on the pitch input -- and it never
    // touches the identity fields, so patching the OTHER file's helper did
    // not reach this test. I assumed it did and the run said otherwise.
    await page.locator('#left-tab').click();
    const name = page.locator('[data-project-name]');
    await name.fill('BONEYARD ROAD');
    await name.dispatchEvent('change');
    await expect(page.locator('#status')).toContainText('saved');

    expect((await h.savedDrawing(page)).buildType,
      'an unrelated PROJECT save reset the method chosen in the model space')
      .toBe('twoStorey');

    // AND NOTHING GLOWS FALSELY. A family button says the type AND the
    // garage plan, and the planted drawing never said a plan -- so the row
    // stays dark rather than answering the half it does not know.
    await expect(page.locator('.family-button[aria-pressed="true"]')).toHaveCount(0);
  });
