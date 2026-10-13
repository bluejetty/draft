// AUTO DIMS strings the exterior of the active plan on all four sides:
// the closest string dims corner-to-corner through the fenestration centres
// facing each side, the next string dims every footprint jog, and the
// outermost string is the overall. The first string offset is adjustable
// (2'-0" or 3'-0") and every further string steps out 1'-6". Re-running
// replaces the previous auto strings; manual dimensions are left alone.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// House: 16×12 rect (x -8..8, z -6..6).
async function drawHouseOutline(page) {
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.climbTourToMain(page);
}

async function buildHouse(page) {
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(300);
}

async function switchLevel(page, name) {
  await page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: name }) })
    .locator('.level-name').click();
  await page.waitForTimeout(300);
}

async function dragWorld(page, fromX, fromZ, toX, toZ) {
  const from = await h.worldToClient(page, fromX, fromZ);
  const to = await h.worldToClient(page, toX, toZ);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await h.waitForSaved(page);
}

async function runAutoDims(page) {
  await h.selectTool(page, 'Dimension');
  await page.getByRole('button', { name: 'AUTO DIMS' }).click();
  await h.waitForSaved(page);
}

// Groups the active plan's auto strings into the rows they print on, then
// asserts every multi-part row adds up to the single-segment row (the
// overall) that shares its side — reading the LABELS the sheet shows, not
// the segment lengths, because the label is what an examiner adds up.
async function expectStringsSum(page) {
  const saved = await h.savedDrawing(page);
  const auto = saved.dimensions.filter(dimension =>
    dimension.auto && dimension.levelId === 3 && dimension.view === 'plan');
  expect(auto.length).toBeGreaterThan(0);
  const printed = await page.evaluate(dims => dims.map(dimension => {
    const length = Math.hypot(dimension.end.x - dimension.start.x,
      dimension.end.z - dimension.start.z);
    const label = window.DraftFormatters.formatArchitecturalInches(length * 12);
    return { dimension, label, inches: window.DraftFormatters.parseArchitecturalLength(label).inches };
  }), auto.map(dimension => ({ start: dimension.start, end: dimension.end })));
  // A row is one printed string: same fixed coordinate, same orientation.
  const rows = new Map();
  printed.forEach(entry => {
    const { start, end } = entry.dimension;
    const horizontal = Math.abs(start.z - end.z) < 1e-9;
    const key = `${horizontal ? 'h' : 'v'}@${(horizontal ? start.z : start.x).toFixed(4)}`;
    rows.set(key, [...(rows.get(key) || []), entry]);
  });
  const sides = new Map();
  [...rows.entries()].forEach(([key, entries]) => {
    const side = key.split('@')[0] + (entries[0].dimension.start.z + entries[0].dimension.start.x > 0 ? '+' : '-');
    sides.set(side, [...(sides.get(side) || []), entries]);
  });
  // Every multi-part row must be checked against an overall: the side
  // grouping above is only trusted because a mis-bucketed side (no overall
  // found beside its partials) fails this count instead of skipping silently.
  const multiPartRows = [...rows.values()].filter(entries => entries.length > 1).length;
  let checked = 0;
  sides.forEach(stack => {
    const overall = stack.find(entries => entries.length === 1);
    if (!overall) return;
    stack.filter(entries => entries.length > 1).forEach(entries => {
      const sum = entries.reduce((total, entry) => total + entry.inches, 0);
      checked += 1;
      expect(`${entries.map(entry => entry.label).join(' + ')} = ${sum.toFixed(4)}"`)
        .toBe(`${entries.map(entry => entry.label).join(' + ')} = ${overall[0].inches.toFixed(4)}"`);
    });
  });
  expect(checked).toBe(multiPartRows);
  expect(checked).toBeGreaterThan(0);
}

