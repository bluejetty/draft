// FINISH THICKNESS ON THE 2D DRAWINGS (jb, 27 Nov 2026), step 2 of 3.
//
// jb: brick "a few inches thicker than siding" should show "on the
// ELEVATION / Construction layouts". The thickness is the house's own per
// finish (wall-types.js finishById, step 1). What each drawing shows of it:
//
// - ELEVATION, head on: where a thicker finish meets a thinner one, a
//   firmer line and a shadow off it (light from the upper left), sized to the
//   difference -- and where two finishes are one thickness, nothing.
// - ELEVATION, at an outside corner: the side wall's cladding stands its
//   thickness out past the face's end.
// - SECTION: the cut wall's cladding is a layer its own thickness outside
//   the wall, masonry hatched.
// - PLAN: brick and stone (2" or more) cut at the plan height are a second
//   line outside the wall, hatched, broken at doors and windows.
//
// Each is checked the same way: the same drawing painted twice, once with
// the finish at its catalogue thickness and once with the house setting it
// flush, and the two must differ where -- and only where -- the step is.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HOUSE = JSON.parse(fs.readFileSync(path.join(ROOT, 'proto', 'repro-movie-2storey-garage.draft'), 'utf8'));

// The main floor's walls running north-south wear brick; the others siding,
// with a shake band (1") part way along and up, and a ledgestone wainscot.
const clad = () => {
  const d = JSON.parse(JSON.stringify(HOUSE));
  d.walls.forEach(w => {
    if ((w.view || 'plan') !== 'plan' || !(w.levelId > 1)) return;
    w.finish = 'siding_h';
    if (w.levelId !== 3) return;
    if (Math.abs(w.start.x - w.end.x) < 0.01) w.finish = 'brick';
    else w.finishBands = [{ finishId: 'shake', lowFt: 4, highFt: 6, startFt: 3, endFt: 3 }];
  });
  return d;
};

async function open(page) {
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => !!window.DraftCutView && !!window.DraftCutViewEnv && !!window.DraftRender2D);
}

// Paint a cut (elevation or section) and hand back its pixels' darkness.
const paintCut = (page, saved, cut, settings) => page.evaluate(({ saved, cut, settings }) => {
  const s = { ...saved, ...(settings ? { finishSettings: settings } : {}) };
  window.DraftWallTypes.adoptFinishSettings(s);
  const env = window.DraftCutViewEnv.buildCutViewEnv(s, window.DraftDrawingFormat.levels(s.levels));
  let c = cut;
  if (!cut.startPt) {
    // The four standard elevations, two feet off the house's bounds
    // (proto/harness-env.js standardElevationCuts).
    const walls = env.walls().filter(w => w.levelId > 0);
    const xs = walls.flatMap(w => [w.start.x, w.end.x]), zs = walls.flatMap(w => [w.start.z, w.end.z]);
    const minX = Math.min(...xs) - 2, maxX = Math.max(...xs) + 2, minZ = Math.min(...zs) - 2, maxZ = Math.max(...zs) + 2;
    c = {
      E1: { startPt: { x: minX, z: maxZ }, endPt: { x: maxX, z: maxZ }, dirVec: { x: 0, z: 1 } },
      E2: { startPt: { x: minX, z: minZ }, endPt: { x: minX, z: maxZ }, dirVec: { x: -1, z: 0 } },
      E3: { startPt: { x: minX, z: minZ }, endPt: { x: maxX, z: minZ }, dirVec: { x: 0, z: -1 } },
      E4: { startPt: { x: maxX, z: minZ }, endPt: { x: maxX, z: maxZ }, dirVec: { x: 1, z: 0 } },
    }[cut.id];
    c = { id: cut.id, name: cut.id, elev: 0, levelId: null, auto: true, ...c };
  }
  const cv = document.createElement('canvas'); cv.width = 1400; cv.height = 900;
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1400, 900);
  window.DraftCutView.drawCutView(env, ctx, 1400, 900, c, { pxPerFt: 30, finishes: true });
  window.DraftWallTypes.adoptFinishSettings({});
  const d = ctx.getImageData(0, 0, 1400, 900).data;
  const out = [];
  for (let i = 0; i < d.length; i += 4) out.push(d[i] + d[i + 1] + d[i + 2] < 600 ? 1 : 0);
  return out;
}, { saved, cut, settings });
const differ = (a, b) => a.reduce((n, v, i) => n + (v !== b[i] ? 1 : 0), 0);

