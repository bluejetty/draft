// THE LENGTH BOX FOLLOWS THE UNITS SWITCH.
//
// Movie, 6 Nov: *"i switched to METRIC but the length box is still
// IMPERIAL"* -- the LENGTH box, the strip's readout beside it and the tag
// that rides the cursor all read 160'-1 7/8" on a drawing whose dimensions
// said metres.
//
//   WHAT THEY SHOW   metres, to the millimetre (3.600 m), the way the
//                    drawing's dimensions already print; feet-inches the
//                    moment IMPERIAL is pressed again
//   WHAT THEY TAKE   a bare number is METRES, because that is what the box
//                    shows; `mm` and `cm` say otherwise; 12-6 and its kin
//                    still read as feet and inches
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 },
  { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
const sheet = units => ({
  version: 1, board: 'drafting', units, levels: LEVELS, activeLevelIdx: 2, nextDrawingItemId: 50,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [], outlines: [], shapes: [],
  surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [], beams: [], fixtures: [],
  boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
});
async function open(page, units) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: sheet(units) });
  await page.goto('/MODEL.html?level=3&lpane=drafting&left=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
async function press(page, at, x, z) { await page.mouse.click(...at(x, z)); await page.waitForTimeout(80); }
async function hover(page, at, x, z) { await page.mouse.move(...at(x, z)); await page.waitForTimeout(120); }
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const lengthBox = page => page.locator('#frozen-length');
const units = (page, which) => page.locator(`#units-corner button[data-units="${which}"]`);
const r3 = n => Math.round(n * 1000) / 1000;

test('the box, the readout and the cursor tag read metres on a metric drawing', async ({ page }) => {
  const { at } = await open(page, 'metric');
  await h.armFromRail(page, 'line');
  await press(page, at, 2, 2);
  await hover(page, at, 12, 2);
  // 10 ft is 3.048 m, printed to the millimetre as the dimensions are.
  await expect(lengthBox(page)).toHaveValue('3.048 m');
  await expect(page.locator('#strip-len')).toHaveText('3.048 m');
  await expect(page.locator('#draw-len')).toHaveText('3.048 m');
  await page.keyboard.press('Escape');
});

test('pressing IMPERIAL or METRIC turns the box at once, before the hand moves', async ({ page }) => {
  const { at } = await open(page, 'imperial');
  await h.armFromRail(page, 'line');
  await press(page, at, 2, 2);
  await hover(page, at, 12, 2);
  await expect(lengthBox(page)).toHaveValue('10\'-0"');
  await units(page, 'metric').click();
  await expect(lengthBox(page), 'without a pointer move').toHaveValue('3.048 m');
  await expect(page.locator('#strip-len')).toHaveText('3.048 m');
  await units(page, 'imperial').click();
  await expect(lengthBox(page)).toHaveValue('10\'-0"');
  await page.keyboard.press('Escape');
});

for (const [typed, metres, said] of [
  ['3.6', 3.6, 'a bare number is metres, what the box shows'],
  ['3600 mm', 3.6, 'mm says millimetres'],
  ['360cm', 3.6, 'cm says centimetres'],
  ['12-6', 12.5 * 0.3048, 'feet and inches still read as feet and inches'],
]) {
  test(`typed into the box on a metric drawing: ${typed} -- ${said}`, async ({ page }) => {
    const { at } = await open(page, 'metric');
    await h.armFromRail(page, 'line');
    await press(page, at, 2, 2);
    await hover(page, at, 12, 2);
    await expect(lengthBox(page)).toBeEnabled();
    await lengthBox(page).fill(typed);
    await lengthBox(page).press('Enter');
    await page.keyboard.press('Escape');
    const d = await saved(page);
    expect(d.lines).toHaveLength(1);
    const line = d.lines[0];
    expect(r3(line.end.x - line.start.x), `${metres} m along +X, in the file's feet`)
      .toBe(r3(metres / 0.3048));
    expect(r3(line.end.z - line.start.z)).toBe(0);
  });
}

// A METRIC SUFFIX FORCES METRES ON AN IMPERIAL DRAWING (jb, 10 Nov: "21m"
// typed into the LENGTH box of an imperial drawing was refused, and so was
// "21.6M"; "a trailing m means metres, whatever the drawing's units are").
// Imperial typed into a metric drawing already read, so this is the mirror.
for (const [typed, metres, said] of [
  ['21m', 21, 'm says metres'],
  ['21.6M', 21.6, 'capital M and a decimal'],
  ['21.6 m', 21.6, 'a space before the suffix'],
  ['2160cm', 21.6, 'cm says centimetres'],
  ['21600 mm', 21.6, 'mm says millimetres'],
]) {
  test(`typed into the box on an IMPERIAL drawing: ${typed} -- ${said}`, async ({ page }) => {
    const { at } = await open(page, 'imperial');
    await h.armFromRail(page, 'line');
    await press(page, at, 2, 2);
    await hover(page, at, 12, 2);
    await expect(lengthBox(page)).toBeEnabled();
    await lengthBox(page).fill(typed);
    await lengthBox(page).press('Enter');
    await page.keyboard.press('Escape');
    const d = await saved(page);
    expect(d.lines).toHaveLength(1);
    const line = d.lines[0];
    expect(r3(line.end.x - line.start.x), `${metres} m along +X, in the file's feet`)
      .toBe(r3(metres / 0.3048));
    expect(r3(line.end.z - line.start.z)).toBe(0);
  });
}

test('on an imperial drawing a bare number is still feet, and the refusal names metres', async ({ page }) => {
  const { at } = await open(page, 'imperial');
  await h.armFromRail(page, 'line');
  await press(page, at, 2, 2);
  await hover(page, at, 12, 2);
  await lengthBox(page).fill('abc');
  await lengthBox(page).press('Enter');
  await expect(page.locator('#strip-message')).toContainText('6.5m for metres');
  await lengthBox(page).fill('21');
  await lengthBox(page).press('Enter');
  await page.keyboard.press('Escape');
  const d = await saved(page);
  expect(d.lines).toHaveLength(1);
  expect(r3(d.lines[0].end.x - d.lines[0].start.x)).toBe(21);
});

test('on a metric drawing, what cannot be read is refused and says so', async ({ page }) => {
  const { at } = await open(page, 'metric');
  await h.armFromRail(page, 'line');
  await press(page, at, 2, 2);
  await hover(page, at, 12, 2);
  await lengthBox(page).fill('abc');
  await lengthBox(page).press('Enter');
  await expect(page.locator('#strip-message')).toContainText('metres');
  await page.keyboard.press('Escape');
  expect((await saved(page)).lines).toHaveLength(0);
});
