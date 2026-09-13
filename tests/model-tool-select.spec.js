// SELECTION and OBJECT TYPE on MODEL.html — the left column's second half.
//
// Work order: GILLIGAN-TOOL-COLUMN-WORKORDER.md, acceptance #3.
//
// THREE THINGS THE ORDER DESCRIBES DIFFERENTLY FROM THE PAGE IT PORTS, all
// settled by reading MODEL.dc.html rather than the order, and all asserted
// below in the old page's shape rather than the order's:
//
//   - ALL LEVELS is a THIRD WINDOW MODE, not a modifier. `selectionMode` is
//     'click' | 'window' | 'window-all' (:2792). WINDOW drags a blue box over
//     the current level; ALL LEVELS drags a red one over every level.
//   - The filter help goes red WHENEVER A FILTER IS ENGAGED, not when the
//     cursor is over something excluded. `selectFilterHelpColor` (:23622) is a
//     straight ternary on `selectFilter`; a cursor-driven red would need a hit
//     test on every mousemove, which the old page does not do.
//   - FIVE filters, not six: ALL, LINE, WALL, OUTLINE, FLOOR (:2793).
//
// THE HELP STRINGS ARE ASSERTED VERBATIM, and that is deliberate rather than
// brittle. The mode help is the ONLY place the shift-drag shortcut is written
// down, and the filter help is the only thing that tells a drafter why the
// thing under the cursor stopped responding. A paraphrase would pass a test
// that checked "contains 'window'" while dropping the fact.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';

// A FIXTURE BUILT FOR THE QUESTION, and the reason is a coordinate trap worth
// writing down. MODEL.html has no fixed scale: fit() centres the view on the
// MIDPOINT OF THE DRAWN BOUNDS and picks a zoom to suit. On
// repro-garage-house that centre is out near the garage, so a spec that
// assumed "screen centre is world (0,0)" -- as the seats spec's helper does,
// harmlessly, because it only needs its own two taps to agree with each other
// -- clicks somewhere it did not mean to. The first version of this file
// reported "the ALL filter does not grab a line", which was false: it was
// clicking at world (10, 1) and finding nothing there, and a click that misses
// looks exactly like a filter that excluded something.
//
// So the fixture is SYMMETRIC ABOUT THE ORIGIN: a 20ft square of wall, centred
// on (0,0), which makes fit()'s centre exactly (0,0) and the mapping
// `screen = centre + world * scale` exactly true. The scale is still read from
// the readout rather than assumed.
//
// It also holds the case the garage house cannot: a wall and a line on ONE
// level, so "the filter excluded it" is distinguishable from "there was
// nothing there".
const V = (x, z) => ({ x, y: 0, z });
const WALL = 10;      // the square's half-width, and where the walls are
const LINE_Z = 0;     // the probe line runs across the middle, clear of walls

const FIXTURE = {
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  walls: [
    ['w-n', V(-WALL, -WALL), V(WALL, -WALL)],
    ['w-e', V(WALL, -WALL), V(WALL, WALL)],
    ['w-s', V(WALL, WALL), V(-WALL, WALL)],
    ['w-w', V(-WALL, WALL), V(-WALL, -WALL)],
  ].map(([id, start, end]) => ({
    id, start, end, levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
  })),
  lines: [{
    id: 'l-probe', start: V(-4, LINE_Z), end: V(4, LINE_Z),
    levelId: 3, view: 'plan', layer: 'draft', bulge: 0,
  }],
  floors: [], roofs: [], fenestrations: [], dimensions: [], outlines: [],
  shapes: [], surfaceOpenings: [], stairs: [], notes: [], roomTags: [],
  columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
};

async function open(page, saved = FIXTURE) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, file }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(file)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, file: saved });
  await page.goto('/MODEL.html?left=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect(page.locator('[data-sel-mode]').first()).toBeVisible();
}

