// ENTER, SPACE AND THE RIGHT CLICK, THE AUTOCAD WAY (jb, 9 Nov: "yes lets
// do the enter space and right and left clicks how AUTOCAD did it"). The
// left button places points and picks; ENTER, SPACE and a right click that
// does not travel FINISH what is in hand, and at an empty prompt -- SELECT
// up, nothing in hand -- arm the last tool again. series-close, loop-close,
// dim-once and model-right-button drive the runs, loops and strings; this
// file drives the repeat and the five classic edits.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
const LINE = (id, a, b) => ({ id, start: V(...a), end: V(...b), levelId: 3, view: 'plan', layer: 'draft', bulge: 0 });
const FIXTURE = () => ({
  version: 1, board: 'drafting',
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0, nextDrawingItemId: 50,
  lines: [LINE('la', [-10, 0], [-2, 0]), LINE('lb', [2, -8], [2, -2])],
  // A wall and a shape out of the way, so the sheet frames a window the
  // presses below all land in (the 0 key frames the drawing's extent).
  walls: [{ id: 'wa', start: V(-10, 10), end: V(0, 10), levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center' }],
  shapes: [{ id: 'sa', levelId: 3, points: [V(4, 4), V(8, 4), V(8, 8), V(4, 8)], layer: 'SHAPE' }],
  outlines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  surfaceOpenings: [], stairs: [], notes: [], roomTags: [],
  columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
});

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, file }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(file)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, file: FIXTURE() });
  await page.goto('/MODEL.html?left=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect(page.locator('[data-tool-key="offset"]')).toBeVisible();
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
const click = async (page, at, x, z) => { await page.mouse.click(...at(x, z)); await page.waitForTimeout(120); };
const hover = async (page, at, x, z) => { await page.mouse.move(...at(x, z)); await page.waitForTimeout(120); };
const rightClick = async (page, at, x, z) => { await page.mouse.click(...at(x, z), { button: 'right' }); await page.waitForTimeout(120); };
const pick = async (page, at, x, z) => {
  if (await page.evaluate(() => activeTool) !== 'select') await page.keyboard.press('s');
  await click(page, at, x, z);
};
const seg = (page, id) => page.evaluate(id => {
  const l = drawing.lines.find(i => i.id === id);
  return l ? [l.start.x, l.start.z, l.end.x, l.end.z].map(v => Math.round(v * 1000) / 1000 + 0) : null;
}, id);
const lineCount = page => page.evaluate(() => drawing.lines.length);
const tool = page => page.evaluate(() => activeTool);
const strip = page => page.evaluate(() => stripNotice);

test('ENTER, SPACE or the right button at an empty prompt arms the last tool again', async ({ page }) => {
  const { at } = await open(page);
  // MIRROR puts itself down when it is done; ENTER brings it back.
  await pick(page, at, -6, 0);
  await page.keyboard.press('j');
  await click(page, at, 0, -6);
  await click(page, at, 0, 6);
  expect(await tool(page)).toBe('select');
  expect(await lineCount(page)).toBe(3);
  await page.keyboard.press('Enter');
  expect(await tool(page), 'ENTER repeated MIRROR').toBe('mirror');
  await page.keyboard.press('Escape');
  await page.keyboard.press('s');
  expect(await tool(page)).toBe('select');
  // The right button repeats it too, and with nothing picked MIRROR says so
  // instead of arming.
  await page.keyboard.press('Escape');
  await rightClick(page, at, 5, 5);
  expect(await tool(page)).toBe('select');
  expect(await strip(page)).toContain('MIRROR: pick what to mirror first');
  // SPACE repeats a tool that does not need a pick.
  await page.keyboard.press('l');
  expect(await tool(page)).toBe('line');
  await page.keyboard.press('l');
  expect(await tool(page)).toBe('select');
  await page.keyboard.press(' ');
  expect(await tool(page), 'SPACE repeated LINE').toBe('line');
});

test('ENTER takes the step at the cursor in OFFSET, ROTATE, FILLET and MIRROR, and the right button makes an ARRAY', async ({ page }) => {
  const { at } = await open(page);
  // OFFSET: the line, then ENTER with the cursor on the side it goes.
  await page.keyboard.press('i');
  await page.locator('#offset-dist').fill('2');
  await click(page, at, -6, 0);
  await hover(page, at, -6, 3);
  await page.keyboard.press('Enter');
  expect(await lineCount(page)).toBe(3);
  expect(await seg(page, 'line-50')).toEqual([-10, 2, -2, 2]);
  // FILLET: the first line, then SPACE on the second.
  await page.keyboard.press('Escape');
  await page.keyboard.press('v');
  await page.locator('#fillet-radius').fill('');
  await click(page, at, -6, 0);
  await hover(page, at, 2, -5);
  await page.keyboard.press(' ');
  expect(await seg(page, 'la')).toEqual([-10, 0, 2, 0]);
  expect(await seg(page, 'lb')).toEqual([2, -8, 2, 0]);
  // ROTATE: the base point, then a right click where the angle points.
  await pick(page, at, -6, 0);
  await page.keyboard.press('z');
  await click(page, at, 2, 0);
  await rightClick(page, at, 2, 6);
  expect(await seg(page, 'la')).toEqual([2, -12, 2, 0]);
  expect(await tool(page)).toBe('select');
  await page.keyboard.press('Control+z');
  // MIRROR: the first point, then ENTER on the second.
  await pick(page, at, -6, 0);
  await page.keyboard.press('j');
  await click(page, at, 0, -6);
  await hover(page, at, 0, 6);
  await page.keyboard.press('Enter');
  expect(await lineCount(page)).toBe(4);
  expect(await seg(page, 'line-51')).toEqual([10, 0, -2, 0]);
  // ARRAY: the boxes, then a right click on the sheet makes.
  await pick(page, at, 6, 0);
  await page.locator('[data-tool-key="array"]').click();
  await page.locator('#array-cols').fill('1');
  await page.locator('#array-rows').fill('2');
  await page.locator('#array-dz').fill('5');
  await rightClick(page, at, 6, 3);
  expect(await lineCount(page)).toBe(5);
  expect(await seg(page, 'line-52')).toEqual([10, 5, -2, 5]);
});

test('SPACE in a text box is a space, and ENTER on a tool key presses the key', async ({ page }) => {
  const { at } = await open(page);
  await page.keyboard.press('i');
  const box = page.locator('#offset-dist');
  await box.fill('4');
  await box.press(' ');
  await box.press('6');
  expect(await box.inputValue()).toBe('4 6');
  expect(await lineCount(page)).toBe(2);
  // A key with the focus takes ENTER itself: the LINE key (on the DRAW pane
  // that is showing; WALL's BUILD pane is folded away) arms LINE.
  await page.locator('[data-tool-key="line"]').focus();
  await page.keyboard.press('Enter');
  expect(await tool(page)).toBe('line');
  void at;
});
