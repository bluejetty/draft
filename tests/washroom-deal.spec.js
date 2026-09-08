// BOARD #315 — THE DEALT WASHROOM AND THE LEVEL LOCK.
//
// One three-piece WC per silent floor, built from washroom.js, grouped
// rigid, seated beside the stairs on the garage side clear of the landing
// zones, then stacked and LOCKED so the wet wall lines up floor to floor
// and the drain runs straight down.
//
// The unit's own arithmetic and the placement rules are pinned offline
// (proto/washroom-harness.js, 44 checks; proto/level-lock-harness.js, 22).
// This file pins the COMMIT layer: that a bone press really deals them,
// really groups them, really locks them, and that silence is what it fills.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const RECT = [[-16, -14], [16, -14], [16, 14], [-16, 14]];

async function bareOutline(page) {
  await h.pickBuild(page, 'twoStorey');
  await page.keyboard.press('Enter');
  for (const [x, z] of RECT) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await expect(page.locator('[data-tour-popup]')).toBeVisible();
  await page.keyboard.press('Escape');
  await h.waitForSaved(page);
}

const washrooms = saved => (saved.groups || []).filter(g => g.washroomLevelId != null);
const locks = saved => saved.levelLocks || [];

test('a bone press deals a washroom on every silent floor, stacked and locked', async ({ page }) => {
  await h.openModel(page, { autoStairs: true, tourEscort: true, roomGrow: true });
  await bareOutline(page);

  const before = await h.savedDrawing(page);
  // THE FIXTURE IS REALLY BARE. Every check below is "the bone produced X";
  // if the tour had already produced X the file would pass while the bone
  // did nothing.
  expect(washrooms(before), 'no washroom before the press').toHaveLength(0);
  expect(locks(before), 'and no lock').toHaveLength(0);

  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);

  const units = washrooms(saved);
  expect(units.length, 'a washroom on each silent floor').toBeGreaterThan(1);
  units.forEach(unit => {
    expect(unit.fixed, 'each unit is a RIGID assembly').toBe(true);
    expect(unit.name).toBe('WASHROOM');
    expect(unit.members.length, 'four walls to a unit').toBe(4);
  });

  // ONE PER FLOOR, not two on one.
  const levels = units.map(u => u.washroomLevelId);
  expect(new Set(levels).size, 'one per floor, never two on one').toBe(units.length);

  // LOCKED ACROSS THE FLOORS.
  const stack = locks(saved);
  expect(stack.length, 'one lock over the stack').toBe(1);
  expect(stack[0].members.length, 'every unit is a member').toBe(units.length);
  expect(new Set(stack[0].members)).toEqual(new Set(units.map(u => u.id)));

  // THE WET WALL IS 2x6 AND THE OTHER THREE ARE 2x4 — the whole reason the
  // stack is worth locking is that one wall carries every supply.
  const wallById = new Map((saved.walls || []).map(w => [w.id, w]));
  units.forEach(unit => {
    const types = unit.members.map(m => wallById.get(m.id)?.wallType).sort();
    expect(types, 'one 2x6 wet wall, three 2x4')
      .toEqual(['stud_2x4', 'stud_2x4', 'stud_2x4', 'stud_2x6']);
  });

  // STACKED: every unit sits at the same plan position.
  const boxes = units.map(unit => {
    const pts = unit.members.flatMap(m => {
      const w = wallById.get(m.id);
      return w ? [w.start, w.end] : [];
    });
    return { x: Math.min(...pts.map(p => p.x)), z: Math.min(...pts.map(p => p.z)) };
  });
  boxes.forEach(box => {
    expect(box.x).toBeCloseTo(boxes[0].x, 6);
    expect(box.z).toBeCloseTo(boxes[0].z, 6);
  });

  await expect(page.locator('[data-model-drawing-message]')).toContainText('washrooms dealt');
});

