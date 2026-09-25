// AUTO BEAM + COLUMNS ON THE LIVE PAGE — the structure a built house needs
// under it, and the button that places it into one already drawn.
//
// Movie, 25 Sep: "ther AUTOBEAM placement was removed a house over 19 ft wide
// needs a beam and columns in the basement / foundation" ... "the DC version
// had it".
//
// IT WAS NEVER WIRED, RATHER THAN REMOVED. build-house.js:88 `midSpanBeams`
// came across whole and is exported; MODEL.dc.html calls it twice (:4356 and
// :4828) and MODEL.html called it nowhere, so the live page painted beams and
// columns it had no gesture to create.
//
// AND THIS FILE EXISTS BECAUSE THE SUITE SAID NOTHING ABOUT THAT. There are
// nine green auto-beam tests in tests/beam-corner.spec.js, and every one of
// them drives /MODEL.dc.html through helpers.openModel (tests/helpers.js:154)
// -- the page the app cannot reach. Coverage of a module through a dead caller
// is coverage of the module, and it reads on the dashboard exactly like
// coverage of the app.
//
// SO THIS DOES NOT CHECK THE SPAN ARITHMETIC. That is midSpanBeams' and the
// offline harness pins it. What is checked here is everything between the
// module and the file: which level and view the records are filed on, that
// they survive the reload, that the button and the bone press are two ways
// into one worker, that re-running replaces its own and spares a drafter's,
// and that one Ctrl+Z takes the lot.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';

// THE WHOLE LEVEL STACK, for the reason model-html-auto-dims.spec.js gives:
// drawing-format.js drops any record whose levelId the drawing does not list,
// so a fixture missing FOUNDATION would write beams the next open loses and
// every count below would measure the page's memory rather than the file.
const empty = (extra = {}) => ({
  version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 },
    { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 },
    { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 },
  ],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
  ...extra,
});

// A RECTANGLE ON MAIN FL, which is the footprint AUTO BEAM reads. `deep` is
// the short span the 19 ft rule is measured against.
const rect = ({ id = 'outline-x', wide = 40, deep = 32, garage = false } = {}) => ({
  id, levelId: 3, garage,
  points: [
    { x: -wide / 2, y: 0, z: -deep / 2 },
    { x: wide / 2, y: 0, z: -deep / 2 },
    { x: wide / 2, y: 0, z: deep / 2 },
    { x: -wide / 2, y: 0, z: deep / 2 },
  ],
});

async function open(page, file = empty()) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  // ?left=1 FOR THE TOOL COLUMN AND ?right=1 FOR THE PROPERTIES SLOT: both
  // ship collapsed, and the key is the only way to arm a tool with no legacy
  // button. Same door model-html-auto-dims.spec.js opens, for its reason.
  await page.goto('/MODEL.html?left=1&right=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

async function order(page, family, entry) {
  await h.openDriveThru(page);
  await page.locator(`[data-build-family="${family}"]`).click();
  await page.locator(`[data-build-entry="${entry}"]`).click();
  await page.locator('#dt-bone').click();
  await page.waitForTimeout(400);
}

async function saveNow(page) {
  await expect(page.locator('#save')).toBeEnabled({ timeout: 4000 });
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
}

const savedFile = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return file ? JSON.parse(await file.text()) : null;
}, BUCKET);

// ARMING THE TOOL IS HOW THE PANEL COMES UP, which is the whole point of
// Movie's placement: "the AUTOBEAM/COLUMN should be available in the build/
// BEAM & COLUMN buttons".
//
// THE BOARD IS SWITCHED FIRST, and the first draft of this file did not do
// that: TOY offers three tools -- select, wall, outline -- so the BEAM key is
// DISABLED there, and the click on it waited out the whole test timeout
// looking exactly like a page that had hung. BEAM is a build tool and build
// tools are on DRAFTING (tool-roster.js:51). armDimension in
// model-html-auto-dims.spec.js switches for the same reason.
// IDEMPOTENT, unlike the press. Pressing the ARMED key returns to SELECT --
// the register's rule, which helpers.armWall carries a note about -- so a
// helper that always clicked would DISARM the tool for any caller that was
// already holding it, and the panel would vanish. That is not a failure: the
// next `click()` waits for a locator that is not there and the test times out
// with "waiting for [data-auto-beam]" and nothing about why.
async function armTool(page, id) {
  await page.locator('[data-board-switch] [data-board="drafting"]').click();
  await page.waitForTimeout(150);
  const key = page.locator(`[data-tool-key="${id}"]`);
  if (await key.getAttribute('aria-pressed') !== 'true') {
    await key.click();
    await page.waitForTimeout(150);
  }
}
const armBeamTool = page => armTool(page, 'beam');

