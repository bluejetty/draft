// A DORMER'S GABLE WALL on the elevations and on EXT. FINISH (Movie, 18 Oct).
//
// "i noticed the RAKE needs to show a line and 'gable wall in the triangle'
// where the user can change the materials in the EXT FINISH area" -- the two
// dormers on E2 marked in blue along their feet.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// A WIDER WINDOW THAN THE CONFIG'S 1280, since 23 Oct: EXT. FINISH fits the
// elevation with the painter's marks gutter and a tenth of the drawing of air
// each side (Movie: "about 10% extra cushion"), which puts this 76 ft view at
// 9 px to the foot in a 1280 window -- and 4" lap siding is under
// finish-patterns' three-pixel scale gate there, drawn as plain fill. The
// claims here are about the dormer's cladding, not about that gate, so the
// window is wide enough for the siding to draw at all.
test.use({ viewport: { width: 1600, height: 900 } });

const BUCKET = 'model-drawing';
const W = (id, a, b, extra = {}) => ({ id, levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 8, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] }, ...extra });
// A 60 x 30 house roofed at 8' and 3/12, a 20' dormer at 4/12 on the middle
// of its z = 30 wall, which is clad in lap siding.
const drawing = () => ({
  version: 1, planTurn: 0, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0, visible: true }, { id: 7, name: 'ROOF', elev: 18, visible: true },
    { id: 5, name: '2ND FL', elev: 9, visible: true }, { id: 3, name: 'MAIN FL', elev: 0, visible: true },
    { id: 1, name: 'FOUNDATION', elev: -10, visible: true }],
  activeLevelIdx: 3,
  walls: [W('a', [0, 0], [60, 0]), W('b', [60, 0], [60, 30]), W('c', [60, 30], [0, 30], { finish: 'siding_h' }),
    W('d', [0, 30], [0, 0]),
    ...[[[0, 0], [60, 0]], [[60, 0], [60, 30]], [[60, 30], [0, 30]], [[0, 30], [0, 0]]].map(([a, b], i) =>
      W(`f${i}`, a, b, { levelId: 1, view: 'foundation', wallType: 'concrete_8', topHeight: 8.125 }))],
  lines: [], floors: [], fenestrations: [], dimensions: [], outlines: [], shapes: [], surfaceOpenings: [],
  stairs: [], notes: [], roomTags: [], columns: [], beams: [], boneyardOutlines: [], groups: [],
  levelLocks: [], underlays: [],
  roofs: [{ id: 'roof-1', levelId: 7, follows: 'none', pitch: 3, overhang: 8,
    points: [[-8, -8], [68, -8], [68, 38], [-8, 38]].map(([x, z]) => ({ x, y: 0, z })),
    edges: ['eave', 'eave', 'eave', 'eave'], edgeOverhang: [8, 8, 8, 8],
    footprint: [[0, 0], [60, 0], [60, 30], [0, 30]].map(([x, z]) => ({ x, y: 0, z })),
    crossGables: [{ at: { x: 30, z: 30 }, widthFt: 20, pitch: 4 }] }],
});

async function openPage(page) {
  await h.suppressEntryCoach(page);
  await page.goto('/EXTFINISH.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: drawing() });
  await page.goto('/EXTFINISH.html');
  await expect(page.locator('#elev-list [data-elev]').first()).toBeVisible({ timeout: 10000 });
}
// The elevation that looks at the dormer, and the dormer as it is drawn there.
async function facingDormer(page) {
  for (const id of ['E1', 'E2', 'E3', 'E4']) {
    await page.locator(`[data-elev="${id}"]`).click();
    const found = await page.evaluate(() => {
      const f = window.__extFinishFrame;
      const list = window.__extFinishDormers ? window.__extFinishDormers() : [];
      return list.length ? { f, dg: list[0] } : null;
    });
    if (found) return { id, ...found };
  }
  return null;
}
// Canvas pixels to page coordinates.
const toPage = async (page, f, u, e) => {
  const box = await page.locator('#elev').boundingBox();
  const size = await page.evaluate(() => ({ w: document.getElementById('elev').width }));
  const k = box.width / size.w;
  return [box.x + (f.x0 + (u - f.uMin) * f.pxPerFt) * k, box.y + (f.y0 + (f.yTop - e) * f.pxPerFt) * k];
};
const stored = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await file.text()).roofs[0].crossGables[0];
}, BUCKET);

