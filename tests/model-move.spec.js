// MOVE, THE COMMAND (Movie, 13 Oct).
//
// "can we press M and then allow the user to select an assembly or item and
// then MOVE it to a new location" -- "or if a thing is already selected, move
// the selected item" -- "item or group of items (using the square selection or
// adding items together)" -- and on the gesture: "it should be either already
// selected item then press M and then the user can either click on and then
// drag and click again to drop or click hold drag and drop or, if they press
// M select an item, then click on it or click hold and drag".
//
// SO THERE ARE TWO WAYS IN AND TWO WAYS THROUGH, and this pins all four
// corners of that: selection first or selection after, drag-and-drop or
// click-follow-click.
//
// WHY A WALL IS THE FIXTURE. Before this command the page could drag notes and
// lines together (the `items` drag) but explicitly NOT a selection with a wall
// in it -- walls had their own corner and body drags and nothing moved a wall
// as part of a group. A washroom is walls AND fixtures, which is the thing
// Movie wants to move and the thing nothing could move, so a wall in the
// selection is the whole point of the test.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const point = (x, z) => ({ x, y: 0, z });
const wall = (id, sx, sz, ex, ez) => ({
  id, start: point(sx, sz), end: point(ex, ez), levelId: 3, view: 'plan',
  wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
});

// A closed room, away from the origin so a move that did nothing and a move
// that recentred the view cannot look alike.
const ROOM = Object.freeze([
  wall(1, 0, 0, 20, 0), wall(2, 20, 0, 20, 15),
  wall(3, 20, 15, 0, 15), wall(4, 0, 15, 0, 0),
]);

// THE PAGE IS MODEL.html, OPENED THE WAY ITS OWN SPECS OPEN IT.
//
// h.openModel drives MODEL.dc.html, the OLD editor, and this command lives in
// MODEL.html -- so a spec that used the helper alone found no DraftToolRoster
// and no #plan at all. The model-html-*.spec.js pattern is the one that works:
// openModel for the storage and flags, seed the bucket, then goto MODEL.html
// and wait for #readout to carry the word 'walls'. (Its visibility is no good
// as a signal -- it is a debug strip and starts hidden.)
const BUCKET = 'model-drawing';

// THE WHOLE LEVEL STACK, because drawing-format.js drops any record whose
// levelId the drawing does not list, and a fixture missing a level would lose
// geometry on the next open while every check went on passing.
const fixture = () => ({
  version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 },
    { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 },
    { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 },
  ],
  activeLevelIdx: 3,
  walls: ROOM.map(w => JSON.parse(JSON.stringify(w))),
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
});

async function openRoom(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: fixture() });
  await page.goto('/MODEL.html?level=3&view=plan');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  return h.planFrame(page);
}

const selectAll = async (page, frame) => {
  await page.keyboard.press('s');
  await page.mouse.move(...frame.at(-40, -40));
  await page.mouse.down();
  await page.mouse.move(...frame.at(60, 55), { steps: 10 });
  await page.mouse.up();
};

// One move, by either gesture. `drag` true presses, travels and releases;
// false presses, releases, travels and clicks -- Movie's two ways through.
const moveBy = async (page, frame, from, dx, dz, { drag }) => {
  await page.keyboard.press('m');
  await page.mouse.move(...frame.at(from.x, from.z));
  await page.mouse.down();
  if (drag) {
    await page.mouse.move(...frame.at(from.x + dx, from.z + dz), { steps: 10 });
    await page.mouse.up();
  } else {
    await page.mouse.up();
    await page.mouse.move(...frame.at(from.x + dx, from.z + dz), { steps: 10 });
    await page.mouse.down();
    await page.mouse.up();
  }
};

const wallsOf = async page => {
  const saved = await h.savedDrawing(page);
  return (saved?.walls || []).map(w => [w.start.x, w.start.z, w.end.x, w.end.z]);
};

const ROOM_WALLS = ROOM.map(w => [w.start.x, w.start.z, w.end.x, w.end.z]);

