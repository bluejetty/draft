// THE DRAFTING BRUSH, PICKED BY THE DOT: a press within a foot of an
// opening's centre dot lifts the opening, never the wall it sits in; the
// cursor is an eyedropper empty and a dripping brush loaded; and what cannot
// be made says TOO BIG in a popup and glows.
//
// Movie, 20 Oct: "i'm trying to GRAB properties from a int FRENCH door and
// trying to copy those to a 36 INT normal door, but not working" -- the strip
// said THE BRUSH IS HOLDING WALL PROPERTIES. "if the user is within 1ft of the
// DOT for fenstration radius 2ft dia can they pickup the DOOR properties (not
// other items lit wall etc)"; "can we have 2 different ICONS for cursor - one
// for when it empty and GRABBING a property - and a second one that looks
// like it DROPPING the properties"; "a popup warning good idea"; "make it
// glow to be obvious too them when it can't be made due to width etc".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const P = (x, z) => ({ x, y: 0, z });
const wall = (id, a, b) => ({ id, start: P(...a), end: P(...b), levelId: 3, view: 'plan',
  wallType: 'stud_2x4', refLine: 'center', baseHeight: 0, topHeight: 8 });
const door = (id, wallId, offset, width, doorStyle) => ({ id, wallId, levelId: 3, view: 'plan',
  type: 'door', layer: 'A-DOOR', offset, width, sillHeight: 0, headHeight: 6.67,
  garage: false, doorType: 'interior', doorStyle, hingeFlip: false, swingFlip: false, auto: false });
const drawing = () => ({
  version: 1, board: 'drafting',
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0, nextDrawingItemId: 50,
  // A 20 FT WALL WITH A 5'-0" FRENCH PAIR AND A 36" DOOR IN IT, and a 4 ft
  // wall off to the side whose 2'-0" window has no room for a French pair.
  walls: [wall('n', [-10, 0], [10, 0]), wall('s', [-10, 8], [-6, 8])],
  fenestrations: [door('fr', 'n', 5, 5, 'french'), door('d36', 'n', 15, 3, 'single'),
    { id: 'tiny', wallId: 's', levelId: 3, view: 'plan', type: 'window', layer: 'A-GLAZ',
      offset: 2, width: 2, sillHeight: 3, headHeight: 6.67, auto: false }],
  lines: [], fixtures: [], dimensions: [], floors: [], roofs: [], outlines: [], shapes: [],
  surfaceOpenings: [], notes: [], stairs: [], roomTags: [], columns: [], beams: [],
  boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
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
async function press(page, at, x, z) {
  await page.mouse.click(...at(x, z));
  await page.waitForTimeout(100);
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const cursor = page => page.locator('#plan').evaluate(el => el.style.cursor);
const strip = page => page.locator('#strip-message');

test('a press a foot off the French door\'s dot lifts the door, not the wall, and the 36" door takes it', async ({ page }) => {
  const { at } = await open(page);
  await page.locator('[data-mode-brush]').click();
  // OFF THE WALL, IN THE SWING: 0.8 ft from the dot at x = -5.
  await press(page, at, -5, 0.8);
  await expect(strip(page)).toContainText('Brush loaded');
  await expect(strip(page)).not.toContainText(/WALL/);
  // ONTO THE 36" DOOR, pressed off its dot on the other side.
  await press(page, at, 5, -0.7);
  const d = await saved(page);
  const d36 = d.fenestrations.find(f => f.id === 'd36');
  expect(d36.doorStyle, 'a French pair now').toBe('french');
  expect(d36.width, 'and as wide as the one it came off').toBe(5);
  expect(d.walls.find(w => w.id === 'n').wallType, 'the wall untouched').toBe('stud_2x4');
});

test('beyond a foot the dot does not answer, and the wall is still the wall', async ({ page }) => {
  const { at } = await open(page);
  await page.locator('[data-mode-brush]').click();
  // ON THE WALL LINE, 2 FT ALONG FROM THE 36" DOOR'S EDGE: the wall.
  await press(page, at, 8.5, 0);
  await expect(strip(page)).toContainText('Brush loaded');
  await expect(page.locator('[data-brush-load]')).not.toHaveText('');
  // IN THE SWING, 0.8 FT OFF THE DOT: a brush holding a wall does not ask
  // the dot, so this is nothing -- not the door.
  await press(page, at, 5, 0.8);
  await expect(strip(page), 'a wall load still means a wall').toContainText('Nothing there');
});

test('the cursor: an eyedropper while empty, a dripping brush once loaded', async ({ page }) => {
  const { at } = await open(page);
  await page.locator('[data-mode-brush]').click();
  const empty = await cursor(page);
  expect(empty, 'a picture, not a stock cursor').toMatch(/^url\(/);
  await press(page, at, -5, 0.5);
  const loaded = await cursor(page);
  expect(loaded).toMatch(/^url\(/);
  expect(loaded, 'a different picture').not.toBe(empty);
  // ESCAPE PUTS THE LOAD DOWN, and FENESTRATION stays armed with a crosshair.
  await page.keyboard.press('Escape');
  expect(await cursor(page)).not.toMatch(/^url\(/);
});

test('too wide: the popup says TOO BIG, the window glows, and nothing changes', async ({ page }) => {
  const { at } = await open(page);
  await page.locator('[data-mode-brush]').click();
  await press(page, at, -5, 0.5);
  const box = await page.locator('#plan').boundingBox();
  const [wx, wy] = at(-8, 8);
  const glowAt = () => page.evaluate(({ x, y }) => {
    const c = document.getElementById('plan');
    const r = c.getBoundingClientRect();
    const k = c.width / r.width;
    const px = c.getContext('2d').getImageData(Math.round((x - r.left) * k), Math.round((y - r.top - 0) * k), 1, 1).data;
    return [px[0], px[1], px[2]];
  }, { x: wx, y: wy - 4 });
  const before = await glowAt();
  await press(page, at, -8, 8.6);
  await expect(page.locator('#brush-warn')).toBeVisible();
  await expect(page.locator('#brush-warn')).toContainText('TOO BIG');
  await expect(strip(page)).toContainText('TOO BIG');
  expect(await glowAt(), 'the warning ink ringing the window').not.toEqual(before);
  await page.locator('[data-brush-warn-ok]').click();
  await expect(page.locator('#brush-warn')).toBeHidden();
  expect(box).toBeTruthy();
  const d = await saved(page);
  const tiny = d.fenestrations.find(f => f.id === 'tiny');
  expect(tiny.width, 'the window it would not fit stays').toBe(2);
  expect(tiny.type).toBe('window');
});

test('a bare wall too short for the load says TOO BIG too, and the next press puts it away', async ({ page }) => {
  const { at } = await open(page);
  await page.locator('[data-mode-brush]').click();
  await press(page, at, -5, 0.5);
  // A PRESS ON THE 4 FT WALL, CLEAR OF THE WINDOW'S DOT.
  await press(page, at, -9.6, 8);
  await expect(page.locator('#brush-warn')).toBeVisible();
  await expect(page.locator('#brush-warn')).toContainText('too short');
  await press(page, at, 0, 4);
  await expect(page.locator('#brush-warn')).toBeHidden();
});
