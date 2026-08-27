// A DETACHED garage is a CLOSED garage loop: MARK GARAGE, then close the run
// back on its first point — no house welding. A foundation prompt picks the
// construction: GRADE BEAM (full perimeter beam; 4" slab sloping 1/8"/ft to
// the door on graded fill) or THICKENED-EDGE SLAB (one LEVEL monolithic pour:
// 4" field, 1'-0" edge, 45° taper, on gravel). BUILD HOUSE raises four stud
// walls, the chosen foundation, overhead + man doors, and its own all-eave
// roof that never splices into the house.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function drawHouseOutline(page) {
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

// A 12×10 garage clear of the house, closed by re-clicking its first
// corner; the foundation prompt then lands the master. The 12' front takes
// the 9' narrow overhead door; a 10' side takes the man door.
async function drawDetachedGarage(page, foundation) {
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: /DETACHED GARAGE/ }).click();
  await h.clickWorld(page, 14, -5);
  await h.clickWorld(page, 26, -5);
  await h.clickWorld(page, 26, 5);
  await h.clickWorld(page, 14, 5);
  await h.clickWorld(page, 14, -5);
  await expect(page.locator('[data-detached-foundation-prompt]')).toBeVisible();
  await page.locator(foundation === 'thickened'
    ? '[data-detached-thickened-edge]' : '[data-detached-grade-beam]').click();
  await h.waitForSaved(page);
}

async function buildHouse(page) {
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(300);
  await h.waitForSaved(page);
}

test('closing a garage loop prompts for the foundation and stores a detached master', async ({ page }) => {
  await h.openModel(page);
  await drawDetachedGarage(page, 'gradebeam');

  const saved = await h.savedDrawing(page);
  expect(saved.boneyardOutlines).toHaveLength(1);
  const master = saved.boneyardOutlines[0];
  expect(master.garage).toBe(true);
  expect(master.open).toBeFalsy();
  expect(master.detached).toBe(true);
  expect(master.foundation).toBe('gradebeam');
  expect(master.points).toHaveLength(4);

  // Every level carries a copy tagged with the same construction.
  const copies = saved.outlines.filter(outline => outline.garage);
  expect(copies).toHaveLength(saved.levels.length);
  copies.forEach(copy => {
    expect(copy.detached).toBe(true);
    expect(copy.foundation).toBe('gradebeam');
  });
});

test('a detached loop touching the house stays detached — no welding, no guessing', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);

  // Corners land right on the house's x=8 edge; DETACHED mode still keeps
  // the loop independent instead of treating it as an attached run.
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: /DETACHED GARAGE/ }).click();
  await h.clickWorld(page, 8, -4);
  await h.clickWorld(page, 20, -4);
  await h.clickWorld(page, 20, 4);
  await h.clickWorld(page, 8, 4);
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-detached-foundation-prompt]')).toBeVisible();
  await page.locator('[data-detached-grade-beam]').click();
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  const garageMaster = saved.boneyardOutlines.find(outline => outline.garage);
  expect(garageMaster.detached).toBe(true);
  expect(garageMaster.open).toBeFalsy();
  expect(garageMaster.points).toHaveLength(4);
  garageMaster.points.forEach(point => expect(point.attach).toBeFalsy());
  // The house master keeps its own four corners — nothing was inserted.
  const houseMaster = saved.boneyardOutlines.find(outline => !outline.garage);
  expect(houseMaster.points).toHaveLength(4);
});

test('the thickened-edge choice lands on the master and its copies', async ({ page }) => {
  await h.openModel(page);
  await drawDetachedGarage(page, 'thickened');

  const saved = await h.savedDrawing(page);
  expect(saved.boneyardOutlines[0].foundation).toBe('thickened');
  saved.outlines.filter(outline => outline.garage)
    .forEach(copy => expect(copy.foundation).toBe('thickened'));
});

