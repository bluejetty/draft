// The BUNGALOWS card's family row and the ROOM OVER press on the drawing
// (Movie, 15 Sep). Two claims worth a browser: the buttons are wired to the
// keys the file actually stores, and the press moves the garage wall so the
// floor it adds lands on the second floor's sheathing rather than wherever
// the garage happened to be.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// level-assembly.js is the authority for the package. Loaded from source the
// way proto/ loads it, so this spec cannot drift from the module by typing
// 19.25 into itself.
const LA = (() => {
  const saved = global.window;
  global.window = {};
  delete require.cache[require.resolve('../level-assembly.js')];
  require('../level-assembly.js');
  const api = global.window.DraftLevelAssembly;
  global.window = saved;
  return api;
})();

const OVER = LA.defaultLevelAssembly('overGarage');

async function openProject(page) {
  await h.openModel(page);
  await page.goto('/PROJECT.html?type=bungalow');
  await expect(page.locator('[data-detail-input="pitch"]')).toBeVisible();
}

test('the first card is BUNGALOWS and its family buttons carry the menu', async ({ page }) => {
  await openProject(page);

  // THE STAGE ITSELF, NOT ITS TITLE. The card carried a "Bungalows" heading
  // until Movie had it taken off on 27 Sep to give the drawing the height --
  // and a check pinned to a LABEL breaks on a wording change that means
  // nothing, exactly as design-notices-wired did. The stage's id is what says
  // which card is on show.
  await expect(page.locator('#stage-bungalow')).toBeVisible();
  // The intro Movie struck is gone, title and all.
  await expect(page.locator('body')).not.toContainText('first 4 ft, cut inward');

  // Same five houses the drive-thru's BUNGALOW family offers -- a card with
  // its own shorter list would be a second menu to keep in step.
  const buttons = page.locator('#family-row .family-button');
  await expect(buttons).toHaveCount(5);
  await expect(page.locator('[data-family-entry="twoStorey-over"]'))
    .toHaveText('2 STOREY + GARAGE + ROOM OVER');
});

// ── AND EVERY COLUMN PAIRS WHAT BELONGS SIDE BY SIDE ──────────────────────
//
// Movie, 28 Sep, with a mockup: "i figured out how to save us more space on
// the left menu area (BUNGALOW SECTION)" -- then, seeing it, "we can do that
// for BILEVEL / + GARAGE too", and a second mockup putting a + ROOM OVER
// beside the detached garage's two deep foundations.
//
// WHAT TAKES A WHOLE LINE IS WHAT HAS NO PARTNER: the room-over house, the
// modified bilevel, and the thickened edge, which cannot carry a storey at
// all. So this is not "three columns of pairs" -- it is the shape of each
// menu, and the widths are where that shape shows.
//
// GEOMETRY, NOT CLASS NAMES. Which line a button lands on is the whole ask, so
// this reads the boxes: a check on the CSS class would pass on a grid that had
// stopped pairing.
const columnLines = (page, id) => page.evaluate(sel => {
  const rows = new Map();
  for (const el of document.querySelectorAll(`#${sel} .family-button`)) {
    const top = Math.round(el.getBoundingClientRect().top);
    (rows.get(top) || rows.set(top, []).get(top)).push(el.textContent.trim());
  }
  return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, names]) => names);
}, id);

test('each column pairs a build with the thing that is added to it', async ({ page }) => {
  await openProject(page);

  expect(await columnLines(page, 'family-row')).toEqual([
    ['1 STOREY', '+ GARAGE'],
    ['2 STOREY', '+ GARAGE'],
    ['2 STOREY + GARAGE + ROOM OVER'],
  ]);
  expect(await columnLines(page, 'bilevel-family-row')).toEqual([
    ['BILEVEL', '+ GARAGE'],
    ['MODIFIED BILEVEL'],
  ]);
  // THE SLAB HAS NO PARTNER, and that is the rule rather than the mockup: a
  // thickened edge carries a garage, not a storey of house.
  expect(await columnLines(page, 'detached-family-row')).toEqual([
    ['THICKENED EDGE'],
    ['GRADE BEAM', '+ ROOM OVER'],
    ['FROST WALL', '+ ROOM OVER'],
  ]);
});

// ONE ANSWER, TWO CONTROLS -- the rule this column already keeps for the
// foundation itself, now for the storey on it. The press beside FROST WALL
// says "a frost wall WITH a room over it", so it has to be able to say both
// halves in one press, and it must not glow for a room standing on a beam.
test('the room-over press names its own foundation', async ({ page }) => {
  await openProject(page);
  const roomOn = f => page.locator(`[data-family-room-over="${f}"]`);
  const roomRow = page.locator('[data-sched-row="roomOver"]');

  await page.goto('/PROJECT.html?type=detached');
  await expect(page.locator('#detached-canvas')).toBeVisible();
  await expect(roomOn('frostwall')).toHaveAttribute('aria-pressed', 'false');

  await roomOn('frostwall').click();
  await page.waitForTimeout(400);
  // Both halves in one press: the foundation moved and the storey went on.
  await expect(page.locator('[data-family-entry="detached-frostwall"]'))
    .toHaveAttribute('aria-pressed', 'true');
  await expect(roomOn('frostwall')).toHaveAttribute('aria-pressed', 'true');
  await expect(roomOn('gradebeam')).toHaveAttribute('aria-pressed', 'false');
  // And the schedule's own press is the same answer seen twice.
  await expect(roomRow.locator('.sched-value')).toHaveAttribute('aria-pressed', 'true');

  await roomOn('frostwall').click();
  await page.waitForTimeout(400);
  await expect(roomOn('frostwall')).toHaveAttribute('aria-pressed', 'false');
  await expect(roomRow.locator('.sched-value')).toHaveAttribute('aria-pressed', 'false');
});

