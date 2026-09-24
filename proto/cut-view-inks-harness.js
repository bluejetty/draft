// WHAT THE ELEVATION PAINTER ACTUALLY PUTS ON THE CANVAS, on every skin.
//
// cut-view.js was the last painter in the app that had never been skinned. It
// carried 58 colour assignments over 14 distinct literals, and MODEL.html
// cleared its canvas to skin['surface-page'] and then handed the painter
// nothing -- so the painter filled straight over that clear with its own
// #fafafa and a drafter working at night got a white rectangle with black
// lines on it. Movie, 24 Sep: "would it be possible to make the background of
// the elevations black when in NIGHT mode? ... or should we reverse the lines
// to white? like on the PROJECT Sections?"
//
// A TEXT SCAN WOULD NOT HAVE CAUGHT THAT, and would not catch it coming back.
// The literals were all real code; the defect was that nobody passed anything
// else. So this harness does not read the file -- it RUNS the painter over
// eight real drawings, records every fillStyle and strokeStyle that reaches
// the context, and asks whether the set is exactly the table's. A literal
// added anywhere in 2,400 lines shows up as a value that belongs to no ink.
//
// THE CHECK THAT MATTERS MOST is the last one: on a dark skin, NO PAPER VALUE
// MAY SURVIVE. That is the actual failure -- not "a literal exists" but "a
// literal reaches the canvas while the page is dark" -- and it is the one a
// reviewer cannot make by reading.
//
// AND THE PAPER PATH IS PINNED JUST AS HARD, because the Construction Layout
// draws these same elevations as viewports on a sheet that gets PRINTED. That
// one passes no colours and must keep every value it has always had.
//
// Run: node proto/cut-view-inks-harness.js          (checks)
//      node proto/cut-view-inks-harness.js --mutate (checks + mutation table)
const fs = require('fs');
const path = require('path');
const MUTATION_MODE = require('./harness-args.js').mutationMode();
const H = require('./elevation-harness.js');

const win = H.loadDraftModules();
let CV = win.DraftCutView;

// palette.js does not run under elevation-harness's window, so it gets its
// own. It is a pure table with no DOM in it.
const paletteWindow = {};
(function loadPalette() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'palette.js'), 'utf8');
  new Function('window', src)(paletteWindow);
}());
const P = paletteWindow.DraftPalette;

// ── Running the painter and watching what it paints ───────────────────
//
// A recorder rather than a canvas: the question is which INKS were chosen,
// and a rasteriser would answer it in pixels that have been blended.
function inksUsed(opts) {
  const seen = new Set();
  const ctx = new Proxy({
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, stroke() {},
    fill() {}, fillRect() {}, strokeRect() {}, clearRect() {}, rect() {},
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
    setLineDash() {}, getLineDash: () => [], fillText() {}, strokeText() {},
    measureText: () => ({ width: 0 }), arc() {}, ellipse() {},
    quadraticCurveTo() {}, bezierCurveTo() {}, clip() {}, roundRect() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    strokeStyle: '#000', fillStyle: '#000', lineWidth: 1, font: '',
    textAlign: '', textBaseline: '', lineCap: 'butt', lineJoin: 'miter',
    globalAlpha: 1,
  }, {
    set(obj, prop, value) {
      if (prop === 'fillStyle' || prop === 'strokeStyle') seen.add(String(value));
      obj[prop] = value;
      return true;
    },
  });
  for (const { env, cuts } of SUBJECTS) {
    for (const cut of cuts) CV.drawCutView(env, ctx, 900, 600, cut, opts);
  }
  return seen;
}

// EIGHT DRAWINGS, and every one of them a house somebody hit a bug with. A
// single fixture would exercise one branch of a painter that has a different
// path for a garage, a courtyard, a walkout and a two-storey.
const DRAWINGS = ['repro-garage-house', 'repro-L-house', 'repro-courtyard-house',
  'repro-2storey-garage', 'repro-bungalow-garage-roofs', 'repro-washroom-bungalow',
  'repro-movie-garage-2storey', 'perf-bungalow'];

