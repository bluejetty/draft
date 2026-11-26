// COLUMN OBJ / PROP: POST SHAPE AND WIDTH, A SQUARE PILE CAP, A POST BASE.
//
// jb, 25 Nov 2026, for a drive-under roof between two buildings: "make more
// OBJ PROP options for the columns so can change the width of the upper
// column and also make circle column also available (DIA.) would be WIDTH
// ... square pile cap on the top of the round pile from under grade to where
// the wood starts". On the numbers (26 Nov): a 20" cap, 8" from grade to the
// top of the concrete, up to 12" on a slope as long as 8" stays in the ground.
//
// Placed, picked on the panel, saved, and read back the way a reload reads it.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });

const base = () => ({
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  board: 'drafting',
  walls: [
    ['n', V(-10, -10), V(10, -10)], ['e', V(10, -10), V(10, 10)],
    ['s', V(10, 10), V(-10, 10)], ['w', V(-10, 10), V(-10, -10)],
  ].map(([id, start, end]) => ({ id, start, end, levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' })),
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
});

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: base() });
  await page.goto('/MODEL.html?left=1&lpane=build&right=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

async function place(page) {
  const box = await page.locator('#plan').boundingBox();
  const scale = await page.evaluate(() => Number(
    /scale ([\d.]+) px\/ft/.exec(document.getElementById('readout').textContent)[1]));
  await page.locator('[data-tool-key="column"]').click();
  await page.mouse.click(box.x + box.width / 2 + 2 * scale, box.y + box.height / 2 + 3 * scale);
  await page.waitForTimeout(120);
}

const rawColumn = page => page.evaluate(async bucket => {
  const f = await window.SharedFileStore.loadSharedFile(bucket);
  const raw = JSON.parse(await f.text());
  const ids = new Set((raw.levels || []).map(l => Number(l.id)));
  return { raw: raw.columns[0], read: window.DraftDrawingFormat.columns(raw.columns, ids)[0] };
}, BUCKET);

const save = async page => { await page.locator('#save').click(); await page.waitForTimeout(400); };

test('a placed column offers POST SQUARE / ROUND and WIDTH, and no cap on a pad', async ({ page }) => {
  await open(page);
  await place(page);
  await expect(page.locator('[data-prop-row="post"] [data-prop-value="square"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-prop-row="width in"] input')).toHaveValue('3');
  await expect(page.locator('[data-prop-row="pile cap"]')).toHaveCount(0);
  await page.locator('[data-prop-row="post"] [data-prop-value="round"]').click();
  await expect(page.locator('[data-prop-row="dia. in"]'), 'WIDTH becomes DIA. on a round post').toBeVisible();
  await page.locator('[data-prop-row="post dia."] [data-prop-value="r8"]').click();
  await expect(page.locator('[data-prop-row="dia. in"] input')).toHaveValue('8');
  await save(page);
  const { raw, read } = await rawColumn(page);
  expect(raw.postShape).toBe('round');
  expect(raw.postIn).toBe(8);
  expect(read.postShape).toBe('round');
  expect(read.postIn).toBe(8);
});

test('a pile takes a square cap 20" tall, 8" to 12" above grade, and a post base', async ({ page }) => {
  await open(page);
  await place(page);
  await page.locator('[data-prop-row="footing"] [data-prop-value="pile12"]').click();
  await page.locator('[data-prop-row="post size"] [data-prop-value="6x6"]').click();
  await page.locator('[data-prop-row="pile cap"] [data-prop-value="cap"]').click();
  await expect(page.locator('[data-prop-row="cap width in"] input'), 'the 12" pile + 4"').toHaveValue('16');
  await expect(page.locator('[data-prop-row="cap height in"] input')).toHaveValue('20');
  const above = page.locator('[data-roof-field^="above grade in"]');
  await expect(above).toHaveValue('8');
  await expect(page.locator('[data-cap-below]')).toContainText('12" BELOW GRADE');
  await above.fill('15');
  await above.dispatchEvent('change');
  await expect(above, 'held to 12" so 8" stays in the ground').toHaveValue('12');
  await expect(page.locator('[data-cap-below]')).toContainText('8" BELOW GRADE');
  await page.locator('[data-prop-row="post base"] [data-prop-value="standoff"]').click();
  await save(page);
  const { raw, read } = await rawColumn(page);
  expect(raw).toMatchObject({ footing: 'pile12', postIn: 5.5, capIn: 16, capAboveIn: 12, postBase: 'standoff' });
  expect(read).toMatchObject({ footing: 'pile12', postIn: 5.5, capIn: 16, capAboveIn: 12, postBase: 'standoff' });

  // Back to a pad: the cap goes with the pile.
  await page.locator('[data-prop-row="footing"] [data-prop-value="pad36"]').click();
  await expect(page.locator('[data-prop-row="pile cap"]')).toHaveCount(0);
  await save(page);
  expect((await rawColumn(page)).raw.capIn).toBeUndefined();
});
