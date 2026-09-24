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

function loadDraftModules() {
  const win = {};
  const sandbox = { window: win, console, Math, Number, String, Object, Array, JSON, Map, Set, isFinite, parseFloat, parseInt };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const file of ['formatters.js', 'wall-types.js', 'geometry-2d.js', 'drawing-format.js', 'room-standards.js', 'level-assembly.js', 'cut-view.js']) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue;
    try { vm.runInContext(fs.readFileSync(full, 'utf8'), sandbox, { filename: file }); }
    catch (err) { console.error(`[harness] ${file}: ${err.message}`); }
  }
  return win;
}

// A canvas 2d context that records instead of painting. Every path is kept
// as its raw screen points plus the ink it was stroked with.
function recordingCtx() {
  const strokes = [];
  const fills = [];
  let cur = null;
  const ctx = {
    strokeStyle: '#000', fillStyle: '#000', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    lineCap: 'butt', lineJoin: 'miter', globalAlpha: 1,
    beginPath() { cur = []; },
    moveTo(x, y) { (cur || (cur = [])).push({ x, y, move: true }); },
    lineTo(x, y) { (cur || (cur = [])).push({ x, y }); },
    closePath() { if (cur && cur.length) cur.push({ ...cur[0], close: true }); },
    stroke() { if (cur && cur.length > 1) strokes.push({ pts: cur.slice(), ink: this.strokeStyle, w: this.lineWidth }); },
    fill() { if (cur && cur.length > 1) fills.push({ pts: cur.slice(), ink: this.fillStyle }); },
    fillRect(x, y, w, h) { fills.push({ rect: { x, y, w, h }, ink: this.fillStyle }); },
    strokeRect() {}, clearRect() {}, rect() {},
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
    setLineDash() {}, getLineDash() { return []; },
    fillText() {}, strokeText() {}, measureText: () => ({ width: 0 }),
    arc() {}, ellipse() {}, quadraticCurveTo() {}, bezierCurveTo() {}, clip() {},
    createLinearGradient: () => ({ addColorStop() {} }),
  };
  return { ctx, strokes, fills };
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
  const roofs = format.roofs(saved.roofs, levelIds);
  const fenestrations = format.fenestrations(saved.fenestrations, levelIds);
  const outlines = format.outlines(saved.outlines, levelIds);
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
function paintElevation(win, env, cut, { pxPerFt = 40 } = {}) {
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
  const { ctx, strokes, fills } = recordingCtx();
  const ok = CV.drawElevationView(env, ctx, w, h, cut, stack, axis, () => {},
    { pxPerFt, extents });
  const model = strokes.map(s => ({
    ink: s.ink, w: s.w,
    pts: s.pts.map(p => ({ u: toU(p.x), e: toE(p.y) })),
  }));
  // THE FILLS IN MODEL SPACE TOO, AND IN PAINT ORDER. Occlusion in an
  // elevation is not a rule the painter applies, it is the ORDER the opaque
  // surfaces go down in -- far first, each covering what it stands in front
  // of -- so the only way to check that a roof hides a wall is to ask which
  // of the two was painted last over a given spot. `fills` stays raw for
  // callers reading ink; this is the same list with the screen mapped back
  // to feet, which is the language every check in this file is written in.
  const modelFills = fills.map(f => ({
    ink: f.ink,
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
  return { ok, strokes: model, rawStrokes: strokes, fills, modelFills, uMin, uMax, yTop, yBottom, pxPerFt, w, h, axis, dir };
}

module.exports = { loadDraftModules, buildEnv, standardElevationCuts, paintElevation, recordingCtx, E_MARK_SIDES };
