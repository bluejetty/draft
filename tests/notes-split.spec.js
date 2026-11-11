// NOTES BESIDE CALC / TURTLE (jb, 11 Nov 2026: "i'd like to copy info over
// and back from the calc and turtle sometimes ... when it's narrow, the
// turtle or calc on top and the notepad bottom half, and if the user widens
// the notepad put the notepad on the left side and right side for the calc
// or turtle"), and the TURTLE paste spot ("paste all the commands into one
// area for the turtle").
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const drawing = () => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

async function open(page, size = null) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f, size }) => {
    localStorage.removeItem('draft.turtle');
    if (size) localStorage.setItem('draft.notepad.size', JSON.stringify(size));
    else localStorage.removeItem('draft.notepad.size');
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing(), size });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  const tab = page.locator('#notes-tab');
  if (await tab.getAttribute('aria-expanded') !== 'true') await tab.click();
}
const panel = page => page.locator('#notes-panel');
const pad = page => page.locator('[data-notes-text]');
const label = page => page.locator('[data-notes-split-label]');
const dirAt = (page, i) => page.locator(`[data-turtle-row="${i}"] [data-turtle-dir]`);
const distAt = (page, i) => page.locator(`[data-turtle-row="${i}"] [data-turtle-dist]`);

test('NOTES alone: no split; CALC or TURTLE on a narrow pane stacks with the pad under', async ({ page }) => {
  await open(page);
  await expect(panel(page)).not.toHaveAttribute('data-split', /./);
  await expect(label(page)).toBeHidden();
  await page.locator('[data-pad-tab="calc"]').click();
  await expect(panel(page)).toHaveAttribute('data-split', 'stack');
  await expect(pad(page)).toBeVisible();
  await expect(page.locator('[data-calc]')).toBeVisible();
  await expect(label(page)).toHaveText(/NOTES · PAGE 1/);
  const calc = await page.locator('[data-calc]').boundingBox();
  const notes = await pad(page).boundingBox();
  expect(calc.y + calc.height).toBeLessThanOrEqual(notes.y + 1);   // calc above
  expect(Math.abs(calc.width - notes.width)).toBeLessThan(12);       // same column
  await page.locator('[data-pad-tab="turtle"]').click();
  await expect(panel(page)).toHaveAttribute('data-split', 'stack');
  await expect(page.locator('[data-turtle]')).toBeVisible();
  await expect(pad(page)).toBeVisible();
  await page.locator('[data-pad-tab="notes"]').click();
  await expect(panel(page)).not.toHaveAttribute('data-split', /./);
  await expect(label(page)).toBeHidden();
});

test('a pad pulled wide puts NOTES on the left and the TURTLE on the right', async ({ page }) => {
  await open(page, { w: 560 });
  await page.locator('[data-pad-tab="turtle"]').click();
  await expect(panel(page)).toHaveAttribute('data-split', 'side');
  const turtle = await page.locator('[data-turtle]').boundingBox();
  const notes = await pad(page).boundingBox();
  expect(notes.x + notes.width).toBeLessThanOrEqual(turtle.x + 1);  // notes left of turtle
  expect(turtle.y).toBeLessThanOrEqual(notes.y);                    // turtle from the top of the row
  await expect(label(page)).toHaveText(/NOTES · PAGE 1/);           // heads the pad's column
  // Narrowed again by the grip's store, the split stacks.
  await page.evaluate(() => { localStorage.setItem('draft.notepad.size', JSON.stringify({ w: 300 })); });
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  const tab = page.locator('#notes-tab');
  if (await tab.getAttribute('aria-expanded') !== 'true') await tab.click();
  await page.locator('[data-pad-tab="turtle"]').click();
  await expect(panel(page)).toHaveAttribute('data-split', 'stack');
});

test('a block of moves pasted into the TURTLE paste spot fills the table and the spot empties', async ({ page }) => {
  await open(page);
  await page.locator('[data-pad-tab="turtle"]').click();
  const spot = page.locator('[data-turtle-paste]');
  await spot.fill('w 86.86\nw 20\nn 106.38\ne 106.86\ns 106.38');
  await expect(spot).toHaveValue('');
  await expect(dirAt(page, 0)).toHaveValue('W');
  await expect(distAt(page, 0)).toHaveValue('86.86');
  await expect(dirAt(page, 4)).toHaveValue('S');
  await expect(distAt(page, 4)).toHaveValue('106.38');
  await expect(page.locator('[data-turtle-status]')).toContainText('CLOSED · 5 MOVES');
  // Nothing readable stays put and shows red.
  await spot.fill('hello there');
  await expect(spot).toHaveAttribute('data-bad', '');
  await expect(spot).toHaveValue('hello there');
  await expect(dirAt(page, 0)).toHaveValue('W');
});

test('a block pasted into a DIRECTION cell fills rows from there down', async ({ page }) => {
  await open(page);
  await page.locator('[data-pad-tab="turtle"]').click();
  await dirAt(page, 0).fill('W');
  await distAt(page, 0).fill('100');
  await dirAt(page, 1).focus();
  await page.evaluate(() => {
    const el = document.activeElement;
    const dt = new DataTransfer();
    dt.setData('text/plain', 'n 50\ne 100\ns 50');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await expect(dirAt(page, 1)).toHaveValue('N');
  await expect(distAt(page, 1)).toHaveValue('50');
  await expect(dirAt(page, 3)).toHaveValue('S');
  await expect(dirAt(page, 0)).toHaveValue('W');
  await expect(page.locator('[data-turtle-status]')).toContainText('CLOSED · 4 MOVES');
});
