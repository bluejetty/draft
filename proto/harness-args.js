// Shared argument handling for the harnesses in this directory.
//
// Three files carried a byte-identical copy of this, which is where
// duplication stops being duplication. It is small, but the thing it does is
// easy to get subtly wrong and expensive when it is: a harness that silently
// accepts --mutate and runs plain mode prints a green result for a mode that
// never ran. That is the defect the guard exists to prevent, occurring in the
// guard itself, and it happened here once already -- the two harnesses grew
// two names for one mode and a loop over proto/*.js ran half of them in the
// wrong one without saying so.
//
// LOADED WITH require(), DELIBERATELY, and this is the one file in proto/ that
// must be. The harnesses evaluate their SUBJECT from source text precisely so
// a mutant can be applied to it; a mutation engine able to mutate its own
// argument parser could silently disable itself and still print a table.
// Nothing here is under test, so nothing here should be reachable by the
// tests. If a later harness source-loads this file, that is the bug.
//
// The filename comes from process.argv[1], NOT __filename. Inside this module
// __filename is harness-args.js, so a naive lift would have every harness
// print the wrong name in its usage line -- on the error path, which is the
// one path a passing run never exercises. Measured before relying on it.
const path = require('path');

const FLAGS = new Set(['--coverage', '--mutate']);
const NO_FLAGS = new Set();

// Exits 2 on anything outside `accepted` -- distinct from 1, which means the
// checks failed. A CI step that cannot tell "you typed it wrong" from "the
// code is broken" will eventually report the first as the second, and someone
// will go looking for a defect in a passing harness.
function reject(argv, accepted) {
  const unknown = argv.filter(a => !accepted.has(a));
  if (unknown.length) {
    console.error(`unknown argument(s): ${unknown.join(', ')}`);
    const usage = accepted.size ? ` [${[...accepted].join('|')}]` : ' (takes no arguments)';
    console.error(`usage: node ${path.basename(process.argv[1])}${usage}`);
    process.exit(2);
  }
}

// True when the caller should run its mutation/coverage mode. Both spellings
// work in every harness that HAS one, so a loop is correct whichever the
// author types.
function mutationMode(argv = process.argv.slice(2)) {
  reject(argv, FLAGS);
  return argv.some(a => FLAGS.has(a));
}

// For a harness with NO mutation mode. It accepts nothing at all, and that is
// the point: calling mutationMode() there would accept --mutate, hand back a
// true the harness has no code to act on, and print a green run for a mode
// that does not exist. That is the same absence-that-looks-like-a-pass one
// layer in from the hole this module was written to close, so the distinction
// is load-bearing rather than tidy.
function noFlags(argv = process.argv.slice(2)) {
  reject(argv, NO_FLAGS);
}

// For a harness that takes ONE OPTIONAL POSITIONAL -- a file to check -- and
// no flags. It cannot use noFlags(), which would reject the file, and it
// cannot read process.argv[2] first: that is what elevation-harness.js did,
// so `--mutate` was consumed AS A FILENAME and the run died on ENOENT --
// exit 1, "the checks failed", for what was a usage error. The ORDER here is
// the point. Flags are rejected before the positional is looked at, so a
// flag never reaches the code that treats argv as a path.
//
// Anything starting with '-' is a flag. That rules out a file whose name
// begins with a hyphen, and that is accepted: no harness input is named that
// way, and a rule with an exception is the kind of guard this file exists to
// not have.
function optionalPositional(argv = process.argv.slice(2)) {
  const flags = argv.filter(a => a.startsWith('-'));
  const rest = argv.filter(a => !a.startsWith('-'));
  const problem = flags.length ? `unknown argument(s): ${flags.join(', ')}`
    : rest.length > 1 ? `expected at most one argument, got ${rest.length}: ${rest.join(', ')}`
    : null;
  if (problem) {
    console.error(problem);
    console.error(`usage: node ${path.basename(process.argv[1])} [file]`);
    process.exit(2);
  }
  return rest[0];
}

module.exports = { FLAGS, mutationMode, noFlags, optionalPositional };
