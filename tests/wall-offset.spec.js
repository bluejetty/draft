// OFFSET FROM LINE on the wall's OBJ / PROP (jb, 16 Nov 2026).
//
// "for the basement interior insulation i will try to make a wall which has a
// 8" space where the foundation wall is", then "have spot where the user can
// displace the wall from the line and change it i will use 8" for mine",
// "place the OFFSET text box in the OBJ PROP of the WALL", and "do MAIN and
// also SPECIAL CASE ones for this". The wall's body stands `offsetFt` off its
// drawn line, away from the line on its WALL SIDE.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b, extra) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'left', baseHeight: 0, topHeight: 8, ...extra });
const drawing = () => ({
  version: 1, board: 'drafting', planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 20,
  walls: [W('n', [0, 0], [12, 0]), W('e', [12, 0], [12, 10]), W('s', [12, 10], [0, 10]), W('w', [0, 10], [0, 0]),
    W('loose', [18, 0], [18, 10])],
  groups: [{ id: 'group-1', name: 'WALLS 1', fixed: false, stretchBehavior: 'item-geometry',
    members: ['n', 'e', 's', 'w'].map(id => ({ type: 'wall', id })),
    wallSettings: { wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' } }],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [], fixtures: [],
  outlines: [], shapes: [], surfaceOpenings: [], notes: [], stairs: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], levelLocks: [], underlays: [],
});
async function open(page, f = drawing()) {
  await h.openEditor(page, { drawing: f, bucket: BUCKET, url: '/MODEL.html?left=1&right=1&level=3', webgl: false });
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const wall = (d, id) => d.walls.find(w => w.id === id);
const slot = '#props-slot';
const typeIn = async (page, selector, text) => {
  const box = page.locator(selector);
  await box.fill(text);
  await box.press('Enter');
  await page.waitForTimeout(100);
};
const faces = (page, id) => page.evaluate(id => {
  const w = drawing.walls.find(x => x.id === id);
  const o = window.DraftGeometry2D.wallFaceOffsets(w, window.DraftWallTypes.wallThicknessFt(w));
  return [o.startOff * 12, o.endOff * 12];
}, id);

test('the faces move off the line by the offset, toward the WALL SIDE; negative goes the other way', async ({ page }) => {
  await open(page);
  const got = await page.evaluate(() => {
    const G = window.DraftGeometry2D, WT = window.DraftWallTypes;
    const at = (refLine, offsetFt) => {
      const w = { start: { x: 0, z: 0 }, end: { x: 10, z: 0 }, wallType: 'stud_2x6', refLine, offsetFt };
      const o = G.wallFaceOffsets(w, WT.wallThicknessFt(w));
      return [o.startOff * 12, o.endOff * 12].map(v => Math.round(v * 100) / 100);
    };
    return { left: at('left', 8 / 12), right: at('right', 8 / 12), center: at('center', 8 / 12),
      back: at('left', -8 / 12), none: at('left', undefined) };
  });
  expect(got.left).toEqual([8, 13.5]);
  expect(got.right).toEqual([-13.5, -8]);
  expect(got.center).toEqual([5.25, 10.75]);
  expect(got.back).toEqual([-8, -2.5]);
  expect(got.none).toEqual([0, 5.5]);
});

test('a lone wall: OFFSET box on OBJ / PROP, a bare 8 is 8", saved, reopened, picked by its body, one UNDO', async ({ page }) => {
  const { at } = await open(page);
  await page.mouse.click(...at(18, 5));
  const box = page.locator(`${slot} [data-prop-row="offset"] [data-wall-offset-field]`);
  await expect(box, 'starts on the line').toHaveValue('0"');
  await typeIn(page, `${slot} [data-prop-row="offset"] [data-wall-offset-field]`, '8');
  let d = await saved(page);
  expect(wall(d, 'loose').offsetFt * 12).toBeCloseTo(8, 6);
  expect(wall(d, 'n').offsetFt, 'nothing else moved').toBeUndefined();
  expect(await faces(page, 'loose')).toEqual([8, 13.5]);
  // Reopened, still 8".
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  expect(await faces(page, 'loose')).toEqual([8, 13.5]);
  // Picked by its body, which stands 8" to 13 1/2" off the line.
  const frame = await h.planFrame(page);
  const side = await page.evaluate(() => {
    const w = drawing.walls.find(x => x.id === 'loose');
    const dx = w.end.x - w.start.x, dz = w.end.z - w.start.z, len = Math.hypot(dx, dz);
    return { nx: -dz / len, nz: dx / len };
  });
  await page.keyboard.press('Escape');
  await page.mouse.click(...frame.at(18 + side.nx * (11 / 12), 5 + side.nz * (11 / 12)));
  await expect(page.locator(`${slot} [data-prop-row="offset"] [data-wall-offset-field]`)).toHaveValue('8"');
  // UNDO (this session's): 4" then Ctrl+Z is 8" again.
  await typeIn(page, `${slot} [data-prop-row="offset"] [data-wall-offset-field]`, '4');
  d = await saved(page);
  expect(wall(d, 'loose').offsetFt * 12).toBeCloseTo(4, 6);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+z');
  d = await saved(page);
  expect(wall(d, 'loose').offsetFt * 12).toBeCloseTo(8, 6);
});

test('OFFSET reads feet with a foot mark and refuses nonsense', async ({ page }) => {
  const { at } = await open(page);
  await page.mouse.click(...at(18, 5));
  const sel = `${slot} [data-prop-row="offset"] [data-wall-offset-field]`;
  await typeIn(page, sel, `1'-4"`);
  let d = await saved(page);
  expect(wall(d, 'loose').offsetFt * 12).toBeCloseTo(16, 6);
  await typeIn(page, sel, 'banana');
  d = await saved(page);
  expect(wall(d, 'loose').offsetFt * 12, 'unchanged').toBeCloseTo(16, 6);
  await typeIn(page, sel, '0');
  d = await saved(page);
  expect(wall(d, 'loose').offsetFt, '0 is on the line, no key').toBeUndefined();
});

test('MAIN WALLS OFFSET reaches every wall of the assembly; THIS WALL keeps its own; x goes back to MAIN', async ({ page }) => {
  const { at } = await open(page);
  await page.mouse.click(...at(6, 0));
  await typeIn(page, `${slot} [data-wall-main] [data-prop-row="offset"] [data-wall-offset-field]`, '8');
  let d = await saved(page);
  expect(['n', 'e', 's', 'w'].map(id => Math.round(wall(d, id).offsetFt * 12))).toEqual([8, 8, 8, 8]);
  expect(d.groups[0].wallSettings.offsetFt * 12).toBeCloseTo(8, 6);
  expect(wall(d, 'loose').offsetFt, 'not in the assembly').toBeUndefined();
  // THIS WALL: 2" for the north wall only.
  await typeIn(page, `${slot} [data-wall-own-field="offsetFt"]`, '2');
  d = await saved(page);
  expect(['n', 'e', 's', 'w'].map(id => Math.round(wall(d, id).offsetFt * 12))).toEqual([2, 8, 8, 8]);
  expect(wall(d, 'n').own).toEqual(['offsetFt']);
  // MAIN 6": the other three; the special one stays.
  await typeIn(page, `${slot} [data-wall-main] [data-prop-row="offset"] [data-wall-offset-field]`, '6');
  d = await saved(page);
  expect(['n', 'e', 's', 'w'].map(id => Math.round(wall(d, id).offsetFt * 12))).toEqual([2, 6, 6, 6]);
  await expect(page.locator(`${slot} [data-wall-main]`)).toContainText('OFFSET (1 SPECIAL)');
  // x: back to MAIN.
  await page.locator(`${slot} [data-wall-own-clear="offsetFt"]`).click();
  await page.waitForTimeout(100);
  d = await saved(page);
  expect(['n', 'e', 's', 'w'].map(id => Math.round(wall(d, id).offsetFt * 12))).toEqual([6, 6, 6, 6]);
  expect(wall(d, 'n').own).toBeUndefined();
});

test('an offset loop still mitres: the corners of four walls 8" in meet 8" in', async ({ page }) => {
  await open(page);
  const corners = await page.evaluate(() => {
    drawing.walls.forEach(w => { if (w.id !== 'loose') w.offsetFt = 8 / 12; });
    const G = window.DraftGeometry2D, WT = window.DraftWallTypes;
    const loop = drawing.walls.filter(w => w.id !== 'loose');
    return G.wallFaceCorners(G.sharedEnds ? G.sharedEnds(loop) : loop, WT.wallThicknessFt)
      .map(p => [Math.round(p.x * 1200) / 100, Math.round(p.z * 1200) / 100]);
  });
  // The loop runs n (0,0)->(12,0), e, s, w; 'left' bodies lie on +normal,
  // which for this winding is inside the box or outside it -- either way the
  // faces now meet 8" and 13 1/2" off the drawn corner, in the same quadrant.
  const atCorner = corners.filter(([x, z]) => Math.abs(x) < 20 && Math.abs(z) < 20);
  const offs = atCorner.map(([x, z]) => [Math.abs(x), Math.abs(z)]);
  expect(offs).toEqual(expect.arrayContaining([[8, 8], [13.5, 13.5]]));
});
