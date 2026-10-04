// THE BONEYARD, PR 2: the bones are edited on the right, and the house follows.
//
// Movie, 3 Oct: a moved bone takes "walls, floors, roof" with it; an edge
// moves by "drag or arrow keys, whole feet"; "all of them" of the moving
// rules -- the ladder and its piles included; and "also need to 'break' the
// outline (per foot)".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const empty = () => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

async function boneyardOf(page, family, entry) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.openDriveThru(page);
  await page.locator(`#dt-tiles [data-build-family="${family}"]`).click();
  await page.locator(`#dt-tiles [data-build-entry="${entry}"]`).click();
  await page.locator('#dt-bone').click();
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  await page.goto('/BONEYARD.html');
  await expect(page.locator('body')).toHaveAttribute('data-boneyard-ready', '1', { timeout: 10000 });
}

// A press on the 2D window at a world point.
async function tapWorld(page, x, z) {
  const canvas = page.locator('#bones2d');
  const frame = JSON.parse(await canvas.getAttribute('data-frame'));
  const box = await canvas.boundingBox();
  await page.mouse.click(box.x + frame.ox + x * frame.s, box.y + frame.oy + z * frame.s);
}
async function dragWorld(page, from, to) {
  const canvas = page.locator('#bones2d');
  const frame = JSON.parse(await canvas.getAttribute('data-frame'));
  const box = await canvas.boundingBox();
  const at = p => [box.x + frame.ox + p.x * frame.s, box.y + frame.oy + p.z * frame.s];
  await page.mouse.move(...at(from));
  await page.mouse.down();
  await page.mouse.move(...at({ x: (from.x + to.x) / 2, z: (from.z + to.z) / 2 }), { steps: 4 });
  await page.mouse.move(...at(to), { steps: 4 });
  await page.mouse.up();
}
// After the page's nth write.
const saved = async (page, n) => {
  await expect(page.locator('body')).toHaveAttribute('data-boneyard-saves', String(n), { timeout: 5000 });
  return h.savedDrawing(page);
};
const savesNow = async page => Number(await page.locator('body').getAttribute('data-boneyard-saves') || 0);
const loopsShown = async page => JSON.parse(await page.locator('#bones2d').getAttribute('data-loops'));
const span = pts => ({
  x0: Math.min(...pts.map(p => p.x)), x1: Math.max(...pts.map(p => p.x)),
  z0: Math.min(...pts.map(p => p.z)), z1: Math.max(...pts.map(p => p.z)),
});

test('the arrows push the picked edge a foot at a time, and the house goes with it', async ({ page }) => {
  await boneyardOf(page, 'bungalow', 'bungalow');
  await expect(page.locator('body')).toHaveAttribute('data-boneyard-editable', '1');
  await page.locator('[data-bone-level="FOUNDATION"]').click();
  // The house's back wall, z = -20.
  await tapWorld(page, 0, -20);
  await expect(page.locator('#bones2d')).not.toHaveAttribute('data-selected', '');
  // The two side edges carry their lengths (Movie, 4 Oct: "add the lengths to
  // the 2 side lines connected to the wall that will move").
  await expect(page.locator('#bones2d')).toHaveAttribute('data-side-lengths', '[40,40]');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  const d = await saved(page, 2);
  await expect(page.locator('#bones2d')).toHaveAttribute('data-side-lengths', '[42,42]');
  const main = d.outlines.find(o => Number(o.levelId) === 3 && !o.garage);
  expect(span(main.points).z0, 'MAIN FL came out with the foundation').toBeCloseTo(-22, 4);
  const back = d.walls.filter(w => Math.abs(w.start.z + 22) < 1e-6 && Math.abs(w.end.z + 22) < 1e-6);
  expect(back.map(w => `${w.levelId}:${w.view}`).sort(), 'the concrete and the stud wall both')
    .toEqual(['1:foundation', '3:plan']);
  const slab = d.floors.find(f => Number(f.levelId) === 1 && !f.garage);
  expect(span(slab.points).z0).toBeCloseTo(-22, 4);
  const roof = d.roofs.find(r => !r.garage);
  expect(span(roof.points).z0, 'the eave is still 2 ft past the wall').toBeCloseTo(-24, 4);
  await expect(page.locator('#status')).toContainText('the roof followed');
});

