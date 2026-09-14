// NO OTHER TOOLS: the board decides what the column offers.
//
// Work order: GILLIGAN-TOY-BONES-WORKORDER §6, and §8's disclaimer removal.
//
// THE RULING is Skipper's, written down in
// RD-DOCUMENTS/IMPORTANT-WORK-ORDERS/SPEC-toy-mode-constraints.md: "A wall can
// be manipulated ONLY through a grip tab. There is no drafting tool in TOY
// MODE." WALL survives because §1 of this order had TOY square the run and
// land it on the foot -- a rule about DRAWING a wall, which would be dead code
// on a board with no wall tool. SELECT survives because it is the resting
// state, not a drafting tool.
//
// WHAT THIS SPEC IS ARRANGED AGAINST is one shape of lie: the key looking
// down while the register still takes the tool. Greying is presentation and
// presentation can be got round, so `the register refuses even when the key is
// forced back on` below strips the disabled attribute and clicks anyway. If
// only the CSS were doing the work, that check is the one that goes red.
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

async function open(page, file) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  // ?left=1 OPENS THE LEFT RAIL, and without it this file measures a column
  // that is not on screen. `<aside id="left-rail" hidden>` is the default, so
  // the three checks that CLICK a key each timed out while the four that only
  // read `disabled`, the computed opacity and the title all passed -- against
  // elements inside a display:none panel. Passing there proved the CSS rule
  // and nothing about what a drafter sees, which is the same defect this file
  // is written against, arriving in its own fixture.
  await page.goto('/MODEL.html?left=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  // The column is ON SCREEN before anything is measured on it.
  await expect(page.locator('[data-tool-key="wall"]')).toBeVisible();
}

const key = (page, id) => page.locator(`[data-tool-key="${id}"]`);
const armed = page => page.evaluate(() => {
  const on = [...document.querySelectorAll('[data-tool-key]')]
    .filter(b => b.getAttribute('aria-pressed') === 'true');
  return on.map(b => b.dataset.toolKey);
});
const downKeys = page => page.evaluate(() =>
  [...document.querySelectorAll('[data-tool-key]')]
    .filter(b => b.disabled).map(b => b.dataset.toolKey).sort());

test('the roster answers per board, and every board can rest', async ({ page }) => {
  await open(page, base({ board: 'toy' }));
  const r = await page.evaluate(() => {
    const R = window.DraftToolRoster;
    return {
      toy: R.availableIn('toy').map(t => t.id),
      drafting: R.availableIn('drafting').length,
      all: R.TOOLS.length,
      // AN UNKNOWN BOARD FALLS OPEN, not shut. Falling shut would strip
      // sixteen keys and look exactly like TOY working correctly.
      unknown: R.availableIn('gruff').length,
      // The fallback has to land somewhere legal on EVERY board, or putting a
      // tool down on some future board would arm a refused one.
      restsEverywhere: R.BOARDS.every(b => R.availableOn(R.RESTING, b)),
      unknownId: R.availableOn('teleporter', 'drafting'),
    };
  });
  expect(r.toy, 'TOY offers select and wall, and nothing else')
    .toEqual(['select', 'wall']);
  expect(r.drafting).toBe(r.all);
  expect(r.unknown).toBe(r.all);
  expect(r.restsEverywhere).toBe(true);
  expect(r.unknownId).toBe(false);
});

test('on TOY the other fifteen keys are down, and on DRAFTING none are',
  async ({ page }) => {
    await open(page, base({ board: 'toy' }));
    const down = await downKeys(page);
    expect(down).toHaveLength(15);
    expect(down).not.toContain('select');
    expect(down).not.toContain('wall');

    await page.locator('[data-board="drafting"]').click();
    await page.waitForTimeout(80);
    // Both directions. "always down" would satisfy the half above.
    expect(await downKeys(page)).toEqual([]);
  });

