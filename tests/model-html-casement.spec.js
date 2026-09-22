// A WINDOW IS A SINGLE OR A DOUBLE CASEMENT, AND THE TYPE CARRIES A SIZE IN.
//
// Movie, 22 Sep 2026, on the room over the garage:
//
//   "for windows over the garage lets put windows at 36" height can we also
//    make it 66" wide and put a seperation in the center"
//   "1 window, with 2 window panes"
//   "let make it a different window TYPE in WINDOW PROPERTIES"
//   "the first one SINGLE CASEMENT, this one DOUBLE CASEMENT"
//
// and, asked whether picking the type should resize the window it is picked
// on, BOTH halves of the ruling:
//
//   "no size should stay the same (they can change it)"
//   "ya lets make that size default for that type"
//
// Those are only both true if a size is a DEFAULT the type carries IN rather
// than a rule it keeps enforcing: the tool panel loads 5'-6" x 3'-0" when a
// double is picked to place, and the selection panel does not, because by
// then the width may be one the drafter typed. It is the 7'-0" head ruling
// again -- what moves is what nobody chose.
//
// WHAT IS PINNED OFFLINE, in proto/casement-harness.js (27 checks, six
// mutation runs): the two modules agreeing on which casements exist, the
// sizes themselves, the reader's default, and that the elevation painter
// bars a double and only a double. WHAT NEEDS A BROWSER is this file: that
// the panel offers the choice, that picking it to place loads the size, and
// that picking it on a window already drawn loads nothing.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
const MAIN_FL = 3;

// geometry-2d.js's numbers, copied by hand for the same reason
// model-html-fenestration.spec.js copies them and says so: asking the page
// which number it used and then checking it used that number is a tautology.
// A copy means a change has to be made twice and the failure names this file.
const WINDOW_W = 4;
const WINDOW_HEAD = 7;
const DOOR_HEAD = (6 * 12 + 8) / 12;
const WINDOW_SILL = WINDOW_HEAD - (DOOR_HEAD - 2.5);   // the single's 4'-2" of glass
const DOUBLE_W = 66 / 12;
const DOUBLE_H = 36 / 12;
const DOUBLE_SILL = WINDOW_HEAD - DOUBLE_H;            // 4'-0", derived not typed

