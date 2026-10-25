// THE SIZE MARKS, WHERE MOVIE WANTS THEM (24 Oct):
//   "tub number near open side (one only)", "the tub should only be 42 x 72
//   (not 73)", "sink left front of vanity", "add PEDESTAL SINK 2ft and 30"",
//   "make 22" for both pedestals", "move the mark to inside of swing",
//   "D36/24", "if the height isn't 80 show the height", "Garag Doors in ft
//   16'x8'", door sizes on elevations "ok put them on by default", "can the
//   window, cabinet and fixture sizes also get turned on and off in that
//   location in standards?", "kitchen cabinet width on front edge", "kitchen
//   sinks number left bowl (right if bigger) or centre if single", "add double
//   sink right bowl option", "uppers number near front just inside door line,
//   not as dark", and "can the LENGTH box show the measured number of how far
//   i am moving".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const W = (id, a, b) => ({ id, levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center',
  baseHeight: 0, topHeight: 9, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
const FX = (id, kind, wallId, offset, width, depth, more = {}) => ({ id, wallId, levelId: 3, view: 'plan', kind, offset, width, depth, side: 1, ...more });
const drawing = () => ({
  version: 1, board: 'drafting', levels: LEVELS, activeLevelIdx: 2, nextDrawingItemId: 50, nextGroupId: 1,
  walls: [
    // A tub's alcove, 9 ft between its end walls: far longer than the tub.
    W('tb', [0, 0], [12, 0]), W('t0', [0, -6], [0, 6]), W('t9', [9, -6], [9, 6]),
    // A vanity and a pedestal sink on a wall of their own.
    W('v', [20, 0], [34, 0]),
    // The kitchen: a cabinet run with a stove standing in it, and three sinks.
    W('k', [0, 20], [16, 20]),
    W('s', [20, 20], [40, 20]),
    // A wall to drag, alone.
    W('d', [0, 40], [10, 40]),
  ],
  fixtures: [
    FX('tub', 'tub', 'tb', 0, 6, 3.5, { endWallId: 't0', dir: 1 }),
    FX('van', 'vanity', 'v', 4, 5, 2),
    FX('ped', 'pedestal', 'v', 10, 2, 22 / 12),
    FX('ped30', 'pedestal30', 'v', 13, 2.5, 22 / 12),
    FX('cab', 'cabinet', 'k', 5, 8, 2),
    FX('stove', 'stove', 'k', 5, 2.5, 2.17),
    FX('sb2', 'sinkbase', 's', 3, 4, 2),
    FX('sbR', 'sinkbase', 's', 9, 4, 2, { bowls: 'right' }),
    FX('sb1', 'sinkbase', 's', 15, 3, 2, { bowls: 'single' }),
  ],
  fenestrations: [],
  lines: [], floors: [], roofs: [], dimensions: [], outlines: [], shapes: [], groups: [],
  surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [], beams: [], boneyardOutlines: [], levelLocks: [], underlays: [],
});

async function open(page, f = drawing(), url = '/MODEL.html?level=3') {
  page.__errors = [];
  page.on('pageerror', err => page.__errors.push(String(err)));
  await h.openModel(page, { webgl: false });
  await page.evaluate(async f => window.SharedFileStore.saveSharedFile(
    new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), 'model-drawing'), f);
  await page.goto(url);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(250);
  return h.planFrame(page);
}
test.afterEach(async ({ page }) => { expect(page.__errors || [], 'no page errors').toEqual([]); });
const marks = page => page.evaluate(() => window.__sizeMarks || []);
const fixtureTags = page => page.evaluate(() => window.__fixtureTags || []);
// A piece's corners on the canvas, in the canvas's own pixels: back two first.
async function cornersOf(page, id) {
  const { at, box } = await h.planFrame(page);
  const world = await page.evaluate(({ id, d }) => window.DraftFixtureGeometry
    .fixtureGeometry(d.walls, d.fixtures.find(f => f.id === id)).corners, { id, d: drawing() });
  return world.map(p => { const [x, y] = at(p.x, p.z); return { x: x - box.x, y: y - box.y }; });
}
// The drafter's left, standing at the front facing the back, on screen.
const leftOf = c => {
  const front = { x: (c[2].x + c[3].x) / 2, y: (c[2].y + c[3].y) / 2 };
  const back = { x: (c[0].x + c[1].x) / 2, y: (c[0].y + c[1].y) / 2 };
  const dx = back.x - front.x, dy = back.y - front.y;
  return { x: dy, y: -dx };
};
const dot = (a, b) => a.x * b.x + a.y * b.y;
const inside = (p, ring) => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i], b = ring[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
};

