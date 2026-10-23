#!/usr/bin/env node
// estimates.js -- THE QUANTITIES OFF THE DRAWING, under the spec's numbers
// (Movie, 23 Oct). A house with two shaped rooms, a roof, four shell walls
// with a window and two doors, an interior wall with a door, a garage door.
// Every number below is worked by hand from that house.
//
// Run: node proto/estimates-harness.js
//      node proto/estimates-harness.js --mutate
const MUTATE = require('./harness-args.js').mutationMode();
const path = require('path');
const { loadDraftModules } = require('./harness-env.js');

const ROOT = path.join(__dirname, '..');

const MUTATIONS = [
  ['flooring waste is ignored', 'estimates.js',
    c => c.replace("        net, waste, qty: withWaste(net, waste), rooms });", "        net, waste, qty: net, rooms });")],
  ['a room with no flooring set is priced as if it were', 'estimates.js',
    c => c.replace("        const price = row.unassigned ? null : priceOf(row.key);", "        const price = priceOf(row.key);")],
  ['a roof is counted flat, whatever its pitch', 'estimates.js',
    c => c.replace("      const mult = Math.sqrt(144 + pitch * pitch) / 12;", "      const mult = 1;")],
  ['an exterior wall keeps its openings in the cladding', 'estimates.js',
    c => c.replace("      g.gross += gross; g.openings += Math.min(openings, gross); g.walls += 1;", "      g.gross += gross; g.walls += 1;")],
  ['an interior wall is clad as the shell is', 'estimates.js',
    c => c.replace("      return thick(wall) >= EXTERIOR_MIN_IN;", "      return true;")],
  ['a wall on the outline is told by its ends alone, so a partition wall to wall is the shell\'s', 'estimates.js',
    c => c.replace("        return onOutline(wall.start, pts) && onOutline(wall.end, pts) && onOutline(mid, pts);", "        return onOutline(wall.start, pts) && onOutline(wall.end, pts);")],
  ['an exterior door is counted with the interior ones', 'estimates.js',
    c => c.replace("      const kind = garage ? 'garage' : (o.doorType === 'ext' ? 'ext' : 'int');", "      const kind = garage ? 'garage' : 'int';")],
  ['a garage door is counted as a door of its width', 'estimates.js',
    c => c.replace("      const garage = o.garage === true || o.doorType === 'garage';", "      const garage = false;")],
  ['two windows of one width are one size whatever their heights', 'estimates.js',
    c => c.replace("      const key = `8-B:${w}x${h}`;", "      const key = `8-B:${w}`;")],
  ['a price is applied to the net area, not the area with waste', 'estimates.js',
    c => c.replace("        return { ...row, price, amount: price == null ? null : round2(row.qty * price) };", "        return { ...row, price, amount: price == null ? null : round2(row.net * price) };")],
  ['the sections come in the order they were counted, not the spec\'s', 'estimates.js',
    c => c.replace("    const sections = (master ? master.sections() : []).map(section => {", "    const sections = (master ? master.sections().slice().reverse() : []).map(section => {")],
  ['the format keeps any waste percent, even a negative one', 'drawing-format.js',
    c => c.replace("      return Number.isFinite(v) && v >= 0 && v <= 100 ? Math.round(v * 10) / 10 : null;", "      return Number.isFinite(v) ? Math.round(v * 10) / 10 : null;")],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('estimates',
    MUTATIONS, { root: ROOT, harness: __filename });
  process.exit(all ? 0 : 1);
}

const win = loadDraftModules();
const { estimateSections } = win.DraftEstimates;
const format = win.DraftDrawingFormat;

