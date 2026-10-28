// A ROOF DROPPED ONTO THE STOREY BELOW (Movie, 27 Oct).
//
// "i'm going to try to cut the roof how it is now and drop it down to match
// the one beside it (on the hologram) so it will be a gable" -- and "we
// shouldn't drop it automatically but allow the user to drop it somehow, in
// the properties menu maybe? ... i think we already set it up for the lower
// roofs to show on the ROOF PLAN but maybe shaded lighter?". BREAK ROOF cuts
// it with a gable on both pieces; SITS ON drops a piece.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b, levelId) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId, view: 'plan', wallType: 'stud_2x6', refLine: 'center' });
const box = (pre, levelId) => [W(`${pre}1`, [0, 0], [30, 0], levelId), W(`${pre}2`, [30, 0], [30, 20], levelId),
  W(`${pre}3`, [30, 20], [0, 20], levelId), W(`${pre}4`, [0, 20], [0, 0], levelId)];
const EAVE = [[-2, -2], [32, -2], [32, 22], [-2, 22]];
const drawing = () => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 1,
  walls: [...box('m', 3), ...box('u', 5)], lines: [], floors: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
  roofs: [{ id: 'roof-1', levelId: 7, sourceLevelId: 5, follows: 'none', pitch: 6, overhang: 2,
    points: EAVE.map(([x, z]) => ({ x, y: 0, z })), edges: EAVE.map(() => 'eave'),
    edgeOverhang: EAVE.map(() => 2) }],
});

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto('/MODEL.html?level=7&left=1&lpane=drafting');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
const sits = page => page.locator('[data-prop-row="sits on"]');
const roofNow = page => page.evaluate(() => {
  const r = drawing.roofs.find(x => x.id === 'roof-1');
  return { drawnOn: r.drawnOn ?? null, sourceLevelId: r.sourceLevelId ?? null };
});
// Where the roof bears, as the elevations and sections draw it.
const bears = page => page.evaluate(() => {
  const CV = window.DraftCutView;
  const env = cutEnv();
  const stack = CV.sectionLevelStack(env);
  const r = drawing.roofs.find(x => x.id === 'roof-1');
  return Math.round(CV.roofBaseElev(r, stack, env) * 100) / 100;
});

test('SITS ON drops a roof to the storey below: it bears on MAIN FL\'s walls, shows on 2ND FL, and is marked on the ROOF plan', async ({ page }) => {
  const { at } = await open(page);
  await page.mouse.click(...at(15, 10));
  await expect(sits(page).locator('[data-prop-value="top"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#plan')).toHaveAttribute('data-lower-roofs', '0');
  const high = await bears(page);
  await sits(page).locator('[data-prop-value="3"]').click();
  expect(await roofNow(page)).toEqual({ drawnOn: 5, sourceLevelId: 3 });
  await expect(sits(page).locator('[data-prop-value="3"]')).toHaveAttribute('aria-pressed', 'true');
  const low = await bears(page);
  expect(low, 'a storey lower than it was').toBeLessThan(high - 6);
  await expect(page.locator('#plan')).toHaveAttribute('data-lower-roofs', '1');
  // ON THE 2ND FL PLAN too, where the drafter works the walls round it.
  expect(await page.evaluate(() => { goToLevel(5); return roofs().map(r => r.id); })).toEqual(['roof-1']);
  // And back up, and one UNDO from there puts it down again.
  await page.evaluate(() => goToLevel(7));
  await page.mouse.click(...at(15, 10));
  await sits(page).locator('[data-prop-value="top"]').click();
  expect(await roofNow(page)).toEqual({ drawnOn: null, sourceLevelId: 5 });
  expect(await bears(page)).toBeCloseTo(high, 2);
  await page.keyboard.press('Control+z');
  expect(await roofNow(page)).toEqual({ drawnOn: 5, sourceLevelId: 3 });
});

test('a one-storey house offers no SITS ON: there is nothing to drop to', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  const f = drawing();
  f.walls = f.walls.filter(w => w.levelId === 3);
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html?level=7&left=1&lpane=drafting');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  const { at } = await h.planFrame(page);
  await page.mouse.click(...at(15, 10));
  await expect(page.locator('[data-roof-edge-label]')).toBeVisible();
  await expect(sits(page)).toHaveCount(0);
});