test('door labels: D36, both panels, the height when it is not 80", and a garage in feet', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  const got = await page.evaluate(() => {
    const FL = window.DraftFenLabels;
    const door = o => FL.fenLabelForOpening({ type: 'door', width: 3, headHeight: 80 / 12, ...o });
    return {
      plain: door({}),
      garden: door({ width: 5, doorStyle: 'garden', gardenWindowWidth: 2 }),
      gardenHalf: door({ width: 5, doorStyle: 'garden' }),
      french: door({ width: 5, doorStyle: 'french' }),
      bypass: door({ width: 6, doorStyle: 'bypass' }),
      pocket: door({ width: 2.5, doorStyle: 'pocket' }),
      tall: door({ headHeight: 8 }),
      shown: door({ showHeight: true }),
      garage: FL.fenLabelForOpening({ type: 'door', width: 16, headHeight: 8, garage: true }),
      garageMm: FL.fenLabelForOpening({ type: 'door', width: 16, headHeight: 8, garage: true }, { units: 'metric' }),
    };
  });
  expect(got).toEqual({
    plain: 'D36', garden: 'D36/24', gardenHalf: 'D30/30', french: 'D30/30', bypass: 'D36/36',
    pocket: 'D30', tall: 'D36 X 96', shown: 'D36 X 80', garage: "16' X 8'", garageMm: '4880 X 2440',
  });
});

test('a swinging door\'s plan mark sits inside its swing; a sliding one\'s on the other face', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  const z = await page.evaluate(() => {
    const FL = window.DraftFenLabels;
    // A 3 ft door in a wall running +x: render-2d swings the leaf to the left
    // of the run (+z here), FLIP SWING to the right.
    const geometry = { glazing: [{ x: 0, z: 0 }, { x: 3, z: 0 }], center: { x: 1.5, z: 0 },
      corners: [{ x: 0, z: -0.15 }, { x: 3, z: -0.15 }, { x: 3, z: 0.15 }, { x: 0, z: 0.15 }] };
    const side = o => { const l = FL.doorTagLine({ type: 'door', width: 3, ...o }, geometry); return Math.sign(l.a.z); };
    return { single: side({}), flipped: side({ swingFlip: true }), garden: side({ doorStyle: 'garden' }),
      pocket: side({ doorStyle: 'pocket' }), barn: side({ doorStyle: 'barn', swingFlip: true }) };
  });
  expect(z).toEqual({ single: 1, flipped: -1, garden: 1, pocket: -1, barn: 1 });
});

test('the four size switches are ON by default, an old saved OFF included, and STANDARDS turns each off', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  const std = await page.evaluate(() => {
    const FL = window.DraftFenLabels;
    const pick = s => FL.SIZE_MARK_SWITCHES.map(k => s[k]);
    return { fresh: pick(FL.normaliseFenStandards(null)),
      oldOff: pick(FL.normaliseFenStandards({ doorsOnElevations: false })),
      cabinetsOff: pick(FL.normaliseFenStandards({ cabinetSizes: false })) };
  });
  expect(std.fresh).toEqual([true, true, true, true]);
  expect(std.oldOff, 'the 1 Oct OFF every saved office carries reads ON now').toEqual([true, true, true, true]);
  expect(std.cabinetsOff).toEqual([true, true, false, true]);
  await page.goto('/STANDARDS.html');
  const boxes = page.locator('[data-fen-size-switch]');
  await expect(boxes).toHaveCount(4);
  for (let i = 0; i < 4; i += 1) await expect(boxes.nth(i)).toBeChecked();
  await page.locator('[data-fen-size-switch="cabinetSizes"]').uncheck();
  await expect(page.locator('#status')).toContainText('Cabinet sizes OFF');
  await page.reload();
  await expect(page.locator('[data-fen-size-switch="cabinetSizes"]')).not.toBeChecked();
  await expect(page.locator('[data-fen-size-switch="fixtureSizes"]')).toBeChecked();
});

