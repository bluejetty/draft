#!/usr/bin/env node
// GENERATED ELEVATIONS — the offline harness (the elevation-occlusion board).
//
// cut-view.js paints through an explicit env of plain accessors and takes a
// canvas context, so its output is checkable here in node against a real
// saved drawing instead of only through the browser: the strokes come back
// as MODEL geometry — feet along the view axis and feet of elevation —
// which is the language the defect is stated in, and which a paint scan can
// only approximate.
//
//   node proto/elevation-harness.js            checks the L-house repro
//   node proto/elevation-harness.js x.draft    checks another drawing
//
// Exit code 0 = every check passed. tests/elevation-occlusion.spec.js pins
// the same behaviour on the real overlay; this pins the geometry.
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

// Mirrors LAYOUT.dc.html's _cutViewEnv over a saved drawing's JSON.
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
  // This said it "mirrors LAYOUT.dc.html's normaliseLevelAssembly exactly".
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
  const distToSeg = (pt, a, b) => {
    const dx = b.x - a.x, dz = b.z - a.z;
    const len2 = dx * dx + dz * dz;
    const t = len2 ? Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.z - a.z) * dz) / len2)) : 0;
    return Math.hypot(pt.x - (a.x + t * dx), pt.z - (a.z + t * dz));
  };
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
  return { ok, strokes: model, rawStrokes: strokes, fills, uMin, uMax, yTop, yBottom, pxPerFt, w, h, axis, dir };
}

module.exports = { loadDraftModules, buildEnv, standardElevationCuts, paintElevation, recordingCtx, E_MARK_SIDES };

if (require.main !== module) return;

// ── Checks ────────────────────────────────────────────────────────────
let passed = 0;
const failures = [];
const check = (name, condition, detail) => {
  if (condition) { passed += 1; return; }
  failures.push(detail ? `${name}\n      ${detail}` : name);
};

// The one optional positional, through the shared guard, so a flag is
// rejected BEFORE anything treats argv as a path. Before this the line read
// process.argv[2] directly and `--mutate` died on ENOENT with exit 1 -- the
// one harness of twenty-two that answered a wrong flag with "checks failed".
const file = require('./harness-args.js').optionalPositional() || path.join(ROOT, 'proto', 'repro-L-house.draft');
const win = loadDraftModules();
const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
const env = buildEnv(win, saved);
const views = {};
standardElevationCuts(env).forEach(cut => { views[cut.id] = paintElevation(win, env, cut); });

// Every stroke as straight model-space segments, so a run of ink can be
// asked about by where it lies rather than by which pass emitted it.
const segmentsOf = view => view.strokes.flatMap(s => {
  const out = [];
  for (let i = 1; i < s.pts.length; i++) {
    const a = s.pts[i - 1], b = s.pts[i];
    if (b.move) continue;
    if (Math.hypot(b.u - a.u, b.e - a.e) < 1e-6) continue;
    out.push({ a, b, w: s.w, ink: s.ink });
  }
  return out;
});
// Ink census over a model-space box: the length of stroke lying inside it,
// in feet. Segments are walked rather than clipped — the question is only
// ever "is there ink here", and half a foot of it is already too much.
const inkIn = (view, { uLo, uHi, eLo, eHi }) => {
  let feet = 0;
  segmentsOf(view).forEach(({ a, b }) => {
    const steps = Math.max(2, Math.ceil(Math.hypot(b.u - a.u, b.e - a.e) / 0.05));
    let run = 0;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const u = a.u + (b.u - a.u) * t, e = a.e + (b.e - a.e) * t;
      if (u >= uLo && u <= uHi && e >= eLo && e <= eHi) run += 1;
    }
    feet += run / (steps + 1) * Math.hypot(b.u - a.u, b.e - a.e);
  });
  return feet;
};
// The highest ink at a spot along the view axis — the drawn skyline.
const skylineAt = (view, u) => {
  let top = null;
  segmentsOf(view).forEach(({ a, b }) => {
    const lo = Math.min(a.u, b.u), hi = Math.max(a.u, b.u);
    if (u < lo - 1e-9 || u > hi + 1e-9) return;
    const t = Math.abs(b.u - a.u) < 1e-9 ? 0 : (u - a.u) / (b.u - a.u);
    const e = a.e + (b.e - a.e) * t;
    if (top === null || e > top) top = e;
  });
  return top;
};
// A stroke matching a model-space line, within tolerance at both ends.
const hasLine = (view, u0, e0, u1, e1, tol = 0.25) => segmentsOf(view).some(({ a, b }) => {
  const fits = (p, u, e) => Math.abs(p.u - u) <= tol && Math.abs(p.e - e) <= tol;
  return (fits(a, u0, e0) && fits(b, u1, e1)) || (fits(a, u1, e1) && fits(b, u0, e0));
});

