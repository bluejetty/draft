// A SKINNED PAGE, PROVEN RATHER THAN GREPPED.
//
// PROJECT.html was converted to palette.js roles on 23 Sep. Nothing stops the
// next edit putting a literal back, and a colour literal is the quietest
// possible regression: the page looks perfect on whichever skin the author
// happened to have open, and wrong on the other three. Nobody sees it until
// Movie flips the lights.
//
// THE INSTRUMENT IS CHECKED BEFORE THE SUBJECT IS, and that is most of this
// file. A scanner that finds nothing reports the same "0 literals" as a page
// that has none, so ten checks feed it fixtures it MUST find and fixtures it
// MUST NOT, and the mutation table breaks the scanner on purpose to watch
// those checks go red. Without that half this harness is the exact defect it
// exists to catch, one layer up.
//
// AND THE REASON IT IS WRITTEN THAT WAY IS A MISTAKE MADE ON THIS PAGE. The
// count published in SPEC-project-shell.md was "54 hex literals". It was 36.
// `#[0-9a-f]{3,8}` matches `&#8217;`, `&#8242;` and `&#8540;` -- eighteen of
// the fifty-four were curly apostrophes and fraction glyphs in the page's own
// prose. A pattern that matches the thing you are looking for will also match
// anything shaped like it, and that count was never checked against a single
// one of the lines it claimed. Check 5 is that mistake, frozen.
//
// NOTHING HERE WRITES TO THE REPO. The subject is file TEXT, so a mutation
// swaps the reader rather than the file. A harness that edits tracked files to
// test them leaves them edited when it dies, and the first person to notice is
// whoever commits the mutant.
//
// WHAT IT DOES NOT CHECK, said plainly so it cannot look tested: named CSS
// colours (`white`, `red`) and 8-digit hex with alpha are not scanned. The
// converted page has none, and a `\bred\b` rule would fire on prose. If a
// named colour ever lands in a value here, this harness will not see it.
//
// Run: node proto/skinned-page-harness.js          (checks)
//      node proto/skinned-page-harness.js --mutate (checks + mutation table)
const fs = require('fs');
const path = require('path');
const MUTATION_MODE = require('./harness-args.js').mutationMode();

const ROOT = path.join(__dirname, '..');
const PAGE = path.join(ROOT, 'PROJECT.html');
const MODULE = path.join(ROOT, 'project-page.js');

// ── The scanner ───────────────────────────────────────────────────────
//
// `let`, all four, and that is the seam the instrument mutations hang on:
// each one swaps a part for a defective version, runs the checks, and puts it
// back. Nothing else reaches these.

// Comments come out FIRST. A hex named in prose -- "this was the literal
// #1d1f20" -- is documentation, not paint, and the comments on this very
// conversion say the old colours out loud. Stripping rather than excusing
// them keeps the rule one rule.
let decomment = src => src
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ');

// The `(?<!&)` is check 5's mistake, fixed: an HTML entity is `&` then `#`
// then digits, so refusing a `#` preceded by `&` drops every one of them and
// nothing else.
let HEX = () => /(?<!&)#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/g;
let FUNC = () => /\b(?:rgba?|hsla?)\([^)]*\)/g;

const literalsIn = src => {
  const clean = decomment(src);
  return [...(clean.match(HEX()) || []), ...(clean.match(FUNC()) || [])];
};

// ── What each page is allowed to keep, and why ────────────────────────
//
// An allowlist with no reason beside each entry is a place to hide a
// regression. These two colours are in SPEC-project-shell.md with their
// measured contrast; neither has a role in palette.js to go to.
const ALLOWED = Object.freeze({
  '#a06035': 'the .notice left border -- no role for a warning',
  'rgba(160,96,53,.08)': 'the .notice tint, the same warning colour',
  '#557a46': '#status -- no role for a success message',
});

const strays = src => literalsIn(src).filter(lit => !(lit in ALLOWED));

// The subject, read through a seam so a mutation can hand back altered text
// without touching the file on disk.
let readPage = () => fs.readFileSync(PAGE, 'utf8');
let readModule = () => fs.readFileSync(MODULE, 'utf8');

const CHECKS = [];
const check = (label, fn) => CHECKS.push({ label, fn });

// ── The scanner is real ───────────────────────────────────────────────
// Fixtures, not the page: these must hold whatever PROJECT.html contains
// today, so they cannot be satisfied by the subject drifting.

check('the scanner finds a bare hex',
  () => [literalsIn('a { color:#5980a6; }').join(), '#5980a6']);
