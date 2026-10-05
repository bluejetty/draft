// THE TOPS OF THE WALLS THE ROOFS STAND ON, ON THE ROOF PLAN.
//
// Movie, 5 Oct: "on the roof plan can you show the tops of the walls that
// the roofs are sitting on (should be 5.5" walls on both levels)" -- thin and
// solid, the main floor's exterior walls under the main roof and the 2nd
// floor's under its own roof. Which walls is geometry-2d's roofBearing
// (proto/roof-bearing-harness.js); this is that the page draws them.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-movie-modbilevel-e3-peak.draft'), 'utf8'));

// Light grey pixels on the drawing canvas: the night skin's wall-edge ink is
// #a7aeb1, thin and anti-aliased over the roof's wash, so it is matched as a
// family -- light and colourless -- not as one exact value. The roof is
// orange and the dimensions blue; neither is grey.
const wallInk = page => page.evaluate(() => {
  const c = document.getElementById('plan');
  const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r > 90 && Math.abs(r - g) < 16 && Math.abs(g - b) < 16) n += 1;
  }
  return n;
});

async function openRoofPlan(page, saved) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, saved }) => {
    const f = new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(f, bucket);
  }, { bucket: h.STORAGE_BUCKET, saved });
  await page.goto('/MODEL.html?theme=rough&mode=night&pane=previews&right=1&level=7&lpane=build&left=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(1200);
}

test('the roof plan draws the tops of the walls each roof stands on', async ({ page }) => {
  await openRoofPlan(page, REPRO);
  const withWalls = await wallInk(page);
  // The same drawing with no house walls under the roofs: nothing to draw.
  const bare = { ...REPRO, walls: REPRO.walls.filter(w => w.body === 'garage' || ![3, 4].includes(w.levelId)) };
  await openRoofPlan(page, bare);
  const without = await wallInk(page);
  expect(withWalls, `wall-top ink with walls ${withWalls}, without ${without}`).toBeGreaterThan(without * 1.5 + 500);
});