let failed = 0, ran = 0;
const near = (label, got, want, tol = 0.11) => {
  ran += 1;
  if (!(Math.abs(got - want) <= tol)) { failed += 1; console.log(`  FAIL ${label}\n       got ${got}, want ${want}`); }
};
const same = (label, got, want) => {
  ran += 1;
  if (got !== want) { failed += 1; console.log(`  FAIL ${label}\n       got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }
};

// ── THE HOUSE ──────────────────────────────────────────────────────────────
// 20 x 12 outside, 2x6 shell walls 9 ft high; one 2x4 partition. A 36 x 48
// window and a 36" exterior door on the north wall; a 32" pocket door and a
// 32" single on the partition; a 16' x 7' garage door on the south wall.
// A tiled WC 8 x 6, a laminate bedroom 10 x 8, an untagged-finish den 6 x 6.
// One gable roof 24 x 16 at the eave, 6/12, asphalt.
const P = (x, z) => ({ x, y: 0, z });
const W = (id, a, b, wallType, more = {}) => ({ id, levelId: 3, view: 'plan', wallType, refLine: 'center',
  baseHeight: 0, topHeight: 9, start: P(...a), end: P(...b), ...more });
const LEVELS = [{ id: 7, name: 'ROOF', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 }];
const house = () => ({
  version: 1, levels: LEVELS, activeLevelIdx: 1,
  walls: [
    W('n', [0, 0], [20, 0], 'stud_2x6', { finish: 'siding_h' }),
    W('e', [20, 0], [20, 12], 'stud_2x6', { finish: 'siding_h' }),
    W('s', [20, 12], [0, 12], 'stud_2x6', { finish: 'stucco' }),
    W('w', [0, 12], [0, 0], 'stud_2x6'),
    W('p', [10, 0], [10, 12], 'stud_2x4'),
  ],
  fenestrations: [
    { id: 'win1', wallId: 'n', levelId: 3, view: 'plan', type: 'window', offset: 3, width: 3, sillHeight: 3, headHeight: 7 },
    { id: 'door1', wallId: 'n', levelId: 3, view: 'plan', type: 'door', offset: 14, width: 3, sillHeight: 0, headHeight: 80 / 12, doorType: 'ext', doorStyle: 'single' },
    { id: 'door2', wallId: 'p', levelId: 3, view: 'plan', type: 'door', offset: 3, width: 32 / 12, sillHeight: 0, headHeight: 80 / 12, doorType: 'int', doorStyle: 'pocket' },
    { id: 'door3', wallId: 'p', levelId: 3, view: 'plan', type: 'door', offset: 8, width: 32 / 12, sillHeight: 0, headHeight: 80 / 12, doorType: 'int', doorStyle: 'single' },
    { id: 'gar', wallId: 's', levelId: 3, view: 'plan', type: 'door', offset: 2, width: 16, sillHeight: 0, headHeight: 7, garage: true },
  ],
  roomTags: [
    { id: 1, at: { x: 4, z: 3 }, levelId: 3, view: 'plan', name: 'WC', stamped: true, flooring: { type: 'tile' },
      points: [{ x: 0, z: 0 }, { x: 8, z: 0 }, { x: 8, z: 6 }, { x: 0, z: 6 }] },
    { id: 2, at: { x: 15, z: 4 }, levelId: 3, view: 'plan', name: 'BEDROOM', stamped: true, flooring: { type: 'laminate' },
      points: [{ x: 10, z: 0 }, { x: 20, z: 0 }, { x: 20, z: 8 }, { x: 10, z: 8 }] },
    { id: 3, at: { x: 3, z: 9 }, levelId: 3, view: 'plan', name: 'DEN', stamped: true,
      points: [{ x: 0, z: 6 }, { x: 6, z: 6 }, { x: 6, z: 12 }, { x: 0, z: 12 }] },
  ],
  roofs: [{ id: 'r1', levelId: 7, pitch: 6, roofing: 'asphalt', overhang: 2, edges: ['eave', 'eave', 'eave', 'eave'],
    points: [P(-2, -2), P(22, -2), P(22, 14), P(-2, 14)] }],
  outlines: [], floors: [], lines: [], dimensions: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  columns: [], beams: [], boneyardOutlines: [], levelLocks: [], underlays: [], fixtures: [],
});

// A price typed against NO FLOORING SET is never applied: the row is a
// list of rooms still to be given a finish, not a quantity to buy.
const out = estimateSections(house(), format.estimates({ prices: { '9-A:tile': 2.5, '9-A:none': 1 } }));
const by = id => out.sections.find(s => s.id === id);
const row = (id, key) => (by(id).rows.find(r => r.key === key) || {});

// ── IN THE SPEC'S ORDER, under its numbers ─────────────────────────────────
const spec = win.DraftSpecMaster.sections().map(s => s.id);
same('every spec section is a section here, in the spec\'s order', out.sections.map(s => s.id).join(','), spec.join(','));
same('a section with nothing to count has no rows', by('3-A').rows.length, 0);
same('the counted sections are the five', out.counted.join(','), '7-B,8-A,8-B,9-A,9-B');

// ── 9-A: the floors the room shapes lay ────────────────────────────────────
near('tile: the WC, 48 sq ft net', row('9-A', '9-A:tile').net, 48);
near('tile: 55.2 with 15% waste', row('9-A', '9-A:tile').qty, 55.2);
near('laminate: the bedroom, 80 net, 92 with waste', row('9-A', '9-A:laminate').qty, 92);
same('the den has no flooring set, and says so', row('9-A', '9-A:none').label, 'NO FLOORING SET');
near('the den\'s 36 sq ft are listed, no waste', row('9-A', '9-A:none').qty, 36);
same('and never priced', row('9-A', '9-A:none').amount, null);
near('tile at 2.50: 55.2 x 2.50 = 138', row('9-A', '9-A:tile').amount, 138);
near('the section total is the priced rows\'', by('9-A').total, 138);
near('and the grand total', out.total, 138);
same('an unpriced row has no amount', row('9-A', '9-A:laminate').amount, null);

// ── 7-B: the roof by pitch ─────────────────────────────────────────────────
// 24 x 16 = 384 flat; 6/12 is sqrt(180)/12 = 1.1180; sloped 429.3; with 15%
// waste 493.7 sq ft, 4.94 squares.
near('asphalt 6/12: flat 384 to sloped 429.3', row('7-B', '7-B:asphalt:6').net, 429.3);
near('493.7 with waste', row('7-B', '7-B:asphalt:6').qty, 493.7);
near('4.94 squares', row('7-B', '7-B:asphalt:6').squares, 4.94, 0.011);

// ── 9-B: the shell's walls, less openings, by finish ───────────────────────
// north 20 x 9 = 180 less the window 12 and the door 20 = 148; east 12 x 9 =
// 108: siding 256 net, 294.4 with waste. South 180 less the garage door 112
// = 68 stucco, 78.2 with waste. West 108 with no finish set.
near('H. siding: north and east, 256 net', row('9-B', '9-B:siding_h').net, 256);
near('294.4 with waste', row('9-B', '9-B:siding_h').qty, 294.4);
near('stucco: the south wall less the garage door, 68', row('9-B', '9-B:stucco').net, 68);
near('the west wall has no finish set: 108, no waste', row('9-B', '9-B:none').qty, 108);
same('the partition is not clad', by('9-B').rows.length, 3);

// ── 8-A, 8-B: counted by size ──────────────────────────────────────────────
same('one exterior 36" door', row('8-A', '8-A:ext:single:36').qty, 1);
same('one 32" pocket and one 32" single inside', `${row('8-A', '8-A:int:pocket:32').qty}/${row('8-A', '8-A:int:single:32').qty}`, '1/1');
same('the overhead door on its own, 192 x 84', row('8-A', '8-A:garage:192x84').qty, 1);
same('and not as a 192" door', row('8-A', '8-A:ext:single:192').qty, undefined);
same('exterior doors come first', by('8-A').rows[0].key, '8-A:ext:single:36');
same('one 36 x 48 window', row('8-B', '8-B:36x48').qty, 1);
same('its label', row('8-B', '8-B:36x48').label, 'WINDOW 36 x 48"');

// ── A second house: the outline decides the shell ──────────────────────────
// With a house outline, a 2x6 wall off it is not the shell's, and a 2x4 on
// it is.
const withOutline = house();
withOutline.outlines = [{ id: 'o1', levelId: 3, points: [P(0, 0), P(20, 0), P(20, 12), P(0, 12)] }];
withOutline.walls.push(W('x', [4, 4], [8, 4], 'stud_2x6'));
withOutline.walls.find(w => w.id === 'w').wallType = 'stud_2x4';
const out2 = estimateSections(withOutline, {});
const ext2 = out2.sections.find(s => s.id === '9-B').rows;
near('on the outline: the 2x4 west wall is still clad (108, no finish)', (ext2.find(r => r.key === '9-B:none') || {}).net, 108);
same('and the 2x6 off it is not', ext2.reduce((n, r) => n + Number(r.detail.split(' wall')[0]), 0), 4);

// ── Waste and the format ───────────────────────────────────────────────────
const out3 = estimateSections(house(), format.estimates({ waste: { flooring: 10, roofing: 0 } }));
near('10% flooring waste: tile 52.8', out3.sections.find(s => s.id === '9-A').rows.find(r => r.key === '9-A:tile').qty, 52.8);
near('0% roofing waste: the sloped area itself', out3.sections.find(s => s.id === '7-B').rows[0].qty, 429.3);
same('the format drops a negative waste and a bad price', JSON.stringify(format.estimates({ waste: { flooring: -5, roofing: 'x', exterior: 12.25 }, prices: { a: -1, b: '3.456', c: 'no' } })),
  '{"waste":{"exterior":12.3},"prices":{"b":3.46}}');

console.log(failed ? `\n  ${failed} of ${ran} checks FAILED\n` : `\n  ${ran} checks passed\n`);
process.exit(failed ? 1 : 0);
