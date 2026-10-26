// A SUITE MEETS ANOTHER BY ITS END LINES (Movie, 25 Oct), the corner rings
// of 23 Oct retired: "on the suite i think the RINGS on the corners don't
// work that great. how about we make a LINE on each end of the suite (top
// and bott of the screen) that start and end where the RINGS are located
// and when the user puts the suite holograms close together those LINES
// should snap" -- "should line up to become one line and sometimes the
// suite will job in or out so will need to slide back and forther to allow
// that" -- and the lines "extend ... 2 ft past" each corner, so "a user can
// see them easily and grab onto the line directly easily".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b) => ({ id, levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 9, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
const SN = (id, x, z) => ({ id, levelId: 3, view: 'plan', point: { x, y: 0, z } });
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 },
  { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
const EMPTY = { walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [],
  beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [], superNodes: [] };
// A 20 x 15 suite. (The super nodes an old file kept are ignored now.)
const SUITE = { version: 1, levels: LEVELS, activeLevelIdx: 2, ...EMPTY,
  walls: [W('s1', [0, 0], [20, 0]), W('s2', [20, 0], [20, 15]), W('s3', [20, 15], [0, 15]), W('s4', [0, 15], [0, 0])],
  superNodes: [SN('c1', 0, 0), SN('c2', 20, 0), SN('c3', 20, 15), SN('c4', 0, 15)] };
// h1 at the origin, h2 standing forty down the sheet, below it; no house
// super nodes at all.
const plan = (h2 = {}) => ({
  version: 1, board: 'drafting', planTurn: 0, levels: LEVELS, activeLevelIdx: 2, ...EMPTY,
  nextDrawingItemId: 20,
  holograms: [
    { id: 'h1', name: 'suite-a', mode: 'suite', x: 0, z: 0, angleDeg: 0, pivotX: 10, pivotZ: 7.5, source: SUITE },
    { id: 'h2', name: 'suite-b', mode: 'suite', x: 0, z: 40, angleDeg: 0, pivotX: 10, pivotZ: 7.5, source: SUITE, ...h2 },
  ] });

async function open(page, drawing) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    try { localStorage.removeItem('draft-skin'); } catch { /* fine */ }
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing });
  await page.goto('/MODEL.html?level=3&left=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  const levels = page.getByRole('button', { name: 'LEVELS / LAYERS' });
  if (await levels.count() && await levels.getAttribute('aria-expanded') === 'true') await levels.click();
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
const saved = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};
const r3 = n => Math.round(n * 1000) / 1000;
const lockAt = async page => JSON.parse(await page.locator('#plan').getAttribute('data-super-lock') || 'null');
async function grab(page, at, from) {
  await page.locator('[data-mode-hologram]').click();
  // TWO COPIES ON THE CARD: h1's row picked opens its buttons.
  await page.locator('#hologram-ask [data-hologram-row="h1"]').click();
  await page.locator('#hologram-ask [data-hologram-move="h1"]').click();
  await page.mouse.move(...at(...from));
  await page.mouse.down();
}
const to = async (page, at, pt) => { await page.mouse.move(...at(...pt), { steps: 8 }); await page.waitForTimeout(100); };
const drop = async page => { await page.mouse.up(); await page.waitForTimeout(150); };

const lineLock = page => page.locator('#plan').getAttribute('data-line-lock');
// Where each suite's end lines stand, as the page works them out.
const lines = (page, id) => page.evaluate(id => {
  const holo = drawing.holograms.find(o => o.id === id);
  return window.DraftHologram.suiteEndLines(holo, activeLevelId())
    .map(L => ({ end: L.end, z: L.a.z, x0: Math.min(L.ea.x, L.eb.x), x1: Math.max(L.ea.x, L.eb.x), cx: L.a.x }));
}, id);

test('the end lines: a top and a bottom, 2 ft past each corner; no corner rings', async ({ page }) => {
  await open(page, plan());
  const [top, bottom] = await lines(page, 'h1');
  expect([top.end, bottom.end]).toEqual(['top', 'bottom']);
  expect(top.z).toBeLessThan(0);          // out to the wall's outside face
  expect(bottom.z).toBeGreaterThan(15);
  // The corners sit on the wall faces; the line runs 2 ft past each.
  expect(top.x1 - top.x0 - (bottom.x1 - bottom.x0)).toBeCloseTo(0, 6);
  const wide = await page.evaluate(() => {
    const L = window.DraftHologram.suiteEndLines(drawing.holograms[0], activeLevelId())[0];
    return [L.len, Math.hypot(L.eb.x - L.ea.x, L.eb.z - L.ea.z)];
  });
  expect(wide[1] - wide[0]).toBeCloseTo(4, 6);
});

