// THE SMALL GABLE OF A STEPPED END STAYS A SPECIAL CASE (jb, 26 Nov 2026).
//
// "i'm trying to change the roof from hip to gable and then the front gable
// gets deleted so i'm copying the special piece first with the thicker fascia
// to try to paste it afterwards ... but when i paste it the main roof seems to
// disappear". Two faults:
//  1. A press on the hipped stepped-back end re-cut the pair and threw the
//     small piece away for a plain new one: its 18" fascia, its SPECIAL CASE
//     list and the corners he had moved were gone. The re-cut piece now keeps
//     its id, `own` values, finish, seat and moved corners.
//  2. A pasted copy of the small piece kept `jogOf`, the big roof took both
//     small pieces' tails out of itself and drew no planes. A paste stays
//     paired only onto a big roof with no small piece; a file saved with two
//     opens with the first one paired.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const WALL = [[-29, 5], [-30, 5], [-30, -15], [30, -15], [30, 15], [-29, 15]];
const EAVE = [[-31, 7], [-32, 7], [-32, -17], [32, -17], [32, 17], [-31, 17]];
const drawing = roofs => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 1,
  walls: [], lines: [], floors: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
  roofs,
});
const plainRoof = () => ({ id: 'roof-1', levelId: 7, follows: 'house', pitch: 4, overhang: 2,
  points: EAVE.map(([x, z]) => ({ x, y: 0, z })), edges: EAVE.map(() => 'eave'),
  edgeOverhang: EAVE.map(() => 2), footprint: WALL.map(([x, z]) => ({ x, y: 0, z })) });

async function open(page, f) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html?level=7&left=1&lpane=drafting');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
}
const ring = roof => roof.points.map(p => [Math.round(p.x * 100) / 100, Math.round(p.z * 100) / 100]);
// How much of the big roof its planes cover, against its ring less any cut.
const planesOf = (page, id) => page.evaluate(id => {
  const G = window.DraftGeometry2D;
  const r = drawing.roofs.find(x => String(x.id) === id);
  const faces = G.roofFaces(r, G.roofSkeleton(r));
  return faces.length;
}, id);

// The hipped end with a small gable running back into it (the long piece
// that sticks out pressed GABLE), then the small one made special: an 18"
// fascia of its own, a stucco board, its front pulled out 2 ft.
async function specialPair(page) {
  await open(page, drawing([plainRoof()]));
  await page.evaluate(() => {
    const big = drawing.roofs.find(r => r.id === 'roof-1');
    jogEndPress(big, 1, 'gable');
    const small = drawing.roofs.find(r => r.jogOf === 'roof-1');
    small.fascia = 18;
    small.own = ['fascia'];
    small.fasciaFinish = 'stucco';
    small.points = small.points.map(p => (Math.abs(p.x + 32) < 1e-6 ? { ...p, x: -34 } : p));
    paint();
  });
  return page.evaluate(() => JSON.parse(JSON.stringify(drawing.roofs.find(r => r.jogOf === 'roof-1'))));
}

test('GABLE on the hipped end of a cut pair keeps the small piece special: id, fascia, finish, moved corners', async ({ page }) => {
  const was = await specialPair(page);
  expect(ring(was).filter(([x]) => x === -34).length, 'its front pulled out to x -34').toBe(2);
  // jb's press: the main roof's hipped end (the stepped-back line) to GABLE.
  await page.evaluate(() => {
    const big = drawing.roofs.find(r => r.id === 'roof-1');
    const i = big.points.findIndex((p, k) => {
      const q = big.points[(k + 1) % big.points.length];
      return Math.abs(p.x + 31) < 1e-6 && Math.abs(q.x + 31) < 1e-6;
    });
    jogEndPress(big, i, 'gable');
  });
  const roofs = await page.evaluate(() => JSON.parse(JSON.stringify(drawing.roofs)));
  expect(roofs.length, 'the big gable and the small one, nothing deleted').toBe(2);
  const big = roofs.find(r => r.id === 'roof-1');
  const small = roofs.find(r => r.id !== 'roof-1');
  expect(big.edges.filter(k => k === 'gable').length, 'the main roof gabled across').toBe(1);
  expect(small.id, 'the same piece').toBe(was.id);
  expect(small.jogOf).toBe('roof-1');
  expect(small.fascia, 'its own 18" fascia').toBe(18);
  expect(small.own).toEqual(['fascia']);
  expect(small.fasciaFinish).toBe('stucco');
  expect(ring(small).filter(([x]) => x === -34).length, 'its front still out at x -34').toBe(2);
  expect(ring(small).some(([x]) => x === -32), 'no corner left on the old front').toBe(false);
  expect(small.edges.filter(k => k === 'gable').length, 'still a gable').toBe(1);
  const groups = await page.evaluate(() => drawing.groups);
  expect(groups.some(g => (g.members || []).some(m => m.id === was.id) && g.members.some(m => m.id === 'roof-1')),
    'still in the assembly with the main roof').toBe(true);
  expect(await planesOf(page, 'roof-1')).toBeGreaterThan(0);
  // UNDO puts the hipped end and the special piece back as they were.
  await page.keyboard.press('Control+z');
  const back = await page.evaluate(() => JSON.parse(JSON.stringify(drawing.roofs.find(r => r.jogOf === 'roof-1'))));
  expect(back).toEqual(was);
});

