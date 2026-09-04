// THE SECTION TABLE'S RULES, MEASURED IN NODE.
//
// project-page.js holds the PROJECT page's section table: a row per build
// type, a column per measured item, the office defaults for each type, and
// the pure geometry of the typical wall section. Until this file, none of it
// had a check that could come out wrong. BILEVEL's WOOD FILL cell sat hatched
// for days -- the code said a bilevel has no fill wall, Movie said on 4 Sep
// that it does -- and nothing in the repo could have noticed, because the
// only reader of that table was a person looking at the page and seeing
// numbers that seemed right.
//
// Three kinds of check here, in the order a defect would arrive:
//
//   STRUCTURAL  every item's `types` entry is a real row id, every default's
//               key is a real item field, ids are unique. A typo in either
//               shows on the page as an EMPTY CELL, never an error -- the
//               same absence-that-reads-as-a-pass shape as the hatched
//               bilevel, so these are the checks worth the most per line.
//   RULES       what the table says about building: which types get which
//               items, what a split's default is, and the stud arithmetic.
//               The kerf is pinned as a RELATIONSHIP (an 8' precut less one
//               1/8" blade, halved), not as 46.25 -- a check against the
//               literal passes with the value hardcoded.
//   GEOMETRY    buildWallSection with one fixed assembly: the anchors the
//               page parks its inputs on all exist, the foundation top sits
//               one floor depth below MAIN FL 0, the heel at the wall face
//               is the same number roofHeelIn reports.
//
// PINS THE 4 SEP RULE, NOT MAIN AS IT STOOD. WOOD FILL HT belongs to all
// three split rows (Gilligan's fce138d). On a main that still hatches the
// bilevel cell this harness is RED -- correctly, because that main is
// wrong. It goes green when that commit merges, and red again if anyone
// puts the old list back.
//
// What this cannot reach: BSMT CLG HT is derived in PROJECT.html, not here
// (fdn wall + sill + wood fill where the type has one, less the slab). The
// pieces it is built from are pinned below; the formula itself is the page's
// until it moves into the module.
//
//   node proto/section-table-harness.js
//   node proto/section-table-harness.js --mutate    break it on purpose, prove each break is caught
const fs = require('fs');
const path = require('path');

const MUTATION_MODE = require('./harness-args.js').mutationMode();
const SRC = path.join(__dirname, '..', 'project-page.js');

function load(mutate) {
  let src = fs.readFileSync(SRC, 'utf8');
  if (mutate) {
    const next = mutate(src);
    if (next === src) throw new Error('mutation matched nothing -- it would prove nothing');
    src = next;
  }
  const window = {};
  new Function('window', src)(window);
  return window.DraftProjectPage;
}

const CHECKS = [];
const check = (label, fn) => CHECKS.push({ label, fn });
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── Structural ─────────────────────────────────────────────────────────
check('row ids are unique', P => {
  const ids = P.SECTION_TABLE_ROWS.map(r => r.id);
  return [new Set(ids).size, ids.length];
});
check('item ids are unique', P => {
  const ids = P.SECTION_TABLE_ITEMS.map(i => i.id);
  return [new Set(ids).size, ids.length];
});
check('zone ids are unique', P => {
  const ids = P.ZONE_ROWS.map(z => z.id);
  return [new Set(ids).size, ids.length];
});
check('every item types entry is a real row id', P => {
  const rows = new Set(P.SECTION_TABLE_ROWS.map(r => r.id));
  const bad = P.SECTION_TABLE_ITEMS.flatMap(i => i.types.filter(t => !rows.has(t)).map(t => `${i.id}:${t}`));
  return [bad.join(','), ''];
});
check('every default is keyed by a real row id', P => {
  const rows = new Set(P.SECTION_TABLE_ROWS.map(r => r.id));
  return [Object.keys(P.SECTION_TABLE_DEFAULTS).filter(k => !rows.has(k)).join(','), ''];
});
check('every default field is a real item field', P => {
  const fields = new Set(P.SECTION_TABLE_ITEMS.map(i => i.field).filter(Boolean));
  const bad = Object.entries(P.SECTION_TABLE_DEFAULTS)
    .flatMap(([row, d]) => Object.keys(d).filter(f => !fields.has(f)).map(f => `${row}:${f}`));
  return [bad.join(','), ''];
});
check('a derived item has no field, every other item has one', P => {
  const bad = P.SECTION_TABLE_ITEMS
    .filter(i => (i.unit === 'derived') !== (i.field === null)).map(i => i.id);
  return [bad.join(','), ''];
});
check('exactly one row is live, and it is HOUSE', P => {
  return [P.SECTION_TABLE_ROWS.filter(r => r.live).map(r => r.id).join(','), 'house'];
});
check('every zone id is also a section-table row', P => {
  const rows = new Set(P.SECTION_TABLE_ROWS.map(r => r.id));
  return [P.ZONE_ROWS.filter(z => !rows.has(z.id)).map(z => z.id).join(','), ''];
});

