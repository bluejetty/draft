#!/usr/bin/env node
// THE PAGE'S SCRIPT PARTS HOLD TOGETHER (stage 2 of the split, Movie, 24
// Oct: "how can we reduce the MODEL.html size in a nice organized way").
//
// MODEL.html's one script was cut at its section headings into model/*.js,
// loaded in order as classic scripts that share one scope. What that buys
// is only safe while three things stay true, and this says each one:
//   - every part MODEL.html names is on disk, parses on its own, and every
//     part on disk is one the page loads (no orphan, no gap);
//   - no top-level name is declared in two parts -- shared scope means a
//     second `const x` is a page that will not load;
//   - the parts load in their numbered order, the order they were cut in.
//
//   node proto/model-parts-harness.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { modelPageParts } = require('./model-page-source.js');

const ROOT = path.join(__dirname, '..');
let failed = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failed += 1;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

const loaded = modelPageParts(ROOT).slice(1);
const onDisk = fs.readdirSync(path.join(ROOT, 'model')).filter(f => f.endsWith('.js')).map(f => `model/${f}`).sort();
check('MODEL.html loads its script parts', loaded.length >= 10, `${loaded.length} parts`);
check('every part on disk is loaded, and every loaded part is on disk',
  JSON.stringify([...loaded].sort()) === JSON.stringify(onDisk),
  `loaded ${loaded.length}, on disk ${onDisk.length}`);
check('they load in their numbered order', JSON.stringify(loaded) === JSON.stringify([...loaded].sort()));

const seen = new Map();
const twice = [];
loaded.forEach(rel => {
  const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  let parses = true, why = '';
  try { new vm.Script(text, { filename: rel }); } catch (e) { parses = false; why = e.message; }
  check(`${rel} parses on its own`, parses, why);
  for (const m of text.matchAll(/^ {2}(?:const|let|var|(?:async )?function|class) ([A-Za-z_$][\w$]*)/gm)) {
    if (seen.has(m[1])) twice.push(`${m[1]} (${seen.get(m[1])} and ${rel})`);
    else seen.set(m[1], rel);
  }
});
check('no top-level name is declared in two parts', twice.length === 0, twice.slice(0, 5).join(', '));
check('and the scan found the names it guards', seen.size > 1000, `${seen.size} names`);

console.log(`\nmodel parts harness: ${failed ? `${failed} FAILED` : 'all checks passed'}`);
process.exit(failed ? 1 : 0);