const autoBeamButton = page => page.locator('[data-auto-beam]');

test('a built house arrives with its mid-span beam and teleposts on FOUNDATION',
  async ({ page }) => {
    await open(page);
    await order(page, 'bungalow', 'bungalow-garage');
    await saveNow(page);
    const saved = await savedFile(page);

    const beams = (saved.beams || []).filter(beam => beam.auto === true);
    // A TELEPOST IS AN AUTO COLUMN THAT IS NOT A PILE, and this read `auto`
    // alone until AUTO PILES landed. The garage's piles carry `auto: true` on
    // the same level and the same view, so the old filter swept eleven of
    // them in and then asserted each one stood on a beam end -- which none of
    // them does. The FOOTING is the discriminator, exactly as it is in
    // placeAutoBeam's sweep and pressAutoPiles': same question, same answer.
    const isPile = column => String(column.footing || '').startsWith('pile');
    const columns = (saved.columns || [])
      .filter(column => column.auto === true && !isPile(column));
    expect(beams.length, 'the bone built a house and left it with no beam under it')
      .toBeGreaterThan(0);
    expect(columns.length, 'a beam arrived with nothing holding it up')
      .toBeGreaterThan(0);

    // THE FOUNDATION DRAWING, NOT THE LEVEL THE DRAFTER WAS STANDING ON.
    // S-BEAM and S-COL-FOOTING are in the FOUNDATION view's layer list and in
    // no other view of that level (layer-views.js:32), so a record filed on
    // 'plan' would be in the file and on no sheet.
    beams.concat(columns).forEach(record => {
      expect(record.levelId, 'structure filed off the foundation').toBe(1);
      expect(record.view, 'structure filed on a view that does not draw it')
        .toBe('foundation');
    });

    // NO POST WHERE THE BEAM BEARS. The runs are clipped to the outline and
    // the foundation wall traces it, so both ends stand on concrete -- the
    // posts are the interior divisions and nothing else.
    const ends = new Set(beams.flatMap(beam =>
      [beam.start, beam.end].map(pt => `${pt.x},${pt.z}`)));
    const extremes = [Math.min, Math.max].map(pick =>
      pick(...beams.flatMap(beam => [beam.start.z, beam.end.z])));
    columns.forEach(column => {
      expect(extremes.includes(column.point.z),
        'a telepost was put on an end that bears on the foundation wall').toBe(false);
      expect(ends.has(`${column.point.x},${column.point.z}`),
        'a telepost landed off every beam end').toBe(true);
    });
  });

test('every record survives the reload', async ({ page }) => {
  // THE PAGE HAS NO SERIALIZER BETWEEN THE PUSH AND THE FILE, so what it
  // wrote and what a reload keeps must be the same object. drawing-format.js
  // refuses a beam whose id is not an integer, whose view is not one of three,
  // or whose length is under 0.001 -- and a refusal is silent.
  await open(page);
  await order(page, 'bungalow', 'bungalow-garage');
  await saveNow(page);

  const kept = await page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const raw = JSON.parse(await file.text());
    const F = window.DraftDrawingFormat;
    const levelIds = new Set((raw.levels || []).map(level => Number(level.id)));
    const beams = F.beams(raw.beams, levelIds, {});
    const columns = F.columns(raw.columns, levelIds, {});
    return {
      wroteBeams: (raw.beams || []).length, keptBeams: beams.length,
      wroteColumns: (raw.columns || []).length, keptColumns: columns.length,
      autoBeams: beams.filter(beam => beam.auto === true).length,
      autoColumns: columns.filter(column => column.auto === true).length,
    };
  }, BUCKET);

  expect(kept.keptBeams, 'beams were written that the reload loses').toBe(kept.wroteBeams);
  expect(kept.keptColumns, 'columns were written that the reload loses').toBe(kept.wroteColumns);
  expect(kept.autoBeams, 'a beam came back unmarked, so a re-run would not sweep it')
    .toBe(kept.wroteBeams);
  expect(kept.autoColumns, 'a column came back unmarked').toBe(kept.wroteColumns);
});

