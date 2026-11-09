#!/usr/bin/env node
// schedules.js and wall-section.js -- THE DOOR AND WINDOW SCHEDULES, AND THE
// WALL SECTION OFF PROJECT'S NUMBERS (jb, 9 Nov). A house drawn in code with
// enough openings to group and a full stack to section; every number below
// is worked by hand from it.
//
// Run: node proto/schedules-harness.js
//      node proto/schedules-harness.js --mutate
const MUTATE = require('./harness-args.js').mutationMode();
const path = require('path');
const { loadDraftModules } = require('./harness-env.js');

const ROOT = path.join(__dirname, '..');

const MUTATIONS = [
  ['two windows of one width are one row whatever their heights', 'schedules.js',
    c => c.replace("      const key = `8-B:${w}x${h}`;", "      const key = `8-B:${w}`;")],
  ['every row wears the same mark', 'schedules.js',
    c => c.replace("      return { ...g, mark: `${letter}${next[letter]++}` };", "      return { ...g, mark: `${letter}${next[letter]}` };")],
  ['an overhead door is marked D like a swing door', 'schedules.js',
    c => c.replace("      const letter = g.type === 'window' ? 'W' : g.garage ? 'G' : 'D';", "      const letter = g.type === 'window' ? 'W' : 'D';")],
  ['interior doors come before exterior', 'schedules.js',
    c => c.replace("  const KIND_RANK = Object.freeze({ ext: 0, int: 1, garage: 2 });", "  const KIND_RANK = Object.freeze({ ext: 1, int: 0, garage: 2 });")],
  ['a window row quotes the first sill it met, not the lowest', 'schedules.js',
    c => c.replace("      g.sillFt = Math.min(g.sillFt, Number(o.sillHeight) || 0);", "")],
  ['a garage door is sized in inches', 'schedules.js',
    c => c.replace("    if (g.garage && !metric) {", "    if (false) {")],
  ['a row names its levels in the order the openings were drawn', 'schedules.js',
    c => c.replace("      .sort((a, b) => rank.get(a) - rank.get(b)).map(id => name.get(id));", "      .map(id => name.get(id));")],
  ['a bungalow sections every floor in the file', 'wall-section.js',
    c => c.replace("    const drawnFloors = buildType === 'bungalow' ? floorLevels.slice(0, 1) : floorLevels;", "    const drawnFloors = floorLevels;")],
  ['the pour is the bearing line, plate counted twice', 'wall-section.js',
    c => c.replace("        wallHeightFt: fdn.wallHeightFt - attachmentIn / 12,", "        wallHeightFt: fdn.wallHeightFt,")],
  ['an ICF foundation keeps the 20\" footing', 'wall-section.js',
    c => c.replace("        footingWidthIn: fdn.footingWidthIn ?? (fdnIsIcf ? ICF_FOOTING_WIDTH_IN : DEFAULT_FOOTING_WIDTH_IN),", "        footingWidthIn: fdn.footingWidthIn ?? DEFAULT_FOOTING_WIDTH_IN,")],
  ['a grade beam is drawn at the wall type\'s thickness', 'wall-section.js',
    c => c.replace("        thicknessIn: gradeBeam ? PP.GRADE_BEAM_THICKNESS_IN : wallType(fdnWallType).totalIn,", "        thicknessIn: wallType(fdnWallType).totalIn,")],
  ['the pitch callout is the office default whatever the file says', 'wall-section.js',
    c => c.replace("`${roof.pitch}:12`", "'4:12'")],
  ['a ladder is lettered as a sill plate', 'wall-section.js',
    c => c.replace("      put(anchors.attachment, fdn.attachment === 'ladder'", "      put(anchors.attachment, false")],
  ['the floor window stands above the sill it is meant to show', 'wall-section.js',
    c => c.replace("        minY: concTop - 1.3, maxY: concTop - 1.3 + DETAIL_H_FT },", "        minY: concTop + 0.2, maxY: concTop + 0.2 + DETAIL_H_FT },")],
  ['a storey\'s own wall type is ignored for the house\'s', 'wall-section.js',
    c => c.replace("      return WT.EXTERIOR_WALL_TYPE_IDS.includes(override) && wallType(override) ? override : activeWallType;", "      return activeWallType;")],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('schedules',
    MUTATIONS, { root: ROOT, harness: __filename });
  process.exit(all ? 0 : 1);
}

