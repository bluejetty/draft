// THE CUT TOOL ON MODEL.html — a section line, and the way it looks.
//
// The parity row has read "SECTIONS list -- listed and deletable, not
// cuttable" since the panel was built, and the panel said it out loud: "This
// page has no cut tool -- sections are cut in LAYOUT." This file is what says
// otherwise.
//
// WHAT IS BEING MEASURED IS THE PERSISTED RECORD, and one field of it above
// all. A cut is a line plus a DIRECTION, and a direction stored backwards
// draws an IDENTICAL line on the plan -- same two ends, same dash, same
// everything a screenshot could catch. What it produces is a mirrored section:
// the far wall in front, the near wall behind. The first place anyone notices
// is a printed sheet, so the check for it here is arithmetic on the saved
// file rather than a look at the canvas.
//
// THE RELATION, NOT THE SIGN. These assertions never say "dirVec.z is -1".
// They say the stored direction points AWAY from the side that was pressed,
// which is a dot product, holds at any angle, and is what the drafter means
// when they press a side. A convention can be swapped in two places and still
// agree with itself; this cannot.
//
// PRESSES ARE AIMED THROUGH THE PUBLISHED CAMERA (h.planFrame), so a press
// lands on the world point it names rather than on centre-of-canvas
// arithmetic that stops being true the moment anything pans.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const readout = page => page.locator('#readout');

// A house saved by the old page, then MODEL.html opened on the same origin --
// the pattern every MODEL.html spec in this suite uses. The walls are left
// alone: they are what the page paints to prove it opened, and a cut through
// a real house is the case the tool exists for.
async function newPageOnSavedHouse(page) {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);
  await page.goto('/MODEL.html');
  await expect(readout(page)).toContainText('walls', { timeout: 6000 });
}

// The SECTIONS panel lives behind the LEVELS / LAYERS tab, which starts shut.
async function pressCut(page) {
  await h.openModelRail(page);
  await page.locator('[data-add-cut]').click();
}

// Three presses: the two ends of the line, then the side to look from.
async function cutThrough(page, [ax, az], [bx, bz], [sx, sz]) {
  const frame = await h.planFrame(page);
  for (const [x, z] of [[ax, az], [bx, bz], [sx, sz]]) {
    const at = frame.at(x, z);
    await page.mouse.click(at[0], at[1]);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(150);
}

// MODEL.html does not autosave: it has a SAVE button and the drafter presses
// it. h.waitForSaved is the OLD page's contract, not this one's.
async function saveOnNewPage(page) {
  await expect(page.locator('#save')).toBeEnabled({ timeout: 4000 });
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
}

const savedFile = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return file ? JSON.parse(await file.text()) : null;
}, h.STORAGE_BUCKET);

const cutsOf = saved => saved?.cuts || [];

// Positive when the stored direction points the SAME way as the press, which
// is the mirrored section this file is here to catch.
const towardPress = (cut, press) => {
  const mid = { x: (cut.startPt.x + cut.endPt.x) / 2, z: (cut.startPt.z + cut.endPt.z) / 2 };
  return cut.dirVec.x * (press[0] - mid.x) + cut.dirVec.z * (press[1] - mid.z);
};

const A = [-6, -4];
const B = [6, -4];
const FOUNDATION_ID = 1;   // the bone house: FOUNDATION, below the level the page opens on
const NORTH = [0, -12];   // the side above the line
const SOUTH = [0, 6];     // the side below it

