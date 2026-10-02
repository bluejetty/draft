#!/usr/bin/env node
// THE SEVEN SMALL TOOLS — what the format already guarantees, and what the
// page currently declines to ask for. The measure-first gate on tier 3j.
//
// Movie, 16 Sep: "i'd like all the drafting tools to work".
//
// MODEL.html's load block normalises FOUR collections -- walls, lines, floors,
// dimensions -- and carries the rest through on `...parsed`. That is the rule
// the block states, not an oversight: geometry the page cannot act on
// round-trips unexamined, and a thing the page ACTS ON is normalised on the
// way in. Tier 3j is the moment beams, columns, shapes and fixtures cross that
// line, because a tool that places a beam is a page acting on beams.
//
// So the question this harness answers is not "is the format right". It is:
// WHAT IS THE PAGE LEAVING ON THE TABLE by not calling these? Each row below
// feeds the real normaliser a well-formed record and a broken one. Everything
// the broken column catches is something that reaches the page today intact,
// and would reach an edit gesture intact tomorrow.
//
// Read as: preserved = a good record survives with its fields; refused = a bad
// record is thrown out. A collection that refuses nothing cannot protect a
// tool built on it.
//
// RD-DOCUMENTS/BOARD-tier3j-normalise-before-you-edit.md
//
// Run: node proto/small-tools-harness.js
//      node proto/small-tools-harness.js --mutate
//
// WHY IT TOOK A MUTATION MODE. Devin's audit, 28 Sep, found this among seven
// harnesses that ACCEPTED `--mutate`, ran the plain checks and printed no
// table -- worse than the thirty-seven that refuse the flag outright, because
// a caller asking for mutation coverage was told nothing and read it as
// everything caught. The table at the bottom now pulls one guard at a time
// out of the two files this harness measures, and every row has to make a
// check above go red.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Derived, never a literal: a harness that names one machine's checkout is one
// nobody else can run. test.yml records that fault for two earlier harnesses.
const ROOT = path.join(__dirname, '..');
// THE FLAG IS THE SHARED GUARD'S, NOT A HAND-ROLLED COPY OF IT.
//
// The block here read argv itself. Two things followed. It refused
// `--coverage`, which proto/harness-args.js treats as the SAME mode spelled a
// second way, so one of the two documented spellings exited 2 on this file.
// And CI derives its engine list from the CALL FORM
// `require('./harness-args.js').mutationMode()` -- a harness that parses its
// own argv is invisible to that grep, so the table below would have run here
// and nowhere else. A mutation table CI never runs is the silence this whole
// piece of work is about, one level out.
const MUTATE = require('./harness-args.js').mutationMode();

// One edit, aimed at one file by name: the mutation table's rows say which of
// the two subjects they bend, and every read below goes through here so a row
// aimed at drawing-format.js reaches the sandbox and a row aimed at MODEL.html
// reaches the load-block slice.
let EDIT = null;
const readSubject = name => {
  const text = fs.readFileSync(path.join(ROOT, name), 'utf8');
  return EDIT && EDIT.file === name ? EDIT.fn(text) : text;
};

function loadFormat() {
  const win = {};
  const sandbox = { window: win, console, Math, Number, String, Object, Array,
    JSON, Map, Set, isFinite, parseFloat, parseInt };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const file of ['formatters.js', 'wall-types.js', 'geometry-2d.js', 'drawing-format.js']) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue;
    vm.runInContext(readSubject(file), sandbox, { filename: file });
  }
  if (!win.DraftDrawingFormat) throw new Error('drawing-format.js did not publish DraftDrawingFormat');
  return win.DraftDrawingFormat;
}

// A SET, because that is what `levelId()` asks for -- it calls .has(). Passing
// an array threw rather than quietly matching nothing, which is the good case.
const LEVEL_IDS = new Set([1, 2, 3]);
const P = (x, z) => ({ x, y: 0, z });

let passed = 0;
let failures = [];
const check = (label, condition, detail) => {
  if (condition) { passed += 1; return; }
  failures.push(detail ? `${label} — ${detail}` : label);
};

