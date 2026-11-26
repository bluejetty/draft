// A COLUMN COPIES AS ONE UNIT (jb, 25 Nov 2026).
//
// "if i copy and paste a column we should copy an paste all columns in its
// location on other floors and also the pad footing or pile which supports it
// below" ... "kindof consider the entire footing (or pile), column, column,
// column all the way up as one UNIT". COPY on any one post takes every post
// within 3" on every level and view, the FOUNDATION pad/pile too; each copy
// lands on its own floor; dragged off, the copies go and the originals stay.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const L = [[-20, -16], [20, -16], [20, 16], [-20, 16]];
const P = (x, z) => ({ x, y: 0, z });
// Post 2 (FOUNDATION pad) with posts 4 (MAIN FL) and 5 (2ND FL) over it;
// post 3 alone off to the side.
const drawing = () => ({
  version: 1, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 20,
  walls: [], lines: [], floors: [], roofs: [], dimensions: [], fenestrations: [],
  outlines: [{ id: 'outline-r', levelId: 3, garage: false, points: L.map(([x, z]) => P(x, z)) }],
  shapes: [], surfaceOpenings: [], notes: [], stairs: [], roomTags: [],
  beams: [],
  columns: [
    { id: 2, point: P(-14, 8), levelId: 1, view: 'foundation', footing: 'pile10' },
    { id: 3, point: P(-10, 12), levelId: 1, view: 'foundation', footing: 'pad36' },
    { id: 4, point: P(-14, 8), levelId: 3, view: 'plan', footing: 'pad36' },
    { id: 5, point: P(-14, 8), levelId: 5, view: 'plan', footing: 'pad36' },
  ],
  boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
});
async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const r2 = n => Math.round(n * 100) / 100 + 0;
const where = c => [Number(c.levelId), c.view || 'plan', r2(c.point.x), r2(c.point.z), c.footing];

test('COPY a MAIN FL post takes the 2ND FL post and the FOUNDATION pile; each lands on its own floor; MOVE takes the copies only', async ({ page }) => {
  await open(page);
  const n = await page.evaluate(() => {
    setSelection([{ type: 'column', item: drawing.columns.find(c => Number(c.id) === 4) }]);
    return copySelection();
  });
  expect(n).toBe(3);
  expect(await page.evaluate(() => stripNotice)).toContain('whole stack');
  // Pasted with the 2ND FL plan up: still one per floor, as copied.
  const landed = await page.evaluate(() => pasteHeld());
  expect(landed).toBe(3);
  let d = await saved(page);
  const copies = d.columns.filter(c => ![2, 3, 4, 5].includes(Number(c.id)));
  expect(copies.map(where).sort()).toEqual([
    [1, 'foundation', -14, 8, 'pile10'], [3, 'plan', -14, 8, 'pad36'], [5, 'plan', -14, 8, 'pad36'],
  ].sort());
  // The pasted unit is picked; moving it carries the three copies, and the
  // originals under them stay where they are.
  await page.evaluate(() => {
    const before = drawing.columns.length;
    setSelection(drawing.columns.slice(before - 3).map(item => ({ type: 'column', item })));
    paint();
  });
  await page.keyboard.press('Control+ArrowRight');
  d = await saved(page);
  const byId = Object.fromEntries(d.columns.map(c => [String(c.id), [r2(c.point.x), r2(c.point.z)]]));
  expect(byId['2']).toEqual([-14, 8]);
  expect(byId['4']).toEqual([-14, 8]);
  expect(byId['5']).toEqual([-14, 8]);
  const moved = d.columns.filter(c => ![2, 3, 4, 5].includes(Number(c.id))).map(c => r2(c.point.x));
  expect(moved).toEqual([-13, -13, -13]);
});

