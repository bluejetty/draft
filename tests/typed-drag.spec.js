// A DRAG UNDER SELECT, MADE EXACT BY A TYPED LENGTH.
//
// Movie, 20 Oct: "when i move the line it doesn't allow me to enter the LENGTH
// textbox to allow it to go a certain distance from initial point" -- "also
// when i grab an enpoint NODE, i'd like to move it over 1/16" by typing into
// the length box". The MOVE verb took a typed length after its drag (#814);
// a line or wall dragged by its body, an assembly, and an end node dragged
// under SELECT now do the same: drag it the way it goes, type the distance,
// ENTER, and it is exactly that far from where it started. One UNDO.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const P = (x, z) => ({ x, y: 0, z });
const drawing = () => ({
  version: 1, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 20,
  walls: [{ id: 'w1', start: P(-10, 0), end: P(0, 0), levelId: 3, view: 'plan',
    wallType: 'stud_2x4', refLine: 'center' }],
  lines: [{ id: 'l1', start: P(-10, 6), end: P(0, 6), levelId: 3, view: 'plan' }],
  floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], notes: [], stairs: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
async function drag(page, from, to) {
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, { steps: 4 });
  await page.mouse.move(...to, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(150);
}

test('a line dragged by its body, then a typed length: exactly that far, one UNDO', async ({ page }) => {
  const { at } = await open(page);
  // PICKED, THEN GRABBED: the page's own two-step.
  await page.mouse.click(...at(-5, 6));
  await page.waitForTimeout(120);
  await drag(page, at(-5, 6), at(-5, 8));
  const box = page.locator('#frozen-length');
  await expect(box, 'the box takes a number after the drag').toBeEnabled();
  await page.keyboard.type("4'6");
  await expect(box).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#strip-message')).toContainText('Moved');
  let d = await saved(page);
  const line = d.lines.find(l => l.id === 'l1');
  expect(line.start.z, "exactly 4'-6\" from where it started").toBeCloseTo(10.5, 6);
  expect(line.end.z).toBeCloseTo(10.5, 6);
  await page.keyboard.press('Control+z');
  d = await saved(page);
  expect(d.lines.find(l => l.id === 'l1').start.z, 'one UNDO').toBeCloseTo(6, 6);
});

test('an end NODE dragged a hair, then 1/16" typed: it sits a sixteenth from where it was', async ({ page }) => {
  const { at } = await open(page);
  await page.mouse.click(...at(-5, 0));
  await page.waitForTimeout(120);
  // The wall's west end, pulled a little further west.
  await drag(page, at(-10, 0), at(-10.6, 0));
  await expect(page.locator('#frozen-length')).toBeEnabled();
  await page.keyboard.type('1/16"');
  await page.keyboard.press('Enter');
  let d = await saved(page);
  const wall = d.walls.find(w => w.id === 'w1');
  expect(wall.start.x, 'a sixteenth of an inch west').toBeCloseTo(-10 - 1 / 192, 6);
  expect(wall.start.z, 'and not off its line').toBeCloseTo(0, 3);
  await page.keyboard.press('Control+z');
  d = await saved(page);
  expect(d.walls.find(w => w.id === 'w1').start.x, 'one UNDO').toBeCloseTo(-10, 6);
});

test('another tool put in hand ends it: the box is that tool\'s again', async ({ page }) => {
  const { at } = await open(page);
  await page.mouse.click(...at(-5, 6));
  await page.waitForTimeout(120);
  await drag(page, at(-5, 6), at(-5, 8));
  await expect(page.locator('#frozen-length')).toBeEnabled();
  await h.armFromRail(page, 'line');
  await page.mouse.move(...at(4, 10));
  await page.waitForTimeout(100);
  await expect(page.locator('#frozen-length'), 'nothing to type into until a run is in hand').toBeDisabled();
  await page.keyboard.type('3');
  await page.keyboard.press('Enter');
  const d = await saved(page);
  expect(d.lines.find(l => l.id === 'l1').start.z, 'the dragged line stayed where the drag left it')
    .toBeCloseTo((await saved(page)).lines.find(l => l.id === 'l1').end.z, 6);
  await expect(page.locator('#strip-message')).not.toContainText('Moved 3');
});
