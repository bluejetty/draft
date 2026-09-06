// fixture-geometry.js — where a fixture's rectangle lands on a wall.
//
// The four functions render-2d.js's drawFixture2D asks its caller for. They
// lived in MODEL.dc.html until this module, so only the old board could paint
// a sink; MODEL.html had no way to answer and drew nothing.
//
// WHAT THIS HARNESS IS FOR, AND WHAT IT DELIBERATELY IS NOT.
//
// The extraction itself was proved by a DIFFERENTIAL, run once while both
// copies still existed: 8421 comparisons across 2994 fixtures, module against
// the live methods, identical. That check is not in this file and must not be
// -- MODEL.dc.html now delegates here, so the same comparison would be the
// module against itself, and a check that reads the thing it is checking
// cannot fail. It is recorded rather than kept.
//
// The differential earned its keep on its first run. The tub's return carries
// a `corners:` line and the first draft of this module dropped it -- the two
// windows the method was read through did not meet, and one line fell in the
// gap. A tub would have painted its decks and no body. `a tub returns four
// corners` below is that defect turned into a standing check, because the
// differential cannot be kept and the next transcription mistake has to hit
// something.
//
// So what is here is the CONTRACT: a fixture is a rectangle of its own size
// against the face it chose, and a tub fills the alcove it is given or refuses
// it. Plus one check that MODEL.dc.html still delegates rather than carrying a
// second copy -- the duplication this file exists to prevent is the thing most
// likely to come back.
//
// Run: node proto/fixture-geometry-harness.js          (checks)
//      node proto/fixture-geometry-harness.js --mutate (checks + mutation table)
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'fixture-geometry.js');
const MODEL_DC = path.join(__dirname, '..', 'MODEL.dc.html');

const MUTATION_MODE = require('./harness-args.js').mutationMode();

// Loaded from SOURCE TEXT so a mutant can be applied without touching disk.
// wall-types.js is loaded the same way rather than stubbed: the assembly width
// it supplies is what decides which face a fixture backs onto, and a stub would
// let a wrong width pass unnoticed here and fail on the board.
function load(mutate) {
  let src = fs.readFileSync(SRC, 'utf8');
  if (mutate) {
    const next = mutate(src);
    if (next === src) throw new Error('mutation matched nothing -- it would prove nothing');
    src = next;
  }
  const window = {};
  new Function('window', fs.readFileSync(path.join(__dirname, '..', 'wall-types.js'), 'utf8'))(window);
  new Function('window', src)(window);
  return window.DraftFixtureGeometry;
}

// ── fixtures ─────────────────────────────────────────────────────────────
const W = (id, x0, z0, x1, z1, extra = {}) => ({
  id, start: { x: x0, y: 0, z: z0 }, end: { x: x1, y: 0, z: z1 },
  wallType: 'stud_2x6', levelId: 'L1', view: 'plan', ...extra,
});
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const round = n => Math.round(n * 1e6) / 1e6;

const CHECKS = [];
const check = (label, fn) => CHECKS.push({ label, fn });

// A 20' wall running east, 2×6 (5½" = 0.4583'), drawn on its centreline.
const east = W('w1', 0, 0, 20, 0);
const sink = (over = {}) => ({ kind: 'sink', wallId: 'w1', offset: 5, width: 2, depth: 2, side: 1, ...over });

// ── wallFrame: the wall's own axes ──
check('the along-vector is a unit vector',
  G => [round(Math.hypot(G.wallFrame(east).ux, G.wallFrame(east).uz)), 1]);

check('the across-vector is perpendicular to it',
  G => { const f = G.wallFrame(east); return [round(f.ux * f.nx + f.uz * f.nz), 0]; });

// The assembly width comes from wall-types.js, not from a number here. 2×6 is
// 5.5" and this is the only check that would notice if the lookup stopped
// happening -- everything downstream takes totalFt on trust.
check('a 2x6 wall is 5.5 inches thick',
  G => [round(G.wallFrame(east).totalFt * 12), 5.5]);

check('an 8 inch concrete wall is thicker than a 2x6 one',
  G => [G.wallFrame(W('c', 0, 0, 20, 0, { wallType: 'concrete_8' })).totalFt
        > G.wallFrame(east).totalFt, true]);

// refLine says where the drawn line sits in the assembly, and it is the reason
// a fixture against a 'left' wall is not in the same place as one against a
// 'center' wall of the same type.
check('a centre-referenced wall straddles the drawn line',
  G => { const f = G.wallFrame(east); return [round(f.startOff + f.endOff), 0]; });

