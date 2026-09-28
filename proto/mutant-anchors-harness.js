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
// *-mutants.js, so the ENGINES and their tables had never been anchor-checked
// at all.
//
// AND GLOBBING THEM WAS ONLY THE FIRST HALF OF THAT (board #57). Seven of the
// engines hand their rows a MAP of sources rather than one file's text, and
// the pass read a subject out of a single `const SRC` -- so all seven were
// reported as uncovered and passed over, roof-pattern-harness.js among them,
// three weeks after #513 added three mutations to it. Fifty more rows across
// five other engines could not be applied at all, because the `sub` they go
// through is declared beside their table and was not in scope. Both are fixed
// below; the run went from 427 anchors checked to 596, with 16 rows left that
// edit no file's text at all and are named as such.
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
//
// AND THE TABLE IS NOT ALWAYS CALLED THAT. render-2d-harness.js writes
// `const BRANCH_MUTATIONS = [`, indented inside the block that runs it, so
// globbing on the one spelling excluded that file outright -- its sixteen
// branch mutations were not merely uncovered, they were invisible, and the
// summary line counted twenty-seven engines where there are twenty-eight.
// A checker of dead checks with a table it cannot see is the failure at the
// top of this file wearing its own clothes.
const TABLE_DECLS = ['const MUTATIONS = [', 'const BRANCH_MUTATIONS = ['];
const engineFiles = fs.readdirSync(__dirname)
  .filter(n => n.endsWith('-harness.js') && n !== path.basename(__filename))
  .filter(n => {
    const text = fs.readFileSync(path.join(__dirname, n), 'utf8');
    return TABLE_DECLS.some(d => text.includes(d));
  })
  .sort();

// ── WHERE AN ENGINE'S SUBJECT IS, AND WHY ONE NAME WAS NOT ENOUGH ───────
//
// An engine that mutates ONE file names it `SRC`, reached either from
// __dirname or from a ROOT it defined itself. Two spellings, one meaning.
const engineSubject = src => {
  const m = src.match(/const SRC = path\.join\(__dirname, '\.\.', '([\w.\-/]+)'\)/)
    || src.match(/const SRC = path\.join\(ROOT, '([\w.\-/]+)'\)/);
  return m ? m[1] : null;
};

// AND SEVEN ENGINES NAME NO `SRC` AT ALL, which is the hole this half was
// extended to close. Their claims span two or three files, so a row is handed
// a MAP of sources and says which one it means -- `sub(s, 'roof-patterns.js',
// find, with)`. Reported as "no single subject" and passed over, that shape
// left the three mutations #513 added to roof-pattern-harness.js sitting in
// its total with nothing checking their anchors, which is the state this
// harness exists to refuse: counted as coverage, checking nothing.
//
// NOTHING HAS TO BE DISCOVERED FOR IT, because the row names its own file. So
// the map handed in READS ON DEMAND: whatever name a row asks for is loaded
// off disk at that moment, and the names it never asks for cost nothing. That
// keeps this pass's one principle -- no opinion about how a row is written --
// whether the engine has one subject or five.
//
// A NAME THAT IS NO FILE IS COLLECTED RATHER THAN THROWN, because the row then
// reaches into `undefined` and the TypeError would read as a broken row
// instead of a mutation aimed at a file that is not there.
const lazySources = (missing) => new Proxy({}, {
  get(held, key) {
    if (typeof key !== 'string' || key in held) return held[key];
    try { held[key] = read(key); } catch { missing.add(key); return undefined; }
    return held[key];
  },
  getOwnPropertyDescriptor(held, key) {
    return { value: held[key], enumerable: true, configurable: true, writable: true };
  },
});

