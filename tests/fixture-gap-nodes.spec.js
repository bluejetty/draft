// THE HALF INCH'S CORNERS AS NODES, AND A LONE SHIFT TAP TO BREAK A CORNER
// (Movie, 24 Oct):
//   "can the corners where the extra half inch space meets become a 'corner
//   type node' that i can snap other wall nodes to (like the floor)", "the
//   corner where the 2 X 1/2" faint lines meet so the user can place it
//   against a wall and if there is a corner node the use can 'connect' them
//   when they are located at the same location";
//   "we should add the disconnect option for corners, but not with a popup
//   ... if they selected the node and selected one of the line at the
//   beginning it will give them control of that line", "choose NODE (and line
//   if desired) and then press SHIFT --- just shift once".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center', baseHeight: 0, topHeight: 8 });
const FX = (id, kind, wallId, offset, width, depth, more = {}) => ({ id, wallId, levelId: 3, view: 'plan', kind, offset, width, depth, side: 1, ...more });
const drawing = (extra = {}) => ({
  version: 1, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 20,
  walls: [W('a', [0, 0], [16, 0]), W('b', [16, 0], [16, 10])],
  fixtures: [FX('van', 'vanity', 'a', 5, 4, 2), FX('c1', 'cabinet', 'a', 10, 2, 2), FX('c2', 'cabinet', 'a', 12, 2, 2)],
  lines: [], floors: [], roofs: [], dimensions: [], fenestrations: [],
  outlines: [], shapes: [], surfaceOpenings: [], notes: [], stairs: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
  ...extra,
});
async function open(page, f = drawing()) {
  page.__errors = [];
  page.on('pageerror', err => page.__errors.push(String(err)));
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html?level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  const levels = page.getByRole('button', { name: 'LEVELS / LAYERS' });
  if (await levels.count() && await levels.getAttribute('aria-expanded') === 'true') await levels.click();
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
test.afterEach(async ({ page }) => { expect(page.__errors || [], 'no page errors').toEqual([]); });
const saved = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};
const corners = (page, id, d = drawing()) => page.evaluate(({ id, d }) =>
  window.DraftFixtureGeometry.gapCorners(d.walls, d.fixtures.find(f => f.id === id), d.fixtures), { id, d });
const r3 = n => Math.round(n * 1000) / 1000;
const move = async (page, at, x, z) => { await page.mouse.move(...at(x, z), { steps: 4 }); await page.waitForTimeout(60); };
const press = async (page, at, x, z) => { await move(page, at, x, z); await page.mouse.click(...at(x, z)); await page.waitForTimeout(80); };
async function tsquare(page, on) {
  const chip = page.locator('[data-mode-tsquare]');
  const lit = /\blit\b/.test(await chip.getAttribute('class') || '');
  if (lit !== on) await chip.click();
}

test('the half inch\'s corners: on the wall face, half an inch past each end; none where a run is tight', async ({ page }) => {
  await open(page);
  const van = await corners(page, 'van');
  const face = await page.evaluate(d => {
    const FG = window.DraftFixtureGeometry;
    const g = FG.fixtureGeometry(d.walls, d.fixtures[0]);
    return { faceOff: g.faceOff, gap: g.wallGap, a0: g.alongStart, a1: g.alongEnd };
  }, drawing());
  expect(van.map(c => c.end)).toEqual([-1, 1]);
  expect(r3(van[0].x)).toBe(r3(face.a0 - face.gap));
  expect(r3(van[1].x)).toBe(r3(face.a1 + face.gap));
  expect(van.every(c => r3(Math.abs(c.z)) === r3(Math.abs(face.faceOff))), 'on the wall face').toBe(true);
  // The two cabinets stand tight: no node between them, one each outside.
  expect((await corners(page, 'c1')).map(c => c.end)).toEqual([-1]);
  expect((await corners(page, 'c2')).map(c => c.end)).toEqual([1]);
});

