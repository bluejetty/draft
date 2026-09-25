// MODEL.html TIER 1 — can a page with no framework read the real drawing and
// paint it with the real painters?
//
// This is a MEASUREMENT, not a feature. The 6-10 week migration estimate has
// two halves: the module half, which has numbers behind it (all seventeen load
// under plain node), and the page half, which had none at all. Fifteen
// thousand stateful lines nobody had tried to move. This spec is the first
// evidence for that half, and it is deliberately the smallest honest question:
// walls on screen, from a drawing the OLD page saved, through the SAME
// painters, with React and the DC runtime absent.
//
// These tests read and never write. MODEL.html grew a save path in the Write
// Tier (tests/write-tier.spec.js owns that proof); nothing in THIS file
// presses it, so a tier-1 failure still cannot cost anyone a drawing.
//
// The old page stays authoritative throughout: index.html still points at
// MODEL.dc.html and nothing here changes that. When these tests grow to cover
// what a drafter actually does, the swap is two hrefs.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const readout = page => page.locator('#readout');

// What SHOULD be on screen, worked out here rather than by calling the module
// the page calls. If this asked layer-views.js the same question MODEL.html
// asks it, a wrong answer would agree with itself and pass. So the rule is
// written out: MAIN FL is level id 3, its default layer view is the walls
// plan, and an item with no `view` is a plan item.
const MAIN_FL = 3;
const onMainPlan = item => Number(item.levelId) === MAIN_FL
  && (item.view || 'plan') === 'plan';

const notice = page => page.locator('#notice');

// TWO different measurements, and conflating them cost this spec its first
// green: `paintGrid` draws too, so "is there ink on the canvas" answers yes on
// a page that read the file and painted no walls at all. Proven by mutation --
// with `paintWalls()` deleted, the original assertion still passed.
//
// So walls are counted by COLOUR. drawWallSeg2D fills #ffffff, rgb(182,182,182)
// and rgb(205,228,248); the grid, plan lines and floor wash are all far darker
// than that on the night skin. Nothing but a wall puts a red channel above 170.
//
// THIS COUNT IS TRUE OF THE NIGHT SKIN ONLY, and that is now a real condition
// rather than the only possibility. palette.js gives MODEL.html four skins
// (RD-DOCUMENTS/SPEC-skins.md); on `?mode=day` the ground is #f2f2f3 and EVERY
// pixel clears 170, so this helper would report a full canvas of walls on a
// page that painted none. It therefore asserts the skin it depends on instead
// of assuming it -- the same mistake, one file over, put 1/16" in a LAYOUT
// comment for four days after it stopped being true.
async function wallInk(page) {
  const mode = await page.evaluate(() => document.documentElement.dataset.mode);
  expect(mode, 'wallInk looks for the night skin\'s wall edge specifically, and '
    + 'the tolerance below was checked against that skin\'s other inks')
    .toBe('night');
  // ASKED OF THE PALETTE, not of a literal -- the same move anyInk makes just
  // below, and for a reason this function learned the hard way.
  //
  // It used to count pixels with red >= 170, which isolated walls only because
  // drawWallSeg2D hardcoded '#ffffff'. When walls were given draw-wall /
  // draw-wall-edge, night's edge became #a7aeb1 -- red 167 -- and this
  // returned ZERO. Three counts under a threshold tuned to a colour that no
  // longer existed. A number calibrated against a constant somewhere else is
  // only ever right until that constant moves.
  //
  // Reading --draw-wall-edge means the skin can be redesigned without touching
  // this file, and it is also a check that the palette reached the document.
  // Night-only, and the window is safe there: the nearest other night ink is
  // draw-line #7f8688, more than 28 per channel away, so nothing else on the
  // canvas can land inside it.
  return page.evaluate(() => {
    const css = getComputedStyle(document.documentElement)
      .getPropertyValue('--draw-wall-edge').trim();
    const hex = css.replace('#', '');
    const want = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    if (want.some(Number.isNaN)) throw new Error(`wallInk: unreadable edge "${css}"`);
    const TOL = 12;
    const canvas = document.getElementById('plan');
    const { data } = canvas.getContext('2d')
      .getImageData(0, 0, canvas.width, canvas.height);
    let ink = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i] - want[0]) <= TOL
        && Math.abs(data[i + 1] - want[1]) <= TOL
        && Math.abs(data[i + 2] - want[2]) <= TOL) ink += 1;
    }
    return ink;
  });
}