test('+ CUT and three presses make a section', async ({ page }) => {
  await newPageOnSavedHouse(page);
  const before = cutsOf(await savedFile(page));

  await pressCut(page);
  await cutThrough(page, A, B, SOUTH);
  await saveOnNewPage(page);

  const after = cutsOf(await savedFile(page));
  expect(after.length, 'one more cut than there was').toBe(before.length + 1);

  const cut = after[after.length - 1];
  expect(cut.startPt.x).toBeCloseTo(A[0], 1);
  expect(cut.startPt.z).toBeCloseTo(A[1], 1);
  expect(cut.endPt.x).toBeCloseTo(B[0], 1);
  expect(cut.endPt.z).toBeCloseTo(B[1], 1);

  // A NUMBER, and the spec says so because the format does: drawing-format.js
  // reads a cut id with Number.isInteger, and this page's own id minter hands
  // out strings. A string id here would be dropped on load without a word.
  expect(Number.isInteger(cut.id), 'a cut id is an integer, not this page-s '
    + 'usual string id').toBe(true);

  // S1, S2 ... after the standard E1-E4 elevations.
  expect(cut.name).toMatch(/^S\d+$/);
});

test('the stored direction points away from the side that was pressed',
  async ({ page }) => {
    await newPageOnSavedHouse(page);
    await pressCut(page);
    await cutThrough(page, A, B, SOUTH);
    await saveOnNewPage(page);

    const cut = cutsOf(await savedFile(page)).pop();
    expect(towardPress(cut, SOUTH),
      'the drafter pressed the side they want to look FROM, so the stored '
      + 'direction -- where the viewer stands -- points the other way. Stored '
      + 'the same way round, the plan is identical and every section built '
      + 'from it is mirrored').toBeLessThan(0);

    // A UNIT VECTOR, because everything downstream treats it as one.
    expect(Math.hypot(cut.dirVec.x, cut.dirVec.z)).toBeCloseTo(1, 3);
  });

test('pressing the other side stores the opposite direction', async ({ page }) => {
  await newPageOnSavedHouse(page);
  await pressCut(page);
  await cutThrough(page, A, B, NORTH);
  await saveOnNewPage(page);

  const cut = cutsOf(await savedFile(page)).pop();
  // THE SAME RELATION, FROM THE OTHER SIDE. Without this case a tool that
  // ignored the third press entirely -- always storing one perpendicular --
  // would pass the test above every time.
  expect(towardPress(cut, NORTH)).toBeLessThan(0);
});

test('a second cut takes the next free S number', async ({ page }) => {
  await newPageOnSavedHouse(page);
  await pressCut(page);
  await cutThrough(page, A, B, SOUTH);
  await pressCut(page);
  await cutThrough(page, [-6, 2], [6, 2], [0, 8]);
  await saveOnNewPage(page);

  const cuts = cutsOf(await savedFile(page));
  expect(cuts.length).toBeGreaterThanOrEqual(2);
  const names = cuts.map(cut => cut.name);
  expect(new Set(names).size, 'two cuts, two names').toBe(names.length);
  // AND TWO IDS, which is the half a name check cannot see: a second cut that
  // reused the first id would be dropped by the loader as a duplicate and the
  // drafter would lose it on the next open.
  const ids = cuts.map(cut => cut.id);
  expect(new Set(ids).size, 'and two ids').toBe(ids.length);
});

test('a cut belongs to the level it was drawn on', async ({ page }) => {
  await newPageOnSavedHouse(page);

  // NOT THE LEVEL THE PAGE OPENS ON. MAIN FL is active at load, so a tool that
  // filed every cut against the default -- or against a hardcoded first level
  // -- would agree with a test cut on MAIN FL and be wrong everywhere else.
  // FOUNDATION also sits at a different elevation from MAIN FL, so the same
  // press measures both fields at once.
  await h.pickModelLevel(page, FOUNDATION_ID);
  expect(await h.modelLevelId(page), 'the page moved to the level asked for')
    .toBe(String(FOUNDATION_ID));

  await pressCut(page);
  await cutThrough(page, A, B, SOUTH);
  await saveOnNewPage(page);

  const saved = await savedFile(page);
  const cut = cutsOf(saved).pop();
  // OWNED BY A LEVEL ID, NOT BY A HEIGHT -- MODEL.dc.html:10051 says why: two
  // levels can sit at the same elevation, so deleting a level takes its own
  // sections and no one else's. A cut filed against the wrong level, or
  // against a level that is not in the file, is KEPT by the old page with its
  // levelId nulled (MODEL.dc.html:5590) -- it still lists in the rail, still
  // draws, and simply never goes away with its floor. Nothing on screen says
  // so, which is why it is measured here.
  expect(Number(cut.levelId), 'the cut is filed against the level it was drawn on')
    .toBe(FOUNDATION_ID);
  const level = (saved.levels || []).find(lvl => Number(lvl.id) === FOUNDATION_ID);
  expect(cut.elev, 'and carries that level-s elevation, not the one the page '
    + 'opened on').toBeCloseTo(Number(level.elev), 3);
});