test('a pasted copy of the small piece is a roof of its own; the main roof keeps its planes', async ({ page }) => {
  const was = await specialPair(page);
  await page.evaluate(() => {
    const big = drawing.roofs.find(r => r.id === 'roof-1');
    const i = big.points.findIndex((p, k) => {
      const q = big.points[(k + 1) % big.points.length];
      return Math.abs(p.x + 31) < 1e-6 && Math.abs(q.x + 31) < 1e-6;
    });
    jogEndPress(big, i, 'gable');
    setSelection([{ type: 'roof', item: drawing.roofs.find(r => r.jogOf === 'roof-1') }]);
  });
  await page.locator('#copy').click();
  await page.locator('#paste').click();
  const roofs = await page.evaluate(() => JSON.parse(JSON.stringify(drawing.roofs)));
  expect(roofs.length).toBe(3);
  const pasted = roofs.find(r => r.id !== 'roof-1' && r.id !== was.id);
  expect(pasted.jogOf, 'the copy is not a second small piece of the main roof').toBeUndefined();
  expect(pasted.fascia).toBe(18);
  expect(roofs.filter(r => r.jogOf === 'roof-1').length).toBe(1);
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const saved = (await h.savedDrawing(page)).roofs;
  const big = saved.find(r => r.id === 'roof-1');
  expect((big.cuts || []).filter(c => c.jog).length, 'one tail at most, the paired piece\'s').toBeLessThanOrEqual(1);
  expect(await planesOf(page, 'roof-1'), 'the main roof keeps its planes').toBeGreaterThan(0);
});

test('a CUT small piece pasted back pairs with its main roof again', async ({ page }) => {
  const was = await specialPair(page);
  await page.evaluate(() => setSelection([{ type: 'roof', item: drawing.roofs.find(r => r.jogOf === 'roof-1') }]));
  await page.keyboard.press('Control+x');
  expect(await page.evaluate(() => drawing.roofs.length)).toBe(1);
  await page.evaluate(() => pasteHeld({ nudge: false }));
  const pasted = await page.evaluate(() => JSON.parse(JSON.stringify(drawing.roofs.find(r => r.id !== 'roof-1'))));
  expect(pasted.jogOf, 'paired again').toBe('roof-1');
  expect(pasted.fascia).toBe(was.fascia);
});

test('a file saved with two small pieces on one main roof opens with the first one paired', async ({ page }) => {
  // jb's own file, cut down: the main roof gabled across, the plain small
  // piece the press made, and the pasted special copy still naming it.
  const big = { id: 'roof-61', levelId: 7, follows: 'none', pitch: 8, overhang: 0,
    points: [[-1, 0], [-41.5, 0], [-41.5, -19.5], [-1, -19.5]].map(([x, z]) => ({ x, y: 0, z })),
    edges: ['eave', 'eave', 'eave', 'gable'], edgeOverhang: [0, 0, 0, 0],
    flushOf: { levelId: 7, pitch: 8, overhang: 0, follows: 'none',
      points: [[0, 0], [-41.5, 0], [-41.5, -19.5], [-1, -19.5], [-1, -13], [0, -13]].map(([x, z]) => ({ x, y: 0, z })),
      edges: ['eave', 'eave', 'eave', 'gable', 'gable', 'gable'], edgeOverhang: [0, 0, 0, 0, 0, 0] },
    cuts: [{ points: [{ x: -1, z: 0 }, { x: -7.5, z: -6.5 }, { x: -1, z: -13 }], jog: true }] };
  const plain = { id: 'roof-185', levelId: 7, follows: 'none', pitch: 8, overhang: 0, jogOf: 'roof-61',
    points: [[-1, 0], [-1, -13], [0, -13], [0, 0]].map(([x, z]) => ({ x, y: 0, z })),
    edges: ['joint', 'eave', 'gable', 'eave'], edgeOverhang: [0, 0, 0, 0] };
  const pasted = { id: 'roof-186', levelId: 7, follows: 'none', pitch: 8, fascia: 18, own: ['fascia', 'pitch'], overhang: 0, jogOf: 'roof-61',
    points: [[-1, 0], [-7.5, -6.5], [-1, -13], [2, -13], [2, 0]].map(([x, z]) => ({ x, y: 0, z })),
    edges: ['joint', 'joint', 'eave', 'gable', 'eave'], edgeOverhang: [0, 0, 0, 0, 0] };
  await open(page, drawing([big, plain, pasted]));
  const roofs = await page.evaluate(() => JSON.parse(JSON.stringify(drawing.roofs)));
  expect(roofs.find(r => r.id === 'roof-185').jogOf).toBe('roof-61');
  expect(roofs.find(r => r.id === 'roof-186').jogOf).toBeUndefined();
  expect(roofs.find(r => r.id === 'roof-61').cuts || [], 'no valley tail out of the gable end').toEqual([]);
});