check('the scanner finds a three-digit hex',
  () => [literalsIn('a { color:#fff; }').join(), '#fff']);
check('the scanner finds an rgba()',
  () => [literalsIn('a { color:rgba(29,31,32,.65); }').join(), 'rgba(29,31,32,.65)']);
check('the scanner finds an hsl()',
  () => [literalsIn('a { color:hsl(210,30%,50%); }').join(), 'hsl(210,30%,50%)']);
// THE MISTAKE, FROZEN. Three entities this page really uses.
check('an HTML entity is not a colour',
  () => [literalsIn('<p>Movie&#8217;s 8&#8242; wall, 1&#8540;&Prime;</p>').length, 0]);
check('a hex inside a CSS comment is not paint',
  () => [literalsIn('a { /* was #1d1f20 */ color:var(--ink-primary); }').length, 0]);
check('a hex inside an HTML comment is not paint',
  () => [literalsIn('<!-- the old #f5f5f4 ground --><b>x</b>').length, 0]);
check('a hex inside a // line comment is not paint',
  () => [literalsIn('  // the literal #1d1f20 was wrong\n  x = 1;').length, 0]);
// And the other half of a real scanner: it must let the allowed ones past
// WITHOUT letting everything past.
check('an allowed literal is not a stray',
  () => [strays('a { border-color:#a06035; }').length, 0]);
check('an unlisted literal beside an allowed one is still a stray',
  () => [strays('a { border-color:#a06035; color:#c0ffee; }').join(), '#c0ffee']);

// ── PROJECT.html is skinned ───────────────────────────────────────────

check('PROJECT.html carries no colour literal outside the allowlist',
  () => [strays(readPage()).join(' '), '']);

// The allowlist is part of the contract, not a convenience. Widening it is a
// decision, and a decision should have to edit a line that says so.
check('the allowlist is exactly the three recorded in the spec',
  () => [Object.keys(ALLOWED).sort().join(' '),
    '#557a46 #a06035 rgba(160,96,53,.08)']);

// A page written entirely in --role tokens and never handed a skin renders
// with every token undefined. It is a state this page was actually in for an
// hour, and it looks like a stylesheet bug rather than a missing call.
// TWO CHECKS, NOT ONE WITH A DISTANCE WINDOW. The first draft asked for
// `DraftPalette` within 600 characters of `.apply(document` and went red on
// the real file, because the boot reads the query string and localStorage in
// between. A proximity anchor measures how the code is laid out, not what it
// does, and it rots the moment somebody adds a line.
//
// AND THEY READ DECOMMENTED SOURCE, which the mutation table is the only
// reason this file knows. `includes('draft-skin')` passed against a page whose
// CODE had been changed to 'project-skin', because the comment four lines
// above still NAMED the key -- the check was reading the prose describing the
// behaviour instead of the behaviour. It survived as a mutation, which is the
// whole argument for running the table: it looked like a perfectly good check.
// Code is the subject here, so comments come off first, exactly as they do for
// the colour scan.
const code = () => decomment(readPage());

check('PROJECT.html reaches for the palette',
  () => [code().includes('window.DraftPalette'), true]);
check('and hands the document a skin',
  () => [code().includes('.apply(document,'), true]);
check('and it reads the skin MODEL writes, rather than choosing its own',
  () => [code().includes("'draft-skin'"), true]);