test('a floor pulled past its foundation walks the ladder: 2 ft free, then 4\'-6" on piles', async ({ page }) => {
  await boneyardOf(page, 'bungalow', 'bungalow');
  await page.locator('[data-bone-level="MAIN FL"]').click();
  // The house's left wall, x = -16.
  await tapWorld(page, -16, 0);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  let d = await saved(page, 2);
  let main = d.outlines.find(o => Number(o.levelId) === 3 && !o.garage);
  expect(span(main.points).x0, 'a 2 ft cantilever').toBeCloseTo(-18, 4);
  expect(d.columns.filter(c => c.pileMark === 'P1'), 'nothing under a cantilever').toHaveLength(0);
  const fdn = d.walls.filter(w => Number(w.levelId) === 1 && w.view === 'foundation');
  expect(Math.min(...fdn.flatMap(w => [w.start.x, w.end.x])), 'the foundation stays').toBeCloseTo(-16, 4);
  // One more press cannot land in the gap: it jumps to 4'-6".
  await page.keyboard.press('ArrowLeft');
  d = await saved(page, 3);
  main = d.outlines.find(o => Number(o.levelId) === 3 && !o.garage);
  expect(span(main.points).x0).toBeCloseTo(-20.5, 4);
  const piles = d.columns.filter(c => c.pileMark === 'P1');
  expect(piles.length, 'a row under the edge, at most 8 ft apart').toBeGreaterThanOrEqual(6);
  piles.forEach(p => expect(p.point.x).toBeCloseTo(-20.5, 4));
  // And back down the ladder, the piles with it.
  await page.keyboard.press('ArrowRight');
  d = await saved(page, 4);
  expect(span(d.outlines.find(o => Number(o.levelId) === 3 && !o.garage).points).x0).toBeCloseTo(-18, 4);
  expect(d.columns.filter(c => c.pileMark === 'P1')).toHaveLength(0);
});

test('BREAK puts a corner on a foot mark, and dragging one part makes a jog', async ({ page }) => {
  await boneyardOf(page, 'bungalow', 'bungalow');
  await page.locator('[data-bone-level="FOUNDATION"]').click();
  await page.locator('#break').click();
  await expect(page.locator('#bones2d')).toHaveAttribute('data-mode', 'break');
  // The left wall at z = 0.3: the corner lands on the foot, z = 0.
  await tapWorld(page, -16, 0.3);
  await saved(page, 1);
  await page.locator('#break').click();
  // Drag the front half (z 0..20) out 4 ft.
  await dragWorld(page, { x: -16, z: 10 }, { x: -20, z: 10 });
  const d = await saved(page, 2);
  const main = d.outlines.find(o => Number(o.levelId) === 3 && !o.garage);
  const pts = main.points.map(p => `${p.x},${p.z}`);
  expect(pts, 'the jog').toEqual(expect.arrayContaining(['-20,20', '-20,0', '-16,0', '-16,-20']));
  // A short wall closes the jog, in concrete and in studs.
  const jog = d.walls.filter(w => Math.abs(w.start.z) < 1e-6 && Math.abs(w.end.z) < 1e-6);
  expect(jog.map(w => Number(w.levelId)).sort()).toEqual([1, 3]);
  const shown = await loopsShown(page);
  expect(shown[0].length, 'the foundation loop has six corners now').toBe(6);
});

test('UNDO puts the bones back where they were', async ({ page }) => {
  await boneyardOf(page, 'bungalow', 'bungalow');
  await page.locator('[data-bone-level="FOUNDATION"]').click();
  const before = await loopsShown(page);
  await tapWorld(page, 16, 0);
  await page.keyboard.press('ArrowRight');
  await saved(page, 1);
  expect(await loopsShown(page)).not.toEqual(before);
  await page.locator('#undo').click();
  const d = await saved(page, 2);
  expect(await loopsShown(page)).toEqual(before);
  const main = d.outlines.find(o => Number(o.levelId) === 3 && !o.garage);
  expect(span(main.points).x1).toBeCloseTo(16, 4);
});

test('the edge the garage shares with the house will not move', async ({ page }) => {
  await boneyardOf(page, 'bungalow', 'bungalow-garage');
  await page.locator('[data-bone-level="MAIN FL"]').click();
  await tapWorld(page, 0, 20);
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#status')).toContainText('the garage and the house meet');
  expect(await savesNow(page)).toBe(0);
});

test('with MODEL editing in another tab, the bones can be looked at but not changed', async ({ page }) => {
  await boneyardOf(page, 'bungalow', 'bungalow');
  await page.evaluate(async () => {
    const S = window.SharedFileStore;
    await S.claimLease('model-drawing', 'model', 'another-tab', { takeover: true });
  });
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-boneyard-ready', '1', { timeout: 10000 });
  await expect(page.locator('body')).toHaveAttribute('data-boneyard-editable', '0');
  await expect(page.locator('#status')).toContainText('another tab');
  await page.locator('[data-bone-level="FOUNDATION"]').click();
  await tapWorld(page, 0, -20);
  await page.keyboard.press('ArrowUp');
  const d = await h.savedDrawing(page);
  expect(span(d.outlines.find(o => Number(o.levelId) === 3).points).z0).toBeCloseTo(-20, 4);
});