check('a left-referenced wall puts the drawn line on its near face',
  G => [round(G.wallFrame(W('l', 0, 0, 20, 0, { refLine: 'left' })).startOff), 0]);

check('a right-referenced wall puts it on the far face',
  G => [round(G.wallFrame(W('r', 0, 0, 20, 0, { refLine: 'right' })).endOff), 0]);

check('the two faces are one assembly apart whatever the reference',
  G => { const f = G.wallFrame(W('r', 0, 0, 20, 0, { refLine: 'right' }));
         return [round(f.endOff - f.startOff), round(f.totalFt)]; });

// An unknown assembly must not throw and must not measure zero: a wall saved
// with a retired type still has to draw.
check('an unknown wall type falls back to a real assembly',
  G => [G.wallFrame(W('x', 0, 0, 20, 0, { wallType: 'no_such_type' })).totalFt > 0, true]);

check('a wall with no type at all still has a width',
  G => [G.wallFrame(W('x', 0, 0, 20, 0, { wallType: undefined })).totalFt > 0, true]);

check('a wall shorter than the length floor has no frame',
  G => [G.wallFrame(W('tiny', 0, 0, 0.005, 0)), null]);

// at() is the frame's only output the painter actually draws with.
check('at(0,0) is the wall start',
  G => [round(dist(G.wallFrame(east).at(0, 0), east.start)), 0]);

check('at(len,0) is the wall end',
  G => { const f = G.wallFrame(east); return [round(dist(f.at(f.len, 0), east.end)), 0]; });

check('at() carries the wall elevation, so a fixture upstairs is upstairs',
  G => [G.wallFrame(W('up', 0, 3, 20, 3)).at(4, 1).y, 0]);

// ── wallCross: where another wall meets this one ──
const northAt7 = W('w2', 7, -5, 7, 5);
check('a crossing wall is found at its own distance along',
  G => [round(G.wallCross(east, G.wallFrame(east), northAt7).along), 7]);

check('and the crossing parameter says it is halfway along the other wall',
  G => [round(G.wallCross(east, G.wallFrame(east), northAt7).s), 0.5]);

check('a parallel wall never crosses',
  G => [G.wallCross(east, G.wallFrame(east), W('w3', 0, 4, 20, 4)), null]);

check('a crossing behind the wall start reads negative, not clamped',
  G => [G.wallCross(east, G.wallFrame(east), W('w4', -3, -5, -3, 5)).along < 0, true]);

// ── fixtureGeometry: the rectangle ──
check('a fixture is a rectangle its own width along the wall',
  G => { const c = G.fixtureGeometry([east], sink()).corners;
         return [round(dist(c[0], c[1])), 2]; });

check('and its own depth across it',
  G => { const c = G.fixtureGeometry([east], sink()).corners;
         return [round(dist(c[1], c[2])), 2]; });

check('the four corners close',
  G => { const c = G.fixtureGeometry([east], sink()).corners;
         return [round(dist(c[3], c[0])), 2]; });

check('the centre is the middle of the rectangle',
  G => { const g = G.fixtureGeometry([east], sink());
         return [round(dist(g.center, g.corners[0])), round(Math.hypot(1, 1))]; });

check('it backs onto the wall face, not the drawn line',
  G => { const g = G.fixtureGeometry([east], sink());
         return [round(g.backOff), round(G.wallFrame(east).endOff)]; });

// side is the whole reason a fixture can sit in either room a wall divides.
check('the far side backs onto the other face',
  G => { const g = G.fixtureGeometry([east], sink({ side: -1 }));
         return [round(g.backOff), round(G.wallFrame(east).startOff)]; });

check('and the two sides land on opposite sides of the wall',
  G => [G.fixtureGeometry([east], sink()).center.z
        * G.fixtureGeometry([east], sink({ side: -1 })).center.z < 0, true]);

// A standoff is what makes an island: the body floats clear of the face.
check('a standoff floats the fixture off the face',
  G => [round(G.fixtureGeometry([east], sink({ standoff: 1.5 })).backOff
              - G.fixtureGeometry([east], sink()).backOff), 1.5]);

check('no standoff is the same as a zero one',
  G => [round(G.fixtureGeometry([east], sink({ standoff: undefined })).backOff),
        round(G.fixtureGeometry([east], sink({ standoff: 0 })).backOff)]);

