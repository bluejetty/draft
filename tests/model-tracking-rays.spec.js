// THE ORANGE TRACKING RAYS.
//
// Movie, 1 Oct: "show the orange lines going rays outward in H and V
// directions 90 180 270 0 and if he crosses one of them, light it up glow",
// "only brighten it and glow it when he is on it", "no snapping to the line",
// and "make those orange lines for all the ext wall nodes when they draw that
// and the outline too".
//
//   EVERY POINT OF THE RUN       sends rays: the first and each one after it
//   ONLY THE RAY UNDER THE CURSOR lights up, and only on its own side
//   AND THE OUTLINE TOO          its corners send rays the same way
//   GONE WHEN THE RUN IS         a tool change leaves no rays behind
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const empty = () => ({
  version: 1, board: 'drafting',
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

const rays = async page => {
  const raw = await page.locator('#plan').getAttribute('data-tracking-rays');
  return raw ? JSON.parse(raw) : null;
};

test('every point of a wall run sends rays, and only the one under the cursor lights',
  async ({ page }) => {
    await open(page);
    const { at } = await h.planFrame(page);
    await h.armWall(page);
    expect(await rays(page), 'no run, no rays').toBeNull();

    await page.mouse.click(...at(0, 0));
    await page.mouse.move(...at(6, 4));
    let now = await rays(page);
    expect(now.nodes, 'the first point sends rays as soon as it is down').toEqual([[0, 0]]);
    expect(now.lit, 'and none is lit while the cursor is off them').toEqual([]);

    await page.mouse.click(...at(10, 0));
    // STRAIGHT BELOW THE SECOND POINT: its downward ray, and nothing else.
    await page.mouse.move(...at(10, 6));
    now = await rays(page);
    expect(now.nodes, 'the second point joins the first').toEqual([[0, 0], [10, 0]]);
    expect(now.lit.length, 'one ray lit').toBe(1);
    expect(now.lit[0][0], 'the second point\'s').toBe(1);
    expect([90, 270], 'and a vertical one').toContain(now.lit[0][1]);

    // STRAIGHT BELOW THE FIRST POINT lights the first point's ray instead.
    await page.mouse.move(...at(0, 6));
    now = await rays(page);
    expect(now.lit.map(r => r[0]), 'the first point\'s ray now').toEqual([0]);
    // AND ONLY ON ITS OWN SIDE: straight ABOVE the first point is the other
    // vertical ray, never the same one.
    const below = now.lit[0][1];
    await page.mouse.move(...at(0, -6));
    now = await rays(page);
    expect(now.lit.map(r => r[0])).toEqual([0]);
    expect(now.lit[0][1], 'the opposite ray').not.toBe(below);
  });

test('the outline\'s corners send rays the same way', async ({ page }) => {
  await open(page);
  const { at } = await h.planFrame(page);
  await h.selectTool(page, 'outline');
  await page.mouse.click(...at(-8, -6));
  await page.mouse.click(...at(8, -6));
  await page.mouse.move(...at(8, 4));
  const now = await rays(page);
  expect(now.nodes.length, 'both corners').toBe(2);
  expect(now.lit.map(r => r[0]), 'the cursor under the second corner lights its ray').toEqual([1]);
});

test('putting the tool down takes the rays with it', async ({ page }) => {
  await open(page);
  const { at } = await h.planFrame(page);
  await h.armWall(page);
  await page.mouse.click(...at(0, 0));
  await page.mouse.move(...at(4, 4));
  expect(await rays(page)).not.toBeNull();
  await page.keyboard.press('Escape');
  await page.mouse.move(...at(5, 5));
  expect(await rays(page), 'no run, no rays').toBeNull();
});

// AND THE HOUSE'S CORNERS WHILE THE GARAGE IS DRAWN (Movie, 6 Oct: "when i
// draw the GARAGE shape can the HOUSE shape nodes also create the ORANGE
// Raylines"): from the moment the house closes, before the garage's first
// corner, and after the garage's own corners once they are down.
test('the house\'s corners send rays while its garage is traced', async ({ page }) => {
  await open(page);
  await h.openDriveThru(page);
  await page.locator('[data-build-family="bungalow"]').click();
  await page.locator('[data-build-entry="bungalow-garage"]').click();
  await page.locator('#dt-outline').click();
  await expect(page.locator('#drivethru')).toBeHidden();
  const { at } = await h.planFrame(page);
  const house = [[-10, -8], [10, -8], [10, 8], [-10, 8]];
  for (const [x, z] of [...house, house[0]]) await page.mouse.click(...at(x, z));
  if (await page.locator('#garage-lesson').isVisible()) await page.keyboard.press('Enter');
  // Straight below the house's right side: both right corners' downward rays.
  await page.mouse.move(...at(10, 20));
  let now = await rays(page);
  expect(now.nodes, 'the house corners, before any garage corner').toEqual(house);
  expect(now.lit, 'the right corners\' downward rays').toEqual([[1, 90], [2, 90]]);
  await page.mouse.click(...at(-2, 8));
  await page.mouse.move(...at(-2, 14));
  now = await rays(page);
  expect(now.nodes[0], 'the garage\'s own corner first').toEqual([-2, 8]);
  expect(now.nodes.slice(1), 'then the house\'s').toEqual(house);
});