const SUBJECTS = DRAWINGS.map((name) => {
  const saved = JSON.parse(fs.readFileSync(
    path.join(__dirname, `${name}.draft`), 'utf8'));
  const env = H.buildEnv(win, saved);
  const walls = env.walls();
  const xs = walls.flatMap(w => [w.start.x, w.end.x]);
  const zs = walls.flatMap(w => [w.start.z, w.end.z]);
  const mid = zs.reduce((a, b) => a + b, 0) / (zs.length || 1);
  // BOTH PAINTERS. An elevation and a section share almost nothing below
  // drawCutView -- different branch, different helpers, different inks -- so
  // a set collected from elevations alone would miss the concrete poche and
  // the floor assembly band entirely.
  const sections = (saved.cuts || []).length ? saved.cuts : [{
    id: 'S1', name: 'S1', elev: 0, levelId: null,
    startPt: { x: Math.min(...xs) - 10, z: mid },
    endPt: { x: Math.max(...xs) + 10, z: mid },
    dirVec: { x: 0, z: 1 },
  }];
  return { name, env, cuts: [...H.standardElevationCuts(env), ...sections] };
});

// Every colour the table can produce, at the weights the painter applies.
// Derived from the painter's own table so the two cannot drift: a weight
// added in cut-view.js and not here shows up as an unexplained ink.
const WEIGHTS = Object.freeze({
  ink: [0.12, 0.25, 0.35, 0.45, 0.5, 0.55, 0.6],
  concrete: [0.35, 0.5],
  assembly: [0.15],
});
const expectedFrom = (C) => new Set([
  C.ground, C.line, C.face, C.faceShade, C.recess,
  ...WEIGHTS.ink.map(a => `rgba(${C.ink},${a})`),
  ...WEIGHTS.concrete.map(a => `rgba(${C.concrete},${a})`),
  ...WEIGHTS.assembly.map(a => `rgba(${C.assembly},${a})`),
]);

const CHECKS = [];
const check = (label, fn) => CHECKS.push({ label, fn });
const list = set => [...set].sort().join(' ');

// ── The instrument is real ────────────────────────────────────────────
// Same argument the other harnesses in here make: a recorder that catches
// nothing reports the same empty set as a painter with no colours.

check('the recorder sees the painter choose inks at all',
  () => [inksUsed(undefined).size > 5, true]);
check('and it sees a colour the caller passed, not one it assumed',
  () => [inksUsed({ colors: { ground: '#c0ffee' } }).has('#c0ffee'), true]);
check('the eight drawings all loaded',
  () => [SUBJECTS.filter(s => s.cuts.length >= 5).length, DRAWINGS.length]);

// ── Paper, which the Construction Layout depends on ───────────────────

check('with no colours passed, the painter uses exactly the paper table',
  () => [list(inksUsed(undefined)), list(expectedFrom(CV.PAPER_INKS))]);
check('and paperColor still means the ground, the name both callers use',
  () => [inksUsed({ paperColor: '#ffffff' }).has('#ffffff'), true]);
check('the paper table is the literals this painter always carried',
  () => [JSON.stringify(CV.PAPER_INKS),
    JSON.stringify({
      ground: '#fafafa', line: '#1d1f20', ink: '29,31,32', face: '#fff',
      faceShade: '#e8e8ea', recess: '#fafafa', concrete: '150,150,155',
      assembly: '89,128,166',
    })]);

// ── Every skin ────────────────────────────────────────────────────────

// EVERY ONE OF THESE ASKS THE MODULE AGAIN INSIDE ITS OWN BODY, and that is
// not a style choice. The first draft resolved `const C = CV.inksFromSkin(skin)`
// out here in the loop and closed over it, so the twenty checks below were
// frozen at whatever the mapping said when the file was read -- they could not
// fail, whatever a mutation did to it.
//
// THE MUTATION TABLE IS WHAT SAID SO, and it said it in a way worth keeping:
// all nine mutants were CAUGHT, 9/9, and every single one of them was caught
// FIRST BY THE SAME CHECK. A column of identical answers is not a healthy
// gate -- it means one check is doing all the work and the rest are scenery.
// A mutant killed by a check other than the one aimed at it has proved
// nothing about that check.
for (const theme of P.THEMES) {
  for (const mode of P.MODES) {
    const skin = P.resolve(theme, mode);
    const inks = () => CV.inksFromSkin(skin);

    check(`${theme}/${mode}: the painter uses exactly the skin's table`,
      () => [list(inksUsed({ colors: inks() })), list(expectedFrom(inks()))]);

    // NOTHING INVENTED. If a thing this painter draws has no role, the honest
    // answer is to add one to palette.js where its contrast is measured
    // against every skin -- not to pick a grey here that looks right on
    // whichever skin happened to be open.
    check(`${theme}/${mode}: every ink comes from a palette role`, () => {
      const C = inks();
      const roleValues = new Set(P.ROLES.map(r => String(skin[r])));
      const triples = new Set(P.ROLES.map(r => tripleOf(skin[r])));
      const stray = ['ground', 'line', 'face', 'faceShade', 'recess']
        .filter(k => !roleValues.has(String(C[k])))
        .concat(['ink', 'concrete', 'assembly'].filter(k => !triples.has(C[k])));
      return [stray.join(' '), ''];
    });

    // THE DRAWING HAS TO READ, and this is the half a value table cannot
    // promise. Three separations, each one a thing that would disappear:
    //   the line on the page   -- a roof outline against the sky
    //   the line on a wall     -- every opening and every floor line
    //   the wall on the page   -- the house as a mass
    // The thresholds are the ones the paper drawing already clears, so they
    // are a floor this painter has always met rather than a bar invented for
    // the skins.
    check(`${theme}/${mode}: the line reads on the page`,
      () => [P.contrast(inks().line, inks().ground) >= 3, true]);
    check(`${theme}/${mode}: the line reads on a wall face`,
      () => [P.contrast(inks().line, inks().face) >= 3, true]);
    check(`${theme}/${mode}: a wall face is distinct from the page`,
      () => [P.contrast(inks().face, inks().ground) >= 1.1, true]);
    check(`${theme}/${mode}: concrete is distinct from a wall face`,
      () => [P.contrast(inks().faceShade, inks().face) >= 1.05, true]);
  }
}

