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

// ── THE FIRST PILE STANDS BACK FROM THE HOUSE ──────────────────────────────
//
// Movie, 25 Sep, looking at a built attached garage: "the first one should not
// be at the foundation it should be 4-6 min or 5' max (lets go 4'6 default)
// the first pile shouldn't effect the foundation/ footing so therefore needs
// to be placed min 4'6 from the foundation wall".
//
// THE OLD PAGE PUT THEM EXACTLY THERE. MODEL.dc.html's _buildGaragePiles takes
// `[points[0], points[points.length - 1]]` -- the two attachment nodes, which
// ARE the house wall -- so both of its piles were drilled against the footing.
// It placed only those two and left the run to the drafter (:14810, "COLUMN or
// COPY places the rest along the beam"), so the defect was there with less to
// show it.
{
  // Edge 0 runs along z = 0 and is the house. Edges 1 and 3 meet it, so each
  // starts its run 4'-6" along instead of at the corner.
  const house = index => index === 0;
  const piles = pilePoints(rect(0, 0, 12, 8), { skipEdge: house, standoffFt: 4.5 });
  checkEq('nothing is drilled within the standoff of the house',
    piles.some(pt => pt.z < 4.5 - 1e-9), false);
  // THE SAME RING WITHOUT THE STANDOFF PUTS TWO ON THE HOUSE LINE, which is
  // what makes the check above a measurement rather than a restatement: the
  // rule has somewhere to fail to.
  const flush = pilePoints(rect(0, 0, 12, 8), { skipEdge: house, standoffFt: 0 });
  checkEq('and without it two piles sit hard on the house line',
    flush.filter(pt => Math.abs(pt.z) < 1e-9).length, 2);
  checkList('the run re-evens over what is left of the leg',
    at(piles).sort((a, b) => a[0] - b[0] || a[1] - b[1]),
    [[0, 4.5], [0, 8], [6, 8], [12, 4.5], [12, 8]]);
}

// A STOOD-OFF PILE HANDS ITS CORNER LINK BACK. srcIndex makes a pile ride that
// vertex when the outline is dragged, and a pile 4'-6" down the leg riding the
// corner would slide along the beam every time the corner moved.
{
  const piles = pilePoints(rect(0, 0, 12, 8), { skipEdge: i => i === 0, standoffFt: 4.5 });
  const stoodOff = piles.filter(pt => Math.abs(pt.z - 4.5) < 1e-9);
  checkEq('two piles were stood off', stoodOff.length, 2);
  checkEq('and neither claims a corner', stoodOff.some(pt => pt.srcIndex !== undefined), false);
  const far = piles.find(pt => Math.abs(pt.x - 12) < 1e-9 && Math.abs(pt.z - 8) < 1e-9);
  checkEq('a corner away from the house keeps its link', far.srcIndex, 2);
}

// A LEG TOO SHORT TO STAND A PILE OFF THE HOUSE GETS NONE, and the beam spans
// it. Placing one anyway would put it inside the very distance the rule exists
// to keep clear.
{
  const piles = pilePoints(rect(0, 0, 12, 4), { skipEdge: i => i === 0, standoffFt: 4.5 });
  checkList('only the far leg carries piles',
    at(piles).sort((a, b) => a[0] - b[0]), [[0, 4], [6, 4], [12, 4]]);
}

// A LEG BETWEEN TWO HOUSE EDGES STANDS OFF AT BOTH ENDS -- the head and the
// tail are the NEIGHBOURS' answers, not this leg's, so both can be a house.
{
  const piles = pilePoints(rect(0, 0, 12, 20), { skipEdge: i => i === 0 || i === 2, standoffFt: 4.5 });
  checkList('both ends of each remaining leg are held off',
    at(piles).sort((a, b) => a[0] - b[0] || a[1] - b[1]),
    [[0, 4.5], [0, 10], [0, 15.5], [12, 4.5], [12, 10], [12, 15.5]]);
}

// AND THE STANDOFF ONLY EVER MEASURES FROM A SKIPPED EDGE, which is how a
// DETACHED garage needs no branch of its own: it passes no `against`, so
// nothing is skipped, no end is a house end, and every corner keeps its pile.
{
  checkList('a ring with nothing skipped is untouched by the standoff',
    at(pilePoints(rect(0, 0, 12, 8), { standoffFt: 4.5 })),
    at(pilePoints(rect(0, 0, 12, 8), { standoffFt: 0 })));
}

