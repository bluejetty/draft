#!/usr/bin/env node
// THE GARAGE SLAB ON THE SHEET, AND THE STAIR THAT LANDS ON IT.
//
// Movie, 16 Oct, two reports off the SECTIONS sheet of his two-storey detached
// garage, both about the same four inches of concrete:
//
//   "the slab shows in model space but not on the construction plan layout"
//
//   "the stairs should calculate to land on the slab height under the last
//    step but in notice there is a gap in that last drawing i showed you with
//    the slab.  how come a gap?"
//
// THE FIRST WAS TWO ENVS WITH TWO RULES. MODEL.html answered which foundation
// a garage has from the outline, its BONEYARD master, then PROJECT's section
// table -- which is where the build files the drafter's choice. cut-view-env.js,
// the env Construction Layout paints through, stopped at the master and said
// 'gradebeam' for everything else. The painter's frost-wall floor pass asks for
// 'frostwall'; its grade-beam pass asks for walls raised off the ground, and a
// frost wall is not. So the sheet drew a garage with no floor, and MODEL one
// tab over drew the slab. Proved here before the fix: through MODEL's rule, one
// slab fill on S1 and on S2 of proto/repro-detached-2storey-frostwall.draft;
// through the sheet's, none. The rule is one exported function now
// (cut-view.js garageFoundationKind) and all three envs call it.
//
// THE SECOND WAS THE LEVEL NUMBER STANDING IN FOR THE FLOOR. The slab is drawn
// from garageFloorAt, which FALLS to the overhead door: 8" under the pour at
// the door, 1/8" a foot less going in. The flight was landed on garageSlabTop,
// the level 4"-down answer, so it stopped short of the drawn slab by the
// difference -- 4" at the door, 5/8" where his stair stands. It lands on the
// floor at the point under its last riser now.
//
// AND ONE THE PAINT SHOWED ON THE WAY. Painting one section through both envs,
// the floor band over the garage broke at the stair hole on MODEL's and ran
// unbroken on the sheet's: cut-view-env.js's floor record carried no id, and
// the painter asks `env.floorOpenings(floor.id)`. It carries its id now.
//
//   node proto/garage-slab-sheet-harness.js             check
//   node proto/garage-slab-sheet-harness.js --mutate    break it, prove each break is caught
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const MUTATION_MODE = require('./harness-args.js').mutationMode();
const ROOT = path.join(__dirname, '..');
const { buildEnv, recordingCtx } = require('./harness-env.js');

// Both subjects are evaluated FROM SOURCE TEXT so a mutant can be applied to
// either. The sheet's env module needs the standards and the fen labels the
// page gives it; the stair profile needs the stair modules.
const FILES = { 'cut-view.js': 'cut-view.js', 'cut-view-env.js': 'cut-view-env.js' };
const LOAD_ORDER = ['formatters.js', 'wall-types.js', 'geometry-2d.js',
  'drawing-format.js', 'building-bodies.js', 'areas.js', 'room-standards.js',
  'level-assembly.js', 'build-house.js', 'finish-patterns.js', 'roof-types.js',
  'roof-patterns.js', 'fen-labels.js', 'profile-manager.js',
  'stair-geometry.js', 'stair-section.js', 'fixture-geometry.js', 'fixture-profiles.js',
  'cut-view.js', 'cut-view-env.js'];
function load(mutants = {}) {
  const win = {};
  const sandbox = {
    window: win, console: { ...console, warn() {}, log() {} }, Math, Number, String, Object, Array, JSON, Map, Set,
    isFinite, parseFloat, parseInt,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const file of LOAD_ORDER) {
    let src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    if (mutants[file]) {
      const next = mutants[file](src);
      if (next === src) throw new Error(`mutation of ${file} matched nothing -- it would prove nothing`);
      src = next;
    }
    vm.runInContext(src, sandbox, { filename: file });
  }
  return win;
}

