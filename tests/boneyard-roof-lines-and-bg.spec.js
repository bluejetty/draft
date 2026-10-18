// THE ROOF'S OWN LINES, AND WHAT STANDS BEHIND THE LEVEL BEING EDITED.
//
// Movie, 16 Oct, two asks in one message and they answer each other:
//
//   "i think we should also add the ROOf lines to show how the overhand and
//   hips/valleys will show up in the BONEYARD in realy thin lins like the
//   edge walls also very very thin lines. and show the roof outline in 3d and
//   only show it on the right window if the ROOF is selected (or selected as
//   a BACKGROUND laryer)"
//
//   "in the middle LEVELS area can you add a BG button to each of those and
//   if they press the BG button that LEVEL will show up lightweight in the
//   background (won't be noticed where it overlaps but any parts that aren't
//   aligned will show up in lighter lines (faded lines) BACKGROUND lines"
//
// THE BONE IS NOT EITHER OF THE NEW LINES. It is the roof brought back in by
// its overhang -- the wall line it stands on. What is new is where the
// overhang ENDS, and where the planes meet each other: the hips, valleys and
// ridges. So the first thing checked here is that the eave really is outside
// the bone by the overhang, measured against the saved drawing, because a
// "thin line" that traces the bone again is a line that says nothing.
//
// AND THE SECOND IS WHO IS ALLOWED TO SEE THEM. Every other level used to be
// drawn faded in the right window, always. Now a level is behind the picked
// one because the drafter pressed BG, and the roof's lines come with it.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const ROOF_INK = [0xff, 0x8c, 0x1a];

const empty = () => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

async function boneyardOf(page, entry) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.openDriveThru(page);
  await page.locator('#dt-tiles [data-build-family="bungalow"]').click();
  await page.locator(`#dt-tiles [data-build-entry="${entry}"]`).click();
  await page.locator('#dt-bone').click();
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const drawing = await h.savedDrawing(page);
  await page.goto('/BONEYARD.html');
  await expect(page.locator('body')).toHaveAttribute('data-boneyard-ready', '1', { timeout: 10000 });
  return drawing;
}

const thinOn = async (page, which) =>
  JSON.parse(await page.locator(which).getAttribute('data-thin'));
const loops2d = async page =>
  JSON.parse(await page.locator('#bones2d').getAttribute('data-loops'));
const faded = async page =>
  JSON.parse(await page.locator('#bones2d').getAttribute('data-faded') || '[]');

const boxOf = pairs => ({
  x0: Math.min(...pairs.map(p => p[0])), x1: Math.max(...pairs.map(p => p[0])),
  z0: Math.min(...pairs.map(p => p[1])), z1: Math.max(...pairs.map(p => p[1])),
});

// HOW MUCH OF THE CANVAS IS THE ROOF'S COLOUR. Faded or full, a stroke keeps
// its RGB on a transparent canvas and gives up only its alpha, so one count
// answers "is any of the roof in this window" however lightly it was drawn.
const roofInk = (page, which) => page.locator(which).evaluate((c, want) => {
  const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] > 8 && px[i] === want[0] && px[i + 1] === want[1] && px[i + 2] === want[2]) n += 1;
  }
  return n;
}, ROOF_INK);

// The strongest alpha within a pixel or two of a point: a hairline can land
// between two pixels and split itself across both, so a single read says
// nothing about how heavily it was drawn.
const alphaNear = (page, which, at) => page.locator(which).evaluate((c, [x, y]) => {
  const dpr = window.devicePixelRatio || 1;
  const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let best = 0, heaviest = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] > heaviest) heaviest = px[i];
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const sx = Math.round(x * dpr) + dx, sy = Math.round(y * dpr) + dy;
      if (sx < 0 || sy < 0 || sx >= c.width || sy >= c.height) continue;
      const a = px[(sy * c.width + sx) * 4 + 3];
      if (a > best) best = a;
    }
  }
  return { best, heaviest };
}, at);

