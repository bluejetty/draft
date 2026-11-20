// THE LINE PANEL ON AN ELEVATION (jb, 19 Nov 2026: "can we show the LINE
// OBJ / PROP in the elevations too"). A line drawn on E2 and picked with
// SELECT shows the plan line's panel -- WEIGHT, STYLE, ARROWS, COLOUR -- in
// OBJ / PROP and the left PROPERTIES box; a chip changes the mark, one UNDO
// takes it back, and the fields save with the mark.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-modbilevel-roof-hood.draft'), 'utf8'));
const URL = '/MODEL.html?theme=rough&mode=day&pane=previews&right=1&level=7&lpane=drafting&left=1&view=cut%3AE2';

async function openE2(page) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, saved }) => {
    const f = new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(f, bucket);
  }, { bucket: h.STORAGE_BUCKET, saved: REPRO });
  await page.goto(URL);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

// The thickest run of ink across a short vertical probe through the line.
const inkRows = (page, x, y) => page.evaluate(({ x, y }) => {
  const c = document.getElementById('plan');
  const r = c.getBoundingClientRect();
  const sx = c.width / r.width, sy = c.height / r.height;
  const px = Math.round((x - r.left) * sx), py = Math.round((y - r.top) * sy);
  const { data } = c.getContext('2d').getImageData(px, py - 10, 1, 21);
  let rows = 0;
  for (let i = 0; i < data.length; i += 4) if (data[i] < 150 || data[i + 2] < 150) rows += 1;
  return rows;
}, { x, y });

const marksOf = async page => (await h.savedDrawing(page))?.elevationMarks || [];

test('a line picked on E2 shows LINE in OBJ / PROP; WEIGHT, STYLE and ARROWS write the mark and save', async ({ page }) => {
  await openE2(page);
  await h.armFromRail(page, 'line');
  await page.mouse.click(450, 480);
  await page.mouse.click(700, 480);
  await page.keyboard.press('Escape');

  const win = page.locator('#objprop');
  if (!(await win.isVisible())) await page.locator('#objprop-tab').click();
  await expect(win.locator('[data-objprop-title]')).toHaveText('PICK ANYTHING TO SEE ITS PROPERTIES');

  await h.armFromRail(page, 'select');
  await page.mouse.click(560, 481);
  await expect(win.locator('[data-objprop-title]')).toHaveText('LINE');
  await expect(win.locator('[data-line-weight]')).toHaveCount(6);
  await expect(win.locator('[data-line-style]')).toHaveCount(4);
  await expect(win.locator('[data-line-arrows]')).toHaveCount(4);
  await expect(win.locator('[data-line-color]')).toHaveCount(1);
  await expect(win.locator('[data-prop-span]')).toContainText('LENGTH');
  // The left PROPERTIES box shows the same panel.
  await expect(page.locator('#props-slot [data-line-weight="5"]')).toBeVisible();

  const thin = await inkRows(page, 560, 480);
  await win.locator('[data-line-weight="5"]').click();
  await win.locator('[data-line-style="dashed"]').click();
  await win.locator('[data-line-arrows="end"]').click();
  await expect(win.locator('[data-line-weight="5"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(win.locator('[data-line-style="dashed"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(win.locator('[data-line-arrows="end"]')).toHaveAttribute('aria-pressed', 'true');

  // Let go of it so the pick blue is off, and the line is BOLD on the view.
  await page.keyboard.press('Escape');
  await page.mouse.click(300, 700);
  await expect(win.locator('[data-objprop-title]')).toHaveText('PICK ANYTHING TO SEE ITS PROPERTIES');
  await expect.poll(() => inkRows(page, 470, 480)).toBeGreaterThan(thin);

  await page.locator('#save').click();
  await h.waitForSaved(page);
  const [line] = await marksOf(page);
  expect(line).toMatchObject({ kind: 'line', weight: 5, style: 'dashed', arrows: 'end' });

  // One UNDO takes the last chip back.
  await page.getByRole('button', { name: /^UNDO$/ }).click();
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const [after] = await marksOf(page);
  expect(after.arrows).toBeUndefined();
  expect(after.weight).toBe(5);
});