// ── TWO PILES TOO CLOSE TOGETHER ARE ONE PILE ──────────────────────────────
//
// Movie, 25 Sep: "there are situations where 2 corners are too close together
// (piles shouldn't be withing 3ft of each other) if the piles would be 3ft or
// closer, remove both piles and replace with 1 at the centerpoint between the
// 2 corners".
//
// IT MOVES THE SURVIVOR, which is what separates it from the 0.01 ft merge
// already here. That one answers "these are one place"; this one answers
// "these are two places too close to drill", and NEITHER original position is
// kept -- the pair is replaced by the point between them.
{
  // A chamfered corner: (2,8) and (0,6) are 2.83 ft apart.
  const ring = [{ x: 0, z: 0 }, { x: 12, z: 0 }, { x: 12, z: 8 }, { x: 2, z: 8 }, { x: 0, z: 6 }];
  checkList('the close pair is replaced by the point between them',
    at(pilePoints(ring)).sort((a, b) => a[0] - b[0] || a[1] - b[1]),
    [[0, 0], [1, 7], [6, 0], [7, 8], [12, 0], [12, 8]]);
  checkEq('and neither corner survives in its own right',
    at(pilePoints(ring)).some(pt => (pt[0] === 2 && pt[1] === 8) || (pt[0] === 0 && pt[1] === 6)),
    false);
  // `?.` RATHER THAN A BARE .srcIndex, and the reason is a lesson not a style
  // note: with the merge disabled there IS no pile at x = 1, and the bare form
  // threw a TypeError that ended the whole run -- so the three checks after it
  // never reported at all. A check that crashes tells you less than one that
  // fails, and a harness that stops early hides every result behind it.
  checkEq('the merged pile claims no corner',
    pilePoints(ring).find(pt => Math.abs(pt.x - 1) < 1e-9)?.srcIndex, undefined);
}

// "3ft OR CLOSER", so the bound is INCLUSIVE -- a pair exactly 3 ft apart is
// the case he named, not the first legal one.
{
  const notch = depth => [{ x: 0, z: 0 }, { x: 12, z: 0 }, { x: 12, z: 8 },
    { x: 6, z: 8 }, { x: 6, z: 8 - depth }, { x: 0, z: 8 - depth }];
  checkEq('exactly 3 ft apart is one pile', pilePoints(notch(3)).length, 6);
  checkEq('and it stands between them',
    at(pilePoints(notch(3))).some(pt => pt[0] === 6 && pt[1] === 6.5), true);
  checkEq('a hair over 3 ft is two', pilePoints(notch(3.02)).length, 7);
}

// CLOSEST PAIR FIRST, AND REPEATEDLY, so the answer does not depend on the
// order the legs were walked. Three piles along one wall at 2.9 and 2.3 ft
// apart: a single forward pass would merge the 2.9 pair it met FIRST and leave
// the tighter 2.3 pair standing, which is both the wrong pair and one pile too
// many.
{
  const ring = [{ x: 0, z: 0 }, { x: 12, z: 0 }, { x: 12, z: 8 },
    { x: 9.1, z: 8 }, { x: 6.8, z: 8 }, { x: 0, z: 8 }];
  const piles = pilePoints(ring);
  checkEq('the tighter pair merges and the looser one is then clear', piles.length, 6);
  checkEq('and the survivor stands between the tighter pair',
    at(piles).some(pt => pt[0] === 7.95 && pt[1] === 8), true);
  checkEq('a forward pass would have left this one standing',
    at(piles).some(pt => pt[0] === 6.8 && pt[1] === 8), false);
}

// AND THE RULE IS A PARAMETER: zero turns it off, which is the only way the
// checks above can be said to measure it rather than the ring.
{
  const ring = [{ x: 0, z: 0 }, { x: 12, z: 0 }, { x: 12, z: 8 }, { x: 2, z: 8 }, { x: 0, z: 6 }];
  checkEq('minGapFt 0 leaves both corners standing', pilePoints(ring, { minGapFt: 0 }).length, 7);
}

console.log(`\nauto piles: ${ran} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
