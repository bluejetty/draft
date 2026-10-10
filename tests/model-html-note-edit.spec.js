// NOTES ARE EDITABLE IN MODEL (Movie, 10 Oct: "looks good as you have it").
// A note on the plan is picked by its text or its leader, dragged by its text
// (the leader's tip stays on what it points at) or by its tip, deleted, and
// its words changed by a double-click. Each is one UNDO.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3;

const wall = (id, x0, z0, x1, z1) => ({
  id, levelId: MAIN_FL, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 8, start: { x: x0, y: 0, z: z0 }, end: { x: x1, y: 0, z: z1 },
});
const HOUSE = (extra = {}) => ({
  format: 'draft-drawing', version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: MAIN_FL, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -10 },
  ],
  walls: [
    wall('w-n', -10, -8, 10, -8), wall('w-e', 10, -8, 10, 8),
    wall('w-s', 10, 8, -10, 8), wall('w-w', -10, 8, -10, -8),
  ],
  floors: [], lines: [], dimensions: [], shapes: [], outlines: [], notes: [], fenestrations: [],
  roomTags: [],
  board: 'drafting',
  ...extra,
});

async function open(page, saved = HOUSE()) {
  await page.goto('/MODEL.dc.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved });
  await page.goto(`/MODEL.html?mode=night&level=${MAIN_FL}`);
  await expect(page.locator('#readout')).toContainText('scale', { timeout: 10000 });
}

const stored = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await file.text());
}, BUCKET);

async function save(page) {
  await page.locator('[data-model-save]').click();
  await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });
  return stored(page);
}

// World -> page pixels off the readout's published scale; every level's
// drawing is centred on the origin, so world (0, 0) is the canvas centre.
async function worldToPage(page, x, z) {
  const hit = (await page.locator('#readout').textContent()).match(/scale ([\d.]+) px\/ft/);
  expect(hit, 'the readout publishes the scale').toBeTruthy();
  const scale = Number(hit[1]);
  const box = await page.locator('#plan').boundingBox();
  return { px: box.x + box.width / 2 + x * scale, py: box.y + box.height / 2 + z * scale, scale };
}
async function tapWorld(page, x, z) {
  const { px, py } = await worldToPage(page, x, z);
  const under = await page.evaluate(({ px, py }) => document.elementFromPoint(px, py)?.id, { px, py });
  expect(under, `world (${x}, ${z}) must land on the canvas`).toBe('plan');
  await page.mouse.click(px, py);
  await page.waitForTimeout(60);
}

const NOTED = (extra = {}) => HOUSE({
  notes: [{ id: 7, levelId: MAIN_FL, view: 'plan', anchor: { x: 2, z: 2 }, text: { x: 5, z: 4 },
    body: 'CHECK HEADER', end: 'arrow', ...extra }],
});
// A point on the note's words: just right of where its text block starts.
async function onWords(page) {
  const { px, py, scale } = await worldToPage(page, 5, 4);
  return { px: px + 12, py, scale };
}
async function tapWords(page) {
  const { px, py } = await onWords(page);
  await page.mouse.click(px, py);
  await page.waitForTimeout(60);
}
async function dragPx(page, from, to) {
  await page.mouse.move(from.px, from.py);
  await page.mouse.down();
  await page.mouse.move((from.px + to.px) / 2, (from.py + to.py) / 2, { steps: 4 });
  await page.mouse.move(to.px, to.py, { steps: 4 });
  await page.mouse.up();
}

test('DELETE takes a note picked by its words; UNDO brings it back', async ({ page }) => {
  await open(page, NOTED());
  await tapWords(page);
  await page.locator('[data-delete]').click();
  expect((await save(page)).notes).toEqual([]);
  await page.locator('[data-model-undo]').click();
  expect((await save(page)).notes.map(n => n.body)).toEqual(['CHECK HEADER']);
});

test('a note is picked by its leader too', async ({ page }) => {
  await open(page, NOTED());
  // Halfway along the leader, between the tip (2, 2) and the text (5, 4).
  const mid = await worldToPage(page, 3.5, 3);
  await page.mouse.click(mid.px, mid.py);
  await page.waitForTimeout(60);
  await page.locator('[data-delete]').click();
  expect((await save(page)).notes).toEqual([]);
});

test('dragging a note by its words moves the words; the tip stays put', async ({ page }) => {
  await open(page, NOTED());
  await tapWords(page);
  const from = await onWords(page);
  await dragPx(page, from, { px: from.px + 3 * from.scale, py: from.py + 2 * from.scale });
  let [n] = (await save(page)).notes;
  expect(n.text.x).toBeCloseTo(8, 0);
  expect(n.text.z).toBeCloseTo(6, 0);
  expect(n.anchor, 'the leader still points where it did').toEqual({ x: 2, z: 2 });
  await page.locator('[data-model-undo]').click();
  [n] = (await save(page)).notes;
  expect(n.text).toEqual({ x: 5, z: 4 });
});

test('dragging a note by its tip points it somewhere else', async ({ page }) => {
  await open(page, NOTED());
  await tapWords(page);
  const tip = await worldToPage(page, 2, 2);
  await dragPx(page, tip, { px: tip.px - 4 * tip.scale, py: tip.py });
  const [n] = (await save(page)).notes;
  expect(n.anchor.x).toBeCloseTo(-2, 0);
  expect(n.anchor.z).toBeCloseTo(2, 0);
  expect(n.text, 'the words stay').toEqual({ x: 5, z: 4 });
});

test('a double-click edits the words; Enter keeps, UNDO puts the old words back', async ({ page }) => {
  await open(page, NOTED());
  const { px, py } = await onWords(page);
  await page.mouse.dblclick(px, py);
  const box = page.locator('[data-note-edit]');
  await expect(box).toBeFocused();
  await expect(box).toHaveValue('CHECK HEADER');
  await page.keyboard.type('verify beam size');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type('at stair');
  await page.keyboard.press('Enter');
  await expect(box).toHaveCount(0);
  let [n] = (await save(page)).notes;
  expect(n.body).toBe('VERIFY BEAM SIZE\nAT STAIR');
  await page.locator('[data-model-undo]').click();
  [n] = (await save(page)).notes;
  expect(n.body).toBe('CHECK HEADER');
});

test('Escape leaves the words as they were, and so does emptying them', async ({ page }) => {
  await open(page, NOTED());
  let { px, py } = await onWords(page);
  await page.mouse.dblclick(px, py);
  await page.keyboard.type('NOPE');
  await page.keyboard.press('Escape');
  await page.mouse.dblclick(px, py);
  await page.keyboard.press('Delete');
  await page.keyboard.press('Enter');
  const [n] = (await save(page)).notes;
  expect(n.body).toBe('CHECK HEADER');
});

test('the NOTE filter grabs a note over the wall under it', async ({ page }) => {
  // The words sit on the east wall: with NOTE engaged the wall cannot answer.
  await open(page, NOTED({ text: { x: 9.5, z: 0 }, anchor: { x: 6, z: -3 } }));
  await h.showLeftPane(page, 'drafting');
  await page.locator('[data-sel-filter="note"]').click();
  const { px, py } = await worldToPage(page, 9.5, 0);
  await page.mouse.click(px + 12, py);
  await page.waitForTimeout(60);
  await page.locator('[data-delete]').click();
  const saved = await save(page);
  expect(saved.notes).toEqual([]);
  expect(saved.walls, 'the wall stays').toHaveLength(4);
});
