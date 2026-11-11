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

const path = require('path');
const MUTATE = require('./harness-args.js').mutationMode();

// ── MUTATIONS (1 Oct) ─────────────────────────────────────────────────────
// Each is a way to hand out free bones or freeze the faucet. Against the
// checks this file had, FOUR OF EIGHT were caught -- measured. The four
// arithmetic rows were; createdAt, both spend guards and read's countdown
// SURVIVED, because nothing here had ever called spend() or read(). The
// checks under "THE TWO THAT TOUCH STORAGE" are what those four asked for.
const MUTATIONS = [
  ['the drip throws away the part-hour, so a reload every 59 minutes drips nothing',
    'bone-wallet.js', c => c.replace('lastDripAt = balance >= cap ? now : lastDripAt + whole * DRIP_MS;',
      'lastDripAt = now;')],
  ['a fractional balance rounds up', 'bone-wallet.js',
    c => c.replace('balance: Math.max(0, Math.floor(balance)),', 'balance: Math.max(0, Math.round(balance)),')],
  ['a clock set back freezes the faucet', 'bone-wallet.js',
    c => c.replace('lastDripAt: Math.min(lastDripAt, now),', 'lastDripAt,')],
  ['the drip runs past the cap', 'bone-wallet.js',
    c => c.replace('const grant = Math.min(whole, cap - balance);', 'const grant = whole;')],
  ['a stored wallet forgets when it was made', 'bone-wallet.js',
    c => c.replace('createdAt: Number.isFinite(createdAt) ? createdAt : now,', 'createdAt: now,')],
  ['spending zero bones succeeds', 'bone-wallet.js',
    c => c.replace('if (!Number.isFinite(count) || count <= 0) return false;',
      'if (!Number.isFinite(count) || count < 0) return false;')],
  ['the last bone cannot be spent', 'bone-wallet.js',
    c => c.replace('if (state.balance < count) { store(state); return false; }',
      'if (state.balance <= count) { store(state); return false; }')],
  ['a full wallet still counts down to a drip it will never get', 'bone-wallet.js',
    c => c.replace('nextDripMs: state.balance >= cap ? null :', 'nextDripMs:')],
  ['the 25BONES line on the pad is ignored', 'bone-wallet.js',
    c => c.replace("first.trim().toUpperCase() === BONES_CODE ? BIG_CAP : DRIP_CAP", 'DRIP_CAP')],
  ['any line of the pad turns the 25 cap on, not just the first', 'bone-wallet.js',
    c => c.replace("split('\\n')[0]", "split('\\n').find(l => l.trim().toUpperCase() === BONES_CODE) || ''")],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('bone-wallet',
    MUTATIONS, { root: path.join(__dirname, '..'), harness: __filename, preload: true });
  process.exit(all ? 0 : 1);
}

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

// A stored wallet keeps its birthday through a later read.
check('a stored wallet keeps when it was made',
  W.normalise({ balance: 1, lastDripAt: T, createdAt: T - HOUR }, T).createdAt, T - HOUR);

// ── THE TWO THAT TOUCH STORAGE ────────────────────────────────────────────
// spend() and read() go through localStorage, which plain node has not got,
// so a Map stands in for it. Each check starts from an empty one.
const store = new Map();
global.localStorage = {
  getItem: key => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => { store.set(key, String(value)); },
};
const wallet = state => {
  store.clear();
  if (state) store.set(W.STORAGE_KEY, JSON.stringify(state));
};
wallet({ balance: 3, lastDripAt: T, createdAt: T });
check('spending nothing is refused, not a free success', W.spend(0, T), false);
wallet({ balance: 3, lastDripAt: T, createdAt: T });
check('the last bones can all be spent', W.spend(3, T), true);
check('and the wallet is then empty', W.read(T).balance, 0);
wallet({ balance: 1, lastDripAt: T, createdAt: T });
check('a spend past the balance is refused', W.spend(2, T), false);
wallet({ balance: W.DRIP_CAP, lastDripAt: T, createdAt: T });
check('a full wallet has no drip coming', W.read(T + HOUR / 2).nextDripMs, null);
wallet({ balance: 1, lastDripAt: T, createdAt: T });
check('a wallet below the cap counts down the rest of the hour',
  W.read(T + HOUR / 4).nextDripMs, HOUR * 3 / 4);

// ── THE 25-BONE LINE (jb, 11 Nov 2026) ────────────────────────────────────
// 25BONES as the FIRST line of the NOTES pad lifts the ceiling to 25 at the
// same drip; anywhere else on the pad it is just a note.
const NOTES = 'draft.notepad';
check('no pad: the ceiling is 10', W.cap(), W.DRIP_CAP);
wallet(null); store.set(NOTES, '25bones \nw 86.86');
check('25BONES first (any case, trailing space): the ceiling is 25', W.cap(), W.BIG_CAP);
wallet({ balance: 0, lastDripAt: T, createdAt: T }); store.set(NOTES, '25BONES');
check('a hundred hours with the code fills to 25', W.read(T + 100 * HOUR).balance, 25);
check('and read says which ceiling is in force', W.read(T + 100 * HOUR).cap, 25);
wallet({ balance: 10, lastDripAt: T, createdAt: T }); store.set(NOTES, 'w 86.86\n25BONES');
check('25BONES on the second line counts for nothing', W.read(T + 100 * HOUR).balance, 10);
wallet({ balance: 25, lastDripAt: T, createdAt: T });
check('the line taken off keeps bones already above 10', W.read(T + HOUR).balance, 25);
check('with no drip coming until a spend brings it under 10', W.read(T + HOUR).nextDripMs, null);

console.log(failed ? `\n  ${failed} of ${ran} checks FAILED\n` : `\n  ${ran} checks passed\n`);
process.exit(failed ? 1 : 0);