test('AUTO DIMS strings a rectangle: overalls everywhere, openings on the door side', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  await buildHouse(page);
  await h.waitForSaved(page);
  // Door centred on the z=-6 wall.
  await h.selectTool(page, 'Fenestration');
  await h.clickWorld(page, 0, -6);
  await h.waitForSaved(page);

  await runAutoDims(page);
  const saved = await h.savedDrawing(page);
  // BUILD HOUSE lays its own stack on every level; this test watches the
  // active MAIN FL plan the AUTO DIMS button just restrung.
  const auto = saved.dimensions.filter(dimension =>
    dimension.auto && dimension.levelId === 3 && dimension.view === 'plan');
  // Rectangle: 3 plain sides get 1 overall each; the door side gets a
  // 2-piece openings string plus its overall.
  expect(auto).toHaveLength(6);

  // Openings string sits at the first offset (2'-0") off the door side and
  // breaks at the door centre.
  const openingString = auto.filter(dimension =>
    h.near(dimension.start.z, -8) && h.near(dimension.end.z, -8));
  expect(openingString).toHaveLength(2);
  const centreEnds = openingString
    .flatMap(dimension => [dimension.start.x, dimension.end.x])
    .filter(x => Math.abs(x) < 1);
  expect(centreEnds).toHaveLength(2);
  // That side's overall steps out one string spacing further.
  const overall = auto.find(dimension =>
    h.near(dimension.start.z, -9.5) && h.near(dimension.end.z, -9.5));
  expect(overall).toBeTruthy();
  expect(Math.abs(overall.end.x - overall.start.x)).toBeCloseTo(16, 3);
});

test('printed partials add up to the printed overall, on a rectangle and on an L', async ({ page }) => {
  // Audit C1. Every label is formatArchitecturalInches at paint time, which
  // rounds to 1/16" — so partials rounded one by one used to disagree with
  // the separately-rounded overall above them (39.5% of traced strings).
  // The string's coordinates are quantised once at generation now, so the
  // parts add to the whole by construction. This asserts the PRINTED
  // STRINGS, not the segment geometry the other cases here watch.
  await h.openModel(page);
  // Hand-traced corners: deliberately NOT on the 1/16" grid, which is what a
  // finger leaves behind and what the whole finding is about.
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -8.37, -6.21);
  await h.clickWorld(page, 8.11, -6.21);
  await h.clickWorld(page, 8.11, 6.43);
  await h.clickWorld(page, -8.37, 6.43);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.climbTourToMain(page);
  await buildHouse(page);
  await h.waitForSaved(page);
  await h.selectTool(page, 'Fenestration');
  await h.clickWorld(page, -3.2, -6.21);
  await h.waitForSaved(page);
  await h.clickWorld(page, 2.6, -6.21);
  await h.waitForSaved(page);
  await runAutoDims(page);
  await expectStringsSum(page);

  // The same question on an L — a rectangle is the shape that hid this class
  // of bug, so every geometry fix carries a non-rectangular case.
  await h.openModel(page);
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -9.13, -7.29);
  await h.clickWorld(page, 8.41, -7.29);
  await h.clickWorld(page, 8.41, -1.17);
  await h.clickWorld(page, 1.73, -1.17);
  await h.clickWorld(page, 1.73, 7.51);
  await h.clickWorld(page, -9.13, 7.51);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.climbTourToMain(page);
  await buildHouse(page);
  await h.waitForSaved(page);
  await runAutoDims(page);
  await expectStringsSum(page);
});

test('each side strings only its own facing corners: the notch stays off the flat sides', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 0);
  await h.clickWorld(page, 0, 0);
  await h.clickWorld(page, 0, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await runAutoDims(page);
  const saved = await h.savedDrawing(page);
  const auto = saved.dimensions.filter(dimension => dimension.auto);
  // The notch faces south and east, so only those sides get a 2-piece jog
  // string + overall; the flat north and west sides string just the overall.
  expect(auto).toHaveLength(8);
  const north = auto.filter(dimension => dimension.start.z < -6.5);
  expect(north).toHaveLength(1);
  expect(h.near(north[0].start.z, -8)).toBe(true);
  expect(Math.abs(north[0].end.x - north[0].start.x)).toBeCloseTo(16, 3);
  const west = auto.filter(dimension => dimension.start.x < -8.5);
  expect(west).toHaveLength(1);
  const south = auto.filter(dimension => dimension.start.z > 6.5);
  expect(south).toHaveLength(3);
  // The south jog string breaks at the notch corner x=0.
  const southJogs = south.filter(dimension => h.near(dimension.start.z, 8));
  expect(southJogs).toHaveLength(2);
  expect(southJogs.some(dimension =>
    h.near(dimension.start.x, 0) || h.near(dimension.end.x, 0))).toBe(true);
  const east = auto.filter(dimension => dimension.start.x > 8.5);
  expect(east).toHaveLength(3);
});

