// METRIC SIZES: THE TAGS AND THE BOXES FOLLOW THE SWITCH.
//
// Movie, 1 Oct: *"is it possible to adjust the window and door / fixture
// dimensions to metric / back to imperial?"*, *"when the METRIC button hit"*,
// *"make text smaller if necessary and yes rounding you decide"*, and for the
// garage *"put the mm number 4880 2440"*.
//
//   THE FORMAT          W 915 X 1065, D915, G 4880W x 2440H -- windows and
//                       doors to 5 mm, a garage door to 10
//   THE TAG ON THE PLAN reads millimetres the moment METRIC is pressed, and
//                       inches again on IMPERIAL
//   THE TAG AS A BOX    a typed 1220 X 1220 on a metric drawing is millimetres
//   THE SIZE BOXES      show 915, and a bare number typed into one is mm
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-movie-bands.draft'), 'utf8'));
const METRIC_TAG = /^W \d{3,4} X \d{3,4}$/;
const INCH_TAG = /^W \d{1,3} X \d{1,3}$/;

async function openTagged(page, units) {
  await h.suppressEntryCoach(page);
  await page.goto('/MODEL.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 15000 });
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: h.STORAGE_BUCKET, saved: { ...REPRO, units } });
  await page.goto('/MODEL.html');
  await page.evaluate(() => {
    window.__tags = [];
    const orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y) {
      const at = this.getTransform();
      window.__tags.push({ text: String(text), e: at.e, f: at.f,
        cv: (this.canvas && this.canvas.id) || '' });
      return orig.call(this, text, x, y);
    };
  });
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 15000 });
  await page.setViewportSize({ width: 1360, height: 764 });
}

const planTags = (page, re) => page.evaluate(src => {
  const dpr = window.devicePixelRatio || 1;
  const pattern = new RegExp(src);
  return (window.__tags || [])
    .filter(t => t.cv === 'plan' && pattern.test(t.text))
    .map(t => ({ text: t.text, x: t.e / dpr, y: t.f / dpr }));
}, re.source);

test('the formats: windows and doors to 5 mm, the garage to 10, the letters kept',
  async ({ page }) => {
    await h.suppressEntryCoach(page);
    await page.goto('/MODEL.html');
    await page.waitForFunction(() => !!window.DraftFenLabels);
    const out = await page.evaluate(() => {
      const FL = window.DraftFenLabels;
      const m = { units: 'metric' };
      return {
        window: FL.fenLabel({ type: 'window', widthFt: 3, heightFt: 3.5, ...m }),
        door: FL.fenLabel({ type: 'door', widthFt: 3, ...m }),
        garage: FL.fenLabel({ type: 'door', widthFt: 16, heightFt: 8, garage: true, ...m }),
        imperialWindow: FL.fenLabel({ type: 'window', widthFt: 3, heightFt: 3.5 }),
        imperialGarage: FL.fenLabel({ type: 'door', widthFt: 16, heightFt: 8, garage: true }),
        readBack: FL.parseWindowSize('915 X 1065', m),
        readInches: FL.parseWindowSize('36 X 42'),
      };
    });
    expect(out.window).toBe('W 915 X 1065');
    expect(out.door).toBe('D915');
    expect(out.garage, 'his own numbers').toBe('G 4880W x 2440H');
    expect(out.imperialWindow, 'imperial is untouched').toBe('W 36 X 42');
    expect(out.imperialGarage).toBe('G 16W x 8H');
    expect(out.readBack.widthFt * 304.8).toBeCloseTo(915, 6);
    expect(out.readBack.heightFt * 304.8).toBeCloseTo(1065, 6);
    expect(out.readInches.widthFt).toBeCloseTo(3, 9);
  });

test('METRIC turns the plan tags to millimetres, and IMPERIAL turns them back',
  async ({ page }) => {
    await openTagged(page, 'imperial');
    await page.waitForFunction(src => (window.__tags || [])
      .some(t => t.cv === 'plan' && new RegExp(src).test(t.text)), INCH_TAG.source);

    await page.evaluate(() => { window.__tags = []; });
    await page.locator('#units-corner button[data-units="metric"]').click();
    await page.waitForFunction(src => (window.__tags || [])
      .some(t => t.cv === 'plan' && new RegExp(src).test(t.text)), METRIC_TAG.source);
    const metric = await planTags(page, METRIC_TAG);
    expect(metric.every(t => t.text.match(/\d+/g).every(n => Number(n) % 5 === 0)),
      'every number on the nearest 5 mm').toBe(true);
    expect(await planTags(page, INCH_TAG), 'and no inch tag is left on the sheet')
      .toEqual([]);

    await page.evaluate(() => { window.__tags = []; });
    await page.locator('#units-corner button[data-units="imperial"]').click();
    await page.waitForFunction(src => (window.__tags || [])
      .some(t => t.cv === 'plan' && new RegExp(src).test(t.text)), INCH_TAG.source);
  });

test('on a metric drawing the tag box takes millimetres', async ({ page }) => {
  await openTagged(page, 'metric');
  await page.waitForFunction(src => (window.__tags || [])
    .some(t => t.cv === 'plan' && new RegExp(src).test(t.text)), METRIC_TAG.source);
  const tags = await planTags(page, METRIC_TAG);
  const tag = tags[tags.length - 1];
  const box = await page.locator('#plan').boundingBox();
  await page.mouse.click(box.x + tag.x, box.y + tag.y);
  const entry = page.locator('[data-window-size-entry]');
  await expect(entry).toBeVisible();
  await expect(entry, 'it opens on the size as painted').toHaveValue(tag.text);
  const id = await entry.getAttribute('data-window-size-entry');
  await entry.fill('1220 X 610');
  await entry.press('Enter');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);
  const win = saved.fenestrations.find(f => String(f.id) === String(id));
  expect(win.width * 304.8, '1220 mm wide, not 1220 inches').toBeCloseTo(1220, 3);
  expect((win.headHeight - win.sillHeight) * 304.8, '610 mm tall').toBeCloseTo(610, 3);
});

test('the window boxes show millimetres, and a bare number typed there is mm',
  async ({ page }) => {
    await openTagged(page, 'metric');
    await h.selectTool(page, 'window');
    const width = page.locator('[data-prop-field="width"]').first();
    await expect(width).toBeVisible();
    await expect(width, 'a number of millimetres, no feet or inches')
      .toHaveValue(/^\d{3,4}$/);
    const note = page.locator('[data-opening-note]');
    await expect(note).toContainText(' mm WIDE');

    await width.fill('1220');
    await width.press('Enter');
    await expect(note).toContainText('1220 mm WIDE');
    await expect(width).toHaveValue('1220');

    // AND AN IMPERIAL LENGTH STILL READS AS ONE: 3'-0" is 914.4, shown 915.
    await width.fill(`3'-0"`);
    await width.press('Enter');
    await expect(width).toHaveValue('915');

    // A BOX LEFT AS SHOWN IS NOT AN EDIT. 915 is 3'-0" to the nearest 5 mm;
    // committing it back would move the window by 0.6 mm on a blur.
    await width.focus();
    await width.press('Enter');
    await page.locator('[data-units="imperial"]').click();
    await expect(page.locator('[data-prop-field="width"]').first(),
      'still exactly 3\'-0", in inches again').toHaveValue(`3'-0"`);
  });
