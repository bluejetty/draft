// LAYOUT-PLAN: THE MODULE THAT COMPOSES EVERY SHEET THAT GOES TO SITE.
//
// Devin's audit, 28 Sep, ranked it the highest-value gap in the repo: it
// draws every construction sheet and every listing plan, it held all three
// of that day's live defects, and it had no harness of any kind.
//
// WHAT THIS PINS IS NOT THE ARITHMETIC. It is the thing that actually went
// wrong: this module reads four other modules off `window` and falls back
// silently when they are missing -- an empty object, a null stage, a default
// size -- so the sheet paints, drawPlan returns, and nothing says a word.
// REALESTATEPLAN shipped for weeks drawing no stairs at all that way.
//
// SO EVERY CHECK HERE IS RUN TWICE: once with the dependency, once without.
// A warning that fires when the module IS present is as broken as one that
// stays quiet when it is absent, and only running both catches the second.
//
// THE LOADER IS LOCAL ON PURPOSE. harness-env's loadDraftModules takes a
// fixed list, and the whole subject here is what happens when that list is
// short one file.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const MUTATE = process.argv.slice(2).includes('--mutate');
const ARGS = process.argv.slice(2).filter(a => a !== '--mutate');
if (ARGS.length) {
  console.error(`layout-plan-harness: takes no arguments (got ${ARGS.join(' ')})`);
  process.exit(2);
}

// Everything layout-plan needs to draw, in load order. The four under test
// are named separately so a case can drop one by name.
const BASE = ['formatters.js', 'wall-types.js', 'geometry-2d.js', 'drawing-format.js',
  'room-standards.js', 'level-assembly.js', 'stair-geometry.js', 'closets.js',
  'fixture-geometry.js', 'render-2d.js', 'plan-composition.js'];
const OPTIONAL = ['layer-views.js', 'cut-view.js', 'build-house.js', 'roof-types.js',
  'profile-manager.js', 'finish-patterns.js', 'roof-patterns.js', 'cut-marks.js',
  'fen-labels.js', 'electric-symbols.js'];

function loadWith(omit = [], source = {}) {
  const warnings = [];
  const win = {};
  const sandbox = {
    window: win, Math, Number, String, Object, Array, JSON, Map, Set, Boolean,
    isFinite, parseFloat, parseInt, Date, RegExp, Error,
    console: { warn: m => warnings.push(String(m)), error: () => {}, log: () => {} },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const failed = [];
  for (const file of [...BASE, ...OPTIONAL, 'layout-plan.js']) {
    if (omit.includes(file)) continue;
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue;
    let code = fs.readFileSync(full, 'utf8');
    if (source[file]) code = source[file](code);
    try { vm.runInContext(code, sandbox, { filename: file }); }
    catch (err) { failed.push(`${file}: ${err.message}`); }
  }
  return { win, warnings, failed };
}

// Records what it is asked to paint. strokeRect is a no-op and measureText
// returns a zero width, the same shapes harness-env's recorder uses.
function recorder() {
  const texts = [];
  const ctx = {
    texts, save() {}, restore() {}, beginPath() {}, closePath() {}, moveTo() {},
    lineTo() {}, arc() {}, rect() {}, stroke() {}, fill() {}, clip() {},
    fillRect() {}, strokeRect() {}, translate() {}, rotate() {}, scale() {},
    setLineDash() {}, quadraticCurveTo() {}, bezierCurveTo() {}, ellipse() {},
    fillText(t) { texts.push(String(t)); }, strokeText(t) { texts.push(String(t)); },
    measureText() { return { width: 0 }; }, setTransform() {}, getTransform() {
      return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    },
  };
  return ctx;
}

const SAVED = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'proto', 'repro-movie-bands.draft'), 'utf8'));
const toS = p => ({ x: (p.x || 0) * 10 + 400, y: (p.z || 0) * 10 + 300 });

function draw(win, levelId) {
  const ctx = recorder();
  const LP = win.DraftLayoutPlan;
  if (!LP) return { ok: false, texts: [], why: 'DraftLayoutPlan never defined' };
  try {
    LP.drawPlan(ctx, toS, SAVED, levelId, {});
    return { ok: true, texts: ctx.texts };
  } catch (err) { return { ok: false, texts: ctx.texts, why: err.message }; }
}

// The level the fixture keeps its stairs on, found rather than assumed.
const MAIN = (SAVED.levels.find(l => /MAIN/i.test(l.name || '')) || SAVED.levels[0]).id;

