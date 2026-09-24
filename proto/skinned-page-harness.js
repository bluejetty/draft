// A SKINNED PAGE, PROVEN RATHER THAN GREPPED.
//
// PROJECT.html was converted to palette.js roles on 23 Sep and LAYOUT.html on
// 24 Sep. Nothing stops the next edit putting a literal back, and a colour
// literal is the quietest possible regression: the page looks perfect on
// whichever skin the author happened to have open, and wrong on the other
// three. Nobody sees it until Movie flips the lights.
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
// converted pages have none, and a `\bred\b` rule would fire on prose. If a
// named colour ever lands in a value here, this harness will not see it.
//
// Run: node proto/skinned-page-harness.js          (checks)
//      node proto/skinned-page-harness.js --mutate (checks + mutation table)
const fs = require('fs');
const path = require('path');
const MUTATION_MODE = require('./harness-args.js').mutationMode();

const ROOT = path.join(__dirname, '..');

// ── The scanner ───────────────────────────────────────────────────────
//
// `let`, all four, and that is the seam the instrument mutations hang on:
// each one swaps a part for a defective version, runs the checks, and puts it
// back. Nothing else reaches these.

// Comments come out FIRST. A hex named in prose -- "this was the literal
// #1d1f20" -- is documentation, not paint, and the comments on these very
// conversions say the old colours out loud. Stripping rather than excusing
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

// ── Where a literal is allowed to stay, and why ───────────────────────
//
// An allowlist with no reason beside each entry is a place to hide a
// regression.
//
// A REGION IS A PART OF A FILE WITH ITS OWN LIST, and LAYOUT.html is why the
// idea exists at all. Its painter is allowed white paper and near-black ink --
// that is what a construction sheet IS, on every skin, because that is the
// sheet the plotter prints. Its stylesheet is allowed neither, because nothing
// in the stylesheet paints on paper. Scanned as ONE file those two lists merge
// and the rule goes soft: #1d1f20 coming back into a panel rule reads as the
// margin border and sails through.
//
// THAT IS NOT A HYPOTHETICAL. The mutation "a bare hex comes back into the
// stylesheet" was written aimed at #1d1f20 and SURVIVED -- the only mutant
// this table has ever let past -- which is what the split was written for and
// what the two slicers below exist to make checkable.
let STYLE = src => {
  const a = src.indexOf('<style>');
  const b = src.indexOf('</style>');
  if (a < 0 || b < 0) throw new Error('no <style> block to scan');
  return src.slice(a, b + '</style>'.length);
};
let NOT_STYLE = src => {
  const a = src.indexOf('<style>');
  const b = src.indexOf('</style>');
  if (a < 0 || b < 0) throw new Error('no <style> block to scan');
  return src.slice(0, a) + src.slice(b + '</style>'.length);
};
let WHOLE = src => src;

// PROJECT.html -- all three are in SPEC-project-shell.md with their measured
// contrast; none has a role in palette.js to go to. One region, because that
// page has no canvas of its own to hold paper on.
const PROJECT_ALLOWED = Object.freeze({
  '#a06035': 'the .notice left border -- no role for a warning',
  'rgba(160,96,53,.08)': 'the .notice tint, the same warning colour',
  '#557a46': '#status -- no role for a success message',
});

const SUBJECTS = Object.freeze([
  { page: 'PROJECT.html', regions: [
    { what: 'anywhere on the page', slice: WHOLE, allowed: PROJECT_ALLOWED },
  ] },
  { page: 'LAYOUT.html', regions: [
    // THE CHROME. Three, and none of them is a surface the skin owns: two
    // states of a sentence and the veil a modal sits under. 83 of this
    // block's 86 literals became roles.
    { what: 'its stylesheet', slice: STYLE, allowed: Object.freeze({
      '#557a46': 'the profile dialog said yes -- no role for a success message',
      '#b04050': 'the profile dialog said no, and a failed sheet save -- no '
        + 'role for a failure message either. MODEL.html keeps the same value '
        + 'on .sel-help',
      'rgba(0,0,0,0.35)': 'the modal scrim and the dialog shadow. '
        + 'shell-bars.css names this exact value as one of the four literals '
        + 'that survive its own palette, for the same reason: black at 35% '
        + 'darkens whatever is behind it, which is the job on all four skins',
    }) },
    // THE SHEET. Every one of these is drawn inside the paper rectangle, and
    // that is the whole justification: a drafter's screen has to match the
    // plot, and the plot is white with near-black ink whatever the lights in
    // the room are doing. The desk the paper lies on and the label above it
    // are roles -- see the two checks further down, which pin both halves.
    { what: 'its canvas painter', slice: NOT_STYLE, allowed: Object.freeze({
      '#ffffff': 'the sheet itself, and the paperColor both painters are handed',
      '#1d1f20': 'the margin border a right-strip titleblock draws ON the sheet',
      'rgba(29,31,32,0.18)': 'the dashed margin guide, the placeholder '
        + 'titleblock word and an unselected viewport frame -- all on the sheet',
      'rgba(29,31,32,0.25)': 'the placeholder titleblock box, on the sheet',
      'rgba(29,31,32,0.45)': 'an unselected viewport caption, on the sheet',
      '#5980a6': 'a selected viewport frame and its caption. The drafting blue '
        + 'rather than --accent BECAUSE it is on the sheet: an accent is '
        + "measured against its own skin's page, and ROUGH's night blue is "
        + 'lifted to clear AA on black, which leaves it near 2.4 on white paper',
      'rgba(0,0,0,0.22)': "the paper's drop shadow -- a light, not a colour, "
        + 'and on the day skin the only thing holding the sheet off the desk',
    }) },
  ] },
]);

