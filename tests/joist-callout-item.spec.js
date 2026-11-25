// THE JOIST CALLOUT AS AN ITEM OF ITS OWN (jb, 25 Nov 2026).
//
// "i'd like to show the joists different"; "put the text on top or bottom of
// the line and allow the user to delete the default floor [text] and either
// add to that floor text or delete it and change to what he wants, and allow
// the user to move that configuration around to where he wants and copy and
// paste it, should only need 1 per floor area"; "need one for each deck /
// floor area".
//
// One arrow per floor area and per deck is drawn from the floors (build-house
// joistCalloutSeeds). A Select press on one picks it up as a LINE carrying
// `joist` (model/08 adoptJoistCalloutAt): from then on it moves, copies and
// deletes as a line, its words and side on OBJ / PROP, and the floor draws
// it no more -- deleted, it stays gone.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const point = (x, z) => ({ x, y: 0, z });
const rect = (x0, z0, x1, z1) => [point(x0, z0), point(x1, z0), point(x1, z1), point(x0, z1)];
const HOUSE = rect(0, 0, 24, 30);
const PORCH = rect(4, -10, 16, 0);
const wallsOf = (levelId, startId, pts, view = 'plan') => pts.map((pt, i) => ({
  id: startId + i, start: pt, end: pts[(i + 1) % pts.length], levelId, view,
  wallType: view === 'foundation' ? 'concrete_8' : 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
}));
const fixture = (extraFloors = []) => ({
  version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 },
  ],
  activeLevelIdx: 2,
  walls: [...wallsOf(3, 100, HOUSE), ...wallsOf(5, 200, HOUSE), ...wallsOf(1, 300, HOUSE, 'foundation')],
  lines: [], roofs: [], fenestrations: [], dimensions: [], shapes: [], stairs: [], notes: [],
  roomTags: [], boneyardOutlines: [], boneyardShelves: [], groups: [], levelLocks: [], underlays: [],
  outlines: [{ id: 1, levelId: 3, points: HOUSE, garage: false }, { id: 3, levelId: 5, points: HOUSE, garage: false }],
  floors: [
    { id: 'deck-3', levelId: 3, view: 'floor', structure: 'floor', points: HOUSE },
    { id: 'deck-5', levelId: 5, view: 'floor', structure: 'floor', points: HOUSE },
    ...extraFloors,
  ],
  surfaceOpenings: [],
  beams: [{ id: 1, start: point(0.5, 15), end: point(23.5, 15), levelId: 3, view: 'floor', mode: 'flush' }],
  columns: [],
});

async function open(page, file) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  await page.goto('/MODEL.html?left=1&right=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.pickModelLayer(page, 5, 'floor');
  await page.waitForTimeout(300);
}
// The middle of the n-th drawn callout, in page px.
const calloutMiddle = async (page, n = 0) => {
  const m = await page.evaluate(i => {
    const hit = joistCalloutHits[i];
    return { x: (hit.a.x + hit.b.x) / 2, y: (hit.a.y + hit.b.y) / 2, text: hit.seed.text, seed: hit.seed.seed };
  }, n);
  const box = await page.locator('#plan').boundingBox();
  return { x: box.x + m.x, y: box.y + m.y, text: m.text, seed: m.seed };
};
const joistLines = page => page.evaluate(() => drawing.lines.filter(l => l.joist)
  .map(l => ({ ...l.joist, sx: +l.start.x.toFixed(2), sz: +l.start.z.toFixed(2) })));

test('one callout per floor area and one per deck', async ({ page }) => {
  await open(page, fixture([{ id: 'porch', levelId: 5, view: 'floor', deck: true, points: PORCH }]));
  await expect(page.locator('#plan')).toHaveAttribute('data-joist-callouts', '2');
  const seeds = await page.evaluate(() => joistCalloutHits.map(h => [h.seed.seed, h.seed.text]));
  expect(seeds[0][0]).toBe('body:3');
  expect(seeds[0][1]).toMatch(/^TJI/);
  expect(seeds[1]).toEqual(['deck:porch', '2x10 DECK JOISTS']);
});

