#!/usr/bin/env node
// THE ENTRY PAGE'S BOOK SHELF: a list he keeps adding to, and a draw from it.
//
// Movie, 14 Oct: "i'd like the left column to be EBAY links to recommended
// ARCHITECTURAL books ... make sure you get my partner info for affiliate
// commissions", then "can you keep adding them to a list and once i fill up
// the column, just randomly show them each time show different ones from the
// list".
//
// TWO THINGS ARE WORTH A HARNESS HERE and neither needs a browser:
//
//   1. THE DRAW. Repeat-free, the right length, every book reachable over
//      enough visits, and STABLE while the list is shorter than the column --
//      a list of two that reshuffled on every load reads as a bug.
//   2. THE LINKS. Every one carries his partner tracking. A book added by
//      hand with the campid dropped, or with a plain ebay.ca search pasted
//      in, is a book that pays nobody -- and nothing on the page would say so.
//
// Run: node proto/entry-books-harness.js
//      node proto/entry-books-harness.js --mutate
const MUTATE = require('./harness-args.js').mutationMode();
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');

const MUTATIONS = [
  ['the draw can show the same book twice', 'entry-books.js',
    c => c.replace('    return pool.slice(0, want);',
      '    return pool.slice(0, want - 1).concat([pool[0]]);')],
  ['a short list is shuffled too, so two books swap places every visit',
    'entry-books.js',
    c => c.replace('    if (all.length <= want) return all.slice();', '')],
  ['the draw hands back the whole list, column or no column', 'entry-books.js',
    c => c.replace('    const want = Math.max(0, Math.floor(Number(count) || 0));',
      '    const want = 99;')],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('entry-books',
    MUTATIONS, { root: ROOT, harness: __filename });
  process.exit(all ? 0 : 1);
}

const SOURCE_OVERRIDES = (() => {
  const at = process.env.DRAFT_HARNESS_SOURCE_OVERRIDES;
  return at ? JSON.parse(fs.readFileSync(at, 'utf8')) : null;
})();
const sourceOf = file => (SOURCE_OVERRIDES && SOURCE_OVERRIDES[file] != null
  ? SOURCE_OVERRIDES[file] : fs.readFileSync(path.join(ROOT, file), 'utf8'));

const win = {};
const sandbox = { window: win, console, Object, Array, Number, Math, String, JSON };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(sourceOf('entry-books.js'), sandbox, { filename: 'entry-books.js' });
const EB = win.DraftEntryBooks;

let passed = 0;
const failures = [];
const check = (name, condition, detail) => {
  if (condition) { passed += 1; return; }
  failures.push(detail ? `${name}\n      ${detail}` : name);
};

check('the shelf is a frozen list of books', Array.isArray(EB.BOOKS) && EB.BOOKS.length > 0,
  `BOOKS is ${JSON.stringify(EB.BOOKS)}`);

// ── EVERY LINK PAYS HIM ───────────────────────────────────────────────────
//
// HIS OWN NUMBERS, read off the links he sent rather than typed as a rule:
// the campaign id is the one that identifies him to eBay, and customid is the
// label he tags this site's traffic with. A book added without them looks
// identical on the page.
const CAMPID = '5339133571';
EB.BOOKS.forEach(book => {
  check(`${book.title}: the link carries his campaign id`,
    typeof book.href === 'string' && book.href.includes(`campid=${CAMPID}`),
    book.href);
  check(`${book.title}: and it is an eBay link over https`,
    /^https:\/\/(www\.)?ebay\./.test(book.href || ''), book.href);
  check(`${book.title}: it says what the book is`,
    typeof book.title === 'string' && book.title.trim().length > 2, JSON.stringify(book));
});

// ── THE DRAW ──────────────────────────────────────────────────────────────
const LONG = Array.from({ length: 9 }, (_, i) => ({ title: `B${i}`, href: `https://www.ebay.ca/?campid=${CAMPID}` }));
// A COUNTER FOR A DICE, so the answer is known: this walks the shuffle
// deterministically rather than hoping a random run covers the case.
const steady = value => () => value;

check('the draw is as long as the column asked for',
  EB.pickBooks(3, { list: LONG }).length === 3,
  `${EB.pickBooks(3, { list: LONG }).length} books for a column of 3`);
check('and never longer than the list itself',
  EB.pickBooks(5, { list: LONG.slice(0, 2) }).length === 2,
  'a column of 5 drew more books than exist');
check('a column of none draws none', EB.pickBooks(0, { list: LONG }).length === 0,
  'something was drawn for a column with no cells');

// REPEAT-FREE, which is the half of "different ones" a naive draw gets wrong.
// Asked over many draws rather than one, because one lucky draw proves
// nothing about a rule.
const repeated = Array.from({ length: 200 }, () => EB.pickBooks(3, { list: LONG }))
  .find(draw => new Set(draw.map(b => b.title)).size !== draw.length);
check('no visit shows the same book twice', repeated === undefined,
  JSON.stringify(repeated && repeated.map(b => b.title)));

// AND THEY REALLY DO MOVE. 200 draws of 3 from 9 that always answered the
// same three would pass every check above.
const seen = new Set();
Array.from({ length: 200 }, () => EB.pickBooks(3, { list: LONG }))
  .forEach(draw => draw.forEach(book => seen.add(book.title)));
check('over a run of visits every book on the list gets shown',
  seen.size === LONG.length, `${seen.size} of ${LONG.length} books ever appeared`);

// STABLE WHILE THE LIST IS SHORT: fewer books than cells is every book, in
// the order he added them, with no shuffle at all.
const short = LONG.slice(0, 2);
check('a list shorter than the column keeps his order',
  EB.pickBooks(3, { list: short, rng: steady(0) }).map(b => b.title).join() === 'B0,B1',
  JSON.stringify(EB.pickBooks(3, { list: short, rng: steady(0) }).map(b => b.title)));

console.log(`entry books harness: ${passed} checks passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach(line => console.log(`  ✘ ${line}`));
  process.exit(1);
}
