// WHICH PAGES OWE A SKIN — one answer, read off the disk.
//
// SPEC-skins.md is Movie's ruling of 3 Sep: two brands (RUFF DRAFTER, ROUGH
// DRAFTER) times two modes (night, day) = four dashboards. palette.js carries
// it as named roles resolved per theme/mode, and a page receives it by calling
// calling DraftPalette.apply(), which writes one custom property per role and
// stamps data-theme / data-mode on the root.
//
// UNTIL THIS FILE EXISTED, ONE PAGE OF THE EIGHT WAS SWEPT. Every skin
// assertion in the suite lives in model-html-skins.spec.js and every one of
// them loads /MODEL.html. Measured on this build: eight pages call apply()
// and seven of them had nothing asserting the skin arrives --
//
//     EXTFINISH  LAYOUT  PROJECT  REALESTATEPLAN  SETTINGS  SPECS  STANDARDS
//
// That is the shape landscape-guard-pages.js was written to retire, one file
// over: a sweep whose population is decided by hand covers what somebody
// remembered, and a page added or renamed tomorrow leaves the sweep silently.
// A spec checking one page passes in exactly the same way as one checking
// eight.
//
// ── WHY THE EXEMPTIONS ARE NAMED AND THE COVERED PAGES ARE NOT ──────────────
//
// The tempting derivation is "the pages that load palette.js", and it is
// worthless for the same reason the landscape roster gives: it is the very
// thing being proven. A page that drops the script tag drops out of the
// roster with it, and the sweep reports a clean pass over the remainder --
// which is exactly how MODEL.html shipped without a landscape guard. The
// population must be decided by something the defect cannot edit.
//
// So the default is SKINNED, and a page leaves the roster only by being named
// here with a reason somebody can check and delete.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// NOT SKINNED, AND WHY. Every entry is a claim, not a convenience.
const EXEMPT = {
  // ENTRY is not a dashboard. Board #310 already holds it apart as the one
  // screen that may follow the device; it carries its own fixed look and
  // loads neither palette.js nor the shell bars. Measured: its body stays
  // rgb(238,245,251) under all four skins.
  'index.html': 'ENTRY — not one of the four dashboards, carries its own look',
  // Single-component preview pages: an <x-dc> block, react, support.js and
  // nothing else. No app shell, no store, no drawing surface, and a
  // transparent body — there is no dashboard here to skin. (MODEL.dc.html
  // shares the suffix and is NOT one of these; see below.)
  'Notepad.dc.html': 'component preview, not a dashboard',
  'SaveBox.dc.html': 'component preview, not a dashboard',
  // THE ONE EXEMPTION THAT IS A DEBT, NOT A CATEGORY. MODEL.dc.html is a
  // working screen — board #310 puts it on the landscape roster and the
  // suite drives it — but it predates the palette and takes no skin: 743
  // colour literals, 0 custom properties, measured in SPEC-skins.md §2, and
  // those counts are the reason the palette is a JS module at all. Skinning
  // it is the port (its painters move to the shared module), not this sweep.
  // Delete this line when that lands and the page will be swept like the
  // rest, because the default is SKINNED.
  'MODEL.dc.html': 'pre-palette page; skinning it is the port, not this sweep',
};

const ALL_PAGES = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).sort();

const SKINNED_PAGES = ALL_PAGES.filter(f => !(f in EXEMPT));
const SKINNED_PATHS = SKINNED_PAGES.map(f => `/${f}`);

// THE FLOOR, BY NAME. A count alone would not catch the fault this file is
// written for: swapping one page for another keeps the count identical, and
// that is exactly how the landscape sweep came to walk MODEL.dc.html three
// times while never loading MODEL.html. These eight were each measured
// applying every role palette.js defines, so naming them makes the roster
// answerable to what was proven rather than to whatever is on disk.
//
// SPEC-skins.md names NO pages — it rules four dashboards and stops — so
// unlike the landscape roster there is no board list to quote. This floor is
// therefore the measured population, recorded as such and not dressed up as
// a ruling.
const MEASURED_SKINNED = ['EXTFINISH.html', 'LAYOUT.html', 'MODEL.html',
  'PROJECT.html', 'REALESTATEPLAN.html', 'SETTINGS.html', 'SPECS.html',
  'STANDARDS.html'];

// AND THE EXEMPTIONS ARE REAL FILES. An exemption for a page that no longer
// exists is a name nobody will delete, and the next page to take that name
// inherits a pass it was never granted.
function rosterProblems() {
  const problems = [];
  if (ALL_PAGES.length < 5) {
    problems.push(`the scan found only ${ALL_PAGES.length} pages — has the glob stopped matching?`);
  }
  for (const name of MEASURED_SKINNED) {
    if (!SKINNED_PAGES.includes(name)) {
      problems.push(`${name} was measured taking the skin and the roster does not carry it`);
    }
  }
  for (const name of Object.keys(EXEMPT)) {
    if (!ALL_PAGES.includes(name)) problems.push(`${name} is exempted and is not on disk`);
  }
  return problems;
}

module.exports = { ALL_PAGES, EXEMPT, SKINNED_PAGES, SKINNED_PATHS, MEASURED_SKINNED, rosterProblems };