const strays = (src, allowed = PROJECT_ALLOWED) =>
  literalsIn(src).filter(lit => !(lit in allowed));

// The subjects, read through ONE seam so a mutation can hand back altered text
// for any of them without touching a file on disk.
let read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
// Code is the subject for every check below that is not about colour, so
// comments come off first -- exactly as they do for the colour scan, and for
// the reason the mutation table found. See the note by the palette checks.
const code = file => decomment(read(file));

const CHECKS = [];
const check = (label, fn) => CHECKS.push({ label, fn });

// ── The scanner is real ───────────────────────────────────────────────
// Fixtures, not the pages: these must hold whatever the pages contain today,
// so they cannot be satisfied by a subject drifting.

check('the scanner finds a bare hex',
  () => [literalsIn('a { color:#c0ffee; }').join(), '#c0ffee']);
check('the scanner finds a three-digit hex',
  () => [literalsIn('a { color:#fed; }').join(), '#fed']);
check('the scanner finds an rgba()',
  () => [literalsIn('a { color:rgba(29,31,32,.65); }').join(), 'rgba(29,31,32,.65)']);
check('the scanner finds an hsl()',
  () => [literalsIn('a { color:hsl(210,30%,50%); }').join(), 'hsl(210,30%,50%)']);
// THE MISTAKE, FROZEN. Three entities PROJECT.html really uses.
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
// ONE LIST PER REGION, and that has to be true rather than intended: the
// drafting blue is the selected viewport's frame on LAYOUT's sheet and has no
// business in either page's stylesheet.
const layoutRegion = what =>
  SUBJECTS.find(s => s.page === 'LAYOUT.html').regions.find(r => r.what === what).allowed;
check('a region is judged by its OWN allowlist, not a neighbour\'s',
  () => [[PROJECT_ALLOWED, layoutRegion('its stylesheet'), layoutRegion('its canvas painter')]
    .map(list => strays('a { color:#5980a6; }', list).join() || '-').join('|'),
  '#5980a6|#5980a6|-']);

// ── The slicers are real ──────────────────────────────────────────────
// Same argument as the scanner: a slicer that hands back nothing reports the
// same "no strays" as a region that has none, and a slicer that hands back
// everything merges the lists it was written to keep apart.

const FIXTURE = '<p>#aaaaaa</p><style>\n  a { color:#bbbbbb; }\n</style><b>#cccccc</b>';
check('STYLE takes the stylesheet and only the stylesheet',
  () => [literalsIn(STYLE(FIXTURE)).join(), '#bbbbbb']);
check('NOT_STYLE takes everything else and only that',
  () => [literalsIn(NOT_STYLE(FIXTURE)).join(), '#aaaaaa,#cccccc']);
check('and between them they lose nothing',
  () => [literalsIn(STYLE(FIXTURE)).length + literalsIn(NOT_STYLE(FIXTURE)).length,
    literalsIn(WHOLE(FIXTURE)).length]);

// ── Both pages are skinned ────────────────────────────────────────────

