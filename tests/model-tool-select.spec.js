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
const STUB_E = -2;    // w-stub's east end -- interior, so a press cannot miss
const STUB_Z = -7;

const FIXTURE = {
  version: 1,
  // TWO LEVELS, because ALL LEVELS has to have somewhere to reach. With one
  // level, 'window' and 'window-all' return the same set and a build that
  // ignored the mode entirely would pass.
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }, { id: 5, name: '2ND FL', elev: 9 }],
  activeLevelIdx: 0,
  walls: [
    ['w-n', V(-WALL, -WALL), V(WALL, -WALL)],
    ['w-e', V(WALL, -WALL), V(WALL, WALL)],
    ['w-s', V(WALL, WALL), V(-WALL, WALL)],
    ['w-w', V(-WALL, WALL), V(-WALL, -WALL)],
    // A STUB IN THE TOP-LEFT, short enough that a small box holds one end and
    // not the other. The square's own walls run corner to corner, so no box
    // that stays on the canvas can hold exactly one of their ends -- and
    // without such a box, `&&` and `||` in the enclosure test behave
    // identically and the mutation for it cannot be caught.
    ['w-stub', V(-8, -7), V(-2, -7)],
  ].map(([id, start, end]) => ({
    id, start, end, levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
  })),
  lines: [{
    id: 'l-probe', start: V(-4, LINE_Z), end: V(4, LINE_Z),
    levelId: 3, view: 'plan', layer: 'draft', bulge: 0,
  }, {
    // Upstairs, inside the same box, so ALL LEVELS catches it and WINDOW does
    // not. A line rather than a wall: it keeps the DELETE button (which means
    // "exactly one wall") out of the reading.
    id: 'l-upstairs', start: V(-3, -3), end: V(3, -3),
    levelId: 5, view: 'plan', layer: 'draft', bulge: 0,
  }],
  // A FLOOR THE WINDOW CAN HALF-CATCH. Without one, the mutation "a floor only
  // needs one corner in the box" cannot be caught by anything -- the fixture
  // had no floors, so the floor branch of the enclosure test was never run.
  // It straddles the origin so a box over one quadrant holds some corners and
  // not others.
  floors: [{
    // SMALL ENOUGH THAT A BOX ROUND IT STAYS ON THE CANVAS. fit() zooms so
    // ±10ft nearly fills the height, which leaves about ±11.6ft of reachable
    // sheet; a box out at ±12 begins off-screen where the mouse cannot press.
    id: 'f-probe', levelId: 3, view: 'floor',
    points: [V(-5, -5), V(5, -5), V(5, 5), V(-5, 5)],
  }],
  roofs: [], fenestrations: [], dimensions: [], outlines: [],
  shapes: [], surfaceOpenings: [], stairs: [], notes: [], roomTags: [],
  columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
  // A DRAFTING BOARD, NAMED. §6 gives TOY a walls-only tool column and puts the
  // rest away, and the page now defaults to TOY -- so every open() here waited
  // on a button that is correctly absent, at three minutes a test. That is what
  // cancelled CI shard 3 after forty minutes, twice, with no failure text on
  // the PR to say why.
  //
  // These suites are about what the tool does once the drafter has it, not
  // about which board offers it. §6's own gate owns that question. So the board
  // is stated rather than inherited, which is the same correction the strip,
  // shell and seats checks needed.
  board: 'drafting',
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
// A press, a move, a release -- the gesture a window is. The intermediate move
// matters: the band arms past 4px of travel, and a down/up with nothing in
// between is a click, not a box.
async function dragBox(page, from, to, { shift = false } = {}) {
  const a = await at(page, ...from);
  const b = await at(page, ...to);
  if (shift) await page.keyboard.down('Shift');
  await page.mouse.move(...a);
  await page.mouse.down();
  await page.mouse.move((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  await page.mouse.move(...b);
  await page.mouse.up();
  if (shift) await page.keyboard.up('Shift');
  await page.waitForTimeout(100);
}

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

    // Under ALL the line at z = 0 is selectable. DELETE is the page's own
    // tell for "something is selected" -- §7c widened it from a wall-only
    // button to one verb over the whole selection, so a picked LINE shows it
    // now where a wall-only DELETE stayed hidden.
    await page.mouse.click(...await at(page, 0, LINE_Z));
    await page.waitForTimeout(80);
    await expect(page.locator('[data-delete]')).toBeVisible();
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
    await expect(page.locator('[data-delete]')).toBeVisible();
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

  // The corner handles go with it: two walls selected is no longer "one
  // wall", so the corner grab stands down. DELETE does NOT -- it takes the
  // whole selection now, and a verb that hid the moment a second item was
  // picked was the wall-only button's limit, not a rule about deleting.
  await expect(page.locator('[data-delete]')).toBeVisible();

  await page.mouse.click(...await at(page, 0, WALL));
  await page.waitForTimeout(60);
  await page.keyboard.up('Shift');
  expect(await selCount(page),
    'shift on a selected item removes it').toBe(1);
});

