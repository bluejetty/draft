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
check(`${SHEET} carries the instruments`, /#strip-center\s*\{/.test(sheet), true);

// A PAGE WITH THE BAR'S MARKUP MUST LINK THE BAR'S STYLESHEET. This is the
// check that catches the next page -- someone copies the shell into SPECS and
// forgets the link, and the bar renders as unstyled buttons in a row.
const wearsBars = f => /<div[^>]+id=["']strip["']/.test(read(f))
  || /<div[^>]+id=["']house-strip["']/.test(read(f));
const linksSheet = f => new RegExp(`<link[^>]+href=["'][./]*${SHEET}["']`).test(read(f));
const barredPages = pages.filter(wearsBars);
check('some page wears the bars', barredPages.length >= 1, true);
check('every page with bar markup links the sheet',
  barredPages.filter(f => !linksSheet(f)), []);

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
check('every page linking the sheet also loads palette.js',
  pages.filter(linksSheet).filter(f => !/palette\.js/.test(read(f))), []);

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