const read = name => JSON.parse(fs.readFileSync(path.join(ROOT, 'proto', name), 'utf8'));
// The two-storey detached garage as Movie drew it (grade beams, the overhead
// doors on the z = -15 wall, the stair over the garage running along x at
// z = 12 1/3), and the same garage on a frost wall named only in PROJECT's
// table -- the drawing that showed no slab on the sheet.
const GRADEBEAM = read('repro-movie-detached-2storey.draft');
const FROSTWALL = read('repro-detached-2storey-frostwall.draft');
const S1 = { id: 901, name: 'S1', startPt: { x: -18, z: 0 }, endPt: { x: 18, z: 0 }, dirVec: { x: 0, z: 1 }, elev: 0, levelId: 3 };
const S2 = { id: 902, name: 'S2', startPt: { x: 0, z: -21 }, endPt: { x: 0, z: 21 }, dirVec: { x: 1, z: 0 }, elev: 0, levelId: 3 };
// Along the stair, so the cut runs WITH the flight and the whole profile draws.
const STAIR_Z = GRADEBEAM.stairs[0].start.z;
const S_STAIR = { id: 903, name: 'S3', startPt: { x: -18, z: STAIR_Z }, endPt: { x: 18, z: STAIR_Z }, dirVec: { x: 0, z: 1 }, elev: 0, levelId: 3 };

const CONCRETE = 'rgba(150,150,155,0.35)';   // weight(C.concrete, 0.35): a slab in section
const ASSEMBLY = 'rgba(89,128,166,0.15)';    // the floor assembly band
const PX_PER_FT = 48;
const ftIn = v => `${Math.floor(Math.abs(v))}'-${((Math.abs(v) % 1) * 12).toFixed(2)}"`;

function paint(win, env, cut) {
  const rec = recordingCtx();
  win.DraftCutView.drawCutView(env, rec.ctx, 1800, 1000, cut, { pxPerFt: PX_PER_FT });
  return rec;
}
const slabFills = rec => rec.fills.filter(f => f.ink === CONCRETE && f.pts);
const sheetEnv = (win, saved) => win.DraftCutViewEnv.buildCutViewEnv(saved, win.DraftDrawingFormat.levels(saved.levels));

// y of a simple band polygon's TOP at x: the smaller of its two edge crossings.
function topYAt(poly, x) {
  const pts = poly.filter(p => !p.close);
  let best = Infinity;
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    if ((a.x <= x && x <= b.x) || (b.x <= x && x <= a.x)) {
      if (Math.abs(b.x - a.x) < 1e-9) { best = Math.min(best, a.y, b.y); continue; }
      best = Math.min(best, a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x));
    }
  }
  return best;
}
// The flight's own polygon: the stringer outline, 1.25 wide in the line ink,
// walking every riser -- the stroke with the most corners at that weight.
function flightPolygon(rec) {
  const candidates = rec.strokes.filter(s => Math.abs(s.w - 1.25) < 1e-9 && s.ink === '#1d1f20' && s.pts.length >= 10);
  return candidates.sort((a, b) => b.pts.length - a.pts.length)[0] || null;
}

