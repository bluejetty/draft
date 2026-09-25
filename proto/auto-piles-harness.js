#!/usr/bin/env node
// build-house.js pilePoints — A PILE PER CORNER, THEN EVENED OUT AT 9 FT.
//
// Movie, 25 Sep: "i pile per corner and then 1 every 9ft or less" ... "(even
// them out if its less than 9ft".
//
// THE PARENTHESIS IS THE RULE, not a footnote to it. "One every 9 ft" alone
// is satisfied by walking a leg in 9 ft steps and dropping whatever is left
// over, which on a 12 ft leg is a pile at 9 and a 3 ft stub — three piles at
// 0, 9, 12 with one span two-thirds shorter than its neighbour. Evening out
// gives 0, 6, 12: the same three piles, each carrying the same share. Every
// spacing check below is written so the packed answer FAILS it.
//
// AND THE OLD PAGE DID NOT DO THIS. MODEL.dc.html placed exactly two piles,
// at the beam corners against the house, and said so in its own hint text
// (:23740): "COLUMN or COPY places the rest along the beam". So there is no
// port to measure against and nothing to inherit a bug from — the rule is
// Movie's, and these are its first checks.
//
// Run: node proto/auto-piles-harness.js
require('./harness-args.js').noFlags();

global.window = global.window || {};
require('../geometry-2d.js');
require('../build-house.js');
const { pilePoints } = global.window.DraftBuildHouse;

let failed = 0, ran = 0;
const checkEq = (label, got, want) => {
  ran += 1;
  if (got !== want) { failed += 1; console.log(`  FAIL ${label}\n       got ${got}, want ${want}`); }
};
const checkList = (label, got, want) => {
  ran += 1;
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a !== b) { failed += 1; console.log(`  FAIL ${label}\n       got ${a}\n       want ${b}`); }
};

const rect = (x, z, w, d) => [{ x, z }, { x: x + w, z }, { x: x + w, z: z + d }, { x, z: z + d }];
const at = pts => pts.map(p => [Number(p.x.toFixed(4)), Number(p.z.toFixed(4))]);
// The longest span between consecutive piles along one straight leg.
const spansOn = (pts, axis, fixed) => {
  const on = pts.filter(p => Math.abs((axis === 'x' ? p.z : p.x) - fixed) < 1e-6)
    .map(p => (axis === 'x' ? p.x : p.z)).sort((m, n) => m - n);
  return on.slice(1).map((v, i) => Number((v - on[i]).toFixed(6)));
};

// ── A leg shorter than the spacing gets its two corners and nothing else ────
{
  const piles = pilePoints(rect(0, 0, 8, 8));
  checkEq('an 8 ft square is four piles, one per corner', piles.length, 4);
  checkList('and they are the corners', at(piles),
    [[0, 0], [8, 0], [8, 8], [0, 8]]);
}

// ── EVENED, NOT PACKED ──────────────────────────────────────────────────────
{
  // 12 ft: ceil(12/9) = 2 spans of 6. The packed answer is 0, 9, 12.
  const piles = pilePoints(rect(0, 0, 12, 8));
  checkList('a 12 ft leg evens into two 6 ft spans', spansOn(piles, 'x', 0), [6, 6]);
  checkEq('and the 8 ft leg still takes none between its corners',
    spansOn(piles, 'z', 12).length, 1);
  checkEq('12 x 8 is six piles', piles.length, 6);
}
{
  // 27 ft divides exactly: three spans of 9, which is the boundary case --
  // `ceil` must not read 27/9 as 3.0000001 and ask for four.
  const piles = pilePoints(rect(0, 0, 27, 8));
  checkList('27 ft is three spans of exactly 9', spansOn(piles, 'x', 0), [9, 9, 9]);
}
{
  // 28 ft: ceil(28/9) = 4 spans of 7. The packed answer is 9, 9, 9, 1 -- a
  // pile a foot from its neighbour, which is the shape Movie ruled out.
  const piles = pilePoints(rect(0, 0, 28, 8));
  checkList('28 ft evens into four 7 ft spans', spansOn(piles, 'x', 0), [7, 7, 7, 7]);
}
{
  // Just over the line. 9.01 must take two spans, not one: the rule is 9 ft
  // OR LESS, so a span of 9.01 is one too long.
  const piles = pilePoints(rect(0, 0, 9.01, 8));
  checkList('9.01 ft is two spans, because 9 ft is a maximum',
    spansOn(piles, 'x', 0), [4.505, 4.505]);
}

// ── ONE PILE PER PLACE ──────────────────────────────────────────────────────
{
  // Every corner is the end of one leg and the start of the next, so a naive
  // walk emits it twice -- two schedule lines for one hole.
  const piles = pilePoints(rect(0, 0, 12, 12));
  const keys = new Set(piles.map(p => `${p.x},${p.z}`));
  checkEq('no pile is placed twice', keys.size, piles.length);
  checkEq('12 x 12 is eight: four corners and four mid-legs', piles.length, 8);
}

// ── A SKIPPED LEG TAKES NO PILES, AND ITS ENDS STILL DO ─────────────────────
{
  // The attached garage: the leg on the house carries no grade beam, so it
  // carries no piles -- but the two corners where the beam MEETS the house are
  // the ends of the legs that remain, and they must be piled. That is the old
  // page's "two piles at the beam corners against the house", reached by the
  // general rule. Edge 3 runs from (0,8) back to (0,0): the house side.
  const piles = pilePoints(rect(0, 0, 12, 8), { skipEdge: index => index === 3 });
  checkEq('the house leg is not piled along its length', piles.length, 6);
  const houseSide = piles.filter(p => Math.abs(p.x) < 1e-9);
  checkList('but both its ends carry one', at(houseSide), [[0, 0], [0, 8]]);
  checkEq('and nothing landed part-way along it',
    houseSide.filter(p => p.z > 1e-9 && p.z < 8 - 1e-9).length, 0);
}

// ── THE CORNER KEEPS ITS INDEX, AND NOTHING ELSE CLAIMS ONE ─────────────────
{
  const piles = pilePoints(rect(0, 0, 12, 8));
  const corners = piles.filter(p => p.srcIndex !== undefined);
  checkEq('every corner rides its own ring index', corners.length, 4);
  checkList('and they are the ring order', corners.map(p => p.srcIndex), [0, 1, 2, 3]);
  checkEq('a mid-leg pile claims no vertex',
    piles.filter(p => p.srcIndex === undefined).length, 2);
}

// ── A DEGENERATE EDGE RAISES NO WALL, SO IT HOLDS UP NOTHING ────────────────
{
  const loop = [{ x: 0, z: 0 }, { x: 12, z: 0 }, { x: 12, z: 0.001 },
    { x: 12, z: 8 }, { x: 0, z: 8 }];
  const piles = pilePoints(loop);
  checkEq('a zero-length edge adds no pile of its own', piles.length, 6);
}

// ── THE SPACING IS A PARAMETER, AND A BAD ONE FALLS BACK ────────────────────
{
  checkList('a tighter spacing divides further',
    spansOn(pilePoints(rect(0, 0, 12, 8), { maxSpacingFt: 5 }), 'x', 0), [4, 4, 4]);
  checkEq('a zero spacing would divide for ever, so it is refused',
    pilePoints(rect(0, 0, 12, 8), { maxSpacingFt: 0 }).length, 6);
  checkEq('and so is a negative one',
    pilePoints(rect(0, 0, 12, 8), { maxSpacingFt: -5 }).length, 6);
}

console.log(`\nauto piles: ${ran} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
