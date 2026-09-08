// TIER 3A, RUNG FOUR — MODEL.html can move a whole wall.
//
// THIS IS THE FIRST GESTURE ON THIS PAGE WITH NOTHING TO COPY. Selection, the
// corner drag and its snap were all measured off MODEL.dc.html; this one could
// not be, because the old page has no whole-wall move. Its SELECT drag grabs a
// vertex (_findVertexHit, MODEL.dc.html:10512) and a press on a wall body away
// from a corner moves nothing at all.
//
// So the behaviour is a ruling, not a measurement: the wall's two endpoints are
// pooled corners shared with its neighbours, and dragging the wall MOVES BOTH,
// so the neighbours travel and the outline deforms around it. The alternative —
// detaching the wall from its corners — would silently unhook it from the pool,
// the same failure shape as a dropped srcId and just as invisible until much
// later. A true detach, if ever wanted, gets its own named gesture.
//
// One thing IS copied: the precedence. The old page tests for a vertex before
// it tests for a line (MODEL.dc.html:16791 then :16799), and so does this page,
// which is why a press near a corner is still a corner press.
//
// THE CHECK THAT MATTERS MOST is that both ends move by the SAME delta. A wall
// that stretched instead of translating would look moved, would be unsaved,
// would undo, and would satisfy every other assertion in this file. It is the
// first mutation written against it.
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

