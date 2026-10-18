// TRIM AND EXTEND, THE AUTOCAD WAY -- AND THE MELD THEY LEAVE.
//
// Movie, 17 Oct, when the two-press TRIM would not take his exterior wall:
// "id like to be able to select both items and them seltec the TRIM or press
// the TRIM command and then select the part i want to cut (i'd select the int
// wall on the side i want to cut off) or if i had selected 2 lines it would
// use all suraces for cutting except the one i select the part i select gets
// the cut ... is gone" -- "cuts on either side if there is another selected
// line crossing over". EXTEND: "if the int wall is 2 ft from the ext wall i
// select both that int wall an that ext wall and then click the int wall at
// the end closest to the ext wall and it will extend to attach to the wall".
// The openings: "move the doors and windows in on the wall if they fit, if
// there comes too many doors and windows widthwise, delete them".
//
// The cutting edges are the selection (all but the wall pressed), or every
// wall and line on the level when nothing is selected. A cut stops at a
// wall's FACE on the kept side, never inside a wall; near the other wall's
// own end the two make a corner. And from 5 Oct: "2 interior wall that cross
// or meet at corner should meld" -- the last test.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const W = (id, a, b, t, refLine = 'center') => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: t, refLine });
const house = (extra, fenestrations = []) => ({
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
  lines: [], floors: [], roofs: [], fenestrations, dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
});
// HIS WALL: an exterior wall whose stored line is its OUTSIDE face, the body
// inside (refLine 'left', run z 14 -> 0 so its normal points into the room).
const hisHouse = (extra, fenestrations = []) => ({
  ...house([], fenestrations),
  walls: [W('wall-1', [0, 14], [0, 0], 'stud_2x6', 'left'), ...extra],
});
const T6 = 5.5 / 12, T4 = 3.5 / 12;

async function open(page, drawing) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'd.json', { type: 'application/json' }), bucket);
  }, { bucket: h.STORAGE_BUCKET, f: drawing });
  await page.goto('/MODEL.html?theme=rough&mode=day');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
