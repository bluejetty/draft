// TWO CLICKS TO PLACE A POINT — every one after the first.
//
// Movie, 27 Sep: *"maybe we should change the method to make a point, was
// thinking rather than 1 click, 1 click will pre-position the point and and
// second click in same location within 1 second will confirm it, if they do
// something else it won't be placed. can we try that?"*
//
// AND THE RULING THAT SHAPES IT, asked and answered the same day: **not the
// first point, all the other points after it**, and **PC only** — the tablet
// keeps press-drag-lift rather than giving a tap a third meaning.
//
// That split is the whole design and it is not arbitrary. The first press of a
// run is deliberate: the drafter has armed a tool and is starting something.
// The presses after it come fast, one after another down a wall run, and a
// stray one drops a wall through the middle of a room. So the protection goes
// where the accidents are.
//
// ── WHAT THIS FILE HAS TO BE CAREFUL ABOUT ──────────────────────────────────
//
// EVERY CHECK ASKS THE DRAWING, NOT THE SCREEN. "The point was pre-positioned"
// and "the point was placed" look nearly identical on the canvas — the band
// is drawn either way — and the difference that matters is whether a WALL
// EXISTS. So the wall count is the witness for placement, and the canvas is
// asked only about the one thing no record can answer: whether the band froze.
//
// AND THE NEGATIVE CHECKS CARRY THEIR OWN POSITIVE. "One click places nothing"
// passes on a page where the wall tool is broken outright, so every check that
// asserts nothing was placed goes on to place something, in the same test.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
const MAIN_FL = 3;

// THE WINDOW AND THE SLOP, copied by hand from MODEL.html rather than read off
// the page. Asking the page what its window is and then checking it honoured
// that window is a tautology; these are the page's own two numbers written out
// a second time, so a change to either end has to be made twice and the
// failure names this file.
const CONFIRM_MS = 1000;
const CONFIRM_SLOP_PX = 6;