// THE HOUSE MODEL OPENS IS THE ONE THE BONEYARD SAVED: nothing it wrote is a
// record MODEL's loader refuses and drops.
test('MODEL opens the edited house whole', async ({ page }) => {
  await boneyardOf(page, 'bungalow', 'bungalow-garage');
  await page.locator('[data-bone-level="FOUNDATION"]').click();
  await page.locator('#break').click();
  await tapWorld(page, -16, 0);
  await page.locator('#break').click();
  await dragWorld(page, { x: -16, z: -10 }, { x: -19, z: -10 });
  const edited = await saved(page, 2);
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const again = await h.savedDrawing(page);
  ['walls', 'floors', 'roofs', 'lines', 'fenestrations', 'columns', 'outlines'].forEach(key => {
    expect((again[key] || []).length, key).toBe((edited[key] || []).length);
  });
});

// QUICK PRESSES ARE EACH SAVED. Two writes in flight at once carried the same
// stale revision, and the second was refused -- under load, the second press
// of the ladder test above never reached the store.
test('five quick presses are five saved pushes', async ({ page }) => {
  await boneyardOf(page, 'bungalow', 'bungalow');
  await page.locator('[data-bone-level="FOUNDATION"]').click();
  await tapWorld(page, 16, 0);
  await page.evaluate(() => {
    for (let i = 0; i < 5; i += 1) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    }
  });
  let d = await saved(page, 5);
  let main = d.outlines.find(o => Number(o.levelId) === 3 && !o.garage);
  expect(span(main.points).x1).toBeCloseTo(21, 4);
  // AND THE EDGE IS STILL PICKED after them. Overlapping presses each went
  // looking for the edge where it had been and dropped the pick, so the next
  // press -- in CI, the ladder test's third -- did nothing.
  await page.keyboard.press('ArrowRight');
  d = await saved(page, 6);
  main = d.outlines.find(o => Number(o.levelId) === 3 && !o.garage);
  expect(span(main.points).x1).toBeCloseTo(22, 4);
});

// AND THEY CHANGE WHILE THE EDGE IS STILL IN THE HAND, not only once it lands:
// "so we can see the length change as they pull out or in".
test('the side lengths follow a drag before it is let go', async ({ page }) => {
  await boneyardOf(page, 'bungalow', 'bungalow');
  await page.locator('[data-bone-level="FOUNDATION"]').click();
  await tapWorld(page, 0, -20);
  await expect(page.locator('#bones2d')).toHaveAttribute('data-side-lengths', '[40,40]');
  const canvas = page.locator('#bones2d');
  const frame = JSON.parse(await canvas.getAttribute('data-frame'));
  const box = await canvas.boundingBox();
  const at = p => [box.x + frame.ox + p.x * frame.s, box.y + frame.oy + p.z * frame.s];
  await page.mouse.move(...at({ x: 0, z: -20 }));
  await page.mouse.down();
  await page.mouse.move(...at({ x: 0, z: -23 }), { steps: 6 });
  await expect(canvas).toHaveAttribute('data-side-lengths', '[43,43]');
  await page.mouse.up();
});

// THE OTHER BONES, FADED, FOR LINING UP. Movie, 4 Oct: "could we show the
// other 'BONE lines in faded out or something so i can line up stuff if i
// need to floor to floor, and when they select one, bring it to top and
// increase thickness and opacity of that one". The level under the picked one
// keeps its grey dashes; every other one is drawn faded in its own colour.
test('the 2D window shows the other bones faded under the picked one', async ({ page }) => {
  await boneyardOf(page, 'bungalow', 'bungalow');
  await page.locator('[data-bone-level="MAIN FL"]').click();
  await expect(page.locator('#bones2d')).toHaveAttribute('data-faded', '["ROOF"]');
  await page.locator('[data-bone-level="ROOF"]').click();
  // The roof's own floor is the dashed one; the foundation is faded.
  await expect(page.locator('#bones2d')).toHaveAttribute('data-faded', '["FOUNDATION"]');
});

// Movie, 4 Oct: "a pile was added under the roof i extended but no POST/
// Column going from the pile to the roof" ... "show me the veritical stick".
test('a roof pulled out onto piles stands a post on each, up to the roof', async ({ page }) => {
  await boneyardOf(page, 'bungalow', 'bungalow');
  await page.locator('[data-bone-level="ROOF"]').click();
  // The roof's front edge, over the wall at z = 20.
  await tapWorld(page, 0, 20);
  await expect(page.locator('#bones2d')).not.toHaveAttribute('data-selected', '');
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('ArrowDown');
  const d = await saved(page, 3);
  const piles = d.columns.filter(c => c.pileMark === 'P1');
  expect(piles.length, 'piles under the roof').toBeGreaterThan(0);
  const posts = JSON.parse(await page.locator('#bones3d').getAttribute('data-posts'));
  expect(posts.length, 'one stick per pile').toBe(piles.length);
  const bones = JSON.parse(await page.locator('#bones3d').getAttribute('data-bones'));
  const roof = bones.find(b => b.kind === 'roof');
  posts.forEach(p => {
    expect(p.carries).toBe('roof');
    expect(p.top, 'up to the roof bone').toBeCloseTo(roof.elev, 3);
    expect(p.foot, 'from the top of the concrete').toBeLessThan(p.top);
  });
});