// Clamping. A fixture dragged off the end of its wall stays on the wall --
// the painter has no opinion about this and would happily draw it in the yard.
check('a fixture pushed past the far end stays on the wall',
  G => [G.fixtureGeometry([east], sink({ offset: 100 })).alongEnd <= 20, true]);

check('a fixture pushed behind the near end stays on the wall',
  G => [G.fixtureGeometry([east], sink({ offset: -100 })).alongStart >= 0, true]);

check('a fixture wider than its wall is cut down to it',
  G => [G.fixtureGeometry([east], sink({ width: 500 })).width <= 20, true]);

// The clamp must not go the other way and shrink a fixture that fits.
check('a fixture that fits is not shrunk',
  G => [round(G.fixtureGeometry([east], sink({ width: 3 })).width), 3]);

check('a fixture on a wall that does not exist has no geometry',
  G => [G.fixtureGeometry([east], sink({ wallId: 'gone' })), null]);

check('a fixture on a degenerate wall has no geometry',
  G => [G.fixtureGeometry([W('tiny', 0, 0, 0.005, 0)], sink({ wallId: 'tiny' })), null]);

// ── tubGeometry: the alcove ──
// A tub is the one fixture whose drawn length is not the length it was placed
// at: it stretches to fill the alcove between its faucet wall and whatever
// stops it, and decks out what it cannot fill.
const backWall = W('t1', 0, 0, 30, 0);
const faucet = W('t2', 1, -6, 1, 6);
const farWall = at => W('t3', at, -6, at, 6);
const tub = (over = {}) => ({ kind: 'tub', wallId: 't1', endWallId: 't2', dir: 1,
  offset: 0, width: 5, depth: 2.5, side: 1, ...over });
const alcove = (at, over) => G => G.tubGeometry
  ? G.fixtureGeometry([backWall, faucet, farWall(at)], tub(over)) : null;

check('a tub returns four corners',
  G => [alcove(9)(G).corners.length, 4]);

// The defect the differential caught: the corners were missing entirely while
// every number beside them was right, so a tub drew as two decks and a hole.
check('and those corners are the tub body, not the whole alcove',
  G => { const g = alcove(9)(G);
         return [round(dist(g.corners[0], g.corners[1])), round(g.tubLen)]; });

check('a tub stretches to fill a short alcove',
  G => { const g = alcove(6)(G); return [round(g.tubLen), round(g.alcove)]; });

check('but not past its stretch limit',
  G => { const g = alcove(20)(G);
         return [round(g.tubLen), round(5 + G.TUB_STRETCH_MAX_FT)]; });

check('what it cannot fill becomes deck',
  G => [alcove(20)(G).decks.length > 0, true]);

check('an alcove it exactly fills has no deck',
  G => [alcove(6)(G).decks.length, 0]);

check('an alcove shorter than the minimum refuses the tub outright',
  G => [alcove(2)(G), null]);

// The refusal is a length rule, not a wall-count rule: it has to fire on the
// boundary, or the constant could be anything.
check('an alcove just under the minimum still refuses it',
  G => [G.fixtureGeometry([backWall, faucet, farWall(1 + 0.229166 + G.TUB_MIN_LENGTH_FT - 0.05)],
        tub()), null]);

check('and one just over it does not',
  G => [G.fixtureGeometry([backWall, faucet, farWall(1 + 0.3 + G.TUB_MIN_LENGTH_FT + 0.5)],
        tub()) !== null, true]);

// The far bound is the NEAREST crossing wall past the faucet, not the last one
// scanned -- a bathroom with a linen closet beyond the tub still stops at the
// tub's own wall.
check('the nearest crossing wall stops the alcove, not the furthest',
  G => { const g = G.fixtureGeometry([backWall, faucet, farWall(8), farWall(20)], tub());
         return [g.alcove < 8, true]; });

// Walls on another level or another sheet are not in this room.
check('a wall on another level does not stop the alcove',
  G => { const a = G.fixtureGeometry([backWall, faucet, farWall(20)], tub()).alcove;
         const b = G.fixtureGeometry([backWall, faucet,
           W('other', 8, -6, 8, 6, { levelId: 'L2' }), farWall(20)], tub()).alcove;
         return [round(a), round(b)]; });

check('nor does one on another sheet',
  G => { const a = G.fixtureGeometry([backWall, faucet, farWall(20)], tub()).alcove;
         const b = G.fixtureGeometry([backWall, faucet,
           W('other', 8, -6, 8, 6, { view: 'elevation' }), farWall(20)], tub()).alcove;
         return [round(a), round(b)]; });

