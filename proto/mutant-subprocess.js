#!/usr/bin/env node
// RUNNING A MUTANT AS ITS OWN PROCESS — for the harnesses that paint at load.
//
// Most mutation tables in proto/ re-enter their own checks in-process: the
// subject is read fresh per mutant and the checks run again. The two painter
// harnesses on this bench cannot do that. fascia-end and foundation-face
// build ONE vm sandbox, run cut-view.js into it, and paint six drawings
// against it as the file loads; there is no seam to hand a second cut-view.js
// through, and re-running the file in-process would re-use the first sandbox.
//
// SO THE PARENT BENDS THE SOURCE AND A CHILD READS IT. The mutated text goes
// to a JSON file, the child is the same harness with the same arguments, and
// harness-env.js's loader prefers what it finds there -- see
// DRAFT_HARNESS_SOURCE_OVERRIDES at the head of that file. The child's exit
// code is the answer: nonzero is a mutant caught, zero is one that survived.
//
// A ROW THAT EDITS NOTHING IS NOT A PASS. An anchor that has drifted off its
// line would otherwise print a clean run and count as caught, which is the
// silence this whole piece of work is about, so it is called out and left
// uncounted.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// label   what to print the tally under
// rows    [name, file, fn] -- fn takes the file's text and returns it bent
// opts    { root, harness, args, preload }
//
// preload: true for a harness that reads its subject with require() or
// readFileSync rather than through harness-env.js -- mutant-preload.js then
// serves the bent text to both. See that file for why.
function runMutations(label, rows, opts) {
  const { root, harness, args = [], preload = false } = opts;
  const node = preload ? ['-r', path.join(__dirname, 'mutant-preload.js')] : [];
  // A HARNESS THAT IS ALREADY RED KILLS EVERY ROW, and the tally reads 100%
  // while measuring nothing. Found 1 Oct: a check written wrong failed the
  // clean run of fixture-kinds-harness and its table still printed 7/7. So
  // the harness runs once unbent first, and a red one refuses the table.
  const clean = spawnSync(process.execPath, [...node, harness, ...args], { encoding: 'utf8' });
  if (clean.status !== 0) {
    console.log(`${label}: REFUSED -- the harness fails with nothing mutated, so every row would read as caught.`);
    console.log((clean.stdout || '').trim().split('\n').slice(-8).map(line => `      ${line}`).join('\n'));
    return false;
  }
  let caught = 0;
  rows.forEach(([name, file, fn]) => {
    const before = fs.readFileSync(path.join(root, file), 'utf8');
    const after = fn(before);
    if (after === before) {
      console.log(`  ANCHOR MISSED  ${name}  (nothing changed in ${file} -- re-aim it)`);
      return;
    }
    const at = path.join(os.tmpdir(), `${label}-mutant-${process.pid}.json`);
    fs.writeFileSync(at, JSON.stringify({ [file]: after }));
    const run = spawnSync(process.execPath, [...node, harness, ...args], {
      encoding: 'utf8',
      env: { ...process.env, DRAFT_HARNESS_SOURCE_OVERRIDES: at },
    });
    fs.unlinkSync(at);
    // EXIT 3 IS NEITHER. harness-env.js uses it when the mutated source
    // itself would not load, which proves nothing about the checks -- see
    // the note at that catch. Counting it as caught is how a row whose
    // anchor has rotted into a syntax error would go on looking green.
    if (run.status === 3) {
      console.log(`  DID NOT LOAD  ${name}  (${(run.stderr || '').trim().split('\n')[0]})`);
      return;
    }
    if (run.status !== 0) caught += 1;
    else console.log(`  SURVIVED  ${name}`);
  });
  console.log(`${label}: ${caught}/${rows.length} mutations caught`);
  return caught === rows.length;
}

module.exports = { runMutations };
