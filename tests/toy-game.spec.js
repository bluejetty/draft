// game/ — TOY, the game (Movie, 27 Oct): step 1 of the split plan.
//
// "i was thinking of using this program to create a 2nd program with only
// TOY MODE, and make a very simplistic GAME version" -- "and then if they
// create a house in the TOY MODE 'game' they can bring it over to this
// program and do more detailed work if they want".
//
// The test of done is the bridge: a house drawn in the game, saved, opens in
// MODEL with its walls where the game drew them.
const { test, expect } = require('@playwright/test');
const fs = require('fs');

async function openGame(page) {
  await page.goto('/game/');
  await page.waitForFunction(() => document.body.dataset.toyReady === '1');
}
// A press at a world point (feet), through the page's own view.
async function pressAt(page, x, z) {
  const box = await page.locator('#plan').boundingBox();
  const s = await page.evaluate(([px, pz]) => window.DraftToyGame.toScreen({ x: px, z: pz }), [x, z]);
  await page.mouse.move(box.x + s.x, box.y + s.y);
  await page.mouse.click(box.x + s.x, box.y + s.y);
}
const ends = drawing => drawing.walls.map(w => [w.start.x, w.start.z, w.end.x, w.end.z]);

// A 10' x 8' box drawn with a sloppy hand: every press a few inches off.
async function sloppyBox(page) {
  await pressAt(page, 0.3, -0.2);
  await pressAt(page, 10.3, 0.4);
  await pressAt(page, 9.8, 8.4);
  await pressAt(page, -0.2, 7.7);
  await pressAt(page, 0.2, 0.3);
}

test('every wall lands square and a whole foot long, and pressing the start closes the run', async ({ page }) => {
  await openGame(page);
  await sloppyBox(page);
  const drawing = await page.evaluate(() => window.DraftToyGame.drawingOf());
  expect(ends(drawing)).toEqual([[0, 0, 10, 0], [10, 0, 10, 8], [10, 8, 0, 8], [0, 8, 0, 0]]);
  expect(await page.locator('#s-run')).toHaveText('—');
  // The run is closed: the next press starts a new one, it adds no wall.
  await pressAt(page, -8, 10);
  await expect(page.locator('#plan')).toHaveAttribute('data-walls', '4');
  // A run rounded below a foot is still a foot.
  await pressAt(page, -7.7, 10.1);
  const short = await page.evaluate(() => window.DraftToyGame.drawingOf());
  expect(ends(short).at(-1)).toEqual([-8, 10, -7, 10]);
});

test('UNDO takes back the last wall, and the house is still there after a reload', async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.toyReady === '1');
  await sloppyBox(page);
  await page.locator('#undo').click();
  await expect(page.locator('#plan')).toHaveAttribute('data-walls', '3');
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.toyReady === '1');
  await expect(page.locator('#plan')).toHaveAttribute('data-walls', '3');
});

test('SAVE writes a .draft that MODEL opens, with the walls where the game drew them', async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.toyReady === '1');
  await sloppyBox(page);
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#save').click()]);
  expect(download.suggestedFilename()).toMatch(/\.draft$/);
  const saved = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  expect(saved.board).toBe('toy');
  expect(saved.walls.every(w => w.levelId === 3 && w.view === 'plan' && w.wallType === 'stud_2x6')).toBe(true);

  // MODEL's own OPEN: the file goes through its file input, as a drafter's would.
  await page.goto('/MODEL.html?level=3');
  await expect(page.locator('#readout')).toContainText('scale', { timeout: 10000 });
  await page.locator('#file-input').setInputFiles({
    name: 'toy-house.draft', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved)),
  });
  await page.waitForFunction(() => drawing.walls.length === 4, null, { timeout: 10000 });
  const inModel = await page.evaluate(() => drawing.walls.map(w => [w.levelId, w.start.x, w.start.z, w.end.x, w.end.z]));
  expect(inModel).toEqual([[3, 0, 0, 10, 0], [3, 10, 0, 10, 8], [3, 10, 8, 0, 8], [3, 0, 8, 0, 0]]);
});

test('OPEN reads a saved house back in', async ({ page }) => {
  await openGame(page);
  const file = { version: 1, levels: [], walls: [
    { id: 'a', levelId: 3, view: 'plan', start: { x: 0, y: 0, z: 0 }, end: { x: 6, y: 0, z: 0 } },
    { id: 'b', levelId: 3, view: 'plan', start: { x: 6, y: 0, z: 0 }, end: { x: 6, y: 0, z: 4 } },
    { id: 'c', levelId: 5, view: 'plan', start: { x: 0, y: 0, z: 0 }, end: { x: 3, y: 0, z: 0 } },
  ] };
  await page.locator('#file').setInputFiles({
    name: 'house.draft', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)),
  });
  await expect(page.locator('#plan')).toHaveAttribute('data-walls', '2');
  await expect(page.locator('#say')).toHaveText('Opened 2 of 3 walls · TOY shows MAIN FL only');
});
