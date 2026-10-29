// RAISE HEEL, ONE EAVE AT A TIME (Movie, 28 Oct).
//
// "could we add an option to 'Raise' roof heel when i click a roof edge on
// the roof plan i can increase the 'wall' below where the eave is" -- just
// that edge, "it will cause the ridge of that roof to need to change location
// in most cases", typed in inches, and in the elevations a separate heel band
// between the plate and the raised soffit.
//
// The raised plane keeps the pitch, so it is the plane an eave line pushed
// out by h x 12 / pitch would raise: on a 4/12 hip 30' deep, 12" pushes the
// line out 3', and the ridge comes 1'-6" TOWARD the raised side and 6" up.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
// A 40 x 30 hip roof, eave ring only. Edge 0 runs (0,0) -> (40,0): the back.
const EAVE = [[0, 0], [40, 0], [40, 30], [0, 30]];
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
  roofs: [{ id: 'roof-1', levelId: 7, follows: 'none', pitch: 4, overhang: 0,
    points: EAVE.map(([x, z]) => ({ x, y: 0, z })), edges: EAVE.map(() => 'eave') }],
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
const click = async (page, at, x, z) => {
  await page.mouse.click(...at(x, z));
  await page.waitForTimeout(80);
};
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return (await h.savedDrawing(page)).roofs[0];
}
const heelBox = page => page.locator('[data-roof-field="raise heel, in"]');
// The level runs of the skeleton: the ridge.
const ridgeOf = (page, roof) => page.evaluate(r => window.DraftGeometry2D.roofSkeleton(r)
  .filter(s => Math.abs(s.a.z - s.b.z) < 1e-6 && Math.abs(s.a.x - s.b.x) > 1e-3)
  .map(s => ({ z: s.a.z, len: Math.abs(s.b.x - s.a.x) })), roof);

test('RAISE HEEL on the clicked eave lifts it; the ridge comes toward it; the file keeps it', async ({ page }) => {
  const { at } = await open(page);
  await click(page, at, 20, 15);
  await click(page, at, 20, 0.2);
  await expect(page.locator('[data-roof-edge-label]')).toHaveText('EDGE 1 OF 4');
  await expect(heelBox(page)).toHaveValue('0');
  // HEEL, THIS EDGE: the fascia, 5 1/2", with no overhang to climb.
  await expect(page.locator('[data-roof-edge-heel]')).toHaveText('HEEL, THIS EDGE 0\'-5 1/2"');
  const before = await ridgeOf(page, drawing().roofs[0]);
  expect(before).toHaveLength(1);
  expect(before[0].z).toBeCloseTo(15, 6);

  await heelBox(page).fill('12');
  await heelBox(page).press('Tab');
  await page.waitForTimeout(100);
  await expect(heelBox(page)).toHaveValue('12');
  await expect(page.locator('[data-roof-edge-heel]')).toHaveText('HEEL, THIS EDGE 1\'-5 1/2"');
  const roof = await saved(page);
  expect(roof.edgeHeelIn).toEqual([12, 0, 0, 0]);
  const after = await ridgeOf(page, roof);
  expect(after).toHaveLength(1);
  expect(after[0].z, 'the ridge comes 1\'-6" toward the raised eave').toBeCloseTo(13.5, 6);
  // The raised eave stands a foot up; the one across from it has not moved.
  const rise = await page.evaluate(r => ({
    raised: window.DraftGeometry2D.roofRiseAt(r, { x: 20, z: 0.01 }),
    across: window.DraftGeometry2D.roofRiseAt(r, { x: 20, z: 29.99 }),
    ridge: window.DraftGeometry2D.roofRiseAt(r, { x: 20, z: 13.5 }),
  }), roof);
  expect(rise.raised).toBeCloseTo(1, 2);
  expect(rise.across).toBeCloseTo(0, 2);
  expect(rise.ridge, 'and the ridge 6" higher').toBeCloseTo(5.5, 2);

  // OPENED AGAIN, the edge still says 12.
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  const again = (await h.planFrame(page)).at;
  await click(page, again, 20, 15);
  await click(page, again, 20, 0.2);
  await expect(heelBox(page)).toHaveValue('12');
  // Back to 0 takes the list off the roof altogether.
  await heelBox(page).fill('0');
  await heelBox(page).press('Tab');
  await page.waitForTimeout(100);
  expect((await saved(page)).edgeHeelIn).toBeUndefined();
});

