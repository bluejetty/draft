// DIMENSION: ONCE ENDS, AND THE RIGHT BUTTON SAYS THE SAME (Movie, 23 Oct):
// "when a dimension line is initiated the user starts clicking the nodes
// with one click. to end a string and go to the Line placement part, press
// SPACE BAR once (or ENTER key) or the RIGHT mouse button. for ESC where the
// string is abandoned and deleted don't use RIGHT mouse button, only use esc
// key. use Right mouse button to END the Node selection and move to Line
// placement, and also left clicks to place the dimensions and right click /
// space / enter to end the line placement and finish the dimension string".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
const base = () => ({
  version: 1, board: 'drafting',
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }], activeLevelIdx: 0,
  walls: [
    ['n', V(-10, -10), V(10, -10)], ['e', V(10, -10), V(10, 10)],
    ['s', V(10, 10), V(-10, 10)], ['w', V(-10, 10), V(-10, -10)],
  ].map(([id, start, end]) => ({
    id, start, end, levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
  })),
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [], outlines: [], shapes: [],
  surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  boneyardShelves: [], groups: [], levelLocks: [], underlays: [], nextDrawingItemId: 20,
});
async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: base() });
  await page.goto('/MODEL.html?left=1&lpane=drafting');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
const strip = page => page.locator('#strip-message');
async function press(page, at, x, z, button = 'left') {
  await page.mouse.move(...at(x, z));
  await page.waitForTimeout(60);
  await page.mouse.click(...at(x, z), { button });
  await page.waitForTimeout(80);
}
async function armDimension(page) {
  await page.evaluate(() => document.activeElement?.blur?.());
  await h.armFromRail(page, 'dimension');
}
const saved = async page => {
  await page.locator('[data-model-save]').click();
  await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });
  return page.evaluate(async bucket => {
    const f = await window.SharedFileStore.loadSharedFile(bucket);
    return JSON.parse(await f.text());
  }, BUCKET);
};
const hand = d => (d.dimensions || []).filter(x => x.auto === false);
const r2 = n => Math.round(n * 100) / 100;

test('SPACE once ends the points; ENTER once finishes the lines, keeping every line laid', async ({ page }) => {
  const { at } = await open(page);
  await armDimension(page);
  await press(page, at, -10, -10);
  await press(page, at, 10, -10);
  await page.keyboard.press(' ');
  await expect(strip(page)).toContainText('click where the string goes');
  // THE ROWS INSIDE THE HOUSE: the fitted sheet has little air above the
  // north wall before the top bar.
  await press(page, at, 0, -8);
  await expect(strip(page)).toContainText('1 placed');
  await press(page, at, 0, -6);
  await page.keyboard.press('Enter');
  await expect(strip(page)).toContainText('done');
  const made = hand(await saved(page));
  expect(made, 'both lines kept: the key laid none to take back').toHaveLength(2);
  expect(new Set(made.map(x => r2(x.start.z))).size, 'on two rows').toBe(2);
});

// THE LAST END PLACES WHERE THE MOUSE IS (Movie, 25 Oct: "if they press
// anything else to end the dimension line placing sequence, the last line will
// be placed before the sequence finishes"): only Esc puts nothing down.
test('the RIGHT button ends the points, and the next one places a line where the mouse is and finishes', async ({ page }) => {
  const { at } = await open(page);
  await armDimension(page);
  await press(page, at, -10, -10);
  await press(page, at, 10, -10);
  await press(page, at, 5, -5, 'right');
  await expect(strip(page), 'the right button ends the points').toContainText('click where the string goes');
  await press(page, at, 0, -8);
  await press(page, at, 3, -4, 'right');
  await expect(strip(page), 'and finishes the lines').toContainText('done');
  const made = hand(await saved(page));
  expect(made, 'the clicked line and the one at the mouse').toHaveLength(2);
  made.forEach(x => expect([r2(x.start.x), r2(x.end.x)].sort((p, q) => p - q)).toEqual([-10, 10]));
  expect(new Set(made.map(x => r2(x.start.z))).size, 'on two rows').toBe(2);
});

test('ESC alone abandons the string: the points go, and the next press starts afresh', async ({ page }) => {
  const { at } = await open(page);
  await armDimension(page);
  await press(page, at, -10, -10);
  await press(page, at, 10, -10);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
  await press(page, at, -10, 10);
  await expect(strip(page), 'the first point of a new string').toContainText('the next point');
  await page.keyboard.press('Escape');
  expect(hand(await saved(page))).toHaveLength(0);
});

test('one point and ENTER: the strip asks for two at least, and the right button does not throw the point away', async ({ page }) => {
  const { at } = await open(page);
  await armDimension(page);
  await press(page, at, -10, -10);
  await page.keyboard.press('Enter');
  await expect(strip(page)).toContainText('two points at least');
  await press(page, at, 0, 0, 'right');
  await expect(strip(page)).toContainText('two points at least');
  await press(page, at, 10, -10);
  await expect(strip(page)).toContainText('2 points');
});

// A SECOND END BEFORE ANY LINE IS DOWN PLACES THE ONE LINE AT THE MOUSE AND
// IS DONE (Movie, 25 Oct: "if they use the SPACE ENTER or RIGHT CLICK the next
// one, the line will be placed in that location and that's it"). It used to
// wait for a click (23 Oct: "it just ESC's and nothing appears"); either way
// only Esc throws the string away.
for (const [name, end] of [
  ['SPACE', page => page.keyboard.press(' ')],
  ['ENTER', page => page.keyboard.press('Enter')],
  ['the right button', (page, at) => press(page, at, 0, -6, 'right')],
]) {
  test(`ending the points, then ${name} with the mouse on a row: one line there, and done`, async ({ page }) => {
    const { at } = await open(page);
    await armDimension(page);
    await press(page, at, -10, -10);
    await press(page, at, 10, -10);
    await page.keyboard.press(' ');
    await expect(strip(page)).toContainText('click where the string goes');
    await page.mouse.move(...at(0, -6));
    await page.waitForTimeout(80);
    await end(page, at);
    await expect(strip(page)).toContainText('done');
    const made = hand(await saved(page));
    expect(made).toHaveLength(1);
    expect(r2(made[0].start.z), 'on the row the mouse was on').toBeCloseTo(-6, 0);
  });
}
