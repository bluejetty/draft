#!/usr/bin/env node
// THE DEFAULT KITCHEN IS MOVIE'S CORNER L, IN WHICHEVER CORNER IT IS PRESSED.
//
// kitchen-presets.js finds the corner two walls make under a press, decides
// which leg is which, and lays the fixtures from the INSIDE corner --
// where the two wall faces meet, not where their lines cross. These checks
// hold it to the studio suite's sheet (NORTH_POINT_S_SUITE.pdf, 17 Oct):
// the 8'-6" legs, the pieces and their order, that every piece lands inside
// the room through fixture-geometry.js (the same module the plan draws them
// with), that F swaps the legs, and when a corner is refused. And the
// suites' KITCHEN U1, L2 and L3 (17-18 Oct): their legs, and the island or
// peninsula floated off a leg's wall, inside the room however it is turned.
//
// Run: node proto/kitchen-presets-harness.js
//      node proto/kitchen-presets-harness.js --mutate
const MUTATE = require('./harness-args.js').mutationMode();
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const MUTATIONS = [
  ['the kitchen\'s own walls do not share a corner', 'kitchen-presets.js',
    c => c.replace("        { key: 'side', start: corner, end: P(h, needFt(p, flip ? 'second' : 'first')), wallType: 'stud_2x4', refLine: 'center' },",
      "        { key: 'side', start: P(h, -h), end: P(h, needFt(p, flip ? 'second' : 'first')), wallType: 'stud_2x4', refLine: 'center' },")],
  ['F does not swap the kitchen\'s own walls\' lengths', 'kitchen-presets.js',
    c => c.replace("end: P(-needFt(p, flip ? 'first' : 'second'), -h)", "end: P(-needFt(p, 'second'), -h)")
      .replace("end: P(h, needFt(p, flip ? 'second' : 'first'))", "end: P(h, needFt(p, 'first'))")],
  ['[ ] does not turn the kitchen\'s own walls', 'kitchen-presets.js',
    c => c.replace('    const t = (angleDeg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);',
      '    const t = 0, c = Math.cos(t), s = Math.sin(t);')],
  ['the sink and stove legs trade places', 'kitchen-presets.js',
    c => c.replace('cross < 0 ? [B, A] : [A, B];', 'cross < 0 ? [A, B] : [B, A];')],
  ['F swaps nothing', 'kitchen-presets.js',
    c => c.replace('    if (flip) [firstLeg, secondLeg] = [secondLeg, firstLeg];\n', '')],
  ['the corner is measured where the lines cross, not where the faces meet', 'kitchen-presets.js',
    c => c.replace('      const inside = cornerAlong + push;', '      const inside = cornerAlong;')],
  ['a short leg is laid anyway', 'kitchen-presets.js',
    c => c.replace('    if (short) {', '    if (false) {')],
  ['the legs run away from the press', 'kitchen-presets.js',
    c => c.replace('      const dir = t >= cornerAlong ? 1 : -1;', '      const dir = t >= cornerAlong ? -1 : 1;')],
  ['every piece faces out of the room', 'kitchen-presets.js',
    c => c.replace('      const side = across >= (f.startOff + f.endOff) / 2 ? 1 : -1;',
      '      const side = across >= (f.startOff + f.endOff) / 2 ? -1 : 1;')],
  ['a corner is found at any distance', 'kitchen-presets.js',
    c => c.replace('        if (d > reachFt || (best && d >= best.d)) continue;',
      '        if (best && d >= best.d) continue;')],
  ['walls at any angle make a corner', 'kitchen-presets.js',
    c => c.replace("        if (Math.abs(dot({ x: A.frame.ux, z: A.frame.uz }, { x: B.frame.ux, z: B.frame.uz })) > 0.05) continue;\n", '')],
  ['a cabinet run is as wide as one piece', 'kitchen-presets.js',
    c => c.replace('        width: runs ? piece.to - piece.from : piece.width,', '        width: piece.width || 2,')],
  ['an island sits against its wall', 'kitchen-presets.js',
    c => c.replace('        ...(piece.standoff ? { standoff: piece.standoff } : {}),\n', '')],
  ['a leg needs only as far as its pieces\' middles', 'kitchen-presets.js',
    c => c.replace("piece.centre + piece.width / 2);", "piece.centre);")],
  ['the sheet\'s bay is ignored', 'kitchen-presets.js',
    c => c.replace('Math.max(p[`${leg}Ft`] || 0, ', 'Math.max(0, ')],
  ['the U1 peninsula sits at the island\'s 42"', 'kitchen-presets.js',
    c => c.replace("{ kind: 'island', centre: 48 * IN, width: 8, depth: 3, standoff: 92.5 * IN }",
      "{ kind: 'island', centre: 48 * IN, width: 8, depth: 3, standoff: 66 * IN }")],
  ['the stove leg starts in the corner, through the other counter', 'kitchen-presets.js',
    c => c.replace("        { kind: 'cabinet', from: 2, to: 5.5 },", "        { kind: 'cabinet', from: 0, to: 5.5 },")],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('kitchen-presets',
    MUTATIONS, { root: ROOT, harness: __filename });
  process.exit(all ? 0 : 1);
}

