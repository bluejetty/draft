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

const ROOT = path.join(__dirname, '..');

// THE PLUMBING MOVED OUT, whole, and comes back under the same names: see
// proto/harness-env.js for why (a spec needs the env builder, and Playwright's
// transpiler will not load a file whose exports end in a top-level `return`).
const {
  loadDraftModules, buildEnv, standardElevationCuts, paintElevation,
  recordingCtx, E_MARK_SIDES,
} = require('./harness-env.js');
module.exports = {
  loadDraftModules, buildEnv, standardElevationCuts, paintElevation,
  recordingCtx, E_MARK_SIDES,
};

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
// `keep` narrows the count to one class of stroke. Without it this sums EVERY
// stroke crossing the box, which is how the gable-climb check below came to
// pass whether the wall climbed or not: the roof's own rakes cross the same
// box and carry it over the threshold on their own. Board #346.
const inkIn = (view, { uLo, uHi, eLo, eHi, keep = null }) => {
  let feet = 0;
  (keep ? segmentsOf(view).filter(keep) : segmentsOf(view)).forEach(({ a, b }) => {
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
// The line weight drawElevationView strokes a WALL FACE with (cut-view.js:1277)
// — the path that walks the per-sample tops. Roof rakes and eaves carry other
// weights, which is what lets a check ask about the wall alone.
const WALL_FACE_W = 1.25;

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
  //
  // WALL INK ONLY. This check counted every stroke in the box until board
  // #346, and the box holds three roof strokes of 13-16ft each — so it read
  // "climbed" at 50ft whether the wall climbed (5.72ft of its own ink) or
  // stayed flat on its plate (0.00). Mutating gableTopAt to never climb, and
  // to always climb, both left it green. WALL_FACE is the weight
  // drawElevationView strokes a wall face with (cut-view.js:1277), which is
  // the path that walks the sampled tops gableTopAt fills.
  const wallFace = s => s.w === WALL_FACE_W;
  check('E4: the near gable-end wall still climbs its gable',
    inkIn(v, { uLo: 2, uHi: 9, eLo: 18, eHi: 21, keep: wallFace }) > 3,
    `${inkIn(v, { uLo: 2, uHi: 9, eLo: 18, eHi: 21, keep: wallFace }).toFixed(2)} ft of wall ink`
      + ` (all strokes: ${inkIn(v, { uLo: 2, uHi: 9, eLo: 18, eHi: 21 }).toFixed(2)} ft)`);
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

// ── board #346: the degenerate segment, and what edgeOnOutline does with it ──
// distToSeg answers distance-to-`a` for a zero-length edge; the shared export
// answers Infinity. The work order expected the `<= eps` test above to go
// permanently false under the export. IT DOES NOT, and the reason is
// structural rather than lucky: onBoundary is a `.some()` over every edge, and
// a zero-length edge sits exactly on a point its two neighbours already reach,
// so the one Infinity is skipped and a neighbour answers.
//
// It flips in exactly one shape — an outline whose edges are ALL degenerate,
// every point in the same place. There the export answers false where
// distToSeg answered true, and false is the better answer: a "outline" that is
// one point has no boundary for an edge to lie along.
//
// These four checks are why no caller-local fallback was added here. A guard
// for a case that cannot arise is not a guard.
{
  const P = (x, z) => ({ x, z });
  const square = { points: [P(0, 0), P(10, 0), P(10, 10), P(0, 10)] };
  const dupCorner = { points: [P(0, 0), P(10, 0), P(10, 0), P(10, 10), P(0, 10)] };
  check('board #346: an edge along a clean outline is on the boundary',
    env.edgeOnOutline(P(2, 0), P(8, 0), square) === true);
  check('board #346: and an edge well off it is not — the test can say no',
    env.edgeOnOutline(P(2, 5), P(8, 5), square) === false);
  check('board #346: a duplicated corner does not hide the edge beside it',
    env.edgeOnOutline(P(2, 0), P(10, 0), dupCorner) === true,
    'a zero-length edge must be skipped by .some(), not fatal to it');
  check('board #346: an outline collapsed to one point carries no boundary',
    env.edgeOnOutline(P(5, 5), P(5, 5), { points: [P(5, 5), P(5, 5), P(5, 5)] }) === false,
    'the shared export refuses a zero-length edge, and refusing is correct here');
}

// ── A ROOF BEARS ON THE WALLS THAT HOLD IT UP ──────────────────────────────
//
// Movie, 19 Sep, on a bungalow's elevation: "the roof is real messed on this
// one". Measured off that very drawing, which is the fixture below:
//
//     floor levels in the stack   MAIN FL wallTop 8.09   2ND FL wallTop 17.24
//     stack.bearing                                                    17.240
//     house roof bore at                                               17.240
//     garage roof bore at                                               8.094
//     walls on 2ND FL                                                        0
//
// The house roof floated nine feet above the walls under it, over a level
// with nothing standing on it -- because `bearing` was the top of the TOPMOST
// FLOOR LEVEL IN THE STACK, and floorLevels() keeps a level for having a
// floor layer view rather than for having anything built there. The default
// stack always carries 2ND FL, so every one-storey house on both pages drew
// its roof a storey high, and always had.
//
// IT WENT UNSEEN BECAUSE NOTHING CORRECT STOOD BESIDE IT. A garage roof
// carries `plateHeightFt` and bears on its own storey, so until the garage
// got a roof there was no second roof in the elevation to disagree with.
//
// THE CHECKS ARE A PAIR, and the second is what keeps the first honest:
// bearing must DROP to the occupied storey here, and must NOT move on a
// drawing whose top floor is occupied. A fix that simply lowered every
// bearing would satisfy the first alone.
{
  const bFile = path.join(ROOT, 'proto', 'repro-bungalow-garage-roofs.draft');
  const bEnv = buildEnv(win, JSON.parse(fs.readFileSync(bFile, 'utf8')));
  const CV = win.DraftCutView;
  const bStack = CV.sectionLevelStack(bEnv);
  const floors = bStack.floors;
  const occupied = id => bEnv.walls().some(w => Number(w.levelId) === id);

  // THE FIXTURE'S REACH, ASSERTED BEFORE IT IS TRUSTED -- the same rule the
  // garage block above follows. Every check here is about an EMPTY top
  // storey, and on a fixture that grew walls up there they would all pass
  // while measuring nothing at all.
  check('bungalow fixture: more than one floor level in the stack',
    floors.length > 1, `${floors.length} floor levels`);
  check('bungalow fixture: and its top floor level is empty',
    !occupied(floors[floors.length - 1].id),
    'the drawing must have a storey with nothing on it');
  check('bungalow fixture: while a lower one is not',
    occupied(floors[0].id), 'something has to stand somewhere');

  check('a roof bears on the top storey that has walls, not the top of the list',
    Math.abs(bStack.bearing - floors[0].wallTop) < 0.001,
    `bearing ${bStack.bearing.toFixed(3)} vs the occupied storey's ${floors[0].wallTop.toFixed(3)}`);

  const houseRoof = bEnv.roofs().find(r => r.garage !== true);
  const garageRoof = bEnv.roofs().find(r => r.garage === true);
  check('bungalow fixture: it has both a house roof and a garage roof',
    !!houseRoof && !!garageRoof);
  // AND THE TWO AGREE. On a one-storey house the garage roof's own plate and
  // the house roof's bearing are the same line, and that agreement IS what a
  // drafter reads as the roof sitting on the walls.
  check('and on a one-storey house the house roof and the garage roof bear together',
    Math.abs(CV.roofBaseElev(houseRoof, bStack, bEnv)
      - CV.roofBaseElev(garageRoof, bStack, bEnv)) < 0.01,
    `house ${CV.roofBaseElev(houseRoof, bStack, bEnv).toFixed(3)} `
    + `garage ${CV.roofBaseElev(garageRoof, bStack, bEnv).toFixed(3)}`);

  // THE CONTROL, on a fixture whose top storey IS occupied: the number must
  // not move. This is what makes the change safe in the one file that draws
  // every elevation and section on both pages -- it moves nothing except
  // where it was already wrong.
  const gEnv2 = buildEnv(win, JSON.parse(
    fs.readFileSync(path.join(ROOT, 'proto', 'repro-garage-house.draft'), 'utf8')));
  const gStack2 = CV.sectionLevelStack(gEnv2);
  const gTop = gStack2.floors[gStack2.floors.length - 1];
  check('control: the other fixture-s top floor level is occupied',
    gEnv2.walls().some(w => Number(w.levelId) === gTop.id),
    'or the check below proves nothing');
  check('control: and its bearing is still the top of the stack, unmoved',
    Math.abs(gStack2.bearing - gTop.wallTop) < 0.001,
    `bearing ${gStack2.bearing.toFixed(3)} vs top ${gTop.wallTop.toFixed(3)}`);
}

// ── THE FASCIA IS BANDED ONCE, OVER THE EAVE'S TRUE LENGTH ─────────────────
//
// Movie, 19 Sep, on the far right of a bungalow's front elevation: "the fascia
// still has extra line (that is a long lasting problem we haven-t been able to
// solve)". Measured rather than eyeballed, by recording both passes' spans:
//
//     silhouette run   u0 -22        u1 46.25
//     eave face edge   u0  22.947    u1 48      -> 46.25..48 survives
//
// Twenty-one inches of fascia hanging off the end of an eave already banded to
// within two feet of there. The silhouette is SAMPLED -- 240 steps along the
// cut, 40 depth probes each -- and near a roof's outer corner the roof is a
// sliver in depth that every probe misses, so the run stops early. The face
// edge is exact. Three runs in that one elevation ended short, by 1.75 ft,
// 1.0 ft and 0.167 ft, and the `> 0.2` filter downstream is why only some were
// ever visible: 0.167 was dropped by luck and 1.75 was not.
//
// So the run is grown to what it approximates. Raising the filter instead
// would trade the stub for a GAP -- the shortfall is real, the eave would just
// stop early -- and a tolerance is what produced this in the first place.
//
// THESE CHECK THE ARITHMETIC, which is why it was pulled out of the canvas
// work: everything around it has to be looked at, and this can be measured.
{
  const CV = win.DraftCutView;
  const run = (u0, u1, top) => ({ u0, u1, base: top - 5.5 / 12, top });
  const TOP = 8.552083333333334;

  // THE MEASURED CASE, in its own numbers.
  const grown = CV.extendRunsToEaves([run(-22, 46.25, TOP)],
    [{ u0: 22.947, u1: 48, top: TOP }]);
  check('a run that stops short of its eave is grown to the eave-s end',
    Math.abs(grown[0].u1 - 48) < 1e-9,
    `u1 ${grown[0].u1} -- the silhouette sampled to 46.25, the eave runs to 48`);
  check('and its other end is left where it was',
    Math.abs(grown[0].u0 - -22) < 1e-9, `u0 ${grown[0].u0}`);

  // TOUCHING COUNTS. The sampling stops short, so the run's end and the edge's
  // start are a sample apart rather than crossing -- an overlap test that
  // demanded a crossing would leave exactly the stub this exists to remove.
  const touch = CV.extendRunsToEaves([run(0, 10, TOP)], [{ u0: 10, u1: 14, top: TOP }]);
  check('an eave that merely meets the run-s end still extends it',
    Math.abs(touch[0].u1 - 14) < 1e-9, `u1 ${touch[0].u1}`);

  // AND WHAT IT MUST NOT DO, which is the half that keeps the rest honest.
  const apart = CV.extendRunsToEaves([run(0, 10, TOP)], [{ u0: 30, u1: 40, top: TOP }]);
  check('an eave nowhere near the run does not stretch it across the gap',
    apart[0].u0 === 0 && apart[0].u1 === 10,
    `${apart[0].u0}..${apart[0].u1}`);

  // A GARAGE ROOF RUNS AT ANOTHER HEIGHT THROUGH THE SAME STRETCH OF PAPER.
  // Grown to that, one band would stretch across a roof it has nothing to do
  // with -- the same confusion that put a house roof on a garage plate.
  const lower = CV.extendRunsToEaves([run(0, 10, TOP)],
    [{ u0: 5, u1: 40, top: TOP - 9 }]);
  check('an eave at another height does not extend a band that is not its own',
    lower[0].u1 === 10, `u1 ${lower[0].u1} -- a different roof-s eave`);

  check('a run with no eaves at all is left alone',
    CV.extendRunsToEaves([run(0, 10, TOP)], [])[0].u1 === 10);
  // The run keeps everything else it carried: `base` is what the band is drawn
  // from and what the subtraction downstream matches on.
  check('and a grown run keeps the base it was banded at',
    Math.abs(grown[0].base - (TOP - 5.5 / 12)) < 1e-9, `base ${grown[0].base}`);
}


// ── A ROOF IS A SURFACE, AND THE PAINTER-S ORDER IS WHAT HIDES THINGS ──────
//
// Movie, 24 Sep, on elevations of his own drawing: *"the roofs look
// 'transparent'"*; over a marked-up screenshot, *"there are still arrached
// garage lines showing (looks like some things are 'tranparent')"*; and then
// the exact one: *"the 2nd floor ext wall on left side is seen withint the
// roof it should stop once it hits the top of the roof (line)"*.
//
// THE PAINTER HID NOTHING BEHIND A ROOF BECAUSE ROOFS DID NOT PAINT. Wall
// faces are filled opaque far-first, so a nearer wall hides a farther one by
// being painted over it; the roof passes only ever STROKED edges. Occlusion
// by a roof was therefore hand-built, one symptom at a time -- a wall top
// pulled down into a roof's band, a roof edge dropped behind a wall, the
// joist band asking the same question a third way -- and each of those hides
// ONE thing. On the 2 STOREY + GARAGE the house's corner ran down through the
// garage hip and the house's own hip end read as open sky.
//
// SO THE CHECKS ARE ABOUT PAINT ORDER, not about a rule. `modelFills` is the
// fill list in the order it went down, in feet, and "is this hidden" is
// "which fill is last over this spot" -- the same question the drafter's eye
// asks. A check phrased as "the wall's top was clipped" would go green again
// the day the clipping came back and the fill went away.
{
  const CV = win.DraftCutView;
  const G = win.DraftGeometry2D;
  const rFile = path.join(ROOT, 'proto', 'repro-2storey-garage.draft');
  const rEnv = buildEnv(win, JSON.parse(fs.readFileSync(rFile, 'utf8')));
  const rStack = CV.sectionLevelStack(rEnv);
  const cuts = standardElevationCuts(rEnv);
  const vFront = paintElevation(win, rEnv, cuts.find(c => c.id === 'E1'));
  const vBack = paintElevation(win, rEnv, cuts.find(c => c.id === 'E3'));
  const garageRoof = rEnv.roofs().find(roof => roof.garage === true);
  const houseRoof = rEnv.roofs().find(roof => roof.garage !== true);

  // THE FIXTURE-S REACH, ASSERTED BEFORE IT IS TRUSTED -- every check below
  // indexes one of these two.
  check('opaque roofs: the fixture has a garage roof and a house roof',
    !!garageRoof && !!houseRoof,
    `${rEnv.roofs().length} roofs, ${rEnv.roofs().filter(r => r.garage).length} on a garage`);

  // Each roof face, as the painter throws it onto the paper: `u` off the
  // cut's axis, elevation off the eave line plus the face's own rise.
  const project = (view, roof) => {
    const eaveTop = CV.roofEaveElev(roof, rStack, rEnv);
    const pitch = roof.pitch || 4;
    return G.roofFaces(roof, G.roofSkeleton(roof)).map(face => face.points.map(pt => ({
      u: pt.x * view.axis.x + pt.z * view.axis.z,
      e: eaveTop + G.roofFaceRise(face, pt, pitch),
    })));
  };
  const twiceArea = poly => poly.reduce((sum, a, i) => {
    const b = poly[(i + 1) % poly.length];
    return sum + a.u * b.e - b.u * a.e;
  }, 0);
  // THE ONE FACE THE VIEWER CAN SEE ANY OF. A roof's other slopes are edge on
  // from here -- every corner shares a `u` with the corner above it -- so they
  // project to a line and fill nothing, which is the right answer and not a
  // gap: what shows between the rakes of a gable seen end on is the gable END
  // WALL, and the wall pass fills that.
  //
  // AND THE RAKE ITSELF IS NOT THE GABLE WALL, which is the half of this that
  // was wrong until 27 Sep. The SURFACE fills nothing, correctly. Its EDGE is
  // another matter: the roof has a thickness, and seen end on that thickness
  // is the strip between the two lines a drafter reads as the rake. That
  // strip was left unfilled with the rest of the face, so the wall behind it
  // showed through -- invisible for as long as everything on the sheet was
  // white, and plain the moment a wall carried a hatch. Movie: "it looks like
  // the finishes are coming through the gable of lower roof". The check below
  // is the one that would have said so.
  const facingFace = (view, roof) => project(view, roof)
    .reduce((best, poly) => (best === null || Math.abs(twiceArea(poly)) > Math.abs(twiceArea(best))
      ? poly : best), null);
  const inside = (poly, u, e) => {
    let hit = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[j], b = poly[i];
      if ((a.e > e) !== (b.e > e)
        && u < a.u + (b.u - a.u) * (e - a.e) / (b.e - a.e)) hit = !hit;
    }
    return hit;
  };
  // Same corners, in any order and at either winding: the painter is free to
  // walk a face whichever way the skeleton handed it over.
  const sameShape = (drawn, want, tol = 0.02) => drawn.length === want.length
    && want.every(w => drawn.some(d => Math.abs(d.u - w.u) < tol && Math.abs(d.e - w.e) < tol))
    && drawn.every(d => want.some(w => Math.abs(d.u - w.u) < tol && Math.abs(d.e - w.e) < tol));
  const fillOf = (view, poly) => view.modelFills.findIndex(f => sameShape(f.pts, poly));
  const lastFillAt = (view, u, e) => {
    let last = -1;
    view.modelFills.forEach((f, i) => { if (inside(f.pts, u, e)) last = i; });
    return last;
  };

  // ── A GABLE SEEN SQUARE ON STILL COVERS WHAT IS BEHIND IT ───────────
  //
  // ASKED WITH THE FINISHES ON, because that is the drawing the defect
  // appears in: a white wall behind a white roof is a white rake, and nothing
  // on any sheet ever looked wrong.
  //
  // MEASURED AS PAINT ORDER, which is the only thing that answers "is this
  // visible" on an elevation. A hatch stroke lying in a rake must have a FILL
  // over it, or the wall is showing through the roof.
  {
    // repro-garage-house, NOT this block's own fixture: it is the one whose
    // lower gable is seen square on from E2 with a two-storey wall standing
    // behind it, which is the geometry the defect needs. Movie's screenshot
    // was of this house.
    const clad = JSON.parse(fs.readFileSync(
      path.join(ROOT, 'proto', 'repro-garage-house.draft'), 'utf8'));
    clad.walls.forEach(w => { if ((w.view || 'plan') === 'plan') w.finish = 'brick'; });
    const cEnv = buildEnv(win, clad);
    const cCut = standardElevationCuts(cEnv).find(c => c.id === 'E2');
    const plain = paintElevation(win, cEnv, cCut, { pxPerFt: 26 });
    const hatched = paintElevation(win, cEnv, cCut, { pxPerFt: 26, finishes: true });
    // THE FIXTURE'S OWN REACH FIRST. A house with no hatch on it passes every
    // line below while proving nothing, and that is exactly how the first
    // version of this probe came back green: proto/harness-env.js was dropping
    // `finish` off every wall before the painter ever saw it, so the elevation
    // drew plain and the probe reported zero hatch strokes on a clad house.
    const key = st => JSON.stringify(st.pts.map(pt =>
      [Math.round(pt.u * 100), Math.round(pt.e * 100), !!pt.move]));
    const before = new Set(plain.strokes.map(key));
    const hatch = hatched.strokes.filter(st => !before.has(key(st)));
    check('gable rake: asking for finishes actually puts a hatch on the wall',
      hatch.length > 0, `${hatch.length} hatch strokes over ${plain.strokes.length} plain`);
    // The roof planes this cut sees EDGE ON -- the ones that fill no surface.
    const edgeOn = cEnv.roofs().flatMap(roof => {
      const eaveTop = CV.roofEaveElev(roof, CV.sectionLevelStack(cEnv), cEnv);
      const pitch = roof.pitch || 4;
      return G.roofFaces(roof, G.roofSkeleton(roof)).map(face => face.points.map(pt => ({
        u: pt.x * hatched.axis.x + pt.z * hatched.axis.z,
        e: eaveTop + G.roofFaceRise(face, pt, pitch),
      })));
    }).filter(poly => poly.length >= 3 && Math.abs(twiceArea(poly)) < 1e-6);
    check('gable rake: and this elevation has a roof plane it sees edge on',
      edgeOn.length > 0, `${edgeOn.length} roof planes project to a line on E2`);
    // A stroke is IN a rake when it falls on the projected line, within the
    // fascia's own depth below it -- which is the band the fix fills.
    const FASCIA_FT = 5.5 / 12;
    // EVERY POINT, NOT ONE. A hatch is a SINGLE path carrying the whole face
    // -- fifteen hundred points of brick -- so sampling its midpoint asks
    // about one brick in one place, which is how the first version of this
    // check passed against the unfixed painter. Measured: it found nothing in
    // any rake at all and then reported that nothing as clean.
    const bandAt = (poly, u) => {
      const us = poly.map(p => p.u);
      if (u < Math.min(...us) || u > Math.max(...us)) return null;
      const lo = poly.reduce((a, b) => (a.u <= b.u ? a : b));
      const hi = poly.reduce((a, b) => (a.u >= b.u ? a : b));
      if (hi.u - lo.u < 0.05) return null;
      return lo.e + (hi.e - lo.e) * (u - lo.u) / (hi.u - lo.u);
    };
    const inRake = hatch.flatMap(st => st.pts
      .filter(pt => edgeOn.some(poly => {
        const at = bandAt(poly, pt.u);
        return at !== null && pt.e <= at && pt.e >= at - FASCIA_FT;
      }))
      .map(pt => ({ seq: st.seq, u: pt.u, e: pt.e })));
    // ── THE CLADDING REACHES THE BOTTOM OF THE SILL PLATE ─────────────
    //
    // Movie, 27 Sep, looking at the Real Estate elevations: *"the top area
    // where they should start the finishing should be the bottom of the sill
    // plate"*, and again *"the main floor bottom line will just move to the
    // bottom of sill plate"*. He could SEE the defect: a band of bare white
    // under the stone, where the rim and the plate were.
    //
    // WHICH IS ALSO THE SECOND HALF OF BOARD #56. cut-view's foundation pass
    // carries a note saying that when exterior finishes land, the plate has to
    // follow the WALL rather than the palette -- or a garage in different
    // siding grows a band of the house's at its foot. It follows it by being
    // INSIDE the cladding now: the finish starts underneath the plate, so the
    // plate wears whatever the wall above it wears, for free.
    //
    // MEASURED, not asserted from the same arithmetic the painter uses: the
    // lowest hatch stroke on the sheet against floorBottom less a sill plate.
    {
      const plate = win.DraftLevelAssembly.SILL_PLATE_IN / 12;
      const lowest = CV.sectionLevelStack(cEnv).floors[0];
      const sill = lowest.floorBottom - plate;
      const lows = hatch.flatMap(st => st.pts.map(pt => pt.e));
      const low = lows.length ? Math.min(...lows) : Infinity;
      check('the cladding runs down to the bottom of the sill plate',
        Number.isFinite(low) && Math.abs(low - sill) < 0.05,
        `lowest hatch ${low.toFixed(4)} against a sill at ${sill.toFixed(4)} `
        + `(floorBottom ${lowest.floorBottom.toFixed(4)} less a ${(plate * 12)}" plate)`);
      // AND IT IS BELOW THE FLOOR, which is the part a drafter sees. Measured
      // against the wall's own foot rather than a constant, so the check still
      // means something on a house with a different floor package.
      check('and therefore BELOW the floor it used to start at, by the rim and the plate',
        low < lowest.floorTop - 0.5,
        `${low.toFixed(4)} against a floor top of ${lowest.floorTop.toFixed(4)}`);
    }

    // ── AND THE CLAIM IS ABOUT THE ROOF, NOT ABOUT WHAT IS BEHIND IT ──
    //
    // "No hatch shows in any rake" is too strong and was measured so: a rake
    // whose roof stands BEHIND the wall is one the wall is right to cover,
    // and 76 of 338 points in the first reading were exactly that -- the
    // garage's own gable, seen through the house from E2, where the wall
    // winning is the drawing being correct.
    //
    // WHAT IS ALWAYS TRUE is that an edge-on plane covering any paper at all
    // PUTS SOMETHING DOWN. Before the fix it put down nothing -- `area2` of
    // zero, dropped, no fill anywhere -- so there was never anything for the
    // sort to place, whichever side of the wall it belonged on. That is the
    // defect, stated without reaching past it.
    // BY SHAPE, NOT BY "IS SOMETHING THERE". Asked the loose way this passes
    // against the unfixed painter too, because the WALL's own fill covers
    // that spot -- which is the whole complaint. The band has four corners and
    // a fill matching them is the roof's or nobody's.
    const rakeFilled = edgeOn.filter(poly => {
      const lo = poly.reduce((p, q) => (p.u <= q.u ? p : q));
      const hi = poly.reduce((p, q) => (p.u >= q.u ? p : q));
      if (hi.u - lo.u < 0.05) return true;       // no paper: nothing to fill
      const band = [
        { u: lo.u, e: lo.e }, { u: hi.u, e: hi.e },
        { u: hi.u, e: hi.e - FASCIA_FT }, { u: lo.u, e: lo.e - FASCIA_FT },
      ];
      return hatched.modelFills.some(f => sameShape(f.pts, band, 0.02));
    });
    check('every gable rake seen edge on puts a fill down, or the wall shows through it',
      rakeFilled.length === edgeOn.length,
      `${rakeFilled.length} of ${edgeOn.length} edge-on planes fill their rake`);
  }

  // ── AND A SILL LEDGE UNDER EVERY WINDOW THE MASONRY REACHES ────────
  //
  // Movie, 27 Sep, with a photograph of his own drawing: *"for the types that
  // are over 1\" under windows we should put a ledge (topledge over the brick)
  // below the window if the brick goes into the window area"*, then *"lets add
  // a choice button on the menu that allows them to TURN OFF the ledge"*.
  //
  // MEASURED BY ITS GEOMETRY, not by "did anything appear". A ledge is a rect
  // sitting ON the window's sill line, the cap's own height, and WIDER than
  // the opening by the cap's projection at each jamb -- that last is the whole
  // point of a sill, which runs past the jambs so water leaves them too. Asked
  // any looser ("is there a fill near the sill") the wall's own face fill
  // answers yes and the check proves nothing, which is exactly how the gable
  // rake probe above passed four times against an unfixed painter.
  {
    const clad = JSON.parse(fs.readFileSync(
      path.join(ROOT, 'proto', 'repro-L-house.draft'), 'utf8'));
    const CAP_HIGH = 2 / 12, HORN = 1 / 12;      // brick's cap, from the table
    // TO THE TOP, so the band is never CAPPED: a water table is the same rect
    // shape at a band's own top, and a probe that cannot tell the two apart is
    // a probe that would call a water table a sill ledge.
    // A WINDOW WITH NO SILL HEIGHT AT ALL, added to the fixture on purpose.
    // The painter defaults a missing sill to SILL_FT, the same three feet the
    // OPENING is drawn at a dozen lines further down -- so a ledge that used
    // its own number would float away from the window it belongs to. Nothing
    // in either repro carries such a record, so that branch was unreachable
    // and a mutant putting a foot and a half back SURVIVED, hand-tested.
    clad.fenestrations.push({ id: 'fenestration-nosill', wallId: 'wall-14',
      levelId: 3, view: 'plan', type: 'window', layer: 'A-GLAZ',
    // AT THE CURRENT HEAD, not the retired 6'-6": a superseded head is
    // MIGRATED by drawing-format, and the migration carries the sill up with
    // it -- 6'-6" becomes 7'-0" and a sill of nothing becomes a sill of six
    // inches. Which is how the first version of this record still failed to
    // reach the branch it was written for.
      offset: 33, width: 3.5, sillHeight: 0, headHeight: 7, garage: false });
    const laid = extra => {
      const copy = JSON.parse(JSON.stringify(clad));
      copy.walls.forEach(w => {
        if ((w.view || 'plan') === 'plan') {
          w.finishBands = [{ finishId: 'brick', anchor: 'sill', lowFt: 0, toTop: true,
            ...extra }];
        }
      });
      const cEnv = buildEnv(win, copy);
      const cut = standardElevationCuts(cEnv).find(c => c.id === 'E1');
      return { env: cEnv, view: paintElevation(win, cEnv, cut, { pxPerFt: 30, finishes: true }) };
    };
    // Every window this elevation can see, at the elevation its sill sits at
    // and the width it opens -- read off the RECORD, so the check knows what
    // it is looking for before it looks.
    const wanted = (cEnv, view) => {
      const stack = CV.sectionLevelStack(cEnv);
      return cEnv.fenestrations().filter(f => f.type === 'window').map(f => {
        const level = stack.floors.find(fl => fl.id === f.levelId);
        const wall = cEnv.walls().find(w => w.id === f.wallId);
        if (!level || !wall) return null;
        const span = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
        const uA = wall.start.x * view.axis.x + wall.start.z * view.axis.z;
        const uB = wall.end.x * view.axis.x + wall.end.z * view.axis.z;
        // THE THREE IS A LITERAL ON PURPOSE. Read off cut-view's own SILL_FT
        // this line would agree with the painter whatever the painter said,
        // which is a mirror and not a check.
        return { e: level.floorTop + (f.sillHeight > 0 ? f.sillHeight : 3),
          width: f.width,
          u: (uA + uB) / 2 + (uB - uA) * ((f.offset / span) - 0.5) };
      }).filter(Boolean);
    };
    // A rect ON that sill line, the cap's height, and overhanging BOTH jambs.
    const ledgeFor = (view, want) => view.modelFills.find(f => {
      if (f.pts.length !== 4) return false;
      const es = f.pts.map(pt => pt.e), us = f.pts.map(pt => pt.u);
      const lo = Math.min(...es), hi = Math.max(...es);
      if (Math.abs(lo - want.e) > 0.05) return false;
      if (Math.abs((hi - lo) - CAP_HIGH) > 0.02) return false;
      const wide = Math.max(...us) - Math.min(...us);
      return Math.abs(wide - (want.width + 2 * HORN)) < 0.05;
    });

    const on = laid({});
    const want = wanted(on.env, on.view);
    check('sill ledge: the fixture has windows this elevation could grow one under',
      want.length > 0, `${want.length} windows on the clad walls`);
    const drawn = want.filter(w => ledgeFor(on.view, w));
    check('brick carried past a window gets a ledge on its sill, overhanging both jambs',
      drawn.length > 0 && drawn.length === want.length,
      `${drawn.length} of ${want.length} windows, each wanting a `
      + `${(CAP_HIGH * 12).toFixed(0)}" rect ${(HORN * 24).toFixed(0)}" wider than its opening`);

    // THE BUTTON. Same house, same band, one key added.
    const off = laid({ noSillLedge: true });
    check('and the band that turns the ledge off has none of them drawn',
      wanted(off.env, off.view).every(w => !ledgeFor(off.view, w)),
      `${wanted(off.env, off.view).filter(w => ledgeFor(off.view, w)).length} ledges survived`);

    // OVER AN INCH IS THE GATE, which is his: a sill is a masonry detail, and
    // half-inch siding has no joint to cover. Asked of the DRAWING rather than
    // of the table, because the table agreeing with itself is not the claim.
    const thin = laid({ finishId: 'siding_h' });
    check('and half-inch siding grows none -- the ledge is for what is over an inch',
      wanted(thin.env, thin.view).every(w => !ledgeFor(thin.view, w)),
      `${wanted(thin.env, thin.view).filter(w => ledgeFor(thin.view, w)).length} ledges on siding`);

    // AND THE BRICK HAS TO REACH THE WINDOW. A wainscot stopping below the
    // sills terminates on its own water table, not on a ledge under a window
    // it never got to -- *"if the brick goes into the window area"*.
    const low = laid({ toTop: undefined, highFt: 1 });
    check('and a wainscot stopping below the sills grows no ledge under them',
      wanted(low.env, low.view).every(w => !ledgeFor(low.view, w)),
      `${wanted(low.env, low.view).filter(w => ledgeFor(low.view, w)).length} ledges `
      + 'under windows the brick never reached');

    // AND NOT UNDER A DOOR. A door has a threshold: the masonry runs past its
    // jambs to the ground, with no horizontal joint under it to cover. The
    // first draft of the painter filtered on the WALL alone and defaulted a
    // missing sill to a foot and a half, so every door grew a stone sill
    // floating across its opening.
    //
    // ON THE GARAGE HOUSE, because the L-house has no door in it at all --
    // which this block asserted the wrong way round first and went red for,
    // reporting "0 doors" instead of passing over a claim it could not make.
    {
      const g = JSON.parse(fs.readFileSync(
        path.join(ROOT, 'proto', 'repro-garage-house.draft'), 'utf8'));
      g.walls.forEach(w => {
        if ((w.view || 'plan') === 'plan') {
          w.finishBands = [{ finishId: 'brick', anchor: 'sill', lowFt: 0, toTop: true }];
        }
      });
      const gEnv = buildEnv(win, g);
      const doors = gEnv.fenestrations().filter(f => f.type === 'door');
      check('sill ledge: the garage house has doors to get this wrong on',
        doors.length > 0, `${doors.length} doors`);
      const gStack = CV.sectionLevelStack(gEnv);
      const sheets = standardElevationCuts(gEnv)
        .map(cut => paintElevation(win, gEnv, cut, { pxPerFt: 30, finishes: true }));
      // EVERY HEIGHT A DEFAULT COULD HAVE PUT ONE AT: the threshold itself, the
      // foot and a half the first draft hardcoded, and the three feet SILL_FT
      // holds now. A door's record says sillHeight 0, so any of the three is a
      // ledge the drawing invented.
      const wrong = sheets.flatMap(view => doors.flatMap(d => {
        const level = gStack.floors.find(fl => fl.id === d.levelId);
        if (!level) return [];
        return [0, 1.5, 3]
          .filter(at => ledgeFor(view, { e: level.floorTop + at, width: d.width }))
          .map(at => `${d.id}@${at}`);
      }));
      check('and no door grows a sill ledge, at a threshold or at any defaulted sill',
        wrong.length === 0,
        wrong.length ? wrong.join(' ')
          : `${doors.length} doors over ${sheets.length} elevations, each asked at `
            + 'the slab, 1\'-6" and 3\'-0"');
    }
  }

  // ── EVERY STANDARD ELEVATION LOOKS AT THE HOUSE ──────────────────
  //
  // Movie, 27 Sep, on EXT. FINISH: *"the E3 is showing the FRONT - E1 should
  // be front -- the other E2, E3, E4 are also in wrong positions"*. The page
  // carried its own copy of the four view directions and every one of them was
  // NEGATED, so each elevation drew the opposite wall. Nothing in the repo
  // said so, because a flipped elevation is a perfectly good drawing -- of the
  // wrong wall.
  //
  // THE INVARIANT IS THE ONE THING ALL THE COPIES MUST AGREE ON: a cut's
  // `dirVec` is the OUTWARD normal of the face it shows, so it points from the
  // house toward the viewer. Stated as a dot product against the house's own
  // centre, which is true of the right answer at any orientation and false of
  // a negated one -- rather than as four vectors written down again, which
  // would just be a fifth copy.
  {
    const walls = env.walls().filter(w => w.levelId > 0);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    walls.forEach(w => [w.start, w.end].forEach(pt => {
      minX = Math.min(minX, pt.x); maxX = Math.max(maxX, pt.x);
      minZ = Math.min(minZ, pt.z); maxZ = Math.max(maxZ, pt.z);
    }));
    const box = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
    const cuts = standardElevationCuts(env);
    const outward = cut => {
      const mid = { x: (cut.startPt.x + cut.endPt.x) / 2,
        z: (cut.startPt.z + cut.endPt.z) / 2 };
      return cut.dirVec.x * (mid.x - box.x) + cut.dirVec.z * (mid.z - box.z);
    };
    check('fixture: the four standard elevations are there to be asked about',
      cuts.length === 4, cuts.map(c => c.id).join(' '));
    check('each one is seen from its own side of the house, not from the far side',
      cuts.every(cut => outward(cut) > 0),
      cuts.map(cut => `${cut.id}:${outward(cut) > 0 ? 'out' : 'IN'}`).join(' '));
    // AND THE SHARED TABLE SAYS THE SAME, which is what EXT. FINISH reads now
    // instead of its own. cut-marks.js derives the vector from the side and
    // sign it already stores, so this asks whether that derivation agrees with
    // the cuts the drawing is actually painted from.
    const MARKS = win.DraftCutMarks;
    check('and cut-marks derives the same four directions the cuts carry',
      !!MARKS && cuts.every(cut => {
        const d = MARKS.eMarkDir(cut.id);
        return d && d.x === cut.dirVec.x && d.z === cut.dirVec.z;
      }),
      MARKS ? cuts.map(cut => `${cut.id}:${JSON.stringify(MARKS.eMarkDir(cut.id))}`).join(' ')
        : 'cut-marks.js is not loaded in the harness env');
  }

  // ── AND WHAT THE ROOF IS COVERED IN REACHES THE SHEET ───────────
  //
  // Movie, 27 Sep: *"we should make a special ROOF area with the roof corners
  // in there and the ROOFING TYPE"*. roof-types names the ten and
  // roof-patterns draws the seven pictures they share, both proved offline --
  // what neither can answer is whether the ELEVATION asks either of them.
  //
  // MEASURED AS THE DIFFERENCE BETWEEN TWO SHEETS, one asked for finishes and
  // one not, on a house whose roofs are named. Asked any looser -- "is there
  // ink on the roof" -- the roof's own outline answers yes and the check
  // proves nothing, which is exactly how the gable-rake probe passed four
  // times against a painter that drew no hatch at all.
  {
    const roofed = JSON.parse(fs.readFileSync(
      path.join(ROOT, 'proto', 'repro-garage-house.draft'), 'utf8'));
    // TWO MATERIALS, because one is a claim about a constant. If both roofs
    // came back with the same number of strokes the painter could be drawing
    // either one for both, or a default for each.
    roofed.roofs.forEach((roof, i) => { roof.roofing = i === 0 ? 'slate' : 'corrugated'; });
    const rEnv = buildEnv(win, roofed);
    check('fixture: the roofs carry a roofing the format kept',
      rEnv.roofs().filter(r => r.roofing).length === roofed.roofs.length,
      rEnv.roofs().map(r => r.roofing || 'none').join(' '));
    const rCut = standardElevationCuts(rEnv).find(c => c.id === 'E1');
    const bare = paintElevation(win, rEnv, rCut, { pxPerFt: 26 });
    const hatched = paintElevation(win, rEnv, rCut, { pxPerFt: 26, finishes: true });
    check('asking for finishes puts more ink on the sheet than not asking',
      hatched.strokes.length > bare.strokes.length,
      `${hatched.strokes.length} against ${bare.strokes.length}`);

    // AND IT LANDS ON THE ROOF, not somewhere else that happens to be new.
    // Every point of the new ink is measured against the roof planes' own
    // projected outlines -- a hatch outside all of them is a hatch on the
    // wall, or on the sky.
    const key = st => JSON.stringify(st.pts.map(pt =>
      [Math.round(pt.u * 100), Math.round(pt.e * 100), !!pt.move]));
    const before = new Set(bare.strokes.map(key));
    const added = hatched.strokes.filter(st => !before.has(key(st)));
    check('and the new ink is a hatch, not one stroke of something',
      added.length > 4, `${added.length} strokes`);
    const planes = rEnv.roofs().flatMap(roof => {
      const eaveTop = CV.roofEaveElev(roof, CV.sectionLevelStack(rEnv), rEnv);
      const pitch = roof.pitch || 4;
      return G.roofFaces(roof, G.roofSkeleton(roof)).map(face => face.points.map(pt => ({
        u: pt.x * hatched.axis.x + pt.z * hatched.axis.z,
        e: eaveTop + G.roofFaceRise(face, pt, pitch),
      })));
    }).filter(poly => poly.length >= 3);
    // THE PLANE ITSELF, NOT ITS BOUNDING BOX. This was a box first, and the
    // mutant that removes the clip SURVIVED it: the hatch frame is the face's
    // bounding PARALLELOGRAM and deliberately overhangs a triangular face at
    // the ridge, so an unclipped hatch spills into the corners above the two
    // sloping edges -- which are inside the box and outside the roof. A gable
    // is a triangle; a check that cannot tell a triangle from its box cannot
    // see the one place this can go wrong.
    const near = (poly, u, e, pad) => poly.some((a, i) => {
      const b = poly[(i + 1) % poly.length];
      const vx = b.u - a.u, vy = b.e - a.e;
      const len2 = vx * vx + vy * vy;
      const t = len2 > 0
        ? Math.max(0, Math.min(1, ((u - a.u) * vx + (e - a.e) * vy) / len2)) : 0;
      return Math.hypot(u - (a.u + vx * t), e - (a.e + vy * t)) <= pad;
    });
    const within = (poly, u, e, pad) => inside(poly, u, e) || near(poly, u, e, pad);

    // ── WHAT KEEPS THE HATCH ON THE ROOF IS THE CLIP ──────────────────
    //
    // And the claim has to be stated as the clip, because the frame a pattern
    // is drawn in is the face's bounding PARALLELOGRAM and overhangs a
    // triangular roof at the ridge ON PURPOSE -- a frame cut to the triangle
    // would stop the courses short of it. So the strokes themselves DO run
    // past the roof's two sloping edges, and a check reading only the strokes
    // reads that as a defect. Measured: 176 "strays" on a correct painter.
    //
    // THE RECORDER NOW REMEMBERS THE CLIP for exactly this. Asked without it
    // the mutant that stops clipping lays down identical strokes and survives,
    // which it did.
    const clipped = added.filter(st => Array.isArray(st.clip) && st.clip.length > 2);
    check('every bit of the hatch is laid under a clip, which is what holds it on the roof',
      clipped.length === added.length,
      `${clipped.length} of ${added.length} strokes clipped`);
    // BY SHAPE, NOT BY "SITS INSIDE ONE". Asked the loose way, a clip set to
    // an EAVE BOARD passes: the board hangs a fascia below the eave, which is
    // five and a half inches -- under any tolerance loose enough to allow for
    // rounding. Measured, and that mutant survived. A face has its own corners
    // and a clip matching them is that face or nothing.
    const clipIsAPlane = clipped.every(st =>
      planes.some(poly => sameShape(st.clip, poly, 0.05)));
    check('and the clip is the roof plane itself, corner for corner',
      clipped.length > 0 && clipIsAPlane,
      `${clipped.length} clips against ${planes.length} planes`);
    // AND THE INK IS ON THE RIGHT ROOF. The clip proves it cannot escape its
    // face; this proves the face it was given is one of the roof's, so a hatch
    // clipped to a WALL would still be caught.
    const frameStray = added.flatMap(st => st.pts).filter(pt =>
      !planes.some(poly => {
        const us = poly.map(q => q.u), es = poly.map(q => q.e);
        return pt.u >= Math.min(...us) - 0.5 && pt.u <= Math.max(...us) + 0.5
          && pt.e >= Math.min(...es) - 0.5 && pt.e <= Math.max(...es) + 0.5;
      }));
    check('and none of it is laid outside the roofs altogether, on a wall or in the sky',
      frameStray.length === 0,
      frameStray.length ? `${frameStray.length} strays, first at `
        + `${frameStray[0].u.toFixed(2)},${frameStray[0].e.toFixed(2)}` : 'all on the roofs');

    // AND A ROOF WEARING SOMETHING ELSE IS DRAWN DIFFERENTLY. The claim the
    // whole table rests on: ten materials that all drew the same would be one
    // material with ten labels.
    const swapped = JSON.parse(JSON.stringify(roofed));
    swapped.roofs.forEach(roof => { roof.roofing = 'pfm_vertical'; });
    const sEnv = buildEnv(win, swapped);
    const other = paintElevation(win, sEnv,
      standardElevationCuts(sEnv).find(c => c.id === 'E1'), { pxPerFt: 26, finishes: true });
    // COUNTED IN POINTS AND NOT IN STROKES, which is this check being wrong
    // once: a pattern builds ONE path per face and strokes it once, so slate,
    // corrugated and standing seam all come back as the same number of
    // strokes -- 59 against 59 -- and a claim that ten materials draw
    // differently passed on a measurement that could not have seen otherwise.
    // The lines are the points.
    const ink = view => view.strokes.reduce((n, st) => n + st.pts.length, 0);
    check('and a house roofed in something else is a different drawing',
      ink(other) !== ink(hatched),
      `${ink(other)} points in standing seam against ${ink(hatched)} `
      + 'in slate and corrugated');
  }

// ── WHERE THE MAIN FLOOR'S CLADDING STARTS ────────────────────────────────
//
// Movie, 27 Sep: *"make the main floor textures start at bottom of sill
// plate"*, and before it *"the top area where they should start the finishing
// should be the bottom of the sill plate"*.
//
// NOTHING MEASURED IT. cut-view's faceLines says the line in a comment and
// computes it in one expression, and the comment has been right since it was
// written -- but a rule stated only in prose is a rule that moves the first
// time someone edits the expression under it. This is the measurement.
//
// AND IT IS ASKED OF THE PAINTER, not of the arithmetic. drawFinish is
// intercepted and its BOX recorded, so the claim is about the rectangle the
// cladding was actually painted into. Recomputing floorBottom minus a plate
// here and comparing it to the same sum inside the painter would be this
// harness checking its own subtraction.
//
// THE TWO FACTS TOGETHER ARE THE CLAIM, and either alone passes on a broken
// drawing. That the base starts at the sill LINE is one -- a band anchored to
// 'sill' at lowFt 0 shares the base's bottom edge, which pins the base to the
// same line a drafter names in the rail. That the sill line is a PLATE BELOW
// THE BEARING LINE is the other, and it is what makes the line the bottom of
// the sill plate rather than the top of it. A painter that clad from the top
// of the plate would leave an inch and a half of bare wall above the
// concrete, all the way round the house, and it would read as a drawing
// artefact rather than as a missing plate.
{
  const fFile = path.join(ROOT, 'proto', 'repro-garage-house.draft');
  const fSaved = JSON.parse(fs.readFileSync(fFile, 'utf8'));
  const probeEnv = buildEnv(win, fSaved);
  const mainId = probeEnv.floorLevels()[0].id;

  // BRICK ON THE MAIN FLOOR AND A ONE-FOOT BAND ON THE SILL. The band is the
  // ruler: it is anchored to the line under test, so its own bottom edge IS
  // that line, and no number in this file has to agree with a number in the
  // painter for the comparison to mean something.
  // THE HOUSE'S OWN WALLS, AND THIS IS THE CHECK BEING WRONG ONCE. The
  // fixture's garage stands on MAIN FL too, so "every wall on the main floor"
  // clad the garage as well -- and a garage face takes its sill from its OWN
  // slab (`floor - plateFt`), by a different branch of the same expression. The
  // first brick box painted was a garage face, so the mutation that moves the
  // HOUSE's sill line a plate up changed nothing this check could see and
  // survived. Measured, not reasoned: 180 checks passed with the plate
  // deleted.
  const clad = JSON.parse(JSON.stringify(fSaved));
  const houseOnMain = wall => Number(wall.levelId) === Number(mainId) && !wall.body;
  clad.walls.filter(houseOnMain).forEach(wall => {
    wall.finish = 'brick';
    wall.finishBands = [{ finishId: 'ledgestone', anchor: 'sill', lowFt: 0, highFt: 1 }];
  });
  const cladEnv = buildEnv(win, clad);
  const cladStack = win.DraftCutView.sectionLevelStack(cladEnv);

  const boxes = [];
  const FP = win.DraftFinishPatterns;
  const realDraw = FP.drawFinish;
  win.DraftFinishPatterns = { ...FP,
    drawFinish: (ctx, box, finish, inks) => {
      boxes.push({ id: finish && finish.id, yTop: box.yTop, yBottom: box.yBottom,
        pxPerFt: box.pxPerFt });
      return realDraw(ctx, box, finish, inks);
    } };
  paintElevation(win, cladEnv,
    standardElevationCuts(cladEnv).find(c => c.id === 'E1'), { pxPerFt: 40, finishes: true });
  win.DraftFinishPatterns = FP;

  // THE LOWEST BOX OF EACH, not the first painted. Paint order is faces in
  // whatever order they come, and the question is about the house's foot -- so
  // the box that reaches furthest DOWN is the one to read. On this fixture
  // every house face shares one sill, so lowest and first agree; picking the
  // lowest says which one is meant when they do not.
  const lowest = id => boxes.filter(b => b.id === id)
    .sort((a, b) => b.yBottom - a.yBottom)[0];
  const base = lowest('brick');
  const onSill = lowest('ledgestone');

  // THE FIXTURE'S REACH, ASSERTED BEFORE IT IS TRUSTED -- the same rule the
  // garage block above states. Every comparison below reads two boxes, and a
  // comparison of two undefineds is a check that cannot fail.
  check('cladding fixture: the house has walls on the main floor that are not '
    + 'the garage\'s', clad.walls.filter(houseOnMain).length > 0,
    `${clad.walls.filter(houseOnMain).length} house walls on level ${mainId}`);
  check('cladding fixture: the main floor painted its base finish',
    !!base, `${boxes.length} finish boxes: ${boxes.map(b => b.id).join(', ')}`);
  check('cladding fixture: and the sill band beside it', !!onSill,
    `${boxes.map(b => b.id).join(', ')}`);

  if (base && onSill) {
    check('the base finish starts on the SILL LINE, not at the wall\'s foot',
      Math.abs(base.yBottom - onSill.yBottom) < 0.01,
      `base bottom ${base.yBottom.toFixed(2)}px, sill band bottom ${onSill.yBottom.toFixed(2)}px`);
    // A foot is a foot: the ruler is the right length, so the band really is
    // anchored where it says and is not some other span that happens to end
    // in the same place.
    check('and the one-foot band really is a foot tall',
      Math.abs((onSill.yBottom - onSill.yTop) / onSill.pxPerFt - 1) < 1e-6,
      `${((onSill.yBottom - onSill.yTop) / onSill.pxPerFt).toFixed(4)} ft`);

    // AND THE SILL LINE IS A PLATE BELOW THE BEARING LINE. floorBottom is
    // where the joists bear, which is the TOP of the sill plate; the cladding
    // starts a plate lower, on the concrete. Measured as the distance from the
    // main floor's TOP -- a line this harness can name without re-deriving the
    // plate -- so the 1 1/2" is the whole of what is being asserted.
    const main = cladStack.floors[0];
    const plateFt = win.DraftLevelAssembly.SILL_PLATE_IN / 12;
    const cladHeightFt = (base.yBottom - base.yTop) / base.pxPerFt;
    const headToFloorTop = cladHeightFt - (main.floorTop - (main.floorBottom - plateFt));
    check('and the sill line is a PLATE BELOW the bearing line, so it is the '
      + 'BOTTOM of the sill plate',
      Math.abs(headToFloorTop - (main.wallTop - main.floorTop)) < 0.02,
      `cladding is ${cladHeightFt.toFixed(4)} ft tall; floorTop to wallTop is `
      + `${(main.wallTop - main.floorTop).toFixed(4)} ft, and floorTop down to the `
      + `sill is ${(main.floorTop - (main.floorBottom - plateFt)).toFixed(4)} ft `
      + `(a ${(plateFt * 12).toFixed(1)}\" plate under a `
      + `${((main.floorTop - main.floorBottom) * 12).toFixed(3)}\" floor)`);
  }
}

// ── AND THE STOREY ABOVE STOPS AT THE CEILING BELOW ───────────────────────
//
// Movie, 27 Sep: *"the main floor and garage should go down to the bottom of
// sill plate and 2nd floor should go to main fl ceiling line"*. The block
// above pins the first half. THIS EXISTS BECAUSE MUTATION FOUND NOTHING
// PINNING THE SECOND: making faceSillFt deduct a sill plate from EVERY floor
// -- so the upper storey clads from 1 1/2" below the ceiling it sits on --
// left all 193 checks green, and left the EXT. FINISH pick-box spec green
// too, because the box follows the same function and moved with it.
//
// TWO STOREYS IN ONE PAINT, IN DIFFERENT MATERIALS, which is what makes the
// answer attributable: with one finish there is no telling an upper box from
// a lower one, and "the lowest box" is the main floor by construction.
//
// ANCHORED ON A LINE THIS FILE HAS ALREADY PROVED rather than on a number it
// computes. The main floor's cladding bottom is checked above to be
// floorBottom less a plate; everything here is measured as a PIXEL DIFFERENCE
// from that box, so the only new arithmetic is a subtraction.
{
  const uFile = path.join(ROOT, 'proto', 'repro-garage-house.draft');
  const uSaved = JSON.parse(fs.readFileSync(uFile, 'utf8'));
  // OFF env.floorLevels(), NOT OFF THE WALLS' OWN levelIds, and that is this
  // check being wrong once: `levelId > 0 && !wall.body` still admits the
  // FOUNDATION, whose walls are a view rather than a body. Sorted ascending
  // it handed back level 1 as "main", so the main floor was clad in the
  // UPPER material and the harness reported three boxes and no brick. The
  // env already names the framed floors, bottom first; asking it is the same
  // fix the block above made for the same reason.
  const uLevels = buildEnv(win, uSaved).floorLevels();
  const levelIds = uLevels.map(l => Number(l.id));

  // THE FIXTURE MUST HAVE TWO STOREYS, asserted before it is trusted: on a
  // bungalow this whole block would compare a box against nothing and pass.
  check('two-storey fixture: the house has walls on a second framed level',
    levelIds.length > 1, `framed levels: ${levelIds.join(', ')}`);

  if (levelIds.length > 1) {
    const [mainId, upperId] = levelIds;
    const two = JSON.parse(JSON.stringify(uSaved));
    two.walls.forEach(w => {
      if (w.body || Number(w.levelId) <= 0) return;
      if (Number(w.levelId) === mainId) w.finish = 'brick';
      if (Number(w.levelId) === upperId) w.finish = 'ledgestone';
    });
    const twoEnv = buildEnv(win, two);
    const twoStack = win.DraftCutView.sectionLevelStack(twoEnv);

    const seen = [];
    const FP = win.DraftFinishPatterns;
    const realDraw = FP.drawFinish;
    win.DraftFinishPatterns = { ...FP,
      drawFinish: (ctx, box, finish, inks) => {
        seen.push({ id: finish && finish.id, yBottom: box.yBottom, pxPerFt: box.pxPerFt });
        return realDraw(ctx, box, finish, inks);
      } };
    paintElevation(win, twoEnv,
      standardElevationCuts(twoEnv).find(c => c.id === 'E1'), { pxPerFt: 40, finishes: true });
    win.DraftFinishPatterns = FP;

    const lowest = id => seen.filter(b => b.id === id)
      .sort((a, b) => b.yBottom - a.yBottom)[0];
    const low = lowest('brick');
    const high = lowest('ledgestone');
    check('two-storey fixture: both storeys painted, in their own materials',
      !!low && !!high, `${seen.length} boxes: ${[...new Set(seen.map(b => b.id))].join(', ')}`);

    if (low && high) {
      const mainLevel = twoStack.floors.find(f => Number(f.id) === mainId);
      const plateFt = win.DraftLevelAssembly.SILL_PLATE_IN / 12;
      // The proved anchor, then one subtraction. y grows DOWNWARD, so the
      // upper box's smaller yBottom is the higher elevation.
      const mainSillFt = mainLevel.floorBottom - plateFt;
      const upperSillFt = mainSillFt + (low.yBottom - high.yBottom) / low.pxPerFt;
      check('the storey above clads from the CEILING BELOW, with no plate '
        + 'deducted from it',
        Math.abs(upperSillFt - mainLevel.wallTop) < 0.01,
        `upper cladding starts at ${upperSillFt.toFixed(4)} ft; the main floor's `
        + `wall top is ${mainLevel.wallTop.toFixed(4)} ft `
        + `(a plate would put it ${(mainLevel.wallTop - plateFt).toFixed(4)})`);

      // AND THE TWO ARE NOT THE SAME LINE, or the check above is comparing a
      // number to itself through a fixture where every storey starts together.
      check('two-storey fixture: the storeys start at different heights',
        Math.abs(low.yBottom - high.yBottom) > 1,
        `main ${low.yBottom.toFixed(2)}px, upper ${high.yBottom.toFixed(2)}px`);
    }
  }
}

// ── THE BAND THAT TURNS THE CORNER ────────────────────────────────────────
//
// Movie asked for the wrap and the rail has offered it since the band
// controls landed -- a checkbox that stores `wrapFt: 2` and a readout beside
// it. THE PAINTER HAD NEVER READ THE FIELD: `wrapFt` appeared nowhere in
// cut-view.js, so the toggle stored a number and the drawing did not change.
// EXTFINISH's own note claimed the opposite in writing -- "the painter reads
// all six" -- which is the worst kind of dead control, the page asserting
// that it works.
//
// IT SHOWS ON THE NEIGHBOUR, and that is why this check has to be built the
// way it is. A band that wraps belongs to wall A; what a drafter sees is A's
// stone standing two feet along wall B. So the band goes on the wall at one
// END of the face under test, and the measurement is taken on the face that
// does NOT own it.
//
// ONE WALL CLAD, NOT ALL OF THEM, or every face would carry the material for
// its own reasons and a wrap would be indistinguishable from a base coat.
{
  const wFile = path.join(ROOT, 'proto', 'repro-garage-house.draft');
  const wSaved = JSON.parse(fs.readFileSync(wFile, 'utf8'));
  const wEnv0 = buildEnv(win, wSaved);
  const wMain = wEnv0.floorLevels()[0].id;
  const houseWalls = wSaved.walls.filter(wall =>
    Number(wall.levelId) === Number(wMain) && !wall.body
    && (wall.view || 'plan') === 'plan');

  // A CORNER THE E1 CUT CAN SEE, and getting this wrong is how the check
  // first came back empty. E1 is the FRONT -- the SOUTH face -- so of the two
  // walls running east-west it draws the one at the GREATER z, and the other
  // is the back wall E3 shows. The band went on the back wall's corner and
  // the measurement was taken on the front, which is a perfectly correct
  // painter drawing nothing where nobody put anything.
  //
  // PICKED BY ASKING THE GEOMETRY, not by naming a wall id, so the check
  // survives the fixture being redrawn -- and by asking the CUT's own
  // direction rather than hardcoding "south", so it survives E1 being
  // re-seated.
  const cutFor = env => standardElevationCuts(env).find(c => c.id === 'E1');
  const e1Dir = cutFor(wEnv0).dirVec;
  const towardViewer = wall =>
    ((wall.start.x + wall.end.x) / 2) * e1Dir.x
    + ((wall.start.z + wall.end.z) / 2) * e1Dir.z;
  const acrossFront = houseWalls
    .filter(wall =>
      Math.abs(wall.end.x - wall.start.x) > Math.abs(wall.end.z - wall.start.z))
    .sort((a, b) => towardViewer(b) - towardViewer(a));
  const pick = acrossFront.map(front => {
    const meets = houseWalls.find(other => other !== front
      && [other.start, other.end].some(p =>
        [front.start, front.end].some(q =>
          Math.abs(p.x - q.x) < 1e-6 && Math.abs(p.z - q.z) < 1e-6)));
    return meets ? { front, meets } : null;
  }).find(Boolean);

  check('wrap fixture: a front wall with a wall meeting it at a corner',
    !!pick, `${acrossFront.length} walls across the front of `
    + `${houseWalls.length} house walls on level ${wMain}`);

  if (pick) {
    const boxesFor = saved => {
      const env = buildEnv(win, saved);
      const seen = [];
      const FP = win.DraftFinishPatterns;
      const real = FP.drawFinish;
      win.DraftFinishPatterns = { ...FP,
        drawFinish: (ctx, box, finish, inks) => {
          seen.push({ id: finish && finish.id, x0: box.x0, x1: box.x1,
            yTop: box.yTop, yBottom: box.yBottom, pxPerFt: box.pxPerFt });
          return real(ctx, box, finish, inks);
        } };
      paintElevation(win, env, cutFor(env), { pxPerFt: 40, finishes: true });
      win.DraftFinishPatterns = FP;
      return seen;
    };

    // THE CONTROL, and it is not a formality: ledgestone must be absent from
    // this elevation BEFORE the wrap is switched on, or "it appears" would be
    // a claim about something that was always there.
    const WRAP_FT = 2;
    const withWrap = JSON.parse(JSON.stringify(wSaved));
    const noWrap = JSON.parse(JSON.stringify(wSaved));
    const sideId = pick.meets.id;
    const bandOf = wrap => ({ finishId: 'ledgestone', anchor: 'sill',
      lowFt: 0, highFt: 3, ...(wrap ? { wrapFt: WRAP_FT } : {}) });
    withWrap.walls.filter(w => w.id === sideId)
      .forEach(w => { w.finishBands = [bandOf(true)]; });
    noWrap.walls.filter(w => w.id === sideId)
      .forEach(w => { w.finishBands = [bandOf(false)]; });

    const before = boxesFor(noWrap).filter(b => b.id === 'ledgestone');
    const after = boxesFor(withWrap).filter(b => b.id === 'ledgestone');

    check('with the wrap off, the side wall\'s band does not reach this elevation',
      before.length === 0, `${before.length} ledgestone boxes with no wrap`);
    check('and switching the wrap on carries it round the corner',
      after.length > 0, `${after.length} ledgestone boxes with wrapFt ${WRAP_FT}`);

    if (after.length) {
      // TWO FEET OF WALL, MEASURED IN THE BOX THE PAINTER USED. The front
      // wall is square to this cut, so a foot of wall is a foot of elevation
      // and the box should be WRAP_FT wide -- and asking the box rather than
      // recomputing the projection is what keeps this a measurement.
      const widest = after.sort((a, b) => (b.x1 - b.x0) - (a.x1 - a.x0))[0];
      const ftWide = (widest.x1 - widest.x0) / widest.pxPerFt;
      check('and it runs the width it was asked for, no further',
        Math.abs(ftWide - WRAP_FT) < 0.05,
        `${ftWide.toFixed(4)} ft of return against ${WRAP_FT} asked for`);

      // AND A BIGGER NUMBER REACHES FURTHER, which is what makes the field a
      // measurement rather than a flag. Without this, a painter that drew a
      // fixed two feet for any positive wrapFt passes everything above.
      const wider = JSON.parse(JSON.stringify(wSaved));
      wider.walls.filter(w => w.id === sideId).forEach(w => {
        w.finishBands = [{ finishId: 'ledgestone', anchor: 'sill',
          lowFt: 0, highFt: 3, wrapFt: WRAP_FT * 2 }];
      });
      const doubled = boxesFor(wider).filter(b => b.id === 'ledgestone')
        .sort((a, b) => (b.x1 - b.x0) - (a.x1 - a.x0))[0];
      const doubledFt = doubled ? (doubled.x1 - doubled.x0) / doubled.pxPerFt : 0;
      check('and doubling the wrap doubles the return',
        Math.abs(doubledFt - WRAP_FT * 2) < 0.05,
        `${doubledFt.toFixed(4)} ft against ${WRAP_FT * 2} asked for`);

      // ── AND IT IS AT THE RIGHT CORNER ──────────────────────────────────
      //
      // EVERY CHECK ABOVE MEASURES A WIDTH, so a painter that put the return
      // at the WRONG END of the face passes all of them -- the stripe is the
      // same two feet wide whichever corner it is nailed to. Mutation said
      // so: swapping the end the wrap starts from survived 186 green.
      //
      // TWO CORNERS, TWO MATERIALS, compared against each other rather than
      // against a computed x. Each side wall gets a different band, so the
      // page has to put them at OPPOSITE ends; a painter reading the wrong
      // end would stack both at the same one, and they would overlap.
      const bothEnds = JSON.parse(JSON.stringify(wSaved));
      const otherSide = houseWalls.find(wall => wall !== pick.meets
        && wall !== pick.front
        && [wall.start, wall.end].some(p => [pick.front.start, pick.front.end]
          .some(q => Math.abs(p.x - q.x) < 1e-6 && Math.abs(p.z - q.z) < 1e-6)));
      check('wrap fixture: the front wall has a wall at its OTHER corner too',
        !!otherSide, otherSide ? otherSide.id : 'none found');
      if (otherSide) {
        bothEnds.walls.filter(w => w.id === sideId).forEach(w => {
          w.finishBands = [bandOf(true)];
        });
        bothEnds.walls.filter(w => w.id === otherSide.id).forEach(w => {
          w.finishBands = [{ finishId: 'shake', anchor: 'sill',
            lowFt: 0, highFt: 3, wrapFt: WRAP_FT }];
        });
        const drawn = boxesFor(bothEnds);
        const a = drawn.filter(b => b.id === 'ledgestone')
          .sort((p, q) => (q.x1 - q.x0) - (p.x1 - p.x0))[0];
        const b = drawn.filter(b => b.id === 'shake')
          .sort((p, q) => (q.x1 - q.x0) - (p.x1 - p.x0))[0];
        check('both corners return, each in its own material',
          !!a && !!b, `ledgestone ${!!a}, shake ${!!b}`);
        if (a && b) {
          check('and they stand at OPPOSITE ends, not stacked at one',
            a.x1 <= b.x0 + 0.5 || b.x1 <= a.x0 + 0.5,
            `ledgestone ${a.x0.toFixed(1)}..${a.x1.toFixed(1)}, `
            + `shake ${b.x0.toFixed(1)}..${b.x1.toFixed(1)}`);
        }
      }

      // ── A BAND THAT TOUCHES NOTHING WRAPS ONTO NOTHING ─────────────────
      //
      // The corner test was doing no work this fixture could see, because the
      // only clad wall WAS at a corner -- so deleting it left 186 green. A
      // wall that shares no point with this face is the case it exists for.
      const faraway = houseWalls.find(wall => wall !== pick.front
        && ![wall.start, wall.end].some(p => [pick.front.start, pick.front.end]
          .some(q => Math.abs(p.x - q.x) < 1e-6 && Math.abs(p.z - q.z) < 1e-6)));
      check('wrap fixture: and a wall that shares no corner with it',
        !!faraway, faraway ? faraway.id : 'every wall touches the front wall');
      if (faraway) {
        const stranger = JSON.parse(JSON.stringify(wSaved));
        stranger.walls.filter(w => w.id === faraway.id).forEach(w => {
          w.finishBands = [bandOf(true)];
        });
        check('a band on a wall that meets no corner of this face does not '
          + 'wrap onto it',
          boxesFor(stranger).filter(x => x.id === 'ledgestone').length === 0,
          `${boxesFor(stranger).filter(x => x.id === 'ledgestone').length} `
          + `ledgestone boxes from ${faraway.id}`);
      }

      // ── AND TWO FEET OF WALL IS TWO FEET OF WALL, NOT OF PAPER ─────────
      //
      // u is a PROJECTION, so a wall at an angle to the cut draws shorter
      // than it is -- and a wrap measured across the paper would put more
      // stone on an angled wall than on a square one, from the same number.
      // The fixture's walls are all square to their cuts, so the mutation
      // that drops the foreshortening was invisible: 186 green with it gone.
      //
      // THE FAR END IS MOVED, NOT THE CORNER THE WRAP IS AT, so the same
      // return is being measured on a face that is now foreshortened and
      // nothing else about the gesture has changed.
      const angled = JSON.parse(JSON.stringify(wSaved));
      const shared = [pick.front.start, pick.front.end].find(p =>
        [pick.meets.start, pick.meets.end].some(q =>
          Math.abs(p.x - q.x) < 1e-6 && Math.abs(p.z - q.z) < 1e-6));
      angled.walls.filter(w => w.id === pick.front.id).forEach(w => {
        ['start', 'end'].forEach(key => {
          if (Math.abs(w[key].x - shared.x) > 1e-6 || Math.abs(w[key].z - shared.z) > 1e-6) {
            w[key] = { ...w[key], z: w[key].z - 10 };
          }
        });
      });
      angled.walls.filter(w => w.id === sideId).forEach(w => {
        w.finishBands = [bandOf(true)];
      });
      const slanted = boxesFor(angled).filter(x => x.id === 'ledgestone')
        .sort((p, q) => (q.x1 - q.x0) - (p.x1 - p.x0))[0];
      check('wrap fixture: the angled face still paints its return',
        !!slanted, slanted ? 'painted' : 'nothing drawn on the angled wall');
      if (slanted) {
        const slantFt = (slanted.x1 - slanted.x0) / slanted.pxPerFt;
        check('a return on an ANGLED wall is foreshortened, like everything '
          + 'else on that face',
          slantFt < WRAP_FT - 0.1,
          `${slantFt.toFixed(4)} ft of paper for ${WRAP_FT} ft of wall `
          + '(square would be exactly 2)');
      }
    }
  }
}

  // THE DATUM THE WHOLE SHEET HANGS OFF, stated against the DRAWING rather
  // than against its own arithmetic. `roofEaveElev` is where a rise of zero
  // lands, which is the eave line -- so the lowest point the painter puts any
  // of a roof's surface at IS that elevation, and a check that said
  // "bearing plus a fascia board" would only be reading the function back to
  // itself. MODEL hands this number to auto-windows.js for the
  // window-over-roof clearance; handed the bearing instead, a sill came out
  // 5 1/2" low and a garage ridge came up inside the glass.
  const lowestDrawn = roof => Math.min(...project(vFront, roof).flat().map(p => p.e));
  check('the eave elevation is the lowest the painter draws that roof',
    Math.abs(lowestDrawn(garageRoof) - CV.roofEaveElev(garageRoof, rStack, rEnv)) < 1e-9,
    `lowest ${lowestDrawn(garageRoof).toFixed(5)} against `
    + `${CV.roofEaveElev(garageRoof, rStack, rEnv).toFixed(5)}`);
  check('and it stands one fascia board over where the roof BEARS',
    Math.abs(CV.roofEaveElev(garageRoof, rStack, rEnv)
      - CV.roofBaseElev(garageRoof, rStack, rEnv)
      - CV.STANDARDS.ROOF_FASCIA_IN / 12) < 1e-9,
    `eave ${CV.roofEaveElev(garageRoof, rStack, rEnv).toFixed(5)}, `
    + `bearing ${CV.roofBaseElev(garageRoof, rStack, rEnv).toFixed(5)}`);

  const garageFace = facingFace(vFront, garageRoof);
  const houseFace = facingFace(vFront, houseRoof);
  const garageFill = fillOf(vFront, garageFace);
  check('E1: the garage roof-s hip end is FILLED, not outlined over sky',
    garageFill >= 0,
    `${vFront.modelFills.length} fills, none matching `
    + garageFace.map(p => `(${p.u.toFixed(2)},${p.e.toFixed(2)})`).join(' '));
  check('E1: and so is the house roof-s',
    fillOf(vFront, houseFace) >= 0,
    houseFace.map(p => `(${p.u.toFixed(2)},${p.e.toFixed(2)})`).join(' '));

  // A FOOT UNDER THE GARAGE RIDGE, WHERE THE HOUSE STANDS BEHIND IT. This is
  // the spot Movie marked: the second-floor front wall carries on up past the
  // garage roof, so the wall, one of its windows and the roof all land on
  // this same scrap of paper, and the roof is the nearest of the three.
  const ridge = garageFace.reduce((best, p) => (p.e > best.e ? p : best), garageFace[0]);
  const probeU = ridge.u, probeE = ridge.e - 1;
  const coveringBefore = vFront.modelFills
    .filter((f, i) => i < garageFill && inside(f.pts, probeU, probeE)).length;
  check('E1: a wall really does stand behind the garage ridge (or this proves nothing)',
    coveringBefore > 0,
    `${coveringBefore} earlier fills over (${probeU.toFixed(2)}, ${probeE.toFixed(2)})`);
  check('E1: and the roof is the LAST thing painted there, so the wall is hidden',
    lastFillAt(vFront, probeU, probeE) === garageFill,
    `last fill ${lastFillAt(vFront, probeU, probeE)}, garage roof ${garageFill}`);

  // THE FASCIA COMES WITH THE SHEET. The face's own polygon stops at the eave
  // LINE and the board hangs 5 1/2" below it; unfilled, a wall behind showed
  // through a stripe that deep along every eave -- the see-through narrowed,
  // not gone. Probed past the house's corner so nothing but the roof can be
  // the answer.
  const eaveTop = CV.roofEaveElev(garageRoof, rStack, rEnv);
  const past = Math.max(...garageFace.map(p => p.u)) - 2;
  check('E1: the fascia band under the eave is filled too',
    lastFillAt(vFront, past, eaveTop - (5.5 / 12) / 2) >= 0,
    `nothing painted at (${past.toFixed(2)}, ${(eaveTop - 5.5 / 24).toFixed(3)})`);

  // ── AND E3, WHERE THE GARAGE IS THE ONE BEHIND ──────────────────────────
  //
  // The band used to be drawn twice: once by the SILHOUETTE, which knows a
  // run's `u` and its base and nothing about what stands in front of it, and
  // once by the face-edge pass, which tests every station against `hidden`
  // and then subtracted whatever the silhouette had drawn. On this fixture's
  // BACK elevation the garage sits behind the house, its eave was grown to
  // its true end by `extendRunsToEaves` -- correctly, for the outline -- and
  // the silhouette then banded it straight across twenty-two feet of
  // two-storey wall. So the band is the face-edge pass's now, all of it.
  const houseWalls = rEnv.walls().filter(wall => (wall.view || 'plan') !== 'foundation');
  const houseUs = houseWalls.flatMap(wall => [wall.start, wall.end])
    .map(pt => pt.x * vBack.axis.x + pt.z * vBack.axis.z);
  const garageUs = (garageRoof.points || [])
    .map(pt => pt.x * vBack.axis.x + pt.z * vBack.axis.z);
  const overlapLo = Math.max(Math.min(...houseUs), Math.min(...garageUs)) + 1;
  const overlapHi = Math.min(Math.max(...houseUs), Math.max(...garageUs)) - 1;
  check('E3: the house and the garage roof really do overlap on the paper',
    overlapHi - overlapLo > 4, `${overlapLo.toFixed(2)}..${overlapHi.toFixed(2)}`);
  const bandInk = inkIn(vBack, {
    uLo: overlapLo, uHi: overlapHi,
    eLo: eaveTop - 5.5 / 12 - 0.05, eHi: eaveTop + 0.05,
    keep: seg => seg.w > 2,
  });
  check('E3: and no fascia band is drawn across the house standing in front of it',
    bandInk < 0.5, `${bandInk.toFixed(2)} ft of heavy ink at the garage eave`);
}


// ── WHERE A SHEET CARRIES ON, NO LINE AND NO BOARD ────────────────────────
//
// Movie, 25 Sep, on the short gable that covers the garage tie: *"your
// updated roof has an extra line in it, that should be all one connected
// roof"*.
//
// THE PIECE AND THE STUB ARE ONE PLANE. The piece is the stub's right slope
// continued over the tie, and it is its own RECORD only because the straight
// skeleton cannot take the notch -- measured on a dense grid, a single
// notched loop reads 7.167 ft of rise where the stub reads 2.167, a five-foot
// error, whatever its edges are declared as. So the shape is right and the
// SEAM is the price, and the painter has to know not to draw it.
//
// HALF OF THIS WAS DONE A DAY EARLIER. That edge is marked `gable` because
// gable is this app's only way to say "no overhang" -- and also its only way
// to say "put a rake board on it" -- so it wore a board, and the board came
// off. The LINE stayed: on E1 it lay on the stub's own hip and could not be
// seen, on E4 it projects to a vertical and is what he marked.
//
// ASKED PER STATION, NOT PER EDGE, which is the whole of it. The stub's gable
// at the house line is shared for the four feet the piece covers and free for
// the other twenty-two; only the shared four may go.
{
  const CV = win.DraftCutView;
  const GEO = win.DraftGeometry2D;
  const tFile = path.join(ROOT, 'proto', 'repro-tie-gable.draft');
  if (!fs.existsSync(tFile)) {
    failures.push('proto/repro-tie-gable.draft is missing');
  } else {
    const tEnv = buildEnv(win, JSON.parse(fs.readFileSync(tFile, 'utf8')));
    const tStack = CV.sectionLevelStack(tEnv);
    const view = paintElevation(win, tEnv, standardElevationCuts(tEnv).find(c => c.id === 'E4'));
    const tie = tEnv.roofs().find(roof => (roof.points || [])
      .some(pt => Math.abs(pt.z - 17) < 0.01));
    const stub = tEnv.roofs().find(roof => roof.garage === true && roof !== tie);
    check('tie fixture: the build raised both the stub and the tie-s piece',
      !!tie && !!stub,
      `${tEnv.roofs().length} roofs, ${tEnv.roofs().filter(r => r.garage).length} on the garage`);
    if (tie && stub) {
      // THE SEAM, IN THIS ELEVATION'S OWN TERMS. E4 looks along +x, so u = -z
      // and the join at z = 20 reads u = -20. The piece's plane there stands
      // its own rise above its eave; between the two is the line Movie
      // marked.
      const eave = CV.roofEaveElev(tie, tStack, tEnv);
      const top = Math.max(...GEO.roofFaces(tie, GEO.roofSkeleton(tie))
        .flatMap(f => f.points.map(pt => eave + GEO.roofFaceRise(f, pt, tie.pitch || 4))));
      // THE ROOF EDGE'S OWN WEIGHT, for WALL_FACE_W's reason one pass over:
      // the question is whether the SEAM is drawn, and a seam is a roof edge.
      // Asked of every stroke instead, this counts the house's own right-hand
      // corner -- 1.35 ft of it at exactly this u -- which is a wall line
      // with every right to be there AND which the piece's own fill paints
      // over anyway. Strokes are not ink; this file has been caught by that
      // twice now.
      const ROOF_EDGE_W = 1.5;
      const along = (uWant, eLo, eHi) => {
        let feet = 0;
        view.strokes.forEach(st => {
          if (Math.abs(st.w - ROOF_EDGE_W) > 1e-9) return;
          for (let i = 1; i < st.pts.length; i++) {
            const a = st.pts[i - 1], b = st.pts[i];
            if (b.move) continue;
            if (Math.abs(a.u - uWant) > 0.05 || Math.abs(b.u - uWant) > 0.05) continue;
            const lo = Math.max(Math.min(a.e, b.e), eLo);
            const hi = Math.min(Math.max(a.e, b.e), eHi);
            if (hi > lo) feet += hi - lo;
          }
        });
        return feet;
      };
      check('the piece stands proud of its own eave, so the seam has somewhere to be',
        top - eave > 1, `${(top - eave).toFixed(3)} ft of rise`);
      check('E4: no line runs down the join between the two sheets',
        along(-20, eave + 0.05, top - 0.05) < 0.1,
        `${along(-20, eave + 0.05, top - 0.05).toFixed(3)} ft of ink on the seam`);
      // AND THE OTHER HALF. Above the piece the stub's gable end is a real
      // edge with open air past it, and it has to stay: a painter that
      // stopped drawing this edge altogether would pass the check above.
      const ridge = Math.max(...GEO.roofFaces(stub, GEO.roofSkeleton(stub))
        .flatMap(f => f.points.map(pt =>
          CV.roofEaveElev(stub, tStack, tEnv) + GEO.roofFaceRise(f, pt, stub.pitch || 4))));
      check('and above it the stub-s own gable end is still drawn',
        along(-20, top + 0.4, ridge - 0.05) > 1,
        `${along(-20, top + 0.4, ridge - 0.05).toFixed(3)} ft between ${top.toFixed(2)} and ${ridge.toFixed(2)}`);
      // ── AND IT REACHES THE PIECE, not the nearest sampling station ─────
      //
      // Movie, 26 Sep, on the corner above the tie once the ghost under it
      // was gone: "this little 'wall not fully dark' spot still has light
      // area".
      //
      // THE 0.4 ABOVE IS WHERE IT WAS HIDING. That bound was picked to clear
      // the seam and it happened to clear this too: the gable end stopped at
      // e 10.902 with the piece's own top at 10.577, four inches short,
      // because the run ended at the last STATION that showed rather than at
      // the boundary. The edge runs x 8..22, its ten stations are 1.4 ft
      // apart, and the piece takes over at x = 16 -- between two of them.
      //
      // WHICH LEFT THE WALL'S CORNER HALF PAINTED. The house's corner stands
      // at exactly this u; the garage's roof fill goes down after it and
      // takes half the stroke's pixel; and this edge is what puts it back.
      // Over those four inches nothing did, so the corner read grey there
      // and black above -- one line in two weights.
      //
      // A TENTH OF A FOOT, which is a station's width divided by fourteen: it
      // can only be met by a run that ends where the sheets actually meet.
      check('and it reaches the piece it dies into, not the nearest station',
        along(-20, top + 0.1, ridge - 0.05) > ridge - top - 0.25,
        `${along(-20, top + 0.1, ridge - 0.05).toFixed(3)} ft drawn of `
        + `${(ridge - top).toFixed(3)} ft between the piece at ${top.toFixed(3)} `
        + `and the ridge at ${ridge.toFixed(3)}`);
      // AND THE PIECE'S OWN EDGE AGAINST THE HOUSE KEEPS ITS FULL LENGTH.
      // The probe that finds the seam lands on the neighbour's BOUNDARY at a
      // shared corner, where inside-or-out is a coin toss; read there it ate
      // a station and with it a foot and a half of this line.
      const tieZ = Math.min(...(tie.points || []).map(pt => pt.z));
      const houseEnd = view.strokes.reduce((feet, st) => {
        if (Math.abs(st.w - ROOF_EDGE_W) > 1e-9) return feet;
        for (let i = 1; i < st.pts.length; i++) {
          const a = st.pts[i - 1], b = st.pts[i];
          if (b.move) continue;
          if (Math.abs(a.e - top) > 0.05 || Math.abs(b.e - top) > 0.05) continue;
          feet += Math.abs(b.u - a.u);
        }
        return feet;
      }, 0);
      check('E4: and the piece-s edge against the house runs its whole length',
        Math.abs(houseEnd - (20 - tieZ)) < 0.2,
        `${houseEnd.toFixed(2)} ft drawn at e ${top.toFixed(3)}, the piece is ${(20 - tieZ).toFixed(2)} ft deep`);
    }
  }
}

// ── A CALLER THAT MEASURES ITS OWN FURNITURE GETS MORE WHITE ───────────────
//
// Movie, 22 Sep, on an elevation with both side menus open: *"when the side
// menus are open they cover the drawing in elevation, can we make the zoom for
// the elevations so the house is a little smaller and there is more white
// around the edges and sides so these menus when expanded don-t cover it"*.
//
// MODEL.html measures its two rails and hands the painter what they cover.
// THIS IS THE PAINTER-S HALF, and it is here rather than in a browser because
// it is arithmetic. What only a browser can prove -- that the numbers handed
// over are the rails- real boxes, and that a rail opening after the first
// paint repaints -- is tests/elevation-clears-the-rails.spec.js.
{
  const CV = win.DraftCutView;
  const cut = standardElevationCuts(env).find(c => c.id === 'E1');
  const stack = CV.sectionLevelStack(env);
  const dir = cut.dirVec;
  const axis = { x: dir.z, z: -dir.x };
  const W = 900;
  const RULE_LEAD = 18;   // cut-view.js draws its datum tails from `marginL - 18`

  // SCREEN MODE, which paintElevation() above cannot reach: it paints through
  // an EXTERNAL FIT (pxPerFt + extents), and an external fit takes no margins
  // at all -- on a LAYOUT sheet the paper decides, not the screen. A reading
  // taken through that helper would report a dead margin and a working one
  // alike.
  //
  // THE HOUSE AND THE REFERENCE RULES ARE MEASURED APART, because they answer
  // different questions. The level marks and the two grade tails are drawn
  // FROM the margin -- they follow it exactly -- so a span taken over all the
  // ink would narrow on a margin the house ignored completely. What the
  // drafter is covered by is the house. Told apart by shape rather than by
  // ink: a reference rule is dead flat, and this drawing-s outline has both a
  // left and a right vertical, so nothing of the house is lost by asking only
  // its upright strokes where it begins and ends.
  const span = opts => {
    const { ctx, strokes, texts } = recordingCtx();
    const ok = CV.drawElevationView(env, ctx, W, 600, cut, stack, axis, () => {}, opts);
    const upright = strokes.filter(s => {
      const ys = s.pts.map(p => p.y);
      return Math.max(...ys) - Math.min(...ys) > 0.5;
    });
    const xs = strokes.flatMap(s => s.pts.map(p => p.x));
    const body = upright.flatMap(s => s.pts.map(p => p.x));
    // THE LEVEL MARKS' OWN READINGS, which is the one thing here that is not a
    // stroke. They are right-aligned, so `x` is the RIGHT edge of the number
    // and the label runs leftward from it; the header at the top-left is
    // left-aligned and is not one of these.
    const marks = texts.filter(t => t.align === 'right');
    return {
      ok, n: xs.length, uprights: upright.length,
      inkLo: Math.min(...xs), inkHi: Math.max(...xs),
      lo: Math.min(...body), hi: Math.max(...body),
      marks: marks.length,
      markX: marks.length ? Math.min(...marks.map(t => t.x)) : null,
    };
  };
  const at = v => v.toFixed(1);

  const plain = span(undefined);
  check('the elevation paints in screen mode at all',
    plain.ok && plain.n > 100 && plain.uprights > 4,
    `ok ${plain.ok}, ${plain.n} points, ${plain.uprights} upright strokes`);

  const WANT = 150;   // under the half-canvas cap below, which 900/2 puts at 450
  const wide = span({ margins: { left: WANT, right: WANT } });
  check('a caller asking for margin each side gets a narrower house',
    wide.hi - wide.lo < (plain.hi - plain.lo) - 1,
    `${at(wide.hi - wide.lo)}px of house against ${at(plain.hi - plain.lo)}px`);
  check('and the house sits inside the margins it asked for',
    wide.lo >= WANT - 1 && wide.hi <= W - WANT + 1,
    `house ${at(wide.lo)}..${at(wide.hi)} in ${W}px with ${WANT}px asked each side`);
  // EXACTLY THOSE MARGINS, read off the ink that marks them. The datum tails
  // and the grade line are drawn FROM the margin -- `marginL - 18` and
  // `w - marginR` -- so where they end IS where the margins are, and pinning
  // them is the only way to tell a margin honoured from one merely cleared.
  // A painter that answered every ask by insetting to half the canvas would
  // satisfy every bound above and be wrong.
  //
  // AN ASK MOVES THE RULES BY EXACTLY WHAT IT ASKED FOR, and that phrasing --
  // rather than "the rules land at WANT" -- is the whole of the 25 Sep fix.
  // The painter's own left margin is not white space: the level marks live in
  // it, right-aligned at `marginL - 22`, OUTSIDE the drawing. A max() spent
  // that gutter twice, so a rail asking for 150 got a drawing starting at 150
  // and numbers printed back out at 94, under the panel. Movie, looking at it:
  // "of the left the elevation numbers, can you bring those to the right so
  // they aren't covered by the side menu when it is open". The two numbers
  // compose; they do not compete -- so the ask is measured as a SHIFT off the
  // no-ask reading, which is a claim no constant in this file can drift from.
  check('an ask moves the reference rules by exactly what it asked for',
    Math.abs((wide.inkLo - plain.inkLo) - WANT) < 1
      && Math.abs((plain.inkHi - wide.inkHi) - WANT) < 1,
    `the rules run ${at(wide.inkLo)}..${at(wide.inkHi)} against `
    + `${at(plain.inkLo)}..${at(plain.inkHi)} with nothing asked, so the ask `
    + `moved them ${at(wide.inkLo - plain.inkLo)} and ${at(plain.inkHi - wide.inkHi)} `
    + `against ${WANT} asked`);
  // AND THE NUMBERS THEMSELVES CLEAR IT, which is what he was actually looking
  // at. The rules are 18px of tail; the readings hang further out still, so a
  // gutter that fits the tail and not the label would satisfy the line above
  // and print the numbers on the menu anyway.
  //
  // 40px IS A LABEL'S WORTH, measured in a browser rather than guessed at:
  // -12'-11 3/4" sets 34.1px wide in Barlow Condensed at 9px, GRADE 20.6, and
  // the anchor sits 22px in from the drawing. measureText answers 0 offline,
  // which is why the number is written here instead of asked for.
  const LABEL_ROOM = 40;
  check('and the elevation numbers keep a gutter of their own inside it',
    wide.marks > 3 && wide.markX - WANT >= LABEL_ROOM,
    `${wide.marks} readings, the leftmost anchored at ${at(wide.markX)} with `
    + `${WANT}px asked -- ${at(wide.markX - WANT)}px of gutter against `
    + `${LABEL_ROOM} a label needs`);

  // AND WHAT IT MUST NOT DO, which is the half that keeps the rest honest. A
  // shut rail covers nothing and MODEL.html hands that over as a zero rather
  // than withholding it, so zero has to mean "the painter-s own default" and
  // not "paint to the edge".
  const zero = span({ margins: { left: 0, right: 0 } });
  check('asking for LESS margin than the default changes nothing',
    Math.abs(zero.lo - plain.lo) < 1e-9 && Math.abs(zero.hi - plain.hi) < 1e-9,
    `${at(zero.lo)}..${at(zero.hi)} against ${at(plain.lo)}..${at(plain.hi)}`);
  const none = span({ margins: null });
  check('and neither does handing over no measurement at all',
    Math.abs(none.lo - plain.lo) < 1e-9 && Math.abs(none.hi - plain.hi) < 1e-9,
    `${at(none.lo)}..${at(none.hi)}`);

  // ONE SIDE AT A TIME. Both sides asked together would read the same if the
  // painter quietly halved the pair into a single symmetric inset, or zoomed
  // out by their sum and centred; only an uneven ask can tell a margin from a
  // zoom. One rail open and one shut is also the ordinary case on screen.
  const leftOnly = span({ margins: { left: WANT } });
  check('a margin asked on the left alone clears the left',
    leftOnly.lo >= WANT - 1, `house begins at ${at(leftOnly.lo)}, ${WANT}px asked`);
  check('and leaves the right margin exactly where it was',
    Math.abs(leftOnly.inkHi - plain.inkHi) < 1,
    `the datum tails end at ${at(leftOnly.inkHi)} against ${at(plain.inkHi)} -- `
    + 'that end IS the right margin, so it moving would mean a left-hand ask ate both sides');
  check('and the house moves toward the free side rather than shrinking about its middle',
    leftOnly.hi > plain.hi + 1,
    `house ends at ${at(leftOnly.hi)} against ${at(plain.hi)} with nothing asked`);

  // AND HALF THE CANVAS IS THE DRAFTER-S, whatever is sitting on it. MODEL's
  // two rails ask for about 540px between them; on a narrow window that is
  // most of the canvas, and honoured literally it would answer "don-t cover
  // the drawing" by leaving no drawing to cover.
  const greedy = span({ margins: { left: 400, right: 400 } });
  check('a pair of margins bigger than the canvas still leaves half of it',
    greedy.hi - greedy.lo >= W / 2 - 1,
    `${at(greedy.hi - greedy.lo)}px of house in ${W}px, 800px of margin asked`);
  check('and that half is not taken out of one side only',
    greedy.lo > 1 && W - greedy.hi > 1,
    `house ${at(greedy.lo)}..${at(greedy.hi)} -- an ask scaled back on one side `
    + 'alone would leave the other flush with the edge');

  // (THE CAP IS A CEILING, NOT THE ANSWER -- that an ask which fits is
  // honoured whole rather than rounded up to half the canvas is what the
  // exact reading above pins, and it is the same arithmetic that does both.)
}

// ── A WALL'S OUTLINE RUNS LONG ONLY WHEN IT IS LEVEL OR PLUMB ────────────
//
// Movie, 26 Sep: "here is a really weird one - look at the line near 2nd floor
// (elevation line it gets warped)".
//
// THE STOREY LINE WAS LEANING. Measured on a twoStorey-garage captured from
// the drive-thru, E1:
//
//     (16.00, 10.577) -> (-16.00, 9.152)   w1.25, slope 1:22.5
//
// -- thirty-two feet of second-floor line dropping a foot and a half across
// the front of the house. It came in with `roofClippedFoot`, which lifts a
// wall's end vertical off its floor where a roof sheet covers it: the base
// line after it had no `moveTo` of its own and took whatever the pen was left
// at, which until then was always `(xb, floor)`. Any pass that moves an
// endpoint of that path can do it again.
//
// SO THE CLAIM IS ABOUT THE PATH, not about that line. A wall face outlines
// three things: its two ends, which are PLUMB; its floor, which is LEVEL; and
// its top, which follows the roof over it. THE TOP IS SAMPLED -- `tops` walks
// the roof underside in steps of half a foot -- so every sloping piece of a
// wall outline is at most that long, and anything longer that is neither
// level nor plumb is a line that has lost an endpoint.
//
// A FOOT IS THE THRESHOLD, twice the sampling step, so a change to that step
// has to double before this stops meaning what it says.
//
// NOT A SLOPE FLOOR, which was tried first and is unsound: a roof line
// projects SHALLOWER than its pitch wherever the wall runs oblique to the
// slope -- measured at 0.300 for a 4/12 on repro-garage-house's gable ends --
// so there is no angle a legitimate line cannot reach.
{
  const LONG_FT = 1;
  let probed = 0, sloped = 0;
  fs.readdirSync(path.join(ROOT, 'proto')).filter(n => n.endsWith('.draft')).forEach(name => {
    const dEnv = buildEnv(win, JSON.parse(
      fs.readFileSync(path.join(ROOT, 'proto', name), 'utf8')));
    standardElevationCuts(dEnv).forEach(cut => {
      const view = paintElevation(win, dEnv, cut, { pxPerFt: 40 });
      const bad = [];
      view.strokes.forEach(st => {
        if (Math.abs(st.w - WALL_FACE_W) > 1e-9) return;
        for (let k = 1; k < st.pts.length; k += 1) {
          const a = st.pts[k - 1], b = st.pts[k];
          if (b.move || b.close) continue;
          const de = Math.abs(a.e - b.e), du = Math.abs(a.u - b.u);
          if (de < 1e-6 || du < 1e-6) continue;        // level, or plumb
          sloped += 1;
          probed += 1;
          if (du <= LONG_FT) continue;
          bad.push(`(${a.u.toFixed(2)},${a.e.toFixed(3)})->`
            + `(${b.u.toFixed(2)},${b.e.toFixed(3)}) -- ${du.toFixed(2)} ft of it`);
        }
      });
      check(`${name} ${cut.id}: no wall line runs long without being level or plumb`,
        bad.length === 0,
        bad.length ? bad.join(', ') : `${sloped} sloping segment(s) so far, none over ${LONG_FT} ft`);
    });
  });
  // A PAINTER THAT DREW NO SLOPING WALL LINE AT ALL would satisfy every check
  // above, and a gable wall climbing into its own roof is the commonest thing
  // on these elevations.
  check('fixture: some wall line does follow a roof', sloped > 0,
    `${sloped} non-level, non-plumb segment(s)`);
}

// ── AND NO EDGE SHORTER THAN THE BOARD IT IS PART OF ─────────────────────
//
// Refining a run's ends to the real boundary gave a run that covers a single
// station a real extent, where before it had none and was dropped for it.
// Eleven appeared across proto/ at 0.05..0.08 ft -- an inch of ink at a
// corner, saying nothing -- so the painter's minimum moved from "spans more
// than one station" to a LENGTH.
//
// HALF A FASCIA, which is the drawing's own shortest edge and not a number
// typed into either file. Counted here as well as there: the shortest roof
// edge any fixture draws is the depth of the board itself, wherever an eave
// is cut off square, and nothing real comes in under half of it.
{
  const CV = win.DraftCutView;
  const fasciaFt = CV.STANDARDS.ROOF_FASCIA_IN / 12;
  const ROOF_EDGE_W = 1.5;
  let shortest = Infinity, counted = 0;
  const bad = [];
  fs.readdirSync(path.join(ROOT, 'proto')).filter(n => n.endsWith('.draft')).forEach(name => {
    const dEnv = buildEnv(win, JSON.parse(
      fs.readFileSync(path.join(ROOT, 'proto', name), 'utf8')));
    standardElevationCuts(dEnv).forEach(cut => {
      paintElevation(win, dEnv, cut, { pxPerFt: 400 }).strokes.forEach(st => {
        // ONE SEGMENT, which is what a roof-edge run is: the pass strokes
        // each visible stretch as a lone moveTo/lineTo. The same weight is
        // used elsewhere for SAMPLED polylines -- eight thousand two-inch
        // steps across proto/ -- and those are one line, not eight thousand.
        if (Math.abs(st.w - ROOF_EDGE_W) > 1e-9 || st.pts.length !== 2) return;
        for (let k = 1; k < st.pts.length; k += 1) {
          const a = st.pts[k - 1], b = st.pts[k];
          if (b.move || b.close) continue;
          const len = Math.hypot(a.u - b.u, a.e - b.e);
          counted += 1;
          if (len < shortest) shortest = len;
          if (len < fasciaFt / 2) {
            bad.push(`${name} ${cut.id} (${a.u.toFixed(2)},${a.e.toFixed(3)})->`
              + `(${b.u.toFixed(2)},${b.e.toFixed(3)}) -- ${(len * 12).toFixed(2)}"`);
          }
        }
      });
    });
  });
  check('no roof edge is drawn shorter than half a fascia',
    bad.length === 0,
    bad.length ? bad.slice(0, 4).join(', ') + (bad.length > 4 ? ` (+${bad.length - 4})` : '')
      : `${counted} edge(s), shortest ${(shortest * 12).toFixed(2)}" against `
        + `${(fasciaFt * 6).toFixed(2)}" allowed`);
  // A PAINTER THAT DREW NO EDGES AT ALL would pass the bound above, and the
  // shortest one is reported so the margin over the floor stays visible: it
  // sat at 0.05..0.08 ft before the runs were refined and the floor raised.
  check('fixture: there are roof edges to measure',
    counted > 100,
    `${counted} edge(s), shortest ${(shortest * 12).toFixed(2)}" against `
      + `${(fasciaFt * 6).toFixed(2)}" allowed`);
}

// ── AND THE BOTTOM, WHERE ONE THING IS ALLOWED OUT ───────────────────────
//
// Movie, 26 Sep, on a two-storey with a garage: "see how the footing bottom
// line is just under the dashboard line where the tint starts - could we make
// the house just a little smaller so that the bottom of the footing doesnt
// cross over the 'tint' line of the lower bar ... keep them about 3-5 pixels
// above that line so there is a little space, BUT ALLOW THE PILES TO EXTEND
// PAST THAT TINT LINE." Then, correcting the first attempt he imagined:
// "rather than moving the house up, make it smaller scale slightly so it fits
// and gets smaller too" ... "the position is nice centered basically how it is
// just need it smaller".
//
// SO THE BOTTOM MARGIN IS NOT THE OTHER TWO WITH THE AXIS TURNED. A left ask
// must hold EVERYTHING off that strip of canvas -- that is what the gutter
// reading above pins. A bottom ask must hold the FOOTING off it and let the
// pile shafts through, because a pile has no bottom of its own on an
// elevation: it is drawn from the underside of what it carries down to
// `yBottom` and stops there, saying nothing about how deep it goes. The two
// feet below the footing in the extent are that run-off, not air.
//
// A FIXTURE WITH PILES, which the L-house above has not got: an attached
// garage on a grade beam is the whole of what puts a shaft on an elevation.
{
  const CV = win.DraftCutView;
  const pFile = path.join(ROOT, 'proto', 'repro-2storey-garage-beam.draft');
  const pEnv = buildEnv(win, JSON.parse(fs.readFileSync(pFile, 'utf8')));
  const pCut = standardElevationCuts(pEnv).find(c => c.id === 'E1');
  const pStack = CV.sectionLevelStack(pEnv);
  const pDir = pCut.dirVec;
  const pAxis = { x: pDir.z, z: -pDir.x };
  const W = 900, H = 600;
  const deep = opts => {
    const { ctx, strokes } = recordingCtx();
    const ok = CV.drawElevationView(pEnv, ctx, W, H, pCut, pStack, pAxis, () => {}, opts);
    let flat = -Infinity, any = -Infinity, top = Infinity;
    let widest = 0, gradeY = null;
    strokes.forEach(s => {
      for (let k = 1; k < s.pts.length; k += 1) {
        const a = s.pts[k - 1], b = s.pts[k];
        if (b.move || b.close) continue;
        any = Math.max(any, a.y, b.y);
        top = Math.min(top, a.y, b.y);
        // FLAT AND LONG. The deepest HORIZONTAL run is the footing's dashed
        // underside -- nothing else on an elevation is drawn level below it,
        // and the shafts are verticals -- so this tells the thing that must
        // stay in from the thing that may leave without naming an elevation.
        if (Math.abs(a.y - b.y) < 0.6 && Math.abs(a.x - b.x) > 2) {
          flat = Math.max(flat, a.y);
          // AND THE LONGEST OF THEM IS THE GRADE LINE, which runs past both
          // ends of the building and is drawn in one piece. Two flats whose
          // elevations the model knows are what turn pixels into feet here,
          // so nothing below has to re-derive the painter's own fit.
          if (Math.abs(a.x - b.x) > widest) { widest = Math.abs(a.x - b.x); gradeY = a.y; }
        }
      }
    });
    return { ok, flat, any, top, gradeY };
  };
  const at = v => v.toFixed(1);
  const plain = deep(undefined);
  check('the pile fixture paints, with shafts below its deepest footing',
    plain.ok && Number.isFinite(plain.flat) && plain.any > plain.flat + 2,
    `footing ${at(plain.flat)}, deepest ink ${at(plain.any)}`);

  const BAR = 64;   // #house-strip at 1366x700 is 64px of it, measured
  const bar = deep({ margins: { bottom: BAR } });
  // AN INCH OF GROUND, NOT A PIXEL COUNT. "make it look like the footing is
  // just about resting on one inch of dirt and then the tint starts" -- so
  // what is asserted is the DEPTH, read back through the drawing's own scale,
  // and it is the same inch whatever size the window is. A bottom ask is the
  // one side the painter's own inset does not add to, for the reason written
  // at `screenMargins`: nothing is drawn below the drawing, so that inset is
  // pure white and the furniture's edge is the frame.
  const INCH = 1 / 12;
  check('a bottom ask keeps the footing out of the strip it named',
    bar.flat < H - BAR,
    `footing at ${at(bar.flat)} in ${H}px with ${BAR}px asked -- the strip `
    + `begins at ${H - BAR}`);
  // THE SCALE IS READ OFF THE DRAWING rather than recomputed here: grade and
  // the footing's underside are both flats the model can name, so the pixels
  // between them say what a foot is worth on this fit and an inch follows.
  const pFdn = pStack.foundation;
  const ft = (bar.flat - bar.gradeY) / (pFdn.grade - pFdn.footingBottom);
  check('and stands it on an inch of ground, not the painter-s own inset',
    Math.abs((H - BAR - bar.flat) - INCH * ft) < 1.2,
    `${at(H - BAR - bar.flat)}px of ground above the strip, and an inch is `
    + `${at(INCH * ft)}px at ${at(ft)}px/ft`);
  check('and lets the pile shafts run on past it',
    bar.any > H - BAR + 1,
    `deepest ink ${at(bar.any)} against a strip beginning at ${H - BAR}`);
  // SMALLER, NOT SHIFTED. The correction Movie made himself: an elevation
  // that answered this by sliding up would clear the strip and be the same
  // drawing, which is not what he asked for twice.
  check('and the house is SMALLER for it rather than merely moved up',
    (bar.flat - bar.top) < (plain.flat - plain.top) - 4,
    `${at(bar.flat - bar.top)}px tall against ${at(plain.flat - plain.top)}px `
    + 'with nothing asked');
  check('and a bottom ask of zero changes nothing',
    Math.abs(deep({ margins: { bottom: 0 } }).flat - plain.flat) < 1e-9,
    `${at(deep({ margins: { bottom: 0 } }).flat)} against ${at(plain.flat)}`);
}

console.log(`elevation harness: ${passed} checks passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach(line => console.log(`  \u2718 ${line}`));
  process.exit(1);
}
