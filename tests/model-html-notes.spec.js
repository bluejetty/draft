// THE NOTES PAD (Movie, 16-17 Oct).
//
// "a 'notepad' that can open up as a tab under the LEVELS/LAYERS tab ... that
// blue sticky pad look and put the text dark grey or black that says NOTES
// ... when it opens up make it a notepad area about the same width that the
// LEVELS / LAYER s opens up to ... type or paste text and numbers ... a page
// that can scroll down ... but only about 5 pages in length total" -- "and
// then they can open and close that like the levels tab" -- "save with the
// draft, and also when a user starts a new plan, keep the notes still there
// ... add a CLEAR button ... keep those notes always in there as long as
// possible unless the user presses CLEAR".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const drawing = (extra = {}) => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
  ...extra,
});

async function open(page, f = drawing()) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
const tab = page => page.locator('#notes-tab');
const pad = page => page.locator('[data-notes-text]');
async function openPad(page) {
  if (await tab(page).getAttribute('aria-expanded') !== 'true') await tab(page).click();
  await expect(pad(page)).toBeVisible();
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}

test('NOTES hangs under LEVELS / LAYERS on the right edge: a blue sticky pad, dark lettering', async ({ page }) => {
  await open(page);
  await expect(tab(page)).toBeVisible();
  // NOTES / CALC (Movie, 20 Oct: "make the title for the tab NOTES / CALC").
  await expect(tab(page)).toHaveText('NOTES / CALC');
  const [levels, notes] = await Promise.all([
    page.locator('#right-tab').boundingBox(), tab(page).boundingBox()]);
  expect(notes.y, 'below LEVELS / LAYERS, not over it').toBeGreaterThanOrEqual(levels.y + levels.height);
  expect(Math.round(notes.x + notes.width), 'on the right edge').toBe(Math.round(levels.x + levels.width));
  const look = await tab(page).evaluate(el => {
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundImage, color: cs.color };
  });
  // ROUGH is the blue pad; the lettering is dark grey.
  await page.evaluate(() => window.DraftPalette?.apply?.(document, 'rough', 'day'));
  const rough = await tab(page).evaluate(el => getComputedStyle(el).backgroundImage);
  expect(rough).toContain('rgb(214, 233, 248)');
  const ink = look.color.match(/\d+/g).slice(0, 3).map(Number);
  expect(Math.max(...ink), `NOTES is dark grey or black, not ${look.color}`).toBeLessThan(80);
});

test('it opens and shuts like the LEVELS tab, and swaps with it on the same rail', async ({ page }) => {
  await open(page);
  // LEVELS / LAYERS opens by default; NOTES swaps the pane without shutting.
  await expect(page.locator('#levels-panel')).toBeVisible();
  const levelsW = (await page.locator('#right-rail').boundingBox()).width;
  await tab(page).click();
  await expect(pad(page)).toBeVisible();
  await expect(page.locator('#levels-panel')).toBeHidden();
  await expect(tab(page)).toHaveAttribute('aria-selected', 'true');
  expect((await page.locator('#right-rail').boundingBox()).width, 'the width LEVELS opens to')
    .toBe(levelsW);
  // Pressed again, the pad shuts.
  await tab(page).click();
  await expect(pad(page)).toBeHidden();
  await expect(page.locator('#right-rail')).toHaveAttribute('data-collapsed', '');
  // Opened, then LEVELS swaps back.
  await tab(page).click();
  await page.locator('#right-tab').click();
  await expect(page.locator('#levels-panel')).toBeVisible();
  await expect(pad(page)).toBeHidden();
});

test('typing goes on the pad, not to the tools, and the notes save in the .draft', async ({ page }) => {
  await open(page);
  await openPad(page);
  await pad(page).click();
  await page.keyboard.type('wdl 366-11 x 69\n');
  await expect(pad(page)).toHaveValue('wdl 366-11 x 69\n');
  // W, D and L arm nothing while the drafter is writing: every key
  // handler on the page already steps aside for a text field.
  for (const key of ['wall', 'dimension']) {
    await expect(page.locator(`[data-tool-key="${key}"]`)).not.toHaveAttribute('aria-pressed', 'true');
  }
  await expect(page.locator('#save')).toHaveText('UNSAVED');
  expect((await saved(page)).notepad).toBe('wdl 366-11 x 69\n');
});

