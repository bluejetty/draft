#!/usr/bin/env node
// THE DEFAULT KITCHEN IS MOVIE'S CORNER L, IN WHICHEVER CORNER IT IS PRESSED.
//
// kitchen-presets.js finds the corner two walls make under a press, decides
// which leg takes the sink, and lays six fixtures from the INSIDE corner --
// where the two wall faces meet, not where their lines cross. These checks
// hold it to the studio suite's sheet (NORTH_POINT_S_SUITE.pdf, 17 Oct):
// the 8'-6" legs, the pieces and their order, that every piece lands inside
// the room through fixture-geometry.js (the same module the plan draws them
// with), that F swaps the legs, and when a corner is refused.
//
// Run: node proto/kitchen-presets-harness.js
//      node proto/kitchen-presets-harness.js --mutate
const MUTATE = require('./harness-args.js').mutationMode();
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const MUTATIONS = [
  ['the sink and stove legs trade places', 'kitchen-presets.js',
    c => c.replace('cross < 0 ? [B, A] : [A, B];', 'cross < 0 ? [A, B] : [B, A];')],
  ['F swaps nothing', 'kitchen-presets.js',
    c => c.replace('    if (flip) [sinkLeg, stoveLeg] = [stoveLeg, sinkLeg];\n', '')],
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
const geoOf = f => FG.fixtureGeometry(WALLS, { kind: f.kind, wallId: f.wall.id, offset: f.offset,
  width: f.width, depth: f.depth, side: f.side });

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
    `${kit.sinkLeg.wall.id} ${kit.stoveLeg.wall.id}`, 'balcony end');
  const on = (id, kind) => kit.fixtures.find(f => f.wall.id === id && f.kind === kind);
  check('sink and DW on the balcony wall, range and fridge on the end wall',
    [on('balcony', 'sink'), on('balcony', 'dish'), on('end', 'stove'), on('end', 'fridge')].every(Boolean), true);
  // From the inside corner, south along the balcony wall.
  const south = f => inches(geoOf(f).alongStart - HALF_6) + '..' + inches(geoOf(f).alongEnd - HALF_6);
  check('the corner counter starts at the inside corner and runs 8\'-6"', south(on('balcony', 'cabinet')), '0..102');
  check('the 30" sink is centred 4\'-5" down the leg', south(on('balcony', 'sink')), '38..68');
  check('the 24" DW ends the leg', south(on('balcony', 'dish')), '78..102');
  // From the inside corner, west along the end wall.
  const west = f => inches((30 - HALF_6) - geoOf(f).alongEnd) + '..' + inches((30 - HALF_6) - geoOf(f).alongStart);
  check('the end-wall counter starts past the 24" corner counter', west(on('end', 'cabinet')), '24..66');
  check('the 30" range is on it, 3\'-9" from the corner', west(on('end', 'stove')), '30..60');
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
  check('mirrored, the sink leg is the end wall', `${kit.sinkLeg.wall.id} ${kit.stoveLeg.wall.id}`, 'end balcony');
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
  check('in the mirror-image corner the sink leg is the end wall', `${kit.sinkLeg.wall.id} ${kit.stoveLeg.wall.id}`, 'end side');
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

console.log(`\n${ran - failed}/${ran} checks passed`);
if (failed) process.exitCode = 1;
