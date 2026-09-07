// EVERY PAGE CARRIES THE SAME HEAD FURNITURE, AND NOBODY WAS CHECKING.
//
// index.html has had `<link rel="icon">` since the favicon was drawn. The
// other NINE pages never got it -- including MODEL.dc.html and PROJECT.html,
// the two a drafter has open all day -- so a session with eight tabs showed
// eight blank icons and one bone.
//
// IT SCANS RATHER THAN LISTS, and that is the whole design. Two lists of
// pages already exist in this repo and BOTH have drifted: this file was
// written after finding that tests/no-third-party.spec.js's own PAGES array
// is missing MODEL.html, Notepad.dc.html and SaveBox.dc.html. A hand-kept
// roster of pages is a fourth copy of "which pages exist", and it fails the
// same way every time -- silently, when someone adds the tenth page.
//
// So the population comes off the disk. A page added tomorrow is covered
// without anyone remembering this file exists.
//
// AND IT ASSERTS THE POPULATION IS NON-EMPTY. "No page is missing the icon"
// is trivially true of zero pages, and a glob that stops matching -- a rename,
// a move to a subdirectory -- would report a clean sweep of nothing. The
// count check is what makes the silence mean something.
//
// Run: node proto/page-head-harness.js
const fs = require('fs');
const path = require('path');
require('./harness-args.js').noFlags();

const ROOT = path.join(__dirname, '..');
const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).sort();

const CHECKS = [];
const check = (label, got, want) => CHECKS.push({ label, got, want });

// The companion the emptiness assertion needs. Nine was the count on 7 Sep
// with index.html already correct; the floor is deliberately low and only
// guards against the glob matching nothing at all, not against the roster
// changing -- pages are meant to be added.
check('the scan finds pages at all', pages.length >= 5, true);

// One line, one asset, in every head. Matched on the RELATIONSHIP -- a link
// whose rel is icon -- not on the exact string, because MODEL.html closes its
// tags `/>` and the .dc.html pages do not, and pinning the byte sequence
// would fail on a page that is perfectly correct.
const missing = pages.filter(f =>
  !/<link[^>]*rel=["']icon["'][^>]*>/i.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
check('every page links a favicon', missing.join(', '), '');

// And it has to point at something that exists. A link to a missing file is
// the same blank tab with an extra line of markup, which reads as fixed.
const hrefs = new Set();
for (const f of pages) {
  const m = /<link[^>]*rel=["']icon["'][^>]*href=["']([^"']+)["']/i
    .exec(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  if (m) hrefs.add(m[1]);
}
check('they all point at the same asset', hrefs.size, 1);
check('and that asset is on disk',
  [...hrefs].filter(h => !fs.existsSync(path.join(ROOT, h))).join(', '), '');

let failed = 0;
for (const { label, got, want } of CHECKS) {
  if (got !== want) { failed += 1; console.log(`  ✘ ${label}\n       got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }
}
console.log(`page head harness: ${CHECKS.length - failed} checks passed, ${failed} failed  (${pages.length} pages)`);
process.exit(failed ? 1 : 0);