test('BUILD HOUSE grade beam: full perimeter beam, sloped 4" slab, walls, doors, own roof', async ({ page }) => {
  await h.openModel(page);
  await drawDetachedGarage(page, 'gradebeam');
  await buildHouse(page);

  const saved = await h.savedDrawing(page);

  // Grade beam all the way around the closed loop — no leg is skipped.
  const fdnWalls = saved.walls.filter(wall => wall.levelId === 1);
  expect(fdnWalls).toHaveLength(4);
  fdnWalls.forEach(wall => expect(wall.wallType).toBe('concrete_8'));

  // The detached beam hangs off GRADE, not the house: its top sits 8" above
  // the drawn grade (foundation top − 1'), i.e. 4" below the foundation top,
  // and it drops with the grade if the grade drops.
  const wallHeightFt = (8 * 12 + 1 + 1 / 8) / 12;
  fdnWalls.forEach(wall => {
    expect(wall.topHeight).toBeCloseTo(wallHeightFt - 1 + 8 / 12, 3);
    expect(wall.baseHeight).toBe(0);
  });

  // Uniform 4" slab sloping 1/8"/ft to the door — the fill carries the fall.
  const slab = saved.floors.find(floor => floor.garage);
  expect(slab).toBeTruthy();
  expect(slab.thickness * 12).toBeCloseTo(4, 5);
  expect(slab.slopeInPerFt).toBeCloseTo(1 / 8, 5);
  expect(slab.thickenedEdge).toBeFalsy();
  expect(slab.points).toHaveLength(4);

  // Four stud walls off the slab.
  const studWalls = saved.walls.filter(wall => wall.levelId === 3);
  expect(studWalls).toHaveLength(4);
  studWalls.forEach(wall => {
    expect(wall.wallType).toBe('stud_2x6');
    expect(wall.baseHeight).toBe(0);
  });

  // Its own roof: garage-tagged, every edge an eave, past the far wall.
  expect(saved.roofs).toHaveLength(1);
  const roof = saved.roofs[0];
  expect(roof.garage).toBe(true);
  roof.edges.forEach(edge => expect(edge).toBe('eave'));
  expect(Math.max(...roof.points.map(point => point.x))).toBeGreaterThan(26);

  // Overhead + man door on the plan walls AND the beam (pour cut).
  const doors = saved.fenestrations.filter(opening => opening.type === 'door');
  expect(doors.filter(door => door.view === 'plan')).toHaveLength(2);
  expect(doors.filter(door => door.view === 'foundation')).toHaveLength(2);
  const widths = doors.map(door => door.width);
  expect(widths).toContain(9); // narrow overhead on the 12' front leg
});

test('BUILD HOUSE thickened edge: no beam, LEVEL FLAT monolithic slab', async ({ page }) => {
  await h.openModel(page);
  await drawDetachedGarage(page, 'thickened');
  await buildHouse(page);

  const saved = await h.savedDrawing(page);

  // No grade beam — the slab's perimeter IS the footing.
  expect(saved.walls.filter(wall => wall.levelId === 1)).toHaveLength(0);

  // One level pour: 4" field, no slope, thickened-edge flagged.
  const slab = saved.floors.find(floor => floor.garage);
  expect(slab).toBeTruthy();
  expect(slab.thickness * 12).toBeCloseTo(4, 5);
  expect(slab.slopeInPerFt).toBe(0);
  expect(slab.thickenedEdge).toBe(true);

  // Walls and roof still rise; doors land on the plan walls only (no beam
  // to cut on the FOUNDATION plan).
  expect(saved.walls.filter(wall => wall.levelId === 3)).toHaveLength(4);
  expect(saved.roofs).toHaveLength(1);
  expect(saved.roofs[0].garage).toBe(true);
  const doors = saved.fenestrations.filter(opening => opening.type === 'door');
  expect(doors.filter(door => door.view === 'plan')).toHaveLength(2);
  expect(doors.filter(door => door.view === 'foundation')).toHaveLength(0);
});

