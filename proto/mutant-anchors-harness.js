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
const tableAfter = (src, decl) => {
  const start = src.indexOf(decl);
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
  const table = tableAfter(src, 'const MUTANTS = [');
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

// ── AND THE TABLES THE ENGINES CARRY, WHICH THIS NEVER LOOKED AT ────────
//
// WHY THIS HALF EXISTS. On 26 Sep a COMMENT-ONLY commit -- not one stroke
// changed across ten fixtures and forty elevations -- put twenty lines of note
// between `if (!plate) return;` and the `ctx.fillStyle` under it, which is
// what garage-bearing-harness's "the strip is painted as concrete" mutant
// anchored on. CI:
//
//     !!! MUTATION DID NOT APPLY: mutation matched nothing
//     29/30 mutations caught · 1 mutation(s) never applied
//
// A MUTATION ANCHOR IS TEXT. "No ink changed" says nothing about whether the
// gate still has something to bite, so a stroke diff passes it and so does a
// plain harness run. Only `--mutate` sees it, and CI is the first thing that
// runs that -- which is the expensive gate being the first to notice, exactly
// what the half above was written to prevent. It could not: `files` globs
// *-mutants.js, so the twenty-two ENGINES and their tables had never been
// anchor-checked at all.
//
// THE ENTRIES ARE A DIFFERENT SHAPE, which is why it is a second pass rather
// than another glob. A *-mutants.js row is a plain object, {name, find, with};
// an engine's row is a PAIR, ['label', s => s.replace('find', 'with')]. There
// is no `find` key to read.
//
// SO LIVENESS IS ASKED BY APPLICATION, not by parsing: run the row's own
// function over the subject and see whether anything moved. That is the same
// question the runner asks ("mutation matched nothing -- it would prove
// nothing") and it needs no opinion about how the row is written -- chained
// replaces, a regex find, a helper: if the text comes back identical the
// anchor is dead, whatever its shape.
//
// AMBIGUITY STILL NEEDS THE LITERAL, and that is best-effort: the find string
// is pulled out of the function's own source. Where it cannot be parsed the
// check is SKIPPED AND SAID SO rather than passed -- the reason "exactly once"
// matters is in the note above, and a silent skip would be the same lie this
// file refuses.
const engineFiles = fs.readdirSync(__dirname)
  .filter(n => n.endsWith('-harness.js') && n !== path.basename(__filename))
  .filter(n => fs.readFileSync(path.join(__dirname, n), 'utf8').includes('const MUTATIONS = ['))
  .sort();

// An engine names its subject `SRC`, reached either from __dirname or from a
// ROOT it defined itself. Two spellings, one meaning.
const engineSubject = src => {
  const m = src.match(/const SRC = path\.join\(__dirname, '\.\.', '([\w.\-/]+)'\)/)
    || src.match(/const SRC = path\.join\(ROOT, '([\w.\-/]+)'\)/);
  return m ? m[1] : null;
};

// Every string literal handed to a .replace() in the row's source. Quotes and
// escapes are JS's own, so each is evaluated rather than unescaped by hand.
// ── AND A MUTATION MAY MEAN EVERY COPY, ON PURPOSE ──────────────────────
//
// "Exactly once" is the right rule for `.replace(string, ...)` because that
// call rewrites THE FIRST MATCH ONLY -- the note above this pass has the
// reasoning. It is the WRONG rule for a rule that genuinely lives twice.
//
// project-page.js carries the roof's heel arithmetic in two places, the
// house's section and the detached garage's, byte for byte the same three
// lines. Aiming a mutation at one copy leaves the other ungated and picks
// which by counting lines; aiming it at BOTH is what "break this rule and
// see that something notices" actually means there.
//
// `.split(find).join(with)` says that, and says it in the code rather than
// in a comment: it rewrites every occurrence, so "takes the first" does not
// apply and more than one match is the intent. The find is still read, and
// still has to occur AT ALL -- a dead anchor is a dead anchor either way.
const REPLACE_LIT = /\.replace\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)\s*,/g;
const SPLIT_LIT = /\.split\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)\s*\)\s*\.join\(/g;
//
// AND NOT A .replace() THAT BUILDS THE FIND ITSELF. premade-plans writes its
// anchors with `-s` where an apostrophe goes and restores it in place:
//
//     s.replace('pt(houseRight, tieZ),  // down the house-s right wall'
//       .replace('-s', "'s"), 'pt(houseRight, houseFront),')
//
// -- so the INNER call's first argument is `-s`, which occurs twelve times in
// premade-plans.js, four of them in comments. Read naively this harness
// reported a twelve-match ambiguity on an anchor that is not an anchor, which
// is the checker crying wolf about its own parsing.
//
// THE RECEIVER TELLS THEM APART. A mutation's replace is applied to the
// SOURCE -- `s.replace(`, or another replace's result, `).replace(` -- and a
// string-building one is applied to a LITERAL, so the character before the
// dot is a quote. One look back over the whitespace separates them.
const buildsItsOwnFind = (src, dot) => {
  let i = dot - 1;
  while (i >= 0 && /\s/.test(src[i])) i -= 1;
  return i >= 0 && (src[i] === "'" || src[i] === '"' || src[i] === '`');
};
const findsIn = fnSrc => {
  const out = [];
  [[REPLACE_LIT, true], [SPLIT_LIT, false]].forEach(([re, once]) => {
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(fnSrc)) !== null) {
      if (buildsItsOwnFind(fnSrc, m.index)) continue;
      try {
        // eslint-disable-next-line no-new-func
        const lit = new Function(`return ${m[1]};`)();
        if (typeof lit === 'string' && lit) out.push({ find: lit, once });
      } catch { /* unparseable: the caller reports the gap */ }
    }
  });
  return out;
};

