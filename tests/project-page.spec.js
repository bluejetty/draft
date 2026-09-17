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

async function openProjectPage(page) {
  await page.locator('[data-project-open]').click();
  await page.waitForURL(/PROJECT\.html/);
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

test('zone heights edit both ways against the elevation datum and persist', async ({ page }) => {
  await h.openModel(page);
  // The drafter's usual reference: MAIN FL reads 100'-0". A fresh model has
  // not saved a file yet, so build the envelope if needed.
  await page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const drawing = file ? JSON.parse(await file.text())
      : { version: 1, levels: [{ id: 3, name: 'MAIN FL', elev: 0 }] };
    drawing.elevationDatum = 100;
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(drawing)], file?.name || 'model-drawing.json',
        { type: 'application/json' }), bucket);
  }, h.STORAGE_BUCKET);
  await page.goto('/PROJECT.html');

  // Offset first: -2'-0" off MAIN FL reads locally as 98'-0".
  const offset = page.locator('[data-zone-offset="attachedGarage"]');
  await offset.fill(`-2'-0"`);
  await offset.dispatchEvent('change');
  await expect(page.locator('[data-zone-local="attachedGarage"]')).toHaveValue(`98'-0"`);

  // Local the other way: 97'-6" works out to -2'-6" off MAIN FL.
  const local = page.locator('[data-zone-local="attachedGarage"]');
  await local.fill(`97'-6"`);
  await local.dispatchEvent('change');
  await expect(offset).toHaveValue(`-2'-6"`);

  const saved = await h.savedDrawing(page);
  expect(saved.zoneHeights.zones.attachedGarage.offsetFt).toBeCloseTo(-2.5, 5);
  expect(saved.zoneHeights.zones.bilevel.offsetFt).toBe(0);

  await page.reload();
  await expect(page.locator('[data-zone-offset="attachedGarage"]')).toHaveValue(`-2'-6"`);
  await expect(page.locator('[data-zone-local="attachedGarage"]')).toHaveValue(`97'-6"`);
});

test('grade derives from the attached garage beam and drives the detached garage until overridden', async ({ page }) => {
  await h.openModel(page);
  await page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const drawing = file ? JSON.parse(await file.text())
      : { version: 1, levels: [{ id: 3, name: 'MAIN FL', elev: 0 }] };
    drawing.elevationDatum = 100;
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(drawing)], file?.name || 'model-drawing.json',
        { type: 'application/json' }), bucket);
  }, h.STORAGE_BUCKET);
  await page.goto('/PROJECT.html');

  // GRADE IS NO LONGER A NUMBER OF ITS OWN. It used to default to a flat
  // 1'-0" below the foundation top; an attached garage's beam has to sit 8"
  // above grade, so the garage decides where grade is and the house takes
  // it. Grade is 1'-2" below the garage's top of concrete, and the garage's
  // sill plate is inline with the house's on the grade beam this fixture
  // draws, so it comes out 1'-2" below the foundation top.
  //
  // IT WAS 3'-2" UNTIL 16 SEP, when the grade beam went inline -- the
  // bungalow's garage used to drop 2'-0" and carry grade down with it.
  // Movie, asked what that does to the house's height out of the ground:
  // "grade should be 14\" below the lowest sill plate". Inline means the
  // house's own sill IS the lowest, so the house sits 1'-2" out rather than
  // 3'-2", and a FROST WALL still drops and still takes grade with it.
  //
  // 1'-2", not the 8" MINIMUM, and the two are different jobs. Movie: "if
  // the house is higher out of the ground it is easier to regrade afterwards
  // if there is space... move it to 1'-2" grade to top of concrete so they
  // have 6" to slope around the perimeter". 8" is the line a drafter cannot
  // type past; 1'-2" is where it is drawn; the 6" between them is the room
  // the site has to fall away from the building.
  //
  // Two assertions, deliberately. The first pins the ARITHMETIC against the
  // module's own constants, so moving either one fails here naming which.
  // The second pins what the box actually READS, because a derive that
  // computes correctly and renders wrong is still wrong. Asserting only the
  // second would pass with 2'-8" hardcoded anywhere in the chain.
  expect(-(P.GRADE_BELOW_CONCRETE_IN / 12)).toBeCloseTo(-14 / 12, 6);
  // And the drawn depth must stay clear of the minimum, or the default would
  // be a value the page itself refuses.
  expect(P.GRADE_BELOW_CONCRETE_IN).toBeGreaterThan(P.GRADE_MIN_BELOW_CONCRETE_IN);
  await expect(page.locator('[data-grade-offset]')).toHaveValue(`-1'-2"`);
  // Local reads off the datum: MAIN FL 100'-0", the foundation top one
  // main-floor assembly (11 7/8" + 3/4") below it, grade 1'-2" under that.
  await expect(page.locator('[data-grade-local]')).toHaveValue(`97'-9 3/8"`);
  // Detached garage derives until overridden: beam top 1'-2" above grade. It
  // moved with grade -- which is the point: the attached garage sets grade,
  // and the detached one is measured off grade, so a chain runs from the
  // attached garage's floor all the way to the detached garage's beam.
  //
  // 1'-2", NOT the 8" this asserted until 5 Sep. Movie put every garage
  // foundation at the house's own height out of the ground, so a detached beam
  // tops out level with the house instead of 6" under it. This assertion is
  // what caught the change -- it failed by exactly the 6".
  const detachedLocal = page.locator('[data-zone-local="detachedGarage"]');
  await expect(detachedLocal).toHaveValue(`98'-11 3/8"`);

  // Dropping grade a foot drops the derived garage the same foot.
  await page.locator('[data-grade-offset]').fill(`-2'-0"`);
  await page.locator('[data-grade-offset]').dispatchEvent('change');
  await expect(detachedLocal).toHaveValue(`98'-1 3/8"`);
  await expect(page.locator('[data-grade-local]')).toHaveValue(`96'-11 3/8"`);

  // An explicit garage height is an override — later grade edits leave it.
  await detachedLocal.fill(`96'-0"`);
  await detachedLocal.dispatchEvent('change');
  await expect(page.locator('[data-zone-offset="detachedGarage"]')).toHaveValue(`-4'-0"`);
  await page.locator('[data-grade-offset]').fill(`-1'-0"`);
  await page.locator('[data-grade-offset]').dispatchEvent('change');
  await expect(detachedLocal).toHaveValue(`96'-0"`);

  const saved = await h.savedDrawing(page);
  expect(saved.zoneHeights.gradeOffsetFt).toBeCloseTo(-1, 5);
  expect(saved.zoneHeights.zones.detachedGarage.offsetFt).toBeCloseTo(-4, 5);
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

