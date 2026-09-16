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
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Derived, never a literal: a harness that names one machine's checkout is one
// nobody else can run. test.yml records that fault for two earlier harnesses.
const ROOT = path.join(__dirname, '..');

function loadFormat() {
  const win = {};
  const sandbox = { window: win, console, Math, Number, String, Object, Array,
    JSON, Map, Set, isFinite, parseFloat, parseInt };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const file of ['formatters.js', 'wall-types.js', 'geometry-2d.js', 'drawing-format.js']) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue;
    vm.runInContext(fs.readFileSync(full, 'utf8'), sandbox, { filename: file });
  }
  if (!win.DraftDrawingFormat) throw new Error('drawing-format.js did not publish DraftDrawingFormat');
  return win.DraftDrawingFormat;
}

const F = loadFormat();
// A SET, because that is what `levelId()` asks for -- it calls .has(). Passing
// an array threw rather than quietly matching nothing, which is the good case.
const LEVEL_IDS = new Set([1, 2, 3]);
const P = (x, z) => ({ x, y: 0, z });

let passed = 0;
const failures = [];
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

console.log('\ntool        collection   good record   broken record                       refused?');
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

  console.log(`${row.tool.padEnd(11)} ${row.call.padEnd(12)} ${String(kept.length === 1).padEnd(13)} `
    + `${row.broke.padEnd(35)} ${refused.length === 0 ? 'yes' : 'NO'}`);
}

// AND THE FINDING, kept as a check so it cannot rot into prose: these are the
// collections MODEL.html does NOT normalise on load. If a future load block
// starts calling one, this goes red and the board gets updated -- which is the
// only way a measurement stays true after the thing it measured has changed.
const LOAD_BLOCK = (() => {
  const src = fs.readFileSync(path.join(ROOT, 'MODEL.html'), 'utf8');
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

console.log(`\nsmall tools harness: ${passed} checks passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach(line => console.log(`  ✘ ${line}`));
  process.exit(1);
}
