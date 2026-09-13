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
    expect(after.board ?? null,
      'a file that never chose is not given a choice by being opened')
      .toBe(null);
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
    expect((await stored(page)).board,
      'the junk did not survive the round trip').toBe(null);
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
