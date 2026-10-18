// THE CHAIN FROM WHAT A DIMENSION MEASURES TO WHETHER IT DRAWS.
//
// Five links, and until this file not one of them had a check:
//
//   auto-dims.js      decides the layer at the push, where the kind is known
//   drawing-format.js stores it, so it survives a save and a reload
//   profile-manager.js carries the layer, so STANDARDS can show a tick
//   layout-plan.js    hands the composer the standards to read
//   plan-composition  reads them and draws, or does not
//
// A break anywhere in that chain fails SILENTLY and fails OPEN: the dimension
// draws. That is the whole reason this harness exists rather than a spec --
// nothing on screen is wrong when it breaks, so no screenshot catches it, and
// the drafter's only symptom is a tick that does nothing. Two of the five were
// already broken when this was written and neither had ever been reported:
//
//   - every dimension in every drawing carried `layer: null` (967 of them in
//     the bungalow fixture), so the gate had nothing to match on; and
//   - NOBODY passed `env.layerStandard`, so `layerShows` returned true for
//     everything. STANDARDS.html has been writing visible/printable into the
//     saved profile since it shipped and no painter ever read them back.
//
// Run: node proto/dim-layers-harness.js          (checks)
//      node proto/dim-layers-harness.js --mutate (checks + mutation table)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
// THROUGH THE SHARED GUARD, AND THAT IS WHAT PUTS IT IN CI. This hand-parsed
// `--mutate` until it was checked: .github/workflows/test.yml builds its
// engine list by grepping every harness for the literal call form
// `harness-args.js').mutationMode()`, so a file that parses the flag itself
// is not an engine as far as CI is concerned. The table ran here and nowhere
// else -- 13 mutations that could rot green forever, which is the same shape
// as everything this harness was written to catch, one layer out.
const MUTATE = require('./harness-args.js').mutationMode();

// auto-dims.js needs nothing; the rest of the chain needs geometry and the
// format. layout-plan.js is last because it reads the others off `window`.
const FILES = ['formatters.js', 'wall-types.js', 'geometry-2d.js', 'drawing-format.js',
  'room-standards.js', 'level-assembly.js', 'profile-manager.js', 'layer-views.js',
  'render-2d.js', 'plan-composition.js', 'auto-dims.js', 'cut-view-env.js',
  'layout-plan.js'];

function loadWith(source = {}) {
  const warnings = [];
  const win = {};
  const sandbox = {
    window: win, Math, Number, String, Object, Array, JSON, Map, Set, Boolean,
    isFinite, parseFloat, parseInt, Date, RegExp, Error, localStorage: undefined,
    console: { warn: m => warnings.push(String(m)), error: () => {}, log: () => {} },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const failed = [];
  for (const file of FILES) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) { failed.push(`${file}: missing`); continue; }
    let code = fs.readFileSync(full, 'utf8');
    if (source[file]) code = source[file](code);
    try { vm.runInContext(code, sandbox, { filename: file }); }
    catch (err) { failed.push(`${file}: ${err.message}`); }
  }
  return { win, warnings, failed };
}

