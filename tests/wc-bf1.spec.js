// WC BF1 ON THE LIVE PAGE (Movie, 17 Oct, NORTH_POINT_S_SUITE.pdf): "can you
// make a WC and KITCHENS that are like on this plan ... call it WC BF1 ...
// (BF = Barrier Free)". The room's geometry is washroom-presets.js's and
// proto/washroom-presets-harness.js proves it; what only the page can show
// is that the third chip stands beside BATH A and BATH B, drops the room
// whole, joins the exterior wall by its vanity end, hangs a door that swings
// OUT, and files one assembly named for it.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const MAIN_FL = 3;

async function houseOnLivePage(page) {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);
  await page.goto('/MODEL.html?left=1&lpane=build');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

async function house(page) {
  const drawing = await h.savedDrawing(page);
  const plan = (drawing.walls || [])
    .filter(w => Number(w.levelId) === MAIN_FL && (w.view || 'plan') === 'plan');
  const xs = plan.flatMap(w => [w.start.x, w.end.x]);
  const zs = plan.flatMap(w => [w.start.z, w.end.z]);
  return { drawing, plan, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
}

async function pressWorld(page, pt) {
  const frame = await h.planFrame(page);
  const [x, y] = frame.at(pt.x, pt.z);
  await page.mouse.move(x, y);
  await page.mouse.click(x, y);
}

async function saveNow(page) {
  await page.locator('[data-model-save]').click();
  await h.waitForSaved(page);
}

test('WC BF1 stands beside the baths and drops whole: no wall of its own on the house wall, the V42 on it, a D32 swinging out', async ({ page }) => {
  await houseOnLivePage(page);
  const before = await house(page);
  const ext = before.plan.find(w => Math.abs(w.start.z - before.z0) < 0.01 && Math.abs(w.end.z - before.z0) < 0.01);
  expect(ext, 'the bone builds a wall along its north edge').toBeTruthy();

  // The third chip on the BATH row, after Movie's two baths.
  const bathRow = page.locator('[data-assembled-row="bath"]');
  await expect(bathRow.locator('[data-washroom]')).toHaveText(['BATH A', 'BATH B', 'WC BF1']);
  const chip = page.locator('[data-washroom="BF1"]');
  await expect(chip).toBeEnabled();
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');

  // Unturned, the vanity end faces -z: half the room plus a few inches off
  // the wall, inside the 18" snap.
  await pressWorld(page, { x: (before.x0 + before.x1) / 2, z: before.z0 + 125.5 / 24 + 0.8 });
  await saveNow(page);
  const after = await h.savedDrawing(page);
  const added = after.walls.filter(w => !before.drawing.walls.some(o => o.id === w.id));
  // Left, right and far -- no end wall, no 6" wall: the house's wall is the end.
  expect(added).toHaveLength(3);
  expect(added.every(w => w.wallType === 'stud_2x4')).toBe(true);
  expect(after.fixtures.map(f => f.kind).sort()).toEqual(['shower', 'toilet', 'vanity']);
  const vanity = after.fixtures.find(f => f.kind === 'vanity');
  expect(vanity.wallId).toBe(ext.id);
  expect(Math.round(vanity.width * 12)).toBe(42);
  const shower = after.fixtures.find(f => f.kind === 'shower');
  expect(added.some(w => w.id === shower.wallId)).toBe(true);
  expect([Math.round(shower.width * 12), Math.round(shower.depth * 12)]).toEqual([72, 36]);
  // The door is on one of the room's own walls, 32" wide, and swings OUT:
  // the room stands on that wall's side 1 (its left normal), and an
  // unflipped swing goes to that side, so swinging away from the room means
  // swingFlip is on.
  const door = after.fenestrations.filter(f => f.type === 'door' && added.some(w => w.id === f.wallId));
  expect(door).toHaveLength(1);
  expect(Math.round(door[0].width * 12)).toBe(32);
  const host = added.find(w => w.id === door[0].wallId);
  const d = { x: host.end.x - host.start.x, z: host.end.z - host.start.z };
  const n = { x: -d.z, z: d.x };
  const centre = { x: (before.x0 + before.x1) / 2, z: before.z0 + 125.5 / 24 };
  const roomOnLeft = n.x * (centre.x - host.start.x) + n.z * (centre.z - host.start.z) >= 0;
  expect(door[0].swingFlip).toBe(roomOnLeft);
  const group = (after.groups || []).find(g => g.name === 'WC BF1');
  expect(group.members.map(m => m.id).sort()).toEqual(added.map(w => w.id).sort());

  // ONE UNDO TAKES THE ROOM.
  await page.keyboard.press('Control+z');
  await saveNow(page);
  const undone = await h.savedDrawing(page);
  expect(undone.walls).toHaveLength(before.drawing.walls.length);
  expect(undone.fixtures || []).toHaveLength(0);
  expect((undone.groups || []).some(g => g.name === 'WC BF1')).toBe(false);
});
