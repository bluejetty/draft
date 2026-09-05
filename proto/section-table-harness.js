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
//               page parks its inputs on all exist, the floor bears on a sill
//               one floor package below MAIN FL 0 with the concrete one sill
//               below that, the roof stands the reported heel above the plate
//               at the wall face, and the heel web meets both chords.
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
// TWO, not three. The SPLIT row went on 5 Sep (Movie's option A): the family
// name is not a build anybody makes, so no build type could select its row and
// anything stored under it was unread by construction. SPLIT_BASE survives as
// what it always was -- the defaults these two start from.
const SPLIT_FAMILY = ['bilevel', 'modifiedBilevel'];
const GARAGES = ['attachedGarage', 'detachedGarage'];

// Movie, 4 Sep: a SPLIT is the family name for BILEVEL and MODIFIED BILEVEL,
// and all three pour the same 5'-0" wall with wood above it.
check('WOOD FILL HT belongs to exactly the split family', P =>
  [same([...itemById(P, 'woodFill').types].sort(), [...SPLIT_FAMILY].sort()), true]);
check('the two split rows share one default, by value', P => {
  const d = P.SECTION_TABLE_DEFAULTS;
  return [same(d.bilevel, d.modifiedBilevel), true];
});
// The family name must not come back as a row. A default keyed by it would be
// storage nothing can select, which is the state option A removed.
check('SPLIT is a defaults holder, not a row and not a stored type', P => {
  const rows = P.SECTION_TABLE_ROWS.map(r => r.id);
  return [!rows.includes('split') && P.SECTION_TABLE_DEFAULTS.split === undefined, true];
});
check('the split default pours a 5\'-0" wall', P => [P.SECTION_TABLE_DEFAULTS.bilevel.fdnWallHeightFt, 5]);
// Movie, 4 and 5 Sep: the bungalow frames 8'-1 1/8" and the split frames
// 9'-1 1/8" -- main floor and the storey over the garage alike. Pinned as THE
// PRECUT ONE STEP UP rather than as 9.09375, because that is the claim: a
// stock stud, not a height that merely happens to be right today. A literal
// would still pass with the plate stack broken underneath it.
check('the split frames the precut one step above the bungalow', P =>
  [near(P.SECTION_TABLE_DEFAULTS.bilevel.mainWallHeightFt,
    P.wallHeightFtFromStud(P.STUD_LENGTHS_IN[1])), true]);
check('the storey over the garage frames the same wall as the floor below', P =>
  [near(P.SECTION_TABLE_DEFAULTS.modifiedBilevel.upperWallHeightFt,
    P.SECTION_TABLE_DEFAULTS.modifiedBilevel.mainWallHeightFt), true]);
// The inequality beside them: the split's wall must NOT be the house's, which
// is the failure it was written to close. Two equalities agreeing about a
// number they both inherit would prove nothing.
check('the split wall is a foot clear of the bungalow it fell back to', P =>
  [near(P.SECTION_TABLE_DEFAULTS.bilevel.mainWallHeightFt
    - P.wallHeightFtFromStud(P.STUD_LENGTHS_IN[0]), 1), true]);
check('the split fill wall is the half stud plus the plate stack', P =>
  [near(P.SECTION_TABLE_DEFAULTS.bilevel.woodFillHeightFt, (P.HALF_STUD_IN + P.PLATE_STACK_IN) / 12), true]);

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
// Movie, 5 Sep: the fascia is a 2x6 with its BOTTOM level with the top of the
// top plate, so the heel is 5 1/2" plus what the roof climbs across the
// overhang -- 13 1/2" at the office default of 4:12 over 2 ft.
// THE BAND MUST NOT ARGUE WITH THE ARITHMETIC BEHIND IT. Movie's ceiling
// exists to catch a typo, and the heel is DERIVED, so the ceiling has to
// clear the largest heel the drawing can compute or it would refuse a number
// the app itself produced. The caps are drawing-format.js's (overhang <= 6',
// pitch <= 24:12) -- named here as literals on purpose, because that is the
// contract this file cannot see and the one that breaks silently if it moves.
check('the ceiling clears the steepest, deepest roof the drawing allows', P =>
  [P.ROOF_HEEL_MAX_IN > P.roofHeelIn(5.5, 6, 24), true]);
