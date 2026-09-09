// BOARD #348 — A DEALT WASHROOM SLIDES AS ONE UNIT.
//
// Movie's #352 ruling was "just place it and allow user to move it". The
// second half was not true: the dealt group carries `fixed: true`, so every
// reshape was refused, and _translateItemsBy had exactly one caller --
// _applyLevelLockDelta, the lock propagating a delta between floors. Nothing
// originated a delta. The unit was doubly immovable and deletion was the only
// recourse.
//
// Grabbing a node of a rigid assembly used to arm NOTHING. It now arms a
// translate. These pin the three things that makes true:
//
//   the unit keeps its shape        -- it is rigid, not merely draggable
//   the locked sibling rides        -- the delta _applyLevelLockDelta waited for
//   `dealt` clears on first touch   -- board #349, on BOTH floors
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const RECT = [[-16, -14], [16, -14], [16, 14], [-16, 14]];

// The half-height comes from helpers, never a copy of it. The first draft of
// this file hardcoded 22 against the real 25, so every press landed a few feet
// from the corner it was aiming at and the drag grabbed nothing -- caught only
// because the "it actually travelled" companion was there to notice zero.
async function worldToClient(page, x, z) {
  const box = await page.locator('[data-model-canvas]').boundingBox();
  const ppf = box.height / (2 * h.HALF_HEIGHT_FT);
  return { x: box.x + box.width / 2 + x * ppf, y: box.y + box.height / 2 + z * ppf };
}

// Press on a, travel to b, release. Far enough to clear the 4px arm threshold.
async function dragWorld(page, a, b) {
  const pa = await worldToClient(page, a.x, a.z);
  const pb = await worldToClient(page, b.x, b.z);
  await page.mouse.move(pa.x, pa.y);
  await page.evaluate(({ ax, ay, bx, by }) => {
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    const canvas = document.querySelector('[data-model-canvas]');
    const base = { bubbles: true, cancelable: true, view: window, button: 0, pointerId: 1, isPrimary: true };
    canvas.dispatchEvent(new PointerEvent('pointermove', { ...base, clientX: ax, clientY: ay, buttons: 0 }));
    canvas.dispatchEvent(new PointerEvent('pointerdown', { ...base, clientX: ax, clientY: ay, buttons: 1 }));
    // Two moves: the first arms the drag past the 4px threshold, the second
    // lands it. One move can arm and land in the same event and still works,
    // but two is what a hand does.
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    canvas.dispatchEvent(new PointerEvent('pointermove', { ...base, clientX: mx, clientY: my, buttons: 1 }));
    canvas.dispatchEvent(new PointerEvent('pointermove', { ...base, clientX: bx, clientY: by, buttons: 1 }));
    window.dispatchEvent(new PointerEvent('pointerup', { ...base, clientX: bx, clientY: by, buttons: 0 }));
  }, { ax: pa.x, ay: pa.y, bx: pb.x, by: pb.y });
  await page.waitForTimeout(400);
}

async function traceHouse(page, points) {
  await h.pickBuild(page, 'twoStorey');
  await page.keyboard.press('Enter');
  for (const [x, z] of points) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await expect(page.locator('[data-tour-popup]')).toBeVisible();
  await page.keyboard.press('Escape');
  await h.waitForSaved(page);
}

const wcGroups = saved => (saved.groups || []).filter(g => g.washroomLevelId != null);

function wcWalls(saved, group) {
  const ids = new Set(group.members.filter(m => m.type === 'wall').map(m => m.id));
  return (saved.walls || []).filter(w => ids.has(w.id))
    .map(w => ({ id: w.id, sx: w.start.x, sz: w.start.z, ex: w.end.x, ez: w.end.z }))
    .sort((a, b) => a.id - b.id);
}

// A signature that changes if the unit DEFORMS but not if it merely moves.
function shape(walls) {
  const minX = Math.min(...walls.map(w => Math.min(w.sx, w.ex)));
  const minZ = Math.min(...walls.map(w => Math.min(w.sz, w.ez)));
  return walls.map(w => [w.sx - minX, w.sz - minZ, w.ex - minX, w.ez - minZ]
    .map(v => +v.toFixed(4)).join(',')).join(' | ');
}

async function dealtHouse(page) {
  await h.openModel(page, { autoStairs: true, tourEscort: true, roomGrow: true });
  await traceHouse(page, RECT);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);
  const groups = wcGroups(saved);
  expect(groups.length, 'two floors were dealt and locked').toBe(2);
  expect(groups.every(g => g.dealt === true), 'both start out machine-dealt').toBe(true);
  expect((saved.levelLocks || []).length, 'and a lock joins them').toBeGreaterThan(0);
  return saved;
}

test('dragging one wall slides the whole assembly, and the locked floor rides', async ({ page }) => {
  const before = await dealtHouse(page);
  const groups = wcGroups(before);
  const near = groups.find(g => g.washroomLevelId === 3); // MAIN FL, the floor activated below
  const far = groups.find(g => g !== near);
  const nearBefore = wcWalls(before, near);
  const farBefore = wcWalls(before, far);

  // MAKE THE UNIT'S FLOOR ACTIVE FIRST. The tour leaves the ROOF active, and
  // a press cannot hit geometry on a floor that is not the active one -- the
  // first draft of this test grabbed thin air for that reason alone, and only
  // the "it actually travelled" companion noticed.
  await page.locator('.level-row', { hasText: 'MAIN FL' }).locator('.level-body').click();
  await page.waitForTimeout(200);

  // Grab a real corner of the unit and pull it 2ft along each axis.
  const corner = { x: nearBefore[0].sx, z: nearBefore[0].sz };
  await h.selectTool(page, 'Select');
  await dragWorld(page, corner, { x: corner.x + 2, z: corner.z + 2 });
  await h.waitForSaved(page);

  const after = await h.savedDrawing(page);
  const nearAfter = wcWalls(after, wcGroups(after).find(g => g.washroomLevelId === near.washroomLevelId));
  const farAfter = wcWalls(after, wcGroups(after).find(g => g.washroomLevelId === far.washroomLevelId));

  // IT MOVED. Without this the shape check below passes on a drag that did
  // nothing at all -- an untouched unit trivially keeps its shape.
  const moved = Math.hypot(nearAfter[0].sx - nearBefore[0].sx, nearAfter[0].sz - nearBefore[0].sz);
  expect(moved, 'the grabbed unit actually travelled').toBeGreaterThan(0.5);

  // IT DID NOT DEFORM. This is the whole reason the group is rigid: the
  // 103"/67" runs cannot drift, or closes() is false of a room it approved.
  expect(shape(nearAfter), 'the unit kept its exact shape').toBe(shape(nearBefore));

  // THE LOCKED FLOOR RODE ALONG, by the same delta.
  const farMoved = Math.hypot(farAfter[0].sx - farBefore[0].sx, farAfter[0].sz - farBefore[0].sz);
  expect(farMoved, 'the locked sibling moved too').toBeCloseTo(moved, 3);
  expect(shape(farAfter), 'and kept its shape as well').toBe(shape(farBefore));

  // FIRST TOUCH CLEARS `dealt`, on both floors -- the lock carried the far
  // one, but the drafter is who moved it.
  expect(wcGroups(after).some(g => g.dealt === true),
    'no unit still claims to be machine-placed').toBe(false);
});
