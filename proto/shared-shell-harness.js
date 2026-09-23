// THE SHELL IS SHARED, AND THIS IS WHAT KEEPS IT THAT WAY.
//
// shell-bars.css exists because Movie asked a question that has only one
// honest answer: "it will guarantee to be same style if i change one all will
// change right". Sharing the markup guarantees nothing on its own -- the
// STYLING has to move too, or each page keeps a copy and they drift. They
// were already drifting when the file was written: .card, .field,
// .card-title and four more meant different things on PROJECT.html and
// SPECS.html, and nobody had noticed.
//
// SO THE GUARANTEE NEEDS A GUARD, because it is not a property of the code --
// it is a property of NOBODY EVER PASTING THE RULES BACK. That is the failure
// this file watches for, and it is a cheap mistake to make: a page wants the
// bar a little different, someone copies four rules into its own <style>, and
// the shared sheet quietly stops being the one place.
//
// IT SCANS RATHER THAN LISTS, for page-head-harness.js's reason -- two hand-
// kept rosters of pages exist in this repo and BOTH have drifted. The pages
// come off the disk, so REAL ESTATE PLANS and ESTIMATES are covered the day
// they are made, without anyone remembering this file exists.
//
// Run: node proto/shared-shell-harness.js
const fs = require('fs');
const path = require('path');
require('./harness-args.js').noFlags();

const ROOT = path.join(__dirname, '..');
const SHEET = 'shell-bars.css';

const CHECKS = [];
const check = (label, got, want) => CHECKS.push({ label, got, want });

const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).sort();

// THE COMPANION THE WHOLE FILE NEEDS. Every check below is of the shape "no
// page does X", which is triumphantly true of zero pages. A glob that stopped
// matching -- a rename, a move into a subdirectory -- would print a clean
// sweep of nothing at all.
check('the scan finds pages at all', pages.length >= 5, true);

