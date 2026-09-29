#!/usr/bin/env node
// THE OFFICE MASTER — the written half of the set, checked as data.
//
// WHY IT EXISTS. Devin's audit, 28 Sep: `DraftSpecMaster` is named by
// SPECS.html and by nothing else -- no test, no harness. What the page proves
// when it renders is that text arrived; it does not prove the ADDRESSING is
// intact, and the addressing is the whole reason this file is a list of
// numbered sections rather than four pages of prose. The trades read 3-A by
// number. A section that quietly moves division, loses its letter or comes
// back with somebody else's division title is a spec that says the wrong
// thing on a job site while every page in the app still looks right.
//
// FOUR CLAIMS, AND EACH ONE COULD BREAK WITHOUT A PIXEL MOVING:
//   1. the numbering is sound -- ids unique, lettered in order, and each
//      section's id agrees with the division it says it is in.
//   2. sections() hands out COPIES. The master is the office's; a project that
//      edits its spec must not write through to the next project's.
//   3. `verify` and `note` are decided for every section, not left undefined
//      for the page to guess at. verify: true is how a per-project number --
//      a pile schedule, a bearing capacity -- is stopped from riding along
//      from the last job unread. That is the one in here with a job-site cost.
//   4. rows() splits what it is meant to split AND NOTHING ELSE. Nearly every
//      body line in the master begins with '- '; a splitter that got any
//      greedier would cut ordinary notes into columns.
//
// Run: node proto/spec-master-harness.js
//      node proto/spec-master-harness.js --mutate
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const MUTATE = require('./harness-args.js').mutationMode();

let EDIT = null;
const readSubject = name => {
  const text = fs.readFileSync(path.join(ROOT, name), 'utf8');
  return EDIT && EDIT.file === name ? EDIT.fn(text) : text;
};

function loadMaster() {
  const win = {};
  const sandbox = { window: win, console, Math, Number, String, Object, Array,
    JSON, Map, Set, RegExp, isFinite, parseFloat, parseInt };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readSubject('spec-master.js'), sandbox, { filename: 'spec-master.js' });
  if (!win.DraftSpecMaster) throw new Error('spec-master.js did not publish DraftSpecMaster');
  return win.DraftSpecMaster;
}

let passed = 0;
let failures = [];
const check = (label, condition, detail) => {
  if (condition) { passed += 1; return; }
  failures.push(detail ? `${label} — ${detail}` : label);
};