// A ZONE HEIGHT EDIT HAS TO REDRAW, and until 5 Sep it did not. Movie's whole
// point about the attached garage: "it's 'quasi attached' only because it will
// move up and down as the user enters new heights for it". The garage section
// is built from attachedOffsetFt(), which reads the zone, so the number and
// the drawing are the same fact -- but the zone rows' commit called only
// fillZones(), while the GRADE LEVEL row beside them called fillZones() AND
// repaint(). So the boxes updated, the file saved, and the garage stayed where
// it was until something else happened to repaint.
//
// Measured on the grey label rather than the canvas: (PILE) rides the garage
// section, so if the section moves the label moves with it. Asserting the
// input's value would have passed the whole time -- the value was never the
// broken half.
test('a zone height edit moves the garage in the drawing, not just in the box', async ({ page }) => {
  await h.openModel(page);
  await openProjectPage(page);

  // RELATIVE TO THE CANVAS, not to the page. The first version of this check
  // measured the label's page Y and passed on a build where nothing redrew:
  // showStatus() adds a line of text above the drawing, and that shifts every
  // absolute Y by more than the tolerance all by itself. A check that a save
  // message appeared, wearing the costume of a check that the garage moved.
  const pileY = async () => {
    const tag = await page.locator('.detail-tag', { hasText: '(PILE)' }).first().boundingBox();
    const box = await page.locator('canvas').first().boundingBox();
    return tag.y - box.y;
  };
  const before = await pileY();

  // Four feet down: far more than the couple of pixels of travel the small
  // section gives a foot, so a redraw is unmistakable and a stale drawing
  // cannot pass by rounding.
  const offset = page.locator('[data-zone-offset="attachedGarage"]');
  await offset.fill(`-4'-0"`);
  await offset.dispatchEvent('change');
  await expect(page.locator('#status')).toContainText('saved');

  expect(Math.abs(await pileY() - before)).toBeGreaterThan(2);
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
  await page.goto('/PROJECT.html');
  return page.locator('[data-zone-offset="attachedGarage"]').inputValue();
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
  // And inline means the HOUSE SILL, not merely "the same as each other":
  // one main-floor package below MAIN FL, which is where the house bears.
  expect(offsetFt(bungalow)).toBeCloseTo(-(11.875 + 0.75) / 12, 5);
});

// THE GARAGE'S TYPED NUMBER READS SILL TO SILL. Movie, 16 Sep: "lets make it
// garage sill off foundation sill (its usually to the ft and makes more
// sense)" — so the one visible offset row measures against the HOUSE's
// foundation sill, and the two MAIN FL rows (sill and the floor row that
// never held a floor) retired with the datum change.
test('the garage sill reads off the foundation sill and the MAIN FL rows are gone', async ({ page }) => {
  await page.goto('/PROJECT.html');
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

    // A fresh drawing has been through no build row, so nothing glows --
    // lighting a button would be the card answering for the drafter.
    await expect(page.locator('.family-button[aria-pressed="true"]')).toHaveCount(0);

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
    const foundation = page.locator('[data-detail-input="garageFoundationType"]');
    await foundation.selectOption('frostwall');
    await foundation.dispatchEvent('change');
    const offset = await page.locator('[data-zone-offset="attachedGarage"]').inputValue();

    await page.locator('[data-family-entry="bungalow-garage"]').click();
    await expect(page.locator('[data-family-entry="bilevel-garage"]'))
      .toHaveAttribute('aria-pressed', 'false');
    expect(await page.locator('[data-zone-offset="attachedGarage"]').inputValue(),
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
