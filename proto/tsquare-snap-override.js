// THE CORNER SNAP OVERRIDES THE T-SQUARE. Measured, 13 Sep.
//
// MODEL.html's drawPoint carries this comment:
//
//   "THE T-SQUARE GOES FIRST AND THE CORNER SNAP MAY STILL OVERRIDE IT, but
//    only along the axis it is already on (squareTo's second half)."
//
// squareTo has no second half -- it is four lines and returns a squared point.
// cornerSnap is DraftGeometry2D.nearestVertex over every candidate within the
// radius, with no axis restriction at all. So the promise in the comment is
// not implemented, and a corner sitting off-axis inside the snap radius pulls
// the run off square.
//
// GILLIGAN-TOY-BONES-WORKORDER §1 depends on the opposite being true: "a snap
// may only move the point along the axis it is already on", citing drawPoint
// as already showing the shape. It shows the intent; the code does not hold
// it. The order says the code wins and it wants to hear about it -- this is
// the hearing.
//
// RESULT, on a fixture symmetric about the origin with the T-square lit:
//
//   scale 30.96 px/ft, snap radius 0.129 ft, bait corner 0.06 ft off axis
//   drawn: (0,0) -> (4, 0.06)      squareTo would have given (4, 0)
//   OFF SQUARE by 0.0600 ft, landing exactly on the bait corner
//
// TWO WRONG READINGS THIS PROBE PRODUCED BEFORE IT PRODUCED A RIGHT ONE, both
// worth keeping because both look like proof:
//
//   1. Pressing `t` did not light the T-square, and the unsquared wall that
//      followed looked exactly like a snap override. "The snap beat the
//      instrument" and "the instrument was never up" commit the same wall.
//      The probe now reads the chip and aborts if it is dark.
//   2. The verdict line picked `walls.find(w => w.id !== "bait")`, which
//      matched a FIXTURE wall and reported SQUARE about geometry the probe had
//      never touched. It now identifies the drawn wall by absence from the
//      fixture.
const { chromium } = require('playwright');
const V = (x, z) => ({ x, y: 0, z });

// A FIXTURE SYMMETRIC ABOUT THE ORIGIN, so fit()'s centre is exactly (0,0) and
// a screen point is centre + world * scale. The first version of this probe
// used a single wall, fit() centred on IT, and every click landed somewhere
// the probe did not mean -- the same coordinate trap that cost two wrong
// readings in the selection spec.
//
// THE BAIT is the endpoint of a stub wall, placed just OFF the axis a squared
// run would land on and INSIDE the corner-snap radius. If the snap is
// unrestricted it will pull the run's endpoint onto the bait and off square.
const BAIT_X = 4;
const BAIT_OFF = 0.06;
const ON_X = -4.05;      // on-axis bait: an endpoint at (ON_X, 6), which is
                         // the axis the second run is squared onto          // ft off the axis; snap radius is ~0.13 ft here
