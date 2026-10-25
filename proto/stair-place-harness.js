#!/usr/bin/env node
// A STAIR PLACED BY HAND, OFFLINE (Movie, 25 Oct). stair-place.js turns a
// press, an aim, a shape and UP or DOWN into the downward record the page
// stores; this holds what that record must say for every shape both ways:
//   - DOWN: its top step is the press and its first leg runs the aim;
//   - UP: its BOTTOM step is the press, its last leg (walked up, its first)
//     climbs the aim, and it turns the other hand going down;
//   - its outline is one run straight, two and a landing turned.
//
// Run: node proto/stair-place-harness.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
require('./harness-args.js').noFlags();

const ROOT = path.join(__dirname, '..');
const ctx = { window: {}, Math, Number, Object };
vm.createContext(ctx);
['stair-geometry.js', 'stair-place.js'].forEach(f =>
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
const SG = ctx.window.DraftStairGeometry;
const SP = ctx.window.DraftStairPlace;

let failed = 0, passed = 0;
const check = (ok, what) => { if (ok) passed += 1; else { failed += 1; console.log(`  FAIL  ${what}`); } };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const samePt = (p, q) => near(p.x, q.x) && near(p.z, q.z);
const dirOf = (a, b) => { const l = Math.hypot(b.x - a.x, b.z - a.z); return { x: (b.x - a.x) / l, z: (b.z - a.z) / l }; };

const layout = SG.stairLayout(9.5);   // a storey's rise: 15 risers, 14 treads
const at = { x: 3, z: -2 };
const AIMS = [{ x: 3, z: 10 }, { x: 13, z: -2 }, { x: -4, z: -9 }];

['straight', 'L', 'U'].forEach(shape => ['left', 'right'].forEach(turn => AIMS.forEach(toward => {
  const tag = `${shape} ${turn} toward (${toward.x}, ${toward.z})`;
  const aim = dirOf(at, toward);
  // DOWN
  const down = SP.stairFromAim(SG, { at, toward, layout, shape, turn, widthFt: 3, up: false });
  check(samePt(down.start, at), `DOWN ${tag}: the top step is the press`);
  const d = dirOf(down.start, down.end);
  check(near(d.x, aim.x) && near(d.z, aim.z), `DOWN ${tag}: the first leg runs the aim`);
  check(down.turn === turn, `DOWN ${tag}: it turns the hand asked`);
  // UP
  const up = SP.stairFromAim(SG, { at, toward, layout, shape, turn, widthFt: 3, up: true });
  const parts = SG.stairPlanParts(up, layout);
  check(samePt(parts.walk[parts.walk.length - 1], at), `UP ${tag}: the bottom step is the press`);
  const last = parts.runs[parts.runs.length - 1];
  check(near(-last.dir.x, aim.x) && near(-last.dir.z, aim.z), `UP ${tag}: walked up, the first leg climbs the aim`);
  check(shape === 'straight' || up.turn !== turn, `UP ${tag}: stored, it turns the other hand going down`);
  // THE OUTLINE
  const outline = SP.stairOutline(SG, down, layout);
  check(outline.runs.length === (shape === 'straight' ? 1 : 2), `${tag}: one run straight, two turned`);
  check(!!outline.landing === (shape !== 'straight'), `${tag}: a landing only when it turns`);
  check(outline.runs.every(r => r.length === 4), `${tag}: each run a rectangle`);
})));
// NO AIM, NO STAIR.
check(SP.stairFromAim(SG, { at, toward: at, layout }) === null, 'no aim: nothing to place');

console.log(`stair place: ${passed} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