// ── AND THE HELPERS DECLARED BESIDE THE TABLE, WHICH ARE NOT OPTIONAL ───
//
// The table's SOURCE is evaluated here, not the module -- the note at the top
// of this file says why. So a row calling a helper declared beside it threw a
// ReferenceError and was reported as not covered, which was fifty of the
// fifty-two rows this file could not check. Worse, the helper it could not
// reach is usually `sub`, and `sub` is where the exactly-once rule lives: five
// engines route every row through one, and each throws unless its anchor hits
// exactly once.
//
// SO THE INERT DECLARATIONS COME WITH THE TABLE. A top-level `const` whose
// initialiser is a literal or an arrow function cannot do anything by being
// evaluated: an arrow is not run until it is called, and a literal is a value.
// Those are swept up in source order and evaluated ahead of the table, so a
// row runs with its own `sub`, its own `F`, its own ROOM_RETURN.
//
// AND NOTHING ELSE IS, on purpose. `const baseline = run(load(null));` is the
// one line this file must never execute, and anything reaching `require`, `fs`
// or `__dirname` is the same hazard wearing a different hat. The rule is the
// initialiser's SHAPE, not a guess about what a call does -- and a declaration
// that is inert by shape yet still throws when evaluated is dropped as well,
// by evaluating them one at a time and keeping the ones that hold.
const INERT = /^\s*(?:[`'"]|-?\d|Object\.freeze\(\s*[[{]|[[{]|\([^()]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/;
const IMPURE = /require\(|\bfs\.|\bprocess\b|__dirname|__filename/;

// The declaration's own text, to its terminating `;` at depth zero. Strings
// and comments are stepped over for the reason the table walker gives.
const statementAt = (src, start) => {
  let depth = 0, inStr = null, esc = false;
  for (let i = start; i < src.length; i += 1) {
    const c = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) return null; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i); if (i < 0) return null; i += 1; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') depth -= 1;
    else if (c === ';' && depth === 0) return src.slice(start, i + 1);
  }
  return null;
};

// INDENTED DECLARATIONS COUNT, because render-2d-harness declares its sixteen
// mutate functions inside the block that holds its table. A declaration nested
// in a function usually reaches that function's parameters, so it throws when
// evaluated on its own and is dropped by the same one-at-a-time test; the ones
// that hold are the ones the rows need. Names are taken once: two `const`s of
// one name in a prelude is a SyntaxError that would cost the whole table.
const preludeOf = src => {
  const out = [];
  const taken = new Set();
  const re = /^[ \t]*const ([A-Za-z_$][\w$]*) = /gm;
  let m;
  while ((m = re.exec(src)) !== null) {
    if (taken.has(m[1])) continue;
    if (!INERT.test(src.slice(m.index + m[0].length))) continue;
    const decl = statementAt(src, m.index + m[0].indexOf('const'));
    if (!decl || IMPURE.test(decl)) continue;
    try {
      // eslint-disable-next-line no-new-func
      new Function(`${out.map(o => o.decl).join('\n')}\n${decl}\nreturn 0;`)();
    } catch { continue; }
    taken.add(m[1]);
    out.push({ name: m[1], decl });
  }
  return out;
};

// The table, and the helper scope it was evaluated in. `FILES` out of that
// scope is how a [label, key, fn] row's key becomes a path.
const evalWithPrelude = (prelude, table) => {
  const names = [...new Set(prelude.map(p => p.name))];
  // eslint-disable-next-line no-new-func
  return new Function(`${prelude.map(p => p.decl).join('\n')}\n`
    + `return { rows: ${table}, scope: { ${names.join(', ')} } };`)();
};

// AN ENGINE MAY CARRY THE EXACTLY-ONCE RULE ITSELF, and five do: every row
// goes through a `sub` that counts the hits and refuses unless there is one.
// Applying the row RUNS that guard, so asking the same question again by
// parsing the find out of the row's source would be a second, weaker copy of
// a check already made -- and a noisy one, since `sub(s, F, find, with)` is
// not a `.replace()` call and the parser below cannot read it.
const selfGuards = src => /const sub = [\s\S]{0,600}?hits !== 1/.test(src);

// Each top-level element of the table, as its own source text. String(fn) is
// no use once a row is BUILT by a helper -- `editing('PROJECT.html', ...)`
// stringifies to the helper's inner arrow, not to the row as written -- and
// the file such a row names is in its source and nowhere else.
const rowSources = table => {
  const out = [];
  let depth = 0, inStr = null, esc = false, start = -1;
  for (let i = 0; i < table.length; i += 1) {
    const c = table[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '/' && table[i + 1] === '/') { i = table.indexOf('\n', i); if (i < 0) break; continue; }
    if (c === '/' && table[i + 1] === '*') { i = table.indexOf('*/', i); if (i < 0) break; i += 1; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '(' || c === '[' || c === '{') {
      depth += 1;
      if (depth === 2 && start < 0) start = i;
    } else if (c === ')' || c === ']' || c === '}') {
      depth -= 1;
      if (depth === 1 && start >= 0) { out.push(table.slice(start, i + 1)); start = -1; }
    }
  }
  return out;
};


// Every find handed to a .replace() in the row's source. Quotes and escapes
// are JS's own, so each is evaluated rather than unescaped by hand.
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
//
// THE FIND IS AN EXPRESSION, NOT A LITERAL, and reading only literals was the
// biggest hole in this pass: twenty-two rows reported "its find string could
// not be read" because they write their anchor as a concatenation over four
// lines, or name a const beside the table (premade-plans' ROOM_RETURN). Both
// are strings by the time the row runs, so the argument's TEXT is sliced to
// the call's own comma and evaluated -- in the helper scope the table was
// evaluated in, which is where ROOM_RETURN lives. A first argument that is a
// regex, or that reaches the row's own parameter, evaluates to no string and
// is reported as the gap it is.
const ARG_AT = (src, open) => {
  let depth = 0, inStr = null, esc = false;
  for (let i = open; i < src.length; i += 1) {
    const c = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') {
      depth -= 1;
      if (depth === 0) return { expr: src.slice(open + 1, i), end: i };
    } else if (c === ',' && depth === 1) return { expr: src.slice(open + 1, i), end: null };
  }
  return null;
};
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
const findsIn = (fnSrc, scope = {}) => {
  const out = [];
  const names = Object.keys(scope).filter(n => /^[A-Za-z_$][\w$]*$/.test(n));
  const vals = names.map(n => scope[n]);
  const evaluate = expr => {
    try {
      // eslint-disable-next-line no-new-func
      return new Function(...names, `return (${expr});`)(...vals);
    } catch { return null; }
  };
  [['.replace(', true], ['.split(', false]].forEach(([call, once]) => {
    let at = fnSrc.indexOf(call);
    for (; at >= 0; at = fnSrc.indexOf(call, at + 1)) {
      if (buildsItsOwnFind(fnSrc, at)) continue;
      const arg = ARG_AT(fnSrc, at + call.length - 1);
      if (!arg) continue;
      // `.split(x).join(` is the every-copy spelling; a bare .split() is not a
      // mutation at all and its argument is no anchor.
      if (!once) {
        if (arg.end === null) continue;
        if (!/^\s*\.join\(/.test(fnSrc.slice(arg.end + 1))) continue;
      }
      const lit = evaluate(arg.expr);
      if (typeof lit === 'string' && lit) out.push({ find: lit, once });
      // A REGEX FIND IS STILL A FIND. render-2d's last two rows spell theirs
      // `/ctx\.strokeStyle = env\.columnColor;/`, and a regex that matches
      // nothing is as dead as a string that occurs nowhere. `g` is the
      // every-copy spelling here, the way .split().join() is for a string, so
      // it carries the same exemption from exactly-once.
      else if (lit instanceof RegExp) out.push({ find: lit, once: once && !lit.flags.includes('g') });
    }
  });
  return out;
};

// One anchor, one count, whichever shape it was written in.
const hitsOf = (text, find) => {
  if (typeof find === 'string') return text.split(find).length - 1;
  const flags = find.flags.includes('g') ? find.flags : `${find.flags}g`;
  return (text.match(new RegExp(find.source, flags)) || []).length;
};

let engineChecked = 0;
const uncovered = [];

// ── AND WHEN A ROW CANNOT BE APPLIED, IT IS STILL READ ──────────────────
//
// skinned-page's rows are BUILT: `editing('PROJECT.html', s => ...)` hands back
// a thunk that swaps the harness's own reader for the length of one run, so
// there is no subject to apply it to and no running it without the module. Its
// anchors are text all the same, and they rot all the same.
//
// So the row's SOURCE is read instead: the files it names, and the finds handed
// to the .replace() calls inside it. THIS IS THE WEAKER OF THE TWO CHECKS and
// it is used only here, because liveness by application needs no opinion about
// how a row is written and liveness by parsing needs both a find it can read
// and a file it can name.
//
// AND IT WILL NOT GUESS WHICH FILE. A row may name two -- one as its subject,
// one inside the anchor (`<script src="./palette.js">`) -- so the subject is
// the candidate that holds every find. Where no candidate does and there is
// only one, that one is the subject and the anchor is dead; where there are
// several, the row is reported as not covered rather than failed against a
// file picked by counting. A checker crying wolf about its own parsing is the
// thing the -s note further up was written about.
const FILEISH = /['"]([\w.\-/]+\.(?:js|html|css|json|md))['"]/g;

let livenessOnly = 0;

const staticCheck = (label, text, scope, why) => {
  const finds = findsIn(text, scope);
  const names = [...new Set([...text.matchAll(FILEISH)].map(m => m[1]))];
  const bodies = new Map();
  for (const n of names) {
    try { bodies.set(n, read(n)); } catch { /* not a subject of this repo */ }
  }
  if (!finds.length || !bodies.size) {
    uncovered.push(`${label}: ${why}, and it edits no file's text `
      + '-- there is no anchor to read instead');
    return;
  }

  const holdsAll = [...bodies.keys()].filter(n => finds.every(f => hitsOf(bodies.get(n), f.find)));
  const file = holdsAll.length === 1 ? holdsAll[0]
    : (bodies.size === 1 ? [...bodies.keys()][0] : null);
  if (!file) {
    uncovered.push(`${label}: ${why}, and its source names ${bodies.size} readable files `
      + `(${[...bodies.keys()].join(', ')}) -- which one its anchors are aimed at cannot be told apart`);
    return;
  }

  engineChecked += 1;
  livenessOnly += 1;
  const body = bodies.get(file);
  const seen = new Set();
  finds.forEach(({ find }) => {
    if (seen.has(String(find))) return;
    seen.add(String(find));
    if (!hitsOf(body, find)) failures.push(`${label}: ANCHOR DEAD -- not found in ${file}`);
  });
};

