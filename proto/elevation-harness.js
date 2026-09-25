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
    const { ctx, strokes } = recordingCtx();
    const ok = CV.drawElevationView(env, ctx, W, 600, cut, stack, axis, () => {}, opts);
    const upright = strokes.filter(s => {
      const ys = s.pts.map(p => p.y);
      return Math.max(...ys) - Math.min(...ys) > 0.5;
    });
    const xs = strokes.flatMap(s => s.pts.map(p => p.x));
    const body = upright.flatMap(s => s.pts.map(p => p.x));
    return {
      ok, n: xs.length, uprights: upright.length,
      inkLo: Math.min(...xs), inkHi: Math.max(...xs),
      lo: Math.min(...body), hi: Math.max(...body),
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
  check('and those margins are the ones asked for, not more and not less',
    Math.abs(wide.inkLo - (WANT - RULE_LEAD)) < 1 && Math.abs(wide.inkHi - (W - WANT)) < 1,
    `the rules run ${at(wide.inkLo)}..${at(wide.inkHi)}, so the margins are `
    + `${at(wide.inkLo + RULE_LEAD)} and ${at(W - wide.inkHi)} against ${WANT} asked`);

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

console.log(`elevation harness: ${passed} checks passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach(line => console.log(`  \u2718 ${line}`));
  process.exit(1);
}
