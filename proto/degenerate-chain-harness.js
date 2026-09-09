#!/usr/bin/env node
// THE DEGENERATE CHAIN — board #351, slice 1: the pin.
//
// A collapsed corner (two coincident outline points) travels through the tour
// roof model and comes out the far end as a segment that three separate
// `|| 1` guards have each quietly repaired. This file pins every link, so the
// collapse of MODEL.dc.html's private `distToSegment` onto the shared export
// cannot change behaviour without something here going red.
//
// WHY A CHAIN AND NOT A FUNCTION. Board #351 was written as "four functions
// disagree on a zero-length segment". True, and not the whole shape. The
// divergence only reaches a drafter because THREE guards compose, and each
// one reads as prudent divide-by-zero defence on its own line:
//
//   1. MODEL.dc.html:4750   len  = Math.hypot(dx, dz) || 1   -> ux, uz = 0
//   2. MODEL.dc.html:4768   nlen = Math.hypot(nx, nz) || 1   -> nx, nz = 0
//   3. MODEL.dc.html:4887   len2 = dx*dx + dz*dz  || 1       -> masks it
//
// Together they turn a collapsed corner into a one-foot edge carrying a zero
// normal that still answers proximity tests. Guard 1 also makes `edge.len`
// report 1 ft for an edge of length zero, which is a lie the gable splitter
// is downstream of -- noted, not this order's to fix.
//
//   node proto/degenerate-chain-harness.js
//
// Exit 0 = every check passed.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const win = {};
const sandbox = { window: win, console, Math, Number, String, Object, Array, JSON, Set, Map, isFinite };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'geometry-2d.js'), 'utf8'), sandbox, { filename: 'geometry-2d.js' });

const G = win.DraftGeometry2D;
let passed = 0;
const failures = [];
const check = (name, condition, detail) => {
  if (condition) { passed += 1; return; }
  failures.push(detail ? `${name}\n      ${detail}` : name);
};
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// ── The fixture: a 10x10 square with ONE collapsed corner ────────────────
// Index 2 and index 3 are the same point. This is what an import or a
// mid-drag coincidence leaves behind; nobody draws it deliberately, which is
// exactly why no test drawing in the repo contains one.
const LOOP = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 10, z: 10 }, { x: 0, z: 10 }];
const OVERHANG = 2;
const DEGEN = 2; // the edge running from point 2 to point 3 -- zero length

// ── LINK 0 · the shared export's rule, referenced not duplicated ─────────
// proto/outline-accessors-harness.js owns the full pin on this (16 checks,
// including the companion that stops "Infinity for everything" passing). One
// check here, because the rest of this file is meaningless if it changed.
check('the shared export still answers Infinity on a degenerate segment',
  G.pointToSegment({ x: 4, z: 4 }, { start: { x: 1, z: 1 }, end: { x: 1, z: 1 } }).d === Infinity,
  'geometry-2d.js pointToSegment -- see outline-accessors-harness.js for the full pin');

// ── LINK 1 · the offset routine leaves a coincident point where it is ────
// MEASURED, not assumed. The whole chain hangs on this: if the offset moved
// the collapsed point the way it moves its neighbours, the normal below would
// be a real unit vector and the 0.6 call site could never see a degenerate
// segment at all.
const offset = G.offsetOutlineVariable(LOOP.map(p => ({ x: p.x, z: p.z })), LOOP.map(() => OVERHANG));
check('the collapsed point is left exactly where it was',
  near(offset[DEGEN].x, LOOP[DEGEN].x) && near(offset[DEGEN].z, LOOP[DEGEN].z),
  `got ${JSON.stringify(offset[DEGEN])}, want ${JSON.stringify(LOOP[DEGEN])}`);
// The companion. Without it the check above passes on an offset routine that
// moves NOTHING -- "unmoved" and "inert" look identical at one point.
check('while its neighbours really are pushed out',
  !near(offset[0].x, LOOP[0].x) && !near(offset[1].x, LOOP[1].x),
  `corner 0 ${JSON.stringify(offset[0])}, corner 1 ${JSON.stringify(offset[1])}`);

// ── LINK 2 · `len = hypot || 1` collapses the unit vector ────────────────
// Reproduces MODEL.dc.html:4749-4752 exactly. A zero-length edge divides by
// the substituted 1, so the "unit" vector is (0, 0) -- and `edge.len`, which
// the gable splitter reads, reports ONE FOOT for an edge of length zero.
const edgeOf = (a, b) => {
  const dx = b.x - a.x, dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  return { a, b, len, ux: dx / len, uz: dz / len };
};
const degen = edgeOf(LOOP[DEGEN], LOOP[DEGEN + 1]);
const sound = edgeOf(LOOP[0], LOOP[1]);
check('a collapsed edge reports a unit vector of (0, 0)',
  degen.ux === 0 && degen.uz === 0, `got ux ${degen.ux}, uz ${degen.uz}`);
check('and reports its length as 1ft when it is 0ft long',
  degen.len === 1, `got ${degen.len}`);
check('a sound edge is unaffected -- ux is a real unit vector',
  near(Math.hypot(sound.ux, sound.uz), 1) && sound.len === 10,
  `len ${sound.len}, |u| ${Math.hypot(sound.ux, sound.uz)}`);

