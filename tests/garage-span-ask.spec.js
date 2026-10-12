// PAST THE OWJ TABLE OVER A GARAGE. Movie, 12 Oct: "if user goes past 31 ...
// have a popup that states: choices 1. REQ ENGINEERED ... Beam / or Joists.
// OR 2. PLACE COLUMNS to support BEAM (which are placed 10ft max from the
// back wall to where the front of the room above is ... place the columns
// centered between 2 doors so the cars won't hit the columns", "the beam
// doesn't need to be steel", "DROPPED ENGINEERED BEAM".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = 36, D = 40;   // a room over the garage 36 ft side wall to side wall
const garageWall = (id, x0, z0, x1, z1) => ({
  id, levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center', body: 'garage',
  baseHeight: 0, topHeight: 8, start: { x: x0, y: 0, z: z0 }, end: { x: x1, y: 0, z: z1 },
});
const loop = (id, levelId, garage) => ({
  id, levelId, garage,
  points: [{ x: 0, y: 0, z: 0 }, { x: W, y: 0, z: 0 }, { x: W, y: 0, z: D }, { x: 0, y: 0, z: D }],
});
const door = (offset, i) => ({
  id: `gd-${i}`, wallId: 'g-front', levelId: 3, view: 'plan', type: 'door', layer: 'A-DOOR',
  offset, width: 8, sillHeight: 0, headHeight: 7, garage: true,
});
const FILE = {
  version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 },
  ],
  activeLevelIdx: 2,
  walls: [garageWall('g-back', 0, 0, W, 0), garageWall('g-right', W, 0, W, D),
    garageWall('g-front', W, D, 0, D), garageWall('g-left', 0, D, 0, 0)],
  // DOORS AT 9 AND 27 FT ACROSS: the front wall runs from x=36 back to 0.
  fenestrations: [door(W - 9, 0), door(W - 27, 1)],
  outlines: [loop('garage-out', 3, true), loop('room-out', 5, false)],
  lines: [], floors: [], roofs: [], dimensions: [], shapes: [], surfaceOpenings: [], stairs: [],
  notes: [], roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
};

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: FILE });
  // ON 2ND FL: AUTO BEAM frames the floor of the level on screen, and the
  // room over the garage is the 2ND FL's.
  await page.goto('/MODEL.html?left=1&right=1&level=5&view=floor');
  await page.waitForTimeout(800);
  await page.locator('[data-board-switch] [data-board="drafting"]').click();
  await h.showLeftPane(page, h.TOOL_PANE.beam || 'build');
  const key = page.locator('[data-tool-key="beam"]');
  if (await key.getAttribute('aria-pressed') !== 'true') await key.click();
}
const autoBeam = page => page.locator('[data-auto-beam]').click();
async function saved(page) {
  await expect(page.locator('#save')).toBeEnabled({ timeout: 4000 });
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
  return page.evaluate(async bucket => JSON.parse(await (await window.SharedFileStore.loadSharedFile(bucket)).text()), BUCKET);
}
const notesOn = (d, levelId, re) => (d.notes || []).filter(n => Number(n.levelId) === levelId && re.test(n.body));

test('past 31 ft it asks; PLACE COLUMNS puts a DROPPED ENGINEERED BEAM between the doors', async ({ page }) => {
  await open(page);
  await autoBeam(page);
  const ask = page.locator('#garage-span');
  await expect(ask).toBeVisible();
  await expect(ask.locator('[data-garage-span-ft]')).toHaveText(`36'-0"`);
  await ask.locator('[data-garage-span-columns]').click();
  await expect(ask).toBeHidden();
  const d = await saved(page);
  const beams = (d.beams || []).filter(b => b.auto && Number(b.levelId) === 3);
  expect(beams.length, 'one beam: 36 ft is two rows of joists').toBe(1);
  expect(beams[0].mode, 'dropped, "better for ducts ... and insulation"').toBe('dropped');
  expect(beams[0].start.x, 'between the doors at 9 and 27 ft').toBeCloseTo(18, 6);
  expect([beams[0].start.z, beams[0].end.z].sort((a, b) => a - b), 'back wall to front of the room').toEqual([0, D]);
  const cols = (d.columns || []).filter(c => c.auto && Number(c.levelId) === 3).map(c => c.point.z).sort((a, b) => a - b);
  expect(cols, '10 ft apart at most, none where the beam bears on a wall').toEqual([10, 20, 30]);
  expect(notesOn(d, 3, /^DROPPED ENGINEERED BEAM$/).length, 'the beam is marked').toBe(1);
  const owj = notesOn(d, 5, /^ENGINEERED OWJ/);
  expect(owj.length).toBe(1);
  expect(owj[0].body, 'the joists now span wall to beam').toMatch(/WALL TO BEAM -- 18'-0" SPAN/);
  expect(notesOn(d, 5, /^REQ ENGINEERED BEAM/).length).toBe(0);

  // ASKED ONCE: the answer is on the drawing, and a re-run gives it again.
  await autoBeam(page);
  await page.waitForTimeout(200);
  await expect(ask).toBeHidden();
  const rerun = await saved(page);
  expect((rerun.beams || []).filter(b => b.auto && b.mode === 'dropped').length, 'still the dropped beam').toBe(1);
  expect(notesOn(rerun, 3, /^DROPPED ENGINEERED BEAM$/).length, 'one tag, not two').toBe(1);
});

test('REQ ENGINEERED BEAM / OR JOISTS keeps the garage clear and says so', async ({ page }) => {
  await open(page);
  await autoBeam(page);
  const ask = page.locator('#garage-span');
  await expect(ask).toBeVisible();
  await ask.locator('[data-garage-span-engineer]').click();
  const d = await saved(page);
  expect((d.beams || []).filter(b => b.auto).length, 'no beam').toBe(0);
  expect((d.columns || []).filter(c => c.auto).length, 'no column in the garage').toBe(0);
  const req = notesOn(d, 5, /^REQ ENGINEERED BEAM \/ OR JOISTS/);
  expect(req.length, 'the note on the room\'s floor layout').toBe(1);
  expect(req[0].body).toMatch(/SIDE WALL TO SIDE WALL -- 36'-0" SPAN/);
  expect(req[0].body, 'no steel').not.toMatch(/STEEL/);
  await autoBeam(page);
  await page.waitForTimeout(200);
  await expect(ask, 'kept: not asked again').toBeHidden();
  expect(notesOn(await saved(page), 5, /^REQ ENGINEERED BEAM/).length, 'one note, not two').toBe(1);
});
