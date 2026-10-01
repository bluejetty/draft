#!/usr/bin/env node
// ROOM NUMBERS — the offline harness (board #276).
//
// room-numbers.js holds the naming rules a stamped room answers to: the
// house-wide BEDROOM and WC ladders, the one primary suite, and the WC
// fixture suffix. Pure, so they are checked here in node.
//
//   node proto/room-numbers-harness.js
//
// WHAT THIS USED TO BE (1 Oct). This was room-grow-harness.js, and most of it
// checked the partition -- the grower that turned a stamp program into walls.
// The drafter ruled the grower out ("lets remove it i don't need it, didn't
// work") and room-grow.js went with it; these three sections were never about
// growing, so they came across whole, with the mutation rows that bend them.
const MUTATE = require('./harness-args.js').mutationMode();
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// ── MUTATIONS ─────────────────────────────────────────────────────────────
// Carried over from room-grow-harness's table, where all seven were caught.
const MUTATIONS = [
  ['the ordinary bedroom ladder starts at 1, on top of the primary', 'room-numbers.js',
    c => c.replace("let next = !basement && base === 'BEDROOM' ? 2 : 1;", 'let next = 1;')],
  ['the basement loses its B-series', 'room-numbers.js',
    c => c.replace("const prefix = basement ? 'B' : '';", "const prefix = '';")],
  ['the ladder lands on a number somebody claimed', 'room-numbers.js',
    c => c.replace('            while (claimed.has(next)) next += 1;\n', '')],
  ['two rooms claiming one number both keep it', 'room-numbers.js',
    c => c.replace('tag.claimedNo > 0 && !claimed.has(tag.claimedNo)) {', 'tag.claimedNo > 0) {')],
  ['a primary is allowed in the basement', 'room-numbers.js',
    c => c.replace("    if (levelId === basementLevelId) return { ok: false, reason: 'basement' };\n", '')],
  ['a second primary is allowed while one stands', 'room-numbers.js',
    c => c.replace("return standing ? { ok: false, reason: 'standing' } : { ok: true };", 'return { ok: true };')],
  ['a stall is not a shower', 'room-numbers.js',
    c => c.replace("const shower = set.has('SHOWER') || set.has('STALL');", "const shower = set.has('SHOWER');")],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('room-numbers',
    MUTATIONS, { root: ROOT, harness: __filename, preload: true });
  process.exit(all ? 0 : 1);
}

global.window = {};
(0, eval)(fs.readFileSync(path.join(ROOT, 'room-numbers.js'), 'utf8'));
const G = window.DraftRoomNumbers;

let passed = 0;
const failures = [];
const check = (name, condition, detail) => {
  if (condition) { passed += 1; return; }
  failures.push(detail ? `${name}\n      ${detail}` : name);
};
const eq = (name, actual, expected) => check(name,
  JSON.stringify(actual) === JSON.stringify(expected),
  `expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`);

