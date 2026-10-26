// MOVE, FOR A ROOF (Movie, 18 Oct).
//
// "grab the edge of a roof, and then have opion down below with BREAK COPY
// etc that says MOVE ... pushed it over all the way to the left so there is
// no roof left it would just smooth out the roof to the main eave" -- "grab
// the ... ROOF EDGE and then drag it down to where the main roof edge is and
// line them up" -- "SELECT just the NODE and i could either DELETE it or MOVE
// it".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
// A 60 x 30 house with a 6' jog-out on its front from x = 20 to 40, roofed
// at 8': the eave ring is the wall ring pushed out 8'.
const WALL = [[0, 0], [60, 0], [60, 30], [40, 30], [40, 36], [20, 36], [20, 30], [0, 30]];
const EAVE = [[-8, -8], [68, -8], [68, 38], [48, 38], [48, 44], [12, 44], [12, 38], [-8, 38]];
const drawing = () => ({
  version: 1, planTurn: 0, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 1,
  walls: [], lines: [], floors: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
  roofs: [{ id: 'roof-1', levelId: 7, follows: 'none', pitch: 4, overhang: 8,
    points: EAVE.map(([x, z]) => ({ x, y: 0, z })), edges: EAVE.map(() => 'eave'),
    edgeOverhang: EAVE.map(() => 8), footprint: WALL.map(([x, z]) => ({ x, y: 0, z })) }],
});
async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto('/MODEL.html?level=7');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
const click = async (page, at, x, z) => { await page.mouse.click(...at(x, z)); await page.waitForTimeout(100); };
async function drag(page, at, from, to) {
  await page.mouse.move(...at(...from));
  await page.mouse.down();
  await page.mouse.move(...at(...to), { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(100);
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return (await h.savedDrawing(page)).roofs[0];
}
const ring = pts => pts.map(p => [Math.round(p.x * 100) / 100 + 0, Math.round(p.z * 100) / 100 + 0]);
async function armMove(page, at) {
  await click(page, at, 30, 15);
  await expect(page.locator('#model-move')).toBeVisible();
  await page.locator('#model-move').click();
  await expect(page.locator('#model-move')).toHaveAttribute('aria-pressed', 'true');
}

test('option 1: the jog\'s side pushed all the way across smooths it into the main eave; one UNDO', async ({ page }) => {
  const { at } = await open(page);
  await armMove(page, at);
  // The jog's right side, x = 48, pushed left to x = 12.
  await drag(page, at, [48, 41], [12, 41]);
  let roof = await saved(page);
  expect(ring(roof.points)).toEqual([[-8, -8], [68, -8], [68, 38], [-8, 38]]);
  expect(ring(roof.footprint), 'the wall line it hangs from goes with it').toEqual([[0, 0], [60, 0], [60, 30], [0, 30]]);
  expect(roof.edgeOverhang).toEqual([8, 8, 8, 8]);
  await page.keyboard.press('Control+z');
  roof = await saved(page);
  expect(ring(roof.points)).toEqual(EAVE);
});

test('option 2: the jog\'s front dragged down onto the main eave line -- no node left over', async ({ page }) => {
  const { at } = await open(page);
  await armMove(page, at);
  // Part way first: the wall line under it comes the same 3'.
  await drag(page, at, [30, 44], [30, 41]);
  let part = await saved(page);
  expect(ring(part.points)).toContainEqual([48, 41]);
  expect(ring(part.footprint)).toContainEqual([40, 33]);
  await page.keyboard.press('Control+z');
  await drag(page, at, [30, 44], [30, 38]);
  const roof = await saved(page);
  expect(ring(roof.points)).toEqual([[-8, -8], [68, -8], [68, 38], [-8, 38]]);
});

// IT STOPS ON THE CORNER (Movie, 18 Oct: "if the user pulls it past the
// corner can you cut it at the corner rather than making new roof on the other
// side" -- "it was hard to get right on the corner point there was a little
// extra roof").
test('an edge pulled past the corner stops on it: no roof the other side, no sliver', async ({ page }) => {
  const { at } = await open(page);
  await armMove(page, at);
  // The jog's front pulled 1.5' past the main eave line.
  await drag(page, at, [30, 44], [30, 36.5]);
  let roof = await saved(page);
  expect(ring(roof.points)).toEqual([[-8, -8], [68, -8], [68, 38], [-8, 38]]);
  await page.keyboard.press('Control+z');
  // And let go a hair short of it: caught.
  await drag(page, at, [30, 44], [30, 38.05]);
  roof = await saved(page);
  expect(ring(roof.points)).toEqual([[-8, -8], [68, -8], [68, 38], [-8, 38]]);
});

// THE STOP CATCHES FROM 3" (Movie, 26 Oct, the one snap rule: "keep the 3""),
// whatever the zoom; 4" short is let go where it was.
test('the edge stop catches from 2 1/2" short, not from 4"', async ({ page }) => {
  const { at } = await open(page);
  await armMove(page, at);
  await drag(page, at, [30, 44], [30, 38 + 2.5 / 12]);
  let roof = await saved(page);
  expect(ring(roof.points), '2 1/2" short: on the corner').toEqual([[-8, -8], [68, -8], [68, 38], [-8, 38]]);
  await page.keyboard.press('Control+z');
  await drag(page, at, [30, 44], [30, 38 + 4 / 12]);
  roof = await saved(page);
  expect(ring(roof.points).length, '4" short: the jog stays, four inches deep').toBe(8);
});

test('a node dragged moves alone; a node clicked is picked and DELETE takes it out', async ({ page }) => {
  const { at } = await open(page);
  await armMove(page, at);
  // The top-left corner pulled out 2'.
  await drag(page, at, [-8, -8], [-10, -10]);
  let roof = await saved(page);
  expect(ring(roof.points)[0]).toEqual([-10, -10]);
  expect(roof.points).toHaveLength(8);
  // Pick the jog's front-left corner (12, 44) and DELETE it.
  await click(page, at, 12, 44);
  await page.keyboard.press('Delete');
  roof = await saved(page);
  expect(roof.points).toHaveLength(7);
  expect(ring(roof.points)).not.toContainEqual([12, 44]);
  expect(roof.edges).toHaveLength(7);
  expect(roof.footprint).toHaveLength(7);
  // A CORNER TAKEN OUT LEAVES A SLOPED EDGE, from (48, 44) to (12, 38).
  const k = ring(roof.points).findIndex(p => p[0] === 48 && p[1] === 44);
  expect(roof.edges[k]).toBe('sloped');
});

// THE CORNER CUT AT 45, THE PLANES KEPT (Movie, 18 Oct: "that corner node i
// would delete to cut off the corner and match the 45 (it would be a sloped
// eave)" -- "keep the PLANE / SLOPE of roof FIXED").
test('a corner node DELETEd on a plain roof: a SLOPED edge, the planes the corner had, cut along it', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  const R = [[0, 0], [60, 0], [60, 30], [0, 30]];
  const f = drawing();
  f.roofs[0] = { ...f.roofs[0], points: R.map(([x, z]) => ({ x, y: 0, z })),
    edges: R.map(() => 'eave'), edgeOverhang: R.map(() => 8) };
  delete f.roofs[0].footprint;
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html?level=7&left=1&lpane=drafting');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  const { at } = await h.planFrame(page);
  await click(page, at, 30, 15);
  // BREAK puts a node 10' along each side of the corner (0, 30), then the
  // corner is DELETEd: the 45 between them.
  await page.locator('#model-break').click();
  await click(page, at, 10, 29.9);
  await click(page, at, 0.1, 20);
  await page.keyboard.press('Enter');
  await page.locator('#model-move').click();
  await click(page, at, 0, 30);
  await page.keyboard.press('Delete');
  const roof = await saved(page);
  expect(ring(roof.points)).toEqual([[0, 0], [60, 0], [60, 30], [10, 30], [0, 20]]);
  expect(roof.edges).toEqual(['eave', 'eave', 'eave', 'sloped', 'eave']);
  // THE PLANES ARE THE CORNER'S: the hip from the old corner reaches the
  // sloped edge at its middle, 5' in from each eave -- 5' x 4/12 up.
  const rise = await page.evaluate(r => {
    const Gm = window.DraftGeometry2D;
    const faces = Gm.roofFaces(r, Gm.roofSkeleton(r));
    const mid = { x: 5, z: 25 };
    // One pitch all round: the roof over a point is the lowest of its planes.
    return Math.min(...faces.map(fc => Gm.roofFaceRise(fc, mid, r.pitch)));
  }, roof);
  expect(rise).toBeCloseTo(5 * 4 / 12, 6);
  // AND IT IS STILL SLOPED OPENED AGAIN: the format keeps it.
  await page.goto('/MODEL.html?level=7&left=1&lpane=drafting');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  expect((await saved(page)).edges).toEqual(['eave', 'eave', 'eave', 'sloped', 'eave']);
  // The edge panel says SLOPED for it.
  await page.keyboard.press('Escape');
  await click(page, at, 30, 15);
  await click(page, at, 5, 25);
  await expect(page.locator('[data-prop-row="edge"] [data-prop-value="sloped"]')).toHaveAttribute('aria-pressed', 'true');
});

// A NODE ON A STRAIGHT RUN IS NOT A CORNER: taken out, it just goes and the
// eave runs on as it was -- nothing to slope.
test('a BREAK node DELETEd from a straight eave just goes; no SLOPED edge', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  const R = [[0, 0], [60, 0], [60, 30], [0, 30]];
  const f = drawing();
  f.roofs[0] = { ...f.roofs[0], points: R.map(([x, z]) => ({ x, y: 0, z })),
    edges: R.map(() => 'eave'), edgeOverhang: R.map(() => 8) };
  delete f.roofs[0].footprint;
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html?level=7&left=1&lpane=drafting');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  const { at } = await h.planFrame(page);
  await click(page, at, 30, 15);
  await page.locator('#model-break').click();
  await click(page, at, 30, 0.1);
  await page.keyboard.press('Enter');
  expect((await saved(page)).points).toHaveLength(5);
  await page.locator('#model-move').click();
  await click(page, at, 30, 0);
  await page.keyboard.press('Delete');
  const roof = await saved(page);
  expect(ring(roof.points)).toEqual(R);
  expect(roof.edges).toEqual(['eave', 'eave', 'eave', 'eave']);
});

