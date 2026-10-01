// gruff-drivethru.js — the board's four zones, and the engine's read of a draft.
//
// The zones are PERCENTAGES because the board art scales, but they were
// MEASURED off `assets/gruff-drivethru-board.png` at its natural 1250x1050.
// That is the fact worth pinning: a percentage that no longer lands on a whole
// pixel of the source art is a number somebody nudged by eye, and nudging by
// eye is how a panel drifts off the drawing underneath it.

const path = require('path');
const MUTATE = require('./harness-args.js').mutationMode();

// ── MUTATIONS (1 Oct) ─────────────────────────────────────────────────────
//
// AGAINST THE CHECKS THIS FILE HAD, THIS TABLE CAUGHT THREE OF EIGHT --
// measured, not estimated. The two zone rows and `hasStairs` were caught; the
// sliver, the front wall, the zero, the send guard and the KEEP chip all
// SURVIVED, because the harness tested the board art and the empty-input
// refusals and nothing the engine actually decides. The checks under "WHAT
// THE ENGINE DECIDES" below are what those five asked for, each written
// against the row that survived it. With them: eight of eight.
const MUTATIONS = [
  ['a zone nudged by eye, off a whole pixel of the art', 'gruff-drivethru.js',
    c => c.replace('portrait: Object.freeze({ left: 6.720,', 'portrait: Object.freeze({ left: 6.750,')],
  ['the speaker climbs into the answer strip', 'gruff-drivethru.js',
    c => c.replace('speaker:  Object.freeze({ left: 34.400, top: 86.571,',
      'speaker:  Object.freeze({ left: 34.400, top: 80.000,')],
  ['a sliver of an outline is taken for a house', 'gruff-drivethru.js',
    c => c.replace('if (!Number.isFinite(x0) || x1 - x0 < 1 || z1 - z0 < 1) return null;',
      'if (!Number.isFinite(x0)) return null;')],
  ['the front is measured off the back wall', 'gruff-drivethru.js',
    c => c.replace("{ side: 'front', gap: Math.abs(box.z1 - door.z) },",
      "{ side: 'front', gap: Math.abs(box.z0 - door.z) },")],
  ['the empty project field confirms "0 bedrooms" at the client', 'gruff-drivethru.js',
    c => c.replace('(Number.isFinite(value) && value > 0 ? Math.round(value) : undefined)',
      '(Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined)')],
  ['every drawing claims stairs', 'gruff-drivethru.js',
    c => c.replace('facts.hasStairs = stairs.length > 0;', 'facts.hasStairs = stairs.length >= 0;')],
  ['a draft of spaces can be sent', 'gruff-drivethru.js',
    c => c.replace('canSend: typed.trim().length > 0,', 'canSend: typed.length > 0,')],
  ['a settled answer not among the options loses its KEEP chip', 'gruff-drivethru.js',
    c => c.replace("if (suggested !== '' && !chips.some(chip => chip.suggested)) {",
      'if (false) {')],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('gruff-drivethru',
    MUTATIONS, { root: path.join(__dirname, '..'), harness: __filename, preload: true });
  process.exit(all ? 0 : 1);
}

global.window = global.window || {};
require('../gruff-drivethru.js');
const G = global.window.DraftGruffDrivethru;

let failed = 0, ran = 0;
const check = (label, got, want) => {
  ran += 1;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failed += 1;
    console.log(`  FAIL ${label}\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`);
  }
};

const { width: W, height: H, zones } = G.BOARD;
check('the board art is the measured size', [W, H], [1250, 1050]);

// Every zone must resolve to whole pixels of the source art, both axes.
for (const [name, z] of Object.entries(zones)) {
  const px = v => Math.abs(v - Math.round(v)) < 0.02;
  check(`${name} left/width land on whole pixels`,
    [px(z.left / 100 * W), px(z.width / 100 * W)], [true, true]);
  check(`${name} top/height land on whole pixels`,
    [px(z.top / 100 * H), px(z.height / 100 * H)], [true, true]);
  // And no zone may run off the board, which a hand-edited percentage does first.
  check(`${name} stays inside the board`,
    [z.left >= 0, z.top >= 0, z.left + z.width <= 100, z.top + z.height <= 100],
    [true, true, true, true]);
}

// The portrait and the screen sit side by side; nothing may overlap the answer
// strip below them, or Gruff's words land on his own face.
check('portrait ends before the screen begins', zones.portrait.left + zones.portrait.width <= zones.screen.left, true);
check('the answer strip starts below both', zones.answer.top >=
  Math.max(zones.portrait.top + zones.portrait.height, zones.screen.top + zones.screen.height), true);
check('the speaker sits below the answer strip', zones.speaker.top >= zones.answer.top + zones.answer.height, true);

// Empty in, empty out — the engine reads a draft, it does not invent one.
check('no snapshot yields no stairs, not a guess', G.factsFrom(), { hasStairs: false });
check('doorSide refuses without a wall', G.doorSide(), null);
check('outlineBox refuses without an outline', G.outlineBox(), null);

// ── WHAT THE ENGINE DECIDES ───────────────────────────────────────────────
//
// A box is the outline's extents, and a sliver is not a house: every zone
// would collapse onto one line of it.
const square = [{ x: 0, z: 0 }, { x: 30, z: 0 }, { x: 30, z: 40 }, { x: 0, z: 40 }];
check('a house outline reduces to its extents', G.outlineBox(square), { x0: 0, x1: 30, z0: 0, z1: 40 });
check('a sliver under a foot wide is refused, not boxed',
  G.outlineBox([{ x: 0, z: 0 }, { x: 0.5, z: 0 }, { x: 0.5, z: 40 }, { x: 0, z: 40 }]), null);

// The section marks' compass: front is +z. One door per wall, each nearest
// its own -- so a side measured off the wrong edge answers for the wrong one.
const box = G.outlineBox(square);
check('a door on the +z wall is the front', G.doorSide({ x: 15, z: 40 }, box), 'front');
check('a door on the -z wall is the back', G.doorSide({ x: 15, z: 0 }, box), 'back');
check('a door on the -x wall is the left', G.doorSide({ x: 0, z: 20 }, box), 'left');
check('a door on the +x wall is the right', G.doorSide({ x: 30, z: 20 }, box), 'right');

// Zero is the project form's empty state, not an answer to confirm.
check('zero bedrooms on file is no fact at all',
  'bedrooms' in G.factsFrom({ projectInfo: { bedrooms: 0, bathrooms: 2 } }), false);
check('and a real count is kept', G.factsFrom({ projectInfo: { bedrooms: 3 } }).bedrooms, 3);

// The send key reads the draft as a person would: spaces are not an answer.
check('a draft of spaces cannot be sent', G.viewModel({ id: 'q' }, '   ').canSend, false);
check('a typed answer can', G.viewModel({ id: 'q' }, 'yes').canSend, true);

// A settled answer the options do not list is still one press away.
const keep = G.viewModel({ id: 'q', options: ['1', '2'], suggested: '3' });
check('a settled answer off the list leads as its own KEEP chip',
  [keep.chips[0].label, keep.chips[0].suggested], ['KEEP 3', true]);
check('and one on the list is marked rather than repeated',
  G.viewModel({ id: 'q', options: ['1', '2'], suggested: '2' }).chips.map(c => c.suggested), [false, true]);

console.log(failed ? `\n  ${failed} of ${ran} checks FAILED\n` : `\n  ${ran} checks passed\n`);
process.exit(failed ? 1 : 0);
