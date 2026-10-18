// KITCHEN L1 ON THE LIVE PAGE (Movie, 17 Oct, NORTH_POINT_S_SUITE.pdf): "can
// you make a WC and KITCHENS that are like on this plan ... call it ...
// KITCHEN L1". Then: "maybe kitchen not ready still, not working yet like the
// WCs which work good", "these items should be all inserted as an ASSEMBY
// unit", and "we need the L Kitchen as soon as possible". The kitchen's
// geometry is kitchen-presets.js's and proto/kitchen-presets-harness.js
// proves it; what only the page can show is the GESTURE -- the chip beside
// the KITCHEN title, the press into a corner of the house (six fixtures on
// its two walls) or in open floor (with its own two walls), F swapping the
// legs, [ ] turning it, one assembly, and one undo for the lot.
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

// The bone's house: its plan walls, its extent, and the two walls that make
// its north-east corner.
async function house(page) {
  const drawing = await h.savedDrawing(page);
  const plan = (drawing.walls || [])
    .filter(w => Number(w.levelId) === MAIN_FL && (w.view || 'plan') === 'plan');
  const xs = plan.flatMap(w => [w.start.x, w.end.x]);
  const zs = plan.flatMap(w => [w.start.z, w.end.z]);
  const x1 = Math.max(...xs), z0 = Math.min(...zs);
  const onLine = (w, axis, v) => Math.abs(w.start[axis] - v) < 0.01 && Math.abs(w.end[axis] - v) < 0.01;
  return {
    drawing, plan, x1, z0,
    north: plan.find(w => onLine(w, 'z', z0)),
    east: plan.find(w => onLine(w, 'x', x1)),
  };
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

async function arm(page) {
  const chip = page.locator('[data-kitchen="L1"]');
  await expect(chip).toBeEnabled();
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
}

const byKind = (fixtures, kind) => fixtures.filter(f => f.kind === kind);

test('KITCHEN L1 pressed into the north-east corner lays six pieces on its two walls', async ({ page }) => {
  await houseOnLivePage(page);
  const before = await house(page);
  expect(before.north && before.east, 'the bone builds a north and an east wall').toBeTruthy();

  // The chip stands beside the KITCHEN title, alone there now.
  await expect(page.locator('[data-assembled-row="kitchen"] [data-kitchen="L1"]')).toHaveText('KITCHEN L1');
  await arm(page);
  await pressWorld(page, { x: before.x1 - 1.5, z: before.z0 + 1.5 });
  await saveNow(page);
  const after = await h.savedDrawing(page);
  const fixtures = after.fixtures || [];
  expect(fixtures).toHaveLength(6);
  expect(after.walls).toHaveLength(before.drawing.walls.length);
  fixtures.forEach(f => expect(f.layer).toBe('A-FIXT'));

  // The suite as drawn: sink and DW down the east wall, range and fridge
  // along the north wall.
  const wallOf = f => (f.wallId === before.east.id ? 'east' : f.wallId === before.north.id ? 'north' : 'other');
  expect(byKind(fixtures, 'sink').map(wallOf)).toEqual(['east']);
  expect(byKind(fixtures, 'dish').map(wallOf)).toEqual(['east']);
  expect(byKind(fixtures, 'stove').map(wallOf)).toEqual(['north']);
  expect(byKind(fixtures, 'fridge').map(wallOf)).toEqual(['north']);
  expect(byKind(fixtures, 'cabinet').map(wallOf).sort()).toEqual(['east', 'north']);
  // Sizes are the suite's: a 30" sink, a 24" DW, a 24" apartment range, a
  // 36" fridge, the corner counter 8'-6" long.
  const widthIn = kind => Math.round(byKind(fixtures, kind)[0].width * 12);
  expect([widthIn('sink'), widthIn('dish'), widthIn('stove'), widthIn('fridge')]).toEqual([30, 24, 24, 36]);
  // ONE ASSEMBLY of its six pieces, named for it; in a corner of the house it
  // owns no walls, so it is not rigid.
  const group = (after.groups || []).find(g => g.name === 'KITCHEN L1');
  expect(group, 'the kitchen is one assembly').toBeTruthy();
  expect(group.members.map(m => m.type)).toEqual(Array(6).fill('fixture'));
  expect(group.members.map(m => m.id).sort()).toEqual(fixtures.map(f => f.id).sort());
  const eastRun = byKind(fixtures, 'cabinet').find(f => wallOf(f) === 'east');
  expect(Math.round(eastRun.width * 12)).toBe(102);
  // Every piece projects into the house: the corner is at (x1, z0), so the
  // east wall's pieces lie at x < x1 and the north wall's at z > z0.
  const walls = after.walls;
  const G = f => {
    const w = walls.find(x => x.id === f.wallId);
    const dx = w.end.x - w.start.x, dz = w.end.z - w.start.z, len = Math.hypot(dx, dz);
    const ux = dx / len, uz = dz / len, nx = -uz, nz = ux;
    return { x: w.start.x + ux * f.offset + nx * f.side * 1, z: w.start.z + uz * f.offset + nz * f.side * 1 };
  };
  fixtures.forEach(f => {
    const at = G(f);
    expect(at.x).toBeLessThan(before.x1);
    expect(at.z).toBeGreaterThan(before.z0);
  });

  // ONE UNDO TAKES THE KITCHEN, and its assembly with it.
  await page.keyboard.press('Control+z');
  await saveNow(page);
  const undone = await h.savedDrawing(page);
  expect(undone.fixtures || []).toHaveLength(0);
  expect((undone.groups || []).some(g => g.name === 'KITCHEN L1')).toBe(false);
});

test('F swaps the legs: the sink goes along the north wall', async ({ page }) => {
  await houseOnLivePage(page);
  const before = await house(page);
  await arm(page);
  await page.keyboard.press('KeyF');
  await pressWorld(page, { x: before.x1 - 1.5, z: before.z0 + 1.5 });
  await saveNow(page);
  const fixtures = (await h.savedDrawing(page)).fixtures || [];
  expect(fixtures).toHaveLength(6);
  expect(byKind(fixtures, 'sink')[0].wallId).toBe(before.north.id);
  expect(byKind(fixtures, 'stove')[0].wallId).toBe(before.east.id);
});

// IN OPEN FLOOR IT BRINGS ITS OWN TWO WALLS, like a washroom brings its room:
// "not working yet like the WCs which work good".
const openFloor = async page => {
  await houseOnLivePage(page);
  const before = await house(page);
  // Well clear of the house -- no corner within reach -- and zoomed out
  // until that spot is on the sheet.
  const box = await page.locator('#plan').boundingBox();
  for (let i = 0; i < 4; i++) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 240);
    await page.waitForTimeout(80);
  }
  return { before, at: { x: before.x1 + 14, z: before.z0 - 12 } };
};

