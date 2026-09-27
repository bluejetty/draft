// WHAT THE MODEL SPACE FRAMES WHEN IT OPENS.
//
// Movie, 27 Sep: *"can you adjust the 'default' opening window of model space
// to zoom to a position so that the E1 - E4 lines have extra space to the top
// bottom and sidemenus"*.
//
// TWO THINGS WERE WRONG AND THEY ARE DIFFERENT THINGS. fit() measured walls,
// lines and floors -- the HOUSE -- so the ring of elevation marks standing off
// it fell outside the frame. And chromeInsets() counted the two BARS and not
// the three RAIL TABS, so the width was taken whole and the marks on the left
// and right ran under DRAFTING TOOLS and LEVELS / LAYERS.
//
// ASKED OF THE PAGE'S OWN CAMERA AND THE PAGE'S OWN MARKS. `data-view` is the
// camera paint() published, read through planFrame; the ring comes from
// calling DraftCutMarks.autoElevationCuts IN the page with the page's own
// walls and dimensions. Neither is re-derived here -- a second copy of either
// is how a spec and its page drift apart, and helpers.js already carries the
// note about what that drift cost.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const fs = require('fs');
const path = require('path');

const BUCKET = 'model-drawing';
// A HOUSE TO FRAME, and a real one. fit() with nothing on the sheet falls back
// to scale 6 at the world origin -- which would pass every claim below by
// having no marks to place. repro-garage-house carries 24 walls and 60
// dimension strings, and the mark ring is a function of that dimension stack.
const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-garage-house.draft'), 'utf8'));

// MODEL.html, NOT MODEL.dc.html. helpers' openModel opens the older page, whose
// canvas is [data-model-canvas]; this is the ported one, whose canvas is #plan
// and whose fit() is the one under test. Getting that wrong is a spec that
// times out waiting for an element the page it opened does not have.
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

// WHERE THE CHROME IS, read off the elements rather than assumed -- a tab that
// is hidden takes no room, which is the rule chromeInsets follows too.
const chromeRects = page => page.evaluate(() => {
  const box = id => {
    const el = document.getElementById(id);
    if (!el || el.hidden) return null;
    const r = el.getBoundingClientRect();
    return (r.width > 0 && r.height > 0)
      ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom } : null;
  };
  return ['strip', 'house-strip', 'left-tab', 'right-tab', 'previews-tab']
    .map(id => ({ id, r: box(id) })).filter(entry => entry.r);
});

test('the model space opens framed on the elevation marks, clear of the chrome',
  async ({ page }) => {
    await openSheet(page);
    const saved = await page.evaluate(async bucket => {
      const file = await window.SharedFileStore.loadSharedFile(bucket);
      return file ? JSON.parse(await file.text()) : null;
    }, BUCKET);
    expect(saved && (saved.walls || []).length,
      'the fixture put a house on the sheet').toBeGreaterThan(0);

    // THE MARKS THE PAGE WOULD DRAW, from the page's own module and the page's
    // own drawing. The ring is a function of the walls and the dimension
    // stack, and this calls the function rather than copying it.
    const cuts = await page.evaluate(drawing => {
      const M = window.DraftCutMarks;
      if (!M || !M.autoElevationCuts) return { error: 'cut-marks is not loaded' };
      return { cuts: M.autoElevationCuts({
        walls: drawing.walls || [],
        dimensions: drawing.dimensions || [],
        elevationMarkOffsets: drawing.elevationMarkOffsets || {},
        autoElevations: true,
      }) };
    }, saved);

    // THE FIXTURE'S OWN REACH: a spec that could not find the marks would pass
    // every claim below by having nothing to check.
    expect(cuts.error, `could not place the marks: ${cuts.error}`).toBeUndefined();
    expect(cuts.cuts.length, 'four standard elevations to frame').toBe(4);

    const frame = await h.planFrame(page);
    const chrome = await chromeRects(page);
    expect(chrome.length, 'the bars and tabs are on screen to be cleared')
      .toBeGreaterThan(1);

    // EVERY END OF EVERY MARK LINE, because a line with one end on the sheet is
    // a line running off it.
    const offSheet = [];
    const underChrome = [];
    cuts.cuts.flatMap(cut => [cut.startPt, cut.endPt]).forEach(pt => {
      const [x, y] = frame.at(pt.x, pt.z);
      if (x < frame.box.x || x > frame.box.x + frame.box.width
        || y < frame.box.y || y > frame.box.y + frame.box.height) {
        offSheet.push(`${x.toFixed(0)},${y.toFixed(0)}`);
        return;
      }
      const hit = chrome.find(entry => x >= entry.r.left && x <= entry.r.right
        && y >= entry.r.top && y <= entry.r.bottom);
      if (hit) underChrome.push(`${hit.id} at ${x.toFixed(0)},${y.toFixed(0)}`);
    });
    expect(offSheet, 'no mark runs off the canvas').toEqual([]);
    expect(underChrome, 'and none of them is under a bar or a rail tab').toEqual([]);
  });