// COLOUR BEFORE ANYTHING PAINTS. palette.js has to be defined before the
// script that applies it; if another module reached for a role first it would
// get undefined, and palette.js is the one file in this chain that must lead.
check('palette.js is the first script PROJECT.html loads',
  () => [(code().match(/<script src="([^"]+)"/) || [])[1], './palette.js']);

// THE CANVAS IS THE HALF A STYLESHEET SWEEP MISSES. project-page.js painted
// sections in a literal #1d1f20 -- right on a white page, invisible on a
// night one. The fallback literal is allowed; a bare assignment is not.
check('the section painter takes its ink from the page, not a literal',
  () => [/ctx\.strokeStyle = getComputedStyle\(canvas\)\.color/
    .test(decomment(readModule())), true]);

// ── Runner ────────────────────────────────────────────────────────────

function run() {
  const missed = [];
  for (const { label, fn } of CHECKS) {
    let got, want;
    try { [got, want] = fn(); } catch (err) { got = `threw ${err.message}`; want = null; }
    if (got !== want) missed.push({ label, got, want });
  }
  return missed;
}

const baseline = run();
for (const m of baseline) console.log(`  FAIL ${m.label}\n       got ${m.got}, want ${m.want}`);
console.log(`\n${CHECKS.length - baseline.length}/${CHECKS.length} checks passed`);

// ── Mutations ─────────────────────────────────────────────────────────
//
// Two kinds, and the second kind is the point. SUBJECT mutations put a literal
// back into the page text. INSTRUMENT mutations break the scanner, so the "0
// literals" result has been watched turning red rather than assumed to mean
// something. A guard that has never been seen to fail is worth nothing.

// Swap a `let` for the length of one run, then put it back whatever happens.
const swapping = (get, set, broken, thenRun) => {
  const real = get();
  set(broken);
  try { return thenRun(); } finally { set(real); }
};

// A subject mutation edits the TEXT the reader hands back. The refusal when
// nothing changed is what stops an anchor rotting into a silent pass -- the
// failure mode this repo has now hit four times.
const editing = (get, set, edit) => () => {
  const real = get()();
  const next = edit(real);
  if (next === real) throw new Error('mutation matched nothing -- it would prove nothing');
  return swapping(get, set, () => next, run);
};

const getPage = () => readPage, setPage = v => { readPage = v; };
const getModule = () => readModule, setModule = v => { readModule = v; };

const MUTATIONS = [
  // --- the subject -----------------------------------------------------
  ['a bare hex comes back into the stylesheet',
    editing(getPage, setPage, s => s.replace('color:var(--ink-primary);', 'color:#1d1f20;'))],
  ['an rgba() comes back into the stylesheet',
    editing(getPage, setPage, s => s.replace('color:var(--ink-secondary);', 'color:rgba(29,31,32,.65);'))],
  ['the accent goes back to the literal drafting blue',
    editing(getPage, setPage, s => s.replace('border-color:var(--accent)', 'border-color:#5980a6'))],
  ['the page stops applying a skin',
    editing(getPage, setPage, s => s.replace('P.apply(document,', 'void (document,'))],
  ['the page picks its own skin instead of the one MODEL wrote',
    editing(getPage, setPage, s => s.replace("'draft-skin'", "'project-skin'"))],
  ['palette.js loses its place at the front',
    editing(getPage, setPage, s => s.replace(
      '<script src="./palette.js"></script>',
      '<script src="./shared-file-store.js"></script>\n  <script src="./palette.js"></script>'))],
  ['the section painter goes back to a hardcoded ink',
    editing(getModule, setModule, s => s.replace(
      'ctx.strokeStyle = getComputedStyle(canvas).color', "ctx.strokeStyle = '#1d1f20'; //"))],

  // --- the instrument --------------------------------------------------
  // If breaking the scanner does NOT turn a check red, the green run above was
  // measuring nothing. The entity one is the original mistake put back.
  ['THE SCANNER: hex matching is blinded entirely', () =>
    swapping(() => HEX, v => { HEX = v; }, () => /a^/g, run)],
  ['THE SCANNER: rgba()/hsl() matching is blinded entirely', () =>
    swapping(() => FUNC, v => { FUNC = v; }, () => /a^/g, run)],
  ['THE SCANNER: the entity guard is dropped -- the original 54-vs-36 bug', () =>
    swapping(() => HEX, v => { HEX = v; }, () => /#[0-9a-fA-F]{3,8}\b/g, run)],
  ['THE SCANNER: comments stop being stripped, so prose counts as paint', () =>
    swapping(() => decomment, v => { decomment = v; }, s => s, run)],
  ['THE SCANNER: the allowlist becomes a blanket that excuses everything', () =>
    swapping(() => decomment, v => { decomment = v; }, s => s.replace(/#/g, 'X'), run)],
];

if (MUTATION_MODE) {
  console.log('\nMUTATION                                                              CAUGHT BY');
  let survivors = 0, broken = 0;
  for (const [label, apply] of MUTATIONS) {
    let by;
    try {
      const missed = apply();
      if (!missed.length) survivors += 1;
      by = missed.length ? missed.map(m => m.label).join('\n' + ' '.repeat(70)) : '*** NOTHING ***';
    } catch (err) {
      broken += 1;
      by = `!!! MUTATION DID NOT APPLY: ${err.message}`;
    }
    console.log(`${label.padEnd(70)}${by}`);
  }
  console.log(`\n${MUTATIONS.length - survivors - broken}/${MUTATIONS.length} mutations caught`);
  if (broken) console.log(`${broken} mutation(s) never applied -- they prove nothing`);
  if (!MUTATIONS.length) console.log('NO MUTATIONS DEFINED -- this table proves nothing');
  process.exit(baseline.length || survivors || broken || !MUTATIONS.length ? 1 : 0);
}

process.exit(baseline.length ? 1 : 0);
