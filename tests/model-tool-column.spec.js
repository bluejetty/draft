// THE LEFT TOOL COLUMN on MODEL.html — the seventeen keys and the register
// under them.
//
// Work order: GILLIGAN-TOOL-COLUMN-WORKORDER.md, stage A.
//
// WHY THE REGISTER LANDS BEFORE THE COLUMN, and why that ordering is the first
// thing tested here. The order as written said MODEL.html "has no tools at
// all"; it has one. `#draw-wall` is a working wall gesture — press-press,
// corner-snapping, armed shown in the accent — and `tests/model-html-seats.js`
// drives it on every run. But it is armed by `let drawArmed = false`: a
// BOOLEAN, not a tool id. Hang a seventeen-key keypad off a second variable and
// the page has two ideas of what is armed, which is the two-sources-of-truth
// failure the same order warns about one panel over, for the active level. So
// the boolean becomes a register first and the old button re-seats onto it —
// and the test that would catch a regression here is `the old button and the
// WALL key are one register`, below, which fails the moment anyone gives the
// keypad its own state.
//
// THE FIVE BARE KEYS WERE MEASURED, NOT DERIVED. ANNOTATION, COLUMN, BEAM,
// STAIR and FIXTURE have no command in profile-manager.js's
// DEFAULT_KEYBINDINGS, so the old page prints nothing on those faces. That was
// read off MODEL.dc.html running in a browser, because `shortcut(tool)` on a
// missing command returns the empty string and an empty string is
// indistinguishable in source from a letter nobody wrote down.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-garage-house.draft'), 'utf8'));

// The seventeen, in the old page's own order (MODEL.dc.html:23890-23907) with
// the faces read off it. `key: ''` is a face the old page leaves bare.
const ROSTER = [
  ['draw', 'select', 'Select', 'S'],
  ['draw', 'extend', 'Extend', 'X'],
  ['draw', 'copy', 'Copy', 'K'],
  ['draw', 'trim', 'Trim', 'Q'],
  ['draw', 'node', 'NODE / ARC', 'N'],
  ['draw', 'line', 'LINE', 'L'],
  ['draw', 'shape', 'SHAPE', 'A'],
  ['draw', 'dimension', 'DIMENSION', 'D'],
  ['draw', 'annotation', 'ANNOTATION', ''],
  ['build', 'wall', 'WALL', 'W'],
  ['build', 'fenestration', 'FENESTRATION', 'E'],
  ['build', 'floor', 'FLOOR', 'F'],
  ['build', 'roof', 'ROOF', 'O'],
  ['build', 'column', 'COLUMN', ''],
  ['build', 'beam', 'BEAM', ''],
  ['build', 'stair', 'STAIR', ''],
  ['build', 'fixture', 'FIXTURE', ''],
];

// `?left=1` opens the tool rail. The shell keeps that in the URL on purpose —
// "the URL is the state" (MODEL.html:2067) — so a spec asks for the column the
// same way a reload gets it back, which is also acceptance #1's mechanism.
async function seedHouse(page) {
  // A drawing has to be in the bucket before the page opens or the readout
  // says "no drawing saved" and there is nothing for a wall to land in.
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: REPRO });
}