// "COPY or CUT would be even better the peice they would like to take down 1
// storey and then go down one story and paste it on that story, and the
// properties change if he does it".
test('CUT a roof on the ROOF plan and paste it on 2ND FL: it lands in place, SITS ON MAIN FL; pasted back on the ROOF plan it is a top roof', async ({ page }) => {
  const { at } = await open(page);
  await page.mouse.click(...at(15, 10));
  await page.keyboard.press('Control+x');
  expect(await page.evaluate(() => drawing.roofs.length), 'cut takes it off the roof').toBe(0);
  await page.evaluate(() => goToLevel(5));
  await page.keyboard.press('Control+v');
  const pasted = await page.evaluate(() => drawing.roofs.map(r => ({ levelId: r.levelId, drawnOn: r.drawnOn ?? null,
    src: r.sourceLevelId, x0: Math.min(...r.points.map(p => p.x)), x1: Math.max(...r.points.map(p => p.x)) })));
  expect(pasted).toEqual([{ levelId: 7, drawnOn: 5, src: 3, x0: -2, x1: 32 }]);
  expect(await page.evaluate(() => roofs().length), 'and it shows on 2ND FL').toBe(1);
  await expect(sits(page).locator('[data-prop-value="3"]')).toHaveAttribute('aria-pressed', 'true');
  // COPY it back up onto the ROOF plan: a roof on the top storey.
  await page.keyboard.press('Control+c');
  await page.evaluate(() => goToLevel(7));
  await page.keyboard.press('Control+v');
  const both = await page.evaluate(() => drawing.roofs.map(r => [r.drawnOn ?? null, r.sourceLevelId]));
  expect(both).toEqual([[5, 3], [null, 5]]);
  // One UNDO takes a paste back; the CUT's own UNDO puts the roof back.
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(() => drawing.roofs.map(r => [r.id, r.drawnOn ?? null]))).toEqual([['roof-1', null]]);
});

// "instead of making the lower roof dimmer, lets make it a redish color
// instead, will be more obvious to the user. make the printed construction
// layout a dimmer or greyer line" (Movie, 28 Oct).
const inkOf = (page, hex) => page.evaluate(want => {
  const c = document.getElementById('plan');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const r = parseInt(want.slice(1, 3), 16), g = parseInt(want.slice(3, 5), 16), b = parseInt(want.slice(5, 7), 16);
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (Math.abs(d[i] - r) < 12 && Math.abs(d[i + 1] - g) < 12 && Math.abs(d[i + 2] - b) < 12) n += 1;
  }
  return n;
}, hex);
test('a lower roof is RED on the ROOF plan, and GREY on the printed roof plan', async ({ page }) => {
  const { at } = await open(page);
  const red = await page.evaluate(() => skin['draw-roof-lower']);
  expect(red).toMatch(/^#[0-9a-f]{6}$/i);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  expect(await inkOf(page, red), 'the main roof is not red').toBeLessThan(20);
  await page.mouse.click(...at(15, 10));
  await sits(page).locator('[data-prop-value="3"]').click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  expect(await inkOf(page, red), 'the lower roof is').toBeGreaterThan(200);
  // On paper: LAYOUT's roof plan, through the same painter LAYOUT uses.
  const printed = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 300;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 400, 300);
    window.DraftLayoutPlan.drawPlan(ctx, p => ({ x: 50 + p.x * 8, y: 50 + p.z * 8 }), drawing, 7, {});
    const d = ctx.getImageData(0, 0, 400, 300).data;
    let grey = 0, brown = 0;
    for (let i = 0; i < d.length; i += 4) {
      const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
      if (r < 200 && Math.abs(r - g) < 8 && Math.abs(g - b) < 8 && r > 110) grey += 1;
      if (r - b > 50 && r < 200) brown += 1;
    }
    return { grey, brown };
  });
  expect(printed.grey, 'the lower roof prints grey').toBeGreaterThan(200);
  expect(printed.brown, 'not in the main roof\'s brown').toBeLessThan(40);
});

// "the ridge lines on the main roof disappeared on that roof plan view i
// noticed, the roof still is on the elevations" (Movie, 28 Oct). The bone's
// own roof has no storey named; a piece dropped onto MAIN FL is below it,
// and must not cut it away inside MAIN FL's outline.
test('a roof dropped onto MAIN FL leaves the bone\'s main roof whole on the ROOF plan, ridges and all', async ({ page }) => {
  await open(page);
  const excluded = await page.evaluate(() => {
    const G = window.DraftGeometry2D;
    const P = a => a.map(([x, z]) => ({ x, y: 0, z }));
    const outlines = [{ id: 'o3', levelId: 3, points: P([[0, 0], [30, 0], [30, 20], [0, 20]]) },
      { id: 'o5', levelId: 5, points: P([[0, 0], [30, 0], [30, 20], [0, 20]]) }];
    const main = { id: 'main', levelId: 7, pitch: 6, points: P([[-2, -2], [32, -2], [32, 22], [-2, 22]]) };
    const piece = { id: 'piece', levelId: 7, pitch: 6, sourceLevelId: 3, drawnOn: 5,
      points: P([[30, 5], [40, 5], [40, 15], [30, 15]]) };
    const bear = roofs => G.roofBearing({ roofs, walls: drawing.walls, outlines, levels: drawing.levels })
      .find(b => b.roof === main).exclude.length;
    return { alone: bear([main]), withDropped: bear([main, piece]),
      withUpper: bear([main, { ...piece, drawnOn: undefined, sourceLevelId: 5 }]) };
  });
  expect(excluded.alone).toBe(0);
  expect(excluded.withDropped, 'a dropped piece cuts nothing out of the main roof').toBe(0);
  expect(excluded.withUpper, 'a storey with its own roof ABOVE still stops it, as before').toBe(1);
});