for (const name of engineFiles) {
  const src = fs.readFileSync(path.join(__dirname, name), 'utf8');
  const decl = TABLE_DECLS.find(d => src.includes(d));
  const table = tableAfter(src, decl);
  if (!table) { failures.push(`${name}: '${decl}' found but its table could not be sliced`); continue; }

  let built;
  try { built = evalWithPrelude(preludeOf(src), table); }
  catch (err) {
    failures.push(`${name}: its MUTATIONS table could not be read (${err.message})`);
    continue;
  }
  const rows = built.rows;
  if (!Array.isArray(rows) || !rows.length) {
    failures.push(`${name}: MUTATIONS read as empty -- a table with no rows passes every check`);
    continue;
  }

  const single = engineSubject(src);
  const named = built.scope.FILES;
  const rowSrc = rowSources(table);
  const guarded = selfGuards(src);

  let singleText = null;
  if (single) {
    try { singleText = read(single); }
    catch { failures.push(`${name}: subject ${single} does not exist`); continue; }
  }

  rows.forEach((row, index) => {
    const label = `${name} [${index}] ${(Array.isArray(row) && row[0]) || '(unnamed)'}`;
    const text = rowSrc[index] || String(row && row[1]);
    const fn = Array.isArray(row) ? row.find(v => typeof v === 'function') : null;
    if (typeof fn !== 'function') { failures.push(`${label}: row carries no mutate function`); return; }

    // THREE SHAPES, ONE QUESTION. A row is handed the one subject's text, or
    // one file NAMED BY KEY beside its label ([label, 'modelHtml', fn], the
    // key being a FILES entry), or a map it reads by name.
    const keyed = row.length > 2 && typeof row[1] === 'string' ? row[1] : null;
    let subject = single;
    let before = singleText;
    if (keyed) {
      subject = (named && named[keyed]) || keyed;
      try { before = read(subject); }
      catch {
        failures.push(`${label}: names ${JSON.stringify(keyed)}, which is neither a file nor a FILES entry`);
        return;
      }
    } else if (!single) {
      subject = null;
      before = null;
    }

    const missing = new Set();
    if (before === null) before = lazySources(missing);

    let after, thrown = null;
    try { after = fn(before); } catch (err) { thrown = err; }

    if (thrown) {
      if (missing.size) {
        engineChecked += 1;
        failures.push(`${label}: target ${[...missing].join(', ')} does not exist`);
        return;
      }
      // ── A ROW THAT NEEDS ITS MODULE IS THIS CHECKER'S LIMIT ───────────
      //
      // The inert declarations come along (see the note above the sweep), but
      // a row reaching a `let` the harness reassigns, or a function declared
      // with `function`, is reaching something this file will not evaluate.
      // That says nothing about the row: inside its own harness it has its
      // closure and works. So the row's source is read instead, and only when
      // that finds nothing is the row reported as not covered.
      if (thrown instanceof ReferenceError || thrown instanceof TypeError) {
        staticCheck(label, text, built.scope, `cannot be applied standalone (${thrown.message})`);
        return;
      }
      engineChecked += 1;
      if (guarded) {
        // The engine's own sub refusing the anchor IS the finding: its message
        // carries the hit count and the file, so it is passed straight on.
        failures.push(`${label}: ANCHOR BAD -- the engine's own guard refused it: ${thrown.message}`);
      } else {
        failures.push(`${label}: mutating threw (${thrown.message})`);
      }
      return;
    }

    let subjectText = null;
    if (typeof after === 'string') {
      engineChecked += 1;
      if (after === before) {
        failures.push(`${label}: ANCHOR DEAD -- applying it to ${subject} changes nothing`);
        return;
      }
      subjectText = before;
    } else if (after && typeof after === 'object') {
      const touched = Object.keys(after);
      const moved = touched.filter(file => {
        let orig;
        try { orig = read(file); } catch { return false; }
        return after[file] !== orig;
      });
      engineChecked += 1;
      if (!moved.length) {
        failures.push(`${label}: ANCHOR DEAD -- applying it to ${
          touched.join(', ') || 'its subjects'} changes nothing`);
        return;
      }
      subject = moved.join(', ');
      if (moved.length === 1) subjectText = read(moved[0]);
    } else {
      // A thunk, or a mapping swap: the row edits through the harness rather
      // than handing back source. Read it instead of scoring it.
      staticCheck(label, text, built.scope, `its mutate returned ${typeof after}, not source`);
      return;
    }

    // The exactly-once question, for the engines that do not already answer it
    // themselves. `guarded` is the note by selfGuards.
    if (guarded) return;
    const finds = findsIn(String(fn), built.scope);
    if (!finds.length) {
      uncovered.push(`${label}: live, but its find string could not be read for the exactly-once check`);
      return;
    }
    if (subjectText === null) {
      uncovered.push(`${label}: live, but it moves ${subject} at once -- `
        + 'the exactly-once check has no single subject to count in');
      return;
    }
    // DEDUPED: a row that chains two replaces on the same anchor would say it
    // twice, and one anchor is one finding.
    const seenFind = new Set();
    finds.forEach(({ find, once }) => {
      if (seenFind.has(String(find))) return;
      seenFind.add(String(find));
      const hits = hitsOf(subjectText, find);
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
  failures.push('no ENGINE anchors were checked -- the tables carrying them went unread');
}

failures.forEach(f => console.log(`  FAIL  ${f}`));
uncovered.forEach(u => console.log(`  ----  ${u}`));
console.log(`\nmutant anchors: ${checked} checked across ${files.length} mutant files, `
  + `${engineChecked} across ${engineFiles.length} engines `
  + `(${livenessOnly} of them for liveness only), `
  + `${uncovered.length} not covered, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
