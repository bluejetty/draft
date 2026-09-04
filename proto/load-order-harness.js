// LOAD ORDER, PROVEN RATHER THAN GREPPED.
//
// Two sweeps of this repo -- one each from two agents -- converged on "7 files,
// 10 captures" and called it definitive. Both were wrong the same way: the
// pattern `const X = window.Y` cannot see DESTRUCTURING, and
// `const { WALL_TYPES } = window.DraftWallTypes;` at module scope is not only a
// capture, it is a stricter one -- it throws AT LOAD rather than at the
// eventual call site.
//
// A keyword grep is not a verdict. This runs it.
//
// Answer: 8 files, 13 captures -- 10 plain, 3 destructured (cut-view x2,
// layout-plan x1). See RD-DOCUMENTS/IMPORTANT-WORK-ORDERS/MIGRATION-STATUS.md.

// No mutation mode here, so this harness accepts no arguments at all. It
// used to read none: `node load-order-harness.js --mutate` printed a full
// passing run and exited 0, having mutated nothing. noFlags(), not
// mutationMode() -- the latter would accept --mutate and print green for a
// mode that does not exist.
require('./harness-args.js').noFlags();

global.window = global;

console.log('--- layout-plan.js WITHOUT wall-types.js loaded first');
try {
  require('../layout-plan.js');
  console.log('    loaded fine  <- would mean it is NOT load-order-sensitive');
} catch (e) {
  console.log(`    ${e.constructor.name}: ${e.message}`);
  console.log('    ^ thrown AT LOAD, before any function is called');
}

console.log('--- and WITH wall-types.js loaded first');
delete global.DraftLayoutPlan;
require('../wall-types.js');
try {
  require('../layout-plan.js');
  console.log('    loaded fine  <- order is the only difference');
} catch (e) {
  console.log(`    still failed: ${e.message}`);
}
