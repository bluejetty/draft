// THE PREMADE BILEVEL, built off the drive-thru (premade bilevel PR 2).
//
// Movie, 2 Oct: a premade BILEVEL "so they don't have to draw the outlines",
// "a entry floor sitting on the foundation wall", heights from "the 'PROJECT'
// information for bilevel", entered "from front door and garage door (if
// attached)", with "2 sets of stairs" off the landing -- UP to MAIN on the
// house-door side, DOWN to the basement on the garage-door side -- and "the
// entry area will need to straddle the garage line so both doors work".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const empty = () => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

async function buildBilevel(page, entry) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.openDriveThru(page);
  await page.locator('#dt-tiles [data-build-family="bilevel"]').click();
  await page.locator(`#dt-tiles [data-build-entry="${entry}"]`).click();
  await page.locator('#dt-bone').click();
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const d = await h.savedDrawing(page);
  return d;
}

const span = pts => ({
  x0: Math.min(...pts.map(p => p.x)), x1: Math.max(...pts.map(p => p.x)),
  z0: Math.min(...pts.map(p => p.z)), z1: Math.max(...pts.map(p => p.z)),
});

test('BILEVEL + GARAGE: an ENTRY level, the entry cut out of the house, and both doors into the landing',
  async ({ page }) => {
    const d = await buildBilevel(page, 'bilevel-garage');
    expect(d.buildType).toBe('bilevel');
    expect(d.levels.map(l => Number(l.id)), 'ENTRY added between MAIN FL and FOUNDATION')
      .toEqual([8, 7, 5, 3, 2, 1]);
    const house = d.outlines.find(o => Number(o.levelId) === 3 && !o.garage);
    const entry = d.outlines.find(o => Number(o.levelId) === 2);
    const garage = d.outlines.find(o => o.garage);
    expect(house.points.length, 'the house outline is notched').toBe(8);
    const e = span(entry.points), g = span(garage.points);
    expect([e.x1 - e.x0, e.z1 - e.z0], '12 wide, 6 deep').toEqual([12, 6]);
    expect(e.x0 < g.x0 && g.x0 < e.x1, 'straddling the garage line').toBe(true);
    // The entry's walls: its front only, tall to MAIN FL's ceiling.
    const entryWalls = d.walls.filter(w => Number(w.levelId) === 2 && w.topHeight > 10);
    expect(entryWalls.length).toBe(1);
    // And the wood fill all round the rest of the house, sill to MAIN's
    // bearing line: 4'-2 3/4" less the entry's 10" package.
    const fill = d.walls.filter(w => Number(w.levelId) === 2 && w.topHeight < 10);
    expect(fill.length, 'every house edge but the three the entry shares').toBe(5);
    fill.forEach(w => expect(w.topHeight).toBeCloseTo(3.3958, 3));
    expect(entryWalls[0].topHeight, '13\'-6 1/2" from the landing to MAIN\'s ceiling')
      .toBeCloseTo(13.5417, 2);
    const doors = d.fenestrations.filter(f => f.type === 'door' && f.wallId === entryWalls[0].id);
    expect(doors.length, 'the front door and the door in from the garage').toBe(2);
    // The notch carries no wall on MAIN FL -- the wall between is held.
    const onNotch = d.walls.filter(w => Number(w.levelId) === 3
      && [w.start, w.end].every(p => p.x >= e.x0 - 0.01 && p.x <= e.x1 + 0.01
        && p.z >= e.z0 - 0.01 && p.z <= e.z1 + 0.01));
    expect(onNotch.length).toBe(0);
    // Decks: MAIN is the notched house, ENTRY is the landing.
    expect(d.floors.some(f => Number(f.levelId) === 2 && f.points.length === 4)).toBe(true);
    expect(d.floors.some(f => Number(f.levelId) === 3 && f.points.length === 8)).toBe(true);
    // A 5'-0" pour with the sill on top.
    const fdn = d.walls.filter(w => Number(w.levelId) === 1 && w.view === 'foundation' && w.body !== 'garage');
    expect(fdn.length).toBeGreaterThan(0);
    fdn.forEach(w => expect(w.topHeight).toBeCloseTo(5.125, 3));
  });

test('the two flights leave the landing: UP to MAIN on the front-door side, DOWN on the garage side',
  async ({ page }) => {
    const d = await buildBilevel(page, 'bilevel-garage');
    const up = d.stairs.find(s => Number(s.levelId) === 3);
    const down = d.stairs.find(s => Number(s.levelId) === 2);
    expect(up && down, 'one flight on each level').toBeTruthy();
    expect(up.start.x).toBeLessThan(down.start.x);
    // Rises from PROJECT's numbers: 4'-5 3/8" up, 5'-8 1/2" down.
    expect(up.riseFt).toBeCloseTo(4.4479, 2);
    expect(down.riseFt).toBeCloseTo(5.7083, 2);
    // UP lands on the landing's back edge; DOWN starts there.
    expect(up.end.z).toBeCloseTo(14, 3);
    expect(down.start.z).toBeCloseTo(14, 3);
    expect(up.start.z).toBeLessThan(14);
    expect(down.end.z).toBeLessThan(14);
    // MAIN FL is open over both.
    const holes = d.surfaceOpenings.filter(o => Number(o.levelId) === 3);
    expect(holes.map(o => o.stairId).sort()).toEqual([up.id, down.id].sort());
  });

test('a plain BILEVEL: the same entry, the front door alone', async ({ page }) => {
  const d = await buildBilevel(page, 'bilevel');
  expect(d.outlines.some(o => o.garage)).toBe(false);
  const entryWall = d.walls.find(w => Number(w.levelId) === 2 && w.topHeight > 10);
  expect(d.fenestrations.filter(f => f.wallId === entryWall.id).length).toBe(1);
  expect(d.stairs.length).toBe(2);
});

test('one Ctrl+Z takes the whole bilevel back, ENTRY level and all', async ({ page }) => {
  await buildBilevel(page, 'bilevel-garage');
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const d = await h.savedDrawing(page);
  expect(d.walls.length).toBe(0);
  expect(d.stairs.length).toBe(0);
  expect(d.levels.map(l => Number(l.id))).toEqual([8, 7, 5, 3, 1]);
});
