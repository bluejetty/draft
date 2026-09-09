// BOARD #352 — A DEALT WASHROOM MUST BE INSIDE THE HOUSE.
//
// Movie, 8 Sep, looking at an L-shaped two-storey: the dealt washroom was
// protruding through the exterior wall on the left side.
//
// THE CAUSE. _washroomInterior computes the correctly inset interior POLYGON
// and returns it as `points` -- then also returns a bounding box, and
// _washroomSeat uses only the box:
//
//     const x0 = side === 'right' ? interior.maxX - wFt : interior.minX;
//     const midZ = (interior.minZ + interior.maxZ) / 2 - dFt / 2;
//
// On a rectangle the box IS the interior, so it is right. On an L the box
// covers the notch -- ground outside the building -- and a seat against minX
// at mid-depth lands in the missing leg. The polygon that would have answered
// this was in the returned object the whole time, unused.
//
// This was not a documented limit. PR #348's note about not "following the
// outline" was about a unit not re-riding when a corner is dragged later. That
// one could be seated outside the building at all is a defect I missed, on a
// shape I never tested.
//
// Movie's ruling: containment is the ONE hard rule; location quality is a
// preference. So this file asserts containment and nothing about where in the
// room the unit sits.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// An L: full width along the bottom, and only the right half carries on up.
// The missing quarter is x < 0, z > 0 -- top-left, the side the unit seats
// against, which is what makes this the shape that catches the bug.
const L_SHAPE = [[-16, -14], [16, -14], [16, 14], [0, 14], [0, 0], [-16, 0]];
const RECT = [[-16, -14], [16, -14], [16, 14], [-16, 14]];

async function traceHouse(page, points) {
  await h.pickBuild(page, 'twoStorey');
  await page.keyboard.press('Enter');
  for (const [x, z] of points) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await expect(page.locator('[data-tour-popup]')).toBeVisible();
  await page.keyboard.press('Escape');
  await h.waitForSaved(page);
}

// Ray casting. The outline is a closed loop of plan points; a wall endpoint
// outside it is a wall outside the house.
function inside(poly, pt) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > pt.z) !== (b.z > pt.z)
      && pt.x < ((b.x - a.x) * (pt.z - a.z)) / (b.z - a.z) + a.x) hit = !hit;
  }
  return hit;
}

// A hair of tolerance: the unit is inset from the outline by a wall thickness,
// so a correctly seated washroom is comfortably inside and this never rescues
// a real protrusion -- the L notch is fourteen feet deep.
const TOL = 0.01;
function outsideBy(poly, pt) {
  if (inside(poly, pt)) return 0;
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    const dx = b.x - a.x, dz = b.z - a.z;
    const len2 = dx * dx + dz * dz;
    const t = len2 ? Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.z - a.z) * dz) / len2)) : 0;
    best = Math.min(best, Math.hypot(pt.x - (a.x + dx * t), pt.z - (a.z + dz * t)));
  }
  return best;
}

// Every corner of every washroom wall, per floor that got one.
function strayCorners(saved) {
  const stray = [];
  const groups = (saved.groups || []).filter(g => g.washroomLevelId != null);
  for (const group of groups) {
    const outline = (saved.outlines || [])
      .filter(o => o.levelId === group.washroomLevelId && !o.garage && o.points.length >= 3)
      .pop();
    if (!outline) continue;
    const poly = outline.points.map(p => ({ x: p.x, z: p.z }));
    const ids = new Set(group.members.filter(m => m.type === 'wall').map(m => m.id));
    for (const wall of (saved.walls || []).filter(w => ids.has(w.id))) {
      for (const pt of [wall.start, wall.end]) {
        const by = outsideBy(poly, { x: pt.x, z: pt.z });
        if (by > TOL) stray.push({ levelId: group.washroomLevelId, x: pt.x, z: pt.z, by: +by.toFixed(2) });
      }
    }
  }
  return stray;
}

async function buildAndRead(page, points) {
  await h.openModel(page, { autoStairs: true, tourEscort: true, roomGrow: true });
  await traceHouse(page, points);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);
  // THE COMPANION THAT MATTERS MOST. "Every washroom wall is inside" is
  // trivially true of a drawing with no washroom, which is exactly what a
  // future refusal-on-no-fit would produce.
  const dealt = (saved.groups || []).filter(g => g.washroomLevelId != null);
  expect(dealt.length, 'a washroom was dealt to have an opinion about').toBeGreaterThan(0);
  return saved;
}

test('a dealt washroom stays inside an L-shaped house', async ({ page }) => {
  const saved = await buildAndRead(page, L_SHAPE);
  const stray = strayCorners(saved);
  expect(stray, `washroom corners outside the outline: ${JSON.stringify(stray)}`).toEqual([]);
});

test('and on a plain rectangle, which it already did', async ({ page }) => {
  // THE CONTROL. Without it, the L test failing proves only "this assertion
  // can fail" -- not that the L is what breaks it. If this one ever goes red
  // the containment rule itself is wrong, not the shape handling.
  const saved = await buildAndRead(page, RECT);
  expect(strayCorners(saved), 'a rectangle was never the problem').toEqual([]);
});
