// WHERE A ROOF MEETS A 2ND-STOREY WALL, AND THE SPIKE THAT HID IT.
//
// Movie, 16 Oct, after sending a MOD BILEVEL he had traced himself: "the roof
// is still messed up here, the 45 degree corners are still showing too, but
// they shouldn't be there and the roof slopes the wrong way on one side", and
// then the rule itself -- "the main rule for that connection should be the
// roof should be designed in a way (usually using gable design) to slope the
// main roof AWAY or to the SIDES of the 2nd storey wall lines", with "the
// rest of the roofs not involved in the connection to the second floor can be
// drawn as a normal HIP style roof that the user can change to gable if they
// desire".
//
// THE RULE WAS ALREADY WRITTEN AND IT WAS NOT RUNNING. Measured from his own
// file, the chain was:
//
//   1. his traced loop comes back along the wall it just drew -- six feet of
//      north wall walked twice, a spike with no area in it
//   2. offsetOutline meets that vertex with two ANTIPARALLEL edges and hands
//      back a ring with a DIAGONAL across the building
//   3. cutLoops refuses a ring that is not square-cornered, so the cut that
//      notches the roof around the 2nd-storey wall answered null
//   4. notchRoofRound took the null and returned false, silently
//   5. the main roof kept a two-foot eave running straight at the room's
//      wall -- the water he marked in red
//
// One stray vertex, four consequences, no error anywhere. So this file checks
// the chain at both ends: the cleaning (pure), and the roof a traced house
// actually gets (built).
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const empty = () => ({
  version: 1, planTurn: 0, board: 'drafting',
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

// HIS OWN TWO LOOPS, corner for corner out of the file he sent (11c4d306).
// The house carries the spike: the north wall runs east to (0,0) and comes
// straight back to (-6,0) round the entry notch.
const HOUSE = [[0, 0], [-6, 0], [-6, -12], [0, -12], [0, -21],
  [-32, -21], [-32, -26], [-56, -26], [-56, 0]];
const GARAGE = [[0, 0], [0, -1], [16, -1], [16, 26], [-13, 26], [-13, 0]];

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

// Trace a MOD BILEVEL the way he does: the house, then the garage, then the
// bone with the room-over line where it falls.
async function traceModBilevel(page, house, garage) {
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
  await walk(house);
  await walk(garage);
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
}

async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}

const r = n => Math.round(n * 100) / 100;
// The roof over the house, told from the garage's and the room's by reach:
// only the house runs out to the west end of his plan.
const mainRoofOf = d => (d.roofs || [])
  .find(roof => roof.points.some(p => p.x < -50));
const inLoop = (loop, pt) => {
  let hit = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i], b = loop[j];
    if ((a.z > pt.z) !== (b.z > pt.z)
      && pt.x < (b.x - a.x) * (pt.z - a.z) / (b.z - a.z) + a.x) hit = !hit;
  }
  return hit;
};

