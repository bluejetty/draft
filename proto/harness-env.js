#!/usr/bin/env node
// THE OFFLINE PAINTER'S BENCH — loading cut-view.js in node, and wiring a
// saved drawing up as the env it paints through.
//
// cut-view.js takes an explicit env of plain accessors and a canvas context,
// which is what makes it checkable outside a browser at all: hand it a
// recording context and its output comes back as MODEL geometry -- feet
// along the view axis and feet of elevation -- rather than as pixels to
// scan.
//
// THIS FILE IS THE PLUMBING ONLY, AND THAT SPLIT IS RECENT. It all lived in
// elevation-harness.js, which five other harnesses already required for it
// -- that alone said it was shared -- and then a Playwright spec needed the
// same env builder to measure a window against the roof the painter draws.
// It could not have it: elevation-harness.js ends its exports with
// `if (require.main !== module) return;`, and Playwright transpiles a spec's
// requires through Babel, which rejects a top-level `return`. Copying the
// env into the spec was the other way out, and the env is a hundred and
// thirty lines of accessors that decide what a garage is and where a level
// bears -- two of those, drifting apart, is the failure this repo keeps
// cataloguing.
//
// elevation-harness.js re-exports everything here, so nothing that required
// it has to change.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

// ── A MUTATED MODULE, HANDED IN FROM OUTSIDE ─────────────────────────
//
// The painter harnesses that run through this bench -- fascia-end,
// foundation-face -- paint half a dozen drawings at module load, so a
// mutation run is a fresh PROCESS per mutant rather than a re-entry. The
// parent writes the bent source to a JSON file and names it here; every
// module this loader reads is checked against it first.
//
// A FILE, NOT THE SOURCE ITSELF, because cut-view.js is a quarter of a
// megabyte and an environment variable is not the place for it.
//
// Absent, which is every run but a mutation run, this reads nothing and
// costs nothing.
const SOURCE_OVERRIDES = (() => {
  const at = process.env.DRAFT_HARNESS_SOURCE_OVERRIDES;
  if (!at) return null;
  return JSON.parse(fs.readFileSync(at, 'utf8'));
})();

function loadDraftModules() {
  const win = {};
  const sandbox = { window: win, console, Math, Number, String, Object, Array, JSON, Map, Set, isFinite, parseFloat, parseInt };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  // finish-patterns.js BEFORE cut-view.js is not required -- the painter looks
  // it up at paint time -- but it has to be in this list at all, and it was
  // not: an elevation asked for `finishes: true` without it drew nothing and
  // said nothing, which is how a probe came back reporting zero hatch strokes
  // on a house whose every wall was clad.
  for (const file of ['formatters.js', 'wall-types.js', 'geometry-2d.js', 'drawing-format.js',
    'room-standards.js', 'level-assembly.js', 'build-house.js', 'finish-patterns.js',
    // THE ROOF'S TWO, beside the wall's one. cut-view reaches for both off
    // `window` when finishes are asked for, and without them here every roof
    // in every offline check draws plain -- which is the shape of the bug that
    // made the first gable-rake probe pass against an unfixed painter: a
    // mirror that quietly drops a module the painter reads turns every claim
    // about it into a claim about an empty drawing.
    'roof-types.js', 'roof-patterns.js',
    // AND THE ONE TABLE SAYING WHICH WAY EACH STANDARD ELEVATION IS SEEN
    // FROM. This env builds its own cuts and so does every page; what makes
    // that safe is that they can all be checked against cut-marks, and a
    // check that cannot load it cannot make the comparison.
    'cut-marks.js',
    // AND THE WINDOW TAG'S FORMATTER, for the same reason the roof's two are
    // here. cut-view guards on DraftFenLabels and draws no size tag without
    // it -- silently -- so a mirror that leaves it out reports a clean sheet
    // for a tag that never drew. That is not hypothetical: the plan tag hid
    // behind exactly this guard on MODEL.html, through four screenshots.
    'fen-labels.js',
    'cut-view.js']) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue;
    const text = SOURCE_OVERRIDES && SOURCE_OVERRIDES[file] != null
      ? SOURCE_OVERRIDES[file] : fs.readFileSync(full, 'utf8');
    try { vm.runInContext(text, sandbox, { filename: file }); }
    catch (err) {
      console.error(`[harness] ${file}: ${err.message}`);
      // A MUTANT THAT WILL NOT PARSE IS NOT A MUTANT CAUGHT.
      //
      // This catch has always logged and carried on, which is right for a
      // plain run: a module that throws at load leaves its globals undefined
      // and the checks that need them fail loudly a moment later.
      //
      // IT IS WRONG UNDER A MUTATION. Probed by appending `throw new
      // Error("boom")` to cut-view.js: the loader printed one line to stderr
      // and the harness went on to report `64 checks passed, 0 failed`,
      // because every painted check reads the sandbox's own recorded strokes
      // and the sandbox still had the ones from before the throw. The parent
      // reads the child's exit code, so a broken edit would have counted as
      // a mutant caught -- the exact silence this bench exists to remove.
      //
      // So under an override the load error is the run's answer: stop here,
      // with a code the parent cannot read as either pass or fail.
      if (SOURCE_OVERRIDES) {
        console.error('[harness] the mutated source did not load; '
          + 'the mutant proves nothing. Re-aim the row.');
        process.exit(3);
      }
    }
  }
  return win;
}