// THREE INCHES now (Movie, 26 Oct, the one snap rule: suite lines "both at 3"").
test('within 3": the bottom line meets the suite below\'s top line -- one line -- and the suite stays where the hand put it the other way', async ({ page }) => {
  const { at } = await open(page, plan());
  const gap = (await lines(page, 'h2'))[0].z - (await lines(page, 'h1'))[1].z;
  // Down to two inches short of meeting, and two feet over: a jog.
  await grab(page, at, [10, 7.5]);
  await to(page, at, [10 + 2, 7.5 + gap - 2 / 12]);
  expect(await lineLock(page), 'the suite below\'s top line has it').toBe('h2:top');
  expect(await page.locator('#plan').getAttribute('data-suite-lines'), 'both lines lit').toBe('2');
  await drop(page);
  const d = await saved(page);
  expect(d.holograms[0].z, 'down onto the line').toBeCloseTo(gap, 4);
  expect(d.holograms[0].x, 'the jog is kept').toBeCloseTo(2, 1);
  const [, bottom] = await lines(page, 'h1');
  expect(bottom.z).toBeCloseTo((await lines(page, 'h2'))[0].z, 6);
  // JOINED: the shared stretch is drawn in both colours, turn about.
  await expect(page.locator('#plan')).toHaveAttribute('data-joined-lines', '1');
});

test('lines that do not quite meet stay solid: nothing is drawn joined', async ({ page }) => {
  await open(page, plan({ z: 40 }));
  await expect(page.locator('#plan')).toHaveAttribute('data-joined-lines', '0');
  // Put exactly on, they join.
  await page.evaluate(() => {
    const [h1, h2] = drawing.holograms;
    const gap = window.DraftHologram.suiteEndLines(h2, activeLevelId())[0].a.z
      - window.DraftHologram.suiteEndLines(h1, activeLevelId())[1].a.z;
    h1.z += gap; paint();
  });
  await expect(page.locator('#plan')).toHaveAttribute('data-joined-lines', '1');
});

test('a foot short, nothing catches', async ({ page }) => {
  const { at } = await open(page, plan());
  const gap = (await lines(page, 'h2'))[0].z - (await lines(page, 'h1'))[1].z;
  await grab(page, at, [10, 7.5]);
  await to(page, at, [10, 7.5 + gap - 1]);
  expect(await lineLock(page)).toBeNull();
  await drop(page);
  expect((await saved(page)).holograms[0].z).toBeCloseTo(gap - 1, 1);
});

test('the corners no longer pull: corner to corner across, with the lines not facing, nothing catches', async ({ page }) => {
  // h2 beside h1 this time, its corner three inches off h1's.
  const { at } = await open(page, plan({ x: 40, z: 0 }));
  await grab(page, at, [10, 7.5]);
  await to(page, at, [10 + 19.75, 7.5]);
  expect(await lineLock(page)).toBeNull();
  expect(await page.locator('#plan').getAttribute('data-super-lock')).toBeNull();
  await drop(page);
});

// A SUITE FILE STILL BLUE: its kind says suite (its stored super nodes used
// to; SUPERNODE is gone).
test('a blue hologram\'s lines catch too', async ({ page }) => {
  const { at } = await open(page, plan({ mode: 'hologram', source: { ...SUITE, suiteKind: 'residential' } }));
  const gap = (await lines(page, 'h2'))[0].z - (await lines(page, 'h1'))[1].z;
  await grab(page, at, [10, 7.5]);
  await to(page, at, [10, 7.5 + gap - 2 / 12]);
  expect(await lineLock(page)).toBe('h2:top');
  await drop(page);
});

test('a press on a suite\'s line picks it up and drags it -- no card, no MOVE; a click that moves nothing leaves it be', async ({ page }) => {
  const { at } = await open(page, plan());
  const gap = (await lines(page, 'h2'))[0].z - (await lines(page, 'h1'))[1].z;
  const [, bottom] = await lines(page, 'h1');
  // A foot past the corner, on the bottom line's reach.
  const grabAt = [bottom.x1 - 1, bottom.z];
  await page.mouse.move(...at(...grabAt));
  await page.mouse.down();
  await to(page, at, [grabAt[0] + 1, grabAt[1] + gap - 0.2]);
  expect(await lineLock(page)).toBe('h2:top');
  await drop(page);
  let d = await saved(page);
  expect(d.holograms[0].z).toBeCloseTo(gap, 4);
  // A click on the line that moves nothing: nothing moves and nothing is left in hand.
  const [, now] = await lines(page, 'h1');
  await page.mouse.click(...at(now.x1 - 1, now.z));
  await page.waitForTimeout(150);
  await page.mouse.move(...at(now.x1 - 1 + 3, now.z + 3), { steps: 4 });
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => traceMoving), 'nothing left in hand').toBeNull();
  d = await saved(page);
  expect(d.holograms[0].z).toBeCloseTo(gap, 4);
  expect(d.holograms[0].x).toBeCloseTo(1, 1);
});
