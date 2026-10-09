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
    // THE GARAGE'S GRADE BEAM HANGS OFF THE HOUSE'S OWN SILL (Movie, 3 Oct:
    // "the 1.5" sill plate should match height and then 32" grade beam
    // below"): the bilevel pours 5'-0" + a 1 1/2" plate, so the beam tops out
    // at 5'-0" over the wall bottom and hangs 32" from there -- not off the
    // 8'-0" a house wall defaults to.
    const beam = d.walls.filter(w => Number(w.levelId) === 1 && w.body === 'garage');
    expect(beam.length, 'the garage stands on a beam').toBeGreaterThan(0);
    beam.forEach(w => {
      expect(w.topHeight).toBeCloseTo(5, 3);
      expect(w.baseHeight).toBeCloseTo(5 - 32 / 12, 3);
    });
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
    // Decks: MAIN is the notched house, ENTRY is the landing -- grown 3.5"
    // past its three inside edges onto the fill wall, but not across the
    // head of the flights.
    const landing = d.floors.find(f => Number(f.levelId) === 2);
    expect(landing.points.length).toBe(8);
    const l = span(landing.points);
    expect([l.x0, l.x1, l.z0, l.z1].map(v => +v.toFixed(3)))
      .toEqual([-10.292, 2.292, 13.708, 20]);
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
    // MAIN FL is open over both, in ONE hole (Movie, 7 Oct: "that little
    // floor area between the stairs (lets just make that a GAP space").
    const holes = d.surfaceOpenings.filter(o => Number(o.levelId) === 3);
    expect(holes.length).toBe(1);
    // EXTERIOR DIMS ON THE 1 FLOOR LAYOUT, none on the 0.5's (Movie, 7 Oct).
    const dimsOn = (lv, view) => d.dimensions.filter(x => Number(x.levelId) === lv && x.view === view);
    expect(dimsOn(3, 'floor').length, 'the MAIN FL floor layout is dimensioned').toBeGreaterThan(4);
    expect(dimsOn(2, 'floor').length, 'the ENTRY floor layout is not').toBe(0);
    expect(holes[0].stairIds.slice().sort()).toEqual([up.id, down.id].sort());
    // The middle of the 4.5" gap, a foot back from the landing, is open.
    const inside = (pts, p) => {
      let hit = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        if ((pts[i].z > p.z) !== (pts[j].z > p.z)
          && p.x < ((pts[j].x - pts[i].x) * (p.z - pts[i].z)) / (pts[j].z - pts[i].z) + pts[i].x) hit = !hit;
      }
      return hit;
    };
    const gapX = ((up.start.x + up.widthFt / 2) + (down.start.x - down.widthFt / 2)) / 2;
    expect(inside(holes[0].points, { x: gapX, z: 13 }), 'the strip between the flights').toBe(true);
    expect(inside(holes[0].points, { x: up.start.x, z: 13 }), 'over the UP flight').toBe(true);
    expect(inside(holes[0].points, { x: down.start.x, z: 13 }), 'over the DOWN flight').toBe(true);
  });