test('the PASTE row reads ALL LEVELS beside PASTE THIS LEVEL; THIS LEVEL lands just the MAIN FL post', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    setSelection([{ type: 'column', item: drawing.columns.find(c => Number(c.id) === 4) }]);
    copySelection();
    paint();
  });
  await expect(page.locator('#paste')).toHaveText('PASTE ALL LEVELS');
  await expect(page.locator('#paste-level')).toBeVisible();
  await page.locator('#paste-level').click();
  const d = await saved(page);
  const copies = d.columns.filter(c => ![2, 3, 4, 5].includes(Number(c.id)));
  expect(copies.map(where)).toEqual([[3, 'plan', -14, 8, 'pad36']]);
});

test('PASTE THIS LEVEL on a floor the stack has no piece on lands the picked post there', async ({ page }) => {
  await open(page);
  const d = await page.evaluate(() => {
    setSelection([{ type: 'column', item: drawing.columns.find(c => Number(c.id) === 4) }]);
    copySelection();
    drawing.columns = drawing.columns.filter(c => Number(c.id) !== 4); // MAIN FL piece gone
    const n = pasteHeld({ thisLevel: true });
    return { n, landed: selection.map(e => [Number(e.item.levelId), e.item.footing]) };
  });
  expect(d).toEqual({ n: 1, landed: [[3, 'pad36']] });
});

test('a column standing alone copies alone, onto the plan the paste is made on', async ({ page }) => {
  await open(page);
  const n = await page.evaluate(() => {
    setSelection([{ type: 'column', item: drawing.columns.find(c => Number(c.id) === 3) }]);
    return copySelection();
  });
  expect(n).toBe(1);
  await page.evaluate(() => paint());
  await expect(page.locator('#paste')).toHaveText('PASTE');
  await expect(page.locator('#paste-level')).toBeHidden();
});

// PASTED ON ANOTHER FLOOR (jb, 26 Nov 2026): "if i copy a beam and columns
// from basement i'd like to be able to paste them ... onto the new level main
// fl and 2nd floor" -- "beam and columns or just beam or just column or
// columns". A beam or column pasted on another level is filed on the plan
// showing, as the BEAM / COLUMN tool would file one drawn there.
const beamDrawing = () => {
  const f = drawing();
  f.beams = [{ id: 1, start: P(-20, 8), end: P(0, 8), levelId: 1, view: 'foundation', mode: 'flush' }];
  f.columns = [
    { id: 2, point: P(-14, 8), levelId: 1, view: 'foundation', footing: 'pad36' },
    { id: 3, point: P(-6, 8), levelId: 1, view: 'foundation', footing: 'pad36' },
  ];
  return f;
};
async function openWith(page, f) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
for (const [what, pick] of [
  ['beam and its posts', d => [{ type: 'beam', item: d.beams[0] }]],
  ['just the beam', null],
  ['one column', d => [{ type: 'column', item: d.columns[0] }]],
  ['two columns', d => d.columns.map(item => ({ type: 'column', item }))],
]) {
  test(`copied on FOUNDATION, ${what} pastes onto the MAIN FL plan, filed there`, async ({ page }) => {
    await openWith(page, beamDrawing());
    await h.pickModelLayer(page, 1, 'foundation');
    const out = await page.evaluate(src => {
      const pick = new Function('d', `return (${src})(d)`);
      setSelection(pick(drawing));
      copySelection();
      // 'just the beam': held without its posts, as a box round the beam
      // alone would leave it after the posts are deleted from the copy.
      return held.length;
    }, (pick || (d => [{ type: 'beam', item: d.beams[0] }])).toString());
    if (!pick) await page.evaluate(() => { held = held.filter(e => e.type === 'beam'); });
    await h.pickModelLayer(page, 3, 'plan');
    await page.evaluate(() => pasteHeld());
    const d = await saved(page);
    const fresh = [...d.beams.filter(b => Number(b.id) !== 1), ...d.columns.filter(c => ![2, 3].includes(Number(c.id)))];
    expect(fresh.length).toBe(pick ? out : 1);
    fresh.forEach(item => expect([Number(item.levelId), item.view || 'plan']).toEqual([3, 'plan']));
    // The originals stay on FOUNDATION.
    expect(d.beams.find(b => Number(b.id) === 1).view).toBe('foundation');
  });
}