const wall = (id, a, b) => ({ id, start: a, end: b, levelId: 3, view: 'plan',
  wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' });
const FIX = {
  version: 1, levels: [{ id: 3, name: 'MAIN FL', elev: 0 }], activeLevelIdx: 0,
  walls: [
    wall('n', V(-10, -10), V(10, -10)),
    wall('s', V(-10, 10), V(10, 10)),
    wall('bait', V(BAIT_X, BAIT_OFF), V(BAIT_X, 6)),
    // ON the axis and inside the radius. The axis lock must still take this
    // one, or "square" has been bought by a snap that never fires -- which
    // looks identical from the wall alone and loses the mitre the snap exists
    // for.
    wall('onaxis', V(ON_X, 6), V(ON_X, 0)),
  ],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
};
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => console.log('PAGE ERROR:', e.message));
  await p.goto('http://localhost:4173/MODEL.html');
  await p.evaluate(async f => { await window.SharedFileStore.saveSharedFile(
    new File([JSON.stringify(f)], 'd.json', { type: 'application/json' }), 'model-drawing'); }, FIX);
  await p.goto('http://localhost:4173/MODEL.html');
  await p.locator('#readout').filter({ hasText: 'walls' }).waitFor({ timeout: 15000 });

  const box = await p.locator('#plan').boundingBox();
  const scale = await p.evaluate(() => Number(/scale ([\d.]+) px\/ft/.exec(
    document.getElementById('readout').textContent)[1]));
  const at = (x, z) => [box.x + box.width / 2 + x * scale, box.y + box.height / 2 + z * scale];
  console.log(`scale ${scale.toFixed(2)} px/ft — snap radius ${(4 / scale).toFixed(3)} ft; `
    + `the bait corner sits ${BAIT_OFF} ft off the axis`);

  // T-SQUARE ON, ASSERTED, NOT ASSUMED. The first version of this probe
  // pressed `t` and drew an unsquared wall, which looks like proof and is not:
  // "the snap overrode the T-square" and "the T-square was never on" produce
  // exactly the same wall. Read the chip.
  await p.locator('[data-mode-tsquare]').click();
  await p.waitForTimeout(80);
  const lit = await p.locator('[data-mode-tsquare]').evaluate(el => el.classList.contains('lit'));
  console.log('T-square lit:', lit);
  if (!lit) { console.log('ABORT — the instrument is down, the probe would prove nothing'); await b.close(); return; }
  await p.locator('[data-draw-wall]').click();
  // Start on the axis the bait is off, and aim at the bait's x. squareTo will
  // put the endpoint at z = 0; the bait is BAIT_OFF above it.
  await p.mouse.click(...at(0, 0));
  await p.waitForTimeout(60);
  await p.mouse.click(...at(BAIT_X, BAIT_OFF * 0.4));
  await p.waitForTimeout(120);

  const drawn = await p.evaluate(async () => {
    const f = await window.SharedFileStore.loadSharedFile('model-drawing');
    return null;   // not saved yet; read the live readout instead
  });
  await p.locator('#save').click();
  await p.locator('#save').filter({ hasText: /SAVED/i }).waitFor({ timeout: 6000 }).catch(() => {});
  await p.waitForTimeout(300);
  const walls = await p.evaluate(async () => {
    const f = await window.SharedFileStore.loadSharedFile('model-drawing');
    return JSON.parse(await f.text()).walls.map(w => ({ id: w.id,
      s: [Number(w.start.x.toFixed(4)), Number(w.start.z.toFixed(4))],
      e: [Number(w.end.x.toFixed(4)), Number(w.end.z.toFixed(4))] }));
  });
  // THE WALL THE PROBE DREW, not "the first one that is not the bait" -- that
  // read picked a fixture wall and reported SQUARE about geometry the probe
  // never touched. Identify it by absence from the fixture.
  const seeded = new Set(FIX.walls.map(w => w.id));
  const made = walls.find(w => !seeded.has(w.id));
  console.log('walls in file:', JSON.stringify(walls));
  if (!made) { console.log('NO WALL COMMITTED — the probe did not draw'); }
  else {
    const dz = Math.abs(made.e[1] - made.s[1]);
    console.log(`\nthe drawn wall: (${made.s}) -> (${made.e})`);
    console.log(dz < 1e-9
      ? 'SQUARE — the snap did not pull it off axis'
      : `OFF SQUARE by ${dz.toFixed(4)} ft — the corner snap overrode the T-square`);
    console.log(Math.abs(made.e[1] - BAIT_OFF) < 1e-6
      ? '   and it landed exactly ON the bait corner, which names the cause'
      : '   (not on the bait — something else moved it)');
  }
  // SECOND HALF: aim west at -4, where a corner sits at -4.05 ON the axis.
  await p.locator('[data-draw-wall]').click();          // disarm
  await p.waitForTimeout(60);
  await p.locator('[data-draw-wall]').click();          // re-arm, fresh chain
  await p.waitForTimeout(60);
  await p.mouse.click(...at(0, 6));
  await p.waitForTimeout(60);
  await p.mouse.click(...at(-4, 6));
  await p.waitForTimeout(120);
  await p.locator('#save').click();
  await p.waitForTimeout(400);
  const after = await p.evaluate(async () => {
    const f = await window.SharedFileStore.loadSharedFile('model-drawing');
    return JSON.parse(await f.text()).walls.map(w => ({ id: w.id,
      s: [Number(w.start.x.toFixed(4)), Number(w.start.z.toFixed(4))],
      e: [Number(w.end.x.toFixed(4)), Number(w.end.z.toFixed(4))] }));
  });
  const second = after.find(w => !seeded.has(w.id) && w.id !== made.id);
  if (!second) console.log('\nsecond run: NO WALL — the probe did not draw');
  else {
    console.log(`\nthe on-axis run: (${second.s}) -> (${second.e})`);
    const tookIt = Math.abs(second.e[0] - ON_X) < 1e-6 && Math.abs(second.e[1] - 6) < 1e-6;
    console.log(tookIt
      ? `SNAPPED ALONG THE AXIS onto ${ON_X} — the mitre still works`
      : `did NOT take the on-axis corner at ${ON_X}: the lock is too tight`);
  }
  await b.close();
})();