const base = extra => ({
  version: 1,
  levels: [{ id: 1, name: 'FOUNDATION', elev: -8 }, { id: MAIN_FL, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 1,
  board: 'drafting',
  walls: [
    ['n', V(-14, -14), V(14, -14)], ['e', V(14, -14), V(14, 14)],
    ['s', V(14, 14), V(-14, 14)], ['w', V(-14, 14), V(-14, -14)],
  ].map(([id, start, end]) => ({ id, start, end, levelId: MAIN_FL, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' })),
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
  ...extra,
});

const readout = page => page.locator('#readout');

// THE FOUR WALLS THE FIXTURE STARTS WITH are the baseline every count is read
// against, so a check says "five" and means "one more than the house".
const HOUSE_WALLS = 4;
const wallsNow = async page => Number(
  (await readout(page).textContent()).match(/walls (\d+)\/(\d+)/)?.[2] ?? -1);

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: base({}) });
  await page.goto(`/MODEL.html?level=${MAIN_FL}&view=plan&left=1`);
  await expect(readout(page)).toContainText('walls', { timeout: 10000 });
  await page.locator('[data-tool-key="wall"]').click();
  return h.planFrame(page);
}

// MOVE, THEN PRESS, ALWAYS. The instruments read the cursor and the confirm
// reads where the last press landed; Playwright's click() can put a press down
// with no move before it, which is not how a mouse works and would let a test
// pass on a page that is only correct under a robot.
const clickAt = async (page, f, x, z) => {
  const [px, py] = f.at(x, z);
  await page.mouse.move(px, py);
  await page.mouse.click(px, py);
  await page.waitForTimeout(50);
};

// A PRESS OFFSET BY PIXELS, not by feet, because the slop is a pixel rule: it
// is about a hand that drifts on a mouse mat, and a hand drifts the same
// distance whatever the drawing is zoomed to.
const clickOffsetPx = async (page, f, x, z, dx, dy) => {
  const [px, py] = f.at(x, z);
  await page.mouse.move(px + dx, py + dy);
  await page.mouse.click(px + dx, py + dy);
  await page.waitForTimeout(50);
};

test.describe('MODEL.html — a point is confirmed, not just clicked', () => {
  test('the first point takes one click; the second takes two', async ({ page }) => {
    const f = await open(page);

    // THE FIRST PRESS IS UNCHANGED, which is Movie's ruling and the half of
    // this feature that is about NOT doing something. The strip is the witness
    // rather than the wall count, because a first point commits nothing either
    // way — "wall — second point" is the page saying the anchor is down.
    await clickAt(page, f, 0, 0);
    await expect(page.locator('#strip-message')).toContainText('second point');
    expect(await wallsNow(page), 'an anchor is not a wall').toBe(HOUSE_WALLS);

    // ONE PRESS ON THE SECOND POINT PLACES NOTHING.
    await clickAt(page, f, 9, 0);
    expect(await wallsNow(page),
      'one press on the second point pre-positions it and builds nothing')
      .toBe(HOUSE_WALLS);

    // THE SECOND PRESS IN THE SAME PLACE BUILDS IT. Without this half the
    // check above is satisfied by a wall tool that does not work at all.
    await clickAt(page, f, 9, 0);
    expect(await wallsNow(page), 'the confirming press builds the wall')
      .toBe(HOUSE_WALLS + 1);
  });

  test('a press somewhere else is not a confirmation — it is a new pre-position',
    async ({ page }) => {
      const f = await open(page);
      await clickAt(page, f, 0, 0);

      // *"if they do something else it won't be placed"*. Two presses, both on
      // the second point, in two DIFFERENT places: the first pre-positions,
      // the second does not confirm it — it moves it.
      await clickAt(page, f, 9, 0);
      await clickAt(page, f, 0, 9);
      expect(await wallsNow(page),
        'two presses in two places are two pre-positions, not a placement')
        .toBe(HOUSE_WALLS);

      // AND THE PRE-POSITION MOVED WITH THE SECOND PRESS rather than being
      // thrown away: a third press where the SECOND one landed confirms.
      await clickAt(page, f, 0, 9);
      expect(await wallsNow(page), 'the second press became the pending point')
        .toBe(HOUSE_WALLS + 1);
    });

  test('a hand that drifts a pixel or two still confirms', async ({ page }) => {
    const f = await open(page);
    await clickAt(page, f, 0, 0);
    await clickAt(page, f, 9, 0);

    // THE SLOP IS THE FEATURE'S SURVIVAL. "Same location" read strictly means
    // the same device pixel, and no hand on a mouse hits the same pixel twice
    // — so a strict reading would make the gesture fail more often than it
    // worked, and the drafter would learn it as unreliable rather than as
    // careful. A press inside the slop is the same press.
    await clickOffsetPx(page, f, 9, 0, CONFIRM_SLOP_PX - 3, CONFIRM_SLOP_PX - 4);
    expect(await wallsNow(page), 'a press inside the slop is the same press')
      .toBe(HOUSE_WALLS + 1);

    // AND IT BUILT THE POINT THAT WAS AIMED, not the press that said yes.
    //
    // THIS IS WHAT THE SLOP COSTS IF IT IS GOT WRONG, and it is the reason
    // this half exists. The two presses are allowed to be six pixels apart --
    // that forgiveness is the only thing making the gesture usable by a hand
    // -- and six pixels is three and a half inches at the opening zoom, more
    // when zoomed in. A drafter aims, watches the line freeze exactly where
    // they want it, presses to accept THAT, and must not get a wall somewhere
    // else. The first press is the aim; the second is only the word yes.
    //
    // ASKED OF THE WALL'S RECORD, because that is the only place the
    // difference shows: both candidate endpoints are inside the same few
    // pixels, so no pixel check could tell them apart.
    // READ BACK OFF THE STORE, the way every other record check in this repo
    // reads one -- the page holds no test hook for the last wall and should
    // not grow one for this.
    await page.locator('#save').click();
    await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
    const walls = await page.evaluate(async bucket => {
      const file = await window.SharedFileStore.loadSharedFile(bucket);
      return JSON.parse(await file.text()).walls;
    }, BUCKET);
    const drawn = walls.find(w => String(w.id).startsWith('wall') || !'nesw'.includes(String(w.id)));
    expect(drawn, 'the wall the gesture built is in the file').toBeTruthy();
    expect({ x: Number(drawn.end.x.toFixed(4)), z: Number(drawn.end.z.toFixed(4)) },
      'the wall ends where the point was pre-positioned, not where the yes landed')
      .toEqual({ x: 9, z: 0 });
  });

  test('a press outside the slop is somewhere else', async ({ page }) => {
    const f = await open(page);
    await clickAt(page, f, 0, 0);
    await clickAt(page, f, 9, 0);

    // THE OTHER SIDE OF THE SAME RULE, and it is what stops the slop from
    // quietly becoming "anywhere". Without this check the slop could be
    // widened to the whole sheet and every check above would still pass.
    await clickOffsetPx(page, f, 9, 0, CONFIRM_SLOP_PX * 4, 0);
    expect(await wallsNow(page), 'a press outside the slop is a new pre-position')
      .toBe(HOUSE_WALLS);
  });

  test('the pending point goes out after a second', async ({ page }) => {
    const f = await open(page);
    await clickAt(page, f, 0, 0);
    await clickAt(page, f, 9, 0);

    // *"second click in same location within 1 second"*. Past the window the
    // pre-position is gone, so the next press is a fresh one and builds
    // nothing — which is the point: a drafter who clicked, looked away and
    // came back has not left a live trigger under their cursor.
    await page.waitForTimeout(CONFIRM_MS + 400);
    await clickAt(page, f, 9, 0);
    expect(await wallsNow(page),
      'a press after the window re-pre-positions rather than confirming')
      .toBe(HOUSE_WALLS);

    // AND THE FRESH PRE-POSITION IS LIVE, so the expiry dropped the pending
    // point rather than breaking the gesture.
    await clickAt(page, f, 9, 0);
    expect(await wallsNow(page), 'the fresh pre-position confirms normally')
      .toBe(HOUSE_WALLS + 1);
  });

  test('moving the cursor away drops the pending point', async ({ page }) => {
    const f = await open(page);
    await clickAt(page, f, 0, 0);
    await clickAt(page, f, 9, 0);

    // MOVING IS "SOMETHING ELSE" — the most ordinary something else there is.
    // A drafter who pre-positions a point and then takes the cursor off to look
    // at the other end of the wall has changed their mind about that point,
    // and coming back to press once more must not build a wall they had left
    // behind.
    await page.mouse.move(...f.at(-6, -6));
    await page.waitForTimeout(50);
    await clickAt(page, f, 9, 0);
    expect(await wallsNow(page),
      'the cursor leaving is something else, so the point was not placed')
      .toBe(HOUSE_WALLS);
  });

  test('Escape drops the pending point with the rest of the gesture',
    async ({ page }) => {
      const f = await open(page);
      await clickAt(page, f, 0, 0);
      await clickAt(page, f, 9, 0);

      // ESCAPE ALREADY PUTS DOWN EVERY HALF-TAKEN GESTURE ON THIS PAGE, and a
      // pending point is one. Left behind, it would be a trigger surviving the
      // run it belonged to: the drafter escapes, starts a new wall somewhere
      // else, and their first press lands on a stale confirmation.
      await page.keyboard.press('Escape');
      // READ ONCE, NOT POLLED, and that is the difference between this check
      // holding and this check being decorative. toContainText retries for
      // five seconds, and the confirm window is one -- so a page that left the
      // word on the strip would have it taken off by the window closing,
      // inside the poll, and the check would pass on exactly the bug it names.
      // Mutation found this: stopping Escape from clearing the point survived.
      expect(await page.locator('#strip-message').textContent(),
        'the strip must not still be asking for a press that was escaped')
        .toContain('first point');
      await clickAt(page, f, 9, 0);
      expect(await wallsNow(page),
        'after Escape the press is a fresh anchor, not a confirmation')
        .toBe(HOUSE_WALLS);
      await expect(page.locator('#strip-message')).toContainText('second point');
    });

  test('a finger still draws a wall in one press-drag-lift', async ({ page }) => {
    const f = await open(page);

    // PC ONLY, which is Movie's second ruling. §1 gave touch its own gesture —
    // press, drag, lift — and a tap already means two things there (set the
    // start, close the run). A third meaning is how a gesture becomes a guess.
    //
    // THE TOUCH PATH IS THE LIFT, not the press, so this drives it with a real
    // touch pointer rather than a mouse: a mouse drag would be read as a pan.
    const [ax, ay] = f.at(0, 0);
    const [bx, by] = f.at(9, 0);
    const touch = await page.context().newCDPSession(page);
    const send = (type, x, y) => touch.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
    });
    await send('touchStart', ax, ay);
    await send('touchMove', (ax + bx) / 2, (ay + by) / 2);
    await send('touchMove', bx, by);
    await send('touchEnd', bx, by);
    await page.waitForTimeout(120);

    expect(await wallsNow(page),
      'press-drag-lift builds a wall in one gesture, with no confirmation')
      .toBe(HOUSE_WALLS + 1);
  });
});
