#!/usr/bin/env node
// THE DEFAULT WASHROOMS ARE MOVIE'S BATHS, WHEREVER THEY ARE DROPPED.
//
// washroom-presets.js lays out WC 1 (5'-7" x 8'-7") and WC 2 (5'-1" x
// 8'-1") from 1._Story.DXF, WC BF1 (9'-11" x 10'-5 1/2", barrier free, its
// laundry notch) from the North Point studio suite, and WC BF2 to BF5 with
// their closets and laundry off the 1B, 1BD and 2BD suites, turns and
// mirrors them into the world,
// and slides the end that joins the house flush with an exterior wall it is
// dropped against. These checks hold it to the drawings: the inside sizes,
// which walls it draws, that every fixture and the door land INSIDE the room
// through fixture-geometry.js (the same module the plan draws them with),
// that the door swings in -- or OUT, for the barrier-free room -- and hangs
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
    c => c.replace('      if (own) box.push({ key: \'tub\'', '      box.push({ key: \'tub\'')],
  ['bath A loses the 6" wall at the tub\'s foot', 'washroom-presets.js',
    c => c.replace('      if (p.chase) {\n        const u', '      if (false) {\n        const u')],
  ['every fixture faces out of the room', 'washroom-presets.js',
    c => c.replace("return dot({ x: -d.z, z: d.x }, sub(pt, wall.start)) >= 0 ? 1 : -1;",
      "return dot({ x: -d.z, z: d.x }, sub(pt, wall.start)) >= 0 ? -1 : 1;")],
  ['every door swings the other way', 'washroom-presets.js',
    c => c.replace("        swingFlip: d.swing === 'out' ? roomSide(doorHost) === 1 : roomSide(doorHost) !== 1,",
      "        swingFlip: d.swing === 'out' ? roomSide(doorHost) !== 1 : roomSide(doorHost) === 1,")],
  ['a door marked out swings in like the others', 'washroom-presets.js',
    c => c.replace("        swingFlip: d.swing === 'out' ? roomSide(doorHost) === 1 : roomSide(doorHost) !== 1,",
      "        swingFlip: roomSide(doorHost) !== 1,")],
  ['what stands on the end wall is lost when the house supplies it', 'washroom-presets.js',
    c => c.replace("    const endKey = key => (key === 'tub' && !lay.walls.some(w => w.key === 'tub') ? 'ext' : key);",
      "    const endKey = key => key;")],
  ['the roll-in shower is a 36" square', 'washroom-presets.js',
    c => c.replace("{ kind: 'shower', host: 'far', at: [36 * IN, 125.5 * IN], width: 6, depth: 3 }",
      "{ kind: 'shower', host: 'far', at: [36 * IN, 125.5 * IN], width: 3, depth: 3 }")],
  ['the door is hung on its other jamb', 'washroom-presets.js',
    c => c.replace('        hingeFlip: hingeAt > strikeAt,', '        hingeFlip: hingeAt < strikeAt,')],
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
  ['the walls a suite gives are ignored for the plain box', 'washroom-presets.js',
    c => c.replace('    const walls = (p.walls ? p.walls(vT, own) : (() => {', '    const walls = (false ? p.walls(vT, own) : (() => {')],
  ['a suite\'s tub is laid as WC 1\'s', 'washroom-presets.js',
    c => c.replace("      fixtures: p.fixtures.map(f => (f.kind !== 'tub' || f.faucet ? f", "      fixtures: p.fixtures.map(f => (f.kind !== 'tub' ? f")],
  ['the washer on the laundry wall faces the WC', 'washroom-presets.js',
    c => c.replace('      return Math.abs(off) > 1e-6 ? (off > 0 ? 1 : -1) : roomSide(wall);', '      return roomSide(wall);')],
  ['every door is a plain swing door', 'washroom-presets.js',
    c => c.replace("        swing: d.swing || 'in', style: d.style || 'single' }))", "        swing: d.swing || 'in', style: 'single' }))")],
  ['the V42 stands on the end wall, not its plumbing wall', 'washroom-presets.js',
    c => c.replace("{ kind: 'vanity', host: 'plumb', at: [98 * IN, STUD_4], width: 3.5, depth: 2 }",
      "{ kind: 'vanity', host: 'tub', at: [98 * IN, 0], width: 3.5, depth: 2 }")],
  ['the BF1 door is hung at the old height', 'washroom-presets.js',
    c => c.replace("hinge: [119 * IN, 51.5 * IN], strike: [119 * IN, 83.5 * IN]", "hinge: [119 * IN, 30 * IN], strike: [119 * IN, 62 * IN]")],
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
    levelId: 3, view: 'plan', wallType: w.wallType, refLine: w.refLine || 'center' }));
  if (extWall) walls.push(extWall);
  const idOf = key => (key === 'ext' ? extWall.id : key);
  const fixtures = room.fixtures.map(f => ({ kind: f.kind, wallId: idOf(f.host), levelId: 3, offset: f.offset,
    width: f.width, depth: f.depth, side: f.side,
    ...(f.kind === 'tub' ? { endWallId: idOf(f.endWall), dir: f.dir } : {}) }));
  // AS THE PAGE DROPS IT: a piece run into a wall stands its half inch off
  // it (settleWallGaps; Movie, 23 Oct).
  FG.settleWallGaps(walls, fixtures).forEach(({ fixture, offset }) => { fixture.offset = offset; });
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
  check('named WC 1 and WC 2', `${A.name} / ${B.name}`, 'WC 1 / WC 2');
  const BF = WP.place('BF1', { at: { x: 0, z: 0 } });
  check('WC BF1 is 9\'-11" x 10\'-5 1/2" inside', `${inches(span(BF.inside, 'x'))} x ${inches(span(BF.inside, 'z'))}`, '119 x 125.5');
  check('its walls: the box with the laundry notch cut from the far corner, its end wall, the plumbing wall',
    BF.walls.map(w => `${w.key}:${w.wallType}`).join(' '),
    'left:stud_2x4 far:stud_2x4 notchV:stud_2x4 notchH:stud_2x4 right:stud_2x4 tub:stud_2x4 plumb:stud_2x4');
  check('a 36 x 72 roll-in shower, a toilet and a V42 on the plumbing wall, no tub',
    BF.fixtures.map(f => `${f.kind}:${f.host}:${inches(f.width)}x${inches(f.depth)}`).sort().join(' '),
    'shower:far:72x36 toilet:left:20x28 vanity:plumb:42x24');
  check('and one 32" POCKET door', BF.doors.map(d => `${inches(d.width)} ${d.style}`).join(', '), '32 pocket');
}

