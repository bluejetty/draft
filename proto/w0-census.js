// W0 SERIALIZER CENSUS -- MODEL.dc.html's _serializeDrawing, tallied.
//
// Ordered by Commander Devin, 6 Sep, as the groundwork for W1. The prose lives
// in RD-DOCUMENTS/W0-serializer-census.md; this is the tool that produced its
// numbers, committed so the next hand can RE-RUN the census instead of
// trusting the document. A census nobody can re-run looks exactly the same
// whether it is current or a year stale, which is the failure this repo has
// spent a week removing from its prose.
//
//   node proto/w0-census.js          the summary counts, as quoted in the doc
//   node proto/w0-census.js --json   the full index, for diffing two revisions
//
// NOT A HARNESS, deliberately, and the filename says so. CI globs
// 'proto/*-harness.js' (.github/workflows/test.yml:112) -- the hyphenated
// suffix is the membership test, so this file is outside that loop by
// construction and the harness count is unchanged. It asserts nothing and
// exits 0 whatever it finds; a census reports, a harness judges.
//
// Read-only: opens MODEL.dc.html and tests/persisted-format.spec.js, writes
// nothing.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MODEL = path.join(ROOT, 'MODEL.dc.html');
const SPEC = path.join(ROOT, 'tests', 'persisted-format.spec.js');
const src = fs.readFileSync(MODEL, 'utf8');
const lines = src.split('\n');

// --- brace matcher --------------------------------------------------------
// Skips strings, template literals (including ${} nesting), line and block
// comments, and regex literals. A naive depth count is wrong here for a
// concrete reason: this serializer builds objects inside template strings and
// a '}' in one of them would close the function early, silently shortening
// every count below.
function bodyFrom(offset) {
  let i = offset;
  while (src[i] !== '{') i++;
  const open = i;
  let depth = 0;
  const prevSig = () => { let j = i - 1; while (j >= 0 && /\s/.test(src[j])) j--; return src[j]; };
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '"' || c === "'") { const q = c; i++; while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; } i++; continue; }
    if (c === '`') {
      i++;
      while (i < src.length && src[i] !== '`') {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '$' && src[i + 1] === '{') { let d = 1; i += 2; while (i < src.length && d > 0) { if (src[i] === '{') d++; else if (src[i] === '}') d--; i++; } continue; }
        i++;
      }
      i++; continue;
    }
    if (c === '/') {
      const p = prevSig();
      if (p && !/[\w)\]]/.test(p)) {
        i++; let cls = false;
        while (i < src.length) {
          if (src[i] === '\\') { i += 2; continue; }
          if (src[i] === '[') cls = true;
          else if (src[i] === ']') cls = false;
          else if (src[i] === '/' && !cls) { i++; break; }
          else if (src[i] === '\n') break;
          i++;
        }
        continue;
      }
    }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
    i++;
  }
  return { open, end: i, text: src.slice(open, i) };
}
const lineOf = off => src.slice(0, off).split('\n').length;

