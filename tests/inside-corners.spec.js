// INSIDE-CORNER ATTACHMENT POINTS (board #303): an interior wall butts into
// the FACE of an exterior wall, not its centreline — but the snap pool only
// ever held centrelines, so the point a drafter actually aims at on a jog was
// not a magnet at all. These specs drive the real tools: they draw walls, then
// snap to the corner and read where the geometry actually landed.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// The Wall tool draws with refLine 'left': the line the drafter clicks is a
// FACE of the assembly, not its centre. So the opposite face — the one an
// interior wall butts into from inside the room — is a FULL thickness in, not
// half. (A wall saved with refLine 'center' straddles its line and its faces
// are at half either side; the code reads each wall's own refLine, which is
// why a 'centre' wall and a 'left' wall meeting at a corner still land right.)
const T_2X6 = 5.5 / 12;
const T_2X4 = 3.5 / 12;

// A closed run, so the walls enclose a room and one corner faces its inside.
const ROOM = [[4, 4], [24, 4], [24, 16], [4, 16]];

async function drawWalls(page, points, typeLabel, close = true) {
  await h.selectTool(page, 'Wall');
  if (typeLabel) await page.getByRole('button', { name: typeLabel }).click();
  for (const [x, z] of points) await h.clickWorld(page, x, z);
  if (close) await h.clickWorld(page, points[0][0], points[0][1]);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

// Draw one line starting near `at` and report where its start actually landed.
async function snapProbe(page, [x, z], offset = 0.06) {
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, x + offset, z + offset);
  await h.clickWorld(page, x + 6, z + 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  const lines = h.allLines(await h.savedDrawing(page));
  return lines[lines.length - 1].start;
}

test('an interior wall lands on the inside face of the corner, not its centreline', async ({ page }) => {
  await h.openModel(page);
  await drawWalls(page, ROOM, '2×6 Stud  (5½")');

  // The room lies up and right of the (4,4) corner, and the clicked line is the
  // outside face, so the face the interior wall butts into is one full assembly
  // in along both walls.
  const landed = await snapProbe(page, [4 + T_2X6, 4 + T_2X6]);
  expect(landed.x).toBeCloseTo(4 + T_2X6, 5);
  expect(landed.z).toBeCloseTo(4 + T_2X6, 5);

  // And it is genuinely the FACE, not the centreline the pool used to offer.
  expect(landed.x).not.toBeCloseTo(4, 3);
  expect(landed.z).not.toBeCloseTo(4, 3);
});

test('a thinner wall puts its corner somewhere else', async ({ page }) => {
  await h.openModel(page);
  await drawWalls(page, ROOM, '2×4 Stud  (3½")');

  const landed = await snapProbe(page, [4 + T_2X4, 4 + T_2X4]);
  expect(landed.x).toBeCloseTo(4 + T_2X4, 5);
  expect(landed.z).toBeCloseTo(4 + T_2X4, 5);
  // A 2x4 corner sits two inches nearer the drawn line than the 2x6 one — the
  // corner is derived from the assembly, not from a fixed guess.
  expect(T_2X6 - T_2X4).toBeCloseTo(2 / 12, 6);
});

test('deleting a wall takes its corner with it', async ({ page }) => {
  await h.openModel(page);
  await drawWalls(page, ROOM, '2×6 Stud  (5½")');
  const corner = [4 + T_2X6, 4 + T_2X6];

  // Take out the wall running up from the corner. Deliberately no probe before
  // this: a probe line would leave its own start vertex sitting exactly on the
  // corner, and the later snap would catch THAT and read as a pass.
  await h.selectTool(page, 'Select');
  await h.clickWorld(page, 4, 10);
  await page.keyboard.press('Delete');
  await h.waitForSaved(page);
  expect(h.allWalls(await h.savedDrawing(page))).toHaveLength(3);

  // One arm gone, so there is no two-wall corner left to derive from and the
  // phantom must be gone with it.
  const after = await snapProbe(page, corner);
  const stillThere = Math.abs(after.x - corner[0]) < 1e-4 && Math.abs(after.z - corner[1]) < 1e-4;
  expect(stillThere).toBe(false);
});

test('a drag grabs the wall vertex, never the phantom corner', async ({ page }) => {
  await h.openModel(page);
  await drawWalls(page, ROOM, '2×6 Stud  (5½")');
  const corner = { x: 4 + T_2X6, z: 4 + T_2X6 };

  const wallsBefore = h.allWalls(await h.savedDrawing(page)).length;

  // Press exactly on the phantom corner and drag. The phantom is derived and
  // must not be grabbable; the real wall vertex under it is what moves.
  await h.selectTool(page, 'Select');
  const from = await h.worldToClient(page, corner.x, corner.z);
  const to = await h.worldToClient(page, corner.x + 3, corner.z + 3);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  const walls = h.allWalls(saved);
  // Nothing was created and nothing was lost — a phantom cannot become geometry.
  expect(walls.length).toBe(wallsBefore);
  // No wall endpoint was left sitting on the phantom's old position.
  const onPhantom = walls.some(wall => [wall.start, wall.end].some(pt =>
    Math.abs(pt.x - corner.x) < 1e-6 && Math.abs(pt.z - corner.z) < 1e-6));
  expect(onPhantom).toBe(false);
});