test('a down key LOOKS down, measured rather than asserted', async ({ page }) => {
  // THE CHECK THIS REPLACES would have read `disabled` and passed with no CSS
  // behind it at all -- a broken state identical to the working one on screen.
  // So the computed opacity is what is compared, and against a live key rather
  // than a constant, which also catches the rule being widened to every key.
  await open(page, base({ board: 'toy' }));
  const seen = await page.evaluate(() => {
    const op = id => parseFloat(getComputedStyle(
      document.querySelector(`[data-tool-key="${id}"]`)).opacity);
    const cur = id => getComputedStyle(
      document.querySelector(`[data-tool-key="${id}"]`)).cursor;
    return { live: op('wall'), down: op('roof'), downCursor: cur('roof') };
  });
  expect(seen.live).toBeCloseTo(1, 2);
  expect(seen.down).toBeLessThan(0.6);
  expect(seen.downCursor).toBe('not-allowed');
});

test('a down key says WHY, on the face a drafter can reach', async ({ page }) => {
  await open(page, base({ board: 'toy' }));
  await expect(key(page, 'roof')).toHaveAttribute('title', /TOY board does not offer/);
  // The available ones keep the plain name -- the reason is not sprayed over
  // keys it is not true of.
  await expect(key(page, 'wall')).toHaveAttribute('title', 'WALL');
});

test('the register refuses even when the key is forced back on', async ({ page }) => {
  // THE CHECK THE REST OF THIS FILE EXISTS FOR. Everything above measures
  // presentation, and presentation is not a rule: a keyboard shortcut, a
  // restored session or a tool arming itself at the end of a gesture all reach
  // setTool without going near a disabled attribute. Removing the attribute
  // here stands in for every one of those paths.
  await open(page, base({ board: 'toy' }));
  await page.evaluate(() => {
    document.querySelector('[data-tool-key="roof"]').disabled = false;
  });
  await key(page, 'roof').click();
  await page.waitForTimeout(60);
  expect(await armed(page), 'ROOF is refused; the page rests on SELECT')
    .toEqual(['select']);
});

test('leaving DRAFTING puts down a tool TOY does not offer', async ({ page }) => {
  await open(page, base({ board: 'drafting' }));
  await key(page, 'roof').click();
  await page.waitForTimeout(60);
  expect(await armed(page)).toEqual(['roof']);

  await page.locator('[data-board="toy"]').click();
  await page.waitForTimeout(80);
  // Rebuilding the faces alone would leave ROOF armed behind a greyed ROOF
  // key: the column telling the truth about the key and a lie about the state,
  // and the next drag still drawing a roof.
  expect(await armed(page), 'the tool is put down, not merely greyed')
    .toEqual(['select']);
  expect(await downKeys(page)).toContain('roof');
});

test('a tool TOY DOES offer survives the switch', async ({ page }) => {
  // The mirror of the check above. Putting EVERY tool down on a board change
  // would pass that one and be wrong: WALL is offered on both boards, so
  // crossing has no reason to disarm it.
  await open(page, base({ board: 'drafting' }));
  await key(page, 'wall').click();
  await page.waitForTimeout(60);
  expect(await armed(page)).toEqual(['wall']);

  await page.locator('[data-board="toy"]').click();
  await page.waitForTimeout(80);
  expect(await armed(page)).toEqual(['wall']);
});

test('a drawing that opens on TOY has the keys down from the first paint',
  async ({ page }) => {
    // THE LOAD PATH IS A THIRD ENTRY, not the switch. `board = boardOfDrawing()`
    // runs after the column is built, so a page that only constrained on click
    // would open a TOY file with all seventeen keys live.
    await open(page, base({ board: 'toy' }));
    expect(await downKeys(page)).toHaveLength(15);
  });

test('the board buttons no longer disclaim that nothing is constrained',
  async ({ page }) => {
    // §8. The disclaimer was true until §6; leaving it would now mislead.
    await open(page, base({ board: 'toy' }));
    const titles = await page.evaluate(() =>
      [...document.querySelectorAll('[data-board]')].map(b => b.title));
    expect(titles.join(' | ')).not.toContain('nothing is constrained');
    expect(titles.join(' | ')).toContain('walls only');
  });
