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
  'fen-labels.js', 'electric-symbols.js', 'hologram.js'];

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
  const texts = [], alphas = [], strokes = [], stack = [];
  const ctx = {
    texts, alphas, strokes, globalAlpha: 1,
    save() { stack.push(this.globalAlpha); },
    restore() { if (stack.length) this.globalAlpha = stack.pop(); },
    beginPath() {}, closePath() {}, moveTo() {},
    lineTo() {}, arc() {}, rect() {}, stroke() { strokes.push(this.globalAlpha); }, fill() {}, clip() {},
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
    return { ok: true, texts: ctx.texts, alphas: ctx.alphas, strokes: ctx.strokes, endAlpha: ctx.globalAlpha };
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
      { id: 90003, levelId: MAIN, view: 'floor', layer: 'A-DIMS-COLS',
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
    'layout-plan.js', c => c.replace('const half = env.halfLevel === true ? null : HALF_LEVEL_UNDER[levelId];',
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
