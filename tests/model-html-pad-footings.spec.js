// THE PAD UNDER A COLUMN, AND THE HOLE IN THE FLOOR ABOVE.
//
// Movie, 25 Sep, looking at a built foundation showing its beam and three
// teleposts and nothing beneath them: "we have beam and columns, but no
// footing, we will need footings below the columns, please check the model.DC
// version i think it had them already 36"x36"x8"dp". And: "the stair, also on
// the foundation plan (on on floor plans where the floor has an opening above
// uses a line with short dashes and gaps with a med-lightweight pen draw where
// the openings in the floor ABOVE are located".
//
// THE ARITHMETIC IS NOT HERE. Which pads pour together is build-house.js's
// rule and proto/pad-footing-harness.js pins it. What only a page test reaches
// is whether the page ASKS -- a pad group drawn on the wrong plan, or an
// opening drawn for the wrong level, is a page bug that every harness check
// would pass through.
//
// AND THE PAGE HAD NO TABLE TO ASK WITH. MODEL.html carried id+label pairs for
// the picker and no sizes, so it handed the painter `footing: null` for every
// pad -- which is why nothing drew -- and a hard-coded `sizeIn: 6` for every
// pile, so a 12" pile and an 8" pile were the same circle.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const FOUNDATION = 1, MAIN_FL = 3, SECOND_FL = 5;

// Wraps every draw* on window.DraftRender2D and records the call. Lifted from
// model-html-beam-column.spec.js, which is where the idiom was worked out.
const SPY = `
  window.__paintCalls = {};
  window.__spyState = 'waiting';
  let real = undefined;
  Object.defineProperty(window, 'DraftRender2D', {
    configurable: true,
    get() { return real; },
    set(value) {
      if (!value || typeof value !== 'object') { real = value; return; }
      const copy = {};
      let wrapped = 0;
      for (const name of Object.keys(value)) {
        const member = value[name];
        if (typeof member === 'function' && /^draw/.test(name)) {
          wrapped += 1;
          copy[name] = function (...args) {
            (window.__paintCalls[name] = window.__paintCalls[name] || []).push(1);
            return member.apply(this, args);
          };
        } else copy[name] = member;
      }
      window.__spyState = 'wrapped ' + wrapped;
      real = copy;
    },
  });
`;

const empty = (extra = {}) => ({
  version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 },
  ],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
  ...extra,
});

async function seed(page, file = empty()) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
}

async function order(page, family, entry) {
  await h.openDriveThru(page);
  await page.locator(`[data-build-family="${family}"]`).click({ timeout: 8000 });
  await page.locator(`[data-build-entry="${entry}"]`).click({ timeout: 8000 });
  await page.locator('#dt-bone').click();
  await page.waitForTimeout(700);
}

// A SAVE BEFORE ANY NAVIGATION. This page saves on a PRESS, not on every edit,
// so a goto after a build throws the house away and paints an empty grid --
// which looks exactly like a painter that drew nothing. Cost this file an
// afternoon's confusion during the probe that preceded it.
async function saveNow(page) {
  await expect(page.locator('#save')).toBeEnabled({ timeout: 4000 });
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
}

const savedFile = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return file ? JSON.parse(await file.text()) : null;
}, BUCKET);

