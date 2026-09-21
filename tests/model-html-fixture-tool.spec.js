// TIER 2 — MODEL.html can PLACE a fixture, not merely draw one.
//
// The page has painted fixtures since fixture-geometry.js landed and has
// carried them through save untouched, so a kitchen drawn on MODEL.dc.html
// opens here correctly and could not be added to. Nothing looked broken: the
// FIXTURE key was on the tool column, enabled on the drafting board, arming
// `activeTool = 'fixture'` — with no gesture reading it. Pressing it did
// nothing at all.
//
// FIT-OUT forced it. A kitchen is roughly seven fixtures and a cabinet is one,
// so a CABINET cannot be an assembly until a cabinet can be placed. See
// RD-DOCUMENTS/ORDER-tiers-of-assembly.md.
//
// WHAT THESE SPECS ARE FOR, and it is narrower than "the tool works": the
// maths is not new. fixturePlacement composes pointToSegment and wallFrame,
// both already covered by proto/ harnesses, and the catalogue is pinned by
// proto/fixture-kinds-harness.js. What only a page test can reach is the SEAM
// — that a press reaches the gesture, that the record lands on the host wall's
// level and view, and that the two-press run measures between its presses.
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
  await page.goto('/MODEL.html?left=1');
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

test('a cabinet presses onto a wall and lands on that wall', async ({ page }) => {
  await houseOnLivePage(page);
  const wall = await longestPlanWall(page);
  expect(await fixturesOf(page)).toHaveLength(0);

  await armKind(page, 'sink');          // a simple kind: one press, one fixture
  await pressWorld(page, alongWall(wall, 0.5, 0.6));
  await saveNow(page);

  const fixtures = await fixturesOf(page);
  expect(fixtures).toHaveLength(1);
  expect(fixtures[0].kind).toBe('sink');
  expect(fixtures[0].wallId).toBe(wall.id);
  // THE HOST WALL'S LEVEL AND VIEW, not the drafter's. A fixture sits against
  // a wall and belongs wherever that wall is drawn; filing it under whatever
  // layer set happened to be open would hide it from its own wall.
  expect(Number(fixtures[0].levelId)).toBe(Number(wall.levelId));
  expect(fixtures[0].view).toBe(wall.view || 'plan');
  // Written at the push, not derived on load: this page has no serializer
  // between the two, and a record that is only right after a reload is a file
  // that is wrong until then.
  expect(fixtures[0].layer).toBe('A-FIXT');
});

test('casework lands on its own layer', async ({ page }) => {
  await houseOnLivePage(page);
  const wall = await longestPlanWall(page);

  // A RUN IS TWO PRESSES along one face of one wall, and the pair sets the
  // width — so this is also the proof that the second press is measured
  // against the first rather than placing a second cabinet.
  await armKind(page, 'cabinet');
  await pressWorld(page, alongWall(wall, 0.30, 0.6));
  expect(await fixturesOf(page)).toHaveLength(0);   // one press places nothing
  await pressWorld(page, alongWall(wall, 0.70, 0.6));
  await saveNow(page);

  const fixtures = await fixturesOf(page);
  expect(fixtures).toHaveLength(1);
  expect(fixtures[0].kind).toBe('cabinet');
  expect(fixtures[0].layer).toBe('A-CASE');

  // The run spans the two presses: 40% of the wall, to the inch.
  const len = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
  expect(fixtures[0].width).toBeCloseTo(len * 0.40, 2);
});

test('a press away from every wall places nothing and says why', async ({ page }) => {
  await houseOnLivePage(page);
  await armKind(page, 'toilet');

  // ON THE CANVAS, BUT OFF EVERY WALL -- and getting that right took three
  // goes, each wrong in a way that still produced a green-looking "no fixture
  // was placed":
  //
  //   world (400, 400)   fit() frames the house, so this is far off the
  //                      canvas; the click landed on page chrome
  //   canvas corner+12   with ?left=1 the sidebar and its tab sit over that
  //                      corner, and the click NAVIGATED the page
  //
  // Both times the fixture count was 0 because the gesture never ran. So the
  // point is now derived from the drawing's own bounds, and the page is ASKED
  // what is under it before pressing -- a press that misses the canvas must
  // fail this spec, not pass it.
  const drawing = await h.savedDrawing(page);
  const pts = (drawing.walls || []).flatMap(w => [w.start, w.end]);
  const maxX = Math.max(...pts.map(pt => pt.x));
  const midZ = (Math.min(...pts.map(pt => pt.z)) + Math.max(...pts.map(pt => pt.z))) / 2;
  const frame = await h.planFrame(page);
  // Well clear of the grab zone: it is 30px, so 30/scale feet, and this is
  // that plus six more.
  const [px, py] = frame.at(maxX + 30 / frame.scale + 6, midZ);

  const under = await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y);
    return el ? (el.id || el.tagName) : null;
  }, [px, py]);
  expect(under, 'the bare-canvas press must land on the canvas to mean anything')
    .toBe('plan');

  await page.mouse.move(px, py);
  await page.mouse.click(px, py);

  expect(await fixturesOf(page)).toHaveLength(0);
  await expect(page.locator('#strip-message'))
    .toContainText(/sit against the wall/i);
});

// THE TWO GESTURES THIS PORT DOES NOT CARRY, asserted so their absence is a
// stated fact rather than something a drafter discovers. The tub takes two
// WALLS (back, then faucet end) and the kitchen L drops seven fixtures at
// once; both are their own gesture on the old page. They refuse BY NAME, which
// is the difference between "not built yet" and "silently broken".
for (const [kindId, label] of [['tub', 'TUB'], ['kitchenL', 'L PRESET']]) {
  test(`${label} says it is not here yet rather than placing the wrong thing`,
    async ({ page }) => {
      await houseOnLivePage(page);
      const wall = await longestPlanWall(page);
      await armKind(page, kindId);
      await pressWorld(page, alongWall(wall, 0.5, 0.6));

      expect(await fixturesOf(page)).toHaveLength(0);
      await expect(page.locator('#strip-message'))
        .toContainText(/not on this page yet/i);
    });
}
