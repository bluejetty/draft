#!/usr/bin/env node
// BOARD #346, THE MODEL HALF — MODEL.dc.html KEEPS NO PRIVATE POINT-TO-SEGMENT
// DISTANCE OF ITS OWN.
//
// The board asked for the page's private copies to be collapsed onto
// geometry-2d.js. Two independent censuses (mine and Devin's, different
// probes) found none left: PR #349 turned _distToLineSeg into a forwarder and
// PR #352 collapsed the last private copy, the tour roof's distToSegment,
// leaving a documented adapter that calls the shared export on its next line.
// The board entry was simply dated.
//
// So this file is what the MODEL half produces instead of a rewrite: the
// one-time cleanup made into a STANDING PROPERTY. The next inlined copy is
// caught by a check on the day it lands, not by a board survey six weeks
// later — which is how the ~10 copies accumulated in the first place.
//
// WHY THE CLAMP AND NOT THE SQUARED LENGTH. The obvious guard is wrong, and
// measurably so: `X * X + Y * Y` appears FOURTEEN times in live code here --
// screen-distance checks, drag thresholds, honest arithmetic that has nothing
// to do with segments. Guarding on it would cry wolf until someone deleted
// the guard. What actually distinguishes point-to-SEGMENT is the CLAMP: t
// pinned into [0,1] so the foot of the perpendicular cannot fall off the end.
// A distance to a POINT never needs it. Zero occurrences in this file today.
//
// Run: node proto/no-inline-distance-harness.js
const fs = require('fs');
const path = require('path');

const PAGE = path.join(__dirname, '..', 'MODEL.dc.html');

// COMMENTS ARE NOT CODE. This file's own prose discusses `len2 = dx * dx + dz
// * dz || 1` and the clamp at length -- the PR #352 comment quotes the very
// idiom it removed -- so a raw grep would flag the documentation explaining
// why the code is gone. Strip first, search second.
const stripComments = text => {
  const noBlock = text.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlock.split('\n').map(line => line.replace(/\/\/.*$/, '')).join('\n');
};

const SIGNATURES = [
  { name: 'a projection clamped into [0,1] (the point-to-SEGMENT step)',
    re: /Math\.max\(\s*0\s*,\s*Math\.min\(\s*1\s*,/g },
  { name: 'a squared segment length held in len2 / lenSq / length2',
    re: /\b(?:len2|lenSq|length2)\b/g },
];

let passed = 0;
const failures = [];
const check = (name, ok, detail) => {
  if (ok) { passed += 1; return; }
  failures.push(detail ? `${name}\n      ${detail}` : name);
};

const source = fs.readFileSync(PAGE, 'utf8');
const code = stripComments(source);
const lineOf = index => code.slice(0, index).split('\n').length;

for (const sig of SIGNATURES) {
  sig.re.lastIndex = 0;
  const hits = [];
  let m;
  while ((m = sig.re.exec(code)) !== null) hits.push(`line ${lineOf(m.index)}: ${m[0]}`);
  check(`MODEL.dc.html holds no ${sig.name}`, hits.length === 0,
    hits.length ? `${hits.length} found -- ${hits.slice(0, 5).join('; ')}\n`
      + '      Point-to-segment distance belongs to geometry-2d.js\n'
      + '      (pointToSegment). Call the export, or forward to it as\n'
      + '      _distToLineSeg does; do not re-inline the arithmetic.' : '');
}

// ── THE DETECTOR MUST PROVE IT CAN SEE ───────────────────────────────────
//
// Every check above passes when it finds nothing -- which is also what a
// broken pattern, a bad strip, or a mistyped regex produces. "Zero found" and
// "cannot find" are the same output, and that is the failure this whole
// harness exists to prevent elsewhere. So the detector is run against a
// planted copy and MUST catch it.
const PLANTED = `
  const distToSegment = (p, a, b) => {
    const dx = b.x - a.x, dz = b.z - a.z;
    const len2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2));
    return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
  };`;
for (const sig of SIGNATURES) {
  sig.re.lastIndex = 0;
  check(`the ${sig.name} detector catches a planted copy`, sig.re.test(PLANTED),
    'the pattern found nothing in a textbook inline copy -- it would find nothing in a real one either');
}

// And the stripper must not be so eager that it eats the code it guards.
check('stripping comments leaves the code itself intact',
  code.includes('_distToLineSeg') && code.includes('DraftGeometry2D'),
  'the comment stripper removed live code, so the search above ran on rubble');
// Its other half: a copy quoted INSIDE a comment must not count as an
// occurrence, or the guard fires on its own documentation.
check('a copy quoted inside a comment does not count',
  stripComments(`// const t = Math.max(0, Math.min(1, x));\nconst ok = 1;`)
    .includes('Math.max') === false,
  'commented-out arithmetic still reads as code');

for (const f of failures) console.log(`  FAIL ${f}`);
console.log(`\nno-inline-distance harness: ${passed} checks passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