// ── THE SUITES' WCs, AS THEIR SHEETS DRAW THEM ──────────────────────────────
// Sizes are the room tags; the walls and doors the sheets'.
const SUITES = {
  BF2: { size: '106 x 138', walls: 'left right far clFarA clFarB tub stub plumb',
    fixtures: 'toilet:tub:20x28 tub:right:72x42 vanity:plumb:60x26',
    doors: '36 single out, 36 single out', tubIn: 72 },
  BF3: { size: '168 x 128', walls: 'left right lauL lauB far clFarA clFarB tub stubA stubB plumb',
    fixtures: 'dryer:lauB:30x30 toilet:tub:20x28 tub:tub:72x42 vanity:plumb:48x27 washer:lauB:30x30',
    doors: '36 single out, 36 single in, 57 french out', tubIn: 72 },
  BF4: { size: '113 x 138', walls: 'left right far clFarA clFarB tub stub plumb',
    fixtures: 'toilet:tub:20x28 tub:right:72x42 vanity:left:48x26 vanity:plumb:60x26',
    doors: '36 single out', tubIn: 72 },
  BF5: { size: '88.7 x 126', walls: 'left part clB right far tub',
    fixtures: 'shower:tub:60x30 toilet:part:20x28 vanity:right:48x25',
    doors: '36 single out, 51 french out', tubIn: null },
};
for (const [id, want] of Object.entries(SUITES)) {
  const room = WP.place(id, { at: { x: 0, z: 0 } });
  check(`${id} is named WC ${id}`, room.name, `WC ${id}`);
  check(`${id}: the WC's own size`, `${inches(span(room.inside, 'x'))} x ${inches(span(room.inside, 'z'))}`, want.size);
  check(`${id}: its walls`, room.walls.map(w => w.key).join(' '), want.walls);
  check(`${id}: its fixtures`,
    room.fixtures.map(f => `${f.kind}:${f.host}:${inches(f.width)}x${inches(f.depth)}`).sort().join(' '), want.fixtures);
  check(`${id}: its doors`, room.doors.map(d => `${inches(d.width)} ${d.style} ${d.swing}`).join(', '), want.doors);
  check(`${id}: every wall a 2x4`, room.walls.every(w => w.wallType === 'stud_2x4'), true);
}
check('BF3, BF4 and BF5 bring their closets, BF3 its laundry too',
  ['BF2', 'BF3', 'BF4', 'BF5'].map(id => WP.place(id, { at: { x: 0, z: 0 } }).spaces.map(sp => sp.name).join('+')).join(' '),
  'WC+CL WC+CL+LAUNDRY WC+CL WC+CL');

