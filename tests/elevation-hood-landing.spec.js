// THE UPPER LANDING'S WALLS DO NOT HANG A BOX OVER THE ROOM'S WINDOWS.
//
// Movie, 8 Oct, on E2 of his traced MOD BILEVEL with the garage on the
// corner (proto/repro-movie-corner-garage.draft): the walls round the upper
// landing stand set back from the room's front and poke up through the main
// roof; drawn above it, they made a box hanging under the room's eave, over
// its windows -- "we don't want the stuff covering the windows". The wall
// carrying the room's front on down to the ceiling, and the background wall
// under the eave, stay.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const CORNER = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'proto', 'repro-movie-corner-garage.draft'), 'utf8'));
const LANDING = ['wall-134', 'wall-135', 'wall-136', 'wall-137', 'wall-138'];

async function e2(page, drawing) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async f => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), 'model-drawing');
  }, drawing);
  await page.goto('/MODEL.html?view=cut:E2');
  await page.waitForTimeout(1200);
  return page.evaluate(() => {
    const c = document.getElementById('plan');
    return Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data);
  });
}

test('E2 draws the room the same with or without the landing\'s set-back walls', async ({ page }) => {
  const without = await e2(page, { ...CORNER, walls: CORNER.walls.filter(w => !LANDING.includes(w.id)) });
  const full = await e2(page, CORNER);
  let differ = 0;
  for (let i = 0; i < full.length; i += 4) {
    if (Math.abs(full[i] - without[i]) + Math.abs(full[i + 1] - without[i + 1])
      + Math.abs(full[i + 2] - without[i + 2]) > 60) differ += 1;
  }
  // Measured: 92 with the box gone (the landing's own walls where they really
  // show), 544 with it hanging over the windows.
  expect(differ, 'pixels the landing walls change on E2').toBeLessThan(250);
});