// A 2x4's half thickness: its face is this far off its drawn centre line.
const HALF_2X4 = 1.75 / 12;
test('a wall drawn to a half-inch corner puts its FACE there, its body outside the gap', async ({ page }) => {
  const { at } = await open(page);
  const [lo] = await corners(page, 'van');
  await tsquare(page, false);
  await h.armFromRail(page, 'wall');
  await press(page, at, lo.x + 0.03, lo.z + 0.03);
  await press(page, at, lo.x, lo.z + 6);
  await page.keyboard.press('Escape');
  const w = (await saved(page)).walls.find(x => !['a', 'b'].includes(x.id));
  expect(w, 'a wall was drawn').toBeTruthy();
  // Its centre line half ITS thickness off the corner, away from the vanity
  // (the vanity is at higher x), at the corner's depth; the whole wall
  // stepped across, so it still runs straight.
  const half = await page.evaluate(w => { const f = window.DraftFixtureGeometry.wallFrame(w); return Math.abs(f.endOff); }, w);
  expect(r3(w.start.x)).toBe(r3(lo.x - half));
  expect(r3(w.start.z)).toBe(r3(lo.z));
  expect(r3(w.end.x), 'straight, not leaning').toBe(r3(w.start.x));
  // ...and the vanity still has its half inch to that face, so nothing pushes it.
  expect((await saved(page)).fixtures.find(x => x.id === 'van').offset).toBe(5);
});

