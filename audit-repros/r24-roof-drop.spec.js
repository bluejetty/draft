// Reproduce the section's own roof pipeline for the cut that loses its roof.
const { test } = require('@playwright/test');
const h = require('../tests/helpers.js');

test('R24: the exact pipeline the section runs, for two neighbouring cuts', async ({ page }) => {
  test.setTimeout(200000);
  await h.openModel(page, { webgl: false });
  await h.selectTool(page, 'Outline');
  for (const [x, z] of [[-12, -9], [12, -9], [12, 9], [-12, 9]]) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.climbTourToMain(page);
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(500);
  await h.waitForSaved(page);

  for (const t of [13, 13.4]) {
    await page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: 'MAIN FL' }) })
      .locator('.level-name').click();
    await page.waitForTimeout(300);
    await page.keyboard.press('c');
    await h.clickWorld(page, -16, -t);
    await h.clickWorld(page, 16, t);
    await h.clickWorld(page, 0, -14);
    await page.waitForTimeout(500);
    await h.waitForSaved(page);
  }
  const saved = await h.savedDrawing(page);
  const out = await page.evaluate(({ cuts, roof }) => {
    const g = window.DraftGeometry2D;
    const faces = g.roofFaces(roof, g.roofSkeleton(roof));
    return cuts.map(cut => {
      const dir = cut.dirVec;
      const axis = { x: dir.z, z: -dir.x };            // exactly as MODEL builds it
      const uA = cut.startPt.x * axis.x + cut.startPt.z * axis.z;
      const uB = cut.endPt.x * axis.x + cut.endPt.z * axis.z;
      const profile = g.roofProfile(roof, faces, cut.startPt, cut.endPt, axis);
      const shifted = profile.map(p => ({ u: p.u, rise: 10 + p.rise }));
      const env = g.profileEnvelope([shifted]);
      // Why does an endpoint vanish? profileEnvelope rounds every event u to 5
      // decimals but valueAt only tolerates 1e-6 of slop.
      const detail = shifted.map(p => {
        const rounded = +p.u.toFixed(5);
        return { u: p.u, rounded, drift: Math.abs(rounded - p.u), outsideTolerance: Math.abs(rounded - p.u) > 1e-6 };
      });
      return {
        name: cut.name,
        dirVec: [Number(dir.x.toFixed(4)), Number(dir.z.toFixed(4))],
        axis: [Number(axis.x.toFixed(4)), Number(axis.z.toFixed(4))],
        uRange: [Number(Math.min(uA, uB).toFixed(2)), Number(Math.max(uA, uB).toFixed(2))],
        profilePoints: profile.length,
        profileU: profile.map(p => Number(p.u.toFixed(2))),
        envelope: env.length,
        envelopeLit: env.filter(p => p.rise != null).length,
        detail,
      };
    });
  }, { cuts: saved.cuts, roof: { ...saved.roofs[0], points: saved.roofs[0].points.map(p => ({ x: p.x, z: p.z })) } });
  out.forEach(r => console.log(JSON.stringify(r)));
});