test('a section cuts the brick as a layer outside the wall, and siding at its own half inch', async ({ page }) => {
  await open(page);
  // Across the west wall (x = -31, brick on the main floor), looking north.
  const cut = { id: 9, name: 'S9', startPt: { x: -36, z: 15 }, endPt: { x: -20, z: 15 }, dirVec: { x: 0, z: 1 }, levelId: 3 };
  const brick = await paintCut(page, clad(), cut, null);
  const flush = await paintCut(page, clad(), cut, { brick: { thicknessIn: 0 } });
  const same = await paintCut(page, clad(), cut, { brick: { thicknessIn: 4.625 } });
  expect(differ(brick, flush), 'the brick layer is drawn').toBeGreaterThan(400);
  expect(differ(brick, same), 'the catalogue number and the same number typed in are one drawing').toBe(0);
});

test('a plan draws brick outside the wall, broken at the windows, and no siding', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => {
    const R = window.DraftRender2D;
    const WT = window.DraftWallTypes;
    const S = 20;   // px per foot; the wall runs x 0..20 at z = 0
    const toS = p => ({ x: 40 + p.x * S, y: 100 + p.z * S });
    const wall = finish => ({ id: 'w', start: { x: 0, z: 0 }, end: { x: 20, z: 0 }, levelId: 3, view: 'plan',
      wallType: 'stud_2x6', topHeight: 8, refLine: 'left', finish });
    const win = [{ id: 'o', wallId: 'w', type: 'window', offset: 10, width: 4 }];
    const ink = finish => {
      WT.adoptFinishSettings({});
      const c = document.createElement('canvas'); c.width = 520; c.height = 200;
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 520, 200);
      R.drawFinishVeneer2D(ctx, toS, [wall(finish)], { colors: {} }, win);
      const d = ctx.getImageData(0, 0, 520, 200).data;
      // Dark pixels in a column x (ft) between z0 and z1 (ft).
      return (xFt, z0, z1) => {
        let n = 0;
        const px = Math.round(40 + xFt * S);
        for (let y = Math.round(100 + z0 * S); y <= Math.round(100 + z1 * S); y += 1) {
          for (let x = px - 2; x <= px + 2; x += 1) {
            const i = (y * 520 + x) * 4;
            if (d[i] + d[i + 1] + d[i + 2] < 600) n += 1;
          }
        }
        return n;
      };
    };
    const brick = ink('brick'), siding = ink('siding_h');
    // A 'left' line is the wall's outside face, its body to +z: the veneer
    // is on -z, 4 5/8" deep.
    return {
      brickOut: brick(4, -0.45, -0.05), brickIn: brick(4, 0.05, 0.4),
      brickAtWindow: brick(10, -0.45, -0.05), sidingOut: siding(4, -0.45, -0.05),
    };
  });
  expect(r.brickOut, 'the brick\'s outer line, outside the face').toBeGreaterThan(3);
  expect(r.brickIn, 'nothing on the wall\'s own side').toBe(0);
  expect(r.brickAtWindow, 'broken at the window').toBe(0);
  expect(r.sidingOut, 'half an inch of siding is not drawn on a plan').toBe(0);
});

test('an elevation shows the step where a thicker finish meets a thinner one, and none where they match', async ({ page }) => {
  await open(page);
  const views = {};
  for (const id of ['E1', 'E2', 'E3', 'E4']) {
    views[id] = {
      cat: await paintCut(page, clad(), { id }, null),
      thin: await paintCut(page, clad(), { id }, { shake: { thicknessIn: 0.5 }, brick: { thicknessIn: 0.5 } }),
    };
  }
  const total = Object.values(views).reduce((n, v) => n + (v.cat && v.thin ? differ(v.cat, v.thin) : 0), 0);
  expect(total, 'the shake band\'s edges and the brick\'s corner steps are drawn').toBeGreaterThan(200);
});
