// pdf-scan.js — the pure half, under plain node.
//
// Seven exports, and they split cleanly:
//
//   browser-bound   inspectPdf, inspectPdfPage, inspectImage
//                   (pdfjsLib, canvas, createImageBitmap)
//   PURE            detectScalesInText, parseScaleEntry,
//                   calibrateScale, worldSizeFromScan
//
// The pure four are the ones carrying the risk: they turn a scanned drawing
// into real-world dimensions, and a wrong number there is silently wrong on
// every measurement taken off the underlay afterwards. They need no DOM, so
// the whole file loads under node with a `window = {}` stub -- the DOM calls
// live inside the three browser functions and are simply never reached.
//
// This was the one module of MODEL's seventeen with neither a harness nor a
// spec. It did not need refactoring to get one.
global.window = global.window || {};
require('../pdf-scan.js');
const S = global.window.DraftPdfScan;

let failed = 0, ran = 0;
const check = (label, got, want) => {
  ran += 1;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { failed += 1; console.log(`  FAIL ${label}\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`); }
};

check('the module loads and exports seven', Object.keys(S).length, 7);

// ── calibrateScale ────────────────────────────────────────────────────────
// widthFt = canvasWidth / distPx * realInches / 12. Two marks a quarter of a
// 1000px canvas apart is 250px; calling that 12 real inches makes the full
// width 1000/250 * 12 / 12 = 4 feet. Arithmetic, not a stored expectation.
check('a quarter-canvas span called 12in makes the sheet 4ft',
  S.calibrateScale({ marks: [{ fx: 0.25, fy: 0.5 }, { fx: 0.50, fy: 0.5 }],
    canvasWidth: 1000, canvasHeight: 800, kind: 'image', pageDims: null, realInches: 12 }),
  { ok: true, widthFt: 4 });

check('two marks on the same point are refused, not divided by zero',
  S.calibrateScale({ marks: [{ fx: 0.5, fy: 0.5 }, { fx: 0.5, fy: 0.5 }],
    canvasWidth: 1000, canvasHeight: 800, kind: 'image', pageDims: null, realInches: 12 }).ok,
  false);

// THE PRECONDITION LIVES IN THE CALLER, AND THAT IS THE FINDING.
//
// A zero or negative typed length is accepted here and produces a zero or
// NEGATIVE sheet width. It cannot happen in the app today: MODEL.dc.html's
// _applyInsertCalibration refuses it first --
//
//     if (!parsed.ok || parsed.inches <= 0) { ...'The distance must be
//     positive.'... return; }
//
// -- so this is not a defect in the shipped app, and the behaviour is pinned
// here as it IS rather than as it ought to be. What it is not is SAFE TO
// CARRY: a second caller that does not know about that guard gets a negative
// scale and no error. Recorded rather than changed, because changing a
// module's contract to suit a page that does not exist yet is how a rule
// nobody ruled on gets invented.
check('a negative typed length is NOT refused here (MODEL:3335 refuses it)',
  S.calibrateScale({ marks: [{ fx: 0.25, fy: 0.5 }, { fx: 0.75, fy: 0.5 }],
    canvasWidth: 1000, canvasHeight: 800, kind: 'image', pageDims: null, realInches: -12 }),
  { ok: true, widthFt: -2 });

// ── parseScaleEntry ───────────────────────────────────────────────────────
// The ratio is how many real inches one paper inch stands for: at 1/4"=1'-0",
// a quarter inch is twelve inches, so one inch is 48. Every row below is that
// same division, so the table is derived rather than remembered.
for (const [entry, ratio] of [['1/8"=1\'-0"', 96], ['1/4"=1\'-0"', 48],
                              ['3/16"=1\'-0"', 64], ['1/2"=1\'-0"', 24],
                              ['1"=1\'-0"', 12]]) {
  check(`${entry} is 1:${ratio}`, S.parseScaleEntry(entry)?.ratio, ratio);
  check(`${entry} is imperial`, S.parseScaleEntry(entry)?.unit, 'imperial');
}
check('1:50 is a bare ratio, not an imperial scale', S.parseScaleEntry('1:50'),
  { raw: '1:50', ratio: 50, unit: 'ratio' });

// Nonsense returns null rather than coercing to a scale. A scale that quietly
// became 0 or NaN would put a drawing on the sheet at the wrong size with
// nothing on screen to say so.
check('unparseable text is null, not a guess', S.parseScaleEntry('rubbish'), null);
check('the empty string is null', S.parseScaleEntry(''), null);

console.log(failed ? `\n  ${failed} of ${ran} checks FAILED\n` : `\n  ${ran} checks passed\n`);
process.exit(failed ? 1 : 0);
