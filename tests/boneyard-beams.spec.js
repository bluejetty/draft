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

    // LEVEL LOCK (on by default): dragging MAIN FL's line drags the
    // foundation's under it too -- every level moves (jb, 16 Nov).
    await level(page, 'MAIN FL');
    await dragWorld(page, { x: mid, z: z + 2 }, { x: mid, z: z + 4 });
    d = await saved(page, ++n);
    expect(d.beams.find(x => x.id === main.id).start.z).toBeCloseTo(z + 4, 3);
    expect(d.beams.find(x => x.id === fdnId).start.z,
      'locked, the line below goes with it').toBeCloseTo(z + 4, 3);

    // LEVEL UNLOCK: MAIN FL's line moves alone.
    await page.locator('#beam-lock').click();
    d = await saved(page, ++n);
    expect(d.beamLock).toBe(false);
    await dragWorld(page, { x: mid, z: z + 4 }, { x: mid, z: z + 6 });
    d = await saved(page, ++n);
    expect(d.beams.find(x => x.id === main.id).start.z).toBeCloseTo(z + 6, 3);
    expect(d.beams.find(x => x.id === fdnId).start.z,
      'unlocked, a line never drags the one below').toBeCloseTo(z + 4, 3);
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
  await tapWorld(page, (b.x0 + b.x1) / 2 + 1, z);  // one span of the line
  await expect(page.locator('#bones2d')).toHaveAttribute('data-beam-pick', /"span":\{/);
  await tapWorld(page, (b.x0 + b.x1) / 2 + 1, z);  // again: the whole line
  await expect(page.locator('#bones2d')).toHaveAttribute('data-beam-pick', /"span":null/);
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

// THE DIMENSIONS (Movie, 28 Oct: "we should also show the dimensions between
// the beams at each end", "(maybe columns too but only when zoomed in closer").
test('a string across the lines at each end, wall to line to line to wall; post spacing once zoomed in',
  async ({ page }) => {
    await boneyardOfTwoStorey(page);
    await level(page, 'FOUNDATION');
    const b = await box(page);
    let n = await savesNow(page);
    const z1 = Math.round(b.z0 + 8), z2 = Math.round(b.z0 + 20);
    await drawLine(page, b, z1);
    await saved(page, ++n);
    await tapWorld(page, b.x0, z2);
    await tapWorld(page, b.x1, z2);
    await saved(page, ++n);
    await page.keyboard.press('Escape');
    const dims = JSON.parse(await page.locator('#bones2d').getAttribute('data-beam-dims'));
    const along = dims.filter(d => d.axis === 'x');
    expect(along.map(d => d.end).sort(), 'one string at each end').toEqual(['end', 'start']);
    along.forEach(d => {
      expect(d.gaps.map(g => Math.round(g * 12)), `${d.end}: wall, line, line, wall`)
        .toEqual([Math.round((z1 - b.z0) * 12), (z2 - z1) * 12, Math.round((b.z1 - z2) * 12)]);
    });
    expect(JSON.parse(await page.locator('#bones2d').getAttribute('data-post-dims')),
      'no post spacing at the fitted size').toEqual([]);
    const c = await page.locator('#bones2d').boundingBox();
    await page.mouse.move(...await at(page, { x: (b.x0 + b.x1) / 2, z: z1 }));
    for (let i = 0; i < 8; i++) await page.mouse.wheel(0, -120);
    const posts = JSON.parse(await page.locator('#bones2d').getAttribute('data-post-dims'));
    expect(posts.length, 'zoomed in, each line\'s posts are dimensioned').toBeGreaterThan(0);
    const len = b.x1 - b.x0;
    const mine = posts.find(g => Math.abs(g.reduce((s, v) => s + v, 0) - len) < 1e-3);
    expect(mine, 'a line wall to wall').toBeTruthy();
    expect(Math.max(...mine), 'no span past 12 ft').toBeLessThanOrEqual(12 + 1e-6);
    expect(c).toBeTruthy();
  });

// SHORTEN A LINE (jb, 16 Nov): "i only need 2 columns and a beam beside the
// stair opening, and i don't need the part that goes over to the walls on
// each side", "CUT a beam after a certain column or between columns", "a
// beam can cantilever up to 2 ft", "grab ... the corner and then M".
const mainLineWithPosts = async page => {
  await boneyardOfTwoStorey(page);
  await level(page, 'MAIN FL');
  const b = await box(page);
  // Clear of the auto line's posts, so the only posts on it are its own.
  const z = Math.round((b.z0 + b.z1) / 2) + 3;
  let n = await savesNow(page);
  const had = new Set((await h.savedDrawing(page)).beams.map(x => x.id));
  await drawLine(page, b, z);
  const d = await saved(page, ++n);
  const line = d.beams.find(x => !had.has(x.id));
  const posts = d.columns.filter(c => c.auto !== true && c.levelId === 3 && Math.abs(c.point.z - z) < 1e-3)
    .map(c => c.point.x).sort((p, q) => p - q);
  await page.locator('#beam-add').click();       // BEAM off
  return { b, z, n, line, posts, had };
};
const handLines = (d, z) => d.beams.filter(x => x.auto !== true && x.levelId === 3 && Math.abs(x.start.z - z) < 1e-3)
  .map(x => [Math.min(x.start.x, x.end.x), Math.max(x.start.x, x.end.x)]).sort((p, q) => p[0] - q[0]);

test('a click picks one span; DELETE cuts it out and the line ends on its columns', async ({ page }) => {
  let { b, z, n, posts } = await mainLineWithPosts(page);
  expect(posts.length, 'a line long enough for two posts').toBeGreaterThanOrEqual(2);
  const [p1] = posts, p2 = posts[posts.length - 1];
  // The span from the left wall to the first post.
  await tapWorld(page, (b.x0 + p1) / 2, z);
  const pick = JSON.parse(await page.locator('#bones2d').getAttribute('data-beam-pick'));
  expect(pick.span.lo).toBeCloseTo(b.x0, 3);
  expect(pick.span.hi).toBeCloseTo(p1, 3);
  await page.screenshot({ path: 'test-results/beam-cut-1-span-picked.png' });
  await page.locator('#beam-delete').click();
  let d = await saved(page, ++n);
  expect(handLines(d, z), 'the line now starts on the first post').toEqual([[expect.closeTo(p1, 3), expect.closeTo(b.x1, 3)]]);
  // And the span past the last post.
  await tapWorld(page, (p2 + b.x1) / 2, z);
  await page.keyboard.press('Delete');
  d = await saved(page, ++n);
  expect(handLines(d, z), 'post to post').toEqual([[expect.closeTo(p1, 3), expect.closeTo(p2, 3)]]);
  const left = d.columns.filter(c => c.auto !== true && c.levelId === 3 && Math.abs(c.point.z - z) < 1e-3);
  expect(left.length, 'every post stays').toBe(posts.length);
  await page.screenshot({ path: 'test-results/beam-cut-2-post-to-post.png' });
  // UNDO puts the span back.
  await page.locator('#undo').click();
  d = await saved(page, ++n);
  expect(handLines(d, z)).toEqual([[expect.closeTo(p1, 3), expect.closeTo(b.x1, 3)]]);
});

test('a cut between two posts leaves two lines; both posts stay', async ({ page }) => {
  let { b, z, n, posts } = await mainLineWithPosts(page);
  const [p1, p2] = posts;
  await tapWorld(page, (p1 + p2) / 2 + 2, z);
  await page.locator('#beam-delete').click();
  const d = await saved(page, ++n);
  expect(handLines(d, z)).toEqual([[expect.closeTo(b.x0, 3), expect.closeTo(p1, 3)],
    [expect.closeTo(p2, 3), expect.closeTo(b.x1, 3)]]);
  expect(d.columns.filter(c => c.auto !== true && c.levelId === 3).length).toBe(posts.length);
});

test('an end drags in onto a column, M moves it out up to a 2 ft cantilever, typed or pointed', async ({ page }) => {
  let { b, z, n, posts } = await mainLineWithPosts(page);
  const p2 = posts[posts.length - 1];
  await tapWorld(page, (p2 + b.x1) / 2, z);      // pick a span: the end squares show
  await expect(page.locator('#bones2d')).toHaveAttribute('data-beam-ends', /"hi"/);
  // Drag the right end in to just shy of the last post: it lands on it.
  await dragWorld(page, { x: b.x1, z }, { x: p2 + 0.2, z });
  let d = await saved(page, ++n);
  expect(handLines(d, z)).toEqual([[expect.closeTo(b.x0, 3), expect.closeTo(p2, 3)]]);
  // Pick the end, M, type 1'6 and ENTER: a cantilever of 1'-6".
  await tapWorld(page, (p2 + posts[posts.length - 2]) / 2 + 2, z);
  await page.mouse.click(...await at(page, { x: p2, z }));
  await expect(page.locator('#bones2d')).toHaveAttribute('data-beam-end', /"which":"hi"/);
  await page.keyboard.press('m');
  await expect(page.locator('#bones2d')).toHaveAttribute('data-beam-end', /"moving":true/);
  await page.keyboard.type("1'6");
  await page.keyboard.press('Enter');
  d = await saved(page, ++n);
  expect(handLines(d, z)[0][1], 'out 1\'-6"').toBeCloseTo(p2 + 1.5, 3);
  // M again and point well past: held at 2'-0" past the post.
  await tapWorld(page, (p2 + posts[posts.length - 2]) / 2 + 2, z);
  await page.mouse.click(...await at(page, { x: p2 + 1.5, z }));
  await page.keyboard.press('m');
  await page.mouse.move(...await at(page, { x: p2 + 5, z }), { steps: 3 });
  await expect(page.locator('#status')).toContainText('held at');
  await page.screenshot({ path: 'test-results/beam-cut-3-cantilever-held.png' });
  await page.mouse.click(...await at(page, { x: p2 + 5, z }));
  d = await saved(page, ++n);
  expect(handLines(d, z)[0][1], 'never past 2 ft').toBeCloseTo(p2 + 2, 3);
});
