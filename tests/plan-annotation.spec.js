// ANNOTATION ON A PLAN -- the SITE plan first.
//
// jb, 10 Nov: "when i am drawing the site plan i want to make a annotation
// with the plan info (i put it in the rm tag) i tried the ANNOTATION and it
// didn't draw and arrow or make a text box" -- "it act like just a grab and
// move the screen function". The tool drew on elevations only; on a plan
// the press fell through to the pan. Now: a TAP opens the text box where
// the tap was; POINTER on, the first tap is the thing, the second the text;
// PRESS AND DRAG is a leader too. The box takes several lines with
// Shift+Enter, Enter places it, and the note is the plan's own kind
// (drawing.notes), so it is back after a reload and on the LAYOUT sheet.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const SITE = 8;
const ring = ([w, d]) => [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]
  .map(([x, z]) => ({ x, y: 0, z }));
const siteFile = () => ({
  version: 1, planTurn: 0, board: 'drafting', standalone: 'site',
  levels: [{ id: SITE, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -10 }],
  activeLevelIdx: 0,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [{ id: 'lot', levelId: SITE, site: true, garage: false, detached: false, masterId: null,
    foundation: null, closed: true, points: ring([60, 120]), overriddenSrcIds: [] }],
  shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

async function openSite(page) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, drawing }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(drawing)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, drawing: siteFile() });
  await page.goto(`/MODEL.html?level=${SITE}&lpane=drafting&left=1`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(300);
  const later = page.locator('#lot-pick [data-lot-pick-ok]');
  if (await later.isVisible().catch(() => false)) await later.click();
}
const saved = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};
const viewOf = page => page.locator('#plan').getAttribute('data-view');

test('a tap opens the text box, Shift+Enter adds a line, Enter places a note on SITE', async ({ page }) => {
  await openSite(page);
  await h.armFromRail(page, 'annotation');
  const before = await viewOf(page);
  const f = await h.planFrame(page);
  const [x, y] = f.at(0, -50);
  await page.mouse.click(x, y);
  const box = page.locator('[data-elev-note]');
  await expect(box, 'the text box opens where the tap was').toBeVisible();
  await page.keyboard.type('Plan of proposed subdivision');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type('into bare land units 20-33');
  await page.keyboard.press('Enter');
  await expect(box).toHaveCount(0);
  expect(await viewOf(page), 'the sheet did not pan').toBe(before);

  const notes = (await saved(page)).notes;
  expect(notes).toHaveLength(1);
  expect(notes[0].body).toBe('PLAN OF PROPOSED SUBDIVISION\nINTO BARE LAND UNITS 20-33');
  expect(notes[0].end).toBe('none');
  expect(notes[0].levelId).toBe(SITE);
  expect(notes[0].view).toBe('plan');
  expect(Math.abs(notes[0].text.z + 50)).toBeLessThan(1);

  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  expect((await h.savedDrawing(page)).notes, 'back after a reload').toHaveLength(1);
  expect(await page.evaluate(() => notes().length), 'and painted on SITE').toBe(1);
});

test('POINTER: tap the lot corner, tap where the text goes, and the leader ends in an ARROW', async ({ page }) => {
  await openSite(page);
  await h.armFromRail(page, 'annotation');
  await page.locator('[data-note-pointer="on"]').click();
  await page.locator('[data-note-end="arrow"]').click();
  await expect(page.locator('[data-note-end="arrow"]')).toHaveAttribute('aria-pressed', 'true');
  const f = await h.planFrame(page);
  const [cx, cy] = f.at(30.4, 60.4);          // just off the lot's corner
  await page.mouse.click(cx, cy);
  await expect(page.locator('[data-elev-note]')).toHaveCount(0);
  await expect(page.locator('#strip-message')).toContainText(/now tap where the text goes/i);
  const [tx, ty] = f.at(45, 70);
  await page.mouse.click(tx, ty);
  await expect(page.locator('[data-elev-note]')).toBeVisible();
  await page.keyboard.type('Iron pin found');
  await page.keyboard.press('Enter');

  const [note] = (await saved(page)).notes;
  expect(note.body).toBe('IRON PIN FOUND');
  expect(note.end).toBe('arrow');
  expect(note.anchor.x, 'the pointer caught the lot corner').toBeCloseTo(30, 1);
  expect(note.anchor.z).toBeCloseTo(60, 1);
  expect(note.text.x).toBeCloseTo(45, 0);
});

test('press on the thing and drag to the text is a leader; Escape in the box drops it', async ({ page }) => {
  await openSite(page);
  await h.armFromRail(page, 'annotation');
  const f = await h.planFrame(page);
  const [ax, ay] = f.at(-30, 0);
  const [tx, ty] = f.at(-50, -20);
  await page.mouse.move(ax, ay);
  await page.mouse.down();
  await page.mouse.move((ax + tx) / 2, (ay + ty) / 2, { steps: 4 });
  await page.mouse.move(tx, ty, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator('[data-elev-note]')).toBeVisible();
  await page.keyboard.type('West lot line');
  await page.keyboard.press('Enter');

  // And a box let go with Escape leaves nothing behind.
  await page.mouse.click(...f.at(0, 0));
  await expect(page.locator('[data-elev-note]')).toBeVisible();
  await page.keyboard.type('Nothing');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-elev-note]')).toHaveCount(0);

  const notes = (await saved(page)).notes;
  expect(notes).toHaveLength(1);
  expect(notes[0].body).toBe('WEST LOT LINE');
  expect(notes[0].end).toBe('line');
  expect(notes[0].anchor.x).toBeCloseTo(-30, 0);
  expect(notes[0].text.x).toBeCloseTo(-50, 0);
});
