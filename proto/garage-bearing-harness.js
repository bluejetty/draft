#!/usr/bin/env node
// THE GARAGE BEARS ON THE HOUSE SILL, AND ITS CONCRETE STARTS BELOW THAT.
//
// Movie, 25 Sep, looking at a built attached garage: "wait- the garage bears
// at the house sill height" ... "the garage sill and house sill line up" ...
// "the concrete starts below the 1.5" sill". Then, on the section: "we need
// extra 1'-0 5/8" of wall added to the bottom of the garage wall to meet the
// top of the sill plate (main floor joists + sheathing height".
//
// TWO DEFECTS, AND THEY STACKED. Measured on proto/repro-garage-house.draft
// before the fix, on the stack's own datum (MAIN FL deck top = 0):
//
//     house sill plate top   -1'-0.62"      (fdn.wallTop)
//     house top of concrete  -1'-2.12"
//     garage sill top        -0'-11.13"     <- 1 1/2" ABOVE the house sill
//     section garage wall    ±0'-0.00"      <- a whole floor package above it
//
// THE 1 1/2" IS ONE PLATE, WRITTEN FOUR TIMES. fdn.wallTop is the foundation
// wall's BEARING line -- level-assembly.js says so in capitals, "IT IS THE
// BEARING LINE, WHICH IS NOT THE CONCRETE'S OWN HEIGHT ... pour + plate" --
// and every garage path set the garage's top of CONCRETE equal to it:
// cut-view's frostWallTop, cut-view's grade-beam branch (by way of
// `fdn.grade + 1'-2"`, which is just fdn.wallTop spelled the long way round),
// and MODEL.html's raiseGarageConcrete, twice. Four sites wrong by the same
// number is why nothing caught it: the drawing stayed self-consistent, at the
// wrong height, and only a drafter putting a tape on it would know.
//
// THE FOOT IS drawSectionWall NEVER ASKING. sectionWallCrossings has put
// `garage` on every crossing since audit C5 and that painter read
// `level.floorTop` for every wall -- the top of the MAIN FLOOR DECK. A house
// wall belongs there. A garage has no joists and no deck: its wall runs down
// past where that floor would be, one DEFAULT_FLOOR_THICKNESS lower. The
// elevation already knew, which is why the two views of one garage disagreed
// by a foot, and why PROJECT.html -- which draws sections -- is where he saw
// it.
//
// PROJECT.html WAS ALREADY RIGHT, and that is the check this harness exists
// to keep. Its derivedAttachedOffsetFt says split OR GRADE BEAM takes no drop
// and anchors on houseSillFt(), which is -(joist + sheathing)/12 on the same
// MAIN FL 0 datum -- the same number as fdn.wallTop. So the page Movie asked
// me to fix held the correct rule and the two that draw the garage disagreed
// with it. The fix moves cut-view and MODEL onto PROJECT's answer; these
// checks fail if they ever drift back apart.
//
// WHY A GRADE BEAM TAKES NO DROP -- arithmetic, not preference. Grade is 1'-2"
// under the house sill. Drop a garage GARAGE_SILL_BELOW_HOUSE_FT and its top
// of concrete lands 11 1/2" BELOW GRADE: the slab would be a foot underground
// and the beam would have no face out of the ground at all. A frost wall runs
// to footing depth and the site backfills against it, so it can be dropped.
//
//   node proto/garage-bearing-harness.js
//   node proto/garage-bearing-harness.js --mutate    break it, prove each break is caught
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const MUTATION_MODE = require('./harness-args.js').mutationMode();
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'cut-view.js');
const { buildEnv, recordingCtx, standardElevationCuts, paintElevation } = require('./harness-env.js');

