// THE NORTH POINT SUITES' WCs AND KITCHENS ON THE LIVE PAGE.
//
// Movie, 17-18 Oct, sending the 1B, 1BD and 2BD suite sheets: "can you make
// KITCHEN U1 and WC BF2 from this", "KITCHEN L2 and WC BF3 (in this one we
// should include the CLOSET and the W/D Laundry closet i think)", "the WC with
// CL on the back lets call that one WC BF3 (or whichever # is next in line)
// put the closet on the back of this one, include that as part of the
// 'ASSEMBLY'", "WCBF# (next one) include the closet too", "have the Kitchen as
// KITCHEN L# (next number -- its very similar to the last one we may need to
// combine these later but keep seperate for now)".
//
// The rooms' geometry is washroom-presets.js's and kitchen-presets.js's, and
// their harnesses prove it turned and mirrored; what only the page can show
// is the press: each drops whole, its closet and laundry and doors with it,
// one assembly, one undo -- and a kitchen's island floats off its wall.
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

async function arm(page, sel) {
  const chip = page.locator(sel);
  await expect(chip).toBeEnabled();
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
}

// Well clear of the house -- no exterior wall or corner within reach -- and
// zoomed out until that spot is on the sheet.
async function openFloor(page) {
  await houseOnLivePage(page);
  const before = await house(page);
  const box = await page.locator('#plan').boundingBox();
  for (let i = 0; i < 4; i++) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 240);
    await page.waitForTimeout(80);
  }
  return { before, at: { x: before.x1 + 16, z: before.z0 - 14 } };
}

const WCS = {
  BF2: { walls: 8, fixtures: 'toilet tub vanity', doors: 'single single' },
  BF3: { walls: 11, fixtures: 'dryer toilet tub vanity washer', doors: 'french single single' },
  BF4: { walls: 8, fixtures: 'toilet tub vanity vanity', doors: 'single' },
  BF5: { walls: 6, fixtures: 'shower toilet vanity', doors: 'french single' },
};

test('each suite WC drops whole in open floor -- its closet, its laundry, every door -- one assembly, one undo', async ({ page }) => {
  const { before, at } = await openFloor(page);
  for (const [id, want] of Object.entries(WCS)) {
    await arm(page, `[data-washroom="${id}"]`);
    await pressWorld(page, at);
    await expect(page.locator('#strip-message')).toContainText(`WC ${id} placed`);
    await saveNow(page);
    const after = await h.savedDrawing(page);
    const added = after.walls.filter(w => !before.drawing.walls.some(o => o.id === w.id));
    expect(added, `${id}: its walls`).toHaveLength(want.walls);
    expect(added.every(w => w.wallType === 'stud_2x4'), `${id}: every wall a 2x4`).toBe(true);
    expect((after.fixtures || []).map(f => f.kind).sort().join(' '), `${id}: its fixtures`).toBe(want.fixtures);
    const doors = (after.fenestrations || []).filter(f => f.type === 'door' && added.some(w => w.id === f.wallId));
    expect(doors.map(d => d.doorStyle).sort().join(' '), `${id}: its doors`).toBe(want.doors);
    const group = (after.groups || []).find(g => g.name === `WC ${id}`);
    expect(group, `${id}: one assembly named for it`).toBeTruthy();
    expect(group.members.map(m => m.id).sort()).toEqual(added.map(w => w.id).sort());
    // ONE UNDO TAKES IT ALL, closet and laundry and doors.
    await page.keyboard.press('Control+z');
    await saveNow(page);
    const undone = await h.savedDrawing(page);
    expect(undone.walls, `${id}: one undo takes its walls`).toHaveLength(before.drawing.walls.length);
    expect(undone.fixtures || [], `${id}: and its fixtures`).toHaveLength(0);
    expect((undone.fenestrations || []).filter(f => f.type === 'door'), `${id}: and its doors`)
      .toHaveLength((before.drawing.fenestrations || []).filter(f => f.type === 'door').length);
  }
});

