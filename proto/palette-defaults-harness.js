// THE PAGE'S OWN COPY OF THE PALETTE, CHECKED AGAINST THE PALETTE.
//
// MODEL.html declares eight palette roles as CSS literals in its :root --
// --surface-page, --surface-chip, --edge-panel, --ink-primary,
// --ink-secondary, --ink-quiet, --accent and --accent-mark -- and every one of
// them is a hand-copy of palette.js's ruff/night value. They agree today.
// Nothing asserted they keep agreeing, which is the whole of this file.
//
// IT IS NOT A LATENT RISK, IT IS A VISIBLE ONE. DraftPalette.apply() runs at
// MODEL.html:1506, inside <body> (which opens at :980), so these eight
// literals are what paints until that line executes. Change a night value in
// palette.js and MODEL flashes the OLD colour on every load -- briefly, on the
// page a drafter opens most, and on nobody's screen long enough to be reported
// as a bug.
//
// RUFF/NIGHT IS THE RIGHT EXPECTATION, and it is named by the code twice:
// apply()'s own signature is `apply(doc, theme = 'ruff', mode = 'night')`, and
// MODEL's boot reads `storedOr('theme', ..., 'ruff')` and
// `storedOr('mode', ..., 'night')`. A fallback that matched some other skin
// would be a flash of a colour the page never settles on.
//
// THE POPULATION IS DERIVED BY ROLE MEMBERSHIP, NOT BY NAME. The tempting
// scan is "every --something: #hex in a page", and it is wrong in a way that
// costs an argument: index.html declares --ink, --paper, --blue-dark,
// --blue-medium and --blue-light, which are ENTRY's own variables and not
// palette roles at all. A prefix rule drags ENTRY onto a roster it is
// deliberately off -- it takes no skin, by the ruling board #310 already holds
// it apart under -- and then demands it match a palette it does not use. So a
// declaration counts only when its name is a MEMBER of DraftPalette.ROLES.
// Check 4 is that distinction, frozen.
//
// NOTHING HERE WRITES TO THE REPO. The subject is file TEXT and the scanner
// that reads it, so a mutation swaps the READER rather than the file. A
// harness that edits tracked files to test them leaves them edited when it
// dies, and the first person to notice is whoever commits the mutant.
//
// WHAT IT DOES NOT CHECK, said plainly so it cannot look tested: rgba() and
// color-mix() declarations of a role, and any role declared outside a plain
// `--name: #hex` form. MODEL declares all eight in that form; if a ninth ever
// lands as rgba(), this harness will not see it.
//
// Run: node proto/palette-defaults-harness.js          (checks)
//      node proto/palette-defaults-harness.js --mutate (checks + mutation table)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const MUTATION_MODE = require('./harness-args.js').mutationMode();

const ROOT = path.join(__dirname, '..');

// palette.js is the ORACLE here, not the subject, so it is loaded rather than
// source-evaluated -- but in a sandbox, because a harness that leaks a global
// `window` into its own process is one require away from changing what it is
// measuring.
function loadPalette(src) {
  const sandbox = { window: {} };
  vm.runInNewContext(src, sandbox);
  return sandbox.window.DraftPalette;
}
const PALETTE_SRC = fs.readFileSync(path.join(ROOT, 'palette.js'), 'utf8');

// ── The scanner ───────────────────────────────────────────────────────
//
// `let`, all four, and that is the seam the instrument mutations hang on:
// each swaps a part for a defective version, runs the checks, and puts it back.

// Comments come out first. A role named in prose -- "this was --ink-primary:
// #e7e5e2" -- is documentation, not a declaration.
let decomment = src => src
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/\/\*[\s\S]*?\*\//g, ' ');

let DECL = /--([a-z][a-z0-9-]*)\s*:\s*(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})\s*[;}]/g;

let isRole = (name, roles) => roles.includes(name);

let readPage = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

const PAGES = () => fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).sort();

function scan(roles) {
  const found = [];
  for (const page of PAGES()) {
    const src = decomment(readPage(page));
    DECL.lastIndex = 0;
    let m;
    while ((m = DECL.exec(src)) !== null) {
      if (isRole(m[1], roles)) found.push({ page, role: m[1], hex: m[2].toLowerCase() });
    }
  }
  return found;
}

// ── The checks ────────────────────────────────────────────────────────
let failures = [];
const ok = (cond, msg) => { if (!cond) failures.push(msg); };

