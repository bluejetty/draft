// TOY'S 6" GRAIN INSIDE THE HOUSE, AND ON ITS CABINETS.
//
// Movie, 16 Oct, four messages in the order the rules matter:
//
//   "this 6" spacing should be based on the 1ft exterior grid ... if the line
//   isn't connected to a CORNER, the GRID used for the interior 6" snap grid
//   will be based on the 1ft exterior house wall corners" -- and, correcting
//   an earlier wording, "its not measure off inside face - the 6" grid is
//   based on the ext corners of the house (1ft grid)".
//
//   "the interior walls allows the connection at the 5.5" corner (usually
//   default) rather than the 6" so it lines up and the stair opening is a
//   similar line-up method which deviates from the 6" grid (in most cases)"
//   -- "the interior walls should be 'cut' at the interior wall line of the
//   exterior wall", "so those points won't follow the 6" rule in most cases".
//
//   "at the corners the int walls will just move to the req 1/2" for 5.5"
//   wall or whatever in need for the thicker ... or thinner wall".
//
//   And cabinets: "for the CABINETS we allow those to shift extra to 6" scale
//   so we could have 1ft, 18" 24" 30" 36" 42" 48" etc" -- "aligned with the
//   nearest wall at the back of cabinets".
//
// WHY THE FACE MUST BEAT THE GRID, so nobody simplifies it away: 5½" and 6"
// are half an inch apart and indistinguishable by eye. If the grid won, every
// interior wall meeting an exterior wall would miss the inside face by ½" --
// a drawing that looks right and builds wrong.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
const T_2X6 = 5.5 / 12;

