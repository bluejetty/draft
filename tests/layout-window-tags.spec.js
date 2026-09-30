// THE PRINTED PLAN SAYS WHAT SIZE EACH WINDOW IS.
//
// Movie, 30 Sep, on where the tags belong: *"the window tags are eg 36X36 and
// are on floor plans and elevations centered on the windows"*.
//
// THE ELEVATION BOXES ON A SHEET HAVE CARRIED THEM ALL ALONG -- cut-view.js
// tags a window wherever it draws one, and cut-view-env.js has given the
// Construction Layout the layer lookup since the tags got their own layer. The
// PLAN box beside them carried nothing. One sheet, the same windows, sizes on
// the elevations and none on the plan, so a builder reading it could only get
// a window size off an elevation.
//
// plan-composition.js has had a label stage since it was written and nothing
// ever passed `showFenLabels`, so it had never once run.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BUCKET = 'model-drawing';
const PW = 17;
const PH = 11;
const FIT_MARGIN = 60;

// The same house window-size-tags.spec.js measures on the Model Space, so the
// two readings are of one drawing and can be compared rather than merely both
// being green.
const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-movie-bands.draft'), 'utf8'));

async function openLayout(page, drawing) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('draft-test-storage-cleared')) return;
    sessionStorage.setItem('draft-test-storage-cleared', '1');
    indexedDB.deleteDatabase('pdf-img-mgr-shared');
    localStorage.clear();
  });
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.evaluate(async ({ bucket, saved }) => {
    const file = new File([JSON.stringify(saved)], 'model-drawing.json',
      { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(file, bucket);
  }, { bucket: BUCKET, saved: drawing });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
}

// EVERY PIECE OF TEXT THE SHEET IS ASKED TO PAINT. The tag is two numbers
// around an X and nothing else on a plan prints that shape, which is the same
// reading dim-layers-harness takes of an elevation.
async function tape(page) {
  await page.evaluate(() => {
    window.__tags = [];
    const orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y) {
      window.__tags.push(String(text));
      return orig.call(this, text, x, y);
    };
  });
}

const sizeTags = page => page.evaluate(() =>
  window.__tags.filter(t => /^\d+ X \d+$/.test(t)));

async function sheetMetrics(page) {
  const box = await page.locator('[data-layout-canvas]').boundingBox();
  const zoom = Math.min((box.width - FIT_MARGIN * 2) / PW,
    (box.height - FIT_MARGIN * 2) / PH);
  return { box, zoom, panX: (box.width - PW * zoom) / 2,
    panY: (box.height - PH * zoom) / 2 };
}

async function placeViewport(page, xIn, yIn) {
  const seq = await page.evaluate(() =>
    Number(document.body.dataset.layoutSaveSeq || 0));
  await page.locator('[data-layout-add-viewport]').click();
  await expect(page.locator('[data-layout-add-viewport]')).toContainText('CLICK THE SHEET');
  const m = await sheetMetrics(page);
  await page.mouse.click(m.box.x + m.panX + xIn * m.zoom,
    m.box.y + m.panY + yIn * m.zoom);
  await page.waitForFunction(
    prev => Number(document.body.dataset.layoutSaveSeq || 0) > prev, seq);
  await page.waitForTimeout(600);
}

test('a plan viewport tags every window with its size', async ({ page }) => {
  await openLayout(page, REPRO);
  await tape(page);
  await placeViewport(page, PW / 2, PH / 2);

  const tags = await sizeTags(page);
  expect(tags.length,
    'the printed plan carries no window size tags at all').toBeGreaterThan(0);
  // THE FIXTURE'S OWN ARITHMETIC, and the same number the Model Space reads
  // off it: 4 ft wide, a 2'-10" sill under a 7'-0" head, which is 48 by 50 in
  // inches. A tag that agreed on "some text appeared" and disagreed on the
  // SIZE would be the drift this whole job is about.
  expect(tags, 'the sheet and the Model Space disagree about a window size')
    .toContain('48 X 50');
});

test('and a door is not given one', async ({ page }) => {
  await openLayout(page, REPRO);
  await tape(page);
  await placeViewport(page, PW / 2, PH / 2);

  // THE OLD PLACEMENT TAGGED EVERY OPENING. fenLabelForOpening answers for a
  // door too -- it is the door LEAF size the office orders -- so a stage that
  // forgot to ask the type would print one beside every door on the sheet and
  // look plausible doing it.
  const doors = (REPRO.fenestrations || []).filter(f => f.type === 'door');
  expect(doors.length, 'no doors in the fixture, so this proves nothing')
    .toBeGreaterThan(0);
  const tags = await sizeTags(page);
  const windows = (REPRO.fenestrations || []).filter(f => f.type === 'window');
  expect(tags.length,
    `${tags.length} tags for ${windows.length} windows and ${doors.length} doors`)
    .toBeLessThanOrEqual(windows.length);
});