test('a loop that doubles back loses the tip, and nothing else does',
  async ({ page }) => {
    await open(page);
    const out = await page.evaluate(house => {
      const G = window.DraftGeometry2D;
      const loop = pts => pts.map(([x, z]) => ({ x, z }));
      const spiked = G.loopWithoutSpikes(loop(house));
      const offset = G.offsetOutline(spiked.points, 2);
      const diagonals = offset.filter((p, i) => {
        const q = offset[(i + 1) % offset.length];
        return Math.abs(p.x - q.x) > 0.01 && Math.abs(p.z - q.z) > 0.01;
      }).length;
      // AND THE SAME OFFSET WITHOUT THE CLEAN, which is what the page used
      // to do: one diagonal, straight across the building.
      const raw = G.offsetOutline(loop(house), 2);
      const rawDiagonals = raw.filter((p, i) => {
        const q = raw[(i + 1) % raw.length];
        return Math.abs(p.x - q.x) > 0.01 && Math.abs(p.z - q.z) > 0.01;
      }).length;
      return {
        cleaned: spiked.points.map(p => [p.x, p.z]),
        kept: spiked.kept,
        diagonals,
        rawDiagonals,
        square: G.loopWithoutSpikes(loop([[0, 0], [10, 0], [10, 10], [0, 10]])).points.length,
        // A VERTEX THAT CARRIES STRAIGHT ON is not a spike, and must survive.
        // Its two edges are collinear like a tip's, and only the DIRECTION
        // tells them apart -- so a clean that asked about collinearity alone
        // would quietly merge edges a design may have named separately (the
        // bungalow's split roofs share a line exactly that way).
        straightThrough: G.loopWithoutSpikes(
          loop([[0, 0], [5, 0], [10, 0], [10, 10], [0, 10]])).points.map(p => [p.x, p.z]),
        ell: G.loopWithoutSpikes(loop([[0, 0], [20, 0], [20, 10], [10, 10], [10, 20], [0, 20]])).points.length,
        // TWO SPIKES, the second only reachable once the first has gone:
        // (0,0) is a tip, and dropping it leaves (-20,0) with both its edges
        // running west, which is a tip the first pass could not see.
        twice: G.loopWithoutSpikes(loop([[-30, 0], [-20, 0], [0, 0], [-25, 0],
          [-25, -10], [-30, -10]])).points.map(p => [p.x, p.z]),
      };
    }, HOUSE);
    // THE TIP ONLY. The wall it walked twice becomes the one wall it always
    // was -- (-56,0) to (-6,0) -- and every other corner is where he put it.
    expect(out.cleaned[0], 'the spike tip (0,0) is gone').toEqual([-6, 0]);
    expect(out.cleaned.length).toBe(HOUSE.length - 1);
    expect(out.kept, 'and the survivors carry their old numbers')
      .toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    // THE WHOLE POINT OF REMOVING IT.
    expect(out.rawDiagonals, 'uncleaned, the offset runs a diagonal across the house').toBe(1);
    expect(out.diagonals, 'cleaned, it is square all the way round').toBe(0);
    // AND AN ORDINARY LOOP IS NOT TOUCHED, which is the other half: a cleaner
    // that trimmed real corners would be a worse bug than the one it fixes.
    expect(out.square).toBe(4);
    expect(out.ell).toBe(6);
    expect(out.straightThrough, 'a collinear corner that carries on is kept')
      .toEqual([[0, 0], [5, 0], [10, 0], [10, 10], [0, 10]]);
    // AND IT KEEPS GOING UNTIL IT IS STABLE. One pass takes the tip it can
    // see; the vertex behind it only becomes a tip once that one is gone, and
    // a single-pass clean would hand back a loop still carrying a spike --
    // which offsets exactly as badly as the one it just fixed.
    expect(out.twice, 'both tips go, and what is left is the rectangle they hid')
      .toEqual([[-30, 0], [-25, 0], [-25, -10], [-30, -10]]);
  });

