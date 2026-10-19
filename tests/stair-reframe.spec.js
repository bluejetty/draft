// A STAIR MOVED OR TURNED IS FRAMED AGAIN WHERE IT NOW IS.
//
// Movie, 19 Oct, over a stair he had turned on his foundation plan: "i
// rotated the stairs (which would no longer need a beam due to direction of
// stairs being perpendiculat to beam (paralel with joists. and also the beam
// would be on the wrong side if it was needed (should not be on foundation
// side) is there a way to regenerate the beam after the stairs move". And the
// rule, when asked: "no the short ends won't need beams ever it can be
// supported but the side joists only the long end needs a beam on side that
// span 10 ft or more,. (under 10 ft not needed".
//
// So the framing used to ride along with the flight, and now it is laid
// again on the drop: none for a run that lies with the joists, and on a run
// across them the beam goes on the long side with 10 ft of floor or more --
// never the side standing on the wall.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3;

const empty = () => ({
  version: 1, planTurn: 0, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: MAIN_FL, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
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

async function pastTheCards(page) {
  const card = page.locator('#lot-pick');
  if (await card.isVisible().catch(() => false)) {
    await card.locator('[data-lot-pick-skip]').click();
    await expect(card).toBeHidden();
  }
}

// The stock bungalow with its garage: one well on the MAIN FL, its open side
// framed (model-stair-dead-strip pins that much).
async function build(page) {
  await open(page);
  await h.openDriveThru(page);
  await page.locator('[data-build-family="bungalow"]').click();
  await page.locator('[data-build-entry="bungalow-garage"]').click();
  await page.locator('#dt-bone').click();
  await page.waitForTimeout(1200);
  await pastTheCards(page);
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
}

async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}

const mainStair = d => (d.stairs || []).find(s => Number(s.levelId) === MAIN_FL);
const sideBeams = (d, stair) => (d.beams || []).filter(b => Number(b.stairId) === Number(stair.id));
const runsAlongX = s => Math.abs(s.end.x - s.start.x) >= Math.abs(s.end.z - s.start.z);
const r = n => Math.round(n * 100) / 100;

// Picked by a point inside the flight a foot and a half from its start, asked
// of the hover label first so a miss reads as a miss.
async function pick(page, stair) {
  const { at } = await h.planFrame(page);
  const len = Math.hypot(stair.end.x - stair.start.x, stair.end.z - stair.start.z);
  const dir = { x: (stair.end.x - stair.start.x) / len, z: (stair.end.z - stair.start.z) / len };
  const [x, y] = at(stair.start.x + dir.x * 1.5, stair.start.z + dir.z * 1.5);
  await page.mouse.move(x, y);
  await expect(page.locator('#hover-name')).toHaveText('STAIR', { timeout: 4000 });
  await page.mouse.click(x, y);
  await expect(page.locator('#model-rotate')).toBeVisible();
  return [x, y];
}

async function turn(page, degrees) {
  await page.locator('#model-rotate').click();
  await page.locator(`[data-rotate-by="${degrees}"]`).click();
  await page.waitForTimeout(150);
}

test('turned to lie with the joists, the stair keeps no side beam; one UNDO brings it back', async ({ page }) => {
  await build(page);
  const first = await saved(page);
  const stair = mainStair(first);
  const before = sideBeams(first, stair);
  expect(before.length, 'the stock well has its open side framed').toBe(1);
  // THE BEAM RUNS WITH THE FLIGHT, so the joists run across it: the flight is
  // across the joists, and its long side cuts them.
  expect(runsAlongX(before[0])).toBe(runsAlongX(stair));
  const posts = (first.columns || []).length;

  await pick(page, stair);
  await turn(page, 90);
  await expect(page.locator('#strip-message')).toContainText('side beam is not needed');
  const d = await saved(page);
  const turned = mainStair(d);
  expect(runsAlongX(turned), 'a quarter turn').not.toBe(runsAlongX(stair));
  expect(sideBeams(d, turned), 'a run with the joists cuts none along its sides').toHaveLength(0);
  expect((d.columns || []).length, 'and its two posts went with the beam').toBe(posts - 2);

  await page.keyboard.press('Control+z');
  const undone = await saved(page);
  expect(sideBeams(undone, mainStair(undone)).map(b => [b.start, b.end]),
    'the turn and the re-frame are one UNDO').toEqual(before.map(b => [b.start, b.end]));
  expect((undone.columns || []).length).toBe(posts);
  expect(mainStair(undone).start).toEqual(stair.start);
});

test('turned end for end, the beam goes on the open side, never where the wall carries it', async ({ page }) => {
  await build(page);
  const first = await saved(page);
  const stair = mainStair(first);
  const [beam] = sideBeams(first, stair);
  await pick(page, stair);
  await turn(page, 90);
  await turn(page, 90);
  const d = await saved(page);
  const turned = mainStair(d);
  expect(runsAlongX(turned), 'a half turn runs the same way').toBe(runsAlongX(stair));
  const now = sideBeams(d, turned);
  expect(now.length, 'framed again').toBe(1);
  // THE WELL IS ASTRIDE THE SAME MIDDLE, so the open side is the same side of
  // the house -- where a beam that rode the turn would have swung across to
  // the wall side.
  const across = runsAlongX(stair) ? 'z' : 'x';
  expect(r(now[0].start[across]), 'on the open side, as before').toBe(r(beam.start[across]));
});

test('slid and let go, the stair is framed again where it landed, in the same UNDO', async ({ page }) => {
  await build(page);
  const first = await saved(page);
  const stair = mainStair(first);
  const [beam] = sideBeams(first, stair);
  const at = await pick(page, stair);
  const { scale } = await h.planFrame(page);
  // A foot along its own run: the side spans do not change, so the framing
  // comes back on the same side, a foot along -- laid fresh, not ridden.
  const u = runsAlongX(stair) ? { x: 1, z: 0 } : { x: 0, z: 1 };
  await page.mouse.move(...at);
  await page.mouse.down();
  await page.mouse.move(at[0] + u.x * scale, at[1] + u.z * scale, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const d = await saved(page);
  const now = sideBeams(d, mainStair(d));
  expect(now.length).toBe(1);
  expect(now[0].id, 'a new record, laid where the stair now is').not.toBe(beam.id);
  const along = runsAlongX(stair) ? 'x' : 'z';
  const lo = b => Math.min(b.start[along], b.end[along]);
  expect(lo(now[0]) - lo(beam), 'a foot along with the flight').toBeCloseTo(1, 1);
  await page.keyboard.press('Control+z');
  const undone = await saved(page);
  expect(sideBeams(undone, mainStair(undone)).map(b => b.id)).toEqual([beam.id]);
  expect(mainStair(undone).start).toEqual(stair.start);
});