test('the tub is its own 72", reads 42X72 once, inside it by the open side', async ({ page }) => {
  await open(page);
  const geo = await page.evaluate(d => {
    const g = window.DraftFixtureGeometry.fixtureGeometry(d.walls, d.fixtures.find(f => f.id === 'tub'));
    return { len: g.tubLen, decks: g.decks.length };
  }, drawing());
  expect(geo.len, 'no growing to fill the alcove').toBeCloseTo(6, 6);
  expect(geo.decks).toBeGreaterThan(0);
  const tags = (await fixtureTags(page)).filter(t => t.id === 'tub');
  expect(tags.map(t => t.label)).toEqual(['42X72']);
  const c = await cornersOf(page, 'tub');
  expect(inside({ x: tags[0].cx, y: tags[0].cy }, c), 'inside the tub').toBe(true);
  const front = (c[2].y + c[3].y) / 2, back = (c[0].y + c[1].y) / 2;
  expect(Math.abs(tags[0].cy - front), 'nearer the open side than the wall').toBeLessThan(Math.abs(tags[0].cy - back));
});

test('the vanity\'s mark is at its front left; the pedestal sinks are 22" deep, drawn and marked', async ({ page }) => {
  await open(page);
  const c = await cornersOf(page, 'van');
  const tag = (await fixtureTags(page)).find(t => t.id === 'van');
  expect(tag.label).toBe('24X60');
  expect(inside({ x: tag.cx, y: tag.cy }, c), 'inside the vanity').toBe(true);
  const left = leftOf(c);
  const lc = dot(c[3], left) > dot(c[2], left) ? c[3] : c[2];
  const rc = lc === c[3] ? c[2] : c[3];
  expect(Math.hypot(tag.cx - lc.x, tag.cy - lc.y), 'by the front-left corner')
    .toBeLessThan(Math.hypot(tag.cx - rc.x, tag.cy - rc.y) / 2);
  const all = await fixtureTags(page);
  expect(all.find(t => t.id === 'ped').label).toBe('22X24');
  expect(all.find(t => t.id === 'ped30').label).toBe('22X30');
  const kinds = await page.evaluate(() => window.DraftFixtureKinds.kindsInGroup('BATH').map(k => [k.id, k.widthFt, k.depthFt]));
  expect(kinds).toContainEqual(['pedestal', 2, 22 / 12]);
  expect(kinds).toContainEqual(['pedestal30', 2.5, 22 / 12]);
  // ...and the format keeps them, a sink's bowls and a door's SHOW HEIGHT.
  const kept = await page.evaluate(d => {
    const F = window.DraftDrawingFormat;
    const ids = new Set([3]);
    const fx = F.fixtures([...d.fixtures, { ...d.fixtures[0], id: 'x', kind: 'sinkbase', bowls: 'nonsense' }], ids);
    const fen = F.fenestrations([{ id: 'dd', wallId: 'v', levelId: 3, type: 'door', offset: 5, width: 3,
      sillHeight: 0, headHeight: 80 / 12, showHeight: true }], ids);
    return { kinds: fx.map(f => f.kind), bowls: fx.map(f => f.bowls).filter(Boolean),
      nonsense: 'bowls' in fx.find(f => f.id === 'x'), showHeight: fen[0].showHeight };
  }, drawing());
  expect(kept.kinds).toEqual(expect.arrayContaining(['pedestal', 'pedestal30']));
  expect(kept.bowls).toEqual(['right', 'single']);
  expect(kept.nonsense, 'a bowls it cannot read is dropped').toBe(false);
  expect(kept.showHeight).toBe(true);
});