const at = async (page, x, z) => {
  const box = await page.locator('#plan').boundingBox();
  const scale = await page.evaluate(() => Number(
    /scale ([\d.]+) px\/ft/.exec(document.getElementById('readout').textContent)[1]));
  return [box.x + box.width / 2 + x * scale, box.y + box.height / 2 + z * scale];
};

// HOW MANY THINGS ARE SELECTED, read off the page's own readout rather than a
// test hook. The readout is where this page reports what it did -- it already
// says `walls 8/20` rather than making a drafter count -- and the selection
// belongs there for a drafter's sake too: with a filter engaged, a click that
// grabbed nothing and a click that grabbed something look identical, because
// the highlight is under the cursor.
const selCount = page => page.evaluate(() => {
  const m = /(\d+) selected/.exec(document.getElementById('readout').textContent);
  return m ? Number(m[1]) : 0;
});

const armed = (page, attr) => page.locator(`[${attr}][aria-pressed="true"]`)
  .evaluateAll(els => els.map(el => el.getAttribute(
    el.hasAttribute('data-sel-mode') ? 'data-sel-mode' : 'data-sel-filter')));

test('three modes and five filters, ITEMS and ALL to start', async ({ page }) => {
  await open(page);
  await expect(page.locator('[data-sel-mode]')).toHaveText(
    ['ITEMS', 'WINDOW', 'ALL LEVELS']);
  await expect(page.locator('[data-sel-filter]')).toHaveText(
    ['ALL', 'LINE', 'WALL', 'OUTLINE', 'FLOOR']);
  expect(await armed(page, 'data-sel-mode')).toEqual(['click']);
  expect(await armed(page, 'data-sel-filter')).toEqual(['all']);
});

test('the mode help says exactly what the old page says', async ({ page }) => {
  await open(page);
  const help = page.locator('[data-sel-help]');

  await expect(help).toHaveText('Click items to select; Shift adds or removes. '
    + 'Press and drag for a blue window — hold Shift while dragging for a red '
    + 'all-levels window.');

  await page.locator('[data-sel-mode="window"]').click();
  await expect(help).toHaveText(
    'Drag a blue box to select fully enclosed items on the current level.');

  await page.locator('[data-sel-mode="window-all"]').click();
  await expect(help).toHaveText(
    'Drag a red box to select fully enclosed items on every level.');

  // ONE mode at a time. ALL LEVELS is a third mode, not a modifier riding
  // WINDOW, so arriving here must have put WINDOW down.
  expect(await armed(page, 'data-sel-mode')).toEqual(['window-all']);
});

test('picking a mode also arms SELECT', async ({ page }) => {
  await open(page);
  // Arm something else first, or "select is armed" is the state the page
  // started in and this assertion proves nothing.
  await page.locator('[data-tool-key="wall"]').click();
  await expect(page.locator('[data-tool-key="wall"]'))
    .toHaveAttribute('aria-pressed', 'true');

  await page.locator('[data-sel-mode="window"]').click();
  await expect(page.locator('[data-tool-key="select"]'))
    .toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-tool-key="wall"]'))
    .toHaveAttribute('aria-pressed', 'false');
});

test('an engaged filter turns the help red and names itself', async ({ page }) => {
  await open(page);
  const help = page.locator('[data-filter-help]');

  await expect(help).toHaveText('Engage a type so Select only grabs that object '
    + '— even under other geometry.');
  await expect(help).not.toHaveAttribute('data-engaged', /.*/);

  await page.locator('[data-sel-filter="wall"]').click();
  await expect(help).toHaveText('WALL is engaged: nothing else responds. '
    + 'Click ALL — or press Esc with nothing selected — to release.');
  await expect(help).toHaveAttribute('data-engaged', '');

  // Back to ALL and the red goes. Without this half, a build that painted the
  // help red permanently would pass the assertion above.
  await page.locator('[data-sel-filter="all"]').click();
  await expect(help).not.toHaveAttribute('data-engaged', /.*/);
});