test('the dormer\'s gable stands on the elevation that looks at it, from the main roof up to its own ridge, and on no other', async ({ page }) => {
  await openPage(page);
  const seen = [];
  for (const id of ['E1', 'E2', 'E3', 'E4']) {
    await page.locator(`[data-elev="${id}"]`).click();
    seen.push(await page.evaluate(() => window.__extFinishDormers().length));
  }
  expect(seen.filter(n => n === 1), 'one elevation, one dormer').toHaveLength(1);
  expect(seen.filter(n => n === 0)).toHaveLength(3);
  const { dg, f } = await facingDormer(page);
  // AND IT IS THE ONE IN FRONT OF THE DORMER: its cut stands out past the
  // z = 30 wall the dormer is on, not behind the house looking at its back.
  expect(f.cut.startPt.z, 'the elevation faces the dormer\'s front').toBeGreaterThan(30);
  // 20' wide at 4/12: 3'-4" from its foot to its ridge.
  expect(dg.apex - dg.base).toBeCloseTo(20 / 2 * 4 / 12, 3);
  expect(dg.hi - dg.lo).toBeCloseTo(20, 3);
  // It wears the siding of the wall it stands over.
  expect(dg.finish).toBe('siding_h');
});

test('a click on the dormer\'s triangle picks its gable wall; a finish chosen is stored on the dormer and survives a reload', async ({ page }) => {
  await openPage(page);
  const { id, f, dg } = await facingDormer(page);
  await page.mouse.click(...await toPage(page, f, dg.mid, dg.base + 0.8));
  await expect(page.locator('#dormer-props')).toBeVisible();
  await expect(page.locator('#wall-props')).toBeHidden();
  await expect(page.locator('#dormer-finish')).toHaveValue('siding_h');
  await page.locator('#dormer-finish').selectOption('shake');
  await expect.poll(async () => (await stored(page)).finish).toBe('shake');
  await page.reload();
  await expect(page.locator('#elev-list [data-elev]').first()).toBeVisible({ timeout: 10000 });
  await page.locator(`[data-elev="${id}"]`).click();
  expect(await page.evaluate(() => window.__extFinishDormers()[0].finish)).toBe('shake');
  // Back to the wall's own finish, and the dormer carries no key of its own.
  await page.mouse.click(...await toPage(page, f, dg.mid, dg.base + 0.8));
  await page.locator('#dormer-finish').selectOption('siding_h');
  await expect.poll(async () => 'finish' in (await stored(page))).toBe(false);
});

test('the gable wall is clad, and a line runs along its foot where it stands on the roof', async ({ page }) => {
  await openPage(page);
  const { f, dg } = await facingDormer(page);
  const at = async (u, e) => page.evaluate(([x, y]) => {
    const c = document.getElementById('elev');
    return [...c.getContext('2d').getImageData(Math.round(x), Math.round(y), 1, 1).data].slice(0, 3);
  }, [f.x0 + (u - f.uMin) * f.pxPerFt, f.y0 + (f.yTop - e) * f.pxPerFt]);
  const lum = c => c[0] + c[1] + c[2];
  // ON THE FOOT, the ink; a foot and a half up, inside, not the ink.
  const foot = await at(dg.mid - 3, dg.base);
  const inside = await at(dg.mid - 3, dg.base + 1.5);
  expect(Math.abs(lum(foot) - lum(inside)), 'the line along the foot').toBeGreaterThan(90);
  // CLAD: the siding's courses cross a column inside the triangle.
  const column = [];
  for (let e = dg.base + 0.3; e < dg.base + 2.6; e += 0.05) column.push(lum(await at(dg.mid, e)));
  expect(Math.max(...column) - Math.min(...column), 'the siding is drawn on the gable wall').toBeGreaterThan(60);
  // THE RAKE BOARD: in stucco (no coursing to confuse it), a fascia's depth
  // under the rake at its peak is a line, and a foot below that is wall.
  await page.mouse.click(...await toPage(page, f, dg.mid, dg.base + 0.8));
  await page.locator('#dormer-finish').selectOption('stucco');
  await expect.poll(async () => (await stored(page)).finish).toBe('stucco');
  const fascia = 5.5 / 12;
  const board = await at(dg.mid, dg.apex - fascia);
  const wall = await at(dg.mid, dg.apex - fascia - 1);
  expect(Math.abs(lum(board) - lum(wall)), 'the rake board\'s lower edge').toBeGreaterThan(90);
});