test('the old page finds the section the new page cut', async ({ page }) => {
  await newPageOnSavedHouse(page);
  await pressCut(page);
  await cutThrough(page, A, B, SOUTH);
  await saveOnNewPage(page);

  const drawn = cutsOf(await savedFile(page)).pop();
  expect(drawn, 'the new page wrote a cut to hand over').toBeTruthy();

  // BACK TO THE OLD PAGE, same origin, no fixture in between. This is the
  // handover: the old page is the one that draws section views, and a record
  // it cannot read is a record that was never really written.
  //
  // AND IT IS THE OLD PAGE'S OWN RAIL THAT IS ASKED, not the file again.
  // The first draft of this read h.savedDrawing after the navigation, which is
  // the same bytes MODEL.html just wrote -- so it passed with a cut the old
  // page had DROPPED. Found by mutation: a string id (this page's usual kind)
  // is refused by drawing-format.js, which reads a cut id with
  // Number.isInteger, and the check went green anyway. The SECTIONS rail is
  // built from what the page loaded, so a dropped cut leaves no row.
  await page.goto('/MODEL.dc.html');
  await page.waitForFunction(() => document.body.dataset.modelReady === '1');
  await h.openRails(page);
  await expect(page.locator('.cut-body').filter({ hasText: drawn.name }),
    'the old page-s SECTIONS rail lists the cut, so it loaded rather than '
    + 'dropping it').toHaveCount(1);
});

test('undo takes the cut back out, record and rail together', async ({ page }) => {
  await newPageOnSavedHouse(page);
  await pressCut(page);
  await cutThrough(page, A, B, SOUTH);
  await expect(page.locator('[data-delete-cut]'), 'a section to undo').toHaveCount(1);

  // THE FIRST MISTAKE A THREE-PRESS TOOL INVITES is a third press in the wrong
  // place, and the way out of it is the way out of every other edit on this
  // page.
  await page.keyboard.press('Control+z');

  await expect(page.locator('[data-delete-cut]'),
    'the row goes with the record -- undo used to splice the cut out and leave '
    + 'its row, which then pointed at nothing').toHaveCount(0);

  await saveOnNewPage(page);
  const cuts = cutsOf(await savedFile(page));
  expect(cuts.filter(cut => /^S\d+$/.test(cut.name || '')),
    'and nothing reaches the file either: a row can be redrawn, a saved cut '
    + 'the drafter took back cannot').toHaveLength(0);
});

test('the empty state names the gesture, and the row appears once one is cut',
  async ({ page }) => {
    await newPageOnSavedHouse(page);
    await h.openModelRail(page);

    // The bone's own house carries no sections, so the empty line is what a
    // drafter meets first. It used to say this page had no cut tool.
    const empty = page.locator('[data-no-sections]');
    if (await empty.count()) {
      await expect(empty).toContainText('+ CUT');
      await expect(empty).not.toContainText('no cut tool');
    }

    await pressCut(page);
    await cutThrough(page, A, B, SOUTH);

    await expect(page.locator('[data-no-sections]'),
      'the empty line goes once there is a section').toHaveCount(0);
    await expect(page.locator('[data-delete-cut]'),
      'and the section has a row of its own, with its delete')
      .toHaveCount(1);
  });