// The floor is an office rule ABOVE the real one: 3 1/2" is buildable and the
// office will not draw it. Pinned as an inequality so nobody "corrects" ours
// back down to the physical minimum.
check('the floor sits above the 3 1/2" the trusses would actually do', P =>
  [P.ROOF_HEEL_MIN_IN > 3.5 && P.roofHeelInBand(P.ROOF_HEEL_MIN_IN), true]);
check('the office default heel is inside its own band', P =>
  [P.roofHeelInBand(P.roofHeelIn(5.5, 2, 4)), true]);
check('the heel is the fascia plus the rise across the overhang', P => [P.roofHeelIn(5.5, 2, 4), 13.5]);

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
check('the detached garage beam rides 8" above grade at the house', P => [P.DETACHED_BEAM_ABOVE_GRADE_IN, 8]);

// ── Geometry ───────────────────────────────────────────────────────────
// One fixed two-storey assembly, in the shape the page hands the builder.
// The main floor is the office package from Movie's reference section:
// 11 7/8" I-joist + 3/4" sheathing = 1'-5/8", under an 8' precut wall.
const ASSEMBLY = Object.freeze({
  floors: [
    { id: 'main', name: 'MAIN FL', wallHeightFt: 97.125 / 12, joistDepthIn: 11.875, sheathingIn: 0.75 },
    { id: 'upper', name: '2ND FL', wallHeightFt: 97.125 / 12, joistDepthIn: 9.25, sheathingIn: 0.75 },
  ],
  foundation: { wallHeightFt: 8, thicknessIn: 8, slabIn: 4, footingWidthIn: 20, footingDepthIn: 8, gradeOffsetFt: -1 },
  roof: { pitch: 4, overhangFt: 2, fasciaIn: 5.5 },
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
// The main floor bears on the SILL, and the sill on the concrete. Movie, 4
// Sep: "where is your sill plate?" -- the section had none until #281, and
// this check pinned the concrete top one floor package below zero, which was
// the pre-sill shape. Now both facts are pinned: the sill's top is one floor
// package below MAIN FL 0, and the concrete top is one sill below that.
check('the main floor bears on a sill that sits one floor package below MAIN FL 0', P => {
  const pkg = (11.875 + 0.75) / 12;
  const sill = rects(section(P)).find(r => near(r.h, P.SILL_PLATE_IN / 12) && near(r.w, ASSEMBLY.foundation.thicknessIn / 12));
  return [sill ? near(sill.y + sill.h, -pkg) : 'no sill rect on the foundation', true];
});
check('the concrete top sits one sill below the floor package', P => {
  const fdn = rects(section(P)).find(r => near(r.h, ASSEMBLY.foundation.wallHeightFt));
  return [fdn ? near(fdn.y + fdn.h, -((11.875 + 0.75 + P.SILL_PLATE_IN) / 12)) : 'no foundation rect', true];
});
// THE HEEL, AND THE WEB UNDER IT -- two facts, and this was one check until
// 5 Sep. It looked for a vertical AT the wall face whose length was the heel,
// which is the shape the section had before Movie's correction: that line ran
// the full height of the heel on x = 0, so it drew the outside of the
// building rather than a member, and it went out with 6ebf942. Pinning the
// heel to a line that no longer exists made the check a snapshot of the
// painter, not a statement about the roof -- so the heel is now read off the
// top chord where it crosses the wall, and the member gets a check of its own.
// Three lines leave the eave: the soffit, which stops at the wall, and the
// chord's two faces, which run to the cut. Of the two that reach the cut the
// upper is the top surface. Deliberately NOT located by a height above the
// plate -- a raised heel moves the eave, so a plate-anchored finder reports
// "no top chord" on a drawing that is right, which is the mistake this file
// has now made once.
const chordLines = s => s.parts
  .filter(p => p.kind === 'line' && near(p.x1, -ASSEMBLY.roof.overhangFt) && near(p.x2, CUT))
  .sort((a, b) => b.y1 - a.y1);
const topChordFace = s => chordLines(s)[0];
const topChordUnder = s => chordLines(s)[1];
const CUT = 4;
const atX = (l, x) => l.y1 + (x - l.x1) * (l.y2 - l.y1) / (l.x2 - l.x1);

check('the roof stands the reported heel above the plate at the wall face', P => {
  const plateY = (97.125 / 12) * 2 + (9.25 + 0.75) / 12;
  const chord = topChordFace(section(P));
  const R = ASSEMBLY.roof;
  const want = P.roofHeelIn(R.fasciaIn, R.overhangFt, R.pitch) / 12;
  return [chord ? near(atX(chord, 0) - plateY, want) : 'no top chord', true];
});
// Movie, 4 Sep: "the purple line thats the 3 1/2\" from the outside to connect
// the top and bottom chords". A 2x4 standing at the wall with its outer face
// flush with the outside, so what shows in section is its INNER face. Pinned
// by WHERE IT LANDS -- top of the bottom chord up to the underside of the top
// chord -- and not by a length, because the length grows with the pitch and a
// number here would only be true at 4:12.
check('the heel web stands 3 1/2\" in and meets both chords', P => {
  const s = section(P);
  const plateY = (97.125 / 12) * 2 + (9.25 + 0.75) / 12;
  const chordFt = P.ROOF_CHORD_IN / 12;
  const webs = s.parts.filter(p => p.kind === 'line' && near(p.x1, chordFt) && near(p.x2, chordFt));
  const under = topChordUnder(s);
  if (webs.length !== 1) return [`${webs.length} verticals 3 1/2" in from the outside`, 'exactly one'];
  if (!under) return ['no top chord underside to meet', 'exactly one'];
  return [near(webs[0].y1, plateY + chordFt) && near(webs[0].y2, atX(under, chordFt)), true];
});
// THE OVERRIDE, WITH THE CONTROL THAT MUST MOVE BESIDE IT. Movie, 5 Sep:
// the heel is calculated, and typeable. A check that only proved the derived
// case still draws would pass on a build that ignored the override entirely,
// so the two are asserted together: null draws the calculation, and a number
// lifts the eave off the plate by exactly the difference -- a raised heel,
// not a fatter fascia.
check('a null heel draws the calculation, and a raised heel lifts the eave', P => {
  const R = ASSEMBLY.roof;
  const plateY = (97.125 / 12) * 2 + (9.25 + 0.75) / 12;
  const derived = P.roofHeelIn(R.fasciaIn, R.overhangFt, R.pitch);
  const eaveY = a => {
    const chord = topChordFace(P.buildWallSection({ ...ASSEMBLY, roof: { ...R, heelIn: a } }));
    return chord ? chord.y1 - R.fasciaIn / 12 : NaN;
  };
  const flat = eaveY(null);
  const raised = eaveY(derived + 6);
  return [near(flat, plateY) && near(raised - flat, 0.5), true];
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
  const fdnTop = -(11.875 + 0.75) / 12;
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
    s => s.replace("const SPLIT_TYPES = Object.freeze(['bilevel', 'modifiedBilevel']);", "const SPLIT_TYPES = Object.freeze(['modifiedBilevel']);")],
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
    s => s.replace("const SPLIT_TYPES = Object.freeze(['bilevel', 'modifiedBilevel']);", "const SPLIT_TYPES = Object.freeze(['bilevl', 'modifiedBilevel']);")],
  ['the bilevel zone row goes live before the feature does',
    s => s.replace("{ id: 'bilevel', label: 'BILEVEL', reserved: true }", "{ id: 'bilevel', label: 'BILEVEL', reserved: false }")],
  ['the roof rises at pitch per foot instead of pitch per twelve',
    s => s.replace('(roof.overhangFt + x) * (roof.pitch / 12);', '(roof.overhangFt + x) * roof.pitch;')],
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
  ['the heel web goes back on the wall face (the line Movie struck out)',
    s => s.replace('line(ROOF_CHORD_IN / 12, plateY + ROOF_CHORD_IN / 12,\n      ROOF_CHORD_IN / 12, plateY + riseAt(ROOF_CHORD_IN / 12) - chordDropFt, 1);',
      'line(0, plateY + ROOF_CHORD_IN / 12,\n      0, plateY + riseAt(0) - chordDropFt, 1);')],
  // The flat-drop mistake the module's own comment warns about, made on the
  // web instead of the chord: it stops short of the top chord's underside by
  // an amount that is zero at 0:12 and grows with the pitch.
  ['the heel web is dropped a flat 3 1/2" and stops short of the top chord',
    s => s.replace('ROOF_CHORD_IN / 12, plateY + riseAt(ROOF_CHORD_IN / 12) - chordDropFt, 1);',
      'ROOF_CHORD_IN / 12, plateY + riseAt(ROOF_CHORD_IN / 12) - ROOF_CHORD_IN / 12, 1);')],
  ['a raised heel is ignored and the roof stays on the plate',
    s => s.replace('const heelLiftFt = roof.heelIn == null ? 0', 'const heelLiftFt = true ? 0')],
  // The plausible misreading of "raise the heel": deepen the board instead of
  // lifting the roof. It puts the top chord in the right place and leaves the
  // soffit sitting on the plate, so only a check that watches the EAVE sees it.
  ['a raised heel fattens the fascia instead of lifting the roof',
    s => s.replace('const eaveY = plateY + heelLiftFt;', 'const eaveY = plateY;')],
  ['the ceiling drops back to something a big overhang can derive past',
    s => s.replace('const ROOF_HEEL_MAX_IN = 20 * 12;', 'const ROOF_HEEL_MAX_IN = 48;')],
  ['the floor is "corrected" to the real-world 3 1/2" minimum',
    s => s.replace('const ROOF_HEEL_MIN_IN = 5.5;', 'const ROOF_HEEL_MIN_IN = 3.5;')],
  ['the band is checked exclusively, so its own endpoints fall outside it',
    s => s.replace('inches >= ROOF_HEEL_MIN_IN && inches <= ROOF_HEEL_MAX_IN', 'inches > ROOF_HEEL_MIN_IN && inches < ROOF_HEEL_MAX_IN')],
  ['the split falls back to the bungalow wall again',
    s => s.replace('const SPLIT_WALL_FT = wallHeightFtFromStud(STUD_LENGTHS_IN[1]);', 'const SPLIT_WALL_FT = wallHeightFtFromStud(STUD_LENGTHS_IN[0]);')],
  ['the storey over the garage loses its default',
    s => s.replace('    upperWallHeightFt: SPLIT_WALL_FT,\n', '')],
  // Option A undone two ways, because the row and its default are separate
  // lines and putting back either one alone re-creates storage nothing can
  // select.
  ['the SPLIT row comes back',
    s => s.replace("    Object.freeze({ id: 'house', label: 'HOUSE', live: true }),",
      "    Object.freeze({ id: 'house', label: 'HOUSE', live: true }),\n    Object.freeze({ id: 'split', label: 'SPLIT', live: false }),")],
  ['a default comes back keyed by the family name',
    s => s.replace('  const SECTION_TABLE_DEFAULTS = Object.freeze({',
      '  const SECTION_TABLE_DEFAULTS = Object.freeze({\n    split: SPLIT_BASE,')],
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
