// TIER 3A, RUNG TWO — MODEL.html can move a corner.
//
// Selection proved itself in pixels: nothing about the drawing changed, so a
// hash that differed proved the overlay painted. THIS rung changes the
// drawing, so pixels are the wrong instrument — a highlight and a moved corner
// both just make the picture different. These tests read NUMBERS, by saving
// through the page and inspecting the file that comes out.
//
// Saving is how the numbers get out, not what is under test. The Write Tier
// already round-trips (tests/write-tier.spec.js holds it against a legacy save
// key for key); here it is the only honest window onto the pooled objects the
// drag actually touches, since `drawing` lives in the page's closure and a
// test-only hook onto it would prove things about the hook.
//
// WHAT MUST BE TRUE, and each is a way this could be silently wrong:
//   1. the corner moves, and EVERY wall sharing it moves — that is the pool
//   2. the walls' far ends do NOT move — or the whole drawing slid
//   3. srcId survives and offX/offZ re-measure — MODEL.dc.html:11641, the old
//      page's rule, matched rather than invented
//   4. Ctrl+Z puts back all four numbers
//   5. the corner snaps to another corner, AND has an edge where it does not
//   6. a corner nobody selected is not draggable — the gesture still pans
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

// FOUR WALLS MEETING AT THE WORLD ORIGIN, arms reaching -10..10 in x and
// -5..5 in z. The page fits the drawing on load, so the bounding box centre is
// the canvas centre — and here that centre IS the shared corner. Every click
// and drag below is therefore expressed in pixels from the canvas centre with
// no world-to-screen mapping needed, the same arithmetic the selection spec
// leans on.
//
// FOUR arms, not two, because the pool's promise is about walls the drag never
// names. A two-wall fixture would pass with a hand-rolled "also move the other
// end" and this one would not.
//
// THE MASTER OUTLINE is hand-built and deliberately NOT at the origin: a
// master at (0,0) would make offX equal x, and every offset assertion below
// would hold just as well for code that copied the coordinate instead of
// measuring the difference. At (3, -2) the two numbers can never coincide.
//
// AND THE STORED OFFSETS ARE DELIBERATELY STALE — half a foot off the true
// difference. Every real drawing in the repo stores them exact (checked: 132
// linked wall vertices across the three proto/repro-*.draft files, zero
// mismatches), and exact is the one value that makes RESTORING an offset and
// RE-MEASURING it produce the same number. A fixture built from exact offsets
// cannot tell those two apart, so the undo assertion below would hold for an
// undo that recomputed — passing while proving nothing.
//
// Stale is also the honest case to carry: a file written before some master
// edit is exactly what arrives here, and undo must hand back the drawing that
// was open, not a tidied one.
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

async function open(page) {
  await page.evaluate(async ({ bucket, src }) => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const drawing = JSON.parse(await file.text());
    // eslint-disable-next-line no-new-func
    const out = new Function('d', src)(drawing) || drawing;
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(out)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, src: FIXTURE });
  await page.goto('/MODEL.html?mode=night');
  await expect(page.locator('#readout')).toContainText('walls 4/4', { timeout: 6000 });
}

// Save through the page and read back what landed in the store. Waiting for
// the button's own SAVED text rather than a timeout: the write is async and a
// read that raced it would return the previous revision, which looks exactly
// like a drag that did nothing.
const readStore = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await file.text());
}, BUCKET);

async function saveAndRead(page) {
  // The button must be OFFERING a save. Clicking a button that already reads
  // SAVED and then asserting it reads SAVED is the shape of a check that
  // cannot fail — and it would hand back the previous revision as if it were
  // the edit's.
  await expect(page.locator('#save'), 'there must be an unsaved edit to save')
    .toHaveText('UNSAVED');
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
  return readStore(page);
}

// The four wall ends that meet at the shared corner, by wall id.
const cornerEnds = saved => ({
  w: saved.walls.find(x => x.id === 'w').end,
  e: saved.walls.find(x => x.id === 'e').start,
  n: saved.walls.find(x => x.id === 'n').start,
  s: saved.walls.find(x => x.id === 's').start,
});
const farEnds = saved => ({
  w: saved.walls.find(x => x.id === 'w').start,
  e: saved.walls.find(x => x.id === 'e').end,
  n: saved.walls.find(x => x.id === 'n').end,
  s: saved.walls.find(x => x.id === 's').end,
});