// A CLOSED RECTANGLE, x -10..10 and z -5..5, so the fitted canvas centre is the
// world origin and every press below is pixels from the centre with no
// world-to-screen mapping.
//
// A rectangle, not the corner spec's four arms, because the ruling is about
// what happens to the NEIGHBOURS. Each corner here is shared by exactly two
// walls, so moving the north wall must drag the tops of the east and west walls
// with it and leave their bottoms alone — a shape that four arms meeting at one
// point cannot show.
//
//        nw ────── n ────── ne          n  z = -5, x -10..10
//        │                   │          e  x =  10, z -5..5
//        w                   e          s  z =  5,  x -10..10
//        │                   │          w  x = -10, z -5..5
//        sw ────── s ────── se
//
// The stored offsets are stale by half a foot, for the reason
// model-html-corner.spec.js gives: with exact offsets, restoring an offset and
// re-measuring it produce the same number and no test can tell them apart.
const MASTER = { x: 3, z: -2 };
const STALE = 0.5;
const FIXTURE = `
  const P = (x, z, id) => ({ x, y: 0, z, srcId: id,
                             offX: x - ${MASTER.x} + ${STALE},
                             offZ: z - ${MASTER.z} + ${STALE} });
  d.boneyardOutlines = [{
    id: 'M', shelfId: 1, open: false, points: [
      { id: 'nw', x: -10, y: 0, z: -5 }, { id: 'ne', x: 10, y: 0, z: -5 },
      { id: 'se', x: 10, y: 0, z: 5 },   { id: 'sw', x: -10, y: 0, z: 5 },
      { id: 'p0', x: ${MASTER.x}, y: 0, z: ${MASTER.z} }
    ]
  }];
  const wall = (id, start, end) => ({
    id, start, end, levelId: ${MAIN_FL}, view: 'plan', wallType: 'stud_2x6',
  });
  d.walls = [
    wall('n', P(-10, -5, 'nw'), P(10, -5, 'ne')),
    wall('e', P(10, -5, 'ne'),  P(10, 5, 'se')),
    wall('s', P(10, 5, 'se'),   P(-10, 5, 'sw')),
    wall('w', P(-10, 5, 'sw'),  P(-10, -5, 'nw'))
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

async function open(page) {
  await page.goto('/MODEL.html?mode=night');
  await expect(page.locator('#readout')).toContainText('walls 4/4', { timeout: 6000 });
}

const readStore = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await file.text());
}, BUCKET);

async function saveAndRead(page) {
  await expect(page.locator('#save'), 'there must be an unsaved edit to save')
    .toHaveText('UNSAVED');
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
  return readStore(page);
}

// Every wall by id, ends named by which corner they sit on rather than by
// start/end, so an assertion reads as a place on the rectangle.
const corners = saved => {
  const by = id => saved.walls.find(w => w.id === id);
  return {
    nw: by('n').start, ne: by('n').end,
    se: by('e').end,   sw: by('s').end,
    // The same four corners reached through the OTHER wall that shares each
    // one. If the pool held, these are the same numbers; if a drag detached a
    // wall from its corners, this is where it shows.
    ne2: by('e').start, se2: by('s').start, sw2: by('w').start, nw2: by('w').end,
  };
};

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

// Pixels per foot, from the fixture's known 20ft width. Derived once per test
// from the readout the page prints rather than from a guess about the fit.
async function pxPerFt(page) {
  const text = await page.locator('#readout').textContent();
  const m = text.match(/scale ([\d.]+) px\/ft/);
  expect(m, 'the readout must print the scale this test measures from').not.toBeNull();
  return Number(m[1]);
}

// Select the north wall by clicking its middle — the top edge of the rectangle,
// 5ft above the origin, and far along it from either corner.
async function selectNorth(page, ppf) {
  await clickAt(page, 0, -5 * ppf);
  await expect(page.locator('#save')).toHaveText('SAVE');   // selecting is not an edit
}

test.describe('MODEL.html whole-wall drag', () => {
  test('the wall travels and its neighbours follow at the corners they share',
    async ({ page }) => {
      await houseOnOldPage(page);
      await writeFixture(page);
      await open(page);
      const ppf = await pxPerFt(page);

      const before = corners(await readStore(page));
      // CONTROL. The rectangle really is closed — each corner reached through
      // two different walls is the same point. Every assertion after the drag
      // compares against this, and a fixture whose walls did not actually share
      // corners would make the pool claim below meaningless.
      expect(before.ne2, 'the east wall must start on the north wall\'s corner')
        .toMatchObject({ x: before.ne.x, z: before.ne.z });
      expect(before.nw2, 'the west wall must start on the north wall\'s corner')
        .toMatchObject({ x: before.nw.x, z: before.nw.z });

      await selectNorth(page, ppf);
      await dragFrom(page, 0, -5 * ppf, 0, -3 * ppf);   // push the north wall 3ft further north

      const after = corners(await saveAndRead(page));

      // THE WALL TRAVELLED, and both of its ends by the SAME delta. This is the
      // assertion the whole rung turns on: a wall that stretched — one end
      // moving further than the other — would still read as "the wall moved"
      // to every other check in this file.
      const dNW = { x: after.nw.x - before.nw.x, z: after.nw.z - before.nw.z };
      const dNE = { x: after.ne.x - before.ne.x, z: after.ne.z - before.ne.z };
      expect(Math.hypot(dNW.x, dNW.z), 'the wall must actually have moved')
        .toBeGreaterThan(0.5);
      expect(dNE.x, 'both ends must travel the same distance in x — a wall '
        + 'translates, it does not stretch').toBeCloseTo(dNW.x, 9);
      expect(dNE.z, 'both ends must travel the same distance in z — a wall '
        + 'translates, it does not stretch').toBeCloseTo(dNW.z, 9);
      // And it went the way it was pushed, not merely somewhere.
      expect(dNW.z, 'dragging north must move it north').toBeLessThan(0);

      // THE NEIGHBOURS CAME WITH IT. Nothing in the drag names the east or west
      // wall; their ends moved because those ends ARE the objects that moved.
      expect(after.ne2, 'the east wall\'s top must still be on the moved corner')
        .toMatchObject({ x: after.ne.x, z: after.ne.z });
      expect(after.nw2, 'the west wall\'s top must still be on the moved corner')
        .toMatchObject({ x: after.nw.x, z: after.nw.z });

      // AND THE FAR END OF THE RECTANGLE STAYED. Without this the test passes
      // for a page that translated the whole drawing, which is the same picture
      // slid sideways.
      expect(after.se, 'the south-east corner must not have moved')
        .toMatchObject({ x: before.se.x, z: before.se.z });
      expect(after.sw, 'the south-west corner must not have moved')
        .toMatchObject({ x: before.sw.x, z: before.sw.z });
    });

  test('a press near a corner is still a corner press', async ({ page }) => {
    await houseOnOldPage(page);
    await writeFixture(page);
    await open(page);
    const ppf = await pxPerFt(page);
    const before = corners(await readStore(page));

    await selectNorth(page, ppf);
    // ON the north wall, but within its north-west corner's 30px grab zone.
    // The old page's precedence says vertex before line; so one end moves and
    // the other does not, which is exactly what a wall drag may never do.
    await dragFrom(page, -10 * ppf + 10, -5 * ppf, 0, -3 * ppf);

    const after = corners(await saveAndRead(page));
    expect(after.nw.z, 'the corner nearest the press must have moved')
      .toBeLessThan(before.nw.z - 0.5);
    expect(after.ne, 'the far end must have stayed exactly where it was — this '
      + 'was a corner press, not a wall press')
      .toMatchObject({ x: before.ne.x, z: before.ne.z });
  });

  test('a wall end snaps to another corner, and the whole wall follows it',
    async ({ page }) => {
      await houseOnOldPage(page);
      await writeFixture(page);
      await open(page);
      const ppf = await pxPerFt(page);
      const before = corners(await readStore(page));

      // Drag the north wall down so its EAST end lands 2px short of the
      // south-east corner — inside the 4px snap zone. The west end has no
      // corner near it, so the snap can only come from the east end, and the
      // wall must move rigidly by whatever correction that end needed.
      await selectNorth(page, ppf);
      await dragFrom(page, 0, -5 * ppf, 0, 10 * ppf - 2);

      const after = corners(await saveAndRead(page));
      expect(after.ne, 'the east end must land exactly on the south-east corner')
        .toMatchObject({ x: before.se.x, z: before.se.z });
      // RIGID. The west end took the same correction, so the wall is still
      // 20ft long and still level.
      expect(after.nw.x, 'the wall must not have stretched to reach the snap')
        .toBeCloseTo(after.ne.x - 20, 9);
      expect(after.nw.z, 'and it must still be level').toBeCloseTo(after.ne.z, 9);

      // THE ZONE HAS AN EDGE. Released 40px short, nothing snaps — without this
      // a snap that fired at any distance would satisfy the assertion above
      // every time.
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(60);
      await dragFrom(page, 0, -5 * ppf, 0, 10 * ppf - 40);
      const near = corners(await saveAndRead(page));
      expect(near.ne.z, 'released 40px away, the end must stay where it was dropped')
        .not.toBeCloseTo(before.se.z, 3);
    });

  test('Ctrl+Z puts the whole wall back in one press', async ({ page }) => {
    await houseOnOldPage(page);
    await writeFixture(page);
    await open(page);
    const ppf = await pxPerFt(page);
    const before = corners(await readStore(page));

    await selectNorth(page, ppf);
    await dragFrom(page, 0, -5 * ppf, 4 * ppf, -3 * ppf);
    const moved = corners(await saveAndRead(page));
    expect(moved.nw.z, 'the drag must have moved the wall, or undo has no work')
      .not.toBeCloseTo(before.nw.z, 6);

    // ONE PRESS IS ONE UNDO. The drag moved two pooled corners; a page that
    // pushed one entry per vertex would need two keystrokes and leave the
    // rectangle torn open after the first.
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(60);

    const undone = corners(await saveAndRead(page));
    ['nw', 'ne', 'se', 'sw'].forEach(id => {
      expect(undone[id], `${id} must be exactly where it started`)
        .toMatchObject({ x: before[id].x, z: before[id].z, offX: before[id].offX });
    });
  });

  test('an unselected wall is not draggable — the gesture pans',
    async ({ page }) => {
      await houseOnOldPage(page);
      await writeFixture(page);
      await open(page);
      const ppf = await pxPerFt(page);
      const before = corners(await readStore(page));

      // NO SELECTION. Pressing the same pixels on the north wall must slide the
      // sheet, not the wall — otherwise every pan begun on a wall would drag
      // geometry, and a drafter could not move the view without editing.
      await dragFrom(page, 0, -5 * ppf, 0, -3 * ppf);
      await expect(page.locator('#save'),
        'a pan is not an edit and must not mark the drawing unsaved')
        .toHaveText('SAVE');

      const after = corners(await readStore(page));
      ['nw', 'ne', 'se', 'sw'].forEach(id => {
        expect(after[id], `${id} must not have moved without a selection`)
          .toMatchObject({ x: before[id].x, z: before[id].z });
      });
    });
});