test('detached construction survives a save and reload', async ({ page }) => {
  await h.openModel(page);
  await drawDetachedGarage(page, 'thickened');
  await buildHouse(page);

  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await h.waitForModelReady(page);

  const saved = await h.savedDrawing(page);
  const master = saved.boneyardOutlines[0];
  expect(master.detached).toBe(true);
  expect(master.foundation).toBe('thickened');
  const slab = saved.floors.find(floor => floor.garage);
  expect(slab.thickenedEdge).toBe(true);
  expect(slab.slopeInPerFt).toBe(0);
});

test('a detached garage beside a house keeps its own roof and skips the ties', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  await drawDetachedGarage(page, 'gradebeam');
  await buildHouse(page);

  const saved = await h.savedDrawing(page);

  // 4 house foundation walls + 4 garage beams — nothing welded, no rebar
  // ties (those belong to the attached open run).
  expect(saved.walls.filter(wall => wall.levelId === 1)).toHaveLength(8);
  expect(saved.notes.filter(note => note.body === 'REBAR TIE')).toHaveLength(0);

  // Two roofs: the house's own plus the garage's all-eave roof — never one
  // spliced loop.
  expect(saved.roofs).toHaveLength(2);
  const garageRoof = saved.roofs.find(roof => roof.garage);
  const houseRoof = saved.roofs.find(roof => !roof.garage);
  expect(garageRoof).toBeTruthy();
  garageRoof.edges.forEach(edge => expect(edge).toBe('eave'));
  expect(Math.max(...houseRoof.points.map(point => point.x))).toBeLessThan(14);
});

test('a second BUILD HOUSE never doubles the detached garage', async ({ page }) => {
  await h.openModel(page);
  await drawDetachedGarage(page, 'gradebeam');
  await buildHouse(page);
  await buildHouse(page);

  const saved = await h.savedDrawing(page);
  expect(saved.walls.filter(wall => wall.levelId === 1)).toHaveLength(4);
  expect(saved.walls.filter(wall => wall.levelId === 3)).toHaveLength(4);
  expect(saved.floors.filter(floor => floor.garage)).toHaveLength(1);
  expect(saved.roofs).toHaveLength(1);
});

// Garage first, house second: the garage's built pieces must not read as
// "the shell is already built" — BUILD HOUSE raises the house next to them.
test('a house drawn after a built garage still builds', async ({ page }) => {
  await h.openModel(page);
  await drawDetachedGarage(page, 'thickened');
  await buildHouse(page);

  await drawHouseOutline(page);
  await buildHouse(page);

  const saved = await h.savedDrawing(page);
  // House shell: foundation walls + main-floor walls beside the garage's.
  expect(saved.walls.filter(wall => wall.levelId === 1)).toHaveLength(4);
  expect(saved.walls.filter(wall => wall.levelId === 3).length).toBeGreaterThanOrEqual(8);
  // House slab joins the garage slab; footings and the house roof appear.
  expect(saved.floors.filter(floor => !floor.garage && floor.levelId === 1)).toHaveLength(1);
  expect(saved.lines.filter(line => line.layer === 'S-FOOTING').length).toBeGreaterThan(0);
  expect(saved.roofs.filter(roof => !roof.garage)).toHaveLength(1);
  expect(saved.roofs.filter(roof => roof.garage)).toHaveLength(1);

  // And a second BUILD HOUSE stays idempotent.
  await buildHouse(page);
  const again = await h.savedDrawing(page);
  expect(again.walls.length).toBe(saved.walls.length);
  expect(again.floors.length).toBe(saved.floors.length);
  expect(again.roofs.length).toBe(saved.roofs.length);
});

