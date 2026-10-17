// KITCHEN L1 ON THE LIVE PAGE (Movie, 17 Oct, NORTH_POINT_S_SUITE.pdf): "can
// you make a WC and KITCHENS that are like on this plan ... call it ...
// KITCHEN L1". The kitchen's geometry is kitchen-presets.js's and
// proto/kitchen-presets-harness.js proves it; what only the page can show is
// the GESTURE -- the chip beside the KITCHEN title, the press inside a corner
// of the house, six ordinary fixtures filed on the corner's two walls, F
// swapping the legs, and one undo for the lot.
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

  // The chip stands beside the KITCHEN title, with the old page's L PRESET.
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
  // Sizes are the suite's: a 30" sink, a 24" DW, a 30" range, a 36" fridge,
  // the corner counter 8'-6" long.
  const widthIn = kind => Math.round(byKind(fixtures, kind)[0].width * 12);
  expect([widthIn('sink'), widthIn('dish'), widthIn('stove'), widthIn('fridge')]).toEqual([30, 24, 30, 36]);
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

  // ONE UNDO TAKES THE KITCHEN.
  await page.keyboard.press('Control+z');
  await saveNow(page);
  expect((await h.savedDrawing(page)).fixtures || []).toHaveLength(0);
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

test('pressed in the open, nothing is placed and the strip says to find a corner', async ({ page }) => {
  await houseOnLivePage(page);
  const before = await house(page);
  await arm(page);
  await pressWorld(page, { x: before.x1 - 12, z: before.z0 + 12 });
  await expect(page.locator('#strip-message')).toContainText('corner');
  await saveNow(page);
  expect((await h.savedDrawing(page)).fixtures || []).toHaveLength(0);
});
