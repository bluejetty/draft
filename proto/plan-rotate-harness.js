// TURNING THE HOUSE A QUARTER -- and everything that stands on it.
//
//   node proto/plan-rotate-harness.js
//   node proto/plan-rotate-harness.js --mutate   break it, prove each break is caught
//
// Movie, 27 Sep, having asked for the rotation: *"the dimension and annotation
// notes should shift to line up to the propery direction"*, *"and the room
// tags"*, *"etc"*.
//
// THE "ETC" IS THE WHOLE PROBLEM. A rotation that turns the walls and forgets
// the room tags leaves a plan with its labels in the wrong rooms, and nothing
// crashes, and nothing goes red -- the drawing is perfectly well formed and
// perfectly wrong. Listing the record types by hand in a check would repeat
// exactly the mistake the check is for.
//
// SO THE CENTRAL CHECK WALKS THE DRAWING. It finds every {x, z} in a real
// file, turns the file, and asserts that each one MOVED -- naming any that did
// not by its own path. A record type added next year that nobody remembered to
// rotate fails that check the first time a fixture carries one, which is the
// only form of "etc" a harness can actually keep.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const MUTATION_MODE = require('./harness-args.js').mutationMode();
const ROOT = path.join(__dirname, '..');
// TWO FILES, ONE SUBJECT. plan-rotate.js turns the geometry; cut-marks.js
// decides which side of the plan each elevation stands on. They are checked
// together because the whole of Movie's clarification is about the pair
// agreeing: *"the front view E1 will stay as the same view but the house and
// the E1-E4 lines will rotate"*. Turn one without the other and E1 reads a
// different wall, which is a drawing nobody asked for and nothing else would
// catch.
const FILES = ['plan-rotate.js', 'cut-marks.js'];
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');

function load(mutate) {
  let src = Object.fromEntries(FILES.map(name => [name, read(name)]));
  if (mutate) {
    const next = mutate({ ...src });
    if (FILES.every(name => next[name] === src[name])) {
      throw new Error('mutation matched nothing -- it would prove nothing');
    }
    src = next;
  }
  const win = {};
  const sandbox = { window: win, console, Math, Number, String, Object, Array, JSON, Set };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const name of FILES) vm.runInContext(src[name], sandbox, { filename: name });
  return win;
}

// EVERY POINT IN A RECORD, BY PATH. The same walk for both sides of the
// question: what is here, and what moved.
const points = (value, at = '', out = []) => {
  if (value && typeof value === 'object') {
    if (!Array.isArray(value)
      && Number.isFinite(Number(value.x)) && Number.isFinite(Number(value.z))) {
      out.push({ at, x: Number(value.x), z: Number(value.z) });
      return out;
    }
    if (Array.isArray(value)) value.forEach((v, i) => points(v, `${at}[${i}]`, out));
    else Object.entries(value).forEach(([k, v]) => points(v, at ? `${at}.${k}` : k, out));
  }
  return out;
};