// Any ink at all, for the empty state -- where the assertion is that the page
// drew NOTHING, and the grid counts against that just as much as a wall would.
//
// "Not the ground" is asked of the SKIN's ground rather than of a literal, so
// this one holds on all four. It reads --surface-page off the element
// palette.js wrote it to, which is also a check that the palette was applied.
async function anyInk(page) {
  return page.evaluate(() => {
    const css = getComputedStyle(document.documentElement)
      .getPropertyValue('--surface-page').trim();
    const hex = css.replace('#', '');
    const ground = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    if (ground.some(Number.isNaN)) throw new Error(`anyInk: unreadable ground "${css}"`);
    const canvas = document.getElementById('plan');
    const { data } = canvas.getContext('2d')
      .getImageData(0, 0, canvas.width, canvas.height);
    let ink = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i] - ground[0]) > 8 || Math.abs(data[i + 1] - ground[1]) > 8
        || Math.abs(data[i + 2] - ground[2]) > 8) ink += 1;
    }
    return ink;
  });
}

const scaleNow = page => page.evaluate(() => {
  const m = document.getElementById('readout').textContent.match(/scale ([\d.]+)/);
  return m ? Number(m[1]) : null;
});

// Build a house on the OLD page, exactly as a first-time user does, then hand
// the same origin to the new one. Same origin is the whole point: IndexedDB is
// per-origin, so this is the real handover and not a fixture.
async function houseOnOldPage(page) {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);
  expect(saved.walls.length).toBeGreaterThan(0);
  return saved;
}