// ── Rules ──────────────────────────────────────────────────────────────
const itemById = (P, id) => P.SECTION_TABLE_ITEMS.find(i => i.id === id);
const SPLIT_FAMILY = ['split', 'bilevel', 'modifiedBilevel'];
const GARAGES = ['attachedGarage', 'detachedGarage'];

// Movie, 4 Sep: a SPLIT is the family name for BILEVEL and MODIFIED BILEVEL,
// and all three pour the same 5'-0" wall with wood above it.
check('WOOD FILL HT belongs to exactly the split family', P =>
  [same([...itemById(P, 'woodFill').types].sort(), [...SPLIT_FAMILY].sort()), true]);
check('the three split rows share one default, by value', P => {
  const d = P.SECTION_TABLE_DEFAULTS;
  return [same(d.split, d.bilevel) && same(d.bilevel, d.modifiedBilevel), true];
});
check('the split default pours a 5\'-0" wall', P => [P.SECTION_TABLE_DEFAULTS.split.fdnWallHeightFt, 5]);
check('the split fill wall is the half stud plus the plate stack', P =>
  [near(P.SECTION_TABLE_DEFAULTS.split.woodFillHeightFt, (P.HALF_STUD_IN + P.PLATE_STACK_IN) / 12), true]);

// The kerf is a contract, not a number: an 8' precut sawn in two loses one
// 1/8" blade, so each half is 46 1/4", not 46 5/16".
check('HALF_STUD_IN is the shortest precut less one 1/8" kerf, halved', P =>
  [near(P.HALF_STUD_IN, (P.STUD_LENGTHS_IN[0] - 0.125) / 2), true]);
check('the plate stack is three 1 1/2" plates', P => [P.PLATE_STACK_IN, 4.5]);
check('the sill plate is one 1 1/2" plate', P => [P.SILL_PLATE_IN, 1.5]);
check('precuts step by a foot from 7\'-8 5/8"', P => {
  const s = P.STUD_LENGTHS_IN;
  return [s[0] === 92.625 && s.every((v, i) => i === 0 || near(v - s[i - 1], 12)), true];
});
check('wall height from stud and stud from wall height are inverses on every precut', P =>
  [P.STUD_LENGTHS_IN.every(s => near(P.studInFromWallHeightFt(P.wallHeightFtFromStud(s)), s)), true]);
check('an 8\' precut makes an 8\'-1 1/8" wall', P => [near(P.wallHeightFtFromStud(92.625), 97.125 / 12), true]);
check('the heel is the fascia plus the rise across the overhang', P => [P.roofHeelIn(6, 2, 4), 14]);