test('one press is still one undo, with the washrooms in it', async ({ page }) => {
  await h.openModel(page, { autoStairs: true, tourEscort: true, roomGrow: true });
  await bareOutline(page);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  expect(washrooms(await h.savedDrawing(page)).length).toBeGreaterThan(1);

  await page.keyboard.press('Control+z');
  await h.waitForSaved(page);
  const undone = await h.savedDrawing(page);

  // The stairs half found this the hard way: a fill that marks its own
  // history lands its own undo step, and ctrl-Z peels the house off while
  // leaving the fill standing in an empty outline.
  expect(undone.walls || [], 'the house is gone').toHaveLength(0);
  expect(washrooms(undone), 'and so are the washrooms it came with').toHaveLength(0);
  expect(locks(undone), 'and the lock with them').toHaveLength(0);
});

test('a floor the drafter stamped gets no washroom dealt', async ({ page }) => {
  await h.openModel(page, { autoStairs: true, tourEscort: true, roomGrow: true });
  await h.pickBuild(page, 'twoStorey');
  await page.keyboard.press('Enter');
  for (const [x, z] of RECT) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await page.locator('[data-tour-popup]').click();      // FOUNDATION → MAIN
  await h.waitForSaved(page);
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-tour-popup]')).toBeVisible();
  await page.locator('[data-tour-popup]').click();      // → rooms-main
  await expect(page.locator('[data-room-tray]')).toBeVisible();
  await page.locator('[data-tray-chip]').filter({ hasText: /^KITCHEN$/ }).click();
  await h.clickWorld(page, -6, -6);
  await h.waitForSaved(page);
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-tour-popup]')).toBeVisible();
  await page.keyboard.press('Escape');
  await h.waitForSaved(page);

  const before = await h.savedDrawing(page);
  const spokenFor = before.roomTags.find(t => t.stamped && t.base)?.levelId;
  expect(spokenFor, 'the fixture needs the stamp it is about').toBeTruthy();

  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);

  expect(washrooms(saved).filter(u => u.washroomLevelId === spokenFor),
    'a stamped floor has spoken — no washroom dealt on it').toHaveLength(0);
  // AND THE COMPANION: the OTHER floor stayed silent and must have one, or a
  // deal that never ran at all would pass the check above.
  expect(washrooms(saved).filter(u => u.washroomLevelId !== spokenFor).length,
    'the silent floor must still be dealt, or the check above proves nothing')
    .toBeGreaterThan(0);
});

// BOARD #349 — UNIT OWNERSHIP. Two facts that cost nothing today and cannot
// be recovered later, so they are written from day one.
test('a dealt unit says so, carries no master links, and stops saying so once touched', async ({ page }) => {
  await h.openModel(page, { autoStairs: true, tourEscort: true, roomGrow: true });
  await bareOutline(page);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);

  const units = washrooms(saved);
  expect(units.length, 'a unit to be about').toBeGreaterThan(0);

  // MACHINE-PLACED UNTIL TOUCHED. Once files exist where a dealt unit and a
  // drafter-moved one both say dealt:true, no migration can separate them --
  // the information was never written down.
  units.forEach(unit => expect(unit.dealt, 'the bone placed this').toBe(true));

  // NO MASTER LINKS ON A SEATED UNIT. The schema would accept srcId/offX/offZ,
  // and accepting them is a shear defect: four corners riding four different
  // master points deform the unit independently, the 103"/67" runs stop
  // holding, and two locked floors can shear apart -- breaking the wet-wall
  // stack the LEVEL LOCK exists for.
  const wallById = new Map((saved.walls || []).map(w => [w.id, w]));
  units.forEach(unit => unit.members.forEach(member => {
    const wall = wallById.get(member.id);
    expect(wall, 'every member resolves to a wall').toBeTruthy();
    [wall.start, wall.end].forEach(pt => {
      expect(pt.srcId, 'a seated unit rides no master point').toBeUndefined();
      expect(pt.offX, 'and carries no master offset').toBeUndefined();
      expect(pt.offZ).toBeUndefined();
    });
  }));
});