// ── LINK 3 · `nlen = hypot || 1` collapses the normal ────────────────────
// Reproduces MODEL.dc.html:4764-4769. With the point unmoved (link 1) the raw
// normal is the zero vector, and the guard divides it by 1 rather than
// rejecting it -- so the edge carries a normal of length ZERO, not length 1.
const normalOf = (edge, offA) => {
  let nx = offA.x - edge.a.x, nz = offA.z - edge.a.z;
  const along = nx * edge.ux + nz * edge.uz;
  nx -= along * edge.ux; nz -= along * edge.uz;
  const nlen = Math.hypot(nx, nz) || 1;
  return { nx: nx / nlen, nz: nz / nlen };
};
const nDegen = normalOf(degen, offset[DEGEN]);
const nSound = normalOf(sound, offset[0]);
check('a collapsed edge carries a normal of length zero',
  nDegen.nx === 0 && nDegen.nz === 0, `got ${JSON.stringify(nDegen)}`);
check('a sound edge carries a real unit normal',
  near(Math.hypot(nSound.nx, nSound.nz), 1), `|n| = ${Math.hypot(nSound.nx, nSound.nz)}`);

// ── LINK 4 · the 0.6 call site's segment has length zero ─────────────────
// MODEL.dc.html:4913-4918 builds cWall -> cOut as cWall + n*(overhang+1).
// The `overhang + 1` floor guarantees a length of at least 1ft -- but only if
// the normal is a unit vector. It is not, so the segment is a POINT.
//
// This is worth stating plainly because the obvious reading of that code says
// this call site can never see a degenerate segment. It can. The route is the
// normal, not the overhang.
const cWall = { x: degen.a.x, z: degen.a.z };
const cOut = { x: cWall.x + nDegen.nx * (OVERHANG + 1), z: cWall.z + nDegen.nz * (OVERHANG + 1) };
check('the gable centerline stub collapses to a point despite the +1 floor',
  near(Math.hypot(cOut.x - cWall.x, cOut.z - cWall.z), 0),
  `length ${Math.hypot(cOut.x - cWall.x, cOut.z - cWall.z)} for overhang ${OVERHANG}`);
// The companion: on a sound edge the same construction is a real 3ft stub.
const scWall = { x: sound.a.x, z: sound.a.z };
const scOut = { x: scWall.x + nSound.nx * (OVERHANG + 1), z: scWall.z + nSound.nz * (OVERHANG + 1) };
check('while a sound edge builds the full overhang+1 stub',
  near(Math.hypot(scOut.x - scWall.x, scOut.z - scWall.z), OVERHANG + 1),
  `length ${Math.hypot(scOut.x - scWall.x, scOut.z - scWall.z)}`);

// ── LINK 5 · THE DIVERGENCE ITSELF, at both call sites ───────────────────
// The private copy (MODEL.dc.html:4885) against the shared export, on the two
// segments links 4 and 2 just proved are degenerate. Pinned BY VALUE, not by
// "does not throw": the private copy answers the distance to the start point,
// the shared export answers Infinity.
const privateDistToSegment = (p, a, b) => {
  const dx = b.x - a.x, dz = b.z - a.z;
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2));
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
};
const sharedDist = (p, a, b) =>
  G.pointToSegment({ x: p.x, z: p.z }, { start: { x: a.x, z: a.z }, end: { x: b.x, z: b.z } }).d;

// A click 0.5ft from the collapsed point: inside BOTH thresholds.
const CLICK = { x: cWall.x + 0.5, z: cWall.z };

check('the private copy measures a degenerate segment to its start point',
  near(privateDistToSegment(CLICK, cWall, cOut), 0.5),
  `got ${privateDistToSegment(CLICK, cWall, cOut)}, want 0.5`);
check('the shared export calls the same segment infinitely far',
  sharedDist(CLICK, cWall, cOut) === Infinity,
  `got ${sharedDist(CLICK, cWall, cOut)}`);

// The caller-level consequence, which is the thing that actually breaks.
check('0.6 gable-break: the private copy says HIT',
  privateDistToSegment(CLICK, cWall, cOut) <= 0.6, 'the centerline break stays reachable');
check('0.6 gable-break: a bare swap says MISS, permanently',
  !(sharedDist(CLICK, cWall, cOut) <= 0.6), 'the break would silently stop being reachable');
check('0.8 node-edit refusal: the private copy says HIT',
  privateDistToSegment(CLICK, degen.a, degen.b) <= 0.8, 'the refusal message still appears');
check('0.8 node-edit refusal: a bare swap says MISS, permanently',
  !(sharedDist(CLICK, degen.a, degen.b) <= 0.8), 'the drafter would get silence instead');

// AND THE COMPANION THAT STOPS THIS BEING A STORY ABOUT NOTHING. On a sound
// edge the two agree exactly -- so the divergence really is confined to the
// degenerate case and a collapse is safe everywhere else. Without this, every
// check above passes on two functions that disagree about EVERYTHING.
const soundClick = { x: 5, z: 0.5 };
check('on a sound segment the private copy and the shared export agree',
  near(privateDistToSegment(soundClick, sound.a, sound.b), sharedDist(soundClick, sound.a, sound.b)),
  `private ${privateDistToSegment(soundClick, sound.a, sound.b)}, shared ${sharedDist(soundClick, sound.a, sound.b)}`);
check('and they agree past the end of a sound segment too',
  near(privateDistToSegment({ x: 20, z: 0 }, sound.a, sound.b), sharedDist({ x: 20, z: 0 }, sound.a, sound.b)),
  'the clamp behaves identically');

// ── Report ──
for (const f of failures) console.log(`  FAIL ${f}`);
console.log(`\ndegenerate chain harness: ${passed} checks passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