test('the BEAM tool raises the panel, and its button is the second way in',
  async ({ page }) => {
    // A HOUSE NOBODY PRESSED THE BONE FOR: an outline in the file and no
    // structure under it, which is the drawing a drafter who traced his own
    // footprint is looking at.
    await open(page, empty({ outlines: [rect({ wide: 40, deep: 32 })] }));

    await armBeamTool(page);
    await expect(autoBeamButton(page), 'arming BEAM showed no properties for BEAM')
      .toBeVisible();
    await expect(autoBeamButton(page)).toBeEnabled();

    await autoBeamButton(page).click();
    await saveNow(page);
    const saved = await savedFile(page);
    expect((saved.beams || []).length, 'the button placed no beam').toBeGreaterThan(0);
    expect((saved.columns || []).length, 'the button placed no post').toBeGreaterThan(0);

    // AND COLUMN RAISES THE SAME PANEL, because AUTO BEAM places both and a
    // drafter reaching for either is reaching for one button.
    await armTool(page, 'column');
    await expect(autoBeamButton(page)).toBeVisible();
  });

test('a span under 19 ft gets no beam, and the page says so rather than going quiet',
  async ({ page }) => {
    // THE RULE'S OWN ANSWER, not a failure: joists span the short way, and a
    // house narrow enough to span it needs nothing in the middle. The button
    // stays ENABLED for this -- greying it would read as broken on a bungalow.
    await open(page, empty({ outlines: [rect({ wide: 40, deep: 18 })] }));
    await armBeamTool(page);
    await expect(autoBeamButton(page)).toBeEnabled();
    await autoBeamButton(page).click();

    // THE STRIP IS WHERE THIS PAGE SAYS THINGS -- `#strip-message`, which
    // sayOnStrip writes (MODEL.html:11233). Asserted on that element by name
    // rather than on the body: a body-wide match would pass on the button's
    // own title attribute and prove nothing about the message.
    await expect(page.locator('[data-strip-message]'), 'the page went quiet about it')
      .toHaveText(/no mid-span beam needed/i, { timeout: 4000 });

    await saveNow(page);
    const saved = await savedFile(page);
    expect((saved.beams || []).length, 'a house under 19 ft got a beam anyway').toBe(0);
  });

test('re-running replaces its own structure and leaves a drafter’s alone',
  async ({ page }) => {
    // `auto: true` IS THE WHOLE DISCRIMINATOR, the same rule AUTO DIMS takes.
    // Movie: "we should just autoplace the beam once into the 'premade homes'
    // and if i need to change them i will" -- so what he changed must survive
    // the next press.
    await open(page, empty({
      outlines: [rect({ wide: 40, deep: 32 })],
      beams: [{ id: 900, start: { x: -8, y: 0, z: 4 }, end: { x: 8, y: 0, z: 4 },
        levelId: 1, view: 'foundation', mode: 'dropped' }],
      columns: [{ id: 900, point: { x: -8, y: 0, z: 4 }, levelId: 1,
        view: 'foundation', footing: 'pad42' }],
    }));

    await armBeamTool(page);
    await autoBeamButton(page).click();
    await autoBeamButton(page).click();
    await autoBeamButton(page).click();
    await saveNow(page);
    const saved = await savedFile(page);

    const mine = (saved.beams || []).filter(beam => beam.auto === true);
    const his = (saved.beams || []).filter(beam => beam.auto !== true);
    expect(his.length, 'a hand-placed beam was swept by a re-run').toBe(1);
    expect(his[0].id, 'the drafter’s beam came back as a different record').toBe(900);
    expect(his[0].mode, 'the drafter’s beam lost what he set on it').toBe('dropped');
    expect((saved.columns || []).filter(column => column.auto !== true).length,
      'a hand-placed column was swept').toBe(1);

    // THREE PRESSES, ONE SET OF BEAMS. Without the sweep this is three.
    const ids = mine.map(beam => beam.id);
    expect(new Set(ids).size, 'a re-run duplicated its own ids').toBe(ids.length);
    const oneRun = await page.evaluate(() => window.DraftBuildHouse.midSpanBeams(
      [{ x: -20, z: -16 }, { x: 20, z: -16 }, { x: 20, z: 16 }, { x: -20, z: 16 }]).beams.length);
    expect(mine.length, 'three presses left three runs of beams stacked on each other')
      .toBe(oneRun);
  });