let failures = 0;
let checks = 0;
const ok = (name, cond, detail) => {
  checks += 1;
  if (cond) return;
  failures += 1;
  console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ''}`);
};

// ── THE FIXTURE ─────────────────────────────────────────────────────────────
// A 36 x 66 rectangle, which is Movie's own worked example of an overall
// dimension ("A buyer reads the footprint -- 36 x 66").
const rect = (x0, z0, x1, z1) =>
  [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }];
const wallsAround = pts => pts.map((pt, i) => ({ start: pt, end: pts[(i + 1) % pts.length] }));
const HOUSE = rect(0, 0, 36, 66);
// An L: the south-east corner is cut away, so the S and E sides each gain a
// third coordinate and emit a jog string where the rectangle emits none.
const L_HOUSE = [{ x: 0, z: 0 }, { x: 36, z: 0 }, { x: 36, z: 40 },
  { x: 20, z: 40 }, { x: 20, z: 66 }, { x: 0, z: 66 }];
const NORTH_WALL = { start: { x: 0, z: 0 }, end: { x: 36, z: 0 } };

// SIX INCHES, so a face sits a clean quarter foot off the stored line and
// every figure below is readable by eye: a 36 ft house reads 0.5, 35.5, 0.5.
const WALL_FT = 0.5;
// `extraOutlines` is how a GARAGE reaches this module: an outline of its own
// carrying garage:true, beside the house's. Its walls have to be handed over
// too (`extraWalls`), because the interior string measures WALLS and a garage
// outline alone has none -- the live page filters both off the level and does
// not infer one from the other.
function strings(win, { points = HOUSE, openings = [], roofs = [],
  extraWalls = [], extraOutlines = [], faces = true, firstOffset = 1.5 } = {}) {
  const AD = win.DraftAutoDims;
  const G = win.DraftGeometry2D;
  return AD.computeAutoDimStrings({
    thicknessFt: faces ? (() => WALL_FT) : undefined,
    faceOffsets: faces ? G.wallFaceOffsets : undefined,
    walls: [...wallsAround(points), ...extraWalls],
    outlines: [{ points, garage: false }, ...extraOutlines],
    roofs,
    openings,
    offsetOutline: (pts, dist) => G.offsetOutline(pts, dist),
    firstOffset,
    jogMergeFt: AD.JOG_MERGE_FT,
    stringSpacingFt: AD.STRING_SPACING_FT,
  }) || [];
}
const countBy = (segs, layer) => segs.filter(s => s.layer === layer).length;
const uniqOf = values => [...values].sort((a, b) => a - b)
  .filter((v, i, all) => i === 0 || v - all[i - 1] > 0.01);
const spanOf = s => Math.hypot(s.end.x - s.start.x, s.end.z - s.start.z);

function run() {
  const { win, warnings, failed } = loadWith(...arguments);

  // THE MODULES LOADED AT ALL. Devin, 29 Sep, on harness-env.js: a mutant that
  // would not even parse was counting as a mutant CAUGHT -- "I proved it with
  // a deliberate throw and got 64 checks passed, 0 failed". Every check below
  // reads something off `win`, so a file that threw on load would fail them
  // all and look like a bitten mutation. This says which it was.
  ok('every module in the chain parses and runs', failed.length === 0, failed.join('; '));
  const AD = win.DraftAutoDims;
  const DF = win.DraftDrawingFormat;
  const LS = win.DraftLayerStandards;
  if (!AD || !DF || !LS) {
    ok('auto-dims, drawing-format and layer standards all defined',
      false, `AD=${!!AD} DF=${!!DF} LS=${!!LS}`);
    return { win, warnings };
  }

  // ── THE FIXTURE REACHES ───────────────────────────────────────────────────
  // Asserted before anything is read off it. A fixture that strings nothing
  // makes every claim below vacuously true -- "no segment is mislabelled" is
  // satisfied by no segments, and that is the shape of a green sheet that
  // measured nothing.
  const plain = strings(win);
  ok('the fixture strings something at all', plain.length > 0, `${plain.length} segments`);
  const withWindow = strings(win, {
    openings: [{ center: { x: 18, z: 0 }, wall: NORTH_WALL }],
  });
  ok('an opening adds segments the bare footprint did not have',
    withWindow.length > plain.length, `${plain.length} -> ${withWindow.length}`);

  // ── EVERY STRING IS TAGGED, AND ONLY WITH IDS THAT EXIST ──────────────────
  const known = new Set(Object.values(AD.DIM_LAYERS));
  // ALL FIVE NOW. This read three, then four, and went red each time a kind
  // arrived -- which is the count doing its job rather than being a nuisance:
  // a constant added for a string nobody pushes is exactly what it is here to
  // refuse.
  ok('DIM_LAYERS names all five kinds auto-dims emits', known.size === 5,
    [...known].join(','));
  ['A-DIMS-OVR', 'A-DIMS-EXT', 'A-DIMS-FENS', 'A-DIMS-COLS', 'A-DIMS-INT']
    .forEach(id => ok(`${id} is one of them`, known.has(id)));
  const untagged = withWindow.filter(s => !s.layer);
  ok('no segment leaves auto-dims without a layer', untagged.length === 0,
    `${untagged.length} untagged`);
  const stray = withWindow.filter(s => s.layer && !known.has(s.layer));
  ok('no segment carries an id outside DIM_LAYERS', stray.length === 0,
    [...new Set(stray.map(s => s.layer))].join(','));

  // ── EACH KIND IS THE KIND IT CLAIMS ───────────────────────────────────────
  // Measured, not counted: an overall string on this footprint is 36 or 66
  // long, because that IS the footprint. A check that only counted OVR
  // segments would pass with the labels shuffled.
  const overalls = withWindow.filter(s => s.layer === AD.DIM_LAYERS.OVERALL);
  ok('an overall string exists', overalls.length > 0);
  const spans = overalls.map(spanOf);
  ok('every overall string spans a whole side of the footprint',
    spans.length > 0 && spans.every(v => Math.abs(v - 36) < 0.01 || Math.abs(v - 66) < 0.01),
    spans.map(v => v.toFixed(2)).join(' '));
  ok('both directions of the footprint are strung overall',
    spans.some(v => Math.abs(v - 36) < 0.01) && spans.some(v => Math.abs(v - 66) < 0.01));

  // FENESTRATION follows the openings, in both directions: present with one,
  // ABSENT without. One-sided, this would pass against a build that tagged
  // every string FENS.
  ok('an opening produces a fenestration string',
    countBy(withWindow, AD.DIM_LAYERS.FENESTRATION) > 0);
  ok('no opening produces no fenestration string',
    countBy(plain, AD.DIM_LAYERS.FENESTRATION) === 0,
    `${countBy(plain, AD.DIM_LAYERS.FENESTRATION)} on a house with no openings`);

  // EXTERIOR is the jog string, so it appears on the L and not on the
  // rectangle -- the rectangle's sides have two coordinates and jog nowhere.
  const lShaped = strings(win, { points: L_HOUSE });
  ok('a jogged footprint produces an exterior string',
    countBy(lShaped, AD.DIM_LAYERS.EXTERIOR) > 0);
  ok('a plain rectangle produces no exterior string',
    countBy(plain, AD.DIM_LAYERS.EXTERIOR) === 0,
    `${countBy(plain, AD.DIM_LAYERS.EXTERIOR)} on a footprint with no jogs`);

  // THE ROOF BRANCH is a different arm of the same emitter: it strings the
  // overhang and the overall, and never the openings.
  const roofed = strings(win, {
    roofs: [{ points: rect(-2, -2, 38, 68), overhang: 2 }],
    openings: [{ center: { x: 18, z: 0 }, wall: NORTH_WALL }],
  });
  ok('the roof stack strings something', roofed.length > 0, `${roofed.length} segments`);
  ok('the roof stack tags its overhang string exterior',
    countBy(roofed, AD.DIM_LAYERS.EXTERIOR) > 0);
  ok('the roof stack still strings an overall',
    countBy(roofed, AD.DIM_LAYERS.OVERALL) > 0);
  // The openings are handed in and the roof arm never reads them. Tagging is
  // per-branch, and a build that tagged on shape rather than on kind would
  // put the roof's own multi-coordinate string on the fenestration layer.
  ok('the roof stack emits no fenestration string even with an opening passed',
    countBy(roofed, AD.DIM_LAYERS.FENESTRATION) === 0,
    `${countBy(roofed, AD.DIM_LAYERS.FENESTRATION)}`);
  ok('every roofed segment is tagged too',
    roofed.every(s => known.has(s.layer)));

  // ── A MERGED JOG IS A REAL WALL FACE, NEVER THE MEAN (audit M7) ─────
  //
  // Two corners closer than JOG_MERGE_FT string as one coordinate, and the
  // one they string as has to be a face that EXISTS. Collapsing the cluster to
  // its arithmetic mean puts a printed dimension up to an inch from any wall
  // on the drawing -- a fabricated coordinate on a permit set.
  //
  // IT LIVES HERE BECAUSE THE PAGE CANNOT DRAW IT. tests/auto-dims.spec.js
  // owned this property and clicked the pair in through the Outline tool: the
  // second click lands 1 7/16" from the first, INSIDE the vertex snap, so the
  // page snapped the two onto one point and saved a zero-width spike. The
  // fixture had no near-coincident pair in it at all, the mean was never on
  // the drawing to be found, and the check passed on a drawing that could not
  // fail it. Any pair close enough to merge is close enough to snap, so there
  // is no click sequence that reaches this -- it needs exact geometry, which
  // is what this harness is for.
  {
    // A slot in the south face whose two sides are 1 7/16" apart: x = 2.88
    // and x = 3, inside JOG_MERGE_FT (2") so they string as one.
    const notched = [{ x: 0, z: 0 }, { x: 36, z: 0 }, { x: 36, z: 66 },
      { x: 3, z: 66 }, { x: 3, z: 60 }, { x: 2.88, z: 60 }, { x: 2.88, z: 66 }, { x: 0, z: 66 }];
    // THE JOG ROW ALONE. The south stack also carries the interior string,
    // whose coordinates are wall faces a quarter foot off the stored lines --
    // real faces, but not the ones this rule is about.
    const jogXs = pts => uniqOf(strings(win, { points: pts })
      .filter(s => s.layer === 'A-DIMS-EXT' && Math.abs(s.start.z - s.end.z) < 1e-6
        && s.start.z > 66)
      .flatMap(s => [s.start.x, s.end.x]));
    const southXs = jogXs(notched);
    const real = uniqOf(notched.map(pt => pt.x));
    ok('M7: the pair strings as ONE coordinate, not two inch-scale jogs',
      southXs.filter(x => Math.abs(x - 2.88) < 0.05 || Math.abs(x - 3) < 0.05).length === 1,
      southXs.join(', '));
    ok('M7: and that coordinate is a wall face that exists, not their mean',
      southXs.every(x => real.some(r => Math.abs(r - x) <= 0.01))
      && !southXs.some(x => Math.abs(x - (2.88 + 3) / 2) < 0.01),
      southXs.join(', '));
    // AND THE JOG IS STILL DRAWN. A rule that merged the pair away entirely
    // would pass both checks above and lose the step off the sheet.
    ok('M7: the step itself still strings, between the two ends',
      southXs.length > 2, southXs.join(', '));

    // THE CONTROL, and the shape that broke the page test: two COLLINEAR
    // stretches of one wall meeting at a point are one wall, not a jog. A
    // zero-width spike -- which is what the snap left behind -- has no step to
    // dimension and must not earn a break in a flat run.
    const spiked = [{ x: 0, z: 0 }, { x: 36, z: 0 }, { x: 36, z: 66 },
      { x: 3, z: 66 }, { x: 3, z: 60 }, { x: 3, z: 66 }, { x: 0, z: 66 }];
    ok('M7: a zero-width spike breaks no flat wall, so there is no jog row',
      jogXs(spiked).length === 0, jogXs(spiked).join(', '));
  }

  // ── ONE STACK PER BUILDING ON THE PLANS (Movie, 12 Oct) ─────────────
  //
  // HIS OWN PLAN, TO HIS OWN NUMBERS. Garage along the top, house below it
  // and wider, and the three figures he named: "the outer row that is 28'
  // should go all the way to the other outside wall (maybe around 35'?
  // total)", "the next string that shows front of garage (19ft i think) add
  // the extra part on the north side dimention from garage to outside wall",
  // and "the door dimension can line up with the garage door line".
  //
  // 28 is the house's depth, 19 the garage's front, 35 the building both ways
  // -- so every figure below is one he either asked for or named as wrong.
  {
    const house = rect(0, 7, 35, 35);          // 35 wide, 28 deep
    const garage = rect(0, 0, 19, 7);          // along the top, 19 of the 35
    const GARAGE_DOOR = 9.5;                   // mid-garage, on its north wall
    const FRONT_DOOR = 27;                     // on the house's north wall, east of the garage
    const segs = strings(win, {
      points: house,
      extraOutlines: [{ points: garage, garage: true }],
      extraWalls: wallsAround(garage),
      openings: [
        { center: { x: GARAGE_DOOR, z: 0 }, wall: { start: { x: 0, z: 0 }, end: { x: 19, z: 0 } } },
        { center: { x: FRONT_DOOR, z: 7 }, wall: { start: { x: 19, z: 7 }, end: { x: 35, z: 7 } } },
      ],
    });
    const run = s => Math.round(Math.hypot(s.end.x - s.start.x, s.end.z - s.start.z) * 100) / 100;
    const horiz = segs.filter(s => Math.abs(s.start.z - s.end.z) < 1e-6);
    const vert = segs.filter(s => Math.abs(s.start.x - s.end.x) < 1e-6);
    const rowAt = (list, key, value) => list.filter(s => Math.abs(s.start[key] - value) < 1e-6)
      .map(run).sort((a, b) => a - b);

    // THE OUTER ROW IS THE BUILDING, BOTH WAYS. 35 on the west side where it
    // used to stop at 28, and 35 across the north.
    const westXs = uniqOf(vert.filter(s => s.start.x < 0).map(s => s.start.x));
    const northZs = uniqOf(horiz.filter(s => s.start.z < 0).map(s => s.start.z));
    ok('PLANS: the west overall reads the whole building, not the house alone',
      rowAt(vert, 'x', westXs[0]).join() === '35',
      `west rows ${westXs.join(', ')} -> ${westXs.map(x => rowAt(vert, 'x', x).join('+')).join(' | ')}`);
    ok('and the north overall reads it the other way',
      rowAt(horiz, 'z', northZs[0]).join() === '35',
      `north rows ${northZs.join(', ')} -> ${northZs.map(z => rowAt(horiz, 'z', z).join('+')).join(' | ')}`);

    // THE ROW INSIDE IT READS THE STEP: the garage's 19 ft front and the 16
    // ft of house beside it, on ONE line, adding to the 35 above.
    ok('the north jog row reads the garage front and the rest of the wall',
      northZs.slice(1).some(z => rowAt(horiz, 'z', z).join() === '16,19'),
      northZs.map(z => `${z}:${rowAt(horiz, 'z', z).join('+')}`).join(' '));

    // THE TWO DOORS SHARE A ROW. One FENS line across the whole north side,
    // breaking at both centres -- 9.5 and 27 of the 35.
    const fens = horiz.filter(s => s.layer === 'A-DIMS-FENS');
    const fensZ = uniqOf(fens.map(s => s.start.z));
    ok('the front door and the garage door string on ONE row, not two',
      fensZ.length === 1, `FENS rows at z ${fensZ.join(', ')}`);
    ok('and that row breaks at both door centres',
      uniqOf(fens.flatMap(s => [s.start.x, s.end.x])).join() === '0,9.5,27,35',
      uniqOf(fens.flatMap(s => [s.start.x, s.end.x])).join());

    // ── THE ORDER OF THE ROWS, OUTWARD (Movie, 12 Oct) ────────────────
    // "you have it right inside line WINDOWS (FENS), next one INT, next EXT
    // corners, NEXT ext outter". The north side carries all four, so it is
    // the one side that can pin the whole order.
    const northOrder = northZs.map(z => uniqOf(horiz.filter(s => Math.abs(s.start.z - z) < 1e-6)
      .map(s => s.layer)));
    ok('the north stack runs FENS, INT, EXT, OVR from the building outward',
      JSON.stringify(northOrder.reverse()) === JSON.stringify(
        [['A-DIMS-FENS'], ['A-DIMS-INT'], ['A-DIMS-EXT'], ['A-DIMS-OVR']]),
      JSON.stringify(northOrder));

    // NOTHING LANDS ON THE BUILDING. Every string is outside the footprint,
    // which is what the old per-footprint rule was really protecting.
    ok('no string crosses the plan',
      !segs.some(s => Math.min(s.start.x, s.end.x) > 0.01 && Math.max(s.start.x, s.end.x) < 34.99
        && Math.min(s.start.z, s.end.z) > 0.01 && Math.max(s.start.z, s.end.z) < 34.99));

    // AND A DETACHED GARAGE IS STILL ITS OWN BUILDING -- the half of the old
    // rule that survives. Same garage, moved off the house: no row reaches
    // across the gap, and it strings its own 19 against its own edge.
    const away = rect(0, -30, 19, -23);
    const apart = strings(win, {
      points: house,
      extraOutlines: [{ points: away, garage: true }],
      extraWalls: wallsAround(away),
    });
    ok('a detached garage keeps its own stack and its own figures',
      apart.some(s => Math.abs(s.start.z - s.end.z) < 1e-6 && run(s) === 19)
      && apart.some(s => Math.abs(s.start.z - s.end.z) < 1e-6 && run(s) === 35)
      && !apart.some(s => run(s) > 36),
      apart.filter(s => Math.abs(s.start.z - s.end.z) < 1e-6).map(run).join(' '));
  }

  // ── ONE STACK PER BUILDING, THREE ROWS (Movie, 11 Oct) ──────────────
  //
  // "1st row ... edge of roof to edge of wall (showing over hang), edge of
  // wall to edge of wall / then to edge of roof again ... 2nd row out will be
  // edge of roof to edge of roofs, and then the 3rd row ... full lengeth of
  // building roof", front to back and side to side. A house roof with a
  // garage roof stepped out past its front, and a detached roof well away.
  {
    const house = { points: rect(-2, -2, 32, 22), overhang: 2 };
    const garage = { points: rect(30, 10, 50, 32), overhang: 2, garage: true };
    const shed = { points: rect(80, 0, 92, 10), overhang: 1, garage: true };
    const segs = strings(win, { roofs: [house, garage, shed] });
    const rowOf = (z, x0, x1) => segs.filter(s => Math.abs(s.start.z - z) < 1e-6 && Math.abs(s.end.z - z) < 1e-6
      && Math.min(s.start.x, s.end.x) >= x0 - 1e-6 && Math.max(s.start.x, s.end.x) <= x1 + 1e-6)
      .map(s => Math.round(Math.abs(s.end.x - s.start.x) * 100) / 100).sort((a, b) => a - b);
    const southZs = uniqOf(segs.filter(s => Math.abs(s.start.z - s.end.z) < 1e-6 && s.start.z > 32 && s.start.x < 60)
      .map(s => s.start.z));
    ok('ROOFS: the touching house and garage share one south stack of three rows',
      southZs.length === 3, `${southZs.length} rows at z ${southZs.join(', ')}`);
    const [r1, r2, r3] = southZs.map(z => rowOf(z, -2, 50));
    ok('row 1 reads both overhangs and the walls between',
      JSON.stringify(r1) === JSON.stringify([2, 2, 2, 16, 30]), JSON.stringify(r1));
    ok('row 2 reads roof edge to roof edge, the step between the roofs',
      JSON.stringify(r2) === JSON.stringify([20, 32]), JSON.stringify(r2));
    ok('row 3 is the whole building, eave to eave', JSON.stringify(r3) === JSON.stringify([52]), JSON.stringify(r3));
    ok('the detached roof keeps its own stack, not the building\'s',
      segs.some(s => Math.abs(Math.abs(s.end.x - s.start.x) - 12) < 1e-6 && Math.min(s.start.x, s.end.x) >= 80 - 1e-6)
      && !segs.some(s => Math.abs(Math.abs(s.end.x - s.start.x) - 94) < 1e-6));
  }

  // ── THE GARAGE OFF THE HOUSE'S CORNER (Movie, 11 Oct) ───────────────
  //
  // "need some dimension lines for the other side of garage too", marked
  // straight under the garage's eave. A detached garage up and to the side of
  // the house: its bottom row line lands inside the house's band for the few
  // feet the two overlap, and the rule for plans called that whole side
  // buried. On a roof plan it is the garage's own eave, so it strings -- and
  // under the garage, not pushed a building away past the house.
  {
    const house = { points: rect(0, 0, 54, 33), overhang: 2 };
    const garage = { points: rect(50, -25, 85, -1), overhang: 2, garage: true };
    const segs = strings(win, { roofs: [house, garage] });
    const under = segs.filter(s => Math.abs(s.start.z - s.end.z) < 1e-6
      && s.start.z > -1 && s.start.z < 8
      && Math.min(s.start.x, s.end.x) >= 50 - 1e-6 && Math.max(s.start.x, s.end.x) <= 85 + 1e-6);
    ok('GARAGE: its own south side strings, right under its eave',
      under.some(s => Math.abs(Math.abs(s.end.x - s.start.x) - 35) < 1e-6),
      under.map(s => `${s.start.z}:${Math.abs(s.end.x - s.start.x)}`).join(' '));
    ok('the house\'s own stacks keep their place past the garage',
      segs.some(s => Math.abs(Math.abs(s.end.x - s.start.x) - 54) < 1e-6 && s.start.z < -25));
    // A garage TUCKED against the house face, most of its run behind the
    // house: that side is still buried and still strings nothing.
    const tucked = { points: rect(10, 33, 40, 55), overhang: 2, garage: true };
    const tSegs = strings(win, { roofs: [house, tucked] });
    ok('a garage side mostly behind the house still strings nothing',
      !tSegs.some(s => Math.abs(s.start.z - s.end.z) < 1e-6 && s.start.z > 33 - 8 && s.start.z < 33
        && Math.abs(Math.abs(s.end.x - s.start.x) - 30) < 1e-6));
  }

  // ── THE INTERIOR STRING ───────────────────────────────────────────────
  //
  // Both faces of every wall that CROSSES this side's string and reaches it.
  // On the bare 36 x 66 house the only such walls are the two exterior ones,
  // so the north string reads: half a foot of wall, the clear span, half a
  // foot of wall.
  const intOn = segs => segs.filter(s => s.layer === AD.DIM_LAYERS.INTERIOR);
  const northRun = segs => uniqOf(intOn(segs)
    .filter(s => Math.abs(s.start.z - s.end.z) < 0.01 && s.start.z < 0)
    .flatMap(s => [s.start.x, s.end.x]));

  const bare = northRun(plain);
  ok('the interior string reaches the faces of both exterior walls',
    bare.length === 4, bare.map(v => v.toFixed(2)).join(' '));
  const bareRuns = bare.slice(1).map((v, i) => v - bare[i]);
  ok('so it reads wall, clear span, wall', bareRuns.length === 3
    && Math.abs(bareRuns[0] - WALL_FT) < 0.02
    && Math.abs(bareRuns[1] - (36 - WALL_FT)) < 0.02
    && Math.abs(bareRuns[2] - WALL_FT) < 0.02,
    bareRuns.map(v => v.toFixed(2)).join(' '));

  // A PARTITION EARNS ITS PLACE BY REACHING THE SIDE. One touching the north
  // wall lands on the north string; one down at the south end does not.
  const nearNorth = { start: { x: 12, z: 0 }, end: { x: 12, z: 20 } };
  const nearSouth = { start: { x: 24, z: 50 }, end: { x: 24, z: 66 } };
  const withBoth = strings(win, { extraWalls: [nearNorth, nearSouth] });
  const northWith = northRun(withBoth);
  ok('a partition meeting the north wall lands on the north string',
    northWith.some(v => Math.abs(v - 11.75) < 0.02)
    && northWith.some(v => Math.abs(v - 12.25) < 0.02),
    northWith.map(v => v.toFixed(2)).join(' '));
  ok('and a partition down at the south end does not',
    !northWith.some(v => Math.abs(v - 24) < 0.5),
    northWith.map(v => v.toFixed(2)).join(' '));
  ok('both its faces land, so the wall thickness is a figure on the sheet',
    northWith.length === 6, `${northWith.length} coordinates`);

  // ── AT THE BOUNDARY, BOTH SIDES OF IT ──────────────────────────────────
  //
  // Devin, 29 Sep: "'reaches within 4 ft of this side' makes INT's output
  // depend on a tolerance rather than on a stored fact, so two walls a hair
  // over 4 ft apart will silently drop a partition -- worth a harness case
  // sitting right on the boundary, both sides of it."
  //
  // Right: the two cases above stand at reach 0 and reach 50, which prove
  // the rule exists and say nothing about WHERE it cuts. A rule that fired
  // at 40 ft, or at one inch, passes both of them. These two are a tenth of
  // a foot either side of the line, so only a cut at 4 ft passes both.
  const atReach = z0 => ({ start: { x: 8, z: z0 }, end: { x: 8, z: 20 } });
  const inAt = northRun(strings(win, { extraWalls: [atReach(3.9)] }));
  const outAt = northRun(strings(win, { extraWalls: [atReach(4.1)] }));
  ok('a partition reaching 3.9 ft from the side is on the string',
    inAt.some(v => Math.abs(v - 7.75) < 0.02) && inAt.some(v => Math.abs(v - 8.25) < 0.02),
    inAt.map(v => v.toFixed(2)).join(' '));
  ok('and one reaching 4.1 ft from it is not',
    !outAt.some(v => Math.abs(v - 8) < 0.5),
    outAt.map(v => v.toFixed(2)).join(' '));

  // WITHOUT THE THICKNESS TABLE THERE IS NO STRING, rather than a centreline
  // pretending to be a face.
  ok('no thickness table means no interior string at all',
    intOn(strings(win, { faces: false })).length === 0);
  ok('and the other four kinds still come through without it',
    strings(win, { faces: false }).length > 0);

  // ── THE COLUMN STACK ──────────────────────────────────────────────────
  //
  // A beam down the middle of the 36 x 66 house with two posts under it. The
  // numbers are chosen so every claim below can be MEASURED rather than
  // counted: posts at 12 and 24 inside a house 0..36 means the along string
  // reads 12, 12, 12 and the across string reads 33, 33.
  // THE BEAM STOPS SHORT OF THE HOUSE EDGE, at the wall's inner face, which
  // is where a beam actually bears. It ran 0 to 36 -- exactly the edges --
  // until the mutation table caught what that hid: measuring from the beam's
  // own ends and measuring from the house edge gave the SAME answer, so the
  // check could not tell them apart and the mutation walked through it. Half
  // a foot of wall at each end is the whole difference, and it is a figure a
  // framer needs.
  const BEAM = { id: 1, start: { x: 0.5, z: 33 }, end: { x: 35.5, z: 33 } };
  const POSTS = [
    { id: 1, point: { x: 12, z: 33 } },
    { id: 2, point: { x: 24, z: 33 } },
  ];
  const colStrings = (over = {}) => AD.computeColumnDimStrings({
    beams: [BEAM], columns: POSTS, outlines: [{ points: HOUSE, garage: false }],
    walls: wallsAround(HOUSE), floorOpenings: [], ...over,
  });

  const cols = colStrings();
  ok('a beam with posts under it strings something', cols.length > 0,
    `${cols.length} segments`);
  ok('every column segment is tagged A-DIMS-COLS',
    cols.length > 0 && cols.every(s => s.layer === AD.DIM_LAYERS.COLUMNS),
    [...new Set(cols.map(s => s.layer))].join(','));

  // ALONG: runs on x, so z is constant and the x coordinates are the posts
  // plus BOTH house edges. Movie: "each column and then the ext edge where
  // the beams sit".
  const alongSegs = cols.filter(s => Math.abs(s.start.z - s.end.z) < 0.01);
  const alongX = uniqOf(alongSegs.flatMap(s => [s.start.x, s.end.x]));
  ok('the along string starts at the house edge, not where the beam ends',
    alongX.length > 0 && Math.abs(alongX[0]) < 0.02
    && Math.abs(alongX[0] - 0.5) > 0.02, String(alongX[0]));
  ok('the along string runs from one house edge to the other',
    alongX.length && Math.abs(alongX[0] - 0) < 0.02
    && Math.abs(alongX[alongX.length - 1] - 36) < 0.02, alongX.join(','));
  ok('and stops at each post on the way',
    alongX.some(v => Math.abs(v - 12) < 0.02) && alongX.some(v => Math.abs(v - 24) < 0.02),
    alongX.join(','));
  // MEASURED, NOT COUNTED. A string of the right shape with the wrong figures
  // is the bug this catches: 0-12-24-36 reads 12, 12, 12.
  const alongRuns = [];
  for (let i = 0; i < alongX.length - 1; i++) alongRuns.push(alongX[i + 1] - alongX[i]);
  ok('so every figure on it is 12 ft', alongRuns.length === 3
    && alongRuns.every(v => Math.abs(v - 12) < 0.02),
    alongRuns.map(v => v.toFixed(2)).join(' '));
  ok('the along string sits one foot off the beam, not on it',
    alongSegs.length > 0
    && alongSegs.every(s => Math.abs(Math.abs(s.start.z - 33) - 1) < 0.01),
    [...new Set(alongSegs.map(s => s.start.z))].join(','));

  // NOTHING CROSSES THE FLOOR AT A POST (Movie, 11 Oct, the 14'-6" strings
  // he struck out): the beam's own position rides the perimeter instead.
  const acrossSegs = cols.filter(s => Math.abs(s.start.x - s.end.x) < 0.01);
  ok('no column string crosses the floor any more', acrossSegs.length === 0,
    `${acrossSegs.length} segments`);
  // ONE ROW FOR A LINE LAID IN PIECES ("only need 1 mark for beams (if the
  // beams are lined up)").
  const pieces = colStrings({ beams: [
    { id: 1, start: { x: 0.5, z: 33 }, end: { x: 12, z: 33 } },
    { id: 2, start: { x: 12, z: 33 }, end: { x: 24, z: 33 } },
    { id: 3, start: { x: 24, z: 33 }, end: { x: 35.5, z: 33 } }] });
  ok('three pieces on one line string one row, not three',
    uniqOf(pieces.map(s => s.start.z)).length === 1 && pieces.length === 3,
    `${pieces.length} segments at z ${uniqOf(pieces.map(s => s.start.z)).join(',')}`);
  // THE BEAM'S POSITION ON THE OUTSIDE, closest in, on the right side.
  const withBeam = AD.computeAutoDimStrings({
    walls: wallsAround(HOUSE), outlines: [{ points: HOUSE, garage: false }], roofs: [], openings: [],
    offsetOutline: (pts, dist) => G.offsetOutline(pts, dist), firstOffset: 1.5,
    jogMergeFt: AD.JOG_MERGE_FT, stringSpacingFt: AD.STRING_SPACING_FT, beams: [BEAM],
  }) || [];
  const beamRow = withBeam.filter(s => s.layer === AD.DIM_LAYERS.COLUMNS);
  ok('the beam line is located on the outside of the plan, one row on the right',
    beamRow.length === 2 && beamRow.every(s => s.start.x > 36 && Math.abs(s.start.x - s.end.x) < 0.01)
    && uniqOf(beamRow.flatMap(s => [s.start.z, s.end.z])).join(',') === '0,33,66',
    beamRow.map(s => `${s.start.x.toFixed(1)}:${s.start.z}-${s.end.z}`).join(' '));
  const eastXs = uniqOf(withBeam.filter(s => s.start.x > 36).map(s => s.start.x));
  ok('and it is the row closest to the building', eastXs.length > 1
    && beamRow.every(s => Math.abs(s.start.x - eastXs[0]) < 1e-6), eastXs.join(','));

  // BOTH DIRECTIONS, because "it strings the posts" is half a claim.
  ok('no beams means no column strings', colStrings({ beams: [] }).length === 0);
  ok('no posts means no column strings', colStrings({ columns: [] }).length === 0);
  // A post standing off this beam's line is not this beam's post -- otherwise
  // a parallel beam's posts print a figure against a member they do not touch.
  ok('a post that is not on the beam does not join its string',
    colStrings({ columns: [{ id: 9, point: { x: 18, z: 10 } }] }).length === 0);
  ok('a post on the beam DOES, so the check above reads the line and not the count',
    colStrings({ columns: [{ id: 9, point: { x: 18, z: 33 } }] }).length > 0);

  // THE STAIR HOLE PUSHES IT OVER. Movie: "on a side that doesn't have stair
  // hole". Asserted by WHICH SIDE it lands on, in both directions.
  const holeAt = z0 => [{ points: [
    { x: 10, z: z0 }, { x: 20, z: z0 }, { x: 20, z: z0 + 8 }, { x: 10, z: z0 + 8 }] }];
  const colsOnly = list => list.filter(s => s.layer === AD.DIM_LAYERS.COLUMNS);
  const pushedUp = colsOnly(colStrings({ floorOpenings: holeAt(34) }))
    .filter(s => Math.abs(s.start.z - s.end.z) < 0.01);
  ok('a hole on the far side of the beam puts the along string on the near side',
    pushedUp.length > 0 && pushedUp.every(s => s.start.z < 33),
    [...new Set(pushedUp.map(s => s.start.z))].join(','));
  // AND ITS LINE STANDS OFF THAT WAY TOO: the screen draws a string to its
  // left-hand normal, so a row placed clear of the hole runs the way that
  // keeps the drawn line clear of it (+x stands off to +z).
  ok('the row placed clear of the hole is drawn standing away from the beam',
    pushedUp.length > 0 && pushedUp.every(s => s.start.x > s.end.x),
    pushedUp.map(s => `${s.start.x}>${s.end.x}`).join(' '));
  const pushedDown = colsOnly(colStrings({ floorOpenings: holeAt(25) }))
    .filter(s => Math.abs(s.start.z - s.end.z) < 0.01);
  // This one is the case the first margin got wrong: a hole whose edge IS the
  // beam line. Both sides looked blocked and the beam got no string at all.
  ok('a hole running up to the beam puts the string on its other side',
    pushedDown.length > 0 && pushedDown.every(s => s.start.z > 33),
    [...new Set(pushedDown.map(s => s.start.z))].join(','));

  // CLEAR OF THE TEXT ALREADY THERE (Movie, 11 Oct: "not overlapping other
  // text"). The beam's own tag sits on its -across side and a pile's footing
  // tag under its post, so the string stands further out on a tagged side.
  {
    const zOf = list => uniqOf(colsOnly(list).filter(s => Math.abs(s.start.z - s.end.z) < 0.01).map(s => s.start.z));
    // RE-AIMED (16 Oct): the beam's own tag follows the string to the OTHER
    // side now (render-2d beamTagSides), so a string forced onto the old tag
    // side keeps its foot -- it is not standing clear of text that moved.
    ok('forced onto the beam tag\'s old side, the string keeps its foot (the tag moves)',
      zOf(colStrings({ floorOpenings: holeAt(34) })).join(',') === '32',
      zOf(colStrings({ floorOpenings: holeAt(34) })).join(','));
    const piled = POSTS.map(post => ({ ...post, footing: 'pile12' }));
    ok('posts on piles push the string past their footing tags',
      zOf(colStrings({ columns: piled })).join(',') === String(33 + AD.TAG_CLEAR_FT),
      zOf(colStrings({ columns: piled })).join(','));
    ok('an untagged side keeps its foot', zOf(colStrings()).join(',') === '34', zOf(colStrings()).join(','));
  }

  // THE STAIR OPENING, BOTH WAYS (Movie, 11 Oct): ext wall to opening,
  // opening, opening to the far ext wall, about a foot off the opening and
  // on the side away from a beam beside it.
  {
    const hole = holeAt(34);
    const opening = colStrings({ floorOpenings: hole }).filter(s => s.layer === AD.DIM_LAYERS.INTERIOR);
    const xRun = opening.filter(s => Math.abs(s.start.z - s.end.z) < 0.01);
    const zRun = opening.filter(s => Math.abs(s.start.x - s.end.x) < 0.01);
    ok('the opening is strung across: wall, opening, opening, wall',
      uniqOf(xRun.flatMap(s => [s.start.x, s.end.x])).join(',') === '0,10,20,36',
      uniqOf(xRun.flatMap(s => [s.start.x, s.end.x])).join(','));
    ok('a foot and a quarter off the opening, on the side away from the beam',
      xRun.length && xRun.every(s => Math.abs(s.start.z - 43.25) < 1e-6),
      uniqOf(xRun.map(s => s.start.z)).join(','));
    ok('and along: wall, opening, opening, wall',
      uniqOf(zRun.flatMap(s => [s.start.z, s.end.z])).join(',') === '0,34,42,66'
      && zRun.every(s => Math.abs(s.start.x - 8.75) < 1e-6),
      zRun.map(s => `${s.start.x}:${s.start.z}-${s.end.z}`).join(' '));
    const noBeam = AD.computeColumnDimStrings({ beams: [], columns: [],
      outlines: [{ points: HOUSE, garage: false }], walls: wallsAround(HOUSE), floorOpenings: hole });
    ok('an opening on a floor with no beams is still dimensioned (the 2ND FLOOR)',
      noBeam.length === 6, `${noBeam.length} segments`);
  }

  // ── OUTSIDE THE PLAN WHEN THE OPENING HUGS THE WALL (Movie, 16 Oct) ──────
  // "the stair opening's dims OUTSIDE the plan when the opening is within 3
  // ft of the exterior wall's outside perimeter line, INSIDE when farther."
  // A 36 x 66 house, the hole 10..20 across and 2 ft short of the far wall
  // (z 56..64): its across string cannot fit between hole and wall, so it
  // goes out past the perimeter stack on that side. Its along string (the
  // z run) is 10 ft from either side wall and stays inside.
  {
    const hugging = holeAt(56);
    const stack = [
      { start: { x: 0, z: 67.5 }, end: { x: 36, z: 67.5 }, layer: 'A-DIMS-OVR' },
      { start: { x: 0, z: 69 }, end: { x: 36, z: 69 }, layer: 'A-DIMS-COLS' },
      { start: { x: -1.5, z: 0 }, end: { x: -1.5, z: 66 }, layer: 'A-DIMS-OVR' }];
    const out = AD.computeColumnDimStrings({ beams: [], columns: [],
      outlines: [{ points: HOUSE, garage: false }], walls: wallsAround(HOUSE),
      floorOpenings: hugging, perimeter: stack, firstOffsetFt: 1.5, stringSpacingFt: 1.5 });
    const xRun = out.filter(s => Math.abs(s.start.z - s.end.z) < 0.01);
    const zRun = out.filter(s => Math.abs(s.start.x - s.end.x) < 0.01);
    ok('an opening 2 ft from the wall is strung OUTSIDE the plan, past that wall',
      xRun.length === 3 && xRun.every(s => s.start.z > 66), uniqOf(xRun.map(s => s.start.z)).join(','));
    ok('one row past the stack already outside on that side (69 + 1.5)',
      xRun.every(s => Math.abs(s.start.z - 70.5) < 1e-6), uniqOf(xRun.map(s => s.start.z)).join(','));
    ok('and it still reads wall, opening, opening, wall',
      uniqOf(xRun.flatMap(s => [s.start.x, s.end.x])).join(',') === '0,10,20,36',
      uniqOf(xRun.flatMap(s => [s.start.x, s.end.x])).join(','));
    ok('its stand-off points away from the house',
      xRun.every(s => s.start.x < s.end.x), xRun.map(s => `${s.start.x}>${s.end.x}`).join(' '));
    ok('the run that is 10 ft from its walls stays inside',
      zRun.length === 3 && zRun.every(s => s.start.x > 0 && s.start.x < 36),
      uniqOf(zRun.map(s => s.start.x)).join(','));
    const bare = AD.computeColumnDimStrings({ beams: [], columns: [],
      outlines: [{ points: HOUSE, garage: false }], walls: wallsAround(HOUSE),
      floorOpenings: hugging, firstOffsetFt: 1.5 });
    const bareX = bare.filter(s => Math.abs(s.start.z - s.end.z) < 0.01);
    ok('with no stack outside, the first offset off the wall',
      bareX.every(s => Math.abs(s.start.z - 67.5) < 1e-6), uniqOf(bareX.map(s => s.start.z)).join(','));
    // EXACTLY 3 FT IS STILL HUGGING; 3 ft and an inch is inside (Movie's own
    // number, read as the boundary it is).
    const atThree = AD.computeColumnDimStrings({ beams: [], columns: [],
      outlines: [{ points: HOUSE, garage: false }], walls: wallsAround(HOUSE),
      floorOpenings: holeAt(55), firstOffsetFt: 1.5 })
      .filter(s => Math.abs(s.start.z - s.end.z) < 0.01);
    ok('an opening exactly 3 ft from the wall goes outside',
      atThree.every(s => s.start.z > 66), uniqOf(atThree.map(s => s.start.z)).join(','));
    const farther = AD.computeColumnDimStrings({ beams: [], columns: [],
      outlines: [{ points: HOUSE, garage: false }], walls: wallsAround(HOUSE),
      floorOpenings: holeAt(54.9), firstOffsetFt: 1.5 })
      .filter(s => Math.abs(s.start.z - s.end.z) < 0.01);
    ok('an opening farther than 3 ft from the wall stays inside',
      farther.every(s => s.start.z < 66), uniqOf(farther.map(s => s.start.z)).join(','));
  }

  // ── THE FORMAT KEEPS IT ───────────────────────────────────────────────────
  // The link that would otherwise lose everything above on the next save.
  const through = layer => {
    const out = DF.dimensions([{
      id: 1, start: { x: 0, y: 0, z: 0 }, end: { x: 36, y: 0, z: 0 },
      levelId: 3, view: 'plan', layer, auto: true,
    }], new Set([3]), {});
    return out.length ? out[0] : null;
  };
  // THE FIVE AUTO-DIMS EMITS, AND A-DIMS-HAND (18 Oct), the DIMENSION tool's
  // own strings -- no auto-dims kind, but a record may claim it and STANDARDS
  // must switch it like the rest.
  const ALL_FIVE = ['A-DIMS-OVR', 'A-DIMS-EXT', 'A-DIMS-INT', 'A-DIMS-FENS', 'A-DIMS-COLS', 'A-DIMS-HAND'];
  ALL_FIVE.forEach(layer => {
    const back = through(layer);
    ok(`${layer} survives a round trip through the format`,
      back && back.layer === layer, back ? String(back.layer) : 'dropped');
  });
  ok('a hand string stays a hand string: auto is false through the format',
    DF.dimensions([{ id: 2, start: { x: 0, y: 0, z: 0 }, end: { x: 9, y: 0, z: 0 }, levelId: 3,
      view: 'plan', layer: 'A-DIMS-HAND', auto: false }], new Set([3]), {})[0]?.auto === false);
  // THE KEY'S ABSENCE, NOT ITS VALUE, and that distinction cost a red shard.
  // These read `=== null` until write-tier.spec.js caught what that meant on
  // the way OUT: a null is still a key, the old page writes no such key, and
  // that spec compares the two pages' saves byte for byte. Asking "is it
  // null" cannot tell a key that is absent from one that is present and
  // empty, so it passed against the build that broke the round trip.
  const wrote = layer => {
    const back = through(layer);
    return back ? Object.prototype.hasOwnProperty.call(back, 'layer') : null;
  };
  ok('a layer the format does not know is not written at all',
    wrote('A-DIMS-NOPE') === false, String(through('A-DIMS-NOPE')?.layer));
  ok('a dimension written before layers existed gains no layer key',
    wrote(undefined) === false, String(through(undefined)?.layer));
  ok('a real layer IS written, so the check above is reading the key',
    wrote('A-DIMS-OVR') === true);

  // ── THE THREE LISTS AGREE ─────────────────────────────────────────────────
  // Devin, 29 Sep, asked for exactly this: "a harness check per entity type so
  // the next entity can't quietly join the untagged list". A rename in any one
  // of the three files silently unswitches a dimension -- it would still draw,
  // and its tick would still be there, and the tick would do nothing.
  const table = LS.normaliseLayerStandards(null);
  // TWO DIFFERENT FIELDS, AND THE FIRST CHECK HERE TESTED THE WRONG ONE.
  // `visible` is the STATE and normaliseLayerStandards defaults it to true for
  // every layer in the table, so `table[layer].visible === true` is satisfied
  // by any layer at all -- it passed just as happily with the flag deleted.
  // `visibility` is the one that matters: it is the raw table's own field, and
  // STANDARDS.html renders a Visible tick only where it is true. Without it a
  // dimension layer gets a blank cell and the drafter has no switch, which is
  // the entire feature. Caught by the mutation that removed it and was not
  // noticed -- a check green by default, which is what this file is about.
  const flat = LS.DEFAULT_LAYER_STANDARDS.flatMap(group => group.layers);
  const rawOf = id => flat.find(layer => layer.id === id) || null;
  ALL_FIVE.forEach(layer => {
    ok(`${layer} is in the standards table`, !!table[layer]);
    ok(`${layer} offers a Visible tick in STANDARDS`, rawOf(layer)?.visibility === true,
      String(rawOf(layer)?.visibility));
  });
  // And the control: a layer that is NOT meant to offer one still does not, so
  // the check above is reading the flag rather than reporting true for
  // everything the way its predecessor did.
  ok('a layer with no visibility flag offers no tick',
    rawOf('A-WALL-EXT') && rawOf('A-WALL-EXT').visibility !== true);
  Object.values(AD.DIM_LAYERS).forEach(layer => {
    ok(`auto-dims emits ${layer}, and the standards table carries it`, !!table[layer]);
  });
  ok('the four view-scoped dimension layers are retired',
    !table['PLAN DIMENSION'] && !table['FLOOR DIMENSION']
    && !table['FOUNDATION DIMENSION'] && !table['E-POWER DIMENSION']);

  // ── THE GATE HAS ITS HANDLE ───────────────────────────────────────────────
  // layout-plan.js is the one wiring both sheet pages paint through. The spy
  // replaces the composer and reads the env it is handed, which is the only
  // thing under test here -- whether the standards reach the gate at all.
  const LP = win.DraftLayoutPlan;
  ok('layout-plan is loaded', !!LP);
  if (LP) {
    let handed = null;
    win.DraftPlanComposition = { drawPlan: (ctx, toS, env) => { handed = env; return true; } };
    const saved = {
      levels: [{ id: 3, name: 'MAIN FL' }],
      walls: wallsAround(HOUSE).map((w, i) => ({
        id: i + 1, levelId: 3, view: 'plan', start: w.start, end: w.end,
        thickness: 0.5, topHeight: 8,
      })),
      dimensions: [], fenestrations: [], floors: [], roofs: [],
      shapes: [], lines: [], notes: [],
    };
    const ctx = new Proxy({}, { get: () => () => {} });
    LP.drawPlan(ctx, { x: v => v, y: v => v, s: v => v }, saved, 3, { view: 'plan' });
    ok('layout-plan reached the composer at all', handed !== null);
    ok('layout-plan hands the composer a layerStandard lookup',
      typeof handed?.layerStandard === 'function', typeof handed?.layerStandard);
    if (typeof handed?.layerStandard === 'function') {
      ok('the lookup answers for a dimension layer',
        handed.layerStandard('A-DIMS-OVR')?.visible === true,
        JSON.stringify(handed.layerStandard('A-DIMS-OVR')));
      ok('the lookup answers null for a layer nobody defined, so it draws',
        handed.layerStandard('A-DIMS-NOPE') === null);
    }
  }

  // ── THE ELEVATION'S ENV CARRIES THE TICKS TOO ───────────────────────────
  //
  // cut-view-env.js is the shared env EXTFINISH and LAYOUT hand the elevation
  // painter, and it is a different file from the one harness-env.js builds --
  // so the painting section below, which supplies its own layerStandard,
  // cannot say a word about whether the real pages supply one. This does.
  const CVE = win.DraftCutViewEnv;
  ok('cut-view-env is loaded', !!CVE);
  if (CVE) {
    const elevEnv = CVE.buildCutViewEnv({
      levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
      walls: wallsAround(HOUSE).map((w, i) => ({
        id: i + 1, levelId: 3, view: 'plan', start: w.start, end: w.end,
        thickness: 0.5, topHeight: 8,
      })),
      fenestrations: [], floors: [], roofs: [], columns: [], beams: [],
      dimensions: [], shapes: [], lines: [], notes: [], stairs: [],
    }, [{ id: 3, name: 'MAIN FL', elev: 0 }]);
    ok('cut-view-env builds an env at all', !!elevEnv);
    ok('cut-view-env hands the painter a layerStandard lookup',
      typeof elevEnv?.layerStandard === 'function', typeof elevEnv?.layerStandard);
    ok('that lookup answers for the window size layer',
      elevEnv?.layerStandard?.('A-DIMS-WIN')?.visible === true,
      JSON.stringify(elevEnv?.layerStandard?.('A-DIMS-WIN')));
    ok('and still for the corner string it was split from',
      elevEnv?.layerStandard?.('A-DIMS-FENS')?.visible === true,
      JSON.stringify(elevEnv?.layerStandard?.('A-DIMS-FENS')));
  }

  // ── AND THE SAME LAYER ON THE ELEVATION ─────────────────────────────────
  //
  // Movie, 29 Sep: "can we make the window number get layer A-DIMS-FENS so
  // the user can turn them off in ELEVATION views if desired".
  //
  // A size tag is what the elevation says instead of an opening-centre
  // string, so it rides the same layer and one tick takes both. Painted
  // rather than reasoned about: the claim is that the TAG LEAVES THE SHEET,
  // and only a painter can answer that.
  //
  // This section borrows harness-env.js because building an elevation by hand
  // -- level stack, cut, axis, extents -- is that file's whole job, and a
  // second copy is what this repo keeps paying for. It READS it and edits
  // nothing in proto/, so it does not collide with the mutation-table patch
  // landing there.
  //
  // AND IT IS THE ONE SECTION THE MUTATION TABLE CANNOT REACH, said here
  // rather than left to look as proven as the rest: harness-env's loader
  // takes no source hook, so a mutation to cut-view.js does not reach the
  // modules these checks run against. The gate was proved by hand instead --
  // deleting `&& showFenTags` leaves 12 tags where 0 are expected, which is
  // every window in the fixture. Wiring a source hook into that loader is the
  // fix, and it belongs in harness-env.js rather than here.
  const HE = require('./harness-env.js');
  const saved = JSON.parse(fs.readFileSync(path.join(ROOT, 'proto',
    'repro-washroom-bungalow.draft'), 'utf8'));
  const ev = HE.loadDraftModules();
  const env = HE.buildEnv(ev, saved);
  // ALL FOUR ELEVATIONS, not a chosen one: which side a given window lands on
  // is a fact about the fixture, and a check pinned to E1 would go quiet the
  // day someone moved a window rather than going red.
  const cuts = HE.standardElevationCuts(env);
  // A size tag is two numbers around an X, which is the shape fen-labels
  // prints and nothing else on an elevation does.
  const isTag = t => /\d+\s*[Xx]\s*\d+/.test(String(t && t.text));
  const paint = layerStandard => {
    const use = layerStandard === undefined ? env : { ...env, layerStandard };
    return cuts.map(cut => HE.paintElevation(ev, use, cut))
      .reduce((all, out) => ({
        tags: all.tags + (out.texts || []).filter(isTag).length,
        strokes: all.strokes + (out.strokes || []).length,
      }), { tags: 0, strokes: 0 });
  };
  const tagsIn = out => ({ length: out.tags });

  const shown = paint(undefined);
  // THE FIXTURE'S REACH AGAIN. 12 windows in this drawing, and if none of
  // them tags on E1 then "hiding the layer removed the tags" is a claim about
  // an empty sheet -- which is exactly how the plan's own tag hid behind a
  // guard through four screenshots.
  ok('the elevation paints window size tags to begin with', tagsIn(shown).length > 0,
    `${tagsIn(shown).length} tags`);
  // A SIZE IS NOT A LOCATION, and until 30 Sep both rode A-DIMS-FENS. Movie:
  // *"i think i put them on layer A-DIMS-FENS but if i want to turn of the
  // outside line dimensions and leave the window sizes on i won't be able
  // too"*. So the tag moved to A-DIMS-WIN and A-DIMS-FENS kept what its name
  // says -- the exterior string locating centres from the corners.
  //
  // THE STUB ANSWERS PER ID NOW. It took one standard for every layer, which
  // could not express the question this section exists to answer: with the
  // corner string hidden and the sizes ticked, the sheet must still carry
  // every tag. A lookup that answers the same for both layers passes that
  // check by accident.
  const standardsWhere = hidden => id => ({
    name: id, visible: !hidden.includes(id), printable: true,
  });

  const hidden = paint(standardsWhere(['A-DIMS-WIN']));
  ok('unticking A-DIMS-WIN takes every size tag off the elevation',
    tagsIn(hidden).length === 0, `${tagsIn(hidden).length} left`);
  const ticked = paint(standardsWhere([]));
  ok('ticking it puts them back', tagsIn(ticked).length === tagsIn(shown).length,
    `${tagsIn(ticked).length} vs ${tagsIn(shown).length}`);

  // THE WHOLE POINT OF THE SPLIT, and the check that is red until the tag
  // stops reading A-DIMS-FENS: the corner string goes, the sizes stay.
  const fensOff = paint(standardsWhere(['A-DIMS-FENS']));
  ok('dropping the corner string leaves every window size on the elevation',
    tagsIn(fensOff).length === tagsIn(shown).length,
    `${tagsIn(fensOff).length} of ${tagsIn(shown).length} tags survived`);
  // The windows themselves are not on that layer and must not follow the tag
  // off the sheet -- hiding a DIMENSION layer that took the glass with it
  // would be a far worse bug than the one this fixes.
  ok('the windows still draw when their size tags are hidden',
    hidden.strokes === shown.strokes,
    `${hidden.strokes} vs ${shown.strokes} strokes`);
  // NO STANDARD DRAWS, the same way an untagged dimension does: a page that
  // never wired a profile has not hidden anything.
  ok('an elevation with no layer standard still tags its windows',
    tagsIn(paint(() => null)).length === tagsIn(shown).length);

  return { win, warnings };
}

run();
console.log(`dim-layers-harness: ${checks - failures}/${checks} checks passed, ${failures} failed`);
if (!MUTATE) process.exit(failures ? 1 : 0);
if (failures) {
  console.error('dim-layers-harness: checks are red, so the mutation table would be meaningless');
  process.exit(1);
}

// ── MUTATIONS ───────────────────────────────────────────────────────────────
//
// Each breaks one link of the chain in memory and asserts the checks go red.
// A mutation that makes a file UNPARSEABLE is reported INVALID rather than
// caught: it would fail every check for the wrong reason, which is the exact
// miscount Devin found in harness-env.js on 29 Sep.
const MUTATIONS = [
  ['the overall is tagged exterior detail on a roofed stack',
    'auto-dims.js', c => c.replace(
      `          }\n          strings.push({ coords: [lo, hi], layer: DIM_LAYERS.OVERALL });`,
      `          }\n          strings.push({ coords: [lo, hi], layer: DIM_LAYERS.EXTERIOR });`)],
  ['the overall is tagged exterior detail on a walls stack',
    'auto-dims.js', c => c.replace(
      `if (jogCoords.length > 2) strings.push({ coords: jogCoords, layer: DIM_LAYERS.EXTERIOR });\n          strings.push({ coords: [lo, hi], layer: DIM_LAYERS.OVERALL });`,
      `if (jogCoords.length > 2) strings.push({ coords: jogCoords, layer: DIM_LAYERS.EXTERIOR });\n          strings.push({ coords: [lo, hi], layer: DIM_LAYERS.EXTERIOR });`)],
  ['opening centres are tagged overall',
    'auto-dims.js', c => c.replace('layer: DIM_LAYERS.FENESTRATION', 'layer: DIM_LAYERS.OVERALL')],
  ['the jog string loses its layer',
    'auto-dims.js', c => c.replace(
      'strings.push({ coords: jogCoords, layer: DIM_LAYERS.EXTERIOR })',
      'strings.push({ coords: jogCoords, layer: null })')],
  ['the segment is built without carrying the layer',
    'auto-dims.js', c => c.replace('            layer: string.layer,\n', '')],
  // THE TOLERANCE ITSELF. Devin's point in mutation form: if the 4 ft can
  // move to 40 and no check goes red, the two boundary cases above are
  // decoration. This is what makes them load-bearing.
  ['the partition reach widens from 4 ft to 40',
    'auto-dims.js', c => c.replace(
      'const PARTITION_REACH_FT = 4;', 'const PARTITION_REACH_FT = 40;')],
  ['the partition reach narrows to an inch',
    'auto-dims.js', c => c.replace(
      'const PARTITION_REACH_FT = 4;', 'const PARTITION_REACH_FT = 0.08;')],
  ['the interior string measures centrelines instead of faces',
    'auto-dims.js', c => c.replace(
      'const offsets = faceOffsets(wall, thicknessFt(wall));',
      'const offsets = { startOff: 0, endOff: 0 };')],
  ['only one face of each wall is strung',
    'auto-dims.js', c => c.replace(
      "        coords.push(wall.start[along] + normal[along] * offsets.endOff);\n", '')],
  ['every partition lands on every side, however far away',
    'auto-dims.js', c => c.replace(
      'if (reach > PARTITION_REACH_FT) return;', '')],
  ['walls parallel to the string join it too',
    'auto-dims.js', c => c.replace(
      "        if (Math.abs(u[across]) < 0.9) return;\n", '')],
  ['the interior string is never emitted',
    'auto-dims.js', c => c.replace(
      'if (faceCoords.length >= 2) {', 'if (false) {')],
  ['a missing thickness table falls back to the stored line',
    'auto-dims.js', c => c.replace(
      'if (!thicknessFt || !faceOffsets) return [];', '')],
  ['the along string measures from the beam ends, not the house edge',
    'auto-dims.js', c => c.replace(
      'emit(along, [edge[along][0], ...inner, edge[along][1]], fixed + side * distOf(side),',
      'emit(along, [runLo, ...inner, runHi], fixed + side * distOf(side),')],
  // CLEAR OF THE TAGS (Movie, 11 Oct: "not overlapping other text").
  ['a column string stands a foot off a tagged side, on top of the tag',
    'auto-dims.js', c => c.replace(
      '(tagged(direction) ? Math.max(clearFt, TAG_CLEAR_FT) : clearFt)', 'clearFt')],
  ['a pile\'s footing tag is not counted as text in the way',
    'auto-dims.js', c => c.replace('&& along === \'x\' && hasPile', '&& false')],
  ['the column strings sit on the beam instead of clear of it',
    'auto-dims.js', c => c.replace(
      'clearFt = COLUMN_CLEAR_FT,', 'clearFt = 0,')],
  // RE-AIMED (11 Oct): the across string is gone; the beam line rides the
  // perimeter stack now, and these are the rules that replaced it.
  ['the beam line is not located on the outside of the plan',
    'auto-dims.js', c => c.replace(
      "strings.push({ coords: uniqSorted([lo, ...beamCoords, hi]), layer: DIM_LAYERS.COLUMNS });", '')],
  ['beam pieces on one line string a row each again',
    'auto-dims.js', c => c.replace(
      'if (line) { line.lo = Math.min(line.lo, lo); line.hi = Math.max(line.hi, hi); }\n      else lines.push',
      'lines.push')],
  // OUTSIDE THE PLAN (Movie, 16 Oct).
  ['an opening hugging the wall is strung inside anyway',
    'auto-dims.js', c => c.replace(
      'const hug = order.find(index => hugs[index]);', 'const hug = undefined;')],
  ['the outside string lands on the perimeter stack instead of past it',
    'auto-dims.js', c => c.replace(
      'const off = beyond.length ? Math.max(...beyond) + stringSpacingFt : firstOffsetFt;',
      'const off = firstOffsetFt;')],
  ['the hugging reach widens from 3 ft to 30',
    'auto-dims.js', c => c.replace('const OPENING_OUTSIDE_FT = 3;', 'const OPENING_OUTSIDE_FT = 30;')],
  ['the hugging reach narrows to 2 ft',
    'auto-dims.js', c => c.replace('const OPENING_OUTSIDE_FT = 3;', 'const OPENING_OUTSIDE_FT = 2.5;')],
  ['the beam tag counts as text in the way again, pushing the string off',
    'auto-dims.js', c => c.replace(
      "const tagged = direction => direction > 0 && along === 'x' && hasPile;",
      "const tagged = direction => direction < 0 || (direction > 0 && along === 'x' && hasPile);")],
  ['the opening string ignores the beam beside it',
    'auto-dims.js', c => c.replace(
      'const order = beamNear(0) && !beamNear(1) ? [1, 0] : [0, 1];', 'const order = [0, 1];')],
  ['an opening on a floor with no posts goes undimensioned',
    'auto-dims.js', c => c.replace(
      'const columnList = Array.isArray(columns) ? columns : [];',
      'const columnList = Array.isArray(columns) ? columns : [];\n    if (!columnList.length) return [];')],
  ['a post off the beam line joins the beam anyway',
    'auto-dims.js', c => c.replace(
      'if (Math.abs(point[across] - fixed) > ON_BEAM_FT) return false;', '')],
  ['the stair hole stops being looked for',
    'auto-dims.js', c => c.replace(
      'const side = clearSide(1) ? 1 : clearSide(-1) ? -1 : 0;', 'const side = 1;')],
  ['an interior string stands off across the beam again',
    'auto-dims.js', c => c.replace(
      "const flip = runAxis === 'x' ? away < 0 : away > 0;", 'const flip = false;')],
  ['a column segment loses its layer',
    'auto-dims.js', c => c.replace(
      'DIM_LAYERS.COLUMNS, side);', 'null, side);')],
  ['the format drops the layer again',
    'drawing-format.js', c => c.replace(
      'const layer = oneOf(dimension?.layer, DIMENSION_LAYERS, null);',
      'const layer = null;')],
  ['the format takes any layer it is handed',
    'drawing-format.js', c => c.replace(
      'const layer = oneOf(dimension?.layer, DIMENSION_LAYERS, null);',
      'const layer = dimension?.layer ?? null;')],
  ['a dimension layer is renamed in the standards table only',
    'profile-manager.js', c => c.replace("id: 'A-DIMS-OVR', name: 'A-DIMS-OVR'",
      "id: 'A-DIM-OVR', name: 'A-DIM-OVR'")],
  ['the dimension layers lose their Visible tick',
    'profile-manager.js', c => c.replace(
      "use: 'Overall size — the footprint corner to corner, eave to eave. The one string a listing plan keeps.', printable: true, visibility: true",
      "use: 'Overall size — the footprint corner to corner, eave to eave. The one string a listing plan keeps.', printable: true")],
  ['layout-plan stops handing over the standards',
    'layout-plan.js', c => c.replace(
      'layerStandard: layerTable ? (id => layerTable[id] || null) : null,', '')],
  ['cut-view-env stops handing over the standards',
    'cut-view-env.js', c => c.replace(
      'layerStandard: layerTable ? (id => layerTable[id] || null) : null,', '')],
  ['cut-view-env hands over an empty table',
    'cut-view-env.js', c => c.replace(
      'layerStandard: layerTable ? (id => layerTable[id] || null) : null,',
      'layerStandard: id => null,')],
  ['layout-plan hands over an empty table',
    'layout-plan.js', c => c.replace(
      'layerStandard: layerTable ? (id => layerTable[id] || null) : null,',
      'layerStandard: id => null,')],
];

let caught = 0;
let invalid = 0;
for (const [name, file, edit] of MUTATIONS) {
  const probe = loadWith({ [file]: edit });
  if (probe.failed.length) {
    invalid += 1;
    console.log(`  INVALID   ${name} -- ${probe.failed[0]}`);
    continue;
  }
  const before = failures;
  const beforeChecks = checks;
  try { run({ [file]: edit }); } catch (err) { failures += 1; }
  const died = failures > before;
  if (died) caught += 1;
  else console.log(`  SURVIVED  ${name}`);
  failures = before;
  checks = beforeChecks;
}
const expected = MUTATIONS.length - invalid;
console.log(`dim-layers-harness: ${caught}/${MUTATIONS.length} mutations caught`
  + (invalid ? `, ${invalid} INVALID (did not parse -- not counted as caught)` : ''));
process.exit(caught === expected && !invalid ? 0 : 1);
