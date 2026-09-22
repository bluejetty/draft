#!/usr/bin/env node
// A WINDOW HEADS OUT AT 7'-0", AND TWO MODULES SAY SO.
//
// Movie, 21 Sep 2026:
//
//   "on windows the top of the window should be default located 7ft high from
//    the current level floor level (if the window changes size the bottom
//    changes)"
//
// and on 22 Sep, asked whether that was the rule or only the default, and
// whether windows already drawn should follow:
//
//   "7' is default window height, but use can change window height"
//   "move to 7ft"
//
// ── WHY THE NUMBER IS IN TWO PLACES ──────────────────────────────────────
//
// geometry-2d.js owns it for the PLACERS -- auto-windows.js asks it at deal
// time, premade-plans.js hangs its designs from it, MODEL.html's drawing
// gesture defaults to it.
//
// drawing-format.js needs it too, for the MIGRATION: a window still sitting at
// an old default head moves to 7'-0" on load, keeping its size. That has to
// live in the reader because fenestrations() is the one gate every page goes
// through -- MODEL.dc.html, LAYOUT.dc.html and proto/elevation-harness.js all
// call it -- so no page has to remember to apply it.
//
// AND THAT MODULE MAY NOT READ IT. Its own rule, stated at its head: "Every
// table these rules consult is passed in rather than read off `window`.
// Reading window.DraftWallTypes here would put a load-order dependency into
// the module that every page loads first -- the trap Finding 3 of the module
// review gate counted thirteen times."
//
// So the copy is deliberate, and this file is the price of it. A second copy
// is free to drift; this is the check that would otherwise go on passing
// while the two disagreed -- and a drawing would then carry two head heights,
// the migrated windows at one and the newly placed ones at the other, with
// nothing on the plan to say so. That is the DEFAULT_FLOOR_THICKNESS_IN
// lesson and the ROOF_FASCIA_IN one, a third time.
//
//   node proto/window-head-harness.js
require('./harness-args.js').noFlags();

global.window = global.window || {};
require('../geometry-2d.js');
require('../drawing-format.js');
const G = window.DraftGeometry2D;
const F = window.DraftDrawingFormat;

let pass = 0;
const fails = [];
const eq = (label, got, want) => {
  if (String(got) === String(want)) { pass += 1; return; }
  fails.push(`${label} — got ${got}, want ${want}`);
};
const check = (label, ok, detail) => {
  if (ok) { pass += 1; return; }
  fails.push(detail ? `${label} — ${detail}` : label);
};

// ── THE TWO COPIES AGREE ──────────────────────────────────────────────────
eq('the head geometry-2d places at and the head drawing-format migrates to',
  G.DEFAULT_WINDOW_HEAD_FT, F.WINDOW_HEAD_FT);
eq('and so do the lists of heads they call superseded',
  G.SUPERSEDED_WINDOW_HEADS_FT.join(','), F.SUPERSEDED_WINDOW_HEADS_FT.join(','));

// AND NEITHER IS EMPTY OR ZERO, because `undefined === undefined` passes the
// check above perfectly. A rename on one side that left the other reading a
// missing export would agree on nothing and report agreement.
check('and the head is a real height, not two modules agreeing on undefined',
  Number.isFinite(G.DEFAULT_WINDOW_HEAD_FT) && G.DEFAULT_WINDOW_HEAD_FT > 3,
  `${G.DEFAULT_WINDOW_HEAD_FT}`);
check('and the superseded list is not empty, which would migrate nothing',
  Array.isArray(G.SUPERSEDED_WINDOW_HEADS_FT) && G.SUPERSEDED_WINDOW_HEADS_FT.length > 0,
  JSON.stringify(G.SUPERSEDED_WINDOW_HEADS_FT));

// A DOOR IS NOT A WINDOW. They shared one head until this ruling, and the
// thing that would quietly undo it is someone pointing one constant at the
// other again.
check('a door still heads lower than a window',
  G.DEFAULT_OPENING_HEAD_FT < G.DEFAULT_WINDOW_HEAD_FT,
  `door ${G.DEFAULT_OPENING_HEAD_FT}, window ${G.DEFAULT_WINDOW_HEAD_FT}`);