// ── EVERY PIECE INSIDE ITS SPACE, HOWEVER IT IS TURNED ─────────────────────
// The washer and dryer stand in the laundry; everything else in the WC. The
// whole footprint, not only its middle: a fixture on the wrong face of its
// wall, or as deep as the room, sticks out of it.
const spaceOf = kind => (kind === 'washer' || kind === 'dryer' ? 'LAUNDRY' : 'WC');
const footprintIn = (g, poly) => [g.center, ...g.corners.map(c => ({
  x: c.x + (g.center.x - c.x) * 0.01, z: c.z + (g.center.z - c.z) * 0.01 }))].every(pt => inside(pt, poly));
for (const id of WP.IDS) {
  for (const angleDeg of [0, 90, 180, 270]) {
    for (const flip of [false, true]) {
      const room = WP.place(id, { at: { x: 7, z: -4 }, angleDeg, flip });
      const R = realise(room);
      const tag = `${id} at ${angleDeg}${flip ? ' mirrored' : ''}`;
      const outside = R.fixtures.filter(f => {
        const g = R.geo(f);
        const space = room.spaces.find(sp => sp.name === spaceOf(f.kind));
        return !g || !space || !footprintIn(g, space.poly);
      }).map(f => f.kind);
      check(`${tag}: every fixture inside its space`, outside.join(',') || 'none', 'none');
      if (id === 'BF1') {
        // The shower lies across the far end from the left wall: 72" along
        // it, its back corner half an inch off that wall's inside face and
        // off the far wall (Movie, 23 Oct: the 1/2" on back and sides).
        const shower = R.geo(R.fixtures.find(f => f.kind === 'shower'));
        const farWall = R.walls.find(w => w.id === 'far');
        const fromLeft = Math.min(...[shower.corners[0], shower.corners[1]].map(c =>
          Math.min(...room.inside.map(p => Math.hypot(p.x - c.x, p.z - c.z)))));
        check(`${tag}: the shower runs 72" along the far wall from a corner`,
          `${inches(shower.width)} ${r2(fromLeft)} ${shower.wall === farWall}`, '72 0.06 true');
        continue;
      }
      const tubRec = R.fixtures.find(f => f.kind === 'tub');
      // ITS OWN LENGTH, the half inch each end out of the alcove (Movie, 24
      // Oct: "the tub should only be 42 x 72 (not 73)"): A's 61 1/2" alcove
      // no longer stretches its 60" tub to 60 1/2".
      const want = id === 'A' || id === 'B' ? 60 : SUITES[id].tubIn;
      if (want == null) { check(`${tag}: no tub`, Boolean(tubRec), false); continue; }
      const tub = R.geo(tubRec);
      check(`${tag}: the tub fills its alcove`, tub ? inches(tub.tubLen) : 'none', want);
    }
  }
}