// cut-view.js is evaluated FROM SOURCE TEXT so a mutant can be applied to it.
// Its dependencies are loaded the way harness-env does, into the same sandbox.
function load(mutate) {
  let src = fs.readFileSync(SRC, 'utf8');
  if (mutate) {
    const next = mutate(src);
    if (next === src) throw new Error('mutation matched nothing -- it would prove nothing');
    src = next;
  }
  const win = {};
  const sandbox = {
    window: win, console, Math, Number, String, Object, Array, JSON, Map, Set,
    isFinite, parseFloat, parseInt,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const file of ['formatters.js', 'wall-types.js', 'geometry-2d.js',
    'drawing-format.js', 'room-standards.js', 'level-assembly.js',
    // The elevation asks build-house for a pile's bore, so the sandbox this
    // harness builds has to carry it as the page does.
    'build-house.js',
    // AND THE PATTERN FILES, because `finishes: true` is what the cladding
    // block at the foot of run() paints with -- without them cut-view warns
    // once and draws every wall and every roof plain, which is a fixture that
    // cannot show the defect it is there for.
    'finish-patterns.js', 'roof-types.js', 'roof-patterns.js',
    // AND THE WINDOW TAG'S FORMATTER. cut-view guards on DraftFenLabels and
    // draws no size tag without it, SILENTLY -- which is how the same tag hid
    // on MODEL.html, in harness-env's sandbox and in the offline renderer
    // before it hid here. Four mirrors, one missing script, and every one of
    // them reported a clean sheet for a feature that never drew.
    'fen-labels.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
  }
  vm.runInContext(src, sandbox, { filename: 'cut-view.js' });
  return win;
}

const ptOnCut = (cut, u, axis) => {
  const uA = cut.startPt.x * axis.x + cut.startPt.z * axis.z;
  const uB = cut.endPt.x * axis.x + cut.endPt.z * axis.z;
  const t = Math.abs(uB - uA) < 1e-9 ? 0 : (u - uA) / (uB - uA);
  return { x: cut.startPt.x + (cut.endPt.x - cut.startPt.x) * t,
    z: cut.startPt.z + (cut.endPt.z - cut.startPt.z) * t };
};
const SAVED = JSON.parse(fs.readFileSync(path.join(ROOT, 'proto', 'repro-garage-house.draft'), 'utf8'));
const near = (a, b, eps = 1e-6) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < eps;
const ftIn = v => {
  if (!Number.isFinite(v)) return String(v);
  const neg = v < -1e-9, a = Math.abs(v), f = Math.floor(a + 1e-9);
  return `${neg ? '-' : ''}${f}'-${((a - f) * 12).toFixed(2)}"`;
};

function run(win) {
  const missed = [];
  const check = (label, ok, detail = '') => {
    if (!ok) missed.push({ label, detail });
    if (!MUTATION_MODE) console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? `   ${detail}` : ''}`);
    return ok;
  };
  const CV = win.DraftCutView;
  if (!CV || !CV.garageBearing) {
    missed.push({ label: 'cut-view exports garageBearing', detail: 'missing' });
    return missed;
  }
  const S = CV.STANDARDS;
  const PLATE = S.GARAGE_BEAM_PLATE_IN / 12;
  const base = buildEnv(win, SAVED);
  const stack = CV.sectionLevelStack(base);
  const fdn = stack.foundation;
  const mainLevel = stack.floors[0];
  const floorPackageFt = base.levelFloorFt(mainLevel.id);

  // ── THE FIXTURE'S REACH, ASSERTED BEFORE IT IS TRUSTED ────────────────
  // Every check below filters a list, and a filter over an empty list passes
  // whatever the code does. If the fixture loses its garage these say so.
  const garages = [];
  stack.floors.forEach(l => base.garageOutlines(l.id).forEach(g => {
    if (!garages.some(x => x.id === g.id)) garages.push(g);
  }));
  check('fixture: it has attached garage outlines', garages.length > 0,
    `${garages.length} outlines`);
  if (!garages.length) return missed;
  const attached = garages[0];
  check('fixture: and that garage is ATTACHED, not detached',
    attached.open === true && attached.detached !== true,
    `open=${attached.open} detached=${attached.detached}`);
  check('fixture: on a GRADE BEAM, which is the default Movie was looking at',
    base.garageFoundation(attached) === 'gradebeam',
    base.garageFoundation(attached));
  check('fixture: MAIN FL deck top is the datum, so the numbers below read as drawn',
    near(mainLevel.floorTop, 0), ftIn(mainLevel.floorTop));

  // ── THE HOUSE'S OWN TWO LINES, WHICH EVERYTHING ELSE IS MEASURED TO ───
  const houseSill = fdn.wallTop;
  const houseConcrete = fdn.wallTop - PLATE;
  check('the house sill sits one floor package below MAIN FL',
    near(houseSill, -floorPackageFt), `${ftIn(houseSill)} vs ${ftIn(-floorPackageFt)}`);
  check("that package is 1'-0 5/8\" -- 11 7/8\" TJI + 3/4\" sheathing",
    near(floorPackageFt, (11 + 7 / 8 + 3 / 4) / 12), ftIn(floorPackageFt));

  // ── THE DROP TABLE ────────────────────────────────────────────────────
  // Pure, so it is pinned as a table rather than through a drawing.
  const drop = CV.garageSillDropFt;
  check('drop: a GRADE BEAM never drops -- it would go below grade',
    drop('bungalow', 'gradebeam') === 0, String(drop('bungalow', 'gradebeam')));
  check('drop: a thickened edge never drops either',
    drop('bungalow', 'thickened') === 0, String(drop('bungalow', 'thickened')));
  check('drop: a frost wall on a bungalow drops GARAGE_SILL_BELOW_HOUSE_FT',
    drop('bungalow', 'frostwall') === S.GARAGE_SILL_BELOW_HOUSE_FT,
    String(drop('bungalow', 'frostwall')));
  check('drop: a frost wall on a 2 storey drops too',
    drop('twoStorey', 'frostwall') === S.GARAGE_SILL_BELOW_HOUSE_FT,
    String(drop('twoStorey', 'frostwall')));
  check('drop: LEVEL on a bilevel -- Movie, "for bilevels it should be level"',
    drop('bilevel', 'frostwall') === 0, String(drop('bilevel', 'frostwall')));
  check('drop: and on a modified bilevel',
    drop('modifiedBilevel', 'frostwall') === 0, String(drop('modifiedBilevel', 'frostwall')));
  check('drop: an UNTYPED drawing drops like a bungalow, not like a split',
    drop(null, 'frostwall') === S.GARAGE_SILL_BELOW_HOUSE_FT, String(drop(null, 'frostwall')));

  // ── WHERE AN ATTACHED GRADE-BEAM GARAGE BEARS ─────────────────────────
  const bearing = CV.garageBearing(base, fdn, attached);
  check('SILL TO SILL: the garage sill top IS the house sill top',
    near(bearing, houseSill), `${ftIn(bearing)} vs ${ftIn(houseSill)}`);
  check('and its concrete starts one plate below that sill, not on it',
    near(bearing - PLATE, houseConcrete), `${ftIn(bearing - PLATE)} vs ${ftIn(houseConcrete)}`);
  check('DOWN, NEVER UP: a garage sill is never above the house sill',
    bearing <= houseSill + 1e-9, `${ftIn(bearing)} vs ${ftIn(houseSill)}`);
  check('NOT BURIED: a grade beam keeps its concrete face out of the ground',
    bearing - PLATE > fdn.grade + 0.5,
    `${ftIn(bearing - PLATE - fdn.grade)} of concrete above grade`);

  // ── EVERY GARAGE FOUNDATION TOPS OUT 1'-2" ABOVE GRADE ────────────────
  //
  // Board #296 and SPEC-garage-foundations.md, from Movie 5 Sep: the 1'-2"
  // is "for the grade beam or frost wall". He re-confirmed the guideline on
  // 25 Sep. It was NOT true before this: grade was measured down from
  // fdn.wallTop, the BEARING line, so every foundation stood 1'-0 1/2" out of
  // the ground and the spec's own invariant was quietly false. These pin it
  // at the relationship rather than at a literal -- a check against 14 passes
  // with the number hardcoded in the formula.
  check("the HOUSE's top of concrete is GRADE_BELOW_FOUNDATION_TOP_FT above grade",
    near(houseConcrete - fdn.grade, S.GRADE_BELOW_FOUNDATION_TOP_FT),
    ftIn(houseConcrete - fdn.grade));
  check("the attached grade beam's top of concrete lands there too",
    near(bearing - PLATE - fdn.grade, S.GARAGE_BEAM_ABOVE_GRADE_FT),
    ftIn(bearing - PLATE - fdn.grade));
  check('and so does a detached one, off its own grade',
    near(CV.garageBearing(base, fdn, { ...attached, open: false, detached: true })
      - PLATE - fdn.grade, S.DETACHED_BEAM_ABOVE_GRADE_IN / 12),
    ftIn(CV.garageBearing(base, fdn, { ...attached, open: false, detached: true }) - PLATE - fdn.grade));
  check('grade is a plate below what fdn.wallTop would have given',
    near(CV.gradeFromBearing(fdn.wallTop), fdn.wallTop - PLATE - S.GRADE_BELOW_FOUNDATION_TOP_FT),
    ftIn(fdn.grade));

  // ── EVERY GARAGE FLOOR LANDS 10" ABOVE GRADE, LESS ITS DROP ───────────
  //
  // SPEC-garage-foundations.md: "10" is not a compromise, it is the number
  // that keeps the floor still ... Both floors land at grade + 10", so
  // changing a detached garage's foundation moves the concrete and leaves the
  // door where it was." This file held it in ONE of three places -- the frost
  // wall -- while the grade beam drew grade + 19 1/2" (a slab standing on the
  // wood plate) and the thickened edge grade + 4" (project-page.js took
  // DETACHED_SLAB_ABOVE_GRADE_IN = 10 in board #296 and cut-view never did).
  //
  // ONE FORMULA FOR ALL SIX COMBINATIONS: floor = grade + 10" - drop. It is
  // exact today, and it says out loud what is still open -- a DROPPED garage
  // takes its floor below grade, because grade follows the HOUSE here while
  // PROJECT.html derives it from the GARAGE. An attached frost-walled
  // bungalow comes out with its floor 14" underground. That is pre-existing
  // (it measured -14" before any of this) and is Movie's open question: if
  // grade comes to follow the garage, the `- drop` term goes and these
  // checks tighten to a bare 10".
  {
    const combos = [
      ['DETACHED thickened', { ...attached, open: false, detached: true }, 'thickened', null],
      ['DETACHED grade beam', { ...attached, open: false, detached: true }, 'gradebeam', null],
      ['DETACHED frost wall', { ...attached, open: false, detached: true }, 'frostwall', null],
      ['ATTACHED grade beam', attached, 'gradebeam', 'bungalow'],
      ['ATTACHED frost wall, a split takes no drop', attached, 'frostwall', 'bilevel'],
      ['ATTACHED frost wall, a bungalow drops', attached, 'frostwall', 'bungalow'],
    ];
    combos.forEach(([label, garage, mode, buildType]) => {
      const e = { ...base, garageFoundation: () => mode, buildType: () => buildType };
      const floor = CV.garageSlabTop(e, fdn, garage);
      const isDet = garage.open !== true && garage.detached === true;
      const drop = isDet ? 0 : CV.garageSillDropFt(buildType, mode);
      const want = fdn.grade + S.GARAGE_SLAB_ABOVE_GRADE_IN / 12 - drop;
      check(`floor: ${label}`, near(floor, want),
        `${ftIn(floor - fdn.grade)} above grade, wanted ${ftIn(want - fdn.grade)}`);
    });
    // THE DOOR'S OWN RULE, stated as the spec states it: swapping a DETACHED
    // garage's foundation must not move its floor. This is the whole reason
    // the 10" exists, and it was false in two of three directions.
    const det = { ...attached, open: false, detached: true };
    const floorOf = mode => CV.garageSlabTop(
      { ...base, garageFoundation: () => mode }, fdn, det);
    check('changing a detached garage\'s foundation leaves the door where it was',
      near(floorOf('thickened'), floorOf('gradebeam'))
      && near(floorOf('gradebeam'), floorOf('frostwall')),
      `thickened ${ftIn(floorOf('thickened'))} beam ${ftIn(floorOf('gradebeam'))} frost ${ftIn(floorOf('frostwall'))}`);
    // And the cost the spec names for the thickened edge: 2" of edge buried
    // rather than 4". At the 4" this file drew before, it was 8".
    const thick = CV.garageSlabTop({ ...base, garageFoundation: () => 'thickened' }, fdn, det);
    check('the thickened edge buries the 2" the spec says it costs',
      near(S.GARAGE_EDGE_DEPTH_IN / 12 - (thick - fdn.grade), 2 / 12),
      ftIn(S.GARAGE_EDGE_DEPTH_IN / 12 - (thick - fdn.grade)));
    check("cut-view's 10\" is project-page's DETACHED_SLAB_ABOVE_GRADE_IN",
      new RegExp(`DETACHED_SLAB_ABOVE_GRADE_IN = ${S.GARAGE_SLAB_ABOVE_GRADE_IN};`)
        .test(fs.readFileSync(path.join(ROOT, 'project-page.js'), 'utf8')),
      `cut-view says ${S.GARAGE_SLAB_ABOVE_GRADE_IN}`);
  }

  // ── THE FOOT THE SECTION WAS MISSING ──────────────────────────────────
  check("the garage wall starts 1'-0 5/8\" below the deck a house wall starts on",
    near(mainLevel.floorTop - bearing, floorPackageFt),
    `${ftIn(mainLevel.floorTop - bearing)} vs ${ftIn(floorPackageFt)}`);

  // ── A FROST WALL, WHICH DOES DROP ─────────────────────────────────────
  const frostGarage = { ...attached, foundation: 'frostwall' };
  const frostEnv = { ...base, garageFoundation: () => 'frostwall' };
  const bungalow = { ...frostEnv, buildType: () => 'bungalow' };
  const bilevel = { ...frostEnv, buildType: () => 'bilevel' };
  const frostBungalow = CV.garageBearing(bungalow, fdn, frostGarage);
  const frostBilevel = CV.garageBearing(bilevel, fdn, frostGarage);
  check('frost wall on a bungalow: sill to sill less the drop',
    near(frostBungalow, houseSill - S.GARAGE_SILL_BELOW_HOUSE_FT),
    `${ftIn(frostBungalow)} vs ${ftIn(houseSill - S.GARAGE_SILL_BELOW_HOUSE_FT)}`);
  check('frost wall on a bilevel: LEVEL with the house sill',
    near(frostBilevel, houseSill), `${ftIn(frostBilevel)} vs ${ftIn(houseSill)}`);
  check('frost wall concrete is one plate below its sill, at either drop',
    near(CV.frostWallTop(bungalow, fdn, frostGarage), frostBungalow - PLATE)
    && near(CV.frostWallTop(bilevel, fdn, frostGarage), frostBilevel - PLATE),
    `${ftIn(CV.frostWallTop(bungalow, fdn, frostGarage))} / ${ftIn(CV.frostWallTop(bilevel, fdn, frostGarage))}`);

  // ── A DETACHED GARAGE IS NOT MOVED BY ANY OF THIS ─────────────────────
  // It has no house sill to meet, so it keeps its grade anchor. Board #44
  // owns its datum; this change must not touch it.
  const detached = { ...attached, open: false, detached: true };
  const detachedBeam = CV.garageBearing(base, fdn, detached);
  check('detached: still stands off ITS OWN grade, not the house sill',
    near(detachedBeam, fdn.grade + (S.DETACHED_BEAM_ABOVE_GRADE_IN + S.GARAGE_BEAM_PLATE_IN) / 12),
    ftIn(detachedBeam));
  check('detached: a frost wall likewise',
    near(CV.frostWallTop(base, fdn, { ...detached, foundation: 'frostwall' }),
      fdn.grade + S.DETACHED_BEAM_ABOVE_GRADE_IN / 12),
    ftIn(CV.frostWallTop(base, fdn, { ...detached, foundation: 'frostwall' })));
  check('detached: a CLOSED outline that never says detached is still attached',
    near(CV.garageBearing(base, fdn, { ...attached, open: false }), houseSill),
    ftIn(CV.garageBearing(base, fdn, { ...attached, open: false })));

  // ── AND THE PAINTER ACTUALLY STANDS THE WALL THERE ────────────────────
  // The arithmetic above proves the rule; this proves drawSectionWall reads
  // it. Without this, "the section ignores crossing.garage" -- the whole
  // defect Movie reported -- leaves every check above green.
  const garageWall = base.walls().find(w =>
    w.levelId === mainLevel.id && (w.view || 'plan') === 'plan'
    && CV.garageOfWall(w, base, {}) !== null);
  check('fixture: a garage wall exists on the main floor to paint',
    !!garageWall, garageWall ? `wall ${garageWall.id}` : 'none');
  if (garageWall) {
    const paint = (crossing) => {
      const { ctx, fills } = recordingCtx();
      CV.drawSectionWall(base, ctx, u => u, v => v, 1, crossing, mainLevel,
        { paper: true }, CV.PAPER_INKS, fdn);
      const rect = fills.map(f => f.rect).filter(Boolean).sort((a, b) => b.h - a.h)[0];
      return rect ? rect.y - rect.h : null;   // Y is identity, so bottom = y(top) - height
    };
    const crossing = { wall: garageWall, u: 0, width: 0.5, alongWall: -999, garage: attached };
    const drawnBottom = paint(crossing);
    check('the painted garage wall stands on the garage bearing, not the deck',
      near(drawnBottom, bearing, 1e-6), `${ftIn(drawnBottom)} vs ${ftIn(bearing)}`);
    const houseWall = base.walls().find(w =>
      w.levelId === mainLevel.id && (w.view || 'plan') === 'plan'
      && CV.garageOfWall(w, base, {}) === null);
    if (check('fixture: and a HOUSE wall to tell it apart from', !!houseWall,
      houseWall ? `wall ${houseWall.id}` : 'none')) {
      const drawnHouse = paint({ wall: houseWall, u: 0, width: 0.5, alongWall: -999, garage: null });
      check('a HOUSE wall still stands on the floor deck',
        near(drawnHouse, mainLevel.floorTop, 1e-6),
        `${ftIn(drawnHouse)} vs ${ftIn(mainLevel.floorTop)}`);
      check("the two differ by exactly the floor package Movie measured",
        near(drawnHouse - drawnBottom, floorPackageFt, 1e-6),
        `${ftIn(drawnHouse - drawnBottom)} vs ${ftIn(floorPackageFt)}`);
    }
  }

  // ── AND THE WHOLE SECTION, PAINTED THROUGH THE REAL CALLER ────────────
  //
  // The check above calls drawSectionWall DIRECTLY, so it cannot see the one
  // line that hands it a foundation. Measured: with `fdn` dropped from the
  // call at drawCutView's floor loop, every check above stayed green and the
  // garage wall went back onto the deck. A painter checked through its own
  // caller is the only version of this that holds.
  //
  // THE DRAWING IS ITS OWN SCALE. The main floor's assembly band spans
  // floorBottom..floorTop, and sectionLevelStack sets fdn.wallTop = that
  // floorBottom -- the house sill IS the underside of the main floor. So the
  // band gives back pxPerFt and the origin, and everything else can be read
  // in FEET rather than as a ratio of pixels.
  {
    const zs = attached.points.map(pt => pt.z);
    const midZ = (Math.min(...zs) + Math.max(...zs)) / 2;
    const xs = base.walls().filter(w => w.levelId > 0).flatMap(w => [w.start.x, w.end.x]);
    const cut = {
      id: 'S1', name: 'S1', elev: 0, levelId: null,
      startPt: { x: Math.min(...xs) - 10, z: midZ },
      endPt: { x: Math.max(...xs) + 10, z: midZ },
      dirVec: { x: 0, z: -1 },
    };
    const crossings = CV.sectionWallCrossings(base, cut, { x: 1, z: 0 });
    check('section fixture: the cut crosses GARAGE walls',
      crossings.filter(c => c.garage).length > 0,
      `${crossings.filter(c => c.garage).length} of ${crossings.length}`);
    check('section fixture: and house walls, so the two can be told apart',
      crossings.filter(c => !c.garage).length > 0,
      `${crossings.filter(c => !c.garage).length} of ${crossings.length}`);

    const { ctx, fills } = recordingCtx();
    CV.drawCutView(base, ctx, 900, 700, cut, {});
    const rects = fills.filter(f => f.rect);
    // Grouped by the alpha each painter fills at. Named rather than
    // hardcoded as a colour so a re-skin moves the ink and not the rule --
    // and asserted non-empty, because a filter over an empty list passes
    // whatever the painter does, which is the shape this repo keeps finding.
    const atAlpha = a => rects.filter(f => f.ink.endsWith(`,${a})`)).map(f => f.rect);
    const bands = atAlpha(0.15);        // floor assembly bands
    const wallBands = atAlpha(0.12);    // drawSectionWall's wall fill
    const concrete = atAlpha(0.35);     // slabs and foundation
    check('section: the floor assembly bands are on the paper',
      bands.length > 0, `${bands.length} bands`);
    check('section: and the crossed walls', wallBands.length > 0, `${wallBands.length} walls`);
    check('section: and the concrete', concrete.length > 0, `${concrete.length} pours`);

    if (bands.length && wallBands.length) {
      // The LOWEST band is the main floor's: its underside is the house sill.
      const band = bands.slice().sort((a, b) => (b.y + b.h) - (a.y + a.h))[0];
      const pxPerFt = band.h / floorPackageFt;
      const world = y => mainLevel.floorTop - (y - band.y) / pxPerFt;
      check('section: the band scales back to the floor package it draws',
        pxPerFt > 1, `${pxPerFt.toFixed(2)} px/ft`);
      check('section: and its underside is the house sill',
        near(world(band.y + band.h), houseSill, 1e-6), ftIn(world(band.y + band.h)));

      const deepestWall = world(Math.max(...wallBands.map(r => r.y + r.h)));
      check('SECTION: the deepest wall runs to the garage bearing, not the deck',
        near(deepestWall, bearing, 0.01), `${ftIn(deepestWall)} vs ${ftIn(bearing)}`);
      check('SECTION: which is a floor package below where a house wall stops',
        near(mainLevel.floorTop - deepestWall, floorPackageFt, 0.01),
        `${ftIn(mainLevel.floorTop - deepestWall)} vs ${ftIn(floorPackageFt)}`);

      if (concrete.length) {
        // ── THE FLOOR IS MEASURED DOWN FROM THE TOP OF THE CONCRETE ──────
        //
        // Movie, 26 Sep, shown this floor quoted against grade: *"it shouldn't
        // be measured to 'grade' it should be measured from top of concrete
        // (1ft down from top of concrete)"*, and *"1 ft down default"*.
        //
        // WHAT THIS CHECK USED TO SAY, and why it passed anyway: it asked
        // garageSlabTop -- one level, `GARAGE_SLAB_THICKNESS_IN` below the pour
        // -- and was satisfied by a `fillRect` drawn at that level. One level is
        // the fall at 32 ft in and nowhere else. THIS CUT stands 4 ft in from
        // the door of an 8 ft garage, where the fall is 7 1/2" and the level
        // answer is 4": the drawing was 3 1/2" out and the check said fine.
        //
        // READ OFF THE SHAPE, because the floor is not a rect any more -- it
        // falls, and across a door it drops into the buck. A level band cannot
        // express either.
        const slabPolys = fills.filter(f => !f.rect && f.ink.endsWith(',0.35)'))
          .map(f => f.pts.filter(q => !q.close));
        check('SECTION: the garage floor is drawn as a shape, not a level band',
          slabPolys.length > 0, `${slabPolys.length} polygons at the slab's alpha`);
        // ONE NUMBER FOR THIS CUT ONLY BECAUSE THE CUT IS PARALLEL TO THE DOOR,
        // asserted rather than assumed: the fall runs across this cut, so every
        // station on it is the same depth in and the floor really is level here.
        // On a cut that runs INTO the garage it is not, which is what the block
        // below this one is for.
        const cutEnds = [cut.startPt, cut.endPt];
        const depths = cutEnds.map(q => CV.garageDepthFt(base, attached, q));
        check('section fixture: this cut runs ACROSS the fall, so the floor is level on it',
          near(depths[0], depths[1], 1e-6), depths.map(d => d.toFixed(3)).join(' vs '));
        if (slabPolys.length) {
          const garagePoly = slabPolys.reduce((a, b) => (a.length >= b.length ? a : b));
          const drawnTop = world(Math.min(...garagePoly.map(q => q.y)));
          const here = { x: (cut.startPt.x + cut.endPt.x) / 2, z: midZ };
          const want = CV.garageFloorAt(base, fdn, attached, here);
          const cTop = CV.garageConcreteTop(base, fdn, attached);
          check('SECTION: the garage floor is drawn where garageFloorAt puts it',
            near(drawnTop, want, 0.01), `drawn ${ftIn(drawnTop)} vs ${ftIn(want)}`);
          check('SECTION: which is the fall below the TOP OF THE CONCRETE',
            near(cTop - drawnTop,
              CV.garageSlabBelowConcreteIn(CV.garageDepthFt(base, attached, here)) / 12, 1e-6),
            `${ftIn(cTop - drawnTop)} below top of concrete`);
          // AND THE OLD LEVEL ANSWER IS WRONG HERE, stated so the check above
          // cannot be satisfied by going back to it.
          check('SECTION: and the one-level answer would have been out here',
            Math.abs(CV.garageSlabTop(base, fdn, attached) - want) > 1 / 12,
            `level ${ftIn(CV.garageSlabTop(base, fdn, attached))}`
            + ` vs here ${ftIn(want)}`);
        }
        const slabTop = CV.garageSlabTop(base, fdn, attached);
        check('the level garageSlabTop still answers 10" above grade',
          near(slabTop - fdn.grade, S.GARAGE_SLAB_ABOVE_GRADE_IN / 12),
          ftIn(slabTop - fdn.grade));
        // ── ONE DATUM, ASSERTED RATHER THAN ASSUMED ──────────────────────
        //
        // cut-view.js draws a hung beam's slab from garageSlabTop when it
        // knows the body, and falls back to the STORED WALL for a crossing
        // whose body is unknown: `wallBottom + the beam's topHeight, less the
        // slab`. Its comment calls that the same rule -- "ONE DATUM ... rather
        // than a second arrangement" -- and until 97a82c9 it was not: the
        // foundation's base was a sill plate high, so the fallback answered
        // 1 1/2" above the datum.
        //
        //     pre-fix    fallback -1.3854   datum -1.5104   apart
        //     with fix   fallback -1.5104   datum -1.5104   agree
        //
        // NOTHING SAID SO, and the way that surfaced is worth keeping: a
        // MUTANT was the only thing standing on it. "the grade-beam slab goes
        // back to the stored wall instead of the datum" was killed by the two
        // answers differing -- that is, by the defect -- so correcting the
        // base made the mutant a no-op and CI read it as a gate going soft.
        // It was a mutant living on a bug. The claim it was standing in for
        // is this check, which says the thing directly and cannot be
        // satisfied by an arrangement being wrong.
        const beamWalls = base.walls().filter(w => (w.view || 'plan') === 'foundation'
          && w.baseHeight > 0.01);
        if (beamWalls.length) {
          const stored = fdn.wallBottom + Math.max(...beamWalls.map(w => w.topHeight))
            - S.GARAGE_SLAB_THICKNESS_IN / 12;
          check('SECTION: the stored-wall fallback answers the SAME datum',
            near(stored, slabTop, 1e-6),
            `fallback ${ftIn(stored)} vs garageSlabTop ${ftIn(slabTop)}`);
        }
      }
    }
  }

  // ── AND THE SAME SECTION CUT THE OTHER WAY: INTO THE GARAGE ───────────
  //
  // The block above cuts ACROSS the garage, parallel to its door, which is the
  // one direction on which the floor is level and the cut misses every door.
  // Everything board #45 is about lives on the perpendicular cut: the fall, the
  // buck formed in the top of the beam at a door, and what the door stands on.
  //
  // Movie, 26 Sep: *"the slab will always 'pour over the 1ft door buck and fil
  // in the extra space"*, and on the datum for it: *"it shouldn't be measured to
  // 'grade' it should be measured from top of concrete (1ft down from top of
  // concrete)"* -- *"1 ft down default"*.
  //
  // THE DRAWING IS READ IN FEET, exactly, because this one hands the painter a
  // `fit`: pxPerFt and extents given rather than reverse-engineered off a band,
  // so a pixel maps back to a foot with no ratio to recover.
  {
    const overhead = base.fenestrations().find(f => f.garage === true
      && (f.type || f.kind) === 'door');
    const ohWall = overhead && base.walls().find(w => w.id === overhead.wallId);
    check('section fixture: the garage has an OVERHEAD door, which is the datum',
      !!ohWall, overhead ? `on ${overhead.wallId}` : 'none');
    // ── TWO STATIONS, AND THE SECOND ONE IS WHY ───────────────────────────
    //
    // A cut through the middle of the overhead door hits the man door too on
    // this fixture -- they are both on the garage's centreline -- so EVERY
    // garage beam it crosses has a door over it, and "a beam with no door keeps
    // its full top" never fires. Measured: the mutant that bucks every garage
    // beam whether or not a door is over it survived on one station.
    //
    // A QUARTER OF THE WAY ALONG THE OVERHEAD DOOR is inside it and clear of
    // the narrower man door, and both of those are asserted below rather than
    // assumed -- the offset is derived from the doors' own widths, so a fixture
    // whose doors move takes the checks with it.
    if (ohWall) {
      const at = CV.doorPoint(ohWall, overhead);
      const zs = attached.points.map(q => q.z);
      const ohLen = Math.hypot(ohWall.end.x - ohWall.start.x, ohWall.end.z - ohWall.start.z);
      const ux = (ohWall.end.x - ohWall.start.x) / ohLen;
      const offset = { x: at.x - ux * overhead.width / 4, z: at.z };
      const stations = [
        ['through both doors', at.x, 2],
        ['through the overhead door only', offset.x, 1],
      ];
      stations.forEach(([where, cutX, wantDoors]) => {
      const cut = {
        id: 'S2', name: 'S2', elev: 0, levelId: null,
        startPt: { x: cutX, z: Math.min(...zs) - 10 },
        endPt: { x: cutX, z: Math.max(...zs) + 10 },
        dirVec: { x: 1, z: 0 },
      };
      const axis = CV.cutAxis(cut);
      const uA = cut.startPt.x * axis.x + cut.startPt.z * axis.z;
      const uB = cut.endPt.x * axis.x + cut.endPt.z * axis.z;
      const uMin = Math.min(uA, uB), uMax = Math.max(uA, uB);
      const extents = CV.cutViewExtents(base, cut);
      const PX = 40;
      const w = Math.ceil((uMax - uMin) * PX) + 40;
      const h = Math.ceil((extents.yTop - extents.yBottom) * PX) + 40;
      const x0 = (w - (uMax - uMin) * PX) / 2;
      const y0 = (h - (extents.yTop - extents.yBottom) * PX) / 2;
      const toU = x => (x - x0) / PX + uMin;
      const toE = y => extents.yTop - (y - y0) / PX;
      const crossings = CV.sectionWallCrossings(base, cut, axis);
      const fdnC = crossings.filter(c => (c.wall.view || 'plan') === 'foundation' && c.garage);
      // WHICH FOUNDATION CROSSINGS HAVE A DOOR OVER THEM, worked out here from
      // the MODEL rather than read off the drawing. Asking the picture "is the
      // concrete notched here" would let a painter that notched nothing agree
      // with itself.
      const doorOver = (c) => crossings.find(q => (q.wall.view || 'plan') === 'plan'
        && CV.sameGarageBody(q.garage, c.garage) && Math.abs(q.u - c.u) < 1
        && base.fenestrations().some(f => f.wallId === q.wall.id
          && (f.type || f.kind) === 'door'
          && Math.abs(q.alongWall - f.offset) < f.width / 2));
      const withDoor = fdnC.filter(doorOver);
      check(`section fixture: the cut ${where} passes ${wantDoors}`,
        withDoor.length === wantDoors,
        `${withDoor.length} of ${fdnC.length} garage beams`);
      check(`section fixture: and ${fdnC.length - withDoor.length} garage beam(s) with no door, ${where}`,
        fdnC.length - withDoor.length === fdnC.length - wantDoors,
        `${fdnC.length - withDoor.length} bare of ${fdnC.length}`);
      const doorOf = (c) => {
        const q = doorOver(c);
        return base.fenestrations().find(f => f.wallId === q.wall.id
          && (f.type || f.kind) === 'door'
          && Math.abs(q.alongWall - f.offset) < f.width / 2);
      };
      check(`section fixture: the OVERHEAD door is crossed ${where}`,
        withDoor.some(c => doorOf(c).garage === true),
        withDoor.map(c => `${doorOf(c).id}${doorOf(c).garage ? ' (overhead)' : ''}`).join(' '));

      const { ctx, fills, strokes } = recordingCtx();
      CV.drawCutView(base, ctx, w, h, cut, { pxPerFt: PX, extents });
      const rects = fills.filter(f => f.rect).map(f => ({ ink: f.ink, r: f.rect }));
      const cTop = CV.garageConcreteTop(base, fdn, attached);
      const buckFt = S.GARAGE_DOOR_BUCK_IN / 12;
      // WHAT THE CUT FACE IS DRAWN AT, and it cannot be read off this tape:
      // recordingCtx makes `strokeRect` a no-op on purpose, and the pour's
      // outline is a strokeRect. So the weight is named from the painter --
      // 1.25, the same figure drawSectionWall and the concrete pass both use --
      // and "lighter" is asserted on the two things the tape DOES carry.
      const CUT_WEIGHT = 1.25;

      // ── THE BUCK: A FOOT OFF THE TOP OF THE BEAM AT EVERY DOOR ─────────
      const beamAt = (c) => rects
        .filter(f => f.ink.endsWith(',0.5)')
          && Math.abs(toU(f.r.x + f.r.w / 2) - c.u) < 0.05)
        .sort((a, b) => a.r.y - b.r.y)[0];
      fdnC.forEach(c => {
        const drawn = beamAt(c);
        const door = doorOver(c) ? doorOf(c) : null;
        if (!drawn) { check(`buck: a beam is drawn at ${c.wall.id}`, false, 'none found'); return; }
        const top = toE(drawn.r.y);
        if (door) {
          check(`buck: ${c.wall.id} under ${door.id} is bucked a foot off the top`,
            near(cTop - top, buckFt, 0.01),
            `${ftIn(cTop - top)} below top of concrete, wanted ${ftIn(buckFt)}`);
        } else {
          check(`buck: ${c.wall.id} has no door over it and keeps its full top`,
            near(top, cTop, 0.01), `${ftIn(top)} vs ${ftIn(cTop)}`);
        }
      });

      // ── AND THE TOP THE BUCK CAME OUT OF, DRAWN LIGHT ──────────────────
      //
      // Movie, 26 Sep: *"maybe also show the top of the grade beam in the
      // background with not as dark lines (for reference)"*. The pocket is only
      // as long as the door, so past either jamb the beam runs on full height
      // and the cut looks PAST the void at it.
      //
      // READ AS A HORIZONTAL AT THE POUR'S TOP, spanning the beam and no wider,
      // and asserted LIGHTER than the pour's own outline -- a beyond line drawn
      // at the cut's own weight would put a second top of concrete on the sheet
      // at equal authority, which is the thing that makes it wrong rather than
      // merely plain.
      const flat = strokes.filter(t => t.pts.length === 2
        && Math.abs(t.pts[0].y - t.pts[1].y) < 0.5);
      withDoor.forEach(c => {
        const hit = flat.find(t => Math.abs(toE(t.pts[0].y) - cTop) < 0.01
          && Math.abs(Math.min(toU(t.pts[0].x), toU(t.pts[1].x)) - (c.u - c.width / 2)) < 0.02
          && Math.abs(Math.max(toU(t.pts[0].x), toU(t.pts[1].x)) - (c.u + c.width / 2)) < 0.02);
        check(`beyond: ${c.wall.id} shows the beam's full top behind ${doorOf(c).id}, ${where}`,
          !!hit, hit ? ftIn(toE(hit.pts[0].y)) : `no line at ${ftIn(cTop)} across the beam`);
        if (hit) {
          // THINNER THAN THE CUT, and struck in a TRANSLUCENT ink rather than
          // the solid one the cut face carries. Both, because either alone is
          // satisfied by a line that still reads as another top of concrete:
          // a thin solid line, or a fat pale one.
          const alpha = Number((/,\s*([0-9.]+)\)$/.exec(hit.ink) || [])[1]);
          check(`beyond: and it is drawn lighter than the cut face at ${c.wall.id}`,
            hit.w < CUT_WEIGHT - 1e-9 && Number.isFinite(alpha) && alpha < 0.5,
            `w ${hit.w} (cut ${CUT_WEIGHT})  ink ${hit.ink}`);
        }
      });
      // AND NOWHERE ELSE: a beam with no door over it draws its top ONCE, as
      // the cut face, so a second line there would be the reference standing in
      // for something that is not behind anything.
      fdnC.filter(c => !doorOver(c)).forEach(c => {
        const over = flat.filter(t => Math.abs(toE(t.pts[0].y) - cTop) < 0.01
          && Math.min(toU(t.pts[0].x), toU(t.pts[1].x)) > c.u - c.width / 2 - 0.02
          && Math.max(toU(t.pts[0].x), toU(t.pts[1].x)) < c.u + c.width / 2 + 0.02);
        check(`beyond: no reference line at ${c.wall.id}, which has no buck, ${where}`,
          over.length === 0, `${over.length} lines at the pour's top across it`);
      });

      // ── THE FLOOR FALLS TOWARD THE DOOR, AND FILLS THE VOID ────────────
      const polys = fills.filter(f => !f.rect && f.ink.endsWith(',0.35)'))
        .map(f => f.pts.filter(q => !q.close).map(q => ({ u: toU(q.x), e: toE(q.y) })));
      check('fall: the garage floor is drawn as a shape on this cut too',
        polys.length > 0, `${polys.length} polygons`);
      if (polys.length) {
        const floor = polys.reduce((a, b) => (a.length >= b.length ? a : b));
        // ── THE SHAPE READ AT A STATION, NOT AT ITS CORNERS ──────────────
        //
        // The floor's vertices sit where its geometry CHANGES -- the ends, the
        // door's own line, each buck jamb -- and none of those is a crossing
        // centre. Filtering for a vertex near the station found nothing and the
        // check read -Infinity, which is the instrument answering about a place
        // the shape has no corner at rather than about the shape.
        //
        // So: intersect the vertical line at `u` with every edge of the loop.
        // The highest hit is the floor's top there, the lowest its underside.
        const cutsAt = (poly, u) => {
          const es = [];
          for (let i = 0; i < poly.length; i += 1) {
            const a = poly[i], b = poly[(i + 1) % poly.length];
            if (Math.abs(b.u - a.u) < 1e-9) {
              if (Math.abs(a.u - u) < 1e-6) es.push(a.e, b.e);
              continue;
            }
            const t = (u - a.u) / (b.u - a.u);
            if (t >= -1e-9 && t <= 1 + 1e-9) es.push(a.e + (b.e - a.e) * t);
          }
          return es;
        };
        const topAt = (u) => Math.max(...cutsAt(floor, u));
        const doorU = withDoor.find(c => doorOf(c).garage === true).u;
        // THE BACK OF THE SLAB, whether or not a door happens to be there: the
        // fall is the floor's, not a pair of doors'. The far garage beam is the
        // back wall either way.
        const backU = fdnC.map(c => c.u).filter(u => Math.abs(u - doorU) > 1)
          .sort((a, b) => Math.abs(b - doorU) - Math.abs(a - doorU))[0];
        check('fall: the floor at the overhead door is GARAGE_SLAB_AT_DOOR_IN below the pour',
          near(cTop - topAt(doorU), S.GARAGE_SLAB_AT_DOOR_IN / 12, 0.02),
          `${ftIn(cTop - topAt(doorU))} below top of concrete`);
        // NOT LEVEL, and by the rate rather than merely "different": the two
        // stations are a known distance apart, so the rise between them is the
        // slope the standard names and nothing else can satisfy it.
        const runFt = Math.abs(CV.garageDepthFt(base, attached, ptOnCut(cut, backU, axis))
          - CV.garageDepthFt(base, attached, ptOnCut(cut, doorU, axis)));
        const riseIn = (topAt(backU) - topAt(doorU)) * 12;
        check('fall: and it rises from the door at GARAGE_SLAB_SLOPE_IN_PER_FT',
          runFt > 1 && near(riseIn / runFt, S.GARAGE_SLAB_SLOPE_IN_PER_FT, 1e-3),
          `${riseIn.toFixed(3)}" over ${runFt.toFixed(2)} ft`
          + ` = ${(riseIn / (runFt || 1)).toFixed(4)}"/ft`);
        // AND THE EXTRA SPACE IS FILLED: across a door the underside of the
        // slab reaches the bottom of the void, which is the foot below the pour.
        const lowAt = (u) => Math.min(...cutsAt(floor, u));
        withDoor.forEach(c => {
          check(`fill: the slab reaches the bottom of ${doorOf(c).id}'s buck`,
            near(cTop - lowAt(c.u), buckFt, 0.02),
            `deepest over the beam ${ftIn(cTop - lowAt(c.u))}, void ${ftIn(buckFt)}`);
        });
        // AND IT IS ONLY AT A DOOR, so the dip is the buck and not the slab
        // having grown a foot thick everywhere.
        fdnC.filter(c => !doorOver(c)).forEach(c => {
          check(`fill: the slab stays one thickness at ${c.wall.id}, which has no door`,
            cutsAt(floor, c.u).length === 0
            || near(topAt(c.u) - lowAt(c.u), S.GARAGE_SLAB_THICKNESS_IN / 12, 0.02),
            `${ftIn(topAt(c.u) - lowAt(c.u))} deep`);
        });
      }

      // ── AND THE DOOR STANDS ON IT ──────────────────────────────────────
      //
      // The defect this replaces: every door in section bottomed out on
      // `level.floorTop` or the garage's bearing -- the top of its sill plate --
      // which on a hung beam is 5 1/2" clear of the floor this same painter
      // drew under it. The door hung in the air.
      withDoor.forEach(c => {
        const door = doorOf(c);
        const plan = crossings.find(q => (q.wall.view || 'plan') === 'plan'
          && Math.abs(q.u - c.u) < 1);
        const slab = rects.filter(f => Math.abs(toU(f.r.x + f.r.w / 2) - plan.u) < 0.1
          && f.r.h / PX > 4 && f.r.w / PX < 0.3)
          .sort((a, b) => (b.r.y + b.r.h) - (a.r.y + a.r.h))[0];
        if (!slab) { check(`door: a leaf is drawn in ${door.id}`, false, 'none'); return; }
        const bottom = toE(slab.r.y + slab.r.h);
        const dWall = base.walls().find(x => x.id === door.wallId);
        const stands = CV.garageFloorAt(base, fdn, attached, CV.doorPoint(dWall, door))
          + (door.garage ? 0 : S.DOOR_THRESHOLD_IN / 12);
        check(`door: ${door.id} stands on the floor${door.garage ? '' : ' plus its threshold'}`,
          near(bottom, stands, 0.01), `${ftIn(bottom)} vs ${ftIn(stands)}`);
        check(`door: ${door.id} is NOT left on the sill plate`,
          bottom < CV.garageBearing(base, fdn, attached) - 0.02,
          `${ftIn(bottom)} vs bearing ${ftIn(CV.garageBearing(base, fdn, attached))}`);
      });
      check(`door: an OVERHEAD door takes no threshold, ${where}`,
        (() => {
          const c = withDoor.find(x => doorOf(x).garage === true);
          const door = doorOf(c);
          const dWall = base.walls().find(x => x.id === door.wallId);
          return near(CV.garageFloorAt(base, fdn, attached, CV.doorPoint(dWall, door)),
            cTop - S.GARAGE_SLAB_AT_DOOR_IN / 12, 1e-9);
        })(), 'the overhead door sits at the pour less the door drop');
      });

      // ── THE NORMAL IS THE GARAGE'S, NOT THE WALL'S ─────────────────────
      //
      // Both fixtures happen to wind their overhead door's wall so its +normal
      // already points inside the garage, so no drawing either of them can make
      // tells an oriented normal from an unoriented one. Measured: the mutant
      // that drops the orientation changed NOTHING on either fixture.
      //
      // So ask it directly, with that one wall wound the other way -- which is
      // the half of all drawings the fixtures do not carry. Flipping the ends
      // moves the datum's origin ALONG the wall, and a perpendicular distance
      // to a line does not care where on the line it was measured from, so the
      // right answer is that nothing changes.
      {
        const pts = attached.points;
        const inside = {
          x: pts.reduce((a, q) => a + q.x, 0) / pts.length,
          z: pts.reduce((a, q) => a + q.z, 0) / pts.length,
        };
        const flipped = {
          ...base,
          walls: () => base.walls().map(w => (w.id === overhead.wallId
            ? { ...w, start: w.end, end: w.start } : w)),
        };
        const asDrawn = CV.garageDepthFt(base, attached, inside);
        const wound = CV.garageDepthFt(flipped, attached, inside);
        check('depth: a point inside the garage is a POSITIVE depth in',
          asDrawn > 0, `${asDrawn.toFixed(3)} ft in`);
        check('depth: and it stays the same with the door wall wound the other way',
          near(wound, asDrawn, 1e-6), `${wound.toFixed(3)} vs ${asDrawn.toFixed(3)}`);
        // AND OUTSIDE IS NEGATIVE, which is the whole point: the clamp in
        // garageSlabBelowConcreteIn only holds the floor at the door's own drop
        // if what reaches it is signed.
        const outside = {
          x: at.x + (at.x - inside.x) * 0.1,
          z: at.z + (at.z - inside.z) * 0.1,
        };
        check('depth: a point OUTSIDE the door is a negative depth',
          CV.garageDepthFt(base, attached, outside) < 0,
          `${CV.garageDepthFt(base, attached, outside).toFixed(3)} ft in`);
        check('depth: which the fall clamps to the door-s own drop, not past it',
          near(CV.garageDoorOpeningFt(base, attached, outside),
            S.GARAGE_SLAB_AT_DOOR_IN / 12, 1e-9),
          ftIn(CV.garageDoorOpeningFt(base, attached, outside)));
        // ── A GARAGE WITH NO OVERHEAD DOOR STILL HAS A SLAB ──────────────
        //
        // There is no fall without a datum to measure it from, and
        // garageDoorOpeningFt says so by answering zero -- right about a BUCK,
        // wrong about a FLOOR, where it would lay the slab flush with the pour
        // and lose its four inches. tests/section-garage-slab.spec.js draws
        // exactly this garage (no fenestrations at all), which is how it
        // surfaced.
        const doorless = { ...base, fenestrations: () => [] };
        check('a garage with no overhead door has no fall to measure',
          CV.garageDoorOpeningFt(doorless, attached, inside) === 0,
          ftIn(CV.garageDoorOpeningFt(doorless, attached, inside)));
        check('but its floor is still a slab below the pour, not flush with it',
          near(CV.garageFloorAt(doorless, fdn, attached, inside),
            CV.garageSlabTop(doorless, fdn, attached), 1e-9),
          `${ftIn(CV.garageFloorAt(doorless, fdn, attached, inside))}`
          + ` vs level ${ftIn(CV.garageSlabTop(doorless, fdn, attached))}`);
      }
    }
  }

  // ── A GARAGE'S GRADE BEAM BELONGS TO THE GARAGE ───────────────────────
  //
  // env.garageOutlines(levelId) filters to that level exactly, and the app's
  // builder raises the beam with `withOutline: false` -- so a garage has ONE
  // outline, on MAIN FL, and none on FOUNDATION. Every foundation wall came
  // back `house`, and with it the frost-wall garage slab block (which filters
  // on c.garage) never fired and the grade-beam slab always took its fallback.
  //
  // THE FIXTURE HID IT. proto/repro-garage-house.draft was saved by an older
  // builder that wrote a garage outline on EVERY level, level 1 included, so
  // the geometric path finds one there and these checks would pass on a shape
  // the app no longer produces. So the check below STRIPS that outline: it
  // asks the question the way today's files ask it.
  {
    const fdnWall = base.walls().find(w => (w.view || 'plan') === 'foundation'
      && CV.garageOfWall(w, base, {}) !== null);
    check('fixture: it has a garage foundation wall to ask about',
      !!fdnWall, fdnWall ? `wall ${fdnWall.id}` : 'none');
    if (fdnWall) {
      // Today's shape: no garage outline on the wall's own level.
      const noFdnOutline = {
        ...base,
        garageOutlines: id => (Number(id) === Number(fdnWall.levelId)
          ? [] : base.garageOutlines(id)),
      };
      check('a foundation wall marked `body: garage` still finds its garage',
        CV.garageOfWall({ ...fdnWall, body: 'garage' }, noFdnOutline, {}) !== null,
        String(CV.garageOfWall({ ...fdnWall, body: 'garage' }, noFdnOutline, {})?.id));
      // AND THE MARKER IS WHAT DID IT. Without this the check above passes on
      // any fixture that still carries the old level-1 outline, which is the
      // exact way this defect stayed invisible.
      check('and without the marker it does not, so the marker is what answered',
        CV.garageOfWall({ ...fdnWall, body: undefined }, noFdnOutline, {}) === null,
        String(CV.garageOfWall({ ...fdnWall, body: undefined }, noFdnOutline, {})?.id));
    }
    // WHICH GARAGE, NOT JUST A GARAGE. With one garage in the fixture,
    // "the first outline on that level" and "the one this wall lies on" are
    // the same answer, so a lookup that never checked would score green --
    // the mutation `the marker is trusted without checking WHICH garage`
    // survived until this check existed. A decoy garage, filed FIRST and
    // nowhere near the wall, is the whole difference.
    if (fdnWall) {
      const decoy = {
        ...attached,
        id: 'decoy-garage',
        points: attached.points.map(pt => ({ x: pt.x + 500, z: pt.z + 500 })),
      };
      const twoGarages = {
        ...base,
        garageOutlines: id => (Number(id) === Number(fdnWall.levelId) ? []
          : [decoy, ...base.garageOutlines(id)]),
      };
      const got = CV.garageOfWall({ ...fdnWall, body: 'garage' }, twoGarages, {});
      check('the marker finds the garage the wall LIES ON, not the first one filed',
        got !== null && got.id !== 'decoy-garage',
        `resolved to ${got ? got.id : 'null'}`);
    }
    // A HOUSE WALL IS NEVER CLAIMED. The marker is only ever read after
    // geometry comes back empty, so nothing that resolved before moves.
    const houseFdn = base.walls().filter(w => (w.view || 'plan') === 'foundation'
      && String(w.body || '').trim() !== 'garage');
    check('an unmarked foundation wall is still nobody\'s garage',
      houseFdn.every(w => CV.garageOfWall({ ...w, body: undefined },
        { ...base, garageOutlines: () => [] }, {}) === null),
      `${houseFdn.length} unmarked foundation walls`);
  }

  // ── A FOOTING IS WIDER THAN THE WALL ON IT, AT BOTH ENDS ──────────────
  //
  // Movie, 25 Sep, on E4 of a 2 STOREY + GARAGE + ROOM OVER: "the 6" X 8"
  // side of footing on left side of the house foundation is also missing".
  //
  // THE PROJECTION BELONGED TO THE RUN, NOT TO THE FACE. The buried
  // silhouette's stops were each face's WALL extent, and only the run's two
  // outer ends had projFt added. An attached garage's grade beam overlaps the
  // house across GARAGE_TIE_FT, so the two merge into ONE run whose outer end
  // is the BEAM's -- and a hung beam correctly has no footing -- leaving the
  // house's own end interior, with its 6" never spent.
  //
  // THE FIXTURE CATCHES IT IN BOTH DIRECTIONS, which is why it is worth
  // asking of every elevation rather than one. Measured before the fix:
  //
  //     E1  beam on the RIGHT  u 8..20    -8.50 -8.00  8.00  20.00
  //     E3  beam on the LEFT   u -20..-8  -20.00 -8.00 8.00   8.50
  //
  // -- on E1 the house's RIGHT end lost its step and on E3 its LEFT end did.
  // A check written for one side alone passes on the other's defect.
  {
    const projFt = Math.max(0, base.footingWidthIn(1) - 8) / 2 / 12;
    check('the footing projects (footingWidthIn - wall) / 2 -- 6" on concrete_8',
      near(projFt, 0.5), `${(projFt * 12).toFixed(2)}"`);
    standardElevationCuts(base).forEach(cut => {
      const painted = paintElevation(win, base, cut, { pxPerFt: 40 });
      const axis = painted.axis;
      const uOf = pt => pt.x * axis.x + pt.z * axis.z;
      const bearing = base.walls().filter(w => (w.view || 'plan') === 'foundation'
        && w.baseHeight <= 0.01);
      const hung = base.walls().filter(w => (w.view || 'plan') === 'foundation'
        && w.baseHeight > 0.01);
      if (!bearing.length || !hung.length) return;
      const us = bearing.flatMap(w => [uOf(w.start), uOf(w.end)]);
      const lo = Math.min(...us), hi = Math.max(...us);
      const hungUs = hung.flatMap(w => [uOf(w.start), uOf(w.end)]);
      // Only where the hung beam actually reaches this house end does the
      // merge happen; elsewhere the run's own end already carried the step.
      const merged = Math.min(...hungUs) < lo + 0.05 || Math.max(...hungUs) > hi - 0.05;
      if (!merged) return;
      // Every below-grade vertical the painter laid down.
      const verticals = [];
      (painted.strokes || []).forEach(stroke => stroke.pts.forEach((pt, i) => {
        if (i === 0 || pt.move) return;
        const prev = stroke.pts[i - 1];
        if (Math.abs(prev.u - pt.u) < 0.01 && Math.abs(prev.e - pt.e) > 0.05
          && Math.min(prev.e, pt.e) < fdn.grade + 0.01) verticals.push(pt.u);
      }));
      const at = u => verticals.some(v => Math.abs(v - u) < 0.02);
      check(`${cut.id}: the house footing steps out on BOTH sides of its wall`,
        at(lo - projFt) && at(hi + projFt),
        `wall ${ftIn(lo)}..${ftIn(hi)}; verticals at `
        + [...new Set(verticals.map(v => v.toFixed(2)))].sort((a, b) => a - b).join(' '));
    });
  }

  // ── AND THE PILES UNDER IT, DASHED ────────────────────────────────────
  //
  // Movie, 25 Sep: "we should should the dashed lines where the piles are
  // located on this view too". Nothing drew columns on an elevation before
  // this -- the env did not even serve them, which is why the first check is
  // that the fixture's piles reach the painter at all.
  {
    const piles = (base.columns ? base.columns() : []).filter(column =>
      (column.view || 'plan') === 'foundation'
      && String(column.footing || '').startsWith('pile'));
    check('fixture: its piles reach the painter through the env',
      piles.length > 0, `${piles.length} piles`);
    if (piles.length) {
      const bh = win.DraftBuildHouse;
      let hiddenSeen = 0;
      check('the env serves build-house, so a shaft can be drawn at its real bore',
        !!(bh && typeof bh.footingFor === 'function'), bh ? 'loaded' : 'missing');
      standardElevationCuts(base).forEach(cut => {
        const painted = paintElevation(win, base, cut, { pxPerFt: 40 });
        const axis = painted.axis;
        // The elevation of the concrete a pile at this station carries: the
        // deepest foundation wall whose span covers it.
        const fdnGeomsAt = u => {
          const bases = base.walls()
            .filter(w => (w.view || 'plan') === 'foundation')
            .map(w => ({
              lo: Math.min(w.start.x * axis.x + w.start.z * axis.z,
                w.end.x * axis.x + w.end.z * axis.z),
              hi: Math.max(w.start.x * axis.x + w.start.z * axis.z,
                w.end.x * axis.x + w.end.z * axis.z),
              base: w.baseHeight,
              baseE: fdn.wallBottom + w.baseHeight,
            }))
            .filter(g => g.hi - g.lo > 0.01 && g.lo - 0.5 <= u && u <= g.hi + 0.5);
          if (!bases.length) return null;
          // Same rule the painter uses: a pile carries HUNG concrete, so a
          // beam over the station answers before a bearing wall beside it.
          const hung = bases.filter(g => g.base > 0.01);
          return Math.min(...(hung.length ? hung : bases).map(g => g.baseE));
        };
        const deep = [];
        (painted.strokes || []).forEach(stroke => stroke.pts.forEach((pt, i) => {
          if (i === 0 || pt.move) return;
          const prev = stroke.pts[i - 1];
          if (Math.abs(prev.u - pt.u) < 0.01
            && Math.min(prev.e, pt.e) < fdn.footingBottom - 0.01) {
            deep.push({ u: pt.u, top: Math.max(prev.e, pt.e) });
          }
        }));
        // ── AND A PILE BEHIND THE FOUNDATION WALL IS NOT DRAWN ────────
        //
        // Movie, 26 Sep, on E2 of a 2 STOREY + GARAGE + ROOM OVER: "on
        // inside the far side pile shouldn't show because its 'behind' the
        // foundation wall". So "every pile in view" is no longer the whole
        // claim -- the view now has two kinds of pile in it, and BOTH halves
        // are asserted below. Without the second, "stop drawing piles" would
        // pass the first by having nothing left to be missing.
        //
        // THE PARTITION IS COMPUTED FROM THE RECORDS, not read back off the
        // ink: a bearing foundation wall (on a strip footing, not hung)
        // strictly over the pile's station and nearer than it along the
        // viewing axis. A hung beam beside a pile is not in front of it --
        // they share a perimeter -- and a wall's own END is beside a pile,
        // not over it, which is why both tests are strict.
        const dirVec = cut.dirVec;
        const fdnFaces = base.walls()
          .filter(w => (w.view || 'plan') === 'foundation')
          .map(w => ({
            lo: Math.min(w.start.x * axis.x + w.start.z * axis.z,
              w.end.x * axis.x + w.end.z * axis.z),
            hi: Math.max(w.start.x * axis.x + w.start.z * axis.z,
              w.end.x * axis.x + w.end.z * axis.z),
            depth: ((w.start.x * dirVec.x + w.start.z * dirVec.z)
              + (w.end.x * dirVec.x + w.end.z * dirVec.z)) / 2,
            bearing: w.baseHeight <= 0.01,
          }))
          .filter(g => g.hi - g.lo > 0.01);
        const buried = (u, depth) => fdnFaces.some(g => g.bearing
          && g.depth > depth + 1 && u > g.lo + 0.05 && u < g.hi - 0.05);

        const wanted = [];
        const hiddenWanted = [];
        piles.forEach(column => {
          const u = column.point.x * axis.x + column.point.z * axis.z;
          if (u < painted.uMin - 0.5 || u > painted.uMax + 0.5) return;
          const half = bh.footingFor(column.footing).sizeIn / 24;
          const depth = column.point.x * dirVec.x + column.point.z * dirVec.z;
          (buried(u, depth) ? hiddenWanted : wanted).push([u - half, u + half]);
        });
        if (hiddenWanted.length) {
          hiddenSeen += hiddenWanted.length;
        }
        if (!wanted.length && !hiddenWanted.length) return;
        // BOTH SIDES OF EVERY SHAFT. A centreline alone would pass a check
        // asking only that something was drawn near the station, and a pile
        // is a bore with a diameter the schedule names.
        // BY PROXIMITY, NEVER BY KEY. Both axes are pixel-snapped -- X() and
        // Y() each round to a pixel centre -- so a shaft the model puts at
        // u 7.583 is drawn at 7.57, and a lookup keyed on the rounded string
        // misses it entirely. That is not the code being wrong; it is the
        // check comparing a RENDER against model feet without allowing for
        // the render's own resolution.
        const at = u => deep.some(v => Math.abs(v.u - u) < 0.05);
        const topAt = u => {
          const hits = deep.filter(v => Math.abs(v.u - u) < 0.05);
          return hits.length ? Math.max(...hits.map(v => v.top)) : undefined;
        };
        const missing = wanted.filter(([a, b]) => !(at(a) && at(b)));
        check(`${cut.id}: every pile the wall does not cover is drawn, both sides`,
          missing.length === 0,
          `${wanted.length} clear of the wall, ${missing.length} missing`);
        const shown = hiddenWanted.filter(([a, b]) => at(a) || at(b));
        check(`${cut.id}: and no pile behind the foundation wall is drawn`,
          shown.length === 0,
          `${hiddenWanted.length} behind the wall, ${shown.length} drawn through it`);
        // AND IT STARTS UNDER THE BEAM, not at grade. A drilled pile begins
        // where the concrete it carries ends; hung off the grade line instead
        // it would draw a shaft through the beam it is holding up, and every
        // check above still passes -- that mutation survived until this one
        // existed.
        if (!missing.length) {
          const wrong = wanted.filter(([a, b]) => [a, b].some(edge => {
            const top = topAt(edge);
            if (top === undefined) return true;
            const over = fdnGeomsAt(edge);
            // ONE PIXEL OF SLACK, because this compares a RENDERED elevation
            // against model feet. Y() snaps every line to a pixel centre --
            // `Math.round(...) + 0.5`, which at 40 px/ft is 0.025 ft a step --
            // so the drawn top reads 0.017 ft off a head it is sitting exactly
            // on. A tolerance tighter than the render's own resolution fails
            // on correct code, which is what 0.02 did.
            return over === null || Math.abs(top - over) > 1 / painted.pxPerFt;
          }));
          check(`${cut.id}: and each shaft starts at the underside of its beam`,
            wrong.length === 0,
            wrong.length ? `${wrong.length} of ${wanted.length} start elsewhere`
              : `all ${wanted.length} under the concrete they carry`);
        }
      });
      // WITHOUT A PILE THE WALL ACTUALLY COVERS, the second claim above is a
      // filter over an empty list on every elevation and passes whatever the
      // painter does. On this fixture E2 is the one that reaches it: the
      // garage sits inside the house's footprint, so from that side its two
      // piles stand behind the house's foundation.
      check('fixture: some elevation stands the foundation wall in front of a pile',
        hiddenSeen > 0, `${hiddenSeen} pile(s) behind a wall`);
      // IT BREAKS AT THE DRAWING'S BOTTOM rather than running to its tip. A
      // P2 is 15' long; drawn to the tip it would hang seven feet of empty
      // ground under the building and push it up the sheet.
      const cut = standardElevationCuts(base)[0];
      const painted = paintElevation(win, base, cut, { pxPerFt: 40 });
      const lowest = Math.min(...(painted.strokes || [])
        .flatMap(stroke => stroke.pts.map(pt => pt.e)));
      check('the shaft breaks at the drawing, it does not reach the pile tip',
        lowest >= painted.yBottom - 0.01,
        `lowest ink ${ftIn(lowest)}, drawing floor ${ftIn(painted.yBottom)}`);
    }
  }

  // ── A RIM BAND IS HIDDEN BY WHATEVER STANDS IN FRONT OF IT ────────────
  //
  // Movie, 25 Sep, marking it in red on E1 and E4 of his own build: "the main
  // floor looks like it over 'overlayed' overtop of the attached garage
  // walls/door etc".
  //
  // houseFaces drops every garage face -- it was built for houseHi, where
  // dropping them IS the point -- and houseSpans inherited that blindness, so
  // the rim band asked "is a nearer face covering this?" of a list the garage
  // had been removed from. Measured on E1 of his file, the garage's front wall
  // being the nearest face in the drawing:
  //
  //     seq 56  u  -4.0..20.0  e -1.05..8.10   the garage's face
  //     seq 61  u -16.0..16.0  e -1.07..0.03   the house's rim band, after
  //
  // THE INVARIANT, not the instance: no painted rim band may overlap a face
  // nearer than the one it belongs to. Asked of every elevation, because
  // which side the garage lands on changes with the view.
  {
    let reached = 0;
    standardElevationCuts(base).forEach(cut => {
      const painted = paintElevation(win, base, cut, { pxPerFt: 40 });
      const axis = painted.axis;
      const faceSpans = base.walls()
        .filter(w => (w.view || 'plan') === 'plan' && Number(w.levelId) > 0)
        .map(w => ({
          lo: Math.min(w.start.x * axis.x + w.start.z * axis.z,
            w.end.x * axis.x + w.end.z * axis.z),
          hi: Math.max(w.start.x * axis.x + w.start.z * axis.z,
            w.end.x * axis.x + w.end.z * axis.z),
          depth: ((w.start.x * cut.dirVec.x + w.start.z * cut.dirVec.z)
            + (w.end.x * cut.dirVec.x + w.end.z * cut.dirVec.z)) / 2,
          garage: CV.garageOfWall(w, base, {}) !== null,
        }))
        .filter(span => span.hi - span.lo >= 0.5);
      // A rim band is the floor package seen flat: a face-ink fill whose
      // height is a level's floorTop..floorBottom.
      const levels = stack.floors;
      const bands = (painted.modelFills || []).map(f => f.pts || []).filter(pts => pts.length)
        .map(pts => ({
          lo: Math.min(...pts.map(p => p.u)), hi: Math.max(...pts.map(p => p.u)),
          e0: Math.min(...pts.map(p => p.e)), e1: Math.max(...pts.map(p => p.e)),
        }))
        .filter(f => levels.some(l => Math.abs(f.e1 - l.floorTop) < 0.06
          && Math.abs(f.e0 - l.floorBottom) < 0.06));
      if (!bands.length) return;
      // Each band belongs to the deepest house face under it; anything NEARER
      // than that, garage included, should have clipped it.
      bands.forEach(band => {
        const under = faceSpans.filter(sp => sp.hi > band.lo + 0.05 && sp.lo < band.hi - 0.05);
        if (!under.length) return;
        const own = Math.max(...under.map(sp => sp.depth));
        const infront = faceSpans.filter(sp => sp.depth > own + 1e-6
          && sp.hi > band.lo + 0.05 && sp.lo < band.hi - 0.05);
        if (faceSpans.some(sp => sp.garage && sp.depth > own + 1e-6)) reached += 1;
        check(`${cut.id}: the rim band at ${ftIn(band.e1)} is not painted over a nearer face`,
          infront.length === 0,
          infront.length
            ? `band u ${band.lo.toFixed(1)}..${band.hi.toFixed(1)} is covered by `
              + infront.map(sp => `${sp.garage ? 'garage' : 'house'} u ${sp.lo.toFixed(1)}..${sp.hi.toFixed(1)}`).join(', ')
            : `u ${band.lo.toFixed(1)}..${band.hi.toFixed(1)} clear`);
      });
    });
    // WITHOUT A GARAGE IN FRONT OF A BAND SOMEWHERE, the checks above are a
    // filter over an empty list and pass whatever the painter does.
    check('fixture: some elevation stands the garage in front of a rim band',
      reached > 0, `${reached} band(s) with a nearer garage face`);
  }

  // ── AND NO PAPER BETWEEN THE CONCRETE AND WHAT STANDS ON IT ───────────
  //
  // Movie, 25 Sep, on E4 of a 2 STOREY + GARAGE + ROOM OVER: "looks like the
  // side connection is fixed but there is a new gap looks like at sill
  // location" ... "sill attachment 1.5"".
  //
  // THE GAP IS THIS FILE'S OWN FIX SEEN FROM ABOVE. The mutant at the foot of
  // this harness -- "the foundation base forgets the sill plate, as it did
  // before 97a82c9" -- pins the concrete topping out one plate BELOW the
  // bearing line, which is where concrete really tops out. Nothing then
  // painted that plate, so the wall above it started 1 1/2" clear of the
  // concrete below it and the building's own corner lines broke across the
  // slot. Measured on this fixture, E4:
  //
  //     the rim band's bottom        -1.0521      what bears
  //     a garage face's floor        -1.0521      what bears
  //     every exposed concrete top   -1.1771      what it bears ON
  //
  // ASKED AS INK AND NOT AS GEOMETRY, on purpose. The heights above were
  // already right and already checked; what was wrong was that nothing was
  // PAINTED between them, and only the tape can see an absence. Three probes
  // down one vertical -- inside the concrete, inside the strip, inside the
  // wall -- and the claim is that the strip belongs to the wall: same ink as
  // the wall, different ink from the concrete below.
  //
  // THE DIFFERENT-INK HALF IS WHAT KEEPS IT HONEST. Without it, "draw the
  // concrete 1 1/2" taller" passes -- and that is the other wrong answer,
  // the one that puts the top-of-concrete line back where 97a82c9 took it
  // from.
  //
  // AND THE WALL'S INK COMES FROM THE RIM BAND, not from the wall directly
  // over the strip. Two drafts went that way and both broke on the same
  // thing: a GARAGE DOOR is drawn from the garage floor up, so it starts
  // exactly at the bearing line the "wall" probe sits above. Four of
  // eighteen faces read the door's fill as the wall's; sampling across the
  // face and voting fixed those and then broke on E3, where the visible
  // stretch of one garage wall is ENTIRELY behind its door and every vote
  // said door.
  //
  // THE RIM BAND CANNOT BE BEHIND AN OPENING. It is the floor package seen
  // flat -- the block above this one is built on exactly that -- and the
  // painter's note says it is painted "white like the walls", which is the
  // same C.face this strip must use. So the band is where the wall's ink is
  // read from, once per elevation, and the strip is compared against it.
  {
    let reached = 0;
    const fillAt = (painted, u, e) => {
      let found = null;
      (painted.modelFills || []).forEach(f => {
        const us = f.pts.map(p => p.u), es = f.pts.map(p => p.e);
        if (u > Math.min(...us) + 1e-6 && u < Math.max(...us) - 1e-6
          && e > Math.min(...es) + 1e-6 && e < Math.max(...es) - 1e-6) found = f;
      });
      return found;   // LAST wins: modelFills is in paint order
    };
    standardElevationCuts(base).forEach(cut => {
      const painted = paintElevation(win, base, cut, { pxPerFt: 40 });
      const axis = painted.axis;
      const uOf = pt => pt.x * axis.x + pt.z * axis.z;
      const band = (painted.modelFills || []).find(f => stack.floors.some(l =>
        Math.abs(Math.max(...f.pts.map(p => p.e)) - l.floorTop) < 0.06
        && Math.abs(Math.min(...f.pts.map(p => p.e)) - l.floorBottom) < 0.06));
      if (!band) return;                              // no framed floor in view
      const wallInk = band.ink;
      base.walls().filter(w => (w.view || 'plan') === 'foundation').forEach(w => {
        const lo = Math.min(uOf(w.start), uOf(w.end));
        const hi = Math.max(uOf(w.start), uOf(w.end));
        if (hi - lo < 0.5) return;                    // edge-on to this view
        const garage = CV.garageOfWall(w, base, {});
        const conc = fdn.wallBottom + w.topHeight;    // top of THIS concrete
        const bear = garage ? CV.garageBearing(base, fdn, garage) : fdn.wallTop;
        if (bear - conc < 0.01) return;               // nothing bears a plate here
        if (conc - fdn.grade < 0.4) return;           // no exposed face to stand on
        // ── AND NOT ACROSS A DOOR, where there is no plate to paint ─────
        //
        // A door buck is notched out of the top of the beam and the door
        // stands in it, so over its width the plate band carries the DOOR,
        // not the wall's finish. Eight stations walked blindly across a
        // garage's front wall put two of them inside a 16 ft overhead door
        // and read the recess.
        //
        // TAKEN FROM THE MODEL, not from what is painted there: asking the
        // drawing "is the concrete missing here" would let a painter that
        // wrongly removed it skip its own defect.
        const doors = base.fenestrations()
          .filter(f => (f.type || f.kind) === 'door')
          .map(f => {
            const dw = base.walls().find(x => x.id === f.wallId);
            if (!dw || !garage || CV.garageOfWall(dw, base, {}) !== garage) return null;
            const len = Math.hypot(dw.end.x - dw.start.x, dw.end.z - dw.start.z);
            if (!(len > 1e-6)) return null;
            const a = uOf(dw.start), b = uOf(dw.end);
            const perFt = (b - a) / len;
            const uc = a + perFt * f.offset;
            const half = Math.abs(perFt) * f.width / 2;
            return half > 0.05 ? { lo: uc - half, hi: uc + half } : null;
          }).filter(Boolean);
        const inDoor = u => doors.some(d => u > d.lo - 0.05 && u < d.hi + 0.05);
        const N = 9;
        const seen = [];
        for (let i = 1; i < N; i += 1) {
          const u = lo + (hi - lo) * i / N;
          if (inDoor(u)) continue;
          const below = fillAt(painted, u, conc - 0.3);
          // THE CONCRETE MUST BE SHOWING or this vertical says nothing: where
          // a nearer face covers it there is no strip to paint.
          if (!below || below.ink === wallInk) continue;
          seen.push({ u, below, strip: fillAt(painted, u, (conc + bear) / 2) });
        }
        if (!seen.length) return;
        reached += 1;
        // ── AND IT IS NOT OUTLINED, WHICH IS A DIFFERENT THING ──────────
        //
        // Movie, 26 Sep, after the fill above was in: "there is still a gap
        // where the garage sill plate should be (i think its the sill plate
        // location)". Read off that build's E4 at the garage:
        //
        //     fill   u -46..-19  e -1.1729..-1.0479   the plate, C.face
        //     stroke u -46..-19  e -1.1729            top of concrete, w1
        //     stroke u -46..-19  e -1.0479            the wall's base, w1.25
        //
        // Filled or not, a strip bracketed by two lines reads as a slot --
        // and at 1.25 against the concrete's 1 the bracket was heavier than
        // the thing it bracketed. The rim band has had this rule from the
        // start ("white like the walls, no banding line"); a garage wall
        // face closed its outline along its own base and did not.
        //
        // BOTH HALVES OR NEITHER. Without the second check, "stroke nothing
        // down there" passes -- and the top of the pour is a real line that
        // has to stay.
        //
        // AND THEN HE ASKED FOR IT, LIGHTER BELOW. Movie, 4 Oct: "i'm
        // considering adding a second line (1.5\" down) to show the location
        // of the sill plate", then "make the lower 'sil plate' line lighter".
        // So the plate's top now carries the full-weight line and the top
        // of the pour under it goes light -- the weight difference is what
        // keeps the strip from reading as a slot.
        const INK_FULL = '#1d1f20';   // PAPER_INKS.line, the painter's INK
        const strokeAt = e => painted.strokes.find(s => {
          for (let k = 1; k < s.pts.length; k += 1) {
            const a = s.pts[k - 1], b = s.pts[k];
            if (b.move || b.close) continue;
            if (Math.abs(a.e - b.e) > 0.01 || Math.abs(a.e - e) > 0.04) continue;
            if (Math.max(a.u, b.u) < lo + 0.05 || Math.min(a.u, b.u) > hi - 0.05) continue;
            return true;
          }
          return false;
        });
        const topLine = strokeAt(bear), pourLine = strokeAt(conc);
        check(`${cut.id}: the ${garage ? 'garage' : 'house'} sill plate over ${ftIn(conc)} carries a full-weight line across its top`,
          !!topLine && topLine.ink === INK_FULL, `probed ${ftIn(bear)} over u ${lo.toFixed(2)}..${hi.toFixed(2)}: ${topLine ? topLine.ink : 'none'}`);
        check(`${cut.id}: and the top of the pour at ${ftIn(conc)} still draws one, lighter`,
          !!pourLine && pourLine.ink !== INK_FULL, `probed ${ftIn(conc)} over u ${lo.toFixed(2)}..${hi.toFixed(2)}: ${pourLine ? pourLine.ink : 'none'}`);
        const bad = seen.filter(s => !s.strip || s.strip.ink !== wallInk);
        check(`${cut.id}: the ${garage ? 'garage' : 'house'} sill plate over ${ftIn(conc)} is painted, and as WALL`,
          bad.length === 0,
          bad.length
            ? `${bad.length}/${seen.length} probes: ${bad.slice(0, 2).map(s => `u ${s.u.toFixed(1)} ${s.strip ? s.strip.ink : 'BARE'}`).join(', ')}`
              + ` -- wall ${wallInk}, concrete ${seen[0].below.ink}`
            : `${seen.length} probes ${wallInk} over ${seen[0].below.ink}`);
      });
    });
    // WITH NO EXPOSED FACE ANYWHERE the loop above is a filter over an empty
    // list, which passes whatever the painter does.
    check('fixture: some elevation shows concrete with a wall standing on it',
      reached > 0, `${reached} exposed face(s) probed`);
  }

  // ── A HUNG BEAM'S UNDERSIDE RUNS ITS WHOLE LENGTH ─────────────────────
  //
  // Movie, 25 Sep, marking it in green on E1 of a 2 STOREY + GARAGE: "i
  // noticed the bottom of the dashed line for the grade beam is missing
  // where it crosses the house".
  //
  // THE BURIED OUTLINE IS A SILHOUETTE. It asks for the DEEPEST concrete
  // under each stretch, which is right for the excavation's edge and wrong
  // for a beam hanging over a footing: the house's footing is deeper, so the
  // minimum is the footing's bottom and the beam's own underside is never
  // drawn. Measured on this fixture before the fix -- and it is every
  // elevation, because an attached beam laps the house by GARAGE_TIE_FT:
  //
  //     E1  missing u  8.00..8.50     E2  missing u -4.00..4.00
  //     E3  missing u -8.50..-8.00    E4  missing u -4.00..4.00
  //
  // ASKED AS COVERAGE, not as a count of strokes. The line may arrive in one
  // piece or in two -- part from the silhouette where the beam hangs clear,
  // part from the pass that fills in what the silhouette swallowed -- and
  // what Movie is looking at is whether the beam's underside is THERE. Merging
  // the horizontals at that elevation and comparing them against the stretch
  // that should carry ink is that question and not a re-statement of how the
  // painter happens to split it.
  //
  // ── AND NOWHERE A BEARING WALL STANDS IN FRONT OF IT ──────────────────
  //
  // Which is the other half, and Movie ruled on it twice on 26 Sep, once per
  // side. On E3 BACK: "the grade beam line extends over the house foundation
  // (which is in front of the grade beam) where the house foundation is in
  // front ... the grade beam dashed line bottom shouldn't show." Then on E2
  // LEFT, on a later build: "the bottom dashed line of the grade beam is
  // extending into where the house foundation should be in front (shouldn't
  // see the bottom of grade beam where the house foundation is in front".
  //
  // SO THE CHECK IS TWO CLAIMS OVER ONE MEASUREMENT, the shape the piles
  // already use: the underside is drawn across every stretch that is not
  // behind a bearing wall, AND across none of the stretch that is. Either
  // alone is satisfied by a painter that has given up -- drawing all of it
  // passes the first, drawing none of it passes the second.
  //
  // THE COVER IS COMPUTED FROM THE MODEL, not read back off the painter: a
  // foundation face NEARER than the beam by more than a foot, whose concrete
  // spans the elevation of the beam's underside. The foot of slack is what
  // keeps a face from being read as standing in front of itself. Nothing here
  // asks whether the cover is a WALL rather than another beam, and the note
  // at the pass in cut-view.js says why: a garage's own near beam hangs at
  // the same elevation as its far one and draws the same stretch, so the
  // question has no answer to give.
  //
  // AND EXACT EDGES, not the piles' 0.05 slack. A pile is a yes/no question
  // about one station; a bottom is a range, so a stretch that merely TOUCHES
  // the wall's end keeps all of it. Which is the case Movie signed off --
  // "this side view looks perfect" -- and it is every junction: the garage's
  // beam starts exactly where the house's wall stops.
  //
  // TWO FIXTURES, because one of them cannot show the middle case.
  // repro-garage-house has the garage projecting straight back, so its beam
  // is either wholly in front of the house (E4), wholly behind it (E2), or
  // beside it (E1, E3) -- no elevation splits a beam. repro-2storey-garage-beam
  // laps the house by GARAGE_TIE_FT, which is what Movie was looking at:
  //
  //     E3  beam u -20.00.. 4.00 depth -46, house u -16.00..16.00 depth  20
  //         -> shown -20.00..-16.00, hidden -16.00..4.00   (twenty feet)
  //     E2  beam u  19.00..46.00 depth -20, house u -20.00..20.00 depth  16
  //         -> shown  20.00..46.00, hidden  19.00..20.00   (the lap itself)
  {
    let reached = 0, partly = 0;
    const merge = ivs => {
      const out = [];
      ivs.slice().sort((x, y) => x.lo - y.lo).forEach(iv => {
        const last = out[out.length - 1];
        if (last && iv.lo <= last.hi + 0.02) last.hi = Math.max(last.hi, iv.hi);
        else out.push({ lo: iv.lo, hi: iv.hi });
      });
      return out;
    };
    const minus = (parts, cut) => parts.flatMap(p => {
      if (cut.hi <= p.lo || cut.lo >= p.hi) return [p];
      const kept = [];
      if (cut.lo > p.lo) kept.push({ lo: p.lo, hi: cut.lo });
      if (cut.hi < p.hi) kept.push({ lo: cut.hi, hi: p.hi });
      return kept;
    }).filter(p => p.hi - p.lo >= 0.05);
    const FIXTURES = [['repro-garage-house', base]];
    ['repro-2storey-garage-beam'].forEach(name => FIXTURES.push([name,
      buildEnv(win, JSON.parse(fs.readFileSync(
        path.join(ROOT, 'proto', `${name}.draft`), 'utf8')))]));
    FIXTURES.forEach(([fixture, env]) => {
      const ff = CV.sectionLevelStack(env).foundation;
      standardElevationCuts(env).forEach(cut => {
        const painted = paintElevation(win, env, cut, { pxPerFt: 40 });
        const axis = painted.axis, dir = cut.dirVec;
        const uOf = pt => pt.x * axis.x + pt.z * axis.z;
        const dOf = w => ((w.start.x * dir.x + w.start.z * dir.z)
          + (w.end.x * dir.x + w.end.z * dir.z)) / 2;
        const faceOf = w => ({
          lo: Math.min(uOf(w.start), uOf(w.end)),
          hi: Math.max(uOf(w.start), uOf(w.end)),
          depth: dOf(w),
          bearing: w.baseHeight <= 0.01,
          // A BEARING WALL'S BOTTOM IS ITS FOOTING'S UNDERSIDE; a hung beam's
          // bottom is its own base. cut-view.js says the same thing as
          // `bottomOf`, and this is the independent spelling of it.
          bottom: ff.wallBottom + w.baseHeight
            - (w.baseHeight <= 0.01 ? ff.footingIn / 12 : 0),
          topE: ff.wallBottom + w.topHeight,
        });
        const all = env.walls()
          .filter(w => (w.view || 'plan') === 'foundation').map(faceOf)
          .filter(f => f.hi - f.lo >= 0.5);       // edge-on to this view
        const byE = new Map();
        all.filter(f => !f.bearing && f.bottom < ff.grade - 0.05).forEach(f => {
          const key = f.bottom.toFixed(4);
          const g = byE.get(key) || byE.set(key, { e: f.bottom, faces: [] }).get(key);
          g.faces.push(f);
        });
        byE.forEach(({ e, faces }) => {
          const span = merge(faces.map(f => ({ lo: f.lo, hi: f.hi })));
          const shown = merge(faces.flatMap(f => all
            .filter(o => o.depth > f.depth + 1
              && o.bottom <= e + 1e-6 && o.topE > e + 1e-6)
            .reduce(minus, [{ lo: f.lo, hi: f.hi }])));
          const hidden = shown.reduce(minus, span);
          const drawn = merge(painted.strokes.flatMap(s => {
            const out = [];
            for (let k = 1; k < s.pts.length; k += 1) {
              const a = s.pts[k - 1], b = s.pts[k];
              if (b.move || b.close) continue;
              // THE TAPE IS A HALF-PIXEL OFF the model number by construction
              // (paintElevation maps screen centres back), which at 40px/ft
              // is 0.0125 ft; 0.04 clears that without reaching the next
              // thing anything is drawn at.
              if (Math.abs(a.e - b.e) > 0.01 || Math.abs(a.e - e) > 0.04) continue;
              out.push({ lo: Math.min(a.u, b.u), hi: Math.max(a.u, b.u) });
            }
            return out;
          }));
          const where = `drawn ${drawn.length
            ? drawn.map(m => `${m.lo.toFixed(2)}..${m.hi.toFixed(2)}`).join(', ')
            : '(nothing)'}`;
          reached += 1;
          if (hidden.length) partly += 1;
          if (shown.length) {
            check(`${fixture} ${cut.id}: the hung beam's underside at ${ftIn(e)}`
              + ` runs the ${shown.reduce((t, p) => t + p.hi - p.lo, 0).toFixed(1)} ft`
              + ' nothing stands in front of',
              shown.every(p => drawn.some(m => m.lo <= p.lo + 0.02 && m.hi >= p.hi - 0.02)),
              `${where} -- wants ${shown.map(p => `${p.lo.toFixed(2)}..${p.hi.toFixed(2)}`).join(', ')}`);
          }
          if (hidden.length) {
            const over = hidden.flatMap(p => drawn
              .map(m => ({ lo: Math.max(p.lo, m.lo), hi: Math.min(p.hi, m.hi) }))
              .filter(iv => iv.hi - iv.lo > 0.05));
            check(`${fixture} ${cut.id}: and none of the ${hidden
              .reduce((t, p) => t + p.hi - p.lo, 0).toFixed(1)} ft`
              + ` of it standing behind concrete, at ${ftIn(e)}`,
              over.length === 0,
              over.length
                ? `${where} -- through ${over.map(iv => `${iv.lo.toFixed(2)}..${iv.hi.toFixed(2)}`).join(', ')}`
                : `${where} -- hidden ${hidden.map(p => `${p.lo.toFixed(2)}..${p.hi.toFixed(2)}`).join(', ')}`);
          }
        });
      });
    });
    // WITHOUT A HUNG BEAM the loop above is a filter over an empty list and
    // passes whatever the painter does. AND WITHOUT A BEAM BEHIND A WALL the
    // second claim is never made at all, which is the half Movie reported.
    check('fixture: the garage hangs a grade beam below grade',
      reached > 0, `${reached} beam elevation(s) probed`);
    check('fixture: and some of it stands behind other concrete',
      partly > 0, `${partly} of ${reached} partly or wholly covered`);
  }

  // ── A DOOR IS A NOTCH OUT OF THE TOP OF THE BEAM ──────────────────────
  //
  // Movie, 25 Sep: "the 1ft door buck - and 8" garage door drops. (and 4" slab
  // filling the 4" gap between door and door buck - completing 24" height
  // grade beam ... i guess the door buck will appear on the elevations as a 8"
  // opening in the top of the concrete (but man doors and garage door bucks
  // will be less if they are located at the back of the garage". And 26 Sep,
  // settling which of the two varies: "the slab will always pour over the 1ft
  // door buck and fill in the extra space".
  //
  // SO THE VOID IS CONSTANT AND THE FILL IS NOT. A foot is formed out of the
  // top of the beam at every door, leaving 20" of concrete under it; the slab
  // is poured over the buck and fills what is left; and what a drafter sees in
  // the elevation is the part the slab did not fill, which is the slab's own
  // fall at that door.
  //
  // TWO CLAIMS, AND THE SECOND IS WHY THE FIRST IS NOT A CONSTANT. The notch
  // is as deep as the fall AND a door further in is notched LESS -- a painter
  // that cut 8" at every door passes the first and fails the second.
  {
    const S2 = CV.STANDARDS;
    // THE ARITHMETIC FIRST, on its own, because the painting below reads the
    // same function and could agree with it while both were wrong.
    check('a door buck is a foot, whatever the slab does',
      S2.GARAGE_DOOR_BUCK_IN === 12, `${S2.GARAGE_DOOR_BUCK_IN}"`);
    const fallAt = d => CV.garageSlabBelowConcreteIn(d);
    check('and the opening at the overhead door is the slab-s fall there',
      near(fallAt(0), S2.GARAGE_SLAB_AT_DOOR_IN, 1e-9), `${fallAt(0)}"`);
    check('and it shrinks going in, at the slab-s own slope',
      near(fallAt(24), S2.GARAGE_SLAB_AT_DOOR_IN - 24 * S2.GARAGE_SLAB_SLOPE_IN_PER_FT, 1e-9),
      `${fallAt(24)}" at 24 ft against ${S2.GARAGE_SLAB_AT_DOOR_IN}" at the door`);
    check('and is gone where the slab has climbed level with the pour',
      near(fallAt(S2.GARAGE_SLAB_FLAT_AT_FT), 0, 1e-9)
        && near(fallAt(S2.GARAGE_SLAB_FLAT_AT_FT + 20), 0, 1e-9),
      `${fallAt(S2.GARAGE_SLAB_FLAT_AT_FT)}" at ${S2.GARAGE_SLAB_FLAT_AT_FT} ft`);

    let doorsSeen = 0, shallower = 0, platesSeen = 0;
    const FACE_W = 1;
    [['repro-garage-house', base],
      ['repro-2storey-garage-beam', buildEnv(win, JSON.parse(fs.readFileSync(
        path.join(ROOT, 'proto', 'repro-2storey-garage-beam.draft'), 'utf8')))],
    ].forEach(([fixture, env]) => {
      const eFdn = CV.sectionLevelStack(env).foundation;
      const byId = new Map(env.walls().map(w => [w.id, w]));
      standardElevationCuts(env).forEach(cut0 => {
        // FINE, because the thing being measured is inches. The tape maps
        // screen centres back to feet, so at 40px/ft a half pixel is 0.15" and
        // a 4 5/8" notch cannot be told from a 4 1/2" one; at 400 it is 0.015".
        const painted = paintElevation(win, env, cut0, { pxPerFt: 400 });
        const axis = painted.axis;
        // EVERY GARAGE DOOR, PROJECTED, with the opening the model says it has.
        // The overhead door's own wall is the datum: `garage: true` on the
        // fenestration is the builder's word for which door that is.
        const overhead = env.fenestrations().find(f => f.garage === true
          && (f.type || f.kind) === 'door' && byId.get(f.wallId));
        const oWall = overhead && byId.get(overhead.wallId);
        const datum = (() => {
          if (!oWall) return null;
          const dx = oWall.end.x - oWall.start.x, dz = oWall.end.z - oWall.start.z;
          const len = Math.hypot(dx, dz);
          return len > 1e-6 ? { at: oWall.start, nx: -dz / len, nz: dx / len } : null;
        })();
        const want = [];
        env.fenestrations().forEach(f => {
          if ((f.type || f.kind) !== 'door') return;
          const wall = byId.get(f.wallId);
          const garage = wall && CV.garageOfWall(wall, env, {});
          if (!garage) return;
          const len = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
          if (!(len > 1e-6)) return;
          const t = f.offset / len;
          const pt = { x: wall.start.x + (wall.end.x - wall.start.x) * t,
            z: wall.start.z + (wall.end.z - wall.start.z) * t };
          // THE FALL, WORKED OUT HERE. Asking cut-view's own
          // `garageDoorOpeningFt` would compare the painter against itself:
          // a mutation that notched every door 8" changed both sides and
          // survived. So the distance is measured off the overhead door's
          // wall -- the datum the slab falls from -- and handed to
          // `garageSlabBelowConcreteIn`, whose own arithmetic is pinned above.
          if (!datum) return;
          const into = Math.abs((pt.x - datum.at.x) * datum.nx
            + (pt.z - datum.at.z) * datum.nz);
          const open = CV.garageSlabBelowConcreteIn(into) / 12;
          if (open <= 0.01) return;
          const uA = wall.start.x * axis.x + wall.start.z * axis.z;
          const uB = wall.end.x * axis.x + wall.end.z * axis.z;
          const perFt = (uB - uA) / len;
          const half = Math.abs(perFt) * f.width / 2;
          if (half < 0.25) return;            // edge on to this view
          const uc = uA + perFt * f.offset;
          want.push({ id: f.id, lo: uc - half, hi: uc + half, open, overhead: f.garage === true });
        });
        if (!want.length) return;
        // ── READ THE NOTCHES THE DRAWING HAS, then match each to a door ──
        //
        // Asked the other way round -- take every door and look for its notch
        // -- this needs to know which doors are VISIBLE on this elevation,
        // which is `visibleRuns`' whole job in the painter and would be a
        // second copy of it here. A notch, on the other hand, is self-evident
        // in the tape: a face paints its top, its base and its door sills in
        // ONE stroke, so a run that sits below its own stroke's highest run
        // and above grade IS a sill, and nothing else is.
        const byStroke = new Map();
        painted.strokes.forEach((st, i) => {
          if (Math.abs(st.w - FACE_W) > 1e-9) return;
          for (let k = 1; k < st.pts.length; k += 1) {
            const a = st.pts[k - 1], b = st.pts[k];
            if (b.move || b.close) continue;
            if (Math.abs(a.e - b.e) > 0.005 || Math.abs(a.u - b.u) < 0.2) continue;
            if (a.e < eFdn.grade + 0.2) continue;        // the base, not the top
            const list = byStroke.get(i) || byStroke.set(i, []).get(i);
            list.push({ e: a.e, lo: Math.min(a.u, b.u), hi: Math.max(a.u, b.u) });
          }
        });
        // ── THE CONCRETE'S TOP DOES NOT STEP AT A DOOR ──────────────────
        //
        // Movie, 26 Sep: *"on the elevations don't show the line where the
        // pour and grade beam [meet] - just show them all as concrete. in the
        // sections you can show that line."*
        //
        // THIS BLOCK USED TO ASSERT THE STEP. Board #45's first half drew the
        // buck here as an opening in the top of the concrete and these checks
        // measured its depth against the slab's fall. Seeing it drawn he
        // called it off: the slab is poured into the buck and fills it, so
        // from outside there is one concrete face and no joint to draw. The
        // claim inverts -- a run below its own stroke's top, above grade, is
        // now a defect wherever it appears.
        //
        // THE SAME READING EITHER WAY, which is why it inverts cleanly rather
        // than being deleted: a face paints its top, its base and anything in
        // between in ONE stroke, so a run below that stroke's highest and
        // above grade IS a step in the top of the concrete and nothing else.
        byStroke.forEach(runs => {
          const top = Math.max(...runs.map(r => r.e));
          runs.filter(r => r.e < top - 0.005).forEach(step => {
            const door = want.find(d => Math.abs(d.lo - step.lo) < 0.05
              && Math.abs(d.hi - step.hi) < 0.05);
            check(`${fixture} ${cut0.id}: the concrete's top does not step at u `
              + `${step.lo.toFixed(2)}..${step.hi.toFixed(2)}`,
              false, `${((top - step.e) * 12).toFixed(2)}" below this face's top`
                + `${door ? ` -- ${door.id}'s buck, which now fills flush` : ''}`);
          });
        });
        // ── AND THE PLATE STILL STOPS AT EVERY DOOR ─────────────────────
        //
        // That rule did not change with the step and must not be carried off
        // by it: the sill plate is what the wall above bears on, and over a
        // door there is no wall over it however the concrete under it is
        // drawn.
        //
        // FOUND BY WHAT IT IS, NOT BY WHOSE FACE IT SITS ON. Pairing a door
        // with its face needs `visibleRuns`' answer -- which of several bodies
        // is nearest over this span -- and a second copy of that here got it
        // wrong four ways on the first run: it matched the garage's man door
        // to the HOUSE's face on an elevation the door is not even drawn on,
        // and read the foundation wall's own openings as doors with plates
        // over them.
        //
        // A PLATE IS A STRIP ONE PLATE THICK. Nothing else on an elevation is
        // 1 1/2" tall -- a wall face is feet -- so the fills can be sieved for
        // it directly, with no face to pair and no depth to recover. Then the
        // claim is flat: no such strip overlaps a garage door's span, on any
        // face, on any elevation.
        const plateFt = S.GARAGE_BEAM_PLATE_IN / 12;
        const plates = painted.modelFills.map(f => ({
          lo: Math.min(...f.pts.map(q => q.u)), hi: Math.max(...f.pts.map(q => q.u)),
          bot: Math.min(...f.pts.map(q => q.e)), top: Math.max(...f.pts.map(q => q.e)),
        })).filter(f => Math.abs((f.top - f.bot) - plateFt) < 0.01 && f.hi - f.lo > 0.1);
        platesSeen += plates.length;
        // ── AND ONLY WHERE THE PAINTER DREW THE DOOR ────────────────────
        //
        // A plate strip over a door's SPAN is not a plate over the DOOR: on an
        // elevation where the garage stands behind the house, the house's own
        // face and its plate run across that span and are perfectly right to.
        // Asserted without this, the rule failed four ways on faces the door
        // is not drawn on at all.
        //
        // THE OPENING IS THE PAINTER'S OWN ANSWER to which face is nearest
        // there -- it only paints a recess where the door is the visible thing
        // -- so a door with one on this view has nothing in front of it, and
        // any plate crossing its span would have to be its own face's.
        // Recognised by its span and its height: a fill exactly as wide as the
        // rough opening and taller than a man, which nothing else on an
        // elevation is.
        // THE TAPE KEEPS WHAT WAS PAINTED OVER. An elevation has no occlusion
        // RULE, it has an ORDER -- far first, each opaque surface covering
        // what it stands in front of -- so a fill in the list is not a fill on
        // the sheet. On repro-2storey-garage-beam E3 the house stands in front
        // of the garage's front wall, and the garage's door opening is in the
        // tape, painted and then buried. Read as drawn, it made the house's
        // own plate look like a plate over that door.
        const boxOf = f => ({
          lo: Math.min(...f.pts.map(q => q.u)), hi: Math.max(...f.pts.map(q => q.u)),
          bot: Math.min(...f.pts.map(q => q.e)), top: Math.max(...f.pts.map(q => q.e)),
        });
        const buried = (f) => {
          const b = boxOf(f);
          const u = (b.lo + b.hi) / 2, e = (b.bot + b.top) / 2;
          return painted.modelFills.some(o => {
            if (o.seq <= f.seq) return false;
            const q = boxOf(o);
            return u > q.lo + 1e-6 && u < q.hi - 1e-6
              && e > q.bot + 1e-6 && e < q.top - 1e-6;
          });
        };
        want.forEach(door => {
          const opening = painted.modelFills.find(f => {
            const b = boxOf(f);
            return Math.abs(b.lo - door.lo) < 0.05 && Math.abs(b.hi - door.hi) < 0.05
              && b.top - b.bot > 3 && !buried(f);
          });
          if (!opening) return;                  // not drawn on this elevation
          doorsSeen += 1;
          if (!door.overhead) shallower += 1;
          const over = plates.filter(f => f.lo < door.hi - 0.1 && f.hi > door.lo + 0.1);
          check(`${fixture} ${cut0.id} ${door.id}: no sill plate crosses the door`,
            over.length === 0,
            over.length ? `${over.length} plate strip(s) over u `
              + `${door.lo.toFixed(2)}..${door.hi.toFixed(2)}`
              : `${plates.length} plate strip(s) on this view, none across it`);
        });
      });
    });
    // THE SWEEP ABOVE IS TWO NEGATIVE CLAIMS AND A FILTER, so without these it
    // passes a painter that draws no garage doors at all.
    check('fixture: sill plates are drawn on these elevations at all',
      platesSeen > 0, `${platesSeen} strip(s) one plate thick`);
    check('fixture: and garage doors are drawn, so the rule is not vacuous',
      doorsSeen > 0, `${doorsSeen} garage door opening(s) painted`);
    // AND ONE FURTHER IN than the overhead door, so "the fall" and "8 inches"
    // stay two different claims for the door bottoms checked below.
    check('fixture: and one of them is not the overhead door',
      shallower > 0, `${shallower} of ${doorsSeen} further in`);

    // ── AND NONE OF IT SHOWS THROUGH THE HOUSE ────────────────────────────
    //
    // Movie, 26 Sep, on the BACK elevation: *"the garage door buck is showing
    // on the HOUSE FOUNDATION at the back"*, and his own diagnosis -- *"its
    // like the house is transparent or the door buck lines are going in front
    // of the house"*.
    //
    // The garage's foundation is stored 1 1/2" taller than the house's (8'-1
    // 1/2" against 8'-0"), so a test that asked "does the near face top out at
    // least as high" said no and hid nothing: the garage's top of concrete,
    // and the buck notched out of it, ran twenty feet across the back of a
    // house standing 26 ft in front. A wall does not stop at its concrete --
    // the sill plate on it is opaque -- so cover is measured to the top of the
    // PLATE now.
    //
    // READ AS A LENGTH, which is what makes it one claim rather than two: a
    // corner with nothing in front of it runs the concrete's full depth, and a
    // corner that is cut short is one standing where something covers it,
    // which is a corner that should not be drawn at all.
    // proto/foundation-face-harness.js has the same reading in detail; this is
    // the copy a mutation can kill.
    {
      const shown = buildEnv(win, JSON.parse(fs.readFileSync(
        path.join(ROOT, 'proto', 'repro-movie-garage-2storey.draft'), 'utf8')));
      let corners = 0, cut = [];
      ['E2', 'E3'].forEach(id => {
        const cut0 = standardElevationCuts(shown).find(c => c.id === id);
        if (!cut0) return;
        const view = paintElevation(win, shown, cut0, { pxPerFt: 40 });
        const eF = CV.sectionLevelStack(shown).foundation;
        const top = eF.wallTop - S.GARAGE_BEAM_PLATE_IN / 12;
        const full = top - eF.grade;
        view.strokes.forEach(st => {
          for (let i = 1; i < st.pts.length; i += 1) {
            const a = st.pts[i - 1], b = st.pts[i];
            if (b.move || Math.abs(a.u - b.u) > 0.01) continue;
            const hi = Math.max(a.e, b.e), lo = Math.min(a.e, b.e);
            if (lo < eF.grade - 0.01 || hi > top + 0.3 || hi <= eF.grade + 0.01) continue;
            corners += 1;
            if (hi - lo < full - 0.01) cut.push(`${id} u ${a.u.toFixed(2)} ${(hi - lo).toFixed(3)}ft`);
          }
        });
      });
      check('fixture: the back elevations draw foundation corners at all',
        corners > 0, `${corners} corners`);
      check('no foundation corner is cut short by what stands in front of it',
        cut.length === 0,
        cut.length ? cut.join('  ') : `all ${corners} run the concrete's full depth`);
    }
  }

  // ── AND A DOOR STANDS ON WHAT IS UNDER IT ─────────────────────────────
  //
  // Movie, 26 Sep, once the bucks were drawn: "why is there an extra line in
  // door buck? looks like top of sill plate location ... and we should put
  // the exterior 'mandoor's thresholds at 1/2" (to avoid the bottom line not
  // showing ...) and usually there is one on exterior doors".
  //
  // TWO CLAIMS, ONE PER HALF. A door in a buck reaches DOWN to the slab --
  // the buck is formed so it can, and stopping at the wall's floor left the
  // wall fill's own edge showing across the opening at plate height, which is
  // the line he named. And an exterior door stands half an inch PROUD of what
  // it stands on, so its bottom line clears the line under it; an overhead
  // door takes none, because it seals to the slab.
  {
    const S3 = CV.STANDARDS;
    let doors = 0, thresholds = 0, inBucks = 0, hidden = 0;
    [['repro-garage-house', base],
      ['repro-2storey-garage-beam', buildEnv(win, JSON.parse(fs.readFileSync(
        path.join(ROOT, 'proto', 'repro-2storey-garage-beam.draft'), 'utf8')))],
    ].forEach(([fixture, env]) => {
      const eStack = CV.sectionLevelStack(env);
      const eFdn = eStack.foundation;
      const byId = new Map(env.walls().map(w => [w.id, w]));
      standardElevationCuts(env).forEach(cut2 => {
        const view = paintElevation(win, env, cut2, { pxPerFt: 400 });
        const axis = view.axis;
        env.fenestrations().forEach(f => {
          if ((f.type || f.kind) !== 'door') return;
          const wall = byId.get(f.wallId);
          if (!wall) return;
          const garage = CV.garageOfWall(wall, env, {});
          const level = eStack.floors.find(l => l.id === wall.levelId);
          if (!level) return;
          const len = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
          if (!(len > 1e-6)) return;
          const uA = wall.start.x * axis.x + wall.start.z * axis.z;
          const uB = wall.end.x * axis.x + wall.end.z * axis.z;
          const perFt = (uB - uA) / len;
          const half = Math.abs(perFt) * f.width / 2;
          if (half < 0.25) return;                    // edge on to this view
          const uc = uA + perFt * f.offset;
          // THE OPENING, found by its span: the painter fills a door's recess
          // as a rectangle exactly the door's width.
          const box = view.modelFills.find(fl => fl.pts.length === 4
            && Math.abs(Math.min(...fl.pts.map(q => q.u)) - (uc - half)) < 0.05
            && Math.abs(Math.max(...fl.pts.map(q => q.u)) - (uc + half)) < 0.05
            && Math.max(...fl.pts.map(q => q.e))
              - Math.min(...fl.pts.map(q => q.e)) > 3);
          if (!box) return;                           // hidden on this view
          const drawn = Math.min(...box.pts.map(q => q.e));
          // WHAT IT STANDS ON, from the model. A garage door stands on the
          // slab that filled its buck, which is the top of concrete less the
          // slab's fall there; everything else stands on its own floor.
          let stands = garage ? CV.garageConcreteTop(env, eFdn, garage) : level.floorTop;
          if (garage) {
            const t = f.offset / len;
            const pt = { x: wall.start.x + (wall.end.x - wall.start.x) * t,
              z: wall.start.z + (wall.end.z - wall.start.z) * t };
            stands -= CV.garageDoorOpeningFt(env, garage, pt);
          }
          const sill = f.garage === true ? 0 : S3.DOOR_THRESHOLD_IN / 12;
          // ── UNLESS SOMETHING STANDS IN FRONT OF IT ────────────────────
          //
          // Movie, 26 Sep, circling the back of a 2 STOREY + GARAGE: *"the
          // garage door buck is showing on the HOUSE FOUNDATION at the back"*
          // ... *"its like the house is transparent or the door buck lines are
          // going in front of the house"*.
          //
          // A door in a buck hangs below its own wall, and that strip belongs
          // to the FOUNDATION, which this painter lays down before any wall
          // face. So a far door's dip landed on a near house's concrete that
          // had been painted twenty passes earlier and could not cover it.
          // Clipped to its own floor there now, and this is the half of the
          // claim that says so -- asked of the MODEL, because asking the
          // drawing "is the dip missing here" would let a painter that drew no
          // dips at all agree with itself.
          const dir = view.dir;
          const midDepth = w => ((w.start.x + w.end.x) / 2) * dir.x
            + ((w.start.z + w.end.z) / 2) * dir.z;
          const myDepth = midDepth(wall);
          const infront = env.walls().some(o => (o.view || 'plan') === 'foundation'
            && midDepth(o) > myDepth + 1
            && Math.min(o.start.x * axis.x + o.start.z * axis.z,
              o.end.x * axis.x + o.end.z * axis.z) < uc + half - 0.05
            && Math.max(o.start.x * axis.x + o.start.z * axis.z,
              o.end.x * axis.x + o.end.z * axis.z) > uc - half + 0.05);
          const ownFloor = garage ? CV.garageBearing(env, eFdn, garage) : level.floorTop;
          // ONLY A DOOR THAT DIPS IS AT RISK. A door standing ON its floor, or
          // proud of it on a threshold, is covered by the nearer face painted
          // after it -- the order working as intended. It is what hangs BELOW
          // the wall that has nothing coming later, so that is the only case
          // the clip touches and the only one asked about here.
          const dips = (stands + sill) < ownFloor - 1e-6;
          doors += 1;
          if (infront && dips) {
            hidden += 1;
            check(`${fixture} ${cut2.id} ${f.id}: stops at its own wall, behind what is in front`,
              Math.abs(drawn - ownFloor) < 0.005,
              `bottom ${drawn.toFixed(4)} against its floor ${ownFloor.toFixed(4)}`);
            return;
          }
          if (sill) thresholds += 1;
          if (garage) inBucks += 1;
          check(`${fixture} ${cut2.id} ${f.id}: stands on ${f.garage === true
            ? 'the slab' : 'a half-inch threshold'}`,
            Math.abs(drawn - (stands + sill)) < 0.005,
            `bottom ${drawn.toFixed(4)} against ${(stands + sill).toFixed(4)}`
            + ` -- ${(stands).toFixed(4)} plus ${(sill * 12).toFixed(2)}"`);
          // AND ITS BOTTOM LINE IS CLEAR OF THE LINE UNDER IT, which is the
          // whole point of the threshold: at the floor exactly, the door's
          // own outline lands on the wall's base line and there is nothing to
          // see.
          if (!sill) return;
          check(`${fixture} ${cut2.id} ${f.id}: and its bottom line clears the floor`,
            drawn > stands + 0.02,
            `${((drawn - stands) * 12).toFixed(3)}" of threshold`);
        });
      });
    });
    check('fixture: some door was measured', doors > 0, `${doors} door(s)`);
    check('fixture: and one of them stands in a buck', inBucks > 0,
      `${inBucks} in a garage`);
    // AND ONE OF THEM IS BEHIND SOMETHING, so the branch above is not vacuous:
    // without a door on a face another body stands in front of, "clip every
    // dip" and "clip none" draw the same sheet.
    check('fixture: and one of them has a body in front of it',
      hidden > 0, `${hidden} door(s) behind something`);
    check('fixture: and one of them has a threshold', thresholds > 0,
      `${thresholds} with a sill`);
  }

  // ── A FOOTING IS NOT FLAT ON ONE SIDE ─────────────────────────────────
  //
  // Movie, 25 Sep: "the left footing doesn't stick out 6" x 8" deep", and
  // again on 26 Sep, on a later build: "the dashed footings were sometimes
  // flat on one side".
  //
  // "SOMETIMES" AND "ONE SIDE" ARE THE DIAGNOSIS. The buried outline spends
  // a face's projection only at the RUN's two outer ends. An attached grade
  // beam hangs (no footing, projFt 0, correctly) and laps the house by
  // GARAGE_TIE_FT, so the two merge into one run whose outer end on the
  // garage side is the BEAM's -- and the house's own footing end, now
  // interior to that run, got nothing. Measured on this fixture before the
  // fix: E1 had the shoulder at u -8.50..-8.00 and nothing at 8.00..8.50;
  // E3 had it at 8.00..8.50 and nothing at -8.50..-8.00. One side, and
  // whichever side the garage is on.
  //
  // THE OUTERMOST ENDS ARE THE CLAIM, not every end. A footing that runs
  // into another wall's concrete does not stop there and has no shoulder to
  // draw -- the interior ends at u +/-4 on this fixture's E2 and E4 are
  // exactly that, and drawing a step there would be the opposite defect.
  // The outermost two ends of the bearing concrete are free by definition,
  // so they are where "both sides" can be asserted without re-deriving the
  // painter's carry-through test here.
  {
    const proj = Math.max(0, fdn.footingWidthIn - 8) / 2 / 12;
    let reached = 0;
    standardElevationCuts(base).forEach(cut => {
      const painted = paintElevation(win, base, cut, { pxPerFt: 40 });
      const axis = painted.axis;
      const uOf = pt => pt.x * axis.x + pt.z * axis.z;
      const faces = base.walls()
        .filter(w => (w.view || 'plan') === 'foundation' && w.baseHeight <= 0.01)
        .map(w => ({ lo: Math.min(uOf(w.start), uOf(w.end)), hi: Math.max(uOf(w.start), uOf(w.end)) }))
        .filter(f => f.hi - f.lo >= 0.5);
      if (!faces.length || proj < 0.01) return;
      const lo = Math.min(...faces.map(f => f.lo));
      const hi = Math.max(...faces.map(f => f.hi));
      // The footing's TOP is the bearing wall's base, which is the foundation
      // datum itself -- the shoulder is the 6" of it that sticks out past the
      // wall face before the 8" drop to the footing's underside.
      const flat = [];
      painted.strokes.forEach(s => {
        for (let k = 1; k < s.pts.length; k += 1) {
          const a = s.pts[k - 1], b = s.pts[k];
          if (b.move || b.close) continue;
          if (Math.abs(a.e - b.e) > 0.01 || Math.abs(a.e - fdn.wallBottom) > 0.05) continue;
          flat.push({ lo: Math.min(a.u, b.u), hi: Math.max(a.u, b.u) });
        }
      });
      const spans = (x, y) => flat.some(s => s.lo <= x + 0.03 && s.hi >= y - 0.03);
      reached += 1;
      const left = spans(lo - proj, lo), right = spans(hi, hi + proj);
      check(`${cut.id}: the footing steps out ${(proj * 12).toFixed(0)}" at BOTH ends of the concrete`,
        left && right,
        `left ${left ? 'yes' : 'NO'} at ${(lo - proj).toFixed(2)}..${lo.toFixed(2)}, `
        + `right ${right ? 'yes' : 'NO'} at ${hi.toFixed(2)}..${(hi + proj).toFixed(2)}`
        + ` -- drawn ${flat.map(s => `${s.lo.toFixed(2)}..${s.hi.toFixed(2)}`).join(', ') || 'nothing'}`);
    });
    check('fixture: some elevation shows bearing concrete with a footing under it',
      reached > 0, `${reached} elevation(s) probed`);

    // ── AND ITS SIDE DOES NOT RISE ABOVE THE FOOTING ──────────────────
    //
    // Movie, 26 Sep, marking it in green on E4 and again on E2: "the footing
    // line looks like the 8" side of footing extends all the way up but
    // should stop after 8"".
    //
    // The buried outline's riser at a stop climbed to the NEXT BOTTOM,
    // whatever stood between. Where a house footing gives way to a garage's
    // hung beam that is six feet of line up the side of an eight-inch
    // footing, through ground holding nothing. Measured on this fixture, E1,
    // with the cap off and on:
    //
    //     u 8.50   e -9.952..-3.827   6.13 ft
    //     u 8.50   e -9.952..-9.302   0.65 ft
    //
    // ASKED AS A CEILING, NOT A LENGTH. "No taller than 8 inches" would be
    // false the moment two footings at different depths meet -- the step
    // between them is a real riser off the deeper one's underside and it is
    // as tall as the difference. What is never true is a footing's side
    // reaching ABOVE the footing: fdn.wallBottom is the top of the pour and
    // the underside of nothing, so ink from the excavation floor has no
    // business crossing it.
    let sides = 0;
    standardElevationCuts(base).forEach(cut => {
      const painted = paintElevation(win, base, cut, { pxPerFt: 40 });
      const tall = [];
      painted.strokes.forEach(st => {
        for (let k = 1; k < st.pts.length; k += 1) {
          const a = st.pts[k - 1], b = st.pts[k];
          if (b.move || b.close) continue;
          if (Math.abs(a.u - b.u) > 0.01) continue;
          const lo = Math.min(a.e, b.e), hi = Math.max(a.e, b.e);
          // FROM THE EXCAVATION FLOOR, which is what makes it a footing's
          // side. A pile shaft runs on past it to the sheet's own bottom and
          // is not this claim's business.
          if (Math.abs(lo - fdn.footingBottom) > 0.05) continue;
          if (hi - lo < 0.01) continue;
          sides += 1;
          if (hi > fdn.wallBottom + 0.05) {
            tall.push(`u ${a.u.toFixed(2)} rises to ${ftIn(hi)}`);
          }
        }
      });
      check(`${cut.id}: no footing side rises above the top of the footing at ${ftIn(fdn.wallBottom)}`,
        tall.length === 0, tall.join(', '));
    });
    check('fixture: some elevation draws a footing side at all',
      sides > 0, `${sides} side(s) off the excavation floor`);

    // ── AND THE WALL ABOVE THAT SHOULDER IS DRAWN TOO ─────────────────
    //
    // Movie, 26 Sep, marking it in green on E1: "the footing is correct, but
    // the line of the ext of foundation wall going up to grade level is
    // missing".
    //
    // IT WAS NEVER DRAWN; THE RISER WAS STANDING IN FOR IT. Before the cap
    // above, the silhouette climbed the whole step at the FOOTING's outer
    // edge and read as the foundation's edge going up. Capping it to the
    // footing's own 8" was right and left the wall's real face, a foot
    // further in, bare:
    //
    //     u -16.00   -9.173..-2.323   the run's own left end, drawn
    //     u  16.00   NOTHING          interior to the merged run
    //
    // WHERE THE CONCRETE CARRIES THROUGH THERE IS NO FACE, which is the same
    // partition the shoulder uses and is not a gap: on this fixture the
    // house's foundation is three runs meeting at u +/-4, and two walls
    // meeting have no exposed end between them. The claim is about the ends
    // that ARE exposed.
    let faces = 0;
    standardElevationCuts(base).forEach(cut => {
      const painted = paintElevation(win, base, cut, { pxPerFt: 40 });
      const axis = painted.axis;
      const uOf = pt => pt.x * axis.x + pt.z * axis.z;
      const walls = base.walls()
        .filter(w => (w.view || 'plan') === 'foundation' && w.baseHeight <= 0.01)
        .map(w => ({ lo: Math.min(uOf(w.start), uOf(w.end)), hi: Math.max(uOf(w.start), uOf(w.end)) }))
        .filter(g => g.hi - g.lo >= 0.5);
      const bare = [];
      walls.forEach(g => [g.lo, g.hi].forEach(u => {
        // EXPOSED means no other bearing wall carries the concrete through
        // this station -- a wall meeting a wall has no end to draw.
        if (walls.some(o => o !== g && u > o.lo + 0.05 && u < o.hi - 0.05)) return;
        if (u <= painted.uMin + 0.1 || u >= painted.uMax - 0.1) return;
        faces += 1;
        const drawn = painted.strokes.some(st => {
          for (let k = 1; k < st.pts.length; k += 1) {
            const a = st.pts[k - 1], b = st.pts[k];
            if (b.move || b.close) continue;
            if (Math.abs(a.u - b.u) > 0.01 || Math.abs(a.u - u) > 0.06) continue;
            const lo = Math.min(a.e, b.e), hi = Math.max(a.e, b.e);
            if (lo < fdn.wallBottom - 0.1 || hi > fdn.grade + 0.1) continue;
            if (hi - lo > 0.5) return true;
          }
          return false;
        });
        if (!drawn) bare.push(`u ${u.toFixed(2)}`);
      }));
      check(`${cut.id}: every exposed foundation wall end draws its face to grade`,
        bare.length === 0, bare.join(', '));
    });
    check('fixture: some elevation has an exposed foundation wall end',
      faces > 0, `${faces} end(s) probed`);
  }

  // ── ONE RULE, NOT FIVE COPIES ─────────────────────────────────────────
  // The whole defect was five sites each holding their own version. These
  // read the SOURCES, because "the rule is shared" is a fact about the text
  // and no amount of arithmetic here can observe it.
  const modelSrc = fs.readFileSync(path.join(ROOT, 'MODEL.html'), 'utf8');
  check('MODEL.html ASKS for the drop rather than holding a copy',
    modelSrc.includes('DraftCutView.garageSillDropFt('),
    modelSrc.includes('GARAGE_SILL_BELOW_HOUSE_FT') ? 'still holds its own constant' : 'asks');
  check('MODEL.html sets the garage concrete a PLATE below the house sill',
    /houseTop - drop - S\.GARAGE_BEAM_PLATE_IN \/ 12/.test(modelSrc), 'attachedTop');
  const pageSrc = fs.readFileSync(path.join(ROOT, 'project-page.js'), 'utf8');
  check("PROJECT's drop constant still agrees with this file's",
    new RegExp(`GARAGE_SILL_BELOW_HOUSE_FT = ${S.GARAGE_SILL_BELOW_HOUSE_FT};`).test(pageSrc),
    `cut-view says ${S.GARAGE_SILL_BELOW_HOUSE_FT}`);
  const projectSrc = fs.readFileSync(path.join(ROOT, 'PROJECT.html'), 'utf8');
  check('PROJECT.html still exempts the grade beam from the drop, as this file does',
    /garageFoundation\(\) === 'gradebeam'\s*\?\s*houseSillFt\(\)/.test(projectSrc),
    'derivedAttachedOffsetFt');

  // ── THE CLADDING REACHES THE SILL, AND NOTHING PAINTS BACK OVER IT ────
  //
  // Movie, 28 Sep: *"the exterior finish doesn't go down to the SILL"*, and
  // then, marking the strip under his front door in orange, *"the stone
  // should continue under the door"* -- with the number to go with it, *"on
  // typical house (this one) the band should be -1'-2 1/8" below the 0-0 main
  // floor level"*. That is this harness's own subject read from outside the
  // house: joists 11 7/8" + sheathing 3/4" + sill plate 1 1/2" = 1'-2 1/8".
  //
  // TWO DEFECTS, STACKED, AND BOTH SHIPPED WITH NOTHING WATCHING THEM:
  //
  //   1. paintFaceFinish's `ctx.clip()` took the CURRENT PATH -- which is
  //      paintFace's own polygon, whose bottom is the STOREY line at 0. The
  //      base box was drawn from `lines.sill` and always had been, so the
  //      painter was right and the clip threw 1'-2 1/8" of it away. Two
  //      mechanisms, one claim, and the second won silently.
  //
  //   2. The rim band was filled AFTER every face, putting C.face back over
  //      the bottom 1'-0 5/8" of its own wall's cladding -- everything the
  //      clip fix had just let through, bar the 1 1/2" plate strip.
  //
  // WHY HERE AND NOT IN elevation-harness.js. That file's cladding checks
  // read the BOX handed to drawFinish, and the box was never wrong; they
  // stayed green through the whole of defect 1 and were what let me tell him
  // twice that the paint was correct. What was wrong was the CLIP and the
  // ORDER, and neither is visible in a box. This is also the one engine that
  // mutates cut-view.js, so a check written here can be broken on purpose.
  //
  // THE MARKER IS HOW BOTH ARE READ. A recorded stroke carries the clip that
  // was in force when it was laid down and the seq it was laid down at, so
  // the hook draws one hairline in an ink the painter never uses immediately
  // before each drawFinish. That marker's clip IS that call's clip, and its
  // seq IS that call's place in the paint order -- which is the only language
  // occlusion is written in on an elevation.
  {
    const MARK = '#ff00ff';
    const clad = JSON.parse(JSON.stringify(SAVED));
    const mainId = Number(buildEnv(win, clad).floorLevels()[0].id);
    const houseOnMain = w => Number(w.levelId) === mainId && !w.body;
    clad.walls.filter(houseOnMain).forEach(w => { w.finish = 'ledgestone'; });
    const cladEnv = buildEnv(win, clad);
    const main = win.DraftCutView.sectionLevelStack(cladEnv).floors[0];
    const sillFt = main.floorBottom - win.DraftLevelAssembly.SILL_PLATE_IN / 12;

    const FP = win.DraftFinishPatterns;
    const realDraw = FP.drawFinish;
    win.DraftFinishPatterns = { ...FP,
      drawFinish: (ctx, box, finish, inks) => {
        const ink = ctx.strokeStyle, lw = ctx.lineWidth;
        ctx.strokeStyle = MARK; ctx.lineWidth = 0.01;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1, 0); ctx.stroke();
        ctx.strokeStyle = ink; ctx.lineWidth = lw;
        return realDraw(ctx, box, finish, inks);
      } };
    const view = paintElevation(win, cladEnv,
      standardElevationCuts(cladEnv).find(c => c.id === 'E1'),
      { pxPerFt: 40, finishes: true });
    win.DraftFinishPatterns = FP;

    // THE FIXTURE'S OWN REACH, ASSERTED BEFORE ANYTHING IS READ OFF IT. With
    // no clad wall on the main floor every claim below is made about an empty
    // list, and an empty list agrees with anything.
    check('cladding fixture: the house has main-floor walls to clad',
      clad.walls.filter(houseOnMain).length > 0,
      `${clad.walls.filter(houseOnMain).length} on level ${mainId}`);
    const marks = view.strokes.filter(st => st.ink === MARK);
    check('cladding fixture: E1 painted a finish, and every call left a marker',
      marks.length > 0 && marks.every(m => m.clip && m.clip.length > 2),
      `${marks.length} drawFinish call(s), `
      + `${marks.filter(m => m.clip && m.clip.length > 2).length} clipped`);

    if (marks.length && marks.every(m => m.clip && m.clip.length > 2)) {
      const clipLow = m => Math.min(...m.clip.map(pt => pt.e));
      const lowest = marks.map(clipLow).sort((a, b) => a - b)[0];
      // THE LOWEST CLIP OF THE WHOLE PAINT is the main floor's by
      // construction -- it is the bottom storey -- so this names the sill
      // without having to say which face carried it.
      check('the cladding is CLIPPED to the SILL, not to the storey line',
        near(lowest, sillFt, 0.01),
        `lowest clip bottom ${ftIn(lowest)}; sill ${ftIn(sillFt)}; `
        + `storey line ${ftIn(main.floorTop)}`);

      // THE RIM BAND IS FOUND BY ITS OWN EXTENT -- a rect standing on the
      // main floor's package, floorBottom to floorTop.
      //
      // TO A PIXEL AND A HALF, NOT TO THE DECIMAL, and that is not slack. The
      // fill bleeds 1px each way on purpose to close a hairline, and `Y` snaps
      // to the half-pixel grid (`Math.round(v - 0.5) + 0.5`), so the drawn
      // height is the arithmetic one give or take a pixel. Asserting the exact
      // number found NO band here and let the order check below pass over an
      // empty list -- a check agreeing with nothing, which is the same fault
      // this whole block exists for.
      const px = 1 / view.pxPerFt;
      const bandsOn = L => view.modelFills.filter(f => {
        if (f.pts.length !== 4) return false;
        const es = f.pts.map(pt => pt.e);
        return near(Math.min(...es), L.floorBottom, 2.5 * px)
          && near(Math.max(...es), L.floorTop, 2.5 * px);
      });
      const bandFills = bandsOn(main);
      check('cladding fixture: the main floor wears a rim band on E1',
        bandFills.length > 0, `${bandFills.length} band fill(s)`);

      // ONLY THE CLADDING THAT ACTUALLY ENTERS THE BAND is asked about: a
      // storey above clads down to its own floor package and never reaches
      // this one, so its order against this band says nothing.
      const reaches = marks.filter(m => clipLow(m) < main.floorTop - 0.01);
      check('cladding fixture: some cladding on E1 reaches into the rim band',
        reaches.length > 0, `${reaches.length} of ${marks.length}`);
      const late = [];
      bandFills.forEach(band => {
        const bu = band.pts.map(pt => pt.u);
        reaches.forEach(m => {
          const mu = m.clip.map(pt => pt.u);
          if (Math.max(...bu) <= Math.min(...mu) + 0.05) return;
          if (Math.min(...bu) >= Math.max(...mu) - 0.05) return;
          if (band.seq > m.seq) {
            late.push(`band seq ${band.seq} u ${Math.min(...bu).toFixed(2)}..`
              + `${Math.max(...bu).toFixed(2)} over cladding seq ${m.seq}`);
          }
        });
      });
      check('and the rim band goes down BEFORE that cladding, not over it',
        late.length === 0, late.join('; '));

      // ── AND NO FLOOR LINE RUNS ACROSS THE HOUSE ─────────────────────
      //
      // Movie, 28 Sep, shown the before and after side by side: *"we don't
      // want to show those horizontal lines on the house, only off to the
      // side of the house (for the user to visualize where the floors are
      // located"*, and *"on the side of the house is sufficient"*.
      //
      // THIS COULD NOT BE ASKED UNTIL THE BAND MOVED. paintFace closed its
      // outline along the face's foot and the band's fill, painted last,
      // covered the whole 2px of it -- so the sheet was already what he
      // wants and the CODE was not, and nothing could tell the two apart.
      // The sub-path is gone now; this is what keeps it gone.
      //
      // THE FAINT DATUMS ARE NOT IT. They run the full width of the sheet at
      // 25% and are painted before everything, which is exactly the "off to
      // the side" he is keeping -- so the probe ignores anything `rgba`.
      // ASKED INSIDE A PAINTED BAND PART, WHICH IS WHOSE LINE IT IS. A band
      // part is by construction a stretch with nothing nearer standing in
      // front of it, so a horizontal there belongs to the house. Asked over
      // the whole sheet instead, this found the attached GARAGE's own wall
      // head at the same elevation on E1 -- a line that is real and has to
      // stay -- and called it the house's.
      // MEASURED AS COVERAGE, NOT AS ONE LONG SEGMENT, which is this probe
      // being wrong once and the mutation table saying so. A face's top
      // profile follows the roof underside and is SAMPLED: sixteen feet of
      // wall head comes back as seventy segments of a few inches each, so
      // "is there a horizontal spanning this band" asked of any single
      // segment is always no. The bands-before-every-wall mutation drew the
      // storey below's head line straight across and this reported nothing.
      //
      // AND ONLY INK THE BAND DID NOT COVER, which is the same probe being
      // wrong twice. "Is there a horizontal here" is not the question on an
      // elevation; "is one still showing" is. The wall head under a band IS
      // drawn -- a face's top profile is its outline -- and what settles it
      // is that the band goes down after it. Asked without `afterSeq` this
      // reported both edges lined on a correct sheet.
      const acrossAt = (e, lo, hi, afterSeq) => {
        const runs = [];
        view.strokes.forEach(st => {
          if (/^rgba/.test(st.ink) || st.seq < afterSeq) return;
          for (let k = 1; k < st.pts.length; k += 1) {
            const a = st.pts[k - 1], b = st.pts[k];
            if (b.move || b.close) continue;
            if (Math.abs(a.e - b.e) > 0.01 || Math.abs(a.e - e) > 0.04) continue;
            const l = Math.max(Math.min(a.u, b.u), lo), h = Math.min(Math.max(a.u, b.u), hi);
            if (h > l) runs.push({ lo: l, hi: h });
          }
        });
        // THE LONGEST CONTIGUOUS RUN, NOT THE TOTAL, and that is the probe
        // being wrong a third time. A LINE is continuous ink; a STONE HATCH
        // is not. On the clad fixture the ledgestone pattern lays down 11 ft
        // of horizontal within 1/2" of the floor level -- scattered across
        // the facade in stone-sized pieces -- and a total-coverage test read
        // that as a storey line. The wall head's seventy sampled segments
        // are end to end, so they merge into one run and this still sees it.
        runs.sort((a, b) => a.lo - b.lo);
        let best = 0, from = null, at = null;
        runs.forEach(r => {
          if (from == null || r.lo > at + 0.02) { from = r.lo; at = r.hi; }
          else at = Math.max(at, r.hi);
          if (at - from > best) best = at - from;
        });
        return best >= (hi - lo) / 2;
      };
      // BOTH EDGES OF EVERY BAND, not just the top. floorTop is the storey
      // line the face used to close its outline along; floorBottom is the
      // head of the wall BELOW, and the band covers that one by going down
      // after it. A band painted wholly before the walls shows the second
      // while hiding the first, which is the other way to get this wrong.
      const lined = [];
      win.DraftCutView.sectionLevelStack(cladEnv).floors.forEach(L => {
        bandsOn(L).forEach(f => {
          const us = f.pts.map(pt => pt.u);
          const lo = Math.min(...us), hi = Math.max(...us);
          const where = `u ${lo.toFixed(2)}..${hi.toFixed(2)}`;
          if (acrossAt(L.floorTop, lo, hi, f.seq)) lined.push(`level ${L.id} floor ${ftIn(L.floorTop)} ${where}`);
          if (acrossAt(L.floorBottom, lo, hi, f.seq)) lined.push(`level ${L.id} head ${ftIn(L.floorBottom)} ${where}`);
        });
      });
      check('and no floor line is drawn across the house face, at either edge '
        + 'of the band', lined.length === 0, lined.join(', '));
    }
  }

  // ── AND A BAND'S STONE STAYS INSIDE THE BAND ─────────────────────────
  //
  // Movie, 29 Sep, on his own saved drawing: the fieldstone band ran past
  // its top. Measured on that file (20260929T0557.draft, its 0-3' band set
  // to fieldstone) and on repro-garage-house before the fix: stone showed
  // 1'-3 3/4" ABOVE a 3'-0" band on every elevation, E1 to E4. Ashlar,
  // brick, shake, ledgestone and roundstone on the same band: 0".
  //
  // THE PATTERN IS RIGHT TO OVERHANG. finish-patterns' fieldstone lattice
  // starts a cell outside its box and runs a cell past it, so no stone at
  // the edge is sliced into a ruled line -- and it says, in so many words,
  // that the caller's clip is what cuts it. The base finish had that clip;
  // a band inherited the FACE's, which reaches the wall head.
  //
  // SO THE CLAIM IS THE CLIP, READ THE WAY THE CLADDING BLOCK ABOVE READS
  // IT: a marker before and after each drawFinish. The marker's clip is that
  // call's clip, and the strokes between the two are that call's pattern.
  // The band's own FACE FILL is the ruler -- the last fill before the call is
  // the rectangle the band painted, so no number here has to agree with a
  // number in the painter.
  {
    const OPEN = '#ff00ff', SHUT = '#00ffff';
    const stone = JSON.parse(JSON.stringify(SAVED));
    const mainId = Number(buildEnv(win, stone).floorLevels()[0].id);
    const houseOnMain = w => Number(w.levelId) === mainId && !w.body;
    stone.walls.filter(houseOnMain).forEach(w => {
      w.finishBands = [{ finishId: 'fieldstone', anchor: 'sill', lowFt: 0, highFt: 3 }];
    });
    const stoneEnv = buildEnv(win, stone);

    const FP = win.DraftFinishPatterns;
    const realDraw = FP.drawFinish;
    const mark = (ctx, ink) => {
      const was = ctx.strokeStyle, lw = ctx.lineWidth;
      ctx.strokeStyle = ink; ctx.lineWidth = 0.01;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1, 0); ctx.stroke();
      ctx.strokeStyle = was; ctx.lineWidth = lw;
    };
    const calls = [];
    standardElevationCuts(stoneEnv).forEach(cut => {
      const ids = [];
      win.DraftFinishPatterns = { ...FP,
        drawFinish: (ctx, box, finish, inks) => {
          ids.push(finish && finish.id);
          mark(ctx, OPEN);
          const out = realDraw(ctx, box, finish, inks);
          mark(ctx, SHUT);
          return out;
        } };
      const view = paintElevation(win, stoneEnv, cut, { pxPerFt: 40, finishes: true });
      win.DraftFinishPatterns = FP;
      const opens = view.strokes.filter(st => st.ink === OPEN);
      const shuts = view.strokes.filter(st => st.ink === SHUT);
      opens.forEach((o, k) => {
        if (ids[k] !== 'fieldstone' || !shuts[k]) return;
        const fill = view.modelFills.filter(f => f.seq < o.seq).pop();
        const pattern = view.strokes.filter(st => st.seq > o.seq && st.seq < shuts[k].seq);
        calls.push({ cut: cut.id, px: 1 / view.pxPerFt, fill, clip: o.clip, pattern });
      });
    });

    const boundsOf = pts => ({
      uLo: Math.min(...pts.map(p => p.u)), uHi: Math.max(...pts.map(p => p.u)),
      eLo: Math.min(...pts.map(p => p.e)), eHi: Math.max(...pts.map(p => p.e)),
    });
    // THE FIXTURE'S REACH, ASSERTED FIRST, and the second one is the one
    // that matters: if fieldstone ever stopped overhanging its box, every
    // clip would pass this block without having been asked anything.
    check('band fixture: fieldstone bands painted on the house elevations',
      calls.length > 0, `${calls.length} fieldstone call(s)`);
    const overhang = calls.filter(c => c.fill && c.pattern.length
      && boundsOf(c.pattern.flatMap(st => st.pts)).eHi > boundsOf(c.fill.pts).eHi + 2 * c.px);
    check('band fixture: the stone pattern overhangs its band, so the clip is what cuts it',
      calls.length > 0 && overhang.length === calls.length,
      `${overhang.length} of ${calls.length} reach past the band top`);

    const loose = [];
    calls.forEach(c => {
      if (!c.fill || !c.clip || c.clip.length < 3) {
        loose.push(`${c.cut}: no clip`);
        return;
      }
      const band = boundsOf(c.fill.pts);
      const clip = boundsOf(c.clip);
      const ink = boundsOf(c.pattern.flatMap(st => st.pts));
      const shown = Math.min(clip.eHi, ink.eHi);
      const off = ['uLo', 'uHi', 'eLo', 'eHi'].filter(k => !near(clip[k], band[k], 1.5 * c.px));
      if (off.length) {
        loose.push(`${c.cut}: stone shows ${((shown - band.eHi) * 12).toFixed(2)}" above a band `
          + `topping at ${ftIn(band.eHi)} (clip ${off.join('/')} off)`);
      }
    });
    check('a band\'s pattern is CLIPPED to the band it painted, not to the whole face',
      calls.length > 0 && loose.length === 0, loose.join('; '));
  }

  // ── AND AN EXTERIOR DOOR KEEPS SIX INCHES OF ITS WALL BARE ────────────
  //
  // Movie, 28 Sep, straight after the stone reached the sill: *"we should put
  // a 6" 'threshold' just blank spot where they can install pfm drip edge
  // under the door to the edge of the DECK - which i will be adding to in
  // front of the higher up exterior doors"*, then *"I will be adding DECK and
  // COVERED deck later"*. Asked which doors, he said *"House exterior doors
  // only"*; asked how it ends, *"Down from the door, with a line"*.
  //
  // ON THE FIXTURE THAT HAS ONE. repro-garage-house's four doors are all on
  // garage walls, so the block above cannot see this at all -- it would have
  // reported a clean sheet for a feature that never drew. This fixture has a
  // house door on the main floor and a garage door and man door beside it,
  // which is the whole claim in one drawing: one gets the strip, the others
  // do not.
  //
  // EACH DOOR IS FOUND BY ITS OWN PAINTED BOX rather than by re-deriving
  // where its bottom is. A garage door in a buck stands on the slab and a
  // house door on a half-inch threshold; both are already worked out by the
  // painter, and the recess fill is that answer drawn. So the probe reads the
  // box and asks what is 6" under it, which is the same question for both.
  {
    const MARK = '#ff00ff';
    const bareFt = 6 / 12;
    const tSaved = JSON.parse(fs.readFileSync(path.join(ROOT, 'proto',
      'repro-2storey-garage-beam.draft'), 'utf8'));
    const tMainId = Number(buildEnv(win, tSaved).floorLevels()[0].id);
    const tClad = JSON.parse(JSON.stringify(tSaved));
    tClad.walls.forEach(w => {
      if (w.body || Number(w.levelId) !== tMainId) return;
      w.finish = 'ledgestone';
    });
    const tEnv = buildEnv(win, tClad);
    const wallsById = new Map(tEnv.walls().map(w => [w.id, w]));
    const doors = tEnv.fenestrations().filter(f => f.type === 'door');
    const houseDoors = doors.filter(f => {
      const w = wallsById.get(f.wallId);
      return w && !w.body;
    });
    check('threshold fixture: it has a house exterior door AND garage doors',
      houseDoors.length > 0 && doors.length > houseDoors.length,
      `${houseDoors.length} house of ${doors.length} doors`);

    const seen = [];
    standardElevationCuts(tEnv).forEach(cut => {
      // THE SAME MARKER AS THE BLOCK ABOVE, and one paint rather than two:
      // the strip's place in the order is read off the very sheet its
      // geometry is read off, so the two can never be about different paints.
      const FP2 = win.DraftFinishPatterns;
      const realDraw2 = FP2.drawFinish;
      win.DraftFinishPatterns = { ...FP2,
        drawFinish: (ctx, box, finish, inks) => {
          const ink = ctx.strokeStyle, lw = ctx.lineWidth;
          ctx.strokeStyle = MARK; ctx.lineWidth = 0.01;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1, 0); ctx.stroke();
          ctx.strokeStyle = ink; ctx.lineWidth = lw;
          return realDraw2(ctx, box, finish, inks);
        } };
      const view = paintElevation(win, tEnv, cut, { pxPerFt: 40, finishes: true });
      win.DraftFinishPatterns = FP2;
      const axis = view.axis;
      const uOf = pt => pt.x * axis.x + pt.z * axis.z;
      doors.forEach(f => {
        const w = wallsById.get(f.wallId);
        if (!w) return;
        const uA = uOf(w.start), uB = uOf(w.end);
        const len = Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z);
        if (len < 1e-6) return;
        const uc = uA + ((uB - uA) / len) * f.offset;
        const half = Math.abs((uB - uA) / len) * f.width / 2;
        const lo = uc - half, hi = uc + half;
        // SEEN EDGE ON, a door is a line and has no box; skip it rather than
        // assert about a strip nobody could see.
        if (hi - lo < 0.5) return;
        if (lo < view.uMin + 0.05 || hi > view.uMax - 0.05) return;
        // ITS OWN PAINTED BOX: the tallest 4-point fill standing on this u
        // range. A door's recess is the only thing that shape at that width.
        const box = view.modelFills.filter(fill => fill.pts.length === 4
          && near(Math.min(...fill.pts.map(pt => pt.u)), lo, 0.12)
          && near(Math.max(...fill.pts.map(pt => pt.u)), hi, 0.12))
          .sort((a, b) => (Math.max(...b.pts.map(pt => pt.e)) - Math.min(...b.pts.map(pt => pt.e)))
            - (Math.max(...a.pts.map(pt => pt.e)) - Math.min(...a.pts.map(pt => pt.e))))[0];
        if (!box) return;
        const foot = Math.min(...box.pts.map(pt => pt.e));
        const lineAt = e => view.strokes.some(st => {
          for (let k = 1; k < st.pts.length; k += 1) {
            const a = st.pts[k - 1], b = st.pts[k];
            if (b.move || b.close) continue;
            if (Math.abs(a.e - b.e) > 0.01 || Math.abs(a.e - e) > 0.03) continue;
            if (Math.abs(a.u - b.u) < (hi - lo) * 0.8) continue;
            if (Math.min(a.u, b.u) < lo - 0.12 || Math.max(a.u, b.u) > hi + 0.12) continue;
            return true;
          }
          return false;
        });
        const bare = view.modelFills.find(fill => fill.pts.length === 4
          && fill.ink === '#fff'
          && near(Math.min(...fill.pts.map(pt => pt.u)), lo, 0.12)
          && near(Math.max(...fill.pts.map(pt => pt.u)), hi, 0.12)
          && near(Math.max(...fill.pts.map(pt => pt.e)), foot, 0.03)
          && near(Math.min(...fill.pts.map(pt => pt.e)), foot - bareFt, 0.03));
        // ── THE CLADDING THAT COVERS THIS DOOR'S OWN WALL ───────────────
        //
        // NOT THE LAST ONE ON THE SHEET, which is this check being wrong
        // first time out and saying so: a door on a FAR face is painted
        // before a nearer face's cladding as a matter of course, and asked
        // against the sheet's last drawFinish both house doors here came back
        // "under the cladding" on a drawing where they are not. A marker
        // carries the clip that was in force, so the ones that could cover
        // this strip are the ones whose clip contains it.
        const mid = foot - bareFt / 2;
        //
        // AND ONLY ITS OWN FACE'S, which `st.seq < box.seq` is: paintFace
        // clads the wall and THEN draws the openings in it, so a marker
        // before this door's box is this door's wall being clad. Without
        // that, E3 -- where this door is round the back and a nearer wall's
        // stone is painted straight over it -- reported the strip "under the
        // cladding", which it is, and which is the drawing being right.
        const covering = view.strokes.filter(st => st.ink === MARK && st.clip
          && st.seq < box.seq
          && Math.min(...st.clip.map(pt => pt.u)) < uc
          && Math.max(...st.clip.map(pt => pt.u)) > uc
          && Math.min(...st.clip.map(pt => pt.e)) < mid
          && Math.max(...st.clip.map(pt => pt.e)) > mid)
          .reduce((m, st) => Math.max(m, st.seq), -1);
        // ── IS THIS DOOR EVEN ON THE SHEET ─────────────────────────────
        //
        // On E3 this house door is round the back and a nearer wall's stone
        // is painted flat over it, box and all. Its strip is under cladding
        // there and that is the drawing being RIGHT, so the claim below is
        // only made where the door can be seen. Asked without this, the
        // check called the back of the house a defect.
        //
        // ASKED AS "IS THE STRIP THE LAST THING PAINTED THERE", which is the
        // only form that works. One nearer FILL containing the whole strip
        // was the first try and it missed: on E3 what covers this door is a
        // nearer wall's rim band AND its face, two fills meeting on the
        // storey line, and neither contains the strip by itself.
        const midU = uc, midE = foot - bareFt / 2;
        const over0 = view.modelFills.filter(fill =>
          Math.min(...fill.pts.map(pt => pt.u)) <= midU
          && Math.max(...fill.pts.map(pt => pt.u)) >= midU
          && Math.min(...fill.pts.map(pt => pt.e)) <= midE
          && Math.max(...fill.pts.map(pt => pt.e)) >= midE)
          .reduce((m, fill) => Math.max(m, fill.seq), -1);
        const covered = !bare || bare.seq !== over0;
        // ── AND IS ANY INK LAID INSIDE THE STRIP AFTER IT ───────────────
        //
        // THE DIRECT QUESTION, replacing a seq comparison that could not ask
        // it. "The strip's fill is later than the cladding's marker" needed
        // to know which drawFinish was this door's own FACE, and every proxy
        // for that was wrong somewhere: before the box missed a pass added
        // after it, and the sheet's last marker condemned every far wall.
        // Whether a blank spot is blank is not a question about order at
        // all -- it is whether anything is drawn in it.
        //
        // THE CLOSING LINE IS NOT INK IN IT: it sits ON the bottom edge, and
        // the probe asks about segment midpoints strictly inside.
        const bareBot = foot - bareFt;
        const inStrip = st => {
          for (let k = 1; k < st.pts.length; k += 1) {
            const a = st.pts[k - 1], b = st.pts[k];
            if (b.move || b.close) continue;
            const mu = (a.u + b.u) / 2, me = (a.e + b.e) / 2;
            if (me < bareBot + 0.02 || me > foot - 0.02) continue;
            if (mu < lo + 0.02 || mu > hi - 0.02) continue;
            return true;
          }
          return false;
        };
        seen.push({ cut: cut.id, id: f.id, house: !wallsById.get(f.wallId).body,
          foot, line: lineAt(bareBot), bare: !!bare, covered, covering,
          over: bare ? view.strokes.filter(st => st.seq > bare.seq && inStrip(st)).length : 0 });
      });
    });

    check('threshold fixture: both a house door and a garage door were painted '
      + 'with a box to measure', seen.some(d => d.house) && seen.some(d => !d.house),
      seen.map(d => `${d.cut}/${d.id}${d.house ? '' : ' (garage)'}`).join(', ') || 'none');

    const houseSeen = seen.filter(d => d.house);
    const missingBare = houseSeen.filter(d => !d.bare)
      .map(d => `${d.cut}/${d.id} foot ${ftIn(d.foot)}`);
    check('an exterior HOUSE door keeps 6" of bare wall under it',
      missingBare.length === 0 && houseSeen.length > 0,
      missingBare.length ? missingBare.join(', ') : `${houseSeen.length} door view(s)`);
    const missingLine = houseSeen.filter(d => !d.line)
      .map(d => `${d.cut}/${d.id} probed ${ftIn(d.foot - bareFt)}`);
    check('and it is closed by a line, not left open', missingLine.length === 0,
      missingLine.join(', '));
    // ── AND IT IS LAID OVER THE CLADDING, NOT UNDER IT ─────────────────
    //
    // A blank spot that the stone is painted on top of is not a blank spot.
    // Read as a seq, the same way the rim band is above: the strip has to go
    // down after every drawFinish on the sheet it belongs to.
    const clad = houseSeen.filter(d => d.covering >= 0 && !d.covered);
    check('threshold fixture: the strip really is cut into CLADDING, on a door '
      + 'the sheet actually shows',
      clad.length > 0, `${clad.length} of ${houseSeen.length} door view(s)`);
    const painted = clad.filter(d => !d.bare || d.over > 0)
      .map(d => `${d.cut}/${d.id} ${d.bare ? `${d.over} stroke(s) in it` : 'no strip'}`);
    check('and the strip is BARE -- nothing is drawn inside it after it',
      painted.length === 0, painted.join(', '));

    const garageSeen = seen.filter(d => !d.house);
    const extra = garageSeen.filter(d => d.bare || d.line)
      .map(d => `${d.cut}/${d.id} foot ${ftIn(d.foot)}`);
    check('and a GARAGE door gets none -- it stands on a slab with no deck '
      + 'coming to it', extra.length === 0, extra.join(', '));
  }

  // ── AND THE EXPOSED CONCRETE CAN BE CLAD ──────────────────────────────
  //
  // Movie, 28 Sep: *"we also need the FOUNDATION to be clickable - sometimes
  // someone may want finish added to the side of foundation too"*, and the
  // case that makes it ordinary: *"sometimes it will be needed on the side of
  // a house that has a walkout for instance"*.
  //
  // ONE LINE, TWO NAMES. He asked *"goes to top of concrete/ bot of sill plate
  // right?"* -- yes, and they are the same height. The wall's cladding above
  // runs DOWN to it and the foundation's runs UP to it, so the pair meet with
  // nothing between them, which is what lets him say *"if i want to DROP the
  // main floor finish i can add a bit to the TOP of the FOUNDATION finish"*.
  //
  // MEASURED AGAINST THE GREY IT COVERS, not against grade re-derived here.
  // The concrete's own fill already answers "what of this pour can be seen" --
  // `visibleRuns` cut it against everything standing nearer -- so asserting
  // the cladding lands on exactly those rectangles asks the real question
  // once. Re-deriving the extent would be a second answer to it, and the two
  // would agree until the day they did not.
  //
  // ── ON TWO DRAWINGS, BECAUSE ONE OF THEM CANNOT SHOW THE CLIP ───────
  //
  // repro-garage-house's foundation faces each show whole: nothing stands in
  // front of them, so `visibleRuns` hands back the face's own extent and
  // "clipped to what shows" and "the whole face" are the same rectangle. The
  // mutation that clads the whole face passed on it, and would have gone on
  // passing. On repro-2storey-garage-beam E1 the garage stands in front of
  // 800px of the house's pour -- run 100..580 of a face 100..1380 -- so the
  // two answers differ and the claim can be made.
  [['repro-garage-house', SAVED],
    ['repro-2storey-garage-beam', JSON.parse(fs.readFileSync(path.join(ROOT,
      'proto', 'repro-2storey-garage-beam.draft'), 'utf8'))]].forEach(([name, fixture]) => {
    const bareSaved = JSON.parse(JSON.stringify(fixture));
    const cladSaved = JSON.parse(JSON.stringify(fixture));
    const fdnOf = d => d.walls.filter(w => (w.view || 'plan') === 'foundation');
    fdnOf(cladSaved).forEach(w => { w.finish = 'ledgestone'; });
    check(`${name}: the drawing has foundation walls to clad`,
      fdnOf(cladSaved).length > 0, `${fdnOf(cladSaved).length} wall(s)`);

    const paint = saved => {
      const env = buildEnv(win, saved);
      const boxes = [];
      const FP = win.DraftFinishPatterns;
      const realDraw = FP.drawFinish;
      win.DraftFinishPatterns = { ...FP,
        drawFinish: (ctx, box, finish, inks) => {
          boxes.push({ id: finish && finish.id, x0: box.x0, x1: box.x1,
            yTop: box.yTop, yBottom: box.yBottom });
          return realDraw(ctx, box, finish, inks);
        } };
      const view = paintElevation(win, env,
        standardElevationCuts(env).find(c => c.id === 'E1'),
        { pxPerFt: 40, finishes: true });
      win.DraftFinishPatterns = FP;
      return { view, boxes };
    };

    const bare = paint(bareSaved);
    const clad = paint(cladSaved);
    // THE GREY IS IN THE DEFAULT SKIN'S OWN WORDS. C.faceShade is what an
    // elevation paints exposed concrete in, and these run with no skin
    // passed, so it is the literal at the top of cut-view.js.
    const concreteOf = view => view.view.fills
      .filter(f => f.rect && f.ink === '#e8e8ea').map(f => f.rect);
    check(`${name}: E1 shows some exposed concrete to clad`,
      concreteOf(clad).length > 0, `${concreteOf(clad).length} exposed run(s)`);

    // ── ASKED BY WHERE IT LANDS, NOT BY WHAT IT IS ────────────────────
    //
    // "No LEDGESTONE on the bare drawing" was the first form of this and it
    // was blind in exactly the direction that matters: the defect worth
    // catching is a foundation falling back to the DEFAULT finish, and the
    // default is stucco, so a mutation dropping the `g.wall.finish` test
    // would have painted every exposed pour in the drawing and passed. What
    // is being claimed is about the CONCRETE, so the probe is too.
    const near = (a, b) => Math.abs(a - b) < 1.5;
    const onConcrete = view => {
      const runs = concreteOf(view);
      return view.boxes.filter(b => runs.some(r =>
        near(r.x, Math.min(b.x0, b.x1))
        && near(r.x + r.w, Math.max(b.x0, b.x1))
        && near(r.y, b.yTop)
        && near(r.y + r.h, b.yBottom)));
    };
    check(`${name}: bare concrete stays bare -- a foundation carries no `
      + 'DEFAULT finish',
      onConcrete(bare).length === 0,
      onConcrete(bare).map(b => b.id).join(', ')
        || `${bare.boxes.length} box(es) painted, none on concrete`);
    const clads = onConcrete(clad);
    check(`${name}: and a foundation wall given a finish wears it`,
      clads.length > 0 && clads.every(b => b.id === 'ledgestone'),
      `${clads.length} box(es): ${[...new Set(clads.map(b => b.id))].join(', ') || 'none'}`);

    // GRADE TO THE TOP OF THE POUR, AND NO WIDER THAN WHAT SHOWS. Every
    // ledgestone box must be one of those, not merely near one: a box
    // reaching below grade, above the pour, or across a stretch a nearer
    // wall covers matches no painted rectangle at all.
    const ledge = clad.boxes.filter(b => b.id === 'ledgestone');
    const astray = ledge.filter(b => !clads.includes(b))
      .map(b => `x ${b.x0.toFixed(1)}..${b.x1.toFixed(1)} y ${b.yTop.toFixed(1)}..${b.yBottom.toFixed(1)}`);
    check(`${name}: and it covers exactly the concrete that shows -- grade `
      + 'to the top of the pour, clipped to what nothing nearer hides',
      astray.length === 0 && ledge.length > 0,
      astray.length ? astray.join('; ')
        : `${ledge.length} box(es) on ${concreteOf(clad).length} run(s)`);
  });

  // ── AND A WINDOW SAYS ITS SIZE IN THE MIDDLE OF THE GLASS ─────────────
  //
  // Movie, 28 Sep: *"on the elevations i'd like the window marked in middle
  // center of the window"*, with the format settled the same afternoon --
  // *"36 X 42 width by height in inches"*, *"(don't need the letter for the
  // window)"*, *"i want it to match the actual size of the window"*.
  //
  // THE RECORD'S SIZE, NOT THE DRAWN ONE, and that is the whole of the second
  // check. `top` in the painter is clamped to the wall plate: a window whose
  // head would poke through its own top plate is DRAWN short, and a framer
  // ordering off the drawn height would order the wrong window. So the fixture
  // below raises one head deliberately past the plate, where the two numbers
  // differ by eleven inches and only one of them is right.
  {
    // ON MOVIE'S OWN DRAWING, because repro-garage-house has no window in it
    // at all -- its four openings are every one a door. The fixture-reach
    // check below said so on the first run, which is what it is for.
    const tagSaved = JSON.parse(JSON.stringify(
      JSON.parse(fs.readFileSync(path.join(ROOT, 'proto', 'repro-movie-bands.draft'), 'utf8'))));
    const wins = (tagSaved.fenestrations || []).filter(f => f.type === 'window');
    // A HEAD THROUGH THE PLATE, on one window only, so the pair can be told
    // apart in the same paint.
    const tall = wins[0];
    if (tall) { tall.sillHeight = 2; tall.headHeight = 9; }
    check('window tag fixture: the drawing has windows, and one with its head '
      + 'above the plate', wins.length > 0 && !!tall,
      `${wins.length} window(s)`);

    const tagEnv = buildEnv(win, tagSaved);
    const seen = [];
    standardElevationCuts(tagEnv).forEach(cut => {
      const view = paintElevation(win, tagEnv, cut, { pxPerFt: 40 });
      view.texts.filter(t => /^W \d+ X \d+$/.test(t.text)).forEach(t => {
        // ── STILL SHOWING, OR PAINTED OVER ──────────────────────────────
        //
        // A window on a far wall has its tag drawn by that wall's own pass and
        // must be covered by whatever stands in front. Asked of the ORDER,
        // which is the only thing occlusion is on an elevation -- and it took
        // stamping texts with the same seq counter the strokes and fills have
        // always carried, because until 28 Sep a word's place in the paint
        // order was unaskable.
        const buried = view.modelFills.some(f => f.seq > t.seq
          && Math.min(...f.pts.map(pt => pt.u)) <= t.u
          && Math.max(...f.pts.map(pt => pt.u)) >= t.u
          && Math.min(...f.pts.map(pt => pt.e)) <= t.e
          && Math.max(...f.pts.map(pt => pt.e)) >= t.e);
        seen.push({ cut: cut.id, text: t.text, u: t.u, e: t.e, buried });
      });
    });

    const shown = seen.filter(t => !t.buried);
    check('a window on an elevation is tagged with its size',
      shown.length > 0, `${shown.length} showing of ${seen.length} painted`);
    // THE RAISED WINDOW: 9'-0" head less a 2'-0" sill is 7'-0" = 84", and the
    // plate would have cut it to 73". If 73 ever appears the label has started
    // reading the drawing instead of the record.
    check('and the size is the WINDOW, not the height the plate cut it to',
      seen.some(t => t.text.endsWith(' X 84')) && !seen.some(t => / X 7[0-9]$/.test(t.text)
        && !t.text.endsWith(' X 84')),
      [...new Set(seen.map(t => t.text))].join(', ') || 'none');
    // AND IT IS COVERED WHERE THE WINDOW IS. A tag floating over a nearer
    // wall is worse than no tag: it names a window that cannot be seen.
    check('window tag fixture: some tag IS buried, so the order is being asked',
      seen.some(t => t.buried),
      `${seen.filter(t => t.buried).length} buried of ${seen.length}`);
  }

  // ── A HOUSE WALL THAT CARRIES A STOREY CLIMBS NO GARAGE GABLE ─────────
  //
  // Movie, 29 Sep, on a BILEVEL + ATTACHED ROOM-OVER GARAGE, E2: a line
  // leaves the top of the little lean-to, runs up across the house face and
  // stops in mid-wall. It was the house's main-floor face climbing the
  // garage's gable: the garage's gable edge lies on the house wall, the two
  // bear on the same plate, and nothing asked whether a second storey stood
  // on that wall. It does, so there is no triangle there to climb.
  //
  // ASKED AS SLOPE, of wall ink only. A carried wall's top is its plate --
  // level -- and its corners are plumb, so any wall-face line between the
  // plate and the storey above that is neither is the climb.
  //
  // THE GUARDS ARE GABLE WALLS THAT DO CLIMB: the garage's own far gable end,
  // and its near gable end meeting the house square on, which has to reach
  // the rake AT the house and not drop to the plate one station short of it.
  {
    const WALL_FACE_W = 1.25;
    const sloped = (view, box) => {
      let feet = 0, top = null;
      view.strokes.forEach(st => {
        if (Math.abs(st.w - WALL_FACE_W) > 1e-9) return;
        for (let k = 1; k < st.pts.length; k += 1) {
          const a = st.pts[k - 1], b = st.pts[k];
          if (b.move || b.close) continue;
          if (Math.abs(a.u - b.u) < 1e-6 || Math.abs(a.e - b.e) < 1e-6) continue;
          const inside = q => q.u >= box.uLo && q.u <= box.uHi && q.e > box.eLo && q.e < box.eHi;
          if (!inside(a) || !inside(b)) continue;
          feet += Math.hypot(a.u - b.u, a.e - b.e);
          [a, b].forEach(q => { if (!top || q.e > top.e) top = q; });
        }
      });
      return { feet, top };
    };
    const viewOf = (dEnv, id) => {
      const cut = standardElevationCuts(dEnv).find(c => c.id === id);
      return cut ? paintElevation(win, dEnv, cut, { pxPerFt: 40 }) : null;
    };

    const gStack = CV.sectionLevelStack(base);
    const gPlate = gStack.floors[0].wallTop, gUpper = gStack.floors[1];
    const gE4 = viewOf(base, 'E4'), gE2 = viewOf(base, 'E2');
    check('carried-wall fixture: the garage house has a storey on its main floor',
      !!gUpper && gUpper.floorBottom >= gPlate - 0.05 && !!gE4 && !!gE2,
      gUpper ? `plate ${ftIn(gPlate)}, 2nd floor from ${ftIn(gUpper.floorBottom)}` : 'one storey');
    if (gUpper && gE4 && gE2) {
      // E4 looks along +x: the house's x = 8 wall, the one the garage's
      // gable edge lies on, is u -6..6. Its middle -4..4 is where the
      // garage's far gable end stands behind it, stroked and then painted
      // over by the second floor, so the two SHOULDERS are what is asked:
      // 2 ft either side that only the house wall can draw in.
      const shoulder = uLo => sloped(gE4, { uLo, uHi: uLo + 2.03, eLo: gPlate + 0.05, eHi: gUpper.wallTop });
      const sides = [shoulder(-6.05), shoulder(3.98)];
      const climb = { feet: sides[0].feet + sides[1].feet, top: sides[0].top || sides[1].top };
      check('E4: the house wall under the second floor stays on its plate under the garage gable',
        climb.feet < 0.05,
        `${climb.feet.toFixed(2)} ft of sloping wall line, up to ${climb.top ? ftIn(climb.top.e) : '-'}`);
      const far = sloped(gE2, { uLo: -4.05, uHi: 4.05, eLo: gPlate + 0.05, eHi: gUpper.wallTop });
      check('and E2: the garage\'s own far gable end still climbs its gable',
        far.feet > 3, `${far.feet.toFixed(2)} ft of sloping wall line`);
    }

    const bFile = path.join(ROOT, 'proto', 'repro-bilevel-roomover-garage.draft');
    if (!fs.existsSync(bFile)) {
      check('proto/repro-bilevel-roomover-garage.draft is present', false, 'missing');
    } else {
      const bEnv = buildEnv(win, JSON.parse(fs.readFileSync(bFile, 'utf8')));
      const bStack = CV.sectionLevelStack(bEnv);
      const bPlate = bStack.floors[0].wallTop, bUpper = bStack.floors[1];
      const bE2 = viewOf(bEnv, 'E2');
      check('bilevel fixture: two storeys and an E2 to look at',
        !!bUpper && bUpper.floorBottom >= bPlate - 0.05 && !!bE2,
        bUpper ? `plate ${ftIn(bPlate)}, 2nd floor from ${ftIn(bUpper.floorBottom)}` : 'one storey');
      if (bUpper && bE2) {
        // E2: the house's x = 9 face is u -1..31, the lean-to's gable end
        // wall is u -5..-1 and meets the house at u = -1.
        const house = sloped(bE2, { uLo: -0.95, uHi: 31.05, eLo: bPlate + 0.05, eHi: bUpper.wallTop });
        check('E2: the bilevel\'s main-floor face draws no line up the garage gable',
          house.feet < 0.05,
          `${house.feet.toFixed(2)} ft of sloping wall line, up to ${house.top ? ftIn(house.top.e) : '-'}`
            + (house.top ? ` at u ${house.top.u.toFixed(2)}` : ''));
        const gable = sloped(bE2, { uLo: -5.05, uHi: -0.95, eLo: bPlate + 0.05, eHi: bUpper.wallTop });
        check('and the lean-to\'s gable end still climbs, to the rake at the house wall',
          gable.feet > 2 && !!gable.top && gable.top.u > -1.05 && gable.top.e > bPlate + 1,
          `${gable.feet.toFixed(2)} ft, highest ${gable.top ? `${ftIn(gable.top.e)} at u ${gable.top.u.toFixed(2)}` : '-'}`);
      }
    }
  }

    // ── THE MOD BILEVEL'S FRONT: ONE FACE, AND ITS ROOM'S FLOOR BAND ────
    //
    // Movie, 4 Oct, on E1: "see that LINE in the wall it looks like there the
    // entry area is / main floor. we need to remove that line. and i also
    // noticed a 'height' line that should be removed".
    //
    // ASKED OF WHAT IS SEEN, not of what is stroked: a line painted and then
    // covered by a later fill is not on the sheet. Ink at (u, e) is visible
    // when no fill painted after it contains that point.
    // A MODIFIED BILEVEL built from the drive-thru on 4 Oct, after the room's
    // roof went square -- the lean-to and the room's floor band as he saw them.
    const mFile = path.join(ROOT, 'proto', 'repro-modbilevel-e1.draft');
    if (fs.existsSync(mFile)) {
      const mEnv = buildEnv(win, JSON.parse(fs.readFileSync(mFile, 'utf8')));
      const mStack = CV.sectionLevelStack(mEnv);
      const entry = mStack.floors.find(l => l.id === 2);
      const main = mStack.floors.find(l => l.id === 3);
      const over = mStack.floors.find(l => l.id === 4);
      const cut = standardElevationCuts(mEnv).find(c => c.id === 'E1');
      const painted = cut && paintElevation(win, mEnv, cut, { pxPerFt: 40 });
      check('MOD BILEVEL fixture: ENTRY, MAIN, OVER GARAGE and an E1',
        !!(entry && main && over && painted));
      if (entry && main && over && painted) {
        const axis = painted.axis;
        const uOf = pt => pt.x * axis.x + pt.z * axis.z;
        const inside = (pts, u, e) => {
          let hit = false;
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const a = pts[i], b = pts[j];
            if ((a.e > e) !== (b.e > e) && u < (b.u - a.u) * (e - a.e) / (b.e - a.e) + a.u) hit = !hit;
          }
          return hit;
        };
        const seen = (seq, u, e) => !(painted.modelFills || []).some(f => f.seq > seq && inside(f.pts, u, e));
        // INK ONLY: a face strokes its own outline in its fill's colour to
        // close the half-pixel seam between two fills, and that is paint, not
        // a line on the sheet.
        const segs = [];
        (painted.strokes || []).filter(st => st.ink !== '#fff').forEach(st => st.pts.forEach((pt, i) => {
          if (i === 0 || pt.move) return;
          segs.push({ seq: st.seq, a: st.pts[i - 1], b: pt });
        }));
        // The joint between the house's front and the entry's: x = -10.
        const uJ = uOf({ x: -10, z: 20 });
        const seam = segs.filter(s => Math.abs(s.a.u - uJ) < 0.02 && Math.abs(s.b.u - uJ) < 0.02)
          .filter(s => [0.25, 0.5, 0.75].some(t => {
            const e = s.a.e + (s.b.e - s.a.e) * t;
            return e > entry.floorTop + 0.1 && e < main.wallTop - 0.1 && seen(s.seq, uJ, e);
          }));
        check('E1: no seam where the house front meets the entry front, in one plane',
          seam.length === 0, `${seam.length} visible segment(s) at u ${uJ.toFixed(2)}`);
        // The OVER GARAGE floor package over the garage's lean-to: no line
        // at its top across the room's width.
        const uA = uOf({ x: -4, z: 38 }), uB = uOf({ x: 20, z: 38 });
        const lo = Math.min(uA, uB) + 0.1, hi = Math.max(uA, uB) - 0.1;
        const stub = segs.filter(s => Math.abs(s.a.e - over.floorTop) < 0.05 && Math.abs(s.b.e - over.floorTop) < 0.05)
          .filter(s => [0.1, 0.3, 0.5, 0.7, 0.9].some(t => {
            const u = s.a.u + (s.b.u - s.a.u) * t;
            // Just under the line: the room's wall fill starts ON it, the band goes under it.
            return u > lo && u < hi && seen(s.seq, u, s.a.e - 0.03);
          }));
        check('E1: no line along the room\'s floor over the garage roof',
          stub.length === 0, `${stub.length} visible segment(s) at ${ftIn(over.floorTop)}`);
      }
    } else {
      check('proto/repro-modbilevel-e1.draft is present', false, 'missing');
    }

    // ── A BILEVEL + GARAGE, E1 ────────────────────────────────────────
    //
    // Movie, 4 Oct, circling three lines on E1 of a BILEVEL + GARAGE built
    // from the drive-thru: up the entry's left edge from sill to head, up its
    // right edge above the garage roof, and along the ENTRY level's top.
    //
    // The right one was ink: the house front x 2..16 runs along the garage's
    // outline, so it was taken for the garage's and stopped at the garage's
    // plate, and the entry beside it drew its end. The other two were SEAMS --
    // two fills meeting on a pixel's centre each cover half the column, and
    // the back wall's window jamb and a level datum showed through. Polygons
    // cannot show a seam, so those two are held by what closes them: every
    // face strokes its outline in its own fill, and a floor band reaches a
    // whole pixel row under the floor it carries.
    const bFile = path.join(ROOT, 'proto', 'repro-bilevel-garage-e1.draft');
    if (fs.existsSync(bFile)) {
      const bEnv = buildEnv(win, JSON.parse(fs.readFileSync(bFile, 'utf8')));
      const bStack = CV.sectionLevelStack(bEnv);
      const bMain = bStack.floors.find(l => l.id === 3);
      const bCut = standardElevationCuts(bEnv).find(c => c.id === 'E1');
      const bPainted = paintElevation(win, bEnv, bCut, { pxPerFt: 40 });
      const inside = (pts, u, e) => {
        let hit = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const a = pts[i], b = pts[j];
          if ((a.e > e) !== (b.e > e) && u < (b.u - a.u) * (e - a.e) / (b.e - a.e) + a.u) hit = !hit;
        }
        return hit;
      };
      const seen = (seq, u, e) => !(bPainted.modelFills || []).some(f => f.seq > seq && inside(f.pts, u, e));
      const inkAt = (u, e) => (bPainted.strokes || []).filter(st => st.ink !== '#fff').some(st =>
        st.pts.some((pt, i) => i > 0 && !pt.move && Math.abs(pt.u - u) < 0.02
          && Math.abs(st.pts[i - 1].u - u) < 0.02
          && Math.min(pt.e, st.pts[i - 1].e) < e && Math.max(pt.e, st.pts[i - 1].e) > e
          // A hair either side: a line ON a later fill's edge is half
          // covered, and the polygon test cannot say which half.
          && (seen(st.seq, u - 0.01, e) || seen(st.seq, u + 0.01, e))));
      check('BILEVEL + GARAGE E1: no line up the entry\'s left edge, sill to head',
        ![3.5, 5, 6.5].some(e => inkAt(-10, e)));
      check('BILEVEL + GARAGE E1: no line up the entry\'s right edge over the garage roof',
        ![6, 7.5, 8.5].some(e => inkAt(2, e)));
      const front = (bPainted.modelFills || []).find(f => f.pts.length >= 4
        && Math.abs(Math.min(...f.pts.map(p => p.u)) - 2) < 0.05
        && Math.abs(Math.max(...f.pts.map(p => p.u)) - 16) < 0.05
        && f.ink !== '#e8e8ea');
      check('BILEVEL + GARAGE E1: the house front over the garage stands to MAIN\'s plate, not the garage\'s',
        !!front && Math.abs(Math.max(...front.pts.map(p => p.e)) - bMain.wallTop) < 0.05,
        front ? `top ${Math.max(...front.pts.map(p => p.e)).toFixed(3)} want ${bMain.wallTop.toFixed(3)}` : 'no face u 2..16');
      check('BILEVEL + GARAGE E1: each wall face closes the seam with its neighbour in its own fill',
        (bPainted.strokes || []).some(st => st.ink === '#fff' && st.pts.some((pt, i) => i > 0
          && Math.abs(pt.u + 10) < 0.02 && Math.abs(st.pts[i - 1].u + 10) < 0.02
          && Math.min(pt.e, st.pts[i - 1].e) < 3.5 && Math.max(pt.e, st.pts[i - 1].e) > 6.5)));
      const band = (bPainted.modelFills || []).find(f => f.pts.length === 4
        && Math.abs(Math.max(...f.pts.map(p => p.e)) - bMain.floorTop) < 0.06
        && Math.min(...f.pts.map(p => p.e)) < bMain.floorBottom - 0.02);
      check('BILEVEL + GARAGE E1: MAIN\'s floor band reaches a whole pixel row under its floor',
        !!band && Math.min(...band.pts.map(p => p.e)) <= bMain.floorBottom - 1.25 / 40,
        band ? `bottom ${Math.min(...band.pts.map(p => p.e)).toFixed(4)} floor ${bMain.floorBottom.toFixed(4)}` : 'no band');
    } else {
      check('proto/repro-bilevel-garage-e1.draft is present', false, 'missing');
    }

  return missed;
}