test('cabinet runs say their width on the front edge, cut round the stove; uppers say theirs lighter, behind their dashed line', async ({ page }) => {
  await open(page);
  const all = await marks(page);
  const cab = all.filter(m => m.what === 'cabinet' && m.id === 'cab').map(m => m.label).sort();
  // 8 ft run, a 30" stove in its middle: 33" either side.
  expect(cab).toEqual(['33', '33']);
  const ups = all.filter(m => m.what === 'upper');
  expect(ups.filter(m => m.id === 'cab').map(m => m.label).sort()).toEqual(['33', '33']);
  expect(ups.filter(m => m.id === 'stove').map(m => m.label)).toEqual(['30']);
  // A sink base hangs its own and says its own width (Movie, 24 Oct: "All
  // lowers, all ON").
  expect(ups.filter(m => m.id === 'sb2').map(m => m.label)).toEqual(['48']);
  // The cabinet's marks sit nearer its front than the uppers' do.
  const c = await cornersOf(page, 'cab');
  const front = (c[2].y + c[3].y) / 2;
  const cabY = all.find(m => m.what === 'cabinet').cy, upY = ups.find(m => m.id === 'cab').cy;
  expect(Math.abs(cabY - front)).toBeLessThan(Math.abs(upY - front));
  // ...and the uppers' sits behind their dashed line, 12" off the wall,
  // toward the wall, not on it (Movie, 24 Oct: "behind the dashed line (not
  // on top)").
  const back = (c[0].y + c[1].y) / 2, dashed = back + (front - back) / 2;
  expect(Math.abs(upY - back), 'between the wall and the dashed line').toBeLessThan(Math.abs(dashed - back) - 3);
});

test('a sink base says its width in its left bowl, the bigger one in a 60/40, the middle of a single', async ({ page }) => {
  await open(page);
  const sinks = (await marks(page)).filter(m => m.what === 'sink');
  for (const [id, want] of [['sb2', 'left'], ['sbR', 'right'], ['sb1', 'middle']]) {
    const m = sinks.find(s => s.id === id);
    expect(m, `a mark on ${id}`).toBeTruthy();
    const c = await cornersOf(page, id);
    const mid = { x: (c[0].x + c[1].x + c[2].x + c[3].x) / 4, y: (c[0].y + c[1].y + c[2].y + c[3].y) / 4 };
    const lean = dot({ x: m.cx - mid.x, y: m.cy - mid.y }, leftOf(c)) / Math.hypot(...Object.values(leftOf(c)));
    if (want === 'left') expect(lean, id).toBeGreaterThan(3);
    if (want === 'right') expect(lean, id).toBeLessThan(-3);
    if (want === 'middle') expect(Math.abs(lean), id).toBeLessThan(1);
  }
  expect(sinks.find(s => s.id === 'sb2').label).toBe('48');
});

test('FIXTURE SIZES and CABINET SIZES off in STANDARDS take their marks off the plan', async ({ page }) => {
  await open(page);
  expect((await marks(page)).some(m => m.what === 'cabinet')).toBe(true);
  await page.evaluate(() => {
    const PM = window.DraftProfileManager;
    PM.saveActive(PM.createPackage('standards', 'TEST',
      { model: { fenestrationStandards: { cabinetSizes: false, fixtureSizes: false } } }));
  });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  expect(await marks(page)).toEqual([]);
  expect(await fixtureTags(page)).toEqual([]);
});

test('a sink base\'s BOWLS are picked in PROPERTIES and saved', async ({ page }) => {
  // THE LEFT SIDEBAR OPEN, where PROPERTIES lives.
  const { at } = await open(page, drawing(), '/MODEL.html?level=3&left=1&lpane=build');
  await page.mouse.click(...at(23, 20 + 1.2));
  await page.waitForTimeout(150);
  const pick = page.locator('#props-slot [data-prop-select="bowls"]');
  await expect(pick).toBeVisible();
  await expect(pick).toHaveValue('double');
  await pick.selectOption('right');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const d = await h.savedDrawing(page);
  expect(d.fixtures.find(f => f.id === 'sb2').bowls).toBe('right');
});

test('while a wall is dragged the LENGTH box reads how far it has gone', async ({ page }) => {
  const { at } = await open(page);
  await page.mouse.click(...at(5, 40));
  await page.waitForTimeout(150);
  await page.mouse.move(...at(5, 40));
  await page.mouse.down();
  await page.mouse.move(...at(5, 41), { steps: 4 });
  await page.mouse.move(...at(5, 43), { steps: 6 });
  await page.waitForTimeout(100);
  const box = page.locator('#frozen-length');
  await expect(box, 'a distance in the box with the button still down').toHaveValue(/^\d+'/);
  const said = await box.inputValue();
  await page.mouse.up();
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const wall = (await h.savedDrawing(page)).walls.find(w => w.id === 'd');
  // WHAT IT SAID IS WHAT THE WALL WENT, to the inch.
  const went = await page.evaluate(ft => window.DraftFormatters.formatArchitecturalInches(ft * 12),
    Math.abs(wall.start.z - 40));
  expect(went).not.toBe("0\"");
  expect(said).toBe(went);
});
