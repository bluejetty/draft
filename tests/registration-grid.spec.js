// WHERE A COORDINATE IS MEASURED FROM, AND WHAT IT MAY LAND ON (board NEW-5).
//
// Part 1: a free node lands on the project's own increment — a sixteenth of an
// inch on an imperial project, a millimetre on a metric one. Before this, a
// node landed on a free real, so a wall could sit at 12.0001' while its
// dimension printed 12'-0"; the partials then failed to sum to the overall and
// the only way to make the numbers agree was to nudge the wall by a
// sixty-fourth that existed nowhere on screen. The discrepancy was in the
// rounding, not the drawing.
//
// The snap is at `_snap`, which is the FREE-point path only. A caught node, a
// midpoint or a point projected onto a locked ray returns earlier and comes
// back exactly as before — those are already on real geometry, and rounding
// them would break the alignment they exist to provide.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// A sixteenth of an inch, in feet. 12 in/ft x 16 = 192.
const SIXTEENTH_FT = 1 / 192;
const MM_FT = 0.001 / 0.3048;

const offGrid = (value, step) => {
  const n = value / step;
  return Math.abs(n - Math.round(n));
};
// Every coordinate a drawing stores for its own geometry.
const coords = drawing => [
  ...(drawing.lines || []).flatMap(l => [l.start, l.end]),
  ...(drawing.walls || []).flatMap(w => [w.start, w.end]),
  ...(drawing.boneyardOutlines || []).flatMap(o => o.points || []),
].flatMap(p => [p.x, p.z]);

test('a free node lands on a sixteenth, so the printed number and the drawing agree', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await h.selectTool(page, 'Line');
  // Deliberately awkward: nowhere near the origin, and not a round number, so
  // nothing else in the snap path can be credited with the result.
  await h.clickWorld(page, -7.3137, 4.8291);
  await h.clickWorld(page, 9.1719, -3.4157);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const stored = coords(await h.savedDrawing(page));
  expect(stored.length).toBeGreaterThan(0);
  const worst = Math.max(...stored.map(v => offGrid(v, SIXTEENTH_FT)));
  expect(worst).toBeLessThan(1e-6);
});
