#!/usr/bin/env node
// THE FIRST-RUN CEREMONY — the offline harness.
//
//   node proto/first-run-harness.js
//
// ── THE TWO RULES THIS FILE EXISTS TO PROTECT ───────────────────────────
//
//   NEVER MORE THAN ONE QUESTION ON SCREEN.
//   EVERY STAGE IS SKIPPABLE.
//
// (Movie, 1 Sep.) Both are the kind of rule that survives a first build and
// dies quietly in the third, when someone adds "while we are here, how many
// bathrooms?" to a screen that already asks something, or makes one stage the
// exception that has to be answered. Written down here so that costs a test.

// No mutation mode here, so this harness accepts no arguments at all. It
// used to read none: `node first-run-harness.js --mutate` printed a full
// passing run and exited 0, having mutated nothing. noFlags(), not
// mutationMode() -- the latter would accept --mutate and print green for a
// mode that does not exist.
require('./harness-args.js').noFlags();

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
global.window = {};
['gruff-interview.js', 'first-run.js']
  .forEach(file => { (0, eval)(fs.readFileSync(path.join(ROOT, file), 'utf8')); });
const F = window.DraftFirstRun;
const G = window.DraftGruffInterview;

let passed = 0;
const failures = [];
const check = (name, condition, detail) => {
  if (condition) { passed += 1; return; }
  failures.push(detail ? `${name}\n      ${detail}` : name);
};

// Walk the ceremony the way a person would.
const run = (...steps) => steps.reduce((state, action) => F.advance(state, action), F.start());

// ── 1 · ONE QUESTION, AND ONLY ONE ───────────────────────────────────────
{
  const stages = [F.start(), run({}), run({}, { bedrooms: 3 }), run({}, { bedrooms: 3 }, { way: 'bone' })];
  const asking = stages.filter(state => F.asking(state));
  check('exactly one stage of the ceremony asks anything',
    asking.length === 1 && asking[0].stage === F.STAGE.ASK,
    stages.map(s => `${s.stage}:${F.asking(s)}`).join(' '));

  // And it is the question that moves the most house. A beginner who has never
  // drawn a plan has an opinion about bedrooms and usually none about storeys,
  // which is why this is the rung taken rather than the ladder's first.
  check('and the one question is bedrooms', F.QUESTION.id === 'bedrooms');
  check('which is on the drive-thru\'s own critical ladder',
    G.CRITICAL_LADDER.includes(F.QUESTION.id), G.CRITICAL_LADDER.join(','));
}

// ── 2 · EVERY STAGE IS SKIPPABLE, AND SKIPPING COSTS NOTHING ─────────────
{
  check('every stage before the end has a way past it',
    [F.start(), run({}), run({}, { bedrooms: 3 })].every(state => F.skippable(state)));
  check('and the end is not a stage to escape',
    !F.skippable(run({}, { bedrooms: 3 }, { way: 'bone' })));

  // THE NUMBER A SKIP LANDS ON IS THE ENGINE'S, NOT THIS FILE'S. A skipped
  // question and a bone press have to produce the same house, or skipping
  // quietly costs a room -- and the only way to be sure of that is to read the
  // default rather than restate it.
  const skipped = run({}, { skip: true });
  check('a skipped question takes the bone\'s own default',
    skipped.bedrooms === G.DEFAULTS.bedrooms, `${skipped.bedrooms} vs ${G.DEFAULTS.bedrooms}`);
  check('and the ceremony holds no number of its own to drift from it',
    F.QUESTION.fallback === G.DEFAULTS.bedrooms);
  check('a skip is recorded rather than pretended away',
    skipped.skipped.includes(F.STAGE.ASK), JSON.stringify(skipped.skipped));

  // Skipping the CHOICE is not choosing nothing: the drafting tools have been
  // on screen the whole time, so the ceremony simply gets out of the way.
  const noWay = run({}, { skip: true }, { skip: true });
  check('skipping the choice ends the ceremony rather than blocking on it',
    noWay.stage === F.STAGE.DONE && noWay.way === null, JSON.stringify(noWay));
  check('and Gruff still says where the tools are',
    /tools are on the left/i.test(F.line(noWay)), F.line(noWay));
}

// ── 3 · THE THREE WAYS IN, INCLUDING THE ONE THAT IS NOT BUILT ──────────
{
  check('three ways in, and they are the ladder', F.WAYS.length === 3
    && F.WAYS.map(way => way.id).join(',') === 'bone,rabbit,turtle');

  // RABBIT IS OFFERED THOUGH IT IS NOT BUILT. The ladder is the thing being
  // explained, and a rung missing from it teaches the wrong shape -- but a
  // press says so plainly rather than answering with nothing.
  check('the unbuilt rung is still shown', F.wayFor('rabbit') !== null);
  check('and is marked unbuilt rather than quietly working',
    F.wayFor('rabbit').ready === false && typeof F.wayFor('rabbit').soon === 'string');
  const pressed = F.advance(run({}, { bedrooms: 3 }), { way: 'rabbit' });
  check('pressing it does not move the ceremony on',
    pressed.stage === F.STAGE.CHOOSE && pressed.way == null, JSON.stringify(pressed));
  check('while the two that are built do',
    F.advance(run({}, { bedrooms: 3 }), { way: 'bone' }).stage === F.STAGE.DONE
      && F.advance(run({}, { bedrooms: 3 }), { way: 'turtle' }).stage === F.STAGE.DONE);
}

// ── 4 · WHAT WAS MADE, AND THE NEXT STAGE UP ────────────────────────────
// The last thing Gruff does is name what happened and offer the rung above --
// so the ladder keeps going instead of ending at whichever one they took.
{
  const bone = run({}, { bedrooms: 4 }, { way: 'bone' });
  check('after the bone he names the house that was made',
    /4-bedroom house/.test(F.line(bone)), F.line(bone));
  check('and points at the next thing to touch',
    /tabs/i.test(F.line(bone)), F.line(bone));

  const turtle = run({}, { bedrooms: 4 }, { way: 'turtle' });
  check('after the turtle he offers the rung above it',
    /bone/i.test(F.line(turtle)), F.line(turtle));

  check('the choice screen reflects the answer back',
    /4 bedrooms/.test(F.line(run({}, { bedrooms: 4 }))), F.line(run({}, { bedrooms: 4 })));
}

// ── 5 · The answer is taken as given, within reason ─────────────────────
{
  check('a number is kept', run({}, { bedrooms: 5 }).bedrooms === 5);
  check('nonsense falls back rather than making a nonsense house',
    run({}, { bedrooms: 'lots' }).bedrooms === G.DEFAULTS.bedrooms);
  // Clamped rather than refused: refusing would be a second question, and
  // there is only ever one.
  check('and a wild number is clamped, never argued with',
    run({}, { bedrooms: 99 }).bedrooms === F.QUESTION.most
      && run({}, { bedrooms: 0 }).bedrooms === F.QUESTION.least);
}

// ── Report ───────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`\n  ${failures.length} FAILED, ${passed} passed\n`);
  failures.forEach(name => console.error(`   ✘ ${name}`));
  console.error('');
  process.exit(1);
}
console.log(`\n  ${passed} checks passed\n`);