test('auto strings ride master outline edits, staying outside the moved plan', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  await runAutoDims(page);

  // Slide the whole footprint by dragging every master corner the same 4' east
  // on the BONEYARD — the auto strings must ride along, never left inside.
  await switchLevel(page, 'BONEYARD');
  await h.selectTool(page, 'Select');
  await dragWorld(page, 8, -6, 12, -6);
  await dragWorld(page, 8, 6, 12, 6);
  await dragWorld(page, -8, -6, -4, -6);
  await dragWorld(page, -8, 6, -4, 6);

  const saved = await h.savedDrawing(page);
  const auto = saved.dimensions.filter(dimension => dimension.auto && dimension.levelId === 3);
  expect(auto).toHaveLength(4);
  // Every string end carries its master link and rode the 4' slide.
  auto.forEach(dimension => {
    expect(dimension.start.srcId).toBeTruthy();
    expect(dimension.end.srcId).toBeTruthy();
  });
  // Mouse drops land within a pixel of the target, so compare loosely.
  // N and E strings run reversed (ink outward), so match both ends.
  const east = auto.find(dimension => dimension.start.x > 9 && dimension.end.x > 9);
  expect(east.start.x).toBeCloseTo(14, 0);
  const west = auto.find(dimension => dimension.start.x < -5 && dimension.end.x < -5);
  expect(west.start.x).toBeCloseTo(-6, 0);
  const north = auto.find(dimension => dimension.start.z < -7);
  expect(Math.min(north.start.x, north.end.x)).toBeCloseTo(-4, 0);
  expect(Math.max(north.start.x, north.end.x)).toBeCloseTo(12, 0);

  // The links survive a reload: a further master edit still carries them.
  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await h.waitForModelReady(page);
  await switchLevel(page, 'BONEYARD');
  await h.selectTool(page, 'Select');
  await dragWorld(page, 12, -6, 12, -10);
  const reloaded = await h.savedDrawing(page);
  const northAfter = reloaded.dimensions.filter(dimension =>
    dimension.auto && dimension.levelId === 3)
    .find(dimension => Math.min(dimension.start.z, dimension.end.z) < -11);
  expect(northAfter).toBeTruthy();
  expect(Math.min(northAfter.start.z, northAfter.end.z)).toBeCloseTo(-12, 0);
});

