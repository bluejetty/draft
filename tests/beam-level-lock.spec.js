// LEVEL LOCK FOR BEAMS AND COLUMNS ON THE WIREFRAME (boneyard-beams.js).
//
// jb, 16 Nov: "can we make it so that the BEAMS and COLUMNS are part of the
// BG Background lines and can we have LEVEL LOCK COLUMNS & BEAMS", then
// "deleting will be all upper layers and the current layer, leave level
// below", "(move beams and columns) all levels will move for LEVEL LOCK",
// "for COPYING and pasting to an upper level ... if they past 2 layers up
// draw the laying in between too", "if there are unsupported columns when
// it is LOCKED can we make them glow red, and for supported columns ...
// green", and "no glows when levels not locked".
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

const glow = async page => JSON.parse(await page.locator('#bones2d').getAttribute('data-column-glow') || '[]');
const near = (c, x, z) => Math.hypot(c.point.x - x, c.point.z - z) < 0.3;

test('copy a foundation line, paste it on 2ND FL: MAIN FL between gets it too, columns glow green',
  async ({ page }) => {
    await boneyardOfTwoStorey(page);
    await expect(page.locator('#beam-lock')).toHaveText('LEVEL LOCK');
    await expect(page.locator('body')).toHaveAttribute('data-beam-lock', '1');
    await level(page, 'FOUNDATION');
    const b = await box(page);
    const zAt = Math.round((b.z0 + b.z1) / 2) + 0.5;
    let n = await savesNow(page);
    const had = new Set((await h.savedDrawing(page)).beams.map(x => x.id));
    await drawLine(page, b, zAt);
    let d = await saved(page, ++n);
    // Where it really landed (a click is a pixel, not an exact foot).
    const z = d.beams.find(x => !had.has(x.id)).start.z;
    const fdnPosts = d.columns.filter(c => c.levelId === 1 && Math.abs(c.point.z - z) < 1e-6);
    expect(fdnPosts.length).toBeGreaterThan(0);
    // ADDING IS THIS LEVEL ONLY.
    expect(d.beams.filter(x => x.levelId !== 1 && Math.abs(x.start.z - z) < 1e-6)).toEqual([]);
    await page.locator('#beam-add').click();      // BEAM off, the line stays picked
    await page.keyboard.press('Control+c');
    await expect(page.locator('#bones2d')).toHaveAttribute('data-beam-clip', /"type":"beam"/);

    await level(page, '2ND FL');
    await page.keyboard.press('Control+v');
    d = await saved(page, ++n);
    for (const id of [3, 5]) {
      expect(d.beams.some(x => x.levelId === id && Math.abs(x.start.z - z) < 1e-6),
        `the line on level ${id}`).toBe(true);
    }
    // Every foundation column has one over it on 2ND FL and on MAIN FL.
    fdnPosts.forEach(p => {
      expect(d.columns.some(c => c.levelId === 3 && near(c, p.point.x, p.point.z)), 'MAIN FL column').toBe(true);
      expect(d.columns.some(c => c.levelId === 5 && near(c, p.point.x, p.point.z)), '2ND FL column').toBe(true);
    });
    const mine = d.columns.filter(c => c.levelId === 5 && Math.abs(c.point.z - z) < 1e-6);
    let g = await glow(page);
    mine.forEach(c => expect(g.find(x => x.id === c.id), 'held up all the way down').toEqual({ id: c.id, glow: 'green' }));

    // A PASTE IS LOCKED TO WHAT IT CAME FROM: drag 2ND FL's line and the
    // foundation's and MAIN FL's go too.
    const mid = (b.x0 + b.x1) / 2 + 1;
    await dragWorld(page, { x: mid, z }, { x: mid, z: z + 2 });
    d = await saved(page, ++n);
    for (const id of [1, 3, 5]) {
      expect(d.beams.some(x => x.levelId === id && Math.abs(x.start.z - z - 2) < 1e-3),
        `moved on level ${id}`).toBe(true);
    }

    // UNLOCK, delete a MAIN FL column: only that one goes, and with the lock
    // back on the 2ND FL column over it glows red.
    await page.keyboard.press('Escape');
    await page.locator('#beam-lock').click();
    d = await saved(page, ++n);
    await expect(page.locator('#beam-lock')).toHaveText('LEVEL UNLOCK');
    expect(await glow(page), 'no glow when unlocked').toEqual([]);
    const p0 = fdnPosts[0].point;
    await level(page, 'MAIN FL');
    await tapWorld(page, p0.x, z + 2);
    await expect(page.locator('#bones2d')).toHaveAttribute('data-beam-pick', /"type":"column"/);
    await page.locator('#beam-delete').click();
    d = await saved(page, ++n);
    expect(d.columns.some(c => c.levelId === 3 && near(c, p0.x, z + 2)), 'gone on MAIN FL').toBe(false);
    expect(d.columns.some(c => c.levelId === 5 && near(c, p0.x, z + 2)), '2ND FL keeps its own').toBe(true);
    expect(d.columns.some(c => c.levelId === 1 && near(c, p0.x, z + 2)), 'and so does the foundation').toBe(true);
    await page.locator('#beam-lock').click();
    d = await saved(page, ++n);
    await level(page, '2ND FL');
    const lone = d.columns.find(c => c.levelId === 5 && near(c, p0.x, z + 2));
    g = await glow(page);
    expect(g.find(x => x.id === lone.id), 'standing on nothing on MAIN FL').toEqual({ id: lone.id, glow: 'red' });

    // LOCKED, A DELETE ON MAIN FL TAKES 2ND FL'S AND LEAVES THE FOUNDATION'S.
    await level(page, 'MAIN FL');
    const other = fdnPosts[fdnPosts.length - 1].point;
    await tapWorld(page, other.x, z + 2);
    await expect(page.locator('#bones2d')).toHaveAttribute('data-beam-pick', /"type":"column"/);
    await page.locator('#beam-delete').click();
    d = await saved(page, ++n);
    expect(d.columns.some(c => c.levelId === 3 && near(c, other.x, z + 2)), 'gone on MAIN FL').toBe(false);
    expect(d.columns.some(c => c.levelId === 5 && near(c, other.x, z + 2)), 'and on 2ND FL above').toBe(false);
    expect(d.columns.some(c => c.levelId === 1 && near(c, other.x, z + 2)), 'the foundation keeps its').toBe(true);
  });

test('a level put in BG shows its beams and columns too', async ({ page }) => {
  await boneyardOfTwoStorey(page);
  await level(page, 'FOUNDATION');
  const b = await box(page);
  const n = await savesNow(page);
  await drawLine(page, b, Math.round((b.z0 + b.z1) / 2) + 0.5);
  await saved(page, n + 1);
  await page.keyboard.press('Escape');
  await level(page, '2ND FL');
  await page.locator('.levels-rail [data-bone-bg="FOUNDATION"]').click();
  const faded = JSON.parse(await page.locator('#bones2d').getAttribute('data-faded-beams') || '[]');
  const fdn = faded.find(f => f.name === 'FOUNDATION');
  expect(fdn, 'the foundation is behind').toBeTruthy();
  expect(fdn.beams, 'with its beams').toBeGreaterThan(0);
  expect(fdn.columns, 'and its columns').toBeGreaterThan(0);
});
