#!/usr/bin/env node
// THE DEFAULT WASHROOMS ARE MOVIE'S BATHS, WHEREVER THEY ARE DROPPED.
//
// washroom-presets.js lays out BATH A (5'-7" x 8'-7") and BATH B (5'-1" x
// 8'-1") from 1._Story.DXF, turns and mirrors them into the world, and slides
// the tub end flush with an exterior wall it is dropped against. These checks
// hold it to the drawing: the inside sizes, which walls it draws, that every
// fixture and the door land INSIDE the room through fixture-geometry.js (the
// same module the plan draws them with), that the door swings in and hangs
// where Movie hung it, and when the snap does and does not happen.
//
// Run: node proto/washroom-presets-harness.js
//      node proto/washroom-presets-harness.js --mutate
const MUTATE = require('./harness-args.js').mutationMode();
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const MUTATIONS = [
  ['the room always draws its own tub wall', 'washroom-presets.js',
    c => c.replace('    if (own) walls.push({ key: \'tub\'', '    walls.push({ key: \'tub\'')],
  ['bath A loses the 6" wall at the tub\'s foot', 'washroom-presets.js',
    c => c.replace('    if (p.chase) {\n      const u', '    if (false) {\n      const u')],
  ['every fixture faces out of the room', 'washroom-presets.js',
    c => c.replace("return dot({ x: -d.z, z: d.x }, sub(centre, wall.start)) >= 0 ? 1 : -1;",
      "return dot({ x: -d.z, z: d.x }, sub(centre, wall.start)) >= 0 ? -1 : 1;")],
  ['the door swings out of the room', 'washroom-presets.js',
    c => c.replace('      swingFlip: roomSide(doorHost) !== 1,', '      swingFlip: roomSide(doorHost) === 1,')],
  ['the door is hung on its other jamb', 'washroom-presets.js',
    c => c.replace('      hingeFlip: hingeAt > strikeAt,', '      hingeFlip: hingeAt < strikeAt,')],
  ['the tub runs away from its faucet wall', 'washroom-presets.js',
    c => c.replace('dir: toFar >= 0 ? 1 : -1 };', 'dir: toFar >= 0 ? -1 : 1 };')],
  ['F mirrors nothing', 'washroom-presets.js',
    c => c.replace('const a = (flip ? -1 : 1) * (u - p.W / 2)', 'const a = (u - p.W / 2)')],
  ['the snap slides the room the wrong way', 'washroom-presets.js',
    c => c.replace('      at: { x: at.x + out.x * best.gap, z: at.z + out.z * best.gap },',
      '      at: { x: at.x - out.x * best.gap, z: at.z - out.z * best.gap },')],
  ['the snap takes a wall at any angle', 'washroom-presets.js',
    c => c.replace('      if (Math.abs(dot(d, out)) > 0.05) return;\n', '')],
  ['the snap reaches any distance', 'washroom-presets.js',
    c => c.replace('      if (Math.abs(gap) > snapFt) return;\n', '')],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('washroom-presets',
    MUTATIONS, { root: ROOT, harness: __filename });
  process.exit(all ? 0 : 1);
}

// A mutant arrives as a file of replacement sources (mutant-subprocess.js).
const OVERRIDES = process.env.DRAFT_HARNESS_SOURCE_OVERRIDES
  ? JSON.parse(fs.readFileSync(process.env.DRAFT_HARNESS_SOURCE_OVERRIDES, 'utf8')) : {};
const win = {};
for (const file of ['wall-types.js', 'fixture-geometry.js', 'washroom-presets.js']) {
  const text = OVERRIDES[file] != null ? OVERRIDES[file] : fs.readFileSync(path.join(ROOT, file), 'utf8');
  try {
    new Function('window', text)(win);
  } catch (err) {
    console.error(`${file} did not load: ${err.message}`);
    process.exit(3);
  }
}
const WP = win.DraftWashroomPresets;
const FG = win.DraftFixtureGeometry;

let failed = 0, ran = 0;
const check = (label, got, want) => {
  ran += 1;
  if (String(got) === String(want)) return;
  failed += 1;
  console.log(`  FAIL ${label}\n       got  ${got}\n       want ${want}`);
};
const r2 = n => Math.round(n * 100) / 100;
const inches = ft => Math.round(ft * 12 * 10) / 10;

