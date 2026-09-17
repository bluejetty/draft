// EVERY MUTATION'S ANCHOR STILL POINTS AT SOMETHING -- and at exactly one
// thing.
//
// WHY THIS EXISTS. On 17 Sep a sweep of proto/*-mutants.js found SIXTEEN
// mutations, across eight of the sixteen files, whose `find` string no longer
// occurred in its subject. Each printed
//
//     SKIPPED (anchor not found): <name>
//
// and carried on. None of them had been checking anything for weeks. They had
// not been noticed because CI's harness job globs proto/*-harness.js and has
// never run a *-mutants.js file at all, so the only thing that could have said
// so was a person running them by hand.
//
// That is the house rule turned on the gates themselves: a check whose broken
// state looks like its passing state is not a check. A mutation with a dead
// anchor is worse than no mutation, because it is COUNTED -- it sits in the
// file's total looking like coverage.
//
// WHAT THIS CHECKS, AND WHAT IT DELIBERATELY DOES NOT. It reads the mutation
// tables as DATA and asks three questions that need no browser:
//
//   1. does every `find` occur in its subject AT ALL?      (the rot above)
//   2. does it occur EXACTLY ONCE?                          (see below)
//   3. does `with` actually differ from `find`?             (a no-op mutant)
//
// It does NOT run the mutations. That is the *-mutants.js files' own job and
// it costs real Playwright runs; this is the cheap guard that belongs on every
// push, so that the expensive one is never the first to notice.
//
// WHY "EXACTLY ONCE" AND NOT "AT LEAST ONCE". The runners use
// String.replace(find, with), which rewrites THE FIRST MATCH ONLY. An anchor
// that matches twice mutates whichever copy comes first in the file -- quite
// possibly not the branch the mutation is named for -- and still reports a
// clean KILLED or SURVIVED. That is the same class of lie as a dead anchor,
// arriving by the opposite route, and it is invisible in the runner's output.
//
// THE FOURTH CHECK, AND WHY IT IS HERE. Each runner passes `test` to Playwright
// as -g. A grep that matches no test makes Playwright exit non-zero, which the
// runners read as 'failed' and therefore score as KILLED -- a mutation marked
// caught by a run that executed no tests. One such pair was found on 17 Sep
// (tool-assembly's 'clicking one member takes the whole assembly', whose test
// had been deleted along with the behaviour). Its anchor happened to be dead
// too, so it never got that far; had only the test gone, the file would have
// reported a clean kill forever. So: every `test` grep must still match a title
// in the spec that runner drives.
//
// HOW THE TABLES ARE READ. All sixteen files declare `const MUTANTS = [...]`
// of plain object literals, so the array's source text is sliced out and
// evaluated. It is NOT require()d: these files run their sweep on load, and a
// checker that executed its subjects would take an hour and rewrite the tree.
// A file whose table cannot be read is a FAILURE here, never a skip -- the one
// outcome this harness exists to refuse is "nothing to report".
const fs = require('fs');
const path = require('path');
require('./harness-args.js').noFlags();

const ROOT = path.resolve(__dirname, '..');
const files = fs.readdirSync(__dirname)
  .filter(n => n.endsWith('-mutants.js')).sort();

const failures = [];
let checked = 0;

// The array literal, sliced by bracket depth rather than by regex: several
// tables contain ']' inside their strings (`welds: [[wall.id]]`), so a lazy
// match to the first ']' would truncate the table and silently check a prefix.
//
// COMMENTS ARE SKIPPED, and that is not a nicety. Every table in this
// directory is commented in prose, and prose has apostrophes -- "the page's
// own", "don't". Without this the walker reads the ' in a comment as the start
// of a string, never finds its close, runs off the end of the file and
// reports NO TABLE. Measured: that is exactly what it did to toy-bone and
// toy-roof on the first run of this harness, which is a fitting way for a
// checker of dead checks to fail.
const mutantsTable = src => {
  const start = src.indexOf('const MUTANTS = [');
  if (start < 0) return null;
  const open = src.indexOf('[', start);
  let i = open, depth = 0, inStr = null, esc = false;
  for (; i < src.length; i += 1) {
    const c = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i); if (i < 0) break; i += 1; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '[') depth += 1;
    else if (c === ']') { depth -= 1; if (depth === 0) return src.slice(open, i + 1); }
  }
  return null;
};

// A file-level subject, for the two tables whose entries carry no `file`.
const fileLevelSubject = src => {
  const m = src.match(/const (?:PATH|SRC|SUBJECT|TARGET) = [`'"]?\$\{ROOT\}\/([\w.\-/]+)/)
    || src.match(/const (?:PATH|SRC|SUBJECT|TARGET) = path\.join\(__dirname, '\.\.', '([\w.\-/]+)'/);
  return m ? m[1] : null;
};

// The spec a runner drives, for the -g check.
const specOf = src => {
  const m = src.match(/playwright test (tests\/[\w.\-]+\.spec\.js)/);
  return m ? m[1] : null;
};

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

for (const name of files) {
  const src = fs.readFileSync(path.join(__dirname, name), 'utf8');
  const table = mutantsTable(src);
  if (!table) { failures.push(`${name}: no 'const MUTANTS = [...]' table found`); continue; }

  let mutants;
  try {
    // eslint-disable-next-line no-new-func
    mutants = new Function(`return ${table};`)();
  } catch (err) {
    failures.push(`${name}: its MUTANTS table could not be read (${err.message})`);
    continue;
  }
  if (!Array.isArray(mutants) || !mutants.length) {
    failures.push(`${name}: MUTANTS read as empty -- a table with no rows passes every check`);
    continue;
  }

  const fallback = fileLevelSubject(src);
  const spec = specOf(src);
  let specText = null;
  if (spec) {
    try { specText = read(spec); }
    catch { failures.push(`${name}: drives ${spec}, which does not exist`); }
  }

  mutants.forEach((m, index) => {
    const label = `${name} [${index}] ${m.name || '(unnamed)'}`;
    const subject = m.file || fallback;
    if (!subject) { failures.push(`${label}: no target file (no 'file' key and no file-level subject)`); return; }
    if (typeof m.find !== 'string' || !m.find) { failures.push(`${label}: no 'find' string`); return; }

    let text;
    try { text = read(subject); }
    catch { failures.push(`${label}: target ${subject} does not exist`); return; }

    checked += 1;
    const hits = text.split(m.find).length - 1;
    if (hits === 0) failures.push(`${label}: ANCHOR DEAD -- not found in ${subject}`);
    else if (hits > 1) failures.push(`${label}: ANCHOR AMBIGUOUS -- ${hits} matches in ${subject}; replace() takes the first`);

    if (typeof m.with === 'string' && m.with === m.find) {
      failures.push(`${label}: 'with' is identical to 'find' -- the mutation changes nothing`);
    }
    if (specText && typeof m.test === 'string' && m.test && !specText.includes(m.test)) {
      failures.push(`${label}: test grep ${JSON.stringify(m.test)} matches no title in ${spec}`
        + ' -- playwright would run NOTHING and exit non-zero, scoring this mutation as KILLED');
    }
  });
}

// A run that checked nothing is the failure this file exists to refuse, so it
// is stated rather than passing quietly on an empty list.
if (!checked) {
  failures.push('no anchors were checked at all -- the tables were found but held nothing');
}

failures.forEach(f => console.log(`  FAIL  ${f}`));
console.log(`\nmutant anchors: ${checked} checked across ${files.length} files, `
  + `${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
