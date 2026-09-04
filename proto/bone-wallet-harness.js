// bone-wallet.js — the free-bone economy's arithmetic, under plain node.
//
// Nine exports; two of them touch localStorage (`read`, `spend`) and the rest
// are pure. The pure pair carry the whole risk: `normalise` decides what a
// stored wallet is allowed to say, and `applyDrip` decides how many bones an
// hour is worth. A silent error in either hands out free bones or freezes the
// faucet, and neither shows on screen until somebody complains.
//
// The module's own header calls it an honour system by design — localStorage,
// editable with devtools, real enforcement waiting on the server ledger (#52).
// So these checks pin the ARITHMETIC, not the security, which is exactly the
// claim the module makes for itself.

// No mutation mode here, so this harness accepts no arguments at all. It
// used to read none: `node bone-wallet-harness.js --mutate` printed a full
// passing run and exited 0, having mutated nothing. noFlags(), not
// mutationMode() -- the latter would accept --mutate and print green for a
// mode that does not exist.
require('./harness-args.js').noFlags();

global.window = global.window || {};
require('../bone-wallet.js');
const W = global.window.DraftBoneWallet;

let failed = 0, ran = 0;
const check = (label, got, want) => {
  ran += 1;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failed += 1;
    console.log(`  FAIL ${label}\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`);
  }
};
const HOUR = W.DRIP_MS;
const T = 1_000_000_000_000;      // a fixed "now", so nothing here depends on the clock

check('a new browser is seeded, not empty', W.normalise(null, T),
  { balance: W.SEED_BONES, lastDripAt: T, createdAt: T });
check('a mangled record reseeds rather than throwing', W.normalise({ balance: 'x' }, T),
  { balance: W.SEED_BONES, lastDripAt: T, createdAt: T });
check('a negative balance floors at zero', W.normalise({ balance: -5, lastDripAt: T, createdAt: T }, T).balance, 0);
check('a fractional balance floors, never rounds up', W.normalise({ balance: 2.9, lastDripAt: T, createdAt: T }, T).balance, 2);

// A clock set back — or a restored VM — must not freeze the faucet forever.
check('a lastDripAt in the FUTURE clamps to now',
  W.normalise({ balance: 1, lastDripAt: T + 5 * HOUR, createdAt: T }, T).lastDripAt, T);

// Below the cap: whole hours grant, and the remainder must CARRY. If the
// fraction were discarded, a reload every 59 minutes would drip nothing ever.
check('two and a half hours grants two bones',
  W.applyDrip({ balance: 1, lastDripAt: T, createdAt: T }, T + 2.5 * HOUR).balance, 3);
check('and the half hour carries, not lost',
  W.applyDrip({ balance: 1, lastDripAt: T, createdAt: T }, T + 2.5 * HOUR).lastDripAt, T + 2 * HOUR);
check('under an hour grants nothing and moves nothing',
  W.applyDrip({ balance: 1, lastDripAt: T, createdAt: T }, T + 0.9 * HOUR),
  { balance: 1, lastDripAt: T, createdAt: T });

// At or above the cap the clock PARKS: elapsed time is discarded so nothing
// banks above the ceiling, and a later spend starts a fresh hour.
check('the drip never exceeds the cap',
  W.applyDrip({ balance: W.DRIP_CAP - 1, lastDripAt: T, createdAt: T }, T + 50 * HOUR).balance, W.DRIP_CAP);
check('at the cap the clock parks at now',
  W.applyDrip({ balance: W.DRIP_CAP, lastDripAt: T, createdAt: T }, T + 50 * HOUR).lastDripAt, T + 50 * HOUR);
check('a hundred hours from empty still stops at the cap',
  W.applyDrip({ balance: 0, lastDripAt: T, createdAt: T }, T + 100 * HOUR).balance, W.DRIP_CAP);

check('BUILD HOUSE costs exactly one bone', W.COSTS.buildHouse, 1);

console.log(failed ? `\n  ${failed} of ${ran} checks FAILED\n` : `\n  ${ran} checks passed\n`);
process.exit(failed ? 1 : 0);