// Strip comments before reading any page's CSS. This repo's comments QUOTE
// selectors constantly -- "`#house-strip .set` came off these three rules" is
// a real line in MODEL.html -- and a checker that counted those would fail on
// a page whose only sin was explaining itself.
const decomment = s => s.replace(/\/\*[\s\S]*?\*\//g, '');
const styleOf = html => decomment(
  (html.match(/<style[^>]*>([\s\S]*?)<\/style>/g) || []).join('\n'));
const selectorsIn = css =>
  [...css.matchAll(/([^{}]+)\{/g)].map(m => m[1].replace(/\s+/g, ' ').trim());

// WHAT THE SHARED SHEET OWNS. Terminated with (?![-\w]) rather than \b,
// because \b after "bone" matches "#bone-choice" -- and #bone-choice is
// MODEL's own dialog for picking which house to build, deliberately NOT
// shared. The first draft of this check failed on it, which is the only
// reason the distinction is written down.
const OWNED = [
  'strip', 'strip-center', 'strip-divide', 'strip-len', 'strip-ang',
  'strip-length-box', 'strip-angle-box', 'strip-message', 'frozen-length',
  'frozen-angle', 'house-strip', 'page-row', 'sheet-row', 'file-row',
  'mode-corner', 'units-corner', 'settings-corner', 'settings-stack',
  'lower-left', 'readout', 'readout-tab', 'readout-text', 'dt-bar',
  'bone', 'bone-balance', 'delete', 'save-as', 'save-as-name', 'file-guard',
];
const OWNED_RE = new RegExp(
  `#(?:${OWNED.join('|')})(?![-\\w])|(?:^|[\\s,>+~])\\.(?:chip|strip-half)(?![-\\w])`);

const sheet = fs.existsSync(path.join(ROOT, SHEET)) ? read(SHEET) : '';

// THE SHEET IS REAL, not an empty file that would make every check below pass
// by having nothing to disagree with.
check(`${SHEET} exists`, sheet.length > 0, true);
check(`${SHEET} carries the top bar`, /#strip\s*\{/.test(sheet), true);
check(`${SHEET} carries the bottom bar`, /#house-strip\s*\{/.test(sheet), true);
// THE INSTRUMENTS, AS A SET RATHER THAN A SIGHTING. The first version of
// this asked only whether `#strip-center {` appeared anywhere, and
// shared-shell-mutants.js killed it: the sheet has NINE #strip-center rules,
// so renaming one still left eight for the regex to find. A check that any
// single rule survives is not a check that the instruments are here.
const INSTRUMENTS = ['#strip-center', '#strip-length-box', '#strip-angle-box',
  '#frozen-length', '#frozen-angle', '#strip-len', '#strip-ang', '.chip'];
check(`${SHEET} carries every instrument`,
  INSTRUMENTS.filter(sel => !new RegExp(
    `${sel.replace(/[.#]/g, '\\$&')}(?![-\\w])[^{}]*\\{`).test(decomment(sheet))), []);

// A PAGE WEARS THE BARS IF IT MOUNTS THEM, which is a change from what this
// asked a commit ago -- it looked for `<div id="strip">` in the source, and
// the markup left the source when shell-bars.js took it. THE POPULATION WENT
// TO ZERO AND THIS FILE SAID SO, because of the emptiness guard at the top:
// without it, every "no page does X" check below would have passed
// triumphantly over nothing at all and the move would have looked clean.
// That is the whole argument for the guard, and it came due immediately.
const wearsBars = f => /DraftShellBars\.(?:topBar|bottomBar)\s*\(/.test(read(f));
const linksSheet = f => new RegExp(`<link[^>]+href=["'][./]*${SHEET}["']`).test(read(f));
const loadsModule = f => /<script[^>]+src=["'][.\/]*shell-bars\.js["']/.test(read(f));
const barredPages = pages.filter(wearsBars);
check('some page mounts the bars', barredPages.length >= 1, true);
check('every page that mounts the bars links the sheet',
  barredPages.filter(f => !linksSheet(f)), []);
check('every page that mounts the bars loads the module',
  barredPages.filter(f => !loadsModule(f)), []);

// AND THE MODULE ARRIVES BEFORE ITS OWN MOUNT CALL. The bars are written
// where the calling <script> stands, mid-parse, so a module loaded at the
// foot of the body with the others -- which is where every other module on
// these pages lives, and therefore the obvious place to put it -- would be a
// TypeError on a page that otherwise looks perfectly wired. The failure is
// total and the cause is invisible, so it gets a check rather than a comment.
const moduleFirst = f => {
  const src = read(f);
  const tag = src.search(/<script[^>]+src=["'][.\/]*shell-bars\.js["']/);
  const mount = src.search(/DraftShellBars\.(?:topBar|bottomBar|readout|fileGuard|saveAs)\s*\(/);
  return tag >= 0 && mount >= 0 && tag < mount;
};
check('the module loads before the first mount', barredPages.filter(f => !moduleFirst(f)), []);

// AND IT IS NOT DEFERRED OR ASYNC, which the check above cannot see. A
// `<script src="shell-bars.js" defer>` still sits EARLIER IN THE TEXT than
// every mount call, so the ordering check passes -- and the page throws,
// because defer means the module runs after parsing and the mounts run
// during it. The hole was found by trying to write a mutant for the ordering
// check and noticing the obvious one would sail through it.
const deferred = f => /<script[^>]*src=["'][.\/]*shell-bars\.js["'][^>]*\s(?:defer|async)[\s>]/.test(read(f));
check('the module is neither deferred nor async',
  barredPages.filter(deferred), []);

// AND NOBODY PASTES THE RULES BACK. The one that matters: a page may style
// its own furniture however it likes, but the moment it writes a rule for a
// selector the shared sheet owns, the guarantee is gone and nothing else in
// the repo would say so.
const copiers = [];
for (const f of pages) {
  const own = selectorsIn(styleOf(read(f))).filter(s => OWNED_RE.test(s));
  if (own.length) copiers.push(`${f}: ${own.slice(0, 3).join(' | ')}`);
}
check('no page re-styles what the shared sheet owns', copiers, []);

// THE SHEET IS USELESS WITHOUT THE ROLE TABLE, and this is a real trap rather
// than a hypothetical: SPECS, SETTINGS and STANDARDS have ZERO palette roles
// between them and do not load palette.js at all. Whichever gets the bars
// first gets a bar with no colours unless it takes palette.js too.
// MATCHED AS A SCRIPT TAG, NOT AS THE WORDS. The first version tested
// /palette\.js/ against the whole page, and MODEL.html says "palette.js" in
// TEN comments -- so the check passed on prose while the script tag was
// commented out, which is exactly what the mutant did. The same trap this
// file's own decomment() was written for, sprung one check later.
const loadsPalette = f =>
  /<script[^>]+src=["'][.\/]*palette\.js["']/.test(decomment(read(f)));
check('every page linking the sheet also loads palette.js',
  pages.filter(linksSheet).filter(f => !loadsPalette(f)), []);

// THE MAP OF THE JOB IS ALL SIX TOWNS. The page row's oldest rule is that it
// shows every page of the shop, built or not -- "a map with two towns missing
// teaches the drafter a shape that is wrong" -- and now that the row is
// rendered from a table instead of written out by hand, a page can go missing
// from every bar in the shop with one edit.
//
// EACH ONE SITS IN A ROW THAT EXISTS. `row` decides which end of the bottom
// bar a chip lands at, and a typo there does not throw: the filter simply
// returns nothing and the chip is silently absent, which is this repo's
// favourite kind of bug.
const MODULE = fs.existsSync(path.join(ROOT, 'shell-bars.js'))
  ? decomment(read('shell-bars.js')) : '';
const declared = [...MODULE.matchAll(/id:\s*'([a-z-]+)',\s*row:\s*'([a-z]+)'/g)];
check('the page table names all six pages',
  declared.map(m => m[1]).sort(),
  ['construction', 'estimates', 'model', 'project', 'real-estate', 'specs']);
check('every page sits in a row that exists',
  declared.filter(m => m[2] !== 'page' && m[2] !== 'sheet').map(m => `${m[1]}:${m[2]}`), []);

// THE FOUR LITERALS, HELD TO FOUR. The sheet's own head names them and says
// why each is not a surface the skin owns; this is what makes that comment a
// claim rather than a hope. A fifth means somebody typed a colour where a
// role belongs -- the exact defect that left SPECS white on a night skin.
const literals = (decomment(sheet).match(/#[0-9a-fA-F]{3,8}(?![-\w])|rgba?\([^)]*\)/g) || [])
  .filter(t => !/^#(?:strip|house|page|sheet|file|mode|units|settings|lower|readout|dt|bone|delete|save|frozen)/.test(t));
check('the sheet holds exactly the four named literals', literals.sort(),
  ['#fff', 'rgba(0,0,0,0.35)', 'rgba(255,64,51,0.75)', 'rgba(29,31,32,0.55)'].sort());

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let failed = 0;
for (const c of CHECKS) {
  const ok = eq(c.got, c.want);
  if (!ok) failed += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'}  ${c.label}`);
  if (!ok) console.log(`          got  ${JSON.stringify(c.got)}\n          want ${JSON.stringify(c.want)}`);
}
console.log(`\nshared shell: ${CHECKS.length} checks, ${failed} failed`
  + `  (${pages.length} pages scanned, ${barredPages.length} wearing the bars)`);
process.exit(failed ? 1 : 0);
