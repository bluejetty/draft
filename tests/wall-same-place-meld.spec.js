// ENDS IN THE SAME PLACE MELD (Movie, 28 Oct: "the ext / inside suite wall
// (hallway wall) where the door jogs in the wall doesn't connect properly on
// the inside and outside corners doesn't meld" -- "even if they aren't
// connected but in the same location, they should meld").
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test('two walls whose ends sit in one place but are two nodes mitre like one corner; the records stay two nodes', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  const out = await page.evaluate(() => {
    const G = window.DraftGeometry2D;
    const W = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] }, levelId: 3, wallType: 'stud_2x6' });
    // A hallway jog: three walls, ends coinciding as VALUES, not objects.
    const walls = [W('a', [0, 0], [10, 0]), W('b', [10, 0], [10, 2]), W('c', [10, 2], [20, 2])];
    const apart = G.wallJoins(G.meldPieces(walls));
    const shared = G.sharedEnds(walls);
    const joined = G.wallJoins(G.meldPieces(shared));
    return {
      apart: apart.size,
      kinds: [...joined.values()].map(j => j.type).sort(),
      untouched: walls[0].end !== walls[1].start,
      // A hair apart is still one place; a real gap is not.
      hair: G.sharedEnds([W('a', [0, 0], [10, 0]), W('b', [10.002, 0], [10, 2])]).filter((w, i, all) => all[0].end === all[1].start).length,
      gap: G.sharedEnds([W('a', [0, 0], [10, 0]), W('b', [10.2, 0], [10, 2])])[1].start.x,
    };
  });
  expect(out.apart, 'before: two boxes').toBe(0);
  expect(out.kinds, 'after: both corners mitre').toEqual(['miter', 'miter']);
  expect(out.untouched, 'the drawing\'s own walls keep their own nodes').toBe(true);
  expect(out.hair).toBe(2);
  expect(out.gap, 'a real gap stays a gap').toBe(10.2);
});