async function openColumn(page, query = '?left=1') {
  await h.openModel(page, { webgl: false });
  await seedHouse(page);
  await page.goto(`/MODEL.html${query}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect(page.locator('[data-tool-key]').first()).toBeVisible();
}

const keys = page => page.locator('[data-tool-key]').evaluateAll(els => els.map(el => ({
  id: el.dataset.toolKey,
  group: el.closest('[data-tool-group]')?.dataset.toolGroup,
  name: el.querySelector('[data-tool-name]')?.textContent.trim(),
  key: el.querySelector('[data-tool-letter]')?.textContent.trim() ?? '',
  armed: el.getAttribute('aria-pressed') === 'true',
})));

test('seventeen keys, in the old page\'s order and grouping', async ({ page }) => {
  await openColumn(page);
  const got = await keys(page);

  // Order and grouping together in one comparison, so a key that moved between
  // DRAW/EDIT and BUILD fails as loudly as one that vanished.
  expect(got.map(k => [k.group, k.id, k.name]))
    .toEqual(ROSTER.map(([group, id, name]) => [group, id, name]));

  // The headings, which are what tell a drafter which half they are in.
  await expect(page.locator('[data-tool-group="draw"] [data-tool-group-name]'))
    .toHaveText('DRAW / EDIT');
  await expect(page.locator('[data-tool-group="build"] [data-tool-group-name]'))
    .toHaveText('BUILD');
});

test('twelve keys carry a letter and five are deliberately bare',
  async ({ page }) => {
    await openColumn(page);
    const got = await keys(page);
    expect(got.map(k => [k.id, k.key]))
      .toEqual(ROSTER.map(([, id, , key]) => [id, key]));

    // Stated as a count as well as a table, because the table above would also
    // be satisfied by a build that prints nothing on ANY face if the expected
    // letters were ever loosened to ''.
    expect(got.filter(k => k.key !== '')).toHaveLength(12);
    expect(got.filter(k => k.key === '').map(k => k.id))
      .toEqual(['annotation', 'column', 'beam', 'stair', 'fixture']);
  });

test('a SETTINGS remap moves the letter on the key face', async ({ page }) => {
  // The acceptance says "remaps from SETTINGS honoured", and a column that
  // hard-codes Q would pass every other test in this file. Move TRIM off its
  // default and the face has to follow, or the column is telling a drafter to
  // press a key that does nothing.
  await h.openModel(page, { webgl: false });
  await page.addInitScript(() => {
    const key = 'draft-active-package:settings';
    let pkg = null;
    try { pkg = JSON.parse(localStorage.getItem(key) || 'null'); } catch { pkg = null; }
    if (!pkg) {
      pkg = { format: 'draft-profile-package', version: 1, kind: 'settings',
        name: 'remap-seed', createdAt: new Date().toISOString(), content: {} };
    }
    pkg.content = pkg.content || {};
    pkg.content.keybindings = { ...(pkg.content.keybindings || {}), trim: 'Z' };
    localStorage.setItem(key, JSON.stringify(pkg));
  });
  await seedHouse(page);
  await page.goto('/MODEL.html?left=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });

  await expect(page.locator('[data-tool-key="trim"] [data-tool-letter]'))
    .toHaveText('Z');
  // The other faces are untouched — a remap that moved every letter would
  // satisfy the assertion above.
  await expect(page.locator('[data-tool-key="select"] [data-tool-letter]'))
    .toHaveText('S');
});

test('the register holds one tool, not seventeen booleans', async ({ page }) => {
  await openColumn(page);

  await page.locator('[data-tool-key="line"]').click();
  let got = await keys(page);
  expect(got.filter(k => k.armed).map(k => k.id)).toEqual(['line']);

  await page.locator('[data-tool-key="wall"]').click();
  got = await keys(page);
  expect(got.filter(k => k.armed).map(k => k.id)).toEqual(['wall']);

  // Pressing the armed key again disarms to SELECT rather than to nothing.
  // "No tool" is not a state the old page has — select is its resting tool —
  // and a page with no armed key looks exactly like a page whose keypad
  // stopped working.
  await page.locator('[data-tool-key="wall"]').click();
  got = await keys(page);
  expect(got.filter(k => k.armed).map(k => k.id)).toEqual(['select']);
});

test('the old #draw-wall button and the WALL key are ONE register',
  async ({ page }) => {
    await openColumn(page);
    const legacy = page.locator('[data-draw-wall]');
    const wallKey = page.locator('[data-tool-key="wall"]');

    // Old button arms the new key.
    await legacy.click();
    await expect(wallKey).toHaveAttribute('aria-pressed', 'true');
    await expect(legacy).toHaveClass(/armed/);

    // And back the other way: the new key disarms the old button. This is the
    // direction that catches a keypad given its own state — arming from the
    // column while `drawArmed` stayed true would leave both lit and the page
    // would commit walls from a tool the column says is not selected.
    await page.locator('[data-tool-key="select"]').click();
    await expect(wallKey).toHaveAttribute('aria-pressed', 'false');
    await expect(legacy).not.toHaveClass(/armed/);

    await wallKey.click();
    await expect(legacy).toHaveClass(/armed/);
  });

test('a wall still commits when WALL is armed from the column',
  async ({ page }) => {
    await openColumn(page);
    await page.locator('[data-tool-key="wall"]').click();

    const box = await page.locator('#plan').boundingBox();
    const scale = await page.evaluate(() => Number(
      /scale ([\d.]+) px\/ft/.exec(document.getElementById('readout').textContent)[1]));
    const at = (x, z) => [box.x + box.width / 2 + x * scale,
      box.y + box.height / 2 + z * scale];

    const before = await page.evaluate(() => Number(
      /walls (\d+)\/(\d+)/.exec(document.getElementById('readout').textContent)[2]));
    await page.mouse.click(...at(-4, 6));
    await page.waitForTimeout(60);
    await page.mouse.click(...at(4, 6));
    await page.waitForTimeout(120);
    const after = await page.evaluate(() => Number(
      /walls (\d+)\/(\d+)/.exec(document.getElementById('readout').textContent)[2]));

    expect(after, 'the gesture the old button drove still runs off the register')
      .toBe(before + 1);
  });