// Movie, 3 Oct: the entry floor overlaps the house by 3.5" on its three
// inside edges so one 2x4 wall stands there, slab to MAIN, filling between
// the posts ("it doesn't SUPPORT the floor the beams should"); a 4.5" gap
// between the flights holds a 3.5" post with 1/2" drywall each side; and
// "copy sharmas" -- dropped beams down the stair opening, posts on pads.
test('the framing round the entry: fill walls in the overlap, the post between the flights, beams and pads',
  async ({ page }) => {
    const d = await buildBilevel(page, 'bilevel-garage');
    const up = d.stairs.find(s => Number(s.levelId) === 3);
    const down = d.stairs.find(s => Number(s.levelId) === 2);
    const gapIn = ((down.start.x - down.widthFt / 2) - (up.start.x + up.widthFt / 2)) * 12;
    expect(gapIn, '1/2" drywall + 3.5" post + 1/2" drywall').toBeCloseTo(4.5, 3);
    // Four 2x4s on the basement plan, slab to MAIN's underside: 5'-0" pour,
    // the sill and PROJECT's wood fill -- 9'-4 1/4".
    const fill = d.walls.filter(w => Number(w.levelId) === 1 && w.view === 'plan');
    expect(fill.length).toBe(4);
    fill.forEach(w => {
      expect(w.wallType).toBe('stud_2x4');
      expect(w.refLine).toBe('center');
      expect(w.topHeight).toBeCloseTo(9.3542, 3);
    });
    const back = fill.filter(w => Math.abs(w.start.z - w.end.z) < 1e-6);
    expect(back.length, 'the back runs either side of the stairwell').toBe(2);
    back.forEach(w => expect(w.start.z).toBeCloseTo(14 - 1.75 / 12, 4));
    const wellL = up.start.x - up.widthFt / 2, wellR = down.start.x + down.widthFt / 2;
    back.forEach(w => [w.start.x, w.end.x].forEach(x =>
      expect(x <= wellL + 1e-6 || x >= wellR - 1e-6, 'no fill across the stairs').toBe(true)));
    // Posts on FOUNDATION, on pads: the two inside corners, the gap, and each
    // end of each stairwell beam.
    const posts = d.columns.filter(c => Number(c.levelId) === 1 && c.view === 'foundation'
      && c.footing === 'pad36');
    expect(posts.length).toBe(7);
    const at = (x, z) => posts.some(c => Math.abs(c.point.x - x) < 1e-3 && Math.abs(c.point.z - z) < 1e-3);
    const backZ = 14 - 1.75 / 12;
    expect(at(-10 - 1.75 / 12, backZ), 'left inside corner').toBe(true);
    expect(at(2 + 1.75 / 12, backZ), 'right inside corner').toBe(true);
    expect(at((up.start.x + down.start.x) / 2, backZ), 'between the flights').toBe(true);
    const beams = d.beams.filter(b => b.mode === 'dropped' && Number(b.levelId) === 1);
    expect(beams.length, 'one down each long side of the opening').toBe(2);
    expect(beams.map(b => +b.start.x.toFixed(3)).sort((a, b) => a - b))
      .toEqual([+wellL.toFixed(3), +wellR.toFixed(3)]);
    beams.forEach(b => {
      expect(b.start.z).toBeCloseTo(backZ, 4);
      expect(at(b.start.x, b.start.z) && at(b.end.x, b.end.z), 'a post at each end').toBe(true);
    });
    // Each beam runs to the far end of the flight beside it.
    const farOf = s => Math.min(s.start.z, s.end.z);
    expect(beams.find(b => b.start.x < -4).end.z).toBeCloseTo(farOf(up), 3);
    expect(beams.find(b => b.start.x > -4).end.z).toBeCloseTo(farOf(down), 3);
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
  expect(d.beams.length).toBe(0);
  expect(d.columns.length).toBe(0);
  expect(d.levels.map(l => Number(l.id))).toEqual([8, 7, 5, 3, 1]);
});

