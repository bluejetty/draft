// A WALL SEEN END ON SHOWS ITS END.
//
// jb, 15 Nov 2026: a 2 ft wall drawn by hand off the front of a 2ND FL, at
// the step where the front goes back a foot, sticking out past the face
// beside it. "the int. wall corner isn't showing on front elevation", and on
// EXT. FINISH the wall could be picked on the side elevation but not on the
// front. The painter draws a wall as the plane of its stored line, so a wall
// running straight at the viewer was dropped as a sliver, and the strip of
// its free end (a wall thickness wide, standing out in front) went with it.
//
// cut-view.js elevationFaces now hands the free near end of such a wall in
// as a face of its own, across the wall's two faces, under the wall's id.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');
const H = require('../proto/harness-env.js');

const BUCKET = 'model-drawing';
const W = (id, levelId, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId, view: 'plan', wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' });
// jb's house: 19'-6" deep, the front (z 0) stepped back a foot for its last
// 6'-6". The 2ND FL carries the hand wall: x 13, from the front out 2 ft.
const ring = lv => [
  W(`w${lv}a`, lv, [0, 0], [0, -41.5]), W(`w${lv}b`, lv, [0, -41.5], [19.5, -41.5]),
  W(`w${lv}c`, lv, [19.5, -41.5], [19.5, -1]), W(`w${lv}d`, lv, [19.5, -1], [13, -1]),
  W(`w${lv}e`, lv, [13, -1], [13, 0]), W(`w${lv}f`, lv, [13, 0], [0, 0])];
const house = (fin = true) => ({
  version: 1, board: 'drafting', planTurn: 0, buildType: 'twoStorey', autoRoof: false,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 }, { id: 5, name: '2ND FL', elev: 9 },
    { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -10 }],
  activeLevelIdx: 2, nextDrawingItemId: 50,
  walls: [...ring(3), ...ring(5), ...(fin ? [W('fin', 5, [13, 0], [13, 2])] : [])],
  lines: [], floors: [], fenestrations: [], dimensions: [], outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [], roofs: [],
});

// Ink plumb lines on E1 (the front, z 0 side) between u 12 and 13.
const plumbs = saved => {
  const win = H.loadDraftModules();
  const env = H.buildEnv(win, saved);
  const cut = H.standardElevationCuts(env).find(c => c.id === 'E1');
  const v = H.paintElevation(win, env, cut, {});
  const out = [];
  v.strokes.forEach(s => s.pts.forEach((p, i) => {
    if (!i || p.move || s.ink === '#fff') return;
    const q = s.pts[i - 1];
    if (Math.abs(q.u - p.u) < 0.01 && q.u > 12 && q.u < 12.99) out.push({ u: q.u, lo: Math.min(q.e, p.e), hi: Math.max(q.e, p.e) });
  }));
  return out;
};

test('E1: the hand wall standing out of the 2ND FL front draws its inside corner, a wall thickness off the step', () => {
  const lines = plumbs(house());
  // A 2x6 wall is 5 5/8" with its finishes: the wall's other face, which
  // meets the front at the inside corner.
  const corner = lines.find(l => Math.abs(l.u - (13 - 5.625 / 12)) < 0.02);
  expect(corner, JSON.stringify(lines)).toBeTruthy();
  // Up the 2ND FL only: the wall is not on MAIN FL.
  expect(corner.lo).toBeGreaterThan(8.5);
  expect(corner.hi).toBeGreaterThan(16);
  // And without the hand wall, nothing there.
  expect(plumbs(house(false))).toEqual([]);
});

test('EXT. FINISH E1: a click on the end of the hand wall picks it', async ({ page }) => {
  await h.suppressEntryCoach(page);
  await page.goto('/EXTFINISH.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 15000 });
  await page.evaluate(async ({ bucket, file }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(file)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, file: house() });
  await page.goto('/EXTFINISH.html');
  await page.waitForSelector('#elev-list [data-elev]', { timeout: 15000 });
  await page.locator('[data-elev="E1"]').click();
  await page.waitForTimeout(300);
  const click = async (u, e) => {
    const box = await page.locator('#elev').boundingBox();
    const [px, py] = await page.evaluate(([u, e]) => {
      const f = window.__extFinishFrame;
      const c = document.getElementById('elev');
      const r = c.getBoundingClientRect();
      return [(f.x0 + (u - f.uMin) * f.pxPerFt) * r.width / c.width,
        (f.y0 + (f.yTop - e) * f.pxPerFt) * r.height / c.height];
    }, [u, e]);
    await page.mouse.click(box.x + px, box.y + py);
    await page.waitForTimeout(200);
    return page.locator('#status').textContent();
  };
  // The end strip, mid 2ND FL: picked, half a foot wide.
  expect(await click(12.77, 13)).toMatch(/0\.5 ft on E1/);
  // Beside it, the 2ND FL front behind it is still its own pick.
  expect(await click(6, 13)).toMatch(/13\.0 ft on E1/);
});