const baseline = run(load(null));
if (!MUTATION_MODE) {
  const total = baseline.length;
  console.log(`\n${total ? `${total} FAILED` : 'all checks passed'}`);
  process.exit(total ? 1 : 0);
}

// ── THE MUTATIONS ───────────────────────────────────────────────────────
// Each is a defect that has either already happened here or is one edit
// away. A mutation nothing catches is a rule this harness only appears to
// hold.
const MUTATIONS = [
  // BILEVEL + GARAGE E1, Movie 4 Oct: the three lines and what closed them.
  ['a split\'s house wall on the garage outline is the garage\'s again',
    s => s.replace("const garage = split && tagsGarage && wall.body !== 'garage' ? null : garageFor(wall);",
      'const garage = garageFor(wall);')],
  ['a face no longer strokes its outline in its own fill',
    s => s.replace('      ctx.strokeStyle = C.face; ctx.lineWidth = 1;\n      ctx.stroke();\n', '')],
  ['a floor band stops half a row under its floor again',
    s => s.replace('yBotPx = Y(level.floorBottom) + 1.5;', 'yBotPx = Y(level.floorBottom) + 1;')],
  ['an end line is drawn full height when only part of it is uncovered',
    s => s.replace('        return open.filter(([lo, hi]) => hi - lo > 0.01);',
      '        return open.length ? [[foot, top]] : [];')],
  ['a wall face draws its end where the same plane carries on',
    s => s.replace('      const endL = topL - footL > 0.01 ? carriesOn(loU, -1, footL, topL) : [];',
      '      const endL = topL - footL > 0.01 ? [[footL, topL]] : [];')],
  ['a floor band is clipped by a nearer face that stops below it',
    s => s.replace('        && (top == null || other.top >= top - 1e-6)).forEach(other => {', '        ).forEach(other => {')],
  ['a floor band draws its end against a wall in its own plane',
    s => s.replace('            if (flushStop(u, d, part)) return;', '')],
  // ── RE-AIMED: IT WAS NAMED FOR ONE FUNCTION AND MUTATING ANOTHER ────
  //
  // Its anchor was `- GARAGE_BEAM_PLATE_IN / 12;\n  }`, which occurs TWICE in
  // cut-view.js -- at :332 inside garageConcreteTop and at :352 inside
  // frostWallTop -- and String.replace takes the first. So a mutation called
  // "frostWallTop stops subtracting the plate" has been taking the plate off
  // garageConcreteTop for as long as it has existed, and scoring a clean
  // kill for it. Both are real defects and both are caught, which is exactly
  // why nothing ever said so: the table read 30/30 either way.
  //
  // Found by proto/mutant-anchors-harness.js once it learned to read the
  // tables the ENGINES carry -- the half of that file written on 26 Sep. It
  // is the first thing that has ever looked at these anchors.
  //
  // AIMED AT THE WHOLE RETURN, so it can only be frostWallTop's: the drop
  // and the plate are one expression there and the two lines occur nowhere
  // else together.
  ['frostWallTop stops subtracting the plate (the original defect)',
    s => s.replace("    return fdn.wallTop - garageSillDropFt(envBuildType(env), 'frostwall')\n      - GARAGE_BEAM_PLATE_IN / 12;",
      "    return fdn.wallTop - garageSillDropFt(envBuildType(env), 'frostwall');")],
  // THE ORIGINAL DEFECT, SPELLED AS IT WOULD APPEAR NOW. It used to read
  // `fdn.grade + GARAGE_BEAM_ABOVE_GRADE_FT + GARAGE_BEAM_PLATE_IN / 12`, and
  // that is no longer a mutation at all: with grade corrected, grade + 1'-2"
  // + plate IS fdn.wallTop, so the expression became right. The two errors
  // were cancelling -- the garage climbed a plate too far out of a grade that
  // sat a plate too high -- which is precisely why no drawing ever disagreed
  // with itself and nothing caught either one. Aimed at the plate instead.
  ['the attached garage stands a sill plate proud of the house again',
    s => s.replace('if (!isDetachedGarage(garage)) return fdn.wallTop - garageSillDropFt(envBuildType(env), mode);',
      'if (!isDetachedGarage(garage)) return fdn.wallTop + GARAGE_BEAM_PLATE_IN / 12;')],
  ['a grade beam takes the drop too, and ends up under the ground',
    s => s.replace("if (mode !== 'frostwall') return 0;", "if (mode === 'nonesuch') return 0;")],
  ['a frost wall stops dropping at all',
    s => s.replace("return SPLIT_TYPES.includes(buildType) ? 0 : GARAGE_SILL_BELOW_HOUSE_FT;",
      'return 0;')],
  ['the split clause goes, so a bilevel drops like a bungalow',
    s => s.replace("SPLIT_TYPES.includes(buildType) ? 0 : GARAGE_SILL_BELOW_HOUSE_FT",
      'GARAGE_SILL_BELOW_HOUSE_FT')],
  ['isDetachedGarage inverts, so attached and detached swap answers',
    s => s.replace('garage.open !== true && garage.detached === true',
      'garage.open === true || garage.detached !== true')],
  ['drawSectionWall stops asking which body the wall belongs to',
    s => s.replace("const bottom = crossing.garage && fdn\n      ? garageBearing(env, fdn, crossing.garage)\n      : level.floorTop;",
      'const bottom = level.floorTop;')],
  ['the section caller stops handing the painter its foundation',
    s => s.replace('drawSectionWall(env, ctx, X, Y, pxPerFt, c, level, opts, C, fdn)',
      'drawSectionWall(env, ctx, X, Y, pxPerFt, c, level, opts, C)')],
  ['grade goes back to measuring from the bearing line, a plate high',
    s => s.replace('return wallTop - houseSillPlateFt() - GRADE_BELOW_FOUNDATION_TOP_FT;',
      'return wallTop - GRADE_BELOW_FOUNDATION_TOP_FT;')],
  ['grade borrows the GARAGE plate, so the house defers to the garage',
    s => s.replace('const houseSillPlateFt = () => window.DraftLevelAssembly.SILL_PLATE_IN / 12;',
      'const houseSillPlateFt = () => 0;')],
  // Anchored on the ASSIGNMENT, not on the whole ternary: the fallback arm
  // beside it has already been rewritten once in this file's life and took
  // this mutation's anchor with it ("MUTATION DID NOT APPLY", caught by the
  // gate rather than scored as a kill). `const slabTop = garage ?` is unique
  // and survives anything done to the arm after it.
  ['the grade-beam slab stands on the plate again, 9 1/2" high',
    s => s.replace('    return top - garageDoorOpeningFt(env, garage, pt);',
      '    return garageBearing(env, fdn, garage) + GARAGE_SLAB_THICKNESS_IN / 12;')],
  ['the thickened edge goes back to 4" proud of grade',
    s => s.replace('const GARAGE_SLAB_ABOVE_GRADE_IN = 10;',
      'const GARAGE_SLAB_ABOVE_GRADE_IN = 4;')],
  ['the slab is not subtracted, so the floor IS the top of concrete',
    s => s.replace('return top - GARAGE_SLAB_THICKNESS_IN / 12;\n  }', 'return top;\n  }')],
  ['a thickened edge grows a sill plate it has no wall for',
    s => s.replace("if (env.garageFoundation(garage) === 'thickened') return garageBearing(env, fdn, garage);\n    return garageBearing(env, fdn, garage) - GARAGE_BEAM_PLATE_IN / 12;",
      'return garageBearing(env, fdn, garage) - GARAGE_BEAM_PLATE_IN / 12;')],
  ['a foundation wall\'s `body: garage` marker is ignored again',
    s => s.replace("if (String(wall.body || '').trim() !== 'garage') return null;",
      'return null;')],
  ['the marker is trusted without checking WHICH garage it lies on',
    s => s.replace('      if (found) return found;', '      if (others.length) return others[0];')],
  ['the buried silhouette walks the WALL extent again, losing the inner step',
    s => s.replace('...run.faces.flatMap(g => [footLo(g), footHi(g)])])]',
      '...run.faces.flatMap(g => [g.lo, g.hi])])]')],
  ['only the run\'s outer ends carry a footing projection',
    s => s.replace('const footLo = g => g.lo - g.projFt;\n      const footHi = g => g.hi + g.projFt;',
      'const footLo = g => g.lo;\n      const footHi = g => g.hi;')],
  ['the elevation stops drawing piles',
    s => s.replace("        && String(column.footing || '').startsWith('pile')\n        && column.point);",
      '        && false);')],
  ['a pile is drawn as a centreline, with no bore',
    s => s.replace('      const half = sizeIn / 24;', '      const half = 0;')],
  ['the shaft hangs off grade instead of the concrete it carries',
    s => s.replace('      const head = Math.min(...(hung.length ? hung : over).map(g => g.baseE));',
      '      const head = fdn.grade;')],
  // The defect the check above was written for, and which it found in the
  // code rather than in a mutant: at the corner where a garage beam meets the
  // house, taking the DEEPEST face starts the shaft under the house footing,
  // 5'-6" below the beam the pile actually carries.
  ['a pile takes the deepest concrete over it, not the beam it carries',
    s => s.replace('      const hung = over.filter(g => !g.bearing);', '      const hung = [];')],
  // RE-AIMED 26 Sep. This pointed at `uncovered(...).forEach(part => {`, which
  // stopped existing when the edge pass learned to read the painted parts too
  // -- the call and the walk are two statements now, with the list kept
  // between them. The claim is unchanged and the mutant is STRONGER for the
  // move: replacing the list at its source takes the clip away from the fill
  // AND from the edges that close it, which is the whole of "stops asking".
  ['the rim band stops asking what stands in front of it',
    s => s.replace('        const parts = uncovered(run.lo, run.hi, depth, level.floorTop);',
      '        const parts = [{ lo: run.lo, hi: run.hi }];')],
  ['the occlusion test goes back to house faces only, blind to the garage',
    s => s.replace('    const allSpans = faces.map(spanOf).filter(span => span.hi - span.lo >= 0.5);',
      '    const allSpans = houseSpans;')],
  // REPLACED 26 Sep, and the old one is worth naming. It read
  //
  //   'const slabTop = garage ? garageSlabTop(env, fdn, garage)' -> 'false ? 0'
  //
  // which forced the hung-beam slab onto the STORED-WALL fallback. It was
  // killed only because that fallback disagreed with garageSlabTop by a sill
  // plate -- the very defect 97a82c9 fixed -- so once the base was right the
  // two branches agreed and the mutation changed nothing. A mutant standing
  // on a bug: it read as a gate going soft when the bug went away.
  //
  // THE DEFECT ITSELF IS THE MUTANT NOW. Dropping the plate from the
  // foundation's base is what was actually wrong, and the check above --
  // the fallback and the datum answering alike -- is what catches it.
  ['the foundation base forgets the sill plate, as it did before 97a82c9',
    s => s.replace("const wallBottom = wallTop - houseSillPlateFt()\n      - (split ?",
      "const wallBottom = wallTop\n      - (split ?")],
  // THE OTHER HALF OF THAT ONE. Taking the plate off the base put the top of
  // concrete where concrete really tops out; these two are what say the
  // 1 1/2" it opened up is now painted, and painted as WALL.
  ['the sill plate goes unpainted, and the wall floats a plate off the concrete',
    s => s.replace('      return rise > 0.01 && rise < PLATE_CAP_FT ? rise : 0;',
      '      return 0;')],
  // RE-AIMED. This anchored on `if (!plate) return;` + the fillStyle under it,
  // and ea3bc01 -- a COMMENT-ONLY commit -- put twenty lines of note between
  // the two. Not one stroke moved and the anchor died anyway: a mutation
  // anchor is TEXT, so "no ink changed" says nothing about whether the gate
  // still has something to bite. CI caught it, my own sweep did not, because
  // I re-ran the harnesses PLAIN and only `--mutate` sees a dead anchor.
  //
  // AIMED AT THE CODE, NOT AT A BOUNDARY A COMMENT CAN LAND ON. The fillStyle
  // alone appears four times in the file; paired with the fillRect it serves,
  // it appears once, and the two lines are adjacent code with nothing between
  // them for a note to slide into.
  // RE-AIMED, 26 Sep: the plate strip learned to skip a door buck, so the
  // `runs.forEach` that followed this fillStyle became a `notched(...)` walk
  // and the old anchor stopped matching. proto/mutant-anchors-harness.js
  // caught it on the same run.
  ['the strip is painted as concrete -- the top-of-concrete line moves back up',
    s => s.replace('      ctx.fillStyle = C.face;\n      runs.forEach(r => notched(r, bs).filter(p => !p.drop)',
      '      ctx.fillStyle = C.faceShade;\n      runs.forEach(r => notched(r, bs).filter(p => !p.drop)')],
  // THE BURIED SILHOUETTE GOES BACK TO SWALLOWING WHAT HANGS OVER IT. The
  // guard is the whole pass: with it always continuing, no stretch is
  // collected and the drawing is exactly what Movie marked in green.
  ['a hung beam loses its underside where the house footing runs deeper',
    s => s.replace('          if (bottomAt((a + b) / 2) > mine - 1e-6) continue;',
      '          if (bottomAt((a + b) / 2) < Infinity) continue;')],
  // AND THE FOOTING GOES FLAT ON THE SIDE THE GARAGE IS ON. The shoulder is
  // then spent only at the run's two outer ends, which is where it was
  // before -- and on that side the outer end belongs to the beam.
  ['a footing end interior to a merged run spends no shoulder',
    s => s.replace('        if (g.projFt <= 0) return;',
      '        if (g.projFt <= 0 || true) return;')],
  // AND A WALL FACE CLOSES ITS OUTLINE ALONG ITS OWN BASE AGAIN, which
  // brackets a garage's sill plate between two horizontals and reads as the
  // slot Movie reported after the plate was already being filled -- and, on
  // a house, draws a storey line straight across the facade.
  //
  // RE-AIMED TWICE. On 26 Sep the base line grew a `moveTo` of its own and
  // the old anchor, which named the whole one-line statement, stopped
  // matching; proto/mutant-anchors-harness.js said so on the run that made
  // the change and CI never saw it. On 28 Sep the `if (!face.garage)` went
  // with the line itself -- the house's half was never on the sheet, the rim
  // band had always covered it, and Movie chose to keep it that way. So the
  // mutation now PUTS THE SUB-PATH BACK rather than widening a condition,
  // and it is aimed at the `ctx.stroke()` that used to follow it.
  ['a wall face lines its own base again, and a house grows a storey line',
    s => s.replace('      ctx.stroke();\n      const wallLen = Math.hypot(',
      '      ctx.moveTo(xb, Y(floor));\n      ctx.lineTo(xa, Y(floor));\n'
      + '      ctx.stroke();\n      const wallLen = Math.hypot(')],
  // AND THE TWO 26 SEP READINGS OFF THE BURIED WORK. The first puts the
  // riser back to the full height of the step; the second draws every pile
  // again, including the ones the house's foundation stands in front of.
  ['a footing-s side climbs to the next bottom instead of stopping at the footing',
    s => s.replace('const top = sideTopAt(stops[s] + (b < prevBottom ? 0.01 : -0.01));',
      'const top = null;')],
  ['an exposed foundation wall end loses its face above the shoulder',
    s => s.replace('          const top = Math.min(g.topE, fdn.grade);',
      '          const top = g.baseE;')],
  ['a pile behind the foundation wall is drawn through it',
    s => s.replace('const infront = fdnGeoms.some(g => g.bearing && g.depth > pileDepth + 1',
      'const infront = false && fdnGeoms.some(g => g.bearing && g.depth > pileDepth + 1')],
  // AND THE THREE WAYS THE BEAM'S UNDERSIDE STOPS MINDING WHAT IS IN FRONT
  // OF IT -- the 26 Sep reading, once per condition it rests on.
  //
  // The first is the defect itself: no cover at all, twenty feet of dashes
  // through the house on E3. The second turns the depth test around, so the
  // NEARER piece is the one that goes. The third forgets that concrete hides
  // only over the height it occupies; no fixture here can tell the honest
  // version from a missing test on its own, so it is aimed to hide MORE --
  // `>= mine` instead of `<= mine` puts the house's footing, which stops six
  // feet BELOW the beam, back in front of it.
  //
  // THERE IS NO `bearing` MUTANT because there is no `bearing` test: see the
  // note at the pass. The piles need one and this does not, and a mutation
  // table is not the place to assert a condition the code does not have.
  ['the beam-s underside is drawn through whatever stands in front of it',
    s => s.replace('          walls.reduce(clipOut, [{ lo: a, hi: b }])',
      '          [{ lo: a, hi: b }]')],
  ['the wall BEHIND the beam is the one taken to hide it',
    s => s.replace('const walls = run.faces.filter(o => o.depth > g.depth + 1',
      'const walls = run.faces.filter(o => o.depth < g.depth - 1')],
  // AND THE FOUR WAYS THE DOOR BUCK STOPS BEING A DOOR BUCK. The first two
  // are the feature missing and the notch cut at a constant instead of at the
  // slab's fall -- which is why the fixture claim about a door further in is
  // there. The third takes the fall from the wrong end, so the back of the
  // garage is notched deepest. The fourth paints the plate across the opening,
  // which puts 1 1/2" of wall finish over a door.
  // ── AND THE STEP THAT CAME BACK OUT OF THE ELEVATION ────────────────
  //
  // Movie, 26 Sep: *"on the elevations don't show the line where the pour and
  // grade beam [meet] - just show them all as concrete"*. Board #45's first
  // half drew it; this is the two halves of undrawing it, so neither the
  // outline nor the fill can put the step back on its own.
  ['the concrete-s top steps down at a door on the elevation again',
    s => s.replace('        runs.forEach(r => { ctx.moveTo(X(r.lo), Y(g.topE)); ctx.lineTo(X(r.hi), Y(g.topE)); });',
      '        runs.forEach(r => notched(r, bs).forEach(q => { ctx.moveTo(X(q.lo), Y(g.topE - q.drop));'
      + ' ctx.lineTo(X(q.hi), Y(g.topE - q.drop)); }));')],
  //
  // THERE IS NO MATCHING MUTANT FOR THE FILL, and that is a measurement rather
  // than an omission. A door's own recess is painted over its rough opening
  // down to where the door stands, which is exactly the strip a stepped fill
  // would leave empty -- measured on repro-2storey-garage-beam E1, the recess
  // runs u 0.00..16.00, e -1.8433..5.9483 while the concrete's top is -1.1729.
  // So no drawing can tell a flat fill from a stepped one, and a mutation table
  // is not the place to assert a difference nothing can see. The fill is flat
  // because the outline is; the outline is what a drafter reads.
  ['no door notches the top of the beam at all',
    s => s.replace('        if (open <= 0.01) return;      // the slab has filled the whole buck',
      '        if (true) return;      // the slab has filled the whole buck')],
  ['every door is notched the same, whatever the slab has done',
    s => s.replace('    return garageSlabBelowConcreteIn(garageDepthFt(env, garage, pt)) / 12;',
      '    return GARAGE_SLAB_AT_DOOR_IN / 12;')],
  ['the fall is measured from the back of the garage instead of the door',
    s => s.replace('    return garageSlabBelowConcreteIn(garageDepthFt(env, garage, pt)) / 12;',
      '    return garageSlabBelowConcreteIn('
      + 'GARAGE_SLAB_FLAT_AT_FT - garageDepthFt(env, garage, pt)) / 12;')],
  ['the sill plate is painted across the door opening',
    s => s.replace('      runs.forEach(r => notched(r, bs).filter(p => !p.drop)\n        .forEach(p => ctx.fillRect(',
      '      runs.forEach(r => notched(r, bs).filter(p => true)\n        .forEach(p => ctx.fillRect(')],
  // AND THE THREE WAYS A DOOR STOPS STANDING ON WHAT IS UNDER IT. The first
  // is the 26 Sep defect itself -- a door in a buck stopping at the wall's
  // floor, which leaves the wall fill's own edge showing across the opening
  // at plate height. The second takes the threshold away, so the door's
  // bottom line lands on the wall's base line and disappears. The third gives
  // the overhead door one, which it must not have: it seals to the slab.
  ['a door in a buck stops at the plate instead of reaching the slab',
    s => s.replace("        const buck = f.type === 'door' && face.garage",
      "        const buck = false && f.type === 'door' && face.garage")],
  ['an exterior door stands flush on the floor, with no threshold under it',
    s => s.replace('          : stands + (f.garage ? 0 : DOOR_THRESHOLD_IN / 12);',
      '          : stands;')],
  ['the overhead door is given a threshold it does not have',
    s => s.replace('          : stands + (f.garage ? 0 : DOOR_THRESHOLD_IN / 12);',
      '          : stands + DOOR_THRESHOLD_IN / 12;')],
  ['a wall hides the beam from below its own footing',
    s => s.replace('          && bottomOf(o) <= mine + 1e-6 && o.topE > mine + 1e-6);',
      '          && bottomOf(o) >= mine + 1e-6 && o.topE > mine + 1e-6);')],
  // ── AND THE SECTION HALF OF THE SAME BOARD ITEM ──────────────────────
  //
  // The buck seen from the side: the void formed in the top of the beam, the
  // slab poured into it, and the door standing on that. One mutant per claim
  // the block reads off the drawing, plus the two ways the DATUM slips -- which
  // is what Movie's correction was about, and the reason the old one-level
  // reading passed a drawing 3 1/2" out.
  ['the section leaves the beam-s full top under a door -- no buck at all',
    s => s.replace('const buck = doorAt(c) ? buckFloor(c.garage) : null;',
      'const buck = null;')],
  ['the section bucks EVERY garage beam, door or no door',
    s => s.replace('const buck = doorAt(c) ? buckFloor(c.garage) : null;',
      'const buck = c.garage ? buckFloor(c.garage) : null;')],
  ['the buck is cut to the slab-s fall instead of a foot, so it vanishes at the back',
    s => s.replace('const buckFloor = g => garageConcreteTop(env, fdn, g)'
      + ' - GARAGE_DOOR_BUCK_IN / 12;',
      'const buckFloor = g => garageConcreteTop(env, fdn, g)'
      + ' - garageDoorOpeningFt(env, g, ptAtU(0));')],
  ['the section-s garage floor goes back to one level',
    s => s.replace('const F = u => garageFloorAt(env, fdn, garage, ptAtU(u));',
      'const F = () => garageSlabTop(env, fdn, garage);')],
  ['the slab-s underside runs straight past a door, leaving the void empty',
    s => s.replace('        const buck = buckAt((a + b) / 2);',
      '        const buck = null;')],
  ['the floor-s corner at the door is dropped, so the fall runs out through it',
    s => s.replace('      [0, GARAGE_SLAB_FLAT_AT_FT].forEach(d => {',
      '      [].forEach(d => {')],
  ['a door in section stands on its sill plate again, clear of the floor',
    s => s.replace("    const stands = opening.type === 'door' && crossing.garage && fdn",
      "    const stands = false && opening.type === 'door' && crossing.garage && fdn")],
  ['a man door in section loses its threshold',
    s => s.replace('        + (opening.garage ? 0 : DOOR_THRESHOLD_IN / 12)',
      '        + 0')],
  ['the overhead door in section is given a threshold too',
    s => s.replace('        + (opening.garage ? 0 : DOOR_THRESHOLD_IN / 12)',
      '        + DOOR_THRESHOLD_IN / 12')],
  // THE DATUM ITSELF, twice. An unsigned depth mirrors a point OUTSIDE the door
  // into one inside it, so the fall climbs back out through the opening; a
  // normal left on the wall-s own winding points at the driveway on half the
  // drawings and does the same thing to the whole garage.
  ['the depth into the garage is unsigned again, mirroring the buck outward',
    s => s.replace('    return (pt.x - datum.at.x) * datum.nx + (pt.z - datum.at.z) * datum.nz;',
      '    return Math.abs((pt.x - datum.at.x) * datum.nx'
      + ' + (pt.z - datum.at.z) * datum.nz);')],
  ['the door wall-s normal is taken as drawn instead of turned into the garage',
    s => s.replace('if ((cx - wall.start.x) * nx + (cz - wall.start.z) * nz < 0)',
      'if (false)')],
  ['a garage with no overhead door loses its slab and sits flush with the pour',
    s => s.replace('    if (!garageDoorDatum(env, garage)) return garageSlabTop(env, fdn, garage);',
      '')],
  // AND THE REFERENCE LINE: missing, drawn on every beam whether or not a buck
  // was taken out of it, struck at the cut's own weight so it reads as a second
  // top of concrete, and put at the notched top where it says nothing.
  ['the beam-s full top is not shown behind the buck at all',
    s => s.replace('      if (buck != null) {\n'
      + '        ctx.strokeStyle = ink(0.35); ctx.lineWidth = 1;',
      '      if (false) {\n'
      + '        ctx.strokeStyle = ink(0.35); ctx.lineWidth = 1;')],
  ['the reference line is struck at the cut-s own weight',
    s => s.replace('        ctx.strokeStyle = ink(0.35); ctx.lineWidth = 1;\n'
      + '        ctx.beginPath();',
      '        ctx.strokeStyle = INK; ctx.lineWidth = 1.25;\n'
      + '        ctx.beginPath();')],
  ['the reference line is drawn at the notched top, where it says nothing',
    s => s.replace('        ctx.moveTo(x, Y(garageConcreteTop(env, fdn, c.garage)));\n'
      + '        ctx.lineTo(x + wid, Y(garageConcreteTop(env, fdn, c.garage)));',
      '        ctx.moveTo(x, Y(top));\n'
      + '        ctx.lineTo(x + wid, Y(top));')],
  // ── AND WHAT HIDES A FACE BEHIND IT ─────────────────────────────────
  //
  // Movie, 26 Sep: *"its like the house is transparent or the door buck lines
  // are going in front of the house"*. A wall does not stop at its concrete,
  // and asking only the concrete let the garage's foundation -- 26 ft behind
  // -- paint its top line and its buck across the back of the house.
  ['a face hides what is behind it only up to its concrete, not its plate',
    s => s.replace('      && o.topE + plateOf(o) >= g.topE - 1e-3',
      '      && o.topE >= g.topE - 1e-3')],
  // AND THE DOOR'S OWN HALF OF IT: the dip is what hangs below the wall, into
  // a band the foundation pass painted first, so it is the part that has to
  // ask. Clipping every door, or none, is the same sheet without a body in
  // front of one -- which the fixture claim beside these asserts there is.
  ['a door reaches below its wall even with a house standing in front of it',
    s => s.replace('        const bottom = infront ? floor : reaches;',
      '        const bottom = reaches;')],
  ['every door is cut off at its wall, buck or no buck',
    s => s.replace('        const bottom = infront ? floor : reaches;',
      '        const bottom = dips ? floor : reaches;')],
  ['one garage filed on two storeys is two garages again',
    s => s.replace('  const sameGarageBody = (a, b) => !!a && !!b && (a === b',
      '  const sameGarageBody = (a, b) => !!a && !!b && (a === b && false')],
  // ── THE TWO THAT ATE THE STRIP UNDER MOVIE'S FRONT DOOR ─────────────
  //
  // BOTH SHIPPED, so neither of these is hypothetical: they are the code as
  // it stood on the morning of 28 Sep, spelled as a mutation. The first is
  // paintFaceFinish clipping to the CURRENT PATH -- paintFace's own polygon,
  // whose bottom is the storey line -- which is exactly what `ctx.clip()`
  // means where it is called, and is why the one-word version is the whole
  // mutation.
  ['the cladding is clipped to the face polygon again, so it stops at the floor',
    src => src.replace(`      ctx.beginPath();
      ctx.moveTo(xa, Y(lines.sill));
      tops.forEach(s => ctx.lineTo(X(s.u), Y(s.top)));
      ctx.lineTo(xb, Y(lines.sill));
      ctx.closePath();
      ctx.clip();`, '      ctx.clip();')],
  // AND THE SECOND IS THE ORDER. The bands move to the end of the same
  // depth-sorted list, which is where painting them in their own pass after
  // the faces put them: `sort` is stable, and a band's depth is the NEAREST
  // face of its run, so band-against-its-own-wall is a tie every time and the
  // tie is the whole of it.
  // AND THE SECOND IS THE ORDER, WHICH HAS TWO WRONG ANSWERS. The band sits
  // between two edges that want opposite things, so a pass that goes wholly
  // before or wholly after the walls gets one of them wrong. Both are what
  // the file actually did: last until 28 Sep, then first for an hour.
  ['the rim bands are painted after every wall again, over their own cladding',
    src => src.replace(`      ...wallItems,
      ...roofFills.map(fill => ({ depth: fill.depth, go: () => paintRoof(fill) })),`,
    `      ...wallItems.filter(item => !item.band),
      ...roofFills.map(fill => ({ depth: fill.depth, go: () => paintRoof(fill) })),
      ...wallItems.filter(item => item.band),`)],
  // ── AND THE WINDOW SIZE TAG ON AN ELEVATION ─────────────────────────
  ['a window on an elevation carries no size tag at all',
    src => src.replace(
      "        if (f.type === 'window' && window.DraftFenLabels && showFenTags) {",
      "        if (false && window.DraftFenLabels && showFenTags) {")],
  // THE DRAWN HEIGHT INSTEAD OF THE RECORD'S. `top` is clamped to the wall
  // plate, so a window whose head would poke through its own plate is DRAWN
  // short -- and a framer ordering off that number orders the wrong window.
  // Eleven inches on the fixture, and the only reason it is visible at all is
  // that the fixture raises one head on purpose.
  ['the elevation tag reads the height the plate cut it to, not the window',
    src => src.replace('            type: \'window\', widthFt: f.width, heightFt: head - sill, units: env.units });',
      '            type: \'window\', widthFt: f.width, heightFt: top - bottom, units: env.units });')],
  // ── AND THE FINISH ON THE EXPOSED CONCRETE ──────────────────────────
  ['the foundation is never clad, whatever the drafter picked',
    src => src.replace("      if (opts && opts.finishes && g.wall && g.wall.finish",
      "      if (false && opts && opts.finishes && g.wall && g.wall.finish")],
  // CONCRETE FALLS BACK TO THE DEFAULT FINISH, which is the one that would
  // repaint the exposed pour of every drawing in existence: finishById(undefined)
  // hands back stucco rather than nothing. This is why the bare check is asked
  // by WHERE a box lands and not by which material it is -- looking for
  // ledgestone, it slept straight through.
  ['bare concrete falls back to the default finish instead of staying concrete',
    src => src.replace("      if (opts && opts.finishes && g.wall && g.wall.finish\n        && g.topE - shownBase > 0.02) {",
      "      if (opts && opts.finishes && g.wall\n        && g.topE - shownBase > 0.02) {")],
  ['the cladding runs down the buried concrete, below grade',
    src => src.replace(`            ctx.rect(x0, Y(g.topE), x1 - x0, (g.topE - shownBase) * pxPerFt);
            ctx.clip();
            FP.drawFinish(ctx, { x0, x1, yTop: Y(g.topE), yBottom: Y(shownBase), pxPerFt },`,
    `            ctx.rect(x0, Y(g.topE), x1 - x0, (g.topE - g.baseE) * pxPerFt);
            ctx.clip();
            FP.drawFinish(ctx, { x0, x1, yTop: Y(g.topE), yBottom: Y(g.baseE), pxPerFt },`)],
  // AND IT IGNORES WHAT STANDS IN FRONT, clad across the whole face rather
  // than the runs `visibleRuns` left -- so a garage's concrete gets the
  // house's stone painted over it.
  ['the cladding covers the whole face, not just the part that shows',
    src => src.replace(`          runs.forEach(r => {
            const x0 = X(r.lo), x1 = X(r.hi);`,
    `          [{ lo: g.lo, hi: g.hi }].forEach(r => {
            const x0 = X(r.lo), x1 = X(r.hi);`)],
  // ── AND THE BARE STRIP UNDER AN EXTERIOR DOOR ───────────────────────
  ['an exterior door is clad straight past its threshold, with no bare strip',
    src => src.replace("        if (opts && opts.finishes && f.type === 'door' && !face.garage && !f.garage) {",
      "        if (false && opts && opts.finishes && f.type === 'door' && !face.garage && !f.garage) {")],
  ['a GARAGE door gets the strip too, on a slab with no deck coming to it',
    src => src.replace("        if (opts && opts.finishes && f.type === 'door' && !face.garage && !f.garage) {",
      "        if (opts && opts.finishes && f.type === 'door') {")],
  // HUNG OFF THE WALL'S FLOOR AGAIN rather than off the door's own bottom.
  // On a house door that is half an inch, which is the threshold -- small,
  // and it is the whole difference between a strip that follows a door up a
  // storey and one that only happens to be right on the main floor.
  ['the bare strip hangs off the floor, not off the door bottom',
    src => src.replace('          const bare = reaches - DOOR_SILL_BARE_IN / 12;',
      '          const bare = floor - DOOR_SILL_BARE_IN / 12;')
      .replace('            ctx.fillRect(bx0, Y(reaches), bx1 - bx0, (reaches - bare) * pxPerFt);',
        '            ctx.fillRect(bx0, Y(floor), bx1 - bx0, (floor - bare) * pxPerFt);')],
  ['the strip is a foot, not the six inches he asked for',
    src => src.replace('  const DOOR_SILL_BARE_IN = 6;', '  const DOOR_SILL_BARE_IN = 12;')],
  ['the strip is left open at the bottom, with no line under it',
    src => src.replace(`            ctx.beginPath();
            ctx.moveTo(bx0, Y(bare));
            ctx.lineTo(bx1, Y(bare));
            ctx.stroke();`, '            ctx.beginPath();')],
  // AND THE CLADDING GOES BACK OVER IT. A blank spot the stone is painted on
  // top of is not a blank spot, and paintFace is where that order lives: it
  // clads the wall and then draws the openings in it. One more call at the
  // end is the whole defect.
  ['the cladding is laid back over the bare strip',
    src => src.replace(`      });
    };

    // ── A ROOF IS A SURFACE, AND IT JOINS THE PAINTER'S SORT ─────────────`,
    `      });
      if (opts && opts.finishes) paintFaceFinish(geom);
    };

    // ── A ROOF IS A SURFACE, AND IT JOINS THE PAINTER'S SORT ─────────────`)],
  ['the rim bands are painted before every wall, so the storey below keeps its head line',
    src => src.replace(`      ...wallItems,
      ...roofFills.map(fill => ({ depth: fill.depth, go: () => paintRoof(fill) })),`,
    `      ...wallItems.filter(item => item.band),
      ...wallItems.filter(item => !item.band),
      ...roofFills.map(fill => ({ depth: fill.depth, go: () => paintRoof(fill) })),`)],
  // THE BAND STONE DEFECT AS MOVIE SAW IT: the band paints under the face's
  // clip alone, so fieldstone runs 1'-3 3/4" up the wall above its band.
  ['a band draws its pattern under the face\'s clip, not its own (stone over-fills)',
    src => src.replace(`        ctx.closePath();
        ctx.clip();
        FP.drawFinish(ctx, boxAt(lo, hi, x0, x1), finishById(band.finishId), C);`,
    `        ctx.closePath();
        FP.drawFinish(ctx, boxAt(lo, hi, x0, x1), finishById(band.finishId), C);`)],
  // THE NEAR MISS: a clip that is there but cut to the wall head, which a
  // "was it clipped at all" check would pass.
  ['a band clips its pattern to the wall head instead of its own top',
    src => src.replace(`        ctx.moveTo(x0, Y(hi)); ctx.lineTo(x1, Y(hi));`,
      `        ctx.moveTo(x0, Y(lines.head)); ctx.lineTo(x1, Y(lines.head));`)],
  // THE E2 STRAY LINE AS MOVIE SAW IT: nothing asks whether a storey stands
  // on the wall, so a carried house wall climbs the garage's gable.
  ['a wall carrying a storey climbs a gable again (the E2 stray line)',
    src => src.replace(`      if (carriesStoreyAbove(pt, plateTop, wall, wallDir)) return top;\n`, '')],
  // THE TWO WAYS TO OVER-ASK IT, each of which drops a real gable wall to
  // its plate somewhere: a wall above that only shares a corner with this
  // one, or a wall on the same storey.
  ['a parallel wall above counts as a load with no stretch of this one under it',
    src => src.replace(`      if (shared <= STOREY_ABOVE_EPS) return false;\n`, '')],
  ['a wall on the same storey counts as the storey above',
    src => src.replace(`      if (other.level.floorBottom < plateTop - STOREY_ABOVE_EPS) return false;\n`, '')],
];

console.log('\n' + 'mutation'.padEnd(72) + 'caught by');
let survivors = 0, broken = 0;
for (const [label, mutate] of MUTATIONS) {
  let by;
  try {
    const m = run(load(mutate));
    if (!m.length) survivors += 1;
    by = m.length ? m.map(x => x.label).join('\n' + ' '.repeat(72)) : '*** NOTHING ***';
  } catch (err) {
    broken += 1;
    by = `!!! MUTATION DID NOT APPLY: ${err.message}`;
  }
  console.log(`${label.padEnd(72)}${by}`);
}
console.log(`\n${MUTATIONS.length - survivors - broken}/${MUTATIONS.length} mutations caught`);
if (broken) console.log(`${broken} mutation(s) never applied -- they prove nothing`);
if (!MUTATIONS.length) console.log('NO MUTATIONS DEFINED -- this table proves nothing');
process.exit(baseline.length || survivors || broken || !MUTATIONS.length ? 1 : 0);