// The repro's measured geometry, read off the roof faces in geometry-2d.js
// (see the board): Wing A's ridge stands at 22.63, Wing B's at 22.01, the
// eaves at 17.70 and the fascia's heavy line 5.5" under each. Cited as
// numbers because they are what the defect was reported in.
const WING_A_RIDGE = 22.63, WING_B_RIDGE = 22.01, EAVE = 17.70, PLATE = 17.24;

// ── E4 · RIGHT — the near wing stands in front; nothing may be hidden ──
{
  const v = views.E4;
  // Its gable's rakes run unbroken from the ridge to each eave, and both
  // overhang the wall corners (-2.14 / 23.45) by the roof's 2' overhang.
  check('E4: the near wing\'s left rake runs ridge to eave, past its wall corner',
    hasLine(v, 10.65, WING_A_RIDGE, -4.15, EAVE),
    JSON.stringify(segmentsOf(v).filter(s => s.a.e > 17.5 && s.w === 1).map(s =>
      [+s.a.u.toFixed(2), +s.a.e.toFixed(2), +s.b.u.toFixed(2), +s.b.e.toFixed(2)])));
  check('E4: the near wing\'s right rake runs ridge to eave, past its wall corner',
    hasLine(v, 25.43, EAVE, 10.65, WING_A_RIDGE));
  // The guard against fixing an over-draw by hiding: the far wing really is
  // taller across the plateau, and its ridge must survive.
  check('E4: the far wing\'s ridge is still drawn across the plateau',
    hasLine(v, 8.78, WING_B_RIDGE, -29.90, WING_B_RIDGE));
  // The near gable-end wall is the nearest thing in this view: it climbs to
  // the underside of its own rakes, and the same stretch that must be EMPTY
  // in E2 and E3 must be LIT here. Its own roof stands nearer than it and
  // higher than its plate, and must not be read as standing in front of it.
  check('E4: the near gable-end wall still climbs its gable',
    inkIn(v, { uLo: 2, uHi: 9, eLo: 18, eHi: 21 }) > 5,
    `${inkIn(v, { uLo: 2, uHi: 9, eLo: 18, eHi: 21 }).toFixed(2)} ft`);
  check('E4: its skyline peaks on the ridge',
    Math.abs(skylineAt(v, 10.65) - WING_A_RIDGE) < 0.1,
    `skyline at the ridge: ${skylineAt(v, 10.65)}`);
}

// ── E2 · LEFT and E3 · BACK — a whole wing stands in front ─────────
// Both look at a gable-end wall from behind another wing, so every foot of
// the triangle that wall climbs is hidden. Walls hide each other by the
// painter's opaque fill and roofs joined nothing, so the triangle used to be
// stroked over the wing in front of it — a slope running down out of the
// ridge and stopping in open air at the wall's corner.
//
// EMPTY is the stretch that carried it: between the plate and the ridge, on
// the side of the apex where the wing in front projects nothing. LIT is the
// mirror stretch, where the nearer wing's own hip and rake really do run —
// the guard that says this was fixed by hiding the wall, not the roof.
const BEHIND = {
  E2: { span: { uLo: -23.4, uHi: 2.1 }, ridge: WING_B_RIDGE,
    empty: { uLo: -6, uHi: 2, eLo: 18, eHi: 21 },
    lit: { uLo: -22, uHi: -13, eLo: 18, eHi: 21 } },
  E3: { span: { uLo: 24.2, uHi: 46 }, ridge: WING_A_RIDGE,
    empty: { uLo: 24.5, uHi: 32, eLo: 18, eHi: 21 },
    lit: { uLo: 38, uHi: 45, eLo: 18, eHi: 21 } },
};
for (const [id, { span, ridge, empty, lit }] of Object.entries(BEHIND)) {
  const v = views[id];
  check(`${id}: the gable-end wall behind the nearer wing draws nothing through it`,
    inkIn(v, empty) < 0.25, `${inkIn(v, empty).toFixed(2)} ft of ink in ${JSON.stringify(empty)}`);
  check(`${id}: the nearer wing's own slope is still drawn`,
    inkIn(v, lit) > 5, `${inkIn(v, lit).toFixed(2)} ft`);
  check(`${id}: the ridge over that span is still drawn`,
    inkIn(v, { ...span, eLo: ridge - 0.15, eHi: ridge + 0.15 }) > 5,
    `${inkIn(v, { ...span, eLo: ridge - 0.15, eHi: ridge + 0.15 }).toFixed(2)} ft`);
  check(`${id}: the eave over that span is still drawn`,
    inkIn(v, { ...span, eLo: EAVE - 0.05, eHi: EAVE + 0.05 }) > 5);
  // No slope stops in open air: over the wall's whole span the drawn skyline
  // stays up on the wing in front of it.
  const dips = [];
  for (let u = span.uLo + 0.5; u <= span.uHi - 0.5; u += 0.5) {
    const top = skylineAt(v, u);
    if (top === null || top < EAVE - 0.05) dips.push(+u.toFixed(1));
  }
  check(`${id}: the skyline never drops below the nearer wing's eave`,
    dips.length === 0, `dips at u = ${JSON.stringify(dips.slice(0, 8))}`);
}