test('one Ctrl+Z takes the beam back, and the bone press takes it with the house',
  async ({ page }) => {
    await open(page, empty({ outlines: [rect({ wide: 40, deep: 32 })] }));
    await armBeamTool(page);
    await autoBeamButton(page).click();
    await saveNow(page);
    expect(((await savedFile(page)).beams || []).length).toBeGreaterThan(0);

    // THE PRESS IS ONE STEP. It writes beams AND columns into two different
    // lists, so an undo that knew about only one would leave posts under a
    // beam that is gone.
    // NO CANVAS CLICK TO TAKE FOCUS. BEAM is armed, and a press on the plan
    // is the gesture that STARTS a hand-drawn beam -- so the click meant to
    // focus the page would leave a half-drawn one behind and the counts below
    // would be measuring that instead.
    await page.keyboard.press('Control+z');
    await saveNow(page);
    const after = await savedFile(page);
    expect((after.beams || []).length, 'Ctrl+Z left the beams standing').toBe(0);
    expect((after.columns || []).length, 'Ctrl+Z took the beams and left the posts').toBe(0);
  });

test('the garage is not the house footprint', async ({ page }) => {
  // A LOOP TAKEN ACROSS BOTH BODIES WOULD RUN A BEAM THROUGH THE GARAGE.
  // MODEL.dc.html picks the house the same way (`!outline.garage`, :4804), and
  // the attached garage outline carries that flag (drawing-format.js:998).
  //
  // THE GARAGE HERE IS THE WIDER OF THE TWO, so a rule that took the last
  // outline without asking, or took the biggest, lands on it and this fails.
  await open(page, empty({
    outlines: [
      rect({ id: 'outline-house', wide: 40, deep: 32 }),
      rect({ id: 'outline-garage', wide: 60, deep: 60, garage: true }),
    ],
  }));
  await armBeamTool(page);
  await autoBeamButton(page).click();
  await saveNow(page);
  const saved = await savedFile(page);

  // MEASURED ON BOTH AXES, AND THE FIRST VERSION WAS NOT. It read the z
  // coordinates alone and the mutation gate walked straight past it: a 60 x 60
  // garage is as wide as it is deep, so `w >= d` puts ITS long axis along x
  // too and ITS cut line also lands at z = 0. Every z read 0 either way and
  // the check passed while the beam ran the full 60 ft of the garage. The
  // wrongness was entirely in x -- -30..30 where the house is -20..20 -- so
  // the assertion was reading the quantity NEXT TO the one it meant.
  //
  // 40 x 32 puts the house's long axis along x as well, so the answer is
  // exact: the cut is the centre line z = 0 and the run is clipped to the
  // house at x = -20 .. 20. Pinned rather than bounded, because a bound is
  // what let the last one through.
  const ends = (saved.beams || []).flatMap(beam => [beam.start, beam.end]);
  expect(ends.length, 'no beam was placed at all').toBeGreaterThan(0);
  expect([...new Set(ends.map(pt => pt.z))],
    'the beam is not on the house centre line').toEqual([0]);
  expect(Math.min(...ends.map(pt => pt.x)),
    'the beam ran out past the house and into the garage').toBe(-20);
  expect(Math.max(...ends.map(pt => pt.x)),
    'the beam ran out past the house and into the garage').toBe(20);

  // AND THE POSTS WITH IT. A run clipped to the garage divides into garage-
  // sized spans, so its teleposts stand outside the house even where the
  // beam's own ends happen to look right.
  (saved.columns || []).forEach(column => {
    expect(Math.abs(column.point.x) <= 20 && Math.abs(column.point.z) <= 16,
      'a telepost was planted outside the house').toBe(true);
  });
});

