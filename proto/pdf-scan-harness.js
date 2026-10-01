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

const path = require('path');
const MUTATE = require('./harness-args.js').mutationMode();

// ── MUTATIONS (1 Oct) ─────────────────────────────────────────────────────
// Each is a wrong number on every measurement taken off the underlay. Against
// the checks this file had, ONE OF EIGHT was caught -- measured. The harness
// pinned parseScaleEntry's imperial arithmetic and calibrateScale's IMAGE
// path; the PDF path, worldSizeFromScan and detectScalesInText had never been
// called, and the seven survivors were all there. "THE OTHER THREE PATHS"
// below is what they asked for. Each
// String.replace bends the FIRST match, and the order in pdf-scan.js is
// detectScalesInText, then parseScaleEntry -- so a row written against the
// shared regex arithmetic lands in the detector, and one written against
// parseScaleEntry's own lines says so in its anchor.
const MUTATIONS = [
  ['a typed scale counts its feet as inches', 'pdf-scan.js',
    c => c.replace("const totalInches = feet * 12 + inches;\n        if (val && totalInches) return",
      "const totalInches = feet + inches;\n        if (val && totalInches) return")],
  ['a typed 1:1 is taken for a scale', 'pdf-scan.js',
    c => c.replace('if (rm && parseInt(rm[1], 10) > 1) return', 'if (rm && parseInt(rm[1], 10) > 0) return')],
  ['a PDF page is measured in CSS pixels, not points', 'pdf-scan.js',
    c => c.replace('const pxPerPaperInch = canvasWidth / pageDims.w * 72;',
      'const pxPerPaperInch = canvasWidth / pageDims.w * 96;')],
  ['the calibration span ignores how far the marks are apart vertically', 'pdf-scan.js',
    c => c.replace('const distPx = Math.hypot(dx, dy);', 'const distPx = Math.abs(dx);')],
  ['a scaled PDF\'s height is taken off its width', 'pdf-scan.js',
    c => c.replace('heightFt: paperInchesH * selectedScale.ratio / 12', 'heightFt: paperInchesW * selectedScale.ratio / 12')],
  ['an image\'s aspect is turned on its side', 'pdf-scan.js',
    c => c.replace(': (imgWidth ? imgHeight / imgWidth : 1);', ': (imgWidth ? imgWidth / imgHeight : 1);')],
  ['a scale printed twice on a sheet is offered twice', 'pdf-scan.js',
    c => c.replace("        if (seen.has(raw)) continue;\n        seen.add(raw);\n        found.push({ raw, ratio: totalInches / val, unit: 'imperial' });",
      "        found.push({ raw, ratio: totalInches / val, unit: 'imperial' });")],
  ['the detector offers 1:1, which every title block prints somewhere', 'pdf-scan.js',
    c => c.replace('if (!n || n === 1) continue;', 'if (!n) continue;')],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('pdf-scan',
    MUTATIONS, { root: path.join(__dirname, '..'), harness: __filename, preload: true });
  process.exit(all ? 0 : 1);
}

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

check('1:1 is not a scale, typed or not', S.parseScaleEntry('1:1'), null);

// ── THE OTHER THREE PATHS ─────────────────────────────────────────────────
// A PDF page is measured in POINTS, 72 to the inch. A 720pt page drawn 720px
// wide is 72px per paper inch, so marks 72px apart span one paper inch --
// and calling that 48 real inches is 1:48. Arithmetic, not remembered.
check('one paper inch on a PDF called 4ft is 1:48',
  S.calibrateScale({ marks: [{ fx: 0.1, fy: 0.5 }, { fx: 0.2, fy: 0.5 }],
    canvasWidth: 720, canvasHeight: 500, kind: 'pdf', pageDims: { w: 720, h: 500 }, realInches: 48 })
    .scale?.ratio, 48);

// A 3-4-5 span: 300px across and 400px down is 500px, not 300.
check('a diagonal span is measured along the diagonal',
  S.calibrateScale({ marks: [{ fx: 0, fy: 0 }, { fx: 0.3, fy: 0.4 }],
    canvasWidth: 1000, canvasHeight: 1000, kind: 'image', pageDims: null, realInches: 12 }),
  { ok: true, widthFt: 2 });

// A letter sheet on its side, 11in x 8.5in, at 1:48 is 44ft x 34ft.
check('a scaled PDF sheet takes its height off its own height',
  S.worldSizeFromScan({ kind: 'pdf', pageDims: { w: 792, h: 612 }, selectedScale: { ratio: 48 } }),
  { widthFt: 44, heightFt: 34 });
// An image twice as wide as tall, typed at 40ft, is 20ft deep.
check('an image keeps its own aspect',
  S.worldSizeFromScan({ kind: 'image', imgWidth: 2000, imgHeight: 1000, typedWidthFt: 40 }),
  { widthFt: 40, heightFt: 20 });

// A title block prints its scale more than once, and 1:1 on every sheet; the
// picker offers each real scale once and never the 1:1.
check('the detector offers each scale once, and never 1:1',
  S.detectScalesInText('PLAN 1/4"=1\'-0" ... ELEV 1/4"=1\'-0" ... DETAIL 1:1 ... SITE 1:100')
    .map(found => found.raw),
  ['1/4" = 1\'-0"', '1:100']);

console.log(failed ? `\n  ${failed} of ${ran} checks FAILED\n` : `\n  ${ran} checks passed\n`);
process.exit(failed ? 1 : 0);