// THE HOUSE: the square model-toy-board.spec.js draws on, with its OUTLINE
// written, because the grain is the outline's and a level with walls alone
// has no exterior corners to hang a grid on. Symmetric about the origin so
// fit()'s centre is (0,0). Every wall's reference line is 'left' and the
// walls run clockwise, so each body sits INSIDE the outline and the inside
// face of `n` is at z = -10 + 5½".
const square = (x0, z0, x1, z1) => [
  ['n', V(x0, z0), V(x1, z0)], ['e', V(x1, z0), V(x1, z1)],
  ['s', V(x1, z1), V(x0, z1)], ['w', V(x0, z1), V(x0, z0)],
];
const house = (x0 = -10, z0 = -10, x1 = 10, z1 = 10, extra = {}) => ({
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  walls: square(x0, z0, x1, z1).map(([id, start, end]) => ({ id, start, end, levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' })),
  outlines: [{ id: 'house', levelId: 3, points: [V(x0, z0), V(x1, z0), V(x1, z1), V(x0, z1)] }],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [], fixtures: [],
  nextDrawingItemId: 20,
  board: 'toy',
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

const boardOf = page => page.evaluate(() => document.body.getAttribute('data-board'));
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
const lengthOf = w => Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z);

// THE PAGE IS ASKED WHERE A WORLD POINT LANDS (h.planFrame reads #plan's
// data-view), and the presses are real mouse clicks on MODEL.html's canvas --
// the same gesture model-toy-draw.spec.js performs. h.clickWorld is the OLD
// page's helper and waits for a canvas this page does not have.
const frame = page => h.planFrame(page);

// TWO PRESSES, THEN ESCAPE: the second press commits the wall and leaves the
// chain live from its end; Escape puts the chain down without touching the
// wall, so the next run starts fresh.
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

test('inside the house a TOY run lands on the 6" grid off the exterior corners, and the light stays on',
  async ({ page }) => {
    await open(page, house());
    // The hand at (3.3, 2.2) and then (3.3, 7.7): the first point lands on
    // (3.5, 2), the run squares along z and its free end lands on 7.5 -- a
    // 5'-6" wall, which is a length the foot alone could never make.
    await drawRun(page, 3.3, 2.2, 3.3, 7.7);
    const [w] = drawnWalls(await saveAndRead(page));
    expect(w, 'the wall reached the file').toBeTruthy();
    expect([w.start.x, w.start.z], 'the first press is on the grid, not where the hand was').toEqual([3.5, 2]);
    expect([w.end.x, w.end.z], 'the free end too').toEqual([3.5, 7.5]);
    expect(lengthOf(w), 'a half-foot length, which is the grain').toBeCloseTo(5.5, 9);
    expect(await boardOf(page), 'nothing was typed, so the light is still on').toBe('toy');
  });

test('a run square into the exterior wall is cut at its inside face, not on the grid',
  async ({ page }) => {
    await open(page, house());
    // THE HAND INSIDE THE WALL'S BODY: -9.8 is between the exterior line at
    // -10 and the inside face at -9.54. The grid alone would land it on -10,
    // the wall's own line, which is a wall drawn through the exterior wall.
    await drawRun(page, 3.3, 2.2, 3.3, -9.8);
    // AND THE HAND JUST INSIDE THE FACE: -9.6 rounds to the -9.5 grid point,
    // half an inch off the face -- the miss that looks right and builds wrong.
    await drawRun(page, -3.3, 2.2, -3.3, -9.6);
    const walls = drawnWalls(await saveAndRead(page));
    expect(walls.length).toBe(2);
    walls.forEach(w => {
      expect(w.end.z, 'cut at the 2x6\'s inside face, 5½" in').toBeCloseTo(-10 + T_2X6, 9);
      expect(w.start.z, 'the other end is the grid\'s').toBe(2);
    });
    expect(await boardOf(page), 'a face is the house\'s own number, not a typed one').toBe('toy');
  });

test('the grid is the exterior corners, not the world origin', async ({ page }) => {
  // A HOUSE STANDING OFF THE WORLD'S FOOT MARKS: its corners at -9.75 and
  // 10.25. Its own grid is at .25 and .75; the world's is at .0 and .5. The
  // 31 Aug rule says a drawing is never re-gridded, so this house keeps its
  // corners -- and its interior walls go on ITS grid.
  await open(page, house(-9.75, -9.75, 10.25, 10.25));
  await drawRun(page, 3.3, 2.2, 3.3, 7.7);
  const [w] = drawnWalls(await saveAndRead(page));
  expect([w.start.x, w.start.z]).toEqual([3.25, 2.25]);
  expect(w.end.z).toBe(7.75);
});

test('the edge of a floor opening is a hard line, like a face', async ({ page }) => {
  // "the stair opening is a similar line-up method which deviates from the
  // 6" grid". A well whose edge stands at 6'-2½": the hand at 6.3 would round
  // to 6.5 on the grid, and takes the edge instead.
  await open(page, house(-10, -10, 10, 10, {
    floors: [{ id: 'fl', levelId: 3, points: [V(-10, -10), V(10, -10), V(10, 10), V(-10, 10)] }],
    surfaceOpenings: [{ id: 'well', levelId: 3, hostType: 'floor', hostId: 'fl',
      points: [V(2, -3), V(6 + 2.5 / 12, -3), V(6 + 2.5 / 12, 3), V(2, 3)] }],
  }));
  await drawRun(page, 3.3, 5.2, 6.3, 5.2);
  const [w] = drawnWalls(await saveAndRead(page));
  expect(w, 'the wall reached the file').toBeTruthy();
  expect(w.end.x, 'on the well\'s edge').toBeCloseTo(6 + 2.5 / 12, 9);
  expect(w.start.x, 'started on the grid').toBe(3.5);
});

test('outside the house, and with no house on the level, the foot rule stands as it was',
  async ({ page }) => {
    // The grain is for the inside of a house. A run beside it is the foot's:
    // the first press is where the hand was and the length is whole feet.
    await open(page, house());
    await drawRun(page, 12.3, 2.2, 12.3, 7.7);
    const [beside] = drawnWalls(await saveAndRead(page));
    expect(beside, 'the wall reached the file').toBeTruthy();
    expect(beside.start.x, 'where the hand was, to the pixel').toBeCloseTo(12.3, 1);
    expect(beside.start.x, 'and not on the grain').not.toBe(12.5);
    expect(lengthOf(beside), 'whole feet').toBeCloseTo(6, 6);
  });

test('with no outline on the level the foot rule stands too', async ({ page }) => {
  await open(page, house(-10, -10, 10, 10, { outlines: [] }));
  await drawRun(page, 3.3, 2.2, 3.3, 7.7);
  const [w] = drawnWalls(await saveAndRead(page));
  expect(w.start.x).toBeCloseTo(3.3, 1);
  expect(w.start.x).not.toBe(3.5);
  expect(lengthOf(w)).toBeCloseTo(6, 6);
});

// ── CABINETS ─────────────────────────────────────────────────────────────
// A WALL OF ODD LENGTH, 20'-3", so the two corners disagree about where the
// half-foot marks fall: from the start they are at .0 and .5, from the far
// corner at .25 and .75. A cabinet pressed near the far corner is measured
// from that corner, so it can sit flush in it.
const oddHouse = extra => house(-10, -10, 10.25, 10, extra);
// THE FIXTURE TOOL FROM THE BUILD RAIL, THEN ITS CABINET CHIP -- the way
// model-html-fixture-tool.spec.js arms a kind -- and two real presses along
// the north wall, 0.4 ft inside its line, which is within the pick zone and
// nearer to it than to any other wall.
async function cabinetRun(page, x1, x2, z) {
  const { at } = await frame(page);
  await h.armFromRail(page, 'fixture');
  const chip = page.locator('[data-fixture-kind="cabinet"]');
  await expect(chip).toBeVisible();
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  for (const x of [x1, x2]) {
    await page.mouse.move(...at(x, z));
    await page.mouse.click(...at(x, z));
    await page.waitForTimeout(120);
  }
}
const cabinets = saved => (saved.fixtures || []).filter(f => f.kind === 'cabinet');

test('a cabinet run lands on the half foot from the nearer corner of its wall', async ({ page }) => {
  await open(page, oddHouse());
  // Along the north wall from its start at x = -10: the hand at 16.9 and
  // 19.4 ft along. From the far corner (20.25) those are 16.75 and 19.25 --
  // a 2'-6" cabinet ending a foot short of the corner, on the grain either
  // way; measured from the START they would be 17.0 and 19.5, a quarter
  // foot off the corner's grain. Pressed 0.4 ft inside the north wall's
  // line and no nearer than 0.85 ft to the east wall, so the north wall is
  // the one that carries both presses.
  await cabinetRun(page, 6.9, 9.4, -9.6);
  const [c] = cabinets(await saveAndRead(page));
  expect(c, 'the cabinet reached the file').toBeTruthy();
  expect(c.width, 'two feet six').toBeCloseTo(2.5, 9);
  expect(c.offset, 'centred at 18.0 from the wall\'s start: 16.75 to 19.25, measured from the far corner')
    .toBeCloseTo(18, 9);
  expect(await boardOf(page)).toBe('toy');
});

test('on DRAFTING a cabinet keeps the width the hand gave it', async ({ page }) => {
  await open(page, oddHouse({ board: 'drafting' }));
  await cabinetRun(page, 6.9, 9.2, -9.6);
  const [c] = cabinets(await saveAndRead(page));
  expect(c).toBeTruthy();
  expect(c.width, 'about 2.3 ft').toBeCloseTo(2.3, 1);
  expect(Math.abs(c.width * 2 - Math.round(c.width * 2)), 'and not on any half foot').toBeGreaterThan(0.1);
});