// THE MODIFIED BILEVEL: the 2 STOREY's room over the garage on OVER GARAGE,
// 6'-3" over MAIN (the Sharma plans' 10 risers), reached by a third flight
// over the down flight onto a landing over the entry, with its own roof.
test('MODIFIED BILEVEL: the room over the garage, its landing, the third flight and its roof',
  async ({ page }) => {
    const d = await buildBilevel(page, 'modifiedBilevel');
    expect(d.buildType).toBe('modifiedBilevel');
    expect(d.levels.map(l => Number(l.id)), 'OVER GARAGE above MAIN, ENTRY below it')
      .toEqual([8, 7, 5, 4, 3, 2, 1]);
    const room = d.outlines.find(o => Number(o.levelId) === 4);
    expect(room, 'the room is filed on OVER GARAGE').toBeTruthy();
    const roomWalls = d.walls.filter(w => Number(w.levelId) === 4);
    expect(roomWalls.length).toBeGreaterThan(3);
    roomWalls.forEach(w => expect(w.topHeight).toBeCloseTo(109.125 / 12, 3));
    // A door off the landing into the room.
    expect(d.fenestrations.some(f => f.type === 'door'
      && roomWalls.some(w => w.id === f.wallId))).toBe(true);
    // ONE deck on OVER GARAGE, the room and the landing together (Movie,
    // 4 Oct: "see the 2 X floors- make them 1 floor").
    const decks = d.floors.filter(f => Number(f.levelId) === 4);
    expect(decks.length).toBe(1);
    expect(span(decks[0].points), 'the landing (back to z 14) and the room in one')
      .toEqual(span([{ x: -4, z: 14 }, { x: 20, z: 38 }]));
    expect(decks[0].points.length, 'no seam: the landing\'s corner is the deck\'s').toBe(8);
    // Three flights; the third over the down one, 6'-3" up from MAIN.
    const down = d.stairs.find(s => Number(s.levelId) === 2);
    const third = d.stairs.find(s => Number(s.levelId) === 4);
    expect(d.stairs.length).toBe(3);
    expect(third.riseFt).toBeCloseTo(6.25, 2);
    expect(third.start.x).toBeCloseTo(down.start.x, 3);
    expect(third.start.z).toBeCloseTo(14, 3);
    // The entry's garage half stops at the landing; its street half climbs on.
    const entryTops = d.walls.filter(w => Number(w.levelId) === 2 && w.topHeight > 5)
      .map(w => Number(w.topHeight.toFixed(3))).sort();
    expect(entryTops).toEqual([10.698, 13.542]);
    // The room has its own roof, raised from OVER GARAGE.
    const roomRoof = d.roofs.find(r => Number(r.sourceLevelId) === 4);
    expect(roomRoof).toBeTruthy();
    // Square over the room, straight across its jog (Movie, 4 Oct: "make it
    // strait across"), joined to the upper landing; and on 4 Oct again: "the roof needs to extend to the
    // END of the stairs" -- the third flight's bottom step on MAIN FL, at
    // z = 14 - its run -- in a strip the landing's width ("option 2"). So an
    // L, two feet of eave all round.
    const bottomZ = third.end.z;
    expect(bottomZ, 'the third flight runs back from the landing').toBeLessThan(14);
    expect(span(roomRoof.points)).toEqual(span([{ x: -6, z: bottomZ - 2 }, { x: 22, z: 40 }]));
    expect(roomRoof.points.length, 'an L, not the old square').toBe(6);
    // And closed in where it stands over the main roof ("a wall that goes
    // from the bottom of the 2nd fl roof to the top of the main fl
    // ceiling"): on OVER GARAGE, from MAIN's ceiling (9'-1 1/8" less the
    // 6'-3" rise) to the room's plate, round every edge of the roof's wall
    // line the room's own walls do not stand on -- the strip's end and its
    // two sides, and the cavity wall in line with the room's 1 ft jog
    // (z 19), framed straight so there is no jog. Movie, 5 Oct: it "only
    // needs to line up with the 1ft jog not the front of the stairs" (z 14).
    const hood = d.walls.filter(w => Number(w.levelId) === 4 && w.baseHeight > 1);
    const runs = hood.map(w => [w.start, w.end].map(p => [p.x, p.z]).sort().join(' ')).sort();
    expect(runs).toEqual([
      [[-4, bottomZ], [-4, 20]], [[-4, bottomZ], [2, bottomZ]], [[2, bottomZ], [2, 19]],
      [[2, 19], [16, 19]],
    ].map(r => r.sort().join(' ')).sort());
    // ON THE EXTERIOR FACE, like the room's own walls, so the two line up
    // outside (Movie, 9 Oct: "why is it CENTERLINE ? should be EXT line so
    // it lines up"): each wall's body lies in from its line, toward the
    // room and the strip.
    const inward = { '-4': [1, 0], '2': [-1, 0], [bottomZ]: [0, 1], '19': [0, 1] };
    hood.forEach(w => {
      const dx = w.end.x - w.start.x, dz = w.end.z - w.start.z, len = Math.hypot(dx, dz);
      const side = w.refLine === 'left' ? 1 : w.refLine === 'right' ? -1 : 0;
      const along = Math.abs(dx) < 1e-6 ? String(w.start.x) : String(w.start.z);
      expect([side * -dz / len, side * dx / len].map(v => Math.round(v) + 0), `${w.refLine} wall at ${along}`)
        .toEqual(inward[along]);
    });
    hood.forEach(w => {
      expect(w.baseHeight).toBeCloseTo(109.125 / 12 - third.riseFt, 3);
      expect(w.topHeight).toBeCloseTo(109.125 / 12, 3);
    });

    // And the garage's walls reach the room's floor.
    d.walls.filter(w => w.body === 'garage' && (w.view || 'plan') === 'plan')
      .forEach(w => expect(w.topHeight).toBeCloseTo(9.8646, 3));
  });
