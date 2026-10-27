// THE BOARD TAKES NOTHING AWAY ANY MORE: IT IS A LIGHT.
//
// WHAT THIS FILE USED TO SAY, because the change is the point. Under
// GILLIGAN-TOY-BONES-WORKORDER §6 and Skipper's
// SPEC-toy-mode-constraints.md -- "There is no drafting tool in TOY MODE" --
// TOY offered five keys out of twenty and greyed the rest, the selection
// filters and the assembly verbs with them. Every check here measured that:
// fifteen keys down, a refusal in each title, the register refusing even when
// the key was forced back on.
//
// Movie overturned it on 15 Oct: *"lets always start the users in TOY MODE,
// but we should allow more features (they all go dim i notices) but maybe the
// features will be slightly limited (to ft and 90 degrees)"*, *"maybe don't
// even offer them to change to DRAFTING MODE, but if they enter a ANGLE or
// length other than 1ft, it will automatically place them in DRAFTING MODE.
// so it ill be basically a LIGHT -- not a button"*, and, asked which tools
// that leaves on TOY: all of them.
//
// SO THE RULE IS A CONSTRAINT NOW, NOT A SHORTER LIST. The foot and the right
// angle are what TOY is; the tools are what the page is. This file asks the
// same question of the new ruling -- and the shape of lie it is arranged
// against turned over with it. It used to be "the key looks down while the
// register still takes the tool"; it is now "the page looks open while
// something still refuses", which is why the checks below PRESS the keys and
// the chips rather than reading an attribute off them.
//
// WHAT THE BOARD STILL DECIDES is in model-toy-board.spec.js: the foot, the
// square, the grip tabs, and the promotion that turns the light off. The lamp
// is checked here because it is presentation -- what the corner SAYS -- and
// there because it is behaviour -- what makes it say it.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });

