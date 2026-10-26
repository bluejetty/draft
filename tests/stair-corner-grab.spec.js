// A SELECTED STAIR IS HELD BY ITS CORNER (Movie, 26 Oct, the one snap rule:
// "whole-thing drags grab the nearest own corner within reach", cyan before
// the press): a press within a node's reach of one of a selected flight's
// four corners takes that corner exactly, and brought within reach of a
// node it lands on it exactly. Ctrl held, it goes where the hand goes.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3;
// A 10 ft flight, 3 ft wide, running east from (-2, -4): corners at x -2 and
// 8, z -5.5 and -2.5. A line out east whose end, a node, stands at (12, -5.5).
const base = () => ({
  version: 1, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], roofs: [], fenestrations: [], dimensions: [], floors: [],
  outlines: [], shapes: [], notes: [], roomTags: [], columns: [], beams: [],
  boneyardOutlines: [], boneyardShelves: [], groups: [], levelLocks: [], underlays: [], surfaceOpenings: [],
  lines: [{ id: 'l1', levelId: MAIN_FL, view: 'plan', start: { x: 12, y: 0, z: -5.5 }, end: { x: 20, y: 0, z: -5.5 } }],
  stairs: [{ id: 7401, levelId: MAIN_FL, view: 'plan', layer: 'A-STR', start: { x: -2, z: -4 }, end: { x: 8, z: -4 },
    widthFt: 3, riseFt: 9, rail: 'left', shape: 'straight', turn: 'right', winders: 0, auto: true }],
});

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: base() });
  await page.goto(`/MODEL.html?level=${MAIN_FL}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  // Framed on the flight and the line, 30 px a foot.
  await page.evaluate(() => { view.cx = 8; view.cz = -4; view.scale = 30; paint(); });
  await page.waitForTimeout(150);
  const frame = await h.planFrame(page);
  // Picked by a press inside the flight.
  await page.mouse.click(...frame.at(0, -4));
  await page.waitForTimeout(120);
  return frame;
}
const saved = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return (await h.savedDrawing(page)).stairs[0];
};
const attr = async (page, name) => JSON.parse(await page.locator('#plan').getAttribute(name) || 'null');
const r3 = n => Math.round(n * 1000) / 1000 + 0;

test('a selected flight\'s corner rings cyan under the hand before the press', async ({ page }) => {
  const { at } = await open(page);
  const [cx, cy] = at(8, -5.5);
  await page.mouse.move(cx + 1, cy + 1);
  await page.waitForTimeout(150);
  expect(await attr(page, 'data-move-grab'), 'the corner a press would take').toEqual([8, -5.5]);
});

test('held by its corner, brought within reach of a node, it lands on it exactly', async ({ page }) => {
  const { at } = await open(page);
  const [cx, cy] = at(8, -5.5);
  await page.mouse.move(cx + 1, cy + 1);
  await page.mouse.down();
  // The hand to an inch short of the line's end, and a hair off its row.
  await page.mouse.move(...at(12 - 1 / 12, -5.5 + 0.5 / 12), { steps: 8 });
  await page.waitForTimeout(100);
  const lit = await attr(page, 'data-snap-magnet');
  expect(lit?.kind, 'a node holds it').toBe('node');
  expect(lit.at).toEqual([12, -5.5]);
  await page.mouse.up();
  await page.waitForTimeout(150);
  const s = await saved(page);
  expect([r3(s.start.x), r3(s.start.z), r3(s.end.x), r3(s.end.z)], 'four feet east, exactly').toEqual([2, -4, 12, -4]);
});

test('Ctrl held: nothing catches, the flight goes by the hand\'s travel', async ({ page }) => {
  const { at } = await open(page);
  const [cx, cy] = at(8, -5.5);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.keyboard.down('Control');
  await page.mouse.move(...at(12 - 1 / 12, -5.5), { steps: 8 });
  await page.waitForTimeout(100);
  expect(await attr(page, 'data-snap-magnet'), 'nothing lit').toBeNull();
  await page.mouse.up();
  await page.keyboard.up('Control');
  const s = await saved(page);
  expect(s.end.x, 'an inch short of the node').toBeLessThan(11.97);
});
