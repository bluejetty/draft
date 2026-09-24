// A SHEET SET WRITTEN BY THE OLD PAGE MUST OPEN IN THE NEW ONE.
//
// RD-DOCUMENTS/ORDER-construction-layouts.md names this as Stage 2's single
// highest risk and asks for the fixture before a line of the port is written:
//
//   "Saved sheets keep loading. Whatever layout records exist in the shared
//    store were written by the DC page and must open unchanged in the new
//    one."
//
// Every other guard on the Construction Layout starts the page empty and
// writes its own record. Thirteen spec files drive LAYOUT and not one of them
// opens a sheet set it did not just compose, so none of them can tell a
// reader that lost a field from a reader that never had one. This file exists
// to open a record the page wrote BEFORE the port and ask whether it is still
// all there.
//
// ── WHERE THE FIXTURE CAME FROM ─────────────────────────────────────────
// proto/layout-record-dc.draft is not typed out. It was captured off
// LAYOUT.dc.html on 23 Sep 2026, driven in a browser: a 36' x 26' main floor
// over a foundation with a gable roof and one drawn section (the same drawing
// layout-compose.spec.js calls boneDrawing), dealt with DEAL SHEETS, then
// given a drafter's hand -- the BLUEJETTY BAND strip, the north arrow raised,
// and E1 nudged 1.25" across its sheet. It is the bytes the store held,
// unedited. That matters: a fixture I compose to suit the reader proves the
// reader agrees with me, not that it agrees with the page.
//
// ── WHAT IT CANNOT SEE ──────────────────────────────────────────────────
// This is Node, so it measures the RECORD and the page's SOURCE, never the
// ink. Whether the sheet looks the same is the suite's job, and the suite is
// the acceptance instrument the order already chose.
//
// Run: node proto/layout-record-harness.js
const fs = require('fs');
const path = require('path');
require('./harness-args.js').noFlags();

const ROOT = path.join(__dirname, '..');
const FIXTURE = 'proto/layout-record-dc.draft';

const CHECKS = [];
const check = (label, got, want) => CHECKS.push({ label, got, want });
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

// LOADED FOR REAL rather than regexed out of the source, section-table-
// harness.js's reason: a rename or a restructure in drawing-format.js then
// fails HERE instead of sailing past a pattern that no longer matches.
const FORMAT = (() => {
  const w = {};
  new Function('window', read('drawing-format.js'))(w);
  return w.DraftDrawingFormat;
})();

const raw = JSON.parse(read(FIXTURE));

// ── THE FIXTURE IS WORTH READING FROM ───────────────────────────────────
// Every check below is of the shape "the record survives X", which is
// triumphantly true of a record with no viewports and no fields set. The
// population guard page-head-harness.js and shared-shell-harness.js both
// carry, and both had come due within a day of being written.
check('the fixture is a drawing the app would open',
  FORMAT.checkEnvelope(raw).ok, true);

// AND IT IS A HAND-ARRANGED ONE. An `auto` record is re-dealt on load -- the
// composer replaces every viewport in it -- so loading one proves nothing
// about the reader at all. It was this that made the first attempt at this
// measurement useless: the page was re-dealing between the two reads and the
// record "survived" because it had been written again, not because it was
// carried.
check('the record was arranged by hand, so loading it must carry it',
  raw.layout.auto, false);
check('it carries all three viewport kinds',
  [...new Set(raw.layout.viewports.map(v => v.kind))].sort(),
  ['elevation', 'plan', 'section']);
check('it spans more than one sheet',
  new Set(raw.layout.viewports.map(v => v.sheet)).size > 1, true);
// THE TWO FIELDS WHOSE DEFAULT WOULD MASK A READER THAT IGNORES THEM.
// `titleblock` falls back to 'roughdrafter' and `northArrow` to false, so a
// fixture wearing the defaults cannot tell a reader that read them from one
// that returned its own.
check('it wears a titleblock that is not the fallback',
  raw.layout.titleblock !== 'roughdrafter', true);
check('it carries the north arrow raised', raw.layout.northArrow, true);

// ── THE RECORD OPENS WHOLE ──────────────────────────────────────────────
// Read exactly the way LAYOUT.dc.html's _loadDrawing reads it, including that
// the cut ids come off the VALIDATED cuts rather than the saved ones.
const levelIds = new Set(FORMAT.levels(raw.levels).map(level => level.id));
const cutIds = new Set(FORMAT.cuts(raw.cuts, levelIds).map(cut => cut.id));
const opened = FORMAT.layout(raw.layout, levelIds, cutIds);

// NOT A COUNT -- a count of 7 is what a reader that repointed every viewport
// at the same plan would also report. Each seat is named with the reference
// that makes it that view, because losing the reference is the failure that
// looks like a full sheet set until a drafter reads the drawings on it.
const seats = list => list.viewports.map(v => [
  v.id, v.kind, v.sheet, v.pif, v.xIn, v.yIn,
  v.kind === 'plan' ? v.levelId : v.kind === 'section' ? v.cutId : v.elevId,
].join('/'));
check('every viewport keeps its seat, its scale and what it looks at',
  seats(opened), seats(raw.layout));