function run(win) {
  const missed = [];
  const check = (label, ok, detail) => {
    if (!ok) missed.push({ label, detail });
    if (!MUTATION_MODE) console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? `   ${detail}` : ''}`);
    return ok;
  };
  const R = win.DraftPlanRotate;
  if (!R || !R.rotateDrawing) {
    missed.push({ label: 'plan-rotate exports rotateDrawing', detail: 'missing' });
    return missed;
  }

  // ── THE TURN ITSELF ───────────────────────────────────────────────────
  //
  // CLOCKWISE, which with x running right and z running down means a point to
  // the EAST goes to the SOUTH. That direction is not arbitrary: it is the one
  // the E-mark table already runs in, so a turn moves each elevation one seat
  // along and cut-marks needs an index shift and nothing else.
  check('a quarter turn sends east to south, which is clockwise on a plan',
    JSON.stringify(R.spin({ x: 1, z: 0 }, 1)) === JSON.stringify({ x: 0, z: 1 }),
    JSON.stringify(R.spin({ x: 1, z: 0 }, 1)));
  check('and south to west, the next seat round',
    JSON.stringify(R.spin({ x: 0, z: 1 }, 1)) === JSON.stringify({ x: -1, z: 0 }),
    JSON.stringify(R.spin({ x: 0, z: 1 }, 1)));
  check('two turns is straight across',
    JSON.stringify(R.spin({ x: 3, z: 5 }, 2)) === JSON.stringify({ x: -3, z: -5 }),
    JSON.stringify(R.spin({ x: 3, z: 5 }, 2)));
  // EXACT, and this is the reason there is no trigonometry in the module. A
  // rotation by Math.cos(Math.PI/2) leaves a sixteenth-decimal residue at every
  // corner, and four turns of it is a dirty save, a re-snapped wall, and a join
  // that no longer closes.
  check('four turns is the point it started at, to the bit',
    JSON.stringify(R.spin({ x: 11.37, z: -4.29 }, 4)) === JSON.stringify({ x: 11.37, z: -4.29 }),
    JSON.stringify(R.spin({ x: 11.37, z: -4.29 }, 4)));
  check('and a turn about a centre leaves that centre alone',
    JSON.stringify(R.turnPoint({ x: 5, z: 5 }, { x: 5, z: 5 }, 1)) === JSON.stringify({ x: 5, z: 5 }),
    JSON.stringify(R.turnPoint({ x: 5, z: 5 }, { x: 5, z: 5 }, 1)));
  // A POINT CARRIES MORE THAN ITS COORDINATES. `srcId` links a wall's end to
  // the boneyard master it was pulled from, and a rotation that rebuilt the
  // point as a bare {x, z} would cut every one of those links -- silently,
  // since nothing reads srcId until a body is asked what it belongs to.
  check('and a point keeps whatever else it was carrying',
    R.turnPoint({ x: 1, z: 2, srcId: 'op-3' }, { x: 0, z: 0 }, 1).srcId === 'op-3',
    JSON.stringify(R.turnPoint({ x: 1, z: 2, srcId: 'op-3' }, { x: 0, z: 0 }, 1)));

  // ── THE REAL DRAWING ──────────────────────────────────────────────────
  const file = path.join(ROOT, 'proto', 'repro-garage-house.draft');
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  // AND ONE OF EVERY RECORD THE FIXTURES DO NOT CARRY. A check that walks a
  // drawing can only see the types that drawing has, so the ones no repro
  // holds -- room tags, devices, shapes, underlays, surface openings, beams,
  // stairs -- are added here. Without them the completeness check below is
  // blind to exactly the records Movie named.
  const level = saved.levels.find(l => l.id === 3) || saved.levels[0];
  const lid = level.id;
  saved.roomTags = [{ id: 1, levelId: lid, view: 'plan', at: { x: 12, z: -10 }, text: 'KITCHEN' }];
  saved.electricDevices = [{ id: 'd1', levelId: lid, view: 'plan', at: { x: 9, z: -3 }, kind: 'outlet' }];
  saved.shapes = [{ id: 's1', levelId: lid, view: 'plan',
    points: [{ x: 2, z: 2 }, { x: 6, z: 2 }, { x: 6, z: 6 }] }];
  saved.underlays = [{ id: 'u1', levelId: lid, view: 'plan', kind: 'image',
    x: 4, z: 4, widthFt: 30, heightFt: 12 }];
  saved.surfaceOpenings = [{ id: 'so1', hostType: 'floor', hostId: 'f1',
    points: [{ x: 1, z: 1 }, { x: 4, z: 1 }, { x: 4, z: 4 }] }];
  saved.beams = [{ id: 1, levelId: lid, view: 'floor',
    start: { x: 0, z: 0 }, end: { x: 10, z: 0 } }];
  saved.stairs = [{ id: 1, levelId: lid, view: 'plan',
    start: { x: 3, z: 3 }, end: { x: 3, z: 12 } }];
  saved.cuts = [{ id: 'S1', levelId: lid, startPt: { x: -5, z: 0 }, endPt: { x: 25, z: 0 },
    dirVec: { x: 0, z: 1 } }];

  const before = points(saved);
  check('fixture: the drawing carries points to turn',
    before.length > 50, `${before.length} points`);
  const turned = R.rotateDrawing(saved, 1);
  const after = points(turned);
  check('and turning it leaves the same points in the same places in the record',
    after.length === before.length, `${after.length} against ${before.length}`);

  // ── THE CHECK THAT ANSWERS "ETC" ──────────────────────────────────────
  //
  // Every point in the file moved, or the one that did not is named. The list
  // of what is deliberately left alone comes from the MODULE, so a record type
  // quietly dropped out of the rotation table does not get excused by this
  // check as well -- it has to be declared as an exception on purpose.
  const spared = new Set(R.NOT_ROTATED.map(entry => entry.key));
  const still = before.filter((pt, i) => {
    const root = pt.at.split(/[.[]/)[0];
    if (spared.has(root)) return false;
    const now = after[i];
    return now && Math.abs(now.x - pt.x) < 1e-9 && Math.abs(now.z - pt.z) < 1e-9;
  });
  // A POINT AT THE CENTRE DOES NOT MOVE, and that is arithmetic rather than a
  // gap. Measured against the module's own centre so the allowance cannot
  // quietly widen.
  const centre = R.planCentre(saved);
  const atCentre = pt => Math.hypot(pt.x - centre.x, pt.z - centre.z) < 1e-9;
  const stranded = still.filter(pt => !atCentre(pt));
  check('every point in the drawing turns with the house, or is named',
    stranded.length === 0,
    stranded.length ? `${stranded.length} left behind: `
      + [...new Set(stranded.map(pt => pt.at.replace(/\[\d+\]/g, '[]')))].join(' ')
      : `${before.length - still.length} points turned`);
  // AND THE SPARED LIST IS NOT EMPTY AND NOT EVERYTHING. A module that
  // declared every key an exception would pass the line above saying nothing.
  check('the shelf beside the plan is spared, and it is the only kind of thing that is',
    spared.has('boneyardOutlines') && spared.size < 4,
    [...spared].join(' '));
  check('and the boneyard really did stay put, which is what sparing it means',
    before.filter(pt => pt.at.startsWith('boneyardOutlines')).length > 0
      && before.filter(pt => pt.at.startsWith('boneyardOutlines'))
        .every((pt, i) => {
          const now = after[before.indexOf(pt)];
          return now && now.x === pt.x && now.z === pt.z;
        }),
    `${before.filter(pt => pt.at.startsWith('boneyardOutlines')).length} shelf points`);

  // ── AND THE RECORDS MOVIE NAMED, EACH BY NAME ────────────────────────
  //
  // The walk above covers these, and it covers them as a COUNT. Named here as
  // well because a count that drops from 130 to 128 is a check that reads as
  // noise, and these three are the ones he asked about: *"the dimension and
  // annotation notes should shift"*, *"and the room tags"*.
  const moved = (list, field) => {
    const was = saved[list]?.[0];
    const now = turned[list]?.[0];
    if (!was || !now) return 'the fixture has none';
    const a = field.split('.').reduce((o, k) => o?.[k], was);
    const b = field.split('.').reduce((o, k) => o?.[k], now);
    return (a && b && (a.x !== b.x || a.z !== b.z)) ? true : `${JSON.stringify(a)} -> ${JSON.stringify(b)}`;
  };
  check('a dimension string turns with the wall it measures',
    moved('dimensions', 'start') === true, String(moved('dimensions', 'start')));
  check('an annotation note turns, both its anchor and the text it leads to',
    moved('notes', 'anchor') === true && moved('notes', 'text') === true,
    `${moved('notes', 'anchor')} / ${moved('notes', 'text')}`);
  check('and a room tag turns, so a label stays in its own room',
    moved('roomTags', 'at') === true, String(moved('roomTags', 'at')));

  // ── THE TWO THAT ARE NOT SIMPLY POINTS ────────────────────────────────
  //
  // A CUT'S DIRECTION turns about the ORIGIN, not about the house: it is which
  // way the cut looks, not where it is. Rotated as a point it would be flung
  // across the plan and stop being a unit vector at all.
  check('a cut-s view direction turns without being carried off across the plan',
    JSON.stringify({ x: turned.cuts[0].dirVec.x, z: turned.cuts[0].dirVec.z })
      === JSON.stringify({ x: -1, z: 0 }),
    JSON.stringify(turned.cuts[0].dirVec));
  check('and it is still a unit vector, which a point-rotated one would not be',
    Math.abs(Math.hypot(turned.cuts[0].dirVec.x, turned.cuts[0].dirVec.z) - 1) < 1e-9,
    `${Math.hypot(turned.cuts[0].dirVec.x, turned.cuts[0].dirVec.z)}`);
  // AN UNDERLAY IS A PICTURE PINNED TO THE PLAN, and turned on its side it is
  // as tall as it was wide.
  check('an underlay-s width and height swap on a quarter turn',
    turned.underlays[0].widthFt === 12 && turned.underlays[0].heightFt === 30,
    `${turned.underlays[0].widthFt} x ${turned.underlays[0].heightFt}`);
  check('and they swap back on the next one, rather than swapping every time',
    R.rotateDrawing(turned, 1).underlays[0].widthFt === 30,
    `${R.rotateDrawing(turned, 1).underlays[0].widthFt}`);
  // AND A HALF TURN IN ONE GO LEAVES THEM ALONE. Two quarters is upside down
  // and the same way round, so the swap is on ODD turns -- asked here because
  // turning twice one quarter at a time swaps and swaps back, which passes
  // whether the rule reads the count or not. Measured: the mutant that swaps
  // on every turn survived until this line existed.
  check('and a half turn in one go leaves them the way round they were',
    R.rotateDrawing(saved, 2).underlays[0].widthFt === 30
      && R.rotateDrawing(saved, 2).underlays[0].heightFt === 12,
    `${R.rotateDrawing(saved, 2).underlays[0].widthFt} x `
    + `${R.rotateDrawing(saved, 2).underlays[0].heightFt}`);

  // ── THE DATUM AND THE COUNT OF TURNS ──────────────────────────────────
  check('the drafter-s own zero turns with the house it was set on',
    turned.drawingOrigin && (turned.drawingOrigin.x !== saved.drawingOrigin.x
      || turned.drawingOrigin.z !== saved.drawingOrigin.z),
    `${JSON.stringify(saved.drawingOrigin)} -> ${JSON.stringify(turned.drawingOrigin)}`);
  check('the drawing remembers how far round it has been turned',
    turned.planTurn === 1, `${turned.planTurn}`);
  check('and it counts on rather than resetting, so three turns reads three',
    R.rotateDrawing(R.rotateDrawing(turned, 1), 1).planTurn === 3,
    `${R.rotateDrawing(R.rotateDrawing(turned, 1), 1).planTurn}`);
  // FROM THREE, ONE MORE IS NONE. Every other count in this block starts from
  // an untouched drawing, where wrapping and not wrapping give the same
  // answer -- so the mutant that lets the count run to four and five survived
  // all of them. This is the only arithmetic that can tell.
  check('and a drawing already turned three times comes back to none, not to four',
    R.rotateDrawing({ ...saved, planTurn: 3 }, 1).planTurn === 0,
    `${R.rotateDrawing({ ...saved, planTurn: 3 }, 1).planTurn}`);
  // FOUR TURNS IS NO TURN, and a drawing that has never been turned still has
  // no key saying so -- the record's standing rule, and the reason this asks
  // what it asks rather than expecting a zero written down.
  check('and wraps at four rather than counting to five',
    R.rotateDrawing(saved, 4).planTurn === saved.planTurn
      && R.rotateDrawing(saved, 5).planTurn === 1,
    `${R.rotateDrawing(saved, 4).planTurn} / ${R.rotateDrawing(saved, 5).planTurn}`);
  check('and a drawing already turned twice keeps that through a full circle',
    R.rotateDrawing({ ...saved, planTurn: 2 }, 4).planTurn === 2,
    `${R.rotateDrawing({ ...saved, planTurn: 2 }, 4).planTurn}`);

  // ── THE ROUND TRIP ────────────────────────────────────────────────────
  //
  // Four turns is the drawing it started as, bit for bit. This is the claim
  // the exactness is FOR, and it is stated over the whole record rather than
  // over a point, because a field handled by three of the four paths through
  // this module would still come back wrong.
  const round = R.rotateDrawing(R.rotateDrawing(R.rotateDrawing(
    R.rotateDrawing(saved, 1), 1), 1), 1);
  const back = points(round);
  const drift = before.map((pt, i) => Math.hypot(back[i].x - pt.x, back[i].z - pt.z));
  const worst = Math.max(...drift);
  check('four turns brings every point back to where it started',
    worst <= 1 / R.LATTICE,
    `worst drift ${worst.toExponential(1)} ft over ${before.length} points`);
  // AND FROM A TURNED DRAWING IT IS EXACT, which is the claim the lattice is
  // for and the one a drafter meets. The fixture's own file is not on the
  // lattice -- repro-garage-house carries a z of 4.000000000000002, written
  // by whatever drew it -- so the first turn CLEANS it, and comparing a
  // cleaned drawing against a dirty one measures the fixture rather than the
  // rotation. Measured: that is exactly how this check first went red, after
  // it had already gone red for the real drift it was written to catch.
  const once1 = R.rotateDrawing(saved, 1);
  const circle = R.rotateDrawing(R.rotateDrawing(R.rotateDrawing(
    R.rotateDrawing(once1, 1), 1), 1), 1);
  const same = JSON.stringify(points(circle)) === JSON.stringify(points(once1));
  check('and a drawing already on the lattice comes back bit for bit',
    same,
    same ? `${before.length} points` : (() => {
      const was = points(once1), now = points(circle);
      const off = was.findIndex((pt, i) => JSON.stringify(now[i]) !== JSON.stringify(pt));
      return `first drift at ${was[off]?.at}: ${JSON.stringify(was[off])} -> `
        + JSON.stringify(now[off]);
    })());
  // AND THE LATTICE IS FAR BELOW ANYTHING DRAWN. A millionth of a foot is a
  // hundred-thousandth of an inch; the app snaps in sixteenths.
  check('and the lattice is finer than anything this app measures',
    1 / R.LATTICE < (1 / 16) / 12 / 1000, `${(1 / R.LATTICE)} ft`);
  check('and the underlay comes back the way round it started',
    round.underlays[0].widthFt === 30 && round.underlays[0].heightFt === 12,
    `${round.underlays[0].widthFt} x ${round.underlays[0].heightFt}`);

  // ── A TURN OF NOTHING IS NOT A CHANGE ────────────────────────────────
  check('turning by nothing hands back the drawing unturned',
    JSON.stringify(points(R.rotateDrawing(saved, 0))) === JSON.stringify(before),
    'unchanged');
  check('and a drawing with no walls has a centre rather than a crash',
    JSON.stringify(R.planCentre({ walls: [] })) === JSON.stringify({ x: 0, z: 0 }),
    JSON.stringify(R.planCentre({ walls: [] })));
  check('and the boneyard alone does not decide where the centre is',
    JSON.stringify(R.planCentre({ walls: [{ levelId: 0, start: { x: 100, z: 100 },
      end: { x: 200, z: 200 } }] })) === JSON.stringify({ x: 0, z: 0 }),
    JSON.stringify(R.planCentre({ walls: [{ levelId: 0, start: { x: 100, z: 100 },
      end: { x: 200, z: 200 } }] })));

  // ── AND E1 STILL READS THE SAME WALL ──────────────────────────────────
  //
  // Movie: *"the front view E1 will stay as the same view but the house and
  // the E1-E4 lines will rotate"*. Which is the whole design in one sentence,
  // and the one thing neither module can keep on its own.
  //
  // MEASURED BY THE WALL, not by the side. Turning the house moves the front
  // wall from the south to the west, and E1 is right only if its mark moved
  // with it -- so the check finds the wall nearest E1's line before the turn,
  // and asks whether the SAME wall is nearest afterwards.
  const M = win.DraftCutMarks;
  if (!M || !M.autoElevationCuts) {
    missed.push({ label: 'cut-marks loads beside the rotation', detail: 'missing' });
    return missed;
  }
  const marksFor = d => M.autoElevationCuts({
    walls: d.walls || [], dimensions: d.dimensions || [],
    elevationMarkOffsets: d.elevationMarkOffsets || {}, autoElevations: true,
    planTurn: d.planTurn || 0,
  });
  // The plan wall whose midpoint is nearest a cut's line, which is the wall
  // that elevation is looking at.
  const wallSeenBy = (d, cut) => {
    const mid = { x: (cut.startPt.x + cut.endPt.x) / 2,
      z: (cut.startPt.z + cut.endPt.z) / 2 };
    const along = { x: cut.endPt.x - cut.startPt.x, z: cut.endPt.z - cut.startPt.z };
    const len = Math.hypot(along.x, along.z) || 1;
    const normal = { x: -along.z / len, z: along.x / len };
    let best = null, bestAt = Infinity;
    (d.walls || []).filter(w => Number(w.levelId) > 0 && w.view !== 'foundation')
      .forEach(w => {
        const c = { x: (w.start.x + w.end.x) / 2, z: (w.start.z + w.end.z) / 2 };
        const off = Math.abs((c.x - mid.x) * normal.x + (c.z - mid.z) * normal.z);
        if (off < bestAt) { bestAt = off; best = w.id; }
      });
    return best;
  };
  const wasMarks = marksFor(saved);
  const nowMarks = marksFor(turned);
  check('fixture: the four marks are placed before and after the turn',
    wasMarks.length === 4 && nowMarks.length === 4,
    `${wasMarks.length} / ${nowMarks.length}`);
  const kept = M.E_ORDER.filter(id => {
    const a = wallSeenBy(saved, wasMarks.find(c => c.id === id));
    const b = wallSeenBy(turned, nowMarks.find(c => c.id === id));
    return a && b && a === b;
  });
  check('every elevation still reads the wall it was reading before the turn',
    kept.length === 4,
    M.E_ORDER.map(id => `${id}:${wallSeenBy(saved, wasMarks.find(c => c.id === id))}`
      + `->${wallSeenBy(turned, nowMarks.find(c => c.id === id))}`).join(' '));
  // AND THE MARK ACTUALLY MOVED, which is the other half: an elevation that
  // reads the same wall because NOTHING turned would pass the line above.
  check('and it is reading it from a different side of the plan, not the old one',
    M.E_ORDER.every(id => {
      const a = wasMarks.find(c => c.id === id), b = nowMarks.find(c => c.id === id);
      return Math.abs(a.startPt.x - b.startPt.x) > 0.5
        || Math.abs(a.startPt.z - b.startPt.z) > 0.5;
    }),
    M.E_ORDER.map(id => {
      const b = nowMarks.find(c => c.id === id);
      return `${id}@${b.startPt.x.toFixed(0)},${b.startPt.z.toFixed(0)}`;
    }).join(' '));
  // AND IT IS STILL LOOKING AT THE HOUSE. A mark moved to the right side and
  // left looking the old way is an elevation seen from behind -- the exact
  // defect EXT. FINISH shipped with, now reachable a second way through the
  // turn. Nothing above could see it: wallSeenBy reads the LINE, and a line is
  // in the same place whichever way it faces. Measured, and that mutant
  // survived until this check existed.
  const outward = (d, cut) => {
    const c = R.planCentre(d);
    const mid = { x: (cut.startPt.x + cut.endPt.x) / 2,
      z: (cut.startPt.z + cut.endPt.z) / 2 };
    return cut.dirVec.x * (mid.x - c.x) + cut.dirVec.z * (mid.z - c.z);
  };
  check('and every turned mark still looks outward, not back through the house',
    nowMarks.every(cut => outward(turned, cut) > 0),
    nowMarks.map(cut => `${cut.id}:${outward(turned, cut) > 0 ? 'out' : 'IN'}`).join(' '));
  check('and so does every mark at every one of the four turns',
    [0, 1, 2, 3].every(t => {
      const d = R.rotateDrawing(saved, t);
      return marksFor(d).every(cut => outward(d, cut) > 0);
    }), 'all four');
  check('and the seat E1 takes after one turn is the one E2 held before it',
    JSON.stringify(M.eMarkSeat('E1', 1)) === JSON.stringify(M.eMarkSeat('E2', 0)),
    JSON.stringify(M.eMarkSeat('E1', 1)));
  check('and four turns puts every elevation back in its own seat',
    M.E_ORDER.every(id =>
      JSON.stringify(M.eMarkSeat(id, 4)) === JSON.stringify(M.eMarkSeat(id, 0))),
    'back where they started');

  // ── TURNING WHERE IT LIES, FOR THE BUILDERS ──────────────────────────
  //
  // Movie, 1 Oct: *"i'd like the drawings to start out with E1 on the right
  // side"* -- so MODEL turns the drawing back to E1's unturned seat, lets the
  // premade house or the ordered garage build front-down, and turns forward.
  // IN PLACE, because the build's undo step holds its walls by identity.
  if (!R.turnInPlace) {
    check('plan-rotate exports turnInPlace', false, 'missing');
    return missed;
  }
  const live = JSON.parse(JSON.stringify(saved));
  const liveWas = JSON.stringify(live);
  const firstWall = live.walls[0];
  const wasPoints = points(live);
  R.turnInPlace(live, 1);
  check('turnInPlace keeps the very records, so undo still finds them',
    live.walls[0] === firstWall, 'walls[0] identity');
  const nowPoints = points(live);
  // THE SAME EXCEPTIONS rotateDrawing keeps, and for the same reasons.
  const exempt = new Set((R.NOT_ROTATED || []).map(rule => rule.key));
  const stood = wasPoints.filter((p, i) => (p.x || p.z)
    && !exempt.has(p.at.split(/[.[]/)[0])
    && nowPoints[i].x === p.x && nowPoints[i].z === p.z);
  check('and turns every point the drawing carries, the datum among them',
    !stood.length && nowPoints.some(p => p.at.includes('drawingOrigin')),
    stood.slice(0, 4).map(p => p.at).join(' '));
  check('and leaves the turn count alone -- the caller turns back and forward',
    (live.planTurn || 0) === (saved.planTurn || 0), String(live.planTurn));
  R.turnInPlace(live, 3);
  check('back and forward is the drawing to the bit, not merely to the lattice',
    JSON.stringify(live) === liveWas, 'round trip');
  // A CORNER TWO WALLS SHARE IS ONE OBJECT, and turned once per wall it would
  // be turned twice -- the house's corners in one frame and its walls' other
  // ends in the next.
  const corner = { x: 4, z: 1 };
  const pool = [{ x: 7, z: 2 }];
  const shared = { walls: [
    { start: { x: 0, z: 0 }, end: corner }, { start: corner, end: { x: 4, z: 9 } }] };
  R.turnInPlace(shared, 1, { also: pool });
  check('a shared corner turns once, not once per wall',
    corner.x === -1 && corner.z === 4, JSON.stringify(corner));
  check('and the corner pool it is handed turns with the walls',
    pool[0].x === -2 && pool[0].z === 7, JSON.stringify(pool[0]));

  return missed;
}

const baseline = run(load(null));
if (!MUTATION_MODE) {
  console.log(`\nplan rotate harness: ${baseline.length ? `${baseline.length} FAILED` : 'all checks passed'}`);
  if (baseline.length) {
    baseline.forEach(m => console.log(`  ✘ ${m.label}${m.detail ? `   ${m.detail}` : ''}`));
    process.exit(1);
  }
  process.exit(0);
}

// EVERY MUTATION GOES THROUGH HERE, the exactly-once guard the other two-file
// engines carry: an anchor matching twice breaks two things and an anchor
// matching nothing breaks none, and both read as a mutation that was caught.
const sub = (src, file, find, replace) => {
  const hits = src[file].split(find).length - 1;
  if (hits !== 1) throw new Error(`anchor hit ${hits} times in ${file}`);
  return { ...src, [file]: src[file].replace(find, replace) };
};

const MUTATIONS = [
  // ── TURNING IN PLACE, FOR THE BUILDERS ──────────────────────────────
  ['a shared corner is turned once per wall that holds it',
    s => sub(s, 'plan-rotate.js', '      seen.add(pt);\n', '')],
  ['the corner pool is left in the other frame',
    s => sub(s, 'plan-rotate.js', '    (Array.isArray(also) ? also : []).forEach(move);\n', '')],
  ['the datum stays behind while the house turns under it',
    s => sub(s, 'plan-rotate.js', '    move(drawing.drawingOrigin);\n', '')],
  ['turning in place copies the records, so undo hunts walls that are gone',
    s => sub(s, 'plan-rotate.js', '    move(drawing.drawingOrigin);\n',
      '    ROTATED.forEach(rule => { if (Array.isArray(drawing[rule.key])) '
      + 'drawing[rule.key] = drawing[rule.key].map(item => ({ ...item })); });\n'
      + '    move(drawing.drawingOrigin);\n')],
  // ── THE RECORDS MOVIE NAMED, DROPPED ONE AT A TIME ──────────────────
  ['the room tags are forgotten, so every label stays in the wrong room',
    s => sub(s, 'plan-rotate.js', "    { key: 'roomTags', at: ['at'] },\n", '')],
  ['the dimensions are forgotten, so the strings measure thin air',
    s => sub(s, 'plan-rotate.js', "    { key: 'dimensions', at: ['start', 'end'] },\n", '')],
  ['the annotation notes are forgotten',
    s => sub(s, 'plan-rotate.js', "    { key: 'notes', at: ['anchor', 'text'] },\n", '')],
  ['a note-s leader turns but its text does not, so the arrow points nowhere',
    s => sub(s, 'plan-rotate.js', "    { key: 'notes', at: ['anchor', 'text'] },",
      "    { key: 'notes', at: ['anchor'] },")],
  ['the electrical devices are forgotten',
    s => sub(s, 'plan-rotate.js', "    { key: 'electricDevices', at: ['at'] },\n", '')],
  ['the floors are forgotten, so the walls turn off their own slab',
    s => sub(s, 'plan-rotate.js', "    { key: 'floors', points: true },\n", '')],
  ['the roofs are forgotten, so the house turns and its roof does not',
    s => sub(s, 'plan-rotate.js', "    { key: 'roofs', points: true },\n", '')],
  ['the beams are forgotten',
    s => sub(s, 'plan-rotate.js', "    { key: 'beams', at: ['start', 'end'] },\n", '')],
  ['the stairs are forgotten',
    s => sub(s, 'plan-rotate.js', "    { key: 'stairs', at: ['start', 'end'] },\n", '')],
  ['the columns are forgotten, so the posts stand where the house used to be',
    s => sub(s, 'plan-rotate.js', "    { key: 'columns', at: ['point'] },\n", '')],
  ['the surface openings are forgotten, so a stairwell hole misses its stair',
    s => sub(s, 'plan-rotate.js', "    { key: 'surfaceOpenings', points: true },\n", '')],
  ['the shapes are forgotten',
    s => sub(s, 'plan-rotate.js', "    { key: 'shapes', points: true },\n", '')],
  ['the outlines are forgotten, so BUILD HOUSE would rebuild the old way round',
    s => sub(s, 'plan-rotate.js', "    { key: 'outlines', points: true },\n", '')],
  ['a points-list rule stops reading its points at all',
    s => sub(s, 'plan-rotate.js', '        if (rule.points && Array.isArray(next.points)) {',
      '        if (false && Array.isArray(next.points)) {')],

  // ── THE TWO THAT ARE NOT SIMPLY POINTS ──────────────────────────────
  ['a cut-s direction is carried off across the plan instead of spun',
    s => sub(s, 'plan-rotate.js', "    { key: 'cuts', at: ['startPt', 'endPt'], spin: ['dirVec'] },",
      "    { key: 'cuts', at: ['startPt', 'endPt', 'dirVec'] },")],
  ['a cut-s direction stops turning, so the section looks the old way',
    s => sub(s, 'plan-rotate.js', "    { key: 'cuts', at: ['startPt', 'endPt'], spin: ['dirVec'] },",
      "    { key: 'cuts', at: ['startPt', 'endPt'] },")],
  ['an underlay stays where it was, so the tracing slides off the plan',
    s => sub(s, 'plan-rotate.js', "    { key: 'underlays', bare: true, swapSize: true },",
      "    { key: 'underlays', swapSize: true },")],
  ['an underlay keeps its old proportions, so the picture is stretched',
    s => sub(s, 'plan-rotate.js', "    { key: 'underlays', bare: true, swapSize: true },",
      "    { key: 'underlays', bare: true },")],
  ['an underlay swaps its sides on every turn, including the half turn',
    s => sub(s, 'plan-rotate.js', '        if (rule.swapSize && n % 2 === 1', '        if (rule.swapSize')],

  // ── THE TURN ─────────────────────────────────────────────────────────
  ['the house turns anticlockwise, so the elevations walk the wrong way round',
    s => sub(s, 'plan-rotate.js', '      const wasX = x;\n      x = -z;\n      z = wasX;',
      '      const wasX = x;\n      x = z;\n      z = -wasX;')],
  ['the turn is about the world origin, so a house drawn off it is flung away',
    s => sub(s, 'plan-rotate.js', '    const local = spin({ x: Number(pt.x) - centre.x, z: Number(pt.z) - centre.z }, turns);\n',
      '    const local = spin({ x: Number(pt.x), z: Number(pt.z) }, turns);\n')],
  ['the centre is the whole drawing, so the boneyard drags it off the house',
    s => sub(s, 'plan-rotate.js', '      .filter(w => Number(w?.levelId) > 0 && w?.start && w?.end);',
      '      .filter(w => w?.start && w?.end);')],
  ['a point is rebuilt bare, so every boneyard link is cut',
    s => sub(s, 'plan-rotate.js', '    return { ...pt, x: snap(centre.x + local.x), z: snap(centre.z + local.z) };',
      '    return { x: snap(centre.x + local.x), z: snap(centre.z + local.z) };')],
  ['the turned point is left off the lattice, so turning back does not land',
    s => sub(s, 'plan-rotate.js', '    return { ...pt, x: snap(centre.x + local.x), z: snap(centre.z + local.z) };',
      '    return { ...pt, x: centre.x + local.x, z: centre.z + local.z };')],
  ['the drafter-s zero is left behind, so the grid runs at an angle to the walls',
    s => sub(s, 'plan-rotate.js', "    if (drawing.drawingOrigin) {\n"
      + '      out.drawingOrigin = turnPoint(drawing.drawingOrigin, centre, n);\n    }\n', '')],

  // ── THE COUNT ────────────────────────────────────────────────────────
  ['the turn count is set rather than added, so two turns still reads one',
    s => sub(s, 'plan-rotate.js', '    out.planTurn = ((((Number(drawing.planTurn) || 0) + n) % 4) + 4) % 4;',
      '    out.planTurn = n;')],
  ['the turn count is not kept at all, so the marks never learn to follow',
    s => sub(s, 'plan-rotate.js', '    out.planTurn = ((((Number(drawing.planTurn) || 0) + n) % 4) + 4) % 4;',
      '')],
  ['the turn count runs past four instead of wrapping',
    s => sub(s, 'plan-rotate.js', '    out.planTurn = ((((Number(drawing.planTurn) || 0) + n) % 4) + 4) % 4;',
      '    out.planTurn = (Number(drawing.planTurn) || 0) + n;')],

  // ── THE EXCEPTIONS ───────────────────────────────────────────────────
  ['the boneyard turns too, so a parked shelf is flung across the sheet',
    s => sub(s, 'plan-rotate.js', "    { key: 'walls', at: ['start', 'end'] },",
      "    { key: 'walls', at: ['start', 'end'] },\n    { key: 'boneyardOutlines', points: true },")],
  ['everything is declared an exception, so the completeness check says nothing',
    s => sub(s, 'plan-rotate.js', "  const NOT_ROTATED = Object.freeze([",
      "  const NOT_ROTATED = Object.freeze([\n"
      + "    { key: 'walls', why: 'no' }, { key: 'dimensions', why: 'no' },\n"
      + "    { key: 'roomTags', why: 'no' }, { key: 'notes', why: 'no' },")],

  // ── AND A TURN OF NOTHING ────────────────────────────────────────────
  // ── AND THE MARKS, WHICH ARE THE OTHER HALF OF HIS SENTENCE ─────────
  ['the marks stay in their old seats, so E1 ends up reading a different wall',
    s => sub(s, 'cut-marks.js', '      const { side, sign } = eMarkSeat(id, planTurn);',
      '      const { side, sign } = eMarkSeat(id, 0);')],
  ['the marks walk the wrong way round, so E1 takes E4-s seat',
    s => sub(s, 'cut-marks.js', '    return E_MARK_SIDES[E_ORDER[(i + n) % 4]];',
      '    return E_MARK_SIDES[E_ORDER[(i + 4 - n) % 4]];')],
  ['a turned mark keeps its old axis, so the line runs the wrong way across',
    s => sub(s, 'cut-marks.js', "      const acrossX = seat.axis === 'z';",
      "      const acrossX = E_MARK_SIDES[id].axis === 'z';")],
  ['a turned mark looks the old way, so the elevation is seen from behind',
    s => sub(s, 'cut-marks.js', '        dirVec: eMarkDir(id, planTurn),',
      '        dirVec: eMarkDir(id, 0),')],
  ['the turn never reaches the marks at all',
    s => sub(s, 'cut-marks.js', '    planTurn = 0 }) => {', '    planTurn: ignored = 0 }) => {\n'
      + '    const planTurn = 0;')],

  ['turning by nothing turns it anyway, so opening a file turns the house',
    s => sub(s, 'plan-rotate.js', '    const n = (((Number(turns) || 0) % 4) + 4) % 4;',
      '    const n = (((Number(turns) || 1) % 4) + 4) % 4;')],
];

console.log('\n' + 'mutation'.padEnd(78) + 'caught by');
let survivors = 0, broken = 0;
for (const [label, mutate] of MUTATIONS) {
  let by;
  try {
    const m = run(load(mutate));
    if (!m.length) survivors += 1;
    by = m.length ? m.map(x => x.label).join('\n' + ' '.repeat(78)) : '*** NOTHING ***';
  } catch (err) {
    broken += 1;
    by = `!!! MUTATION DID NOT APPLY: ${err.message}`;
  }
  console.log(`${label.padEnd(78)}${by}`);
}
console.log(`\n${MUTATIONS.length - survivors - broken}/${MUTATIONS.length} mutations caught`);
if (broken) console.log(`${broken} mutation(s) never applied -- they prove nothing`);
if (!MUTATIONS.length) console.log('NO MUTATIONS DEFINED -- this table proves nothing');
process.exit(baseline.length || survivors || broken || !MUTATIONS.length ? 1 : 0);