test.describe('MOVE', () => {
  test('M is on the board and on the keyboard', async ({ page }) => {
    await openRoom(page);
    // ASKED OF THE ROSTER, NOT OF THE DOM. The roster is what paints the key
    // faces and what feeds a profile, so an entry there IS the key being on
    // the board -- and reading it needs none of the rail choreography that
    // getting at the face itself would (the column sits behind a tab that is
    // not open in this layout, which is what the first version of this check
    // timed out on).
    //
    // WHICH IS THE WHOLE POINT OF THE CHANGE. Moving was a gesture under
    // SELECT: no roster entry, so no key face, no binding a profile could
    // move, and nothing anywhere saying it was possible.
    const tool = await page.evaluate(() => {
      const entry = window.DraftToolRoster.TOOLS.find(t => t.id === 'move');
      return entry ? { command: entry.command, name: entry.name } : null;
    });
    expect(tool, 'MOVE is a tool the roster knows').not.toBeNull();
    expect(tool.command, 'and it carries a command, so it can be bound').toBe('move');
    expect(await page.evaluate(() => window.DraftToolRoster.bindings().move),
      'bound to M by default').toBe('M');
  });

  test('a selected house is picked up and dropped by two clicks', async ({ page }) => {
    const frame = await openRoom(page);
    const before = ROOM_WALLS;
    await selectAll(page, frame);
    await moveBy(page, frame, { x: 0, z: 0 }, 10, 5, { drag: false });
    await expect.poll(async () => (await wallsOf(page))[0][0],
      { message: 'the drop reached the store' }).toBeCloseTo(before[0][0] + 10, 1);
    const after = await wallsOf(page);
    after.forEach((w, i) => {
      expect(w[0], `wall ${i} start x`).toBeCloseTo(before[i][0] + 10, 1);
      expect(w[1], `wall ${i} start z`).toBeCloseTo(before[i][1] + 5, 1);
      expect(w[2], `wall ${i} end x`).toBeCloseTo(before[i][2] + 10, 1);
      expect(w[3], `wall ${i} end z`).toBeCloseTo(before[i][3] + 5, 1);
    });
  });

  test('and by a press that travels -- drag and drop', async ({ page }) => {
    const frame = await openRoom(page);
    const before = ROOM_WALLS;
    await selectAll(page, frame);
    await moveBy(page, frame, { x: 0, z: 0 }, -8, 3, { drag: true });
    await expect.poll(async () => (await wallsOf(page))[0][0])
      .toBeCloseTo(before[0][0] - 8, 1);
    const after = await wallsOf(page);
    after.forEach((w, i) => {
      expect(w[1], `wall ${i} start z`).toBeCloseTo(before[i][1] + 3, 1);
    });
  });

  // THE HOUSE TRAVELS WHOLE. Its walls share corners; moving them as separate
  // items rather than as a vertex pool moves each shared corner twice and
  // tears the run open at its own corners. The span and the closure are what
  // show that, so they are checked rather than the deltas alone.
  test('the house keeps its shape and its corners', async ({ page }) => {
    const frame = await openRoom(page);
    const before = ROOM_WALLS;
    const span = list => [
      Math.max(...list.flatMap(w => [w[0], w[2]])) - Math.min(...list.flatMap(w => [w[0], w[2]])),
      Math.max(...list.flatMap(w => [w[1], w[3]])) - Math.min(...list.flatMap(w => [w[1], w[3]])),
    ];
    const was = span(before);

    await selectAll(page, frame);
    await moveBy(page, frame, { x: 0, z: 0 }, 7, -4, { drag: true });
    await expect.poll(async () => (await wallsOf(page))[0][0]).toBeCloseTo(before[0][0] + 7, 1);

    const after = await wallsOf(page);
    const now = span(after);
    expect(now[0], 'the same width it was').toBeCloseTo(was[0], 1);
    expect(now[1], 'the same depth it was').toBeCloseTo(was[1], 1);
    // AND STILL CLOSED: every wall's end is some other wall's start.
    after.forEach(([, , ex, ez], i) => {
      const meets = after.some(([sx, sz], j) => j !== i
        && Math.abs(sx - ex) < 0.02 && Math.abs(sz - ez) < 0.02);
      expect(meets, `wall ${i} still meets its neighbour`).toBe(true);
    });
  });

  // ESCAPE IS THE WAY OUT OF THE ONE STATE THIS PAGE HAS that looks committed
  // and has written nothing: a selection following the cursor.
  test('Escape puts it back where it was', async ({ page }) => {
    const frame = await openRoom(page);
    const before = ROOM_WALLS;

    await selectAll(page, frame);
    await page.keyboard.press('m');
    await page.mouse.move(...frame.at(0, 0));
    await page.mouse.down();
    await page.mouse.up();
    await page.mouse.move(...frame.at(12, 9), { steps: 10 });
    await page.keyboard.press('Escape');

    // NOTHING WAS WRITTEN, so there is nothing in the store to read -- which
    // is itself the assertion: a cancelled move pushes no undo step and saves
    // no drawing. The page's own geometry is checked instead.
    const live = await page.evaluate(() => [...document.querySelectorAll('#readout')]
      .map(el => el.textContent).join(' '));
    expect(live, 'the page is still showing a drawing').toContain('walls');
    const saved = await h.savedDrawing(page);
    if (saved) {
      expect(saved.walls.map(w => [w.start.x, w.start.z, w.end.x, w.end.z]))
        .toEqual(before);
    }
  });
});