// The same square as tests/model-toy-board.spec.js, and for the same two
// reasons recorded there: symmetric about the origin so fit()'s centre is
// (0,0), and a real extent in BOTH axes so the 200 px/ft clamp does not put
// every click off the canvas.
const base = extra => ({
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
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

async function open(page, file, pane = 'build') {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  // ?left=1 OPENS THE LEFT RAIL, and without it this file measures a column
  // that is not on screen. `<aside id="left-rail" hidden>` is the default, so
  // checks that only read `disabled`, the computed opacity and the title all
  // passed once against elements inside a display:none panel -- proving the
  // CSS rule and nothing about what a drafter sees, which is the same defect
  // this file is written against, arriving in its own fixture.
  //
  // AND `lpane` SAYS WHICH TAB, since 29 Sep: DRAW / EDIT is on DRAFTING and
  // BUILD is on its own tab, so `?left=1` alone puts two thirds of the keys
  // behind a tab that is not up.
  await page.goto(`/MODEL.html?left=1&lpane=${pane}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect(page.locator(
    `[data-tool-key="${pane === 'build' ? 'wall' : 'select'}"]`)).toBeVisible();
}

const key = (page, id) => page.locator(`[data-tool-key="${id}"]`);
const boardOf = page => page.evaluate(() => document.body.getAttribute('data-board'));
const armed = page => page.evaluate(() => {
  const on = [...document.querySelectorAll('[data-tool-key]')]
    .filter(b => b.getAttribute('aria-pressed') === 'true');
  return on.map(b => b.dataset.toolKey);
});
const downKeys = page => page.evaluate(() =>
  [...document.querySelectorAll('[data-tool-key]')]
    .filter(b => b.disabled).map(b => b.dataset.toolKey).sort());

test('the roster offers every tool on every board, and every board can rest',
  async ({ page }) => {
    await open(page, base({ board: 'toy' }));
    const r = await page.evaluate(() => {
      const R = window.DraftToolRoster;
      return {
        toy: R.availableIn('toy').length,
        drafting: R.availableIn('drafting').length,
        all: R.TOOLS.length,
        // AN UNKNOWN BOARD STILL FALLS OPEN. It is the same answer as every
        // other board now, which is why the old warning about it stripping
        // sixteen keys has nothing left to warn about.
        unknown: R.availableIn('gruff').length,
        restsEverywhere: R.BOARDS.every(b => R.availableOn(R.RESTING, b)),
        // AN UNKNOWN ID IS STILL REFUSED, and it is the one refusal left in
        // the roster: it would arm nothing and read as "select is on", a
        // broken state that looks like a working one.
        unknownId: R.availableOn('teleporter', 'drafting'),
        // THE PANELS CAME WITH THEM. §6 named three surfaces, and the ruling
        // that opened the first opened all three.
        panelsOnToy: ['selection', 'assembly'].every(p => R.panelOn(p, 'toy')),
      };
    });
    expect(r.toy, 'TOY offers the whole roster').toBe(r.all);
    expect(r.drafting).toBe(r.all);
    expect(r.unknown).toBe(r.all);
    expect(r.restsEverywhere).toBe(true);
    expect(r.unknownId).toBe(false);
    expect(r.panelsOnToy).toBe(true);
  });

test('no key is down on TOY, and none is down on DRAFTING either',
  async ({ page }) => {
    await open(page, base({ board: 'toy' }));
    expect(await downKeys(page), 'the fifteen that used to be down').toEqual([]);
    await open(page, base({ board: 'drafting' }));
    expect(await downKeys(page)).toEqual([]);
  });

test('a key on TOY says its own name, not a refusal', async ({ page }) => {
  await open(page, base({ board: 'toy' }));
  // The refusal used to read "the TOY board does not offer ROOF". A title
  // that still said so would be the page arguing with its own keys.
  // Since 27 Oct the title is the name and the key's sentence ("WALL — press
  // W to draw a wall.") -- still the tool's own words, still no refusal.
  await expect(key(page, 'roof')).toHaveAttribute('title', 'ROOF — press O to draw a roof.');
  await expect(key(page, 'wall')).toHaveAttribute('title', 'WALL — press W to draw a wall.');
});

test('the register ARMS a drafting tool on TOY', async ({ page }) => {
  // THE CHECK THE REST OF THIS FILE EXISTS FOR, turned over. It used to force
  // a disabled key back on and prove the register refused anyway; the same
  // press now has to go through, because presentation is still not the rule
  // and a column that merely LOOKS open would leave the register refusing
  // behind it -- a key that lights and does nothing.
  await open(page, base({ board: 'toy' }));
  await key(page, 'roof').click();
  await page.waitForTimeout(60);
  expect(await armed(page), 'ROOF arms on the TOY board').toEqual(['roof']);
  expect(await boardOf(page), 'and arming it did not move the board').toBe('toy');
});

test('the selection filters and the assembly verbs operate on TOY',
  async ({ page }) => {
    // §6's other two surfaces, and the reason this check is worth keeping
    // rather than deleting with the ruling: "they all go dim i notices" is
    // what Movie was looking at, and these chips were two thirds of it.
    await open(page, base({ board: 'toy' }), 'drafting');
    const chips = page.locator('[data-sel-mode], [data-sel-filter]');
    const n = await chips.count();
    expect(n).toBeGreaterThan(3);
    expect(await chips.evaluateAll(els => els.filter(e => e.disabled).length),
      'every mode and filter chip is live on TOY').toBe(0);
    // Measured, not asserted -- a chip with the attribute off and the CSS
    // still greying it looks disabled to the only person who matters.
    expect(await chips.first().evaluate(el =>
      parseFloat(getComputedStyle(el).opacity))).toBeCloseTo(1, 1);

    // ASSEMBLY TAKES A SELECTION, so it is asked with one: it is disabled on
    // an empty selection for its own reasons, and a check that did not select
    // first would pass against the old reason and prove nothing.
    await page.locator('[data-sel-mode="click"]').click();
    await page.waitForTimeout(60);
    const box = await page.locator('#plan').boundingBox();
    const scale = await page.evaluate(() => Number(
      /scale ([\d.]+) px\/ft/.exec(document.getElementById('readout').textContent)[1]));
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2 - 10 * scale);
    await page.waitForTimeout(80);
    expect(await page.locator('[data-assembly-start]').isDisabled(),
      'a wall is picked on TOY, so ASSEMBLY is live').toBe(false);
  });

test('the board is a lamp, and there is nothing to press', async ({ page }) => {
  await open(page, base({ board: 'toy' }));
  // NOT A BUTTON ANYWHERE ON THE PAGE. "it ill be basically a LIGHT -- not a
  // button": a drafter who can press it can choose, and the whole of this
  // ruling is that he no longer does.
  expect(await page.locator('button[data-board]').count(),
    'the TOY / DRAFTING switch is gone').toBe(0);
  const lamp = page.locator('[data-board-light]');
  await expect(lamp).toBeVisible();
  await expect(lamp.locator('[data-board-lamp]')).toHaveText('TOY');
  // THE SECOND ROW IS THE INSTRUMENT. "so if its in TOY MODE the user will
  // know its 90s / and 1ft" -- a lamp that only said TOY would be a label.
  await expect(lamp.locator('[data-board-lamp-note]')).toHaveText(/1 FT.*90/);
  await expect(lamp).toHaveAttribute('data-lit', '');
});

test('on a promoted drawing the lamp says DRAFTING, and goes out',
  async ({ page }) => {
    await open(page, base({ board: 'drafting' }));
    const lamp = page.locator('[data-board-light]');
    await expect(lamp.locator('[data-board-lamp]')).toHaveText('DRAFTING');
    // IT STILL SAYS WHICH BOARD. The shading is what goes; the fact does not
    // stop being true because the rule it announces is no longer in force.
    await expect(lamp).toBeVisible();
    expect(await lamp.getAttribute('data-lit'), 'the light is out').toBeNull();
  });

test('every new drawing starts on TOY, whatever the browser last saw',
  async ({ page }) => {
    // "lets ALWAYS start the users in TOY MODE". The board used to be seeded
    // from localStorage, so one typed 12'-6" in one drawing put every later
    // drawing on DRAFTING before its first wall -- which is the thing that
    // sentence rules out.
    await open(page, base({ board: 'drafting' }));
    expect(await boardOf(page)).toBe('drafting');

    await open(page, base({}));   // the file records no board
    expect(await boardOf(page), 'a drawing that never chose is on TOY').toBe('toy');

    // AND THE SEED ITSELF IS PUT BACK BY HAND, which is what makes this a
    // check rather than a coincidence. The mutation gate caught it: a page
    // that read the skin store again survived the two halves above, because
    // nothing WRITES a board there any more -- so both halves passed against
    // a page that would have honoured one if it found it. The old key is
    // written here, and the page must still open TOY.
    await page.evaluate(() => {
      const keep = JSON.parse(localStorage.getItem('draft-skin') || '{}');
      localStorage.setItem('draft-skin', JSON.stringify({ ...keep, board: 'drafting' }));
    });
    await page.reload();
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
    expect(await boardOf(page),
      'the browser cannot seed the board any more').toBe('toy');
  });

test('a drawing that recorded DRAFTING reloads on DRAFTING', async ({ page }) => {
  // THE OTHER HALF, and the reason the board lives on the drawing at all: a
  // promotion is a fact about one file. The other way round, a drafter would
  // be put back on TOY every time he opened the house he promoted.
  await open(page, base({ board: 'drafting' }));
  expect(await boardOf(page)).toBe('drafting');
  expect(await downKeys(page)).toEqual([]);
});

test('the panels that share the pane survive the load', async ({ page }) => {
  // THE CHECK THAT WAS MISSING ONCE, and its absence cost 25 red checks in
  // three MERGED suites while every check in this file stayed green.
  // buildToolColumn used to replaceChildren on a slot that
  // buildSelectionPanel and buildAssemblyPanel APPEND into, so rebuilding the
  // column deleted both -- and the page loads with a board change in it.
  //
  // THE BOARD CHANGE ON LOAD IS STILL THERE (`board = boardOfDrawing()` runs
  // after all three panels exist), even though no drafter can cause another
  // one, so the hazard is live and this still guards it.
  await open(page, base({ board: 'drafting' }), 'drafting');
  await expect(page.locator('[data-sel-mode]').first(),
    'the selection panel survived the board the file carried').toBeVisible();
  await expect(page.locator('[data-assembly-start]')).toBeVisible();
});