test('a press picks the callout up as a line: words, side, RESET, drag, DELETE stays gone', async ({ page }) => {
  await open(page, fixture());
  await expect(page.locator('#plan')).toHaveAttribute('data-joist-callouts', '1');
  await page.keyboard.press('s');
  const mid = await calloutMiddle(page);
  await page.mouse.click(mid.x, mid.y);
  let rows = await joistLines(page);
  expect(rows.length, 'filed as a line').toBe(1);
  expect(rows[0]).toMatchObject({ seed: 'body:3', text: mid.text, defaultText: mid.text, side: 'above' });
  expect(await page.evaluate(() => drawing.joistCalloutsTaken)).toEqual(['body:3']);
  await expect(page.locator('#plan')).toHaveAttribute('data-joist-callouts', '0');
  expect(await page.evaluate(() => selection.map(e => e.type + ':' + !!e.item.joist))).toEqual(['line:true']);

  // ITS WORDS: added to, then the side, then RESET.
  const field = page.locator('[data-joist-text]');
  await expect(field).toHaveValue(mid.text);
  // As typed: a lower-case x in 2x10 stays one.
  await field.fill(`${mid.text} @ 16" O.C.`);
  await field.press('Enter');
  rows = await joistLines(page);
  expect(rows[0].text).toBe(`${mid.text} @ 16" O.C.`);
  await page.locator('[data-joist-side="below"]').click();
  rows = await joistLines(page);
  expect(rows[0].side).toBe('below');
  await page.locator('[data-joist-reset]').click();
  rows = await joistLines(page);
  expect(rows[0].text).toBe(mid.text);
  await expect(page.locator('[data-joist-reset]')).toBeDisabled();

  // DRAGGED like any line.
  const before = rows[0];
  await page.mouse.move(mid.x, mid.y);
  await page.mouse.down();
  await page.mouse.move(mid.x + 40, mid.y, { steps: 6 });
  await page.mouse.move(mid.x + 80, mid.y, { steps: 6 });
  await page.mouse.up();
  rows = await joistLines(page);
  expect(rows[0].sx, 'moved').not.toBe(before.sx);

  // DELETED, it stays gone: the floor does not draw it again.
  await page.keyboard.press('Delete');
  expect((await joistLines(page)).length).toBe(0);
  await page.waitForTimeout(150);
  await expect(page.locator('#plan')).toHaveAttribute('data-joist-callouts', '0');
});

test('COPY / PASTE carries the words; the file keeps them', async ({ page }) => {
  await open(page, fixture());
  await page.keyboard.press('s');
  const mid = await calloutMiddle(page);
  await page.mouse.click(mid.x, mid.y);
  await page.locator('[data-joist-text]').fill('2x10 @ 16" O.C. BY OTHERS');
  await page.locator('[data-joist-text]').press('Enter');
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  const rows = await joistLines(page);
  expect(rows.length).toBe(2);
  expect(rows.every(r => r.text === '2x10 @ 16" O.C. BY OTHERS')).toBe(true);
  // Through the format's own reader, as a save and an open would.
  const kept = await page.evaluate(() => window.DraftDrawingFormat.lines(drawing.lines, new Set([1, 3, 5, 7, 8]))
    .filter(l => l.joist).map(l => l.joist.text));
  expect(kept).toEqual(['2x10 @ 16" O.C. BY OTHERS', '2x10 @ 16" O.C. BY OTHERS']);
});

test('UNDO puts the drawn callout back', async ({ page }) => {
  await open(page, fixture());
  await page.keyboard.press('s');
  const mid = await calloutMiddle(page);
  await page.mouse.click(mid.x, mid.y);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+z');
  expect((await joistLines(page)).length).toBe(0);
  expect(await page.evaluate(() => drawing.joistCalloutsTaken)).toEqual([]);
  await page.waitForTimeout(150);
  await expect(page.locator('#plan')).toHaveAttribute('data-joist-callouts', '1');
});
