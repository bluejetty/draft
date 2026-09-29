// THE RIGHT MOUSE BUTTON — which had a job it was doing wrong, not no job.
//
// Movie, 27 Sep: *"do we have control over anything that happens when the
// right mouse button is clicked, could we make it do more things i don't think
// i've used the right click yet"*.
//
// HE HAD NOT USED IT BECAUSE IT HAD NOTHING TO USE. This page had no
// contextmenu handler at all, and pointerdown never asked which button was
// down — so a right-click PLACED A WALL POINT on its way to opening the
// browser's own menu over the drawing. Two wrong things at once, and the
// second hid the first.
//
// THE OLD PAGE HAD ALREADY RULED IT. MODEL.dc.html:11320's _onRightClick
// cancels every in-progress gesture and clears no selection; it was simply
// never ported.
//
// ── AND THE PART THAT WAS NOT IN THE REPORT ─────────────────────────────────
//
// Writing the cancel list down found that ESCAPE had been claiming more than
// it did. Its note says it puts down "every other half-taken gesture on this
// page"; it cleared the wall's anchor, the ruler's measure and the unfinished
// bone, and left the CUT's first press, the BEAM's anchor, the FLOOR's trace
// and the OUTLINE's trace exactly where they were. The only thing that ever
// cleared those was a tool change. So half the checks here are about Escape,
// not the right button — the two share one list now, and a list with two
// callers is a list a check can hold.
//
// WHAT IS MEASURED IS THE NEXT PRESS. "The gesture was cancelled" is not
// visible; what a drafter finds out is that their next click starts something
// new instead of finishing something old. So every check below cancels, then
// presses, and asks the DRAWING what the press did.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
const MAIN_FL = 3;

const base = () => ({
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
});

const readout = page => page.locator('#readout');
const HOUSE_WALLS = 4;
const wallsNow = async page => Number(
  (await readout(page).textContent()).match(/walls (\d+)\/(\d+)/)?.[2] ?? -1);

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: base() });
  await page.goto(`/MODEL.html?level=${MAIN_FL}&view=plan&left=1&lpane=build`);
  await expect(readout(page)).toContainText('walls', { timeout: 10000 });
  return h.planFrame(page);
}

const leftAt = async (page, f, x, z) => {
  const [px, py] = f.at(x, z);
  await page.mouse.move(px, py);
  await page.mouse.click(px, py);
  await page.waitForTimeout(60);
};

// THE RIGHT BUTTON THROUGH page.mouse, not a dispatched event, so the browser
// does what a browser does: pointerdown first, then contextmenu. A synthetic
// contextmenu would skip the pointerdown entirely — and the pointerdown is
// half of what is being tested.
const rightAt = async (page, f, x, z) => {
  const [px, py] = f.at(x, z);
  await page.mouse.move(px, py);
  await page.mouse.click(px, py, { button: 'right' });
  await page.waitForTimeout(60);
};

