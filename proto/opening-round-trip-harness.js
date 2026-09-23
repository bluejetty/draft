#!/usr/bin/env node
// WHAT THE READER RETURNS, THE WRITER MUST WRITE — OR THE FIELD DIES ON SAVE.
//
// Found 23 Sep, a day after the casement type shipped. MODEL.dc.html's
// _serializeDrawing builds each opening field by field:
//
//     fenestrations: this._fenestrations.map(opening => ({
//       id, wallId, levelId, view, type, layer, offset, width,
//       sillHeight, headHeight, garage, auto,
//     })),
//
// TWELVE KEYS AND NO SPREAD. drawing-format.js's fenestrations() had just
// started returning a thirteenth, `casement`, so:
//
//     reader returns   ... garage, casement, auto
//     dc writes        ... garage, auto
//     dropped on save  casement
//
// A double casement drawn on MODEL.html loaded here perfectly, painted
// perfectly, and came back a SINGLE the first time anyone edited the drawing
// on this page. The drawing was never damaged -- it was just not the drawing.
//
// ── WHY A HARNESS AND NOT A SPEC ─────────────────────────────────────────
//
// A browser spec has to drive a real edit to make the page re-serialise, and
// three attempts at that gesture timed out before this was written. This
// compares the two LISTS instead, which is the actual contract, costs
// milliseconds, and cannot flake. It also generalises: it does not know or
// care what `casement` is, only that every field the shared reader produces
// has somewhere to go.
//
// ONLY MODEL.dc.html NEEDS THIS. MODEL.html has no serializer between the
// push and the file -- its own comments say so in four places -- so it writes
// whatever the record carries and cannot drop a field this way.
//
// THE SAME SHAPE EXISTS FOR EVERY OTHER COLLECTION in that serializer, and
// this guards fenestrations alone. That is a stated limit, not an oversight:
// fenestrations is where the defect was, and one collection parsed exactly
// beats six parsed loosely. `tests/persisted-format.spec.js` guards the
// TOP-LEVEL key set and says nothing about fields inside a record, which is
// why nothing caught this.
//
//   node proto/opening-round-trip-harness.js
require('./harness-args.js').noFlags();

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
global.window = global.window || {};
require(path.join(ROOT, 'geometry-2d.js'));
require(path.join(ROOT, 'drawing-format.js'));
const F = window.DraftDrawingFormat;

let pass = 0;
const fails = [];
const check = (label, ok, detail) => {
  if (ok) { pass += 1; return; }
  fails.push(detail ? `${label} — ${detail}` : label);
};

// ── WHAT THE READER PRODUCES ──────────────────────────────────────────────
//
// Asked of the module rather than listed here. A list in this file would be a
// third copy of the format and would go stale in the safe-looking direction --
// it would stop naming the very field that was just added, which is the one
// at risk.
const readerKeys = kind => Object.keys(F.fenestrations([{
  id: 'f1', wallId: 'w1', levelId: 3, view: 'plan', type: kind,
  width: 4, offset: 5, sillHeight: kind === 'door' ? 0 : 3, headHeight: 7,
  casement: 'double', garage: true, auto: true,
}], new Set([3]))[0] || {});

const windowKeys = readerKeys('window');
const doorKeys = readerKeys('door');
check('the reader returns a window at all', windowKeys.length > 5, `${windowKeys.length} keys`);
check('and a door', doorKeys.length > 5, `${doorKeys.length} keys`);

// ── WHAT MODEL.dc.html WRITES ─────────────────────────────────────────────
//
// A PARSE THAT MATCHES NOTHING IS A FAILURE, NOT A PASS. If the serializer is
// renamed or restructured this harness must go red rather than quietly
// checking an empty list against another empty list and reporting green --
// the exact trap .github/workflows/test.yml names for its own harness loop.
const src = fs.readFileSync(path.join(ROOT, 'MODEL.dc.html'), 'utf8');
const block = src.match(
  /fenestrations: this\._fenestrations\.map\(opening => \(\{([\s\S]*?)\n {6}\}\)\),/);
check('the dc serializer-s fenestration block was found', !!block,
  'the regex matched nothing -- _serializeDrawing has been renamed or '
  + 'restructured, and this harness is checking nothing until it is re-aimed');

if (block) {
  const body = block[1];
  const writerKeys = [...body.matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*):/gm)].map(m => m[1]);
  check('and it names some fields', writerKeys.length > 5, `${writerKeys.length} keys`);

  // A SPREAD WOULD MAKE THIS WHOLE FILE UNNECESSARY, and its absence is the
  // reason the defect is possible. Recorded rather than assumed: if someone
  // adds one, this check is how the next reader learns the contract changed.
  const spread = /\.\.\.\s*opening/.test(body);
  check('the block still builds field by field, with no spread', !spread,
    'a spread appeared -- fields now carry themselves and this harness is '
    + 'belt on top of braces, which is fine, but say so here');

  const missing = windowKeys.filter(k => !writerKeys.includes(k));
  check('every field the reader returns for a WINDOW is written back',
    missing.length === 0,
    `dropped on save: ${missing.join(', ')} — a drawing carrying one of these `
    + 'loads fine here and loses it the next time anyone edits it');

  const missingDoor = doorKeys.filter(k => !writerKeys.includes(k));
  check('and every field it returns for a DOOR', missingDoor.length === 0,
    `dropped on save: ${missingDoor.join(', ')}`);

  // AND THE ONE THAT STARTED IT, named outright so the failure says what it
  // is rather than only that a set difference is non-empty.
  check('casement specifically survives a save on the dc page',
    writerKeys.includes('casement'),
    'MODEL.dc.html does not write `casement`, so every double casement in a '
    + 'drawing edited on that page silently becomes a single');
}

console.log(`opening round-trip harness: ${pass} checks passed, ${fails.length} failed`);
fails.forEach(line => console.log('  ✘ ' + line));
process.exitCode = fails.length ? 1 : 0;
