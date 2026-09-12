#!/usr/bin/env node
// W0 SERIALIZER CENSUS DIFF — "this rung never touched the old serializer",
// as a measurement rather than a claim.
//
// Board Tier 3 gate duty: run proto/w0-census.js --json at main before a rung
// merges and again after, then diff the two. The answer wanted is almost always
// "nothing moved", and that is exactly the answer a broken tool gives too — so
// this one refuses to be silent. A file it cannot read, or a shape it does not
// recognise, is reported as UNREADABLE and never as "no change".
//
// Run: node proto/w0-census-diff.js before.json after.json
const fs = require('fs');

const COUNTED = ['persistedFields', 'literalKeys', 'stateKeys', 'spreads',
  'conditionalKeys', 'nestedConditionalKeys', 'componentFields',
  'transitiveOnly', 'unresolved', 'methods'];

function load(file) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); }
  catch (error) { return { error: `cannot read ${file}: ${error.message}` }; }
  let json;
  try { json = JSON.parse(raw); }
  catch (error) { return { error: `${file} is not JSON: ${error.message}` }; }
  if (!json || typeof json !== 'object' || !json.root || !Array.isArray(json.methods)) {
    return { error: `${file} is not a w0-census payload (no root/methods)` };
  }
  return { json };
}

const [beforeFile, afterFile] = process.argv.slice(2);
if (!beforeFile || !afterFile) {
  console.error('usage: node proto/w0-census-diff.js before.json after.json');
  process.exit(2);
}
const a = load(beforeFile);
const b = load(afterFile);
if (a.error || b.error) {
  console.error('CENSUS DIFF UNREADABLE — this is NOT "no change":');
  if (a.error) console.error('  ' + a.error);
  if (b.error) console.error('  ' + b.error);
  process.exit(2);
}

// IDENTITY BY KEY-SET, NOT BY LINE. Two defects, one after the other, both
// found by running the tool rather than reading it.
//
// The first: `spreads` holds objects, and two separate JSON.parse calls give
// those distinct identities, so a naive Set comparison reported all 21 as both
// added and removed when a file was diffed against ITSELF. Fixed by comparing
// a printed label instead of the object.
//
// The second is that the label was `line 26 keys=auto`. A LINE NUMBER IS NOT AN
// IDENTITY. Insert two lines anywhere above the serializer's spreads and every
// one of them re-labels, so all 21 read as added and removed again -- which is
// exactly what happened across #375, where the serializer gained two comment
// lines and the format did not move at all. The verdict was still "touched",
// truthfully but for the wrong reason, and the 21-row churn is the noise that
// teaches a reader to skip the row. An entry is now identified by WHAT IT
// WRITES: its key-set, its tier, and whether it branches. Where it sits in the
// file is not part of the format.
//
// MULTIPLICITY IS PART OF THE COUNT. Three separate spreads write `auto`. A Set
// of labels collapses them to one, so deleting two of the three would report no
// change AND a before/after size of 19 for a 21-entry list. Labels are counted,
// not deduped, and a repeated label is suffixed `#2`, `#3` so the diff names
// which occurrence went.
const label = x => {
  if (x == null) return String(x);
  if (typeof x === 'string') return x;
  if (x.name) return String(x.name);
  if (x.keys) {
    const keys = [].concat(x.keys);
    // Source order is kept rather than sorted: reordering a spread's keys is an
    // edit to the serializer, and the gate's question is whether the rung
    // touched it.
    return `${x.indent > 6 ? 'per-entity' : 'top-level'}`
      + ` ${x.branching ? 'branching' : 'optional'}`
      + ` keys=${keys.join('+') || '(none)'}`;
  }
  if (x.line != null) return `line ${x.line}`;
  return JSON.stringify(x);
};
// A counted multiset: label -> occurrences, flattened back to `label`,
// `label #2`, `label #3` so set arithmetic keeps the population.
const names = list => {
  const seen = new Map();
  const out = new Set();
  for (const item of (list || [])) {
    const base = label(item);
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    out.add(n === 1 ? base : `${base} #${n}`);
  }
  return out;
};
const rows = [];
let moved = 0;
for (const key of COUNTED) {
  const before = names(a.json[key]);
  const after = names(b.json[key]);
  const added = [...after].filter(x => !before.has(x));
  const removed = [...before].filter(x => !after.has(x));
  if (added.length || removed.length) moved += 1;
  rows.push({ key, before: before.size, after: after.size, added, removed });
}
const chars = { before: a.json.root.chars, after: b.json.root.chars };
if (chars.before !== chars.after) moved += 1;

console.log(`root serializer chars: ${chars.before} -> ${chars.after}`
  + (chars.before === chars.after ? '  (unchanged)' : `  CHANGED by ${chars.after - chars.before}`));
console.log('');
console.log('| dimension | before | after | delta |');
console.log('|---|---|---|---|');
for (const row of rows) {
  const delta = row.added.length || row.removed.length
    ? [...row.added.map(x => `+${x}`), ...row.removed.map(x => `-${x}`)].join(' ')
    : '—';
  console.log(`| \`${row.key}\` | ${row.before} | ${row.after} | ${delta} |`);
}
console.log('');
console.log(moved === 0
  ? 'VERDICT: the old serializer is untouched by this rung.'
  : `VERDICT: ${moved} dimension(s) MOVED — the rung touched the old serializer.`);
process.exit(0);