test('a stair opening in the floor above pushes the beam off it', async ({ page }) => {
  // THE BEAM SERVES THE FLOOR ABOVE, so a hole in THAT floor is what it has to
  // miss. MODEL.dc.html:4806 reads the stairs on MAIN while filing the beam on
  // the FOUNDATION for the same reason, and getting the level wrong here is
  // invisible: the beam still lands somewhere plausible, just through the
  // opening.
  //
  // MEASURED, NOT ASSUMED. 40 x 32 puts the long axis along x, so the strips
  // run in z from -16 to 16 and the unobstructed cut is dead centre at z = 0.
  // A 3'-6" stair at z = -10 takes out -11.75 .. -8.25, which leaves 4.25 ft
  // below it and 24.25 ft above; midSpanBeams lands mid-span of the LARGER
  // strip, at z = 3.875.
  const stair = {
    id: 1, levelId: 3, view: 'plan',
    start: { x: -5, y: 0, z: -10 }, end: { x: 5, y: 0, z: -10 },
    widthFt: 3.5, riseFt: 9, risers: 15, treadRunIn: 10,
    rail: 'left', shape: 'straight', turn: 'right',
  };

  await open(page, empty({ outlines: [rect({ wide: 40, deep: 32 })] }));
  await armBeamTool(page);
  await autoBeamButton(page).click();
  await saveNow(page);
  const clear = await savedFile(page);
  const clearAt = [...new Set((clear.beams || []).flatMap(b => [b.start.z, b.end.z]))];
  expect(clearAt, 'the unobstructed beam did not land on the centre line').toEqual([0]);

  await open(page, empty({ outlines: [rect({ wide: 40, deep: 32 })], stairs: [stair] }));
  // THE FIXTURE HAS TO SURVIVE THE LOADER, or this measures a drawing with no
  // stair in it and passes by agreeing with the case above. drawing-format.js
  // drops a stair with no riseFt, and a dropped one is silent.
  expect(await page.evaluate(() => (window.DraftDrawingFormat
    .stairs([{ id: 1, levelId: 3, view: 'plan', start: { x: -5, z: -10 },
      end: { x: 5, z: -10 }, widthFt: 3.5, riseFt: 9 }], new Set([3]))).length),
  'the fixture stair is one the loader throws away').toBe(1);

  await armBeamTool(page);
  await autoBeamButton(page).click();
  await saveNow(page);
  const held = await savedFile(page);
  const heldAt = [...new Set((held.beams || []).flatMap(b => [b.start.z, b.end.z]))];
  expect(heldAt.length, 'the stair left the beam with no run at all').toBeGreaterThan(0);
  heldAt.forEach(z => {
    expect(z > -11.75 && z < -8.25, 'the beam ran through the stair opening')
      .toBe(false);
  });
  expect(heldAt, 'the stair did not move the beam at all').toEqual([3.875]);
});

// ── THE FLOOR ABOVE IS WHAT A LEVEL CARRIES ───────────────────────────────
//
// Movie, 25 Sep: "i don't think we discussed the columns and beams that will
// be needed on the main floor if there is a 2nd floor. usually a roof won't
// need columns or beams (usually the exterior walls do the complete job)".
//
// Both halves of that are ONE rule, which is why neither is a special case: a
// level earns its beam from the FLOOR it carries, and the top storey carries
// a roof. floorCarriedBy is the only thing that decides, and it hands back
// null up there.

test('a house with a second floor gets a beam under it, not just under the first',
  async ({ page }) => {
    await open(page, empty({
      outlines: [
        { ...rect({ wide: 40, deep: 32 }), id: 'outline-main' },
        { ...rect({ wide: 40, deep: 32 }), id: 'outline-upper', levelId: 5 },
      ],
    }));
    await armBeamTool(page);
    await autoBeamButton(page).click();          // standing on MAIN FL: FOUNDATION's beam
    await h.pickModelLevel(page, 5);             // climb, and ask for the one under 2ND FL
    await armBeamTool(page);
    await autoBeamButton(page).click();
    await saveNow(page);
    const saved = await savedFile(page);

    const on = (levelId, view) => (saved.beams || [])
      .filter(beam => beam.levelId === levelId && beam.view === view);
    expect(on(1, 'foundation').length, 'the foundation lost its beam').toBeGreaterThan(0);
    expect(on(3, 'floor').length,
      'a 2nd floor is standing on a forty-foot span with nothing under it')
      .toBeGreaterThan(0);

    // AND THE MAIN FLOOR'S POSTS STAND ON THE FOUNDATION'S. This is the whole
    // of Movie's rule -- "it need to be over another column" -- and it is
    // asserted on POSITION rather than on a flag, because no flag is stored:
    // drawing-format.js's column validator has no `unsupported` field, so a
    // check reading one would pass on a frame where nothing stacked at all.
    const posts = (levelId, view) => (saved.columns || [])
      .filter(column => column.levelId === levelId && column.view === view
        && !String(column.footing || '').startsWith('pile'))
      .map(column => Number(column.point.x.toFixed(4)))
      .sort((a, b) => a - b);
    expect(posts(3, 'floor').length, 'the main floor beam has nothing holding it')
      .toBeGreaterThan(0);
    expect(posts(3, 'floor'), 'the main floor posts do not stand on the foundation posts')
      .toEqual(posts(1, 'foundation'));
  });

