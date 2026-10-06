// LINES AND NOTES ON AN ELEVATION.
//
// Movie, 5 Oct: "i'd like to be able to also draw lines and add annotations
// to the elevations." LINE draws on the open elevation with the same two
// presses it uses on the plan; ANNOTATION is a tap for a plain note, or a
// press on the thing and a drag to where the words go for a note with an
// arrow. They are kept in the drawing as `elevationMarks`, in the view's own
// feet, so they come back after a reload and LAYOUT's sheets paint them too
// (proto/elevation-harness.js checks that half offline).
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
  // LINE and ANNOTATION are DRAFTING tools; the TOY board puts them away.
  await page.locator('[data-board-switch] [data-board="drafting"]').click();
}

// Ink darker than the paper under one screen point, in a 5px box.
const inkNear = (page, x, y) => page.evaluate(({ x, y }) => {
  const c = document.getElementById('plan');
  const r = c.getBoundingClientRect();
  const sx = c.width / r.width, sy = c.height / r.height;
  const { data } = c.getContext('2d').getImageData(
    Math.round((x - r.left) * sx) - 2, Math.round((y - r.top) * sy) - 2, 5, 5);
  let dark = 0;
  for (let i = 0; i < data.length; i += 4) if (data[i] < 120) dark += 1;
  return dark;
}, { x, y });

const marksOf = async page => (await h.savedDrawing(page))?.elevationMarks || [];

test('a line, a note and a note with an arrow, drawn on E2, saved and back after a reload', async ({ page }) => {
  await openE2(page);
  // An open bit of wall, so the line is the only ink there.
  expect(await inkNear(page, 560, 480)).toBe(0);

  await h.armFromRail(page, 'line');
  await page.mouse.click(450, 480);
  await page.mouse.click(700, 480);
  await expect.poll(() => inkNear(page, 560, 480)).toBeGreaterThan(0);

  await h.armFromRail(page, 'annotation');
  await page.mouse.click(480, 250);
  await expect(page.locator('[data-elev-note]')).toBeVisible();
  await page.keyboard.type('Vinyl siding');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-elev-note]')).toHaveCount(0);

  // Press on the thing, drag to where the words go.
  await page.mouse.move(700, 420);
  await page.mouse.down();
  await page.mouse.move(760, 320, { steps: 5 });
  await page.mouse.move(820, 220, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.type('Stick framed wall');
  await page.keyboard.press('Enter');

  await page.locator('#save').click();
  await h.waitForSaved(page);
  const marks = await marksOf(page);
  expect(marks.map(m => m.kind)).toEqual(['line', 'note', 'note']);
  expect(marks.every(m => m.cut === 'E2')).toBe(true);
  const [line, plain, arrow] = marks;
  // Level within a pixel's worth of feet, and a real length.
  expect(Math.abs(line.a.e - line.b.e)).toBeLessThan(0.2);
  expect(Math.abs(line.b.u - line.a.u)).toBeGreaterThan(5);
  expect(plain.text).toBe('VINYL SIDING');
  expect(plain.tip).toBeUndefined();
  expect(arrow.text).toBe('STICK FRAMED WALL');
  // The arrow points DOWN at the wall, from words that sit above it.
  expect(arrow.tip.e).toBeLessThan(arrow.at.e);

  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect.poll(() => inkNear(page, 560, 480)).toBeGreaterThan(0);
  expect((await marksOf(page)).length).toBe(3);
});

// THE POINTER (Movie, 6 Oct): "can i have an option for a POINTER ARROW? ...
// put in just a straight end on the line now (no arrow)". POINTER in the
// ANNOTATION panel: tap the thing, then where the text goes. The leader ends
// STRAIGHT -- on the pointer and on the press-and-drag leader alike.
test('POINTER: tap the thing, tap where the text goes, and the leader ends straight', async ({ page }) => {
  await openE2(page);
  await h.armFromRail(page, 'annotation');
  await page.locator('[data-note-pointer="on"]').click();
  await expect(page.locator('[data-note-pointer="on"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-note-end="line"]')).toHaveAttribute('aria-pressed', 'true');

  await page.mouse.click(700, 420);              // the thing
  await expect(page.locator('[data-elev-note]')).toHaveCount(0);
  await expect(page.locator('#strip-message')).toContainText(/now tap where the text goes/i);
  await page.mouse.click(820, 220);              // the words
  await expect(page.locator('[data-elev-note]')).toBeVisible();
  await page.keyboard.type('Fascia');
  await page.keyboard.press('Enter');

  // AND THE DRAG STILL WORKS, with the same straight end.
  await page.locator('[data-note-pointer="off"]').click();
  await page.mouse.move(500, 420);
  await page.mouse.down();
  await page.mouse.move(460, 320, { steps: 5 });
  await page.mouse.move(420, 220, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.type('Soffit');
  await page.keyboard.press('Enter');

  await page.locator('#save').click();
  await h.waitForSaved(page);
  const [pointed, dragged] = await marksOf(page);
  expect(pointed.text).toBe('FASCIA');
  expect(pointed.tip.e, 'the pointer goes at the thing, below the words').toBeLessThan(pointed.at.e);
  expect(pointed.end).toBe('line');
  expect(dragged.text).toBe('SOFFIT');
  expect(dragged.end).toBe('line');
});

test('a mark is picked with SELECT, deleted, and UNDO puts it back', async ({ page }) => {
  await openE2(page);
  await h.armFromRail(page, 'line');
  await page.mouse.click(450, 480);
  await page.mouse.click(700, 480);
  await page.keyboard.press('Escape');
  await expect.poll(() => inkNear(page, 560, 480)).toBeGreaterThan(0);

  await h.armFromRail(page, 'select');
  await page.mouse.click(560, 481);
  await page.keyboard.press('Delete');
  await expect.poll(() => inkNear(page, 560, 480)).toBe(0);

  await page.getByRole('button', { name: /^UNDO$/ }).click();
  await expect.poll(() => inkNear(page, 560, 480)).toBeGreaterThan(0);
  await page.locator('#save').click();
  await h.waitForSaved(page);
  expect((await marksOf(page)).map(m => m.kind)).toEqual(['line']);
});

test('a file with no marks saves back without the key', async ({ page }) => {
  await openE2(page);
  await page.locator('#save').click();
  await h.waitForSaved(page);
  expect('elevationMarks' in await h.savedDrawing(page)).toBe(false);
});
