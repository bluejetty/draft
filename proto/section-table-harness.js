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

// cut-view.js's own STANDARDS, loaded for real rather than regexed out of the
// source. It reads three globals at module scope and none of them matter for
// the numbers, so three stubs are enough -- and loading it means a rename or a
// restructure over there fails HERE, which a regex would have sailed past.
const CUT_VIEW = (() => {
  const w = {
    DraftFormatters: { formatInchesOnly: () => '', formatFeetInches: () => '' },
    DraftWallTypes: { WALL_TYPES: [] },
    DraftGeometry: { offsetOutline: () => [], polygonArea: () => 0 },
  };
  new Function('window', fs.readFileSync(path.join(__dirname, '..', 'cut-view.js'), 'utf8'))(w);
  return w.DraftCutView.STANDARDS;
})();

function load(mutate) {
  let src = fs.readFileSync(SRC, 'utf8');
  if (mutate) {
    const next = mutate(src);
    if (next === src) throw new Error('mutation matched nothing -- it would prove nothing');
    src = next;
  }
  const window = {};
  // level-assembly.js FIRST, and for real rather than stubbed. project-page.js
  // reads SILL_PLATE_IN off it -- the sill got one home on 7 Sep, because the
  // foundation's wall height is pour + sill and a second copy of the 1 1/2"
  // here would be free to drift from the height derived out of it. The section
  // builder asks for it at CALL time, so a window without the module loads
  // fine and then throws inside buildWallSection; this window is the page's,
  // and on the page the module is always there.
  new Function('window', fs.readFileSync(path.join(__dirname, '..', 'level-assembly.js'), 'utf8'))(window);
  // drawing-format.js FOR REAL too, and for the reason directly above: the
  // roof's fascia and the heel derived from it now have one home there, and
  // project-page.js delegates. A stub would let this harness keep measuring a
  // number the page no longer computes -- the check would pass while the two
  // disagreed, which is the failure this file exists to make impossible.
  new Function('window', fs.readFileSync(path.join(__dirname, '..', 'drawing-format.js'), 'utf8'))(window);
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

// THE GARAGE'S OFFSET IS A SILL, NOT A FLOOR, and it is worth a check because
// the field spent its whole life called floorOffsetFt with a comment saying
// "the floor surface". It never was: the builder does fdnTop = sillY, puts the
// concrete a sill plate below that, and the slab 4" below the concrete. The
// floor is 5 1/2" under the number.
//
// Pinned as the two ends of that gap rather than as one number, because the
// failure this guards against is somebody "correcting" the value to mean what
// the name used to say. Then the sill lands where the slab belongs, the whole
// garage rises 5 1/2", and every part of it still draws in the right order --
// which is exactly the kind of wrong that looks right.
//
// Found by the plate's own 1 1/2", not as the top of everything: the garage
// draws whole now (16 Sep), so its roof stands above the sill and the
// highest rect is a fascia board.
check('the garage offset is the SILL TOP, with the concrete a sill plate under it', P => {
  const rs = P.buildGarageSection(GARAGE).parts.filter(p => p.kind === 'rect');
  const plates = rs.filter(p => near(p.h, P.SILL_PLATE_IN / 12));
  if (plates.length !== 1) return [`${plates.length} sill-plate bands`, 'exactly one'];
  const concrete = rs.some(p => near(p.y + p.h, plates[0].y) && p.h > plates[0].h);
  return [concrete && near(plates[0].y + plates[0].h, GARAGE.garage.sillOffsetFt), true];
});
// THE SLAB IS 5 1/2" DOWN, AND IT IS NOT DRAWN. Both halves are the check,
// because they arrived together: this used to read the slab's own lines at
// x = 0, and on 16 Sep those lines came out of both bands -- the cut runs
// ALONG the beam, so the slab is behind the cut face and its two sloping
// lines landed inside the beam band, which Movie read as strays at the sill
// ("take out those extra lines they were probably slab before").
//
// So the height is now pinned on the CONSTANTS the builder composes, which is
// where the 5 1/2" lives once no line carries it, and a second check says the
// linework stayed gone. Without that second one, restoring the strays would
// pass here and the drawing would be wrong again with nothing failing.
check('the garage SLAB is 5 1/2" below the sill: a sill plate, then 4"', P =>
  [P.SILL_PLATE_IN + P.GARAGE_SLAB_BELOW_CONCRETE_IN, 5.5]);
check('and no line is drawn between the sill and the beam soffit', P => {
  // Everything legitimately in that band is a rect (beam, sill plate) or the
  // break. A LINE with both ends under the sill and above the beam's underside
  // is the slab coming back.
  const s = garage(P);
  const soffit = GARAGE.garage.sillOffsetFt - P.SILL_PLATE_IN / 12
    - GARAGE.garage.fdnWallHeightFt;
  const inBand = y => y < GARAGE.garage.sillOffsetFt && y > soffit;
  return [s.parts.filter(p => p.kind === 'line' && inBand(p.y1) && inBand(p.y2)).length, 0];
});
// THE PILE IS A MEMBER, NOT A LINE. Movie, 16 Sep, filling the shaft in green
// over the render: two hairlines beside the break read as a stray, where
// everything else down there -- beam, sill, footing -- is a closed band. The
// hatch is what says the cut goes THROUGH it, and it is the only thing on
// this drawing that does, so it is worth pinning that it exists and runs
// beam soffit to footing bottom. WHOLE piles now: the garage draws complete
// to its own end wall, so nothing cuts through a shaft any more and the
// hatch spans the full shaft rather than the half a break used to leave.
//
// THE WIDTH IS READ, NOT TYPED. It was 10" here until 18 Sep, when Movie
// gave the pile its real size -- "the piles should show 12" dia. and the
// center of the pile should be center of the wall" -- and this check went
// red on a drawing that was right. A literal here is a second copy of a
// number the builder already owns, so it asks the builder's own constant
// and fails only if the hatch stops covering the pile.
check('the pile is hatched over its whole width, soffit to footing bottom', P => {
  const s = garage(P);
  const fill = s.parts.filter(p => p.kind === 'hatch');
  const soffit = GARAGE.garage.sillOffsetFt - P.SILL_PLATE_IN / 12
    - GARAGE.garage.fdnWallHeightFt;
  const pileBot = GARAGE.garage.houseFootingTopFt - GARAGE.garage.footingDepthIn / 12;
  const shaft = fill.find(p => near(p.y, pileBot));
  return [shaft && [
    Math.round(shaft.w * 12 * 16) / 16,
    Math.round((shaft.y + shaft.h - soffit) * 16) / 16,
  ].join(','), `${P.PILE_DIAMETER_IN},0`];
});
// AND THE VOID FORM IS TOO, because it is the same pour's formwork read at
// the same scale: a 4" band outlined and left white is a gap, and a gap under
// a beam is what the void form is there to explain.
check('the void form band is hatched as well', P => {
  const s = garage(P);
  return [s.parts.filter(p => p.kind === 'hatch'
    && near(p.h, P.VOID_FORM_IN / 12)).length, 1];
});
// 1'-2", not the 8" this carried until 5 Sep. Movie moved every garage
// foundation out to the house's own height above grade -- "for the grade beam
// or frost wall", on "all 3 detached" -- so a beam tops out level with the
// house foundation instead of 6" under it.
check('the detached garage beam rides 1\'-2" above grade, level with the house', P =>
  [P.DETACHED_BEAM_ABOVE_GRADE_IN, 14]);
// THE THICKENED EDGE CANNOT FOLLOW, and the reason is arithmetic rather than
// preference: it is 1'-0" of concrete, so a top 1'-2" above grade leaves the
// whole edge in the air. This is the one foundation whose floor sits lower.
check('the thickened edge sits lower than every other foundation', P =>
  [P.DETACHED_SLAB_ABOVE_GRADE_IN < P.DETACHED_BEAM_ABOVE_GRADE_IN, true]);
check('and it keeps concrete in the ground -- the edge is not left floating', P =>
  [P.DETACHED_SLAB_ABOVE_GRADE_IN < P.GARAGE_EDGE_DEPTH_IN, true]);
// THE FLOOR DOES NOT MOVE BETWEEN FOUNDATIONS, which is what 10" buys and the
// reason it is not a smaller number. A grade beam tops out 1'-2" above grade
// with its slab GARAGE_SLAB_BELOW_CONCRETE_IN below that; a thickened edge IS
// its own top of concrete. The two floors land at the same height, so changing
// foundation leaves the door and the apron where they were.
check('a thickened edge and a grade beam put the garage floor at the same height', P =>
  [P.DETACHED_SLAB_ABOVE_GRADE_IN,
   P.DETACHED_BEAM_ABOVE_GRADE_IN - P.GARAGE_SLAB_BELOW_CONCRETE_IN]);
// THE PAIR THAT DRIFTED FOR A WEEK. project-page.js took Movie's 1'-2" on
// 4 Sep (e3593a0); cut-view.js sat on 1'-0" from the 30 Aug extraction until
// 5 Sep, so the section painter and the PROJECT page drew grade 2" apart and
// nothing said so. Same face on both -- cut-view's "foundation top" IS the top
// of concrete, per its own note on the beam stack.
check('grade below the concrete agrees between project-page.js and cut-view.js', P =>
  [P.GRADE_BELOW_CONCRETE_IN, CUT_VIEW.GRADE_BELOW_FOUNDATION_TOP_FT * 12]);
// And the relationship the 1'-2" exists to hold: an attached beam's top of
// concrete is LEVEL with the top of the house foundation wall. That is only
// true while the two constants match, and it silently stopped being true the
// moment one of them moved on its own.
check('the attached beam tops out level with the house foundation wall', P =>
  [CUT_VIEW.GARAGE_BEAM_ABOVE_GRADE_FT, CUT_VIEW.GRADE_BELOW_FOUNDATION_TOP_FT]);

// ── The garage wall carries its own opening ────────────────────────────
// GARAGE_OVERHEAD_HEAD_FT lives in MODEL.dc.html and is repeated here as a
// literal 7, for the same reason GARAGE_SILL_BELOW_HOUSE_FT is repeated in two
// files: this module cannot reach STANDARDS. Stated so the duplication is a
// known one rather than a discovered one.
const GARAGE_DOOR_HEAD_IN = 7 * 12;

check('the garage frames a taller wall than the house', P => {
  const house = P.wallHeightFtFromStud(P.STUD_LENGTHS_IN[0]);
  return [P.GARAGE_WALL_FT > house, true];
});
check('the garage default sets its own wall, not HOUSE\'s', P =>
  [P.SECTION_TABLE_DEFAULTS.attachedGarage.mainWallHeightFt, P.GARAGE_WALL_FT]);
// THE REASON, not just the number. A 7'-0" overhead door needs the head drop
// above it -- two top plates, an 11 7/8" LVL and the rough-opening plate -- so
// the wall has to reach 8'-4 1/2". This is the check that would fail if anyone
// trimmed the garage back toward the house precut.
check('a 7\'-0" overhead door clears the head drop on the garage wall', P =>
  [P.GARAGE_WALL_FT * 12 - P.OPENING_HEAD_DROP_IN >= GARAGE_DOOR_HEAD_IN, true]);
// And the inequality beside it: it did NOT clear on the wall the garage used to
// inherit. Without this the pair above passes on any tall-enough number and
// says nothing about why the default moved.
check('that same door does NOT clear on the house wall it used to inherit', P => {
  const house = P.wallHeightFtFromStud(P.STUD_LENGTHS_IN[0]);
  return [house * 12 - P.OPENING_HEAD_DROP_IN >= GARAGE_DOOR_HEAD_IN, false];
});
check('the head drop is two top plates, an 11 7/8" LVL and the RO plate, rounded up', P =>
  [P.OPENING_HEAD_DROP_IN >= 3 + 11.875 + 1.5 && P.OPENING_HEAD_DROP_IN <= 3 + 11.875 + 1.5 + 0.25, true]);

// ── The three foundations, side by side ─────────────────────────────────
// THE ROW EXISTS BECAUSE THE SECTION CANNOT SHOW THIS. In the band 3 section
// the thickened edge comes out about 25px tall, so a 45 degree taper and a 4"
// field against a 1'-0" edge are simply not visible. The row draws the three
// at one scale, and these checks hold the properties that make it a
// comparison rather than three drawings that happen to be adjacent.
const row = P => P.buildDetachedFoundationRow(4);

check('the row draws all three foundations', P => [row(P).length, 3]);
// IN THE ORDER THE DRAFTER SHOULD SEE THEM, DEFAULT FIRST -- and written out,
// not derived. The first version of this check compared the row against
// P.GARAGE_FOUNDATIONS.detachedGarage, which is the array the row is built
// FROM: reordering it moved the result and the expectation together and the
// check passed. The mutation engine caught it as *** NOTHING ***, which is the
// only reason it is not still sitting here looking green.
//
// So the order is spelt out, because it IS the contract rather than a snapshot
// of it: Movie, 5 Sep, "the detached garage will have default thickened edge
// slab", with grade beam and frost wall as the other two options.
check('the row leads with the thickened edge, the default', P =>
  [row(P)[0].kind, 'thickened']);
check('and offers the other two behind it', P =>
  [row(P).map(d => d.kind).join(), 'thickened,gradebeam,frostwall']);
// THE FLOOR IS THE SHARED DATUM, and this is what makes the row legible: the
// garage floor does not move between foundations, so the three slabs line up
// across the strip and the concrete under them is the only thing that changes.
check('all three put the garage floor on the same line', P => {
  const tops = row(P).map(detail => detail.parts.find(part =>
    part.kind === 'line' && part.y1 === 0 && part.y2 === 0).y1);
  return [new Set(tops).size, 1];
});
check('and all three put grade the same distance below it', P => {
  const grades = row(P).map(detail => detail.parts.find(part =>
    part.kind === 'line' && part.y1 === part.y2 && part.y1 < 0).y1);
  return [[new Set(grades).size, grades[0]].join(),
    [1, -P.DETACHED_SLAB_ABOVE_GRADE_IN / 12].join()];
});
// ONE CAPTION BASELINE. Hung off each detail's own lowest point, THICKENED
// EDGE sat most of a foot above the other two -- three captions at three
// heights read as three drawings, not as a row.
check('the three captions share one baseline', P => {
  const ys = row(P).map((detail, index) => detail.anchors[`caption${index}`].y);
  return [new Set(ys).size, 1];
});
// A FROST WALL HAS NO BOTTOM, the convention this file already uses for the
// pile: it runs to the HOUSE's footing depth, a number that varies per
// drawing. The grade beam DOES have one, and the pair is the point -- without
// the second half this passes on a row that caps neither.
check('the frost wall runs off the bottom; the grade beam is closed', P => {
  const closed = kind => {
    const detail = row(P).find(d => d.kind === kind);
    const lowest = Math.min(...detail.parts.flatMap(part => [part.y1, part.y2]));
    return detail.parts.some(part =>
      part.y1 === part.y2 && Math.abs(part.y1 - lowest) < 1e-9);
  };
  return [[closed('frostwall'), closed('gradebeam')].join(), 'false,true'];
});
// The taper is the whole reason for the row, so it is checked here too and as
// the equality rather than as inches -- at 45 degrees the run IS the drop.
check('the thickened edge still tapers at 45 in the row', P => {
  const detail = row(P).find(d => d.kind === 'thickened');
  const taper = detail.parts.find(part =>
    part.y1 !== part.y2 && part.x1 !== part.x2);
  return [Math.abs(Math.abs(taper.x2 - taper.x1) - Math.abs(taper.y2 - taper.y1)) < 1e-9, true];
});

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

// The garage, in the shape garageValues() hands it over. Its one offset is
// deliberately a round -2 so the numbers below read as arithmetic rather than
// coincidence.
const GARAGE = Object.freeze({
  garage: Object.freeze({
    foundation: 'gradebeam', houseFootingTopFt: -9.5, footingWidthIn: 20, footingDepthIn: 8,
    sillOffsetFt: -2, wallHeightFt: 97.125 / 12, fdnWallHeightFt: 32 / 12,
    slabIn: 4, thicknessIn: 8,
  }),
});
const garage = P => P.buildGarageSection(GARAGE);

// ── The detached garage section ─────────────────────────────────────────
// A BUILDING OF ITS OWN, not a flag on the attached one. buildGarageSection
// hangs everything off the house -- g.sillOffsetFt on the house datum,
// g.houseFootingTopFt, no wall of its own because the house wall IS the wall
// at the cut, and no grade because the garage stands over that ground. None
// of those exist for a detached garage, so it gets its own builder and its own
// datum: the TOP OF SLAB at y = 0, the way a slab-on-grade is set out.
const DETACHED = P => ({
  wallThicknessIn: 5.5,
  garage: { slabIn: 4, wallHeightFt: P.GARAGE_WALL_FT },
  roof: { pitch: 4, overhangFt: 2, fasciaIn: 5.5, heelIn: null },
});
const detached = P => P.buildDetachedGarageSection(DETACHED(P));
const yLow = out => Math.min(...out.parts.flatMap(part => part.kind === 'rect'
  ? [part.y, part.y + part.h]
  : part.kind === 'break' ? [part.y1, part.y2] : [part.y1, part.y2]));

// HOW FAR A SLOPED SLAB FALLS, and the reason this is here at all: the slope
// constant existed for weeks with nothing to multiply, so no drawing could turn
// a rate into a fall and every sloped slab was drawn at whatever station its
// author had in mind. A rate needs a run.
check('the garage depth is 24 ft', P => [P.GARAGE_DEPTH_FT, 24]);
check('the fall is the depth times the slope, not a written 3"', P =>
  [P.garageSlabFallIn(), P.GARAGE_DEPTH_FT * (1 / 8)]);
// COMPOSED, and this is the check that proves it. A hard-coded 3" passes the
// one above on the default depth and fails here the moment the depth changes,
// which is exactly the drift the pair exists to catch.
check('a deeper garage falls further -- the fall follows the depth', P =>
  [P.garageSlabFallIn(48) > P.garageSlabFallIn(24), true]);
// AND THE STRIP'S CLAIM IS BOUNDED BY IT. The three floors agree at the back
// and not at the door; the fall is how far apart they finish. Asserted as a
// non-zero difference rather than as 3", so the day the slope or the depth
// moves this still says the right thing.
check('the level and sloped floors do NOT agree at the door', P =>
  [P.garageSlabFallIn() > 0, true]);

check('the detached section puts its datum at the top of slab', P => {
  const slabTop = detached(P).parts.find(part =>
    part.kind === 'line' && part.y1 === 0 && part.y2 === 0 && part.x1 === 0);
  return [slabTop != null, true];
});
// THE FLOOR SITS WHERE THE OTHER FOUNDATIONS PUT IT. Grade is below the datum
// by exactly the constant, so a reader measuring off the drawing gets the same
// number the schedule prints.
check('grade sits DETACHED_SLAB_ABOVE_GRADE_IN below the slab top', P => {
  const grade = detached(P).parts.find(part => part.kind === 'line' && part.x1 < 0);
  return [grade.y1, -P.DETACHED_SLAB_ABOVE_GRADE_IN / 12];
});
check('the edge is GARAGE_EDGE_DEPTH_IN of concrete', P =>
  [yLow(detached(P)) <= -P.GARAGE_EDGE_DEPTH_IN / 12, true]);
// AND IT IS DEEPER THAN THE FIELD, which is the whole reason it is called
// thickened. Without the inequality the check above passes on a flat slab of
// any depth and says nothing about a taper existing.
check('the edge is deeper than the field slab it thickens from', P =>
  [P.GARAGE_EDGE_DEPTH_IN > DETACHED(P).garage.slabIn, true]);
// THE TAPER IS 45 DEGREES, so its run equals its drop. Asserted as that
// equality rather than as a number of inches: at 45 the run follows the two
// depths, and hard-coding 8" would go stale the moment either moved.
check('the taper runs 45 degrees -- its run equals its drop', P => {
  const out = detached(P);
  const taper = out.parts.find(part => part.kind === 'line'
    && part.y1 !== part.y2 && part.x1 !== part.x2 && part.y1 < 0);
  return [Math.abs(taper.x2 - taper.x1) - Math.abs(taper.y2 - taper.y1) < 1e-9, true];
});
// ── THE OTHER TWO FOUNDATIONS ─────────────────────────────────────────────
// A grade beam and a frost wall stand their concrete PROUD of the floor and
// the wall bears on THAT, which is the one thing that makes them a different
// drawing rather than the thickened edge with a deeper edge. Asserted as the
// wall's own bottom against the concrete top, both read off the drawing, so a
// wall left sitting on the slab fails here however deep the concrete is.
const DETACHED_ON = (P, foundation) => P.buildDetachedGarageSection({
  ...DETACHED(P),
  garage: { ...DETACHED(P).garage, foundation },
});
check('a grade beam stands its concrete proud and the wall bears on it', P => {
  const out = DETACHED_ON(P, 'gradebeam');
  const concTop = -P.DETACHED_SLAB_ABOVE_GRADE_IN / 12
    + P.GRADE_BELOW_CONCRETE_IN / 12;
  const wall = rects(out).find(r => near(r.h, P.GARAGE_WALL_FT));
  return [wall ? near(wall.y, concTop) : 'no wall rect on the beam', true];
});
// AND THE FLOOR DOES NOT MOVE WITH IT. The reason the page can switch
// foundation without moving the door and the apron: DETACHED_SLAB_ABOVE_GRADE_IN
// puts both floors at the same height above grade.
check('the floor is at the same height on a beam as on a thickened edge', P => {
  const top = out => out.parts.filter(part => part.kind === 'line'
    && near(part.y1, 0) && near(part.y2, 0) && part.x2 > part.x1).length;
  return [[top(detached(P)) > 0, top(DETACHED_ON(P, 'gradebeam')) > 0].join(), 'true,true'];
});
// ── THE STOREY OVER IT ────────────────────────────────────────────────────
// Movie, 28 Sep. The roof stands on the ROOM's plate once there is a room, and
// that is the whole of what the press changes about the roof: keying it to the
// garage plate is what left band 1's ROOM OVER roofs sitting on the garage.
const DETACHED_ROOM = P => P.buildDetachedGarageSection({
  ...DETACHED(P),
  garage: {
    ...DETACHED(P).garage,
    foundation: 'gradebeam',
    roomOver: true,
    overJoistIn: 19.25,
    overSheathingIn: 0.75,
    overWallHeightFt: 8 + 1.125 / 12,
    overWallIn: 5.5,
  },
});
check('a storey over the detached garage lifts its roof by the whole storey', P => {
  const highest = out => Math.max(...out.parts.flatMap(part => part.kind === 'rect'
    ? [part.y, part.y + part.h]
    : part.kind === 'break' ? [part.y1, part.y2] : [part.y1, part.y2]));
  const lift = highest(DETACHED_ROOM(P)) - highest(DETACHED_ON(P, 'gradebeam'));
  const storey = (19.25 + 0.75) / 12 + 8 + 1.125 / 12;
  return [Math.abs(lift - storey) < 1e-6, true];
});

// ── THE TRUSS IS THE HOUSE'S ─────────────────────────────────────────────
// Movie, 28 Sep: "the roof truss doesn't show properly. can you check how the
// BUNGALOW roof truss is drawn showing all the 3.5" top/side/bottom roof
// chords". It drew a top chord's two faces and nothing else. Asserted as the
// MEMBERS rather than as a line count, because a count passes on two lines
// that happen to be somewhere.
check('the detached truss has a side chord at the wall face, not a bare corner', P => {
  const base = P.GARAGE_WALL_FT;
  const web = P.ROOF_CHORD_IN / 12;
  const verticals = detached(P).parts.filter(part => part.kind === 'line'
    && near(part.x1, part.x2) && part.y2 > part.y1 && part.y1 >= base - 1e-9);
  const outer = verticals.some(part => near(part.x1, 0));
  const inner = verticals.some(part => near(part.x1, web) && near(part.y1, base + web));
  return [[outer, inner].join(), 'true,true'];
});
// THE BOTTOM CHORD, whose underside is the ceiling plane -- the face the
// finish attaches to -- so the member sits ABOVE it rather than straddling
// it, and the top line starts at the side chord's inside face.
check('the detached truss has a bottom chord over its ceiling', P => {
  const base = P.GARAGE_WALL_FT;
  const chord = P.ROOF_CHORD_IN / 12;
  const flat = detached(P).parts.filter(part => part.kind === 'line'
    && near(part.y1, part.y2) && near(part.x2, CUT));
  const ceiling = flat.some(part => near(part.y1, base) && near(part.x1, 0));
  const top = flat.some(part => near(part.y1, base + chord) && near(part.x1, chord));
  return [[ceiling, top].join(), 'true,true'];
});
// ONE TRUSS, NOT TWO THAT AGREE. The joint is a settled ruling (17 Sep), and
// the way it stays settled is that both sections ask the same code for it.
// Compared as the shape each draws above its own plate, so the two can stand
// at different heights and still have to be the same truss.
check('the house and the detached garage draw the SAME truss', P => {
  // Both fixtures carry the same roof (4:12, 2'-0", a 5 1/2" fascia, no
  // typed heel), so with each measured off ITS OWN plate the two sets of
  // members are equal or one of them is not this truss. That equality is the
  // whole point of the extraction: a second copy is settled until somebody
  // edits one of them.
  const shape = (out, base) => out.parts
    .filter(part => part.kind === 'line' && Math.min(part.y1, part.y2) >= base - 1e-9)
    .map(part => [part.x1, part.y1 - base, part.x2, part.y2 - base, part.weight]
      .map(n => Math.round(n * 1e6) / 1e6).join(','))
    .sort().join(' | ');
  const housePlate = (97.125 / 12) * 2 + (9.25 + 0.75) / 12;
  return [shape(detached(P), P.GARAGE_WALL_FT), shape(section(P), housePlate)];
});

// The door head, composed rather than pinned -- it follows the wall and the
// head drop, so it stays right when either moves.
// READ OFF THE ANCHOR, NOT A DASHED LINE. The line is gone -- Movie marked it
// off the drawing on 28 Sep, along with the plate line, because it reached out
// past the wall face into the grey label column and the schedule beside the
// drawing already carries the number. The ELEVATION is what this check is
// about and it has not moved: the label still hangs at it.
check('the overhead door head hangs OPENING_HEAD_DROP_IN under the top plate', P =>
  [detached(P).anchors.doorHead.y, P.GARAGE_WALL_FT - P.OPENING_HEAD_DROP_IN / 12]);
// AND NOTHING IS DRAWN THERE ANY MORE, which is the other half: an elevation
// that is right on a line nobody asked for is the state this came from.
check('and draws no dashed line across the wall for it', P =>
  [detached(P).parts.some(part => part.kind === 'dashed'), false]);
// ── THE BOTTOM SILL PLATE ─────────────────────────────────────
// Movie, 28 Sep: "we should show the 1.5" bottom plates at the bottom of the
// wall... the 3.5"x1.5" stud at the bottom where it meets the slab", and then
// what it is called: "i mean botton SILL plate". At the BOTTOM, which is the
// correction -- the line he first marked off was under the TOP plate, and the
// answer was to move it down rather than delete it.
//
// A MEMBER, NOT A LINE, because that is how the house draws its sill: 1 1/2"
// of wood as wide as the wall, bearing on the slab.
const detachedSill = P => rects(detached(P))
  .filter(r => near(r.h, P.SILL_PLATE_IN / 12));
check('the wall bears on a sill plate where it meets the slab', P => {
  const sills = detachedSill(P);
  if (sills.length !== 1) return [`${sills.length} sill-plate bands`, 'exactly one'];
  return [near(sills[0].y, 0) && near(sills[0].x, 0), true];
});
// AS WIDE AS THE WALL, not a written 3 1/2". A plate is a 2x of the wall's
// own width laid flat, so a number here would draw a 2x4 plate under a 2x6
// wall the moment the type changed -- which is the page's default.
check('the sill plate is as wide as the wall it is under', P => {
  const sills = detachedSill(P);
  return [sills.length === 1 ? near(sills[0].w, DETACHED(P).wallThicknessIn / 12)
    : `${sills.length} sill-plate bands`, true];
});
// THE HOUSE'S OWN SILL, drawn by the same helper, so the two cannot drift into
// two thicknesses of the same member. The house's is found by the check above
// at "the garage offset is the SILL TOP".
check('and it is the same member the house sits on', P => {
  const house = rects(section(P)).filter(r => near(r.h, P.SILL_PLATE_IN / 12));
  const sills = detachedSill(P);
  return [house.length && sills.length ? near(house[0].h, sills[0].h) : 'no sill', true];
});
// AND WHICH MEMBER IT IS, AND HOW TALL, IS THE SCHEDULE'S TO SAY. Movie's
// 28 Sep mockup heads this band's FOUNDATION block with ATTACHMENT and
// HEIGHT, so the builder takes both off the DETACHED GARAGE row instead of
// writing 'sill' and 1 1/2" into the drawing. Hard-coding either would draw a
// detail that disagrees with the two boxes beside it and never says so.
const DETACHED_HELD = (P, attachment, attachmentIn) => P.buildDetachedGarageSection({
  ...DETACHED(P),
  garage: { ...DETACHED(P).garage, attachment, attachmentIn },
});
check('a typed attachment height is the height the plate is drawn', P => {
  const wallFt = DETACHED(P).wallThicknessIn / 12;
  // The plate is the full-width band bearing on the slab -- the wall rect
  // starts there too, which is why width alone is not enough to name it.
  const bands = rects(DETACHED_HELD(P, 'sill', 3))
    .filter(r => near(r.y, 0) && near(r.x, 0) && near(r.w, wallFt) && r.h < 1);
  return [bands.length === 1 ? near(bands[0].h, 3 / 12)
    : `${bands.length} bands on the slab`, true];
});
// A LADDER IS TWO MEMBERS AT THE WALL FACES, not one band across it -- the
// same shape the house draws, because it is the same helper. Read by SHAPE
// rather than against the member sizes: what this check is for is that the
// ROW reached the drawing at all, and a 2x6 on edge is the helper's business.
check('choosing a PT ladder draws the ladder, not a sill plate', P => {
  const wallFt = DETACHED(P).wallThicknessIn / 12;
  // Narrow, and hanging below the top of the concrete -- which is what makes
  // a ladder a ladder and a plate a plate.
  const ladder = rects(DETACHED_HELD(P, 'ladder', P.SILL_PLATE_IN))
    .filter(r => r.w < wallFt / 2 && r.y < 0);
  return [[ladder.length, detachedSill(P).length].join(), '2,1'];
});
check('a 7\'-0" overhead door clears that head on the detached garage wall', P =>
  [P.GARAGE_WALL_FT * 12 - P.OPENING_HEAD_DROP_IN >= 84, true]);
// It is a separate builder, and this is the check that says so: the attached
// garage draws no grade line at all, deliberately, because it stands over that
// ground. If the two were ever fused, one of them would start lying.
check('the attached garage still draws no grade line, the detached one does', P => {
  const attachedHasGrade = P.buildGarageSection(GARAGE).parts
    .some(part => part.kind === 'line' && part.x1 > 0 && part.y1 === part.y2 && part.y1 < 0);
  const detachedHasGrade = detached(P).parts.some(part => part.kind === 'line' && part.x1 < 0);
  return [[attachedHasGrade, detachedHasGrade].join(), 'false,true'];
});

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
const CUT = 4;
const atX = (l, x) => l.y1 + (x - l.x1) * (l.y2 - l.y1) / (l.x2 - l.x1);

check('the roof stands the reported heel above the plate at the wall face', P => {
  const plateY = (97.125 / 12) * 2 + (9.25 + 0.75) / 12;
  const chord = topChordFace(section(P));
  const R = ASSEMBLY.roof;
  const want = P.roofHeelIn(R.fasciaIn, R.overhangFt, R.pitch) / 12;
  return [chord ? near(atX(chord, 0) - plateY, want) : 'no top chord', true];
});
// THE HEEL SIDE CHORD -- SETTLED RULING (Movie, 17 Sep 2026: "BEAUTIFUL you
// finally got it !! lock that in !!"), superseding the 16 Sep wall-face
// close this check used to pin. A 3 1/2" chord PIECE stands at the wall
// exterior connecting the bottom chord to the top chord: outside face on the
// wall face, inside face 3 1/2" in, the top chord's underside OPEN across
// those 3 1/2" so the piece connects straight into the top chord -- no line
// across the joint -- and the bottom chord's upper line stopping against it.
// Chords only: the truss's internal webs are the truss designer's part and
// are deliberately never drawn.
check('the heel side chord stands at the wall face and the top chord opens over it', P => {
  const s = section(P);
  const plateY = (97.125 / 12) * 2 + (9.25 + 0.75) / 12;
  const chordFt = P.ROOF_CHORD_IN / 12;
  const R = ASSEMBLY.roof;
  const lines = s.parts.filter(p => p.kind === 'line');
  // The underside draws in two pieces around the heel's 3 1/2": out to the
  // wall face, then from the inside face to the cut -- never one line across.
  // Sloped, which tells the underside apart from the flat soffit outside the
  // wall and the flat bottom chord inside it on the same x-spans.
  const sloped = p => Math.abs(p.y2 - p.y1) > 0.01;
  const outer = lines.find(p => near(p.x1, -R.overhangFt) && near(p.x2, 0) && sloped(p));
  const inner = lines.find(p => near(p.x1, chordFt) && near(p.x2, CUT) && sloped(p));
  if (!outer || !inner) return ['underside not split open at the heel', 'two pieces'];
  const underAt = x => atX(outer, x);
  // Both edges of the piece: the outside face plate-to-underside on the wall
  // face, the inside face from the bottom chord's top up into the top chord.
  const face = lines.find(p => near(p.x1, 0) && near(p.x2, 0)
    && near(Math.min(p.y1, p.y2), plateY) && near(Math.max(p.y1, p.y2), underAt(0)));
  const inside = lines.find(p => near(p.x1, chordFt) && near(p.x2, chordFt)
    && near(Math.min(p.y1, p.y2), plateY + chordFt)
    && near(Math.max(p.y1, p.y2), underAt(chordFt)));
  if (!face) return ['no outside face on the wall face', 'the heel piece'];
  if (!inside) return ['no inside face 3 1/2" in', 'the heel piece'];
  return [true, true];
});
// THE OVERRIDE, WITH THE CONTROL THAT MUST MOVE BESIDE IT. Movie, 5 Sep:
// the heel is calculated, and typeable. A check that only proved the derived
// case still draws would pass on a build that ignored the override entirely,
// so the two are asserted together: null draws the calculation, and a number
// lifts the eave off the plate by exactly the difference -- a raised heel,
// not a fatter fascia.
// READ THE ANCHOR, DO NOT REBUILD IT. This used to take the eave as
// topChordFace().y1 minus the fascia -- the same arithmetic the builder does,
// run again here -- and a check that recomputes the answer cannot notice that
// answer going wrong. Measured: with `eaveY = plateY + heelLiftFt` mutated to
// `eaveY = plateY`, the reconstruction returned 17.020833 flat and 17.520833
// raised in BOTH builds, so the 0.5 lift looked present on a section that had
// not lifted. The mutation ran uncaught for exactly as long as that line did.
//
// `anchors.fascia` is what the painter PUBLISHES, and it separates them:
// 0.5 clean, 0 mutated. Both claims below are relationships between two of
// those published sections rather than between a section and a sum computed
// here -- null agrees with the derived number, and six inches of extra heel
// lifts the eave six inches. Nothing in this check knows how either is
// calculated, which is the point.
check('a null heel draws the calculation, and a raised heel lifts the eave', P => {
  const R = ASSEMBLY.roof;
  const derived = P.roofHeelIn(R.fasciaIn, R.overhangFt, R.pitch);
  const eaveY = a =>
    P.buildWallSection({ ...ASSEMBLY, roof: { ...R, heelIn: a } }).anchors.fascia.y;
  const flat = eaveY(null);
  return [near(flat, eaveY(derived)) && near(eaveY(derived + 6) - flat, 0.5), true];
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

// ── DETACHED GARAGE, and the copies it forced ──────────────────────────
// THE ROW EXISTS AT ALL. SECTION_TABLE_DEFAULTS held bilevel, modifiedBilevel
// and attachedGarage; a row absent here falls through cellValue() to the
// HOUSE's live value, which is how the attached garage came to read a 3" slab
// before #293. Its neighbour was left that way.
check('DETACHED GARAGE has its own defaults row', P =>
  [P.SECTION_TABLE_DEFAULTS.detachedGarage != null, true]);
check('a detached garage slab is 4", not the house 3"', P =>
  [P.SECTION_TABLE_DEFAULTS.detachedGarage.slabThicknessIn, 4]);
// FDN WALL HT IS THE EDGE DEPTH on this row: on a monolithic slab the thickened
// edge IS the foundation, so 1'-0" -- the depth cut-view.js tapers against -- is
// what that cell is measuring, not a substitute for a wall that isn't there.
check('FDN WALL HT on the detached row is the 1\'-0" thickened edge', P =>
  [P.SECTION_TABLE_DEFAULTS.detachedGarage.fdnWallHeightFt, P.GARAGE_EDGE_DEPTH_IN / 12]);
// THE INEQUALITY THAT MAKES THE WALL ROW MEAN SOMETHING. A 7'-0" overhead door
// needs the head drop above it. The garage wall carries it; the house precut
// this row used to inherit leaves 6'-8 5/8" and will not take the door at all.
check('a 7\'-0" door clears the head drop on the detached row\'s wall', P =>
  [P.SECTION_TABLE_DEFAULTS.detachedGarage.mainWallHeightFt * 12 - P.OPENING_HEAD_DROP_IN >= 84, true]);
check('it did NOT clear on the house wall the row used to inherit', P => {
  const house = P.wallHeightFtFromStud(P.STUD_LENGTHS_IN[0]);
  return [house * 12 - P.OPENING_HEAD_DROP_IN >= 84, false];
});
// THE COPIES, HELD TO THEIR ORIGINALS. project-page.js keeps its own copy of
// four numbers cut-view.js owns, because loading cut-view into PROJECT.html
// would mean three more scripts on a page that never paints a cut view. The
// duplication was never the defect -- the 32" drifted because nobody noticed
// it had, under two different names. These fail the moment they disagree.
check('the thickened edge depth agrees with cut-view.js', P =>
  [P.GARAGE_EDGE_DEPTH_IN, CUT_VIEW.GARAGE_EDGE_DEPTH_IN]);
check('the grade beam depth agrees with cut-view.js GARAGE_BEAM_CONCRETE_IN', P =>
  [P.GARAGE_GRADE_BEAM_IN, CUT_VIEW.GARAGE_BEAM_CONCRETE_IN]);
check('the detached beam height agrees with cut-view.js', P =>
  [P.DETACHED_BEAM_ABOVE_GRADE_IN, CUT_VIEW.DETACHED_BEAM_ABOVE_GRADE_IN]);
check('the garage sill drop agrees with cut-view.js', P =>
  [P.GARAGE_SILL_BELOW_HOUSE_FT, CUT_VIEW.GARAGE_SILL_BELOW_HOUSE_FT]);
check('the garage slab thickness agrees with cut-view.js', P =>
  [P.SECTION_TABLE_DEFAULTS.detachedGarage.slabThicknessIn, CUT_VIEW.GARAGE_SLAB_THICKNESS_IN]);


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
  // ANCHORED ON THE TWO FIELDS IT FLIPS, not the whole object. Matching the
  // full literal meant that adding ANY field to that row -- `datum: null`, as
  // it happened -- silently stopped the mutation applying, and a mutation that
  // does not apply proves nothing while still reading as a line in the table.
  // `label: 'BILEVEL'` cannot hit MODIFIED BILEVEL: the prefix is inside the
  // quotes, so the two labels share no substring at that boundary.
  // BOTH GARAGE ROWS. attachedGarage and detachedGarage each carry the
  // field; a replace() took the attached one and left its neighbour -- which
  // is the very shape of the defect this table already records one entry
  // below ("AND THE DETACHED ROW HAD THE SAME HOLE").
  ['the garage falls back to the house wall again',
    s => s.split('      mainWallHeightFt: GARAGE_WALL_FT,\n').join('')],
  ['the head drop forgets the rough-opening plate',
    s => s.replace('const OPENING_HEAD_DROP_IN = 16.5;', 'const OPENING_HEAD_DROP_IN = 15;')],
  ['the garage wall drops to the house precut',
    s => s.replace('const GARAGE_WALL_FT = wallHeightFtFromStud(STUD_LENGTHS_IN[1]);',
      'const GARAGE_WALL_FT = wallHeightFtFromStud(STUD_LENGTHS_IN[0]);')],
  ['the bilevel zone row goes live before the feature does',
    s => s.replace("label: 'BILEVEL', reserved: true", "label: 'BILEVEL', reserved: false")],
  // THE HOUSE'S SECTION AND THE DETACHED GARAGE'S carry these three roof
  // lines byte for byte the same -- heel lift, eave, rise -- so a replace()
  // gated the house and left the garage. Nothing nearby tells the two apart
  // in CODE (only the comment block above the house's), and picking one by
  // counting lines is how an anchor drifts. Breaking the rule in both places
  // is what the names say anyway.
  ['the roof rises at pitch per foot instead of pitch per twelve',
    s => s.split('(roof.overhangFt + x) * (roof.pitch / 12);')
      .join('(roof.overhangFt + x) * roof.pitch;')],
  ['the foundation forgets the floor it carries',
    s => s.replace('const fdnTop = -mainDepthFt;', 'const fdnTop = 0;')],
  // RE-POINTED AT THE DELEGATE. The sum itself moved to drawing-format.js, so
  // the old anchor -- project-page.js's one-line body -- matches nothing now,
  // and a mutation that never applies proves nothing while still reading as
  // part of a near-perfect score. This mutates what project-page.js still
  // owns: which arguments it hands the shared calc. Dropping the overhang at
  // the call is the same defect from this file's side.
  ['the heel forgets the overhang',
    s => s.replace('window.DraftDrawingFormat.roofHeelIn(fasciaIn, overhangFt, pitch);', 'window.DraftDrawingFormat.roofHeelIn(fasciaIn, 0, pitch);')],
  ['stud from wall height forgets the plates',
    s => s.replace('const studInFromWallHeightFt = wallHeightFt => wallHeightFt * 12 - PLATE_STACK_IN;', 'const studInFromWallHeightFt = wallHeightFt => wallHeightFt * 12;')],
  // Caught by the shared-default rule, not by a count of who has defaults:
  // a garage growing a default of its own is legitimate and must not read
  // as a failure here.
  ['the mod bilevel loses its default (falls back to the house)',
    s => s.replace('    modifiedBilevel: SPLIT_BASE,\n', '')],
  // ── THE TRUSS MUTANTS NOW READ roofTruss ─────────────────────────────
  // The heel joint moved out of buildWallSection on 28 Sep so the detached
  // garage could draw the same members instead of its own two lines, and
  // these three quote it by text. Same mutations, same checks catching them:
  // only the name of the base the truss stands on changed, plateY to
  // roofBase, because the helper is now also called with a room's plate.
  //
  // The 17 Sep heel piece drawn the way Movie refused it ("no its not a
  // line"): the inside face goes, leaving one vertical where the member was.
  ['the heel piece thins back to a single line at the wall face',
    s => s.replace('line(heelWebX, roofBase + ROOF_CHORD_IN / 12,\n      heelWebX, roofBase + riseAt(heelWebX) - chordDropFt, 1);', '')],
  // The joint sealed shut: one underside line across the heel's 3 1/2"
  // instead of the two pieces that leave it open into the top chord.
  ['the top chord underside closes across the heel joint',
    s => s.replace('line(roofStartX, roofBase + riseAt(roofStartX) - chordDropFt,\n      0, roofBase + riseAt(0) - chordDropFt, 1);\n    line(heelWebX, roofBase + riseAt(heelWebX) - chordDropFt,\n      cut, roofBase + riseAt(cut) - chordDropFt, 1);',
      'line(roofStartX, roofBase + riseAt(roofStartX) - chordDropFt,\n      cut, roofBase + riseAt(cut) - chordDropFt, 1);')],
  ['a raised heel is ignored and the roof stays on the plate',
    s => s.split('const heelLiftFt = roof.heelIn == null ? 0')
      .join('const heelLiftFt = true ? 0')],
  // The plausible misreading of "raise the heel": deepen the board instead of
  // lifting the roof. It puts the top chord in the right place and leaves the
  // soffit sitting on the plate, so only a check that watches the EAVE sees it.
  // THE TWO MEMBERS THE DETACHED SECTION WAS MISSING until the truss became
  // shared, so the gate can tell the difference between having them and
  // having had them once.
  // Movie's correction, undone: the plate drawn at the TOP of the wall again,
  // which is the line he marked off before saying where it belonged.
  ['the bottom sill plate goes back to the top of the wall',
    s => s.replace('0, wallBaseY, wallFt,\n      attachFt * 12);',
      '0, plateY - sillFt, wallFt,\n      attachFt * 12);')],
  // The plausible misreading of "3.5\"x1.5\" stud": write the 3 1/2" down.
  ['the sill plate is written 3 1/2" wide instead of following the wall',
    s => s.replace('0, wallBaseY, wallFt,\n      attachFt * 12);',
      '0, wallBaseY, 3.5 / 12,\n      attachFt * 12);')],
  // Back to a line across the wall, which is what it was before he named it.
  ['the sill plate is a line across the wall rather than a member',
    s => s.replace(
      "    attachment(rect, line, g.attachment || 'sill', 0, wallBaseY, wallFt,\n      attachFt * 12);",
      '    line(0, wallBaseY + attachFt, wallFt, wallBaseY + attachFt, 1);')],
  // AND THE TWO BOXES ABOVE IT GO BACK TO BEING DECORATION. Both of these
  // draw a perfectly good detail; what they lose is the connection between
  // the ATTACHMENT / HEIGHT pair Movie asked for on 28 Sep and the member
  // under the wall.
  ['the attachment is hard-coded back to a sill plate',
    s => s.replace("attachment(rect, line, g.attachment || 'sill',",
      "attachment(rect, line, 'sill',")],
  ['the attachment height is hard-coded back to the office 1 1/2"',
    s => s.replace('const attachFt = (g.attachmentIn ?? sillPlateIn()) / 12;',
      'const attachFt = sillPlateIn() / 12;')],
  ['the truss loses its bottom chord, and the ceiling is a bare line again',
    s => s.replace('    if (ceiling) {', '    if (false) {')],
  ['the side chord loses its outside face at the wall',
    s => s.replace('    line(0, roofBase, 0, roofBase + riseAt(0) - chordDropFt, 1);\n', '')],
  ['a raised heel fattens the fascia instead of lifting the roof',
    s => s.split('const eaveY = roofBase + heelLiftFt;').join('const eaveY = roofBase;')],
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
  // THE DETACHED ROW GOES BACK TO INHERITING. Anchored on the three fields it
  // sets, NOT on the Object.freeze around them -- an anchor that matched a whole
  // literal is what rotted when ZONE_ROWS gained a `datum` field, and CI caught
  // it as "1 mutation(s) never applied" rather than as a red check.
  ['the detached garage row loses its defaults again',
    s => s.replace('      fdnWallHeightFt: GARAGE_EDGE_DEPTH_IN / 12,\n      slabThicknessIn: 4,\n      mainWallHeightFt: GARAGE_WALL_FT,', '      slabThicknessIn: 4,')],
  // ANCHORED ON THE EDGE-DEPTH LINE, which only the detached row has. The three
  // fields below it are byte-identical to the attached garage's, and
  // String.replace takes the FIRST match -- so the obvious anchor mutates the
  // attached row, the attached row's own checks catch it, and the table reports
  // green for a detached-row mutation that never touched the detached row.
  ['the detached garage slab drops back to the house 3"',
    s => s.replace('      fdnWallHeightFt: GARAGE_EDGE_DEPTH_IN / 12,\n      slabThicknessIn: 4,', '      fdnWallHeightFt: GARAGE_EDGE_DEPTH_IN / 12,\n      slabThicknessIn: 3,')],
  ['the detached garage inherits the house precut it cannot fit a door in',
    s => s.replace('      fdnWallHeightFt: GARAGE_EDGE_DEPTH_IN / 12,\n      slabThicknessIn: 4,\n      mainWallHeightFt: GARAGE_WALL_FT,',
      '      fdnWallHeightFt: GARAGE_EDGE_DEPTH_IN / 12,\n      slabThicknessIn: 4,\n      mainWallHeightFt: wallHeightFtFromStud(STUD_LENGTHS_IN[0]),')],
  // The drift itself, which is the whole reason the copies are allowed to stay.
  ["this file's thickened edge drifts from cut-view.js",
    s => s.replace('  const GARAGE_EDGE_DEPTH_IN = 12;', '  const GARAGE_EDGE_DEPTH_IN = 13;')],
  ['the grade beam drifts from cut-view.js, the way the 32" already did once',
    s => s.replace('  const GARAGE_GRADE_BEAM_IN = 32;', '  const GARAGE_GRADE_BEAM_IN = 30;')],
  // THE DETACHED SECTION. Anchored on single lines inside the builder rather
  // than on the block around them -- the anchor that rotted earlier today
  // matched a whole object literal and stopped applying when one field was
  // added beside it.
  ['the garage depth drifts off Movie\'s 24 ft',
    s => s.replace('  const GARAGE_DEPTH_FT = 24;', '  const GARAGE_DEPTH_FT = 20;')],
  // The fall written as a number instead of composed -- passes on the default
  // depth, fails the moment anything asks a different one. This is the shape
  // the 32" drifted in, and the shape the whole file is now guarded against.
  ['the fall is hard-coded instead of composed from the depth',
    s => s.replace('  const garageSlabFallIn = (depthFt = GARAGE_DEPTH_FT) => depthFt * GARAGE_SLAB_SLOPE_IN_PER_FT;',
      '  const garageSlabFallIn = () => 3;')],
  ['the detached slab stops being the datum',
    s => s.replace("    line(0, 0, CUT_DEPTH_FT, 0, 2);", "    line(0, 0.25, CUT_DEPTH_FT, 0.25, 2);")],
  // TWICE IN THE DETACHED DETAILS, once per foundation kind.
  ['the detached grade line drifts off the constant',
    s => s.split('    const gradeY = -DETACHED_SLAB_ABOVE_GRADE_IN / 12;')
      .join('    const gradeY = -8 / 12;')],
  ['the thickened edge is poured to the field depth -- no thickening at all',
    s => s.replace('    const edgeBot = -edgeFt;', '    const edgeBot = -slabFt;')],
  ['the taper is cut at something other than 45 degrees',
    s => s.replace('    const taperRun = Math.max(0, edgeFt - slabFt);',
      '    const taperRun = Math.max(0, edgeFt - slabFt) * 2;')],
  // ── THE OTHER TWO FOUNDATIONS, NOW THAT THE SECTION DRAWS THEM ──────────
  // Until 28 Sep this builder drew a thickened edge and nothing else, so
  // every mutant above is a thickened-edge mutant. These two are the facts
  // the other foundations add: the concrete stands PROUD of the floor and the
  // wall bears on it, and the storey over the garage is what the roof stands
  // on once it exists.
  ['the wall on a grade beam bears on the floor instead of the concrete',
    s => s.replace('      wallBaseY = concTop;', '      wallBaseY = 0;')],
  // ANCHORED ON THE LINE ABOVE IT TOO. buildGarageSection carries the same
  // assignment at the same indent for the attached garage's storey, so the
  // bare line matches twice and replace() takes the first -- a mutation of
  // the wrong builder, reported against this one.
  ['the roof ignores the storey and stays on the garage plate',
    s => s.replace(
      '      anchors.overWallHeight = { x: overStudFt + 0.55, y: deck + overWallFt / 2 };\n'
      + '      }\n      roofBase = deck + overWallFt;',
      '      anchors.overWallHeight = { x: overStudFt + 0.55, y: deck + overWallFt / 2 };\n'
      + '      }\n      roofBase = plateY;')],
  ['the foundation row loses a foundation',
    s => s.replace("    detachedGarage: Object.freeze(['thickened', 'gradebeam', 'frostwall']),",
      "    detachedGarage: Object.freeze(['thickened', 'gradebeam']),")],
  ['the row stops leading with the default',
    s => s.replace("    detachedGarage: Object.freeze(['thickened', 'gradebeam', 'frostwall']),",
      "    detachedGarage: Object.freeze(['gradebeam', 'thickened', 'frostwall']),")],
  ['the details stop sharing a floor line',
    s => s.replace('    line(0, 0, run, 0, 2);', '    line(0, index * 0.1, run, index * 0.1, 2);')],
  ['the captions go back under their own details',
    s => s.replace('    anchors[`caption${index}`] = { x: x0 + DETAIL_RUN_FT * 0.25, y: DETAIL_CAPTION_FT };',
      '    anchors[`caption${index}`] = { x: x0 + DETAIL_RUN_FT * 0.25, y: Math.min(...parts.map(part => part.y1)) - 0.28 };')],
  ['the frost wall gets a bottom it cannot know',
    s => s.replace("      if (kind === 'gradebeam') line(0, bottom, widthFt, bottom, 2);",
      "      line(0, bottom, widthFt, bottom, 2);")],
  ['the overhead door head forgets the head drop',
    s => s.replace('    const headY = plateY - OPENING_HEAD_DROP_IN / 12;', '    const headY = plateY;')],
  // And the one that would fuse the two garages back together: a grade line
  // under the attached garage draws earth inside a building.
  ['the attached garage grows a grade line it should not have',
    s => s.replace('    const frostWall = g.foundation === \'frostwall\';',
      '    line(0.5, -1, 2, -1, 2);\n    const frostWall = g.foundation === \'frostwall\';')],
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