test('the roof\'s overhang and the lines where its planes meet are drawn in the 3D',
  async ({ page }) => {
    await boneyardOf(page, 'bungalow');
    const lines = await thinOn(page, '#bones3d');
    const eaves = lines.filter(l => l.kind === 'eave');
    const bones = lines.filter(l => l.kind === 'skeleton');
    expect(eaves.length, 'the overhang is drawn').toBeGreaterThan(0);
    expect(eaves.every(l => l.level === 'ROOF'), 'as the roof\'s own line').toBe(true);
    expect(bones.length, 'and the hips, valleys and ridges with it').toBeGreaterThan(0);
    // EVERY ONE OF THEM INSIDE THE OVERHANG. A skeleton is where the planes
    // meet, so a segment outside the eave is a roof folded inside out.
    const eave = boxOf(eaves[0].points);
    bones.forEach(line => line.points.forEach(([x, y]) => {
      expect(x, 'a hip runs inside the eave').toBeGreaterThanOrEqual(eave.x0 - 1);
      expect(x).toBeLessThanOrEqual(eave.x1 + 1);
      expect(y).toBeGreaterThanOrEqual(eave.z0 - 1);
      expect(y).toBeLessThanOrEqual(eave.z1 + 1);
    }));
    // AND ALL OF IT ON THE CANVAS. The lines are laid out with the bones and
    // scaled with them; a set that missed the frame would be drawn in feet
    // against a window measured in pixels, which is off the edge entirely.
    const c3 = await page.locator('#bones3d').evaluate(c => ({
      w: c.clientWidth, h: c.clientHeight }));
    lines.forEach(line => line.points.forEach(([x, y]) => {
      expect(x, `${line.kind} is on the canvas`).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(c3.w);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(c3.h);
    }));
    // THE LEFT WINDOW IS THE WHOLE BUILDING AT ONCE, so picking a level
    // somewhere else does not take the roof's lines off it.
    await page.locator('.levels-rail [data-bone-level="FOUNDATION"]').click();
    await expect(page.locator('#bones2d')).toHaveAttribute('data-level', 'FOUNDATION');
    const after = await thinOn(page, '#bones3d');
    expect(after.length, 'still drawn with the foundation picked').toBe(lines.length);
  });

test('the eave is the roof\'s own outline, and the bone is that outline brought in by the overhang',
  async ({ page }) => {
    const drawing = await boneyardOf(page, 'bungalow');
    await page.locator('.levels-rail [data-bone-level="ROOF"]').click();
    await expect(page.locator('#bones2d')).toHaveAttribute('data-level', 'ROOF');
    const eave = (await thinOn(page, '#bones2d')).find(l => l.kind === 'eave');
    expect(eave, 'the overhang is drawn in the right window too').toBeTruthy();
    // AGAINST THE SAVED DRAWING, not against the window: this is a claim
    // about which outline was taken, and the only place that can be settled
    // is the file.
    const roof = (drawing.roofs || []).find(r => !r.garage && (r.points || []).length >= 3);
    expect(roof, 'the house has a roof to draw').toBeTruthy();
    const r4 = n => Math.round(n * 1e4) / 1e4;
    expect(new Set(eave.ft.map(([x, z]) => `${r4(x)},${r4(z)}`)),
      'the eave is the roof\'s own corners').toEqual(
      new Set(roof.points.map(p => `${r4(p.x)},${r4(p.z)}`)));
    // AND THE BONE IS INSIDE IT BY THE OVERHANG, all the way round -- which
    // is the whole reason this line is worth drawing.
    // THE FRAME HAS TO KNOW ABOUT IT. The eave hangs past every bone in the
    // drawing, so a frame fitted to the bones alone draws the overhang off
    // the edge of the window -- the one line whose whole point is where it
    // ends.
    const c2 = await page.locator('#bones2d').evaluate(c => ({
      w: c.clientWidth, h: c.clientHeight }));
    eave.points.forEach(([x, y]) => {
      expect(x, 'the overhang is inside the window').toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(c2.w);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(c2.h);
    });
    const over = Number(roof.overhang) || 0;
    expect(over, 'this roof has an overhang').toBeGreaterThan(0);
    const bone = boxOf((await loops2d(page)).flat());
    const out = boxOf(eave.ft);
    expect(bone.x0 - out.x0, 'the overhang stands out to the left').toBeCloseTo(over, 2);
    expect(out.x1 - bone.x1, 'and to the right').toBeCloseTo(over, 2);
    expect(bone.z0 - out.z0, 'and at the top').toBeCloseTo(over, 2);
    expect(out.z1 - bone.z1, 'and at the bottom').toBeCloseTo(over, 2);
  });

