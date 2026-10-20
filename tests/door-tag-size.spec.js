// A DOOR'S TAG IS A CONTROL TOO: click D36, type D60, the door is 5'-0".
//
// Movie, 20 Oct: "when they click on the D48 - if they change that to D60 the
// door width would also change to 5ft wide ... 2 ways to change the width,
// only change height in properties". And on a French pair that would not go
// to 5'-0" in a 5'-3" closet wall: "ok that's why" -- so a width the wall
// cannot carry says TOO BIG in the popup, glows, and names the widest it can.
//
// THE TAG IS FOUND BY ITS INK, as window-size-edit.spec.js finds the window's:
// the real fillText is watched and the press goes where the text was painted,
// so a hit list recorded in the wrong place cannot agree with itself.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const P = (x, z) => ({ x, y: 0, z });
const drawing = () => ({
  version: 1, board: 'drafting',
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0, nextDrawingItemId: 50,
  walls: [{ id: 'n', start: P(-10, 0), end: P(10, 0), levelId: 3, view: 'plan',
    wallType: 'stud_2x4', refLine: 'center', baseHeight: 0, topHeight: 8 }],
  fenestrations: [{ id: 'd', wallId: 'n', levelId: 3, view: 'plan', type: 'door',
    layer: 'A-DOOR', offset: 10, width: 3, sillHeight: 0, headHeight: 6.67,
    garage: false, doorType: 'interior', doorStyle: 'french', auto: false }],
  lines: [], fixtures: [], dimensions: [], floors: [], roofs: [], outlines: [], shapes: [],
  surfaceOpenings: [], notes: [], stairs: [], roomTags: [], columns: [], beams: [],
  boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
});
const DOOR_TAG = /^D\d+$/;

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto('/MODEL.html');
  await page.evaluate(() => {
    window.__tags = [];
    const orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y) {
      const at = this.getTransform();
      window.__tags.push({ text: String(text), e: at.e, f: at.f, cv: (this.canvas && this.canvas.id) || '' });
      return orig.call(this, text, x, y);
    };
  });
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForFunction(re => (window.__tags || []).some(t => t.cv === 'plan' && new RegExp(re).test(t.text)),
    DOOR_TAG.source, { timeout: 10000 });
}
const doorTag = page => page.evaluate(re => {
  const dpr = window.devicePixelRatio || 1;
  const tags = (window.__tags || []).filter(t => t.cv === 'plan' && new RegExp(re).test(t.text));
  const t = tags[tags.length - 1];
  return t && { text: t.text, x: t.e / dpr, y: t.f / dpr };
}, DOOR_TAG.source);
async function pressDoorTag(page) {
  const tag = await doorTag(page);
  expect(tag, 'a door tag painted on the sheet').toBeTruthy();
  const box = await page.locator('#plan').boundingBox();
  await page.mouse.click(box.x + tag.x, box.y + tag.y);
  return tag;
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}

test('click D36, type D60: the door is 5\'-0" wide, its height and centre kept', async ({ page }) => {
  await open(page);
  const tag = await pressDoorTag(page);
  expect(tag.text).toBe('D36');
  const entry = page.locator('[data-window-size-entry]');
  await expect(entry).toBeVisible();
  await expect(entry).toHaveValue('D36');
  await entry.fill('D60');
  await entry.press('Enter');
  const d = (await saved(page)).fenestrations[0];
  expect(d.width).toBe(5);
  expect(d.offset, 'about its centre').toBe(10);
  expect(d.headHeight, 'the height is PROPERTIES\' alone').toBe(6.67);
  expect(d.sillHeight).toBe(0);
  expect(d.doorStyle, 'still the French pair').toBe('french');
  // ONE CTRL+Z PUTS IT BACK.
  await page.keyboard.press('Control+z');
  expect((await saved(page)).fenestrations[0].width).toBe(3);
});

test('a door tag takes one number: a window\'s W X H is not a door size', async ({ page }) => {
  await open(page);
  await pressDoorTag(page);
  const entry = page.locator('[data-window-size-entry]');
  await entry.fill('60 X 80');
  await entry.press('Enter');
  await expect(page.locator('[data-strip-message]')).toContainText('D60');
  expect((await saved(page)).fenestrations[0].width).toBe(3);
});

test('too wide for the wall: TOO BIG in the popup, the widest it can take, and nothing changes', async ({ page }) => {
  await open(page);
  await pressDoorTag(page);
  const entry = page.locator('[data-window-size-entry]');
  await entry.fill('D300');
  await entry.press('Enter');
  await expect(page.locator('#brush-warn')).toBeVisible();
  await expect(page.locator('#brush-warn')).toContainText('TOO BIG');
  await expect(page.locator('#brush-warn')).toContainText(/The most it can take is \d+"/);
  expect((await saved(page)).fenestrations[0].width).toBe(3);
});

test('the PROPERTIES WIDTH says TOO BIG the same way, with the widest', async ({ page }) => {
  await open(page);
  await page.goto('/MODEL.html?left=1&lpane=build');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  // PICK THE DOOR, then type a width its wall cannot carry.
  const { at } = await h.planFrame(page);
  await page.mouse.click(...at(0, 0));
  const width = page.locator('#props-slot [data-prop-field="width"]');
  await expect(width).toBeVisible();
  await width.fill("25'");
  await width.press('Enter');
  await expect(page.locator('#brush-warn')).toBeVisible();
  await expect(page.locator('#brush-warn')).toContainText('The most it can take is');
  expect((await saved(page)).fenestrations[0].width).toBe(3);
});
