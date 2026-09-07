// THE FLOOR OVER THE GARAGE — the joist is the package less its sheathing.
//
// The over-garage level defaults to a deeper joist than the house, because a
// garage spans clear and 11 7/8" that draws perfectly over a bedroom will not
// cross a double bay. The depth was quoted as "20 inches" on 5 Sep and written
// into PROJECT.html as the JOIST. It is the PACKAGE (Movie, 6 Sep: "should be
// 19.25\" with 3/4\" ply sheathing"), so the page built the floor 3/4" too deep
// and put the deck at 10'-9 7/8" instead of 10'-9 1/8".
//
// THREE-QUARTERS OF AN INCH IS EXACTLY THE POINT OF THE NUMBER. Movie chose it
// so "the top of the floor 3/4\" sheathing should line up with the 3/4\" on the
// 11 7/8\"" -- the two floors' finished tops meeting at one datum. Being out by
// one sheathing thickness is the one error that destroys the reason the number
// was picked, and it looks entirely plausible in the source.
//
// IT ASKS THE MODULE NOW, AND THAT IS THE WHOLE OF THIS REVISION. Two versions
// ago this sliced `const OVER_GARAGE_JOIST_IN` out of PROJECT.html by regex.
// Then Devin ruled level-assembly.js role-aware, the constant was going to
// move, and a harness anchored on the old home would have gone red on the PR
// that moved it -- someone else's change, failing on my file, at the moment
// deleting the check is the quick way to green. So the middle version searched
// BOTH homes and refused either extreme: neither meant the move went somewhere
// it could not see, both meant the fourth-copy problem again.
//
// That bridge did its job -- the constant moved in PR #323 and the harness
// followed it without being touched -- and it is now the wrong shape. It only
// ever survived a move whose destination I could name in advance. Asking
// defaultLevelAssembly('overGarage') needs no list, because the module is the
// single home BY CONSTRUCTION: there is nowhere else for the number to be, so
// "two homes" stops being a thing to check for and becomes a thing that cannot
// happen. The list goes, and both its failure branches with it.
//
// WHAT IT DELIBERATELY DOES NOT DO: it does not assert 19.25 alone. A lone
// literal would survive the exact mistake being guarded against, because 20 is
// also a lone literal and reads just as well. The checks below tie the joist to
// its sheathing, to the deck height, and to the house floor it has to meet, so
// the only way to satisfy them is to have the package right.
//
// Run: node proto/over-garage-floor-harness.js
const fs = require('fs');
const path = require('path');
require('./harness-args.js').noFlags();

const win = {};
// eslint-disable-next-line no-new-func
new Function('window', fs.readFileSync(path.join(__dirname, '..', 'level-assembly.js'), 'utf8'))(win);
const LA = win.DraftLevelAssembly;

// The role, not the level id. ROLE_BY_LEVEL_ID maps 4 -> 'overGarage' today,
// and a drawing that renumbers its levels must not silently take this check
// with it: what is being guarded is the floor over a garage, whatever id it
// wears. Asked through levelRole so the two stay tied if the map changes.
const ROLE = 'overGarage';
const JOIST_IN = LA.defaultLevelAssembly(ROLE).joistDepthIn;
const SHEATHING_IN = LA.defaultLevelAssembly(ROLE).sheathingIn;
const HOUSE_JOIST_IN = LA.defaultLevelAssembly('floor').joistDepthIn;
const GARAGE_WALL_FT = 109.125 / 12;   // 9'-1 1/8", project-page.js GARAGE_WALL_FT

const CHECKS = [];
const check = (label, got, want) => CHECKS.push({ label, got, want });
const near = (a, b) => Math.abs(a - b) < 1e-9;
const ftIn = inches => {
  const ft = Math.floor(inches / 12), rest = inches - ft * 12;
  const whole = Math.floor(rest), eighths = Math.round((rest - whole) * 8);
  const frac = ['', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8'][eighths];
  return `${ft}'-${whole}${frac ? ` ${frac}` : ''}"`;
};

// ── The role reaches the module at all ────────────────────────────────
// First, because everything below is vacuous if it does not. A role the
// module does not know returns the house floor, and every package check would
// then pass while measuring the wrong level entirely -- silence that looks
// exactly like agreement.
check('overGarage is a role the module knows',
  (LA.LEVEL_ROLES || []).includes(ROLE), true);
check('and it answers differently from a plain floor',
  JOIST_IN !== HOUSE_JOIST_IN, true);
check('and the level it belongs to still maps to it',
  LA.levelRole(Number(Object.keys(LA.ROLE_BY_LEVEL_ID)
    .find(id => LA.ROLE_BY_LEVEL_ID[id] === ROLE))), ROLE);

// ── The package, which is the number that was actually ruled ──────────
check('the joist plus its sheathing is a 20" package',
  JOIST_IN + SHEATHING_IN, 20);
check('so the joist itself is 19 1/4"',
  JOIST_IN, 19.25);
// The mistake in one line: quoting the package as the joist adds a sheathing.
check('the joist is NOT the package -- 20" here would build 3/4" too deep',
  JOIST_IN !== 20, true);

// ── The deck, which is where the error showed ─────────────────────────
const deckIn = GARAGE_WALL_FT * 12 + JOIST_IN + SHEATHING_IN;
check('the deck lands at 10\'-9 1/8" over the 9\'-1 1/8" garage wall',
  ftIn(deckIn), `10'-9 1/8"`);

// ── The reason for the number: two finished tops on one datum ─────────
// Both floors are joist + 3/4" ply. What must agree is not the joists but the
// tops, so this is written as the tops rather than as a difference of depths.
const houseTop = HOUSE_JOIST_IN + LA.defaultLevelAssembly('floor').sheathingIn;
const garageTop = JOIST_IN + SHEATHING_IN;
check('both floors are a joist under 3/4" ply, so both tops are the package',
  near(houseTop, 12.625) && near(garageTop, 20), true);
// A drafter reads this as "the garage floor is 7 3/8" deeper than the house
// floor" -- true of the joists AND of the packages, because the sheathing is
// the same both sides. It stops being true the moment one side is quoted as a
// package and the other as a joist, which is the failure this file exists for.
check('the two packages differ by exactly the two joists',
  near(garageTop - houseTop, JOIST_IN - HOUSE_JOIST_IN), true);

let failed = 0;
for (const { label, got, want } of CHECKS) {
  if (got !== want) { failed += 1; console.log(`  ✘ ${label}\n       got ${got}, want ${want}`); }
}
console.log(`over-garage floor harness: ${CHECKS.length - failed} checks passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