// Which items a type has a use for. A garage has no floor joists, no
// sheathing over them, no fill wall and no basement; only HOUSE and the MOD
// BILEVEL have a second storey.
check('the garages offer no joists, sheathing, wood fill or basement ceiling', P => {
  const bad = ['mainJoists', 'mainSheathing', 'upperJoists', 'upperStud', 'woodFill', 'basementClg']
    .flatMap(id => itemById(P, id).types.filter(t => GARAGES.includes(t)).map(t => `${id}:${t}`));
  return [bad.join(','), ''];
});
check('only HOUSE and MOD BILEVEL have a second storey', P =>
  [['upperStud', 'upperJoists'].every(id => same([...itemById(P, id).types].sort(), ['house', 'modifiedBilevel'])), true]);
check('every type has a roof, a main stud, a foundation, a sill, a slab and footings', P => {
  const all = P.SECTION_TABLE_ROWS.map(r => r.id).sort();
  const bad = ['pitch', 'overhang', 'heel', 'mainStud', 'fdnWall', 'sill', 'slab', 'footingWidth', 'footingDepth']
    .filter(id => !same([...itemById(P, id).types].sort(), all));
  return [bad.join(','), ''];
});

// Zone rows: the bilevel pair is reserved until the split feature lands, and
// band 2 of the project page waits on that flipping -- deliberately.
check('the bilevel zone rows are reserved', P =>
  [P.ZONE_ROWS.filter(z => z.reserved).map(z => z.id).sort().join(','), 'bilevel,modifiedBilevel']);
check('the garage zone rows are live', P =>
  [P.ZONE_ROWS.filter(z => !z.reserved).map(z => z.id).sort().join(','), 'attachedGarage,detachedGarage']);
check('the section is cut 4 ft into the wall', P => [P.CUT_DEPTH_FT, 4]);
check('the detached garage beam rides 8" above grade at the house', P => [P.GARAGE_BEAM_ABOVE_GRADE_IN, 8]);

// ── Geometry ───────────────────────────────────────────────────────────
// One fixed two-storey assembly, in the shape the page hands the builder.
const ASSEMBLY = Object.freeze({
  floors: [
    { id: 'main', name: 'MAIN FL', wallHeightFt: 97.125 / 12, joistDepthIn: 11.25, sheathingIn: 0.75 },
    { id: 'upper', name: '2ND FL', wallHeightFt: 97.125 / 12, joistDepthIn: 9.25, sheathingIn: 0.75 },
  ],
  foundation: { wallHeightFt: 8, thicknessIn: 8, slabIn: 4, footingWidthIn: 20, footingDepthIn: 8, gradeOffsetFt: -1 },
  roof: { pitch: 4, overhangFt: 2, fasciaIn: 6 },
  wallThicknessIn: 5.5,
});
const section = P => P.buildWallSection(ASSEMBLY);
const rects = s => s.parts.filter(p => p.kind === 'rect');

