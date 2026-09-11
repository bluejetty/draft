// TIER 3A, RUNG THREE — the edit survives the page.
//
// Rung two proved a corner moves and that a save carries it into the store.
// This file proves the two things that make the move worth making: the drafter
// can SEE there is something unsaved, and the drawing that comes back after a
// reload is the one they left.
//
// BOTH DIRECTIONS, and the second is the one that catches a page that only
// ever writes forward: move a corner, save, reload — the corner is where it
// was put. Then undo, save, reload — the corner is back, offsets and all. A
// save that appended, or a load that re-derived, passes the first and fails
// the second.
//
// THE DIRTY FLAG IS READ OFF document.body.dataset.saveDirty, the beacon
// MODEL.dc.html:6206 stamps for the same reason: it flips synchronously with
// the edit, where the button's text lands a frame later. The button's WORDS
// are asserted too — the beacon is for the machine, the word is for the
// drafter, and either one can be right while the other is wrong.
//
// WHAT MUST NOT MARK IT UNSAVED is half the file. Selecting a wall, panning
// the sheet, and a tap on a handle that never moved are all things a drafter
// does constantly; a page that called any of them an edit would sit there
// asking to be saved forever, and the word would stop meaning anything.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3;
const PROFILE_KEY = 'draft-active-package:standards';   // profile-manager.js:7

async function houseOnOldPage(page) {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);
  await page.evaluate(key => localStorage.setItem(key, JSON.stringify({
    format: 'draft-profile-package',
    kind: 'standards',
    content: { model: { structureStandards: { autoElevations: false } } },
  })), PROFILE_KEY);
}

// The corner-drag fixture, unchanged: four walls meeting at the world origin,
// which the page's fit puts at the canvas centre. The stored offsets are
// deliberately stale for the reason model-html-corner.spec.js gives — with
// exact offsets, restoring one and re-measuring it are the same number.
const MASTER = { x: 3, z: -2 };
const STALE = 0.5;
const FIXTURE = `
  const C = () => ({ x: 0, y: 0, z: 0, srcId: 'p0',
                     offX: ${-MASTER.x + STALE}, offZ: ${-MASTER.z + STALE} });
  d.boneyardOutlines = [{
    id: 'M', shelfId: 1, open: false, points: [
      { id: 'p0', x: ${MASTER.x}, y: 0, z: ${MASTER.z} },
      { id: 'pW', x: -10, y: 0, z: 0 },
      { id: 'pE', x: 10, y: 0, z: 0 },
      { id: 'pN', x: 0, y: 0, z: -5 },
      { id: 'pS', x: 0, y: 0, z: 5 }
    ]
  }];
  const wall = (id, start, end) => ({
    id, start, end, levelId: ${MAIN_FL}, view: 'plan', wallType: 'stud_2x6',
  });
  d.walls = [
    wall('w', { x: -10, y: 0, z: 0 }, C()),
    wall('e', C(), { x: 10, y: 0, z: 0 }),
    wall('n', C(), { x: 0, y: 0, z: -5 }),
    wall('s', C(), { x: 0, y: 0, z: 5 })
  ];
  d.lines = []; d.floors = []; d.dimensions = []; d.roofs = []; d.shapes = [];
  return d;`;

async function writeFixture(page) {
  await page.evaluate(async ({ bucket, src }) => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const drawing = JSON.parse(await file.text());
    // eslint-disable-next-line no-new-func
    const out = new Function('d', src)(drawing) || drawing;
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(out)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, src: FIXTURE });
}

// Open (or re-open) MODEL.html on whatever is in the store right now.
async function openModelPage(page) {
  await page.goto('/MODEL.html?mode=night');
  await expect(page.locator('#readout')).toContainText('walls 4/4', { timeout: 6000 });
}

const beacon = page => page.evaluate(() => document.body.dataset.saveDirty);
const corner = saved => saved.walls.find(x => x.id === 'w').end;

async function centre(page) {
  const box = await page.locator('#plan').boundingBox();
  return { cx: box.x + box.width / 2, cy: box.y + box.height / 2 };
}

async function clickAt(page, dx, dy) {
  const { cx, cy } = await centre(page);
  await page.mouse.click(cx + dx, cy + dy);
  await page.waitForTimeout(60);
}

async function dragFrom(page, ox, oy, dx, dy) {
  const { cx, cy } = await centre(page);
  await page.mouse.move(cx + ox, cy + oy);
  await page.mouse.down();
  await page.mouse.move(cx + ox + dx, cy + oy + dy, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(60);
}

const selectWest = page => clickAt(page, -120, 0);
const dragCorner = (page, dx, dy) => dragFrom(page, 0, 0, dx, dy);

async function pressSave(page) {
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
}

const readStore = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await file.text());
}, BUCKET);

