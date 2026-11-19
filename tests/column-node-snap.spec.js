// A COLUMN'S CENTRE IS A NODE (jb, 19 Nov 2026).
//
// On the BASEMENT plan, drawing a wall from a telepost under the floor beam
// above: "can i also make the column node a snappoint for the walls (also
// lines shapes etc)". The cross a post is drawn with marks its centre, and
// nothing caught it. Now every post a plan draws -- its own, the ones under
// the floor beam above, the foundation's ghosted on the basement plan, the
// floor below's on a floor layout -- is a node for every tool
// (model/01 columnSnapPoints, joined into nodeEnds), and on the FOUNDATION
// view the pad's corners catch too.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const SHOTS = process.env.COLUMN_SNAP_SHOTS || '';
const W = (id, a, b, extra) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center', baseHeight: 0, topHeight: 8, ...extra });
const F = (id, a, b) => W(id, a, b, { levelId: 1, view: 'foundation', wallType: 'concrete_8',
  refLine: 'left', baseHeight: -8, topHeight: 0 });
// Two posts under the foundation's beam, one on the main floor's walls plan.
const POST = { x: 7.25, z: 8.4 };
const POST2 = { x: 13.6, z: 8.4 };
const MAIN_POST = { x: 5.3, z: 6.7 };
const drawing = () => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 40, nextRoomTagId: 1,
  walls: [W('n', [0, 0], [20, 0]), W('e', [20, 0], [20, 16]), W('s', [20, 16], [0, 16]), W('w', [0, 16], [0, 0]),
    ...[['fn', [0, 0], [20, 0]], ['fe', [20, 0], [20, 16]], ['fs', [20, 16], [0, 16]], ['fw', [0, 16], [0, 0]]]
      .map(([id, a, b]) => F(id, a, b))],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [], fixtures: [],
  outlines: [], shapes: [], surfaceOpenings: [], notes: [], stairs: [], roomTags: [],
  beams: [{ id: 801, start: { x: 0, y: 0, z: POST.z }, end: { x: 20, y: 0, z: POST.z }, levelId: 1, view: 'foundation' }],
  columns: [
    { id: 901, point: { x: POST.x, y: 0, z: POST.z }, levelId: 1, view: 'foundation', footing: 'pad36' },
    { id: 902, point: { x: POST2.x, y: 0, z: POST2.z }, levelId: 1, view: 'foundation', footing: 'pad36' },
    { id: 903, point: { x: MAIN_POST.x, y: 0, z: MAIN_POST.z }, levelId: 3, view: 'plan', footing: 'pad36' },
  ],
  boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
});
async function open(page, url, skin = { tsquare: false, footLight: false }) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f, skin }) => {
    try { localStorage.setItem('draft-skin', JSON.stringify(skin)); } catch { /* fine */ }
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing(), skin });
  await page.goto(url);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
const BASEMENT = '/MODEL.html?left=1&level=1&view=plan';
const magnet = async page => JSON.parse(await page.locator('#plan').getAttribute('data-snap-magnet') || 'null');
const hover = async (page, at, pt, dx = 2, dy = -1) => {
  const [px, py] = at(pt.x, pt.z);
  await page.mouse.move(px + dx, py + dy);
  await page.waitForTimeout(80);
};
const r4 = n => Number(n.toFixed(4));
const r3 = n => Math.round(n * 1000) / 1000;
async function arm(page, key) {
  await page.evaluate(() => document.activeElement?.blur?.());
  const btn = page.locator(`[data-tool-key="${key}"]`).first();
  if (await btn.getAttribute('aria-pressed') !== 'true') await btn.evaluate(b => b.click());
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
}
const isNode = (lit, p) => !!lit && lit.kind === 'node' && lit.at[0] === r4(p.x) && lit.at[1] === r4(p.z);