test.describe('MODEL.html tier 1', () => {
  test('reads the drawing MODEL.dc.html saved, and paints the walls', async ({ page }) => {
    const saved = await houseOnOldPage(page);

    await page.goto('/MODEL.html');
    await expect(readout(page)).toContainText('walls', { timeout: 5000 });

    // Same walls. Not "some walls" -- the count the old page wrote.
    const onScreen = saved.walls.filter(onMainPlan).length;
    expect(onScreen, 'the fixture must put walls on MAIN FL, or this asserts nothing')
      .toBeGreaterThan(0);
    expect(onScreen, 'and it must NOT be every wall, or the filter is untested')
      .toBeLessThan(saved.walls.length);
    await expect(readout(page)).toContainText(`walls ${onScreen}/`);
    await expect(notice(page)).not.toHaveClass(/show/);

    // And the WALLS are actually on the canvas -- not merely the grid.
    expect(await wallInk(page)).toBeGreaterThan(400);
  });

  test('no framework is present: React and the DC runtime never load', async ({ page }) => {
    await houseOnOldPage(page);
    await page.goto('/MODEL.html');
    await expect(readout(page)).toContainText('walls', { timeout: 5000 });

    // The point of the exercise. If either of these is defined the page is not
    // measuring what it claims to measure.
    const frameworks = await page.evaluate(() => ({
      react: typeof window.React,
      reactDom: typeof window.ReactDOM,
      dc: document.querySelectorAll('x-dc, [data-dc-script]').length,
      scripts: Array.from(document.scripts)
        .map(s => s.getAttribute('src')).filter(Boolean),
    }));
    expect(frameworks.react).toBe('undefined');
    expect(frameworks.reactDom).toBe('undefined');
    expect(frameworks.dc).toBe(0);
    expect(frameworks.scripts).not.toContain('./support.js');

    // THIRTEEN dependencies, and the list is the finding rather than a formality:
    // render-2d.js reaches for no globals, so the wall painter still costs one
    // module. palette.js joined on 3 Sep and is the only one that is not a
    // painter -- it is loaded FIRST because the skin is applied at module
    // scope, before first paint (RD-DOCUMENTS/SPEC-skins.md).
    //
    // formatters.js and cut-view.js joined for tier 2c: drawFloor2D reads
    // env.formatInchesOnly and the two garage-slab standards, and those are
    // the modules that own them. Two scripts for a real painter, and they
    // are the honest cost of not restating a construction standard.
    //
    // ORDER IS ASSERTED, NOT INCIDENTAL. cut-view.js:28-29 destructures
    // window.DraftWallTypes and window.DraftFormatters at module scope, so it
    // throws while loading if either follows it, and a head that throws
    // paints nothing. This list is the only thing standing between that and a
    // tidy-looking alphabetical sort.
    //
    // fixture-geometry.js and closets.js joined for tier 2k, and they are the
    // most expensive pair on this list -- two modules for one painter, where
    // the walls cost one. Worth naming why rather than letting the number
    // creep: drawFixture2D is the only painter that does not know where its
    // subject IS. It asks the caller through fixtureGeometry, wallFrame and
    // wallCross, and those answers were methods on MODEL.dc.html's component
    // -- reachable from exactly one page, which is why this one drew no
    // fixtures through two tiers. fixture-geometry.js is those answers, one
    // copy, both boards. closets.js is the four closet dimensions and the door
    // table the same painter asks for, and it was already in the repo.
    //
    // Neither is a painter and neither is new code: this pair is the price of
    // NOT duplicating geometry, which is the cheaper bill.
    //
    // cut-marks.js and profile-manager.js joined for tier 2l, and the SECOND
    // one is the entry on this list worth arguing about: it is the first
    // dependency here that is not about drawing the drawing. Two of the four
    // inputs a cut mark needs are not in the saved file. `structureStandards`
    // -- whether the auto-elevation ring is on, and which bubble style -- is
    // the drafter's office standard, kept in localStorage by profile-manager.
    //
    // The cheaper option was office defaults, and it was rejected on what it
    // would look like: a drafter who had switched the ring off would open this
    // page and find four elevation marks round the house. A viewer that
    // disagrees with the drafter's own settings is worse than one dependency.
    //
    // level-assembly.js and stair-geometry.js joined for tier 2m, and the
    // PAIR is the argument, not either half. stair-geometry.js is the obvious
    // one: drawStairs2D asks its caller for layoutFor and partsFor and both
    // were component methods, so this page drew no stairs.
    //
    // level-assembly.js is here because the cheap alternative was WRONG rather
    // than merely worse. A stair's rise is the wall height below plus this
    // level's floor, and the table saying what a level is made of lived in
    // three copies (MODEL.dc.html, LAYOUT.html, proto/elevation-harness.js).
    // Without it this page would have fallen back on each stair's STORED rise
    // -- which the bone treats as a fallback and re-derives on every paint
    // without ever writing back. Edit a wall height, save, and the two boards
    // would draw the same drawing with different riser counts. A dependency
    // that stops the viewer disagreeing with the drafter is the same trade
    // profile-manager.js won above.
    //
    // build-menu.js joined for the top bar, and it is the cheapest entry on
    // this list: no code runs from it, it is the house types the build bar
    // offers, declared as data. It is here rather than inline because the
    // same list is MODEL.dc.html's, and a second copy is how the level lookup
    // came to have four homes. A dependency that DELETES a duplicate is the
    // one kind this list should grow by.
    //
    // Keep it exact rather than loosening it to a `toContain`. It caught the
    // palette being added the same hour it was added, and it caught these two
    // the same hour as well, which is what an exact list is for: the
    // migration's whole claim is that this page is cheap, and a dependency
    // that arrives without anyone noticing is how that stops being true.
    expect(frameworks.scripts).toEqual([
      // shell-bars.js leads the list, and its POSITION is the load-bearing
      // part rather than its presence. The bars are written where the calling
      // <script> stands, mid-parse, so the module has to be in hand before
      // the body reaches its first mount. Every other entry here can sit at
      // the foot of the page with the rest; this one cannot, and a well-meant
      // tidy-up that moved it down with its neighbours would be a TypeError
      // on a page that looks perfectly wired. proto/shared-shell-harness.js
      // checks the ordering directly -- and separately checks the tag is not
      // `defer`, because defer keeps it early in the TEXT while running it
      // after the parse, which reads as correct here and still throws.
      //
      // BY THIS LIST'S OWN RULE IT IS THE KIND OF ENTRY TO GROW BY: it
      // DELETES duplicates, and not two -- five. The top bar, the bottom bar,
      // the instruments, the readout and the file dialogs were about to be
      // copied onto PROJECT, Construction Layout, SPECS, and REAL ESTATE
      // PLANS and ESTIMATES when they exist. 380 lines left this page for it.
      //
      // ITS HONEST COST: it reaches for window.DraftPalette inside wireSkin,
      // which this page already loads on the next line, and it is the first
      // module here that WRITES DOM rather than exporting data or geometry.
      // That is a real change in what a dependency can do to this page, and
      // it is said out loud rather than left for someone to discover.
      './shell-bars.js',
      './palette.js', './layer-views.js', './geometry-2d.js',
      './shared-file-store.js', './wall-types.js', './formatters.js',
      './cut-view.js', './drawing-format.js', './render-2d.js',
      './fixture-geometry.js', './closets.js',
      // fixture-kinds.js joined with the FIXTURE tool, and by this list's own
      // rule it is the kind of entry it should grow by: it DELETES a
      // duplicate. The catalogue -- sixteen kinds with their sizes, notes and
      // the casework/run/preset flags -- was a literal inside MODEL.dc.html,
      // which was fine while that was the only page that could place one.
      // This page could DRAW a cabinet and not make one, so the array had to
      // become something two pages could read rather than something this page
      // restated.
      //
      // IT SITS AFTER closets.js BECAUSE IT READS IT. The closet's depth is
      // the clear inside plus its own 2x4 wall, both Movie's numbers, held in
      // closets.js -- so the catalogue names them rather than restating them,
      // and proto/fixture-kinds-harness.js fails if it ever stops doing that.
      './fixture-kinds.js',
      './cut-marks.js',
      // outline-master.js joined with the OUTLINE tool, and it is the kind of
      // entry the build-menu.js note calls the one this list should grow by:
      // it DELETES a duplicate rather than adding a capability. The shape of a
      // stored outline -- a master on a boneyard shelf, a copy per level, and
      // the two identifiers linking them -- was MODEL.dc.html's alone until
      // this page had to write it too, and the order for that rung was
      // explicit that a hand-rolled twin is how #401 lost a shard.
      //
      // It also holds the one fact this page would most easily have got wrong
      // on its own: storage spells a master point's id `id`, MODEL.dc.html
      // holds `pointId`, and this page writes straight to the file with no
      // serializer in between. The wrong spelling produces an outline that
      // renders perfectly and is linked to nothing.
      //
      // It was refused once already -- added here in the extraction PR before
      // anything on this page called it, and this list said no. It is loaded
      // now because the tool calls it.
      './outline-master.js',
      './build-menu.js',
      // building-bodies.js is DEVIN'S, carried in this branch with his
      // garage-sizing commits: what counts as "a house already stands" and "a
      // garage already stands", which PROJECT and the drive-thru tiles both
      // ask. Declared here rather than left to his own PR, because it is THIS
      // branch that loads it -- an undeclared dependency is undeclared no
      // matter whose commit brought it.
      './building-bodies.js',
      // build-house.js arrived with the BONE that builds the drafter's own
      // outline, and it is the DELETES-A-DUPLICATE kind this list should grow
      // by. Walking a loop into wall runs is a few lines and reading its
      // winding to decide which side the body sits on is a few more -- so a
      // page doing it by hand would look cheaper than this and would be
      // another home for a rule the old page already builds from.
      //
      // THE WINDING HALF EARNS THE REQUEST ON ITS OWN. A freehand loop is
      // wound whichever way the drafter walked it, and a build that read the
      // page's refLine SETTING instead would put the wall bodies outside the
      // house on every clockwise trace: a drawing that looks almost right,
      // which is this suite's worst class of defect. The spec walks the same
      // square both ways for exactly that reason -- walked forwards the
      // module's answer and the setting's agree, so only the reversed loop can
      // fail.
      //
      // It also carries the tour's mid-span beam and footing-ring
      // derivations, and NEITHER is called from here. That is not a reason to
      // refuse it: the cost of a script is the request, and the alternative to
      // paying it is a twin of the half that IS called.
      './build-house.js',
      // auto-dims.js is the exterior dimension strings, and it is the SECOND
      // kind of entry this list welcomes rather than the first: it was already
      // extracted pure out of the old page and had exactly one caller, so this
      // page calling it adds no computation anywhere -- it deletes the
      // alternative, which would have been a second stack of string arithmetic
      // written here. The two tuning numbers moved into it at the same time,
      // off the top of MODEL.dc.html, for the same reason.
      './auto-dims.js',
      // premade-plans.js is the drive-thru's catalogue: the bungalow's
      // dimensions and the reasoning behind each of them, with
      // proto/premade-plans-harness.js on the arithmetic. It is here for the
      // reason garage-site.js is -- a design is a domain rule, and a page that
      // carried the numbers itself would be the second home of one.
      // bone-wallet.js is the free-bone economy's arithmetic -- the seed, the
      // hourly drip, the cap and what a build costs. Movie, 19 Sep: "can you
      // bring the BONE number / TOKEN system over too ... bring it like it
      // was in model.dc". It is here for the reason auto-dims.js is: already
      // pure, already extracted, already the OLD page's only copy, with
      // proto/bone-wallet-harness.js on the arithmetic. Carrying the rules
      // here instead would have given one economy two sets of books.
      './bone-wallet.js',
      './premade-plans.js',
      // tour.js joined for the RISING REVEAL (board #283), and by this list's
      // own rule it is the kind of entry to grow by: it stops a rule having a
      // second home. What this page uses is revealClipY() with REVEAL_MS and
      // REVEAL_HOLD_MS beside it -- the eased clip the mask climbs on. Its own
      // comment is the argument: "one eased clip height, shared by the 2D mask
      // today and the 3D clip plane later (same choreography, same timing)".
      // Written again here, the elevation and the 3D view would each own a
      // curve, and the day the 3D lands they would disagree about the timing
      // of the same presentation.
      //
      // IT IS NOT QUITE FREE, and the honest note is that it is not the
      // dependency-less kind build-menu.js is. tour.js reaches for
      // window.DraftRoomGrow in its room-stamp naming -- guarded, so it
      // degrades rather than throws -- and this page loads no room-grow.js.
      // The reveal path touches none of that code; the cost is a module
      // carrying more than this page asks of it, which is cheaper than a
      // second copy of the choreography.
      './tour.js',
      // AND NOT FOR THE DEALER, which this page does not run. auto-windows.js
      // holds two things besides dealWindows: the rule that a window clears
      // the roof under it by 4" -- Movie, 21 Sep -- and the sampling that says
      // WHICH roof is in front of a wall and how high it stands above this
      // level's floor.
      //
      // The designs above deal their windows from fixed lists, and on the
      // 2 STOREY + GARAGE the middle one of `8, 16, 24` lands on the garage
      // ridge to the foot. That is the window he reported, and the board that
      // diagnosed it named this module as the CAUSE, which was wrong -- his
      // fixture carries no `auto: true` window at all. The module is here as
      // the FIX instead, and by this list's own rule it is the kind of entry
      // to grow by: a rule that would otherwise have a second home.
      //
      // Written again in MODEL.html, the two pages would disagree about which
      // roofs count or what the heights are measured from, and either is a
      // right window on one page and a wrong one on the other.
      './auto-windows.js',
      // AND WHERE AN ORDERED GARAGE STANDS. 40 lines, no dependency of its
      // own: a traced loop says where it goes by being traced, an autobuilt
      // one has to be told, and PROJECT will have to be told the same thing
      // the day it offers to place one.
      './garage-site.js',
      './profile-manager.js',
      // ADDED ON PURPOSE, which is what this list is for. tool-roster.js is
      // the seventeen tools as data -- 80 lines, no dependency of its own, and
      // it exists so the tool column renders a list instead of seventeen
      // hand-written buttons that can drift apart. This assertion caught it
      // the same hour it was added, exactly as intended.
      './tool-roster.js',
      // THE THREE TOY MODULES, and this assertion caught them too -- though
      // not the same hour, because the shard holding it was being cancelled at
      // its 40-minute cap rather than reporting. They arrived with §3, the
      // section whose own first finding was that MODEL.html was not loading
      // them at all: the constraint path existed, the page never called it,
      // and every TOY rule "passed" by never running. So these are not a new
      // cost so much as the cost §3 was already supposed to be paying.
      //
      // toy-constraints.js is the rule engine -- what a drag is allowed to do
      // to a welded group -- and it is the largest entry on this list at 787
      // lines. It earns that the way cut-view.js does: MODEL.dc.html runs the
      // same module, so the two boards cannot disagree about whether a move is
      // legal. A second copy of these rules is the four-homes failure again,
      // and this one would show up as two pages drawing different houses from
      // one file.
      //
      // toy-context.js (206) is what turns a drawing into the question the
      // engine answers -- welds, rings, neighbours -- and room-standards.js
      // (129) is data, not code: the room sizes the constraints measure
      // against. Neither has a dependency of its own; both resolve what they
      // need at CALL time, so listing them costs a fetch and nothing else.
      //
      // room-standards.js is here because toy-constraints.js requires
      // window.DraftRoomStandards, NOT because this page reads it directly --
      // which is the kind of entry to watch. A transitive dependency is still
      // a dependency, and the honest place to say so is here.
      './room-standards.js', './toy-constraints.js', './toy-context.js',
      './level-assembly.js',
      // AND THIS LIST CAUGHT TWO MORE, the third time it has earned its keep
      // and the reason it stays an EXACT list rather than a `toContain` --
      // which would have let both of these in silently.
      //
      // level-lock.js (86 lines, mine) holds the rules for an assembly that
      // stands in the same place on more than one floor: which lock holds a
      // group, who its siblings are, that a lock of one is not a lock, that a
      // shared corner moves once. MODEL.dc.html runs the same module, so this
      // is cut-view.js's bargain again -- a second copy would be two pages
      // disagreeing about what a lock does. No dependency of its own; it is
      // arithmetic over ids and points.
      './level-lock.js', './stair-geometry.js',
      // THE TWO AUTO STAIR MODULES ARRIVED TOGETHER, and this list caught them
      // the same hour, which is what the exact form is for -- an earlier
      // version of this comment says the palette and build-menu.js were caught
      // the same way. They are here on purpose:
      //
      // auto-stair.js is the pure placement derivation, the same relationship
      // build-house.js already has to AUTO BEAM: plain data in, one suggested
      // stair out. MODEL.html could PAINT a stair and could not derive one,
      // so the STAIR key armed a tool with no panel, no button and no press
      // handler, and a two-storey house arrived with no way between its
      // floors. stair-rules.js is the table auto-stair.js scores with.
      //
      // THE PAIR IS NOT SEPARABLE, which is why both land rather than one.
      // auto-stair.js falls back on its own seeded constants when the rulebook
      // is missing, so a page that took only the first would load clean,
      // report every export, and place a silently DIFFERENT stair from every
      // other page -- the worst of the three outcomes, because nothing fails.
      //
      // NEITHER RUNS ON THE CRITICAL PATH. Both define a frozen object and
      // stop; the derivation runs on a press. So they cost two requests and no
      // startup work, which is the bar this list actually guards.
      './stair-rules.js', './auto-stair.js',
      // traffic-counter.js is the app's one deliberate off-site voice, and it
      // has been on every other page since it was written -- index, PROJECT,
      // SETTINGS, STANDARDS, SPECS, both DC pages. This page carried the SLOT
      // it mounts into since 19 Sep and never asked for the script, which is
      // why the count Movie asked for never appeared here.
      //
      // IT IS NOT THE KIND OF ENTRY THIS LIST EXISTS TO REFUSE. The list
      // guards the migration's claim that this page is CHEAP: nothing here
      // runs on the critical path, and this one runs after it entirely --
      // deferred, last in the body, fail-silent, and mute on localhost. What
      // it costs is one request the other eight pages already pay.
      //
      // And it is declared rather than exempted. no-third-party.spec.js is
      // where the off-site call itself is argued; this list's job is only
      // that nothing arrives without anyone noticing, and something did.
      './traffic-counter.js',
    ]);
  });

  test('an origin with nothing saved says so instead of showing a black page', async ({ page }) => {
    // A newcomer who never opened the old page. The failure this guards is a
    // blank screen that looks identical to a page that failed to boot.
    await page.addInitScript(() => {
      if (sessionStorage.getItem('draft-test-storage-cleared')) return;
      sessionStorage.setItem('draft-test-storage-cleared', '1');
      indexedDB.deleteDatabase('pdf-img-mgr-shared');
      localStorage.clear();
    });
    await page.goto('/MODEL.html');

    // A BLANK SHEET, NOT A NOTICE (Movie, 20 Sep: "just show a NEW / BLANK
    // page instead"). This read the other way for as long as the page could
    // only READ what MODEL.dc.html made: the notice told the drafter to go
    // and draw there and come back. It writes now, and the front door points
    // here, so that sentence would be the first thing a first-time drafter
    // read and it would send him to the page he is not meant to use.
    await expect(notice(page)).not.toHaveClass(/show/);
    await expect(readout(page)).toContainText('walls 0/0');

    // AND IT PAINTS, which is the half of the old claim that reversed. "There
    // is nothing to paint" was true of no drawing; a blank drawing has a
    // grid, and a blank sheet with no grid on it is a page that failed to
    // start rather than one with nothing on it.
    expect(await anyInk(page), 'the blank sheet came up with no grid')
      .toBeGreaterThan(0);
  });

  test('wheel zooms about the cursor and drag pans', async ({ page }) => {
    await houseOnOldPage(page);
    await page.goto('/MODEL.html');
    await expect(readout(page)).toContainText('walls', { timeout: 5000 });

    const fitted = await scaleNow(page);
    expect(fitted).toBeGreaterThan(0);

    // Zoom in about a fixed point. The world point under the cursor must not
    // move -- that is what makes zoom feel attached to the drawing rather than
    // to the window.
    const box = await page.locator('#plan').boundingBox();
    const cx = box.x + box.width * 0.4, cy = box.y + box.height * 0.4;
    await page.mouse.move(cx, cy);
    await page.mouse.wheel(0, -400);
    const zoomed = await scaleNow(page);
    expect(zoomed).toBeGreaterThan(fitted);

    // Panning changes what is under the canvas centre, so the ink pattern has
    // to move. A pan that silently did nothing would still pass a scale check.
    const inkBefore = await wallInk(page);
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 260, cy + 160, { steps: 8 });
    await page.mouse.up();
    const inkAfter = await wallInk(page);
    expect(inkAfter).not.toBe(inkBefore);
  });
});
