// gruff-drivethru.js — the board's four zones, and the engine's read of a draft.
//
// The zones are PERCENTAGES because the board art scales, but they were
// MEASURED off `assets/gruff-drivethru-board.png` at its natural 1250x1050.
// That is the fact worth pinning: a percentage that no longer lands on a whole
// pixel of the source art is a number somebody nudged by eye, and nudging by
// eye is how a panel drifts off the drawing underneath it.

// No mutation mode here, so this harness accepts no arguments at all. It
// used to read none: `node gruff-drivethru-harness.js --mutate` printed a full
// passing run and exited 0, having mutated nothing. noFlags(), not
// mutationMode() -- the latter would accept --mutate and print green for a
// mode that does not exist.
require('./harness-args.js').noFlags();

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

console.log(failed ? `\n  ${failed} of ${ran} checks FAILED\n` : `\n  ${ran} checks passed\n`);
process.exit(failed ? 1 : 0);
