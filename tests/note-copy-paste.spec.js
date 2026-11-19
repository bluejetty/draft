// A NOTE COPIES AND PASTES.
//
// jb, 19 Nov: "i'm trying to COPY and PASTE the annotation. when i press
// COPY, no PASTE button appears, also could we allow CTL-C and CTL-V to work
// for those commands". A note was left out of what COPY holds (its id is a
// whole number, as a dimension's is), so COPY held nothing and PASTE never
// showed. Now a note is held; the paste gives it the next whole-number id,
// lands it where the first one stood, picked, and one UNDO takes it back.
// Ctrl+C / Ctrl+V do the same, and keep out of a text box.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN = 3;
const file = () => ({
  version: 1, planTurn: 0, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 },
    { id: MAIN, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -10 }],
  activeLevelIdx: 2,
  walls: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  lines: [{ id: 'l1', levelId: MAIN, view: 'plan', start: { x: -20, y: 0, z: -20 }, end: { x: 20, y: 0, z: 20 } }],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [],
  notes: [{ id: 26, levelId: MAIN, view: 'plan', anchor: { x: 0, y: 0, z: 0 }, text: { x: 0, y: 0, z: 0 },
    body: 'FRONT YARD', end: 'none', fill: false, fillOpacity: 0.85, outline: false, bullnose: 0, caps: true }],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

async function open(page) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, drawing }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(drawing)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, drawing: file() });
  await page.goto(`/MODEL.html?level=${MAIN}&lpane=drafting&left=1`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(300);
}
// Pick the note from the page (a click on its words lands on the label box,
// which the select tool already covers elsewhere).
const pickNote = page => page.evaluate(() => {
  setSelection([{ type: 'note', item: drawing.notes.find(n => n.id === 26) }]);
  paint();
});
const notes = page => page.evaluate(() => drawing.notes.map(n => ({ id: n.id, body: n.body,
  levelId: n.levelId, view: n.view, text: n.text })));

test('COPY on a picked note shows PASTE; PASTE puts a second note down, picked, one UNDO back', async ({ page }) => {
  await open(page);
  await pickNote(page);
  await expect(page.locator('#copy')).toBeVisible();
  await expect(page.locator('#paste')).toBeHidden();
  await page.locator('#copy').click();
  await expect(page.locator('#paste'), 'PASTE shows once a note is held').toBeVisible();
  if (process.env.NOTE_SHOTS) await page.screenshot({ path: `${process.env.NOTE_SHOTS}/1-copy-pressed-paste-shows.png` });
  await page.locator('#paste').click();
  const after = await notes(page);
  expect(after).toHaveLength(2);
  const copy = after.find(n => n.id !== 26);
  expect(copy.id, 'a whole-number id after the highest').toBe(27);
  expect(copy.body).toBe('FRONT YARD');
  expect(copy.levelId).toBe(MAIN);
  expect(copy.view).toBe('plan');
  expect(copy.text).toEqual({ x: 0, y: 0, z: 0 });
  const picked = await page.evaluate(() => selection.map(e => [e.type, e.item.id]));
  expect(picked).toEqual([['note', 27]]);

  await page.locator('#model-undo').click();
  expect(await notes(page)).toHaveLength(1);

  // AND IT SAVES: the format keeps the pasted note (whole-number id).
  await page.locator('#paste').click();
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const savedNotes = (await h.savedDrawing(page)).notes;
  expect(savedNotes.map(n => n.id).sort()).toEqual([26, 27]);
});

test('Ctrl+C / Ctrl+V copy and paste a note; in a text box they are the box\'s', async ({ page }) => {
  await open(page);
  await pickNote(page);
  await page.locator('#plan').focus().catch(() => {});
  await page.keyboard.press('Control+c');
  await expect(page.locator('#paste')).toBeVisible();
  await page.keyboard.press('Control+v');
  await page.keyboard.press('Control+v');
  expect((await notes(page)).map(n => n.id)).toEqual([26, 27, 28]);

  // TYPING IS NOT A COMMAND: Ctrl+V in a box pastes no note.
  await page.evaluate(() => {
    const box = document.createElement('input');
    box.id = 'probe-box';
    document.body.appendChild(box);
  });
  await page.locator('#probe-box').focus();
  await page.keyboard.press('Control+v');
  expect(await notes(page)).toHaveLength(3);
});