test('pressed in open floor it brings its own two walls and lays itself against them, one rigid assembly', async ({ page }) => {
  const { before, at } = await openFloor(page);
  await arm(page);
  await pressWorld(page, at);
  await expect(page.locator('#strip-message')).toContainText('with its own two walls');
  await saveNow(page);
  const after = await h.savedDrawing(page);
  const added = after.walls.filter(w => !before.drawing.walls.some(b => b.id === w.id));
  expect(added).toHaveLength(2);
  expect(added.every(w => w.wallType === 'stud_2x4')).toBe(true);
  const fixtures = after.fixtures || [];
  expect(fixtures).toHaveLength(6);
  expect(fixtures.every(f => added.some(w => w.id === f.wallId)), 'every piece rides the kitchen\'s own walls').toBe(true);
  const group = (after.groups || []).find(g => g.name === 'KITCHEN L1');
  expect(group.fixed, 'with walls of its own it moves whole').toBe(true);
  expect(group.members).toHaveLength(8);
  await page.keyboard.press('Control+z');
  await saveNow(page);
  const undone = await h.savedDrawing(page);
  expect(undone.walls).toHaveLength(before.drawing.walls.length);
  expect(undone.fixtures || []).toHaveLength(0);
});

test('[ and ] turn it in open floor: a quarter turn and its top wall runs north', async ({ page }) => {
  const { before, at } = await openFloor(page);
  await arm(page);
  await page.keyboard.press('BracketRight');
  await pressWorld(page, at);
  await saveNow(page);
  const after = await h.savedDrawing(page);
  const added = after.walls.filter(w => !before.drawing.walls.some(b => b.id === w.id));
  const top = added.find(w => Math.abs(w.end.x - w.start.x) < 0.01 && w.end.z < w.start.z);
  expect(top, 'one of its walls now runs north from the corner').toBeTruthy();
});