test('a drag inside the roof moves the whole roof', async ({ page }) => {
  const { at } = await open(page);
  await armMove(page, at);
  await drag(page, at, [30, 15], [35, 15]);
  const roof = await saved(page);
  expect(ring(roof.points)).toEqual(EAVE.map(([x, z]) => [x + 5, z]));
  expect(ring(roof.footprint)[0]).toEqual([5, 0]);
});

test('Esc puts MOVE down', async ({ page }) => {
  const { at } = await open(page);
  await armMove(page, at);
  await page.keyboard.press('Escape');
  await expect(page.locator('#model-move')).not.toHaveAttribute('aria-pressed', 'true');
});

// AN EDGE BESIDE THE 45: its end slides along the chamfer's own line.
test('an edge beside a 45-degree corner: its end slides along the 45', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  const CH = [[-8, -8], [68, -8], [68, 38], [6.6863, 38], [-8, 23.3137]];
  const f = drawing();
  f.roofs[0] = { ...f.roofs[0], points: CH.map(([x, z]) => ({ x, y: 0, z })),
    edges: CH.map(() => 'eave'), edgeOverhang: CH.map(() => 8) };
  delete f.roofs[0].footprint;
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html?level=7');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  const { at } = await h.planFrame(page);
  await armMove(page, at);
  // The left edge, x = -8, pushed 2' right.
  await drag(page, at, [-8, 8], [-6, 8]);
  const roof = await saved(page);
  expect(ring(roof.points)).toContainEqual([-6, 25.31]);
  expect(ring(roof.points)).toContainEqual([-6, -8]);
});

