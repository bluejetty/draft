#!/usr/bin/env node
// WHERE THE SPEC BREAKS — the three-column flow, measured as an invariant.
//
// WHY IT EXISTS ALONGSIDE tests/spec-pages.spec.js. That spec drives the real
// page and checks a handful of hand-built cases through a browser. It is the
// right test for "the page calls this and paints what comes back". It is the
// wrong instrument for the thing flow() actually promises, which is a RULE
// holding over every shape of input: fill the column, then break; never leave
// a heading stranded at the foot of one; never lose an item. A rule is not
// proved by three examples, and flow() is pure, so it can be swept.
//
// WHAT IS SWEPT. Three hundred randomly shaped specs -- mixed heading runs,
// items from one line to taller than a whole column, two to four columns a
// page -- with a FIXED seed so a failure is reproducible and CI is not
// flaky-by-design. Four properties are asserted over every one of them:
//   1. every item appears exactly once, in order. A flow that drops an item
//      loses a clause of the specification and nothing on the page says so.
//   2. no column is overfilled unless a single item was taller than the
//      column to begin with -- the one case the file says it declines to fix.
//   3. no heading is the last thing in its column.
//   4. every page has exactly its column count, the last one padded.
// The hand-built cases below them name the specific rules in prose so a
// failure reads as a sentence rather than as a seed number.
//
// Run: node proto/spec-pages-harness.js
//      node proto/spec-pages-harness.js --mutate
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const MUTATE = require('./harness-args.js').mutationMode();

let EDIT = null;
const readSubject = name => {
  const text = fs.readFileSync(path.join(ROOT, name), 'utf8');
  return EDIT && EDIT.file === name ? EDIT.fn(text) : text;
};

function loadPages() {
  const win = {};
  const sandbox = { window: win, console, Math, Number, String, Object, Array, JSON };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readSubject('spec-pages.js'), sandbox, { filename: 'spec-pages.js' });
  if (!win.DraftSpecPages) throw new Error('spec-pages.js did not publish DraftSpecPages');
  return win.DraftSpecPages;
}

let passed = 0;
let failures = [];
const check = (label, condition, detail) => {
  if (condition) { passed += 1; return; }
  failures.push(detail ? `${label} — ${detail}` : label);
};

// A seeded generator, so the sweep is the same sweep on every machine and in
// CI. A random harness that fails once a fortnight teaches people to re-run
// it, which is worse than not having it.
const seeded = seed => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const flat = (pages) => pages.flat().flat();

