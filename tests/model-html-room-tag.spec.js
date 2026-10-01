// ROOM TAG: a tag the drafter puts down, names, sizes, selects and moves.
//
// Movie, 1 Oct: "if the user want to add a room tag,, there should be a
// DRAFTING TOOL for ROOM TAG", "just make ROOM TAG that a user can place and
// fill out the info", "name top line and each of the FT dims on 2nd line",
// "if they only put in 12 only show 12", and "i wasn't able to select the
// ROOM TAG. the user should be able to select it and move it".
//
// EVERY CHECK READS THE SAVED FILE. What the page painted is not the claim;
// the claim is the record the next page -- LAYOUT, the Real Estate plan --
// will read.
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

const nameBox = page => page.locator('[data-prop-text="name"]');
const sizeBox = page => page.locator('[data-prop-text="size"]');

test('ROOM TAG places a tag; NAME and SIZE are typed, and saved as typed', async ({ page }) => {
  await open(page);
  await h.armFromRail(page, 'roomtag');
  await tapWorld(page, 4, 2);
  // THE NAME BOX IS READY TO TYPE OVER, so tagging a plan is press, type.
  await expect(nameBox(page)).toBeFocused();
  await page.keyboard.type('bedroom');
  await page.keyboard.press('Enter');
  await sizeBox(page).fill('12-6X10');
  await sizeBox(page).press('Enter');

  const saved = await save(page);
  expect(saved.roomTags).toHaveLength(1);
  const [tag] = saved.roomTags;
  expect(tag.name).toBe('BEDROOM');
  expect(tag.size, 'the size is kept exactly as typed').toBe('12-6X10');
  expect(tag.levelId).toBe(MAIN_FL);
  expect(Number.isInteger(tag.id), 'the format insists on a whole-number id').toBe(true);
  expect(tag.at.x).toBeCloseTo(4, 0);
  expect(tag.at.z).toBeCloseTo(2, 0);

  // AND A SECOND ONE, while the tool is still in hand, gets its own id.
  await tapWorld(page, -5, -3);
  await page.keyboard.type('KITCHEN');
  await page.keyboard.press('Enter');
  const two = (await save(page)).roomTags;
  expect(two.map(t => t.name)).toEqual(['BEDROOM', 'KITCHEN']);
  expect(new Set(two.map(t => t.id)).size).toBe(2);
});

test('the file format keeps the size line, and "12" stays "12"', async ({ page }) => {
  await open(page);
  const out = await page.evaluate(() => window.DraftDrawingFormat.roomTags([
    { id: 1, at: { x: 0, z: 0 }, levelId: 3, name: 'den', size: '12' },
    { id: 2, at: { x: 1, z: 0 }, levelId: 3, name: 'wc', size: '  12-4 1/4X10 ' },
    { id: 3, at: { x: 2, z: 0 }, levelId: 3, name: 'hall' },
  ], new Set([3])));
  expect(out.map(t => [t.name, t.size])).toEqual([
    ['DEN', '12'], ['WC', '12-4 1/4X10'], ['HALL', undefined],
  ]);
});

const TAGGED = () => HOUSE({
  roomTags: [{ id: 4, at: { x: 3, z: 1 }, levelId: MAIN_FL, view: 'plan', name: 'LIVING',
    size: '14X16', areaSqFt: 0, stamped: true, layer: 'ROOM-IDS-AREA' }],
  nextRoomTagId: 5,
});

test('SELECT picks a tag, and a drag moves it; UNDO puts it back', async ({ page }) => {
  await open(page, TAGGED());
  await tapWorld(page, 3, 1);
  await expect(nameBox(page), 'the click picked the tag').toHaveValue('LIVING');
  await expect(sizeBox(page)).toHaveValue('14X16');

  const from = await worldToPage(page, 3, 1);
  const to = await worldToPage(page, -4, -2);
  await page.mouse.move(from.px, from.py);
  await page.mouse.down();
  await page.mouse.move((from.px + to.px) / 2, (from.py + to.py) / 2, { steps: 4 });
  await page.mouse.move(to.px, to.py, { steps: 4 });
  await page.mouse.up();

  let [tag] = (await save(page)).roomTags;
  expect(tag.at.x).toBeCloseTo(-4, 0);
  expect(tag.at.z).toBeCloseTo(-2, 0);
  expect(tag.size, 'a move is a move: the size rides along').toBe('14X16');

  await page.locator('[data-model-undo]').click();
  [tag] = (await save(page)).roomTags;
  expect(tag.at).toEqual({ x: 3, z: 1 });
});

test('DELETE takes a selected tag; UNDO brings it back', async ({ page }) => {
  await open(page, TAGGED());
  await tapWorld(page, 3, 1);
  await page.locator('[data-delete]').click();
  expect((await save(page)).roomTags).toEqual([]);
  await page.locator('[data-model-undo]').click();
  expect((await save(page)).roomTags.map(t => t.name)).toEqual(['LIVING']);
});

test('Backspace in a box edits the text and deletes nothing', async ({ page }) => {
  // The bug this page had: a key typed in a properties box also went to the
  // page's own DELETE, so correcting a name took the selected thing away.
  await open(page, TAGGED());
  // The rail open, so PROPERTIES is on screen beside it.
  await h.showLeftPane(page, 'drafting');
  await tapWorld(page, 3, 1);
  await sizeBox(page).click();
  await page.keyboard.press('End');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('20');
  await page.keyboard.press('Enter');
  const saved = await save(page);
  expect(saved.roomTags.map(t => [t.name, t.size])).toEqual([['LIVING', '14X20']]);
  expect(saved.walls, 'and nothing else went either').toHaveLength(4);
});

test('an emptied NAME is refused; an emptied SIZE takes the line away', async ({ page }) => {
  await open(page, TAGGED());
  await h.showLeftPane(page, 'drafting');
  await tapWorld(page, 3, 1);
  await nameBox(page).fill('');
  await nameBox(page).press('Enter');
  await expect(nameBox(page)).toHaveValue('LIVING');
  await sizeBox(page).fill('');
  await sizeBox(page).press('Enter');
  const [tag] = (await save(page)).roomTags;
  expect(tag.name).toBe('LIVING');
  expect('size' in tag, 'no blank size kept').toBe(false);
});

test('ROOM TAG is a drafting key: TOY does not offer it', async ({ page }) => {
  await open(page, HOUSE({ board: 'toy' }));
  await h.showLeftPane(page, 'drafting');
  await expect(page.locator('[data-tool-key="roomtag"]')).toBeDisabled();
});