// --- class methods, by name -----------------------------------------------
// Two-space indent is the class-member column in MODEL.dc.html. Control-flow
// keywords sit at that column too and are excluded by name.
const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'else', 'do']);
const methodAt = {};
{
  let off = 0;
  for (let n = 0; n < lines.length; n++) {
    const m = lines[n].match(/^  ([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/);
    if (m && !KEYWORDS.has(m[1]) && !(m[1] in methodAt)) methodAt[m[1]] = { off, line: n + 1 };
    off += lines[n].length + 1;
  }
}

// --- transitive walk from the root ----------------------------------------
const ROOT_METHOD = '_serializeDrawing';
const idents = t => new Set((t.match(/this\.[A-Za-z_$][A-Za-z0-9_$]*/g) || []).map(s => s.slice(5)));
const callees = t => new Set((t.match(/this\.[A-Za-z_$][A-Za-z0-9_$]*\s*\(/g) || [])
  .map(s => s.slice(5).replace(/\s*\($/, '')));

const walked = new Map();
const unresolved = [];
const queue = [ROOT_METHOD];
while (queue.length) {
  const name = queue.shift();
  if (walked.has(name)) continue;
  const at = methodAt[name];
  if (!at) { unresolved.push(name); walked.set(name, null); continue; }
  const b = bodyFrom(at.off);
  // The signature carries default-parameter expressions -- _roofHeelIn and
  // _stairEndFor both read this.state there, OUTSIDE the braces. Counting only
  // the body would miss them.
  const sig = src.slice(at.off, b.open);
  const whole = b.text + sig;
  walked.set(name, {
    line: at.line,
    endLine: lineOf(b.end - 1),
    chars: b.end - b.open,
    refs: idents(whole),
    calls: callees(whole),
    stateKeys: new Set((whole.match(/this\.state\.[A-Za-z_$][A-Za-z0-9_$]*/g) || []).map(s => s.slice(11))),
    bareState: (whole.match(/this\.state(?![.A-Za-z0-9_$])/g) || []).length,
    nonArrow: (b.text.match(/\bfunction\b/g) || []).length,
  });
  for (const c of walked.get(name).calls) if (!walked.has(c)) queue.push(c);
}
const methods = [...walked].filter(([, v]) => v);
const byName = Object.fromEntries(methods);

// --- output surface --------------------------------------------------------
const rootBody = bodyFrom(methodAt[ROOT_METHOD].off).text;
const literalKeys = [...new Set((rootBody.match(/^ {6}[A-Za-z_$][A-Za-z0-9_$]*:/gm) || [])
  .map(s => s.trim().slice(0, -1)))].sort();
// Conditional spreads, by paren scan rather than regex. Three earlier regex
// attempts each gave a different count, which is the tell: six of these spreads
// wrap onto a second line, so the key sits nowhere near the `...(`, and
// `[...(outline.overriddenSrcIds || [])]` is an array spread that looks like
// one from the outside. Scanning to the matching paren is the only reading
// that does not depend on how the source happens to be wrapped.
//
// Two kinds live here and they are different hazards. An OPTIONAL key has an
// empty alternate -- `: {})` -- so it is present or absent. A BRANCHING spread
// has two non-empty alternates and writes a different SHAPE either way: a
// wall-hosted electric device writes wallId/offset/side, a point-hosted one
// writes `at`. Absence is not the question there; which shape arrived is.
function conditionalSpreads() {
  const out = [];
  const re = /(^|[^.\[])\.\.\.\(/gm;
  let m;
  while ((m = re.exec(rootBody))) {
    const openParen = m.index + m[0].length - 1;
    let i = openParen, depth = 0;
    while (i < rootBody.length) {
      const c = rootBody[i];
      if (c === '(') depth++;
      else if (c === ')') { depth--; if (!depth) break; }
      i++;
    }
    const text = rootBody.slice(openParen, i + 1);
    if (!text.includes('?')) continue;              // not a conditional
    const lineStart = rootBody.lastIndexOf('\n', m.index) + 1;
    const indent = rootBody.slice(lineStart).match(/^ */)[0].length;
    const alternates = [...text.matchAll(/[?:]\s*\{([^}]*)\}/g)].map(a => a[1].trim());
    const keys = alternates.filter(Boolean)
      .flatMap(a => [...a.matchAll(/(^|,)\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g)].map(k => k[2]));
    out.push({
      indent,
      line: rootBody.slice(0, m.index).split('\n').length,
      branching: alternates.length > 1 && alternates.every(Boolean),
      keys,
    });
  }
  return out;
}
const spreads = conditionalSpreads();
const conditionalKeys = [...new Set(spreads.filter(s => s.indent === 6).flatMap(s => s.keys))];
const perEntity = spreads.filter(s => s.indent > 6);
// The branching site is excluded here on purpose: its keys are not optional,
// and its nested `at: { x, y, z }` would otherwise leak inner-object names
// into a list that is supposed to mean 'sometimes absent'.
const nestedConditionalKeys = [...new Set(
  perEntity.filter(s => !s.branching).flatMap(s => s.keys))].sort();
const branchingSites = spreads.filter(s => s.branching);

// --- the spec's declared key list -----------------------------------------
const specSrc = fs.readFileSync(SPEC, 'utf8');
const declared = [...specSrc.split('const PERSISTED_KEYS = [')[1].split('];')[0]
  .matchAll(/'([A-Za-z0-9_$]+)'/g)].map(m => m[1]);
const declaredSet = new Set(declared);
const literalSet = new Set(literalKeys);

// --- classification --------------------------------------------------------
// A field is "persisted" if the serializer itself reads it; anything reached
// only through the accessors and never written is component state.
const methodNames = new Set(methods.map(([n]) => n));
const allRefs = new Map();
for (const [n, r] of methods) for (const id of r.refs) {
  if (id === 'state') continue;
  if (!allRefs.has(id)) allRefs.set(id, new Set());
  allRefs.get(id).add(n);
}
const fields = [...allRefs].filter(([id]) => !methodNames.has(id));
const persistedFields = new Set(fields.filter(([, ms]) => ms.has(ROOT_METHOD)).map(([id]) => id));
const componentFields = fields.filter(([id]) => !persistedFields.has(id)).map(([id]) => id).sort();

const memo = {};
function closure(name, seen = new Set()) {
  if (memo[name]) return memo[name];
  if (seen.has(name) || !byName[name]) return { state: new Set(), fields: new Set() };
  seen.add(name);
  const m = byName[name];
  const state = new Set(m.stateKeys);
  const flds = new Set([...m.refs].filter(r => allRefs.has(r) && !methodNames.has(r)));
  for (const c of m.calls) {
    const r = closure(c, seen);
    for (const x of r.state) state.add(x);
    for (const x of r.fields) flds.add(x);
  }
  return (memo[name] = { state, fields: flds });
}
const buckets = { pure: [], 'impure-input': [], 'component-only': [] };
const needs = {};
for (const [name] of methods) {
  if (name === ROOT_METHOD) continue;
  const c = closure(name);
  const badState = [...c.state].filter(k => !declaredSet.has(k)).sort();
  const badFields = [...c.fields].filter(f => !persistedFields.has(f)).sort();
  const bucket = badFields.length ? 'component-only' : (badState.length ? 'impure-input' : 'pure');
  buckets[bucket].push(name);
  needs[name] = [...badState.map(s => `state.${s}`), ...badFields];
}

// --- report ----------------------------------------------------------------
const allState = new Set();
for (const [, r] of methods) for (const k of r.stateKeys) allState.add(k);
const rootState = byName[ROOT_METHOD].stateKeys;
const transitiveOnly = [...allState].filter(k => !rootState.has(k)).sort();
const root = byName[ROOT_METHOD];

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({
    root: { line: root.line, endLine: root.endLine, chars: root.chars },
    methods: methods.map(([n, r]) => ({ name: n, line: r.line, endLine: r.endLine,
      lines: r.endLine - r.line + 1, calls: [...r.calls].sort(), bucket:
        n === ROOT_METHOD ? 'root' : Object.keys(buckets).find(b => buckets[b].includes(n)),
      needs: needs[n] || [] })),
    unresolved, literalKeys, conditionalKeys, nestedConditionalKeys, spreads,
    stateKeys: [...allState].sort(), transitiveOnly, componentFields,
    persistedFields: [...persistedFields].sort(),
  }, null, 2));
  process.exit(0);
}

const say = (label, value) => console.log(`  ${String(label).padEnd(42)} ${value}`);
console.log(`\n_serializeDrawing  MODEL.dc.html:${root.line}-${root.endLine}  ${root.chars} chars\n`);
say('methods in the transitive closure', methods.length);
say('calls that are not class methods', unresolved.length ? unresolved.join(' ') : 0);
say('distinct this.<ident>', allRefs.size + 1 /* state */);
say('non-arrow functions in any body', methods.reduce((a, [, r]) => a + r.nonArrow, 0));
say('bare this.state (spread/destructure/index)', methods.reduce((a, [, r]) => a + r.bareState, 0));
console.log();
say('state keys reachable', allState.size);
say('  read directly by the serializer', rootState.size);
say('  reached only through accessors', `${transitiveOnly.length}  ${transitiveOnly.join(' ')}`);
console.log();
say('top-level keys written, literal', literalKeys.length);
say('top-level keys written, conditional', `${conditionalKeys.length}  ${conditionalKeys.join(' ')}`);
say('per-entity conditional spread sites', perEntity.length);
say('  distinct optional key names', `${nestedConditionalKeys.length}  ${nestedConditionalKeys.join(' ')}`);
say('  branching (shape differs, not presence)', branchingSites.length
  ? branchingSites.map(b => `line ${b.line}: ${b.keys.join('/')}`).join('; ') : 0);
say('PERSISTED_KEYS declared by the spec', declared.length);
say('  written but not declared', literalKeys.filter(k => !declaredSet.has(k)).join(' ') || '(none)');
say('  declared but not written', declared.filter(k => !literalSet.has(k)).join(' ') || '(none)');
console.log();
say('pure', `${buckets.pure.length}  ${buckets.pure.join(' ')}`);
say('impure-input', `${buckets['impure-input'].length}  ${buckets['impure-input'].join(' ')}`);
say('component-only', `${buckets['component-only'].length}  ${buckets['component-only'].join(' ')}`);
console.log();
say('fields the serializer reads (persisted)', persistedFields.size);
say('fields reached but never written', componentFields.length);
for (const f of componentFields) console.log(`      ${f}`);
console.log();
for (const [name, need] of Object.entries(needs)) {
  if (need.length) console.log(`  ${name.padEnd(26)} needs  ${need.join(' ')}`);
}
console.log();