// A mutant arrives as a file of replacement sources (mutant-subprocess.js).
const OVERRIDES = process.env.DRAFT_HARNESS_SOURCE_OVERRIDES
  ? JSON.parse(fs.readFileSync(process.env.DRAFT_HARNESS_SOURCE_OVERRIDES, 'utf8')) : {};
const win = {};
for (const file of ['wall-types.js', 'fixture-geometry.js', 'closets.js', 'fixture-kinds.js', 'kitchen-presets.js']) {
  const text = OVERRIDES[file] != null ? OVERRIDES[file] : fs.readFileSync(path.join(ROOT, file), 'utf8');
  try {
    new Function('window', text)(win);
  } catch (err) {
    console.error(`${file} did not load: ${err.message}`);
    process.exit(3);
  }
}
const KP = win.DraftKitchenPresets;
const FG = win.DraftFixtureGeometry;
const K = win.DraftFixtureKinds;
const depthOf = kind => K.kindFor(kind).depthFt;

let failed = 0, ran = 0;
const check = (label, got, want) => {
  ran += 1;
  if (String(got) === String(want)) return;
  failed += 1;
  console.log(`  FAIL ${label}\n       got  ${got}\n       want ${want}`);
};
const r2 = n => Math.round(n * 100) / 100;
const inches = ft => Math.round(ft * 12 * 10) / 10;