test('an empty pad leaves the file key for key', async ({ page }) => {
  await open(page);
  await page.evaluate(() => document.dispatchEvent(new Event('noop')));
  expect('notepad' in await saved(page)).toBe(false);
});

test('a reload keeps them, NEW keeps them, and a drawing with its own notes shows those', async ({ page }) => {
  await open(page);
  await openPad(page);
  await pad(page).fill('');
  await pad(page).type('GRID 1 TO 29');
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await openPad(page);
  await expect(pad(page), 'kept through a reload').toHaveValue('GRID 1 TO 29');
  // NEW: a blank plan, the same notes, and the blank saves them.
  await page.locator('[data-file-new]').click();
  const discard = page.locator('[data-guard-discard]');
  if (await discard.isVisible().catch(() => false)) await discard.click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
  await page.keyboard.press('Escape');
  await openPad(page);
  await expect(pad(page), 'still on the pad after NEW').toHaveValue('GRID 1 TO 29');
  expect((await h.savedDrawing(page)).notepad, 'and the new plan carries them').toBe('GRID 1 TO 29');
  // A drawing with notes of its own: the pad shows those.
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing({ notepad: 'NORTH POINT: 69 WIDE' }) });
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await openPad(page);
  await expect(pad(page)).toHaveValue('NORTH POINT: 69 WIDE');
});

test('CLEAR asks first; NO keeps them, YES wipes the pad and the file', async ({ page }) => {
  await open(page, drawing({ notepad: 'KEEP ME' }));
  await openPad(page);
  await expect(pad(page)).toHaveValue('KEEP ME');
  page.once('dialog', d => { expect(d.message()).toBe('Clear all notes?'); d.dismiss(); });
  await page.locator('[data-notes-clear]').click();
  await expect(pad(page)).toHaveValue('KEEP ME');
  page.once('dialog', d => d.accept());
  await page.locator('[data-notes-clear]').click();
  await expect(pad(page)).toHaveValue('');
  expect('notepad' in await saved(page)).toBe(false);
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await openPad(page);
  await expect(pad(page), 'and the browser copy went with them').toHaveValue('');
});

test('about five pages and no more: 15,000 characters, the head counts the pages', async ({ page }) => {
  await open(page);
  await openPad(page);
  await expect(page.locator('[data-notes-count]')).toHaveText('PAGE 1 OF 5');
  await pad(page).fill('x'.repeat(7000));
  await pad(page).dispatchEvent('input');
  await expect(page.locator('[data-notes-count]')).toHaveText('PAGE 3 OF 5');
  // A paste past the end is cut at the fifth page.
  await pad(page).focus();
  await page.evaluate(() => {
    const t = document.querySelector('[data-notes-text]');
    t.setSelectionRange(t.value.length, t.value.length);
  });
  await page.keyboard.insertText('y'.repeat(10000));
  await expect(pad(page)).toHaveValue(/^x{7000}y{8000}$/);
  await expect(page.locator('[data-notes-count]')).toHaveText('PAD FULL');
  // And the page scrolls inside the pad, not off the rail.
  const s = await pad(page).evaluate(el => ({ sh: el.scrollHeight, ch: el.clientHeight }));
  expect(s.sh).toBeGreaterThan(s.ch);
});

// SAVE AS TXT (Movie, 18 Oct): "can we put in the notepad a 'SAVE AS TXT
// FILE' and allow them to save it as a TXT file in location where they save
// their DRAFT files as a backup".
test('SAVE AS TXT downloads the pad as a .txt where there is no save dialog, and the chip says where', async ({ page }) => {
  await page.addInitScript(() => { delete window.showSaveFilePicker; });
  await open(page, drawing({ notepad: 'NORTH POINT 895-2 3/8ft x 349 ft' }));
  await openPad(page);
  await expect(page.locator('[data-notes-save-txt]')).toHaveText('SAVE AS TXT');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-notes-save-txt]').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/ NOTES\.txt$/);
  const fs = require('fs');
  expect(fs.readFileSync(await download.path(), 'utf8')).toBe('NORTH POINT 895-2 3/8ft x 349 ft');
  await expect(page.locator('#saved-where')).toContainText('NOTES.txt');
});