// One well-formed record and one broken one per collection. The BROKEN field
// is named, because "it was refused" is only useful if you know what for.
const ROWS = [
  { tool: 'beam', call: 'beams',
    good: { id: 7, start: P(0, 0), end: P(10, 0), levelId: 1, view: 'plan', mode: 'dropped' },
    bad: { id: 'seven', start: P(0, 0), end: P(10, 0), levelId: 1, view: 'plan' },
    broke: 'a non-integer id',
    keeps: ['id', 'start', 'end', 'levelId', 'view', 'mode'] },

  { tool: 'beam', call: 'beams',
    good: { id: 8, start: P(0, 0), end: P(10, 0), levelId: 1, view: 'plan' },
    bad: { id: 9, start: P(4, 4), end: P(4, 4), levelId: 1, view: 'plan' },
    broke: 'a beam with no length',
    keeps: ['id', 'levelId', 'view'] },

  { tool: 'column', call: 'columns',
    good: { id: 3, point: P(5, 5), levelId: 1, view: 'plan' },
    bad: { id: 4, point: P(5, 5), levelId: 99, view: 'plan' },
    broke: 'a level the drawing does not have',
    keeps: ['id', 'levelId', 'view'] },

  { tool: 'shape', call: 'shapes',
    good: { id: 'shape-1', points: [P(0, 0), P(4, 0), P(4, 4)], levelId: 1, view: 'plan' },
    bad: { id: 'shape-2', points: [], levelId: 1, view: 'plan' },
    broke: 'a shape with no points',
    keeps: ['id', 'levelId'] },

  // THE HOST LINK, and the one that matters most for an edit gesture: the
  // format REQUIRES a fixture to name the wall it hangs on, and throws out one
  // that does not. A fixture orphaned by a deleted wall is exactly the record
  // this refusal exists to stop, and exactly the record the page accepts today.
  { tool: 'fixture', call: 'fixtures',
    good: { id: 'fx-1', wallId: 'wall-1', levelId: 1, kind: 'sink', width: 2, depth: 2, offset: 3 },
    bad: { id: 'fx-2', wallId: '', levelId: 1, kind: 'sink', width: 2, depth: 2, offset: 3 },
    broke: 'a fixture hanging on no wall',
    keeps: ['id', 'wallId', 'levelId', 'kind'] },

  // THE ANNOTATION TOOL'S STORAGE. `notes` is the odd one of the five: it is
  // already PAINTED on this page (drawNoteScreen2D, off drawing.notes) and
  // still un-normalised, so a note reaches the painter without ever being
  // asked whether it says anything. An annotation with no words is the record
  // a half-finished gesture leaves behind.
  { tool: 'annotation', call: 'notes',
    good: { id: 1, anchor: P(0, 0), text: P(3, 3), levelId: 1, view: 'plan', body: 'BEARING WALL' },
    bad: { id: 2, anchor: P(0, 0), text: P(3, 3), levelId: 1, view: 'plan', body: '   ' },
    broke: 'an annotation with no words',
    keeps: ['id', 'anchor', 'text', 'levelId', 'view', 'body'] },

  // The leader has to GO somewhere: a note whose text sits on its own anchor
  // draws an arrow of zero length, which is a mark the drafter cannot see and
  // cannot grab.
  { tool: 'annotation', call: 'notes',
    good: { id: 3, anchor: P(0, 0), text: P(2, 2), levelId: 1, view: 'plan', body: 'SLOPE', end: 'line' },
    bad: { id: 4, anchor: P(5, 5), text: P(5, 5), levelId: 1, view: 'plan', body: 'SLOPE' },
    broke: 'a leader that points at itself',
    keeps: ['id', 'body', 'end'] },
];

function runChecks(quiet) {
passed = 0;
failures = [];
let F;
try { F = loadFormat(); }
catch (err) { failures.push(`drawing-format.js did not load: ${err.message}`); return; }
const say = line => { if (!quiet) console.log(line); };

say('\ntool        collection   good record   broken record                       refused?');
for (const row of ROWS) {
  const fn = F[row.call];
  check(`${row.call} is a published normaliser`, typeof fn === 'function');
  if (typeof fn !== 'function') continue;

  const kept = fn([row.good], LEVEL_IDS);
  const refused = fn([row.bad], LEVEL_IDS);

  check(`a well-formed ${row.tool} survives ${row.call}()`, kept.length === 1,
    `${kept.length} survived, expected 1`);
  // Asserted on the PUBLISHED record, not on a copy of the input: the point is
  // what the format hands back, not what this file thinks it should hand back.
  if (kept.length === 1) {
    for (const field of row.keeps) {
      check(`${row.call}() keeps ${field}`, kept[0][field] !== undefined,
        `${field} came back undefined`);
    }
  }
  check(`${row.call}() refuses ${row.broke}`, refused.length === 0,
    `${refused.length} survived — this collection would carry it to a tool`);
  // AUDIT 2.4: an id the next one cannot follow. `highest + 1` at 2**53 - 1
  // is the same number again, so the next record placed would collide.
  if (Number.isInteger(row.good.id)) {
    const huge = fn([{ ...row.good, id: Number.MAX_SAFE_INTEGER }], LEVEL_IDS);
    check(`${row.call}() refuses an id at MAX_SAFE_INTEGER`, huge.length === 0,
      `${huge.length} survived`);
  }

  say(`${row.tool.padEnd(11)} ${row.call.padEnd(12)} ${String(kept.length === 1).padEnd(13)} `
    + `${row.broke.padEnd(35)} ${refused.length === 0 ? 'yes' : 'NO'}`);
}

// AND THE FINDING, kept as a check so it cannot rot into prose: these are the
// collections MODEL.html does NOT normalise on load. If a future load block
// starts calling one, this goes red and the board gets updated -- which is the
// only way a measurement stays true after the thing it measured has changed.
const LOAD_BLOCK = (() => {
  const src = readSubject('MODEL.html');
  const at = src.indexOf('    drawing = {');
  if (at < 0) return null;
  const end = src.indexOf('\n    };', at);
  return end < 0 ? null : src.slice(at, end);
})();
check('MODEL.html still has a load block to read', LOAD_BLOCK !== null);
if (LOAD_BLOCK) {
  // NOTES IS THE ONE LEFT. The rung wired the four collections a small tool
  // will PLACE -- beams, columns, shapes, fixtures. Annotation was not in it,
  // so drawing.notes still rides through on `...parsed`, still painted and
  // still unasked. This row stays red-on-change so that gap keeps a name.
  for (const call of ['notes']) {
    check(`MODEL.html does not yet normalise ${call} (the rung left it)`,
      !LOAD_BLOCK.includes(`F.${call}(`),
      `it calls F.${call}() now — the gap is closed, update the board`);
  }
  // THE GUARDED EIGHT, four of them wired by tier 3j on 16 Sep. Dropping one
  // of these is a collection losing its guard, which is the silent direction:
  // the page would go on painting and start acting on records nobody checked.
  for (const call of ['walls', 'lines', 'floors', 'dimensions',
    'beams', 'columns', 'shapes', 'fixtures']) {
    check(`MODEL.html still normalises ${call}`, LOAD_BLOCK.includes(`F.${call}(`),
      `it stopped calling F.${call}() — a collection lost its guard`);
  }
}
}