// THE STUDIO SUITE'S CORNER: the end wall running west from the corner at
// (10, 0), the balcony wall running south from it (x right, z down the
// screen), both 2x6 on their centre lines; the room is to the south-west.
const wall = (id, ax, az, bx, bz, extra = {}) => ({ id, start: { x: ax, y: 0, z: az }, end: { x: bx, y: 0, z: bz },
  levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center', ...extra });
const END = wall('end', -20, 0, 10, 0);
const BALCONY = wall('balcony', 10, 0, 10, 18);
const WALLS = [END, BALCONY];
const PRESS = { x: 8.5, z: 1.5 };
const HALF_6 = 2.75 / 12;
const geoOf = (f, walls = WALLS) => FG.fixtureGeometry(walls, { kind: f.kind, wallId: f.wall.id, offset: f.offset,
  width: f.width, depth: f.depth, side: f.side, ...(f.standoff ? { standoff: f.standoff } : {}) });

// ── THE CORNER UNDER THE PRESS ──────────────────────────────────────────
{
  const corner = KP.findCorner(WALLS, PRESS, FG);
  check('a press 1\'-6" inside the corner finds it', Boolean(corner), true);
  const by = id => corner.legs.find(l => l.wall.id === id);
  check('the balcony leg runs south from the corner', `${by('balcony').dir} ${r2(by('balcony').cornerAlong)}`, `1 ${r2(HALF_6)}`);
  check('the end-wall leg runs west from the corner', `${by('end').dir} ${r2(by('end').cornerAlong)}`, `-1 ${r2(30 - HALF_6)}`);
  check('both faces look at the room', corner.legs.map(l => l.side).join(' '), '1 1');
  check('the clear run is the wall less the corner face', r2(by('balcony').clearFt), r2(18 - HALF_6));
  check('a press 6\' off the corner is out of reach', Boolean(KP.findCorner(WALLS, { x: 4, z: 5 }, FG)), false);
  const SKEW = wall('skew', 10, 0, -4, 14);
  check('a wall at 45 degrees makes no corner', Boolean(KP.findCorner([END, SKEW], PRESS, FG)), false);
  const APART = wall('apart', 12, 2, 12, 18);
  check('two walls that never meet make no corner', Boolean(KP.findCorner([END, APART], PRESS, FG)), false);
}

// ── KITCHEN L1 AS THE SUITE HAS IT ──────────────────────────────────────
{
  const corner = KP.findCorner(WALLS, PRESS, FG);
  const kit = KP.place('L1', corner, { depthOf });
  check('six pieces', kit.fixtures.length, 6);
  check('the sink leg is the balcony wall, the stove leg the end wall',
    `${kit.firstLeg.wall.id} ${kit.secondLeg.wall.id}`, 'balcony end');
  const on = (id, kind) => kit.fixtures.find(f => f.wall.id === id && f.kind === kind);
  check('sink and DW on the balcony wall, range and fridge on the end wall',
    [on('balcony', 'sink'), on('balcony', 'dish'), on('end', 'stove'), on('end', 'fridge')].every(Boolean), true);
  // From the inside corner, south along the balcony wall.
  const south = f => inches(geoOf(f).alongStart - HALF_6) + '..' + inches(geoOf(f).alongEnd - HALF_6);
  check('the corner counter starts at the inside corner and runs 8\'-6"', south(on('balcony', 'cabinet')), '0..102');
  check('the 30" sink is centred 4\'-5" down the leg', south(on('balcony', 'sink')), '38..68');
  // Re-measured off the sheet at 300 dpi (Movie, 17 Oct: "check the predrawn
  // kitchens"): the DW's centre is 7'-2 1/2" down, not at the leg's end.
  check('the 24" DW sits 7\'-2 1/2" down the leg, its centre', south(on('balcony', 'dish')), '74.5..98.5');
  // From the inside corner, west along the end wall.
  const west = f => inches((30 - HALF_6) - geoOf(f).alongEnd) + '..' + inches((30 - HALF_6) - geoOf(f).alongStart);
  check('the end-wall counter starts past the 24" corner counter', west(on('end', 'cabinet')), '24..66');
  check('the 24" apartment range is on it, 3\'-5" from the corner to its centre', west(on('end', 'stove')), '29..53');
  check('the 36" fridge bay ends the leg', west(on('end', 'fridge')), '66..102');
  // Depths are the catalogue's, so the preset's fridge is the hand-dropped one.
  check('the fridge is the catalogue\'s 30" deep', r2(on('end', 'fridge').depth), r2(K.kindFor('fridge').depthFt));
  // Every piece projects into the room: south of the end wall's face and
  // west of the balcony wall's.
  const out = kit.fixtures.filter(f => {
    const c = geoOf(f).center;
    return !(c.z > HALF_6 && c.x < 10 - HALF_6);
  }).map(f => f.kind);
  check('every piece inside the room', out.join(',') || 'none', 'none');
}

// ── F SWAPS THE LEGS ─────────────────────────────────────────────────────
{
  const corner = KP.findCorner(WALLS, PRESS, FG);
  const kit = KP.place('L1', corner, { depthOf, flip: true });
  check('mirrored, the sink leg is the end wall', `${kit.firstLeg.wall.id} ${kit.secondLeg.wall.id}`, 'end balcony');
  const sink = kit.fixtures.find(f => f.kind === 'sink');
  check('and the sink is 4\'-5" west of the corner', inches((30 - HALF_6) - sink.offset), 53);
}

// ── THE MIRROR-IMAGE CORNER, UNFLIPPED ───────────────────────────────────
{
  // Corner at the top LEFT, room to the south-east: the end wall runs east
  // from it, the side wall south. Clockwise from the sink leg is the stove
  // leg, so here the sink goes along the END wall.
  const SIDE = wall('side', -20, 0, -20, 18);
  const corner = KP.findCorner([END, SIDE], { x: -18.5, z: 1.5 }, FG);
  const kit = KP.place('L1', corner, { depthOf });
  check('in the mirror-image corner the sink leg is the end wall', `${kit.firstLeg.wall.id} ${kit.secondLeg.wall.id}`, 'end side');
}

// ── A WALL DRAWN ON ITS FACE ─────────────────────────────────────────────
{
  // The end wall drawn on its outside face ('left': the body lies on the
  // +n side, which is +z, the room side): the inside corner is a full
  // 5 1/2" south of its line.
  const FACE_END = wall('end', -20, 0, 10, 0, { refLine: 'left' });
  const corner = KP.findCorner([FACE_END, BALCONY], PRESS, FG);
  const balcony = corner.legs.find(l => l.wall.id === 'balcony');
  check('the inside corner is past the whole wall body', r2(balcony.cornerAlong * 12), 5.5);
}

// ── REFUSED, AND SAID WHICH LEG ──────────────────────────────────────────
{
  const SHORT = wall('balcony', 10, 0, 10, 6);
  const corner = KP.findCorner([END, SHORT], PRESS, FG);
  const kit = KP.place('L1', corner, { depthOf });
  check('a 6\' balcony wall is refused', Boolean(kit.refused), true);
  check('and the sentence names the sink leg and the 8\'-6"', /sink leg.*5'-9"/.test(kit.refused) && /8'-6"/.test(kit.refused), true);
  check('flipped, the stove leg is the short one', /stove leg/.test(KP.place('L1', corner, { depthOf, flip: true }).refused), true);
}

// ── ITS OWN TWO WALLS, IN OPEN FLOOR ─────────────────────────────────────
// Movie, 17 Oct: "not working yet like the WCs which work good". With no
// corner under the press the kitchen brings two 2x4s, inside faces meeting
// at the press, and lays itself against them exactly as it would in a room.
{
  const at = { x: 3, z: -2 };
  const own = KP.ownWalls('L1', at, 0);
  check('it brings two walls', own.walls.length, 2);
  check('that share their corner, so it mitres', own.walls[0].start === own.walls[1].start, true);
  const corner = KP.findCorner(own.walls, own.inside, FG);
  check('their inside corner is the press', corner && `${r2(corner.legs[0].wall.start.x - 1.75 / 12)},${r2(corner.legs[0].wall.start.z + 1.75 / 12)}`, '3,-2');
  const kit = KP.place('L1', corner, { depthOf });
  check('and the kitchen fits them, 8\'-6" each way', Boolean(kit && !kit.refused), true);
  check('unturned, the sink leg runs down the right wall, as the suite', kit.firstLeg.wall.key, 'side');
  const turned = KP.ownWalls('L1', at, 90);
  const d = turned.walls[0];
  // A quarter turn clockwise on the plan (x right, z down the screen): the
  // wall that ran west now runs north.
  check('[ ] turns them about the press: the top wall now runs north',
    `${r2(d.end.x - d.start.x)},${r2(d.end.z - d.start.z)}`, `0,${r2(-(8.5 + 1.75 / 12))}`);
}

// ── THE SUITES' KITCHENS ─────────────────────────────────────────────────
// In the studio corner (both walls long enough for every leg): the pieces on
// their legs, every one -- the island too -- inside the room, the island's
// sink and dishwasher on the island, and the aisle to the counter.
const SUITES = {
  U1: { first: 'cabinet dish fridge island sink', second: 'cabinet stove', need: '102.5 116', aisle: 68.5 },
  L2: { first: 'cabinet cabinet fridge', second: 'cabinet dish island sink stove', need: '105 174', aisle: 57 },
  L3: { first: 'cabinet fridge', second: 'cabinet dish island sink stove', need: '99 175.5', aisle: 60 },
};
// Past both inside faces: the room's side of each leg's wall.
const inRoom = (pt, corner) => corner.legs.every(leg => {
  const f = leg.frame;
  const across = (pt.x - leg.wall.start.x) * f.nx + (pt.z - leg.wall.start.z) * f.nz;
  return leg.side * across >= (leg.side === 1 ? f.endOff : -f.startOff) - 1e-6;
});
const within = (g, box) => g.corners.every(c => box.some(() => true) && (() => {
  // A point inside a convex quadrilateral: on the same side of every edge.
  const s = box.map((a, i) => {
    const b = box[(i + 1) % box.length];
    return (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
  });
  return s.every(v => v >= -1e-6) || s.every(v => v <= 1e-6);
})());
for (const [id, want] of Object.entries(SUITES)) {
  const corner = KP.findCorner(WALLS, PRESS, FG);
  const kit = KP.place(id, corner, { depthOf });
  check(`${id}: placed in the studio corner`, Boolean(kit && !kit.refused), true);
  check(`${id} is named KITCHEN ${id}`, kit.name, `KITCHEN ${id}`);
  const legOf = leg => kit.fixtures.filter(f => f.leg === leg).map(f => f.kind).sort().join(' ');
  check(`${id}: its first leg`, legOf('first'), want.first);
  check(`${id}: its second leg`, legOf('second'), want.second);
  check(`${id}: each leg needs as far as its furthest piece`,
    `${inches(KP.needFt(id, 'first'))} ${inches(KP.needFt(id, 'second'))}`, want.need);
  const outside = kit.fixtures.filter(f => !geoOf(f).corners.every(c => inRoom(c, corner))).map(f => f.kind);
  check(`${id}: every piece inside the room`, outside.join(',') || 'none', 'none');
  const island = kit.fixtures.find(f => f.kind === 'island');
  const ig = geoOf(island);
  const onIt = kit.fixtures.filter(f => f.standoff && f.kind !== 'island');
  check(`${id}: the sink and the dishwasher stand on the island`,
    onIt.map(f => `${f.kind}:${within(geoOf(f), ig.corners)}`).sort().join(' '), 'dish:true sink:true');
  // The aisle: the island's near face less the counter depth in front of
  // the wall it rides.
  check(`${id}: the aisle between the counter and the island`, inches(island.standoff - depthOf('cabinet')), want.aisle);
}
check('KITCHEN U1 refused in a corner with a 7\' leg, and says which',
  KP.place('U1', KP.findCorner([END, wall('balcony', 10, 0, 10, 7)], PRESS, FG), { depthOf }).refused || 'laid',
  'KITCHEN U1 needs 8\'-7" along the fridge leg and 9\'-8" along the stove leg from the corner — the fridge leg has 6\'-9".');
// IN OPEN FLOOR, TURNED AND MIRRORED: its own walls as long as its legs
// need, every piece at its full width (none clamped short by a short wall)
// and inside the room.
for (const id of ['U1', 'L2', 'L3']) {
  for (const angleDeg of [0, 90, 180, 270]) {
    for (const flip of [false, true]) {
      const own = KP.ownWalls(id, { x: 3, z: -2 }, angleDeg, flip);
      own.walls.forEach(w => { w.id = w.key; w.levelId = 3; w.view = 'plan'; });
      const corner = KP.findCorner(own.walls, own.inside, FG);
      const kit = KP.place(id, corner, { depthOf, flip });
      const tag = `${id} at ${angleDeg}${flip ? ' mirrored' : ''}`;
      if (!kit || kit.refused) { check(`${tag}: laid on its own walls`, kit && kit.refused, 'laid'); continue; }
      const bad = kit.fixtures.filter(f => {
        const g = geoOf(f, own.walls);
        return Math.abs(g.width - f.width) > 1e-6 || !g.corners.every(c => inRoom(c, corner));
      }).map(f => f.kind);
      check(`${tag}: every piece full width, inside the room`, bad.join(',') || 'none', 'none');
    }
  }
}

console.log(`\n${ran - failed}/${ran} checks passed`);
if (failed) process.exitCode = 1;
