// THE FLOOR OVER THE GARAGE — the joist is the package less its sheathing.
//
// PROJECT.html defaults the over-garage level to a deeper joist than the
// house, because a garage spans clear and 11 7/8" that draws perfectly over a
// bedroom will not cross a double bay. The depth was quoted as "20 inches" on
// 5 Sep and written into the page as the JOIST. It is the PACKAGE (Movie,
// 6 Sep: "should be 19.25\" with 3/4\" ply sheathing"), so the page built the
// floor 3/4" too deep and put the deck at 10'-9 7/8" instead of 10'-9 1/8".
//
// THREE-QUARTERS OF AN INCH IS EXACTLY THE POINT OF THE NUMBER. Movie chose
// it so "the top of the floor 3/4\" sheathing should line up with the 3/4\" on
// the 11 7/8\"" -- the two floors' finished tops meeting at one datum. Being
// out by one sheathing thickness is the one error that destroys the reason
// the number was picked, and it looks entirely plausible in the source.
//
// WHY A HARNESS AND NOT A PAGE SPEC. The constant is inline in a page and the
// arithmetic is pure, so this reads it out of the file and checks the
// relationship directly. A page spec would have to reach the over-garage row
// through the UI, and a check that cannot reach what it checks passes for the
// wrong reason.
//
// IT LOOKS IN BOTH HOMES, BECAUSE THE NUMBER IS ABOUT TO MOVE. Devin ruled on
// 6 Sep that level-assembly.js becomes role-aware -- defaultLevelAssembly
// (levelRole) -- so there is ONE deriver instead of PROJECT.html's per-level
// table and the module's level-blind one. When that lands the constant leaves
// PROJECT.html. A harness anchored on the old home only would go red on the
// PR that does the move, for a reason belonging to this file rather than to
// that change, and the temptation then is to delete the check to get green.
//
// So it finds the number wherever it lives and SAYS WHICH. What it will not
// accept is neither home and it will not accept both: one missing is the move
// half-done, and two is the fourth-copy problem all over again.
//
// WHAT IT DELIBERATELY DOES NOT DO: it does not assert 19.25 alone. A lone
// literal would survive the exact mistake being guarded against, because 20
// is also a lone literal and reads just as well. The checks below tie the
// joist to the sheathing and to the deck, so the only way to satisfy them is
// to have the package right.
//
// Run: node proto/over-garage-floor-harness.js
const fs = require('fs');
const path = require('path');
const HOMES = [
  { file: 'PROJECT.html', name: 'OVER_GARAGE_JOIST_IN' },
  { file: 'level-assembly.js', name: 'OVER_GARAGE_JOIST_IN' },
];
require('./harness-args.js').noFlags();

// Anchored on the DEFINITION, `const NAME =`, not a bare mention. The name
// appears in prose above each constant, and a whole-file search for it finds
// the comment first -- the wrong-scope habit that has cost this migration
// four separate readings.
const constIn = (src, name, where) => {
  const m = new RegExp(`^\\s*const ${name} = ([^;]+);`, 'm').exec(src);
  if (!m) throw new Error(`${name}: no definition found in ${where}`);
  // eslint-disable-next-line no-new-func
  const value = new Function(`return (${m[1]});`)();
  if (!Number.isFinite(value)) throw new Error(`${name}: not a number (${m[1]})`);
  return value;
};

const found = HOMES
  .map(home => {
    const full = path.join(__dirname, '..', home.file);
    if (!fs.existsSync(full)) return null;
    const src = fs.readFileSync(full, 'utf8');
    if (!new RegExp(`^\\s*const ${home.name} = `, 'm').test(src)) return null;
    return { ...home, value: constIn(src, home.name, home.file) };
  })
  .filter(Boolean);
if (found.length === 0) {
  console.log(`  \u2718 OVER_GARAGE_JOIST_IN is defined in neither `
    + `${HOMES.map(h => h.file).join(' nor ')} -- it has moved somewhere this `
    + `harness does not look, and nothing is checking the package arithmetic`);
  console.log('over-garage floor harness: 0 checks passed, 1 failed');
  process.exit(1);
}
if (found.length > 1) {
  console.log(`  \u2718 OVER_GARAGE_JOIST_IN is defined in ${found.length} places `
    + `(${found.map(h => h.file).join(', ')}) -- two homes for one number is the `
    + `divergence this repo spent 6 Sep removing`);
  console.log('over-garage floor harness: 0 checks passed, 1 failed');
  process.exit(1);
}
const HOME = found[0];
const JOIST_IN = HOME.value;
const GARAGE_WALL_FT = 109.125 / 12;   // 9'-1 1/8", project-page.js GARAGE_WALL_FT
const SHEATHING_IN = 0.75;             // level-assembly.js DEFAULT_FLOOR_ASSEMBLY
const HOUSE_JOIST_IN = 11.875;         // the house floor this one has to meet

const CHECKS = [];
const check = (label, got, want) => CHECKS.push({ label, got, want });
const near = (a, b) => Math.abs(a - b) < 1e-9;
const ftIn = inches => {
  const ft = Math.floor(inches / 12), rest = inches - ft * 12;
  const whole = Math.floor(rest), eighths = Math.round((rest - whole) * 8);
  const frac = ['', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8'][eighths];
  return `${ft}'-${whole}${frac ? ` ${frac}` : ''}"`;
};

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
const houseTopFromItsBearing = HOUSE_JOIST_IN + SHEATHING_IN;
const garageTopFromItsBearing = JOIST_IN + SHEATHING_IN;
check('both floors are a joist under 3/4" ply, so both tops are the package',
  near(houseTopFromItsBearing, 12.625) && near(garageTopFromItsBearing, 20), true);
// A drafter reads this as "the garage floor is 7 3/8" deeper than the house
// floor" -- true of the joists AND of the packages, because the sheathing is
// the same both sides. It stops being true the moment one side is quoted as a
// package and the other as a joist, which is the failure this file exists for.
check('the two packages differ by exactly the two joists',
  near(garageTopFromItsBearing - houseTopFromItsBearing, JOIST_IN - HOUSE_JOIST_IN), true);

let failed = 0;
for (const { label, got, want } of CHECKS) {
  const ok = typeof got === 'object' ? false : got === want;
  if (!ok) { failed += 1; console.log(`  ✘ ${label}\n       got ${got}, want ${want}`); }
}
console.log(`over-garage floor harness: ${CHECKS.length - failed} checks passed, `
  + `${failed} failed (read from ${HOME.file})`);
process.exit(failed ? 1 : 0);
