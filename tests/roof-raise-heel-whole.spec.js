// RAISE HEEL FOR THE WHOLE ROOF (jb, 28 Nov 2026).
//
// "in ROOF can i have a spot to adjust the ROOF HEEL for OBJ PROP" -- "i need
// a higher heel for this roof - more air flow coming in from under the 6"
// eaves". jb chose the AMOUNT ADDED: "leave the bottom of soffit / top of
// ceiling the default HEEL / 0", and "no you can go below 0" -- down only as
// far as keeps the standard 5 1/2" heel at the wall line, so 0 with no
// overhang. `roof.heelIn` moves the whole roof; the per-edge RAISE HEEL
// (roof-raise-heel.spec.js) still adds on top.
// On a joined roof it is a MAIN ROOF field with a THIS PIECE (SPECIAL CASE)
// override, like PITCH / FASCIA / OVERHANG.
//
// And in 3D the wall under a raised eave climbs to the fascia's foot (jb saw
// the open slot over the plate), as the elevations already stand it.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const ROOT = path.join(__dirname, '..');
// A 40 x 30 roof, eaves front and back, gables at the ends.
const RING = [[0, 0], [40, 0], [40, 30], [0, 30]];
const EDGES = ['eave', 'gable', 'eave', 'gable'];
const drawing = () => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 1,
  walls: [], lines: [], floors: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
  roofs: [{ id: 'roof-1', levelId: 7, follows: 'none', pitch: 6, overhang: 0,
    points: RING.map(([x, z]) => ({ x, y: 0, z })), edges: EDGES.slice() }],
});

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
  return h.planFrame(page);
}
const click = async (page, at, x, z) => {
  await page.mouse.click(...at(x, z));
  await page.waitForTimeout(80);
};
const savedRoofs = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return (await h.savedDrawing(page)).roofs;
};
const allBox = page => page.locator('[data-roof-field="raise heel, in"]');
const edgeBox = page => page.locator('[data-roof-field="raise heel, this edge, in"]');
// Enter, not Tab: Tab lands in OVERHANG, whose blur redraws the panel.
const setBox = async (box, text) => {
  await box.fill(text);
  await box.press('Enter');
  await box.page().waitForTimeout(100);
};

test('RAISE HEEL moves the whole roof by the amount added; 0 is as drawn, never under the 5 1/2" heel', async ({ page }) => {
  const { at } = await open(page, drawing());
  await click(page, at, 20, 15);
  await expect(allBox(page)).toHaveValue('0');
  // No overhang: the heel at the wall is the standard 5 1/2" already, so 0
  // is the bottom (jb: "at 0 overhang / 5.5" roof heel - 0 might be the bottom").
  await expect(page.locator('[data-roof-heel-range]')).toContainText('0" TO 48"');
  await setBox(allBox(page), '-2');
  await expect(allBox(page)).toHaveValue('0');
  let [roof] = await savedRoofs(page);
  expect('heelIn' in roof).toBe(false);

  await setBox(allBox(page), '6 1/2');
  [roof] = await savedRoofs(page);
  expect(roof.heelIn).toBe(6.5);
  expect('edgeHeelIn' in roof, 'the whole roof moves; no edge is singled out').toBe(false);

  // The per-edge RAISE HEEL still adds on top, on its own.
  await click(page, at, 20, 0.2);
  await setBox(edgeBox(page), '4');
  await click(page, at, 20, 15);
  await expect(allBox(page)).toHaveValue('6 1/2');
  [roof] = await savedRoofs(page);
  expect(roof.edgeHeelIn).toEqual([4, 0, 0, 0]);
  expect(roof.heelIn).toBe(6.5);

  // Back to 0: the roof as drawn (the edge's own raise stays).
  await setBox(allBox(page), '0');
  [roof] = await savedRoofs(page);
  expect('heelIn' in roof).toBe(false);
  expect(roof.edgeHeelIn).toEqual([4, 0, 0, 0]);
});