test('a gable has no heel to raise', async ({ page }) => {
  const { at } = await open(page);
  await click(page, at, 20, 15);
  await click(page, at, 39.8, 15);
  await expect(page.locator('[data-roof-edge-label]')).toHaveText('EDGE 2 OF 4');
  await expect(heelBox(page)).toHaveCount(1);
  await page.locator('[data-prop-row="edge"] [data-prop-value="gable"]').click();
  await expect(heelBox(page)).toHaveCount(0);
});

// ── THE ELEVATIONS, OFFLINE, ON THE BUNGALOW ─────────────────────────────
//
// Its back eave (edge 0, the E3 side) raised 12": E3 shows the fascia a foot
// up and a heel band under it with the plate's line across; the sides keep
// their own fascia (a raised strip cut back along them once read as a seam
// and took it off); the front does not change.
const ENV = require('../proto/harness-env.js');
const BUNGALOW = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'proto', 'perf-bungalow.draft'), 'utf8'));
// Level ink in an elevation, by height AND pen: `17.25/1.25` is the wall's
// own outline at the plate, `17.25/2.25` a fascia board's heavy foot. The
// faint level rules (alpha ink) are left out.
const levelRuns = (strokes, minLen) => {
  const at = {};
  strokes.filter(st => !/rgba\(29,31,32,0\.25\)/.test(st.ink)).forEach(st => {
    for (let i = 1; i < st.pts.length; i++) {
      const a = st.pts[i - 1], b = st.pts[i];
      if (b.move || Math.abs(a.e - b.e) > 0.005) continue;
      const k = `${a.e.toFixed(2)}/${st.w}`;
      at[k] = (at[k] || 0) + Math.abs(a.u - b.u);
    }
  });
  return Object.fromEntries(Object.entries(at).filter(([, v]) => v > minLen));
};
const elevations = heel => {
  const s = JSON.parse(JSON.stringify(BUNGALOW));
  if (heel) s.roofs[0].edgeHeelIn = [heel, 0, 0, 0];
  const win = ENV.loadDraftModules();
  const env = ENV.buildEnv(win, s);
  return Object.fromEntries(ENV.standardElevationCuts(env)
    .map(cut => [cut.id, levelRuns(ENV.paintElevation(win, env, cut).strokes, 3)]));
};

test('the elevations: the raised fascia, the heel band and its plate line, the other eaves as they were', () => {
  const plain = elevations(0);
  const raised = elevations(12);
  // The bungalow's plate (the soffit) and eave top (the fascia's top).
  const PLATE = 17.25, TOP = 17.7;
  const at = (e, w) => `${e.toFixed(2)}/${w}`;
  // The fascia: a light top line, a heavy foot a board under it.
  expect(plain.E3[at(TOP, 1)], 'the back fascia, plain').toBeGreaterThan(35);
  expect(plain.E3[at(PLATE, 2.25)], 'and its foot').toBeGreaterThan(35);
  expect(raised.E3[at(TOP + 1, 1)], 'raised a foot').toBeGreaterThan(25);
  expect(raised.E3[at(PLATE + 1, 2.25)], 'its board\'s foot with it').toBeGreaterThan(25);
  expect(raised.E3[at(TOP, 1)] || 0, 'and none left at the old height').toBeLessThan(5);
  // THE HEEL BAND: the wall's outline climbs to the raised soffit, and the
  // plate's own line runs across under it.
  expect(raised.E3[at(PLATE + 1, 1.25)], 'the wall up to the raised soffit').toBeGreaterThan(25);
  expect(raised.E3[at(PLATE, 1)], 'the plate line across the band').toBeGreaterThan(25);
  for (const side of ['E2', 'E4']) {
    expect(raised[side][at(TOP, 1)], `${side} keeps its fascia`).toBeGreaterThan(40);
  }
  expect(raised.E1, 'the front is as it was').toEqual(plain.E1);
});
