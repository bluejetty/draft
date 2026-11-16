// THE STRIP FOOTING'S OUTLINE ON THE FOUNDATION PLAN.
//
// jb, 16 Nov 2026: "show the dotted line for the footing on the foundation
// wall. for 8" conc. foundation it needs a 20" wide footing so the lines will
// be 6" from the ext and in lines of the foundation wall", "all 8" conc
// walls ... it can connect on the inside and blend we only need the
// outline", and ICF on 24", the outside kept to a clean 1/2" with the rest
// to the inside. footing-outline.js works it out; MODEL and the sheets draw it.
const { test, expect } = require('@playwright/test');
const H = require('../proto/harness-env.js');

const W = (id, a, b, wallType = 'concrete_8') => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 1, view: 'foundation', wallType, baseHeight: 0, topHeight: 8, refLine: 'left' });
// A 10 x 6 box, wound so 'left' puts the concrete inside its lines, and a
// 2 ft stub run out of its front (z 0) at x 4, its concrete x 3'-4" to 4'.
const box = (type, stub = true) => [
  W('a', [0, 0], [0, -6], type), W('b', [0, -6], [10, -6], type),
  W('c', [10, -6], [10, 0], type), W('d', [10, 0], [0, 0], type),
  ...(stub ? [W('s', [4, 0], [4, 2], type)] : [])];
const outline = walls => {
  const win = H.loadDraftModules();
  return win.DraftFootingOutline.footingOutline({ walls, levelId: 1, levelAssemblies: [] })
    .map(s => ({ x0: +s.start.x.toFixed(3), z0: +s.start.z.toFixed(3), x1: +s.end.x.toFixed(3), z1: +s.end.z.toFixed(3) }));
};
const has = (segs, x0, z0, x1, z1) => segs.some(s =>
  (Math.abs(s.x0 - x0) < 1e-3 && Math.abs(s.z0 - z0) < 1e-3 && Math.abs(s.x1 - x1) < 1e-3 && Math.abs(s.z1 - z1) < 1e-3)
  || (Math.abs(s.x0 - x1) < 1e-3 && Math.abs(s.z0 - z1) < 1e-3 && Math.abs(s.x1 - x0) < 1e-3 && Math.abs(s.z1 - z0) < 1e-3));

test('8" concrete: one outline 6" outside and 6" inside, blended at the corners', () => {
  const segs = outline(box('concrete_8', false));
  // The box's outer face runs on its lines; the concrete is 8" inside them.
  expect(segs.length, JSON.stringify(segs)).toBe(8);
  expect(has(segs, -0.5, 0.5, 10.5, 0.5)).toBe(true);
  expect(has(segs, 10.5, 0.5, 10.5, -6.5)).toBe(true);
  // Inside: 8" + 6" in from the lines.
  const i = 8 / 12 + 0.5;
  expect(has(segs, i, -i, 10 - i, -i)).toBe(true);
});

test('a stub out of the front: the footing wraps its free end, no line across the join', () => {
  const segs = outline(box('concrete_8'));
  // Round the end: 6" past z 2, and 6" each side of the stub's 8".
  const lo = 4 - 8 / 12 - 0.5;
  expect(has(segs, lo, 2.5, 4.5, 2.5), JSON.stringify(segs)).toBe(true);
  // The front's outside line stops at the stub's footing on both sides.
  expect(has(segs, -0.5, 0.5, lo, 0.5)).toBe(true);
  expect(has(segs, 4.5, 0.5, 10.5, 0.5)).toBe(true);
  expect(segs.some(s => s.z0 === 0.5 && s.z1 === 0.5 && Math.min(s.x0, s.x1) < 4 && Math.max(s.x0, s.x1) > 4)).toBe(false);
});

test('ICF (11 1/4") on 24": 6" outside, 6 3/4" inside', () => {
  const segs = outline(box('icf', false));
  expect(has(segs, -0.5, 0.5, 10.5, 0.5), JSON.stringify(segs)).toBe(true);
  const i = (11.25 + 6.75) / 12;
  expect(has(segs, i, -i, 10 - i, -i)).toBe(true);
});

test('stud walls and hung grade beams get none', () => {
  expect(outline(box('stud_2x6', false))).toEqual([]);
  expect(outline(box('concrete_8', false).map(w => ({ ...w, baseHeight: 2 })))).toEqual([]);
});

test('MODEL FOUNDATION view draws it', async ({ page }) => {
  await page.goto('/MODEL.html?left=1');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 15000 });
  const file = {
    version: 1, board: 'drafting', planTurn: 0, buildType: 'bungalow', autoRoof: false,
    levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -10 }],
    activeLevelIdx: 3, nextDrawingItemId: 50, walls: box('concrete_8'),
    lines: [], floors: [], fenestrations: [], dimensions: [], outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
    roomTags: [], columns: [], beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [], roofs: [],
  };
  await page.evaluate(async f => {
    await window.SharedFileStore.saveSharedFile(new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), 'model-drawing');
  }, file);
  await page.goto('/MODEL.html?level=1&view=foundation&left=1');
  await expect.poll(() => page.locator('#plan').getAttribute('data-footing-outline'), { timeout: 15000 }).toBe('12');
});