// WHAT THE WIDENED DELETE STOPPED OBSERVING, restored as the behaviour itself.
//
// The two assertions above read `[data-delete-wall]` and were correct to
// change: §7c made DELETE one verb over the whole selection, so "hidden for a
// line" and "hidden for two walls" were facts about the OLD wall-only button,
// not rules about deleting. But that button's visibility was doing a second
// job -- the comment said so in as many words, "the page's own tell for
// exactly one wall is selected" -- and only the first job was replaced.
//
// So the claim went quiet: `cornerAt()` returns null unless selectedWall()
// finds exactly one wall (MODEL.html:4319), and after the swap nothing watched
// it. The handles are painted on the CANVAS, which is why a DOM button was
// standing in for them; the grab they advertise is not, so the honest
// substitute is to try the grab and see that it does nothing.
//
// THE CONTROL IS THE POINT. "The corner did not move" is also what a drag that
// missed the corner entirely looks like, and what a page with no corner drag
// at all looks like -- so the same gesture runs with ONE wall selected and
// must move it. Without that half this passes on a page where nothing drags.
test('two walls selected: the corner grab stands down, one wall: it still grabs',
  async ({ page }) => {
    // SAVED THROUGH THE PAGE'S OWN BUTTON rather than h.waitForSaved, which
    // waits on [data-model-status] -- the DC page's element. This page carries
    // the status ON the SAVE button (data-save-status) since the chrome shell.
    const cornerZ = async (page, x, z) => {
      await page.locator('[data-model-save]').click();
      await expect(page.locator('[data-model-save]'))
        .toHaveText(/saved/i, { timeout: 6000 });
      const d = await h.savedDrawing(page);
      const pt = (d.walls || []).flatMap(w => [w.start, w.end])
        .find(p => Math.hypot(p.x - x, p.z - z) < 0.75);
      return pt || null;
    };

    // ONE WALL FIRST, so the control is measured on the same fixture and the
    // same corner before anything is added to the selection.
    await open(page);
    await page.mouse.click(...await at(page, -5, STUB_Z));   // on w-stub
    await page.waitForTimeout(60);
    expect(await selCount(page), 'one wall selected').toBe(1);

    // THE STUB'S EAST END, not the square's corner. The square runs to the very
    // edge of the fitted view, so its corners land on -- or under -- the page's
    // own top chrome, and a press that misses is indistinguishable from a grab
    // that stood down. w-stub is interior by construction; the fixture already
    // put it there for a neighbouring reason.
    const from = await at(page, STUB_E, STUB_Z);
    await page.mouse.move(...from);
    await page.mouse.down();
    await page.mouse.move(from[0], from[1] - 40, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(120);
    expect(await cornerZ(page, STUB_E, STUB_Z),
      'CONTROL: with one wall selected the corner drag moves the corner, so a '
      + 'point is no longer sitting at the place it started').toBe(null);

    // NOW TWO. Fresh page: the drag above moved the drawing.
    await open(page);
    await page.mouse.click(...await at(page, -5, STUB_Z));   // w-stub
    await page.waitForTimeout(60);
    await page.keyboard.down('Shift');
    await page.mouse.click(...await at(page, 0, WALL));      // and a second wall
    await page.keyboard.up('Shift');
    await page.waitForTimeout(60);
    expect(await selCount(page), 'two walls selected').toBe(2);

    await page.mouse.move(...from);
    await page.mouse.down();
    await page.mouse.move(from[0], from[1] - 40, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(120);
    expect(await cornerZ(page, STUB_E, STUB_Z),
      'with two walls selected cornerAt() offers no handle, so the same drag '
      + 'must leave the corner exactly where it was').not.toBe(null);
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

test('a window takes what it fully encloses, not what it crosses',
  async ({ page }) => {
    await open(page);
    await page.locator('[data-sel-mode="window"]').click();

    // This box runs out past the WEST wall, so it CONTAINS a stretch of that
    // wall while enclosing neither of its endpoints (which sit at z = ±10,
    // outside the box's z range). Fully enclosed is the old page's rule
    // (_handleWindowSelection :18282); a crossing window is a different tool
    // it has not built.
    //
    // TWO COORDINATE TRAPS PAID FOR HERE, both of which produced "the window
    // selects nothing" when the window was fine and the DRAG never started:
    //
    //   - fit() takes its zoom from whichever axis is tighter, which on a
    //     square drawing in a landscape viewport is the HEIGHT. So ±10ft fills
    //     most of the vertical and a box reaching z = -12 begins above the
    //     canvas, where the mouse cannot press.
    //   - AND THE OPEN TOOL COLUMN COVERS THE LEFT OF THE DRAWING. Pressing at
    //     world (-12, -6) with `?left=1` lands on the panel, not the canvas.
    //     Reversing the drag fixes it because only the START has to be on the
    //     canvas -- which is also a real thing about the page, not just this
    //     test: see RD-DOCUMENTS for what the column costs in drawing area.
    //
    // So the drag runs bottom-right to top-left. Same box, same rule.
    await dragBox(page, [6, 6], [-12, -6]);
    expect(await selCount(page),
      'the probe line is enclosed; the west wall is only crossed').toBe(1);
  });

test('one end of a wall inside the box is not enough', async ({ page }) => {
  // THE MUTATION GATE FOUND THE CHECK ABOVE TOO WEAK. Its box encloses NEITHER
  // end of the west wall, so a build that took anything with EITHER end inside
  // -- `||` where the rule says `&&` -- behaved identically and the mutant
  // lived. The distinction only shows on a box holding exactly one end, which
  // is what the stub wall in the fixture exists for.
  await open(page);
  await page.locator('[data-sel-mode="window"]').click();

  // The stub runs (-8,-7) to (-2,-7). This box holds the first end only.
  await dragBox(page, [-5, -5], [-10, -9]);
  expect(await selCount(page),
    'one end in, one end out: the wall stays behind').toBe(0);

  // And the whole stub does come, or "takes nothing" would satisfy the line
  // above just as well.
  await dragBox(page, [0, -5], [-10, -9]);
  expect(await selCount(page), 'both ends in: the wall comes').toBe(1);
});

test('a floor comes only when every corner is in the box', async ({ page }) => {
  // Same hole, one type over: the fixture had no floors, so the floor branch
  // of the enclosure test ran in no check at all and "some corner" passed for
  // "every corner".
  //
  // DRIVEN IN ALL LEVELS MODE, and that is not a dodge. A floor carries
  // `view: 'floor'`, so floors() -- which filters to the view on screen --
  // holds none of them in PLAN, and a window over the current level correctly
  // finds nothing. window-all reads the raw collection, exactly as the old
  // page's `this._floors` does, which is where the floor branch actually runs.
  await open(page);
  await page.locator('[data-sel-mode="window-all"]').click();

  // The floor spans ±5. This box holds one of its four corners.
  await dragBox(page, [0, 0], [7, 7]);
  expect(await selCount(page), 'a quarter of a floor is not a floor').toBe(0);

  // And all four, with both lines.
  await dragBox(page, [7, 7], [-7, -7]);
  expect(await selCount(page), 'the floor and the two lines').toBe(3);
});

test('ALL LEVELS reaches upstairs and WINDOW does not', async ({ page }) => {
  await open(page);

  await page.locator('[data-sel-mode="window"]').click();
  await dragBox(page, [-6, -6], [6, 6]);
  expect(await selCount(page), 'WINDOW is this level only').toBe(1);

  await page.locator('[data-sel-mode="window-all"]').click();
  await dragBox(page, [-6, -6], [6, 6]);
  // THREE, and the third is worth naming: the upstairs line, plus the FLOOR,
  // which window-all reaches because it reads the raw collection rather than
  // what is painted in PLAN. Same box, same drag -- the mode is the only thing
  // that changed, and it went from one to three.
  expect(await selCount(page),
    'ALL LEVELS also takes the line upstairs and the floor').toBe(3);
});

test('the OBJECT TYPE filter restricts a window too', async ({ page }) => {
  await open(page);
  await page.locator('[data-sel-mode="window"]').click();
  await page.locator('[data-sel-filter="wall"]').click();

  // WALL engaged and the only enclosed thing is a line.
  await dragBox(page, [-6, -6], [6, 6]);
  expect(await selCount(page)).toBe(0);

  await page.locator('[data-sel-filter="line"]').click();
  await dragBox(page, [-6, -6], [6, 6]);
  expect(await selCount(page), 'LINE engaged, and a line is what is in there')
    .toBe(1);
});

test('a window with OUTLINE engaged selects nothing, on purpose',
  async ({ page }) => {
    // THE OLD PAGE'S BEHAVIOUR, not an omission. Its window reaches lines,
    // walls, floors and dimensions; outlines are click-only. Written down as a
    // check because "the window is broken" and "outlines were never in a
    // window" look identical from the outside.
    await open(page);
    await page.locator('[data-sel-mode="window"]').click();
    await page.locator('[data-sel-filter="outline"]').click();
    await dragBox(page, [-12, -12], [12, 12]);
    expect(await selCount(page)).toBe(0);
  });

test('shift-drag adds to the selection instead of replacing it',
  async ({ page }) => {
    await open(page);
    await page.mouse.click(...await at(page, 0, -WALL));
    await page.waitForTimeout(60);
    expect(await selCount(page)).toBe(1);

    await page.locator('[data-sel-mode="window"]').click();
    await dragBox(page, [-6, -6], [6, 6], { shift: true });
    expect(await selCount(page), 'the wall stays, the line joins it').toBe(2);

    // And without shift it replaces, or "adds" is indistinguishable from
    // "always adds".
    await dragBox(page, [-6, -6], [6, 6]);
    expect(await selCount(page), 'no shift replaces').toBe(1);
  });

test('a tap in a window mode still selects, without drawing a box',
  async ({ page }) => {
    // The old page runs its click handler for "a clean click (no drag) in
    // select mode" whichever window mode is armed. Without this a drafter who
    // left WINDOW on could not pick a single item at all.
    await open(page);
    await page.locator('[data-sel-mode="window-all"]').click();
    await page.mouse.click(...await at(page, 0, LINE_Z));
    await page.waitForTimeout(80);
    expect(await selCount(page)).toBe(1);
  });