test('two bodies on one floor are two floors, and each is asked on its own span',
  async ({ page }) => {
    // THE BUG THIS IS FOR WAS REAL AND WAS FOUND BY MEASURING, not by review:
    // a 2 STOREY WITH ROOM OVER GARAGE puts TWO loops on 2ND FL -- the house
    // at 32 x 40 and the room over the garage at 24 x 19 -- and "last one
    // wins" measured the room, whose short span is exactly 19 and so needs
    // nothing, while the house's forty feet were never asked about. The main
    // floor came back with no beam at all and nothing said so.
    //
    // The mutation gate found that this file could not catch it: every other
    // fixture here puts ONE loop on the carried floor, so `.slice(-1)` is a
    // no-op against them. The small body is LAST on purpose.
    await open(page, empty({
      outlines: [
        { ...rect({ wide: 40, deep: 32 }), id: 'outline-main' },
        { ...rect({ wide: 40, deep: 32 }), id: 'outline-upper', levelId: 5 },
        // 24 x 19 -- a room over a garage. 19 is NOT over 19, so on its own
        // it needs nothing, and a rule that stopped at it would report
        // "no beam needed" for the whole floor.
        { id: 'outline-over', levelId: 5,
          points: [{ x: 24, y: 0, z: -9.5 }, { x: 48, y: 0, z: -9.5 },
            { x: 48, y: 0, z: 9.5 }, { x: 24, y: 0, z: 9.5 }] },
      ],
    }));
    await h.pickModelLevel(page, 5);
    await armBeamTool(page);
    await autoBeamButton(page).click();
    await saveNow(page);
    const saved = await savedFile(page);

    const onMain = (saved.beams || []).filter(beam => beam.levelId === 3);
    expect(onMain.length, 'the house was skipped because a smaller body came last')
      .toBeGreaterThan(0);
    // THE HOUSE'S OWN SPAN, not the room's: the beam runs the 40 ft body,
    // between x = -20 and 20, and nothing of it is out over the room.
    const xs = onMain.flatMap(beam => [beam.start.x, beam.end.x]);
    expect(Math.min(...xs), 'the beam is not on the house').toBeCloseTo(-20, 4);
    expect(Math.max(...xs), 'the beam ran out past the house').toBeCloseTo(20, 4);
    // AND THE ROOM GOT NONE, for the right reason -- 19 is not over 19.
    expect(xs.some(x => x > 20.001), 'the 19 ft room was given a beam it does not need')
      .toBe(false);
  });

test('the posts land on the columns below, not on the even divisions',
  async ({ page }) => {
    // THE TEST ABOVE CANNOT TELL THE RULE FROM LUCK, and this one is here to
    // say so. A 40 ft run divides evenly into four 10s with posts at -10, 0,
    // 10 -- and on the premades the foundation's posts are at -10, 0, 10 too,
    // because both floors are the same rectangle. Comparing them proves the
    // two AGREE, not that the upper one was placed BY the lower. Code with
    // supportsBelow deleted passes it.
    //
    // So the floor below is held at -9, 3 and 15: hand-placed columns, off
    // every even division. supportsUnder does not filter on `auto`, so a
    // drafter's own column is support like any other -- which is Movie's rule
    // read literally, "it need to be over another column".
    //
    // GREEDY-FURTHEST WALKS THEM EXACTLY. From -20 the limit is -8 and the
    // furthest support in reach is -9; from -9 the limit is 3 and 3 is
    // reachable; from 3 the limit is 15 and 15 is reachable; from 15 the
    // remaining 5 ft is under the limit. Even division would answer -10, 0,
    // 10 and every one of those numbers is wrong here.
    await open(page, empty({
      outlines: [
        { ...rect({ wide: 40, deep: 32 }), id: 'outline-main' },
        { ...rect({ wide: 40, deep: 32 }), id: 'outline-upper', levelId: 5 },
      ],
      columns: [-9, 3, 15].map((x, index) => ({
        id: 900 + index, point: { x, y: 0, z: 0 },
        levelId: 1, view: 'foundation', footing: 'pad36',
      })),
    }));
    await h.pickModelLevel(page, 5);
    await armBeamTool(page);
    await autoBeamButton(page).click();
    await saveNow(page);
    const saved = await savedFile(page);

    const posts = (saved.columns || [])
      .filter(column => column.levelId === 3 && column.view === 'floor')
      .map(column => Number(column.point.x.toFixed(4)))
      .sort((a, b) => a - b);
    expect(posts, 'the main floor posts divided evenly instead of standing on '
      + 'the columns below').toEqual([-9, 3, 15]);

    // AND THE BEAM IS CUT WHERE THEY STAND. "a beam is one span between two
    // supports", so an even four-span beam over posts at -9, 3, 15 would be
    // four members whose ends miss every post.
    const ends = (saved.beams || [])
      .filter(beam => beam.levelId === 3)
      .flatMap(beam => [beam.start.x, beam.end.x])
      .map(x => Number(x.toFixed(4)));
    expect([...new Set(ends)].sort((a, b) => a - b),
      'the beam was divided somewhere other than where its posts are')
      .toEqual([-20, -9, 3, 15, 20]);

    // AND NONE OF THEM IS HANGING, because all three were in reach.
    await expect(page.locator('[data-strip-message]'))
      .not.toHaveText(/nothing under it/i);
  });

