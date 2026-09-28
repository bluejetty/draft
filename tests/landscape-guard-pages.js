// WHICH PAGES OWE A LANDSCAPE GUARD — one answer, read off the disk.
//
// Board #310's ruling is that the working screens always present landscape on
// a tablet, and ENTRY is the one screen that may follow the device. Two specs
// assert that ruling, and until this file existed each kept its own hand-typed
// roster of pages. BOTH HAD DRIFTED, in opposite directions:
//
//     page                     orientation-lock   model-portrait-guard
//     MODEL.html               absent             listed
//     MODEL.dc.html            listed             absent
//     SPECS.html               listed             absent
//     LAYOUT/PROJECT/…         listed             listed
//
// MODEL.html is the one that cost something. orientation-lock.spec.js is the
// suite whose whole job is "every working screen shows the turn-your-device
// panel", and it walked /MODEL.dc.html three times while never once loading
// /MODEL.html. When the page was ported the roster was not updated, so the
// check written to catch a missing guard was still asking the old page — and
// the guard went missing on the new one and shipped. #512 then added a second
// hardcoded list to catch it, which is two mechanisms and one claim: the same
// trap, one file later. model-portrait-guard.spec.js's own header names six
// pages including SPECS, and the array below it names five and omits SPECS.
//
// A HAND-KEPT ROSTER OF PAGES FAILS SILENTLY, always the same way: somebody
// adds or renames a page and the sweep quietly stops covering it, and a spec
// checking five pages passes in exactly the same way as one checking seven.
// tests/no-phantom-scroll.spec.js, tests/no-third-party.spec.js,
// proto/page-head-harness.js and proto/shared-shell-harness.js all reached the
// same conclusion and all read the population off the disk. This does too, and
// the two specs read it from here rather than each keeping a copy.
//
// ── WHY THE EXEMPTIONS ARE NAMED AND THE COVERED PAGES ARE NOT ──────────────
//
// The tempting derivation is "the pages that load orientation-guard.js", and
// it is worthless: it is the very thing the specs are trying to prove. A page
// that drops the script tag would drop out of the roster with it, and the
// suite would sweep the remainder and report a clean pass — which is exactly
// how MODEL.html shipped without a guard. The population must be decided by
// something the defect cannot edit.
//
// So the default is COVERED, and a page leaves the roster only by being named
// here with a reason. A page added tomorrow is covered without anyone
// remembering this file exists; a page that loses its guard is caught, because
// losing the guard is not a way off the list.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// NOT WORKING SCREENS. Short, and every entry is a claim somebody can check.
const EXEMPT = {
  // The ruling's own exception, quoted at the top of orientation-guard.js:
  // "ENTRY (index.html) is the one exception and does not load this file."
  'index.html': 'ENTRY — the one screen the ruling lets follow the device',
  // Single-component preview pages: a <x-dc> block, react, support.js and
  // nothing else — around 5KB each, with no app shell, no store and no
  // drawing surface. Nobody drafts on them, so there is no landscape to
  // present. (MODEL.dc.html shares the suffix and is NOT one of these: it is
  // a working screen, and it is on the roster.)
  'Notepad.dc.html': 'component preview, not a screen a drafter works on',
  'SaveBox.dc.html': 'component preview, not a screen a drafter works on',
};

const ALL_PAGES = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).sort();

const GUARDED_PAGES = ALL_PAGES.filter(f => !(f in EXEMPT));
const GUARDED_PATHS = GUARDED_PAGES.map(f => `/${f}`);

// THE COMPANIONS THE SCAN NEEDS, for the reason every scanning file in this
// repo writes down: every assertion built on this roster is of the shape "no
// page does X", which is triumphantly true of a glob that has stopped
// matching. Each spec runs these, so a rename or a move into a subdirectory
// fails loudly instead of sweeping nothing at all.
//
// THE RULING'S OWN NAMES ARE THE FLOOR. A count alone would not have caught
// the fault this file was written for: swapping MODEL.html for MODEL.dc.html
// keeps the count identical. Asking for the six pages the ruling names, by
// name, is what makes the roster answerable to the ruling rather than to
// whatever happens to be on disk.
//
// SIX, AND THE RULING IS QUOTED TWO WAYS. orientation-guard.js's own head
// names five — "MODEL, LAYOUT, PROJECT, STANDARDS and SETTINGS" — and
// orientation-lock.spec.js's head names the same five plus SPECS. SPECS.html
// is a working screen, it has carried the guard all along, and both specs
// exercised it, so six is the reading that matches what is on disk and what
// has always been checked. Written down because the two quotes disagree and
// the next person to read them deserves to know which was followed here.
const RULING_NAMES = ['MODEL.html', 'LAYOUT.html', 'PROJECT.html',
  'SPECS.html', 'STANDARDS.html', 'SETTINGS.html'];

// AND THE EXEMPTIONS ARE REAL FILES. An exemption for a page that no longer
// exists is a name nobody will delete, and the next page to take that name
// inherits a pass it was never granted.
function rosterProblems() {
  const problems = [];
  if (ALL_PAGES.length < 5) {
    problems.push(`the scan found only ${ALL_PAGES.length} pages — has the glob stopped matching?`);
  }
  for (const name of RULING_NAMES) {
    if (!GUARDED_PAGES.includes(name)) problems.push(`board #310 names ${name} and the roster does not carry it`);
  }
  for (const name of Object.keys(EXEMPT)) {
    if (!ALL_PAGES.includes(name)) problems.push(`${name} is exempted and is not on disk`);
  }
  return problems;
}

module.exports = { ALL_PAGES, EXEMPT, GUARDED_PAGES, GUARDED_PATHS, RULING_NAMES, rosterProblems };
