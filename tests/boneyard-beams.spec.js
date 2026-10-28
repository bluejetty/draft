// THE BEAMS ON THE WIREFRAME (boneyard-beams.js).
//
// Movie, 28 Oct: "for the beams - which i think will be easier to edit in the
// wireframe area, i'd like to be able to add a beam line in the basement/
// crawl space", "so i will need to be able to add a beam line (in the
// foundation) on wireframe and remove a beamline on the main floor, but the 2
// beamlines on the main floor should be alligned with 2 of the foundation
// beamlines in the center".
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

async function boneyardOfTwoStorey(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.openDriveThru(page);
  await page.locator('#dt-tiles [data-build-family="bungalow"]').click();
  await page.locator('#dt-tiles [data-build-entry="twoStorey"]').click();
  await page.locator('#dt-bone').click();
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  await page.goto('/BONEYARD.html');
  await expect(page.locator('body')).toHaveAttribute('data-boneyard-ready', '1', { timeout: 10000 });
  await expect(page.locator('body')).toHaveAttribute('data-boneyard-editable', '1');
}

const at = async (page, p) => {
  const canvas = page.locator('#bones2d');
  const frame = JSON.parse(await canvas.getAttribute('data-frame'));
  const box = await canvas.boundingBox();
  return [box.x + frame.ox + p.x * frame.s, box.y + frame.oy + p.z * frame.s];
};
const tapWorld = async (page, x, z) => page.mouse.click(...await at(page, { x, z }));
const dragWorld = async (page, from, to) => {
  await page.mouse.move(...await at(page, from));
  await page.mouse.down();
  await page.mouse.move(...await at(page, { x: (from.x + to.x) / 2, z: (from.z + to.z) / 2 }), { steps: 4 });
  await page.mouse.move(...await at(page, to), { steps: 4 });
  await page.mouse.up();
};
const saved = async (page, n) => {
  await expect(page.locator('body')).toHaveAttribute('data-boneyard-saves', String(n), { timeout: 5000 });
  return h.savedDrawing(page);
};
const savesNow = async page => Number(await page.locator('body').getAttribute('data-boneyard-saves') || 0);
const shownBeams = async page => JSON.parse(await page.locator('#bones2d').getAttribute('data-beams') || '[]');
const shownColumns = async page => JSON.parse(await page.locator('#bones2d').getAttribute('data-columns') || '[]');
const box = async page => {
  const loops = JSON.parse(await page.locator('#bones2d').getAttribute('data-loops'));
  const pts = loops[0];
  return { x0: Math.min(...pts.map(p => p[0])), x1: Math.max(...pts.map(p => p[0])),
    z0: Math.min(...pts.map(p => p[1])), z1: Math.max(...pts.map(p => p[1])) };
};
const level = (page, name) => page.locator(`[data-bone-level="${name}"]`).click();

// A line across the house along x, at z, drawn with BEAM.
const drawLine = async (page, b, z) => {
  await page.locator('#beam-add').click();
  await tapWorld(page, b.x0, z);
  await tapWorld(page, b.x1, z);
};

test('BEAM draws a foundation line wall to wall, with columns at most 12 ft apart', async ({ page }) => {
  await boneyardOfTwoStorey(page);
  await level(page, 'FOUNDATION');
  const b = await box(page);
  const before = (await shownBeams(page)).length;
  const n = await savesNow(page);
  const z = Math.round((b.z0 + b.z1) / 2);
  const had = new Set((await h.savedDrawing(page)).beams.map(x => x.id));
  await drawLine(page, b, z);
  const d = await saved(page, n + 1);
  const mine = d.beams.filter(x => !had.has(x.id));
  expect(mine.length, 'one hand line on the foundation').toBe(1);
  expect(mine[0].view).toBe('foundation');
  expect(mine[0].start.z, 'square, at the clicked line').toBeCloseTo(z, 3);
  expect(Math.min(mine[0].start.x, mine[0].end.x), 'from the wall').toBeCloseTo(b.x0, 3);
  expect(Math.max(mine[0].start.x, mine[0].end.x), 'to the wall').toBeCloseTo(b.x1, 3);
  const len = b.x1 - b.x0;
  const posts = d.columns.filter(c => c.auto !== true && c.levelId === 1 && Math.abs(c.point.z - z) < 1e-6);
  expect(posts.length, 'no span past 12 ft').toBe(Math.ceil(len / 12) - 1);
  expect((await shownBeams(page)).length, 'and it is drawn').toBe(before + 1);
});