test('the top storey carries a roof, so it gets nothing', async ({ page }) => {
  // "usually a roof won't need columns or beams (usually the exterior walls
  // do the complete job)". Nothing in the code says `if roof`; floorCarriedBy
  // returns null for the top storey because there is no floor above it, and
  // the press says so rather than going quiet.
  await open(page, empty({
    outlines: [
      { ...rect({ wide: 40, deep: 32 }), id: 'outline-main' },
      { ...rect({ wide: 40, deep: 32 }), id: 'outline-upper', levelId: 5 },
    ],
  }));
  await h.pickModelLevel(page, 5);
  await armBeamTool(page);
  await h.pickModelLevel(page, 7);   // ROOF
  await armBeamTool(page);
  await expect(autoBeamButton(page),
    'the roof was offered a beam it does not need').toBeDisabled();
});

test('a post with nothing under it says so rather than standing quietly',
  async ({ page }) => {
    // The floor below is held only at its own perimeter -- no columns, no
    // interior wall -- so the storey above has nowhere legal to land a post
    // and the beam still has to be carried. midSpanBeams tags those; the page
    // cannot STORE the tag (no such field in the format) so it says it.
    //
    // 2ND FL is offset from MAIN FL so its beam sits over open floor rather
    // than over the foundation posts, which is the case that separates "these
    // stack" from "these happen to coincide".
    await open(page, empty({
      outlines: [
        { ...rect({ wide: 40, deep: 32 }), id: 'outline-main' },
        { id: 'outline-upper', levelId: 5,
          points: [{ x: -20, y: 0, z: 20 }, { x: 20, y: 0, z: 20 },
            { x: 20, y: 0, z: 52 }, { x: -20, y: 0, z: 52 }] },
      ],
    }));
    await armBeamTool(page);
    await autoBeamButton(page).click();      // FOUNDATION, from MAIN FL
    await h.pickModelLevel(page, 5);
    await armBeamTool(page);
    await autoBeamButton(page).click();      // MAIN FL, framing the offset 2ND FL
    await expect(page.locator('[data-strip-message]'),
      'a post standing on nothing was placed without a word')
      .toHaveText(/nothing under it/i, { timeout: 4000 });
  });

test('no FOUNDATION level means the button is greyed, not a record filed nowhere',
  async ({ page }) => {
    // drawing-format.js validates every levelId against the drawing's own list
    // and DROPS what it does not recognise -- so a beam written against a
    // FOUNDATION this drawing has not got would paint once and be gone on the
    // next load. That is the silent loss the page refuses everywhere else.
    const noFoundation = empty({ outlines: [rect({ wide: 40, deep: 32 })] });
    noFoundation.levels = noFoundation.levels.filter(level => level.id !== 1);
    await open(page, noFoundation);
    await armBeamTool(page);
    await expect(autoBeamButton(page), 'the panel did not come up at all').toBeVisible();
    await expect(autoBeamButton(page),
      'the button offered to file a beam against a level the drawing has not got')
      .toBeDisabled();
  });