check('a tub whose faucet wall is gone has no geometry',
  G => [G.fixtureGeometry([backWall, faucet], tub({ endWallId: 'vanished' })), null]);

check('a tub with no faucet wall named draws as a plain fixture',
  G => { const g = G.fixtureGeometry([backWall], { kind: 'tub', wallId: 't1',
           offset: 5, width: 5, depth: 2.5, side: 1 });
         return [g.tub, undefined]; });

check('a tub slid down the alcove moves its body, not its bounds',
  G => { const a = alcove(20)(G), b = alcove(20, { offset: 1 })(G);
         return [a.tubAlongStart < b.tubAlongStart && round(a.alongStart) === round(b.alongStart), true]; });

check('a tub cannot slide further than the gap it has',
  G => [round(alcove(20, { offset: 99 })(G).slide), round(alcove(20)(G).gap)]);

// The counter overhang is not read in this module -- the painter takes it
// through env -- so nothing else here would notice it going missing.
check('the counter overhang is exported for the painter to read',
  G => [G.COUNTER_OVERHANG_FT > 0, true]);

check('and it is one inch, the same on both boards',
  G => [round(G.COUNTER_OVERHANG_FT * 12), 1]);

// ── MODEL.dc.html still delegates ──
// The duplication this module exists to remove is also the thing most likely
// to come back: someone debugging the old board inlines "just this one" and
// the two copies drift silently, because both boards keep drawing.
check('MODEL.dc.html delegates all four rather than carrying a second copy',
  () => {
    const src = fs.readFileSync(MODEL_DC, 'utf8');
    const missing = ['_wallFrame', '_wallCross', '_fixtureGeometry', '_tubGeometry']
      .filter(name => {
        const m = src.match(new RegExp(`\\n  ${name}\\(([^)]*)\\) \\{\\n([^\\n]*)\\n  \\}`));
        return !m || !m[2].includes('window.DraftFixtureGeometry.');
      });
    return [missing.join(',') || 'all four delegate', 'all four delegate'];
  });

// ── Run ──
function run(G) {
  const missed = [];
  for (const { label, fn } of CHECKS) {
    let got, want;
    try { [got, want] = fn(G); } catch (err) { got = `threw ${err.message}`; want = null; }
    if (got !== want) missed.push({ label, got, want });
  }
  return missed;
}

const baseline = run(load(null));
for (const m of baseline) console.log(`  FAIL ${m.label}\n       got ${m.got}, want ${m.want}`);
console.log(`\n${CHECKS.length - baseline.length}/${CHECKS.length} checks passed`);