if (!MUTATE) {
  runChecks(false);
  console.log(`\nsmall tools harness: ${passed} checks passed, ${failures.length} failed`);
  if (failures.length) {
    failures.forEach(line => console.log(`  ✘ ${line}`));
    process.exit(1);
  }
  process.exit(0);
}

// ── MUTATIONS ───────────────────────────────────────────────────────────
//
// Two subjects, because this harness makes two different claims. The rows
// aimed at drawing-format.js pull one refusal at a time: each is a record the
// format throws out today, and a surviving row means the collection would
// carry that record to a tool that places beams. The rows aimed at MODEL.html
// bend the load block, because the finding at the bottom of this file -- four
// collections guarded, notes still riding through on `...parsed` -- is only
// worth keeping if it can still go red when that changes.
const BEAM_ID_GUARD = 'if (!safeId(id) || seen.has(id) || !start || !end'
  + ' || beamLevelId == null || !view) return null;';

const MUTATIONS = [
  ['beams stop asking for a whole-number id', 'drawing-format.js',
    c => c.replace(BEAM_ID_GUARD,
      'if (seen.has(id) || !start || !end || beamLevelId == null || !view) return null;')],

  ['a beam with no length is allowed through', 'drawing-format.js',
    c => c.replace(`${BEAM_ID_GUARD}\n      `
      + 'if (Math.hypot(end.x - start.x, end.z - start.z) < 0.001) return null;',
    BEAM_ID_GUARD)],

  ['a beam comes back without the mode it was placed in', 'drawing-format.js',
    c => c.replace("mode: oneOf(beam?.mode, ['flush', 'dropped'], 'flush'),",
      'mode: undefined,')],

  ['a column takes its level as typed, unchecked against the drawing', 'drawing-format.js',
    c => c.replace('const columnLevelId = levelId(column?.levelId, levelIds);',
      'const columnLevelId = Number(column?.levelId);')],

  ['a shape is allowed to have no points', 'drawing-format.js',
    c => c.replace('if (shapeLevelId == null || points.length < 3) return null;',
      'if (shapeLevelId == null) return null;')],

  ['a fixture hanging on no wall is given one', 'drawing-format.js',
    c => c.replace("const wallId = String(fixture?.wallId || '').trim();",
      "const wallId = String(fixture?.wallId || 'wall-1').trim();")],

  ['an annotation of pure whitespace counts as words', 'drawing-format.js',
    c => c.replace("const body = String(note?.body ?? '').trim();",
      "const body = String(note?.body ?? '');")],

  ['a leader pointing at itself is allowed', 'drawing-format.js',
    c => c.replace("if (end !== 'none' && Math.hypot(text.x - anchor.x,"
      + ' text.z - anchor.z) < 0.001) return null;', '')],

  ['the load block stops normalising walls', 'MODEL.html',
    c => c.replace('walls: F.walls(parsed.walls, levelIds, {',
      'walls: (parsed.walls, levelIds, {')],

  ['the load block starts normalising notes, and the finding rots', 'MODEL.html',
    c => c.replace('board: F.board(parsed.board),',
      'board: F.board(parsed.board),\n      notes: F.notes(parsed.notes, levelIds),')],

  ['the load block is renamed, so there is nothing to read', 'MODEL.html',
    c => c.replace('    drawing = {', '    drawing =  {')],
];

let caught = 0;
for (const [name, file, fn] of MUTATIONS) {
  const before = fs.readFileSync(path.join(ROOT, file), 'utf8');
  if (fn(before) === before) {
    console.log(`  ANCHOR MISSED  ${name}  (the edit changed nothing in ${file} -- re-aim it)`);
    continue;
  }
  EDIT = { file, fn };
  runChecks(true);
  EDIT = null;
  if (failures.length) caught += 1;
  else console.log(`  SURVIVED  ${name}`);
}
console.log(`small-tools-harness: ${caught}/${MUTATIONS.length} mutations caught`);
process.exit(caught === MUTATIONS.length ? 0 : 1);
