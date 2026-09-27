// TURNING THE HOUSE, from the button.
//
// Movie, 27 Sep: *"can we add a HOUSE ROTATE function (maybe in instruments
// panel top on the right side ... Make it rotate the actual model space so the
// E1 E2 etc all rotate. make the rotations 90degrees don't allow in between"*,
// and the sentence that settles what it means: *"the front view E1 will stay
// as the same view but the house and the E1-E4 lines will rotate"*.
//
// THE ARITHMETIC IS PROVED OFFLINE. plan-rotate-harness walks a drawing and
// names any record that did not turn, and checks that every elevation still
// reads the wall it read before. What it cannot say is whether the BUTTON
// reaches any of it -- so these are the claims a page can answer:
//
//   THE PRESS TURNS THE DRAWING     and the store has it afterwards, not just
//                                   the screen
//   QUARTERS ONLY                   four presses is the house back as drawn
//   E1 KEEPS ITS WALL               measured through the page's own marks
//   AND THE VIEW FOLLOWS            a house turned onto its side is re-framed
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-garage-house.draft'), 'utf8'));

// MODEL.html, whose canvas is #plan -- helpers' openModel opens the older page.
async function openSheet(page) {
  await h.suppressEntryCoach(page);
  await page.goto('/MODEL.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: REPRO });
  await page.goto('/MODEL.html');
  await page.waitForFunction(() => {
    const el = document.getElementById('plan');
    return el && el.getAttribute('data-view');
  }, null, { timeout: 15000 });
}

// WHAT THE PAGE IS HOLDING, fetched through SAVE. A press marks the drawing
// dirty rather than writing it, so pressing SAVE is the one gesture that puts
// what the page holds into the store -- and reading it from there beats a
// probe attribute carrying a copy of every wall on every frame.
const savedNow = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    return JSON.parse(await file.text());
  }, BUCKET);
};

// WHICH WALL EACH ELEVATION READS, from the page's own mark placement and the
// drawing it just saved. Nothing here re-derives either.
// THE MARKS THE PAGE IS DRAWING, off the attribute paint() publishes -- NOT
// re-derived here. Asked the other way round this check computes the right
// answer while the page draws the wrong one: the mutant that stopped MODEL
// passing the turn through to its own mark placement survived a spec that
// called DraftCutMarks itself with the saved drawing's turn.
const reading = (page, drawing) => page.evaluate(d => {
  const raw = document.getElementById('plan').getAttribute('data-e-marks');
  if (!raw) return null;
  const cuts = JSON.parse(raw).map(m => ({ id: m.id,
    startPt: { x: m.a[0], z: m.a[1] }, endPt: { x: m.b[0], z: m.b[1] },
    dirVec: { x: m.d[0], z: m.d[1] } }));
  const nearest = cut => {
    const mid = { x: (cut.startPt.x + cut.endPt.x) / 2,
      z: (cut.startPt.z + cut.endPt.z) / 2 };
    const along = { x: cut.endPt.x - cut.startPt.x, z: cut.endPt.z - cut.startPt.z };
    const len = Math.hypot(along.x, along.z) || 1;
    const n = { x: -along.z / len, z: along.x / len };
    let best = null, at = Infinity;
    (d.walls || []).filter(w => Number(w.levelId) > 0 && w.view !== 'foundation')
      .forEach(w => {
        const c = { x: (w.start.x + w.end.x) / 2, z: (w.start.z + w.end.z) / 2 };
        const off = Math.abs((c.x - mid.x) * n.x + (c.z - mid.z) * n.z);
        if (off < at) { at = off; best = w.id; }
      });
    return best;
  };
  return { seen: Object.fromEntries(cuts.map(cut => [cut.id, nearest(cut)])), cuts };
}, drawing);

test('the strip carries a house-rotate button, and it turns the house a quarter',
  async ({ page }) => {
    await openSheet(page);
    const button = page.locator('#strip-rotate');
    await expect(button, 'the instrument is on the strip').toBeVisible();
    await expect(button).toHaveAttribute('title', /quarter turn/i);

    // THE WALLS BEFORE, off the page's own state through SAVE -- which is the
    // one gesture that puts what the page holds into the store.
    const wallsNow = async () => {
      const saved = await savedNow(page);
      return { turn: saved.planTurn || 0,
        walls: (saved.walls || []).map(w => ({ id: w.id,
          x: Math.round(w.start.x * 100) / 100, z: Math.round(w.start.z * 100) / 100 })) };
    };

    const before = await wallsNow();
    expect(before.walls.length, 'the fixture has walls to turn').toBeGreaterThan(0);
    expect(before.turn, 'and has not been turned yet').toBe(0);

    await button.click();
    const after = await wallsNow();
    expect(after.turn, 'one press is one quarter').toBe(1);
    const moved = after.walls.filter((w, i) =>
      w.x !== before.walls[i].x || w.z !== before.walls[i].z);
    expect(moved.length, 'and every wall moved').toBe(before.walls.length);

    // QUARTERS ONLY, which is his rule: "make the rotations 90degrees don't
    // allow in between". Three more presses is the house as it was drawn.
    await button.click();
    await button.click();
    await button.click();
    const round = await wallsNow();
    expect(round.turn, 'four presses is back to none').toBe(0);
    expect(round.walls, 'and the house is where it was drawn')
      .toEqual(before.walls);
  });

test('E1 keeps its own wall, and the view follows the house round',
  async ({ page }) => {
    await openSheet(page);

    const was = await reading(page, await savedNow(page));
    expect(was, 'the page publishes what it is holding').not.toBeNull();
    expect(Object.keys(was.seen).length, 'four elevations').toBe(4);

    await page.locator('#strip-rotate').click();
    const now = await reading(page, await savedNow(page));
    // THE SENTENCE, CHECKED: "the front view E1 will stay as the same view but
    // the house and the E1-E4 lines will rotate".
    expect(now.seen, 'every elevation still reads the wall it was reading')
      .toEqual(was.seen);
    // AND THE MARKS ACTUALLY MOVED -- an elevation reading the same wall
    // because nothing turned would pass the line above.
    const stood = now.cuts.filter((cut, i) =>
      Math.abs(cut.startPt.x - was.cuts[i].startPt.x) < 0.5
      && Math.abs(cut.startPt.z - was.cuts[i].startPt.z) < 0.5);
    expect(stood, 'and every mark moved to a new side of the plan').toEqual([]);

    // AND THE CAMERA MOVED WITH IT. A house turned onto its side that kept the
    // old frame runs off the sheet, which is the whole reason he wants the
    // press: "depending on length of house so it fits on the layout pages
    // nicer".
    const frame = await h.planFrame(page);
    const off = now.cuts.flatMap(cut => [cut.startPt, cut.endPt]).filter(pt => {
      const [x, y] = frame.at(pt.x, pt.z);
      return x < frame.box.x || x > frame.box.x + frame.box.width
        || y < frame.box.y || y > frame.box.y + frame.box.height;
    });
    expect(off, 'the turned house is still framed, marks and all').toEqual([]);
  });
