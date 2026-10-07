// THE STAIR SECTION, ON MODEL.html (Movie, 7 Oct): "on the MODEL.DC.html i
// could bring up the STAIR SECTION - it would show a full page with 2 views
// ... can you find that and bring it over. i will need them to also display
// on the SECTIONS when i make cuts" -- "it should show the full stairs with
// the rails".
//
// The painting itself is checked offline (proto/section-stairs-harness.js);
// this holds the page to its wiring: the STAIR view opens the two panes, a
// press enlarges and splits, and a section cut through the stairwell draws
// them.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const BUNGALOW = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'proto', 'perf-bungalow.draft'), 'utf8'));
const STAIR = [93, 74, 138];   // #5d4a8a, the workspace's stair ink

// A cut straight down the stairwell, and one straight across it.
const CUTS = [
  { id: 1, name: 'S1', startPt: { x: -14.5, z: -52 }, endPt: { x: -14.5, z: -4 }, dirVec: { x: 1, z: 0 }, elev: 0, levelId: 3 },
  { id: 2, name: 'S2', startPt: { x: -37, z: -28 }, endPt: { x: 4, z: -28 }, dirVec: { x: 0, z: -1 }, elev: 0, levelId: 3 },
];

async function load(page, drawing, url) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing });
  await page.goto(url);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(400);
}

// Pixels of one colour in a band of the canvas (fractions of its height).
const inkIn = (page, rgb, y0, y1) => page.evaluate(({ rgb, y0, y1 }) => {
  const c = document.getElementById('plan');
  const g = c.getContext('2d');
  const top = Math.floor(c.height * y0), rows = Math.max(1, Math.floor(c.height * (y1 - y0)));
  const d = g.getImageData(0, top, c.width, rows).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (Math.abs(d[i] - rgb[0]) < 12 && Math.abs(d[i + 1] - rgb[1]) < 12 && Math.abs(d[i + 2] - rgb[2]) < 12) n += 1;
  }
  return n;
}, { rgb, y0, y1 });

// Every pixel that is not the paper, across the whole canvas.
const inked = page => page.evaluate(() => {
  const c = document.getElementById('plan');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const bg = [d[(Math.floor(c.height / 2) * c.width + 4) * 4], d[(Math.floor(c.height / 2) * c.width + 4) * 4 + 1],
    d[(Math.floor(c.height / 2) * c.width + 4) * 4 + 2]];
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 30) n += 1;
  }
  return n;
});

test('the STAIR view opens the section over the plan; a press enlarges, the next splits', async ({ page }) => {
  await load(page, BUNGALOW, '/MODEL.html?level=3&view=stair');
  const plan = page.locator('#plan');
  await expect(plan).toHaveAttribute('data-stair-pane', 'split');
  expect(await inkIn(page, STAIR, 0.1, 0.45), 'the section pane draws the stair').toBeGreaterThan(200);
  expect(await inkIn(page, STAIR, 0.55, 0.9), 'and the plan pane under it').toBeGreaterThan(200);

  const box = await plan.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.3);
  await expect(plan).toHaveAttribute('data-stair-pane', 'section');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.3);
  await expect(plan).toHaveAttribute('data-stair-pane', 'split');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.8);
  await expect(plan).toHaveAttribute('data-stair-pane', 'plan');
});

test('a level with no stair says so instead of drawing one', async ({ page }) => {
  await load(page, { ...BUNGALOW, stairs: [] }, '/MODEL.html?level=3&view=stair');
  await expect(page.locator('#plan')).toHaveAttribute('data-stair-pane', 'empty');
});

for (const cut of CUTS) {
  test(`section ${cut.name} draws the stairs it cuts through`, async ({ page }) => {
    await load(page, { ...BUNGALOW, cuts: CUTS, stairs: [] }, `/MODEL.html?level=3&view=cut:${cut.id}`);
    const without = await inked(page);
    await load(page, { ...BUNGALOW, cuts: CUTS }, `/MODEL.html?level=3&view=cut:${cut.id}`);
    expect(await inked(page)).toBeGreaterThan(without + 300);
  });
}