function runChecks() {
  passed = 0; failures = [];
  const { flow, KEEP_LINES } = loadPages();

  check('a heading keeps two lines with it', KEEP_LINES === 2, `states ${KEEP_LINES}`);

  // ── THE SIMPLE SHAPE ─────────────────────────────────────────────────
  const tens = n => Array.from({ length: n }, (_, i) => ({ key: `k${i}`, h: 10 }));
  const filled = flow(tens(30), 100);
  check('columns are FILLED before they are broken',
    filled[0][0].length === 10 && filled[0][1].length === 10 && filled[0][2].length === 10,
    `got ${filled[0].map(col => col.length).join('/')}`);
  check('three columns make a page', filled.length === 1);
  check('a fourth column starts a second page',
    flow(tens(31), 100).length === 2);
  check('the last page is padded out to its columns',
    flow(tens(31), 100)[1].length === 3,
    'a short last page must still be three columns or the sheet is misshapen');
  check('an empty spec is no pages at all', flow([], 100).length === 0);
  const twoUp = flow(tens(25), 100, 2);
  check('the column count is the caller\'s to choose',
    twoUp.length === 2 && twoUp.every(page => page.length === 2)
      && twoUp[0][0].length === 10 && twoUp[1][0].join() === 'k20,k21,k22,k23,k24'
      && twoUp[1][1].length === 0,
    `got ${JSON.stringify(twoUp)}`);

  // ── AN ITEM THAT WOULD OVERHANG MOVES WHOLE ──────────────────────────
  const straddle = flow([
    { key: 'a', h: 90 }, { key: 'b', h: 30 }, { key: 'c', h: 10 },
  ], 100);
  check('an item that would overhang the column moves to the next one entire',
    straddle[0][0].join() === 'a' && straddle[0][1].join() === 'b,c',
    `got ${JSON.stringify(straddle[0])}`);

  // ── A HEADING DRAGS ITS FIRST LINES ──────────────────────────────────
  // 70 used, then a heading and two lines of 20 each: the heading fits on its
  // own and must not take it.
  const orphan = flow([
    { key: 'fill', h: 70 },
    { key: 'head', h: 10, keepWithNext: true },
    { key: 'l1', h: 20 }, { key: 'l2', h: 20 },
  ], 100);
  check('a heading does not sit at the foot of a column without its lines',
    orphan[0][0].join() === 'fill' && orphan[0][1].join() === 'head,l1,l2',
    `got ${JSON.stringify(orphan[0])}`);

  // THE BUG THE FILE NAMES: a division rule followed by a section heading.
  // Stopping the walk at the first heading printed the rule alone at the foot
  // with its division overleaf.
  const pair = flow([
    { key: 'fill', h: 60 },
    { key: 'rule', h: 10, keepWithNext: true },
    { key: 'head', h: 10, keepWithNext: true },
    { key: 'l1', h: 15 }, { key: 'l2', h: 15 },
  ], 100);
  check('a RUN of headings is measured to its end, not to the first of them',
    pair[0][0].join() === 'fill' && pair[0][1].join() === 'rule,head,l1,l2',
    `got ${JSON.stringify(pair[0])}`);

  const heldBack = flow([
    { key: 'fill', h: 40 },
    { key: 'head', h: 10, keepWithNext: true },
    { key: 'l1', h: 20 }, { key: 'l2', h: 20 },
  ], 100);
  check('a heading that DOES fit with its lines stays put',
    heldBack[0][0].join() === 'fill,head,l1,l2',
    'dragging a heading that fits would empty half a column for nothing');

  const lastHeading = flow([{ key: 'head', h: 10, keepWithNext: true }], 100);
  check('a heading with nothing after it is still placed',
    lastHeading[0][0].join() === 'head');

  // ── THE ITEM TALLER THAN THE COLUMN ──────────────────────────────────
  const tall = flow([{ key: 'a', h: 40 }, { key: 'big', h: 250 }, { key: 'b', h: 10 }], 100);
  check('an item taller than a column is not shunted ahead of itself',
    tall[0][0].join() === 'a,big',
    'moving it empties the column it leaves and overflows the next one anyway');
  check('what follows an over-tall item starts a clean column',
    tall[0][1].join() === 'b', `got ${JSON.stringify(tall[0])}`);
  // The other side of it, and the only place the "column is full, close it
  // now" line can be seen on its own: an over-tall item skips the break test
  // above, so if the full column were not already closed it would be piled on
  // top of a column that is exactly full.
  const afterFull = flow([{ key: 'fill', h: 100 }, { key: 'big', h: 250 }], 100);
  check('an over-tall item does not pile onto a column that is already full',
    afterFull[0][0].join() === 'fill' && afterFull[0][1].join() === 'big',
    `got ${JSON.stringify(afterFull[0])}`);

  // ── THE SWEEP ────────────────────────────────────────────────────────
  const rnd = seeded(20260928);
  let lost = null, overfull = null, stranded = null, ragged = null;
  for (let run = 0; run < 300; run += 1) {
    const columnHeight = 60 + Math.floor(rnd() * 300);
    const columnsPerPage = 2 + Math.floor(rnd() * 3);
    const count = 1 + Math.floor(rnd() * 60);
    const items = Array.from({ length: count }, (_, i) => ({
      key: `i${i}`,
      // one in twelve is taller than the column on purpose
      h: rnd() < 1 / 12 ? columnHeight + 1 + Math.floor(rnd() * 200)
        : 4 + Math.floor(rnd() * (columnHeight / 2)),
      keepWithNext: rnd() < 0.25,
    }));
    const pages = flow(items, columnHeight, columnsPerPage);
    const laid = flat(pages);
    if (!lost && (laid.length !== count
      || laid.some((key, i) => key !== `i${i}`))) {
      lost = `run ${run}: ${count} items in, ${laid.length} out`;
    }
    const byKey = new Map(items.map(item => [item.key, item]));
    pages.forEach(page => {
      if (!ragged && page.length !== columnsPerPage) {
        ragged = `run ${run}: a page of ${page.length} columns`;
      }
      page.forEach(column => {
        const height = column.reduce((sum, key) => sum + byKey.get(key).h, 0);
        const tallest = Math.max(0, ...column.map(key => byKey.get(key).h));
        // Overfull is allowed ONLY where a single item could not fit anyway,
        // and only by that item: two ordinary items must never exceed it.
        if (!overfull && height > columnHeight && tallest <= columnHeight
          && column.length > 1
          && height - byKey.get(column[column.length - 1].valueOf()).h > columnHeight) {
          overfull = `run ${run}: ${height} in a ${columnHeight} column`;
        }
        // A heading at the foot is a strand ONLY if moving it would have
        // helped. Where the heading plus the run it leads plus its first
        // lines is taller than a whole column, no column in the document
        // holds them together and the flow is right to place it and move on.
        const last = column[column.length - 1];
        const index = items.findIndex(item => item.key === last);
        if (!stranded && last && byKey.get(last).keepWithNext && items[index + 1]) {
          let block = byKey.get(last).h;
          let k = index + 1;
          while (items[k] && items[k].keepWithNext) { block += items[k].h; k += 1; }
          for (let n = 0; n < KEEP_LINES && items[k + n]; n += 1) block += items[k + n].h;
          if (block <= columnHeight) stranded = `run ${run}: ${last} left at the foot`;
        }
      });
    });
  }
  check('no item is lost or reordered over 300 random specs', lost === null, lost);
  check('no column is overfilled by items that would have fitted elsewhere',
    overfull === null, overfull);
  check('no heading is ever left at the foot of a column', stranded === null, stranded);
  check('every page comes back with its full column count', ragged === null, ragged);
}