// Paint once with the spy live and read what was called. The page paints at
// boot, BEFORE an init script's wrapper can be in place for the first frame,
// so the '0' (zoom to fit) forces a frame the instrument can see.
async function paintedOn(page, level, view) {
  await page.goto(`/MODEL.html?left=1&right=1&level=${level}&view=${view}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  // ONE FRAME, NOT EVERY FRAME SINCE THE LOAD. The spy ACCUMULATES, and the
  // page paints at least twice before this line -- once at boot and again as
  // the level settles. Counting without clearing gave exactly 2x on every
  // check: 6 pad calls for 3 teleposts, 2 opening calls for 1 hole. The ratio
  // is what identified it as the instrument rather than the app, since a page
  // really drawing each pad twice would not land on a clean multiple of the
  // frame count for two unrelated painters at once.
  await page.evaluate(() => { window.__paintCalls = {}; });
  await page.keyboard.press('0');
  await page.waitForTimeout(400);
  const state = await page.evaluate(() => window.__spyState);
  // THE INSTRUMENT'S OWN CONTROL: an empty result from a spy that never
  // installed is not a finding about pads.
  expect(String(state), 'the paint spy did not install').toMatch(/^wrapped [1-9]/);
  return page.evaluate(() => window.__paintCalls || {});
}
const times = (calls, painter) => (calls[painter] || []).length;

test('a built foundation draws a pad under every telepost', async ({ page }) => {
  await page.addInitScript(SPY);
  await seed(page);
  await page.goto('/MODEL.html?left=1&right=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await order(page, 'bungalow', 'twoStorey');
  await saveNow(page);
  const saved = await savedFile(page);

  // What the drawing actually holds, so the count below is measured against
  // the file rather than against a number typed here.
  const isPile = column => String(column.footing || '').startsWith('pile');
  const pads = (saved.columns || []).filter(column =>
    column.levelId === FOUNDATION && !isPile(column));
  expect(pads.length, 'the house was built with no teleposts to put pads under')
    .toBeGreaterThan(0);

  const calls = await paintedOn(page, FOUNDATION, 'foundation');
  expect(times(calls, 'drawPadGroup2D'),
    'the foundation drew no pad at all under columns that have one')
    .toBeGreaterThan(0);
  // THE TELEPOSTS ON THIS HOUSE STAND CLEAR OF EACH OTHER, so each pours its
  // own footing -- one group per column. A count that merely exceeded zero
  // would pass for a single combined rectangle swallowing the lot.
  expect(times(calls, 'drawPadGroup2D'),
    'the pads did not pour one per telepost').toBe(pads.length);
});

test('a pad is drawn on the foundation and nowhere else', async ({ page }) => {
  // A pad is concrete in the ground and the plan it belongs on is the one
  // about the ground. Drawn on a floor plan it reads as something in the room.
  await page.addInitScript(SPY);
  await seed(page);
  await page.goto('/MODEL.html?left=1&right=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await order(page, 'bungalow', 'twoStorey');
  await saveNow(page);

  const onFoundation = await paintedOn(page, FOUNDATION, 'foundation');
  expect(times(onFoundation, 'drawPadGroup2D')).toBeGreaterThan(0);

  const onMain = await paintedOn(page, MAIN_FL, 'plan');
  expect(times(onMain, 'drawPadGroup2D'),
    'a buried pad was drawn onto a floor plan, where it reads as furniture')
    .toBe(0);
  // AND THE CONTROL: the main floor DID paint, so the zero above is a rule
  // rather than a page that drew nothing at all.
  expect(Object.keys(onMain).length,
    'the main floor painted nothing, so the pad count proves nothing')
    .toBeGreaterThan(0);
});

test('each plan draws the openings in the floor above it', async ({ page }) => {
  await page.addInitScript(SPY);
  await seed(page);
  await page.goto('/MODEL.html?left=1&right=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await order(page, 'bungalow', 'twoStorey');
  await saveNow(page);
  const saved = await savedFile(page);

  const openingsOn = level => (saved.surfaceOpenings || [])
    .filter(o => Number(o.levelId) === level && o.hostType === 'floor').length;
  expect(openingsOn(MAIN_FL) + openingsOn(SECOND_FL),
    'the build cut no openings, so there is nothing overhead to draw')
    .toBeGreaterThan(0);

  // FOUNDATION carries the lowest storey, so it shows MAIN FL's holes.
  const onFoundation = await paintedOn(page, FOUNDATION, 'foundation');
  expect(times(onFoundation, 'drawOpeningAbove2D'),
    'the foundation did not show the hole in the floor it carries')
    .toBe(openingsOn(MAIN_FL));

  // MAIN FL carries the second storey, so it shows THAT floor's holes -- not
  // its own. Its own opening belongs to the level below's drawing.
  const onMain = await paintedOn(page, MAIN_FL, 'plan');
  expect(times(onMain, 'drawOpeningAbove2D'),
    'the main floor drew the wrong storey’s openings')
    .toBe(openingsOn(SECOND_FL));
});

test('the top storey has nothing overhead to draw', async ({ page }) => {
  // The top storey carries a ROOF, and floorCarriedBy hands back null for it --
  // the same lookup, and the same reason, as the beam rule's roof exclusion.
  await page.addInitScript(SPY);
  await seed(page);
  await page.goto('/MODEL.html?left=1&right=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await order(page, 'bungalow', 'twoStorey');
  await saveNow(page);

  const onSecond = await paintedOn(page, SECOND_FL, 'plan');
  expect(times(onSecond, 'drawOpeningAbove2D'),
    'the top storey drew an opening for a floor that is not there').toBe(0);
  expect(Object.keys(onSecond).length,
    'the second floor painted nothing, so the zero above proves nothing')
    .toBeGreaterThan(0);
});

test('every pile is drawn at its own diameter, not one size for all',
  async ({ page }) => {
    // The page had no footing table, so it passed `sizeIn: 6` for every pile
    // and handed the label the raw id: a 12" pile and an 8" pile were the same
    // circle marked "pile12". This reads the table the page now resolves from.
    await seed(page);
    await page.goto('/MODEL.html?left=1&right=1');
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
    const sizes = await page.evaluate(() => {
      const B = window.DraftBuildHouse;
      return ['pile8', 'pile10', 'pile12', 'pad36', 'pad42']
        .map(id => [id, B.footingFor(id).sizeIn, B.footingFor(id).label]);
    });
    expect(sizes).toEqual([
      ['pile8', 8, '8"ø PILE'],
      ['pile10', 10, '10"ø PILE'],
      ['pile12', 12, '12"ø PILE'],
      ['pad36', 36, 'TYP 36×36 PAD'],
      ['pad42', 42, 'MED 42×42 PAD'],
    ]);
  });