// Real wall records from a placed room, so fixture-geometry measures them
// exactly as the page will.
const realise = (room, extWall = null) => {
  const walls = room.walls.map(w => ({ id: w.key, start: { ...w.start, y: 0 }, end: { ...w.end, y: 0 },
    levelId: 3, view: 'plan', wallType: w.wallType, refLine: 'center' }));
  if (extWall) walls.push(extWall);
  const idOf = key => (key === 'ext' ? extWall.id : key);
  const fixtures = room.fixtures.map(f => ({ kind: f.kind, wallId: idOf(f.host), levelId: 3, offset: f.offset,
    width: f.width, depth: f.depth, side: f.side,
    ...(f.kind === 'tub' ? { endWallId: idOf(f.endWall), dir: f.dir } : {}) }));
  return { walls, fixtures, geo: f => FG.fixtureGeometry(walls, f) };
};
const inside = (pt, poly) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const a = poly[i], b = poly[j];
    if ((a.z > pt.z) !== (b.z > pt.z) && pt.x < ((b.x - a.x) * (pt.z - a.z)) / (b.z - a.z) + a.x) hit = !hit;
  }
  return hit;
};
const span = (poly, axis) => Math.max(...poly.map(p => p[axis])) - Math.min(...poly.map(p => p[axis]));

// ── WHAT THE TWO ROOMS ARE ─────────────────────────────────────────────────
{
  const A = WP.place('A', { at: { x: 0, z: 0 } });
  check('BATH A is 5\'-7" x 8\'-7" inside', `${inches(span(A.inside, 'x'))} x ${inches(span(A.inside, 'z'))}`, '67 x 103');
  check('with left, right, far, its own tub wall and the 6" wall',
    A.walls.map(w => `${w.key}:${w.wallType}`).join(' '),
    'left:stud_2x4 right:stud_2x4 far:stud_2x4 tub:stud_2x4 chase:stud_2x6');
  const chase = A.walls.find(w => w.key === 'chase');
  check('the 6" wall runs to the tub\'s 30" depth', inches(chase.end.z - A.inside[0].z), 30);
  const B = WP.place('B', { at: { x: 0, z: 0 } });
  check('BATH B is 5\'-1" x 8\'-1" inside', `${inches(span(B.inside, 'x'))} x ${inches(span(B.inside, 'z'))}`, '61 x 97');
  check('and has no 6" wall', B.walls.map(w => w.key).join(' '), 'left right far tub');
  check('the V36 in A, the V30 in B',
    `${A.fixtures.find(f => f.kind === 'vanity').width * 12} ${B.fixtures.find(f => f.kind === 'vanity').width * 12}`, '36 30');
  check('a 32" door in each', `${inches(A.door.width)} ${inches(B.door.width)}`, '32 32');
}

// ── EVERY PIECE INSIDE THE ROOM, HOWEVER IT IS TURNED ──────────────────────
for (const id of ['A', 'B']) {
  for (const angleDeg of [0, 90, 180, 270]) {
    for (const flip of [false, true]) {
      const room = WP.place(id, { at: { x: 7, z: -4 }, angleDeg, flip });
      const R = realise(room);
      const outside = R.fixtures.filter(f => {
        const g = R.geo(f);
        return !g || !inside(g.center, room.inside);
      }).map(f => f.kind);
      check(`${id} at ${angleDeg}${flip ? ' mirrored' : ''}: every fixture inside`, outside.join(',') || 'none', 'none');
      const tub = R.geo(R.fixtures.find(f => f.kind === 'tub'));
      check(`${id} at ${angleDeg}${flip ? ' mirrored' : ''}: the tub fills its alcove`,
        tub ? inches(tub.tubLen) : 'none', id === 'A' ? 61.5 : 61);
    }
  }
}