for (const { page, regions } of SUBJECTS) {
  for (const { what, slice, allowed } of regions) {
    check(`${page} carries no colour literal in ${what} outside its allowlist`,
      () => [strays(slice(read(page)), allowed).join(' '), '']);
    check(`every literal ${page} keeps in ${what} carries a reason`,
      () => [Object.values(allowed).filter(why => !why || why.length < 20).length, 0]);
  }

  // A page written entirely in --role tokens and never handed a skin renders
  // with every token undefined. It is a state PROJECT.html was actually in
  // for an hour, and it looks like a stylesheet bug rather than a missing
  // call.
  // TWO CHECKS, NOT ONE WITH A DISTANCE WINDOW. The first draft asked for
  // `DraftPalette` within 600 characters of `.apply(document` and went red on
  // the real file, because the boot reads the query string and localStorage in
  // between. A proximity anchor measures how the code is laid out, not what it
  // does, and it rots the moment somebody adds a line.
  //
  // AND THEY READ DECOMMENTED SOURCE, which the mutation table is the only
  // reason this file knows. `includes('draft-skin')` passed against a page
  // whose CODE had been changed to 'project-skin', because the comment four
  // lines above still NAMED the key -- the check was reading the prose
  // describing the behaviour instead of the behaviour. It survived as a
  // mutation, which is the whole argument for running the table: it looked
  // like a perfectly good check.
  check(`${page} reaches for the palette`,
    () => [code(page).includes('window.DraftPalette'), true]);
  check(`${page} hands the document a skin`,
    () => [code(page).includes('.apply(document,'), true]);
  check(`${page} reads the skin MODEL writes, rather than choosing its own`,
    () => [code(page).includes("'draft-skin'"), true]);

  // COLOUR BEFORE ANYTHING PAINTS. palette.js has to be defined before the
  // script that applies it; if another module reached for a role first it
  // would get undefined, and palette.js is the one file in this chain that
  // must lead.
  check(`palette.js is the first script ${page} loads`,
    () => [(code(page).match(/<script src="([^"]+)"/) || [])[1], './palette.js']);

  // THE SPECS DEFECT, AS A RULE. That page mapped a dark BACKGROUND to
  // --ink-primary because the pair it was converting read like ink and page.
  // On night --ink-primary is #e7e5e2, so the chip came out near-white with
  // near-white lettering on it. A selected face is --accent with --accent-ink;
  // an ink role is never a ground.
  check(`${page} never paints a background with an ink role`,
    () => [(code(page).match(/background(?:-color)?\s*:\s*var\(--ink-[a-z]+/g) || []).join(' '), '']);
}

// THE ALLOWLISTS ARE PART OF THE CONTRACT, not a convenience. Widening one is
// a decision, and a decision should have to edit a line that says so.
check('the allowlists are exactly the ones recorded here',
  () => [SUBJECTS.map(({ page, regions }) => regions
    .map(r => `${page}/${r.what}: ${Object.keys(r.allowed).sort().join(' ')}`)
    .join('\n')).join('\n'),
  [
    'PROJECT.html/anywhere on the page: #557a46 #a06035 rgba(160,96,53,.08)',
    'LAYOUT.html/its stylesheet: #557a46 #b04050 rgba(0,0,0,0.35)',
    'LAYOUT.html/its canvas painter: #1d1f20 #5980a6 #ffffff rgba(0,0,0,0.22) '
      + 'rgba(29,31,32,0.18) rgba(29,31,32,0.25) rgba(29,31,32,0.45)',
  ].join('\n')]);

// ── The canvas is the half a stylesheet sweep misses ──────────────────
//
// project-page.js painted sections in a literal #1d1f20 -- right on a white
// page, invisible on a night one. The fallback literal is allowed; a bare
// assignment is not.
check('PROJECT: the section painter takes its ink from the page, not a literal',
  () => [/ctx\.strokeStyle = getComputedStyle\(canvas\)\.color/
    .test(code('project-page.js')), true]);

// LAYOUT's painter is inline, and it does the OPPOSITE thing on purpose, so
// both halves are pinned: the DESK comes from the palette, and the SHEET does
// not. The second is the one that needs a guard, because removing a literal
// always looks like progress -- somebody "finishing the conversion" by
// clearing the paper to --surface-page would hand the drafter a near-black
// sheet on the night skin and a plot that no longer matches the screen.
check('LAYOUT: the desk is cleared from the palette, not a literal',
  () => [/ctx\.fillStyle = skin\['surface-page'\]/.test(code('LAYOUT.html')), true]);
check('LAYOUT: and the sheet on it is still painted white',
  () => [/ctx\.fillStyle = '#ffffff';\s*ctx\.fillRect\(panX, panY/
    .test(code('LAYOUT.html')), true]);
check('LAYOUT: the painter asks the document which skin is on',
  () => [/getAttribute\('data-theme'\)/.test(code('LAYOUT.html')), true]);

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
// back into a page. INSTRUMENT mutations break the scanner, so the "0
// literals" result has been watched turning red rather than assumed to mean
// something. A guard that has never been seen to fail is worth nothing.

// Swap a `let` for the length of one run, then put it back whatever happens.
const swapping = (get, set, broken, thenRun) => {
  const real = get();
  set(broken);
  try { return thenRun(); } finally { set(real); }
};

// A subject mutation edits the TEXT the reader hands back for ONE file. The
// refusal when nothing changed is what stops an anchor rotting into a silent
// pass -- the failure mode this repo has now hit four times.
const editing = (file, edit) => () => {
  const real = read;
  const before = real(file);
  const after = edit(before);
  if (after === before) throw new Error('mutation matched nothing -- it would prove nothing');
  return swapping(() => read, v => { read = v; },
    f => (f === file ? after : real(f)), run);
};

const MUTATIONS = [
  // --- PROJECT.html ----------------------------------------------------
  ['PROJECT: a bare hex comes back into the stylesheet',
    editing('PROJECT.html', s => s.replace('color:var(--ink-primary);', 'color:#1d1f20;'))],
  ['PROJECT: an rgba() comes back into the stylesheet',
    editing('PROJECT.html', s => s.replace('color:var(--ink-secondary);', 'color:rgba(29,31,32,.65);'))],
  ['PROJECT: the accent goes back to the literal drafting blue',
    editing('PROJECT.html', s => s.replace('border-color:var(--accent)', 'border-color:#5980a6'))],
  ['PROJECT: the page stops applying a skin',
    editing('PROJECT.html', s => s.replace('P.apply(document,', 'void (document,'))],
  ['PROJECT: the page picks its own skin instead of the one MODEL wrote',
    editing('PROJECT.html', s => s.replace("'draft-skin'", "'project-skin'"))],
  ['PROJECT: palette.js loses its place at the front',
    editing('PROJECT.html', s => s.replace(
      '<script src="./palette.js"></script>',
      '<script src="./shared-file-store.js"></script>\n  <script src="./palette.js"></script>'))],
  ['PROJECT: the section painter goes back to a hardcoded ink',
    editing('project-page.js', s => s.replace(
      'ctx.strokeStyle = getComputedStyle(canvas).color', "ctx.strokeStyle = '#1d1f20'; //"))],

  // --- LAYOUT.html -----------------------------------------------------
  ['LAYOUT: a bare hex comes back into the stylesheet',
    editing('LAYOUT.html', s => s.replace('color: var(--ink-primary); font-size:13px;',
      'color:#1d1f20; font-size:13px;'))],
  ['LAYOUT: an rgba() comes back into the stylesheet',
    editing('LAYOUT.html', s => s.replace('border-top:1px solid var(--edge-panel);',
      'border-top:1px solid rgba(29,31,32,0.16);'))],
  ['LAYOUT: the page stops applying a skin',
    editing('LAYOUT.html', s => s.replace('P.apply(document,', 'void (document,'))],
  ['LAYOUT: the page picks its own skin instead of the one MODEL wrote',
    editing('LAYOUT.html', s => s.replace("'draft-skin'", "'layout-skin'"))],
  ['LAYOUT: palette.js loses its place at the front',
    editing('LAYOUT.html', s => s.replace(
      '<script src="./palette.js"></script>',
      '<script src="./profile-manager.js"></script>\n<script src="./palette.js"></script>'))],
  ['LAYOUT: the desk goes back to its literal grey',
    editing('LAYOUT.html', s => s.replace(
      "ctx.fillStyle = skin['surface-page'];", "ctx.fillStyle = '#c8c8c8';"))],
  // THE ONE THAT LOOKS LIKE PROGRESS. Nothing about it reads as a regression
  // -- it removes a literal -- and it hands the night skin a near-black sheet.
  ['LAYOUT: somebody "finishes the conversion" and skins the paper too',
    editing('LAYOUT.html', s => s.replace(
      "ctx.fillStyle = '#ffffff';\n    ctx.fillRect(panX, panY",
      "ctx.fillStyle = skin['surface-page'];\n    ctx.fillRect(panX, panY"))],
  // THE SPECS DEFECT ITSELF, aimed at the rule written for it: the chosen
  // paper chip goes back to reading as ink-and-page.
  ['LAYOUT: a selected chip maps its dark face to --ink-primary',
    editing('LAYOUT.html', s => s.replace(
      '.lay-pick.lay-paper.on { border-color: var(--accent);\n    background-color: var(--accent);',
      '.lay-pick.lay-paper.on { border-color: var(--ink-primary);\n    background-color: var(--ink-primary);'))],

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

  // --- the slicers -----------------------------------------------------
  // The regions are the strongest claim this file makes -- that LAYOUT's
  // stylesheet is held to a tighter list than its painter -- so the split is
  // broken on purpose in the two ways it could silently stop meaning
  // anything: one half coming back empty, and the two halves collapsing into
  // the one file they were separated from.
  ['THE SLICERS: the stylesheet region comes back empty, so it scans nothing', () =>
    swapping(() => STYLE, v => { STYLE = v; }, () => '', run)],
  ['THE SLICERS: the split collapses -- both regions scan the whole file again, '
    + 'which is the state the #1d1f20 mutant survived in', () =>
    swapping(() => STYLE, v => { STYLE = v; }, s => s,
      () => swapping(() => NOT_STYLE, v => { NOT_STYLE = v; }, s => s, run))],
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
