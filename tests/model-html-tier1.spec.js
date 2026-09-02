// MODEL.html TIER 1 — can a page with no framework read the real drawing and
// paint it with the real painters?
//
// This is a MEASUREMENT, not a feature. The 6-10 week migration estimate has
// two halves: the module half, which has numbers behind it (all seventeen load
// under plain node), and the page half, which had none at all. Fifteen
// thousand stateful lines nobody had tried to move. This spec is the first
// evidence for that half, and it is deliberately the smallest honest question:
// walls on screen, from a drawing the OLD page saved, through the SAME
// painters, with React and the DC runtime absent.
//
// It reads and never writes. MODEL.html has no save path at all, so a tier-1
// bug cannot cost anyone a drawing.
//
// The old page stays authoritative throughout: index.html still points at
// MODEL.dc.html and nothing here changes that. When these tests grow to cover
// what a drafter actually does, the swap is two hrefs.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const readout = page => page.locator('#readout');
const notice = page => page.locator('#notice');

// TWO different measurements, and conflating them cost this spec its first
// green: `paintGrid` draws too, so "is there ink on the canvas" answers yes on
// a page that read the file and painted no walls at all. Proven by mutation --
// with `paintWalls()` deleted, the original assertion still passed.
//
// So walls are counted by COLOUR. drawWallSeg2D fills #ffffff, rgb(182,182,182)
// and rgb(205,228,248); the grid is #26292a and #34383a, plan lines are #7f8688
// and the floor wash sits just off the #1d1f20 ground. Nothing but a wall puts
// a red channel above 170 on this page.
async function wallInk(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById('plan');
    const { data } = canvas.getContext('2d')
      .getImageData(0, 0, canvas.width, canvas.height);
    let ink = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] >= 170) ink += 1;
    return ink;
  });
}

// Any ink at all, for the empty state -- where the assertion is that the page
// drew NOTHING, and the grid counts against that just as much as a wall would.
async function anyInk(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById('plan');
    const { data } = canvas.getContext('2d')
      .getImageData(0, 0, canvas.width, canvas.height);
    let ink = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i] - 0x1d) > 8 || Math.abs(data[i + 1] - 0x1f) > 8
        || Math.abs(data[i + 2] - 0x20) > 8) ink += 1;
    }
    return ink;
  });
}

const scaleNow = page => page.evaluate(() => {
  const m = document.getElementById('readout').textContent.match(/scale ([\d.]+)/);
  return m ? Number(m[1]) : null;
});

// Build a house on the OLD page, exactly as a first-time user does, then hand
// the same origin to the new one. Same origin is the whole point: IndexedDB is
// per-origin, so this is the real handover and not a fixture.
async function houseOnOldPage(page) {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);
  expect(saved.walls.length).toBeGreaterThan(0);
  return saved;
}

test.describe('MODEL.html tier 1', () => {
  test('reads the drawing MODEL.dc.html saved, and paints the walls', async ({ page }) => {
    const saved = await houseOnOldPage(page);

    await page.goto('/MODEL.html');
    await expect(readout(page)).toContainText('walls', { timeout: 5000 });

    // Same walls. Not "some walls" -- the count the old page wrote.
    await expect(readout(page)).toContainText(`walls ${saved.walls.length}`);
    await expect(notice(page)).not.toHaveClass(/show/);

    // And the WALLS are actually on the canvas -- not merely the grid.
    expect(await wallInk(page)).toBeGreaterThan(400);
  });

  test('no framework is present: React and the DC runtime never load', async ({ page }) => {
    await houseOnOldPage(page);
    await page.goto('/MODEL.html');
    await expect(readout(page)).toContainText('walls', { timeout: 5000 });

    // The point of the exercise. If either of these is defined the page is not
    // measuring what it claims to measure.
    const frameworks = await page.evaluate(() => ({
      react: typeof window.React,
      reactDom: typeof window.ReactDOM,
      dc: document.querySelectorAll('x-dc, [data-dc-script]').length,
      scripts: Array.from(document.scripts)
        .map(s => s.getAttribute('src')).filter(Boolean),
    }));
    expect(frameworks.react).toBe('undefined');
    expect(frameworks.reactDom).toBe('undefined');
    expect(frameworks.dc).toBe(0);
    expect(frameworks.scripts).not.toContain('./support.js');

    // Four dependencies, and the list is the finding: render-2d.js reaches for
    // no globals, so the wall painter costs one module.
    expect(frameworks.scripts).toEqual([
      './shared-file-store.js', './wall-types.js',
      './drawing-format.js', './render-2d.js',
    ]);
  });

  test('an origin with nothing saved says so instead of showing a black page', async ({ page }) => {
    // A newcomer who never opened the old page. The failure this guards is a
    // blank screen that looks identical to a page that failed to boot.
    await page.addInitScript(() => {
      if (sessionStorage.getItem('draft-test-storage-cleared')) return;
      sessionStorage.setItem('draft-test-storage-cleared', '1');
      indexedDB.deleteDatabase('pdf-img-mgr-shared');
      localStorage.clear();
    });
    await page.goto('/MODEL.html');

    await expect(notice(page)).toHaveClass(/show/, { timeout: 5000 });
    await expect(notice(page)).toContainText('No saved drawing');
    await expect(readout(page)).toContainText('no drawing saved');
    // Nothing is painted at all, grid included: there is nothing to paint.
    expect(await anyInk(page)).toBe(0);
  });

  test('wheel zooms about the cursor and drag pans', async ({ page }) => {
    await houseOnOldPage(page);
    await page.goto('/MODEL.html');
    await expect(readout(page)).toContainText('walls', { timeout: 5000 });

    const fitted = await scaleNow(page);
    expect(fitted).toBeGreaterThan(0);

    // Zoom in about a fixed point. The world point under the cursor must not
    // move -- that is what makes zoom feel attached to the drawing rather than
    // to the window.
    const box = await page.locator('#plan').boundingBox();
    const cx = box.x + box.width * 0.4, cy = box.y + box.height * 0.4;
    await page.mouse.move(cx, cy);
    await page.mouse.wheel(0, -400);
    const zoomed = await scaleNow(page);
    expect(zoomed).toBeGreaterThan(fitted);

    // Panning changes what is under the canvas centre, so the ink pattern has
    // to move. A pan that silently did nothing would still pass a scale check.
    const inkBefore = await wallInk(page);
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 260, cy + 160, { steps: 8 });
    await page.mouse.up();
    const inkAfter = await wallInk(page);
    expect(inkAfter).not.toBe(inkBefore);
  });
});