// THE ONE THAT WOULD HAVE CAUGHT THE DEFECT. Not "a literal exists" -- they
// all did, legitimately -- but "a paper value reaches the canvas while the
// page is dark", which is what a drafter actually saw.
check('on a night skin, not one paper value survives to the canvas', () => {
  const paper = expectedFrom(CV.PAPER_INKS);
  const leaked = new Set();
  for (const theme of P.THEMES) {
    const C = CV.inksFromSkin(P.resolve(theme, 'night'));
    // A VALUE THE NIGHT TABLE ITSELF PRODUCES IS NOT A LEAK, and the first
    // version of this check did not say so and went red on its first run.
    // #1d1f20 is paper's LINE and it is also night's surface-page, so every
    // dark elevation legitimately paints it -- as the sky. Comparing the two
    // tables by raw string made the page look like ink that had escaped.
    //
    // The same coincidence is why rgba(89,128,166,0.15) is not a leak either:
    // draw-floor-edge is that exact blue on all four skins, so the floor
    // assembly band is deliberately the same colour on paper and on a screen.
    // One `mine` set covers both cases and needs no exception list.
    const mine = expectedFrom(C);
    for (const ink of inksUsed({ colors: C })) {
      if (paper.has(ink) && !mine.has(ink)) leaked.add(ink);
    }
  }
  return [list(leaked), ''];
});

// A property worth pinning rather than rediscovering: the cut view uses only
// BASE roles, so RUFF and ROUGH draw the identical picture and only the
// chrome around it changes. Proven in pixels when this landed; kept here
// because a future mapping that reached for --accent would break it silently.
check('RUFF and ROUGH draw the same picture, on both modes', () => {
  const diffs = P.MODES.filter(mode =>
    JSON.stringify(CV.inksFromSkin(P.resolve('ruff', mode)))
    !== JSON.stringify(CV.inksFromSkin(P.resolve('rough', mode))));
  return [diffs.join(' '), ''];
});

// And the day skin is the paper drawing, which is why the change was safe to
// make: a drafter with the lights on sees what they always saw.
check('on DAY the line and its weights are the paper ink, unchanged', () => {
  const C = CV.inksFromSkin(P.resolve('ruff', 'day'));
  return [`${C.line}/${C.ink}`, `${CV.PAPER_INKS.line}/${CV.PAPER_INKS.ink}`];
});

function tripleOf(css) {
  const s = String(css).trim();
  const fn = s.match(/^rgba?\(([^)]+)\)$/i);
  if (fn) return fn[1].split(',').slice(0, 3).map(v => Math.round(parseFloat(v))).join(',');
  let hex = s.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (hex.length < 6) return s;
  return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',');
}

// ── Runner ────────────────────────────────────────────────────────────

function run() {
  const missed = [];
  for (const { label, fn } of CHECKS) {
    let got, want;
    try { [got, want] = fn(); } catch (err) { got = `threw ${err.message}`; want = null; }
    if (got !== want) missed.push({ label, got, want });
  }
  return missed;
}

const baseline = run();
for (const m of baseline) console.log(`  FAIL ${m.label}\n       got ${m.got}\n      want ${m.want}`);
console.log(`\n${CHECKS.length - baseline.length}/${CHECKS.length} checks passed`
  + `  (${SUBJECTS.length} drawings, ${SUBJECTS.reduce((n, s) => n + s.cuts.length, 0)} cuts)`);