let failures = 0;
const check = (name, cond, detail) => {
  if (cond) return;
  failures += 1;
  console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`);
};

const STAIR = /^DN — \d+R @ /;

function run(label) {
  // ── THE FIXTURE'S OWN REACH, before anything is read off it ───────────
  const full = loadWith();
  check('every module loads without throwing',
    full.failed.length === 0, full.failed.join('; '));
  const base = draw(full.win, MAIN);
  check('drawPlan paints with everything present', base.ok, base.why);
  check('the fixture carries stairs to lose',
    (SAVED.stairs || []).length > 0);
  check('a complete load draws the stair notes',
    base.texts.some(t => STAIR.test(t)),
    `texts seen: ${base.texts.slice(0, 6).join(' | ') || '(none)'}`);
  check('a complete load says nothing',
    full.warnings.length === 0, full.warnings.join(' / '));

  // ── layer-views.js: the stair stage ───────────────────────────────────
  const noViews = loadWith(['layer-views.js']);
  const drawnNoViews = draw(noViews.win, MAIN);
  check('without layer-views the sheet still paints', drawnNoViews.ok, drawnNoViews.why);
  check('without layer-views NO stair note is drawn',
    !drawnNoViews.texts.some(t => STAIR.test(t)),
    'the stage drew stairs without the module that gates it -- this check is '
    + 'measuring the wrong thing');
  check('without layer-views it SAYS so, and names the file',
    noViews.warnings.some(w => /layer-views\.js/.test(w) && /stair/i.test(w)),
    noViews.warnings.join(' / ') || '(silent)');

  // ── cut-view.js: the drawing standards ────────────────────────────────
  const noCut = loadWith(['cut-view.js']);
  draw(noCut.win, MAIN);
  check('without cut-view it SAYS so, and names the file',
    noCut.warnings.some(w => /cut-view\.js/.test(w)),
    noCut.warnings.join(' / ') || '(silent)');

  // ── AND THE FAULT A PRESENT TAG CAN STILL HAVE ────────────────────────
  //
  // cut-view.js destructures DraftFormatters at load. Loaded before it, the
  // file is there and the module is not -- which is what REALESTATEPLAN
  // actually shipped. The warning has to cover that too, or it only catches
  // the easy half.
  const brokenCut = loadWith(['formatters.js']);
  draw(brokenCut.win, MAIN);
  check('cut-view present but throwing on load warns the same way',
    brokenCut.warnings.some(w => /cut-view\.js/.test(w)),
    brokenCut.warnings.join(' / ') || '(silent)');

  // ── ONCE, NOT PER PAINT ───────────────────────────────────────────────
  const repeat = loadWith(['layer-views.js']);
  draw(repeat.win, MAIN); draw(repeat.win, MAIN); draw(repeat.win, MAIN);
  const stairWarnings = repeat.warnings.filter(w => /layer-views\.js/.test(w));
  check('the warning is said once however many times the sheet paints',
    stairWarnings.length === 1, `said ${stairWarnings.length} times`);

  if (label) console.log(label);
}

if (!MUTATE) {
  run();
  console.log(failures ? `layout-plan-harness: ${failures} FAILED` : 'layout-plan-harness: all checks pass');
  process.exit(failures ? 1 : 0);
}

// ── MUTATIONS ───────────────────────────────────────────────────────────
//
// Each edits layout-plan.js (or a module it reads) in memory and asserts the
// checks above go red. A check that survives its own mutation is not a check.
const MUTATIONS = [
  ['stair stage runs without VIEWS',
    'layout-plan.js', c => c.replace('stairs && LEVELS && VIEWS ? {', 'stairs && LEVELS ? {')],
  ['layer-views warning deleted',
    'layout-plan.js', c => c.replace(/if \(!warnedNoLayerViews && stairs[\s\S]*?\n    \}\n/, '')],
  ['cut-view warning deleted',
    'layout-plan.js', c => c.replace(/if \(!warnedNoStandards[\s\S]*?\n    \}\n/, '')],
  ['layer-views warning fires even when present',
    'layout-plan.js', c => c.replace('!warnedNoLayerViews && stairs && LEVELS && !VIEWS',
      '!warnedNoLayerViews && stairs && LEVELS')],
  ['cut-view warning loses the filename',
    'layout-plan.js', c => c.replace('cut-view.js is not loaded', 'a module is not loaded')],
  ['the warning repeats on every paint',
    'layout-plan.js', c => c.replace('warnedNoLayerViews = true;', 'warnedNoLayerViews = false;')],
];

let caught = 0;
for (const [name, file, edit] of MUTATIONS) {
  const before = failures;
  const origLoad = loadWith;
  // eslint-disable-next-line no-func-assign
  loadWith = (omit = [], source = {}) => origLoad(omit, { ...source, [file]: edit });
  try { run(); } catch { failures += 1; }
  loadWith = origLoad;
  const died = failures > before;
  if (died) caught += 1;
  else console.log(`  SURVIVED  ${name}`);
  failures = before;
}
console.log(`layout-plan-harness: ${caught}/${MUTATIONS.length} mutations caught`);
process.exit(caught === MUTATIONS.length ? 0 : 1);
