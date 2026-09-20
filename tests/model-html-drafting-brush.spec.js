// THE DRAFTING BRUSH — a properties picker, the way an eyedropper works.
//
// The chip has sat in the instrument strip, dimmed, since before this page
// existed; AUTOWINDOWS-PR-NOTES.md named what it was waiting for and said it
// was left out on purpose. RD-DOCUMENTS/SPEC-drafting-brush.md designed it
// with Movie on 5 Sep and left two questions marked "Needs Movie". He answered
// both on 20 Sep:
//
//   "brush will copy the propeties of the object type - LINE / WALL / FLOOR /
//    DIMENSIONS etc. and will copy the EXACT PROPERTIES over to a 'matching'
//    object TYPE - a WALL will only change another WALL for example."
//
//   "if they change to WALL command and start drawing a wall those 'selected'
//    drafting brush properties will remain"
//
//   "so if there is a window in the drafting brush cursor area it will change
//    it, but if a wall it will place a window or door"
//
//   "DOES NOT become a garage door - popup says 'TOO BIG' and won't be
//    accepted the same window will remain it won't change PROPERTIES"
//
// WHAT EVERY CHECK BELOW IS REALLY ASKING is the rule the spec settles the
// edge cases with: THE BRUSH CARRIES WHAT A THING IS, NEVER WHERE IT IS. So a
// dusted wall must take the type and lose nothing about its position; a dusted
// opening must take the width and not slide along its wall to make room; and a
// refusal must leave its target byte-for-byte as it was.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3;