test.describe('MODEL.html — the right mouse button', () => {
  test('a right-click places nothing', async ({ page }) => {
    const f = await open(page);
    await page.locator('[data-tool-key="wall"]').click();

    await rightAt(page, f, 0, 0);
    // THE STRIP IS THE WITNESS, because an anchor is not a wall and the count
    // would not have moved either way. "wall — first point" is the page saying
    // no anchor is down.
    expect(await page.locator('#strip-message').textContent(),
      'the right button did not set an anchor')
      .toContain('first point');

    // AND THE LEFT ONE STILL DOES, or the check above passes on a page where
    // the wall tool is broken outright.
    await leftAt(page, f, 0, 0);
    expect(await page.locator('#strip-message').textContent(),
      'the left button still opens a run').toContain('second point');
  });

  test('and it opens no browser menu over the drawing', async ({ page }) => {
    const f = await open(page);
    // MEASURED AS THE EVENT BEING CANCELLED, which is the only thing a page
    // can control: the browser decides what to do with a contextmenu nobody
    // prevented, and preventDefault is the page's whole say in it.
    //
    // A LISTENER AND A GLOBAL, not an awaited promise, and that is this check
    // being wrong once. Holding an un-awaited page.evaluate across the click
    // and reading it after raced the navigation and reported "no contextmenu
    // fired" on a page that had prevented it perfectly well. Parked in a
    // global, the press and the reading are two plain steps.
    await page.evaluate(() => {
      window.__ctx = null;
      document.getElementById('plan').addEventListener('contextmenu',
        e => { window.__ctx = e.defaultPrevented; });
    });
    const [px, py] = f.at(0, 0);
    await page.mouse.click(px, py, { button: 'right' });
    await page.waitForTimeout(120);
    expect(await page.evaluate(() => window.__ctx),
      'the page took the press and stopped the browser menu').toBe(true);
  });

  test('it cancels a wall in hand, and the next press starts a new one',
    async ({ page }) => {
      const f = await open(page);
      await page.locator('[data-tool-key="wall"]').click();
      await leftAt(page, f, 0, 0);
      await expect(page.locator('#strip-message')).toContainText('second point');

      await rightAt(page, f, 5, 5);
      expect(await page.locator('#strip-message').textContent(),
        'the run was put down').toContain('first point');

      // THE PROOF IS THE NEXT WALL. A cancel that only changed the strip would
      // leave the anchor live, and these two presses would build a wall from
      // the ABANDONED start rather than from the first of them.
      await leftAt(page, f, -9, 0);
      await leftAt(page, f, 9, 0);
      expect(await wallsNow(page), 'one new wall').toBe(HOUSE_WALLS + 1);
      // AND IT RUNS BETWEEN THE TWO PRESSES, not from the abandoned anchor at
      // the origin -- which is the difference between a cancel and a strip
      // message about a cancel.
      await page.locator('#save').click();
      await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
      const walls = await page.evaluate(async bucket => {
        const file = await window.SharedFileStore.loadSharedFile(bucket);
        return JSON.parse(await file.text()).walls;
      }, BUCKET);
      const drawn = walls.find(w => !'nesw'.includes(String(w.id)));
      expect(drawn, 'the new wall is in the file').toBeTruthy();
      expect(Math.abs(Number(drawn.start.x)),
        'it starts at the first of the two presses, not at the abandoned anchor')
        .toBeCloseTo(9, 3);
    });

  test('the tool survives — the right button cancels the run, not the tool',
    async ({ page }) => {
      const f = await open(page);
      await page.locator('[data-tool-key="wall"]').click();
      await leftAt(page, f, 0, 0);
      await rightAt(page, f, 5, 5);
      // THE OLD PAGE'S RULE: _onRightClick puts down gestures and nothing
      // else. A drafter who was drawing walls is still drawing walls, the
      // same promise Escape makes.
      expect(await h.wallArmed(page), 'WALL is still armed').toBe(true);
    });

  test('and it clears no selection, which is what makes it not Escape',
    async ({ page }) => {
      const f = await open(page);
      await leftAt(page, f, 0, -14);   // select the north wall
      await expect(page.locator('[data-delete]')).toBeVisible();

      await rightAt(page, f, 5, 5);

      // THE SELECTION IS MEASURED BY USING IT, not by looking at the DELETE
      // button. That button's visibility is set inside paint(), so a page
      // that cleared the selection and skipped the repaint leaves it showing
      // -- and a check reading the button calls that a selection. Mutation
      // said so: adding `setSelection([])` to the right button survived,
      // because the early return skipped the paint that would have hidden it.
      //
      // Pressing Delete is what a drafter would do next, and the wall count
      // is what answers.
      const before = await wallsNow(page);
      await page.keyboard.press('Delete');
      await page.waitForTimeout(80);
      expect(await wallsNow(page),
        'the selection survived the right button — it is not Escape')
        .toBe(before - 1);

      // AND ESCAPE STILL TAKES IT, or the claim above is about a page where
      // nothing clears a selection at all.
      await leftAt(page, f, 14, 0);
      const held = await wallsNow(page);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(80);
      await page.keyboard.press('Delete');
      await page.waitForTimeout(80);
      expect(await wallsNow(page), 'Escape did clear it, so Delete found nothing')
        .toBe(held);
    });

  test('Escape puts down the FLOOR trace it always claimed to',
    async ({ page }) => {
      const f = await open(page);
      await page.goto(`/MODEL.html?level=${MAIN_FL}&view=floor&left=1&lpane=build`);
      await expect(readout(page)).toContainText('floors', { timeout: 10000 });
      const ff = await h.planFrame(page);
      await page.locator('[data-tool-key="floor"]').click();

      // THREE CORNERS DOWN, which is enough for the loop to be closeable --
      // so if the trace survives Escape, a fourth press near the first would
      // CLOSE it into a floor.
      await leftAt(page, ff, -6, -6);
      await leftAt(page, ff, 6, -6);
      await leftAt(page, ff, 6, 6);
      const before = Number(
        (await readout(page).textContent()).match(/floors (\d+)\/(\d+)/)?.[2] ?? -1);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(80);

      // THE TRACE IS GONE, and the witness is that closing is now impossible:
      // a press back at the first corner starts a fresh trace instead of
      // finishing the abandoned one, so no floor appears.
      await leftAt(page, ff, -6, -6);
      await page.waitForTimeout(80);
      const after = Number(
        (await readout(page).textContent()).match(/floors (\d+)\/(\d+)/)?.[2] ?? -1);
      expect(after, 'the abandoned trace did not close into a floor')
        .toBe(before);
    });

  test('and the CUT that was left half-placed', async ({ page }) => {
    const f = await open(page);
    // + CUT, NOT A RAIL KEY, AND THE RAIL STARTS SHUT. The cut tool has a
    // button of its own in the SECTIONS panel -- "+ CUT, AND NOT A KEY" as
    // the page's own note puts it -- behind the LEVELS / LAYERS tab. Reaching
    // for `[data-tool-key="cut"]` is how this check first spent three minutes
    // timing out on a control that does not exist, and forgetting the tab is
    // how it spent another three on one that was not open yet.
    await h.openModelRail(page);
    await page.locator('[data-add-cut]').click();
    await expect(page.locator('#strip-message')).toContainText(/cut/i);
    await leftAt(page, f, -9, 0);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(80);

    // A CUT TAKES THREE PRESSES -- start, end, then a side to look from. With
    // the first press cancelled, two more cannot finish one, so the rail must
    // still be saying it has none.
    //
    // THE "NO SECTIONS" LINE IS THE WITNESS, and picking it took two goes.
    // Counting `[data-seat^="S"]` matched nothing either way, so the check
    // compared zero against zero and the mutation that lets a cut survive the
    // cancel passed clean. This line is the rail's own statement about itself
    // and goes the moment a section exists.
    const none = page.locator('[data-no-sections]');
    await expect(none, 'the fixture starts with no sections').toBeVisible();
    await leftAt(page, f, 9, 0);
    await leftAt(page, f, 9, 6);
    await page.waitForTimeout(150);
    await expect(none, 'the abandoned cut did not finish itself').toBeVisible();
  });
});