// A canvas 2d context that records instead of painting. Every path is kept
// as its raw screen points plus the ink it was stroked with, and every piece
// of TEXT as its anchor and alignment.
//
// TEXT IS RECORDED BECAUSE THE READINGS ARE PLACED, not just printed. The
// elevation's level marks are right-aligned at `marginL - 22` -- they hang
// OUTSIDE the drawing, in the left margin -- so where they land is a claim
// about the margin and nothing about the strokes can see it. This threw its
// arguments away until 25 Sep, which is why nothing offline noticed the
// numbers being drawn under an open side menu.
//
// measureText STILL ANSWERS ZERO, because there is no font engine here and a
// made-up width would be worse than none: a check that needs to know how wide
// a label is has to say so and use its own number.
function recordingCtx() {
  const strokes = [];
  const fills = [];
  const texts = [];
  // ── PAINT ORDER IS THE ONLY THING THAT ANSWERS "IS THIS VISIBLE" ──────
  //
  // An elevation has no occlusion rule; it has an ORDER -- far first, each
  // opaque surface covering what it stands in front of. So "does this line
  // show on the sheet" is not a question about geometry, it is "was any
  // later fill laid over it", and the two lists here are separate, which
  // made that unaskable. One counter across both is the whole fix.
  let seq = 0;
  let cur = null;
  // ── AND THE CLIP IS RECORDED, BECAUSE IT IS PART OF THE DRAWING ───────
  //
  // This was `clip() {}` -- a no-op -- and that made a whole class of defect
  // invisible here. A hatch frame is a face's bounding PARALLELOGRAM and
  // overhangs a triangular roof at the ridge on purpose, so what keeps it on
  // the roof is the clip and nothing else. With the clip unrecorded, a
  // painter that had stopped clipping laid down exactly the same strokes as
  // one that still did, and the mutant removing it survived.
  //
  // THE PATH, NOT THE INTERSECTION. Honouring a clip properly means clipping
  // every stroke against it, which is a polygon library this file has no
  // business carrying. What a check actually needs is "was this drawn under a
  // clip, and was the clip the right shape" -- so each stroke is stamped with
  // the path that was in force, and the reader decides what that means.
  let clipPath = null;
  const clipStack = [];
  const ctx = {
    strokeStyle: '#000', fillStyle: '#000', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    lineCap: 'butt', lineJoin: 'miter', globalAlpha: 1,
    beginPath() { cur = []; },
    moveTo(x, y) { (cur || (cur = [])).push({ x, y, move: true }); },
    lineTo(x, y) { (cur || (cur = [])).push({ x, y }); },
    closePath() { if (cur && cur.length) cur.push({ ...cur[0], close: true }); },
    stroke() { if (cur && cur.length > 1) strokes.push({ seq: seq++, pts: cur.slice(), ink: this.strokeStyle, w: this.lineWidth, clip: clipPath }); },
    fill() { if (cur && cur.length > 1) fills.push({ seq: seq++, pts: cur.slice(), ink: this.fillStyle }); },
    fillRect(x, y, w, h) { fills.push({ seq: seq++, rect: { x, y, w, h }, ink: this.fillStyle }); },
    strokeRect() {}, clearRect() {}, rect() {},
    save() { clipStack.push(clipPath); },
    restore() { if (clipStack.length) clipPath = clipStack.pop(); },
    translate() {}, rotate() {}, scale() {},
    setLineDash() {}, getLineDash() { return []; },
    // ── AND A WORD TAKES THE SAME COUNTER ────────────────────────────
    //
    // The note above says it outright -- "One counter across both is the whole
    // fix" -- and then stamped the strokes and the fills and left the TEXTS
    // out. So "is this word still showing, or did a nearer wall paint over
    // it" was unaskable, which is exactly the question a window size tag on
    // an elevation raises: the tag of a window 18 ft further back is drawn by
    // its own face's pass and has to be covered by whatever stands in front.
    fillText(text, x, y) {
      texts.push({ seq: seq++, text: String(text), x, y, align: this.textAlign,
        baseline: this.textBaseline, ink: this.fillStyle, font: this.font });
    },
    strokeText() {}, measureText: () => ({ width: 0 }),
    arc() {}, ellipse() {}, quadraticCurveTo() {}, bezierCurveTo() {},
    clip() { clipPath = cur && cur.length > 2 ? cur.slice() : clipPath; },
    createLinearGradient: () => ({ addColorStop() {} }),
  };
  return { ctx, strokes, fills, texts };
}