function run(win) {
  const missed = [];
  const check = (label, ok, detail = '') => {
    if (!ok) missed.push({ label, detail });
    if (!MUTATION_MODE) console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? `   ${detail}` : ''}`);
    return ok;
  };
  const CV = win.DraftCutView;
  if (!CV || !CV.garageFoundationKind || !win.DraftCutViewEnv) {
    missed.push({ label: 'cut-view exports garageFoundationKind and the sheet env loads', detail: 'missing' });
    return missed;
  }

  // ── THE RULE, ASKED DIRECTLY ─────────────────────────────────────────
  const K = CV.garageFoundationKind;
  const rows = table => id => table[id] || null;
  check('a detached garage the table calls frostwall is a frost wall',
    K({ detached: true }, { sectionRow: rows({ detachedGarage: { garageFoundation: 'frostwall' } }) }) === 'frostwall');
  check('an attached garage the table calls frostwall is a frost wall',
    K({ detached: false }, { sectionRow: rows({ attachedGarage: { garageFoundation: 'frostwall' } }) }) === 'frostwall');
  check('a detached garage the table calls thickened is a monolithic slab',
    K({ detached: true }, { sectionRow: rows({ detachedGarage: { garageFoundation: 'thickened' } }) }) === 'thickened');
  check('an ATTACHED garage cannot be thickened: it takes a grade beam',
    K({ detached: false }, { sectionRow: rows({ attachedGarage: { garageFoundation: 'thickened' } }) }) === 'gradebeam');
  check('the outline\'s own answer beats the table',
    K({ detached: true, foundation: 'gradebeam' }, { sectionRow: rows({ detachedGarage: { garageFoundation: 'frostwall' } }) }) === 'gradebeam');
  check('the master\'s answer beats the table',
    K({ masterId: 'm' }, { master: { id: 'm', foundation: 'frostwall' }, sectionRow: rows({ attachedGarage: { garageFoundation: 'thickened' } }) }) === 'frostwall');
  check('a garage is detached when its MASTER says so',
    K({ masterId: 'm' }, { master: { id: 'm', detached: true }, sectionRow: rows({ detachedGarage: { garageFoundation: 'thickened' } }) }) === 'thickened');
  check('nothing said anywhere is a grade beam', K({}, {}) === 'gradebeam' && K({ detached: true }) === 'gradebeam');

  // ── THE SHEET'S ENV ANSWERS WHAT MODEL ANSWERS, AND PAINTS THE SLAB ──
  for (const [name, saved, want] of [['frostwall', FROSTWALL, 'frostwall'], ['gradebeam', GRADEBEAM, 'gradebeam']]) {
    const sheet = sheetEnv(win, saved);
    const bench = buildEnv(win, saved);
    const garage = sheet.garageOutlines(3)[0];
    check(`${name}: the sheet's env knows the garage's foundation`, sheet.garageFoundation(garage) === want,
      `sheet says ${sheet.garageFoundation(garage)}`);
    check(`${name}: the bench's env agrees`, bench.garageFoundation(bench.garageOutlines(3)[0]) === want);
    for (const cut of [S1, S2]) {
      const onSheet = slabFills(paint(win, sheet, cut));
      const onBench = slabFills(paint(win, bench, cut));
      check(`${name} ${cut.name}: the sheet draws the garage slab`, onSheet.length >= 1, `${onSheet.length} slab fills`);
      check(`${name} ${cut.name}: the sheet's slab is MODEL's slab, point for point`,
        JSON.stringify(onSheet.map(f => f.pts)) === JSON.stringify(onBench.map(f => f.pts)),
        `${onSheet.length} vs ${onBench.length} fills`);
    }
  }

  // ── THE FLOOR KEEPS ITS ID, SO THE BAND BREAKS AT THE STAIR HOLE ─────
  {
    const sheet = sheetEnv(win, GRADEBEAM);
    const ids = sheet.floors().map(f => f.id);
    check('the sheet\'s floors carry their ids', ids.length === GRADEBEAM.floors.length
      && GRADEBEAM.floors.every(f => ids.includes(String(f.id))), ids.join(','));
    const bands = paint(win, sheet, S2).fills.filter(f => f.ink === ASSEMBLY);
    const benchBands = paint(win, buildEnv(win, GRADEBEAM), S2).fills.filter(f => f.ink === ASSEMBLY);
    check('S2: the floor band over the garage breaks at the stair opening on the sheet',
      bands.length === 2 && bands.length === benchBands.length, `${bands.length} band fills (bench ${benchBands.length})`);
  }

  // ── THE FLIGHT LANDS ON THE SLAB UNDER ITS LAST RISER ────────────────
  for (const [name, saved] of [['gradebeam', GRADEBEAM], ['frostwall', FROSTWALL]]) {
    const env = sheetEnv(win, saved);
    const stack = CV.sectionLevelStack(env);
    const garage = env.garageOutlines(3)[0];
    const stair = saved.stairs[0];
    const foot = { x: Math.max(stair.start.x, stair.end.x), z: stair.start.z };
    const level = CV.garageSlabTop(env, stack.foundation, garage);
    const there = CV.garageFloorAt(env, stack.foundation, garage, foot);
    // The fixture has to put the fall under the stair, or the check below
    // could not tell the level answer from the right one.
    check(`${name}: the slab has fallen under the stair (the fixture asks the question)`,
      Math.abs(there - level) > 0.02, `level ${ftIn(level)} there ${ftIn(there)}`);
    const rec = paint(win, env, S_STAIR);
    const flight = flightPolygon(rec);
    const slab = slabFills(rec)[0];
    if (!check(`${name}: the cut along the stair draws the flight and the slab`, !!flight && !!slab)) continue;
    const bottom = flight.pts.reduce((best, p) => (p.y > best.y ? p : best), flight.pts[0]);
    const slabTop = topYAt(slab.pts, bottom.x);
    const gapIn = Math.abs(bottom.y - slabTop) / PX_PER_FT * 12;
    check(`${name}: the last riser lands on the slab drawn under it (no gap)`,
      Number.isFinite(slabTop) && gapIn <= 1 / 16, `gap ${gapIn.toFixed(3)}" at x=${(bottom.x / PX_PER_FT).toFixed(2)}px/ft`);
  }
  return missed;
}

