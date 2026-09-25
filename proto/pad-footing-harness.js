#!/usr/bin/env node
// WHAT A COLUMN STANDS ON, AND WHEN TWO PADS ARE ONE POUR.
//
// Movie, 25 Sep, looking at a built foundation with its beam and teleposts
// drawn and nothing under them: "we have beam and columns, but no footing, we
// will need footings below the columns, please check the model.DC version i
// think it had them already 36\"x36\"x8\"dp".
//
// IT DID, AND THE TABLE NEVER CAME ACROSS. MODEL.dc.html:2460 carries
// COLUMN_FOOTINGS with a size and a schedule note per row; MODEL.html carries
// id+label pairs for the picker and nothing else. So the page hands
// render-2d.js `footing: null` for every pad -- the painter draws the 3"
// telepost and stops -- and passes a hard-coded `sizeIn: 6` for every pile,
// which is why a 12" pile and an 8" pile are the same circle on the plan.
//
// Run: node proto/pad-footing-harness.js
require('./harness-args.js').noFlags();
global.window = global.window || {};
require('../geometry-2d.js');
require('../build-house.js');
const { COLUMN_FOOTINGS, footingFor, padSizeIn, padGroups } = global.window.DraftBuildHouse;

let failed = 0, ran = 0;
const check = (label, got, want) => {
  ran += 1;
  if (got === want) return;
  failed += 1;
  console.log(`  FAIL ${label}\n       got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};
const near = (label, got, want, tol = 1e-9) => {
  ran += 1;
  if (Math.abs(got - want) <= tol) return;
  failed += 1;
  console.log(`  FAIL ${label}\n       got ${got}, want ${want}`);
};
const pad = (x, z, footing = 'pad36', extra = {}) => ({ point: { x, z }, footing, ...extra });

// ── THE TABLE ──────────────────────────────────────────────────────────────
{
  check('the pad Movie named is 36 inches', footingFor('pad36').sizeIn, 36);
  check('and its schedule row says 8 inches deep',
    footingFor('pad36').note.includes('8" DP'), true);
  check('a pad is not a pile', footingFor('pad36').pile, undefined);
  // EVERY PILE ITS OWN DIAMETER. The live page hard-codes 6 for all of them,
  // so this is the check that says the table is being read at all.
  check('an 8 inch pile is 8', footingFor('pile8').sizeIn, 8);
  check('a 10 inch pile is 10', footingFor('pile10').sizeIn, 10);
  check('a 12 inch pile is 12', footingFor('pile12').sizeIn, 12);
  check('and none of them is 6', COLUMN_FOOTINGS.filter(f => f.pile)
    .every(f => f.sizeIn !== 6), true);
  check('a pile is flagged as one', footingFor('pile12').pile, true);
  // FIRST ROW IS THE FALLBACK, dc's rule: an id the table has never heard of
  // is a pad, not a crash and not a missing footing.
  check('an unknown footing falls back to the standard pad', footingFor('nope').id, 'pad36');
  check('and so does a missing one', footingFor(undefined).id, 'pad36');
}

// ── THE SIZE A PAD DRAWS AT ────────────────────────────────────────────────
{
  check('a pad takes its table size', padSizeIn(pad(0, 0)), 36);
  check('a typed override wins', padSizeIn(pad(0, 0, 'pad36', { padIn: 48 })), 48);
  check('a nonsense override does not', padSizeIn(pad(0, 0, 'pad36', { padIn: -4 })), 36);
  // A PILE HAS NO OVERRIDE: its size IS its diameter and the id says which, so
  // a padIn on one would be a second answer to a settled question.
  check('a pile ignores a typed pad size',
    padSizeIn(pad(0, 0, 'pile12', { padIn: 99 })), 12);
}

// ── WHEN TWO PADS ARE ONE POUR ─────────────────────────────────────────────
{
  check('two pads far apart are two footings', padGroups([pad(0, 0), pad(10, 0)]).length, 2);
  // 36" pads at 3'-2" centres leave 2" between their edges -- under the 6"
  // join gap, so forming two is more work than pouring the rectangle between.
  const joined = padGroups([pad(0, 0), pad(3.2, 0)]);
  check('two pads almost touching are one', joined.length, 1);
  near('and the pour spans both', joined[0].maxX - joined[0].minX, 6.2);
  check('which knows it holds two columns', joined[0].columns.length, 2);
  // EXACTLY AT THE GAP still joins: the rule is "within", and a hair either
  // side of a boundary is not where a drafter wants the answer to flip.
  check('edges exactly the gap apart still pour as one',
    padGroups([pad(0, 0), pad(3.5, 0)]).length, 1);
  check('a hair further apart do not',
    padGroups([pad(0, 0), pad(3.51, 0)]).length, 2);
}

// ── UNION-FIND, NOT A PAIRWISE SWEEP ───────────────────────────────────────
//
// Three pads in a row where only the NEIGHBOURS touch are still one pour. A
// pairwise pass emits two overlapping rectangles for the same concrete, and
// the drawing shows a seam through a slab that has none.
{
  const chain = padGroups([pad(0, 0), pad(3.2, 0), pad(6.4, 0)]);
  check('a chain of touching pads is ONE footing', chain.length, 1);
  check('holding all three columns', chain[0].columns.length, 3);
  near('spanning end to end', chain[0].maxX - chain[0].minX, 9.4);
  check('the two ends alone would not have joined',
    padGroups([pad(0, 0), pad(6.4, 0)]).length, 2);
  // OUT OF ORDER IS THE CHECK THAT BITES, and the version above did not.
  // Listed 0, 3.2, 6.4 every touching pair is ALSO adjacent in the array, so a
  // rule that only ever compared each pad with the NEXT one produced exactly
  // the same single group and the mutant walked through. Measured: that
  // mutation changed no answer in 32 checks.
  //
  // Here the middle pad is listed LAST. 0 and 6.4 do not touch, so a
  // next-neighbour pass joins nothing at the front and leaves two groups;
  // union-find finds the chain through the pad that arrives after both.
  const outOfOrder = padGroups([pad(0, 0), pad(6.4, 0), pad(3.2, 0)]);
  check('a chain still pours as one when its middle is listed last',
    outOfOrder.length, 1);
  check('with all three in it', outOfOrder[0].columns.length, 3);
  near('and the same span as in order', outOfOrder[0].maxX - outOfOrder[0].minX, 9.4);
}

// ── PILES ARE NOT PADS ─────────────────────────────────────────────────────
//
// A pile is a hole, not a footing to pour a rectangle over, so it never joins
// a group and never draws one.
{
  check('a pile is left out of the pads',
    padGroups([pad(0, 0), pad(0.5, 0, 'pile12')]).length, 1);
  check('and a drawing of only piles has no pad groups at all',
    padGroups([pad(0, 0, 'pile12'), pad(1, 0, 'pile10')]).length, 0);
}

// ── THINGS THAT ARE NOT A COLUMN ───────────────────────────────────────────
{
  check('no columns is no groups', padGroups([]).length, 0);
  check('and neither is nothing', padGroups(null).length, 0);
  check('a column with no point is skipped rather than thrown at',
    padGroups([pad(0, 0), { footing: 'pad36' }]).length, 1);
  check('and so is one whose point is not numbers',
    padGroups([pad(0, 0), { point: { x: NaN, z: 0 }, footing: 'pad36' }]).length, 1);
}

// ── THE GAP IS A PARAMETER ─────────────────────────────────────────────────
//
// Zero turns joining off, which is the only way the checks above can be said
// to measure the gap rather than the fixture.
{
  check('a zero gap joins only what actually overlaps',
    padGroups([pad(0, 0), pad(3.2, 0)], { joinGapFt: 0 }).length, 2);
  check('a wide gap joins what a narrow one did not',
    padGroups([pad(0, 0), pad(10, 0)], { joinGapFt: 8 }).length, 1);
}

console.log(`\npad footings: ${ran} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