// Mirrors LAYOUT.html's _cutViewEnv over a saved drawing's JSON.
const DEFAULT_WALL_TOP_FT = (8 * 12 + 1 + 1 / 8) / 12;
const DEFAULT_FOOTING_WIDTH_IN = 20;
const ICF_FOOTING_WIDTH_IN = 24;

function buildEnv(win, saved) {
  const format = win.DraftDrawingFormat;
  const levels = (saved.levels || []).map(l => ({ id: Number(l.id), name: l.name, elev: Number(l.elev) || 0 }));
  const levelIds = new Set(levels.map(l => l.id));
  const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);
  // srcId TRAVELS. This mapper used to return { x, z } and nothing else, so
  // no point reaching the module through this env carried its BONEYARD
  // source link -- and cut-view's body membership derives from exactly that.
  // The effect was not a wrong answer but a silent "undecidable": every
  // provenance check answered from the stored flag instead of the geometry
  // it was written to test, and passed. A mirror that quietly drops a field
  // the module reads is the audit rule wearing the harness's own hat.
  const point = raw => {
    const x = num(raw?.x), z = num(raw?.z);
    if (x === null || z === null) return null;
    return raw?.srcId ? { x, z, srcId: raw.srcId } : { x, z };
  };
  const walls = (saved.walls || []).map(wall => {
    const start = point(wall?.start), end = point(wall?.end);
    if (!start || !end || !levelIds.has(Number(wall?.levelId))) return null;
    const topHeight = num(wall?.topHeight);
    return {
      id: String(wall?.id || ''), start, end,
      levelId: Number(wall.levelId), view: wall?.view || 'plan',
      ...(wall?.body === 'garage' ? { body: 'garage' } : {}),
      wallType: wall?.wallType,
      baseHeight: num(wall?.baseHeight) ?? 0,
      topHeight: topHeight !== null && topHeight > 0 ? topHeight : DEFAULT_WALL_TOP_FT,
      // ── WHAT THE WALL WEARS ───────────────────────────────────────────
      //
      // WITHOUT THESE THREE LINES NO ENGINE HERE CAN SEE A FINISH AT ALL.
      // This mapper kept the keys the painter had always read, so a fixture
      // with stone on it arrived stripped and the elevation drew plain --
      // silently, and identically to a correct result, which is the worst
      // shape a fixture can fail in. Found on 27 Sep by a probe that reported
      // ZERO hatch strokes on a house whose every wall had been clad.
      //
      // LAYOUT.html's copy of this env had the same hole, and cut-view-env.js
      // carries the same three lines for the same reason. That is three hand
      // copies of one contract needing one fix three times, which is the
      // argument the module extraction was already making.
      ...(wall?.finish ? { finish: wall.finish } : {}),
      ...(wall?.finishColor ? { finishColor: wall.finishColor } : {}),
      ...(Array.isArray(wall?.finishBands) && wall.finishBands.length
        ? { finishBands: wall.finishBands } : {}),
    };
  }).filter(Boolean);
  const floors = (saved.floors || []).map(floor => {
    const points = (floor?.points || []).map(point).filter(Boolean);
    if (points.length < 3 || !levelIds.has(Number(floor?.levelId))) return null;
    return {
      id: String(floor?.id || ''),
      points, levelId: Number(floor.levelId), view: floor?.view || 'floor',
      garage: floor?.garage === true, thickenedEdge: floor?.thickenedEdge === true,
    };
  }).filter(Boolean);
  // Same two lists cut-view-env hands over, for the same reason: a mirror
  // that drops a field the module reads makes every check about that field
  // answer from an empty record and pass.
  const roofs = format.roofs(saved.roofs, levelIds, {
    roofingIds: win.DraftRoofTypes ? win.DraftRoofTypes.ROOFING_TYPES.map(r => r.id) : null,
    cornerStyles: win.DraftProfileManager ? win.DraftProfileManager.GABLE_CORNER_STYLES : null,
  });
  const fenestrations = format.fenestrations(saved.fenestrations, levelIds);
  const outlines = format.outlines(saved.outlines, levelIds);
  // COLUMNS TOO, since the elevation draws the piles under a grade beam.
  // Read through the FORMAT rather than off `saved` raw, so a record this
  // env serves is one the app would have loaded -- a pile whose mark the
  // reader drops must be dropped here as well.
  const columns = format.columns ? format.columns(saved.columns, levelIds, {}) : (saved.columns || []);
  const shelves = format.boneyardShelves(saved.boneyardShelves);
  const masters = format.boneyardOutlines(saved.boneyardOutlines, new Set(shelves.map(s => s.id)));
  const assemblies = (saved.levelAssemblies && typeof saved.levelAssemblies === 'object') ? saved.levelAssemblies : {};
  // THE THIRD COPY IS GONE, and the comment it replaces was already untrue.
  // This said it "mirrors LAYOUT.html's normaliseLevelAssembly exactly".
  // It did not: LAYOUT's answered SIX fields, this one SEVEN (it carried
  // joistSpacingIn, LAYOUT did not), and MODEL.dc.html's answered EIGHT. Three
  // copies of one table that had each drifted a different way, with a comment
  // asserting an equality that had stopped holding.
  //
  // level-assembly.js is the one copy now. Proved before deleting this one: a
  // differential sliced the text below out of this file and raced it against
  // the module over 8002 comparisons -- the contract being that the module
  // RESTRICTED TO THIS HARNESS'S KEYS equals its answer, since the module is a
  // superset. The single field it adds is joistType, which nothing here reads.
  //
  // THE ROLE ARRIVED LATER AND THIS LINE DID NOT FOLLOW IT. PR #323 made the
  // module role-aware and updated MODEL.dc.html's caller; this one, LAYOUT's
  // and MODEL.html's kept asking role-less, so ENTRY read 11 7/8" here where
  // MODEL.dc.html read 9 1/4" and OVER GARAGE read 11 7/8" against 19 1/4".
  // A harness measuring a building the live board does not draw is worse than
  // no harness: it is green about the wrong world. proto/level-role-harness.js
  // now holds every caller to the role vocabulary so this cannot drift again.
  const levelAssembly = id => win.DraftLevelAssembly.normaliseLevelAssembly(
    assemblies[id], win.DraftLevelAssembly.levelRole(id));
  const floorLevels = levels
    .filter(l => l.id > 0 && l.id !== 1 && l.id !== 7 && l.id !== 8)
    .slice().reverse();
  const levelWallTopFt = (levelId, view = 'plan') => {
    const tops = walls.filter(w => w.levelId === levelId && w.view === view).map(w => w.topHeight);
    return tops.length ? Math.max(...tops) : DEFAULT_WALL_TOP_FT;
  };
  // Board #346: one of four outboard copies of point-to-segment, collapsed onto
  // the shared export. loadDraftModules already runs geometry-2d.js in this
  // harness's sandbox, alongside the four other Draft modules `win` serves, so
  // there was nothing to build — the work order's "if the harness can't load
  // the export without scaffolding" did not apply.
  //
  // NO CALLER-LOCAL FALLBACK, deliberately. The export answers Infinity for a
  // segment under 0.01ft where this copy answered distance-to-`a`, and the one
  // caller (edgeOnOutline, below) was expected to need protecting. Measured, it
  // does not: its `.some()` skips a zero-length edge and a neighbour sharing
  // that point answers instead. The checks at the foot of this file hold both
  // halves of that.
  const distToSeg = (pt, a, b) =>
    win.DraftGeometry2D.pointToSegment(pt, { start: a, end: b }).d;
  const ftIn = feet => `${feet.toFixed(2)}'`;
  return {
    floorLevels: () => floorLevels,
    levelAssembly,
    // ASKS THE MODULE, and this file had the most to lose by not. Its own
    // header says a check that cannot reach what it checks passes for the
    // wrong reason -- and this line meant the elevation harness would have
    // stayed green while the module's levelFloorFt broke, because it never
    // called it. Skipper found it while moving MODEL's copy (W1 step 3).
    levelFloorFt: id => win.DraftLevelAssembly.levelFloorFt(levelAssembly(id)),
    levelWallTopFt,
    footingWidthIn: id => {
      const a = levelAssembly(id);
      if (a.footingWidthIn) return a.footingWidthIn;
      const icf = walls.some(w => w.levelId === id && w.view === 'foundation' && String(w.wallType || '').startsWith('icf'));
      return icf ? ICF_FOOTING_WIDTH_IN : DEFAULT_FOOTING_WIDTH_IN;
    },
    walls: () => walls,
    roofs: () => roofs,
    floors: () => floors,
    columns: () => columns,
    fenestrations: () => fenestrations,
    garageOutlines: id => outlines.filter(o => o.levelId === id && o.garage && o.points.length >= 3),
    garageFoundation: g => {
      const mode = g?.foundation || masters.find(m => m.id === g?.masterId)?.foundation;
      return mode === 'thickened' || mode === 'frostwall' ? mode : 'gradebeam';
    },
    buildType: () => null,
    edgeOnOutline: (a, b, outline, eps = 0.1) => {
      if (!outline) return false;
      const count = outline.open ? outline.points.length - 1 : outline.points.length;
      const onBoundary = pt => outline.points.some((p, i) => {
        if (i >= count) return false;
        const q = outline.points[(i + 1) % outline.points.length];
        return distToSeg(pt, p, q) <= eps;
      });
      return onBoundary(a) && onBoundary(b) && onBoundary({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });
    },
    masterPointById: srcId => {
      for (const m of masters) { const s = m.points.find(p => p.id === srcId); if (s) return s; }
      return null;
    },
    gableCornerStyle: () => 'flat',
    elevLabel: e => ftIn(e),
    ftIn,
    elevationDatum: () => 0,
  };
}