// ── E1 · FRONT — square on, nothing stands behind anything ─────────────
{
  const v = views.E1;
  check('E1: the near gable peaks at its own ridge',
    Math.abs(skylineAt(v, -35.10) - WING_B_RIDGE) < 0.1, `${skylineAt(v, -35.10)}`);
  check('E1: the far wing\'s ridge stands above it, unhidden',
    Math.abs(skylineAt(v, -10.65) - WING_A_RIDGE) < 0.1, `${skylineAt(v, -10.65)}`);
}

// ── THE LEVEL ASSEMBLY, READ OFF THE INK ──────────────────────────────
// Added because PR #316 deleted the last duplicate of the defaults table and
// left nothing watching the survivor. Measured first rather than assumed: of
// level-assembly.js's eight fields, FIVE reach elevation ink at all --
// wallHeightFt, joistDepthIn, sheathingIn, footingDepthIn, footingWidthIn --
// and the checks above caught only the first two (mutating wallHeightFt fails
// 16 of them, joistDepthIn 6). The other three moved the drawing and every
// check stayed green. These are for those three.
//
// joistType, joistSpacingIn and slabThicknessIn put NO ink in an elevation:
// mutating each leaves the four views byte-identical at 400 px/ft. They are
// section and schedule facts. No check for them is written here, because a
// check that cannot reach what it checks passes for the wrong reason. Where
// they DO reach, and what watches them now: proto/level-role-harness.js.
//
// PAINTED AT 400 px/ft, NOT THE 40 THE VIEWS ABOVE USE. The painter rounds to
// the pixel grid, so at 40 a pixel is 0.3" -- coarser than the 1/4" sheathing
// this measures, and the 8" footing reads as 7.8". At 400 a pixel is 0.03"
// and the same footing reads 7.98".
const FINE_PX = 400;
const fine = paintElevation(win, env, standardElevationCuts(env).find(c => c.id === 'E2'),
  { pxPerFt: FINE_PX });
// The drawn elevation nearest a target, or null if no ink lies within reach.
// Null fails its check: a line that moved further than the window is exactly
// the failure being looked for, not a reason to look elsewhere.
const drawnE = (target, reach) => {
  let best = null;
  fine.strokes.forEach(s => s.pts.forEach(p => {
    if (Math.abs(p.e - target) > reach) return;
    if (best === null || Math.abs(p.e - target) < Math.abs(best - target)) best = p.e;
  }));
  return best;
};
// How far ink at one elevation reaches past ink at another, on the left --
// the footing's step out from the foundation wall face.
const leftEdgeAt = (target, reach) => {
  let u = null;
  fine.strokes.forEach(s => s.pts.forEach(p => {
    if (Math.abs(p.e - target) > reach) return;
    if (u === null || p.u < u) u = p.u;
  }));
  return u;
};