// ── Mutations ──
const MUTATIONS = [
  ['the along-vector is left unnormalised',
    s => s.replace('const ux = dx / len, uz = dz / len;', 'const ux = dx, uz = dz;')],
  ['the across-vector points along instead of across',
    s => s.replace('const nx = -uz, nz = ux;', 'const nx = ux, nz = uz;')],
  ['the assembly width is a fixed 2x6 rather than a lookup',
    s => s.replace('const totalFt = def.totalIn / 12;', 'const totalFt = 5.5 / 12;')],
  ['refLine is ignored and every wall is centre-referenced',
    s => s.replace("refLine === 'left' ? 0 : refLine === 'right' ? -totalFt : -totalFt / 2",
      '-totalFt / 2')],
  ['a left-referenced wall is treated as right-referenced',
    s => s.replace("refLine === 'left' ? 0 :", "refLine === 'left' ? -totalFt :")],
  ['an unknown wall type yields no assembly at all',
    s => s.replace('|| TYPES[1];', '|| { totalIn: 0 };')],
  ['a degenerate wall is given a frame anyway',
    s => s.replace('if (len < 0.01) return null;', 'if (len < -1) return null;')],
  ['at() forgets the across-offset, so every fixture sits on the drawn line',
    s => s.replace('x: wall.start.x + ux * along + nx * across,\n        y: wall.start.y || 0,\n        z: wall.start.z + uz * along + nz * across,',
      'x: wall.start.x + ux * along,\n        y: wall.start.y || 0,\n        z: wall.start.z + uz * along,')],
  ['parallel walls are reported as crossing',
    s => s.replace('if (Math.abs(denom) < 1e-6) return null;', 'if (Math.abs(denom) < -1) return null;')],
  ['the crossing parameter is swapped for the distance along',
    s => s.replace('s: (frame.uz * rx - frame.ux * rz) / denom,', 's: (rx * vz - rz * vx) / denom,')],
  ['the fixture is drawn at its placed offset, unclamped',
    s => s.replace('const along = Math.min(Math.max(fixture.offset, half + 0.01), Math.max(frame.len - half - 0.01, half + 0.01));',
      'const along = fixture.offset;')],
  ['a fixture wider than its wall is drawn at full width',
    s => s.replace('const width = Math.min(fixture.width, Math.max(frame.len - 0.02, 0.5));',
      'const width = fixture.width;')],
  ['the standoff is dropped, so an island sits against the wall',
    s => s.replace("+ fixture.side * (fixture.standoff || 0);", ';')],
  ['both sides back onto the same face',
    s => s.replace('(fixture.side === -1 ? frame.startOff : frame.endOff) +', 'frame.endOff +')],
  ['the fixture depth is ignored',
    s => s.replace('const frontOff = backOff + fixture.side * fixture.depth;\n    return {\n      wall, frame,\n      along,',
      'const frontOff = backOff;\n    return {\n      wall, frame,\n      along,')],
  ['the centre is taken at the back face rather than the middle',
    s => s.replace('center: frame.at(along, (backOff + frontOff) / 2),', 'center: frame.at(along, backOff),')],
  ['the tub minimum is dropped, so any alcove takes one',
    s => s.replace('if (alcove < TUB_MIN_LENGTH_FT) return null;', 'if (alcove < -1) return null;')],
  ['the tub stretches without limit',
    s => s.replace('const tubLen = Math.min(alcove, fixture.width + TUB_STRETCH_MAX_FT);', 'const tubLen = alcove;')],
  ['the tub never stretches past its placed width',
    s => s.replace('fixture.width + TUB_STRETCH_MAX_FT', 'fixture.width')],
  ['the tub corners are dropped, the defect the differential caught',
    s => s.replace('      corners: rect(Math.min(near, far), Math.max(near, far)),\n', '')],
  ['the tub corners span the whole alcove instead of the body',
    s => s.replace('corners: rect(Math.min(near, far), Math.max(near, far)),',
      'corners: rect(Math.min(face, farFace), Math.max(face, farFace)),')],
  ['the alcove stops at the furthest crossing wall, not the nearest',
    s => s.replace('&& dir * (otherFace - face) < dir * (farFace - face)', '')],
  ['walls on other levels and sheets are scanned too',
    s => s.replace("if (other.levelId !== wall.levelId || (other.view || 'plan') !== (wall.view || 'plan')) return;", '')],
  ['the tub slide is not held inside the gap',
    s => s.replace('const slide = Math.min(Math.max(fixture.offset, 0), gap);', 'const slide = fixture.offset;')],
  ['a tub with no faucet wall named takes the alcove path anyway',
    s => s.replace("if (fixture.kind === 'tub' && fixture.endWallId)", "if (fixture.kind === 'tub')")],
  ['the counter overhang is halved',
    s => s.replace('const COUNTER_OVERHANG_FT = 1 / 12;', 'const COUNTER_OVERHANG_FT = 1 / 24;')],
  ['a fixture whose wall is gone is drawn anyway',
    s => s.replace('if (!wall) return null;', 'if (!wall) wall = { start:{x:0,y:0,z:0}, end:{x:9,y:0,z:0} };')],
];

if (MUTATION_MODE) {
  console.log('\n' + 'mutation'.padEnd(74) + 'caught by');
  let survivors = 0;
  let broken = 0;
  for (const [label, mutate] of MUTATIONS) {
    let missed, by;
    try {
      missed = run(load(mutate));
      if (!missed.length) survivors += 1;
      by = missed.length ? missed.map(m => m.label).join('\n' + ' '.repeat(74)) : '*** NOTHING ***';
    } catch (err) {
      broken += 1;
      by = `!!! MUTATION DID NOT APPLY: ${err.message}`;
    }
    console.log(`${label.padEnd(74)}${by}`);
  }
  console.log(`\n${MUTATIONS.length - survivors - broken}/${MUTATIONS.length} mutations caught`);
  if (broken) console.log(`${broken} mutation(s) never applied -- they prove nothing`);
  if (!MUTATIONS.length) console.log('NO MUTATIONS DEFINED -- this table proves nothing');
  process.exit(baseline.length || survivors || broken || !MUTATIONS.length ? 1 : 0);
}

process.exit(baseline.length ? 1 : 0);