const baseline = run(load());
if (!MUTATION_MODE) {
  const total = baseline.length;
  console.log(`\n${total ? `${total} FAILED` : 'all checks passed'}`);
  process.exit(total ? 1 : 0);
}

// ── THE MUTATIONS ───────────────────────────────────────────────────────
// Each row names the file it bends: both subjects are mutable here.
const MUTATIONS = [
  ['the rule never asks the section table (the sheet\'s old answer)', 'cut-view.js',
    s => s.replace("    const cell = sectionRow(row)?.garageFoundation;", '    const cell = null;')],
  ['an attached garage takes the table\'s thickened slab', 'cut-view.js',
    s => s.replace("    if (cell === 'thickened' && detached) return 'thickened';", "    if (cell === 'thickened') return 'thickened';")],
  ['the outline\'s own answer is ignored for the table\'s', 'cut-view.js',
    s => s.replace("    if (stored === 'thickened' || stored === 'frostwall' || stored === 'gradebeam') return stored;\n", '')],
  ['a garage is detached only when the outline says so, never its master', 'cut-view.js',
    s => s.replace('    const detached = garage?.detached === true || master?.detached === true;', '    const detached = garage?.detached === true;')],
  ['the sheet\'s env keeps its own rule (outline, master, else gradebeam)', 'cut-view-env.js',
    s => s.replace(`      garageFoundation: garage => window.DraftCutView.garageFoundationKind(garage, {
        master: masters.find(master => master.id === garage?.masterId) || null,
        sectionRow: rowId => saved.sectionTable?.rows?.[rowId] ?? null,
      }),`, `      garageFoundation: garage => {
        const mode = garage?.foundation
          || masters.find(master => master.id === garage?.masterId)?.foundation;
        return mode === 'thickened' ? 'thickened' : 'gradebeam';
      },`)],
  ['the sheet\'s floor record drops its id again', 'cut-view-env.js',
    s => s.replace("        id: String(floor?.id || ''),\n        points,\n        levelId: Number(floor.levelId),", '        points,\n        levelId: Number(floor.levelId),')],
  ['the flight lands on the slab\'s level number again (the gap)', 'cut-view.js',
    s => s.replace(`        ? garageFloorAt(env, stack.foundation, garageUnder,
          footOf(top.floorTop - garageSlabTop(env, stack.foundation, garageUnder)))`,
    '        ? garageSlabTop(env, stack.foundation, garageUnder)')],
  ['the flight lands on the top of the concrete, 4" above the slab', 'cut-view.js',
    s => s.replace(`        ? garageFloorAt(env, stack.foundation, garageUnder,
          footOf(top.floorTop - garageSlabTop(env, stack.foundation, garageUnder)))`,
    '        ? garageConcreteTop(env, stack.foundation, garageUnder)')],
];

console.log('\n' + 'mutation'.padEnd(72) + 'caught by');
let survivors = 0, broken = 0;
for (const [label, file, mutate] of MUTATIONS) {
  let by;
  try {
    const m = run(load({ [FILES[file]]: mutate }));
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