// ── 1. #276 numbering ─────────────────────────────────────────────────
{
  const tags = [
    { id: 1, base: 'BEDROOM 1', levelId: 3 },
    { id: 2, base: 'BEDROOM', levelId: 3 },
    { id: 3, base: 'WC', levelId: 3 },
    { id: 4, base: 'BEDROOM', levelId: 5 },
    { id: 5, base: 'WC', levelId: 5 },
    { id: 6, base: 'BEDROOM', levelId: 1 },
    { id: 7, base: 'WC', levelId: 1 },
    { id: 8, base: 'KITCHEN', levelId: 3 },
  ];
  const names = G.assignStampNumbers(tags);
  eq('numbering: the primary is BEDROOM 1', names.get(1), 'BEDROOM 1');
  eq('numbering: ordinary bedrooms start at 2', names.get(2), 'BEDROOM 2');
  eq('numbering: the ladder runs house-wide, never restarting per floor', names.get(4), 'BEDROOM 3');
  eq('numbering: WC starts at 1', names.get(3), 'WC 1');
  eq('numbering: WC continues upstairs', names.get(5), 'WC 2');
  eq('numbering: the basement runs its own B-series bedroom', names.get(6), 'BEDROOM B1');
  eq('numbering: the basement runs its own B-series WC', names.get(7), 'WC B1');
  check('numbering: other bases are left to the per-floor machinery', !names.has(8));

  const claimed = G.assignStampNumbers([
    { id: 1, base: 'BEDROOM', levelId: 3, claimedNo: 4 },
    { id: 2, base: 'BEDROOM', levelId: 3 },
    { id: 3, base: 'BEDROOM', levelId: 3 },
  ]);
  eq('numbering: a claimed number is kept', claimed.get(1), 'BEDROOM 4');
  eq('numbering: the ladder skips a claimed number', [claimed.get(2), claimed.get(3)],
    ['BEDROOM 2', 'BEDROOM 3']);

  // A number belongs to ONE tag per series: the earliest claimant (stamp
  // order) keeps it, the later duplicate falls back onto the ladder.
  const dupBeds = G.assignStampNumbers([
    { id: 1, base: 'BEDROOM', levelId: 3, claimedNo: 4 },
    { id: 2, base: 'BEDROOM', levelId: 5, claimedNo: 4 },
    { id: 3, base: 'BEDROOM', levelId: 3 },
  ]);
  eq('duplicate claim: the earliest bedroom claimant keeps the number',
    dupBeds.get(1), 'BEDROOM 4');
  eq('duplicate claim: the later bedroom claimant falls to the ladder',
    dupBeds.get(2), 'BEDROOM 2');
  eq('duplicate claim: unclaimed bedrooms are untouched', dupBeds.get(3), 'BEDROOM 3');

  const dupWcs = G.assignStampNumbers([
    { id: 1, base: 'WC', levelId: 3, claimedNo: 3 },
    { id: 2, base: 'WC', levelId: 3, claimedNo: 3 },
  ]);
  eq('duplicate claim: WC series honors the earliest claimant', dupWcs.get(1), 'WC 3');
  eq('duplicate claim: the later WC claimant takes the next free rung', dupWcs.get(2), 'WC 1');

  // The basement series resolves its own duplicates, independent of the
  // above-grade ladders.
  const dupBasement = G.assignStampNumbers([
    { id: 1, base: 'BEDROOM', levelId: 1, claimedNo: 2 },
    { id: 2, base: 'BEDROOM', levelId: 1, claimedNo: 2 },
    { id: 3, base: 'WC', levelId: 1, claimedNo: 1 },
    { id: 4, base: 'WC', levelId: 1, claimedNo: 1 },
  ]);
  eq('duplicate claim: basement bedrooms resolve to distinct numbers',
    [dupBasement.get(1), dupBasement.get(2)], ['BEDROOM B2', 'BEDROOM B1']);
  eq('duplicate claim: basement WCs resolve to distinct numbers',
    [dupBasement.get(3), dupBasement.get(4)], ['WC B1', 'WC B2']);
}

// ── 2. The one primary ────────────────────────────────────────────────
{
  eq('primary: allowed on an empty house',
    G.primaryAllowed([], { levelId: 3 }), { ok: true });
  eq('primary: refused in the basement',
    G.primaryAllowed([], { levelId: 1 }), { ok: false, reason: 'basement' });
  eq('primary: refused while one stands',
    G.primaryAllowed([{ base: 'BEDROOM 1' }], { levelId: 3 }),
    { ok: false, reason: 'standing' });
}

// ── 3. The live WC fixture suffix ─────────────────────────────────────
{
  eq('wc suffix: nothing in the room', G.wcSuffix([]), '');
  eq('wc suffix: a tub reads /B', G.wcSuffix(['toilet', 'tub']), '/B');
  eq('wc suffix: a shower reads /S', G.wcSuffix(['shower']), '/S');
  eq('wc suffix: a stall IS a shower', G.wcSuffix(['stall']), '/S');
  eq('wc suffix: both read /BS', G.wcSuffix(['tub', 'stall']), '/BS');
}

// ── Report ────────────────────────────────────────────────────────────
console.log(`room numbers harness: ${passed} checks passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach(line => console.log(`  ✘ ${line}`));
  process.exit(1);
}