async function press(page, x, z, modifiers) {
  const frame = await h.planFrame(page);
  const [cx, cy] = frame.at(x, z);
  await page.mouse.move(cx, cy);
  // mouse.click takes no modifiers, so the key is held down round it.
  for (const key of modifiers || []) await page.keyboard.down(key);
  await page.mouse.click(cx, cy);
  for (const key of modifiers || []) await page.keyboard.up(key);
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
const r3 = v => Math.round(v * 1000) / 1000;

test('his case: select the exterior wall and the partition run through it, TRIM, press outside -- it stops at the inside face', async ({ page }) => {
  await open(page, hisHouse([W('wall-5', [-4, 7], [12, 7], 'stud_2x4')]));
  // SELECT BOTH: a press on the exterior wall's BODY (well inside its outside
  // face, the press the old TRIM missed), Shift+press on the partition.
  await press(page, T6 / 2, 3);
  await press(page, 8, 7, ['Shift']);
  await page.keyboard.press('q');
  await expect(page.locator('#strip-message')).toContainText('the 2 selected');
  await press(page, -2, 7);
  const d = await saved(page);
  expect(pt(wallOf(d, 'wall-5').start), 'the kept partition stops at the INSIDE face').toEqual([r3(T6), 7]);
  expect(pt(wallOf(d, 'wall-5').end), 'its far end stays').toEqual([12, 7]);
  expect(pt(wallOf(d, 'wall-1').start), 'the exterior wall is untouched').toEqual([0, 14]);
});

test('a press between two crossings takes the middle out, leaving two walls, and one UNDO makes it one', async ({ page }) => {
  await open(page, house([W('wall-5', [-3, 7], [23, 7], 'stud_2x4')]));
  await page.keyboard.press('q');
  await press(page, 10, 7);
  let d = await saved(page);
  const pieces = d.walls.filter(w => Math.abs(w.start.z - 7) < 1e-6 && Math.abs(w.end.z - 7) < 1e-6);
  expect(pieces.length, 'two pieces of the partition').toBe(2);
  const near = wallOf(d, 'wall-5'), far = pieces.find(w => w.id !== 'wall-5');
  expect(pt(near.start)).toEqual([-3, 7]);
  expect(pt(near.end), 'the near piece stops at the west wall\'s outside face').toEqual([r3(-T6 / 2), 7]);
  expect(pt(far.start), 'the far piece starts at the east wall\'s outside face').toEqual([r3(20 + T6 / 2), 7]);
  expect(pt(far.end)).toEqual([23, 7]);
  expect(far.wallType, 'the same wall in every property').toBe('stud_2x4');
  await page.keyboard.press('Control+z');
  d = await saved(page);
  expect(d.walls.filter(w => Math.abs(w.start.z - 7) < 1e-6).length, 'one partition again').toBe(1);
  expect(pt(wallOf(d, 'wall-5').end)).toEqual([23, 7]);
});

test('EXTEND: the partition two feet short of the wall runs on to it and stops at its inside face', async ({ page }) => {
  await open(page, house([W('wall-5', [8, 9], [8, T6 / 2 + 2], 'stud_2x4')]));
  await page.keyboard.press('x');
  await press(page, 8, T6 / 2 + 2.3);
  const d = await saved(page);
  expect(pt(wallOf(d, 'wall-5').end)).toEqual([8, r3(T6 / 2)]);
  expect(pt(wallOf(d, 'wall-5').start), 'the far end stays').toEqual([8, 9]);
});

test('Shift swaps them: Shift+press in TRIM extends', async ({ page }) => {
  await open(page, house([W('wall-5', [8, 9], [8, T6 / 2 + 2], 'stud_2x4')]));
  await page.keyboard.press('q');
  await press(page, 8, T6 / 2 + 2.3, ['Shift']);
  const d = await saved(page);
  expect(pt(wallOf(d, 'wall-5').end)).toEqual([8, r3(T6 / 2)]);
});

test('near the other wall\'s end EXTEND makes a corner: both ends on one point', async ({ page }) => {
  await open(page, house([
    W('wall-5', [3, 5], [6, 5], 'stud_2x4'),
    W('wall-6', [7, 5.5], [7, 11], 'stud_2x4'),
  ]));
  await page.keyboard.press('x');
  await press(page, 5.5, 5);
  const d = await saved(page);
  expect(pt(wallOf(d, 'wall-5').end)).toEqual([7, 5]);
  expect(pt(wallOf(d, 'wall-6').start), 'the other wall comes to the corner too').toEqual([7, 5]);
});

test('a door on the piece taken away slides on if it fits, and goes if it does not', async ({ page }) => {
  const door = (id, wallId, offset, width) => ({ id, wallId, levelId: 3, view: 'plan', type: 'door',
    layer: 'A-DOOR', offset, width, sillHeight: 0, headHeight: 6.6667, doorType: 'int', doorStyle: 'single' });
  await open(page, hisHouse([
    W('wall-5', [-4, 3], [12, 3], 'stud_2x4'),
    W('wall-6', [-4, 10], [2.5, 10], 'stud_2x4'),
  ], [door('fenestration-1', 'wall-5', 2, 2.5), door('fenestration-2', 'wall-6', 2, 3)]));
  await page.keyboard.press('q');
  await press(page, -2.5, 3);
  await press(page, -2.5, 10);
  await expect(page.locator('#strip-message')).toContainText('did not fit and was removed');
  const d = await saved(page);
  const kept = d.fenestrations.find(f => f.id === 'fenestration-1');
  expect(kept, 'the door on the long partition is still there').toBeTruthy();
  const len = 12 - T6;
  expect(kept.offset - kept.width / 2, 'slid on to the wall that is left').toBeGreaterThan(0);
  expect(kept.offset + kept.width / 2).toBeLessThan(len);
  expect(d.fenestrations.find(f => f.id === 'fenestration-2'), 'the 3 ft door on 2 ft of wall is gone').toBeFalsy();
});

test('with nothing crossing under the press it says so, and changes nothing', async ({ page }) => {
  await open(page, house([W('wall-5', [4, 4], [8, 4], 'stud_2x4')]));
  await page.keyboard.press('q');
  await press(page, 6, 4);
  await expect(page.locator('#strip-message')).toContainText('Nothing crosses it there');
  await page.keyboard.press('Escape');
  await page.locator('#save').click();
  const d = await page.evaluate(async bucket => JSON.parse(await (await window.SharedFileStore.loadSharedFile(bucket)).text()), h.STORAGE_BUCKET);
  expect(pt(wallOf(d, 'wall-5').start)).toEqual([4, 4]);
  expect(pt(wallOf(d, 'wall-5').end)).toEqual([8, 4]);
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