test('the WALL filter stops a line responding, and ALL lets it back',
  async ({ page }) => {
    await open(page);

    // Under ALL the line at z = 0 is selectable. The DELETE button is the
    // page's own tell for "exactly one wall is selected", so it must stay
    // hidden here: a line was picked, not a wall.
    await page.mouse.click(...await at(page, 0, LINE_Z));
    await page.waitForTimeout(80);
    await expect(page.locator('[data-delete-wall]')).toBeHidden();
    const litUnderAll = await selCount(page);

    await page.locator('[data-sel-filter="wall"]').click();
    await page.mouse.click(...await at(page, 0, LINE_Z));
    await page.waitForTimeout(80);
    const litUnderWall = await selCount(page);

    expect(litUnderAll, 'ALL grabs the line').toBe(1);
    expect(litUnderWall, 'WALL is engaged, so nothing responds there').toBe(0);

    // And the filter restricts rather than breaking selection outright: a WALL
    // is still grabbable with WALL engaged.
    await page.mouse.click(...await at(page, 0, -WALL));
    await page.waitForTimeout(80);
    await expect(page.locator('[data-delete-wall]')).toBeVisible();
  });

test('shift adds and shift removes', async ({ page }) => {
  await open(page);
  await page.mouse.click(...await at(page, 0, -WALL));
  await page.waitForTimeout(60);
  expect(await selCount(page)).toBe(1);

  await page.keyboard.down('Shift');
  await page.mouse.click(...await at(page, 0, WALL));
  await page.waitForTimeout(60);
  expect(await selCount(page),
    'shift adds a second wall').toBe(2);

  // The handles go with it: two walls selected is no longer "one wall", so the
  // corner grab and the DELETE button both stand down.
  await expect(page.locator('[data-delete-wall]')).toBeHidden();

  await page.mouse.click(...await at(page, 0, WALL));
  await page.waitForTimeout(60);
  await page.keyboard.up('Shift');
  expect(await selCount(page),
    'shift on a selected item removes it').toBe(1);
});

test('a plain click on empty space puts the selection down', async ({ page }) => {
  // THE MUTATION GATE FOUND THIS MISSING. Nine mutants died; "a plain click
  // stops clearing the selection" lived, because the Esc check clears the
  // selection by another route and every other check only ever adds to it.
  // Clicking empty space is a drafter's only way to put a selection down with
  // the mouse -- Esc is the keyboard's -- and nothing was watching it.
  await open(page);
  await page.mouse.click(...await at(page, 0, -WALL));
  await page.waitForTimeout(60);
  expect(await selCount(page)).toBe(1);

  // (6, 6) is inside the square and well clear of the walls and the probe
  // line, so this is empty space rather than a near miss.
  await page.mouse.click(...await at(page, 6, 6));
  await page.waitForTimeout(60);
  expect(await selCount(page), 'an empty click clears').toBe(0);

  // And shift does NOT clear, which is the other half: an inaccurate
  // shift-click must not destroy the set a drafter just built.
  await page.mouse.click(...await at(page, 0, -WALL));
  await page.waitForTimeout(60);
  await page.keyboard.down('Shift');
  await page.mouse.click(...await at(page, 6, 6));
  await page.waitForTimeout(60);
  await page.keyboard.up('Shift');
  expect(await selCount(page), 'a shift-click on nothing keeps the set').toBe(1);
});

test('Esc clears the selection first and releases the filter second',
  async ({ page }) => {
    await open(page);
    await page.locator('[data-sel-filter="wall"]').click();
    await page.mouse.click(...await at(page, 0, -WALL));
    await page.waitForTimeout(60);
    expect(await selCount(page)).toBe(1);

    // First Esc: the selection goes, the filter stays. A drafter must not lose
    // both to one press.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(60);
    expect(await selCount(page)).toBe(0);
    await expect(page.locator('[data-filter-help]'))
      .toHaveAttribute('data-engaged', '');

    // Second Esc, nothing selected: the filter releases, exactly as its own
    // help line promises in writing.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(60);
    await expect(page.locator('[data-filter-help]'))
      .not.toHaveAttribute('data-engaged', /.*/);
    expect(await armed(page, 'data-sel-filter')).toEqual(['all']);
  });