const E_MARK_SIDES = {
  E1: { side: 'S', sign: 1, dir: { x: 0, z: 1 } },
  E2: { side: 'W', sign: -1, dir: { x: -1, z: 0 } },
  E3: { side: 'N', sign: -1, dir: { x: 0, z: -1 } },
  E4: { side: 'E', sign: 1, dir: { x: 1, z: 0 } },
};

function standardElevationCuts(env) {
  const walls = env.walls().filter(w => w.levelId > 0);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  walls.forEach(w => [w.start, w.end].forEach(p => {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  }));
  const pad = 2, clear = 2;
  const edge = { S: maxZ, N: minZ, E: maxX, W: minX };
  const at = id => edge[E_MARK_SIDES[id].side] + E_MARK_SIDES[id].sign * clear;
  return [
    { id: 'E1', name: 'E1', elev: 0, levelId: null, startPt: { x: minX - pad, z: at('E1') }, endPt: { x: maxX + pad, z: at('E1') }, dirVec: E_MARK_SIDES.E1.dir },
    { id: 'E2', name: 'E2', elev: 0, levelId: null, startPt: { x: at('E2'), z: minZ - pad }, endPt: { x: at('E2'), z: maxZ + pad }, dirVec: E_MARK_SIDES.E2.dir },
    { id: 'E3', name: 'E3', elev: 0, levelId: null, startPt: { x: minX - pad, z: at('E3') }, endPt: { x: maxX + pad, z: at('E3') }, dirVec: E_MARK_SIDES.E3.dir },
    { id: 'E4', name: 'E4', elev: 0, levelId: null, startPt: { x: at('E4'), z: minZ - pad }, endPt: { x: at('E4'), z: maxZ + pad }, dirVec: E_MARK_SIDES.E4.dir },
  ];
}