function run(mutate) {
  failures = [];
  const src = mutate && mutate.palette ? mutate.palette(PALETTE_SRC) : PALETTE_SRC;
  const P = loadPalette(src);
  const roles = P.ROLES;
  const expected = P.resolve(EXPECT_THEME, EXPECT_MODE);

  const found = scan(roles);

  // 1. THE SCAN FOUND SOMETHING. Every check below is "each found value
  //    matches", which is triumphantly true of nothing at all.
  ok(found.length >= 8,
    `the scan found ${found.length} hand-copied role defaults -- expected at least 8 (MODEL's)`);

  // 2. MODEL IS IN IT, BY NAME. A count alone survives a swap: another page
  //    growing eight while MODEL loses its :root keeps the total identical.
  const modelRoles = found.filter(f => f.page === 'MODEL.html').map(f => f.role);
  ok(modelRoles.length >= 8,
    `MODEL.html declares ${modelRoles.length} role defaults -- expected at least 8`);

  // 3. EVERY HAND-COPY EQUALS THE PALETTE. The reason the file exists.
  for (const f of found) {
    const want = String(expected[f.role] || '').toLowerCase();
    ok(f.hex === want,
      `${f.page} declares --${f.role}: ${f.hex} but palette.js `
      + `${EXPECT_THEME}/${EXPECT_MODE} is ${want || '(no such role)'}`);
  }

  // 4. ENTRY'S OWN VARIABLES ARE NOT ROLES, frozen because a prefix rule would
  //    have counted them and demanded index.html match a palette it does not
  //    use. --ink is not --ink-primary.
  ok(!found.some(f => f.page === 'index.html'),
    'index.html was counted -- its --ink / --paper are ENTRY\'s own variables, not palette roles');
  ok(!roles.includes('ink') && !roles.includes('paper'),
    'palette.js now has a role literally named ink or paper -- check 4 needs rewriting');

  // 5. THE SCANNER FINDS WHAT IT MUST, AND NOT WHAT IT MUST NOT. Fed by hand
  //    rather than by the repo, so a page changing shape cannot quietly turn
  //    this into a check of nothing.
  const probe = src2 => {
    const save = readPage;
    readPage = () => src2;
    try { return scan(roles).length; } finally { readPage = save; }
  };
  ok(probe(':root { --ink-primary: #e7e5e2; }') >= 1,
    'the scanner missed a plain role declaration it must find');
  ok(probe(':root { --ink: #163653; --paper: #eef5fb; }') === 0,
    'the scanner counted a non-role variable as a role');
  ok(probe('/* --ink-primary: #e7e5e2; was the old value */') === 0,
    'the scanner counted a role named inside a comment');
  ok(probe(':root { --ink-primary: var(--x); }') === 0,
    'the scanner counted a declaration that is not a hex literal');
}

// The skin the page falls back to before apply() runs. `let` so a mutation can
// point it at the wrong one.
let EXPECT_THEME = 'ruff';
let EXPECT_MODE = 'night';

run(null);
for (const f of failures) console.log(`  FAIL  ${f}`);
const checksPassed = failures.length === 0;
console.log(`palette-defaults-harness: ${checksPassed ? 'all checks passed' : `${failures.length} failed`}`);

if (!MUTATION_MODE) process.exit(checksPassed ? 0 : 1);
if (!checksPassed) {
  console.log('  checks are red -- the mutation table below would be meaningless');
  process.exit(1);
}

// ── The mutations ─────────────────────────────────────────────────────
//
// Two kinds. SUBJECT mutations drift a value the way a real edit would, by
// swapping the reader or the oracle. INSTRUMENT mutations break the scanner on
// purpose, to watch the checks that guard it go red -- without that half this
// harness is the exact defect it exists to catch, one layer up.
const MUTATIONS = [
  // SUBJECT: a default drifts from the palette.
  ['a page default drifts from palette.js', () => {
    const save = readPage;
    readPage = f => save(f).replace('--surface-page: #1d1f20', '--surface-page: #1d1f21');
    return () => { readPage = save; };
  }],

  // SUBJECT: the palette moves and the page is left behind -- the real-world
  // direction of this defect.
  ['palette.js moves and the page is not updated', () => {
    const restore = () => {};
    const save = EXPECT_MODE;
    EXPECT_MODE = 'day';
    return () => { EXPECT_MODE = save; restore(); };
  }],

  // SUBJECT: MODEL loses its :root block entirely.
  ['MODEL loses its role defaults', () => {
    const save = readPage;
    readPage = f => (f === 'MODEL.html' ? save(f).replace(/--(surface|ink|edge|accent)[a-z-]*:\s*#[0-9a-fA-F]{6}/g, '') : save(f));
    return () => { readPage = save; };
  }],

  // INSTRUMENT: the scanner stops matching anything.
  ['the declaration pattern stops matching', () => {
    const save = DECL;
    DECL = /--(zzz-no-such)\s*:\s*(#[0-9a-fA-F]{6})\s*[;}]/g;
    return () => { DECL = save; };
  }],

  // INSTRUMENT: role membership is dropped, so any --x: #hex counts. This is
  // the mutation check 4 exists for: it drags index.html in.
  ['role membership is not checked', () => {
    const save = isRole;
    isRole = () => true;
    return () => { isRole = save; };
  }],

  // INSTRUMENT: comments are no longer stripped, so a role named in prose
  // counts as a declaration.
  ['comments are no longer stripped', () => {
    const save = decomment;
    decomment = s => s;
    return () => { decomment = save; };
  }],
];

let caught = 0;
for (const [name, apply] of MUTATIONS) {
  const undo = apply();
  run(null);
  const fired = failures.length > 0;
  undo();
  if (fired) caught += 1;
  else console.log(`  SURVIVED  ${name}`);
}
run(null);
if (failures.length) {
  console.log('  the tree did not come back clean after the mutation table');
  process.exit(1);
}
console.log(`palette-defaults-harness: ${caught}/${MUTATIONS.length} mutations caught`);
process.exit(caught === MUTATIONS.length ? 0 : 1);
