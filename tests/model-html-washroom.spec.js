// THE DEFAULT WASHROOMS: BATH A and BATH B, picked under the FIXTURE tool and
// dropped whole (Movie, 9 Oct: "make some 'default' washrooms i can select
// and add to the plan"). The room's geometry is washroom-presets.js's and its
// harness proves it; what only the page can show is the GESTURE -- the chip,
// the press, the snap to the exterior wall, the one assembly and the one undo.
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
  await page.locator('[data-board="drafting"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-board', 'drafting');
}

// The bone's house: its plan walls and their extent on the MAIN FL.
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

async function arm(page, id) {
  const chip = page.locator(`[data-washroom="${id}"]`);
  await expect(chip).toBeEnabled();
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
}

test('BATH A dropped by the exterior wall joins it: no tub wall of its own, the tub on the house wall', async ({ page }) => {
  await houseOnLivePage(page);
  const before = await house(page);
  const ext = before.plan.find(w => Math.abs(w.start.z - before.z0) < 0.01 && Math.abs(w.end.z - before.z0) < 0.01);
  expect(ext, 'the bone builds a wall along its north edge').toBeTruthy();
  await arm(page, 'A');
  // Unturned, the tub end faces -z: half the room plus a few inches off the
  // wall, inside the 18" snap.
  await pressWorld(page, { x: (before.x0 + before.x1) / 2, z: before.z0 + 103 / 24 + 0.8 });
  if (process.env.SHOT) {
    await page.keyboard.press('Escape');
    const frame = await h.planFrame(page);
    const [sx, sy] = frame.at((before.x0 + before.x1) / 2, before.z0 + 4.3);
    await page.mouse.move(sx, sy);
    for (let i = 0; i < 6; i += 1) { await page.mouse.wheel(0, -200); await page.waitForTimeout(60); }
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${process.env.SHOT}/bath-a.png` });
    await arm(page, 'A'); await page.keyboard.press('Escape');
  }
  await saveNow(page);
  const after = await h.savedDrawing(page);
  const added = after.walls.filter(w => !before.drawing.walls.some(o => o.id === w.id));
  // Left, right, far and the 6" wall at the tub's foot -- and no tub wall.
  expect(added).toHaveLength(4);
  expect(added.filter(w => w.wallType === 'stud_2x6')).toHaveLength(1);
  const tub = after.fixtures.find(f => f.kind === 'tub');
  expect(tub.wallId).toBe(ext.id);
  expect(after.fixtures.map(f => f.kind).sort()).toEqual(['toilet', 'tub', 'vanity']);
  const door = after.fenestrations.filter(f => f.type === 'door' && added.some(w => w.id === f.wallId));
  expect(door).toHaveLength(1);
  expect(Math.round(door[0].width * 12)).toBe(32);
  const group = (after.groups || []).find(g => g.name === 'BATH A');
  expect(group.members.map(m => m.id).sort()).toEqual(added.map(w => w.id).sort());

  // ONE UNDO TAKES THE ROOM.
  await page.keyboard.press('Control+z');
  await saveNow(page);
  const undone = await h.savedDrawing(page);
  expect(undone.walls).toHaveLength(before.drawing.walls.length);
  expect(undone.fixtures || []).toHaveLength(0);
  expect((undone.groups || []).some(g => g.name === 'BATH A')).toBe(false);
});

test('BATH B in the middle of the house draws its own tub wall, and F mirrors it', async ({ page }) => {
  await houseOnLivePage(page);
  const before = await house(page);
  await arm(page, 'B');
  const mid = { x: (before.x0 + before.x1) / 2, z: (before.z0 + before.z1) / 2 };
  await page.keyboard.press('KeyF');
  await pressWorld(page, mid);
  if (process.env.SHOT) {
    await page.keyboard.press('Escape');
    const frame = await h.planFrame(page);
    const [sx, sy] = frame.at(mid.x, mid.z);
    await page.mouse.move(sx, sy);
    for (let i = 0; i < 6; i += 1) { await page.mouse.wheel(0, -200); await page.waitForTimeout(60); }
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${process.env.SHOT}/bath-b.png` });
  }
  await saveNow(page);
  const after = await h.savedDrawing(page);
  const added = after.walls.filter(w => !before.drawing.walls.some(o => o.id === w.id));
  expect(added).toHaveLength(4);
  expect(added.every(w => w.wallType === 'stud_2x4')).toBe(true);
  const tub = after.fixtures.find(f => f.kind === 'tub');
  expect(added.some(w => w.id === tub.wallId)).toBe(true);
  // Mirrored: the toilet and vanity stand on the room's -x side (unturned,
  // the right wall is at +x).
  const toiletWall = added.find(w => w.id === after.fixtures.find(f => f.kind === 'toilet').wallId);
  expect(toiletWall.start.x).toBeLessThan(mid.x);
  expect((after.groups || []).some(g => g.name === 'BATH B')).toBe(true);
});
