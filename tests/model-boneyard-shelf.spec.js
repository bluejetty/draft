// THE BONEYARD — the owner set, before any of the shelf UI exists.
//
// Work order: BONEYARD-WORKORDER, "A shelf is already a level with a negative
// id... So parking a wall on a shelf needs no format change at all. Measure
// this claim first -- it is the whole basis of the estimate -- and if the
// loader in fact drops negative-level walls, stop and say so."
//
// MEASURED, AND IT IS HALF TRUE. drawing-format.js is sign-agnostic:
//
//   const levelId = (value, levelIds) =>
//     levelIds.has(Number(value)) ? Number(value) : null;
//
// so everything depends on the set the CALLER builds, and the two pages build
// it differently:
//
//   MODEL.dc.html  new Set([...levelIds, ...boneyardShelves.map(s => -s.id)])
//   MODEL.html     new Set(levels.map(l => Number(l.id)))     <- levels only
//
// So on this page a wall parked at levelId -1 is dropped on load. Not a format
// change and not a blocker -- one line -- but a PRECONDITION, and this check
// is the first commit of that order because the failure it guards is the
// worst this format has: park a wall on a shelf, save, reload, gone. No error,
// no warning. Anything built on the shelf before this passes is thrown away on
// the first reload, and this page has been bitten that exact way twice.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });

const parked = () => ({
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  boneyardShelves: [{ id: 1, name: 'SHELF 1' }],
  walls: [
    // On the plan, so the fixture has a control as well as a subject.
    { id: 'on-plan', start: V(-10, -10), end: V(10, -10), levelId: 3,
      view: 'plan', wallType: 'stud_2x6', baseHeight: 0, topHeight: 8,
      refLine: 'left' },
    // PARKED ON SHELF 1. levelId -1 is the shelf's owner id: -shelfId.
    { id: 'parked', start: V(-4, 4), end: V(4, 4), levelId: -1,
      view: 'plan', wallType: 'stud_2x6', baseHeight: 0, topHeight: 8,
      refLine: 'left' },
  ],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves2: [],
  groups: [], levelLocks: [], underlays: [],
});

async function open(page, file) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

const totals = page => page.evaluate(() => {
  const r = document.getElementById('readout');
  const m = /walls\s+(\d+)\s*\/\s*(\d+)/.exec((r ? r.textContent : '').replace(/\s+/g, ' '));
  return m ? { shown: Number(m[1]), total: Number(m[2]) } : null;
});

const savedWallIds = page => page.evaluate(async bucket => {
  const f = await window.SharedFileStore.loadSharedFile(bucket);
  return (JSON.parse(await f.text()).walls || []).map(w => String(w.id)).sort();
}, BUCKET);

test('a wall parked on a shelf is LOADED, not dropped', async ({ page }) => {
  await open(page, parked());
  const t = await totals(page);
  expect(t, 'the readout reports a wall total').toBeTruthy();
  // THE PAGE MUST HOLD IT, not merely carry it through. MODEL.html puts items
  // the format REFUSED back on the way out (withRefused), so a shelf wall can
  // round-trip in the file while never being readable as a wall -- present,
  // and useless. The readout counts drawing.walls, which refused items never
  // reach, so this separates the two.
  expect(t.total, 'both walls are in the drawing — the parked one was not dropped')
    .toBe(2);
  // And it is NOT on the plan: a shelf is a different workspace.
  expect(t.shown, 'only the plan wall draws on the level').toBe(1);
});

test('a wall parked on a shelf survives save and reload', async ({ page }) => {
  await open(page, parked());
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
  expect(await savedWallIds(page), 'both walls are in the saved file')
    .toEqual(['on-plan', 'parked']);

  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  const t = await totals(page);
  expect(t.total, 'and both are still there after the reload').toBe(2);
});