let engineChecked = 0;
const uncovered = [];

for (const name of engineFiles) {
  const src = fs.readFileSync(path.join(__dirname, name), 'utf8');
  const table = tableAfter(src, 'const MUTATIONS = [');
  if (!table) { failures.push(`${name}: 'const MUTATIONS = [' found but its table could not be sliced`); continue; }

  const subject = engineSubject(src);
  if (!subject) {
    // NOT A FAILURE, AND NOT SILENT. Three engines mutate a LIST of subjects
    // rather than one file; applying a row needs to know which, and guessing
    // would be the ambiguity this file refuses. Named here so the coverage
    // this harness reports is the coverage it has.
    uncovered.push(`${name}: no single 'const SRC = path.join(...)' subject`);
    continue;
  }

  let rows;
  try {
    // eslint-disable-next-line no-new-func
    rows = new Function(`return ${table};`)();
  } catch (err) {
    failures.push(`${name}: its MUTATIONS table could not be read (${err.message})`);
    continue;
  }
  if (!Array.isArray(rows) || !rows.length) {
    failures.push(`${name}: MUTATIONS read as empty -- a table with no rows passes every check`);
    continue;
  }

  let text;
  try { text = read(subject); }
  catch { failures.push(`${name}: subject ${subject} does not exist`); continue; }

  rows.forEach((row, index) => {
    const label = `${name} [${index}] ${(Array.isArray(row) && row[0]) || '(unnamed)'}`;
    const fn = Array.isArray(row) ? row[1] : null;
    if (typeof fn !== 'function') { failures.push(`${label}: row carries no mutate function`); return; }

    engineChecked += 1;
    let after;
    try { after = fn(text); }
    catch (err) {
      // ── A ROW THAT CLOSES OVER ITS FILE IS THIS CHECKER'S LIMIT ──────
      //
      // Several of premade-plans' rows build their find from a const declared
      // beside the table (ROOM_RETURN, GARAGE_TIE_DECL). The table's SOURCE is
      // evaluated here, not the module, so those names are not in scope and
      // applying the row throws. That says nothing about the row: inside its
      // own harness it has its closure and works.
      //
      // NOT COVERED, THEN, AND SAID SO. Calling it a failure would be this
      // file crying wolf about its own blind spot, and passing it silently
      // would be the lie it exists to refuse.
      if (err instanceof ReferenceError) {
        uncovered.push(`${label}: closes over a const beside its table (${err.message}) -- cannot be applied standalone`);
        return;
      }
      failures.push(`${label}: mutating threw (${err.message})`);
      return;
    }
    if (typeof after !== 'string') { failures.push(`${label}: mutate returned ${typeof after}, not source`); return; }
    if (after === text) {
      failures.push(`${label}: ANCHOR DEAD -- applying it to ${subject} changes nothing`);
      return;
    }

    const finds = findsIn(String(fn));
    if (!finds.length) {
      uncovered.push(`${label}: live, but its find string could not be read for the exactly-once check`);
      return;
    }
    // DEDUPED: a row that chains two replaces on the same anchor would say it
    // twice, and one anchor is one finding.
    const seenFind = new Set();
    finds.forEach(({ find, once }) => {
      if (seenFind.has(find)) return;
      seenFind.add(find);
      const hits = text.split(find).length - 1;
      if (once && hits > 1) {
        failures.push(`${label}: ANCHOR AMBIGUOUS -- ${hits} matches in ${subject}; replace() takes the first`);
      }
    });
  });
}

// A run that checked nothing is the failure this file exists to refuse, so it
// is stated rather than passing quietly on an empty list.
if (!checked) {
  failures.push('no anchors were checked at all -- the tables were found but held nothing');
}
if (!engineChecked) {
  failures.push('no ENGINE anchors were checked -- the 22 tables carrying them went unread');
}

failures.forEach(f => console.log(`  FAIL  ${f}`));
uncovered.forEach(u => console.log(`  ----  ${u}`));
console.log(`\nmutant anchors: ${checked} checked across ${files.length} mutant files, `
  + `${engineChecked} across ${engineFiles.length} engines, `
  + `${uncovered.length} not covered, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
