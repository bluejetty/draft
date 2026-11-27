// A PASTED BEAM AND ITS POSTS STAY ON THE PLANS AFTER A RELOAD (jb, 27 Nov
// 2026: "the columns on the MAIN FLOOR and beam to support the 2nd floor
// above don't show on the MAIN FLOOR plan or the 2nd FLOOR LAYOUT.. but they
// show on the WIREFRAME? how come").
//
// PASTE gave a beam or column the page's string id (`beam-159`), and
// drawing-format.js reads only whole-number ids: the copy drew until the next
// load, then sat in the file drawn nowhere but the WIREFRAME (which reads the
// file raw). jb pasted again, and again -- TIMBERHOUSE carried each post three
// times over. PASTE now gives a whole number and skips a twin; the format
// reads a `kind-N` id as a new whole number, files a storey's 'foundation'
// record on its walls plan, and leaves out a twin of one already kept.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const P = (x, z) => ({ x, y: 0, z });
const BOX = [[-20, -16], [20, -16], [20, 16], [-20, 16]].map(([x, z]) => P(x, z));
const drawing = () => ({
  version: 1, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 200,
  walls: [], lines: [], floors: [], roofs: [], dimensions: [], fenestrations: [],
  outlines: [{ id: 'o3', levelId: 3, garage: false, points: BOX },
    { id: 'o5', levelId: 5, garage: false, points: BOX }],
  shapes: [], surfaceOpenings: [], notes: [], stairs: [], roomTags: [],
  beams: [{ id: 1, start: P(-14, -15), end: P(-5, -15), levelId: 1, view: 'foundation', mode: 'flush' }],
  columns: [
    { id: 1, point: P(-14, -15), levelId: 1, view: 'foundation', footing: 'pad36' },
    { id: 2, point: P(-5, -15), levelId: 1, view: 'foundation', footing: 'pad36' },
  ],
  boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
});

async function open(page, f, url = '/MODEL.html') {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async file => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(file)], 'drawing.json', { type: 'application/json' }), 'model-drawing');
  }, f);
  await page.goto(url);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

test('a beam and posts pasted from FOUNDATION onto MAIN FL get whole-number ids and are still there after a reload', async ({ page }) => {
  await open(page, drawing());
  await h.pickModelLayer(page, 1, 'foundation');
  await page.evaluate(() => { setSelection([{ type: 'beam', item: drawing.beams[0] }]); copySelection(); });
  await h.pickModelLayer(page, 3, 'plan');
  await page.evaluate(() => pasteHeld());
  const pasted = await page.evaluate(() => ({ beams: beams().map(b => b.id), columns: columns().map(c => c.id) }));
  expect(pasted.beams.length).toBe(1);
  expect(pasted.columns.length).toBe(2);
  [...pasted.beams, ...pasted.columns].forEach(id => expect(Number.isInteger(id), String(id)).toBe(true));
  // PASTE again: nothing lands on top of what is there.
  await page.evaluate(() => pasteHeld());
  expect(await page.evaluate(() => stripNotice)).toMatch(/already there/i);
  expect(await page.evaluate(() => beams().length)).toBe(1);
  await page.locator('#save').click();
  await h.waitForSaved(page);
  // The reload is where the string ids were lost.
  await page.goto('/MODEL.html?level=3&view=plan');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  expect(await page.evaluate(() => [beams().length, columns().length])).toEqual([1, 2]);
  await page.goto('/MODEL.html?level=5&view=floor');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  const plan = page.locator('#plan');
  await expect(plan).toHaveAttribute('data-beams-below', '1');
  await expect(plan).toHaveAttribute('data-posts-below', '2');
});

// jb's TIMBERHOUSE as it was filed: each pasted copy under a `kind-N` id,
// the first main floor paste on 'foundation', and twins of everything.
const timberhouse = () => {
  const f = drawing();
  const beam = (id, levelId, view) => ({ id, start: P(-14, -15), end: P(-5, -15), levelId, view, mode: 'flush' });
  const post = (id, x, levelId, view) => ({ id, point: P(x, -15), levelId, view, footing: 'pad36' });
  f.beams.push(beam('beam-159', 3, 'foundation'), beam('beam-163', 1, 'foundation'), beam('beam-167', 3, 'plan'));
  f.columns.push(post('column-160', -5, 3, 'foundation'), post('column-161', -14, 3, 'foundation'),
    post('column-162', -14, 1, 'foundation'), post('column-164', -5, 1, 'foundation'),
    post('column-165', -14, 3, 'foundation'), post('column-166', -5, 3, 'foundation'),
    post('column-168', -14, 3, 'plan'), post('column-169', -5, 3, 'plan'));
  return f;
};

test('a file carrying pasted `kind-N` beams and posts opens with them on the MAIN FL plan and under the 2ND FL layout, once each', async ({ page }) => {
  await open(page, timberhouse(), '/MODEL.html?level=3&view=plan');
  const main = await page.evaluate(() => ({ beams: beams(), columns: columns() }));
  expect(main.beams.length).toBe(1);
  expect(main.columns.length).toBe(2);
  [...main.beams, ...main.columns].forEach(item => {
    expect(Number.isInteger(item.id)).toBe(true);
  });
  // Nothing of MAIN FL's left on a 'foundation' sheet, which only FOUNDATION
  // has: the first paste (beam-159 and its posts) is filed on the walls plan,
  // and the later ones are its twins.
  expect(await page.evaluate(() => [...drawing.beams, ...drawing.columns]
    .filter(item => Number(item.levelId) === 3).map(item => item.view))).toEqual(['plan', 'plan', 'plan']);
  await page.goto('/MODEL.html?level=1&view=foundation');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  expect(await page.evaluate(() => [beams().map(b => b.id), columns().map(c => c.id)])).toEqual([[1], [1, 2]]);
  await page.goto('/MODEL.html?level=5&view=floor');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect(page.locator('#plan')).toHaveAttribute('data-beams-below', '1');
  await expect(page.locator('#plan')).toHaveAttribute('data-posts-below', '2');
});

test('the format reads a `kind-N` id as the next whole number and still refuses an id that is neither', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  const out = await page.evaluate(() => {
    const F = window.DraftDrawingFormat;
    const pt = (x, z) => ({ x, y: 0, z });
    return F.columns([
      { id: 4, point: pt(0, 0), levelId: 3, view: 'plan' },
      { id: 'column-9', point: pt(5, 0), levelId: 3, view: 'plan' },
      { id: 'post', point: pt(9, 0), levelId: 3, view: 'plan' },
    ], new Set([1, 3, 5])).map(c => c.id);
  });
  expect(out).toEqual([4, 5]);
});
