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
    'build-house.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
  }
  vm.runInContext(src, sandbox, { filename: 'cut-view.js' });
  return win;
}

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
        // THE FLOOR AS DRAWN, not as computed. This check read
        // `bearing + slab` when it was written -- it pinned the defect,
        // because that is what the painter did: a concrete slab standing on
        // the wood sill plate, grade + 19 1/2". It reads garageSlabTop now,
        // which is the spec's grade + 10", and it still catches the slab
        // drifting back onto the STORED wall height.
        const slabTop = CV.garageSlabTop(base, fdn, attached);
        check('SECTION: the garage floor is drawn where garageSlabTop puts it',
          concrete.some(r => near(world(r.y), slabTop, 0.01)),
          `expected a pour topping at ${ftIn(slabTop)}; saw `
          + concrete.map(r => ftIn(world(r.y))).join(' '));
        check('SECTION: which is 10" above grade',
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
        const wanted = [];
        piles.forEach(column => {
          const u = column.point.x * axis.x + column.point.z * axis.z;
          if (u < painted.uMin - 0.5 || u > painted.uMax + 0.5) return;
          const half = bh.footingFor(column.footing).sizeIn / 24;
          wanted.push([u - half, u + half]);
        });
        if (!wanted.length) return;
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
        check(`${cut.id}: every pile in view is drawn as a shaft, both sides`,
          missing.length === 0,
          `${wanted.length} in view, ${missing.length} missing`);
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
  ['frostWallTop stops subtracting the plate (the original defect)',
    s => s.replace("- GARAGE_BEAM_PLATE_IN / 12;\n  }", ";\n  }")],
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
    s => s.replace("return ['bilevel', 'modifiedBilevel'].includes(buildType) ? 0 : GARAGE_SILL_BELOW_HOUSE_FT;",
      'return 0;')],
  ['the split clause goes, so a bilevel drops like a bungalow',
    s => s.replace("['bilevel', 'modifiedBilevel'].includes(buildType) ? 0 : GARAGE_SILL_BELOW_HOUSE_FT",
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
    s => s.replace('const slabTop = garage ? garageSlabTop(env, fdn, garage)',
      'const slabTop = garage ? garageBearing(env, fdn, garage) + GARAGE_SLAB_THICKNESS_IN / 12')],
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
    s => s.replace('        const parts = uncovered(run.lo, run.hi, depth);',
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
    s => s.replace("const wallBottom = wallTop - houseSillPlateFt()\n      - env.levelWallTopFt(1, 'foundation');",
      "const wallBottom = wallTop - env.levelWallTopFt(1, 'foundation');")],
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