const base = extra => ({
  version: 1,
  levels: [{ id: MAIN_FL, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  board: 'drafting',
  walls: [
    ['n', V(-10, -10), V(10, -10)], ['e', V(10, -10), V(10, 10)],
    ['s', V(10, 10), V(-10, 10)], ['w', V(-10, 10), V(-10, -10)],
  ].map(([id, start, end]) => ({ id, start, end, levelId: MAIN_FL, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' })),
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
  ...extra,
});

const readout = page => page.locator('#readout');

async function open(page, file = base({})) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  await page.goto('/MODEL.html?left=1&right=1');
  await expect(readout(page)).toContainText('walls', { timeout: 10000 });
  await expect(page.locator('[data-tool-key="fenestration"]')).toBeVisible();
}

const armOpening = page => page.locator('[data-tool-key="fenestration"]').click();
const pickType = (page, id) =>
  page.locator(`[data-prop-row="opening"] [data-prop-value="${id}"]`).click();
const pickCasement = (page, id) =>
  page.locator(`[data-prop-row="casement"] [data-prop-value="${id}"]`).click();

async function save(page) {
  await expect(page.locator('#save')).toBeEnabled({ timeout: 4000 });
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
}

// THE READ THAT MATTERS: not what the page holds, but what a fresh load keeps.
// DraftDrawingFormat is the normaliser the page runs on open, so this asks the
// question a reload asks -- and it is the read that catches a field the reader
// quietly drops, which is exactly what a brand-new key is at risk of being.
const survives = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  const raw = JSON.parse(await file.text());
  const F = window.DraftDrawingFormat;
  const levelIds = new Set((raw.levels || []).map(level => Number(level.id)));
  return F.fenestrations(raw.fenestrations, levelIds);
}, BUCKET);

test('the tool offers CASEMENT on a window and not on a door', async ({ page }) => {
  await open(page);
  await armOpening(page);
  const row = page.locator('[data-prop-row="casement"]');

  // A DOOR HAS NO CASEMENT, and the tool opens holding a door. A row offering
  // a choice the record then writes as null would be the panel telling the
  // drafter something about the page that is not true -- the same rule the
  // SILL row already follows.
  await expect(page.locator('[data-prop-row="opening"]')).toBeVisible();
  await expect(row).toHaveCount(0);

  await pickType(page, 'window');
  await expect(row).toBeVisible();
  await expect(row.locator('[data-prop-value="single"]'))
    .toHaveAttribute('aria-pressed', 'true');
});

test('picking DOUBLE to place loads the size that type comes at', async ({ page }) => {
  await open(page);
  await armOpening(page);
  await pickType(page, 'window');

  // The note is the one line that says what the next press will make, so it is
  // what a drafter actually reads before pressing.
  const note = page.locator('[data-opening-note]');
  await expect(note).toContainText("4'-0\"");
  await expect(note).toContainText("2'-10\"");

  await pickCasement(page, 'double');
  await expect(note).toContainText("5'-6\"");
  // THE SILL IS DERIVED FROM THE HEAD, never carried: a 3'-0" unit under the
  // 7'-0" head every window keeps sits on a 4'-0" sill BECAUSE of those two.
  await expect(note).toContainText("4'-0\"");
  await expect(note).toContainText("7'-0\"");

  // AND GOING BACK LOADS THE SINGLE'S AGAIN, so this is a type carrying a
  // size and not a one-way door.
  await pickCasement(page, 'single');
  await expect(note).toContainText("4'-0\"");
  await expect(note).toContainText("2'-10\"");
});

test('a double casement placed by hand survives the save at its own size',
  async ({ page }) => {
    await open(page);
    await armOpening(page);
    await pickType(page, 'window');
    await pickCasement(page, 'double');

    const f = await h.planFrame(page);
    await page.mouse.click(...f.at(0, -10));
    await page.waitForTimeout(150);
    await save(page);

    const openings = await survives(page);
    expect(openings, 'one opening was placed').toHaveLength(1);
    const [o] = openings;
    expect(o.casement, 'and it is a double').toBe('double');
    expect(o.width).toBeCloseTo(DOUBLE_W, 6);
    expect(o.sillHeight).toBeCloseTo(DOUBLE_SILL, 6);
    expect(o.headHeight).toBeCloseTo(WINDOW_HEAD, 6);
  });

test('a single placed by hand is still what a window has always been',
  async ({ page }) => {
    await open(page);
    await armOpening(page);
    await pickType(page, 'window');

    const f = await h.planFrame(page);
    await page.mouse.click(...f.at(0, -10));
    await page.waitForTimeout(150);
    await save(page);

    const [o] = await survives(page);
    expect(o.casement).toBe('single');
    expect(o.width).toBeCloseTo(WINDOW_W, 6);
    expect(o.sillHeight).toBeCloseTo(WINDOW_SILL, 6);
    expect(o.headHeight).toBeCloseTo(WINDOW_HEAD, 6);
  });

test('switching a window already drawn changes its panes and not its size',
  async ({ page }) => {
    await open(page);
    await armOpening(page);
    await pickType(page, 'window');

    const f = await h.planFrame(page);
    await page.mouse.click(...f.at(0, -10));
    await page.waitForTimeout(150);

    // SELECT is the resting tool and the opening tool stays armed by design,
    // so without this the press below would place a SECOND window on the first
    // rather than selecting it.
    await page.locator('[data-tool-key="select"]').click();
    await page.mouse.click(...f.at(0, -10));
    await page.waitForTimeout(150);
    await expect(page.locator('#props-slot [data-prop-row="casement"]')).toBeVisible();

    await page.locator('#props-slot [data-prop-row="casement"] [data-prop-value="double"]')
      .click();
    await page.waitForTimeout(150);
    await save(page);

    const [o] = await survives(page);
    // THE PANES CHANGED,
    expect(o.casement, 'it is a double now').toBe('double');
    // AND NOTHING ELSE DID. This is Movie's *"no size should stay the same
    // (they can change it)"*, and it is the check that would go red the day
    // someone made the selection panel load the type's default the way the
    // TOOL panel does -- which reads like a convenience and would silently
    // resize a window whose width the drafter had typed.
    expect(o.width, 'still the width it was placed at').toBeCloseTo(WINDOW_W, 6);
    expect(o.sillHeight, 'and still on its own sill').toBeCloseTo(WINDOW_SILL, 6);
    expect(o.headHeight).toBeCloseTo(WINDOW_HEAD, 6);
  });

test('a door offers no CASEMENT row when it is the thing selected',
  async ({ page }) => {
    await open(page);
    await armOpening(page);

    const f = await h.planFrame(page);
    await page.mouse.click(...f.at(0, -10));
    await page.waitForTimeout(150);
    await page.locator('[data-tool-key="select"]').click();
    await page.mouse.click(...f.at(0, -10));
    await page.waitForTimeout(150);

    await expect(page.locator('#props-slot [data-prop-row="opening"]')).toBeVisible();
    await expect(page.locator('#props-slot [data-prop-row="casement"]')).toHaveCount(0);
  });

test('the 2 STOREY + GARAGE + ROOM OVER glazes the room with double casements',
  async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await page.evaluate(async bucket => {
      await window.SharedFileStore.saveSharedFile(
        new File([JSON.stringify({
          version: 1,
          levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
            { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
            { id: 1, name: 'FOUNDATION', elev: -8 }],
          activeLevelIdx: 3,
          walls: [], lines: [], floors: [], roofs: [], fenestrations: [],
          dimensions: [], outlines: [], shapes: [], surfaceOpenings: [],
          stairs: [], notes: [], roomTags: [], columns: [], beams: [],
          boneyardOutlines: [], boneyardShelves: [], groups: [], levelLocks: [],
          underlays: [],
        })], 'drawing.json', { type: 'application/json' }), bucket);
    }, BUCKET);
    await page.goto('/MODEL.html');
    await expect(readout(page)).toContainText('walls', { timeout: 10000 });

    await h.openDriveThru(page);
    await page.locator('[data-build-family="bungalow"]').click();
    await page.locator('[data-build-entry="twoStorey-over"]').click();
    await page.locator('#dt-bone').click();
    await page.waitForTimeout(400);
    await save(page);

    const openings = await survives(page);
    const windows = openings.filter(o => o.type === 'window');
    const doubles = windows.filter(o => o.casement === 'double');

    // THE DESIGN SAYS HOW MANY, asked of the module rather than typed in
    // again -- a spec carrying its own three would pass on a page that had
    // stopped reading premade-plans.js and grown a copy.
    const dealt = await page.evaluate(() =>
      window.DraftPremadePlans.planFor('twoStorey-over').overGarageOpenings
        .filter(o => o.type === 'window').length);
    expect(doubles, 'the room over the garage is glazed with doubles')
      .toHaveLength(dealt);
    doubles.forEach(o => {
      expect(o.width).toBeCloseTo(DOUBLE_W, 6);
      expect(o.sillHeight).toBeCloseTo(DOUBLE_SILL, 6);
      expect(o.headHeight).toBeCloseTo(WINDOW_HEAD, 6);
    });

    // AND NOTHING ELSE IN THE HOUSE CHANGED, which is the half that keeps this
    // honest: a build that made EVERY window a double would satisfy the count
    // above only by accident, and would satisfy it exactly if the design had
    // three windows. There are far more than three.
    const singles = windows.filter(o => o.casement === 'single');
    expect(singles.length, 'the rest of the house keeps its singles')
      .toBeGreaterThan(doubles.length);
    singles.forEach(o => expect(o.width).toBeCloseTo(WINDOW_W, 6));
  });