// ── THE PLUMBING WALL STANDS BEHIND THE VANITY ─────────────────────────────
// Movie: "the sink needs a 3.5" wall behind it". Where a preset has one, the
// vanity's back is its face and the wall is no shorter than the vanity.
for (const id of ['BF1', 'BF2', 'BF3', 'BF4']) {
  const room = WP.place(id, { at: { x: 0, z: 0 } });
  const R = realise(room);
  const v = R.fixtures.find(f => f.kind === 'vanity' && f.wallId === 'plumb');
  const g = v && R.geo(v);
  check(`${id}: a vanity on the plumbing wall, full width`, g ? `${inches(g.width)} ${r2(g.backOff * 12)}` : 'none',
    // Its back half an inch off the plumbing wall's face (1 3/4" + 1/2").
    g ? `${inches(v.width)} ${r2((v.side === 1 ? 1 : -1) * 2.25)}` : 'a vanity');
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
  // THE BF1 DOOR IS A POCKET (Movie, 17 Oct, the S suite), moved down to just
  // above the laundry notch: on the right wall, its opening 51 1/2" to
  // 83 1/2" from the end wall, its pocket on the end wall's side and all of
  // it on the wall.
  for (const flip of [false, true]) {
    const room = WP.place('BF1', { at: { x: 0, z: 0 }, angleDeg: 90, flip });
    const R = realise(room);
    const host = R.walls.find(w => w.id === room.door.host);
    const f = FG.wallFrame(host);
    const hingeAlong = room.door.offset + (room.door.hingeFlip ? 1 : -1) * room.door.width / 2;
    const pocketFar = hingeAlong + (room.door.hingeFlip ? 1 : -1) * room.door.width;
    const hinge = f.at(hingeAlong, 0);
    const [from, to] = [room.inside[1], room.inside[2]];
    const len = Math.hypot(to.x - from.x, to.z - from.z);
    const along = ((hinge.x - from.x) * (to.x - from.x) + (hinge.z - from.z) * (to.z - from.z)) / len;
    check(`BF1${flip ? ' mirrored' : ''}: the pocket's jamb 51 1/2" from the end wall, on the right wall`,
      `${inches(along)} ${room.door.host} ${room.door.style}`, '51.5 right pocket');
    check(`BF1${flip ? ' mirrored' : ''}: the pocket stays on its wall`, pocketFar > 0 && pocketFar < f.len, true);
  }
  // THE SUITES' DOORS SWING WHERE THEIR SHEETS SWING THEM: out of the WC to
  // the hall, into the closet beyond, into the WC from it, the laundry's and
  // the bedroom closet's two leaves outward. `null` is outside every space.
  const INTO = { BF2: [null, 'CL'], BF3: [null, 'WC', null], BF4: ['CL'], BF5: [null, null] };
  for (const [id, want] of Object.entries(INTO)) {
    for (const flip of [false, true]) {
      const room = WP.place(id, { at: { x: 3, z: -2 }, angleDeg: 270, flip });
      const R = realise(room);
      const got = room.doors.map(door => {
        const host = R.walls.find(w => w.id === door.host);
        const f = FG.wallFrame(host);
        const hinge = door.offset + (door.hingeFlip ? 1 : -1) * door.width / 2;
        const side = door.swingFlip ? -1 : 1;
        // Half the leaf out, the middle of the arc: clear of the walls.
        const tip = f.at(hinge + (door.hingeFlip ? -1 : 1) * door.width * 0.3, side * door.width * 0.5);
        const sp = room.spaces.find(s2 => inside(tip, s2.poly));
        return sp ? sp.name : null;
      });
      check(`${id}${flip ? ' mirrored' : ''}: its doors swing into ${want.map(w => w || 'the hall').join(', ')}`,
        got.map(w => w || 'the hall').join(', '), want.map(w => w || 'the hall').join(', '));
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
  check('inside the room, its own 60"', tub && inside(tub.center, room.inside) ? inches(tub.tubLen) : 'none', 60);

  // AND THE WC'S VANITY END THE SAME WAY: dropped by the exterior wall, the
  // room draws no end wall and the V42 stands on the house's.
  const LB = WP.PRESETS.BF1.L;
  const bfNear = WP.snapToExterior('BF1', { at: { x: 0, z: face + LB / 2 + 0.8 } }, [EXT], faces);
  check('WC BF1 dropped 10" off the wall snaps too', Boolean(bfNear), true);
  const bf = WP.place('BF1', { at: bfNear.at, ext: bfNear.ext });
  check('snapped, it draws no end wall of its own', bf.walls.map(w => w.key).join(' '), 'left far notchV notchH right plumb');
  const RB = realise(bf, EXT);
  const vanity = RB.fixtures.find(f => f.kind === 'vanity');
  check('the vanity stands on its plumbing wall, not the house\'s', vanity ? vanity.wallId : 'none', 'plumb');
  const vg = vanity && RB.geo(vanity);
  check('inside the room, in its corner', vg && inside(vg.center, bf.inside) ? inches(vg.width) : 'none', 42);

  // A SUITE'S END STANDS ON THE HOUSE TOO: BF2 snapped draws no end wall,
  // and its toilet stands on the exterior wall, inside the room.
  const L2 = WP.PRESETS.BF2.L;
  const b2Near = WP.snapToExterior('BF2', { at: { x: 0, z: face + L2 / 2 + 0.8 } }, [EXT], faces);
  const b2 = WP.place('BF2', { at: b2Near.at, ext: b2Near.ext });
  check('WC BF2 snapped draws no end wall of its own', b2.walls.some(w => w.key === 'tub'), false);
  const R2 = realise(b2, EXT);
  const toilet = R2.fixtures.find(f => f.kind === 'toilet');
  const tg = toilet && R2.geo(toilet);
  check('its toilet stands on the exterior wall, inside the room',
    toilet && tg ? `${toilet.wallId} ${footprintIn(tg, b2.inside)}` : 'none', 'ext true');
  const t2 = R2.geo(R2.fixtures.find(f => f.kind === 'tub'));
  check('and its tub still fills the alcove to the house wall', t2 ? inches(t2.tubLen) : 'none', 72);
}

// ── ON THEIR INSIDE FACES, AND THE MINI REGISTRATION POINT ─────────────────
// Movie, 28 Oct: "for bathrooms this model will be used too - interior
// corner placement", and the point: "sure tub corner". The room's own 2x4s
// are drawn on the face the room sees, studs outward; the point is the
// inside corner at the tub end on the toilet/vanity side, however the room
// is turned or mirrored.
for (const angleDeg of [0, 90, 180, 270]) {
  for (const flip of [false, true]) {
    const tag = `A at ${angleDeg}${flip ? ' mirrored' : ''}`;
    const room = WP.place('A', { at: { x: 7, z: -4 }, angleDeg, flip });
    const R = realise(room);
    const rim = ['left', 'right', 'far', 'tub'];
    // Each rim wall's studs lie wholly outside the room: its two faces are
    // the drawn line and a line 3 1/2" further from the room's centre.
    const outward = rim.every(key => {
      const w = R.walls.find(x => x.id === key);
      const f = FG.wallFrame(w);
      const mid = { x: (w.start.x + w.end.x) / 2, z: (w.start.z + w.end.z) / 2 };
      const toC = (room.centre.x - mid.x) * f.nx + (room.centre.z - mid.z) * f.nz;
      const near = Math.abs(f.startOff) < 1e-9 ? f.startOff : f.endOff;
      const far = near === f.startOff ? f.endOff : f.startOff;
      return Math.abs(near) < 1e-9 && Math.sign(far) === -Math.sign(toC) && Math.abs(Math.abs(far) - 3.5 / 12) < 1e-9;
    });
    check(`${tag}: left, right, far and tub walls drawn on their inside faces, studs outward`, outward, true);
    const corners = room.inside.map(p => `${r2(p.x)},${r2(p.z)}`);
    check(`${tag}: the tub corner is one of the inside corners`,
      corners.includes(`${r2(room.registration.x)},${r2(room.registration.z)}`), true);
    const vanity = R.geo(R.fixtures.find(f => f.kind === 'vanity'));
    const tub = R.geo(R.fixtures.find(f => f.kind === 'tub'));
    const d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
    // The tub end's two corners are the two nearest the tub; of those, the
    // one nearer the vanity.
    const tubEnd = room.inside.slice().sort((a, b) => d(a, tub.center) - d(b, tub.center)).slice(0, 2);
    const want = tubEnd.sort((a, b) => d(a, vanity.center) - d(b, vanity.center))[0];
    check(`${tag}: on the vanity's side, at the tub end`, d(want, room.registration) < 1e-6, true);
  }
}

console.log(`\n${ran - failed}/${ran} checks passed`);
if (failed) process.exitCode = 1;