check('every editable number has an anchor to park beside', P => {
  const want = ['pitch', 'overhang', 'fascia', 'heel', 'fdnHeight', 'fdnThickness', 'footingWidth',
    'footingDepth', 'slab', 'grade', 'wallType', 'floor-main', 'floor-upper', 'wallHeight-main', 'wallHeight-upper'];
  const have = section(P).anchors;
  return [want.filter(k => !have[k]).join(','), ''];
});
check('the foundation top sits one main-floor depth below MAIN FL 0', P => {
  const fdn = rects(section(P)).find(r => near(r.h, ASSEMBLY.foundation.wallHeightFt));
  return [fdn ? near(fdn.y + fdn.h, -(11.25 + 0.75) / 12) : 'no foundation rect', true];
});
check('the heel at the wall face is the same number roofHeelIn reports', P => {
  const s = section(P);
  const plateY = (97.125 / 12) * 2 + (9.25 + 0.75) / 12;
  const heel = s.parts.find(p => p.kind === 'line' && near(p.x1, 0) && near(p.x2, 0) && near(p.y1, plateY));
  const want = P.roofHeelIn(6, 2, 4) / 12;
  return [heel ? near(heel.y2 - heel.y1, want) : 'no heel line at the plate', true];
});
check('the plate is the two walls plus the floor between them', P => {
  const s = section(P);
  const plateY = (97.125 / 12) * 2 + (9.25 + 0.75) / 12;
  return [near(s.anchors.overhang.y, plateY - 0.55), true];
});
check('the cut breaks at CUT_DEPTH_FT and every part lies inside the extents', P => {
  const s = section(P);
  const brk = s.parts.find(p => p.kind === 'break');
  const e = s.extents;
  // Kind-agnostic on purpose: a part is tested on whatever coordinates it
  // carries, so a new kind (the grade line arrived with only a y) is checked
  // rather than misread as outside. A check that enumerates kinds is a
  // snapshot of the painter on the day it was written.
  const xs = p => [p.x, p.x1, p.x2, p.x != null && p.w != null ? p.x + p.w : undefined].filter(Number.isFinite);
  const ys = p => [p.y, p.y1, p.y2, p.y != null && p.h != null ? p.y + p.h : undefined].filter(Number.isFinite);
  const inside = s.parts.every(p =>
    xs(p).every(x => x >= e.minX && x <= e.maxX) && ys(p).every(y => y >= e.minY && y <= e.maxY));
  return [brk && near(brk.x, P.CUT_DEPTH_FT) && inside, true];
});
check('the footing is centred under the foundation wall', P => {
  const s = section(P);
  const fdnFt = 8 / 12, footW = 20 / 12;
  const foot = rects(s).find(r => near(r.w, footW));
  return [foot ? near(foot.x, fdnFt / 2 - footW / 2) : 'no footing rect', true];
});
check('grade is measured from the top of the foundation wall', P => {
  const s = section(P);
  const fdnTop = -(11.25 + 0.75) / 12;
  return [near(s.anchors.grade.y, fdnTop + ASSEMBLY.foundation.gradeOffsetFt - 0.55), true];
});

// ── Run ────────────────────────────────────────────────────────────────
function run(P) {
  const missed = [];
  for (const { label, fn } of CHECKS) {
    let got, want;
    try { [got, want] = fn(P); } catch (err) { got = `threw ${err.message}`; want = null; }
    if (got !== want) missed.push({ label, got, want });
  }
  return missed;
}

const baseline = run(load(null));
for (const m of baseline) console.log(`  FAIL ${m.label}\n       got ${JSON.stringify(m.got)}, want ${JSON.stringify(m.want)}`);
console.log(`\n${CHECKS.length - baseline.length}/${CHECKS.length} checks passed`);