test('WC BF2 dropped by the exterior wall draws no end wall: its toilet stands on the house wall', async ({ page }) => {
  await houseOnLivePage(page);
  const before = await house(page);
  const ext = before.plan.find(w => Math.abs(w.start.z - before.z0) < 0.01 && Math.abs(w.end.z - before.z0) < 0.01);
  await arm(page, '[data-washroom="BF2"]');
  // Unturned, its exterior end faces -z: half the room plus a few inches off
  // the north wall, inside the 18" snap.
  await pressWorld(page, { x: (before.x0 + before.x1) / 2, z: before.z0 + 138 / 24 + 0.8 });
  await expect(page.locator('#strip-message')).toContainText('against the exterior wall');
  await saveNow(page);
  const after = await h.savedDrawing(page);
  const added = after.walls.filter(w => !before.drawing.walls.some(o => o.id === w.id));
  expect(added).toHaveLength(7);
  expect(after.fixtures.find(f => f.kind === 'toilet').wallId).toBe(ext.id);
});

const KITCHENS = {
  L2: { pieces: 'cabinet cabinet cabinet dish fridge island sink stove', island: 81 },
  L3: { pieces: 'cabinet cabinet dish fridge island sink stove', island: 84 },
  U1: { pieces: 'cabinet cabinet dish fridge island sink stove', island: 92.5 },
};

test('the suites\' kitchens drop in open floor with their own two walls, the island floated off its wall with its sink and dishwasher', async ({ page }) => {
  const { before, at } = await openFloor(page);
  for (const [id, want] of Object.entries(KITCHENS)) {
    await arm(page, `[data-kitchen="${id}"]`);
    await pressWorld(page, at);
    await expect(page.locator('#strip-message')).toContainText(`KITCHEN ${id} placed with its own two walls`);
    await saveNow(page);
    const after = await h.savedDrawing(page);
    const added = after.walls.filter(w => !before.drawing.walls.some(o => o.id === w.id));
    expect(added, `${id}: its two walls`).toHaveLength(2);
    const fixtures = after.fixtures || [];
    expect(fixtures.map(f => f.kind).sort().join(' '), `${id}: its pieces`).toBe(want.pieces);
    // The island, and the sink and DW on it, at the sheet's standoff.
    const floated = fixtures.filter(f => f.standoff).map(f => `${f.kind}:${Math.round(f.standoff * 12 * 10) / 10}`).sort();
    expect(floated, `${id}: the island and what stands on it`)
      .toEqual([`dish:${want.island}`, `island:${want.island}`, `sink:${want.island}`]);
    const group = (after.groups || []).find(g => g.name === `KITCHEN ${id}`);
    expect(group.members, `${id}: one assembly, walls and pieces`).toHaveLength(2 + fixtures.length);
    await page.keyboard.press('Control+z');
    await saveNow(page);
    const undone = await h.savedDrawing(page);
    expect(undone.walls).toHaveLength(before.drawing.walls.length);
    expect(undone.fixtures || []).toHaveLength(0);
  }
});

test('F mirrors KITCHEN L2 in open floor and it still drops: its own walls swap lengths with its legs', async ({ page }) => {
  const { before, at } = await openFloor(page);
  await arm(page, '[data-kitchen="L2"]');
  await page.keyboard.press('KeyF');
  await pressWorld(page, at);
  await expect(page.locator('#strip-message')).toContainText('KITCHEN L2 placed with its own two walls');
  await saveNow(page);
  const after = await h.savedDrawing(page);
  const added = after.walls.filter(w => !before.drawing.walls.some(o => o.id === w.id));
  const lengths = added.map(w => Math.round(Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z) * 12)).sort((a, b) => a - b);
  // 105" and 174", each line its leg exactly: the lines are the inside
  // faces and run from the inside corner (Movie, 28 Oct). The short leg is
  // on the wall that runs west now, the long one down the side.
  expect(lengths).toEqual([105, 174]);
  const west = added.find(w => Math.abs(w.end.z - w.start.z) < 0.01);
  expect(Math.round(Math.abs(west.end.x - west.start.x) * 12)).toBe(105);
});
