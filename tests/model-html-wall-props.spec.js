// WALL PROPERTIES — the page could draw a wall and never change one again.
//
// Movie, 19 Sep: "if they select a specific wall or multiples they can change
// the properties ... There should be a PROPERTIES box with in this case WALL
// PROPERTIES, but there should also a PROPERTIES for ROOF, FLOOR, FENST,
// LINE, etc (all objects)". This is the first tenant of that box and the
// pattern the rest follow.
//
// WHY IT IS URGENT rather than merely missing. A wall's height is copied in
// at the moment it is drawn, from the storey's default, and never looked at
// again — on BOTH pages. So Movie's other rule, that changing the PROJECT
// default moves every wall still sitting on it, leaves behind exactly the
// walls somebody had already adjusted, and he answered that himself: "(the
// user may need to manually change the 'previously adjusted' height". THIS is
// the panel he would change them with. Without it that rule has no remedy.
//
// AND THE OLD PAGE IS NOT THE BAR HERE. MODEL.dc.html has this editor, but
// only on an ASSEMBLY: _applyGroupWallSettings reads
// _selectedGroupForWallEditing(), so changing one wall's type means bundling
// it into a named group first. Movie ruled otherwise for this page — a wall,
// or several, selected and changed. The record it writes is the old page's,
// field for field.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3;

// Two walls, far enough apart that a press on one cannot reach the other, and
// DELIBERATELY NOT THE SAME TYPE: a panel that shows the first wall's answer
// for a selection of two would pass against a fixture where both agree.
const FIXTURE = `
  d.walls = [
    { id: 'a', start: { x: -12, z: 0 }, end: { x: 12, z: 0 },
      levelId: ${MAIN_FL}, view: 'plan', wallType: 'stud_2x6',
      baseHeight: 0, topHeight: 8, refLine: 'center' },
    { id: 'b', start: { x: -12, z: -10 }, end: { x: 12, z: -10 },
      levelId: ${MAIN_FL}, view: 'plan', wallType: 'stud_2x4',
      baseHeight: 0, topHeight: 8, refLine: 'center' }
  ];
  d.lines = []; d.floors = []; d.dimensions = []; d.roofs = []; d.shapes = [];
  d.columns = []; d.beams = []; d.fixtures = []; d.openings = [];
  return d;`;

async function houseOnOldPage(page) {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);
}

async function open(page) {
  await page.evaluate(async ({ bucket, src }) => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const drawing = JSON.parse(await file.text());
    // eslint-disable-next-line no-new-func
    const out = new Function('d', src)(drawing) || drawing;
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(out)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, src: FIXTURE });
  await page.goto('/MODEL.html?mode=night&left=1');
  await expect(page.locator('#readout')).toContainText('walls 2/2', { timeout: 6000 });
  await expect(page.locator('#left-rail')).toBeVisible();
}

// Press a world point on the plan, through the camera the page publishes.
//
// SHIFT IS HELD ROUND THE PRESS, not passed to mouse.click -- the raw mouse
// API takes no modifiers, and passing them there is silently ignored: the
// first version of this helper produced a plain click and the multi-select
// check failed reporting a selection of one.
async function pressWorld(page, x, z, { shift = false } = {}) {
  const frame = await h.planFrame(page);
  const [cx, cy] = frame.at(x, z);
  if (shift) await page.keyboard.down('Shift');
  await page.mouse.click(cx, cy);
  if (shift) await page.keyboard.up('Shift');
  await page.waitForTimeout(80);
}

// THIS PAGE DOES NOT AUTOSAVE. markDirty sets the flag and lights UNSAVED;
// nothing writes until the button is pressed, which is the whole reason the
// Write Tier's rule is "what it pushes IS what reaches the file". A check
// that read the store without pressing SAVE would be reading the FIXTURE
// back and calling it a round trip.
async function save(page) {
  await page.locator('[data-model-save]').click();
  await h.waitForSaved(page);
}

// A point on bare sheet, between the two walls and five feet from each -- far
// outside the grab at any zoom this fixture is drawn at, and on the canvas,
// which a point past the drawing's own bounds is not guaranteed to be.
const EMPTY = [0, -5];

const slot = page => page.locator('#props-slot');
const title = page => page.locator('#props-slot .props-title').first();
const chip = (page, id) => page.locator(`#props-slot [data-prop-row="type"] [data-prop-value="${id}"]`);
const field = (page, name) => page.locator(`#props-slot [data-prop-field="${name}"]`);

const wallsOf = drawing => Object.fromEntries(
  (drawing.walls || []).map(wall => [wall.id, wall]));