const win = loadDraftModules();
const S = win.DraftSchedules;
const WS = win.DraftWallSection;
const format = win.DraftDrawingFormat;

let failed = 0, ran = 0;
const same = (label, got, want) => {
  ran += 1;
  if (JSON.stringify(got) !== JSON.stringify(want)) { failed += 1; console.log(`  FAIL ${label}\n       got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }
};
const near = (label, got, want, tol = 1e-6) => {
  ran += 1;
  if (!(Math.abs(got - want) <= tol)) { failed += 1; console.log(`  FAIL ${label}\n       got ${got}, want ${want}`); }
};

// ── THE HOUSE ───────────────────────────────────────────────────────────────
// Two storeys over a basement. MAIN FL carries three 36 x 48 windows, the
// first drawn at a 3'-6" sill and the others at 3'-0"; 2ND FL carries two
// more of the same, one 60 x 36 double and one 36 x 24 single -- the same
// width as the 36 x 48s and not the same window. Doors: a 36" exterior single, a 32" interior pocket and two 32"
// interior singles, a 30" interior with a sidelight, and a 16 x 7 garage
// door. 2ND FL is the higher level, so it is named first.
const P = (x, z) => ({ x, y: 0, z });
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 },
  { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
const wall = (id, levelId, a, b, more = {}) => ({ id, levelId, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 9, start: P(...a), end: P(...b), ...more });
const win36 = (id, levelId, wallId, offset, sill = 3) => ({ id, wallId, levelId, view: 'plan', type: 'window',
  offset, width: 3, sillHeight: sill, headHeight: sill + 4, casement: 'single' });
const house = (patch = {}) => ({
  version: 1, levels: LEVELS, activeWallType: 'stud_2x6', buildType: 'twoStorey',
  walls: [
    wall('n', 3, [0, 0], [30, 0]), wall('e', 3, [30, 0], [30, 20]), wall('s', 3, [30, 20], [0, 20]), wall('w', 3, [0, 20], [0, 0]),
    wall('p', 3, [15, 0], [15, 20], { wallType: 'stud_2x4' }),
    wall('n2', 5, [0, 0], [30, 0]), wall('e2', 5, [30, 0], [30, 20]),
    wall('fn', 1, [0, 0], [30, 0], { view: 'foundation', wallType: 'concrete_8' }),
  ],
  fenestrations: [
    win36('w3', 3, 'e', 4, 3.5), win36('w1', 3, 'n', 3), win36('w2', 3, 'n', 9),
    win36('w4', 5, 'n2', 3), win36('w5', 5, 'n2', 9),
    { id: 'w6', wallId: 'e2', levelId: 5, view: 'plan', type: 'window', offset: 4, width: 5, sillHeight: 4, headHeight: 7, casement: 'double' },
    { id: 'w7', wallId: 'e2', levelId: 5, view: 'plan', type: 'window', offset: 12, width: 3, sillHeight: 5, headHeight: 7, casement: 'single' },
    { id: 'd1', wallId: 'n', levelId: 3, view: 'plan', type: 'door', offset: 20, width: 3, sillHeight: 0, headHeight: 80 / 12, doorType: 'ext', doorStyle: 'single' },
    { id: 'd2', wallId: 'p', levelId: 3, view: 'plan', type: 'door', offset: 3, width: 32 / 12, sillHeight: 0, headHeight: 80 / 12, doorType: 'int', doorStyle: 'pocket' },
    { id: 'd3', wallId: 'p', levelId: 3, view: 'plan', type: 'door', offset: 8, width: 32 / 12, sillHeight: 0, headHeight: 80 / 12, doorType: 'int', doorStyle: 'single' },
    { id: 'd4', wallId: 'p', levelId: 3, view: 'plan', type: 'door', offset: 13, width: 32 / 12, sillHeight: 0, headHeight: 80 / 12, doorType: 'int', doorStyle: 'single' },
    { id: 'd5', wallId: 'w', levelId: 3, view: 'plan', type: 'door', offset: 6, width: 2.5, sillHeight: 0, headHeight: 80 / 12, doorType: 'ext', doorStyle: 'sidelight', sidelightWidth: 14 / 12, sidelightSides: 'latch' },
    { id: 'g1', wallId: 's', levelId: 3, view: 'plan', type: 'door', offset: 2, width: 16, sillHeight: 0, headHeight: 7, garage: true },
  ],
  levelAssemblies: {
    1: { wallHeightFt: 8 + 1.5 / 12, slabThicknessIn: 4, footingDepthIn: 8, wallType: 'concrete_8' },
    3: { wallHeightFt: 9, joistDepthIn: 11.875, sheathingIn: 0.75 },
    5: { wallHeightFt: 8, joistDepthIn: 9.25, sheathingIn: 0.75 },
  },
  roofPitch: 6, roofOverhang: 1.5,
  ...patch,
});

const read = saved => {
  const levels = format.levels(saved.levels);
  const levelIds = new Set(levels.map(level => level.id));
  return { fenestrations: format.fenestrations(saved.fenestrations, levelIds), levels, metric: saved.units === 'metric' };
};

// ── THE SCHEDULES ──────────────────────────────────────────────────────────
{
  const s = S.openingSchedules(read(house()));
  same('the narrowest first, then by height: the 36 x 24 is W1, the five 36 x 48 singles ONE row W2, the 60 x 36 W3',
    s.windows.map(r => [r.mark, r.qty, r.size]), [['W1', 1, '36 x 24"'], ['W2', 5, '36 x 48"'], ['W3', 1, '60 x 36"']]);
  same('W2 quotes the lowest sill of the five, 3\'-0", not the 3\'-6" it met first', s.windows[1].sill, '3\'-0"');
  same('W2 stands on both floors, the higher named first', s.windows[1].levels, ['2ND FL', 'MAIN FL']);
  same('W3 is a double casement on the 2ND FL', [s.windows[2].casementWord, s.windows[2].levels], ['DOUBLE', ['2ND FL']]);
  same('doors: exterior first from the narrowest, then interior, then the overhead door as G1',
    s.doors.map(r => [r.mark, r.qty, r.size, r.kindWord, r.styleWord]), [
      ['D1', 1, '30 x 80"', 'EXTERIOR', 'W/ SIDELIGHT'],
      ['D2', 1, '36 x 80"', 'EXTERIOR', 'SINGLE'],
      ['D3', 1, '32 x 80"', 'INTERIOR', 'POCKET'],
      ['D4', 2, '32 x 80"', 'INTERIOR', 'SINGLE'],
      ['G1', 1, '16\'-0" x 7\'-0"', 'OVERHEAD', 'SECTIONAL'],
    ]);
  same('the sidelight is said in REMARKS', s.doors[0].remarks, 'SIDELIGHT 14" LATCH SIDE');
  same('the keys are the estimate\'s own', s.doors.map(r => r.key),
    ['8-A:ext:sidelight:30', '8-A:ext:single:36', '8-A:int:pocket:32', '8-A:int:single:32', '8-A:garage:192x84']);
  const marks = S.marksById(s);
  same('every opening can be found by its mark', ['w3', 'w7', 'd4', 'g1'].map(id => marks.get(id)), ['W2', 'W1', 'D4', 'G1']);
  const table = S.scheduleTable(s, 'door');
  same('the door table\'s heads', table.columns.map(c => c.head), ['MARK', 'QTY', 'SIZE (W x H)', 'TYPE', 'STYLE', 'LEVEL', 'REMARKS']);
  same('a row of the door table', table.rows[3], ['D4', '2', '32 x 80"', 'INTERIOR', 'SINGLE', 'MAIN FL', '']);
  const metric = S.openingSchedules(read(house({ units: 'metric' })));
  same('metric: millimetres to 5, the garage door too', [metric.windows[1].size, metric.doors[4].size], ['915 x 1220 mm', '4875 x 2135 mm']);
  const empty = S.scheduleTable(S.openingSchedules(read(house({ fenestrations: [] }))), 'window');
  same('no windows: no rows, and a line that says so', [empty.rows, empty.empty], [[], 'NO WINDOWS ON THE DRAWING YET']);
}

// ── THE WALL SECTION OFF PROJECT'S NUMBERS ─────────────────────────────────
{
  const built = WS.buildWallSection(house());
  const v = built.values;
  same('a two storey sections both floors, bottom up', v.floors.map(f => [f.name, f.wallHeightFt, f.joistDepthIn]),
    [['MAIN FL', 9, 11.875], ['2ND FL', 8, 9.25]]);
  near('the pour is the bearing line less the plate: 8\'-0"', v.foundation.wallHeightFt, 8);
  same('8" concrete on a 20" x 8" footing, a 4" slab, a 1 1/2" sill',
    [v.foundation.thicknessIn, v.foundation.footingWidthIn, v.foundation.footingDepthIn, v.foundation.slabIn, v.foundation.attachment, v.foundation.attachmentIn],
    [8, 20, 8, 4, 'sill', 1.5]);
  same('the roof as the file says it: 6:12, 1\'-6" eave, 2x6 fascia', [v.roof.pitch, v.roof.overhangFt, v.roof.fasciaIn], [6, 1.5, 5.5]);
  const texts = built.labels.map(l => l.text);
  same('the callouts', ['6:12', '1\'-6" O/H', '2x6 FASCIA', '2x6 STUDS @ 16" O.C.', '9\'-0" WALL', '8\'-0" WALL',
    '11 7/8" JOISTS', '9 1/4" JOISTS', '1 1/2" SILL PLATE', '8" CONC. WALL', '8\'-0" HIGH', '20" x 8" CONC. FOOTING', '4" CONC. SLAB']
    .filter(t => !texts.includes(t)), []);
  // THE WINDOWS. 0 is the top of the main floor sheathing; the sill plate
  // sits a floor package (12 5/8") and a plate (1 1/2") below it.
  const concTop = -(11.875 + 0.75) / 12 - 1.5 / 12;
  const w = built.windows;
  same('the floor window holds the sill plate and the floor above it',
    [w.floor.minY < concTop, w.floor.maxY > 0, w.floor.maxX - w.floor.minX], [true, true, 4.5]);
  near('the footing window reaches under the footing', w.footing.minY, concTop - 8 - 8 / 12 - 0.8);
  same('the eave window holds the eave and the wall top',
    [w.eave.minX < -1.5, w.eave.maxX > 0.46, w.eave.minY < 17.05, w.eave.maxY > 17.05], [true, true, true, true]);
  same('the four windows are the four details', Object.keys(w), WS.DETAIL_IDS);

  const bungalow = WS.buildWallSection(house({ buildType: 'bungalow' }));
  same('a bungalow sections the main floor alone', bungalow.values.floors.map(f => f.name), ['MAIN FL']);
  const icf = WS.buildWallSection(house({ levelAssemblies: { ...house().levelAssemblies, 1: { wallHeightFt: 8.125, slabThicknessIn: 4, footingDepthIn: 8, wallType: 'icf' } }, foundationAttachment: 'ladder' }));
  same('an ICF foundation: 11 1/4" thick on a 24" footing, and a ladder cannot be set into it',
    [icf.values.foundation.thicknessIn, icf.values.foundation.footingWidthIn, icf.values.foundation.attachment], [11.25, 24, 'sill']);
  const ladder = WS.buildWallSection(house({ foundationAttachment: 'ladder', foundationLadderIn: 5.5 }));
  same('a PT ladder on concrete is lettered as one', ladder.labels.map(l => l.text).includes('5 1/2" PT LADDER'), true);
  const beam = WS.buildWallSection(house({ levelAssemblies: { ...house().levelAssemblies, 1: { wallHeightFt: 4, slabThicknessIn: 4, footingDepthIn: 8, wallType: 'icf', foundationKind: 'gradebeam' } } }));
  same('a grade beam is 8" whatever the wall type says (here ICF), on piles with a void form',
    [beam.values.foundation.thicknessIn, beam.labels.some(l => l.text === 'PILE'), beam.labels.some(l => l.text === 'VOID FORM')], [8, true, true]);
  const icfStorey = WS.buildWallSection(house({ levelAssemblies: { ...house().levelAssemblies, 5: { wallHeightFt: 8, joistDepthIn: 9.25, sheathingIn: 0.75, wallType: 'icf' } } }));
  same('a storey\'s own wall type overrides the house\'s', icfStorey.values.floors.map(f => f.wallType), ['stud_2x6', 'icf']);
  same('no floor level, no section', WS.buildWallSection({ version: 1, levels: [{ id: 8, name: 'SITE', elev: 0 }] }), null);
}

console.log(failed ? `  ${failed} of ${ran} checks FAILED` : `  ${ran} checks passed`);
process.exit(failed ? 1 : 0);
