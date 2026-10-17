// THE MAIN ROOF BESIDE A 2ND-FLOOR WALL (Movie, 17 Oct, on his MOD BILEVEL):
// "the 2nd floor wall will be where the roof should be at highest point, but
// try to keep the roof lower by making the gable from the 2 closest sides
// ... on main roof split the roof into 2 roofs -- front will be gabled away
// slope from 2nd floor, and back roof can be gabled at front to connect to
// back of 2nd floor and shed water to sides and hip at back" ... "will need
// the main roof to have a 'gable wall' ... where the lower green roof will
// meet the GABLE wall of the main roof".
//
// THE GEOMETRY IS geometry-2d's (roofAgainstWall, offsetOutlineStepped;
// proto/roof-wings-harness.js). What this pins is the build: his own two
// loops traced the way he traces them, the bone pressed, and the roofs the
// page files -- the back block gabled into the room with a rake standing
// past it, the front piece a single slope off the room, and the knee wall
// under the block's rake where the front piece dies into it.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');
const BUCKET = 'model-drawing';
const empty = () => ({
  version: 1, planTurn: 3, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 4, name: 'OVER GARAGE', elev: 6 },
    { id: 3, name: 'MAIN FL', elev: 0 }, { id: 2, name: 'ENTRY', elev: -4 },
    { id: 1, name: 'FOUNDATION', elev: -10 }],
  activeLevelIdx: 4,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});
// HIS TWO LOOPS, corner for corner out of the file he sent (52df5b1d): the
// house with its entry notch walked as a spike, and the garage beside it.
const HOUSE = [[0, 0], [-6, 0], [-6, -12], [0, -12], [-19, -12], [-19, -20], [-39, -20], [-39, 21], [-20, 21], [-20, 0]];
const GARAGE = [[0, 0], [0, -1], [6, -1], [6, 21], [-20, 21], [-20, 0]];