// A detached garage is single-storey no matter how many floors the house
// stacks: its roof bears on the MAIN-floor ceiling (the plate height stored
// on the garage roof), never on the full two-storey wall stack.
test('the garage roof sits at the main-floor ceiling, not the second-storey bearing', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await drawHouseOutline(page);
  await drawDetachedGarage(page, 'gradebeam');
  await buildHouse(page);

  const saved = await h.savedDrawing(page);
  const garageRoof = saved.roofs.find(roof => roof.garage);
  expect(garageRoof.plateHeightFt).toBeGreaterThan(0);

  // FRONT elevation: house (left) and garage (right) side by side.
  await page.locator('.cut-row', { hasText: 'E1' }).click({ position: { x: 18, y: 8 } });
  await page.waitForTimeout(400);
  await expect(page.locator('[data-model-title-detail]').last()).toHaveText('E1');

  const scan = await page.evaluate(() => {
    const canvas = document.querySelector('[data-model-overlay]');
    const W = canvas.width, H = canvas.height;
    const { data } = canvas.getContext('2d').getImageData(0, 0, W, H);
    // Opaque ink only: the translucent elevation-mark grid lines cross the
    // whole sheet and would bridge the house-to-garage gap.
    const dark = (x, y) => {
      const i = (y * W + x) * 4;
      return data[i + 3] > 200 && data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120;
    };
    // Grade: the lowest row where a dark run crosses most of the sheet.
    let gradeY = 0;
    for (let y = 0; y < H; y++) {
      let run = 0, best = 0;
      for (let x = 0; x < W; x++) {
        run = dark(x, y) ? run + 1 : 0;
        best = Math.max(best, run);
      }
      if (best > W * 0.6) gradeY = y;
    }
    // Topmost ink per column, well above grade — the roofline of whatever
    // stands there. The floor band hugging the grade line spans the
    // house-to-garage gap, so ink within ~4' of grade doesn't count.
    const tops = [];
    for (let x = 0; x < W; x++) {
      let top = null;
      for (let y = 24; y < gradeY - 60; y++) {
        if (dark(x, y)) { top = y; break; }
      }
      tops.push(top);
    }
    // Clusters of adjacent inked columns: house and garage stand apart.
    const clusters = [];
    let cluster = null;
    tops.forEach((top, x) => {
      if (top == null) { cluster = null; return; }
      if (!cluster) { cluster = { x0: x, x1: x, top }; clusters.push(cluster); }
      else { cluster.x1 = x; cluster.top = Math.min(cluster.top, top); }
    });
    return { gradeY, clusters: clusters.filter(c => c.x1 - c.x0 > 60) };
  });

  expect(scan.clusters.length).toBe(2);
  const [house, garage] = scan.clusters;
  const houseRise = scan.gradeY - house.top;
  const garageRise = scan.gradeY - garage.top;
  // Two-storey house ridge ≈ 21' above grade; a single-storey garage roof
  // peaks near 11'. Riding the full stack would put it at ≈ 20' — well
  // over the 75% line this pins.
  expect(garageRise).toBeGreaterThan(houseRise * 0.3);
  expect(garageRise).toBeLessThan(houseRise * 0.75);
});

test('a detached garage beside a house keeps both masters on the shelf', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  await drawDetachedGarage(page, 'gradebeam');
  await buildHouse(page);

  const saved = await h.savedDrawing(page);
  // House master untouched; the garage master joined it on the shelf.
  expect(saved.boneyardOutlines).toHaveLength(2);
  const garageMaster = saved.boneyardOutlines.find(outline => outline.garage);
  expect(garageMaster.detached).toBe(true);
  expect(garageMaster.foundation).toBe('gradebeam');
  const houseMaster = saved.boneyardOutlines.find(outline => !outline.garage);
  expect(houseMaster).toBeTruthy();
  // The whole plan built: house shell plus the garage pieces.
  expect(saved.walls.filter(wall => wall.levelId === 1).length).toBeGreaterThanOrEqual(8);
  expect(saved.roofs).toHaveLength(2);
});