// ONE STACK PER BUILDING, NOT ONE PER FOOTPRINT (Movie, 12 Oct). This test
// used to assert the opposite -- "the garage's own east overall strings
// closest, off its far edge; the house's east strings continue the same stack
// beyond the garage's" -- which is the arrangement he rejected: the overall
// measured the house and stopped at the house's corner, the garage got rows of
// its own further out, and the figure a drafter wants (the WHOLE building,
// corner to corner) was on no row at all.
//
// What the old rule was protecting survives as the cluster test, and is
// tested two tests down: a DETACHED garage does not touch the house, so it
// is still its own building with its own stack against its own edge.
test('an attached garage strings as one building with the house', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  // Attached garage protruding east: open run from (8,-4) out to x=14 and back.
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: /MARK ATTACHED GARAGE/ }).click();
  await page.keyboard.press('Enter'); // the professor's lesson steps aside
  await h.clickWorld(page, 8, -4);
  await h.clickWorld(page, 14, -4);
  await h.clickWorld(page, 14, 4);
  await h.clickWorld(page, 8, 4);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await runAutoDims(page);
  const saved = await h.savedDrawing(page);
  const auto = saved.dimensions.filter(dimension => dimension.auto);
  const vertical = auto.filter(dimension => h.near(dimension.start.x, dimension.end.x, 0.01));
  const horizontal = auto.filter(dimension => h.near(dimension.start.z, dimension.end.z, 0.01));

  // Nothing lands on the garage, or anywhere inside the building: the east
  // corridor is clear from the house wall (x=8) out past the garage's far
  // edge (x=14) to the first offset beyond it.
  expect(vertical.some(dimension => dimension.start.x > 8.01 && dimension.start.x < 15.9)).toBe(false);
  // And the garage's buried west side earns no row inside the plan.
  expect(vertical.some(dimension => Math.abs(dimension.start.x - 6) < 1)).toBe(false);

  // THE OVERALL IS THE BUILDING. East of the garage, 14 + 2 is the first row
  // and the outermost is the overall: the full north-south run, -6 to 6.
  const east = vertical.filter(dimension => dimension.start.x > 14);
  expect(east.length).toBeGreaterThan(0);
  expect(Math.min(...east.map(dimension => dimension.start.x))).toBeCloseTo(16, 1);
  const eastOuter = east.reduce((far, dimension) =>
    dimension.start.x > far.start.x ? dimension : far);
  expect(Math.abs(eastOuter.end.z - eastOuter.start.z)).toBeCloseTo(12, 1);

  // THE NORTH ROWS READ RIGHT ACROSS BOTH. The overall spans the house's west
  // wall to the garage's east: -8 out to 14, twenty-two feet.
  const north = horizontal.filter(dimension => dimension.start.z < -6.5);
  expect(north.length).toBeGreaterThan(0);
  const northOuter = north.reduce((far, dimension) =>
    dimension.start.z < far.start.z ? dimension : far);
  expect(Math.abs(northOuter.end.x - northOuter.start.x)).toBeCloseTo(22, 1);
  expect(Math.min(northOuter.start.x, northOuter.end.x)).toBeCloseTo(-8, 1);
  expect(Math.max(northOuter.start.x, northOuter.end.x)).toBeCloseTo(14, 1);

  // AND THE ROW INSIDE IT BREAKS WHERE THE GARAGE STEPS OUT, so the house
  // front and the garage front each print their own figure on one line --
  // the "add the extra part" he asked for.
  const northStep = north.filter(dimension => dimension.start.z > northOuter.start.z - 0.01
    && dimension.start.z < -6.5);
  expect(northStep.length).toBeGreaterThan(1);
  const breaks = northStep.flatMap(dimension => [dimension.start.x, dimension.end.x]);
  expect(breaks.some(x => h.near(x, 8, 0.2))).toBe(true);

  // The garage no longer gets a north row of its own off its own edge: that
  // face is part of the building's north side now.
  expect(horizontal.some(dimension => h.near(dimension.start.z, -6, 0.9)
    && Math.min(dimension.start.x, dimension.end.x) > 7)).toBe(false);
});

