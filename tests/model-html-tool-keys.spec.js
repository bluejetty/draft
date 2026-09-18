// THE LETTERS ON THE TOOL KEYS — a face that does something.
//
// The column has painted a letter on every key since it was built and not one
// of them was wired. The faces are real: they come from the roster, which
// reads the drafter's OWN bindings, so a profile that moves TRIM off Q moves
// the face with it. Pressing the key the page drew did nothing at all.
//
// Movie, 18 Sep: "check the model.dc file it has a tool was U before". It is
// U — `outline: 'U'` in profile-manager.js — and he was pressing it. The old
// page has no OUTLINE BUTTON either: its column is the same seventeen keys
// (MODEL.dc.html:24035), and outline is reached there by that letter or by
// picking a house type. So the missing tool and the dead letters were one gap.
//
// WHAT IS MEASURED IS THE REGISTER, NOT THE PAINT. A key that lights is a
// key that lights; the assertions here follow through to the tool actually
// holding the next press, because "looks armed" and "is armed" are two world
// states and the whole column is arranged against confusing them.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });

// The board spec's square, for its reasons: symmetric about the origin so
// fit() centres on (0,0), and a real extent in both axes so the 200 px/ft
// clamp does not put every press off the canvas.
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

// ?left=1 opens the left rail. The column is `hidden` by default, and a spec
// that reads aria-pressed inside a display:none panel is measuring the CSS
// rather than what a drafter sees — the board spec's own fixture note.
async function open(page, file) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  await page.goto('/MODEL.html?left=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect(page.locator('[data-tool-key="wall"]')).toBeVisible();
}

const armed = page => page.evaluate(() => {
  const on = [...document.querySelectorAll('[data-tool-key]')]
    .filter(b => b.getAttribute('aria-pressed') === 'true');
  return on.map(b => b.dataset.toolKey);
});

// THE LETTER THE PAGE ITSELF DREW, read off the key rather than typed in here.
// A test that pressed a hard-coded 'W' would pass on a page whose faces all
// said something else — which is the defect this file exists about, in reverse.
const faceOf = (page, id) => page.evaluate(toolId => {
  const btn = document.querySelector(`[data-tool-key="${toolId}"]`);
  return btn?.querySelector('[data-tool-letter]')?.textContent || '';
}, id);

test('the letter on a key arms the tool the key names', async ({ page }) => {
  await open(page, base());
  expect(await armed(page), 'SELECT is the resting state').toEqual(['select']);

  const letter = await faceOf(page, 'wall');
  expect(letter, 'the key has a letter painted on it to press').toBe('W');

  await page.keyboard.press(letter);
  expect(await armed(page), 'the letter armed the tool whose face it is')
    .toEqual(['wall']);

  // PRESSING THE ARMED TOOL'S LETTER RETURNS TO SELECT, which is the column's
  // own verb — the key and the letter are one sentence said two ways, not two
  // behaviours free to drift.
  await page.keyboard.press(letter);
  expect(await armed(page), 'and the same letter puts it back down').toEqual(['select']);
});

test('U arms the outline, which has a letter and no key of its own',
  async ({ page }) => {
    await open(page, base());

    // NOTHING IN THE COLUMN LIGHTS, because there is nothing in the column to
    // light: `group: null` in the roster keeps outline out of every group's
    // list, which is what the old page is — seventeen keys, and outline
    // reached by its letter. So the witness is the strip, then the drawing.
    await page.keyboard.press('U');
    expect(await armed(page), 'no key lights, because outline has none')
      .toEqual([]);
    await expect(page.locator('#strip-message')).toContainText('Trace your house');
  });

test('a letter typed into a field is a character, not a tool', async ({ page }) => {
  await open(page, base());

  // THE SIZE FIELDS ON THE SIGN ARE THE LIVE CASE: a drafter typing a garage
  // width is not arming the wall tool, and a page that armed one would also
  // eat the character he meant to type.
  await h.openDriveThru(page);
  await page.locator('[data-build-family="detachedGarage"]').click();
  await page.locator('[data-build-entry="detached-thickened"]').click();
  await page.locator('#size-stock [data-build-size="custom"]').click();

  const width = page.locator('#size-w');
  await width.click();
  await page.keyboard.press('W');
  await page.keyboard.press('U');

  expect(await armed(page), 'the field kept the keystrokes').toEqual(['select']);
});

test('a board that refuses a tool refuses its letter too', async ({ page }) => {
  await open(page, base({ board: 'toy' }));
  expect(await armed(page)).toEqual(['select']);

  // ROOF IS NOT ON THE TOY BOARD. Greying the key is presentation and
  // presentation can be got round — a letter is exactly how — so the refusal
  // has to hold at the register.
  await page.keyboard.press('O');
  expect(await armed(page), 'TOY does not offer ROOF, so its letter does nothing')
    .toEqual(['select']);

  // AND THE REFUSED PRESS DOES NOT PUT DOWN WHAT THE DRAFTER WAS HOLDING.
  // setTool falls back to SELECT on a tool the board refuses, so routing the
  // letter through it unguarded would charge the drafter his armed tool for a
  // key that was never going to work.
  await page.keyboard.press('W');
  expect(await armed(page)).toEqual(['wall']);
  await page.keyboard.press('O');
  expect(await armed(page), 'WALL survives a refused letter').toEqual(['wall']);

  // OUTLINE IS ON THE TOY BOARD, because drawing the outline is not a drafting
  // tool — it is how a TOY house begins (Movie, 13 Sep).
  await page.keyboard.press('U');
  await expect(page.locator('#strip-message')).toContainText('Trace your house');
});
