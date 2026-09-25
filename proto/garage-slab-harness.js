#!/usr/bin/env node
// THE GARAGE SLAB FALLS TO THE DOOR, AND THE DOOR IS THE ANCHOR.
//
// Movie, 25 Sep: the curb is "approx. 8" at garage door opening approx 4" or
// higher (if further than 32ft to back of garage) at back of garage"; "past 32
// ft the slab will continue at the slope of 1/8" per foot"; and then "use the
// CAP rule whenever the slope reaches top of concrete" ... "flatten it after
// 64' your right they can deal with it".
//
// WHICH END THE NUMBER IS MEASURED AT IS THE WHOLE QUESTION, and the repo had
// already admitted it did not know. project-page.js:565: the slope "had
// nothing to multiply ... so a sloped slab was drawn at whatever station its
// author happened to be thinking of, and nothing said which". That file
// anchors the BACK at 4" (:1584) and lets the door fall away.
//
// THE 64 SETTLES IT. 8" of curb at 1/8" per foot reaches the top of concrete
// after exactly 64 ft, which is the number Movie gave for where it flattens.
// Anchored at the back instead, nothing lands on 64 at all. And his 8"/4" pair
// is ONE garage read at both ends -- 32 ft of depth is 4" of fall -- so the two
// halves of his sentence describe the same slab rather than two rules.
//
// Run: node proto/garage-slab-harness.js
require('./harness-args.js').noFlags();
const { loadDraftModules } = require('./harness-env.js');
const CV = (loadDraftModules() || global.window).DraftCutView;
const below = CV.garageSlabBelowConcreteIn;
const S = CV.STANDARDS;

let failed = 0, ran = 0;
const near = (label, got, want, tol = 1e-9) => {
  ran += 1;
  if (Math.abs(got - want) <= tol) return;
  failed += 1;
  console.log(`  FAIL ${label}\n       got ${got}, want ${want}`);
};
const check = (label, got, want) => {
  ran += 1;
  if (got === want) return;
  failed += 1;
  console.log(`  FAIL ${label}\n       got ${got}, want ${want}`);
};

// ── THE TWO ENDS MOVIE NAMED ───────────────────────────────────────────────
{
  near('the door end is 8 inches down', below(0), 8);
  // 32 ft of depth is 4" of fall, which is the other half of his sentence --
  // so both numbers he gave are one garage, not two rules.
  near('and 32 ft in is the 4 inches he named at the back', below(32), 4);
}

// ── THE RATE BETWEEN THEM ──────────────────────────────────────────────────
//
// Written as a DIFFERENCE over a span rather than as a list of stations, so a
// slab anchored at the wrong end -- which matches at 32 ft by construction --
// still fails here.
{
  near('it rises an eighth of an inch per foot', below(8) - below(16), 1);
  near('and the rise is the same anywhere on the run',
    below(40) - below(48), below(8) - below(16));
  // ANCHORED AT THE BACK INSTEAD, a 24 ft garage reads 4" at the back and 7"
  // at the door. This is the station where the two anchors disagree most
  // cheaply, and it is the depth the section card actually draws.
  near('a typical 24 ft garage is 5 inches down at the back', below(24), 5);
}

// ── THE CAP ────────────────────────────────────────────────────────────────
{
  near('the curb runs out at 64 ft', below(64), 0);
  check('which is where the constant says it does', S.GARAGE_SLAB_FLAT_AT_FT, 64);
  // FLAT, NOT CLIMBING. An uncapped rate would put the slab ABOVE the top of
  // concrete past 64 ft -- a garage floor over its own grade beam.
  near('and past it the slab is level with the concrete, not above it',
    below(80), 0);
  near('still level a long way past', below(200), 0);
  check('it never goes negative anywhere on the run',
    [0, 10, 33, 63.9, 64, 64.1, 100, 1000].every(d => below(d) >= 0), true);
}

// ── THE CAP IS COMPOSED, NOT TYPED ─────────────────────────────────────────
//
// 64 is the quotient of the two numbers above it, so it follows if either
// moves. A literal 64 would drift the day the curb or the slope changes and
// nothing would say so.
{
  near('the flat station is the curb divided by the slope',
    S.GARAGE_SLAB_FLAT_AT_FT, S.GARAGE_SLAB_AT_DOOR_IN / S.GARAGE_SLAB_SLOPE_IN_PER_FT);
}

// ── OFF THE SLAB ───────────────────────────────────────────────────────────
//
// Nothing sits outside the garage. A negative distance is the door, because a
// silent negative curb would read as the slab rising out through the opening.
{
  near('a point outside the door is the door', below(-5), 8);
  near('and so is a nonsense one', below(NaN), 8);
  near('no argument at all is the door', below(), 8);
}

// ── THE DOOR BUCK ARITHMETIC IT HAS TO SUPPORT ─────────────────────────────
//
// Movie: a 1 ft buck cut from the top of the 32" grade beam leaves 20", and
// the slab overlapping the bottom of it brings the opening back to "24"
// overall height, (24" is the least acceptable grade beam depth for our
// residential situations". That only closes if the slab at the door is 8"
// down: 32 - 12 = 20, and the buck's remaining 4" below the slab is what the
// pour fills.
{
  const BEAM_IN = 32, BUCK_IN = 12, MIN_IN = 24;
  const slabAtDoor = below(0);
  near('the buck leaves the minimum beam depth once the slab overlaps it',
    BEAM_IN - BUCK_IN + (BUCK_IN - slabAtDoor), MIN_IN);
  near('and 4 inches of the buck sit below the slab, for the pour to fill',
    BUCK_IN - slabAtDoor, 4);
}

console.log(`\ngarage slab: ${ran} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