async function centre(page) {
  const box = await page.locator('#plan').boundingBox();
  return { cx: box.x + box.width / 2, cy: box.y + box.height / 2 };
}

// Click at an offset in CSS pixels from the canvas centre.
async function clickAt(page, dx, dy) {
  const { cx, cy } = await centre(page);
  await page.mouse.click(cx + dx, cy + dy);
  await page.waitForTimeout(60);
}

// Press at the canvas centre — the shared corner — and drag by a pixel delta.
async function dragCorner(page, dx, dy) {
  const { cx, cy } = await centre(page);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dx, cy + dy, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(60);
}

// Select the west wall by clicking along it, well left of the shared corner
// and well outside the corner's own 30px grab zone.
const selectWest = page => clickAt(page, -120, 0);

test.describe('MODEL.html corner drag', () => {
  test('the pooled corner carries every wall that meets it, and only those',
    async ({ page }) => {
      await houseOnOldPage(page);
      await open(page);

      // CONTROL FIRST. Every assertion after the drag is a comparison against
      // this, so if the four ends did not start together — or the save did not
      // report them — the rest of the test proves nothing.
      const before = await readStore(page);
      const b = cornerEnds(before);
      Object.entries(b).forEach(([id, v]) => {
        expect(v, `wall ${id} must start at the shared corner`)
          .toMatchObject({ x: 0, z: 0 });
      });

      await selectWest(page);
      await dragCorner(page, 90, 50);

      const after = await saveAndRead(page);
      const a = cornerEnds(after);

      expect(a.w.x, 'the dragged corner must have moved in x').not.toBe(0);
      expect(a.w.z, 'the dragged corner must have moved in z').not.toBe(0);

      // THE POOL. Three of these walls were never named by the drag; they
      // moved because their endpoint IS the object that moved.
      ['e', 'n', 's'].forEach(id => {
        expect(a[id], `wall ${id} shares the corner and must have followed it`)
          .toMatchObject({ x: a.w.x, z: a.w.z });
      });

      // AND NOTHING ELSE MOVED. Without this the test passes for a page that
      // translated the whole drawing, which is the same picture shifted.
      const fBefore = farEnds(before), fAfter = farEnds(after);
      Object.keys(fBefore).forEach(id => {
        expect(fAfter[id], `wall ${id}'s far end must not have moved`)
          .toMatchObject({ x: fBefore[id].x, z: fBefore[id].z });
      });
    });

  test('a dragged corner keeps its master link and re-measures the offset',
    async ({ page }) => {
      await houseOnOldPage(page);
      await open(page);

      const before = await readStore(page);
      const b = cornerEnds(before);
      // CONTROL. The link is here before the drag, and the offsets hold — so a
      // failure after the drag is the drag's doing and not a fixture that
      // never carried a link at all.
      Object.entries(b).forEach(([id, v]) => {
        expect(v.srcId, `wall ${id} must start linked to the master point`).toBe('p0');
        expect(v.offX, `wall ${id}'s stored offX`).toBeCloseTo(0 - MASTER.x + STALE, 9);
        expect(v.offZ, `wall ${id}'s stored offZ`).toBeCloseTo(0 - MASTER.z + STALE, 9);
        // AND THEY START WRONG, on purpose. If the fixture's offsets were
        // already the true difference, the re-measure assertion after the drag
        // would hold for a page that never re-measured anything.
        expect(v.offX, `wall ${id}'s stored offX must NOT already be the true difference`)
          .not.toBeCloseTo(v.x - MASTER.x, 6);
      });

      await selectWest(page);
      await dragCorner(page, 90, 50);

      const after = await saveAndRead(page);
      const a = cornerEnds(after);
      const master = after.boneyardOutlines[0].points.find(p => p.id === 'p0');
      expect(master, 'the master point must survive the save').toMatchObject(MASTER);

      Object.entries(a).forEach(([id, v]) => {
        // THE LINK SURVIVES. MODEL.dc.html's node drag never drops srcId; it
        // re-measures (_relinkVertex, MODEL.dc.html:11641). A page that
        // dropped it would look identical on screen and quietly unhook the
        // wall from its bone forever.
        expect(v.srcId, `wall ${id} must still be linked after the drag`).toBe('p0');
        // AND THE OFFSET IS RE-MEASURED, not left stale. The master sits at
        // (3,-2) so this can never be satisfied by copying the coordinate.
        expect(v.offX, `wall ${id}'s offX must be re-measured from the master`)
          .toBeCloseTo(v.x - master.x, 9);
        expect(v.offZ, `wall ${id}'s offZ must be re-measured from the master`)
          .toBeCloseTo(v.z - master.z, 9);
      });

      // The offsets must have CHANGED, or a page that never relinked would
      // satisfy every line above.
      expect(a.w.offX, 'the re-measured offX must differ from the stored one')
        .not.toBeCloseTo(b.w.offX, 6);
    });

  test('Ctrl+Z puts the corner and its offsets back', async ({ page }) => {
    await houseOnOldPage(page);
    await open(page);
    const before = await readStore(page);

    await selectWest(page);
    await dragCorner(page, 90, 50);
    const moved = cornerEnds(await saveAndRead(page));
    expect(moved.w.x, 'the drag must have moved the corner, or undo has no work')
      .not.toBe(0);

    await page.keyboard.press('Control+z');
    await page.waitForTimeout(60);

    const undone = cornerEnds(await saveAndRead(page));
    const b = cornerEnds(before);
    Object.keys(b).forEach(id => {
      // ALL FOUR NUMBERS, and the offsets are the half of it that bites: the
      // drag re-measured them off their stale stored values, so an undo that
      // recomputed instead of restoring would put the position back and leave
      // the offsets sitting at the drag's numbers. Same picture, different
      // file — the difference only shows the next time the master moves.
      expect(undone[id], `wall ${id} must be exactly where it started`)
        .toMatchObject({ x: b[id].x, z: b[id].z, offX: b[id].offX, offZ: b[id].offZ });
      expect(undone[id].offX, `wall ${id}'s offset must be the stored one, not a re-measure`)
        .toBeCloseTo(0 - MASTER.x + STALE, 9);
    });
  });

  test('a corner snaps to another corner, and stops snapping past the zone',
    async ({ page }) => {
      await houseOnOldPage(page);
      await open(page);
      await selectWest(page);

      // CALIBRATE, because the snap zone is four pixels and aiming at another
      // corner needs to know how many pixels a foot is. One drag of a known
      // pixel delta gives it, and Ctrl+Z takes it back — the same undo the
      // test above proves works, used here as a tool.
      await dragCorner(page, 200, 0);
      const calib = cornerEnds(await saveAndRead(page)).w;
      const pxPerFt = 200 / calib.x;
      expect(pxPerFt, 'the calibration drag must have moved the corner').toBeGreaterThan(0);
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(60);

      // The north arm's far end is at (0, -5) and is a separate pooled corner.
      // Aim 2px short of it: inside the 4px snap zone.
      const targetPx = -5 * pxPerFt;
      await dragCorner(page, 0, targetPx + 2);
      const snapped = cornerEnds(await saveAndRead(page)).w;
      expect(snapped, 'a corner released 2px from another corner must land exactly on it')
        .toMatchObject({ x: 0, z: -5 });

      await page.keyboard.press('Control+z');
      await page.waitForTimeout(60);

      // AND THE ZONE HAS AN EDGE. Without this a snap that fired at any
      // distance would satisfy the assertion above every time — the corner
      // would simply always jump to the nearest one.
      await dragCorner(page, 0, targetPx + 40);
      const near = cornerEnds(await saveAndRead(page)).w;
      expect(near.z, 'released 40px away, the corner must stay where it was dropped')
        .not.toBeCloseTo(-5, 3);
    });

  test('an unselected corner is not draggable — the gesture pans',
    async ({ page }) => {
      await houseOnOldPage(page);
      await open(page);
      const before = cornerEnds(await readStore(page));

      // NO SELECTION. The same press-and-drag on the same pixel must slide the
      // sheet instead of moving the corner underneath it — otherwise every pan
      // begun near a corner would drag geometry.
      await dragCorner(page, 90, 50);

      // Nothing was edited, so the button must not be offering to save one.
      await expect(page.locator('#save'),
        'a pan is not an edit and must not mark the drawing unsaved')
        .toHaveText('SAVE');

      const after = cornerEnds(await readStore(page));
      Object.keys(before).forEach(id => {
        expect(after[id], `wall ${id} must not have moved without a selection`)
          .toMatchObject({ x: before[id].x, z: before[id].z });
      });
    });
});
