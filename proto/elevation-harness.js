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
  for (const file of ['formatters.js', 'wall-types.js', 'geometry-2d.js', 'drawing-format.js', 'room-standards.js', 'cut-view.js']) {
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
  const point = raw => {
    const x = num(raw?.x), z = num(raw?.z);
    return x === null || z === null ? null : { x, z };
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
  // Mirrors LAYOUT.dc.html's normaliseLevelAssembly exactly — the foundation
  // stack reads slabThicknessIn / footingDepthIn off it.
  const positive = (v, fb) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : fb);
  const normalise = a => ({
    wallHeightFt: positive(a?.wallHeightFt, DEFAULT_WALL_TOP_FT),
    joistDepthIn: positive(a?.joistDepthIn, 11 + 7 / 8),
    joistSpacingIn: positive(a?.joistSpacingIn, 16),
    sheathingIn: positive(a?.sheathingIn, 3 / 4),
    slabThicknessIn: positive(a?.slabThicknessIn, 3),
    footingDepthIn: positive(a?.footingDepthIn, 8),
    footingWidthIn: positive(a?.footingWidthIn, null),
  });
  const levelAssembly = id => normalise(assemblies[id]);
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
    levelFloorFt: id => { const a = levelAssembly(id); return (a.joistDepthIn + a.sheathingIn) / 12; },
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
      return mode === 'thickened' ? 'thickened' : 'gradebeam';
    },
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

const file = process.argv[2] || path.join(ROOT, 'proto', 'repro-L-house.draft');
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

// ── The envelope is correct and must not move ─────────────────────────
// Stated for every view: the fix hides, so nothing may appear over the top.
for (const id of ['E1', 'E2', 'E3', 'E4']) {
  check(`${id}: no ink above the tallest ridge`,
    inkIn(views[id], { uLo: -99, uHi: 99, eLo: WING_A_RIDGE + 0.2, eHi: 99 }) === 0);
}

console.log(`elevation harness: ${passed} checks passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach(line => console.log(`  \u2718 ${line}`));
  process.exit(1);
}
