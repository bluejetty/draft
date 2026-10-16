// THE BOARD BELONGS TO THE DRAWING, not to the browser.
//
// Work order: GILLIGAN-TOY-BONES-WORKORDER §7 and §8, acceptance #11 and #12.
//
// WHY THIS MOVED. MODEL.html kept `board` in the skin key in localStorage —
// per browser, not per file. §7 rules against that in as many words: "the same
// drafter meets it on every file while a second drafter never sees it at all".
// And acceptance #11 asks that "a promoted drawing" reload as DRAFTING, which
// is a fact about ONE FILE and unanswerable from a per-browser flag: promote
// one drawing and every other drawing on that machine would open promoted too.
//
// THE FORMAT LEARNED THE KEY rather than the save being taught to smuggle it,
// because acceptance #12 says "nothing here adds a board-shaped field an older
// page would drop". A key the format normalises and re-emits round-trips; one
// hung off the save does not.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
const base = extra => ({
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  // A SQUARE, SYMMETRIC ABOUT THE ORIGIN, and both properties are load-bearing.
  // Symmetric so fit()'s centre is exactly (0,0) and a screen point is
  // centre + world * scale. And a real extent in BOTH axes, because fit()
  // takes min(cssW/spanX, cssH/spanZ) and clamps to 200 px/ft: the single wall
  // this fixture started as had spanZ of 0, so the scale pinned at 200 and
  // every click landed hundreds of pixels off the canvas. The length box then
  // stayed disabled -- correctly, since no run had begun -- and five checks
  // failed pointing at the box.
  walls: [
    ['n', V(-10, -10), V(10, -10)], ['e', V(10, -10), V(10, 10)],
    ['s', V(10, 10), V(-10, 10)], ['w', V(-10, 10), V(-10, -10)],
  ].map(([id, start, end]) => ({ id, start, end, levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' })),
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
  ...extra,
});

async function open(page, file) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

const boardOf = page => page.evaluate(() => document.body.getAttribute('data-board'));
const stored = page => page.evaluate(async bucket => {
  const f = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await f.text());
}, BUCKET);

test('a drawing that records DRAFTING opens on DRAFTING', async ({ page }) => {
  await open(page, base({ board: 'drafting' }));
  expect(await boardOf(page)).toBe('drafting');
});

test('a drawing that records TOY opens on TOY', async ({ page }) => {
  // Both directions, or "always drafting" would satisfy the check above.
  await open(page, base({ board: 'toy' }));
  expect(await boardOf(page)).toBe('toy');
});

test('a drawing that never chose one opens on the default', async ({ page }) => {
  // An older file has no board. The format says null — it does not invent a
  // choice nobody made — and the page supplies its own default.
  await open(page, base({}));
  expect(await boardOf(page)).toBe('toy');
});

test('a promotion writes the board to the drawing and survives reload',
  async ({ page }) => {
    // THE PRESS THAT USED TO BE HERE IS GONE (Movie, 15 Oct: "it ill be
    // basically a LIGHT -- not a button"). The only thing that moves the
    // board now is a number a foot cannot hold, so that is what this types --
    // and the acceptance it guards is unchanged: a promoted drawing reloads
    // as DRAFTING, because the board is a fact about one file.
    await open(page, base({ board: 'toy' }));
    expect(await boardOf(page)).toBe('toy');

    await startARun(page);
    await typeLength(page, PRECISE);
    expect(await boardOf(page)).toBe('drafting');

    // IT IS IN THE FILE, not only on the body. A switch that changed the
    // attribute and nothing else would pass every assertion above.
    await page.locator('#save').click();
    await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
    expect((await stored(page)).board).toBe('drafting');

    await page.reload();
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
    expect(await boardOf(page), 'acceptance #11').toBe('drafting');
  });

test('the board round-trips, and a file that never had one still does not',
  async ({ page }) => {
    // ACCEPTANCE #12, both halves. A page may show less than the file
    // contains; it may not save less.
    await open(page, base({ board: 'drafting' }));
    await page.locator('#save').click();
    await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
    expect((await stored(page)).board,
      'a recorded board comes back out').toBe('drafting');

    await open(page, base({}));
    await h.armWall(page);   // make it dirty honestly
    await h.disarmWall(page);
    await page.locator('#save').click();
    await page.waitForTimeout(400);
    const after = await stored(page);
    // ABSENT, NOT NULL, and the difference is the whole check.
    //
    // This line read `expect(after.board ?? null).toBe(null)` and was green
    // while SIX CI checks were red on this exact fact. `?? null` is satisfied
    // by the key being ABSENT and by it being PRESENT as null, equally -- so
    // the assertion could not see the thing its own title names, and the page
    // wrote `board: null` into every drawing it saved for a day.
    //
    // That is worth naming: an assertion satisfied by the feature's absence
    // proves nothing, and `??`/`||` in an expect is where it usually hides.
    // The Write Tier saw it (write-tier.spec.js:580, key for key) because it
    // compares whole objects and a whole object knows absent from null.
    expect('board' in after,
      'a file that never chose is not given a choice by being opened -- not '
      + 'even a null one, which the old page never writes').toBe(false);
    // `boardPromptSeen` WENT WITH THE CARD (Movie, 15 Oct): there is no
    // question to have answered, so there is no flag to be given. The key is
    // not asserted absent here because the page no longer knows the name --
    // what would fail is nothing, which is not a check.

  });

test('a junk board is normalised out of the file, not carried in it',
  async ({ page }) => {
    // THE MUTATION GATE FOUND THIS MISSING. Dropping the load-time normalise
    // left every other check green, because boardOfDrawing() normalises too --
    // so junk never reaches the switch by either route. What it does reach,
    // unnormalised, is the SAVE: the file would keep "banana" as its board
    // for ever, a value no page can honour.
    //
    // The house rule is already written down one key over, in this suite's own
    // sibling: "buildType: the reader normalises what it does not know, and
    // the writer never emits it". Same treatment.
    await open(page, base({ board: 'banana' }));
    await h.armWall(page);
    await h.disarmWall(page);
    await page.locator('#save').click();
    await page.waitForTimeout(400);
    // Same correction as above: "not carried in it" is a claim about the KEY,
    // and `toBe(null)` is met by a carried null. The house rule this test
    // quotes says the writer never emits it, so the key is gone.
    expect('board' in await stored(page),
      'the junk did not survive the round trip, as a value OR as a null')
      .toBe(false);
  });

test('a junk board in the file does not reach the switch', async ({ page }) => {
  // The load normalises rather than spreading `...parsed` through. Without
  // that the switch would hold a value BOARDS does not contain, and the
  // markSwitch would light nothing while data-board said "banana".
  await open(page, base({ board: 'banana' }));
  expect(await boardOf(page)).toBe('toy');
  expect(['toy', 'drafting']).toContain(await boardOf(page));
});

// ── §7: the promotion, and the question that comes first ────────────────────

// Typing a length needs a run in hand: the wall tool armed and a first point
// down, with the cursor somewhere to aim at.
async function startARun(page) {
  const box = await page.locator('#plan').boundingBox();
  const scale = await page.evaluate(() => Number(
    /scale ([\d.]+) px\/ft/.exec(document.getElementById('readout').textContent)[1]));
  const at = (x, z) => [box.x + box.width / 2 + x * scale, box.y + box.height / 2 + z * scale];
  // ARM IT ONLY IF IT IS DOWN. The button TOGGLES, and after a committed wall
  // the tool stays armed with the chain live -- so a second call that clicked
  // blindly disarmed it, the length box went dead, and the failure pointed at
  // the box rather than at the click that killed it.
  await h.armWall(page);
  await page.mouse.click(...at(0, 4));
  await page.mouse.move(...at(6, 4));
  await page.waitForTimeout(60);
}

const wallCount = page => page.evaluate(() => Number(
  /walls (\d+)\/(\d+)/.exec(document.getElementById('readout').textContent)[2]));

// THE LENGTH BOX IS `[data-frozen-length]` AND IT STARTS DISABLED. stripRefresh
// enables it only when a length is typable -- the wall tool armed, a first
// point down, a cursor to aim at -- so filling it before that WAITS rather than
// failing. The first version of this helper guessed three selectors that do not
// exist and fell back to `input` first; the run hung past its 600s timeout and
// produced no output at all, which is the least useful way a check can fail.
// ── THE TWO LENGTHS THESE TESTS ARE ABOUT ───────────────────────────────────
//
// Movie, 27 Sep: *"allow a TOY MODE user to stay in toy mode if they enter an
// exact foot length"*, and on what sent him looking: *"i tried this and it made
// me switch because it considered it a 'precise' length"*.
//
// EVERY PROMOTION TEST IN THIS FILE USED 8', WHICH IS NOW THE WRONG LENGTH TO
// ASK WITH. They were written when the gate looked only at whether anything
// had been typed, so a whole foot was as good a trigger as any -- and the day
// the gate learned to read the VALUE, eight feet stopped being a promotion at
// all. Named rather than fixed inline, because the distinction IS the subject:
// PRECISE is a length TOY cannot hold, ON_THE_FOOT is the only length it can.
const PRECISE = "8' 6\"";
const ON_THE_FOOT = "8'";

async function typeLength(page, text) {
  const box = page.locator('[data-frozen-length]');
  await expect(box, 'the length box must be live before a length can be typed')
    .toBeEnabled({ timeout: 4000 });
  await box.fill(text);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
}

test('typing a length a foot cannot hold promotes on the spot — and commits it',
  async ({ page }) => {
    // WHAT THIS REPLACES: a card, Continue / Stay in TOY, raised before the
    // first finer length and remembered per drawing. Movie, 15 Oct: "if they
    // enter a ANGLE or length other than 1ft, it will automatically place
    // them in DRAFTING MODE". He is not being moved anywhere he could have
    // refused to go -- TOY takes no tool away any more -- so the question had
    // nothing left to ask.
    await open(page, base({ board: 'toy' }));
    await startARun(page);
    const before = await wallCount(page);

    await typeLength(page, PRECISE);
    expect(await boardOf(page), 'promoted by the number itself').toBe('drafting');
    expect(await wallCount(page), 'and the wall he typed was made').toBe(before + 1);
    expect(await page.locator('[data-promote]').count(),
      'nothing was asked').toBe(0);
  });

test('and the strip says so, in the drafter\'s own words', async ({ page }) => {
  // A MODE THAT CHANGES SILENTLY is the "hidden mode flip" the card existed
  // to prevent, and the lamp in the corner is too quiet for the moment it
  // happens -- a drafter watching his wall is not watching the corner.
  await open(page, base({ board: 'toy' }));
  await startARun(page);
  await typeLength(page, PRECISE);
  await expect(page.locator('#strip-message')).toContainText('DRAFTING now');
  // HIS OWN TEXT, not a re-formatted number: a line that answered 12'-6" to a
  // drafter who typed 12-6 would be the page correcting him in the middle of
  // telling him something else.
  await expect(page.locator('#strip-message')).toContainText(PRECISE);
});

test('the lamp goes out with it', async ({ page }) => {
  await open(page, base({ board: 'toy' }));
  const lamp = page.locator('[data-board-light]');
  await expect(lamp).toHaveAttribute('data-lit', '');
  await startARun(page);
  await typeLength(page, PRECISE);
  await expect(lamp.locator('[data-board-lamp]')).toHaveText('DRAFTING');
  expect(await lamp.getAttribute('data-lit'), 'the light is out').toBeNull();
});

test('in DRAFTING a typed length just commits', async ({ page }) => {
  await open(page, base({ board: 'drafting' }));
  await startARun(page);
  const before = await wallCount(page);
  // PRECISE again: a whole foot would pass on a page that never promotes
  // anything, which is not what this names.
  await typeLength(page, PRECISE);
  expect(await wallCount(page)).toBe(before + 1);
  expect(await boardOf(page)).toBe('drafting');
});

// ── A WHOLE FOOT IS TOY'S OWN LENGTH, NOT A PRECISE ONE ─────────────────────
//
// Movie, 27 Sep: *"allow the use while in 'TOY MODE' to enter a 'L' or 'R'
// value - if it is to the nearest foot accept it and don't change to DRAFTING
// MODE (i tried this and it made me switch because it considered it a
// 'precise' length)"*.
//
// THE GATE NEVER LOOKED AT THE VALUE -- it asked the board and the flag and
// nothing else -- so a drafter typing a number TOY produces natively was told
// he was leaving TOY to do it. Every test above had to move off 8' for this
// one to exist, which is itself the measure of how completely the old rule
// ignored what was typed.

test('a whole foot in TOY commits without asking, and stays in TOY',
  async ({ page }) => {
    await open(page, base({ board: 'toy' }));
    await startARun(page);
    const before = await wallCount(page);

    await typeLength(page, ON_THE_FOOT);

    // THE WALL IS THE CHECK, not the board holding still. A page that refused
    // the length outright would also stay on TOY, and would be a worse answer
    // than the one being replaced.
    expect(await wallCount(page), 'and the wall was built').toBe(before + 1);
    expect(await boardOf(page), 'still TOY').toBe('toy');
    // AND THE NEXT FINER LENGTH STILL PROMOTES. A whole foot that quietly
    // moved the board would take TOY away from a drafter who never left it.
    await startARun(page);
    await typeLength(page, PRECISE);
    expect(await boardOf(page),
      'a precise length still promotes — the whole foot changed nothing')
      .toBe('drafting');
  });

// ── AND THE ANGLE BOX SAYS THE SAME THING THE LENGTH BOX DOES ───────────────
//
// It used to be dead on TOY, with the protractor refused beside it -- Movie,
// 5 Oct, on the ANGLE lock: "i guess this should only be allowed if not in
// TOY mode". TOY squares every run, so a box that took 37 and ignored it
// would have been a lie.
//
// Movie, 15 Oct, answers it the other way instead: *"if they enter a ANGLE or
// length other than 1ft, it will automatically place them in DRAFTING MODE"*.
// 37 is taken now, and it MOVES THE BOARD -- which is the same bargain the
// length box has made since the promotion was written, and the end of "they
// all go dim i notices" for one more control.

test('an angle TOY cannot draw promotes, like a length it cannot hold',
  async ({ page }) => {
    await open(page, base({ board: 'toy' }));
    await startARun(page);
    const box = page.locator('[data-frozen-angle]');
    await expect(box, 'the ANGLE box is live on TOY now').toBeEnabled();
    await box.fill('37');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    expect(await boardOf(page), '37° is not a quarter turn').toBe('drafting');
    await expect(page.locator('#strip-message')).toContainText('DRAFTING now');
  });

test('an angle TOY DRAWS ITSELF keeps it on TOY', async ({ page }) => {
  // The mirror, and the one that makes the check above about the VALUE rather
  // than about typing: every multiple of 90 is a wall TOY would have drawn.
  await open(page, base({ board: 'toy' }));
  await startARun(page);
  await page.locator('[data-frozen-angle]').fill('90');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  expect(await boardOf(page), 'a quarter turn is TOY\'s own angle').toBe('toy');
});

test('the protractor lights on TOY', async ({ page }) => {
  // Refusing the instrument was the complaint in one chip. Lighting it asks
  // for nothing a foot cannot hold -- it is the angle typed INTO it that
  // does, and that number now answers for itself.
  await open(page, base({ board: 'toy' }));
  await startARun(page);
  await page.locator('[data-mode-protractor]').click();
  await expect(page.locator('[data-mode-protractor]')).toHaveClass(/lit/);
  expect(await boardOf(page), 'and lighting it moved nothing').toBe('toy');
});

// ── §1: four directions, whole feet, and no leaking into DRAFTING ───────────

// The committed geometry, read out of the file. §1 says to assert that and not
// the cursor, because a page that rounds only what it DISPLAYS shows 12'-0"
// over a wall the file records as 12.037 — and the drafter finds out later,
// from a dimension string that disagrees with the plan it measures.
async function drawnWall(page, from, to) {
  const box = await page.locator('#plan').boundingBox();
  const scale = await page.evaluate(() => Number(
    /scale ([\d.]+) px\/ft/.exec(document.getElementById('readout').textContent)[1]));
  const at = (x, z) => [box.x + box.width / 2 + x * scale, box.y + box.height / 2 + z * scale];
  await h.armWall(page);
  await page.mouse.click(...at(...from));
  await page.waitForTimeout(60);
  await page.mouse.click(...at(...to));
  await page.waitForTimeout(120);
  await page.locator('#save').click();
  await page.waitForTimeout(400);
  const saved = await stored(page);
  const seeded = new Set(['n', 'e', 's', 'w']);
  const made = saved.walls.filter(w => !seeded.has(w.id)).pop();
  return made && {
    s: [Number(made.start.x.toFixed(6)), Number(made.start.z.toFixed(6))],
    e: [Number(made.end.x.toFixed(6)), Number(made.end.z.toFixed(6))],
  };
}

test('TOY commits an axis-aligned whole-foot wall from an off-axis, off-foot drag',
  async ({ page }) => {
    // Acceptance #1, and the aim is deliberately awkward: 5.4 ft across and
    // 0.8 ft down, so an honest build has to both square it and round it.
    await open(page, base({ board: 'toy' }));
    const w = await drawnWall(page, [0, 0], [5.4, 0.8]);
    expect(w, 'a wall was committed').toBeTruthy();

    const dz = Math.abs(w.e[1] - w.s[1]);
    const dx = Math.abs(w.e[0] - w.s[0]);
    expect(dz, 'exactly axis-aligned').toBeLessThan(1e-9);
    expect(Math.abs(dx - Math.round(dx)), 'a whole number of feet')
      .toBeLessThan(1e-9);
    expect(Math.round(dx), 'and the nearest foot to the 5.4 aimed at').toBe(5);
  });

test('DRAFTING still commits the off-axis, off-foot wall — TOY does not leak',
  async ({ page }) => {
    // ACCEPTANCE #4, and it is the half that makes the one above mean
    // something: a page that squared and rounded everywhere would pass every
    // TOY check and quietly take DRAFTING's precision away.
    await open(page, base({ board: 'drafting' }));
    const w = await drawnWall(page, [0, 0], [5.4, 0.8]);
    expect(w, 'a wall was committed').toBeTruthy();

    const dz = Math.abs(w.e[1] - w.s[1]);
    const dx = Math.abs(w.e[0] - w.s[0]);
    expect(dz, 'still off axis').toBeGreaterThan(0.1);

    // THE RUN'S LENGTH, not its dx. The mutation gate caught this: with the
    // foot rounding leaking into DRAFTING, the endpoint is scaled ALONG the
    // run, so dx comes back fractional and "still off the foot" passed while
    // the wall was exactly 5 feet long. The length is the thing TOY rounds, so
    // the length is the thing DRAFTING must be free of.
    const len = Math.hypot(dx, dz);
    expect(Math.abs(len - Math.round(len)), 'and its LENGTH is off the foot')
      .toBeGreaterThan(0.01);
  });

test('the foot is measured along the run, not rounded coordinate by coordinate',
  async ({ page }) => {
    // THE GATE FOUND THIS INVISIBLE. Every other TOY check starts a run at the
    // origin, where a whole-foot start makes "round each coordinate" and
    // "round the length" give the same answer -- so a build that did the wrong
    // one of those passed everything.
    //
    // It matters on any drawing that existed before TOY: round the coordinates
    // and a run from a fractional corner gets whole-foot POSITIONS and a
    // fractional LENGTH, which is exactly backwards. "Everything adjustable is
    // to the nearest foot" is about how far a wall moves, not where the grid
    // says it may sit.
    await open(page, base({ board: 'toy' }));
    // Start off the foot, so the two rules diverge.
    const w = await drawnWall(page, [0.37, 0], [5.4, 0.8]);
    expect(w, 'a wall was committed').toBeTruthy();

    const len = Math.hypot(w.e[0] - w.s[0], w.e[1] - w.s[1]);
    expect(Math.abs(len - Math.round(len)),
      'the LENGTH lands on the foot').toBeLessThan(1e-9);
    expect(Math.abs(w.s[0] - Math.round(w.s[0])),
      'from a start that does not').toBeGreaterThan(0.01);
  });

test('TOY squares without the T-square, which it has no way to switch on',
  async ({ page }) => {
    // §6 takes the instruments away in TOY, so squaring cannot depend on one
    // being up. The chip is dark here and the wall is square anyway.
    await open(page, base({ board: 'toy' }));
    const lit = await page.locator('[data-mode-tsquare]')
      .evaluate(el => el.classList.contains('lit'));
    expect(lit, 'the T-square is down').toBe(false);

    const w = await drawnWall(page, [0, -6], [4.3, -5.2]);
    expect(Math.abs(w.e[1] - w.s[1]), 'square with the instrument down')
      .toBeLessThan(1e-9);
  });