test('they are hairline: drawn, but lighter than the bone they belong to', async ({ page }) => {
  await boneyardOf(page, 'bungalow');
  await page.locator('.levels-rail [data-bone-level="ROOF"]').click();
  await expect(page.locator('#bones2d')).toHaveAttribute('data-level', 'ROOF');
  const line = (await thinOn(page, '#bones2d')).find(l => l.kind === 'skeleton');
  expect(line, 'there is a hip or a ridge to look at').toBeTruthy();
  const mid = [(line.points[0][0] + line.points[1][0]) / 2,
    (line.points[0][1] + line.points[1][1]) / 2];
  const { best, heaviest } = await alphaNear(page, '#bones2d', mid);
  expect(best, 'the line is really there').toBeGreaterThan(0);
  expect(heaviest, 'and the bone beside it is solid').toBe(255);
  expect(best, 'but the line itself is not').toBeLessThan(200);
});

test('the right window keeps the roof\'s lines to itself until the roof is asked for',
  async ({ page }) => {
    await boneyardOf(page, 'twoStorey-garage');
    // MAIN FL IS WHERE THE PAGE OPENS, and nothing is behind it until the
    // drafter puts something there.
    await expect(page.locator('#bones2d')).toHaveAttribute('data-level', 'MAIN FL');
    expect(await faded(page), 'nothing is behind it to begin with').toEqual([]);
    expect(await thinOn(page, '#bones2d'), 'and no roof lines either').toEqual([]);
    expect(await roofInk(page, '#bones2d'), 'not one pixel of the roof').toBe(0);
    // PICKED: its own lines come with it.
    await page.locator('.levels-rail [data-bone-level="ROOF"]').click();
    const picked = await thinOn(page, '#bones2d');
    expect(picked.some(l => l.kind === 'eave'), 'the overhang').toBe(true);
    expect(picked.some(l => l.kind === 'skeleton'), 'and the hips').toBe(true);
  });

test('BG puts a level behind the one being edited, and takes it away again',
  async ({ page }) => {
    await boneyardOf(page, 'twoStorey-garage');
    await expect(page.locator('#bones2d')).toHaveAttribute('data-level', 'MAIN FL');
    const bg = page.locator('.levels-rail [data-bone-bg="ROOF"]');
    await expect(bg).toHaveAttribute('aria-pressed', 'false');
    await bg.click();
    await expect(bg).toHaveAttribute('aria-pressed', 'true');
    // THE LEVEL BEING EDITED DOES NOT CHANGE. Behind is behind.
    await expect(page.locator('#bones2d')).toHaveAttribute('data-level', 'MAIN FL');
    expect(await faded(page), 'the roof is behind the floor now').toEqual(['ROOF']);
    // AND ITS THIN LINES CAME WITH IT -- "or selected as a BACKGROUND layer".
    const lines = await thinOn(page, '#bones2d');
    expect(lines.some(l => l.level === 'ROOF' && l.kind === 'eave'),
      'the overhang reads against the wall under it').toBe(true);
    // POLLED: the press re-paints on the next frame, and a pixel count taken
    // in the same tick can read the canvas before it (CI, 18 Oct: 0 here
    // with the roof's lines already listed above).
    await expect.poll(() => roofInk(page, '#bones2d'), { message: 'and it is on the canvas' })
      .toBeGreaterThan(0);
    // OFF AGAIN, on the same press.
    await bg.click();
    await expect(bg).toHaveAttribute('aria-pressed', 'false');
    expect(await faded(page)).toEqual([]);
    await expect.poll(() => roofInk(page, '#bones2d'), { message: 'gone from the canvas' }).toBe(0);
  });

test('a level cannot be put behind itself', async ({ page }) => {
  await boneyardOf(page, 'twoStorey-garage');
  await expect(page.locator('#bones2d')).toHaveAttribute('data-level', 'MAIN FL');
  // THE PICKED LEVEL IS ALREADY IN FRONT. Its BG is disabled rather than
  // missing, so the stack does not change shape as levels are picked.
  await expect(page.locator('.levels-rail [data-bone-bg="MAIN FL"]')).toBeDisabled();
  await expect(page.locator('.levels-rail [data-bone-bg="ROOF"]')).toBeEnabled();
  await page.locator('.levels-rail [data-bone-level="ROOF"]').click();
  await expect(page.locator('.levels-rail [data-bone-bg="ROOF"]')).toBeDisabled();
  await expect(page.locator('.levels-rail [data-bone-bg="MAIN FL"]')).toBeEnabled();
  // AND EVERY LEVEL HAS ONE, so the question can be asked of any of them.
  const rows = await page.locator('.levels-rail .level-row').count();
  expect(await page.locator('.levels-rail [data-bone-bg]').count(),
    'one BG to each level').toBe(rows);
});
