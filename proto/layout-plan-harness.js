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
// THROUGH harness-args, NOT ITS OWN ARGV, and the reason is CI rather than
// tidiness: the engine list the workflow runs is derived by grepping for a
// call INTO that file, so a harness parsing its own flags owns a mutation
// table nothing but a person at a keyboard ever runs. This one had a real
// table and nine rows CI could not see.
const MUTATE = require('./harness-args.js').mutationMode();

// Everything layout-plan needs to draw, in load order. The four under test
// are named separately so a case can drop one by name.
const BASE = ['formatters.js', 'wall-types.js', 'geometry-2d.js', 'drawing-format.js',
  'room-standards.js', 'level-assembly.js', 'stair-geometry.js', 'closets.js',
  'fixture-geometry.js', 'render-2d.js', 'plan-composition.js'];
const OPTIONAL = ['layer-views.js', 'cut-view.js', 'build-house.js', 'roof-types.js',
  'profile-manager.js', 'finish-patterns.js', 'roof-patterns.js', 'cut-marks.js',
  'fen-labels.js', 'electric-symbols.js', 'hologram.js', 'door-bucks.js'];

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
  // `inks` RIDES BESIDE `strokes` rather than inside it: every check in this
  // file reads `strokes` as a list of ALPHAS, so a stroke that came back as an
  // object would have rewritten all of them to add one question. The two lists
  // are the same length and the same order, so strokes[i] and inks[i] are one
  // stroke asked two ways.
  const texts = [], alphas = [], strokes = [], inks = [], stack = [];
  const ctx = {
    texts, alphas, strokes, inks, globalAlpha: 1, strokeStyle: '#000',
    save() { stack.push(this.globalAlpha); },
    restore() { if (stack.length) this.globalAlpha = stack.pop(); },
    beginPath() {}, closePath() {}, moveTo() {},
    lineTo() {}, arc() {}, rect() {},
    stroke() { strokes.push(this.globalAlpha); inks.push(this.strokeStyle); }, fill() {}, clip() {},
    fillRect() {}, strokeRect() {}, translate() {}, rotate() {}, scale() {},
    setLineDash() {}, quadraticCurveTo() {}, bezierCurveTo() {}, ellipse() {},
    fillText(t) { texts.push(String(t)); alphas.push(this.globalAlpha); },
    strokeText(t) { texts.push(String(t)); alphas.push(this.globalAlpha); },
    measureText() { return { width: 0 }; }, setTransform() {}, getTransform() {
      return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    },
  };
  return ctx;
}

const SAVED = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'proto', 'repro-movie-bands.draft'), 'utf8'));
const toS = p => ({ x: (p.x || 0) * 10 + 400, y: (p.z || 0) * 10 + 300 });

