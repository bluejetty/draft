#!/usr/bin/env node
// THE CATALOGUE AND THE FORMAT MUST NAME THE SAME FIXTURES.
//
// fixture-kinds.js holds what a drafter can CLICK -- labels, sizes, notes,
// the casework/run/preset flags. drawing-format.js holds what a file may
// CONTAIN, as a bare id list, and it holds it separately on purpose: it is
// the module every page loads first and it reads nothing off `window`, for
// the reason written at its own :337.
//
// So there are two lists, and neither may be edited alone. Add a kind to the
// catalogue and forget the format, and the fixture places, saves, and is
// silently DROPPED on the next load -- by a validator doing exactly its job.
// Add one to the format and forget the catalogue and it can never be placed.
// Both failures are quiet. This is the thing that makes them loud.
//
// PRESETS ARE NOT STORABLE and that is the one legitimate difference. The
// kitchen L drops seven ordinary fixtures and is never itself written to a
// drawing, so the comparison is against STORABLE_KIND_IDS rather than the
// whole catalogue. A preset appearing in the format's list would be a real
// defect -- it would mean a file could claim to hold one.
//
//   node proto/fixture-kinds-harness.js
require('./harness-args.js').noFlags();
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
global.window = global;
require(path.join(ROOT, 'closets.js'));
require(path.join(ROOT, 'fixture-kinds.js'));
const K = window.DraftFixtureKinds;

let passed = 0;
const failures = [];
const check = (name, condition, detail) => {
  if (condition) { passed += 1; return; }
  failures.push(detail ? `${name}\n      ${detail}` : name);
};

// READ AS TEXT, not by loading the module and calling it. drawing-format.js
// keeps FIXTURE_KINDS private -- it is a `const` inside the IIFE and nothing
// exports it -- so the only honest way to see the list a reader validates
// against is the source line that declares it. A regex over one line is
// brittle in the safe direction: if the declaration moves or changes shape,
// this fails loudly rather than comparing against a stale guess.
const formatSrc = fs.readFileSync(path.join(ROOT, 'drawing-format.js'), 'utf8');
const declared = /^\s*const FIXTURE_KINDS = \[([^\]]*)\];/m.exec(formatSrc);
check('drawing-format.js still declares a FIXTURE_KINDS list this can read',
  Boolean(declared), 'the `const FIXTURE_KINDS = [...]` line did not match');

if (declared) {
  const formatIds = declared[1].split(',')
    .map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  const catalogue = [...K.STORABLE_KIND_IDS];

  const missingFromFormat = catalogue.filter(id => !formatIds.includes(id));
  const missingFromCatalogue = formatIds.filter(id => !catalogue.includes(id));

  check('every storable kind in the catalogue is one the format accepts',
    missingFromFormat.length === 0,
    `drawing-format.js would DROP on load: ${missingFromFormat.join(', ')}`);
  check('every kind the format accepts is one the catalogue can place',
    missingFromCatalogue.length === 0,
    `no way to click these: ${missingFromCatalogue.join(', ')}`);

  const presets = K.FIXTURE_KINDS.filter(kind => kind.preset === true).map(kind => kind.id);
  check('a preset is one click, never a stored kind',
    presets.length > 0 && presets.every(id => !formatIds.includes(id)),
    `presets ${presets.join(', ')} against format ${formatIds.join(', ')}`);
}

// ── The catalogue's own shape ────────────────────────────────────────────
check('ids are unique', new Set(K.FIXTURE_KINDS.map(k => k.id)).size === K.FIXTURE_KINDS.length);
check('every kind carries a positive width and depth',
  K.FIXTURE_KINDS.every(k => k.widthFt > 0 && k.depthFt > 0),
  K.FIXTURE_KINDS.filter(k => !(k.widthFt > 0 && k.depthFt > 0)).map(k => k.id).join(', '));
check('every kind carries a label, a group and a note',
  K.FIXTURE_KINDS.every(k => k.label && k.group && k.note));
check('kindsInGroup partitions the catalogue exactly',
  K.GROUPS.reduce((n, g) => n + K.kindsInGroup(g).length, 0) === K.FIXTURE_KINDS.length);

// THE CLOSET'S DEPTH IS NOT A NUMBER IN THIS FILE, and that is the point of
// loading closets.js first.
//
// THIS IS CHECKED IN THE SOURCE TEXT, and the first version of it was worthless.
// It read `closet.depthFt === INSIDE_DEPTH_FT + WALL_FT` and was mutation-run
// against the catalogue restating the depth as the literal `2.375` -- which is
// that sum, to the digit, so the check passed. It could only ever catch a
// restatement that was WRONG, while its own comment claimed it caught any
// restatement at all. A check whose reach is smaller than its stated reach is
// worse than no check, because the comment is what the next reader trusts.
//
// So it reads the declaration instead. `closets.js` owning the number means
// the catalogue must NAME it, and naming is a fact about the text.
const closetSrc = fs.readFileSync(path.join(ROOT, 'fixture-kinds.js'), 'utf8');
const closetLine = /\{\s*id:\s*'closet'[\s\S]*?\}/.exec(closetSrc);
check('the closet entry names closets.js\u2019s constants rather than a literal depth',
  Boolean(closetLine) && /depthFt:\s*CLOSET_INSIDE_DEPTH_FT\s*\+\s*CLOSET_WALL_FT/.test(closetLine[0]),
  closetLine ? closetLine[0].split('\n')[0].trim() : 'no closet entry found');

// And that the names still resolve to what closets.js holds -- the text check
// above cannot see a renamed capture pointing somewhere else.
const closet = K.kindFor('closet');
check('and those constants still carry closets.js\u2019s own numbers',
  Math.abs(closet.depthFt - (window.DraftClosets.INSIDE_DEPTH_FT + window.DraftClosets.WALL_FT)) < 1e-12,
  `catalogue ${closet.depthFt}, closets.js ${window.DraftClosets.INSIDE_DEPTH_FT + window.DraftClosets.WALL_FT}`);

// Only these three take two clicks; a fourth arriving silently would change
// what a single click does on that kind.
check('cabinet, vanity and closet are the only runs',
  K.FIXTURE_KINDS.filter(k => k.run).map(k => k.id).sort().join(',') === 'cabinet,closet,vanity',
  K.FIXTURE_KINDS.filter(k => k.run).map(k => k.id).join(','));
check('casework is cabinet and vanity',
  K.FIXTURE_KINDS.filter(k => k.casework).map(k => k.id).sort().join(',') === 'cabinet,vanity',
  K.FIXTURE_KINDS.filter(k => k.casework).map(k => k.id).join(','));

// A frozen table cannot be edited by a page that borrows it.
check('the catalogue is frozen, entries included',
  Object.isFrozen(K.FIXTURE_KINDS) && K.FIXTURE_KINDS.every(Object.isFrozen));

console.log(`fixture kinds harness: ${passed} checks passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach(line => console.log(`  ✘ ${line}`));
  process.exit(1);
}
