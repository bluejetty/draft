// WHICH SIDE OF THE LINE THE WALL STANDS ON.
//
// Movie, 16 Oct: "allow the user to select the 'LEFT SIDE' CENTERLINE or
// 'RIGHT SIDE' for placement of the actual wall, based on where the LINE is
// positioned". CENTERLINE the default; the pick sticky between walls; LEFT
// and RIGHT read along the direction of travel, first press to second.
//
// THE RECORD ALREADY HELD THIS. A wall keeps one line and a `refLine` naming
// the FACE that line is -- 'left' means the line is the wall's left face, so
// the body lies to the drafter's RIGHT. His words name the BODY's side. The
// WALL panel and the selection panel both speak his words and store the
// record's, and these checks hold the two together: LEFT SIDE is refLine
// 'right'.
//
// AND ALONG A HARD LINE THE SIDE IS NOT THE DRAFTER'S TO GET WRONG. A wall
// whose line lies on an inside face or an opening edge (the TOY grain's hard
// lines) has one side it can stand on; it takes that side whatever the panel
// says, and the panel's pick is left alone.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
const T_2X6 = 5.5 / 12;

// The house from model-toy-grain.spec.js: a 20 ft square with its outline,
// walls clockwise with 'left' reference lines so each body sits inside.
const square = (x0, z0, x1, z1) => [
  ['n', V(x0, z0), V(x1, z0)], ['e', V(x1, z0), V(x1, z1)],
  ['s', V(x1, z1), V(x0, z1)], ['w', V(x0, z1), V(x0, z0)],
];
const house = (board, extra = {}) => ({
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  walls: square(-10, -10, 10, 10).map(([id, start, end]) => ({ id, start, end, levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' })),
  outlines: [{ id: 'house', levelId: 3, points: [V(-10, -10), V(10, -10), V(10, 10), V(-10, 10)] }],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [], fixtures: [],
  nextDrawingItemId: 20,
  board,
  ...extra,
});

async function open(page, file) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

const frame = page => h.planFrame(page);
const saveAndRead = async page => {
  await page.locator('[data-model-save]').click();
  await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });
  return page.evaluate(async bucket => {
    const f = await window.SharedFileStore.loadSharedFile(bucket);
    return JSON.parse(await f.text());
  }, BUCKET);
};
const FIXTURE_IDS = ['n', 'e', 's', 'w'];
const drawnWalls = saved => (saved.walls || []).filter(w => !FIXTURE_IDS.includes(w.id));

// The WALL panel's row while the tool is armed, and the selection panel's
// while a wall is picked: one row at a time, the same words on both.
const sideRow = page => page.locator('[data-prop-row="wall side"]');
const sideChip = (page, value) => sideRow(page).locator(`[data-prop-value="${value}"]`);
// PRESSED BY ITS WORD, never by its stored value: the whole point of the
// panel is that LEFT SIDE means a wall on the left, and a check that clicks
// the chip whose value is 'right' cannot tell the words from a swapped table.
const pressSide = (page, word) => sideRow(page).getByRole('button', { name: word, exact: true }).click();

async function drawRun(page, x1, z1, x2, z2) {
  const { at } = await frame(page);
  await h.armWall(page);
  await page.mouse.click(...at(x1, z1));
  await page.mouse.move(...at(x2, z2), { steps: 10 });
  await page.waitForTimeout(60);
  await page.mouse.click(...at(x2, z2));
  await page.waitForTimeout(120);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
}

test('arming the WALL tool raises its panel -- LEFT SIDE, CENTERLINE, RIGHT SIDE -- with CENTERLINE pressed, and a drawn wall is a centreline wall',
  async ({ page }) => {
    await open(page, house('drafting'));
    await h.armWall(page);
    await expect(sideRow(page)).toBeVisible();
    await expect(sideRow(page).locator('[data-prop-value]')).toHaveText(['LEFT SIDE', 'CENTERLINE', 'RIGHT SIDE']);
    await expect(sideChip(page, 'center'), 'CENTERLINE is the default').toHaveAttribute('aria-pressed', 'true');
    await drawRun(page, 2, 2, 8, 2);
    const [w] = drawnWalls(await saveAndRead(page));
    expect(w, 'the wall reached the file').toBeTruthy();
    expect(w.refLine, 'its line is its centreline').toBe('center');
  });

test('LEFT SIDE puts the wall on the drafter\'s left of the line, sticks for the next wall, and survives a save and a reload',
  async ({ page }) => {
    await open(page, house('drafting'));
    await h.armWall(page);
    await pressSide(page, 'LEFT SIDE');
    await expect(sideChip(page, 'right'), 'LEFT SIDE lit, and it is the record\'s right face').toHaveAttribute('aria-pressed', 'true');
    // Drawn left to right. The body on the drafter's LEFT of that travel is
    // the record's 'right': the line is the wall's right face.
    await drawRun(page, 2, 2, 8, 2);
    await drawRun(page, 2, 6, 8, 6);
    const saved = await saveAndRead(page);
    const walls = drawnWalls(saved);
    expect(walls.map(w => w.refLine), 'both walls, the second from the sticky pick').toEqual(['right', 'right']);
    expect(saved.wallRefLine, 'the pick is the drawing\'s and the save keeps it').toBe('right');
    // AND A RELOAD READS IT BACK: the tool comes up on LEFT SIDE.
    await page.reload();
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
    await h.armWall(page);
    await expect(sideChip(page, 'right'), 'still LEFT SIDE after the reload').toHaveAttribute('aria-pressed', 'true');
  });

test('the selection panel speaks the same words, and a wall-type change leaves the line where it is',
  async ({ page }) => {
    await open(page, house('drafting'));
    await h.armWall(page);
    await pressSide(page, 'LEFT SIDE');
    await drawRun(page, 2, 2, 8, 2);
    // Pick the wall with SELECT, on its line.
    const { at } = await frame(page);
    await h.armFromRail(page, 'select');
    await page.mouse.click(...at(5, 2));
    await page.waitForTimeout(150);
    await expect(sideRow(page), 'the selection panel has the row').toBeVisible();
    await expect(sideChip(page, 'right'), 'and it reads LEFT SIDE for a refLine of right')
      .toHaveAttribute('aria-pressed', 'true');
    await expect(sideChip(page, 'right')).toHaveText('LEFT SIDE');
    // A thinner type: the stored line is the wall's right face and stays put;
    // the body grows and shrinks off it. The room keeps its clear dimension.
    // Compared with the line as drawn, not with round numbers: on DRAFTING
    // the line lands where the pixel put it, a millionth off.
    const [before] = drawnWalls(await saveAndRead(page));
    await page.locator('[data-prop-row="type"] [data-prop-value="stud_2x4"]').click();
    await page.waitForTimeout(100);
    const [w] = drawnWalls(await saveAndRead(page));
    expect(w.wallType).toBe('stud_2x4');
    const line = wall => [wall.start.x, wall.start.z, wall.end.x, wall.end.z];
    line(w).forEach((v, i) => expect(v, 'the line did not move').toBeCloseTo(line(before)[i], 9));
    expect(w.refLine).toBe('right');
  });

test('along an inside face the wall takes the room side, whatever the panel says, and the pick is left alone',
  async ({ page }) => {
    await open(page, house('toy'));
    await h.armWall(page);
    await pressSide(page, 'LEFT SIDE');
    // Along the north wall's inside face, left to right: both ends snap to
    // z = -10 + 5½". Travelling +x the drafter's LEFT is the exterior wall,
    // so LEFT SIDE would stand the wall inside the 2x6. The face answers:
    // the body goes into the room, which is refLine 'left' for this travel.
    await drawRun(page, -6, -9.6, 6, -9.6);
    // And right to left along the same face: the room is now on the
    // drafter's left, which is refLine 'right'.
    await drawRun(page, 6, -9.6, -6, -9.6);
    const walls = drawnWalls(await saveAndRead(page));
    expect(walls.length).toBe(2);
    walls.forEach(w => {
      expect(w.start.z, 'on the face').toBeCloseTo(-10 + T_2X6, 9);
      expect(w.end.z, 'on the face').toBeCloseTo(-10 + T_2X6, 9);
    });
    expect(walls.map(w => w.refLine), 'into the room, both ways round').toEqual(['left', 'right']);
    await expect(sideChip(page, 'right'), 'the panel still says LEFT SIDE').toHaveAttribute('aria-pressed', 'true');
  });

test('along an opening edge the wall goes away from the hole', async ({ page }) => {
  await open(page, house('toy', {
    floors: [{ id: 'fl', levelId: 3, points: [V(-10, -10), V(10, -10), V(10, 10), V(-10, 10)] }],
    surfaceOpenings: [{ id: 'well', levelId: 3, hostType: 'floor', hostId: 'fl',
      points: [V(2, -3), V(6 + 2.5 / 12, -3), V(6 + 2.5 / 12, 3), V(2, 3)] }],
  }));
  await h.armWall(page);
  // CENTERLINE is the pick; the edge decides. Along the well's north edge
  // from its west corner to its east, travelling +x: the hole is on the
  // drafter's right, so the body goes left of the line, refLine 'right'.
  await drawRun(page, 2.2, -2.9, 6.0, -2.9);
  const [w] = drawnWalls(await saveAndRead(page));
  expect(w, 'the wall reached the file').toBeTruthy();
  expect([w.start.x, w.start.z]).toEqual([2, -3]);
  expect(w.end.x).toBeCloseTo(6 + 2.5 / 12, 9);
  expect(w.end.z).toBe(-3);
  expect(w.refLine, 'the body is away from the hole').toBe('right');
});

test('a run square INTO the face is not along it: the panel\'s pick stands', async ({ page }) => {
  await open(page, house('toy'));
  await h.armWall(page);
  await pressSide(page, 'LEFT SIDE');
  await drawRun(page, 3.3, 2.2, 3.3, -9.8);         // ends on the face, runs along z
  const [w] = drawnWalls(await saveAndRead(page));
  expect(w.end.z, 'cut at the face').toBeCloseTo(-10 + T_2X6, 9);
  expect(w.refLine, 'but the face is not its line, so the pick holds').toBe('right');
});

// THE WALL TYPE, PICKED BEFORE DRAWING (Movie, 18 Oct: "under the WALL title
// can we put the TYPE of WALL - 2x4, 2X6, 2X8, 11.25" (6"CORE) ICF 13.25
// (8"CORE) ICF, 8" CONC" -- "so i can select a wall type / thickness before
// drawing").
const typeRow = page => page.locator('[data-prop-row="wall type"]');
test('the WALL panel offers the six types, 2X6 lit; a pick is the next wall\'s type and sticks, ICF on a floor plan too',
  async ({ page }) => {
    await open(page, house('drafting'));
    await h.armWall(page);
    await expect(typeRow(page).locator('[data-prop-value]')).toHaveText(
      ['2X4', '2X6', '2X8', '11 1/4" ICF (6" CORE)', '13 1/4" ICF (8" CORE)', '8" CONC']);
    await expect(typeRow(page).locator('[data-prop-value="stud_2x6"]')).toHaveAttribute('aria-pressed', 'true');
    await typeRow(page).locator('[data-prop-value="stud_2x8"]').click();
    await drawRun(page, 2, 2, 8, 2);
    await h.armWall(page);
    await typeRow(page).locator('[data-prop-value="icf_13"]').click();
    await drawRun(page, 2, 6, 8, 6);
    await drawRun(page, 2, -6, 8, -6);
    const saved = await saveAndRead(page);
    expect(drawnWalls(saved).map(w => w.wallType)).toEqual(['stud_2x8', 'icf_13', 'icf_13']);
    expect(saved.activeWallType).toBe('icf_13');
    // AND THE PAGE KNOWS EACH, at its own thickness: the 2x8 is 7 1/4".
    const thick = await page.evaluate(() => Object.fromEntries(['stud_2x8', 'icf', 'icf_13', 'concrete_8']
      .map(id => [id, window.DraftWallTypes.WALL_TYPES.find(t => t.id === id)?.totalIn ?? null])));
    expect(thick).toEqual({ stud_2x8: 7.25, icf: 11.25, icf_13: 13.25, concrete_8: 8 });
  });
