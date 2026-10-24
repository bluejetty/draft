// CLICK AGAIN FOR WHAT IS UNDERNEATH (Movie, 24 Oct): "I'M HAVING A hard time
// selecting the WALL, - the ROOM AREA for the SUITE will be aligned in the
// same location as the wall line, if a user clicks and the wrong item (if
// they overlap) is selected the first time, allow the user to make a 2nd
// click and it will select the 'underneath' item, and if more than 2 a 3rd
// click will do it too etc... and then cycle back to the first one. the user
// will be able to see what is selected and choose the one he'd like".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const P = (x, z) => ({ x, y: 0, z });
// A wall along z=0 with an outline and a floor whose edges lie on it.
const RING = [P(0, 0), P(10, 0), P(10, 8), P(0, 8)];
const drawing = () => ({
  version: 1, board: 'drafting', levels: [{ id: 3, name: 'MAIN FL', elev: 0 }], activeLevelIdx: 0, nextDrawingItemId: 50,
  walls: [{ id: 'a', levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center', baseHeight: 0, topHeight: 9, start: P(0, 0), end: P(10, 0) }],
  outlines: [{ id: 'o', levelId: 3, garage: false, points: RING }],
  floors: [{ id: 'f', levelId: 3, view: 'plan', points: RING }],
  fenestrations: [], lines: [], fixtures: [], roofs: [], dimensions: [], shapes: [], groups: [],
  surfaceOpenings: [], stairs: [], notes: [], columns: [],
  // ...and a room tag whose area runs round the same ring: Movie's suite.
  roomTags: [{ id: 4, at: { x: 5, z: 4 }, levelId: 3, view: 'plan', name: '1 BEDROOM', size: '', areaSqFt: 0,
    stamped: true, layer: 'ROOM-IDS-AREA', points: RING.map(p => ({ ...p })) }],
  nextRoomTagId: 5, beams: [], boneyardOutlines: [], levelLocks: [], underlays: [],
});
async function open(page) {
  page.__errors = [];
  page.on('pageerror', err => page.__errors.push(String(err)));
  await h.openModel(page, { webgl: false });
  await page.evaluate(async f => window.SharedFileStore.saveSharedFile(
    new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), 'model-drawing'), drawing());
  await page.goto('/MODEL.html?level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(250);
  return h.planFrame(page);
}
test.afterEach(async ({ page }) => { expect(page.__errors || [], 'no page errors').toEqual([]); });
const said = page => page.locator('#strip-message').textContent();

test('clicks on one spot step down through what is there, then round to the top again', async ({ page }) => {
  const { at } = await open(page);
  await page.keyboard.press('s');
  const spot = at(5, 0);
  await page.mouse.click(...spot);
  const first = await said(page);
  const m = /^1 OF (\d+) HERE: (.+?) —/.exec(first);
  expect(m, `the strip counts what is here: ${first}`).toBeTruthy();
  const n = Number(m[1]);
  expect(n, 'the room tag, the wall and what else lies on its line').toBeGreaterThanOrEqual(3);
  // The room's area edge lies on the wall line and is asked first.
  expect(m[2], 'the room tag on top').toMatch(/^ROOM TAG/);
  const names = [m[2]];
  for (let i = 2; i <= n; i += 1) {
    await page.mouse.click(...spot);
    const line = await said(page);
    expect(line.startsWith(`${i} OF ${n} HERE: `), line).toBe(true);
    names.push(/HERE: (.+?) —/.exec(line)[1]);
  }
  expect(new Set(names).size, `each one once: ${names.join(', ')}`).toBe(n);
  // ...and round again to the top.
  await page.mouse.click(...spot);
  expect((await said(page)).startsWith(`1 OF ${n} HERE: ROOM TAG`)).toBe(true);
});

test('a click somewhere else starts from the top again', async ({ page }) => {
  const { at } = await open(page);
  await page.keyboard.press('s');
  await page.mouse.click(...at(5, 0));
  await page.mouse.click(...at(5, 0));
  expect(await said(page)).toMatch(/^2 OF/);
  await page.mouse.click(...at(3, 0));
  expect(await said(page)).toMatch(/^1 OF/);
});