// THE HALF OF THE OLD PER-FOOTPRINT RULE THAT SURVIVES. "Every group's dims
// hug that group's own edge instead of the combined extents" was replaced for
// an ATTACHED garage on 12 Oct, and is still exactly right for a DETACHED
// one: it is a second building, its dims are its own, and an overall reaching
// across the yard to it would measure a distance nobody builds to.
//
// Until now nothing tested this. The attached test above was the only thing
// standing between the clustering and a change that merged every footprint on
// the level, and it could not see the difference -- so the surviving half of
// the ruling got a test of its own rather than a sentence claiming one.
test('a detached garage stays its own building', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  // Well clear of the house (x -8..8): its own loop out at x -30..-20.
  await page.locator('[data-mark-detached-garage]').click();
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -30, -6);
  await h.clickWorld(page, -20, -6);
  await h.clickWorld(page, -20, 2);
  await h.clickWorld(page, -30, 2);
  await page.keyboard.press('Enter');
  const foundation = page.locator('[data-detached-grade-beam]');
  if (await foundation.count()) await foundation.click();
  await h.waitForSaved(page);

  await runAutoDims(page);
  const saved = await h.savedDrawing(page);
  const auto = saved.dimensions.filter(dimension => dimension.auto);
  const horizontal = auto.filter(dimension => h.near(dimension.start.z, dimension.end.z, 0.01));
  const vertical = auto.filter(dimension => h.near(dimension.start.x, dimension.end.x, 0.01));

  // NO ROW REACHES ACROSS THE GAP. The two footprints span 38 ft end to end
  // and nothing on the sheet says 38.
  const spans = horizontal.map(dimension => Math.abs(dimension.end.x - dimension.start.x));
  expect(spans.some(span => span > 20)).toBe(false);

  // The house still strings its own 16 ft, off its own north wall.
  const houseNorth = horizontal.filter(dimension => h.near(dimension.start.z, -8, 0.2)
    && Math.max(dimension.start.x, dimension.end.x) > 0);
  expect(houseNorth.length).toBeGreaterThan(0);
  expect(Math.abs(houseNorth[0].end.x - houseNorth[0].start.x)).toBeCloseTo(16, 1);

  // And the garage strings its own, hugging its own west edge at -30 - 2,
  // measuring its own 8 ft of depth rather than the house's 12.
  const garageWest = vertical.filter(dimension => h.near(dimension.start.x, -32, 0.2));
  expect(garageWest.length).toBeGreaterThan(0);
  expect(Math.abs(garageWest[0].end.z - garageWest[0].start.z)).toBeCloseTo(8, 1);
});

test('an inch-scale jog strings straight: merged into the neighbouring corner', async ({ page }) => {
  await h.openModel(page);
  // T off for the deliberately off-square corner: north-east dips 0'-1¼" low.
  await h.selectTool(page, 'Outline');
  await page.keyboard.press('t');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6.1);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await runAutoDims(page);
  const saved = await h.savedDrawing(page);
  const auto = saved.dimensions.filter(dimension => dimension.auto);
  // The 0.1' jog merges away: one overall per side, no tiny jog strings.
  expect(auto).toHaveLength(4);
  const north = auto.find(dimension => dimension.start.z < -7);
  expect(Math.abs(north.end.x - north.start.x)).toBeCloseTo(16, 1);
  // The first string still clears the LOWEST part of the skewed wall by 2'-0".
  expect(north.start.z).toBeLessThanOrEqual(-6.1 - 2 + 0.05);
});

