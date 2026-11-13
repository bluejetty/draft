// THE AUTOHOUSE OFF AN OUTLINE THE DRAFTER DREW HIS OWN WAY (jb, 13 Nov
// 2026): "after the user selects the type of AUTOHOUSE to build, can you
// allow him to ESC. out of the AUTOHOUSE / DRIVETHRU menu ... and then allow
// him to either change the project info to his req. or use the TURTLE or the
// manual OUTLINE to build his house outline, and then produce the autohouse
// at that point. how i try now i do the turtle house but it only shows a
// dark area and then asks me to draw the house outline still".
//
// Before this, only a loop closed with the OUTLINE tool was the traced house
// (model/10 commitOutline); a TURTLE HOUSE walk put its master on the shelf
// and the bone's BUILD found nothing to build on. ESC shut the board but
// left the OUTLINE tool armed from the tile press. And the pressed tile was
// page state, so a trip to PROJECT forgot it.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const empty = (extra = {}) => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
  ...extra,
});
// A house at 9'-1 1/8" so the garage tops out level with it (as
// model-traced-build.spec.js's matchedTops): one roof over both.
const matchedTops = () => empty({ levelAssemblies: { 3: { wallHeightFt: 109.125 / 12 } } });

async function open(page, f = empty()) {
  await h.openModel(page, { webgl: false, garageAlign: 'yes' });
  await page.evaluate(async ({ bucket, f }) => {
    localStorage.removeItem('draft.turtle');
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
const strip = page => page.locator('#strip-message');
const tool = page => page.evaluate(() => activeTool);
const dirAt = (page, i) => page.locator(`[data-turtle-row="${i}"] [data-turtle-dir]`);
const distAt = (page, i) => page.locator(`[data-turtle-row="${i}"] [data-turtle-dist]`);
const act = (page, what) => page.locator(`[data-turtle-do="${what}"]`);
const kind = (page, k) => page.locator(`[data-turtle-kind="${k}"]`);
async function openTurtle(page) {
  const tab = page.locator('#notes-tab');
  if (await tab.getAttribute('aria-expanded') !== 'true') await tab.click();
  await page.locator('[data-pad-tab="turtle"]').click();
  await expect(page.locator('[data-turtle]')).toBeVisible();
}
async function typeRows(page, rows) {
  for (let i = 0; i < rows.length; i += 1) {
    await dirAt(page, i).fill(rows[i][0]);
    await distAt(page, i).fill(rows[i][1]);
  }
}
// THE WALKS. North is -z, so the house's front (planFromTrace reads +z as
// the front) is the edge along z = 0, and the garage hangs off it to the
// south, starting ON the house's west front corner -- the gold target.
const HOUSE_WALK = [['E', '40'], ['N', '30'], ['W', '40'], ['S', '30']];
const GARAGE_WALK = [['S', '16'], ['E', '14'], ['N', '16'], ['W', '14']];
async function turtleHouse(page, rows, { atPoint = null } = {}) {
  await openTurtle(page);
  // A fresh page of the pad per walk, so the rows are this walk's.
  await typeRows(page, rows);
  await kind(page, 'house').click();
  if (atPoint) {
    await act(page, 'point').click();
    const { at } = await h.planFrame(page);
    await page.mouse.click(...at(atPoint[0] + 0.3, atPoint[1] + 0.3));
  } else {
    await act(page, 'target').click();
  }
}
async function nextPadPage(page, n) {
  await page.locator(`[data-notes-page="${n}"]`).click();
  await expect(page.locator('[data-turtle-row]')).toHaveCount(1);
}
async function pickType(page, family, entry) {
  // WITH A TYPE ALREADY PICKED the bone's press is the second press, which
  // asks BUILD / CHANGE; CHANGE is the way back to the board.
  if (await page.evaluate(() => !!window.ModelBuild.chosen())) {
    await page.locator('#bone').click();
    await page.locator('[data-build-choice-change]').click();
    await expect(page.locator('#build-families button').first()).toBeVisible();
  } else {
    await h.openDriveThru(page);
  }
  // THE FAMILY PRESS TOGGLES: a submenu the board came back open on stays.
  const tile = page.locator(`[data-build-entry="${entry}"]`);
  if (!(await tile.isVisible())) await page.locator(`[data-build-family="${family}"]`).click();
  await tile.click();
}
async function escapeBoard(page) {
  await page.keyboard.press('Escape');
  await expect(page.locator('#drivethru')).toHaveAttribute('data-shut', '');
  await expect(page.locator('#drivethru')).toBeHidden();
}
// THE WALK BUILT ON ITS CLOSE (jb, 13 Nov: "when i draw as a 'house' it
// should be like the autohouse using the project info"): nothing to press,
// only save and read the file back.
async function builtOnClose(page) {
  await page.waitForTimeout(600);
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
async function boneBuild(page) {
  await page.locator('#bone').click();
  await page.locator('[data-build-choice-build]').click();
  await page.waitForTimeout(500);
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const built = d => ({
  main: d.walls.filter(w => Number(w.levelId) === 3).length,
  concrete: d.walls.filter(w => Number(w.levelId) === 1).length,
  floors: d.floors.length, roofs: d.roofs.length,
  garages: d.outlines.filter(o => Number(o.levelId) === 3 && o.garage).length,
  houses: d.outlines.filter(o => Number(o.levelId) === 3 && !o.garage).length,
  windows: d.fenestrations.filter(f => f.type === 'window').length,
  overheadDoors: d.fenestrations.filter(f => f.type === 'door' && f.garage).length,
  shelf: d.boneyardOutlines.length,
});

test('ESC off the board with a type picked puts the OUTLINE tool down and says what the choice is; the type stays picked', async ({ page }) => {
  await open(page);
  await pickType(page, 'bungalow', 'bungalow');
  // THE TILE PRESS ARMED THE TRACE, as it always has.
  expect(await tool(page)).toBe('outline');
  await escapeBoard(page);
  expect(await tool(page), 'the tool is out of his hand').toBe('select');
  await expect(strip(page)).toContainText('ONE 1 STOREY picked. Draw its outline with OUTLINE (U) or TURTLE');
  await expect(page.locator('#bone'), 'the bone still asks for the press').toHaveAttribute('data-ready', '');
  expect(await page.evaluate(() => window.ModelBuild.chosen()?.entry?.id)).toBe('bungalow');
  // AND THE FILE KNOWS WHICH TILE: the type and its garage plan, stamped at
  // the pick, so PROJECT's family row and this page's re-open agree.
  expect(await page.evaluate(() => [drawing.buildType, drawing.garagePlan])).toEqual(['bungalow', 'none']);
  // THE X ON THE BOARD IS THE SAME DOOR.
  await pickType(page, 'bungalow', 'bungalow-garage');
  expect(await tool(page)).toBe('outline');
  await page.locator('#dt-close').click();
  expect(await tool(page)).toBe('select');
  await expect(strip(page)).toContainText('ONE 1 STOREY + GARAGE picked');
  expect(await page.evaluate(() => [drawing.buildType, drawing.garagePlan])).toEqual(['bungalow', 'attached']);
});

test('a TURTLE HOUSE walk after ESC is the traced house, and the whole 1 STOREY goes up on it as the walk closes', async ({ page }) => {
  await open(page);
  await pickType(page, 'bungalow', 'bungalow');
  await escapeBoard(page);
  await turtleHouse(page, HOUSE_WALK);
  // THE TRACE HEARD IT AND BUILT, no bone press (jb, 13 Nov).
  const d = await builtOnClose(page);
  const b = built(d);
  expect(b.main, 'walls round his loop').toBeGreaterThanOrEqual(4);
  expect(b.concrete, 'concrete under it').toBeGreaterThan(0);
  expect(b.floors, 'a floor').toBeGreaterThan(0);
  expect(b.roofs, 'a roof').toBe(1);
  expect(b.windows, 'windows dealt').toBeGreaterThan(0);
  expect(b.shelf, 'the turtle master came off the shelf with the build').toBe(0);
  // ON HIS CORNERS, not the premade square's: the house body is the walk.
  const house = d.outlines.find(o => Number(o.levelId) === 3 && !o.garage);
  const xs = house.points.map(p => p.x), zs = house.points.map(p => p.z);
  expect([Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]).toEqual([0, 40, -30, 0]);
});

test('with a type that hangs a garage on the house, the second TURTLE HOUSE walk is the garage', async ({ page }) => {
  await open(page, matchedTops());
  await pickType(page, 'bungalow', 'bungalow-garage');
  await escapeBoard(page);
  await turtleHouse(page, HOUSE_WALK);
  await expect(strip(page)).toContainText('Now the garage: another TURTLE HOUSE walk, or OUTLINE (U)');
  expect(await tool(page)).toBe('select');
  expect(await page.evaluate(() => drawing.walls.length), 'the house waits for its garage').toBe(0);
  await nextPadPage(page, 2);
  await turtleHouse(page, GARAGE_WALK, { atPoint: [0, 0] });
  // THE GARAGE WALK CLOSES THE ORDER: both go up at once.
  const d = await builtOnClose(page);
  const b = built(d);
  expect(b.houses, 'the house body').toBe(1);
  expect(b.garages, 'the garage body').toBe(1);
  expect(b.roofs, 'one roof over house and garage').toBe(1);
  expect(b.overheadDoors, 'overhead doors on the garage').toBeGreaterThan(0);
  expect(b.shelf).toBe(0);
  const g = d.outlines.find(o => Number(o.levelId) === 3 && o.garage);
  const xs = g.points.map(p => p.x), zs = g.points.map(p => p.z);
  expect([Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]).toEqual([0, 14, 0, 16]);
});

test('the OUTLINE key by hand works the same way: house loop, then the garage loop with U pressed again', async ({ page }) => {
  await open(page, matchedTops());
  await pickType(page, 'bungalow', 'bungalow-garage');
  await escapeBoard(page);
  const { at } = await h.planFrame(page);
  const loop = async corners => {
    for (const [x, z] of [...corners, corners[0]]) await page.mouse.click(...at(x, z));
    await page.waitForTimeout(150);
    if (await page.locator('#garage-lesson').isVisible()) {
      await page.keyboard.press('Enter');
      await expect(page.locator('#garage-lesson')).toBeHidden();
    }
    if (await page.locator('#corner-join').isVisible()) {
      await page.keyboard.press('Enter');
      await expect(page.locator('#corner-join')).toBeHidden();
    }
  };
  await page.keyboard.press('u');
  expect(await tool(page)).toBe('outline');
  await loop([[-10, -8], [10, -8], [10, 8], [-10, 8]]);
  await expect(strip(page)).toContainText('Now draw the garage');
  // THE TOOL PUT DOWN AND PICKED UP AGAIN: setTool's listener forgot that
  // the loop in hand was the garage's; the waiting house says it is.
  await page.keyboard.press('s');
  await page.keyboard.press('u');
  await loop([[-2, 8], [12, 8], [12, 24], [-2, 24]]);
  await expect(strip(page)).toContainText('Press the bone to build your 1 STOREY + GARAGE');
  const d = await boneBuild(page);
  const b = built(d);
  expect(b.garages).toBe(1);
  expect(b.houses).toBe(1);
  expect(b.roofs).toBe(1);
});

test('the pick survives a reload: the file carries the type, and the turtle house goes up on it', async ({ page }) => {
  await open(page);
  await pickType(page, 'bungalow', 'bungalow');
  await escapeBoard(page);
  await page.locator('#save').click();
  await h.waitForSaved(page);
  // A TRIP TO PROJECT AND BACK is a reload of this page off the file.
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  expect(await page.evaluate(() => window.ModelBuild.chosen()?.entry?.id), 'the tile is still pressed').toBe('bungalow');
  await expect(page.locator('#bone')).toHaveAttribute('data-ready', '');
  expect(await tool(page), 'and no tool was armed by the re-open').toBe('select');
  await expect(page.locator('#drivethru'), 'the board does not rise over a drafter coming back').toHaveAttribute('data-shut', '');
  await turtleHouse(page, HOUSE_WALK);
  const b = built(await builtOnClose(page));
  expect(b.main, 'the restored type built on the walk').toBeGreaterThanOrEqual(4);
  expect(b.roofs).toBe(1);
  expect(b.shelf).toBe(0);
});

test('a TURTLE HOUSE drawn with no type on the board raises the board to ask, and the tile pressed builds on it at once', async ({ page }) => {
  await open(page);
  await turtleHouse(page, HOUSE_WALK);
  // THE BOARD RISES WITH THE QUESTION (jb's card choice, 13 Nov: ask rather
  // than build a 1 STOREY nobody named); the press glows two seconds first.
  await expect(page.locator('#drivethru')).not.toHaveAttribute('data-shut', '', { timeout: 6000 });
  await expect(page.locator('#dt-line')).toContainText('WHICH HOUSE IS THIS?');
  await page.locator('[data-build-family="bungalow"]').click();
  await page.locator('[data-build-entry="bungalow"]').click();
  await expect(page.locator('#drivethru'), 'the board came down for the build').toHaveAttribute('data-shut', '');
  const d = await builtOnClose(page);
  const b = built(d);
  expect(b.roofs).toBe(1);
  expect(b.shelf).toBe(0);
  const house = d.outlines.find(o => Number(o.levelId) === 3 && !o.garage);
  const xs = house.points.map(p => p.x);
  expect([Math.min(...xs), Math.max(...xs)]).toEqual([0, 40]);
});
