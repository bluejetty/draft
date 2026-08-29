// Every edit bumps the view-rail epoch, and every thumbnail then re-runs the
// FULL section/elevation generator (MODEL.dc.html:5566-5572) — including the
// 241x41 roof silhouette sampling, whose cost does not shrink with the
// thumbnail. Measure the frame that lands right after an edit.
const { test } = require('@playwright/test');
const h = require('../tests/helpers.js');

test('P14: the frame cost of an edit, with and without elevation thumbnails', async ({ page }) => {
  test.setTimeout(240000);
  await h.openModel(page, { webgl: false });

  const worstFrameAfterEdit = async (label) => {
    await page.evaluate(() => {
      window.__frames = [];
      const tick = () => { const t = performance.now(); requestAnimationFrame(() => { window.__frames.push(performance.now() - t); tick(); }); };
      tick();
    });
    await h.selectTool(page, 'Line');
    await h.clickWorld(page, -30, -30);
    await h.clickWorld(page, -30, -26);
    await page.evaluate(() => { window.__frames.length = 0; });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1200);
    const f = await page.evaluate(() => {
      const a = window.__frames.slice().sort((x, y) => y - x);
      return { worst: +a[0].toFixed(1), second: +a[1].toFixed(1), n: a.length };
    });
    console.log(`${label}: worst frame ${f.worst} ms, next ${f.second} ms (over ${f.n} frames)`);
    return f.worst;
  };

  const bare = await worstFrameAfterEdit('empty drawing, no cuts ');

  // Now build a house: four auto elevations appear in the left rail.
  await h.selectTool(page, 'Outline');
  for (const [x, z] of [[-12, -9], [12, -9], [12, 9], [-12, 9]]) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.climbTourToMain(page);
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(600);
  await h.waitForSaved(page);
  const cards = await page.locator('.view-thumb').count();
  console.log('thumbnails in the rails:', cards);
  const built = await worstFrameAfterEdit('house + 4 elevations ');

  // Add three hand sections: three more full generator runs per edit.
  for (const z of [-3, 0, 3]) {
    await page.keyboard.press('c');
    await h.clickWorld(page, -16, z);
    await h.clickWorld(page, 16, z);
    await h.clickWorld(page, 0, -14);
    await page.waitForTimeout(400);
  }
  await h.waitForSaved(page);
  console.log('thumbnails in the rails:', await page.locator('.view-thumb').count());
  const more = await worstFrameAfterEdit('house + 4 elev + 3 sections');
  console.log(`edit-frame cost grew ${bare} -> ${built} -> ${more} ms`);
});