// Paint one elevation and hand back every stroke in model space.
// `opts` beyond pxPerFt goes straight through to the painter -- `finishes`
// is what the cladding engines need, and a painter option no caller could
// reach is a painter option no engine could ever measure.
function paintElevation(win, env, cut, { pxPerFt = 40, ...opts } = {}) {
  const CV = win.DraftCutView;
  const stack = CV.sectionLevelStack(env);
  const extents = CV.cutViewExtents(env, cut);
  const dir = cut.dirVec;
  const axis = { x: dir.z, z: -dir.x };
  const uA = cut.startPt.x * axis.x + cut.startPt.z * axis.z;
  const uB = cut.endPt.x * axis.x + cut.endPt.z * axis.z;
  const uMin = Math.min(uA, uB), uMax = Math.max(uA, uB);
  const { yTop, yBottom } = extents;
  const w = Math.ceil((uMax - uMin) * pxPerFt) + 40;
  const h = Math.ceil((yTop - yBottom) * pxPerFt) + 40;
  const x0 = ((w) - (uMax - uMin) * pxPerFt) / 2;
  const y0 = ((h) - (yTop - yBottom) * pxPerFt) / 2;
  const toU = X => (X - 0.5 - x0) / pxPerFt + uMin;
  const toE = Y => yTop - (Y - 0.5 - y0) / pxPerFt;
  const { ctx, strokes, fills, texts } = recordingCtx();
  const ok = CV.drawElevationView(env, ctx, w, h, cut, stack, axis, () => {},
    { pxPerFt, extents, ...opts });
  // ── THE PEN-UP MARKERS COME WITH IT ──────────────────────────────────
  //
  // This mapping used to keep only `u` and `e`, which QUIETLY BROKE every
  // reader downstream: elevation-harness.js's `segmentsOf` opens with
  // `if (b.move) continue;` to skip the jump between two sub-paths of one
  // stroke, and with the flag dropped that line could never fire. So a
  // `moveTo` was read as a `lineTo` and every such jump came back as a
  // SEGMENT -- ink the painter never laid down.
  //
  // Measured on a 2 STOREY + GARAGE + ROOM OVER, E3: the foundation's top
  // line and its grade line are one stroke of two sub-paths, and the walkers
  // reported a diagonal running between them, (4.00,-1.048) -> (-16.00,
  // -2.198), a line that does not exist on the sheet. Chasing it cost a
  // reading of a defect Movie had reported.
  //
  // THE HARNESS IS AN INSTRUMENT AND THIS WAS THE INSTRUMENT LYING. Nothing
  // went red for it: `inkIn` counted a little ink in the wrong place,
  // `hasLine` could match a segment that was never drawn, and both look
  // exactly like passing.
  const model = strokes.map(s => ({
    seq: s.seq, ink: s.ink, w: s.w,
    pts: s.pts.map(p => ({ u: toU(p.x), e: toE(p.y), move: !!p.move, close: !!p.close })),
    // THE closePath COPY COMES OFF, the same way modelFills drops it and for
    // the same reason: it is a fact about the PATH, not about the shape. Left
    // in, a clipped triangle comes back with four corners and no check can ask
    // "is this clip the roof face" by the corners it has.
    clip: s.clip ? s.clip.filter(p => !p.close).map(p => ({ u: toU(p.x), e: toE(p.y) })) : null,
  }));
  // THE FILLS IN MODEL SPACE TOO, AND IN PAINT ORDER. Occlusion in an
  // elevation is not a rule the painter applies, it is the ORDER the opaque
  // surfaces go down in -- far first, each covering what it stands in front
  // of -- so the only way to check that a roof hides a wall is to ask which
  // of the two was painted last over a given spot. `fills` stays raw for
  // callers reading ink; this is the same list with the screen mapped back
  // to feet, which is the language every check in this file is written in.
  const modelFills = fills.map(f => ({
    seq: f.seq, ink: f.ink,
    // A `closePath` pushes a copy of the first point, which is a fact about
    // the PATH and not about the shape. Left in, a filled triangle comes back
    // with four corners and no check can ask "is this the roof face" by the
    // corners it has.
    pts: f.rect
      ? [{ u: toU(f.rect.x), e: toE(f.rect.y) },
        { u: toU(f.rect.x + f.rect.w), e: toE(f.rect.y) },
        { u: toU(f.rect.x + f.rect.w), e: toE(f.rect.y + f.rect.h) },
        { u: toU(f.rect.x), e: toE(f.rect.y + f.rect.h) }]
      : f.pts.filter(p => !p.close).map(p => ({ u: toU(p.x), e: toE(p.y) })),
  }));
  // ── AND THE WRITING ON IT ────────────────────────────────────────────
  //
  // recordingCtx has collected `texts` since it was written and this function
  // dropped them on the floor, so NOTHING offline could see a word an
  // elevation prints -- not a level datum, not an elevation's own title, and
  // not the window size tags added on 28 Sep. A probe for those came back 0
  // against a painter that was drawing them correctly, which is the mirror
  // lying rather than the painter failing.
  //
  // IN MODEL SPACE, like the strokes and the fills beside them, so a check can
  // say WHERE a word is and not only that it exists.
  const modelTexts = texts.map(t => ({
    seq: t.seq, text: t.text, u: toU(t.x), e: toE(t.y),
    align: t.align, baseline: t.baseline, ink: t.ink, font: t.font,
  }));
  return { ok, strokes: model, rawStrokes: strokes, fills, modelFills,
    texts: modelTexts, rawTexts: texts,
    uMin, uMax, yTop, yBottom, pxPerFt, w, h, axis, dir };
}

module.exports = { loadDraftModules, buildEnv, standardElevationCuts, paintElevation, recordingCtx, E_MARK_SIDES };