{
  const fdnAsm = env.levelAssembly(1);
  const mainAsm = env.levelAssembly(3);
  const stack = win.DraftCutView.sectionLevelStack(env);
  const TOL_IN = 0.05;           // the measured pixel error at FINE_PX is 0.02"
  const inches = ft => ft * 12;
  // Half of these pin level-assembly.js's DEFAULT numbers as drawn inches, so
  // editing a default moves the ink away from a literal that did not move with
  // it. That question only exists while the defaults are what is in play: a
  // drawing passed on argv may store its own assembly, and 12 5/8" would then
  // be a false failure rather than a caught one. So they are registered only
  // when the drawing stores nothing for the level, and the skip is announced
  // -- a check that quietly vanishes is worse than one that never existed.
  const stored = (saved.levelAssemblies && typeof saved.levelAssemblies === 'object')
    ? saved.levelAssemblies : {};
  const onDefaults = id => !stored[id] || typeof stored[id] !== 'object';
  const checkDefault = (id, name, condition, detail) => {
    if (onDefaults(id)) return check(name, condition, detail);
    console.log(`  - skipped (level ${id} stores its own assembly): ${name}`);
  };

  // ── The floor package: joistDepthIn + sheathingIn, drawn ────────────
  // MAIN FL's floor is the band between the foundation wall's top and the
  // floor level itself. 11 7/8" of joist and 3/4" of sheathing is 12 5/8",
  // and it is written here as that literal so a change to either default
  // moves the ink away from a number that did not move with it.
  const floorTopE = drawnE(stack.floors[0].floorTop, 0.4);
  const floorBotE = drawnE(stack.floors[0].floorBottom, 0.4);
  const packageIn = floorTopE === null || floorBotE === null ? null
    : inches(floorTopE - floorBotE);
  checkDefault(3, 'assembly: the drawn floor package is 12 5/8" (11 7/8" joist + 3/4" sheathing)',
    packageIn !== null && Math.abs(packageIn - 12.625) < TOL_IN,
    `drawn ${packageIn === null ? 'no ink' : packageIn.toFixed(3) + '"'}`);
  // And the same measurement against what the module actually answers, which
  // is a different question: the literal above catches the defaults changing,
  // this catches the painter ceasing to ask.
  check('assembly: the drawn floor package equals levelFloorFt for MAIN FL',
    packageIn !== null && Math.abs(packageIn - inches(env.levelFloorFt(3))) < TOL_IN,
    `drawn ${packageIn === null ? 'no ink' : packageIn.toFixed(3) + '"'}, `
    + `module ${inches(env.levelFloorFt(3)).toFixed(3)}" `
    + `(joist ${mainAsm.joistDepthIn}" + sheathing ${mainAsm.sheathingIn}")`);

  // ── The footing: its depth below the foundation wall ────────────────
  // Buried concrete is drawn dashed below grade, so the footing bottom is
  // real ink and its depth is measurable.
  const wallBotE = drawnE(stack.foundation.wallBottom, 0.3);
  const footBotE = drawnE(stack.foundation.footingBottom, 0.5);
  const footIn = wallBotE === null || footBotE === null ? null
    : inches(wallBotE - footBotE);
  checkDefault(1, 'assembly: the drawn footing is 8" deep under the foundation wall',
    footIn !== null && Math.abs(footIn - 8) < TOL_IN,
    `drawn ${footIn === null ? 'no ink' : footIn.toFixed(3) + '"'}`);
  check('assembly: the drawn footing depth equals footingDepthIn',
    footIn !== null && Math.abs(footIn - fdnAsm.footingDepthIn) < TOL_IN,
    `drawn ${footIn === null ? 'no ink' : footIn.toFixed(3) + '"'}, `
    + `module ${fdnAsm.footingDepthIn}"`);

  // ── The footing: how far it steps out ───────────────────────────────
  // footingWidthIn is null on this drawing, so the value under test is the
  // DERIVED one -- 20" for a non-ICF foundation -- and the step out each side
  // is half of what the 8" concrete wall does not cover.
  // Measured at the elevations the ink is actually AT, not the ones it was
  // expected at. Anchoring this on stack.foundation.footingBottom read as a
  // step-out failure whenever the footing simply sat somewhere else -- one
  // fault reported as a different one, at a place with no ink to measure.
  const wallFaceU = floorBotE === null ? null : leftEdgeAt(floorBotE, 0.02);
  const footFaceU = footBotE === null ? null : leftEdgeAt(footBotE, 0.02);
  const projIn = wallFaceU === null || footFaceU === null ? null
    : inches(wallFaceU - footFaceU);
  checkDefault(1, 'assembly: the footing steps out 6" past the foundation wall face',
    projIn !== null && Math.abs(projIn - 6) < TOL_IN,
    `drawn ${projIn === null ? 'no ink' : projIn.toFixed(3) + '"'}`);
  const fdnWallType = (env.walls().find(w => w.levelId === 1 && w.view === 'foundation') || {}).wallType;
  const wallIn = (win.DraftWallTypes.WALL_TYPES.find(t => t.id === fdnWallType) || {}).totalIn;
  check('assembly: that step out is half of footingWidthIn less the wall',
    projIn !== null && Number.isFinite(wallIn) && Math.abs(projIn - (env.footingWidthIn(1) - wallIn) / 2) < TOL_IN,
    `drawn ${projIn === null ? 'no ink' : projIn.toFixed(3) + '"'}, `
    + `module (${env.footingWidthIn(1)}" - ${wallIn}" ${fdnWallType}) / 2`);
}