test('a MAIN FL line drawn near a foundation line lands on it, and rides with it when it moves',
  async ({ page }) => {
    await boneyardOfTwoStorey(page);
    await level(page, 'FOUNDATION');
    const b = await box(page);
    const z = Math.round((b.z0 + b.z1) / 2);
    let n = await savesNow(page);
    const had = new Set((await h.savedDrawing(page)).beams.map(x => x.id));
    await drawLine(page, b, z);
    const fdnId = (await saved(page, ++n)).beams.find(x => !had.has(x.id)).id;
    await page.keyboard.press('Escape');

    await level(page, 'MAIN FL');
    await expect(page.locator('#bones2d')).toHaveAttribute('data-beams-below', /[1-9]/);
    // A hair off, well inside the snap: it lands exactly over the one below.
    await drawLine(page, b, z + 0.4);
    let d = await saved(page, ++n);
    const main = d.beams.find(x => !had.has(x.id) && x.id !== fdnId);
    expect(main, 'a hand line on MAIN FL').toBeTruthy();
    expect(main.view).toBe('floor');
    expect(main.start.z, 'lined up over the foundation line').toBeCloseTo(z, 6);
    await page.keyboard.press('Escape');

    // Drag the FOUNDATION line 2 ft: MAIN's goes with it, posts and all.
    await level(page, 'FOUNDATION');
    const mid = (b.x0 + b.x1) / 2 + 3;
    await dragWorld(page, { x: mid, z }, { x: mid, z: z + 2 });
    d = await saved(page, ++n);
    const fdn = d.beams.find(x => x.id === fdnId);
    const up = d.beams.find(x => x.id === main.id);
    expect(fdn.start.z, 'the foundation line moved').toBeCloseTo(z + 2, 3);
    expect(up.start.z, 'and MAIN FL\'s stayed over it').toBeCloseTo(z + 2, 3);
    const upPosts = d.columns.filter(c => c.auto !== true && c.levelId === 3);
    expect(upPosts.length, 'MAIN FL\'s line kept its columns').toBeGreaterThan(0);
    upPosts.forEach(c => expect(c.point.z, 'on the moved line').toBeCloseTo(z + 2, 3));

    // Dragging MAIN FL's own line leaves the foundation's where it is.
    await level(page, 'MAIN FL');
    await dragWorld(page, { x: mid, z: z + 2 }, { x: mid, z: z + 6 });
    d = await saved(page, ++n);
    expect(d.beams.find(x => x.id === main.id).start.z).toBeCloseTo(z + 6, 3);
    expect(d.beams.find(x => x.id === fdnId).start.z,
      'a line never drags the one below').toBeCloseTo(z + 2, 3);
  });

test('DELETE takes a picked MAIN FL line and its columns; UNDO puts them back', async ({ page }) => {
  await boneyardOfTwoStorey(page);
  await level(page, 'MAIN FL');
  const b = await box(page);
  const z = Math.round((b.z0 + b.z1) / 2);
  let n = await savesNow(page);
  await drawLine(page, b, z);
  let d = await saved(page, ++n);
  const posts = d.columns.filter(c => c.auto !== true && c.levelId === 3).length;
  expect(posts).toBeGreaterThan(0);
  await page.locator('#beam-add').click();       // BEAM off
  await expect(page.locator('#beam-add')).toHaveAttribute('aria-pressed', 'false');
  await tapWorld(page, (b.x0 + b.x1) / 2 + 1, z);  // pick the line
  await expect(page.locator('#beam-delete')).toBeEnabled();
  await page.locator('#beam-delete').click();
  d = await saved(page, ++n);
  expect(d.beams.filter(x => x.auto !== true && x.levelId === 3), 'the line is gone').toEqual([]);
  expect(d.columns.filter(c => c.auto !== true && c.levelId === 3), 'with its columns').toEqual([]);
  await page.locator('#undo').click();
  d = await saved(page, ++n);
  expect(d.beams.filter(x => x.auto !== true && x.levelId === 3).length, 'UNDO brings it back').toBe(1);
  expect(d.columns.filter(c => c.auto !== true && c.levelId === 3).length).toBe(posts);
});

test('COLUMN puts a post on a line; a post drags along its line and DELETE takes it', async ({ page }) => {
  await boneyardOfTwoStorey(page);
  await level(page, 'FOUNDATION');
  const b = await box(page);
  const z = Math.round((b.z0 + b.z1) / 2);
  let n = await savesNow(page);
  await drawLine(page, b, z);
  let d = await saved(page, ++n);
  const count = () => d.columns.filter(c => c.auto !== true && c.levelId === 1).length;
  const first = count();
  await page.locator('#column-add').click();
  const x = b.x0 + 3;
  await tapWorld(page, x, z + 0.3);
  d = await saved(page, ++n);
  expect(count(), 'one more post').toBe(first + 1);
  const added = d.columns.find(c => c.auto !== true && c.levelId === 1 && Math.abs(c.point.x - x) < 0.1);
  expect(added.point.z, 'on the line, not where the click was').toBeCloseTo(z, 6);
  await page.locator('#column-add').click();      // COLUMN off
  await dragWorld(page, { x, z }, { x: x + 2, z: z + 1 });
  d = await saved(page, ++n);
  const moved = d.columns.find(c => c.id === added.id);
  expect(moved.point.x, 'along the line').toBeCloseTo(x + 2, 1);
  expect(moved.point.z, 'never off it').toBeCloseTo(z, 6);
  await page.keyboard.press('Delete');
  d = await saved(page, ++n);
  expect(d.columns.some(c => c.id === added.id), 'DELETE took the post').toBe(false);
  expect(d.beams.some(x2 => x2.auto !== true && x2.levelId === 1), 'and left the line').toBe(true);
});

test('the 3D shows each level\'s lines under the floor they carry', async ({ page }) => {
  await boneyardOfTwoStorey(page);
  await level(page, 'FOUNDATION');
  const b = await box(page);
  const z = Math.round((b.z0 + b.z1) / 2);
  let n = await savesNow(page);
  await drawLine(page, b, z);
  await saved(page, ++n);
  await page.keyboard.press('Escape');
  await level(page, 'MAIN FL');
  await drawLine(page, b, z);
  await saved(page, ++n);
  const shown3d = JSON.parse(await page.locator('#bones3d').getAttribute('data-beams'));
  const fdn = shown3d.find(l => l.name === 'FOUNDATION');
  const main = shown3d.find(l => l.name === 'MAIN FL');
  expect(fdn.beams, 'the foundation line').toBeGreaterThan(0);
  expect(main.beams, 'MAIN FL\'s line').toBeGreaterThan(0);
  expect(fdn.top, 'the foundation\'s under MAIN FL').toBeLessThan(main.top);
});
