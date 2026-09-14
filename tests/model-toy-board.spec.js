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

test('switching the board writes it to the drawing and survives reload',
  async ({ page }) => {
    await open(page, base({ board: 'toy' }));
    expect(await boardOf(page)).toBe('toy');

    await page.locator('[data-board="drafting"]').click();
    await page.waitForTimeout(80);
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
    await page.locator('[data-draw-wall]').click();   // make it dirty honestly
    await page.locator('[data-draw-wall]').click();
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
    expect('boardPromptSeen' in after,
      'and is not given an answered-the-prompt flag it never answered')
      .toBe(false);
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
    await page.locator('[data-draw-wall]').click();
    await page.locator('[data-draw-wall]').click();
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
  const armed = await page.locator('[data-draw-wall]')
    .evaluate(el => el.classList.contains('armed'));
  if (!armed) await page.locator('[data-draw-wall]').click();
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
async function typeLength(page, text) {
  const box = page.locator('[data-frozen-length]');
  await expect(box, 'the length box must be live before a length can be typed')
    .toBeEnabled({ timeout: 4000 });
  await box.fill(text);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
}

test('typing a length in TOY asks before it promotes', async ({ page }) => {
  await open(page, base({ board: 'toy' }));
  await startARun(page);
  const before = await wallCount(page);

  await typeLength(page, "8'");
  await expect(page.locator('[data-promote]'), 'the confirm is up').toBeVisible();
  await expect(page.locator('[data-promote-text]')).toHaveText(
    'Entering an exact length switches this drawing to DRAFTING.');
  expect(await wallCount(page), 'nothing committed while it is asking')
    .toBe(before);
  expect(await boardOf(page), 'and nothing promoted yet').toBe('toy');
});

test('Stay in TOY changes nothing at all — wall, board, or flag',
  async ({ page }) => {
    await open(page, base({ board: 'toy' }));
    await startARun(page);
    const before = await wallCount(page);

    await typeLength(page, "8'");
    await page.locator('[data-promote-stay]').click();
    await page.waitForTimeout(80);

    await expect(page.locator('[data-promote]')).toBeHidden();
    expect(await wallCount(page), 'no wall').toBe(before);
    expect(await boardOf(page), 'no board change').toBe('toy');

    // AND NO FLAG, which is the half most easily dropped: a refusal that
    // recorded itself would be a change, and the next typed length would
    // promote silently on the strength of a "no".
    await typeLength(page, "8'");
    await expect(page.locator('[data-promote]'), 'it asks again').toBeVisible();
  });

test('Continue promotes and commits, and does not ask twice',
  async ({ page }) => {
    await open(page, base({ board: 'toy' }));
    await startARun(page);
    const before = await wallCount(page);

    await typeLength(page, "8'");
    await page.locator('[data-promote-go]').click();
    await page.waitForTimeout(150);

    await expect(page.locator('[data-promote]')).toBeHidden();
    expect(await boardOf(page), 'promoted').toBe('drafting');
    expect(await wallCount(page), 'and the length committed').toBe(before + 1);

    // Back to TOY by hand, then type again: already answered, so no question.
    await page.locator('[data-board="toy"]').click();
    await page.waitForTimeout(80);
    await startARun(page);
    await typeLength(page, "6'");
    await expect(page.locator('[data-promote]'),
      'asked once per drawing, then remembered').toBeHidden();
  });

test('a drawing that already answered is never asked', async ({ page }) => {
  await open(page, base({ board: 'toy', boardPromptSeen: true }));
  await startARun(page);
  const before = await wallCount(page);
  await typeLength(page, "8'");
  await expect(page.locator('[data-promote]')).toBeHidden();
  expect(await wallCount(page)).toBe(before + 1);
});

test('in DRAFTING a typed length just commits', async ({ page }) => {
  await open(page, base({ board: 'drafting' }));
  await startARun(page);
  const before = await wallCount(page);
  await typeLength(page, "8'");
  await expect(page.locator('[data-promote]')).toBeHidden();
  expect(await wallCount(page)).toBe(before + 1);
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
  const armed = await page.locator('[data-draw-wall]')
    .evaluate(el => el.classList.contains('armed'));
  if (!armed) await page.locator('[data-draw-wall]').click();
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