// ── The envelope is correct and must not move ─────────────────────────
// Stated for every view: the fix hides, so nothing may appear over the top.
for (const id of ['E1', 'E2', 'E3', 'E4']) {
  check(`${id}: no ink above the tallest ridge`,
    inkIn(views[id], { uLo: -99, uHi: 99, eLo: WING_A_RIDGE + 0.2, eHi: 99 }) === 0);
}


// ── SECOND FIXTURE: AN ATTACHED GARAGE (board #334, item 1) ───────────
//
// WHY A SECOND FIXTURE AT ALL. Every check above is written for the L-house
// -- "the far wing's ridge", "the nearer wing's eave" -- so they cannot be
// re-pointed at another building; they would fail on its geometry rather
// than on a defect. But repro-L-house.draft HAS NO GARAGE, and that is not
// a small gap: this harness wires up garageOutlines and garageFoundation
// faithfully and then never exercises either.
//
// MEASURED, 8 Sep 2026: disabling the garage arm of roofBaseElev entirely --
// so every garage roof drops onto the full wall stack, the exact defect
// boards #153 and #245 fixed -- left ALL 29 harnesses green. Only
// tests/garage-roof-drop.spec.js noticed, at 1.2 minutes a run.
//
// So the garage gets its own fixture and its own checks, built through the
// real bone path (house outline, MARK ATTACHED GARAGE, BUILD HOUSE) rather
// than hand-assembled, because a synthetic drawing forgets exactly the
// fields a body question is decided on.
{
  const gFile = path.join(ROOT, 'proto', 'repro-garage-house.draft');
  const gSaved = JSON.parse(fs.readFileSync(gFile, 'utf8'));
  const gEnv = buildEnv(win, gSaved);
  const CV = win.DraftCutView;
  const roofs = gEnv.roofs();
  const garageRoofs = roofs.filter(r => r.garage === true);
  const houseRoofs = roofs.filter(r => r.garage !== true);

  // THE FIXTURE'S REACH, ASSERTED BEFORE IT IS TRUSTED. Every check below
  // is a filter over a list, and a filter over an empty list passes whatever
  // the code does -- which is the shape this repo has now catalogued a dozen
  // times. If the fixture ever loses its garage, these say so instead of
  // going quietly green.
  check('garage fixture: it has a garage roof', garageRoofs.length > 0,
    `${garageRoofs.length} garage roofs`);
  check('garage fixture: and a house roof to tell it apart from', houseRoofs.length > 0,
    `${houseRoofs.length} house roofs`);

  // THE DERIVATION AGREES WITH THE FLAG. Stated before anything indexes the
  // lists above, because it is the one check that still means something when
  // the fixture has drifted -- which is exactly when it must be heard.
  // ROOFS AND FLOORS BOTH. The sweep found floor.garage is the same stored
  // flag in a second place, and derivable the same way.
  const drift = CV.bodyDrift(gEnv);
  check('body membership: stored flag and geometry agree on every roof and floor',
    drift.length === 0,
    drift.map(d => `${d.kind} ${d.id} stored=${d.stored} geometry=${d.geometry}`).join(', ') || 'none');
  const garageFloors = gEnv.floors().filter(f => f.garage === true);
  check('garage fixture: it has a garage FLOOR too, so that half is not vacuous',
    garageFloors.length > 0, `${garageFloors.length} garage floors`);
  check('body membership: the garage slab resolves to its outline by geometry',
    garageFloors.length > 0 && CV.garageOfFloor(garageFloors[0], gEnv) !== null,
    garageFloors.length ? `resolved to ${(CV.garageOfFloor(garageFloors[0], gEnv) || {}).id || 'null'}` : 'no garage floor');
  const houseFloors = gEnv.floors().filter(f => f.garage !== true);
  check('body membership: and a house floor does NOT, despite shared weld points',
    houseFloors.every(f => CV.garageOfFloor(f, gEnv) === null),
    houseFloors.map(f => `${f.id}->${(CV.garageOfFloor(f, gEnv) || {}).id || 'null'}`).join(' '));

  // GUARDED, and the guard is not politeness. Mutating the fixture's stored
  // flag to prove the drift check fires used to CRASH here instead: the
  // reach checks above had already recorded the problem, and then the first
  // garageRoofs[0] threw before anything printed. A harness that dies on the
  // condition it exists to report is the audit rule wearing a different hat.
  if (garageRoofs.length && houseRoofs.length) {
  check('garage fixture: and garage outlines for geometry to match',
    gEnv.garageOutlines(garageRoofs[0].sourceLevelId).length > 0,
    `${gEnv.garageOutlines(garageRoofs[0].sourceLevelId).length} on level ${garageRoofs[0].sourceLevelId}`);
  check('garage fixture: the garage roof carries source links',
    (garageRoofs[0].points || []).filter(pt => pt.srcId).length > 0,
    `${(garageRoofs[0].points || []).filter(pt => pt.srcId).length} linked points`);

  // SET EQUALITY, NOT OVERLAP, and this is the check that defends it. An
  // attached garage WELDS onto the house at shared master points, so the
  // house roof's srcIds genuinely contain two of the garage outline's. A
  // membership test written as "shares any srcId" passes everything above
  // and still calls the house roof a garage -- dropping the main roof a
  // storey. Only this one goes red for it.
  check('body membership: the house roof is NOT the garage, despite shared weld points',
    CV.garageOfRoof(houseRoofs[0], gEnv) === null,
    `resolved to ${(CV.garageOfRoof(houseRoofs[0], gEnv) || {}).id || 'null'}`);
  check('body membership: and the garage roof IS, by exact match',
    CV.garageOfRoof(garageRoofs[0], gEnv) !== null,
    `resolved to ${(CV.garageOfRoof(garageRoofs[0], gEnv) || {}).id || 'null'}`);
  const houseIds = new Set((houseRoofs[0].points || []).map(pt => pt.srcId).filter(Boolean));
  const garageOutline = CV.garageOfRoof(garageRoofs[0], gEnv);
  const shared = (garageOutline.points || [])
    .filter(pt => pt.srcId && houseIds.has(pt.srcId)).length;
  check('body membership: the weld really is shared, so that check is not vacuous',
    shared > 0, `${shared} srcIds in common`);

  // THE BRANCH NO HARNESS COULD SEE. A garage roof bears on its own plate
  // over the main floor; the house roof bears on the full wall stack. Kill
  // the garage arm of roofBaseElev and these two collapse onto each other.
  const gStack = CV.sectionLevelStack(gEnv);
  const garageBase = CV.roofBaseElev(garageRoofs[0], gStack, gEnv);
  const houseBase = CV.roofBaseElev(houseRoofs[0], gStack, gEnv);
  check('roof base: the garage roof bears BELOW the house roof',
    garageBase < houseBase - 0.5,
    `garage ${garageBase.toFixed(3)}ft vs house ${houseBase.toFixed(3)}ft`);
  check('roof base: and it bears on its own plate over the main floor',
    Math.abs(garageBase
      - (gStack.floors[0].floorTop + Number(garageRoofs[0].plateHeightFt))) < 1e-6,
    `${garageBase.toFixed(3)}ft vs floorTop ${gStack.floors[0].floorTop.toFixed(3)}`
      + ` + plate ${Number(garageRoofs[0].plateHeightFt).toFixed(3)}`);
  }
}


