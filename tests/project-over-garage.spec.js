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

  // THE SAME HOUSES THE DRIVE-THRU'S BUNGALOW FAMILY OFFERS, counted off
  // that menu rather than typed here -- a card with its own shorter list
  // would be a second menu to keep in step, and a hardcoded number is that
  // list wearing a disguise. It read 5 until ON-GRADE and ON-GRADE + GARAGE
  // joined the family (Movie, 12 Oct), which is exactly the edit a literal
  // makes you come back for.
  const buttons = page.locator('#family-row .family-button');
  const inMenu = await page.evaluate(() => window.DraftBuildMenu.BUILD_MENU
    .find(family => family.id === 'bungalow').entries.length);
  expect(inMenu, 'the family has grown past the pair it started with')
    .toBeGreaterThan(5);
  await expect(buttons).toHaveCount(inMenu);
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

  // ON-GRADE PAIRS WITH ITS OWN GARAGE, on its own line between the two
  // storeys -- which is the menu's rule arriving unaided: an entry pairs
  // when the one before it is the same type without a garage, so the two
  // tiles added on 12 Oct landed here without a word being said about
  // layout. The long label keeps its words; only the SECOND of a pair is
  // shortened at the plus.
  expect(await columnLines(page, 'family-row')).toEqual([
    ['1 STOREY', '+ GARAGE'],
    ['ON-GRADE (BUNGALOW)', '+ GARAGE'],
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

// ── ON-GRADE, AND WHY THE ROW NEEDED A THIRD TEST TO LIGHT ITSELF ────────
//
// Movie, 12 Oct: "call it ON-GRADE", in the BUNGALOW family, for the floor
// connection he traced off an apartment set -- joists hung on a ledger
// inside the foundation instead of standing on the wall.
//
// IT IS NOT A BUILD TYPE. ON-GRADE and 1 STOREY are both `bungalow`, and
// both carry the same garage plan, so the two tests the row glowed on until
// now ("same type", "same garage") cannot tell them apart -- they would have
// lit 1 STOREY on an on-grade house for ever. The third test is MAIN FL's
// own floor framing, which is where the difference actually lives and what
// the level card's FLOOR FRAMING choice edits.
test('ON-GRADE and 1 STOREY are one type, told apart by the floor framing', async ({ page }) => {
  await openProject(page);

  const plain = page.locator('[data-family-entry="bungalow"]');
  const grade = page.locator('[data-family-entry="bungalow-ongrade"]');
  await expect(grade, 'the tile is on the card').toBeVisible();

  // THE PRESS WRITES THE FRAMING, which is the whole of what it chooses:
  // the type and the garage plan are the same either way.
  await grade.click();
  await expect.poll(async () => {
    const saved = await h.savedDrawing(page);
    return `${saved?.buildType}/${saved?.levelAssemblies?.[3]?.framing}`;
  }, { message: 'a bungalow, framed on a ledger' }).toBe('bungalow/balloon');

  await expect(grade).toHaveAttribute('aria-pressed', 'true');
  await expect(plain, 'and the tile it shares a type with stays dark')
    .toHaveAttribute('aria-pressed', 'false');

  // AND BACK, because a tile that can only be pressed one way is not a
  // choice. 1 STOREY means the platform-framed bungalow; leaving the old
  // answer standing would make the tile a lie.
  await plain.click();
  await expect.poll(async () => (await h.savedDrawing(page))
    ?.levelAssemblies?.[3]?.framing).toBe('platform');
  await expect(plain).toHaveAttribute('aria-pressed', 'true');
  await expect(grade).toHaveAttribute('aria-pressed', 'false');

  // IT SURVIVES THE PAGE. The glow is read from the drawing, not from the
  // last press, so a reload has to land on the same tile.
  await grade.click();
  await expect.poll(async () => (await h.savedDrawing(page))
    ?.levelAssemblies?.[3]?.framing).toBe('balloon');
  await page.reload();
  await expect(page.locator('[data-family-entry="bungalow-ongrade"]'))
    .toHaveAttribute('aria-pressed', 'true');
});

// THE BILEVEL COLUMN SHARES THE BUILDER AND MUST NOT SHARE THE ANSWER. Its
// tiles say nothing about floor framing, so a press there has to leave MAIN
// FL's alone -- a drafter who set BALLOON / LEDGER on the level card and
// then picked BILEVEL + GARAGE would otherwise have it silently reset, and
// the bilevel tile would go dark on his own drawing.
//
// THE DRAWING IS SEEDED RATHER THAN PRESSED INTO SHAPE. The bungalow and
// bilevel family rows live on different cards, and a project that has named
// its house does not switch cards by being looked at ("A PROJECT WITH A HOME
// CARD IS NOT SWITCHED BY LOOKING", Movie, 6 Oct) -- so there is no press
// path from one row to the other, by design. Writing the balloon answer into
// the file is also the truer fixture: it is the drafter who set it on the
// level card last session, which is the case this protects.
test('a bilevel press leaves the floor framing where it was', async ({ page }) => {
  await h.openModel(page);
  // The page writes the file; this edits what it wrote, so the fixture is
  // the drawing PROJECT itself produces rather than a shape typed here that
  // could drift from the format.
  await page.goto('/PROJECT.html?type=bilevel');
  // A PRESS FIRST, BECAUSE A DRAWING NOBODY HAS TOUCHED IS NOT IN THE STORE
  // YET -- the page writes on change, so there is nothing to edit until
  // something changes. The plain BILEVEL is the press, and it is also the
  // state this test is about: a bilevel drawing.
  await page.locator('#bilevel-family-row button[data-family-entry="bilevel"]').click();
  await expect.poll(async () => (await h.savedDrawing(page))?.buildType).toBe('bilevel');
  await page.evaluate(async () => {
    const file = await window.SharedFileStore.loadSharedFile('model-drawing');
    const drawing = JSON.parse(await file.text());
    drawing.buildType = 'bilevel';
    drawing.levelAssemblies = { ...(drawing.levelAssemblies || {}), 3: {
      ...(drawing.levelAssemblies?.[3] || {}), framing: 'balloon' } };
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(drawing)], 'model-drawing.json',
        { type: 'application/json' }), 'model-drawing');
  });
  await page.reload();

  const bilevel = page.locator('#bilevel-family-row button[data-family-entry="bilevel-garage"]');
  await expect(bilevel).toBeVisible();
  await bilevel.click();

  await expect.poll(async () => (await h.savedDrawing(page))?.garagePlan)
    .toBe('attached');
  expect((await h.savedDrawing(page))?.levelAssemblies?.[3]?.framing,
    'the balloon answer is still his').toBe('balloon');
  await expect(bilevel, 'and its tile lights on a balloon-framed drawing')
    .toHaveAttribute('aria-pressed', 'true');
});