test.describe('MODEL.html unsaved edits', () => {
  test('opening the drawing moves nothing — board #313', async ({ page }) => {
    await houseOnOldPage(page);
    await writeFixture(page);
    await openModelPage(page);

    // NO EDIT. Open it, write it straight back out, and every number must be
    // the one that went in.
    //
    // THE STALE OFFSET IS THE WHOLE TEST. A linked corner carries both its
    // position and its offset from a master point, and here the two disagree
    // by half a foot — which is what a file written before some master edit
    // looks like. A load that "resolved" the disagreement would move a wall
    // six inches on open, silently, without a drafter pressing anything.
    // Every other fixture in the repo stores them in agreement, so this is the
    // only place that difference can be seen at all.
    //
    // Board #313: software never moves geometry on load, import or re-derive.
    // Only a drafter's press may.
    await page.locator('#save').click();
    await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });

    const c = corner(await readStore(page));
    expect(c, 'the corner must be re-emitted exactly where it was stored')
      .toMatchObject({ x: 0, z: 0, srcId: 'p0' });
    expect(c.offX, 'and its stale offset must still be stale')
      .toBeCloseTo(0 - MASTER.x + STALE, 9);
    expect(c.offZ, 'and its stale offset must still be stale')
      .toBeCloseTo(0 - MASTER.z + STALE, 9);
    // The offset and the position still disagree, which is the state the file
    // was in. If this line ever fails, the load has started tidying.
    expect(c.offX, 'the disagreement must survive the round trip')
      .not.toBeCloseTo(c.x - MASTER.x, 6);
  });

  test('the button tracks the drawing: SAVE, then UNSAVED, then SAVED',
    async ({ page }) => {
      await houseOnOldPage(page);
      await writeFixture(page);
      await openModelPage(page);

      // ON ARRIVAL nothing has been touched, and the beacon says so in a way
      // that is distinguishable from never having been stamped at all.
      expect(await beacon(page), 'a freshly loaded drawing is not unsaved').toBe('0');
      await expect(page.locator('#save')).toHaveText('SAVE');

      // SELECTING IS NOT EDITING. This is the first of three; without them a
      // page that marked everything unsaved would pass every assertion below.
      await selectWest(page);
      expect(await beacon(page), 'selecting a wall changes nothing in the drawing')
        .toBe('0');
      await expect(page.locator('#save')).toHaveText('SAVE');

      // MOVING A CORNER IS.
      await dragCorner(page, 90, 50);
      expect(await beacon(page), 'a moved corner is an unsaved edit').toBe('1');
      await expect(page.locator('#save')).toHaveText('UNSAVED');

      await pressSave(page);
      expect(await beacon(page), 'the write clears the flag').toBe('0');

      // AND AN UNDO IS AN EDIT TOO — the drawing on screen stopped matching
      // the file again. A page that only watched drags would sit here saying
      // SAVED over a drawing that is not the saved one.
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(60);
      expect(await beacon(page), 'an undo leaves the file out of date').toBe('1');
      await expect(page.locator('#save')).toHaveText('UNSAVED');
    });

  test('panning and a tap that moves nothing are not edits', async ({ page }) => {
    await houseOnOldPage(page);
    await writeFixture(page);
    await openModelPage(page);
    await selectWest(page);

    // A TAP ON THE HANDLE. It grabs the corner — the drag is armed and waiting
    // — and then goes nowhere. Nothing moved, so nothing is unsaved, and there
    // is nothing on the undo stack either.
    const { cx, cy } = await centre(page);
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(60);
    expect(await beacon(page), 'a tap that moved nothing is not an edit').toBe('0');

    // A PAN THAT STARTS OFF THE SELECTED WALL ENTIRELY. This used to start at
    // (-120, 0) — along the west wall, well clear of its corners — because a
    // wall's body was not grabbable and a press there could only pan. It is
    // grabbable now, and that press moves the wall. So the pan starts in empty
    // space above the drawing: press the selected wall and it travels, press
    // anywhere else and the sheet slides, which is the whole rule.
    await dragFrom(page, 0, -300, 140, 60);
    expect(await beacon(page), 'panning the sheet is not an edit').toBe('0');
    await expect(page.locator('#save')).toHaveText('SAVE');
  });

  // A NOTE ON WHY NEITHER TEST BELOW DRAGS AFTER A RELOAD. The page fits the
  // drawing on load, so once a corner has moved the canvas centre is no longer
  // that corner — a press there lands on nothing and pans. An earlier draft of
  // this file did exactly that and proved nothing: the undo popped an empty
  // stack, the save wrote an unchanged drawing, and every assertion held. The
  // mutation that should have failed it passed, which is how it was found.
  // So: every drag happens on a freshly fitted drawing with the corner at the
  // centre, and the reload is what gets checked afterwards.

  test('the edit survives a reload, and the reload does not move it',
    async ({ page }) => {
      await houseOnOldPage(page);
      await writeFixture(page);
      await openModelPage(page);

      expect(corner(await readStore(page)), 'the fixture corner starts at the origin')
        .toMatchObject({ x: 0, z: 0 });

      await selectWest(page);
      await dragCorner(page, 90, 50);
      await pressSave(page);
      const moved = corner(await readStore(page));
      expect(moved.x, 'the drag must have moved the corner').not.toBe(0);
      expect(moved.z, 'the drag must have moved the corner').not.toBe(0);

      // OUT AND BACK IN. A fresh page reads the store from scratch.
      await openModelPage(page);
      expect(await beacon(page), 'a reloaded drawing has nothing unsaved').toBe('0');

      // AND THE RELOAD MUST NOT HAVE MOVED IT. Reading the file again would
      // only re-read the same bytes, so this presses SAVE on the reloaded page
      // and compares what IT writes: load → normalise → store, with the corner
      // arriving and leaving in the same place.
      //
      // That is the check with teeth. The stored offset here is stale by half
      // a foot, so a load that helpfully re-derived a linked corner from its
      // master plus its offset — board #313's hazard, software moving geometry
      // on load — would land it six inches off and this would catch it.
      await page.locator('#save').click();
      await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
      const reloaded = corner(await readStore(page));
      expect(reloaded, 'the reloaded drawing must re-emit the corner unchanged')
        .toMatchObject({ x: moved.x, z: moved.z, srcId: 'p0' });
      expect(reloaded.offX, 'and the offset the drag re-measured')
        .toBeCloseTo(moved.x - MASTER.x, 9);
      expect(reloaded.offZ, 'and the offset the drag re-measured')
        .toBeCloseTo(moved.z - MASTER.z, 9);
    });

  test('an undo saves as an undo: the file goes back with the drawing',
    async ({ page }) => {
      await houseOnOldPage(page);
      await writeFixture(page);
      await openModelPage(page);
      await selectWest(page);

      // OUT. The store really holds the moved corner — asserted, because
      // everything below is about it coming back, and a drag that never
      // reached the file would make that trivially true.
      await dragCorner(page, 90, 50);
      await pressSave(page);
      const moved = corner(await readStore(page));
      expect(moved.x, 'the corner must have gone out to the file first').not.toBe(0);

      // AND BACK. The undo is itself an unsaved edit, so this is a second real
      // write, not a no-op.
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(60);
      await pressSave(page);

      const back = corner(await readStore(page));
      expect(back, 'the file must hold the undone corner, not the dragged one')
        .toMatchObject({ x: 0, z: 0, srcId: 'p0' });
      // THE STALE OFFSETS COME BACK STALE. The drag re-measured them; the undo
      // put the stored ones back; the save wrote those. A page that tidied
      // them on the way past would return a drawing the drafter never had.
      expect(back.offX, 'the stored offset must return as it was stored')
        .toBeCloseTo(0 - MASTER.x + STALE, 9);
      expect(back.offZ, 'the stored offset must return as it was stored')
        .toBeCloseTo(0 - MASTER.z + STALE, 9);

      // And a fresh page reads that back and re-emits it unchanged.
      await openModelPage(page);
      await page.locator('#save').click();
      await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
      expect(corner(await readStore(page)),
        'the reloaded drawing must still be the undone one')
        .toMatchObject({ x: 0, z: 0, offX: 0 - MASTER.x + STALE, offZ: 0 - MASTER.z + STALE });
    });

  // Close a page with its unload handlers running, and report whether the
  // browser asked. Playwright only surfaces a beforeunload dialog on this
  // path, and only as a dialog event — the wording is the browser's and is
  // not ours to assert.
  async function closingAsks(target) {
    const asked = target.waitForEvent('dialog', { timeout: 3000 })
      .then(dialog => { dialog.dismiss(); return true; })
      .catch(() => false);
    await target.close({ runBeforeUnload: true });
    return asked;
  }

  test('a tab with an unsaved corner asks before it closes',
    async ({ page, context }) => {
      await houseOnOldPage(page);
      await writeFixture(page);
      // OFF THE OLD PAGE FIRST. MODEL.dc.html autosaves, and it is still live
      // in this tab — leave it open and it writes its own drawing back over
      // the fixture while these pages are being driven. That is exactly what
      // happened here: the first page loaded 4 walls and the second loaded 18.
      // Every other test in this file navigates away as its next line and
      // never notices; these two open extra pages instead, so it has to be
      // said out loud.
      await openModelPage(page);

      // CONTROL, and it carries the trap. Chrome will not show a beforeunload
      // dialog on a page the user never interacted with — so a control that
      // merely loaded and closed would come back silent no matter what the
      // handler does, and prove nothing about it. This one CLICKS first, on
      // empty space where nothing is selected and nothing moves. Same gesture
      // budget as the dirty page below; the only difference between them is
      // whether an edit happened.
      const clean = await context.newPage();
      await clean.goto('/MODEL.html?mode=night');
      await expect(clean.locator('#readout')).toContainText('walls 4/4', { timeout: 6000 });
      await clickAt(clean, 0, -300);
      expect(await beacon(clean), 'the control page must really be clean').toBe('0');
      expect(await closingAsks(clean),
        'a page with nothing unsaved must close without a word').toBe(false);

      // AND NOW WITH AN EDIT IN IT.
      const edited = await context.newPage();
      await edited.goto('/MODEL.html?mode=night');
      await expect(edited.locator('#readout')).toContainText('walls 4/4', { timeout: 6000 });
      await clickAt(edited, -120, 0);
      await dragCorner(edited, 90, 50);
      expect(await beacon(edited), 'the edited page must really be dirty').toBe('1');
      expect(await closingAsks(edited),
        'a moved corner that was never saved is worth a question').toBe(true);
    });

  test('saving takes the question away again', async ({ page, context }) => {
    await houseOnOldPage(page);
    await writeFixture(page);
    await openModelPage(page);   // close the autosaving old page — see above

    const edited = await context.newPage();
    await edited.goto('/MODEL.html?mode=night');
    await expect(edited.locator('#readout')).toContainText('walls 4/4', { timeout: 6000 });
    await clickAt(edited, -120, 0);
    await dragCorner(edited, 90, 50);
    // RUNG 3: the page opened above already holds the edit lease, so this second
    // one opens read-only with SAVE disabled. Taking the lease is the drafter's
    // route and it keeps this test about the beforeunload handler, which is what
    // its name says. Without it `pressSave` does not fail — it waits for a
    // disabled button to become enabled until the test times out.
    await edited.locator('[data-take-over]').click();
    await expect(edited.locator('body')).toHaveAttribute('data-lease-held', '1', { timeout: 6000 });
    await pressSave(edited);

    // The edit is in the file, so there is nothing left to lose and nothing to
    // ask about. Without this a handler armed once and never disarmed would
    // pass the test above and nag forever after.
    expect(await beacon(edited), 'the save must have cleared the flag').toBe('0');
    expect(await closingAsks(edited),
      'once the edit is saved the tab must close without a word').toBe(false);
  });

  test('a failed save keeps saying UNSAVED', async ({ page }) => {
    await houseOnOldPage(page);
    await writeFixture(page);
    await openModelPage(page);
    await selectWest(page);
    await dragCorner(page, 90, 50);
    await expect(page.locator('#save')).toHaveText('UNSAVED');

    // ANOTHER PAGE SAVES UNDERNEATH. The store's revision moves on, so this
    // page's write is refused — nothing is merged, by design (see save()).
    // The drafter still has an unsaved corner, and the button must still say
    // so: dropping back to a neutral SAVE would tell someone whose write just
    // failed that there is nothing left to lose.
    await page.evaluate(async bucket => {
      const file = await window.SharedFileStore.loadSharedFile(bucket);
      const drawing = JSON.parse(await file.text());
      await window.SharedFileStore.saveSharedFile(
        new File([JSON.stringify(drawing)], 'drawing.json', { type: 'application/json' }), bucket);
    }, BUCKET);

    await page.locator('#save').click();
    await expect(page.locator('#notice')).toHaveClass(/show/, { timeout: 6000 });
    await expect(page.locator('#save'),
      'a refused write leaves the edit unsaved, and the button must say it')
      .toHaveText('UNSAVED');
    expect(await beacon(page), 'and the beacon must still read dirty').toBe('1');
  });
});