check('and the door head is one of the heads a window is migrated OFF',
  G.SUPERSEDED_WINDOW_HEADS_FT.some(h => Math.abs(h - G.DEFAULT_OPENING_HEAD_FT) < 1e-9),
  `${G.DEFAULT_OPENING_HEAD_FT} against ${JSON.stringify(G.SUPERSEDED_WINDOW_HEADS_FT)}`);

// ── AND THE MIGRATION DOES WHAT THE RULING SAYS ───────────────────────────
//
// Driven through fenestrations() rather than a copy of its arithmetic, so
// this is the reader every page uses and not a second opinion about it.
const ids = new Set([3]);
const read = (sill, head, type = 'window') => F.fenestrations([{
  id: 'f1', wallId: 'w1', levelId: 3, type, width: 4, offset: 5,
  sillHeight: sill, headHeight: head,
}], ids)[0];

{
  // THE SIZE IS WHAT SURVIVES. A window moved to the new head is the same
  // window, higher -- which is his rule the other way up: resizing moves the
  // bottom, so moving the top moves the bottom with it.
  const was = { sill: G.DEFAULT_WINDOW_SILL_FT, head: G.DEFAULT_OPENING_HEAD_FT };
  const now = read(was.sill, was.head);
  eq('a window at the old shared head moves to 7 ft', now.headFt ?? now.headHeight,
    G.DEFAULT_WINDOW_HEAD_FT);
  eq('and keeps the size it had', (now.headHeight - now.sillHeight).toFixed(6),
    (was.head - was.sill).toFixed(6));
  check('so its sill rose', now.sillHeight > was.sill,
    `${now.sillHeight} against ${was.sill}`);
}
{
  // THE DEALER'S OWN OLD CATALOGUE, the second superseded head.
  const now = read(3, 6.5);
  eq('a window at the dealer’s old 6 ft 6 head moves too',
    now.headHeight, G.DEFAULT_WINDOW_HEAD_FT);
  eq('and keeps its 3 ft 6 of glass', (now.headHeight - now.sillHeight).toFixed(6),
    (6.5 - 3).toFixed(6));
}
{
  // THE HALF OF THE RULING THAT PROTECTS THE DRAFTER. "7' is default window
  // height, but use can change window height" -- and a migration that ran on
  // every open would drag a head he typed back to 7'-0" every time.
  const now = read(3, 8);
  eq('a head the drafter set is left alone', now.headHeight, 8);
  eq('and so is its sill', now.sillHeight, 3);
}
{
  // IDEMPOTENT, which is what lets this live in the reader at all: no flag on
  // the record says it has run, so running it twice must change nothing.
  const once = read(G.DEFAULT_WINDOW_SILL_FT, G.DEFAULT_OPENING_HEAD_FT);
  const twice = read(once.sillHeight, once.headHeight);
  eq('reading a migrated window again moves it no further',
    `${twice.sillHeight},${twice.headHeight}`, `${once.sillHeight},${once.headHeight}`);
}
{
  // A DOOR STANDS ON THE FLOOR: its head IS its height, and 6'-8" is the leaf
  // the office orders. Migrating it would order a different door.
  const now = read(0, G.DEFAULT_OPENING_HEAD_FT, 'door');
  eq('a door at the same head does not move', now.headHeight, G.DEFAULT_OPENING_HEAD_FT);
  eq('and stays on the floor', now.sillHeight, 0);
}
{
  // AND NO WINDOW IS MIGRATED BELOW THE FLOOR. A window whose old sill sat
  // almost at its head -- a 2" slot -- still has to come out above zero.
  const now = read(6.6, G.DEFAULT_OPENING_HEAD_FT);
  check('a very short window migrates to a sill above the floor',
    now.sillHeight >= 0 && now.sillHeight < now.headHeight,
    `sill ${now.sillHeight}, head ${now.headHeight}`);
}

// ── THE FORMAT VERSION DID NOT MOVE, and that is load-bearing ─────────────
//
// The stored SHAPE does not change: sillHeight and headHeight are both still
// written. A bump would refuse every existing file outright -- checkEnvelope
// reads an older version as 'invalid', not as something to upgrade, and this
// module has no upgrade path. So the migration had to be one that needs none.
eq('the stored format version is unchanged by this ruling', F.VERSION, 1);

console.log(`window head harness: ${pass} checks passed, ${fails.length} failed`);
fails.forEach(line => console.log('  ✘ ' + line));
process.exitCode = fails.length ? 1 : 0;