function runChecks() {
  passed = 0; failures = [];
  const M = loadMaster();
  const sections = M.sections();

  // ── THE DIVISIONS ────────────────────────────────────────────────────
  check('there are sixteen divisions', M.DIVISIONS.length === 16,
    `got ${M.DIVISIONS.length}`);
  check('they run 1 to 16 with no gap and no repeat',
    M.DIVISIONS.every((d, i) => d.no === i + 1),
    `numbers ${M.DIVISIONS.map(d => d.no).join(',')}`);
  check('every division has a title',
    M.DIVISIONS.every(d => typeof d.title === 'string' && d.title.trim().length > 0));
  check('the titles are distinct',
    new Set(M.DIVISIONS.map(d => d.title)).size === 16);
  check('division 1 is the general notes and 16 the electrical',
    M.divisionTitle(1) === 'GENERAL NOTES'
      && M.divisionTitle(16) === 'ELECTRICAL & COMMUNICATIONS');
  check('a division number the office does not have returns nothing, not a guess',
    M.divisionTitle(99) === '' && M.divisionTitle(0) === ''
      && M.divisionTitle(undefined) === '',
    'a fallback title would print the wrong division rule on a spec page');

  // ── THE NUMBERING ────────────────────────────────────────────────────
  check('the master carries every section it was transcribed with',
    sections.length === 42, `got ${sections.length}`);
  check('every id is unique',
    new Set(sections.map(s => s.id)).size === sections.length);
  check('every id agrees with the division the section says it is in',
    sections.every(s => Number(String(s.id).split('-')[0]) === s.div),
    sections.filter(s => Number(String(s.id).split('-')[0]) !== s.div)
      .map(s => `${s.id} is in div ${s.div}`).join('; '));
  check('every section belongs to a division that exists',
    sections.every(s => M.DIVISIONS.some(d => d.no === s.div)));
  check('each section carries its division\'s title, not another\'s',
    sections.every(s => s.divTitle === M.divisionTitle(s.div)));
  // NOT "A, B, C FROM A": division 6 opens with 6-0, the wood-construction
  // preamble, and the letters run from there. What has to hold is that the
  // suffixes ASCEND within a division, so a citation of 6-E lands on the
  // fifth lettered section and not on two of them.
  check('section suffixes ascend within each division, with none repeated',
    (() => {
      const last = new Map();
      return sections.every(s => {
        const suffix = String(s.id).split('-')[1];
        const before = last.get(s.div);
        last.set(s.div, suffix);
        return before === undefined || suffix > before;
      });
    })(), 'a gap or a repeat in the letters is a section the trades cannot cite');
  check('every suffix is a single character the trades can say out loud',
    sections.every(s => /^[0-9A-Z]$/.test(String(s.id).split('-')[1])));
  check('sections arrive in division order',
    sections.every((s, i) => i === 0 || s.div >= sections[i - 1].div));
  check('every section has a title and a body with words in it',
    sections.every(s => s.title.trim().length > 0
      && typeof s.body === 'string' && s.body.trim().length > 0));

  // ── HOW THE PAGE IS TOLD TO SET IT ───────────────────────────────────
  check('every section states a kind, defaulted rather than left undefined',
    sections.every(s => typeof s.kind === 'string' && s.kind.length > 0));
  check('the kinds are the four the page can set',
    sections.every(s => ['notes', 'terms', 'table', 'legend'].includes(s.kind)),
    `saw ${[...new Set(sections.map(s => s.kind))].join(',')}`);
  check('a section with nothing said about it is set as notes',
    sections.find(s => s.id === '15-C').kind === 'notes');
  check('the abbreviations are a two-column terms table',
    sections.find(s => s.id === '1-A').kind === 'terms');
  check('the electrical legend is drawn, not typed',
    sections.find(s => s.id === '16-B').kind === 'legend');

  // ── VERIFY: THE ONE WITH A JOB-SITE COST ─────────────────────────────
  const verify = sections.filter(s => s.verify);
  check('verify is a decided true or false on every section, never undefined',
    sections.every(s => s.verify === true || s.verify === false));
  check('the sections carrying a job\'s own numbers are flagged for verifying',
    verify.length === 6, `${verify.length} flagged`);
  check('piles, footings and the energy-code insulation are among them',
    ['3-A', '3-C', '7-E'].every(id => verify.some(s => s.id === id)),
    `flagged: ${verify.map(s => s.id).join(',')}`);
  check('the two schedules a project fills in are flagged',
    ['6-E', '6-F'].every(id => verify.some(s => s.id === id)));
  check('a section of the office\'s own standing text is NOT flagged',
    sections.find(s => s.id === '1-A').verify === false,
    'flagging everything is the same as flagging nothing');

  // ── THE ONE CORRECTION THAT IS FLAGGED RATHER THAN MADE SILENTLY ─────
  const windows = sections.find(s => s.id === '8-B');
  check('8-B still carries the note about the source sheet\'s minimum',
    typeof windows.note === 'string' && /minimum/i.test(windows.note),
    `note is ${JSON.stringify(windows.note)}`);
  check('a section with nothing to flag says null, not undefined',
    sections.find(s => s.id === '1-A').note === null);

  // ── THE MASTER IS THE OFFICE'S ───────────────────────────────────────
  const first = M.sections();
  first[0].title = 'SCRIBBLED ON';
  first[0].verify = true;
  check('editing what sections() handed over does not write to the master',
    M.sections()[0].title !== 'SCRIBBLED ON' && M.sections()[0].verify === false);
  check('two calls hand out two different objects',
    M.sections()[0] !== M.sections()[0] || M.sections() !== M.sections());

  // ── ROWS ─────────────────────────────────────────────────────────────
  check('a pipe row splits into cells',
    JSON.stringify(M.rows('outlet-110 | 110V AC POWER OUTLET'))
      === JSON.stringify([['outlet-110', '110V AC POWER OUTLET']]));
  check('an em-dash term splits too, as the drafter typed it',
    JSON.stringify(M.rows('ADJ — ADJUSTABLE')) === JSON.stringify([['ADJ', 'ADJUSTABLE']]));
  check('cells are trimmed',
    M.rows('a   |   b')[0].join('|') === 'a|b');
  check('a line with neither separator is one cell set across the row',
    JSON.stringify(M.rows('CONCRETE NOTES')) === JSON.stringify([['CONCRETE NOTES']]));
  check('a blank line is a blank row, not a dropped one',
    JSON.stringify(M.rows('a\n\nb')) === JSON.stringify([['a'], [''], ['b']]),
    'dropping it closes up a gap the drafter put there');
  check('an ordinary bullet is NOT cut into columns',
    JSON.stringify(M.rows('- ALL WORK TO BE CARRIED OUT - SEE PLAN'))
      === JSON.stringify([['- ALL WORK TO BE CARRIED OUT - SEE PLAN']]),
    'a hyphen is not an em dash, and nearly every body line in the master has one');
  check('an em dash with no spaces around it is left alone',
    JSON.stringify(M.rows('CONCRETE—STEEL')) === JSON.stringify([['CONCRETE—STEEL']]));
  check('nothing at all is one blank row',
    JSON.stringify(M.rows(undefined)) === JSON.stringify([['']]));
  check('a pipe row with three cells keeps all three',
    M.rows('a | b | c')[0].length === 3);

  // The two tables that MUST come back square, because the page sets them in
  // columns: a ragged row prints a term with no meaning beside it.
  // The abbreviations body is not ALL pairs -- it closes with a blank line
  // and a full-width sentence about metric conversion, which the page sets
  // across the row. So the claim is the one that matters: every line the
  // drafter wrote AS a pair arrives as a pair.
  const terms = M.rows(sections.find(s => s.id === '1-A').body);
  const pairLines = sections.find(s => s.id === '1-A').body.split('\n')
    .filter(line => line.includes(' — '));
  check('every abbreviation arrives as a term and a meaning',
    pairLines.length > 20
      && terms.filter(row => row.length === 2).length === pairLines.length,
    `${pairLines.length} pairs written, ${terms.filter(r => r.length === 2).length} arrived`);
  check('the full-width lines around them stay full width',
    terms.some(row => row.length === 1 && row[0].length > 20),
    'the metric-conversion sentence is not a term and must not be cut in two');
  const legend = M.rows(sections.find(s => s.id === '16-B').body);
  check('every legend line is a symbol id and a caption',
    legend.every(row => row.length === 2));
  check('the legend\'s first cell is the painter\'s own symbol kind',
    legend.every(row => /^[a-z0-9-]+$/.test(row[0])),
    'the ids have to match electric-symbols.js or the legend drifts from the plan');
}