test.describe('MODEL.html wall properties', () => {
  test.beforeEach(async ({ page }) => {
    await houseOnOldPage(page);
    await open(page);
  });

  test('pressing a wall puts its properties in the box', async ({ page }) => {
    await expect(slot(page), 'nothing is selected yet').toBeHidden();

    await pressWorld(page, 0, 0);
    await expect(slot(page)).toBeVisible();
    await expect(title(page)).toHaveText('WALL');

    // THE WALL'S OWN TYPE IS LIT, not the first in the list and not the tool's
    // armed default. A picker that shows the wrong assembly as current is a
    // panel describing a different wall.
    await expect(chip(page, 'stud_2x6')).toHaveAttribute('aria-pressed', 'true');
    await expect(chip(page, 'stud_2x4')).toHaveAttribute('aria-pressed', 'false');
    await expect(field(page, 'top')).toHaveValue(/8/);
  });

  test('the box comes down with its subject', async ({ page }) => {
    await pressWorld(page, 0, 0);
    await expect(slot(page)).toBeVisible();
    await pressWorld(page, ...EMPTY);
    await expect(slot(page),
      'a panel left standing after its wall is deselected describes a wall the '
      + 'drafter cannot see selected').toBeHidden();
  });

  test('changing the type is in the file, and only for the wall selected',
    async ({ page }) => {
      await pressWorld(page, 0, 0);
      // NOT stud_2x4, WHICH IS WHAT WALL b ALREADY IS. Setting a to the other
      // wall's type would make "b did not move" true whether it moved or not
      // — an assertion two different worlds satisfy. insulation_6 is neither
      // wall's, so b staying 2x4 can only mean it was left alone.
      await chip(page, 'insulation_6').click();
      await save(page);

      const walls = wallsOf(await h.savedDrawing(page));
      expect(walls.a.wallType, 'the selected wall took the new assembly')
        .toBe('insulation_6');
      expect(walls.b.wallType, 'the wall nobody pressed must not move')
        .toBe('stud_2x4');
      expect(walls.a.topHeight, 'changing the type must not touch the height')
        .toBe(8);
    });

  test('GUARDRAIL is one of the assemblies a wall can be', async ({ page }) => {
    // Movie, 19 Sep: "lets consider a 'RAIL' a wall type" -- clarified the
    // next day to GUARDRAIL, "to be not confused with HANDRAIL". A pony wall
    // is a wall whose type is this, so it needs no key of its own.
    await pressWorld(page, 0, 0);
    await expect(chip(page, 'guardrail')).toBeVisible();
    await chip(page, 'guardrail').click();
    await save(page);
    expect(wallsOf(await h.savedDrawing(page)).a.wallType).toBe('guardrail');
  });

  test('several walls change together, and a disagreement lights nothing',
    async ({ page }) => {
      await pressWorld(page, 0, 0);
      await pressWorld(page, 0, -10, { shift: true });
      await expect(title(page)).toHaveText('WALL');

      // THE TWO DISAGREE about their type, so no chip is pressed. Lighting the
      // first wall's would be a claim about both.
      await expect(chip(page, 'stud_2x6')).toHaveAttribute('aria-pressed', 'false');
      await expect(chip(page, 'stud_2x4')).toHaveAttribute('aria-pressed', 'false');

      await chip(page, 'insulation_6').click();
      await save(page);
      const walls = wallsOf(await h.savedDrawing(page));
      expect(walls.a.wallType).toBe('insulation_6');
      expect(walls.b.wallType).toBe('insulation_6');
    });

  test('a typed height lands in the file as feet', async ({ page }) => {
    await pressWorld(page, 0, 0);
    await field(page, 'top').fill("9'-6\"");
    await field(page, 'top').press('Enter');
    await save(page);

    const walls = wallsOf(await h.savedDrawing(page));
    expect(walls.a.topHeight, "9'-6\" is 9.5 feet").toBeCloseTo(9.5, 5);
    expect(walls.b.topHeight, 'the other wall is untouched').toBe(8);

    // AND THE BOX SHOWS WHAT IS IN FORCE, not what was typed: the field is
    // redrawn from the record, so 9.5 comes back architectural.
    await expect(field(page, 'top')).toHaveValue(/9/);
  });

  test('a height the parser refuses changes nothing', async ({ page }) => {
    await pressWorld(page, 0, 0);
    await field(page, 'top').fill('banana');
    await field(page, 'top').press('Enter');
    await page.waitForTimeout(200);

    // SAVED FIRST, DELIBERATELY. Reading the store without pressing SAVE
    // reads the FIXTURE, which says 8 whatever the page did to the wall in
    // memory -- an assertion two different worlds satisfy. Pressing SAVE
    // pushes what is in memory, so 8 here means the refusal held.
    await save(page);
    const walls = wallsOf(await h.savedDrawing(page));
    expect(walls.a.topHeight, 'a refused entry must not reach the record')
      .toBe(8);
    // The field reverts rather than sitting there holding text the page did
    // not take — a box lying about the state is how the NEXT edit goes wrong.
    await expect(field(page, 'top')).toHaveValue(/8/);
  });

  test('a top below its base is refused', async ({ page }) => {
    await pressWorld(page, 0, 0);
    await field(page, 'top').fill("-2'");
    await field(page, 'top').press('Enter');
    await page.waitForTimeout(200);
    await save(page);
    expect(wallsOf(await h.savedDrawing(page)).a.topHeight).toBe(8);
  });

  // ── RAIL ────────────────────────────────────────────────────────────────
  //
  // Movie, 20 Sep, refining "lets consider a 'RAIL' a wall type": "RAIL will
  // be an option for WALL properties it will be toggle you can select turn on
  // or off, and if you turn it on the height will be adjusted to what you
  // input in that part (rail section) of the properties area".
  //
  // THE TOGGLE IS THE VERB AND THE WALL TYPE IS THE RECORD, which is the
  // claim worth checking hardest: a `rail: true` beside a wallType would be
  // two ways to say one thing and free to disagree. So every check below
  // reads the TYPE back out of the saved file, and one of them asserts the
  // two rows on screen answer the same way.
  const railChip = (page, on) =>
    page.locator(`#props-slot [data-prop-row="guardrail"] [data-prop-value="${on}"]`);

  test('a wall is not a rail until it is switched on', async ({ page }) => {
    await pressWorld(page, 0, 0);
    await expect(railChip(page, 'off')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#props-slot [data-prop-row="guardrail height"]'),
      'the guardrail height stands on a wall that is not one')
      .toHaveCount(0);
  });

  test('switching GUARDRAIL on sets the type and brings 42\" with it',
    async ({ page }) => {
      await pressWorld(page, 0, 0);
      await railChip(page, 'on').click();
      await save(page);

      const walls = wallsOf(await h.savedDrawing(page));
      expect(walls.a.wallType, 'the toggle and the type are one fact')
        .toBe('guardrail');
      // A wall switched to a guardrail and left at eight feet is an
      // eight-foot railing, which is not a thing. 42 inches is 3'-6".
      expect(walls.a.topHeight, '42 inches, the guardrail height')
        .toBeCloseTo(42 / 12, 5);
      expect(walls.b.wallType, 'the wall nobody pressed must not move')
        .toBe('stud_2x4');

      // AND THE TWO ROWS AGREE, which is what "one fact" means on screen.
      await expect(railChip(page, 'on')).toHaveAttribute('aria-pressed', 'true');
      await expect(chip(page, 'guardrail')).toHaveAttribute('aria-pressed', 'true');
    });

  test('the guardrail height is the drafter-s once it is on', async ({ page }) => {
    await pressWorld(page, 0, 0);
    await railChip(page, 'on').click();
    const field = page.locator('#props-slot [data-prop-field="guardrail height"]');
    await expect(field).toBeVisible();
    await field.fill(`3'-0"`);
    await field.press('Enter');
    await save(page);

    expect(wallsOf(await h.savedDrawing(page)).a.topHeight).toBeCloseTo(3, 5);
  });

  test('switching it off returns the wall to an ordinary assembly',
    async ({ page }) => {
      await pressWorld(page, 0, 0);
      await railChip(page, 'on').click();
      await railChip(page, 'off').click();
      await save(page);

      const walls = wallsOf(await h.savedDrawing(page));
      expect(walls.a.wallType, 'it stayed a guardrail after being switched off')
        .toBe('stud_2x6');
      // THE HEIGHT STAYS WHERE THE DRAFTER LEFT IT. Switching off says "this
      // is not a guardrail", not "put back the wall I had" -- and a height that
      // sprang back would undo an edit he may have made on purpose. Ctrl+Z
      // is the page's answer to undoing.
      expect(walls.a.topHeight).toBeCloseTo(42 / 12, 5);
    });

  test('the box never describes something that is not selected',
    async ({ page }) => {
      // THE DEFECT THIS ROUTER EXISTS TO END. showStructureProps returned
      // early when the selection was not a column or a beam AND LEFT THE OLD
      // PANEL STANDING. Place a column — it selects itself and fills the box —
      // then press a wall, and COLUMN properties stayed on screen with the
      // column long since deselected.
      // §6 puts every tool but SELECT, WALL and OUTLINE away on the TOY
      // board, which is the board this page opens on. COLUMN is one of them,
      // so the drafting board comes first or the key is disabled.
      await page.locator('[data-board-switch] [data-board="drafting"]').click();
      await h.openToolRail(page);
      await h.selectTool(page, 'Column');
      // INSIDE THE DRAWN BOUNDS, on bare sheet. A point past them is not
      // guaranteed to be on the canvas at all: the page fits the drawing, so
      // a press 11 ft below a 10 ft tall plan lands on the instrument strip
      // and places nothing -- which reads exactly like a tool that does not
      // work.
      await pressWorld(page, 6, -5);
      await expect(title(page)).toHaveText('COLUMN');

      await h.selectTool(page, 'Select');
      await pressWorld(page, 0, 0);
      await expect(title(page),
        'the box still says COLUMN with a wall in the drafter\'s hand')
        .toHaveText('WALL');
    });
});
