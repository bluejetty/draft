// Offline checks for gruff-interview.js (board #323) — the professor with
// no browser in the way. One line per check, in the house style.
//
//   node proto/gruff-interview-harness.js
global.window = global.window || {};
require('../gruff-interview.js');
const G = window.DraftGruffInterview;

let pass = 0;
const fails = [];
const check = (label, ok, detail) => {
  if (ok) { pass++; return; }
  fails.push(detail ? `${label} — ${detail}` : label);
};
const eq = (label, got, want) => check(label, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

// Answer whatever comes, in a fixed way, so a walk is reproducible.
const canned = q => {
  if (q.kind === 'count') return '3';
  if (q.kind === 'yesno') return 'yes';
  if (q.kind === 'zone') return 'back';
  return (q.options || ['standard'])[0];
};
const walk = (state, steps, reply = canned) => {
  const ids = [];
  let s = state;
  for (let i = 0; i < steps; i++) {
    const q = G.nextQuestion(s);
    if (q.done) { ids.push('DONE'); break; }
    ids.push(q.id);
    s = G.answer(s, q.id, reply(q));
  }
  return { ids, state: s };
};

// ── The critical ladder leads ─────────────────────────────────────────
{
  const { ids } = walk(G.startState({}, 1), 4);
  eq('the ladder opens with storeys', ids[0], 'storeys');
  eq('then bedrooms', ids[1], 'bedrooms');
  eq('then bathrooms', ids[2], 'bathrooms');
  eq('then the entry side', ids[3], 'entry');
  eq('and that is the ladder the module publishes',
    G.CRITICAL_LADDER.join(','), ids.slice(0, 4).join(','));
}

// ── Adaptive skipping: what the drawing knows, Gruff does not ask ─────
{
  const facts = { storeys: 2, entrySide: 'left', hasStairs: true };
  const { ids } = walk(G.startState(facts, 1), 12);
  check('a drawn level stack settles the storeys question', !ids.includes('storeys'), ids.join(','));
  check('a placed door settles the entry question', !ids.includes('entry'), ids.join(','));
  check('placed stairs settle the stair question', !ids.includes('stairZone'), ids.join(','));
  eq('so the ladder opens at the first thing the drawing cannot answer', ids[0], 'bedrooms');
}
{
  // With no stairs placed, the stair question IS asked — otherwise the
  // check above would pass for the wrong reason.
  const { ids } = walk(G.startState({ storeys: 2 }, 1), 14);
  check('with no stairs drawn the stair question is asked', ids.includes('stairZone'), ids.join(','));
}

// ── Project-info counts are seeded and confirmed, not asked cold ──────
{
  const s = G.startState({ storeys: 2, bedrooms: 4 }, 1);
  const q = G.nextQuestion(s);
  eq('the seeded count comes up first', q.id, 'bedrooms');
  eq('and it arrives with the value already suggested', q.suggested, 4);
  check('the prompt confirms rather than asks cold', /still 4|down for 4/i.test(q.prompt), q.prompt);
}

// ── Bone at any rung: the program is complete from the first moment ───
{
  let s = G.startState({}, 1);
  let depth = 0;
  let ok = true;
  const sizes = [];
  for (; depth < 14; depth++) {
    const p = G.program(s);
    if (!p.complete || !p.stamps.length) { ok = false; break; }
    if (p.stamps.some(stamp => !stamp.base || !Number.isFinite(stamp.x) || !Number.isFinite(stamp.z))) {
      ok = false; break;
    }
    sizes.push(p.stamps.length);
    const q = G.nextQuestion(s);
    if (q.done) break;
    s = G.answer(s, q.id, canned(q));
  }
  check('every rung hands over a complete, placed program', ok, `failed at depth ${depth}`);
  check('including before a single question is answered', sizes[0] > 0, `first=${sizes[0]}`);
  const p0 = G.program(G.startState({}, 1));
  check('and it names what it decided for you', p0.defaulted.length > 0, `${p0.defaulted.length}`);
  check('a silent program leans entirely on defaults',
    p0.defaulted.includes('bedrooms') && p0.defaulted.includes('storeys'), p0.defaulted.join(','));
}

// ── An answer tightens the result ─────────────────────────────────────
{
  const quiet = G.program(G.startState({}, 1));
  let loud = G.startState({}, 1);
  loud = G.answer(loud, 'storeys', '1');
  loud = G.answer(loud, 'bedrooms', '4');
  const p = G.program(loud);
  eq('an answered storey count reaches the program', p.storeys, 1);
  check('four bedrooms make more bedroom stamps than three',
    p.stamps.filter(s => s.base === 'BEDROOM').length
    > quiet.stamps.filter(s => s.base === 'BEDROOM').length);
  check('and the answered ids drop out of the defaulted list',
    !p.defaulted.includes('bedrooms') && !p.defaulted.includes('storeys'), p.defaulted.join(','));
}

// ── Zone words land where they say ────────────────────────────────────
{
  const box = { x0: -20, x1: 20, z0: -14, z1: 14 };
  const front = G.resolveZone('front', box);
  const back = G.resolveZone('back', box);
  const left = G.resolveZone('left', box);
  const right = G.resolveZone('right', box);
  check('front sits toward +z, the E1 wall', front.z > 0, `z=${front.z}`);
  check('back sits toward -z', back.z < 0, `z=${back.z}`);
  check('left sits toward -x', left.x < 0, `x=${left.x}`);
  check('right sits toward +x', right.x > 0, `x=${right.x}`);
  check('every zone lands inside the footprint',
    [front, back, left, right].every(pt => pt.x > box.x0 && pt.x < box.x1 && pt.z > box.z0 && pt.z < box.z1));
  const stair = G.resolveZone('by the stairs', box, 0, 1, { x: 5, z: -3 });
  check('by-the-stairs lands on the stair when there is one',
    Math.hypot(stair.x - 5, stair.z + 3) < 0.001, JSON.stringify(stair));
  const noStair = G.resolveZone('by the stairs', box, 0, 1, null);
  check('and on the middle when there is not',
    Math.abs(noStair.x) < 0.001 && Math.abs(noStair.z) < 0.001, JSON.stringify(noStair));
}
{
  // Two rooms in the same zone must not stack on one spot.
  const box = { x0: -20, x1: 20, z0: -14, z1: 14 };
  const a = G.resolveZone('back', box, 0, 3);
  const b = G.resolveZone('back', box, 1, 3);
  const c = G.resolveZone('back', box, 2, 3);
  check('rooms sharing a zone spread along it',
    a.x < b.x && b.x < c.x, `${a.x} ${b.x} ${c.x}`);
  check('and they keep the zone they were given', a.z === b.z && b.z === c.z);
}
{
  // The whole program honours the words, not just the resolver.
  let s = G.startState({ outline: { x0: -20, x1: 20, z0: -14, z1: 14 } }, 1);
  s = G.answer(s, 'kitchenZone', 'front');
  s = G.answer(s, 'livingZone', 'back');
  const p = G.program(s);
  const kitchen = p.stamps.find(x => x.base === 'KITCHEN');
  const living = p.stamps.find(x => x.base === 'LIVING');
  check('a kitchen asked for the front goes to the front', kitchen.z > 0, JSON.stringify(kitchen));
  check('a living room asked for the back goes to the back', living.z < 0, JSON.stringify(living));
  check('no two stamps on the same storey share a spot', (() => {
    const seen = new Set();
    return p.stamps.filter(x => x.companionOf == null).every(x => {
      const key = `${x.storey}|${x.x.toFixed(2)}|${x.z.toFixed(2)}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  })());
}

// ── Companions ride with their host, the way room-grow expects ────────
{
  let s = G.startState({}, 1);
  s = G.answer(s, 'primarySuite', 'yes');
  s = G.answer(s, 'walkIn', 'yes');
  const p = G.program(s);
  const primary = p.stamps.find(x => x.base === 'BEDROOM');
  const ensuite = p.stamps.find(x => x.base === 'ENSUITE');
  const walkIn = p.stamps.find(x => x.base === 'WALK-IN');
  eq('the ensuite is a companion of the primary', ensuite.companionOf, primary.id);
  eq('so is the walk-in', walkIn.companionOf, primary.id);
  check('and both sit on the primary spot',
    ensuite.x === primary.x && ensuite.z === primary.z
    && walkIn.x === primary.x && walkIn.z === primary.z);
  check('every stamp carries a base room-grow knows',
    p.stamps.every(x => typeof x.base === 'string' && x.base.length > 0));
}

// ── Determinism ───────────────────────────────────────────────────────
{
  const run = () => {
    let s = G.startState({ outline: { x0: -18, x1: 18, z0: -12, z1: 12 } }, 42);
    for (let i = 0; i < 12; i++) {
      const q = G.nextQuestion(s);
      if (q.done) break;
      s = G.answer(s, q.id, canned(q));
    }
    return G.program(s);
  };
  eq('the same interview builds the same program twice',
    JSON.stringify(run()), JSON.stringify(run()));
  const a = G.nextQuestion(G.startState({}, 9));
  const b = G.nextQuestion(G.startState({}, 9));
  eq('and the same seed says the same words', a.prompt, b.prompt);
}

// ── The reminder, on cadence, without nagging ─────────────────────────
{
  let s = G.startState({}, 5);
  const marks = [];
  for (let i = 0; i < 12; i++) {
    const q = G.nextQuestion(s);
    if (q.done) break;
    marks.push(q.reminder ? 1 : 0);
    s = G.answer(s, q.id, canned(q));
  }
  eq('the first question is never a reminder', marks[0], 0);
  check('the bone gets mentioned', marks.some(Boolean), marks.join(''));
  check('but never twice running', !marks.some((m, i) => m && marks[i + 1]), marks.join(''));
  const gaps = marks.reduce((acc, m, i) => (m ? [...acc, i] : acc), []);
  check(`the cadence is every ${G.REMINDER_EVERY}`,
    gaps.every((g, i) => i === 0 || g - gaps[i - 1] === G.REMINDER_EVERY), gaps.join(','));
}

// ── Tolerant parsing, and never a dead end ────────────────────────────
{
  eq('digits parse', G.parseCount('3'), 3);
  eq('words parse', G.parseCount('three'), 3);
  eq('a whole sentence parses', G.parseCount('about three bedrooms please'), 3);
  eq('a couple is two', G.parseCount('a couple'), 2);
  eq('none is zero', G.parseCount('none'), 0);
  eq('yes in any dress', G.parseYesNo('yeah go on then'), true);
  eq('no in any dress', G.parseYesNo('nah'), false);
  eq('a zone said sideways', G.parseZone('out front please'), 'front');
  eq('and the stairs by name', G.parseZone('near the stairs'), 'by the stairs');
  eq('gibberish parses to nothing', G.parseCount('asdf'), null);
}
{
  const s = G.startState({}, 1);
  const q = G.nextQuestion(s);
  const after = G.answer(s, q.id, 'asdfasdf');
  const again = G.nextQuestion(after);
  eq('an unparseable answer is not recorded', Object.keys(after.answers).length, 0);
  eq('the same question comes back', again.id, q.id);
  check('with a good-natured line in front of it',
    again.prompt.length > q.prompt.length, again.prompt);
  check('and the state was not mutated', Object.keys(s.answers).length === 0);
  // Answering properly still works after a fumble.
  const fixed = G.answer(after, q.id, '2');
  eq('and the recovery lands', fixed.answers[q.id], 2);
}

// ── Purity ────────────────────────────────────────────────────────────
{
  const s = G.startState({}, 1);
  const before = JSON.stringify(s);
  const t = G.answer(s, 'bedrooms', '4');
  eq('answer does not mutate the state it was given', JSON.stringify(s), before);
  check('it returns a new one', t !== s && t.answers.bedrooms === 4);
  check('the surface is frozen', Object.isFrozen(G));
}

// ── Deep, not wide: the tree keeps going past the ladder ──────────────
{
  const { ids } = walk(G.startState({}, 1), 40);
  const past = ids.filter(id => !G.CRITICAL_LADDER.includes(id) && id !== 'DONE');
  check('there is a lot of house left to talk about after the ladder',
    past.length >= 12, `${past.length}: ${past.join(',')}`);
  check('the interview does eventually finish', ids.includes('DONE'), ids.length);
  const unique = new Set(ids.filter(id => id !== 'DONE'));
  eq('and it never asks the same thing twice', unique.size, ids.length - 1);
}
{
  // A bigger house is a longer conversation — depth comes from the answers.
  const small = walk(G.answer(G.startState({}, 1), 'bedrooms', '2'), 40).ids.length;
  const big = walk(G.answer(G.startState({}, 1), 'bedrooms', '5'), 40).ids.length;
  check('five bedrooms ask more than two', big > small, `${big} vs ${small}`);
}

// ── The grower actually accepts it ────────────────────────────────────
// The ground rule for this board is to consume room-grow's interface, not
// rework it. The only honest way to know the stamp program is the shape it
// wants is to hand it over and watch it grow.
{
  require('../geometry-2d.js');
  require('../room-grow.js');
  const R = window.DraftRoomGrow;
  const box = { x0: -20, x1: 20, z0: -14, z1: 14 };
  const ring = [
    { x: box.x0, z: box.z0 }, { x: box.x1, z: box.z0 },
    { x: box.x1, z: box.z1 }, { x: box.x0, z: box.z1 },
  ];
  let s = G.startState({ outline: box, levelIds: [3, 5] }, 7);
  for (let i = 0; i < 20; i++) {
    const q = G.nextQuestion(s);
    if (q.done) break;
    s = G.answer(s, q.id, canned(q));
  }
  const p = G.program(s);
  [1, 2].forEach(storey => {
    const stamps = p.stamps.filter(x => x.storey === storey).map(x => ({
      id: x.id, base: x.base, x: x.x, z: x.z,
      ...(x.companionOf != null ? { companionOf: x.companionOf } : {}),
    }));
    if (!stamps.length) return;
    const grown = R.growRooms({ points: ring, stamps });
    check(`storey ${storey}: the grower takes the program and grows rooms`,
      grown.rooms.length > 0, `rooms=${grown.rooms.length} report=${grown.report.join('|')}`);
    check(`storey ${storey}: and puts up walls for them`,
      grown.walls.length > 0, `walls=${grown.walls.length}`);
    // Every stamp comes back with a claim — companions included, since the
    // grower nests an ensuite or walk-in inside its bedroom rather than
    // dropping it.
    check(`storey ${storey}: every stamp comes back with a claim`,
      grown.rooms.length === stamps.length,
      `rooms=${grown.rooms.length} stamps=${stamps.length}`);
    check(`storey ${storey}: each claim names the stamp it grew from`,
      grown.rooms.every(room => stamps.some(x => x.id === room.stampId)),
      grown.rooms.map(r => r.stampId).join(','));
  });
  // A silent client's program must grow too — that is the bone-at-any-rung
  // promise reaching all the way through to geometry.
  const quiet = G.program(G.startState({ outline: box, levelIds: [3, 5] }, 1));
  const groundFloor = quiet.stamps.filter(x => x.storey === 1).map(x => ({
    id: x.id, base: x.base, x: x.x, z: x.z,
    ...(x.companionOf != null ? { companionOf: x.companionOf } : {}),
  }));
  const grownQuiet = R.growRooms({ points: ring, stamps: groundFloor });
  check('a program nobody answered still grows a real floor',
    grownQuiet.rooms.length > 0, `rooms=${grownQuiet.rooms.length}`);
}

console.log(`gruff interview harness: ${pass} checks passed, ${fails.length} failed`);
fails.forEach(line => console.log('  FAIL ' + line));
process.exitCode = fails.length ? 1 : 0;