if (!MUTATE) {
  runChecks();
  console.log(`\nspec master harness: ${passed} checks passed, ${failures.length} failed`);
  if (failures.length) {
    failures.forEach(line => console.log(`  ✘ ${line}`));
    process.exit(1);
  }
  process.exit(0);
}

// ── MUTATIONS ───────────────────────────────────────────────────────────
const MUTATIONS = [
  ['a division is dropped from the list', 'spec-master.js',
    c => c.replace("    { no: 10, title: 'FIREPLACE' },\n", '')],

  ['an unknown division number is given the first title instead of none', 'spec-master.js',
    c => c.replace("const divisionTitle = no => (DIVISIONS.find(d => d.no === no) || {}).title || '';",
      "const divisionTitle = no => (DIVISIONS.find(d => d.no === no) || DIVISIONS[0]).title || '';")],

  ['a section is moved to the wrong division', 'spec-master.js',
    c => c.replace("id: '3-C', div: 3, title: 'FOOTINGS'", "id: '3-C', div: 4, title: 'FOOTINGS'")],

  ['a section carries the division title of its neighbour', 'spec-master.js',
    c => c.replace('divTitle: divisionTitle(section.div),', 'divTitle: divisionTitle(section.div + 1),')],

  ['a section loses its letter to a duplicate', 'spec-master.js',
    c => c.replace("id: '15-D', div: 15", "id: '15-C', div: 15")],

  ['a section is dropped out of the master', 'spec-master.js',
    c => c.replace("      id: '15-C', div: 15, title: 'AIR CONDITIONING',\n"
      + "      body: '- CENTRAL AIR CONDITIONING – VERIFY INSTALLATION WITH OWNER.',\n    },\n", '')],

  ['the default set is terms rather than notes', 'spec-master.js',
    c => c.replace("kind: section.kind || 'notes',", "kind: section.kind || 'terms',")],

  ['the kind is passed through undefined for the page to guess', 'spec-master.js',
    c => c.replace("kind: section.kind || 'notes',", 'kind: section.kind,')],

  ['the electrical legend is set as plain notes', 'spec-master.js',
    c => c.replace("id: '16-B', div: 16, title: 'ELECTRICAL SYMBOLS', kind: 'legend',",
      "id: '16-B', div: 16, title: 'ELECTRICAL SYMBOLS',")],

  ['the verify flag stops being decided and rides through as undefined', 'spec-master.js',
    c => c.replace('verify: section.verify === true,', 'verify: section.verify,')],

  ['every section is flagged for verifying, so none of them is', 'spec-master.js',
    c => c.replace('verify: section.verify === true,', 'verify: true,')],

  ['the pile schedule stops asking for a job\'s own numbers', 'spec-master.js',
    c => c.replace("id: '3-A', div: 3, title: 'PILES', verify: true,",
      "id: '3-A', div: 3, title: 'PILES',")],

  ['the window note is dropped and the correction goes silent', 'spec-master.js',
    c => c.replace("      note: 'Reads MINIMUM 0.35 m²; the source sheet said maximum."
      + " NBC 9.9.10.1. sets it as a minimum.',\n", '')],

  ['a section with nothing flagged comes back undefined instead of null', 'spec-master.js',
    c => c.replace('note: section.note || null,', 'note: section.note,')],

  ['the page is handed the office master itself to edit', 'spec-master.js',
    c => c.replace('  const sections = () => SECTIONS.map(section => ({',
      '  const sections = () => SECTIONS.length ? SECTIONS : SECTIONS.map(section => ({')],

  ['a row keeps the whitespace around its cells', 'spec-master.js',
    c => c.replace('      .map(cell => cell.trim());', '      .map(cell => cell);')],

  ['a blank line is dropped instead of kept as a gap', 'spec-master.js',
    c => c.replace("if (!trimmed) return [''];", 'if (!trimmed) return [];')],

  ['rows split on a bare hyphen, cutting ordinary notes into columns', 'spec-master.js',
    c => c.replace("trimmed.split(' — ')", "trimmed.split('-')")],

  ['rows split on an em dash with no spaces, cutting words in half', 'spec-master.js',
    c => c.replace("trimmed.split(' — ')", "trimmed.split('—')")],

  // NOT A ROW. `return cells.length > 1 ? cells : [trimmed];` collapsed to
  // `return cells;` is byte-identical output: String.split never returns
  // fewer than one part, and that one part is the already-trimmed line, so
  // the guarded branch and the plain one hand back the same single cell.
  // Measured by running the file with it collapsed -- 42 of 42 green. Kept as
  // a paragraph rather than a row that could only ever print SURVIVED; it
  // becomes real the day rows() filters empty cells, when a line of pure
  // separators would come back as [] rather than as itself.

  ['the pipe is no longer preferred over the dash', 'spec-master.js',
    c => c.replace("(trimmed.includes('|') ? trimmed.split('|') : trimmed.split(' — '))",
      "(trimmed.split(' — '))")],
];

let caught = 0;
for (const [name, file, fn] of MUTATIONS) {
  const before = fs.readFileSync(path.join(ROOT, file), 'utf8');
  if (fn(before) === before) {
    console.log(`  ANCHOR MISSED  ${name}  (the edit changed nothing in ${file} -- re-aim it)`);
    continue;
  }
  EDIT = { file, fn };
  let red = false;
  try { runChecks(); red = failures.length > 0; }
  catch (err) { red = true; }
  EDIT = null;
  if (red) caught += 1;
  else console.log(`  SURVIVED  ${name}`);
}
console.log(`spec-master-harness: ${caught}/${MUTATIONS.length} mutations caught`);
process.exit(caught === MUTATIONS.length ? 0 : 1);