// ── Mutations ──────────────────────────────────────────────────────────
// Each one is a mistake somebody could plausibly make in that file, and each
// would reach the page as a wrong number or an empty cell, never an error.
// Anchors are counted before trusting them: a replace that matches the WRONG
// occurrence mutates a different line and survives, reporting a gap that is
// not there (the geometry-2d.js lesson, 4 Sep).
const MUTATIONS = [
  ['BILEVEL loses its wood fill again',
    s => s.replace("const SPLIT_TYPES = ['split', 'bilevel', 'modifiedBilevel'];", "const SPLIT_TYPES = ['split', 'modifiedBilevel'];")],
  ['the split pours a 6\' wall',
    s => s.replace('fdnWallHeightFt: 5,', 'fdnWallHeightFt: 6,')],
  ['the kerf is forgotten (46 5/16")',
    s => s.replace('const HALF_STUD_IN = 46.25;', 'const HALF_STUD_IN = 46.3125;')],
  ['the plate stack loses a plate',
    s => s.replace('const PLATE_STACK_IN = 1.5 * 3;', 'const PLATE_STACK_IN = 1.5 * 2;')],
  ['the garages get floor joists',
    s => s.replace("item('mainJoists', 'MAIN FL JOISTS', 'in', 'mainJoistDepthIn', HOUSE_LIKE)", "item('mainJoists', 'MAIN FL JOISTS', 'in', 'mainJoistDepthIn', ALL_TYPES)")],
  ['a default is keyed by a misspelt field (an empty cell on the page)',
    s => s.replace('woodFillHeightFt: (HALF_STUD_IN + PLATE_STACK_IN) / 12,', 'woodFillHeight: (HALF_STUD_IN + PLATE_STACK_IN) / 12,')],
  ['a types entry is misspelt (a hatched cell on the page)',
    s => s.replace("const SPLIT_TYPES = ['split', 'bilevel', 'modifiedBilevel'];", "const SPLIT_TYPES = ['split', 'bilevl', 'modifiedBilevel'];")],
  ['the bilevel zone row goes live before the feature does',
    s => s.replace("{ id: 'bilevel', label: 'BILEVEL', reserved: true }", "{ id: 'bilevel', label: 'BILEVEL', reserved: false }")],
  ['the roof rises at pitch per foot instead of pitch per twelve',
    s => s.replace('const riseAt = x => fasciaFt + (roof.overhangFt + x) * (roof.pitch / 12);', 'const riseAt = x => fasciaFt + (roof.overhangFt + x) * roof.pitch;')],
  ['the foundation forgets the floor it carries',
    s => s.replace('const fdnTop = -mainDepthFt;', 'const fdnTop = 0;')],
  ['the heel forgets the overhang',
    s => s.replace('const roofHeelIn = (fasciaIn, overhangFt, pitch) => fasciaIn + overhangFt * pitch;', 'const roofHeelIn = (fasciaIn, overhangFt, pitch) => fasciaIn;')],
  ['stud from wall height forgets the plates',
    s => s.replace('const studInFromWallHeightFt = wallHeightFt => wallHeightFt * 12 - PLATE_STACK_IN;', 'const studInFromWallHeightFt = wallHeightFt => wallHeightFt * 12;')],
  // Caught by the shared-default rule, not by a count of who has defaults:
  // a garage growing a default of its own is legitimate and must not read
  // as a failure here.
  ['the mod bilevel loses its default (falls back to the house)',
    s => s.replace('    modifiedBilevel: SPLIT_BASE,\n', '')],
  ['the footing is hung off the wall face instead of centred',
    s => s.replace('rect(fdnFt / 2 - footW / 2, fdnBot - footD, footW, footD, 1.5);', 'rect(0, fdnBot - footD, footW, footD, 1.5);')],
];

if (MUTATION_MODE) {
  // TWO THINGS THIS LOOP REFUSES TO CALL A PASS: a mutation that will not
  // apply is not a caught mutation, and an empty list is not a clean sweep.
  // Shape shared with outline-accessors, wall-joins and merge-vertex.
  console.log('\n' + 'mutation'.padEnd(68) + 'caught by');
  let survivors = 0;
  let broken = 0;
  for (const [label, mutate] of MUTATIONS) {
    let missed, by;
    try {
      missed = run(load(mutate));
      if (!missed.length) survivors += 1;
      by = missed.length ? missed.map(m => m.label).join('\n' + ' '.repeat(68)) : '*** NOTHING ***';
    } catch (err) {
      broken += 1;
      by = `!!! MUTATION DID NOT APPLY: ${err.message}`;
    }
    console.log(`${label.padEnd(68)}${by}`);
  }
  console.log(`\n${MUTATIONS.length - survivors - broken}/${MUTATIONS.length} mutations caught`);
  if (broken) console.log(`${broken} mutation(s) never applied -- they prove nothing`);
  if (!MUTATIONS.length) console.log('NO MUTATIONS DEFINED -- this table proves nothing');
  process.exit(baseline.length || survivors || broken || !MUTATIONS.length ? 1 : 0);
}

process.exit(baseline.length ? 1 : 0);