function draw(win, levelId, { saved = SAVED, env = {} } = {}) {
  const ctx = recorder();
  const LP = win.DraftLayoutPlan;
  if (!LP) return { ok: false, texts: [], why: 'DraftLayoutPlan never defined' };
  try {
    LP.drawPlan(ctx, toS, saved, levelId, env);
    return { ok: true, texts: ctx.texts, alphas: ctx.alphas, strokes: ctx.strokes,
      inks: ctx.inks, endAlpha: ctx.globalAlpha };
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

  // ── THE STOREY UNDER THIS ONE, GHOSTED (Movie, 12 Oct) ───────────────
  //
  // "show a very lightweight line that shows that ext wall outlines of the
  // wlls below and then adjust the scale so the larger plan with the extra
  // lightweight lines fits on the upper floors (which are smaller without
  // the background lines)".
  //
  // THE FIXTURE IS HIS CASE EXACTLY, which is why it is used rather than one
  // written for the occasion: MAIN FL's outlines reach z = 46 because of the
  // garage, and 2ND FL's stop at 38. The floor below really is bigger than
  // the floor being drawn, so the frame really does have to grow.
  {
    const LP = full.win.DraftLayoutPlan;
    const spanZ = levelId => {
      const box = LP.planBounds(SAVED, levelId);
      return box ? Math.round((box.maxZ - box.minZ) * 100) / 100 : null;
    };
    const loopBox = loops => loops.reduce((box, pts) => pts.reduce((b, pt) => ({
      minZ: Math.min(b.minZ, pt.z), maxZ: Math.max(b.maxZ, pt.z),
    }), box), { minZ: Infinity, maxZ: -Infinity });

    check('the fixture has a floor below that is BIGGER than the floor above',
      loopBox(LP.floorBelowLoops(SAVED, 5)).maxZ > loopBox(
        (SAVED.outlines || []).filter(o => o.levelId === 5).map(o => o.points)).maxZ,
      'nothing in this fixture reaches past the upper floor, so the frame check '
      + 'below cannot tell a grown frame from an ungrown one');

    // WHICH LEVEL IS BELOW, off the storey ladder and not off `elev`. SITE
    // and MAIN FL both sit at elev 0 in this very fixture, so an elevation
    // comparison would have to break that tie by guessing.
    check('2ND FL shows MAIN FL under it', LP.floorBelow(SAVED, 5) === 3,
      String(LP.floorBelow(SAVED, 5)));
    check('MAIN FL shows nothing under it -- the foundation is not a storey',
      LP.floorBelow(SAVED, 3) === null, String(LP.floorBelow(SAVED, 3)));
    check('ROOF and SITE are not floors and get no ghost',
      LP.floorBelow(SAVED, 7) === null && LP.floorBelow(SAVED, 8) === null);

    // THE HALF-FLOOR IS SKIPPED, and this needs a fixture of its own: the
    // repro has no outline on 1.5 at all, so leaving the skip out changes
    // nothing in it and the rule sits unpinned (the mutation table said so --
    // 'the half-floor already on the sheet is ghosted again' survived).
    // 1.5 is drawn on 2ND FL's sheet IN FULL by the half-level pass, so
    // ghosting it as well would be the same lines twice, the second set
    // fainter; the storey below the PAIR is what an upper floor is missing.
    const withHalf = {
      ...SAVED,
      outlines: [
        ...(SAVED.outlines || []),
        { id: 9001, levelId: 4, points: [
          { x: -8, z: -8 }, { x: 8, z: -8 }, { x: 8, z: 8 }, { x: -8, z: 8 }] },
      ],
    };
    // The fixture's own reach, and it cannot be asked through
    // floorBelowLoops: the skip is exactly what makes that come back empty,
    // so asking it there would be asking the rule to prove itself.
    check('the fixture really does put an outline on 1.5 to be picked up by mistake',
      withHalf.outlines.some(o => o.levelId === 4 && o.points.length >= 3)
      && !(SAVED.outlines || []).some(o => o.levelId === 4),
      'nothing was added on 1.5, so the skip below is not being tested');
    check('2ND FL still shows MAIN FL, not the 1.5 already drawn on its sheet',
      LP.floorBelow(withHalf, 5) === 3, String(LP.floorBelow(withHalf, 5)));

    // THE FRAME TAKES IT IN. Without this the ghost is drawn outside the
    // viewport and clipped -- on screen a pan, on paper gone.
    //
    // MEASURED AGAINST THE SAME LEVEL WITHOUT THE GHOST, not against MAIN
    // FL's own frame. The first version of this check compared the two
    // levels' spans and failed at 72 against 76.5 -- correctly, because MAIN
    // FL's frame also carries MAIN FL's DIMENSION rows, and a dimension on
    // the floor below is not something an upper floor ghosts. The question is
    // whether 2ND FL's own frame GREW, so the comparison is 2ND FL with the
    // storey below against 2ND FL with it taken away.
    const withoutBelow = {
      ...SAVED,
      outlines: (SAVED.outlines || []).filter(outline => outline.levelId !== 3),
    };
    const spanWithout = (() => {
      const box = LP.planBounds(withoutBelow, 5);
      return box ? Math.round((box.maxZ - box.minZ) * 100) / 100 : null;
    })();
    check('the ghost has nothing to add once the floor below is taken away',
      LP.floorBelowLoops(withoutBelow, 5).length === 0);
    check('2ND FL\'s frame GREW to take the floor below in',
      spanZ(5) > spanWithout,
      `with the ghost ${spanZ(5)}, without it ${spanWithout}`);
    const below = loopBox(LP.floorBelowLoops(SAVED, 5));
    const frame = LP.planBounds(SAVED, 5);
    check('and reaches it by the real extent rather than by luck',
      frame.maxZ >= below.maxZ && frame.minZ <= below.minZ,
      `frame ${frame.minZ}..${frame.maxZ} vs ghost ${below.minZ}..${below.maxZ}`);

    // AND IT IS DRAWN, LIGHTLY. 0.3 is its own alpha -- the half-floor and
    // the basement's foundation both use 0.6 -- so the stroke can be told
    // apart from theirs.
    const lightStrokes = drawn => (drawn.strokes || [])
      .filter(a => a > 0.2 && a < 0.45).length;
    const upper = draw(full.win, 5);
    check('2ND FL draws the ghost', upper.ok && lightStrokes(upper) > 0,
      upper.why || `alphas stroked: ${(upper.strokes || []).join(', ')}`);
    const main = draw(full.win, 3);
    check('MAIN FL draws no ghost, having no storey under it',
      main.ok && lightStrokes(main) === 0,
      main.why || `alphas stroked: ${(main.strokes || []).join(', ')}`);
    check('and the ghost leaves the alpha as it found it',
      upper.endAlpha === 1, String(upper.endAlpha));

    // THE TWO MODES THAT DECLINE IT, for the reasons those modes exist. A
    // SHELL is this house at 1"=40' among its neighbours; a HOLOGRAM is
    // another drawing shown under this one, so its own storey below would be
    // a ghost two buildings deep.
    const shell = draw(full.win, 5, { env: { shell: true } });
    check('a shell draws no ghost', shell.ok && lightStrokes(shell) === 0,
      shell.why || `alphas stroked: ${(shell.strokes || []).join(', ')}`);
    const holo = draw(full.win, 5, { env: { hologram: true } });
    check('a hologram draws no ghost', holo.ok && lightStrokes(holo) === 0,
      holo.why || `alphas stroked: ${(holo.strokes || []).join(', ')}`);
    // A LISTING KEEPS IT: that mode takes away dimensions and sizes, and this
    // is geometry.
    const listing = draw(full.win, 5, { env: { listing: true } });
    check('a listing plan keeps the ghost', listing.ok && lightStrokes(listing) > 0,
      listing.why || `alphas stroked: ${(listing.strokes || []).join(', ')}`);

    // AND THE FRAME CAN BE TOLD TO LEAVE IT OUT, for the shell caller, whose
    // box has to agree with its ink either way.
    const noGhostBox = LP.planBounds(SAVED, 5, { floorBelow: false });
    check('planBounds can decline the ghost for a caller that does not draw it',
      noGhostBox && Math.round((noGhostBox.maxZ - noGhostBox.minZ) * 100) / 100 === spanWithout,
      `${noGhostBox && noGhostBox.maxZ - noGhostBox.minZ} vs ${spanWithout}`);
  }

  // ── level-assembly.js: the storey ladder the ghost reads ──────────────
  // The ladder arrives off `window` like the four below, so it fails the same
  // silent way: an absent module reads as an empty object, every floor has
  // nothing under it, and the sheet looks finished.
  {
    const noLadder = loadWith(['level-assembly.js']);
    const drawnNoLadder = draw(noLadder.win, 5);
    check('without level-assembly the sheet still paints',
      drawnNoLadder.ok, drawnNoLadder.why);
    check('without level-assembly NO ghost is drawn',
      (drawnNoLadder.strokes || []).filter(a => a > 0.2 && a < 0.45).length === 0,
      'a ghost was drawn without the ladder that decides which level it is -- '
      + 'this check is measuring the wrong thing');
    check('without level-assembly it SAYS so, and names the file',
      noLadder.warnings.some(w => /level-assembly\.js/.test(w) && /below/i.test(w)),
      noLadder.warnings.join(' / ') || '(silent)');
  }

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

  // ── THE VIEW'S OWN LAYER LIST, WHICH THIS FILE IS THE ONLY SOURCE OF ──
  //
  // plan-composition.js gates on `viewLayers`; nothing composes one but
  // here. The harness beside it proves the gate works when handed a list --
  // this proves a list is handed over at all, and that it is the list for
  // the view being drawn rather than some other view's.
  //
  // TWO DIMENSIONS ON THE SAME DRAWING, differing only in their layer:
  // level 3's FLOOR PLAN carries A-DIMS-INT and does NOT carry A-DIMS-COLS,
  // so the interior string prints and the column string does not. Lengths
  // are odd on purpose -- a round one collides with the fixture's own
  // auto-dims and the check would read another string's text as this one's.
  const tagged = {
    ...SAVED,
    dimensions: [
      ...(SAVED.dimensions || []),
      { id: 90001, levelId: MAIN, view: 'plan', layer: 'A-DIMS-INT',
        start: { x: 0, y: 0, z: 40 }, end: { x: 17.25, y: 0, z: 40 } },
      { id: 90002, levelId: MAIN, view: 'plan', layer: 'A-DIMS-COLS',
        start: { x: 0, y: 0, z: 44 }, end: { x: 19.75, y: 0, z: 44 } },
    ],
  };
  const INT = /17'/, COLS = /19'/;
  const onPlan = draw(full.win, MAIN, { saved: tagged, env: { view: 'plan' } });
  check('a layer the view carries is drawn on that view',
    onPlan.texts.some(t => INT.test(t)),
    `texts: ${onPlan.texts.join(' | ') || '(none)'}`);
  check('a layer the view does NOT carry is left off the sheet',
    !onPlan.texts.some(t => COLS.test(t)),
    'the column string printed on a view whose contents do not list it');

  // AND THE SAME STRING ON THE FLOOR LAYOUT OF THE SAME LEVEL, which does
  // carry A-DIMS-COLS. Without this the check above would pass just as well
  // on a list fetched for the level's default view -- 'plan' IS the default
  // for a floor level, so only a second, non-default view can tell the two
  // apart. The floor view needs walls of its own to compose at all.
  const onFloorView = {
    ...tagged,
    walls: [
      ...(SAVED.walls || []),
      ...(SAVED.walls || []).filter(w => w.levelId === MAIN)
        .map((w, i) => ({ ...w, id: 90100 + i, view: 'floor' })),
    ],
    dimensions: [
      ...tagged.dimensions,
      // FILED UNDER THE FOUNDATION, where the main floor's beam rows live: the
      // floor layout borrows them (structureUnder) and the view list gates them.
      { id: 90003, levelId: 1, view: 'foundation', layer: 'A-DIMS-COLS',
        start: { x: 0, y: 0, z: 48 }, end: { x: 19.75, y: 0, z: 48 } },
    ],
  };
  const floorSheet = draw(full.win, MAIN, { saved: onFloorView, env: { view: 'floor' } });
  check('the list is the drawn view-s, not the level-s default view-s',
    floorSheet.texts.some(t => COLS.test(t)),
    `texts: ${floorSheet.texts.join(' | ') || '(none)'}`);

  // A VIEWPORT THAT NAMES NO VIEW IS EVERY VIEW, and gating it against the
  // level's default view would silently change every layout saved before
  // views existed.
  const noView = draw(full.win, MAIN, { saved: tagged });
  check('a viewport with no view of its own gates nothing',
    noView.texts.some(t => INT.test(t)) && noView.texts.some(t => COLS.test(t)),
    `texts: ${noView.texts.join(' | ') || '(none)'}`);

  // ── ONCE, NOT PER PAINT ───────────────────────────────────────────────
  const repeat = loadWith(['layer-views.js']);
  draw(repeat.win, MAIN); draw(repeat.win, MAIN); draw(repeat.win, MAIN);
  const stairWarnings = repeat.warnings.filter(w => /layer-views\.js/.test(w));
  check('the warning is said once however many times the sheet paints',
    stairWarnings.length === 1, `said ${stairWarnings.length} times`);

  // ── THE HALF-FLOOR RIDES ON ITS FULL FLOOR (Movie, 7 Oct) ─────────────
  //
  // "in layout areas we will only need to show the MAIN floors and those
  // will show up too on them": the 0.5 floor's walls, openings and stairs
  // print on MAIN FL's sheet, lighter, under MAIN FL's own; its dimensions
  // and notes do not. The fixture's stairs and a dimension are moved to a
  // half-floor (level 2) that copies MAIN FL's walls 30 ft east.
  const HALF = 2;
  const halfWalls = (SAVED.walls || []).filter(w => w.levelId === MAIN)
    .map((w, i) => ({ ...w, id: 91000 + i, levelId: HALF,
      start: { ...w.start, x: (w.start?.x || 0) + 30 }, end: { ...w.end, x: (w.end?.x || 0) + 30 } }));
  const split = {
    ...SAVED,
    levels: [...SAVED.levels.filter(l => l.id !== HALF), { id: HALF, name: 'ENTRY', elev: -4 }],
    walls: [...(SAVED.walls || []).filter(w => w.levelId !== HALF), ...halfWalls],
    stairs: (SAVED.stairs || []).map(st => (st.levelId === MAIN ? { ...st, levelId: HALF } : st)),
    dimensions: [...(SAVED.dimensions || []),
      { id: 91900, levelId: HALF, view: 'plan', start: { x: 0, y: 0, z: 60 }, end: { x: 23.3125, y: 0, z: 60 } }],
  };
  const LPF = full.win.DraftLayoutPlan;
  const mainSheet = draw(full.win, MAIN, { saved: split });
  const halfStair = mainSheet.texts.findIndex(t => STAIR.test(t));
  check('the full floor\'s sheet draws its half-floor\'s stairs', halfStair >= 0,
    `texts: ${mainSheet.texts.slice(0, 8).join(' | ') || '(none)'}`);
  check('lighter than the full floor\'s own ink',
    halfStair >= 0 && mainSheet.alphas[halfStair] < 1, `alpha ${mainSheet.alphas[halfStair]}`);
  check('and the full floor\'s own ink is back to full strength',
    mainSheet.endAlpha === 1 && mainSheet.alphas.some(a => a === 1));
  check('the half-floor\'s dimensions stay off the full floor\'s sheet',
    !mainSheet.texts.some(t => /23'/.test(t)));
  check('the half-floor gets no sheet of its own once the full floor has walls',
    LPF.ridesOnFullFloor(split, HALF) === true && LPF.ridesOnFullFloor(split, MAIN) === false);
  const noMain = { ...split, walls: split.walls.filter(w => w.levelId !== MAIN) };
  check('but with no full floor drawn it still prints by itself',
    LPF.ridesOnFullFloor(noMain, HALF) === false);
  const box = LPF.planBounds(split, MAIN);
  const halfMaxX = Math.max(...halfWalls.map(w => Math.max(w.start.x, w.end.x)));
  check('the full floor\'s frame takes in its half-floor', box && box.maxX >= halfMaxX,
    `maxX ${box && box.maxX} < ${halfMaxX}`);

  const w = (id, levelId, view, a, b, extra = {}) => ({ id, levelId, view, wallType: 'stud_2x6',
    start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] }, baseHeight: 0, topHeight: 8,
    thickness: 0.5, ...extra });
  // ── THE FLOOR LAYOUT SHEET (Movie, 8 Oct) ─────────────────────────────
  //
  // A storey's FLOOR view has floors, not walls, and used to draw nothing on
  // a sheet. It draws its deck now, with the half-floor's deck lighter under.
  const fl = (id, levelId, pts) => ({ id, levelId, view: 'floor', structure: 'framed',
    points: pts.map(([x, z]) => ({ x, y: 0, z })) });
  const floorHouse = {
    ...SAVED,
    levels: [{ id: 2, name: 'ENTRY', elev: -4 }, { id: 3, name: 'MAIN FL', elev: 0 }],
    walls: [], floors: [fl('f3', 3, [[0, 0], [30, 0], [30, 20], [0, 20]])],
    roofs: [], stairs: [], dimensions: [], notes: [], lines: [], shapes: [], fixtures: [],
    beams: [], columns: [], roomTags: [], fenestrations: [], outlines: [], surfaceOpenings: [],
  };
  const LPF2 = full.win.DraftLayoutPlan;
  const floorStrokes = saved => draw(full.win, 3, { saved, env: { view: 'floor' } }).strokes;
  check('a floor layout with no walls is a floor layout', LPF2.hasFloorLayout(floorHouse, 3) === true
    && LPF2.hasFloorLayout(floorHouse, 2) === false);
  check('and its sheet draws the deck', floorStrokes(floorHouse).length > 0,
    `${floorStrokes(floorHouse).length} strokes`);
  const withEntry = { ...floorHouse, floors: [...floorHouse.floors, fl('f2', 2, [[30, 5], [40, 5], [40, 15], [30, 15]])] };
  const entryStrokes = floorStrokes(withEntry);
  check('the 0.5 floor\'s deck comes onto the 1 FLOOR layout, lighter',
    entryStrokes.some(a => a < 1) && entryStrokes.some(a => a === 1),
    entryStrokes.join(','));
  check('and only on the floor layout, not the walls plan',
    draw(full.win, 3, { saved: { ...withEntry, walls: [w(96001, 3, 'plan', [0, 0], [30, 0])] }, env: { view: 'plan' } })
      .strokes.every(a => a === 1));

  // ── THE BASEMENT PLAN SHOWS ITS FOUNDATION, FADED (Movie, 7 Oct) ──────
  //
  // "show the FOUNDATION WALL (slightly lighter ...) (don't show footings,
  // but show where columns are located". The house's foundation walls and
  // posts come up faded under the basement's own walls; the garage's
  // foundation and its piles do not.
  const basement = {
    ...SAVED,
    levels: [{ id: 1, name: 'FOUNDATION', elev: -8 }, { id: 3, name: 'MAIN FL', elev: 0 }],
    walls: [
      w(95001, 1, 'plan', [4, 4], [12, 4]), w(95002, 1, 'plan', [12, 4], [12, 10]),
      ...[[[0, 0], [30, 0]], [[30, 0], [30, 20]], [[30, 20], [0, 20]], [[0, 20], [0, 0]]]
        .map(([a, b], i) => w(95100 + i, 1, 'foundation', a, b, { wallType: 'conc_8' })),
    ],
    floors: [], roofs: [], stairs: [], dimensions: [], notes: [], lines: [], shapes: [],
    fixtures: [], beams: [], roomTags: [], fenestrations: [], outlines: [], surfaceOpenings: [],
    columns: [],
  };
  const ghostStrokes = saved => draw(full.win, 1, { saved, env: { view: 'plan' } })
    .strokes.filter(a => a < 1).length;
  const withFdn = ghostStrokes(basement);
  check('the basement plan draws the foundation walls, lighter', withFdn > 0, `${withFdn} faded strokes`);
  check('and nothing faded without them',
    ghostStrokes({ ...basement, walls: basement.walls.filter(x => x.view === 'plan') }) === 0);
  const garage = { ...basement, walls: [...basement.walls,
    w(95200, 1, 'foundation', [30, 0], [60, 0], { body: 'garage' })] };
  check('the garage\'s foundation stays off the basement plan', ghostStrokes(garage) === withFdn,
    `${ghostStrokes(garage)} vs ${withFdn}`);
  const post = { ...basement, columns: [{ id: 1, levelId: 1, view: 'foundation', point: { x: 15, y: 0, z: 10 }, footing: 'pad36' }] };
  check('a post on the foundation shows where it stands', ghostStrokes(post) > withFdn,
    `${ghostStrokes(post)} vs ${withFdn}`);
  const pile = { ...basement, columns: [{ id: 2, levelId: 1, view: 'foundation', point: { x: 45, y: 0, z: 10 }, footing: 'pile12' }] };
  const pileSheet = draw(full.win, 1, { saved: pile, env: { view: 'plan' } });
  check('but no pile, which is a footing', ghostStrokes(pile) === withFdn
    && !pileSheet.texts.some(t => /pile/i.test(t)), `${ghostStrokes(pile)} vs ${withFdn}`);
  check('and the basement\'s own walls still at full strength',
    draw(full.win, 1, { saved: basement, env: { view: 'plan' } }).strokes.some(a => a === 1));
  check('the FOUNDATION sheet itself is not faded',
    draw(full.win, 1, { saved: basement, env: { view: 'foundation' } }).strokes.every(a => a === 1));

  // ── HOLOGRAMS (Movie, 8 Oct): ANOTHER .draft SHOWN UNDER THIS ONE ─────
  //
  // The building as drawn -- walls, stairs, fixtures -- without the other
  // drawing's dimension strings and notes, which would read as this one's.
  const DIM = /^\d+'-/;
  const sheet = draw(full.win, MAIN);
  const holo = draw(full.win, MAIN, { env: { hologram: true } });
  check('the construction sheet carries dimension strings to drop',
    sheet.texts.some(t => DIM.test(t)));
  check('a hologram draws no dimension strings', holo.ok && !holo.texts.some(t => DIM.test(t)),
    holo.texts.filter(t => DIM.test(t)).slice(0, 3).join(', '));
  check('but keeps the stairs', holo.texts.some(t => STAIR.test(t)));
  const noted = { ...SAVED, notes: [{ id: 'n1', levelId: MAIN, view: 'plan',
    anchor: { x: 2, y: 0, z: 2 }, text: { x: 6, y: 0, z: 6 }, body: 'EXISTING NOTE',
    end: 'arrow', layer: 'A-ANNO-NOTE' }] };
  check('the sheet draws a note', draw(full.win, MAIN, { saved: noted }).texts.includes('EXISTING NOTE'));
  check('a hologram leaves the note off',
    !draw(full.win, MAIN, { saved: noted, env: { hologram: true } }).texts.includes('EXISTING NOTE'));

  const F = full.win.DraftDrawingFormat;
  const [kept] = F.holograms([{ id: 'hologram-1', name: ' existing ', angleDeg: -90,
    source: { ...SAVED, holograms: [{ id: 'inner', source: SAVED }] } }]);
  check('a hologram keeps its copy of the other drawing',
    kept && kept.source.walls.length === SAVED.walls.length);
  check('but never that drawing\'s own holograms', kept && kept.source.holograms === undefined);
  check('a turn is kept inside a circle', kept && kept.angleDeg === 270);
  check('and the name trimmed', kept && kept.name === 'existing');
  check('a file that is not a drawing is not a hologram',
    F.holograms([{ id: 'h', source: { hello: 1 } }, { id: 'h2', source: { ...SAVED, version: 99 } }]).length === 0);
  const at = (h, pt) => F.hologramPoint(h, pt);
  const same = (a, b) => Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.z - b.z) < 1e-9;
  check('unmoved and unturned, a point stays where its own file has it',
    same(at({ x: 0, z: 0, angleDeg: 0, pivotX: 5, pivotZ: 5 }, { x: 3, z: 7 }), { x: 3, z: 7 }));
  check('a quarter turn spins about the pivot, the way the plan turns',
    same(at({ x: 0, z: 0, angleDeg: 90, pivotX: 10, pivotZ: 0 }, { x: 12, z: 0 }), { x: 10, z: 2 }));
  check('a point off the pivot\'s line turns the same way round',
    same(at({ x: 0, z: 0, angleDeg: 90, pivotX: 10, pivotZ: 0 }, { x: 10, z: 2 }), { x: 8, z: 0 }));
  check('and the slide comes after the turn',
    same(at({ x: 4, z: -1, angleDeg: 90, pivotX: 10, pivotZ: 0 }, { x: 12, z: 0 }), { x: 14, z: 1 }));

  // DEMO (Movie, 8 Oct): the ids coming out, by collection, and nothing else.
  const [marked] = F.holograms([{ id: 'h', source: SAVED,
    demo: { walls: ['w1', ' w1 ', ''], fenestrations: [], stairs: ['s1'] } }]);
  check('a DEMO list keeps each id once', marked && JSON.stringify(marked.demo) === '{"walls":["w1"]}',
    JSON.stringify(marked && marked.demo));
  check('a hologram with nothing marked carries no DEMO key',
    F.holograms([{ id: 'h', source: SAVED, demo: { walls: [] } }])[0].demo === undefined);
  // PART OF A WALL: a run along one wall, ends in order, nothing empty.
  const [cut] = F.holograms([{ id: 'h', source: SAVED, demo: { pieces: [
    { wallId: 'w1', from: 8, to: 3 }, { wallId: 'w1', from: -2, to: 1 },
    { wallId: 'w1', from: 4, to: 4 }, { wallId: '', from: 1, to: 2 }, { from: 1, to: 2 }] } }]);
  check('a piece keeps its ends in order', cut && cut.demo.pieces[0].from === 3 && cut.demo.pieces[0].to === 8,
    JSON.stringify(cut && cut.demo));
  check('a piece starts no earlier than the wall', cut && cut.demo.pieces[1].from === 0);
  check('an empty piece, or one on no wall, is dropped', cut && cut.demo.pieces.length === 2);
  check('pieces alone are a DEMO', cut && !cut.demo.walls && Array.isArray(cut.demo.pieces));

  // WHAT THE EXISTING PLAN KEEPS AND WHAT COMES OUT (hologram.js).
  const HG = full.win.DraftHologram;
  check('hologram.js loads', Boolean(HG && HG.parts));
  if (HG) {
    const w = (id, x0, x1) => ({ id, levelId: 1, view: 'plan', start: { x: x0, y: 0, z: 0 }, end: { x: x1, y: 0, z: 0 },
      wallType: 'stud_2x6', refLine: 'center' });
    const src = { version: 1, levels: [{ id: 1 }], walls: [w('a', 0, 20), w('b', 20, 40)],
      fenestrations: [{ id: 'f-in', wallId: 'a', levelId: 1, offset: 5, width: 3 },
        { id: 'f-run', wallId: 'a', levelId: 1, offset: 16, width: 2 },
        { id: 'f-b', wallId: 'b', levelId: 1, offset: 10, width: 3 }] };
    const split = HG.parts({ source: src, demo: { walls: ['b'], pieces: [{ wallId: 'a', from: 2, to: 9 }] } });
    const ids = list => list.map(item => item.id).sort().join(',');
    check('a DEMO wall leaves the existing plan, with what is on it',
      !split.existing.walls.some(x => x.id === 'b') && ids(split.demo.fenestrations).includes('f-b'));
    check('a piece leaves the runs either side as walls of their own',
      ids(split.existing.walls) === 'a~1,a~2', ids(split.existing.walls));
    check('a window in the piece comes out with it', ids(split.demo.fenestrations) === 'f-b,f-in',
      ids(split.demo.fenestrations));
    const moved = split.existing.fenestrations.find(f => f.id === 'f-run');
    check('a window on a run moves onto it, the same place on the ground',
      moved && moved.wallId === 'a~2' && Math.abs(moved.offset - 7) < 1e-9, JSON.stringify(moved));
    check('nothing marked, nothing moves', ids(HG.parts({ source: src }).existing.walls) === 'a,b');
    // MOVED FOR THE CUT PAINTER: points go through the placement, lengths
    // along a wall do not.
    const moved2 = HG.placed({ x: 5, z: 0, angleDeg: 90, pivotX: 0, pivotZ: 0 },
      { walls: [w('m', 0, 10)], fenestrations: [{ id: 'f', offset: 4, width: 3 }] });
    const mw = moved2.walls[0];
    check('a placed wall stands where the hologram does',
      Math.abs(mw.start.x - 5) < 1e-9 && Math.abs(mw.end.x - 5) < 1e-9 && Math.abs(mw.end.z - 10) < 1e-9,
      JSON.stringify(mw));
    check('an opening keeps its offset along the wall', moved2.fenestrations[0].offset === 4);
  }

  // A SHEET'S SWITCHES: only an OFF is written.
  const vp = F.layout({ viewports: [{ id: 1, kind: 'plan', pif: 0.25, xIn: 1, yIn: 1, levelId: 1,
    hologram: { existing: false, demo: true, new: 'no' } }] }, new Set([1])).viewports[0];
  check('a viewport keeps the hologram parts it switched off, and only those',
    vp && JSON.stringify(vp.hologram) === '{"existing":false}', JSON.stringify(vp));
  const plainVp = F.layout({ viewports: [{ id: 1, kind: 'plan', pif: 0.25, xIn: 1, yIn: 1, levelId: 1 }] },
    new Set([1])).viewports[0];
  check('a viewport with every part on carries no key', plainVp && plainVp.hologram === undefined);

  // AND BACK: a click on this drawing finds the hologram's own point.
  const placed = { x: 4, z: -1, angleDeg: 37, pivotX: 10, pivotZ: 3 };
  const there = F.hologramPoint(placed, { x: 12.5, z: -6 });
  check('hologramLocal undoes hologramPoint', same(F.hologramLocal(placed, there), { x: 12.5, z: -6 }),
    JSON.stringify(F.hologramLocal(placed, there)));

  // ── A FLOOR LAYOUT SHOWS WHAT HOLDS IT UP (Movie, 12 Oct) ─────────────
  //
  // The main floor's sheet draws FOUNDATION's beam and posts (not the piles)
  // and their beam rows; the 2nd floor's draws MAIN FL's. MAIN FL's own beam
  // is the 2nd floor's and leaves the main floor's sheet.
  {
    const deck = (id, levelId) => ({ id, levelId, view: 'floor',
      points: [{ x: 0, z: 0 }, { x: 40, z: 0 }, { x: 40, z: 30 }, { x: 0, z: 30 }] });
    const beam = (id, levelId, view) => ({ id, levelId, view, mode: 'flush',
      start: { x: 0, y: 0, z: 15 }, end: { x: 40, y: 0, z: 15 } });
    const post = (id, levelId, view, footing) => ({ id, levelId, view, footing, point: { x: 20, y: 0, z: 15 } });
    const dim = (id, levelId, view, layer, z) => ({ id, levelId, view, layer,
      start: { x: 0, y: 0, z }, end: { x: 20, y: 0, z } });
    const framed = {
      version: SAVED.version,
      levels: [{ id: 5, name: '2ND FL' }, { id: 3, name: 'MAIN FL' }, { id: 1, name: 'FOUNDATION' }],
      walls: [{ id: 'w1', levelId: 1, view: 'foundation', wallType: 'stud_2x6', refLine: 'center',
        start: { x: 0, y: 0, z: 0 }, end: { x: 40, y: 0, z: 0 } }],
      floors: [deck('f3', 3), deck('f5', 5)],
      beams: [beam('b1', 1, 'foundation'), beam('b3', 3, 'floor')],
      columns: [post('c1', 1, 'foundation', 'pad36'), post('p1', 1, 'foundation', 'pile12'),
        post('c3', 3, 'floor', 'pad36')],
      dimensions: [dim('d1', 1, 'foundation', 'A-DIMS-COLS', 50), dim('d1x', 1, 'foundation', 'A-DIMS-EXT', 60),
        dim('d3', 3, 'floor', 'A-DIMS-COLS', 70), dim('d3x', 3, 'floor', 'A-DIMS-EXT', 80)],
    };
    const LP = full.win.DraftLayoutPlan;
    const R0 = full.win.DraftRender2D;
    const sheet = (levelId, view = 'floor', extra = {}, data = framed) => {
      const seen = [];
      full.win.DraftRender2D = { ...R0,
        drawBeam2D: (c, t, item) => seen.push(item.id),
        drawColumn2D: (c, t, item) => seen.push(item.id),
        drawDimension2D: (c, t, item) => seen.push(item.id) };
      try { LP.drawPlan(recorder(), toS, data, levelId, { view, ...extra }); }
      finally { full.win.DraftRender2D = R0; }
      return seen.sort().join(',');
    };
    check('the lowest floor is held up by the foundation',
      JSON.stringify(LP.structureUnder(framed, 3)) === '{"levelId":1,"view":"foundation"}',
      JSON.stringify(LP.structureUnder(framed, 3)));
    check('the 2nd floor is held up by the main floor',
      JSON.stringify(LP.structureUnder(framed, 5)) === '{"levelId":3,"view":"floor"}',
      JSON.stringify(LP.structureUnder(framed, 5)));
    check('the foundation itself borrows nothing', LP.structureUnder(framed, 1) === null);
    check('the main floor sheet shows the foundation beam, its posts and its beam row, not the piles',
      sheet(3) === 'b1,c1,d1,d3x', sheet(3));
    check('the 2nd floor sheet shows the main floor beam, posts and beam row',
      sheet(5) === 'b3,c3,d3', sheet(5));
    check('the foundation sheet keeps its own', sheet(1, 'foundation') === 'b1,c1,d1,d1x,p1', sheet(1, 'foundation'));
    // THE WALLS PLAN SHOWS THE POSTS STANDING ON THAT FLOOR (Movie, 12 Oct:
    // "show columns on main that will support 2nd floor"), and a listing none.
    const walled = { ...framed, walls: [...framed.walls, { id: 'w3', levelId: 3, view: 'plan',
      wallType: 'stud_2x6', refLine: 'center', start: { x: 0, y: 0, z: 0 }, end: { x: 40, y: 0, z: 0 } }] };
    check('the main floor plan shows the posts holding up the 2nd floor', sheet(3, 'plan', {}, walled) === 'c3',
      sheet(3, 'plan', {}, walled));
    check('a listing plan shows no posts', sheet(3, 'plan', { listing: true }, walled) === '',
      sheet(3, 'plan', { listing: true }, walled));
    const tall = LP.planBounds({ ...framed, dimensions: [dim('far', 1, 'foundation', 'A-DIMS-COLS', 90)] }, 3);
    check('the frame takes in a beam row borrowed from below', tall && tall.maxZ >= 90, JSON.stringify(tall));
  }

  // ── THE TOP PLATES THE ROOF RESTS ON, IN THE CALLER'S INK ─────────────
  //
  // Movie, 14 Oct: "please show the outline of the top plates of walls that
  // the roof rests on that are n the roof plan - show those lines also in the
  // site plane".
  //
  // THEY WERE DRAWN ON BOTH ALREADY, in `#1d1f20` -- the sheet's paper ink,
  // which is right on paper and is BLACK ON A BLACK GROUND on MODEL's own
  // site plan. He was asking for lines that were under his cursor and
  // invisible. So what is checked is not "are they drawn" but "whose ink",
  // which is the thing that was wrong.
  //
  // A GARAGE WITH A ROOF ON IT is the fixture -- his own 2 storey detached
  // garage, which has the roof the plates are read off.
  {
    const roofed = JSON.parse(fs.readFileSync(
      path.join(ROOT, 'proto', 'repro-movie-detached-2storey.draft'), 'utf8'));
    const ROOF = 7;
    const paper = draw(full.win, ROOF, { saved: roofed });
    check('the roof plan draws the plates it rests on', paper.ok && paper.inks.includes('#1d1f20'),
      paper.ok ? `inks: ${[...new Set(paper.inks)].join(', ')}` : paper.why);
    // AND A CALLER PAINTING ON ITS OWN GROUND IS OBEYED. MODEL's site plan
    // hands the skin's wall-edge ink through drawSitePlan, which is the one
    // change that made these lines visible on the screen he was looking at.
    const screen = draw(full.win, ROOF, { saved: roofed, env: { wallTopInk: '#8de1ff' } });
    check('and takes the ink a screen hands it', screen.ok && screen.inks.includes('#8de1ff'),
      screen.ok ? `inks: ${[...new Set(screen.inks)].join(', ')}` : screen.why);
    check('without painting the paper ink as well',
      screen.ok && !screen.inks.includes('#1d1f20'),
      screen.ok ? `inks: ${[...new Set(screen.inks)].join(', ')}` : screen.why);
  }

  // ── THE BUILDING'S FOOTPRINT ON EVERY PLAN PAGE (Movie, 16 Oct) ─────────
  //
  // A faded house-and-garage line on every PLAN-view page, the same scale page
  // to page. The footprint is the lowest full storey's outlines; a page ghosts
  // it once, with the storey below (12 Oct), and never under its own outline.
  {
    const full = loadWith();
    const LP = full.win.DraftLayoutPlan;
    const key = pts => JSON.stringify(pts.map(p => [p.x, p.z]));
    const onLevel = id => (SAVED.outlines || []).filter(o => o.levelId === id).map(o => o.points);
    check('the footprint is MAIN FL\'s outlines -- the house and its garage',
      LP.footprintLoops(SAVED).map(key).sort().join('|') === onLevel(3).map(key).sort().join('|'),
      `${LP.footprintLoops(SAVED).length} loops against ${onLevel(3).length} on MAIN FL`);
    check('the FOUNDATION page ghosts the footprint', LP.ghostLoops(SAVED, 1).length === onLevel(3).length,
      String(LP.ghostLoops(SAVED, 1).length));
    check('MAIN FL does not ghost its own outline', LP.ghostLoops(SAVED, 3).length === 0,
      String(LP.ghostLoops(SAVED, 3).length));
    const g5 = LP.ghostLoops(SAVED, 5).map(key);
    check('2ND FL ghosts the storey below and the footprint as ONE set of lines',
      new Set(g5).size === g5.length && g5.length > 0, g5.length + ' loops');
    check('and none of them is 2ND FL\'s own outline', !g5.some(k => onLevel(5).map(key).includes(k)));
    // A HALF STOREY IS NOT THE FOOTPRINT: an ENTRY landing on level 2 does not
    // become the building.
    const withEntry = { ...SAVED, outlines: [...SAVED.outlines,
      { id: 9002, levelId: 2, points: [{ x: 0, z: 0 }, { x: 6, z: 0 }, { x: 6, z: 6 }, { x: 0, z: 6 }] }] };
    check('a bilevel\'s ENTRY landing is not the footprint',
      LP.footprintLoops(withEntry).map(key).sort().join('|') === onLevel(3).map(key).sort().join('|'));
    // THE FRAME TAKES THE FOOTPRINT IN, so the ghost is not clipped. The
    // fixture's foundation already reaches its garage (the frost wall is on
    // level 1), so a second garage is put on MAIN FL where nothing on the
    // foundation can reach it: the FOUNDATION frame has to grow to it.
    const wider = { ...SAVED, outlines: [...SAVED.outlines, { id: 9003, levelId: 3, garage: true,
      points: [{ x: 60, z: 0 }, { x: 70, z: 0 }, { x: 70, z: 10 }, { x: 60, z: 10 }] }] };
    check('nothing on the fixture\'s foundation reaches x 60', LP.planBounds(SAVED, 1).maxX < 60,
      String(LP.planBounds(SAVED, 1).maxX));
    check('the FOUNDATION frame grew to take the footprint in', LP.planBounds(wider, 1).maxX >= 70 - 0.01,
      `reaches x ${LP.planBounds(wider, 1).maxX}`);
    // DRAWN FAINT: the ghost is the only thing on a foundation page at the
    // ghost's alpha.
    const drawn = draw(full.win, 1, { env: { view: 'foundation' } });
    check('the FOUNDATION page draws the footprint faded', drawn.ok && drawn.strokes.some(a => Math.abs(a - 0.3) < 0.01),
      drawn.ok ? [...new Set(drawn.strokes)].join(',') : drawn.why);
    const none = loadWith(['level-assembly.js']);
    check('without the storey ladder there is no footprint', none.win.DraftLayoutPlan.footprintLoops(SAVED).length === 0);
    // THE JOIST CALLOUTS REACH THE SHEET (Movie, 16 Oct): the floor layout's
    // env carries one per deck and the composer paints its label per bay.
    const floorSheet = draw(full.win, 5, { env: { view: 'floor' } });
    const labels = floorSheet.ok ? floorSheet.texts.filter(t => /^(ENGINEERED OWJ|TJI|\dx\d+ JOISTS)/.test(t)) : [];
    const expected = LP.joistCalloutsFor(SAVED, 5, { levelId: 3, view: 'floor' }).reduce((n, c) => n + c.bays.length, 0);
    check('the 2ND FLOOR sheet labels every bay of its decks', expected > 0 && labels.length === expected,
      `${labels.length} labels for ${expected} bays`);
    check('and the walls plan carries none', !draw(full.win, 5, { env: { view: 'plan' } }).texts.some(t => /^TJI|^ENGINEERED OWJ/.test(t)));
  }

  // ── THE DOOR BUCKS ON THE FOUNDATION SHEET (Movie, 16 Oct) ──────────────
  // door-bucks.js cuts them (its own harness); the sheet has to ask. The
  // inside face's lighter line (alpha 0.4) is the buck's own mark: the bands
  // repro has two doors on garage walls, so the FOUNDATION sheet strokes it
  // twice, and the walls plan never.
  {
    const full = loadWith();
    const fdn = draw(full.win, 1, { env: { view: 'foundation' } });
    const lighter = r => (r.ok ? r.strokes.filter(a => Math.abs(a - 0.4) < 0.01).length : -1);
    check('the FOUNDATION sheet cuts a buck at the man door and at the overhead door', lighter(fdn) === 2,
      fdn.ok ? `${lighter(fdn)} lighter strokes` : fdn.why);
    const plan = draw(full.win, 3, { env: { view: 'plan' } });
    check('the walls plan cuts none', lighter(plan) === 0, `${lighter(plan)} lighter strokes`);
    // THE BASEMENT PLAN SHARES THE FOUNDATION'S LEVEL and must not cut them
    // either: a buck is a note about the pour, read on the FOUNDATION sheet.
    const withBasement = { ...SAVED, walls: [...SAVED.walls,
      ...SAVED.walls.filter(w => w.levelId === 1 && w.view === 'foundation').map((w, i) => ({ ...w, id: 91000 + i, view: 'plan' }))] };
    const basement = draw(full.win, 1, { saved: withBasement, env: { view: 'plan' } });
    check('the basement plan, on the foundation\'s own level, cuts none', basement.ok && lighter(basement) === 0,
      basement.ok ? `${lighter(basement)} lighter strokes` : basement.why);
    const without = loadWith(['door-bucks.js']);
    const bare = draw(without.win, 1, { env: { view: 'foundation' } });
    check('without door-bucks.js the sheet draws the ring whole and says nothing', bare.ok && lighter(bare) === 0,
      bare.ok ? `${lighter(bare)} lighter strokes` : bare.why);
  }

  // ── WHICH STAIRS A PLAN SHOWS, AND HOW (Movie, 16 Oct) ──────────────────
  // "BASEMENT shows main->basement only; MAIN shows main->2nd and any
  // main->basement; 2ND FL shows main->2nd normal weight and main->basement
  // lighter." The fixture has both stairs: id 1 on MAIN FL (down to the
  // basement), id 2 on 2ND FL (down to MAIN). The basement plan needs plan
  // walls to be a plan at all, so the foundation's ring stands in.
  {
    const full = loadWith();
    const SG = full.win.DraftStairGeometry;
    const floors = full.win.DraftLayerViews.floorLevels(SAVED.levels);
    const roles = id => Object.fromEntries(SG.stairsShownOn(id, SAVED.stairs, floors).map(e => [e.stair.id, e.role]));
    check('the basement shows the MAIN stair landing on it and nothing of the 2ND\'s',
      JSON.stringify(roles(1)) === '{"1":"lands"}', JSON.stringify(roles(1)));
    check('MAIN shows its own stair going down and the 2ND\'s landing on it',
      JSON.stringify(roles(3)) === '{"1":"own","2":"lands"}', JSON.stringify(roles(3)));
    check('2ND FL shows its own and the MAIN stair under it, lighter',
      JSON.stringify(roles(5)) === '{"1":"below","2":"own"}', JSON.stringify(roles(5)));
    const UP = /^UP — \d+R @ /;
    const main = draw(full.win, 3, { env: { view: 'plan' } });
    check('the MAIN FL sheet tags one stair DN and one UP',
      main.ok && main.texts.filter(t => STAIR.test(t)).length === 1 && main.texts.filter(t => UP.test(t)).length === 1,
      main.ok ? main.texts.filter(t => /^(DN|UP) /.test(t)).join(' | ') : main.why);
    const upper = draw(full.win, 5, { env: { view: 'plan' } });
    check('the 2ND FL sheet tags its own stair DN and the one under it not at all',
      upper.ok && upper.texts.filter(t => STAIR.test(t)).length === 1 && !upper.texts.some(t => UP.test(t)),
      upper.ok ? upper.texts.filter(t => /^(DN|UP) /.test(t)).join(' | ') : upper.why);
    check('and draws the stair under it lighter',
      upper.ok && upper.strokes.some(a => Math.abs(a - 0.45) < 0.01),
      upper.ok ? [...new Set(upper.strokes.map(a => Math.round(a * 100) / 100))].join(',') : upper.why);
    const withBasement = { ...SAVED, walls: [...SAVED.walls,
      ...SAVED.walls.filter(w => w.levelId === 1 && w.view === 'foundation').map((w, i) => ({ ...w, id: 90000 + i, view: 'plan' }))] };
    const basement = draw(full.win, 1, { saved: withBasement, env: { view: 'plan' } });
    check('the BASEMENT sheet tags the MAIN stair UP and shows no other',
      basement.ok && basement.texts.filter(t => UP.test(t)).length === 1 && !basement.texts.some(t => STAIR.test(t))
        && !basement.strokes.some(a => Math.abs(a - 0.45) < 0.01),
      basement.ok ? basement.texts.filter(t => /^(DN|UP) /.test(t)).join(' | ') : basement.why);
  }

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
  // THE DOOR BUCKS (Movie, 16 Oct).
  ['the sheet cuts no bucks',
    'layout-plan.js', c => c.replace("      doorBucks: view === 'foundation' && !shell && window.DraftDoorBucks",
      "      doorBucks: false && window.DraftDoorBucks")],
  ['the sheet cuts bucks on every view',
    'layout-plan.js', c => c.replace("      doorBucks: view === 'foundation' && !shell && window.DraftDoorBucks",
      "      doorBucks: !shell && window.DraftDoorBucks")],
  ['the composition is handed the bucks and paints none',
    'plan-composition.js', c => c.replace('      render.drawDoorBucks2D(ctx, toS, env.doorBucks, env.buckEnv || {});\n', '')],
  // WHICH STAIRS A PLAN SHOWS (Movie, 16 Oct).
  ['a plan shows its own stairs only',
    'layout-plan.js', c => c.replace('        ? [...stairRoles.keys()] : null,', '        ? null : null,')],
  ['the stair landing here is drawn going DN',
    'render-2d.js', c => c.replace("      const up = role === 'lands';", '      const up = false;')],
  ['the stair under this floor keeps its walk line and tag',
    'render-2d.js', c => c.replace("      if (role === 'below') { ctx.restore(); return; }\n", '')],
  ['the stair under this floor is drawn at full weight',
    'render-2d.js', c => c.replace("      if (role === 'below') ctx.globalAlpha *= STAIR_BELOW_ALPHA;\n", '')],
  ['a stair above this floor is shown too',
    'stair-geometry.js', c => c.replace("    return top < here ? 'below' : null;", "    return 'below';")],
  ['the landing floor is read as the stair\'s own',
    'stair-geometry.js', c => c.replace('    return idx === 0 ? BASEMENT_PLAN_ID : Number(floors[idx - 1].id);',
      '    return Number(floors[idx].id);')],
  ['the composition ignores the list the sheet picked',
    'plan-composition.js', c => c.replace('stairs: Array.isArray(env.stairsShown) ? env.stairsShown : pick(env.stairs, { strict: true })',
      'stairs: pick(env.stairs, { strict: true })')],
  // THE FOOTPRINT AND THE JOIST CALLOUTS (Movie, 16 Oct).
  ['the footprint is not ghosted',
    'layout-plan.js', c => c.replace('return [...floorBelowLoops(saved, levelId), ...footprintLoops(saved)].filter(points => {',
      'return [...floorBelowLoops(saved, levelId)].filter(points => {')],
  ['a level ghosts its own outline',
    'layout-plan.js', c => c.replace('      if (own.has(k) || seen.has(k)) return false;', '      if (seen.has(k)) return false;')],
  ['the same loop is ghosted twice',
    'layout-plan.js', c => c.replace('      if (own.has(k) || seen.has(k)) return false;', '      if (own.has(k)) return false;')],
  ['the frame ignores the footprint',
    'layout-plan.js', c => c.replace('    if (withBelow) ghostLoops(saved, levelId).forEach(points => points.forEach(eat));',
      '    if (withBelow) floorBelowLoops(saved, levelId).forEach(points => points.forEach(eat));')],
  ['a half storey can be the footprint',
    'layout-plan.js', c => c.replace('      .filter(id => Number.isInteger(Number(assembly.STOREY_NUMBER[id])))\n', '')],
  ['the joist callouts never reach the sheet',
    'layout-plan.js', c => c.replace('        ? joistCalloutsFor(saved, levelId, under) : []),', '        ? [] : []),')],
  ['the joist callouts are painted on the walls plan too',
    'layout-plan.js', c => c.replace("      joistCallouts: unless(view === 'floor' && !halfLevel && hasFloorLayout(saved, levelId)",
      "      joistCallouts: unless(!halfLevel && hasFloorLayout(saved, levelId)")],
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
  ['the view-s layer list is never handed to the composer',
    'layout-plan.js', c => c.replace(
      'viewLayers: view !== null && VIEWS ? VIEWS.layersFor(levelId, view) : null,', '')],
  ['a viewport naming no view is gated by the level-s default view',
    'layout-plan.js', c => c.replace('viewLayers: view !== null && VIEWS ?',
      'viewLayers: VIEWS ?')],
  ['the list comes from the level-s default view rather than the one being drawn',
    'layout-plan.js', c => c.replace('VIEWS.layersFor(levelId, view)',
      'VIEWS.layersFor(levelId, VIEWS.defaultLayerViewId(levelId))')],
  ['the half-floor is never drawn under its full floor',
    'layout-plan.js', c => c.replace('const half = env.halfLevel === true ? null : halfLevelUnder(levelId);',
      'const half = null;')],
  ['the half-floor draws at full strength',
    'layout-plan.js', c => c.replace('ctx.globalAlpha *= HALF_LEVEL_SHEET_ALPHA;', '')],
  ['the half-floor brings its dimensions along',
    'layout-plan.js', c => c.replace('const only = list => (halfLevel ? [] : list);', 'const only = list => list;')],
  ['a half-floor keeps a sheet of its own',
    'layout-plan.js', c => c.replace('return full != null && planWalls(saved, Number(full)).length > 0;', 'return false;')],
  ['a lone half-floor is dropped too',
    'layout-plan.js', c => c.replace('return full != null && planWalls(saved, Number(full)).length > 0;', 'return full != null;')],
  ['the frame leaves the half-floor out',
    'layout-plan.js', c => c.replace('.concat(half != null ? planWalls(saved, half) : [])', '')],
  // AND THE PAIRING ITSELF, now that it is read off level-assembly's ladder
  // rather than listed here as {3:2, 5:4}: find a storey's mates in the
  // wrong direction and the FULL floor folds into the HALF one.
  ['the half-floor and its full floor swap places',
    'layout-plan.js', c => c.replace('const below = storeyMates(levelId).filter(id => id < Number(levelId));',
      'const below = storeyMates(levelId).filter(id => id > Number(levelId));')],
  // Movie, 14 Oct -- the plate lines on the site plan.
  ['the plate line ignores the ink its caller hands it',
    'layout-plan.js', c => c.replace('{ thicknessFt, color: env.wallTopInk || ROOF_PLATE_INK }',
      '{ thicknessFt, color: ROOF_PLATE_INK }')],
  ['the roof plan draws no plate line at all',
    'layout-plan.js', c => c.replace('if (render.drawWallTops2D && geo.roofPlanWalls) {',
      'if (false) {')],
  ['no level shares a storey with any other',
    'layout-plan.js', c => c.replace('.filter(other => other !== Number(levelId) && LA.sameStorey(other, levelId));',
      '.filter(() => false);')],
  // ── THE STOREY UNDER THIS ONE (Movie, 12 Oct) ─────────────────────────
  ['an upper floor never shows the storey below it',
    'layout-plan.js', c => c.replace('      drawFloorBelowGhost(ctx, toS, saved, levelId);', '')],
  ['the ghost draws at full strength',
    'layout-plan.js', c => c.replace('ctx.globalAlpha *= GHOST_BELOW_ALPHA;', '')],
  ['the frame leaves the storey below out, so the ghost is clipped off the paper',
    'layout-plan.js', c => c.replace(
      '    if (withBelow) ghostLoops(saved, levelId).forEach(points => points.forEach(eat));\n', '')],
  ['every level is a storey, so the roof ghosts the floor under it',
    'layout-plan.js', c => c.replace(
      "const ladder = Object.keys(assembly.STOREY_NUMBER)",
      "const ladder = Object.keys({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 7: 1, 8: 1 })")],
  ['the half-floor already on the sheet is ghosted again',
    'layout-plan.js', c => c.replace('.filter(id => id < levelId && id !== half)',
      '.filter(id => id < levelId)')],
  ['the ghost keeps looking down past a storey that has an outline',
    'layout-plan.js', c => c.replace('if (outlineLoopsOn(saved, under[i]).length) return under[i];',
      'if (outlineLoopsOn(saved, under[i]).length) continue;')],
  ['the level-assembly warning deleted',
    'layout-plan.js', c => c.replace(/if \(!warnedNoLevelAssembly\) \{[\s\S]*?\n      \}\n/, '')],
  ['the level-assembly warning loses the filename',
    'layout-plan.js', c => c.replace("'layout-plan: level-assembly.js is missing, so no plan can '",
      "'layout-plan: a module is missing, so no plan can '")],
  ['the ghost leaves the alpha turned down for everything after it',
    'layout-plan.js', c => c.replace(`    ctx.save();
    ctx.globalAlpha *= GHOST_BELOW_ALPHA;`, '    ctx.globalAlpha *= GHOST_BELOW_ALPHA;')],
  ['a shell draws the storey below at neighborhood scale',
    'layout-plan.js', c => c.replace("      && env.shell !== true && env.hologram !== true) {",
      "      && env.hologram !== true) {")],
  ['a hologram ghosts its own storey below, two buildings deep',
    'layout-plan.js', c => c.replace("      && env.shell !== true && env.hologram !== true) {",
      "      && env.shell !== true) {")],
  ['a listing plan loses the ghost with the dimensions',
    'layout-plan.js', c => c.replace("      && env.shell !== true && env.hologram !== true) {",
      "      && env.shell !== true && env.hologram !== true && env.listing !== true) {")],
  ['planBounds ignores a caller that declines the ghost',
    'layout-plan.js', c => c.replace('if (withBelow) ghostLoops(saved, levelId)',
      'if (true) ghostLoops(saved, levelId)')],
  ['the basement plan never shows its foundation',
    'layout-plan.js', c => c.replace("if (levelId === BASEMENT_LEVEL_ID && view === 'plan'", 'if (false')],
  ['the basement\'s foundation draws at full strength',
    'layout-plan.js', c => c.replace('ctx.globalAlpha *= BASEMENT_FOUNDATION_ALPHA;', '')],
  ['the garage\'s foundation comes onto the basement plan',
    'layout-plan.js', c => c.replace("return !!wall && wall.body !== 'garage';", 'return !!wall;')],
  ['the posts are left off the basement plan',
    'layout-plan.js', c => c.replace("? of('columns').filter(column => !/pile/i.test(String(column.footing || '')))", "? []")],
  ['the piles come along with the posts',
    'layout-plan.js', c => c.replace("? of('columns').filter(column => !/pile/i.test(String(column.footing || '')))", "? of('columns')")],
  ['a floor layout with no walls draws nothing',
    'layout-plan.js', c => c.replace("const floorLayout = view === 'floor' && hasFloorLayout(saved, levelId);", 'const floorLayout = false;')],
  ['the half-floor\'s deck is left off the floor layout',
    'layout-plan.js', c => c.replace("floors: env.halfLevel === true && view === 'floor' ? of('floors') : only(of('floors')),", "floors: only(of('floors')),")],
  ['a hologram brings its dimension strings',
    'layout-plan.js', c => c.replace('dimensionEnv: hologram ? null : forConstruction({', 'dimensionEnv: forConstruction({')],
  ['a hologram brings its notes',
    'layout-plan.js', c => c.replace("noteEnv: hologram ? null : unless(", 'noteEnv: unless(')],
  ['a hologram is drawn as the bare shell',
    'layout-plan.js', c => c.replace('const shell = env.shell === true;', 'const shell = env.shell === true || env.hologram === true;')],
  ['a hologram keeps its own holograms',
    'drawing-format.js', c => c.replace('const { holograms: nested, ...flat } = source;', 'const flat = source;')],
  ['a hologram of a newer Draft comes in',
    'drawing-format.js', c => c.replace('if (!checkEnvelope(source).ok) return null;', '')],
  ['a hologram turns the wrong way',
    'drawing-format.js', c => c.replace('x: px + (Number(holo?.x) || 0) + dx * cos - dz * sin,', 'x: px + (Number(holo?.x) || 0) + dx * cos + dz * sin,')],
  ['a hologram turns about the origin',
    'drawing-format.js', c => c.replace('const px = Number(holo?.pivotX) || 0, pz = Number(holo?.pivotZ) || 0;', 'const px = 0, pz = 0;')],
  ['a DEMO list keeps its duplicates',
    'drawing-format.js', c => c.replace('const ids = list => [...new Set((Array.isArray(list) ? list : [])', 'const ids = list => [...((Array.isArray(list) ? list : [])')],
  ['DEMO takes any collection it is handed',
    'drawing-format.js', c => c.replace("const HOLOGRAM_DEMO_KINDS = Object.freeze(['walls', 'fenestrations', 'fixtures']);",
      "const HOLOGRAM_DEMO_KINDS = Object.freeze(['walls', 'fenestrations', 'fixtures', 'stairs']);")],
  ['an empty DEMO is kept',
    'drawing-format.js', c => c.replace('...(Object.keys(demo).length ? { demo } : {}),', 'demo,')],
  ['hologramLocal turns the wrong way back',
    'drawing-format.js', c => c.replace('return { x: pivot.x + dx * cos + dz * sin, z: pivot.z - dx * sin + dz * cos };',
      'return { x: pivot.x + dx * cos - dz * sin, z: pivot.z + dx * sin + dz * cos };')],
  ['a piece keeps its ends as clicked',
    'drawing-format.js', c => c.replace('const from = Math.max(0, Math.min(a, b)), to = Math.max(a, b);', 'const from = a, to = b;')],
  ['an empty piece is kept',
    'drawing-format.js', c => c.replace('return to - from > 1e-6 ? { wallId, from, to } : null;', 'return { wallId, from, to };')],
  ['pieces are never saved',
    'drawing-format.js', c => c.replace('if (pieces.length) demo.pieces = pieces;', '')],
  ['a DEMO wall keeps its windows',
    'hologram.js', c => c.replace('if (walls.has(item?.wallId)) return null;', '')],
  ['a window touching a piece stays on',
    'hologram.js', c => c.replace('return run ? { ...item, wallId: run.wall.id, offset: centre - run.from } : null;',
      'return run ? { ...item, wallId: run.wall.id, offset: centre - run.from } : item;')],
  ['a window on a run keeps its old offset',
    'hologram.js', c => c.replace('offset: centre - run.from', 'offset: centre')],
  ['a sheet writes every switch',
    'drawing-format.js', c => c.replace(".filter(key => viewport?.hologram?.[key] === false).map(key => [key, false]));",
      ".map(key => [key, viewport?.hologram?.[key] !== false]));")],
  ['the cut painter gets the hologram where its own file has it',
    'hologram.js', c => c.replace('out.x = p.x; out.z = p.z;', '')],
  ['the cut painter never reaches into a list',
    'hologram.js', c => c.replace('if (Array.isArray(v)) return v.map(walk);', 'if (Array.isArray(v)) return v;')],
  ['a floor layout draws its own structure again',
    'layout-plan.js', c => c.replace("const under = view === 'floor' && !halfLevel ? structureUnder(saved, levelId) : null;", 'const under = null;')],
  ['the lowest floor borrows from nothing',
    'layout-plan.js', c => c.replace("if (at === 0) return { levelId: BASEMENT_LEVEL_ID, view: 'foundation' };", 'if (at === 0) return null;')],
  ['a floor borrows from the floor above',
    'layout-plan.js', c => c.replace('return { levelId: Number(floors[at - 1].id), view: \'floor\' };', 'return { levelId: Number((floors[at + 1] || floors[at]).id), view: \'floor\' };')],
  ['the piles come up onto the floor',
    'layout-plan.js', c => c.replace("under ? borrowed('columns', notPile)", "under ? borrowed('columns', () => true)")],
  ['the borrowed beam rows are left behind',
    'layout-plan.js', c => c.replace(".concat(borrowed('dimensions', beamRow))", '')],
  ['every dimension below comes up',
    'layout-plan.js', c => c.replace("borrowed('dimensions', beamRow)", "borrowed('dimensions', () => true)")],
  ['the sheet keeps its own beam rows',
    'layout-plan.js', c => c.replace('.filter(dimension => !ownBeamRow(dimension))', '')],
  ['the frame leaves the borrowed rows out',
    'layout-plan.js', c => c.replace('const under = structureUnder(saved, levelId);\n    if (under) {', 'const under = null;\n    if (under) {')],
  ['the walls plan shows no posts',
    'layout-plan.js', c => c.replace(": planPosts ? only(of('columns')).concat(planPosts) : only(of('columns')),", ": only(of('columns')),")],
  ['a listing shows the posts',
    'layout-plan.js', c => c.replace("view === 'plan' && !halfLevel && !listing && !shell", "view === 'plan' && !halfLevel && !shell")],
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
