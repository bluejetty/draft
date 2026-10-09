// MOVIE'S KITCHEN PIECES ON THE LIVE PAGE.
//
// Movie, 9 Oct, with KITCHENITEMS1/2.DXF: the base pieces each their own --
// "the SINK should be seperate from the Dishwasher / Drawers etc." -- and
// "when 2 cabinet peices come together can that 'end line' on the cabinet
// 'meld' with the other cabinet 'end line' where they join", drawn as "a
// lightweight line at the joint". The joint itself is render-2d's and is
// checked in proto/render-2d-harness.js; what only the page can show is that
// a drafter's press, never exact, lands the second piece flush against the
// first so there is a joint to meld at all.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const MAIN_FL = 3;

async function houseOnLivePage(page) {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);
  // `?left=1` OPENS THE LEFT SIDEBAR, which is where #tool-slot lives. Closed
  // is the page's default and it is right -- the canvas is the point -- but a
  // panel inside a shut drawer is not clickable, so every panel spec on this
  // page opens it the same way (model-tool-select.spec.js:122).
  // AND `lpane=build`, since 29 Sep. The fixture palettes moved onto the
  // BUILD tab with the FIXTURE key they place from, so `?left=1` alone now
  // opens the rail on DRAFTING and every chip this file drives is behind a
  // tab that is not up.
  await page.goto('/MODEL.html?left=1&lpane=build');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  // THE DRAFTING BOARD, EXPLICITLY. The page opens on TOY, whose tool list is
  // select/wall/outline -- so the FIXTURE key and every chip in its panel are
  // correctly dead until the board changes. That is the roster doing its job,
  // not a gap: a fixture is drafting work. Switching here is what a drafter
  // does, and asserting the chip is enabled afterwards is what proves the
  // panel hears the board at all.
  await page.locator('[data-board="drafting"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-board', 'drafting');
}

// THE HOST WALL COMES FROM THE DRAWING, never a hardcoded id: the bone's first
// press is free to change what it builds, and a spec that names a wall breaks
// on a house that is still perfectly correct.
async function longestPlanWall(page) {
  const drawing = await h.savedDrawing(page);
  const len = w => Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z);
  const wall = (drawing.walls || [])
    .filter(w => Number(w.levelId) === MAIN_FL && (w.view || 'plan') === 'plan')
    .sort((a, b) => len(b) - len(a))[0];
  expect(wall, 'the bone built no plan wall to host a fixture').toBeTruthy();
  return wall;
}

// A point `t` along the wall, nudged `acrossFt` off its centreline so the
// press lands on one face — which is what picks the fixture's `side`.
const alongWall = (wall, t, acrossFt) => {
  const dx = wall.end.x - wall.start.x, dz = wall.end.z - wall.start.z;
  const len = Math.hypot(dx, dz);
  const ux = dx / len, uz = dz / len;
  return { x: wall.start.x + ux * len * t + -uz * acrossFt,
    z: wall.start.z + uz * len * t + ux * acrossFt };
};

async function armKind(page, kindId) {
  const chip = page.locator(`[data-fixture-kind="${kindId}"]`);
  await expect(chip).toBeVisible();
  await expect(chip).toBeEnabled();
  await chip.click();
  // Picking a kind ARMS the tool — a drafter who presses CABINET means to
  // place one. If that ever stops being true the presses below go to SELECT
  // and place nothing, so it is asserted rather than assumed.
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
}

async function pressWorld(page, pt) {
  const frame = await h.planFrame(page);
  const [x, y] = frame.at(pt.x, pt.z);
  await page.mouse.move(x, y);
  await page.mouse.click(x, y);
}

// THIS PAGE DOES NOT AUTOSAVE, and that is deliberate rather than missing --
// MODEL.html and MODEL.dc.html are two writers over one bucket, and what
// autosave would mean between them is a ruling of its own
// (RULING-autosave-two-writers.md, cited at :14873). So a spec that wants to
// read the file must press SAVE, exactly as a drafter does. Waiting for a save
// that nothing asked for is how the first version of these specs spent five
// seconds proving the page was still unsaved.
async function saveNow(page) {
  await page.locator('[data-model-save]').click();
  await h.waitForSaved(page);
}

const fixturesOf = async page => (await h.savedDrawing(page)).fixtures || [];


// A point `along` feet from the wall's start, nudged onto its +1 face.
const atAlong = (wall, along) => alongWall(wall,
  along / Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z), 0.6);

test('drawers pressed 3" off a sink base land flush against it', async ({ page }) => {
  await houseOnLivePage(page);
  const wall = await longestPlanWall(page);
  const len = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);

  await armKind(page, 'sinkbase');
  await pressWorld(page, atAlong(wall, len / 2));
  await saveNow(page);
  const [sink] = await fixturesOf(page);
  expect(sink.kind).toBe('sinkbase');
  expect(sink.width).toBe(4);

  await armKind(page, 'drawerbase');
  // The drawers' near end pressed 3" past the sink base's far end.
  await pressWorld(page, atAlong(wall, sink.offset + 2 + 0.25 + 1));
  await saveNow(page);
  const fixtures = await fixturesOf(page);
  expect(fixtures.map(f => f.kind)).toEqual(['sinkbase', 'drawerbase']);
  const drawers = fixtures[1];
  expect(drawers.side, 'on the same face').toBe(sink.side);
  expect(drawers.offset - drawers.width / 2, 'its end against the sink base\'s')
    .toBeCloseTo(sink.offset + sink.width / 2, 6);
});

test('every kitchen piece Movie drew is on the KITCHEN row', async ({ page }) => {
  await houseOnLivePage(page);
  const row = page.locator('[data-tool-group="fixture-kitchen"]');
  for (const [id, label] of [['sinkbase', 'SINK BASE'], ['drawerbase', 'DRAWERS'],
    ['doorbase', 'DOOR BASE'], ['tallcab', 'FULL HT CAB'], ['fridge30', 'FRIDGE 30']]) {
    await expect(row.locator(`[data-fixture-kind="${id}"]`)).toHaveText(label);
  }
});