test('with a save dialog, it opens beside the last .draft saved and writes the text there', async ({ page }) => {
  await page.addInitScript(() => {
    window.__picks = [];
    window.showSaveFilePicker = async opts => {
      const handle = { kind: 'file', name: opts.suggestedName, written: '',
        createWritable: async () => ({ write: async t => { handle.written += typeof t === 'string' ? t : await new Response(t).text(); }, close: async () => {} }) };
      window.__picks.push({ opts, handle });
      return handle;
    };
  });
  await open(page, drawing({ notepad: 'GRID 1 TO 29' }));
  // A .draft saved through SAVE AS first.
  await page.locator('#file-save-as').click();
  await page.locator('[data-save-as-go]').click();
  await expect.poll(() => page.evaluate(() => window.__picks.length)).toBe(1);
  await openPad(page);
  await page.locator('[data-notes-save-txt]').click();
  await expect.poll(() => page.evaluate(() => window.__picks.length)).toBe(2);
  const got = await page.evaluate(() => {
    const [draft, txt] = window.__picks;
    return { startInIsDraft: txt.opts.startIn === draft.handle, name: txt.opts.suggestedName,
      types: txt.opts.types[0].accept, written: txt.handle.written };
  });
  expect(got.startInIsDraft, 'the dialog opens where the .draft went').toBe(true);
  expect(got.name).toMatch(/ NOTES\.txt$/);
  expect(got.types).toEqual({ 'text/plain': ['.txt'] });
  expect(got.written).toBe('GRID 1 TO 29');
});

// THREE GRAB SPOTS (Movie, 18 Oct): "that ia a good DEFAULT size, but can you
// add 3 'grab spots on the edges where they can grab the edge and pull it
// bigger on the left and top and bottom and allow them to fill basically half
// the page (right half of page) so they can see a couple paragraphs at a time".
test('the pad pulls out by its left, top and bottom edges, to the right half of the page; LEVELS keeps its width; a reload keeps the size', async ({ page }) => {
  await open(page);
  await openPad(page);
  const rail = page.locator('#right-rail');
  const before = await rail.boundingBox();
  const drag = async (which, dx, dy) => {
    const g = await page.locator(`[data-notes-grip="${which}"]`).boundingBox();
    const x = g.x + g.width / 2, y = g.y + g.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 5 });
    await page.mouse.up();
  };
  // Far past the middle: it stops at the right half.
  await drag('left', -2000, 0);
  const vw = page.viewportSize().width;
  let box = await rail.boundingBox();
  expect(box.x, 'its left edge stops at the middle of the page').toBeGreaterThanOrEqual(vw / 2 - 1);
  expect(box.x).toBeLessThanOrEqual(vw / 2 + 1);
  expect(box.x + box.width, 'its right edge where it was').toBeCloseTo(before.x + before.width, 0);
  // Up to under the instrument strip, and down to the foot bar.
  await drag('top', 0, -2000);
  await drag('bottom', 0, 2000);
  box = await rail.boundingBox();
  const strip = await page.locator('#strip').boundingBox();
  const foot = await page.locator('#house-strip').boundingBox();
  expect(box.y).toBeLessThan(before.y);
  expect(box.y).toBeGreaterThanOrEqual(strip.y + strip.height);
  expect(box.y + box.height).toBeGreaterThan(before.y + before.height);
  expect(box.y + box.height).toBeLessThanOrEqual(foot.y);
  // LEVELS / LAYERS keeps the rail's own size.
  await page.locator('#right-tab').click();
  expect((await rail.boundingBox()).width).toBeCloseTo(before.width, 0);
  await tab(page).click();
  expect((await rail.boundingBox()).width).toBeCloseTo(box.width, 0);
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await openPad(page);
  expect((await rail.boundingBox()).width, 'and a reload keeps it').toBeCloseTo(box.width, 0);
});
