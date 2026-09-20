// PROPERTIES FOR THE REST OF THE OBJECTS.
//
// Movie, 19 Sep: "There should be a PROPERTIES box with in this case WALL
// PROPERTIES, but there should also a PROPERTIES for ROOF, FLOOR, FENST,
// LINE, etc (all objects)". WALL landed first; these are the rest of the
// ones that can be reached.
//
// ROOF IS NOT HERE, AND IT IS BLOCKED RATHER THAN SKIPPED. hitAt's chain is
// fenestration, wall, line, outline, floor -- a roof cannot be SELECTED on
// this page at all, so a panel for one would have nothing to open it. The
// roof TOOL's overhang and pitch box already exists and is about the NEXT
// roof, which is a different question. Putting roofs in the pick chain is
// its own rung.
//
// WHAT EACH PANEL CARRIES is what its RECORD carries and nothing invented:
//
//   OPENING   type, width, sill, head  -- the parity row's own list of what
//             was absent: "typing a width, sill or head"
//   FLOOR     thickness, thickened edge, slope -- three of the four the
//             floor tool's own comment named as out of scope, plus the area
//             and the structure, read
//   LINE      its length. A line's record is two points, a level, a view and
//             a layer; there is nothing on it to change but the points.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3;

// EACH THING WHERE NOTHING ELSE IS, because hitAt is a PRECEDENCE and a
// press that could mean two objects proves nothing about either. The opening
// is on the wall at z=0, the line runs alone at z=-8, and the floor sits
// clear of both at z=4..14.
const FIXTURE = `
  d.walls = [
    { id: 'a', start: { x: -12, z: 0 }, end: { x: 12, z: 0 },
      levelId: ${MAIN_FL}, view: 'plan', wallType: 'stud_2x6',
      baseHeight: 0, topHeight: 8, refLine: 'center' }
  ];
  d.fenestrations = [
    { id: 1, wallId: 'a', levelId: ${MAIN_FL}, view: 'plan', type: 'window',
      layer: 'A-GLAZ', offset: 12, width: 3, sillHeight: 3, headHeight: 7,
      auto: false }
  ];
  d.floors = [
    { id: 1, levelId: ${MAIN_FL}, view: 'floor', structure: 'floor',
      thickness: 1, thickenedEdge: false, slopeInPerFt: 0, garage: false,
      points: [{ x: -10, y: 0, z: 4 }, { x: 10, y: 0, z: 4 },
               { x: 10, y: 0, z: 14 }, { x: -10, y: 0, z: 14 }] }
  ];
  d.lines = [
    { id: 1, start: { x: -12, z: -8 }, end: { x: 12, z: -8 },
      levelId: ${MAIN_FL}, view: 'plan', layer: 'A-ANNO' }
  ];
  d.dimensions = []; d.roofs = []; d.shapes = [];
  d.columns = []; d.beams = []; d.outlines = [];
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
  await expect(page.locator('#readout')).toContainText('walls 1/1', { timeout: 6000 });
  await expect(page.locator('#left-rail')).toBeVisible();
}

async function pressWorld(page, x, z) {
  const frame = await h.planFrame(page);
  const [cx, cy] = frame.at(x, z);
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(80);
}

async function save(page) {
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
}

const saved = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await file.text());
}, BUCKET);

const title = page => page.locator('#props-slot .props-title').first();
const field = (page, name) => page.locator(`#props-slot [data-prop-field="${name}"]`);
const row = (page, name) => page.locator(`#props-slot [data-prop-row="${name}"]`);

