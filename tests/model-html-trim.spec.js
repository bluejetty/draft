// TRIM, AND THE MELD IT LEAVES.
//
// Movie, 5 Oct: "i'd especially like to TRIM interior walls against other
// INTERIOR and EXTERIOR walls, and when the trim happens i'd like the walls to
// 'meld' together" -- "2 interior wall that cross or meet at corner should
// meld".
//
// Two presses: the wall to trim (on the half whose end moves), then the wall
// it runs into. The end lands on that wall's centreline -- a tee, which the
// plan melds -- or, near that wall's own end, on its end too: a corner.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const W = (id, a, b, t) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: t, refLine: 'center' });
const house = extra => ({
  version: 1, planTurn: 0, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 20,
  walls: [
    W('wall-1', [0, 0], [20, 0], 'stud_2x6'), W('wall-2', [20, 0], [20, 14], 'stud_2x6'),
    W('wall-3', [20, 14], [0, 14], 'stud_2x6'), W('wall-4', [0, 14], [0, 0], 'stud_2x6'),
    ...extra,
  ],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
});

async function open(page, drawing) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'd.json', { type: 'application/json' }), bucket);
  }, { bucket: h.STORAGE_BUCKET, f: drawing });
  await page.goto('/MODEL.html?theme=rough&mode=day');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
async function press(page, x, z) {
  const frame = await h.planFrame(page);
  const [cx, cy] = frame.at(x, z);
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(120);
}
async function saved(page) {
  await expect(page.locator('#save')).toBeEnabled({ timeout: 4000 });
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
  return page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    return JSON.parse(await file.text());
  }, h.STORAGE_BUCKET);
}
const wallOf = (d, id) => d.walls.find(w => w.id === id);
const pt = p => [Math.round(p.x * 1000) / 1000, Math.round(p.z * 1000) / 1000];

test('Q arms TRIM; a short partition runs on to the outside wall it was pressed against', async ({ page }) => {
  await open(page, house([W('wall-5', [8, 7], [8, 3], 'stud_2x4')]));
  await page.keyboard.press('q');
  await press(page, 8, 4);      // the half nearer (8,3): that end moves
  await press(page, 12, 0);     // the wall it runs into
  const d = await saved(page);
  expect(pt(wallOf(d, 'wall-5').start)).toEqual([8, 7]);
  expect(pt(wallOf(d, 'wall-5').end), 'its end on the outside wall\'s centreline').toEqual([8, 0]);
  // The outside wall itself is untouched: a tee, not a corner.
  expect(pt(wallOf(d, 'wall-1').start)).toEqual([0, 0]);
  expect(pt(wallOf(d, 'wall-1').end)).toEqual([20, 0]);
});

test('a wall that runs past is cut back, and one press of UNDO puts it back', async ({ page }) => {
  await open(page, house([W('wall-5', [8, 7], [8, -2], 'stud_2x4')]));
  await page.keyboard.press('q');
  await press(page, 8, 1);
  await press(page, 14, 0);
  await page.keyboard.press('Control+z');
  // TRIM stays armed after a trim, so the same two presses go again.
  await press(page, 8, 1);
  await press(page, 14, 0);
  const d = await saved(page);
  expect(pt(wallOf(d, 'wall-5').end)).toEqual([8, 0]);
});

test('near the other wall\'s end it makes a corner: both ends on one point', async ({ page }) => {
  await open(page, house([
    W('wall-5', [3, 5], [6, 5], 'stud_2x4'),
    W('wall-6', [7, 5.5], [7, 11], 'stud_2x4'),
  ]));
  await page.keyboard.press('q');
  await press(page, 5.5, 5);
  await press(page, 7, 9);
  const d = await saved(page);
  expect(pt(wallOf(d, 'wall-5').end)).toEqual([7, 5]);
  expect(pt(wallOf(d, 'wall-6').start), 'the other wall comes to the corner too').toEqual([7, 5]);
});

// THE MELD ITSELF, read off the canvas: down the middle of a partition teed
// into the outside wall, the outside wall's inner face line is gone across
// the partition's mouth -- and so is every line inside an X.
test('a tee and an X draw no line across the joint', async ({ page }) => {
  await open(page, house([
    W('wall-5', [8, 0], [8, 7], 'stud_2x4'),
    W('wall-6', [4, 10], [16, 10], 'stud_2x4'),
    W('wall-7', [12, 4], [12, 13], 'stud_2x4'),
  ]));
  const frame = await h.planFrame(page);
  const darkAlong = async (x0, z0, x1, z1) => page.evaluate(({ a, b }) => {
    const c = document.querySelector('#plan');
    const g = c.getContext('2d');
    const r = c.getBoundingClientRect();
    const sx = c.width / r.width, sy = c.height / r.height;
    let dark = 0;
    for (let i = 0; i <= 400; i++) {
      const x = (a[0] + (b[0] - a[0]) * i / 400 - r.left) * sx;
      const y = (a[1] + (b[1] - a[1]) * i / 400 - r.top) * sy;
      const d = g.getImageData(Math.round(x), Math.round(y), 1, 1).data;
      if (d[3] > 150 && d[0] < 110) dark += 1;
    }
    return dark;
  }, { a: frame.at(x0, z0), b: frame.at(x1, z1) });
  // Down the partition, just off its centreline (its own end dot sits on
  // it), from inside the room to past the outside wall's centre: no face
  // line across the mouth and no end cap inside the wall.
  expect(await darkAlong(8.08, 2, 8.08, -0.12), 'no line across the tee').toBe(0);
  // Through the X along both centrelines.
  expect(await darkAlong(11, 10, 13, 10), 'no line across the X, one way').toBe(0);
  expect(await darkAlong(12, 9, 12, 11), 'no line across the X, the other way').toBe(0);
  // And the outside wall's inner face is still drawn beside the tee.
  expect(await darkAlong(5, 0.05, 5, 0.6), 'crossing it beside the tee finds the line').toBeGreaterThan(0);
});
