// SLIVERS TRIMMED OFF (Movie, 18 Oct: "if there is a peice of roof or wall or
// floor with less that 1/64" thickness can you autoamatically TRIM it off ...
// i think this might solve some of our roof problems" -- "ok lets go 1/16" on
// your advice").
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b, extra = {}) => ({ id, levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 8, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] }, ...extra });
// North Point's west gable, as his file had it: drawn a hair out of plumb, and
// an edge slid against it ran the ring down to z = -8 and back up to -2 -- a
// strip 1/60" wide and six feet long.
const ROOF = [[113.854, 83], [0.0013639, 83], [0.0011178, 68.0196], [-0.0001315, -8], [0.0012441, -8],
  [0.0012441, -2], [375.854, -2], [375.854, 83]];
const drawing = () => ({
  version: 1, planTurn: 0, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 },
    { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 2,
  walls: [W('a', [0, 0], [40, 0]), W('b', [40, 0], [40, 30]),
    // A wall a hundredth of an inch long, with a window on it.
    W('tiny', [40, 30], [40.0008, 30])],
  fenestrations: [{ id: 'win', wallId: 'tiny', levelId: 3, view: 'plan', type: 'window', offset: 0, width: 3,
    sillHeight: 3, headHeight: 6.67 }],
  lines: [], dimensions: [], outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
  // A floor whose corner was clicked twice, a thirtieth of an inch apart.
  floors: [{ id: 'fl', levelId: 3, points: [[0, 0], [40, 0], [40, 30], [40.0025, 30.001], [0, 30]]
    .map(([x, z]) => ({ x, y: 0, z })) }],
  roofs: [{ id: 'roof-1', levelId: 7, follows: 'none', pitch: 3, overhang: 2,
    points: ROOF.map(([x, z]) => ({ x, y: 0, z })), edges: ROOF.map(() => 'eave'),
    edgeOverhang: ROOF.map(() => 2) }],
});
async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto('/MODEL.html?level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
const shortest = ring => Math.min(...ring.map((p, i) => {
  const q = ring[(i + 1) % ring.length];
  return Math.hypot(q.x - p.x, q.z - p.z);
}));

test('on open and save: the roof\'s hair-thin strip, the floor\'s doubled corner and the wall under 1/16" are gone', async ({ page }) => {
  await open(page);
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const d = await h.savedDrawing(page);
  // THE ROOF: no edge under a sixteenth, the strip down to z = -8 gone.
  expect(shortest(d.roofs[0].points), 'no roof edge under 1/16"').toBeGreaterThanOrEqual(1 / 192);
  expect(Math.min(...d.roofs[0].points.map(p => p.z)), 'the six-foot strip is gone').toBeCloseTo(-2, 6);
  expect(d.roofs[0].edges).toHaveLength(d.roofs[0].points.length);
  expect(d.roofs[0].edgeOverhang).toHaveLength(d.roofs[0].points.length);
  // THE FLOOR: four corners.
  expect(d.floors[0].points).toHaveLength(4);
  // THE WALL: the sliver and the window on it gone, the real walls kept.
  expect(d.walls.map(w => w.id).sort()).toEqual(['a', 'b']);
  expect(d.fenestrations).toHaveLength(0);
});
