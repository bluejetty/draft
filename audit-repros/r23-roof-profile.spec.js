// Why does the section lose its roof at one cut angle and not the next?
// Calls the shipped geometry directly.
const { test } = require('@playwright/test');
const h = require('../tests/helpers.js');

test('R23: roofProfile across the knife edge', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  // Build the real house so the real roof record is what we probe.
  await h.selectTool(page, 'Outline');
  for (const [x, z] of [[-12, -9], [12, -9], [12, 9], [-12, 9]]) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.climbTourToMain(page);
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(500);
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);
  const realRoof = (saved.roofs || [])[0];
  console.log('real roof: points', JSON.stringify(realRoof.points.map(p => [p.x, p.z])),
    '| edges', JSON.stringify(realRoof.edges), '| overhang', realRoof.overhang, '| pitch', realRoof.pitch);
  const out = await page.evaluate((realRoof) => {
    const g = window.DraftGeometry2D;
    // The roof BUILD HOUSE grows from a 24x18 outline with a 2' overhang.
    const roof = { ...realRoof, points: realRoof.points.map(p => ({ x: p.x, z: p.z })) };
    const faces = g.roofFaces(roof, g.roofSkeleton(roof));
    const run = t => {
      const a = { x: -16, z: -t }, b = { x: 16, z: t };
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const axis = { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
      const p = g.roofProfile(roof, faces, a, b, axis);
      return { t, points: p.length, first: p[0] || null, last: p[p.length - 1] || null };
    };
    return { faces: faces.length, runs: [12, 12.5, 12.9, 13, 13.1, 13.4, 14, 16].map(run) };
  }, realRoof);
  console.log('roof faces:', out.faces);
  out.runs.forEach(r => console.log(
    `  cut t=${r.t}: profile points ${r.points}` +
    (r.first ? ` (u ${r.first.u.toFixed(2)} rise ${r.first.rise.toFixed(2)} → u ${r.last.u.toFixed(2)} rise ${r.last.rise.toFixed(2)})` : '  <-- DROPPED, no roof drawn')));
});