test.describe('MODEL.html object properties', () => {
  test.beforeEach(async ({ page }) => {
    await houseOnOldPage(page);
    await open(page);
  });

  // ── OPENING ────────────────────────────────────────────────────────────
  test('an opening shows its size, and a typed width lands in the file',
    async ({ page }) => {
      await pressWorld(page, 0, 0);
      await expect(title(page)).toHaveText('OPENING');
      await expect(field(page, 'width')).toHaveValue(/3/);
      await expect(field(page, 'sill')).toHaveValue(/3/);
      await expect(field(page, 'head')).toHaveValue(/7/);

      await field(page, 'width').fill(`4'-0"`);
      await field(page, 'width').press('Enter');
      await save(page);
      expect((await saved(page)).fenestrations[0].width).toBeCloseTo(4, 5);
    });

  // A WIDTH IS A PLACEMENT AGAIN: an opening has to fit its wall with bearing
  // either side, and clampOpeningToWall is the rule a PRESS already follows.
  test('a width the wall cannot carry is refused, and nothing changes',
    async ({ page }) => {
      await pressWorld(page, 0, 0);
      await field(page, 'width').fill(`30'-0"`);   // the wall is 24 ft
      await field(page, 'width').press('Enter');
      await page.waitForTimeout(200);
      await save(page);

      const opening = (await saved(page)).fenestrations[0];
      expect(opening.width, 'a refused width reached the record').toBe(3);
      await expect(field(page, 'width'),
        'the box kept text the page did not take').toHaveValue(/3/);
    });

  // A DOOR STANDS ON THE FLOOR, so its sill is zero by construction -- the
  // old page's rule at the point of writing the record rather than a second
  // number kept beside the first. The row goes with it.
  test('switching a window to a door takes its sill to the floor',
    async ({ page }) => {
      await pressWorld(page, 0, 0);
      await expect(field(page, 'sill')).toBeVisible();

      await row(page, 'opening').locator('[data-prop-value="door"]').click();
      await expect(field(page, 'sill'),
        'a door has a sill row to edit a number it does not have')
        .toHaveCount(0);
      await save(page);

      const opening = (await saved(page)).fenestrations[0];
      expect(opening.type).toBe('door');
      expect(opening.sillHeight, 'a door sitting three feet off the floor')
        .toBe(0);
      expect(opening.layer, 'the layer follows the type').toBe('A-DOOR');
    });

  // ── FLOOR ──────────────────────────────────────────────────────────────
  test('a floor reads its structure and area, and takes a thickened edge',
    async ({ page }) => {
      // A FLOOR LIVES ON THE FLOOR LAYER SET, not on the walls plan --
      // layer-views.js's floorHomeView, which is the rule the floor TOOL
      // follows when it files one. So the drafter looking at a floor is
      // looking at that set, and this check has to be there too. The first
      // draft filed the fixture under 'plan' and the readout said it all:
      // floors 0/1, one in the drawing and none on this view.
      await h.openModelRail(page);
      await h.pickModelLayer(page, MAIN_FL, 'floor');
      await page.waitForTimeout(150);
      // AND FIT, BECAUSE THE CAMERA DOES NOT FOLLOW A LAYER SWITCH. It was
      // framed on load against everything then drawn; with only the floor
      // showing, the floor itself can be off the bottom of the sheet -- it
      // was, by 238 px, and the press landed on nothing. `0` is the page's
      // own fit, the same key a drafter presses.
      await page.keyboard.press('0');
      await page.waitForTimeout(200);
      await pressWorld(page, 0, 9);
      await expect(title(page)).toHaveText('FLOOR');
      // Read from the geometry, never stored: 20 x 10.
      await expect(page.locator('#props-slot [data-prop-area]'))
        .toHaveText('AREA 200 SQ FT');
      await expect(page.locator('#props-slot [data-prop-structure]'))
        .toHaveText('FRAMED');

      // Movie asked for this one by name, 18 Sep: "i'd like the roof and
      // thickened edge done".
      await row(page, 'thickened edge').locator('[data-prop-value="on"]').click();
      await field(page, 'thickness').fill(`8"`);
      await field(page, 'thickness').press('Enter');
      await save(page);

      const floor = (await saved(page)).floors[0];
      expect(floor.thickenedEdge).toBe(true);
      expect(floor.thickness, '8 inches is two thirds of a foot')
        .toBeCloseTo(8 / 12, 5);
    });

  // ── LINE ───────────────────────────────────────────────────────────────
  test('a line says how long it is', async ({ page }) => {
    await pressWorld(page, 0, -8);
    await expect(title(page)).toHaveText('LINE');
    // AN EMPTY BOX WOULD BE THE WRONG ANSWER. It reads as "this page has no
    // properties for a line", which is not what is true: a line HAS none to
    // change, and those are different sentences.
    await expect(page.locator('#props-slot [data-prop-span]')).toContainText('24');
    await expect(page.locator('#props-slot [data-prop-note]'))
      .toContainText('TWO POINTS');
  });
});