test('with an overhang the heel drops by up to the rise over it, no further', async ({ page }) => {
  const f = drawing();
  // 2'-0" eaves at 6/12: the heel at the wall is 5 1/2" + 12", so it can come down 12".
  f.roofs[0].overhang = 2;
  f.roofs[0].edgeOverhang = [2, 2, 2, 2];
  const { at } = await open(page, f);
  await click(page, at, 20, 15);
  await expect(page.locator('[data-roof-heel-range]')).toContainText('-12" TO 48"');
  await setBox(allBox(page), '-13');
  await expect(allBox(page)).toHaveValue('0');
  await setBox(allBox(page), '-12');
  await expect(allBox(page)).toHaveValue('-12');
  const [roof] = await savedRoofs(page);
  expect(roof.heelIn).toBe(-12);
  // The file keeps it inside the range whatever was typed into it.
  const kept = await page.evaluate(r => window.DraftDrawingFormat.roofs([{ ...r, heelIn: -40 }], new Set([7]))[0].heelIn, roof);
  expect(kept).toBe(-12);
});

test('a joined roof: RAISE HEEL in MAIN ROOF reaches every piece; THIS PIECE keeps its own', async ({ page }) => {
  const f = drawing();
  const SMALL = [[100, 0], [130, 0], [130, 30], [100, 30]];
  f.roofs.push({ id: 'roof-2', levelId: 7, follows: 'none', pitch: 6, overhang: 0,
    points: SMALL.map(([x, z]) => ({ x, y: 0, z })), edges: SMALL.map(() => 'eave') });
  f.groups = [{ id: 'group-9', name: 'MAIN ROOFS', fixed: false, stretchBehavior: 'item-geometry',
    members: [{ type: 'roof', id: 'roof-1' }, { type: 'roof', id: 'roof-2' }] }];
  const { at } = await open(page, f);
  await click(page, at, 20, 15);
  await expect(page.locator('[data-roof-section="main"]')).toContainText('MAIN ROOF');
  await expect(allBox(page)).toHaveValue('0');
  await setBox(allBox(page), '6');
  let roofs = await savedRoofs(page);
  expect(roofs.map(r => r.heelIn)).toEqual([6, 6]);

  // THIS PIECE: its own raise, the other piece stays on MAIN.
  const own = page.locator('[data-roof-own-field="heel"]');
  await expect(own).toHaveValue('');
  await own.fill('12');
  await own.press('Enter');
  await page.waitForTimeout(100);
  roofs = await savedRoofs(page);
  expect(roofs.map(r => r.heelIn)).toEqual([12, 6]);
  expect(roofs[0].own).toEqual(['heel']);
  await expect(page.locator('[data-prop-row="raise heel, in"] .props-title').first())
    .toHaveText('RAISE HEEL, IN (1 SPECIAL)');

  // A MAIN change now passes the special piece by.
  await setBox(allBox(page), '3');
  roofs = await savedRoofs(page);
  expect(roofs.map(r => r.heelIn)).toEqual([12, 3]);

  // The x puts it back on MAIN.
  await page.locator('[data-roof-own-clear="heel"]').click();
  roofs = await savedRoofs(page);
  expect(roofs.map(r => r.heelIn)).toEqual([3, 3]);
  expect('own' in roofs[0]).toBe(false);
});

// 3D: the wall along a raised eave stands up to the fascia's foot, so no
// slot opens over the plate; the wall under a gable does not move.
test('3D: a wall under a raised eave climbs by the lift, its finish with it', async ({ page }) => {
  await page.goto('/viewer/index.html?painter=plain');
  await page.waitForSelector('body[data-ready="1"]');
  const saved = JSON.parse(fs.readFileSync(path.join(ROOT, 'proto', 'repro-jb-timberhouse-notches.draft'), 'utf8'));
  const r = await page.evaluate(s => {
    const topOf = (faces, test) => Math.max(...faces.filter(test).flatMap(f => f.pts.map(q => q.y)));
    // The eave wall along z = 0 (wall-27) and the gable-end wall at x = -41.5.
    const eaveWall = f => (f.kind === 'wall' || f.kind === 'finish') && f.pts.every(q => Math.abs(q.z) < 0.1 && q.x < -2 && q.x > -41.6);
    const gableWall = f => (f.kind === 'wall' || f.kind === 'finish') && f.pts.every(q => Math.abs(q.x + 41.5) < 0.1 && q.z < -0.5 && q.z > -19);
    const fasciaFoot = faces => Math.min(...faces.filter(f => f.kind === 'fascia'
      && f.pts.every(q => Math.abs(q.z) < 0.2 && q.x < -2)).flatMap(f => f.pts.map(q => q.y)));
    const plain = DraftViewer.loadDrawing(JSON.parse(JSON.stringify(s)), 'plain');
    const before = { eave: topOf(plain.faces, eaveWall), gable: topOf(plain.faces, gableWall), foot: fasciaFoot(plain.faces) };
    const raised = JSON.parse(JSON.stringify(s));
    raised.roofs.forEach(roof => { roof.heelIn = 6.5; });
    const built = DraftViewer.loadDrawing(raised, 'raised');
    return { before, after: { eave: topOf(built.faces, eaveWall), gable: topOf(built.faces, gableWall), foot: fasciaFoot(built.faces) } };
  }, saved);
  expect(r.after.eave - r.before.eave, 'the eave wall up 6 1/2"').toBeCloseTo(6.5 / 12, 2);
  expect(r.after.gable, 'the gable-end wall stays on the plate').toBeCloseTo(r.before.gable, 3);
  expect(r.after.foot - r.after.eave, 'the fascia lands on the wall top, no slot').toBeLessThan(0.05);
  expect(r.after.foot - r.before.foot, 'and the fascia went up the 6 1/2"').toBeCloseTo(6.5 / 12, 2);
});