test('the roof dies into the 2nd-storey wall and sheds away from it',
  async ({ page }) => {
    await open(page);
    await traceModBilevel(page, HOUSE, GARAGE);
    const d = await saved(page);
    const roof = mainRoofOf(d);
    expect(roof, 'the house got a roof').toBeTruthy();

    // THE JUNCTION EXISTS: edges cut against the wall, gable and flush. Both
    // facts together -- a gable that kept its two feet of overhang would hang
    // a rake inside the room.
    const atWall = (roof.edges || []).map((kind, i) => ({ kind, over: (roof.edgeOverhang || [])[i] }))
      .filter(edge => edge.over === 0);
    expect(atWall.length, 'the roof is cut against the wall').toBeGreaterThan(0);
    atWall.forEach(edge => expect(edge.kind, 'and every cut edge is a gable').toBe('gable'));

    // AND NOTHING OF IT STANDS OVER THE ROOM. This is the rule said as
    // geometry: a roof that still ran at the 2nd-storey wall would cover part
    // of the room's own footprint with its eave, which is exactly the
    // overhang he marked water running off.
    // AND THE EDGE THE DESIGN NAMED IS STILL THE EDGE IT NAMED. `flush` and
    // `rake` are indices into the loop the caller handed in, and cleaning
    // renumbers it -- so the garage/room roof's one flush gable has to land
    // on the side that faces the house and nowhere else. Read off the roof
    // rather than named by index here, because an index is the very thing
    // under test.
    const roomRoof = (d.roofs || []).find(other => other !== roof
      && (other.edgeOverhang || []).includes(0));
    if (roomRoof) {
      const flushEdges = (roomRoof.edges || [])
        .map((kind, i) => ({ kind, i, over: (roomRoof.edgeOverhang || [])[i] }))
        .filter(edge => edge.over === 0);
      flushEdges.forEach(edge => {
        expect(edge.kind, 'a flush edge is a gable').toBe('gable');
        const a = roomRoof.points[edge.i];
        const b = roomRoof.points[(edge.i + 1) % roomRoof.points.length];
        // THE HOUSE IS SOUTH AND WEST of this roof on his plan, so the edge
        // cut flush must be the one facing it -- not, say, the street end.
        expect(Math.min(a.z, b.z) < 20,
          'the flush gable faces the house, not the far end').toBe(true);
      });
    }

    const room = (d.outlines || []).find(o => Number(o.levelId) === 4);
    expect(room, 'the room over the garage was raised').toBeTruthy();
    const pts = room.points.map(p => ({ x: p.x, z: p.z }));
    const x0 = Math.min(...pts.map(p => p.x)), x1 = Math.max(...pts.map(p => p.x));
    const z0 = Math.min(...pts.map(p => p.z)), z1 = Math.max(...pts.map(p => p.z));
    const ring = roof.points.map(p => ({ x: p.x, z: p.z }));
    for (let i = 1; i <= 4; i += 1) {
      for (let j = 1; j <= 4; j += 1) {
        const probe = { x: x0 + (x1 - x0) * i / 5, z: z0 + (z1 - z0) * j / 5 };
        if (!inLoop(pts, probe)) continue;
        expect(inLoop(ring, probe),
          `the main roof stands over the room at ${r(probe.x)},${r(probe.z)}`).toBe(false);
      }
    }
  });

test('the stock MOD BILEVEL is exactly where it was, with its ends hipped', async ({ page }) => {
  // THE OTHER HALF OF ANY ROOF CHANGE. The design that was already right has
  // to come out identical, or a fix for a traced house is a regression for
  // every ordered one. These numbers are the ones main built before the
  // cleaning went in, read off the build rather than typed from a drawing.
  //
  // THE ENDS CHANGED ONCE, ON PURPOSE (Movie, 16 Oct): "the back on this one
  // could have been a hip" and "should be hip at first if possible". The
  // back edge and the far ends of the two strips either side of the landing
  // stand in open air, so they are eaves and hip. The edges cut against the
  // landing's walls are the gables, which is what keeps every plane shedding
  // away from the room (roofWingKinds in geometry-2d) -- and there is one
  // more of them than there was: with the split entry under the house's roof
  // now, the front strip runs flush along the landing's whole wall, so the
  // strip is a shed rising to that wall with a hip at its free end.
  await open(page);
  await h.openDriveThru(page);
  await page.locator('[data-build-family="bilevel"]').click();
  await page.locator('[data-build-entry="modifiedBilevel"]').click();
  await page.locator('#dt-bone').click();
  await page.waitForTimeout(1500);
  if (await page.locator('#lot-pick').isVisible().catch(() => false)) {
    await page.locator('#lot-pick [data-lot-pick-skip]').click();
  }
  const d = await saved(page);
  const roofs = (d.roofs || []).map(roof => ({
    pts: roof.points.map(p => [r(p.x), r(p.z)]),
    edges: roof.edges,
  }));
  expect(roofs.length).toBe(3);
  expect(roofs[0].pts).toEqual([[-18, -22], [18, -22], [18, 19], [2, 19],
    [2, 6.5], [-4, 6.5], [-4, 22], [-18, 22]]);
  // The stretch west of the landing is a RAKE since 17 Oct: the side the
  // room stands on is a gable the whole way (geometry-2d roofAgainstWall).
  expect(roofs[0].edges).toEqual(['eave', 'eave', 'gable', 'gable', 'gable',
    'gable', 'gable', 'eave']);
  expect(roofs[2].pts).toEqual([[-6, 4.5], [4, 4.5], [4, 17], [23, 17], [23, 40], [-6, 40]]);
  expect(roofs[2].edges).toEqual(['eave', 'eave', 'eave', 'eave', 'eave', 'eave']);
});
