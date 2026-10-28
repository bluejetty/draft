// THE KITCHEN AND BATH PRESETS ON THEIR INSIDE FACES, AND THEIR MINI
// REGISTRATION POINT.
//
// Movie, 28 Oct: "for the KITCHEN L1 (am probably others too, can we change
// the 3.5" wall so the line is on the interior (behind the cabinets etc) and
// the intersection at the corner of the kitchen would be the 'mini'
// registration point so a user can position the placement in the larger
// model precisely", "for bathrooms this model will be used too - interior
// corner placement, so can be adapted", and for the bath's point: "sure tub
// corner".
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
// Well clear of the house, zoomed out until that spot is on the sheet.
async function openFloor(page) {
  await houseOnLivePage(page);
  const drawing = await h.savedDrawing(page);
  const plan = drawing.walls.filter(w => Number(w.levelId) === MAIN_FL && (w.view || 'plan') === 'plan');
  const x1 = Math.max(...plan.flatMap(w => [w.start.x, w.end.x]));
  const z0 = Math.min(...plan.flatMap(w => [w.start.z, w.end.z]));
  const box = await page.locator('#plan').boundingBox();
  for (let i = 0; i < 4; i++) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 240);
    await page.waitForTimeout(80);
  }
  return { before: drawing, at: { x: x1 + 16, z: z0 - 14 } };
}
const targets = async page => JSON.parse(await page.evaluate(() => document.body.dataset.miniTargets || '[]'));
const near = (a, b) => Math.hypot(a.x - b.x, a.z - b.z) < 1e-4;
const onLine = (p, w) => {
  const dx = w.end.x - w.start.x, dz = w.end.z - w.start.z, len = Math.hypot(dx, dz);
  return Math.abs((p.x - w.start.x) * dz - (p.z - w.start.z) * dx) / len < 1e-4;
};

test('KITCHEN L1 in open floor: its two lines are the inside faces, meeting at the mini registration point',
  async ({ page }) => {
    const { before, at } = await openFloor(page);
    await arm(page, '[data-kitchen="L1"]');
    await pressWorld(page, at);
    await expect(page.locator('#strip-message')).toContainText('placed with its own two walls');
    await saveNow(page);
    const d = await h.savedDrawing(page);
    const added = d.walls.filter(w => !before.walls.some(o => o.id === w.id));
    expect(added).toHaveLength(2);
    expect(added.map(w => w.refLine).sort(), 'each drawn on a face, not its centre').toEqual(['left', 'right']);
    expect(near(added[0].start, added[1].start), 'the two lines meet at one corner').toBe(true);
    const group = d.groups.find(g => g.members.some(m => m.id === added[0].id));
    expect(group.registration, 'the kitchen carries its registration point').toBeTruthy();
    const shown = await targets(page);
    const mine = shown.find(t => t.group === group.id);
    expect(mine, 'and it is drawn').toBeTruthy();
    expect(near(mine, added[0].start), 'at the inside corner').toBe(true);
    // The studs stand outside the kitchen: its pieces are on the lines'
    // other side, so each line is the face the cabinets stand against.
    const fixtures = d.fixtures.filter(f => added.some(w => w.id === f.wallId));
    expect(fixtures.length).toBeGreaterThan(0);
  });

test('the registration point rides the kitchen when it is nudged', async ({ page }) => {
  const { before, at } = await openFloor(page);
  await arm(page, '[data-kitchen="L1"]');
  await pressWorld(page, at);
  await expect(page.locator('#strip-message')).toContainText('placed with its own two walls');
  await page.keyboard.press('Escape');
  await saveNow(page);
  let d = await h.savedDrawing(page);
  const top = d.walls.find(w => !before.walls.some(o => o.id === w.id));
  const first = (await targets(page))[0];
  await page.keyboard.press('s');
  await expect.poll(() => page.evaluate(() => activeTool)).toBe('select');
  // Pick the kitchen by a wall's studs -- outward of its line, which is the
  // face the cabinets stand on -- then nudge it with the arrows.
  const len = Math.hypot(top.end.x - top.start.x, top.end.z - top.start.z);
  const u = { x: (top.end.x - top.start.x) / len, z: (top.end.z - top.start.z) / len };
  const out = (top.refLine === 'left' ? 1 : -1) * (1.75 / 12);
  await pressWorld(page, { x: (top.start.x + top.end.x) / 2 - u.z * out, z: (top.start.z + top.end.z) / 2 + u.x * out });
  await page.waitForTimeout(100);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await saveNow(page);
  d = await h.savedDrawing(page);
  const moved = d.walls.find(w => w.id === top.id);
  const dx = moved.start.x - top.start.x;
  expect(Math.abs(dx), 'the kitchen moved').toBeGreaterThan(1e-6);
  const now = (await targets(page))[0];
  expect(now.x, 'and the point went with it').toBeCloseTo(first.x + dx, 4);
  expect(now.z).toBeCloseTo(first.z, 4);
});

test('WC 1 in open floor: its own walls on their inside faces, the point at the tub corner on the vanity side',
  async ({ page }) => {
    const { before, at } = await openFloor(page);
    await arm(page, '[data-washroom="A"]');
    await pressWorld(page, at);
    await expect(page.locator('#strip-message')).toContainText('WC 1 placed');
    await saveNow(page);
    const d = await h.savedDrawing(page);
    const added = d.walls.filter(w => !before.walls.some(o => o.id === w.id));
    const faced = added.filter(w => w.wallType === 'stud_2x4');
    expect(faced.length, 'left, right, far and its own tub wall').toBe(4);
    expect(faced.every(w => w.refLine === 'left' || w.refLine === 'right'), 'every 2x4 on a face').toBe(true);
    const tag = d.roomTags.find(t => t.name === 'WC 1');
    const group = d.groups.find(g => g.name === 'WC 1');
    const mine = (await targets(page)).find(t => t.group === group.id);
    expect(mine, 'the bath carries a drawn registration point').toBeTruthy();
    expect(tag.points.some(p => near(p, mine)), 'at one of its inside corners').toBe(true);
    const tub = d.fixtures.find(f => f.kind === 'tub');
    const vanity = d.fixtures.find(f => f.kind === 'vanity');
    const wall = id => d.walls.find(w => w.id === id);
    expect(onLine(mine, wall(tub.wallId)), 'at the tub end').toBe(true);
    expect(onLine(mine, wall(vanity.wallId)), 'on the vanity\'s wall').toBe(true);
  });