test('a wall with its face on a half-inch corner is connected: the fixture slid takes it along, one UNDO puts both back', async ({ page }) => {
  await open(page);
  const [lo] = await corners(page, 'van');
  const sx = lo.x - HALF_2X4;
  const f = drawing({ walls: [...drawing().walls, W('p', [sx, lo.z], [sx, lo.z + 6])] });
  const { at } = await open(page, f);
  // PICK THE VANITY, then slide it 2 ft along its wall.
  await page.mouse.click(...at(5, 1.2));
  await page.waitForTimeout(150);
  await page.mouse.move(...at(5, 1.2));
  await page.mouse.down();
  await page.mouse.move(...at(6, 1.2), { steps: 4 });
  await page.mouse.move(...at(7, 1.2), { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  let d = await saved(page);
  const van = d.fixtures.find(x => x.id === 'van');
  expect(van.offset, 'the vanity slid').toBeGreaterThan(6);
  const [now] = await corners(page, 'van', d);
  const p = d.walls.find(x => x.id === 'p');
  expect([r3(p.start.x), r3(p.start.z)], 'the wall end rode its corner, face still on it')
    .toEqual([r3(now.x - HALF_2X4), r3(now.z)]);
  expect([r3(p.end.x), r3(p.end.z)], 'its far end stayed').toEqual([r3(sx), r3(lo.z + 6)]);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  d = await saved(page);
  expect(d.fixtures.find(x => x.id === 'van').offset).toBe(5);
  const back = d.walls.find(x => x.id === 'p');
  expect([r3(back.start.x), r3(back.start.z)]).toEqual([r3(sx), r3(lo.z)]);
});

test('within an eighth of an inch of a wall\'s outside face corner, that corner wins over the node beside it', async ({ page }) => {
  await open(page);
  await tsquare(page, false);
  await h.armFromRail(page, 'line');
  await page.keyboard.press('0');
  await page.waitForTimeout(150);
  // Zoomed right in on the corner of a and b, as he would, the corner kept
  // under the hand in the middle of the sheet.
  const box = await page.locator('#plan').boundingBox();
  const mid = [box.x + box.width / 2, box.y + box.height / 2];
  for (let i = 0; i < 40; i++) {
    const fr = await h.planFrame(page);
    if (fr.scale >= 900) break;
    const [x, y] = fr.at(16 + HALF_2X4, -HALF_2X4);
    if (Math.hypot(x - mid[0], y - mid[1]) > 40) {
      // PAN it to the middle first: a right-drag pans.
      await page.mouse.move(x, y);
      await page.mouse.down({ button: 'right' });
      await page.mouse.move(mid[0], mid[1], { steps: 4 });
      await page.mouse.up({ button: 'right' });
      continue;
    }
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(40);
  }
  const f = await h.planFrame(page);
  expect(f.scale, 'zoomed in').toBeGreaterThan(300);
  // The outside face corner of the a-b corner, and a press a sixteenth off it.
  const cx = 16 + HALF_2X4, cz = -HALF_2X4;
  await press(page, f.at, cx + 1 / 192, cz - 1 / 192);
  await press(page, f.at, cx + 0.25, cz - 0.25);
  await page.keyboard.press('Escape');
  const line = (await saved(page)).lines.at(-1);
  expect(line, 'a line was drawn').toBeTruthy();
  expect([r3(line.start.x), r3(line.start.z)], 'on the face corner, not the node').toEqual([r3(cx), r3(cz)]);
});

test('a loose wall\'s corner dragged onto a half-inch corner: its face lands there, the wall steps across whole', async ({ page }) => {
  await open(page);
  const [lo] = await corners(page, 'van');
  // A loose wall square above the corner, so the drag keeps it upright.
  const f = drawing({ walls: [...drawing().walls, W('q', [lo.x, 3], [lo.x, 8])] });
  const { at } = await open(page, f);
  await tsquare(page, false);
  await page.mouse.click(...at(lo.x, 5.5));     // pick q
  await page.waitForTimeout(150);
  await page.mouse.move(...at(lo.x, 3));
  await page.mouse.down();
  await page.mouse.move(...at(lo.x, 2), { steps: 4 });
  await page.mouse.move(...at(lo.x + 0.02, lo.z + 0.02), { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const q = (await saved(page)).walls.find(x => x.id === 'q');
  expect([r3(q.start.x), r3(q.start.z)], 'its face on the corner').toEqual([r3(lo.x - HALF_2X4), r3(lo.z)]);
  expect([r3(q.end.x), r3(q.end.z)], 'its loose far end stepped across with it').toEqual([r3(lo.x - HALF_2X4), 8]);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  const back = (await saved(page)).walls.find(x => x.id === 'q');
  expect([r3(back.start.x), r3(back.start.z), r3(back.end.x), r3(back.end.z)], 'one UNDO, both ends')
    .toEqual([r3(lo.x), 3, r3(lo.x), 8]);
});

test('a wall end NOT on the corner stays where it is when the fixture slides', async ({ page }) => {
  await open(page);
  const [lo] = await corners(page, 'van');
  const f = drawing({ walls: [...drawing().walls, W('p', [lo.x - 1, lo.z], [lo.x - 1, lo.z + 6])] });
  const { at } = await open(page, f);
  await page.mouse.click(...at(5, 1.2));
  await page.waitForTimeout(150);
  await page.mouse.move(...at(5, 1.2));
  await page.mouse.down();
  await page.mouse.move(...at(7, 1.2), { steps: 6 });
  await page.mouse.up();
  const p = (await saved(page)).walls.find(x => x.id === 'p');
  expect(r3(p.start.x)).toBe(r3(lo.x - 1));
});

test('a picked wall, its corner under the hand, one SHIFT tap: the corner breaks, its end follows the hand, a click puts it down', async ({ page }) => {
  const { at } = await open(page);
  await page.mouse.click(...at(16, 6));          // pick wall b
  await page.waitForTimeout(150);
  await move(page, at, 16, 0);                    // its corner with a
  await page.keyboard.press('Shift');
  await expect(page.locator('#strip-message')).toContainText('Corner broken');
  await move(page, at, 14, 2);
  await page.mouse.click(...at(14, 2));
  await page.waitForTimeout(150);
  let d = await saved(page);
  const a = d.walls.find(x => x.id === 'a'), b = d.walls.find(x => x.id === 'b');
  expect([r3(a.end.x), r3(a.end.z)], 'the other wall keeps the corner').toEqual([16, 0]);
  expect(b.start.x, 'the picked wall\'s end went with the hand').toBeCloseTo(14, 0);
  expect(b.start.z).toBeCloseTo(2, 0);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  d = await saved(page);
  const b2 = d.walls.find(x => x.id === 'b');
  expect([r3(b2.start.x), r3(b2.start.z)], 'one UNDO joins it again').toEqual([16, 0]);
});

test('Esc while the end is carried joins the corner back; SHIFT+click and a held SHIFT do not break it', async ({ page }) => {
  const { at } = await open(page);
  await page.mouse.click(...at(16, 6));
  await page.waitForTimeout(150);
  await move(page, at, 16, 0);
  await page.keyboard.press('Shift');
  await move(page, at, 14, 3);
  await page.keyboard.press('Escape');
  await expect(page.locator('#strip-message')).toContainText('joined again');
  await move(page, at, 13, 4);
  let b = (await saved(page)).walls.find(x => x.id === 'b');
  expect([r3(b.start.x), r3(b.start.z)]).toEqual([16, 0]);
  // SHIFT HELD THROUGH A CLICK is SHIFT+click, not a tap.
  await move(page, at, 16, 0);
  await page.keyboard.down('Shift');
  await page.mouse.click(...at(8, 0));
  await page.keyboard.up('Shift');
  await page.waitForTimeout(100);
  await expect(page.locator('#strip-message')).not.toContainText('Corner broken');
  b = (await saved(page)).walls.find(x => x.id === 'b');
  expect([r3(b.start.x), r3(b.start.z)]).toEqual([16, 0]);
});