// ── THE ELEVATIONS, OFFLINE, ON THE BUNGALOW ─────────────────────────────
// Its plate (the soffit) at 17.25, its eave top (the fascia's top) 17.7.
// The whole roof raised a foot: every fascia a foot up, every eave wall on
// up to it with no line at the plate. Dropped: the fascia comes down past
// the plate and the wall stays where it was.
const ENV = require('../proto/harness-env.js');
const BUNGALOW = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'proto', 'perf-bungalow.draft'), 'utf8'));
const levelRuns = strokes => {
  const at = {};
  strokes.filter(st => !/rgba\(29,31,32,0\.25\)/.test(st.ink) && st.ink !== '#fff').forEach(st => {
    for (let i = 1; i < st.pts.length; i++) {
      const a = st.pts[i - 1], b = st.pts[i];
      if (b.move || Math.abs(a.e - b.e) > 0.005) continue;
      const k = `${a.e.toFixed(2)}/${st.w}`;
      at[k] = (at[k] || 0) + Math.abs(a.u - b.u);
    }
  });
  return Object.fromEntries(Object.entries(at).filter(([, v]) => v > 3));
};
const elevations = heelIn => {
  const s = JSON.parse(JSON.stringify(BUNGALOW));
  if (heelIn) s.roofs[0].heelIn = heelIn;
  const win = ENV.loadDraftModules();
  const env = ENV.buildEnv(win, s);
  return Object.fromEntries(ENV.standardElevationCuts(env)
    .map(cut => [cut.id, levelRuns(ENV.paintElevation(win, env, cut).strokes)]));
};

test('the elevations: the whole roof up a foot, every wall on up to its fascia', () => {
  const PLATE = 17.25, TOP = 17.7;
  const at = (e, w) => `${e.toFixed(2)}/${w}`;
  const plain = elevations(0);
  const raised = elevations(12);
  for (const side of ['E1', 'E2', 'E3', 'E4']) {
    expect(plain[side][at(TOP, 1)], `${side}: the fascia top, plain`).toBeGreaterThan(20);
    expect(raised[side][at(TOP + 1, 1)], `${side}: a foot up`).toBeGreaterThan(20);
    expect(raised[side][at(TOP, 1)] || 0, `${side}: none left at the old height`).toBeLessThan(5);
    expect(raised[side][at(PLATE + 1, 2.25)], `${side}: the board's foot with it`).toBeGreaterThan(20);
    expect(raised[side][at(PLATE, 1.25)] || 0, `${side}: the wall's old top gone`).toBeLessThan(5);
  }
});

test('the elevations: the whole roof dropped, the board hangs past the plate', () => {
  const s = JSON.parse(JSON.stringify(BUNGALOW));
  const win = ENV.loadDraftModules();
  const limit = win.DraftDrawingFormat.roofHeelDropLimitIn(s.roofs[0]);
  expect(limit, 'the bungalow has eaves to drop into').toBeGreaterThan(6);
  const PLATE = 17.25, TOP = 17.7;
  const at = (e, w) => `${e.toFixed(2)}/${w}`;
  const dropped = elevations(-6);
  expect(dropped.E3[at(TOP - 0.5, 1)], 'the fascia top 6" down').toBeGreaterThan(20);
  expect(dropped.E3[at(PLATE - 0.5, 2.25)], 'and its foot').toBeGreaterThan(20);
});