// ── Mutations ─────────────────────────────────────────────────────────
//
// The subject is a live module, so a mutation swaps the MAPPING rather than
// editing the file -- same reason skinned-page-harness swaps its reader.
// Nothing here writes to the repo.
const swapping = (broken, thenRun) => {
  const real = CV;
  CV = { ...CV, ...broken };
  try { return thenRun(); } finally { CV = real; }
};
// THE REAL MAPPING IS CAPTURED BEFORE THE SWAP, and that is not a nicety.
// The first version read `CV.inksFromSkin` from INSIDE the replacement, by
// which time CV had already been reassigned to the replacement itself -- so
// every mutant recursed until the stack blew, every check in the file threw,
// and the table printed a proud 9/9 with a perfectly uniform CAUGHT BY column.
// That column is the only reason it was noticed: nine different mutants
// cannot honestly all die to the same check, and "why is this so tidy" is a
// better instinct here than "good, it passes".
const withMapping = fn => () => {
  const real = CV.inksFromSkin;
  return swapping({ inksFromSkin: skin => fn(real(skin), skin) }, run);
};

const MUTATIONS = [
  // THE DEFECT ITSELF, in the two shapes it could come back in.
  ['THE BUG: the ground stays paper while the page goes dark',
    withMapping(C => ({ ...C, ground: '#fafafa' }))],
  ['THE BUG, HALFWAY: the ground follows the skin and the lines do not -- '
    + 'black on black, which is what "just make the background black" buys',
    withMapping((C, skin) => ({ ...C, line: '#1d1f20', ink: '29,31,32',
      ground: skin['surface-page'] }))],

  // Each separation the drawing needs, removed one at a time.
  ['the wall face is painted the page colour, so the house stops being a mass',
    withMapping((C, skin) => ({ ...C, face: skin['surface-page'] }))],
  ['concrete is painted the same as a wall face, so the materials merge',
    withMapping(C => ({ ...C, faceShade: C.face }))],
  ['the line is dropped to a quiet grey that does not read on the page',
    withMapping((C, skin) => ({ ...C, line: skin['surface-chip'] }))],

  // An invented value, which is the slow version of the same bug.
  ['a grey is invented here instead of taken from a role',
    withMapping(C => ({ ...C, faceShade: '#999999' }))],
  ['a triple is invented instead of read off a role',
    withMapping(C => ({ ...C, concrete: '123,45,67' }))],

  // The theme-independence property.
  ['the mapping reaches for the accent, so RUFF and ROUGH diverge',
    withMapping((C, skin) => ({ ...C, line: skin.accent, ink: tripleOf(skin.accent) }))],

  // And the paper path, which the printed sheet depends on.
  ['the paper default drifts off the literal the sheet has always printed',
    () => swapping({ PAPER_INKS: { ...CV.PAPER_INKS, ground: '#f8f8f8' } }, run)],
];

if (MUTATION_MODE) {
  console.log('\nMUTATION                                                              CAUGHT BY');
  let survivors = 0, broken = 0;
  for (const [label, apply] of MUTATIONS) {
    let by;
    try {
      const missed = apply();
      if (!missed.length) survivors += 1;
      // WHICH CHECK, NOT HOW MANY. One check here compares the whole emitted
      // set against the whole table, so it fires for every mutant and would
      // report a perfect column while the specific checks beside it did
      // nothing -- which is exactly what the first run of this table showed.
      // So the blanket ones are set aside and the SPECIFIC check is named: if
      // a mutant is caught only by "the painter uses exactly the table", the
      // check written for that failure is not doing its job.
      const blanket = /uses exactly the/;
      const specific = missed.map(m => m.label).filter(l => !blanket.test(l));
      by = !missed.length ? '*** NOTHING ***'
        : specific.length ? specific[0].replace(/^\w+\/\w+: /, '')
        : `ONLY THE BLANKET CHECK (${missed.length}) — no specific check caught this`;
    } catch (err) { broken += 1; by = `!!! DID NOT APPLY: ${err.message}`; }
    console.log(`${label.slice(0, 68).padEnd(70)}${by}`);
  }
  console.log(`\n${MUTATIONS.length - survivors - broken}/${MUTATIONS.length} mutations caught`);
  if (broken) console.log(`${broken} mutation(s) never applied -- they prove nothing`);
  process.exit(baseline.length || survivors || broken ? 1 : 0);
}

process.exit(baseline.length ? 1 : 0);