test('the pressed family button glows and the one before it does not', async ({ page }) => {
  await openProject(page);

  const oneStorey = page.locator('[data-family-entry="bungalow-garage"]');
  const twoStorey = page.locator('[data-family-entry="twoStorey-garage"]');

  // NOTHING GLOWS ON A DRAWING THAT NEVER SAID. A fresh file has no garage
  // plan, so lighting a button would be the card answering for the drafter.
  await expect(oneStorey).toHaveAttribute('aria-pressed', 'false');

  await oneStorey.click();
  await expect(oneStorey).toHaveAttribute('aria-pressed', 'true');
  await expect(twoStorey).toHaveAttribute('aria-pressed', 'false');

  await twoStorey.click();
  await expect(oneStorey).toHaveAttribute('aria-pressed', 'false');
  await expect(twoStorey).toHaveAttribute('aria-pressed', 'true');

  // A RELOAD RACES THE WRITE. The page queues its save and returns, so a
  // reload fired the instant a button lights tears the queue down mid-flight
  // and the file keeps the FIRST press -- which reads as the choice not
  // surviving, when what happened is that it was never written. Both
  // presses are the same note ('Attached garage, no storey over it'), so
  // #status cannot tell the second save from the first; the store can.
  await expect.poll(async () => (await h.savedDrawing(page))?.buildType)
    .toBe('twoStorey');

  await page.reload();
  await expect(page.locator('[data-family-entry="twoStorey-garage"]'))
    .toHaveAttribute('aria-pressed', 'true');
});

// The margin copy went with the word columns (Movie, 17 Sep: "the (+ROOM
// BOX) is still there") -- the press now lives on the garage schedule's own
// row, one door onto the state the family row shares.
test('ROOM OVER lives on the garage schedule row, and nowhere on the margins', async ({ page }) => {
  await openProject(page);

  const button = page.locator('[data-room-over-row]');
  await expect(button).toBeVisible();
  await expect(page.locator('#sched-garage [data-room-over-row]')).toBeVisible();
  await expect(button).toHaveText('+ ROOM OVER');

  // The old floating copy is gone, not merely moved.
  await expect(page.locator('[data-room-over]')).toHaveCount(0);
});

test('the press adds the 20" package and lands its deck on the 2nd floor', async ({ page }) => {
  await openProject(page);

  // A second floor to meet: the press is only meaningful against one.
  await page.locator('[data-family-entry="twoStorey-garage"]').click();
  await expect(page.locator('#status')).toContainText(/garage|method/i);

  const button = page.locator('[data-room-over-row]');
  await expect(button).toHaveAttribute('aria-pressed', 'false');

  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');

  // The button lights on the press and the file is written after it, so the
  // read below has to wait for the store rather than for the paint.
  await expect.poll(async () => (await h.savedDrawing(page))?.garagePlan)
    .toBe('attachedRoomOver');
  const saved = await h.savedDrawing(page);
  expect(saved.garagePlan).toBe('attachedRoomOver');

  // THE PACKAGE IS THE MODULE'S, and it is the 20" Movie asked for.
  expect(OVER.joistDepthIn).toBe(19.25);
  expect(OVER.sheathingIn).toBe(0.75);
  expect(OVER.joistDepthIn + OVER.sheathingIn).toBe(20);

  // AND ITS DECK MEETS THE HOUSE'S. The garage wall the press wrote, plus
  // the package, plus how far the garage sits below MAIN FL, is the top of
  // the second floor's sheathing: main wall + that floor's own package.
  const table = saved.sectionTable.rows.attachedGarage;
  // NULL MEANS DERIVED, so the stored zone cannot be read as zero -- the
  // garage sits below MAIN FL by default and treating that as flush is how
  // this check would "pass" two feet out. The page's own box says the number.
  // THE ZONE CARD IS GONE (Movie, 23 Sep). The box that survived reads SILL
  // TO SILL, against the house's foundation sill; this sum needs the offset
  // from MAIN FL, which is one main-floor package higher. Converted below
  // rather than swapped in place -- the two datums differ by 12 5/8" and a
  // silent swap would put this deck out by exactly that and still read green.
  const offsetText = await page.locator('[data-detail-input="garageOffset"]').inputValue();
  const [, sign, feet, inches] = offsetText.match(/(-?)(\d+)'-(\d+(?:\s\d+\/\d+)?)"/);
  const inchFt = inches.split(' ').reduce((sum, part) => sum
    + (part.includes('/') ? part.split('/')[0] / part.split('/')[1] : Number(part)), 0) / 12;
  const sillToSillFt = (sign === '-' ? -1 : 1) * (Number(feet) + inchFt);
  const house = LA.defaultLevelAssembly('floor');
  // Back to the MAIN FL datum: the house's foundation sill is one main-floor
  // package below MAIN FL, so that package is what separates the two.
  const sillFt = sillToSillFt - (house.joistDepthIn + house.sheathingIn) / 12;
  const deckFt = table.mainWallHeightFt + sillFt + (OVER.joistDepthIn + OVER.sheathingIn) / 12;
  // The HOUSE row is `live` -- it reads the drawing's own assemblies rather
  // than a stored row, so the deck it has to meet comes from there.
  const asm = id => ({ ...house, ...(saved.levelAssemblies?.[id] || {}) });
  const upperDeckFt = asm(3).wallHeightFt
    + (asm(5).joistDepthIn + asm(5).sheathingIn) / 12;
  expect(deckFt).toBeCloseTo(upperDeckFt, 5);

  await page.reload();
  await expect(page.locator('[data-room-over-row]')).toHaveAttribute('aria-pressed', 'true');
});