// AUDIT M7, AND THE FIXTURE HAS TO BE SEEDED RATHER THAN CLICKED.
//
// This test used to draw the pair with the Outline tool: a slot in the south
// face whose sides are 1 7/16" apart, x = 2.88 and x = 3. It never got one.
// The second click lands inside the VERTEX SNAP of the first, so the page
// snapped the two onto one point and saved a zero-width spike --
// [[-8,-6],[8,-6],[8,6],[3,6],[3,3],[3,6],[-8,6]], seven points, no pair. The
// mean this test exists to look for was never on the drawing to be found, and
// the assertion passed against a fixture that could not fail it. Any pair
// close enough to MERGE (JOG_MERGE_FT, 2") is close enough to SNAP, so no
// click sequence reaches this.
//
// So the geometry goes in through the store and the page is reloaded on it,
// which is the only way to put a legal-but-unclickable drawing in front of
// AUTO DIMS. The pure-module half of the rule is pinned exactly in
// proto/dim-layers-harness.js; this is the page actually printing it.
test('a merged jog dimensions to a real wall face, never to the average of two', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.climbTourToMain(page);

  // The notch, written in: 2.88 and 3 are 1 7/16" apart and merge.
  const NOTCHED = [[-8, -6], [8, -6], [8, 6], [3, 6], [3, 3], [2.88, 3], [2.88, 6], [-8, 6]];
  await page.evaluate(async ({ bucket, pts }) => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const drawing = JSON.parse(await file.text());
    const outline = drawing.outlines.find(item => item.levelId === 3 && !item.garage);
    outline.points = pts.map(([x, z]) => ({ ...outline.points[0], x, z }));
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(drawing)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: h.STORAGE_BUCKET, pts: NOTCHED });
  await page.reload();
  await h.waitForModelReady(page);

  await runAutoDims(page);
  const saved = await h.savedDrawing(page);
  const outline = saved.outlines.find(item => item.levelId === 3 && !item.garage);
  // THE SEED SURVIVED. Without this the checks below would read a drawing the
  // reload could have normalised back to four corners and report a pass for a
  // notch that is not there -- the exact failure this test was in.
  expect(outline.points.length).toBe(NOTCHED.length);
  const realXs = [...new Set(outline.points.map(point => point.x))];
  expect(realXs.some(x => Math.abs(x - 2.88) < 0.001)).toBe(true);

  const auto = saved.dimensions.filter(dimension =>
    dimension.auto && dimension.levelId === 3 && dimension.view === 'plan');
  const printedXs = [...new Set(auto
    .filter(dimension => Math.abs(dimension.start.z - dimension.end.z) < 1e-6)
    .flatMap(dimension => [dimension.start.x, dimension.end.x]))];
  expect(printedXs.length).toBeGreaterThan(2);
  // Every strung coordinate is a wall face that exists, and the mean of the
  // near-coincident pair — where no wall stands — is not among them.
  printedXs.forEach(x => {
    const onRealFace = realXs.some(real => Math.abs(real - x) <= 0.01);
    expect(`x=${x.toFixed(4)} on a real face: ${onRealFace}`).toBe(`x=${x.toFixed(4)} on a real face: true`);
  });
  expect(printedXs.some(x => Math.abs(x - (2.88 + 3) / 2) < 0.01)).toBe(false);
  // And the merge still MERGES: the 1 7/16" pair strings as ONE coordinate,
  // and it is one of the two — not a pile of inch-scale jog strings.
  expect(printedXs.filter(x => Math.abs(x - 2.88) < 0.05 || Math.abs(x - 3) < 0.05)).toHaveLength(1);
});

test('N and E strings run reversed so the drawn line lands outward', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  await runAutoDims(page);
  const saved = await h.savedDrawing(page);
  const auto = saved.dimensions.filter(dimension => dimension.auto && dimension.levelId === 3);
  expect(auto).toHaveLength(4);
  // The rendered dim line sits to the right of start→end, so top and right
  // strings must run east→west / south→north to keep their ink off the plan.
  const north = auto.find(dimension => h.near(dimension.start.z, -8));
  expect(north.start.x).toBeGreaterThan(north.end.x);
  const east = auto.find(dimension => h.near(dimension.start.x, 10));
  expect(east.start.z).toBeGreaterThan(east.end.z);
  // Bottom and left keep the ascending run — their ink already faces out.
  const south = auto.find(dimension => h.near(dimension.start.z, 8));
  expect(south.start.x).toBeLessThan(south.end.x);
  const west = auto.find(dimension => h.near(dimension.start.x, -10));
  expect(west.start.z).toBeLessThan(west.end.z);
});

test('re-running replaces auto strings, keeps manual dims, honours the 3\'-0" offset', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  // One manual dimension inside the plan.
  await h.selectTool(page, 'Dimension');
  await h.clickWorld(page, -4, 0);
  await h.clickWorld(page, 4, 0);
  await h.waitForSaved(page);

  await runAutoDims(page);
  let saved = await h.savedDrawing(page);
  expect(saved.dimensions.filter(dimension => dimension.auto)).toHaveLength(4);
  expect(saved.dimensions.filter(dimension => !dimension.auto)).toHaveLength(1);

  // Switch the first offset to 3'-0" and re-run: same count, strings move out.
  await page.getByRole('button', { name: '3\'-0"' }).click();
  await runAutoDims(page);
  saved = await h.savedDrawing(page);
  const auto = saved.dimensions.filter(dimension => dimension.auto);
  expect(auto).toHaveLength(4);
  expect(saved.dimensions.filter(dimension => !dimension.auto)).toHaveLength(1);
  const west = auto.find(dimension => dimension.start.x < -8.5);
  expect(west.start.x).toBeCloseTo(-11, 3);
});