// ── THIRD FIXTURE: A COURTYARD (board #292, item 2) ───────────────────
//
// levelSpan took min..max of the crossing positions within one body. For a
// U footprint the cut crosses the same body's walls with a REAL GAP between
// the wings, and one band bridged the open courtyard -- a framed floor
// drawn over open air, the same lie audit C5 fixed for garages, now inside
// a single body.
//
// The fix bands where the FLOOR POLYGON is, not between the outermost
// walls. Two checks below and they answer different questions: floorRuns is
// the rule itself, and the painted fills are the proof the painter actually
// uses it -- a correct rule wired to nothing would pass the first alone.
{
  const cFile = path.join(ROOT, 'proto', 'repro-courtyard-house.draft');
  const cSaved = JSON.parse(fs.readFileSync(cFile, 'utf8'));
  const cEnv = buildEnv(win, cSaved);
  const CV = win.DraftCutView;

  // Straight across the open end of the U, at z = +4: through the left leg,
  // the courtyard, and the right leg.
  const cut = {
    id: 'S1', name: 'S1', elev: 0, levelId: null,
    startPt: { x: -40, z: 4 }, endPt: { x: 40, z: 4 }, dirVec: { x: 0, z: 1 },
  };
  const axis = { x: cut.dirVec.z, z: -cut.dirVec.x };
  const framed = cEnv.floors().filter(f => (f.view || 'plan') !== 'foundation'
    && !f.garage && (f.points || []).length >= 3);

  // THE FIXTURE'S REACH. A U that is not a U proves nothing about gaps.
  check('courtyard fixture: it has framed floors', framed.length > 0,
    `${framed.length} framed floors`);
  check('courtyard fixture: and they are U-shaped, not rectangles',
    framed.every(f => f.points.length > 4),
    `corners ${framed.map(f => f.points.length).join('/')}`);

  if (framed.length) {
    const runs = CV.floorRuns(cut, axis, [framed[0]]);
    check('courtyard: the cut yields TWO floor runs, not one',
      runs.length === 2,
      `${runs.length} runs: ${runs.map(r => `${r.min.toFixed(1)}..${r.max.toFixed(1)}`).join(' | ')}`);
    if (runs.length === 2) {
      const gap = runs[1].min - runs[0].max;
      check('courtyard: with real open air between them', gap > 1,
        `gap ${gap.toFixed(2)}ft`);
      // NOT VACUOUS: the two runs must also be real floor, or "two runs"
      // could be satisfied by two slivers either side of nothing.
      check('courtyard: and both runs are real floor, not slivers',
        runs.every(r => r.max - r.min > 1),
        runs.map(r => (r.max - r.min).toFixed(2) + 'ft').join(', '));
    }
    // THE CONTROL. The same rule over a solid rectangle must give ONE run,
    // or the fix has simply learned to split everything.
    const rect = [{ x: -10, z: -10 }, { x: 10, z: -10 }, { x: 10, z: 10 }, { x: -10, z: 10 }];
    check('courtyard: a solid floor still gives ONE run',
      CV.floorRuns(cut, axis, [{ points: rect }]).length === 1,
      `${CV.floorRuns(cut, axis, [{ points: rect }]).length} runs over a plain rectangle`);
  }

  // AND THE PAINTER USES IT. Band fills carry their own ink, so they can be
  // counted without inverting the transform; widths are compared as a ratio,
  // which is scale-free.
  const BAND_INK = 'rgba(89,128,166,0.15)';
  const rec = recordingCtx();
  CV.drawCutView(cEnv, rec.ctx, 900, 600, cut);
  const bands = rec.fills.filter(f => f.ink === BAND_INK && f.rect);
  check('courtyard: the section paints floor bands at all', bands.length > 0,
    `${bands.length} band fills`);
  if (bands.length) {
    const byRow = {};
    bands.forEach(b => { const k = Math.round(b.rect.y); (byRow[k] = byRow[k] || []).push(b.rect); });
    const rows = Object.values(byRow);
    check('courtyard: every storey wears TWO bands, not one across the gap',
      rows.every(r => r.length === 2),
      rows.map(r => `${r.length}`).join('/') + ' bands per storey');
    const bridged = rows.filter(r => {
      const left = Math.min(...r.map(x => x.x));
      const right = Math.max(...r.map(x => x.x + x.w));
      const painted = r.reduce((sum, x) => sum + x.w, 0);
      return painted > (right - left) * 0.9;
    });
    check('courtyard: and the courtyard is left unpainted', bridged.length === 0,
      `${bridged.length} storeys painted across the gap`);
  }
}

console.log(`elevation harness: ${passed} checks passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach(line => console.log(`  \u2718 ${line}`));
  process.exit(1);
}