test('on the BASEMENT plan a post under the beam above catches WALL, LINE, SHAPE and FLOOR at its centre', async ({ page }) => {
  const { at } = await open(page, BASEMENT);
  for (const key of ['wall', 'line', 'shape', 'floor']) {
    await arm(page, key);
    await hover(page, at, POST, 20, 20);
    await hover(page, at, POST);
    const lit = await magnet(page);
    expect(isNode(lit, POST), `${key}: ${JSON.stringify(lit)}`).toBe(true);
    await page.keyboard.press('Escape');
  }
  // A WALL STARTED THERE STARTS EXACTLY ON THE CENTRE.
  await arm(page, 'wall');
  await page.mouse.click(...at(POST.x, POST.z).map((v, i) => v + (i ? -1 : 2)));
  await page.mouse.click(...at(POST.x, 14));
  await page.keyboard.press('Escape');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const made = (await h.savedDrawing(page)).walls.filter(w => !['n', 'e', 's', 'w', 'fn', 'fe', 'fs', 'fw'].includes(w.id));
  expect(made).toHaveLength(1);
  expect([r3(made[0].start.x), r3(made[0].start.z)]).toEqual([r3(POST.x), r3(POST.z)]);
});

test('the main floor\'s own post catches a LINE; the foundation\'s pads catch at their corners', async ({ page }) => {
  let { at } = await open(page, '/MODEL.html?left=1&level=3&view=plan');
  await arm(page, 'line');
  await hover(page, at, MAIN_POST);
  expect(isNode(await magnet(page), MAIN_POST)).toBe(true);
  // A foundation post is not on the main floor's walls plan: nothing there.
  await hover(page, at, POST);
  expect(isNode(await magnet(page), POST)).toBe(false);
  await page.keyboard.press('Escape');

  ({ at } = await open(page, '/MODEL.html?left=1&level=1&view=foundation'));
  await arm(page, 'line');
  await hover(page, at, POST2);
  expect(isNode(await magnet(page), POST2)).toBe(true);
  const pads = await page.evaluate(() => window.DraftBuildHouse.padGroups(drawing.columns.filter(c => c.levelId === 1)));
  expect(pads.length).toBeGreaterThan(0);
  const corner = { x: pads[0].minX, z: pads[0].minZ };
  await hover(page, at, corner, 3, 3);
  expect(isNode(await magnet(page), corner), JSON.stringify(await magnet(page))).toBe(true);
});

test('a moved column is no magnet for itself; the others still are', async ({ page }) => {
  await open(page, '/MODEL.html?left=1&level=1&view=plan');
  const nodes = await page.evaluate(() => {
    const c = drawing.columns.find(k => k.id === 901);
    return magnetExcluding([c.point]).nodes.map(v => [v.x, v.z]);
  });
  expect(nodes).not.toContainEqual([POST.x, POST.z]);
  expect(nodes).toContainEqual([POST2.x, POST2.z]);
});

// SCREENSHOTS for the PR (COLUMN_SNAP_SHOTS=dir): ROUGH / DAY, zoomed in.
test('shots: the ring on a post on the basement plan, DAY', async ({ page }) => {
  test.skip(!SHOTS, 'screenshots only');
  await page.setViewportSize({ width: 1366, height: 768 });
  await open(page, BASEMENT, { tsquare: false, footLight: false, theme: 'rough', mode: 'day' });
  await page.evaluate(([x, z]) => { view.cx = x; view.cz = z; view.scale = 70; paint(); }, [POST.x + 1, POST.z]);
  await page.waitForTimeout(200);
  const { at } = await h.planFrame(page);
  await arm(page, 'wall');
  await hover(page, at, POST, 30, 30);
  await hover(page, at, POST, 3, 2);
  const [px, py] = at(POST.x, POST.z);
  await page.screenshot({ path: `${SHOTS}/1-wall-tool-ring-on-post.png`, clip: { x: px - 300, y: py - 180, width: 600, height: 360 } });
  await page.mouse.click(px + 2, py - 1);
  await hover(page, at, { x: POST.x + 0.05, z: POST.z + 2.6 }, 0, 0);
  await hover(page, at, { x: POST.x, z: POST.z + 2.5 }, 0, 0);
  await page.screenshot({ path: `${SHOTS}/2-wall-from-post-centre.png`, clip: { x: px - 300, y: py - 180, width: 600, height: 420 } });
});