check('the sheet keeps its paper, its strip and its arrow',
  [opened.paperKey, opened.orientation, opened.titleblock,
    opened.northArrow, opened.auto, opened.nextViewportId],
  [raw.layout.paperKey, raw.layout.orientation, raw.layout.titleblock,
    raw.layout.northArrow, raw.layout.auto, raw.layout.nextViewportId]);

// ── AND NOTHING IS LEFT BEHIND ──────────────────────────────────────────
// This check read "the plan viewport's `view` is the only key the reader
// drops" until 23 Sep, and it was RIGHT: the composer wrote which drawing of
// a level a plan viewport was (board NEW-2 part 2, so FOUNDATION and the
// basement plan are two sheets off level 1), the saved file carried it, and
// format.layout threw it away on the way back in.
//
// IT TURNED OUT TO COST THE WHOLE FEATURE. Two other things were missing with
// it -- LAYOUT never passed the view to its painter, and layout-plan.js's
// planWalls filtered on the view and then dropped the field the shared
// composer filters on a second time -- so both level-1 sheets drew the
// concrete and the basement walls stacked on each other, which is the exact
// failure the board was opened to end. Fixed in the same commit that found
// it; the check now asks for the whole record rather than pinning the loss.
//
// NOTHING IN THE REPO COULD HAVE SAID SO. layout-compose.spec.js asserts on
// the record straight after composing and never reloads or looks at the ink,
// and no other spec opens a sheet set it did not just write. That gap is what
// this file was built for; it found the defect on its first honest reading.
check('the reader leaves nothing behind',
  [...new Set(raw.layout.viewports.flatMap(Object.keys))]
    .filter(key => !opened.viewports.some(v => key in v)), []);

// ── A REFERENCE THAT IS GONE TAKES ONLY ITS OWN SEAT ────────────────────
// drawing-format.js's own comment: "A viewport whose kind is unknown or whose
// reference is gone is DROPPED, never silently repointed at a plan: a section
// box turning into a plan of the wrong level is worse than an empty seat."
// Measured here rather than believed, on the record a drafter would hit it
// with -- a cut deleted back in the Model Space, which is the ordinary way a
// section viewport outlives what it looks at.
const withoutCuts = FORMAT.layout(raw.layout, levelIds, new Set());
check('a deleted cut empties its own section seat and no other',
  seats(withoutCuts),
  seats(raw.layout).filter(seat => !seat.includes('/section/')));
const withoutLevel1 = FORMAT.layout(raw.layout, new Set([3]), cutIds);
check('a deleted level empties its own plan seat and no other',
  seats(withoutLevel1),
  seats(raw.layout).filter(seat => !/^6\//.test(seat)));

// ── AND THE PAGE STILL ASKS FOR IT THE SAME WAY ─────────────────────────
// The two checks that carry across the port, because they are about the
// CALLER rather than the format. Page-agnostic on purpose: it reads whichever
// construction layout page is on disk, so it guards LAYOUT.dc.html today and
// LAYOUT.html the moment the port lands, with nothing to remember to update.
const PAGE = ['LAYOUT.html', 'LAYOUT.dc.html']
  .find(f => fs.existsSync(path.join(ROOT, f))) || '';
check('there is a construction layout page to read', PAGE.length > 0, true);
const page = PAGE ? read(PAGE) : '';

// BOTH ARGUMENTS, and the second is the one worth the check. `cutIds`
// defaults to an empty Set, so a call that forgets it does not throw, does not
// warn, and drops EVERY section viewport off EVERY saved sheet set -- the
// sheets simply come up with fewer drawings on them. There is no louder
// version of that failure to catch it by.
check('the page reads the record through the shared validator, cut ids and all',
  /(?:DraftDrawingFormat|format)\.layout\(\s*[\w.?]+\s*,\s*\w+\s*,\s*\w+\s*\)/
    .test(page.replace(/\/\/[^\n]*/g, '')), true);

// AND IT PUTS THE PAPER ON ONLY WHEN THE VALIDATOR RETURNED ONE. paperKey and
// orientation fall back to null, not to a value, so an unconditional patch
// puts `null` on the paper of every drawing saved before the picker existed --
// which is every drawing older than board #168.
check('paper and orientation are patched only when the record named them',
  ['paperKey', 'orientation'].filter(key =>
    !new RegExp(`if\\s*\\(\\s*\\w+\\??\\.${key}\\s*\\)`).test(page)), []);

// AND THE BAR STILL POINTS AT IT. The page row on every page in the shop links
// the construction layout by name; a port that renames the file and leaves the
// table alone gives all six pages a dead chip.
const bars = read('shell-bars.js');
const href = (/id:\s*'construction'[\s\S]{0,200}?href:\s*'\.\/([\w.-]+)'/.exec(bars) || [])[1];
check('the page row links the construction layout page that exists', href, PAGE);

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let failed = 0;
for (const c of CHECKS) {
  const ok = eq(c.got, c.want);
  if (!ok) failed += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'}  ${c.label}`);
  if (!ok) console.log(`          got  ${JSON.stringify(c.got)}\n          want ${JSON.stringify(c.want)}`);
}
console.log(`\nlayout record: ${CHECKS.length} checks, ${failed} failed`
  + `  (${raw.layout.viewports.length} viewports off ${PAGE || 'no page'})`);
process.exit(failed ? 1 : 0);