async function traceModBilevel(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.openDriveThru(page);
  await page.locator('[data-build-family="bilevel"]').click();
  await page.locator('[data-build-entry="modifiedBilevel"]').click();
  await page.locator('#dt-outline').click();
  await expect(page.locator('#drivethru')).toBeHidden();
  await h.dropSeededCorner(page);
  const { at } = await h.planFrame(page);
  const walk = async corners => {
    for (const [x, z] of [...corners, corners[0]]) {
      await page.mouse.click(...at(x, z));
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(600);
    for (const sel of ['#garage-lesson', '#corner-join']) {
      if (await page.locator(sel).isVisible().catch(() => false)) {
        await page.keyboard.press('Enter');
        await page.waitForTimeout(250);
      }
    }
  };
  await walk(HOUSE);
  await walk(GARAGE);
  await page.waitForTimeout(600);
  await page.locator('#bone').click();
  await page.waitForTimeout(2500);
  const choice = page.locator('#build-choice');
  if (await choice.isVisible().catch(() => false)) {
    await choice.getByRole('button', { name: /build it/i }).click();
    await page.waitForTimeout(2500);
  }
  if (await page.locator('#lot-pick').isVisible().catch(() => false)) {
    await page.locator('#lot-pick [data-lot-pick-skip]').click();
  }
  await page.waitForTimeout(600);
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}

const key = r => r.points.map(p => `${p.x},${p.z}`).join(' ');
const span = r => {
  const xs = r.points.map(p => p.x), zs = r.points.map(p => p.z);
  return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
};
const edgeKind = (r, a, b) => {
  const i = r.points.findIndex((p, k) => {
    const q = r.points[(k + 1) % r.points.length];
    return p.x === a[0] && p.z === a[1] && q.x === b[0] && q.z === b[1];
  });
  return i < 0 ? 'missing' : `${r.edges[i]}:${Array.isArray(r.edgeOverhang) ? r.edgeOverhang[i] : '?'}`;
};

test('his MOD BILEVEL: the back block gables into the room with a gable wall past it, the front piece sheds away', async ({ page }) => {
  const d = await traceModBilevel(page);
  const mainRoofs = (d.roofs || []).filter(r => r.sourceLevelId == null && !r.garage);
  expect(mainRoofs.length, 'the main roof is two roofs: the back block and the front piece').toBe(2);
  const block = mainRoofs.find(r => span(r)[0] < -40);
  const front = mainRoofs.find(r => r !== block);
  expect(block && front, 'one reaches the west eave, the other does not').toBeTruthy();

  // THE BACK BLOCK: eaves west, north and south (the hip at the back, the
  // water to the sides); its east side a gable the whole way -- flush where
  // the room stands, a rake past it, stepped between the two, never slanted.
  expect(span(block), 'the block spans the west block with its overhangs').toEqual([-41, -17, -22, 23]);
  expect(edgeKind(block, [-41, 23], [-41, -22]), 'west eave').toBe('eave:2');
  expect(edgeKind(block, [-41, -22], [-17, -22]), 'north eave').toBe('eave:2');
  expect(edgeKind(block, [-20, 23], [-41, 23]), 'south eave').toBe('eave:2');
  expect(edgeKind(block, [-20, 0], [-20, 23]), 'flush on the room').toBe('gable:0');
  expect(edgeKind(block, [-17, -22], [-17, -6]), 'the rake past the room: a gable with its overhang').toBe('gable:2');
  expect(edgeKind(block, [-17, -6], [-19, -6]), 'the step between rake and flush, not a slant').toBe('gable:0');
  expect(block.points.some((p, i) => {
    const q = block.points[(i + 1) % block.points.length];
    return Math.abs(p.x - q.x) > 0.01 && Math.abs(p.z - q.z) > 0.01;
  }), 'no diagonal edge anywhere on the block').toBe(false);

  // THE FRONT PIECE: one eave, facing away from the room, and three gables
  // -- flush against the block and the hood, a rake on its open end -- cut
  // round the hood BEFORE its overhang, so no strip of roof runs on beside
  // the hood's wall.
  expect(span(front), 'the front piece: the middle piece less the hood, with its north and east overhangs').toEqual([-19, -4, -14, -6]);
  expect(front.edges.filter(k => k === 'eave').length, 'one eave').toBe(1);
  expect(edgeKind(front, [-19, -14], [-4, -14]), 'the eave faces away from the room').toBe('eave:2');
  expect(edgeKind(front, [-19, -6], [-19, -14]), 'flush against the gable wall').toBe('gable:0');
  expect(edgeKind(front, [-4, -6], [-19, -6]), 'flush against the hood').toBe('gable:0');
  expect(edgeKind(front, [-4, -14], [-4, -6]), 'a rake on the open end').toBe('gable:2');

  // THE BLOCK KEEPS UNDER THE ROOM'S PLATE (Movie: "the back roof can have
  // a lower slope if it doesn't fit"): at 4 in 12 its peak at the gable
  // stood above the room's wall top, so the pitch came down to the quarter
  // that fits -- 2 3/4 in 12 on this house -- and the front piece kept the
  // project pitch.
  expect(block.pitch, 'the block\'s pitch is lowered to fit under the room\'s plate').toBe(2.75);
  expect(front.pitch, 'the front piece keeps the project pitch').toBe(4);

  // THE GARAGE ROOF HAS NO LITTLE HIP where the garage's front wall stands a
  // foot north of the house's line (Movie: "should just be a normal hip
  // without the extra little hip where it jogs"): the roof ring takes the
  // outer line, a plain rectangle flush against the room on its west side.
  const garage = (d.roofs || []).find(r => r.garage === true);
  expect(garage.points.map(p => [p.x, p.z]), 'four corners, the front on the garage wall\'s line').toEqual([[8, -3], [8, 23], [-6, 23], [-6, -3]]);
  expect(garage.edges, 'eaves east, south and north; flush against the room west').toEqual(['eave', 'eave', 'gable', 'eave']);
  const shortest = Math.min(...garage.points.map((p, i) => { const q = garage.points[(i + 1) % garage.points.length]; return Math.hypot(q.x - p.x, q.z - p.z); }));
  expect(shortest, 'no edge shorter than a jog').toBeGreaterThan(1.5);

  // THE GABLE WALL under the block's rake where the front piece dies into
  // it: a knee wall on OVER GARAGE whose plate is the main roof's bearing,
  // so the elevation climbs it to the rakes.
  const knee = (d.walls || []).filter(w => w.gableWallOf != null);
  expect(knee.length, 'one gable wall').toBe(1);
  expect(knee[0].levelId, 'filed on OVER GARAGE').toBe(4);
  expect([knee[0].start.x, knee[0].start.z, knee[0].end.x, knee[0].end.z], 'along the block\'s east side, the width of the front piece')
    .toEqual([-19, 0, -19, -12]);
  expect(knee[0].topHeight, 'its plate is where it stands: the main roof bears there').toBeCloseTo(knee[0].baseHeight, 6);
  expect(knee[0].baseHeight, 'standing on MAIN\'s ceiling, above OVER GARAGE\'s floor').toBeGreaterThan(0);
  expect(String(knee[0].gableWallOf), 'tagged with the block it closes under').toBe(String(block.id));
});