// A ROOF'S NODES PICKED WITHOUT MOVE (Movie, 18 Oct: "could we do that right
// sweep rectangle over a node, or even just click close to a ROOF node" --
// "select just the NODE so it lights up and the rest of the roof doesn't" --
// "and then offer thing to do with that node - MOVE, DELETE" -- "a 3rd command
// 'BREAK ROOF at NODE' where the user could split the roof and make different
// properties or move one of them").
// The colour 3px outside the roof's eave at (x, z): the halo's, while the
// roof is lit; the sheet's, while it is not.
const besideEave = (page, [px, py]) => page.evaluate(([px, py]) => {
  const c = document.getElementById('plan');
  const r = c.getBoundingClientRect();
  const k = c.width / r.width;
  return [...c.getContext('2d').getImageData(Math.round((px - r.left) * k), Math.round((py - 3 - r.top) * k), 1, 1).data].slice(0, 3);
}, [px, py]);
const far = (u, v) => Math.abs(u[0] - v[0]) + Math.abs(u[1] - v[1]) + Math.abs(u[2] - v[2]);
test('a click close to a roof node picks just the node; the roof stays dark; DELETE takes it out', async ({ page }) => {
  const { at } = await open(page);
  await click(page, at, 30, 15);
  const lit = await besideEave(page, at(30, -8));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  const dark = await besideEave(page, at(30, -8));
  expect(far(lit, dark), 'the halo shows beside the eave of a roof picked whole').toBeGreaterThan(40);
  // Half a foot off the jog's front-left corner (12, 44): close enough.
  await page.mouse.click(...at(12.4, 44.3));
  await page.waitForTimeout(100);
  await expect(page.locator('#strip-message')).toContainText('NODE picked');
  expect(far(await besideEave(page, at(30, -8)), dark), 'the roof is not lit with its node').toBeLessThan(20);
  await page.locator('#delete').click();
  const roof = await saved(page);
  expect(roof.points).toHaveLength(7);
  expect(ring(roof.points)).not.toContainEqual([12, 44]);
});
test('a box over two roof nodes picks them: DELETE takes both, MOVE and a drag carries both, a click picks one', async ({ page }) => {
  const { at } = await open(page);
  // Left to right round the jog's two right-hand corners (48, 38) and (48, 44).
  await drag(page, at, [45, 35], [51, 47]);
  await expect(page.locator('#strip-message')).toContainText('2 NODES picked');
  await page.locator('#model-move').click();
  await drag(page, at, [48, 44], [50, 44]);
  let roof = await saved(page);
  expect(ring(roof.points)).toContainEqual([50, 38]);
  expect(ring(roof.points)).toContainEqual([50, 44]);
  await page.keyboard.press('Escape');
  await drag(page, at, [47, 35], [53, 47]);
  await expect(page.locator('#strip-message')).toContainText('2 NODES picked');
  await page.locator('#delete').click();
  roof = await saved(page);
  expect(roof.points).toHaveLength(6);
  // And a click on one of a pair picks just that one.
  await page.keyboard.press('Escape');
  await drag(page, at, [-11, -11], [-5, 41]);
  await expect(page.locator('#strip-message')).toContainText('2 NODES picked');
  await page.mouse.click(...at(-8, 38));
  await page.waitForTimeout(100);
  await expect(page.locator('#strip-message')).toContainText('NODE picked:');
});
test('two nodes picked, BREAK ROOF splits the roof between them; each piece its own; one UNDO joins them', async ({ page }) => {
  const { at } = await open(page);
  await page.mouse.click(...at(48, 38));
  await page.waitForTimeout(100);
  await page.keyboard.down('Shift');
  await page.mouse.click(...at(12, 38));
  await page.keyboard.up('Shift');
  await page.waitForTimeout(100);
  await expect(page.locator('#strip-message')).toContainText('2 NODES picked');
  await expect(page.locator('#model-break')).toHaveText('BREAK ROOF');
  await page.locator('#model-break').click();
  await page.locator('#save').click();
  await h.waitForSaved(page);
  let roofs = (await h.savedDrawing(page)).roofs;
  expect(roofs).toHaveLength(2);
  const jog = roofs.find(r => r.points.length === 4), main = roofs.find(r => r.points.length === 6);
  expect(ring(jog.points)).toEqual([[48, 38], [48, 44], [12, 44], [12, 38]]);
  expect(jog.edges[3]).toBe('gable');
  expect(jog.edgeOverhang[3]).toBe(0);
  expect(main.edges[5]).toBe('gable');
  expect(main.pitch).toBe(4);
  expect(new Set(roofs.map(r => r.id)).size).toBe(2);
  await page.keyboard.press('Control+z');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  roofs = (await h.savedDrawing(page)).roofs;
  expect(roofs).toHaveLength(1);
  expect(roofs[0].points).toHaveLength(8);
});
