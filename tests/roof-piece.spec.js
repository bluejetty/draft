// ROOF PIECE, DRAWN BY HAND (jb, 13 Nov 2026).
//
// The HAND ROOF's own tool: "TURN OFF THE AUTOROOF and do a HANDROOF". A
// third option on the DRAW A ROOF card, and the only one on the ROOF plan:
// the outline from above, then one press names the EAVE edge; the rest are
// GABLE, except an edge laid along another roof's edge, which is a JOINT so
// pieces drawn side by side join like a busted roof. Pitch and overhang are
// the PROJECT's to start; the piece is a hand roof from birth.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b, levelId) => ({ id, levelId, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 8, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
const box = (p, x0, x1, z0, z1, lv) => [W(`${p}1`, [x0, z0], [x1, z0], lv), W(`${p}2`, [x1, z0], [x1, z1], lv),
  W(`${p}3`, [x1, z1], [x0, z1], lv), W(`${p}4`, [x0, z1], [x0, z0], lv)];
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 },
  { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
// MAIN FL 30 x 20; 2ND FL set back 10 ft off its z = 0 side. HAND ROOF on.
const drawing = () => ({
  version: 1, board: 'drafting', levels: LEVELS, activeLevelIdx: 2, nextDrawingItemId: 50,
  roofPitch: 3, autoRoof: false,
  walls: [...box('m', 0, 30, 0, 20, 3), ...box('u', 0, 30, 10, 20, 5)],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [], outlines: [], shapes: [],
  surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [], beams: [], fixtures: [],
  boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
});

async function open(page, level = 5) {
  page.__errors = [];
  page.on('pageerror', err => page.__errors.push(String(err)));
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto(`/MODEL.html?level=${level}&lpane=build&left=1`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
test.afterEach(async ({ page }) => { expect(page.__errors || [], 'no page errors').toEqual([]); });
const strip = page => page.locator('#strip-message');
async function press(page, at, x, z) {
  await page.mouse.click(...at(x, z));
  await page.waitForTimeout(80);
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const roofsNow = page => page.evaluate(() => (drawing.roofs || []).map(r => ({
  id: r.id, levelId: r.levelId, drawnOn: r.drawnOn, sourceLevelId: r.sourceLevelId, edges: r.edges.slice(),
  overhang: r.overhang, edgeOverhang: r.edgeOverhang.slice(), pitch: r.pitch, fascia: r.fascia, follows: r.follows,
  points: r.points.map(p => [p.x, p.z]), footprint: (r.footprint || []).length })));
const projectOverhang = page => page.evaluate(() =>
  window.DraftLevelAssembly.projectRoofFor(drawing, 'house', drawing.buildType).overhangFt);
// The outline, closed on its first corner, then the press that names the eave.
async function drawPiece(page, at, corners, eaveAt) {
  await page.locator('[data-tool-key="roof"]').click();
  await expect(page.locator('#roof-pick')).toBeVisible();
  await page.locator('[data-roof-kind="piece"]').click();
  await expect(strip(page)).toContainText('ROOF PIECE 1/2');
  for (const [x, z] of corners) await press(page, at, x, z);
  await press(page, at, ...corners[0]);
  await expect(strip(page)).toContainText('ROOF PIECE 2/2');
  if (eaveAt) await press(page, at, ...eaveAt);
}

test('on a storey the card offers the ROOF PIECE; outline, then the EAVE press, make a hand roof over the floor below', async ({ page }) => {
  const { at } = await open(page);
  await page.locator('[data-tool-key="roof"]').click();
  await expect(page.locator('[data-roof-pick-note]'), 'on a storey the card speaks of the storey below').toContainText('storey below');
  await expect(page.locator('[data-roof-kind="shed"]')).toBeVisible();
  await page.evaluate(() => setTool('select'));
  await drawPiece(page, at, [[-1, -2], [31, -2], [31, 10], [-1, 10]], [15, 10]);
  await expect(strip(page)).toContainText('ROOF PIECE made at 3/12');
  const over = await projectOverhang(page);
  expect(over, 'the PROJECT has an overhang to hand down').toBeGreaterThan(0);
  const [roof] = await roofsNow(page);
  expect(roof.levelId, 'filed on the ROOF plan').toBe(7);
  expect(roof.drawnOn, 'drawn on the 2nd floor').toBe(5);
  expect(roof.sourceLevelId, 'bearing on the main floor under it').toBe(3);
  expect(roof.pitch, 'the PROJECT pitch to start').toBe(3);
  expect(roof.edges, 'the pressed edge is the EAVE, the rest GABLE').toEqual(['gable', 'gable', 'eave', 'gable']);
  expect(roof.overhang, 'the PROJECT overhang').toBeCloseTo(over, 4);
  expect(roof.edgeOverhang.map(v => Number(v.toFixed(4)))).toEqual([over, over, over, over].map(v => Number(v.toFixed(4))));
  expect(roof.follows, 'a hand roof from birth').toBe('none');
  expect(roof.fascia).toBe(5.5);
  expect(roof.footprint, 'a footprint inside the overhangs').toBe(4);
  expect(roof.points.map(([x, z]) => [Math.round(x * 100) / 100, Math.round(z * 100) / 100])).toEqual([[-1, -2], [31, -2], [31, 10], [-1, 10]]);
  // THE TOOL IS DOWN and the piece picked.
  expect(await page.evaluate(() => [activeTool, selection.map(e => `${e.type}:${e.item.id}`)])).toEqual(['select', [`roof:${roof.id}`]]);
  // AND THE FILE KEEPS IT.
  const file = (await saved(page)).roofs[0];
  expect(file.edges).toEqual(['gable', 'gable', 'eave', 'gable']);
  expect(file.drawnOn).toBe(5);
});

test('on the ROOF plan the card offers only the ROOF PIECE; it sits on the top storey with no storey of its own', async ({ page }) => {
  const { at } = await open(page, 7);
  await page.locator('[data-tool-key="roof"]').click();
  await expect(page.locator('#roof-pick')).toBeVisible();
  await expect(page.locator('[data-roof-kind="shed"]'), 'the single slope roof needs a storey below').toBeHidden();
  await expect(page.locator('[data-roof-kind="gable"]')).toBeHidden();
  await expect(page.locator('[data-roof-kind="piece"]')).toBeVisible();
  await expect(page.locator('[data-roof-pick-note]'), 'the card says where a piece sits from here').toContainText('top storey');
  await page.locator('[data-roof-pick-cancel]').click();
  await expect(page.locator('#roof-pick')).toBeHidden();
  // THE TOOL IS STILL ARMED after CANCEL (the ROOF tool's edge flip); put
  // down so the key press below arms it afresh and asks again.
  await page.evaluate(() => setTool('select'));
  await drawPiece(page, at, [[-1, 8], [31, 8], [31, 22], [-1, 22]], [31, 15]);
  const [roof] = await roofsNow(page);
  expect(roof.drawnOn, 'not a lower roof: the ROOF plan is its home').toBeUndefined();
  expect(roof.sourceLevelId, 'bearing on the top storey, 2ND FL').toBe(5);
  expect(roof.edges, 'the east edge pressed is the EAVE').toEqual(['gable', 'eave', 'gable', 'gable']);
  // BACK ON THE STOREY IT DOES NOT SHOW: it was not drawn there.
  await page.goto('/MODEL.html?level=5');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  expect(await page.evaluate(() => (document.getElementById('readout').textContent.match(/roofs\s+(\d+)/) || [])[1] || '0')).toBe('0');
});

test('a second piece laid along the first gets a JOINT on the shared edge; the first is left as it was', async ({ page }) => {
  const { at } = await open(page, 7);
  await drawPiece(page, at, [[-1, -2], [31, -2], [31, 10], [-1, 10]], [15, -2]);
  await drawPiece(page, at, [[31, -2], [45, -2], [45, 10], [31, 10]], [38, -2]);
  await expect(strip(page)).toContainText('1 JOINT edge');
  const roofs = await roofsNow(page);
  expect(roofs.length).toBe(2);
  expect(roofs[0].edges, 'the first piece as drawn').toEqual(['eave', 'gable', 'gable', 'gable']);
  expect(roofs[1].edges, 'the edge on the first piece is a JOINT, the rest as named').toEqual(['eave', 'gable', 'gable', 'joint']);
  expect(roofs[1].edgeOverhang[3], 'no overhang on a JOINT').toBe(0);
  expect(roofs[1].edgeOverhang[0], 'the eave keeps the PROJECT overhang').toBeGreaterThan(0);
});

test('a press off every edge makes nothing; Escape puts the piece down; UNDO takes a made piece back', async ({ page }) => {
  const { at } = await open(page);
  await drawPiece(page, at, [[-1, -2], [31, -2], [31, 10], [-1, 10]], null);
  await press(page, at, 15, 4);
  await expect(strip(page)).toContainText('Click ON one edge');
  expect(await roofsNow(page), 'no roof yet').toEqual([]);
  await page.keyboard.press('Escape');
  await expect(strip(page)).toContainText('ROOF PIECE put down.');
  // THE ROOF TOOL STAYS ARMED, as it does after a single slope roof is put
  // down (its edge flip); a second Escape puts the tool down.
  expect(await page.evaluate(() => [activeTool, !!shedRoof])).toEqual(['roof', false]);
  expect(await roofsNow(page)).toEqual([]);
  await page.evaluate(() => setTool('select'));
  await drawPiece(page, at, [[-1, -2], [31, -2], [31, 10], [-1, 10]], [15, -2]);
  expect((await roofsNow(page)).length).toBe(1);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(100);
  expect(await roofsNow(page), 'UNDO takes the piece back').toEqual([]);
});
