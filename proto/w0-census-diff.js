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

// IDENTITY, NOT REFERENCE. Not every dimension is a list of strings —
// `spreads` holds objects, and two separate JSON.parse calls give those
// distinct identities, so a naive Set comparison reported all 21 as both
// added and removed when a file was diffed against ITSELF. Caught by testing
// the tool on an identical pair; it would otherwise have cried "serializer
// touched" on every rung until someone stopped believing it.
const label = x => {
  if (x == null) return String(x);
  if (typeof x === 'string') return x;
  if (x.name) return String(x.name);
  if (x.line != null) return `line ${x.line}${x.keys ? ` keys=${[].concat(x.keys).join('+')}` : ''}`;
  return JSON.stringify(x);
};
const names = list => new Set((list || []).map(label));
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