// TWO LONG WALLS OF DIFFERENT TYPES, a short one, and openings on two of them.
//
// DELIBERATELY NOT THE SAME TYPE, and deliberately not the same HEIGHT: a
// brush that copied nothing at all would still pass "b is 2x6 now" against a
// fixture where b already was.
//
// THE SHORT WALL IS FOUR FEET, which is the TOO BIG check's whole subject. It
// carries the 2'-6" leaf it has (2.5 + two free-end reserves of 5/8" + 6" is
// 3'-9") and cannot carry the 16'-0" one on the brush by a factor of four.
const FIXTURE = `
  d.walls = [
    { id: 'a', start: { x: -12, z: 0 }, end: { x: 12, z: 0 },
      levelId: ${MAIN_FL}, view: 'plan', wallType: 'stud_2x6',
      baseHeight: 0, topHeight: 9, refLine: 'center' },
    { id: 'b', start: { x: -12, z: -10 }, end: { x: 12, z: -10 },
      levelId: ${MAIN_FL}, view: 'plan', wallType: 'stud_2x4',
      baseHeight: 0, topHeight: 8, refLine: 'left' },
    { id: 'c', start: { x: 20, z: 0 }, end: { x: 24, z: 0 },
      levelId: ${MAIN_FL}, view: 'plan', wallType: 'stud_2x6',
      baseHeight: 0, topHeight: 8, refLine: 'center' },
    { id: 'd', start: { x: -12, z: -20 }, end: { x: 12, z: -20 },
      levelId: ${MAIN_FL}, view: 'plan', wallType: 'stud_2x6',
      baseHeight: 0, topHeight: 8, refLine: 'center' },
    { id: 'e', start: { x: -12, z: -30 }, end: { x: 12, z: -30 },
      levelId: ${MAIN_FL}, view: 'plan', wallType: 'stud_2x6',
      baseHeight: 0, topHeight: 8, refLine: 'center' },
    { id: 'g', start: { x: -12, z: 10 }, end: { x: 12, z: 10 },
      levelId: ${MAIN_FL}, view: 'plan', wallType: 'stud_2x6',
      baseHeight: 0, topHeight: 8, refLine: 'center' }
  ];
  d.fenestrations = [
    { id: 'big', wallId: 'g', levelId: ${MAIN_FL}, view: 'plan', type: 'door',
      layer: 'A-DOOR', offset: 12, width: 16, sillHeight: 0, headHeight: 7,
      garage: true, auto: false },
    { id: 'win', wallId: 'b', levelId: ${MAIN_FL}, view: 'plan', type: 'window',
      layer: 'A-GLAZ', offset: 12, width: 3, sillHeight: 2.5, headHeight: 6.667,
      auto: false },
    { id: 'tiny', wallId: 'c', levelId: ${MAIN_FL}, view: 'plan', type: 'window',
      layer: 'A-GLAZ', offset: 2, width: 2.5, sillHeight: 2.5, headHeight: 6.667,
      auto: false },
    // THREE FEET FROM THE CORNER OF A WALL THAT IS LONG ENOUGH. This is the
    // case 'tiny' cannot make: wall e is 24 ft and CAN carry a 16'-0" door,
    // just not centred three feet from its end -- clampOpeningToWall would
    // slide it out to 8'-9" to leave the lintel its bearing. On 'tiny' the
    // wall refuses the door outright, so a brush that slid instead of
    // refusing would pass that check unchanged. Found by a mutant that
    // survived: "REFUSED BECOMES SLID".
    { id: 'edge', wallId: 'e', levelId: ${MAIN_FL}, view: 'plan', type: 'window',
      layer: 'A-GLAZ', offset: 3, width: 3, sillHeight: 2.5, headHeight: 6.667,
      auto: false }
  ];
  d.lines = [
    { id: 'l1', start: { x: -12, z: 20 }, end: { x: 12, z: 20 },
      levelId: ${MAIN_FL}, view: 'plan', layer: 'draft' },
    { id: 'l2', start: { x: -12, z: 26 }, end: { x: 12, z: 26 },
      levelId: ${MAIN_FL}, view: 'plan', layer: 'S-FOOTING' }
  ];
  d.floors = []; d.dimensions = []; d.roofs = []; d.shapes = [];
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
  await expect(page.locator('#readout')).toContainText('walls 6/6', { timeout: 6000 });
}

async function pressWorld(page, x, z) {
  const frame = await h.planFrame(page);
  const [cx, cy] = frame.at(x, z);
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(80);
}

// THIS PAGE DOES NOT AUTOSAVE, so a check that read the store without pressing
// SAVE would be reading the FIXTURE back and calling it a round trip.
async function saved(page) {
  await page.locator('[data-model-save]').click();
  await h.waitForSaved(page);
  return page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    return JSON.parse(await file.text());
  }, BUCKET);
}

const brush = page => page.locator('#strip-brush');
const load = page => page.locator('#strip-brush-load');
const strip = page => page.locator('#strip-message');
const wallsOf = d => Object.fromEntries((d.walls || []).map(w => [w.id, w]));
const opsOf = d => Object.fromEntries((d.fenestrations || []).map(o => [o.id, o]));
const linesOf = d => Object.fromEntries((d.lines || []).map(l => [l.id, l]));

// Where each fixture item is, in world feet.
//
// AN OFFSET IS MEASURED FROM THE WALL'S START. Every wall here runs from
// x = -12, so an opening at offset 12 is centred at x = 0 and not at x = 12 --
// and the first draft of this file put the two opening presses at x = -4,
// four feet off. The garage door is sixteen feet wide so the press still
// landed inside it and the check passed; the three-foot window it was dusted
// onto was missed entirely, the press fell on BARE WALL, and the brush did
// the other correct thing -- it placed a new door there. Two checks then read
// the untouched window and agreed it was untouched. An assertion satisfied by
// more than one world state, and the more interesting of the two was the one
// nobody was looking at.
//
// EVERY PRESS HAS FEET OF CLEARANCE, and the first two drafts of this file
// did not. An offset is measured from its wall's START, and every wall here
// begins at x = -12, so an opening at offset 12 is centred at x = 0 -- draft
// one pressed at x = -4 and missed a three-foot window entirely. Draft two
// put the sixteen-foot garage door on the same wall the WALL press used and
// aimed that press at x = -8, which is the door's own EDGE: it read as a
// wall at one zoom and as the door at the next, because the grab is in
// SCREEN pixels and adding a wall to the fixture changed the fit.
//
// So the garage door has a wall to itself and nothing here is pressed within
// five feet of anything else. A fixture whose answers depend on the camera is
// a fixture that will change its mind later, on somebody else's branch.
const ON_A = [-8, 0];        // wall a, which carries nothing
const ON_A_DOOR = [0, 10];   // the garage door, alone on wall g
const ON_B = [-8, -10];      // wall b, six feet clear of its window
const ON_B_WIN = [0, -10];   // the 3 ft window on b: offset 12 from x = -12
const ON_C_WIN = [22, 0];    // the 2'-6" window in the 4 ft wall
const ON_D = [0, -20];       // wall d, which carries nothing at all
const ON_E_EDGE = [-9, -30]; // the window three feet from wall e's corner
const ON_L1 = [0, 20];
const ON_L2 = [0, 26];

test.describe('MODEL.html drafting brush', () => {
  test.beforeEach(async ({ page }) => {
    await houseOnOldPage(page);
    await open(page);
  });

  test('the chip is awake, and empty it says nothing', async ({ page }) => {
    // IT WAS A <span class="chip dormant"> WITH NO HANDLER. "Awake" is not a
    // cosmetic claim: a dormant chip is display:none inside the strip's own
    // media query and has no click at any width.
    await expect(brush(page)).toBeEnabled();
    await expect(load(page)).toHaveText('');
    await expect(brush(page)).not.toHaveClass(/\blit\b/);
  });

  test('pressing a wall loads it, and the chip says what it is holding',
    async ({ page }) => {
      await brush(page).click();
      await pressWorld(page, ...ON_A);
      // LIT MEANS LOADED, not merely armed — the whole defence against the
      // usual armed-tool surprise is that the brush says what it will do
      // before the drafter does it.
      await expect(brush(page)).toHaveClass(/\blit\b/);
      await expect(load(page)).toHaveText(/WALL 9/);
      await expect(brush(page)).toHaveAttribute('title', /2.6 Stud/);
    });

  test('a second wall takes the first one-s properties and does not move',
    async ({ page }) => {
      await brush(page).click();
      await pressWorld(page, ...ON_A);   // lift off a: 2x6, 9 ft, centre
      await pressWorld(page, ...ON_B);   // dust b: was 2x4, 8 ft, left
      const d = await saved(page);
      const b = wallsOf(d).b;
      expect(b.wallType, 'it took the type').toBe('stud_2x6');
      expect(b.topHeight, 'and the height').toBeCloseTo(9, 6);
      expect(b.refLine, 'and the reference line').toBe('center');
      // AND NOTHING ABOUT WHERE IT IS. This is the rule the whole tool turns
      // on, and it is the half a "did it copy?" check cannot see: a brush
      // that assigned the source wall wholesale would pass every line above
      // and put wall b on top of wall a.
      expect(b.start.z, 'b is still where it was drawn').toBeCloseTo(-10, 6);
      expect(b.end.z).toBeCloseTo(-10, 6);
      expect(b.id, 'and it is still itself').toBe('b');
      // The source is untouched — a dust is one-way.
      expect(wallsOf(d).a.wallType).toBe('stud_2x6');
      expect(wallsOf(d).a.topHeight).toBeCloseTo(9, 6);
    });

  test('a wall-s properties will not land on a line', async ({ page }) => {
    await brush(page).click();
    await pressWorld(page, ...ON_A);
    await pressWorld(page, ...ON_L1);
    await expect(strip(page),
      'the refusal names BOTH kinds — "wrong kind" without saying which two '
      + 'is a sentence the drafter has to work out from what he can see')
      .toContainText(/holding WALL/i);
    await expect(strip(page)).toContainText(/LINE/i);
    const d = await saved(page);
    const line = linesOf(d).l1;
    expect(line.layer, 'the line is untouched').toBe('draft');
    expect(line.wallType, 'and did not grow a wall-s keys').toBeUndefined();
    expect(line.topHeight).toBeUndefined();
  });

  test('a line gives its layer to another line', async ({ page }) => {
    await brush(page).click();
    await pressWorld(page, ...ON_L2);   // S-FOOTING
    await pressWorld(page, ...ON_L1);   // was A-WALL
    const d = await saved(page);
    expect(linesOf(d).l1.layer, 'A-WALL is not a line layer — the loader '
      + 'normalises it to draft, which is what l1 starts as').toBe('S-FOOTING');
    expect(linesOf(d).l1.start.z, 'and it is still where it was').toBeCloseTo(20, 6);
  });

  test('Escape puts the load down and leaves the brush up', async ({ page }) => {
    await brush(page).click();
    await pressWorld(page, ...ON_A);
    await expect(brush(page)).toHaveClass(/\blit\b/);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(120);
    // LOADED BECOMES EMPTY, AND THE TOOL STAYS UP — which the chip alone
    // cannot do, and is the reason the spec gives Escape a step of its own.
    await expect(brush(page)).not.toHaveClass(/\blit\b/);
    await expect(brush(page)).toHaveClass(/\barmed\b/);
    await expect(load(page)).toHaveText('');
  });

  test('a garage door dusted onto a window makes it a garage door',
    async ({ page }) => {
      await brush(page).click();
      await pressWorld(page, ...ON_A_DOOR);
      await expect(load(page)).toHaveText(/GARAGE DOOR/);
      await pressWorld(page, ...ON_B_WIN);
      const d = await saved(page);
      const win = opsOf(d).win;
      expect(win.type, 'it became a door').toBe('door');
      expect(win.layer, 'on the door layer').toBe('A-DOOR');
      expect(win.width).toBeCloseTo(16, 6);
      expect(win.headHeight).toBeCloseTo(7, 6);
      expect(win.garage, 'and it is an overhead door').toBe(true);
      // NOT SLID. A typed width may slide an opening along to make room,
      // because the drafter asked for that width AT that opening. A dusted
      // one may not: he asked for these properties, and quietly moving the
      // window he aimed at would be the brush editing where a thing is.
      expect(win.offset, 'and it did not move along its wall').toBeCloseTo(12, 6);
      expect(win.wallId, 'nor change walls').toBe('b');
    });

  test('and onto one in a bay too short it says TOO BIG and changes nothing',
    async ({ page }) => {
      await brush(page).click();
      await pressWorld(page, ...ON_A_DOOR);
      await pressWorld(page, ...ON_C_WIN);
      await expect(strip(page), 'Movie: popup says TOO BIG')
        .toContainText(/TOO BIG/i);
      const d = await saved(page);
      const tiny = opsOf(d).tiny;
      // "won't be accepted the same window will remain it won't change
      // PROPERTIES" — every field, not just the width.
      expect(tiny.type).toBe('window');
      expect(tiny.width).toBeCloseTo(2.5, 6);
      expect(tiny.headHeight).toBeCloseTo(6.667, 3);
      expect(tiny.layer).toBe('A-GLAZ');
      expect(tiny.garage, 'and it did not become an overhead door').toBeUndefined();
    });

  test('and it refuses rather than sliding the opening it was aimed at',
    async ({ page }) => {
      // THE OTHER HALF OF THE FIT RULE, and the half 'tiny' cannot show.
      // Wall e IS long enough for a 16'-0" door -- it is twenty-four feet --
      // so clampOpeningToWall does not refuse, it SLIDES: the door would land
      // at 8'-9" from the corner instead of the 3'-0" the window sits at.
      //
      // A typed width may slide, because the drafter asked for that width AT
      // that opening. A dusted one may not: he asked for these properties,
      // and quietly moving the window he aimed at would be the brush editing
      // where a thing is, which is the one thing it must never do.
      await brush(page).click();
      await pressWorld(page, ...ON_A_DOOR);
      await pressWorld(page, ...ON_E_EDGE);
      await expect(strip(page)).toContainText(/TOO BIG/i);
      const d = await saved(page);
      const edge = opsOf(d).edge;
      expect(edge.offset, 'it did not slide out to make room').toBeCloseTo(3, 6);
      expect(edge.width, 'and it is still the window it was').toBeCloseTo(3, 6);
      expect(edge.type).toBe('window');
    });

  test('a loaded opening on bare wall puts a new one there', async ({ page }) => {
    await brush(page).click();
    await pressWorld(page, ...ON_A_DOOR);
    // ON WALL d, WHICH CARRIES NOTHING — the press lands on plain wall, which
    // Movie says is the case that places rather than repaints: "if there is a
    // window in the drafting brush cursor area it will change it, but if a
    // wall it will place a window or door". A wall with an opening already on
    // it would work too, and would leave the check arguing about which of two
    // openings it had found.
    await pressWorld(page, ...ON_D);
    const d = await saved(page);
    const made = (d.fenestrations || []).filter(o => !['big','win','tiny','edge'].includes(o.id));
    expect(made.length, 'one new opening').toBe(1);
    expect(made[0].wallId, 'on the wall that was pressed').toBe('d');
    expect(made[0].type).toBe('door');
    expect(made[0].width).toBeCloseTo(16, 6);
    expect(made[0].garage, 'carrying what the brush held').toBe(true);
    expect(made[0].headHeight).toBeCloseTo(7, 6);
    // AND THE SOURCE IS STILL THERE. A "place" that moved the door it was
    // holding would satisfy every count above.
    expect(opsOf(d).big, 'the door it was lifted from stands').toBeTruthy();
  });

  test('arming WALL puts the brush-s press down and keeps what it holds',
    async ({ page }) => {
      await brush(page).click();
      await pressWorld(page, ...ON_A);
      await expect(load(page)).toHaveText(/WALL 9/);
      // Movie: "if they change to WALL command and start drawing a wall those
      // 'selected' drafting brush properties will remain".
      await page.locator('[data-tool-key="wall"]').click();
      await expect(load(page), 'the load survives the tool change')
        .toHaveText(/WALL 9/);
      await expect(brush(page), 'and the brush stops taking presses')
        .not.toHaveClass(/\barmed\b/);
      // INSIDE THE DRAWING'S OWN BOUNDS. planFrame maps world to screen
      // through the camera the page publishes, and the first draft drew at
      // (-20, 20) -- outside the fit, so both presses missed the canvas and
      // the check reported "one wall was drawn: 0" with nothing wrong in the
      // page at all.
      const frame = await h.planFrame(page);
      await page.mouse.click(...frame.at(16, -4));
      await page.waitForTimeout(80);
      await page.mouse.click(...frame.at(16, -8));
      await page.waitForTimeout(150);
      const d = await saved(page);
      const made = (d.walls || []).filter(w => !['a','b','c','d','e','g'].includes(String(w.id)));
      expect(made.length, 'one wall was drawn').toBe(1);
      expect(made[0].wallType, 'wearing the brush-s type').toBe('stud_2x6');
      expect(made[0].topHeight, 'and its height').toBeCloseTo(9, 6);
      expect(made[0].refLine).toBe('center');
    });

  test('one Ctrl+Z puts a dusted wall back', async ({ page }) => {
    await brush(page).click();
    await pressWorld(page, ...ON_A);
    await pressWorld(page, ...ON_B);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(150);
    const d = await saved(page);
    const b = wallsOf(d).b;
    expect(b.wallType, 'back to what it was').toBe('stud_2x4');
    expect(b.topHeight).toBeCloseTo(8, 6);
    expect(b.refLine).toBe('left');
  });

  test('a key the brush added is removed by the undo, not left standing',
    async ({ page }) => {
      // THE HALF A "PUT IT BACK" CHECK CANNOT SEE. `garage` arrives on a
      // window that never had one, and an undo that assigns the old copy over
      // the top leaves it there — a window that reads as an overhead door in
      // every painter and in the file.
      await brush(page).click();
      await pressWorld(page, ...ON_A_DOOR);
      await pressWorld(page, ...ON_B_WIN);
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(150);
      const d = await saved(page);
      const win = opsOf(d).win;
      expect(win.type, 'a window again').toBe('window');
      expect(win.width).toBeCloseTo(3, 6);
      expect(win.garage, 'and the key the brush added is gone').toBeUndefined();
    });

  test('the foot switch is a square tile with a 1 in it', async ({ page }) => {
    // Movie, 20 Sep: "maybe just a square tile that has a 1' in it for the
    // dashboard light". The switch itself has worked since the FOOT LIGHT
    // order landed — what nobody could read was the glyph, a scale triangle
    // that says "mountain" to anyone who has not been told.
    const svg = await page.locator('#strip-scale svg').innerHTML();
    expect(svg, 'the tile').toContain('<rect');
    expect(svg, 'and not the old scale triangle').not.toContain('M2 11 L8 4 L14 11 Z');
    // AND IT STILL SWITCHES. A glyph change that broke the control would pass
    // both lines above.
    await expect(page.locator('#strip-scale')).toBeEnabled();
  });
});