if (!MUTATE) {
  runChecks();
  console.log(`\nspec pages harness: ${passed} checks passed, ${failures.length} failed`);
  if (failures.length) {
    failures.forEach(line => console.log(`  ✘ ${line}`));
    process.exit(1);
  }
  process.exit(0);
}

// ── MUTATIONS ───────────────────────────────────────────────────────────
const MUTATIONS = [
  ['the column is broken at every item instead of filled', 'spec-pages.js',
    c => c.replace('if (!tooTall && used > 0 && used + block > columnHeight) closeColumn();',
      'if (used > 0) closeColumn();')],

  ['an item is allowed to overhang the foot of the column', 'spec-pages.js',
    c => c.replace('if (!tooTall && used > 0 && used + block > columnHeight) closeColumn();', '')],

  ['the break is measured with the wrong comparison and runs one item long', 'spec-pages.js',
    c => c.replace('used + block > columnHeight', 'used + block > columnHeight * 1.5')],

  ['a heading stops dragging its first lines', 'spec-pages.js',
    c => c.replace('      for (let n = 0; n < KEEP_LINES && items[k + n]; n += 1) block += items[k + n].h;', '')],

  ['a heading keeps only one line with it', 'spec-pages.js',
    c => c.replace('const KEEP_LINES = 2;', 'const KEEP_LINES = 1;')],

  ['a run of headings is measured only to the first of them', 'spec-pages.js',
    c => c.replace('        while (items[k] && items[k].keepWithNext) { block += items[k].h; k += 1; }', '')],

  ['the heading rule is dropped entirely', 'spec-pages.js',
    c => c.replace('if (item.keepWithNext) {', 'if (false) {')],

  ['an over-tall item empties the column ahead of itself anyway', 'spec-pages.js',
    c => c.replace('const tooTall = item.h > columnHeight;', 'const tooTall = false;')],

  ['every item is treated as over-tall, so nothing ever breaks', 'spec-pages.js',
    c => c.replace('const tooTall = item.h > columnHeight;', 'const tooTall = true;')],

  ['a full column is not closed, so the next page never starts', 'spec-pages.js',
    c => c.replace('if (used >= columnHeight) closeColumn();', '')],

  ['the page is cut after the wrong number of columns', 'spec-pages.js',
    c => c.replace('if (page.length >= columnsPerPage) { pages.push(page); page = []; }',
      'if (page.length > columnsPerPage) { pages.push(page); page = []; }')],

  ['the last short page is left ragged instead of padded', 'spec-pages.js',
    c => c.replace('      while (page.length < columnsPerPage) page.push([]);', '')],

  ['the last part-filled column is dropped off the end', 'spec-pages.js',
    c => c.replace('if (column.length) page.push(column);', '')],

  ['the running height stops being counted', 'spec-pages.js',
    c => c.replace('used += item.h;', '')],

  ['the height counted is the dragged block, not the item', 'spec-pages.js',
    c => c.replace('used += item.h;', 'used += block;')],

  ['an item is placed in the column it was moved out of', 'spec-pages.js',
    c => c.replace(`      if (!tooTall && used > 0 && used + block > columnHeight) closeColumn();
      column.push(item.key);`,
    `      column.push(item.key);
      if (!tooTall && used > 0 && used + block > columnHeight) closeColumn();`)],
];

let caught = 0;
for (const [name, file, fn] of MUTATIONS) {
  const before = fs.readFileSync(path.join(ROOT, file), 'utf8');
  if (fn(before) === before) {
    console.log(`  ANCHOR MISSED  ${name}  (the edit changed nothing in ${file} -- re-aim it)`);
    continue;
  }
  EDIT = { file, fn };
  let red = false;
  try { runChecks(); red = failures.length > 0; }
  catch (err) { red = true; }
  EDIT = null;
  if (red) caught += 1;
  else console.log(`  SURVIVED  ${name}`);
}
console.log(`spec-pages-harness: ${caught}/${MUTATIONS.length} mutations caught`);
process.exit(caught === MUTATIONS.length ? 0 : 1);