// ── THE DOOR: IN, AND HUNG WHERE MOVIE HUNG IT ─────────────────────────────
{
  // The leaf, open, points from the hinge into the room: the hinge jamb is
  // at offset -/+ width/2 per hingeFlip, and the swing side per swingFlip.
  const leafTip = (room, R) => {
    const host = R.walls.find(w => w.id === room.door.host);
    const f = FG.wallFrame(host);
    const hinge = room.door.offset + (room.door.hingeFlip ? 1 : -1) * room.door.width / 2;
    const side = room.door.swingFlip ? -1 : 1;
    return { hinge: f.at(hinge, 0), tip: f.at(hinge, side * room.door.width) };
  };
  for (const id of ['A', 'B']) {
    for (const flip of [false, true]) {
      const room = WP.place(id, { at: { x: 0, z: 0 }, angleDeg: 90, flip });
      const { hinge, tip } = leafTip(room, realise(room));
      check(`${id}${flip ? ' mirrored' : ''}: the door swings into the room`, inside(tip, room.inside), true);
      // Hinged at the jamb Movie drew it at, measured along the inside face:
      // A's 5" from the left wall on the far wall, B's 92" from the tub end
      // on the left wall.
      const [from, to, want] = id === 'A'
        ? [room.inside[3], room.inside[2], 5]
        : [room.inside[0], room.inside[3], 92];
      const len = Math.hypot(to.x - from.x, to.z - from.z);
      const along = ((hinge.x - from.x) * (to.x - from.x) + (hinge.z - from.z) * (to.z - from.z)) / len;
      check(`${id}${flip ? ' mirrored' : ''}: hinged where Movie hung it`, inches(along), want);
    }
  }
}

// ── F MIRRORS THE ROOM ─────────────────────────────────────────────────────
{
  const plain = WP.place('B', { at: { x: 0, z: 0 } });
  const mirrored = WP.place('B', { at: { x: 0, z: 0 }, flip: true });
  const rightX = room => room.walls.find(w => w.key === 'right').start.x;
  check('mirrored, the toilet\'s wall crosses to the other side', Math.sign(rightX(plain)) !== Math.sign(rightX(mirrored)), true);
}

// ── THE TUB END AGAINST THE EXTERIOR WALL ──────────────────────────────────
{
  // A 2x6 exterior along z = -6, drawn on its outside face (refLine 'left',
  // room to +z): its inside face is at z = -6 + 5.5".
  const EXT = { id: 'ext', start: { x: -20, y: 0, z: -6 }, end: { x: 20, y: 0, z: -6 }, levelId: 3,
    view: 'plan', wallType: 'stud_2x6', refLine: 'left' };
  const faces = wall => FG.wallFrame(wall);
  const face = -6 + 5.5 / 12;
  const L = WP.PRESETS.A.L;
  const pose = gapFt => ({ at: { x: 0, z: face + L / 2 + gapFt } });
  const near = WP.snapToExterior('A', pose(0.8), [EXT], faces);
  check('dropped 10" off the wall, it snaps', Boolean(near), true);
  check('and its tub end lands on the wall\'s inside face', near ? r2(near.at.z - L / 2) : 'none', r2(face));
  check('the side walls run to the wall\'s drawn line', near ? r2(near.ext.insetFt * 12) : 'none', 5.5);
  const far = WP.snapToExterior('A', pose(2.5), [EXT], faces);
  check('2\'-6" off it, it does not', Boolean(far), false);
  const turned = WP.snapToExterior('A', { ...pose(0.8), angleDeg: 90 }, [EXT], faces);
  check('turned a quarter, the tub end is not on it', Boolean(turned), false);
  // A wall at 45 degrees running right through where the tub end would be:
  // close enough, and no seat for a square room.
  // (Started beside the tub end and long enough to run past both its ends,
  // so the only thing that can refuse it is its angle.)
  const SKEW = { ...EXT, id: 'skew', start: { x: -4, y: 0, z: face + 0.5 }, end: { x: 10, y: 0, z: face + 14.5 } };
  check('a wall at an angle is no seat, however close',
    Boolean(WP.snapToExterior('A', pose(0.2), [SKEW], faces)), false);
  const SHORT = { ...EXT, start: { ...EXT.start, x: -2 }, end: { ...EXT.end, x: 2 } };
  check('a wall shorter than the room is no seat', Boolean(WP.snapToExterior('A', pose(0.8), [SHORT], faces)), false);

  const room = WP.place('A', { at: near.at, ext: near.ext });
  check('snapped, the room draws no tub wall of its own', room.walls.map(w => w.key).join(' '), 'left right far chase');
  const R = realise(room, EXT);
  const tubRec = R.fixtures.find(f => f.kind === 'tub');
  check('the tub sits on the exterior wall', tubRec.wallId, 'ext');
  const tub = R.geo(tubRec);
  check('inside the room, filling its alcove', tub && inside(tub.center, room.inside) ? inches(tub.tubLen) : 'none', 61.5);
}

console.log(`\n${ran - failed}/${ran} checks passed`);
if (failed) process.exitCode = 1;
