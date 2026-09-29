// THE CHAIN FROM WHAT A DIMENSION MEASURES TO WHETHER IT DRAWS.
//
// Five links, and until this file not one of them had a check:
//
//   auto-dims.js      decides the layer at the push, where the kind is known
//   drawing-format.js stores it, so it survives a save and a reload
//   profile-manager.js carries the layer, so STANDARDS can show a tick
//   layout-plan.js    hands the composer the standards to read
//   plan-composition  reads them and draws, or does not
//
// A break anywhere in that chain fails SILENTLY and fails OPEN: the dimension
// draws. That is the whole reason this harness exists rather than a spec --
// nothing on screen is wrong when it breaks, so no screenshot catches it, and
// the drafter's only symptom is a tick that does nothing. Two of the five were
// already broken when this was written and neither had ever been reported:
//
//   - every dimension in every drawing carried `layer: null` (967 of them in
//     the bungalow fixture), so the gate had nothing to match on; and
//   - NOBODY passed `env.layerStandard`, so `layerShows` returned true for
//     everything. STANDARDS.html has been writing visible/printable into the
//     saved profile since it shipped and no painter ever read them back.
//
// Run: node proto/dim-layers-harness.js          (checks)
//      node proto/dim-layers-harness.js --mutate (checks + mutation table)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
// THROUGH THE SHARED GUARD, AND THAT IS WHAT PUTS IT IN CI. This hand-parsed
// `--mutate` until it was checked: .github/workflows/test.yml builds its
// engine list by grepping every harness for the literal call form
// `harness-args.js').mutationMode()`, so a file that parses the flag itself
// is not an engine as far as CI is concerned. The table ran here and nowhere
// else -- 13 mutations that could rot green forever, which is the same shape
// as everything this harness was written to catch, one layer out.
const MUTATE = require('./harness-args.js').mutationMode();

// auto-dims.js needs nothing; the rest of the chain needs geometry and the
// format. layout-plan.js is last because it reads the others off `window`.
const FILES = ['formatters.js', 'wall-types.js', 'geometry-2d.js', 'drawing-format.js',
  'room-standards.js', 'level-assembly.js', 'profile-manager.js', 'layer-views.js',
  'render-2d.js', 'plan-composition.js', 'auto-dims.js', 'cut-view-env.js',
  'layout-plan.js'];

function loadWith(source = {}) {
  const warnings = [];
  const win = {};
  const sandbox = {
    window: win, Math, Number, String, Object, Array, JSON, Map, Set, Boolean,
    isFinite, parseFloat, parseInt, Date, RegExp, Error, localStorage: undefined,
    console: { warn: m => warnings.push(String(m)), error: () => {}, log: () => {} },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const failed = [];
  for (const file of FILES) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) { failed.push(`${file}: missing`); continue; }
    let code = fs.readFileSync(full, 'utf8');
    if (source[file]) code = source[file](code);
    try { vm.runInContext(code, sandbox, { filename: file }); }
    catch (err) { failed.push(`${file}: ${err.message}`); }
  }
  return { win, warnings, failed };
}

let failures = 0;
let checks = 0;
const ok = (name, cond, detail) => {
  checks += 1;
  if (cond) return;
  failures += 1;
  console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ''}`);
};

// ── THE FIXTURE ─────────────────────────────────────────────────────────────
// A 36 x 66 rectangle, which is Movie's own worked example of an overall
// dimension ("A buyer reads the footprint -- 36 x 66").
const rect = (x0, z0, x1, z1) =>
  [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }];
const wallsAround = pts => pts.map((pt, i) => ({ start: pt, end: pts[(i + 1) % pts.length] }));
const HOUSE = rect(0, 0, 36, 66);
// An L: the south-east corner is cut away, so the S and E sides each gain a
// third coordinate and emit a jog string where the rectangle emits none.
const L_HOUSE = [{ x: 0, z: 0 }, { x: 36, z: 0 }, { x: 36, z: 40 },
  { x: 20, z: 40 }, { x: 20, z: 66 }, { x: 0, z: 66 }];
const NORTH_WALL = { start: { x: 0, z: 0 }, end: { x: 36, z: 0 } };

function strings(win, { points = HOUSE, openings = [], roofs = [] } = {}) {
  const AD = win.DraftAutoDims;
  const G = win.DraftGeometry2D;
  return AD.computeAutoDimStrings({
    walls: wallsAround(points),
    outlines: [{ points, garage: false }],
    roofs,
    openings,
    offsetOutline: (pts, dist) => G.offsetOutline(pts, dist),
    firstOffset: 1.5,
    jogMergeFt: AD.JOG_MERGE_FT,
    stringSpacingFt: AD.STRING_SPACING_FT,
  }) || [];
}
const countBy = (segs, layer) => segs.filter(s => s.layer === layer).length;
const uniqOf = values => [...values].sort((a, b) => a - b)
  .filter((v, i, all) => i === 0 || v - all[i - 1] > 0.01);
const spanOf = s => Math.hypot(s.end.x - s.start.x, s.end.z - s.start.z);

function run() {
  const { win, warnings, failed } = loadWith(...arguments);

  // THE MODULES LOADED AT ALL. Devin, 29 Sep, on harness-env.js: a mutant that
  // would not even parse was counting as a mutant CAUGHT -- "I proved it with
  // a deliberate throw and got 64 checks passed, 0 failed". Every check below
  // reads something off `win`, so a file that threw on load would fail them
  // all and look like a bitten mutation. This says which it was.
  ok('every module in the chain parses and runs', failed.length === 0, failed.join('; '));
  const AD = win.DraftAutoDims;
  const DF = win.DraftDrawingFormat;
  const LS = win.DraftLayerStandards;
  if (!AD || !DF || !LS) {
    ok('auto-dims, drawing-format and layer standards all defined',
      false, `AD=${!!AD} DF=${!!DF} LS=${!!LS}`);
    return { win, warnings };
  }

  // ── THE FIXTURE REACHES ───────────────────────────────────────────────────
  // Asserted before anything is read off it. A fixture that strings nothing
  // makes every claim below vacuously true -- "no segment is mislabelled" is
  // satisfied by no segments, and that is the shape of a green sheet that
  // measured nothing.
  const plain = strings(win);
  ok('the fixture strings something at all', plain.length > 0, `${plain.length} segments`);
  const withWindow = strings(win, {
    openings: [{ center: { x: 18, z: 0 }, wall: NORTH_WALL }],
  });
  ok('an opening adds segments the bare footprint did not have',
    withWindow.length > plain.length, `${plain.length} -> ${withWindow.length}`);

  // ── EVERY STRING IS TAGGED, AND ONLY WITH IDS THAT EXIST ──────────────────
  const known = new Set(Object.values(AD.DIM_LAYERS));
  // FOUR NOW: OVR, EXT and FENS on the perimeter, COLS beside the beams. INT
  // is still absent because nothing emits it -- and this count is what says
  // so out loud, rather than the object quietly growing a constant for a
  // string that is never pushed.
  ok('DIM_LAYERS names the four kinds auto-dims emits', known.size === 4,
    [...known].join(','));
  ok('and A-DIMS-INT is not among them, because nothing emits it yet',
    !known.has('A-DIMS-INT'));
  const untagged = withWindow.filter(s => !s.layer);
  ok('no segment leaves auto-dims without a layer', untagged.length === 0,
    `${untagged.length} untagged`);
  const stray = withWindow.filter(s => s.layer && !known.has(s.layer));
  ok('no segment carries an id outside DIM_LAYERS', stray.length === 0,
    [...new Set(stray.map(s => s.layer))].join(','));

  // ── EACH KIND IS THE KIND IT CLAIMS ───────────────────────────────────────
  // Measured, not counted: an overall string on this footprint is 36 or 66
  // long, because that IS the footprint. A check that only counted OVR
  // segments would pass with the labels shuffled.
  const overalls = withWindow.filter(s => s.layer === AD.DIM_LAYERS.OVERALL);
  ok('an overall string exists', overalls.length > 0);
  const spans = overalls.map(spanOf);
  ok('every overall string spans a whole side of the footprint',
    spans.length > 0 && spans.every(v => Math.abs(v - 36) < 0.01 || Math.abs(v - 66) < 0.01),
    spans.map(v => v.toFixed(2)).join(' '));
  ok('both directions of the footprint are strung overall',
    spans.some(v => Math.abs(v - 36) < 0.01) && spans.some(v => Math.abs(v - 66) < 0.01));

  // FENESTRATION follows the openings, in both directions: present with one,
  // ABSENT without. One-sided, this would pass against a build that tagged
  // every string FENS.
  ok('an opening produces a fenestration string',
    countBy(withWindow, AD.DIM_LAYERS.FENESTRATION) > 0);
  ok('no opening produces no fenestration string',
    countBy(plain, AD.DIM_LAYERS.FENESTRATION) === 0,
    `${countBy(plain, AD.DIM_LAYERS.FENESTRATION)} on a house with no openings`);

  // EXTERIOR is the jog string, so it appears on the L and not on the
  // rectangle -- the rectangle's sides have two coordinates and jog nowhere.
  const lShaped = strings(win, { points: L_HOUSE });
  ok('a jogged footprint produces an exterior string',
    countBy(lShaped, AD.DIM_LAYERS.EXTERIOR) > 0);
  ok('a plain rectangle produces no exterior string',
    countBy(plain, AD.DIM_LAYERS.EXTERIOR) === 0,
    `${countBy(plain, AD.DIM_LAYERS.EXTERIOR)} on a footprint with no jogs`);

  // THE ROOF BRANCH is a different arm of the same emitter: it strings the
  // overhang and the overall, and never the openings.
  const roofed = strings(win, {
    roofs: [{ points: rect(-2, -2, 38, 68), overhang: 2 }],
    openings: [{ center: { x: 18, z: 0 }, wall: NORTH_WALL }],
  });
  ok('the roof stack strings something', roofed.length > 0, `${roofed.length} segments`);
  ok('the roof stack tags its overhang string exterior',
    countBy(roofed, AD.DIM_LAYERS.EXTERIOR) > 0);
  ok('the roof stack still strings an overall',
    countBy(roofed, AD.DIM_LAYERS.OVERALL) > 0);
  // The openings are handed in and the roof arm never reads them. Tagging is
  // per-branch, and a build that tagged on shape rather than on kind would
  // put the roof's own multi-coordinate string on the fenestration layer.
  ok('the roof stack emits no fenestration string even with an opening passed',
    countBy(roofed, AD.DIM_LAYERS.FENESTRATION) === 0,
    `${countBy(roofed, AD.DIM_LAYERS.FENESTRATION)}`);
  ok('every roofed segment is tagged too',
    roofed.every(s => known.has(s.layer)));

  // ── THE COLUMN STACK ──────────────────────────────────────────────────
  //
  // A beam down the middle of the 36 x 66 house with two posts under it. The
  // numbers are chosen so every claim below can be MEASURED rather than
  // counted: posts at 12 and 24 inside a house 0..36 means the along string
  // reads 12, 12, 12 and the across string reads 33, 33.
  // THE BEAM STOPS SHORT OF THE HOUSE EDGE, at the wall's inner face, which
  // is where a beam actually bears. It ran 0 to 36 -- exactly the edges --
  // until the mutation table caught what that hid: measuring from the beam's
  // own ends and measuring from the house edge gave the SAME answer, so the
  // check could not tell them apart and the mutation walked through it. Half
  // a foot of wall at each end is the whole difference, and it is a figure a
  // framer needs.
  const BEAM = { id: 1, start: { x: 0.5, z: 33 }, end: { x: 35.5, z: 33 } };
  const POSTS = [
    { id: 1, point: { x: 12, z: 33 } },
    { id: 2, point: { x: 24, z: 33 } },
  ];
  const colStrings = (over = {}) => AD.computeColumnDimStrings({
    beams: [BEAM], columns: POSTS, outlines: [{ points: HOUSE, garage: false }],
    walls: wallsAround(HOUSE), floorOpenings: [], ...over,
  });

  const cols = colStrings();
  ok('a beam with posts under it strings something', cols.length > 0,
    `${cols.length} segments`);
  ok('every column segment is tagged A-DIMS-COLS',
    cols.length > 0 && cols.every(s => s.layer === AD.DIM_LAYERS.COLUMNS),
    [...new Set(cols.map(s => s.layer))].join(','));

  // ALONG: runs on x, so z is constant and the x coordinates are the posts
  // plus BOTH house edges. Movie: "each column and then the ext edge where
  // the beams sit".
  const alongSegs = cols.filter(s => Math.abs(s.start.z - s.end.z) < 0.01);
  const alongX = uniqOf(alongSegs.flatMap(s => [s.start.x, s.end.x]));
  ok('the along string starts at the house edge, not where the beam ends',
    alongX.length > 0 && Math.abs(alongX[0]) < 0.02
    && Math.abs(alongX[0] - 0.5) > 0.02, String(alongX[0]));
  ok('the along string runs from one house edge to the other',
    alongX.length && Math.abs(alongX[0] - 0) < 0.02
    && Math.abs(alongX[alongX.length - 1] - 36) < 0.02, alongX.join(','));
  ok('and stops at each post on the way',
    alongX.some(v => Math.abs(v - 12) < 0.02) && alongX.some(v => Math.abs(v - 24) < 0.02),
    alongX.join(','));
  // MEASURED, NOT COUNTED. A string of the right shape with the wrong figures
  // is the bug this catches: 0-12-24-36 reads 12, 12, 12.
  const alongRuns = [];
  for (let i = 0; i < alongX.length - 1; i++) alongRuns.push(alongX[i + 1] - alongX[i]);
  ok('so every figure on it is 12 ft', alongRuns.length === 3
    && alongRuns.every(v => Math.abs(v - 12) < 0.02),
    alongRuns.map(v => v.toFixed(2)).join(' '));
  ok('the along string sits one foot off the beam, not on it',
    alongSegs.length > 0
    && alongSegs.every(s => Math.abs(Math.abs(s.start.z - 33) - 1) < 0.01),
    [...new Set(alongSegs.map(s => s.start.z))].join(','));

  // ACROSS: runs on z, locating the beam line between the two edges.
  const acrossSegs = cols.filter(s => Math.abs(s.start.x - s.end.x) < 0.01);
  const acrossZ = uniqOf(acrossSegs.flatMap(s => [s.start.z, s.end.z]));
  ok('the across string spans the other direction of the house',
    acrossZ.length === 3 && Math.abs(acrossZ[0]) < 0.02
    && Math.abs(acrossZ[1] - 33) < 0.02 && Math.abs(acrossZ[2] - 66) < 0.02,
    acrossZ.join(','));
  ok('one across string per beam, not one per post', acrossSegs.length === 2,
    `${acrossSegs.length} segments`);

  // BOTH DIRECTIONS, because "it strings the posts" is half a claim.
  ok('no beams means no column strings', colStrings({ beams: [] }).length === 0);
  ok('no posts means no column strings', colStrings({ columns: [] }).length === 0);
  // A post standing off this beam's line is not this beam's post -- otherwise
  // a parallel beam's posts print a figure against a member they do not touch.
  ok('a post that is not on the beam does not join its string',
    colStrings({ columns: [{ id: 9, point: { x: 18, z: 10 } }] }).length === 0);
  ok('a post on the beam DOES, so the check above reads the line and not the count',
    colStrings({ columns: [{ id: 9, point: { x: 18, z: 33 } }] }).length > 0);

  // THE STAIR HOLE PUSHES IT OVER. Movie: "on a side that doesn't have stair
  // hole". Asserted by WHICH SIDE it lands on, in both directions.
  const holeAt = z0 => [{ points: [
    { x: 10, z: z0 }, { x: 20, z: z0 }, { x: 20, z: z0 + 8 }, { x: 10, z: z0 + 8 }] }];
  const pushedUp = colStrings({ floorOpenings: holeAt(34) })
    .filter(s => Math.abs(s.start.z - s.end.z) < 0.01);
  ok('a hole on the far side of the beam puts the along string on the near side',
    pushedUp.length > 0 && pushedUp.every(s => s.start.z < 33),
    [...new Set(pushedUp.map(s => s.start.z))].join(','));
  const pushedDown = colStrings({ floorOpenings: holeAt(25) })
    .filter(s => Math.abs(s.start.z - s.end.z) < 0.01);
  // This one is the case the first margin got wrong: a hole whose edge IS the
  // beam line. Both sides looked blocked and the beam got no string at all.
  ok('a hole running up to the beam puts the string on its other side',
    pushedDown.length > 0 && pushedDown.every(s => s.start.z > 33),
    [...new Set(pushedDown.map(s => s.start.z))].join(','));

  // ── THE FORMAT KEEPS IT ───────────────────────────────────────────────────
  // The link that would otherwise lose everything above on the next save.
  const through = layer => {
    const out = DF.dimensions([{
      id: 1, start: { x: 0, y: 0, z: 0 }, end: { x: 36, y: 0, z: 0 },
      levelId: 3, view: 'plan', layer, auto: true,
    }], new Set([3]), {});
    return out.length ? out[0] : null;
  };
  const ALL_FIVE = ['A-DIMS-OVR', 'A-DIMS-EXT', 'A-DIMS-INT', 'A-DIMS-FENS', 'A-DIMS-COLS'];
  ALL_FIVE.forEach(layer => {
    const back = through(layer);
    ok(`${layer} survives a round trip through the format`,
      back && back.layer === layer, back ? String(back.layer) : 'dropped');
  });
  // THE KEY'S ABSENCE, NOT ITS VALUE, and that distinction cost a red shard.
  // These read `=== null` until write-tier.spec.js caught what that meant on
  // the way OUT: a null is still a key, the old page writes no such key, and
  // that spec compares the two pages' saves byte for byte. Asking "is it
  // null" cannot tell a key that is absent from one that is present and
  // empty, so it passed against the build that broke the round trip.
  const wrote = layer => {
    const back = through(layer);
    return back ? Object.prototype.hasOwnProperty.call(back, 'layer') : null;
  };
  ok('a layer the format does not know is not written at all',
    wrote('A-DIMS-NOPE') === false, String(through('A-DIMS-NOPE')?.layer));
  ok('a dimension written before layers existed gains no layer key',
    wrote(undefined) === false, String(through(undefined)?.layer));
  ok('a real layer IS written, so the check above is reading the key',
    wrote('A-DIMS-OVR') === true);

  // ── THE THREE LISTS AGREE ─────────────────────────────────────────────────
  // Devin, 29 Sep, asked for exactly this: "a harness check per entity type so
  // the next entity can't quietly join the untagged list". A rename in any one
  // of the three files silently unswitches a dimension -- it would still draw,
  // and its tick would still be there, and the tick would do nothing.
  const table = LS.normaliseLayerStandards(null);
  // TWO DIFFERENT FIELDS, AND THE FIRST CHECK HERE TESTED THE WRONG ONE.
  // `visible` is the STATE and normaliseLayerStandards defaults it to true for
  // every layer in the table, so `table[layer].visible === true` is satisfied
  // by any layer at all -- it passed just as happily with the flag deleted.
  // `visibility` is the one that matters: it is the raw table's own field, and
  // STANDARDS.html renders a Visible tick only where it is true. Without it a
  // dimension layer gets a blank cell and the drafter has no switch, which is
  // the entire feature. Caught by the mutation that removed it and was not
  // noticed -- a check green by default, which is what this file is about.
  const flat = LS.DEFAULT_LAYER_STANDARDS.flatMap(group => group.layers);
  const rawOf = id => flat.find(layer => layer.id === id) || null;
  ALL_FIVE.forEach(layer => {
    ok(`${layer} is in the standards table`, !!table[layer]);
    ok(`${layer} offers a Visible tick in STANDARDS`, rawOf(layer)?.visibility === true,
      String(rawOf(layer)?.visibility));
  });
  // And the control: a layer that is NOT meant to offer one still does not, so
  // the check above is reading the flag rather than reporting true for
  // everything the way its predecessor did.
  ok('a layer with no visibility flag offers no tick',
    rawOf('A-WALL-EXT') && rawOf('A-WALL-EXT').visibility !== true);
  Object.values(AD.DIM_LAYERS).forEach(layer => {
    ok(`auto-dims emits ${layer}, and the standards table carries it`, !!table[layer]);
  });
  ok('the four view-scoped dimension layers are retired',
    !table['PLAN DIMENSION'] && !table['FLOOR DIMENSION']
    && !table['FOUNDATION DIMENSION'] && !table['E-POWER DIMENSION']);

  // ── THE GATE HAS ITS HANDLE ───────────────────────────────────────────────
  // layout-plan.js is the one wiring both sheet pages paint through. The spy
  // replaces the composer and reads the env it is handed, which is the only
  // thing under test here -- whether the standards reach the gate at all.
  const LP = win.DraftLayoutPlan;
  ok('layout-plan is loaded', !!LP);
  if (LP) {
    let handed = null;
    win.DraftPlanComposition = { drawPlan: (ctx, toS, env) => { handed = env; return true; } };
    const saved = {
      levels: [{ id: 3, name: 'MAIN FL' }],
      walls: wallsAround(HOUSE).map((w, i) => ({
        id: i + 1, levelId: 3, view: 'plan', start: w.start, end: w.end,
        thickness: 0.5, topHeight: 8,
      })),
      dimensions: [], fenestrations: [], floors: [], roofs: [],
      shapes: [], lines: [], notes: [],
    };
    const ctx = new Proxy({}, { get: () => () => {} });
    LP.drawPlan(ctx, { x: v => v, y: v => v, s: v => v }, saved, 3, { view: 'plan' });
    ok('layout-plan reached the composer at all', handed !== null);
    ok('layout-plan hands the composer a layerStandard lookup',
      typeof handed?.layerStandard === 'function', typeof handed?.layerStandard);
    if (typeof handed?.layerStandard === 'function') {
      ok('the lookup answers for a dimension layer',
        handed.layerStandard('A-DIMS-OVR')?.visible === true,
        JSON.stringify(handed.layerStandard('A-DIMS-OVR')));
      ok('the lookup answers null for a layer nobody defined, so it draws',
        handed.layerStandard('A-DIMS-NOPE') === null);
    }
  }

  // ── THE ELEVATION'S ENV CARRIES THE TICKS TOO ───────────────────────────
  //
  // cut-view-env.js is the shared env EXTFINISH and LAYOUT hand the elevation
  // painter, and it is a different file from the one harness-env.js builds --
  // so the painting section below, which supplies its own layerStandard,
  // cannot say a word about whether the real pages supply one. This does.
  const CVE = win.DraftCutViewEnv;
  ok('cut-view-env is loaded', !!CVE);
  if (CVE) {
    const elevEnv = CVE.buildCutViewEnv({
      levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
      walls: wallsAround(HOUSE).map((w, i) => ({
        id: i + 1, levelId: 3, view: 'plan', start: w.start, end: w.end,
        thickness: 0.5, topHeight: 8,
      })),
      fenestrations: [], floors: [], roofs: [], columns: [], beams: [],
      dimensions: [], shapes: [], lines: [], notes: [], stairs: [],
    }, [{ id: 3, name: 'MAIN FL', elev: 0 }]);
    ok('cut-view-env builds an env at all', !!elevEnv);
    ok('cut-view-env hands the painter a layerStandard lookup',
      typeof elevEnv?.layerStandard === 'function', typeof elevEnv?.layerStandard);
    ok('that lookup answers for the fenestration dimension layer',
      elevEnv?.layerStandard?.('A-DIMS-FENS')?.visible === true,
      JSON.stringify(elevEnv?.layerStandard?.('A-DIMS-FENS')));
  }

  // ── AND THE SAME LAYER ON THE ELEVATION ─────────────────────────────────
  //
  // Movie, 29 Sep: "can we make the window number get layer A-DIMS-FENS so
  // the user can turn them off in ELEVATION views if desired".
  //
  // A size tag is what the elevation says instead of an opening-centre
  // string, so it rides the same layer and one tick takes both. Painted
  // rather than reasoned about: the claim is that the TAG LEAVES THE SHEET,
  // and only a painter can answer that.
  //
  // This section borrows harness-env.js because building an elevation by hand
  // -- level stack, cut, axis, extents -- is that file's whole job, and a
  // second copy is what this repo keeps paying for. It READS it and edits
  // nothing in proto/, so it does not collide with the mutation-table patch
  // landing there.
  //
  // AND IT IS THE ONE SECTION THE MUTATION TABLE CANNOT REACH, said here
  // rather than left to look as proven as the rest: harness-env's loader
  // takes no source hook, so a mutation to cut-view.js does not reach the
  // modules these checks run against. The gate was proved by hand instead --
  // deleting `&& showFenTags` leaves 12 tags where 0 are expected, which is
  // every window in the fixture. Wiring a source hook into that loader is the
  // fix, and it belongs in harness-env.js rather than here.
  const HE = require('./harness-env.js');
  const saved = JSON.parse(fs.readFileSync(path.join(ROOT, 'proto',
    'repro-washroom-bungalow.draft'), 'utf8'));
  const ev = HE.loadDraftModules();
  const env = HE.buildEnv(ev, saved);
  // ALL FOUR ELEVATIONS, not a chosen one: which side a given window lands on
  // is a fact about the fixture, and a check pinned to E1 would go quiet the
  // day someone moved a window rather than going red.
  const cuts = HE.standardElevationCuts(env);
  // A size tag is two numbers around an X, which is the shape fen-labels
  // prints and nothing else on an elevation does.
  const isTag = t => /\d+\s*[Xx]\s*\d+/.test(String(t && t.text));
  const paint = layerStandard => {
    const use = layerStandard === undefined ? env : { ...env, layerStandard };
    return cuts.map(cut => HE.paintElevation(ev, use, cut))
      .reduce((all, out) => ({
        tags: all.tags + (out.texts || []).filter(isTag).length,
        strokes: all.strokes + (out.strokes || []).length,
      }), { tags: 0, strokes: 0 });
  };
  const tagsIn = out => ({ length: out.tags });

  const shown = paint(undefined);
  // THE FIXTURE'S REACH AGAIN. 12 windows in this drawing, and if none of
  // them tags on E1 then "hiding the layer removed the tags" is a claim about
  // an empty sheet -- which is exactly how the plan's own tag hid behind a
  // guard through four screenshots.
  ok('the elevation paints window size tags to begin with', tagsIn(shown).length > 0,
    `${tagsIn(shown).length} tags`);
  const hidden = paint(() => ({ name: 'A-DIMS-FENS', visible: false, printable: true }));
  ok('unticking A-DIMS-FENS takes every size tag off the elevation',
    tagsIn(hidden).length === 0, `${tagsIn(hidden).length} left`);
  const ticked = paint(() => ({ name: 'A-DIMS-FENS', visible: true, printable: true }));
  ok('ticking it puts them back', tagsIn(ticked).length === tagsIn(shown).length,
    `${tagsIn(ticked).length} vs ${tagsIn(shown).length}`);
  // The windows themselves are not on that layer and must not follow the tag
  // off the sheet -- hiding a DIMENSION layer that took the glass with it
  // would be a far worse bug than the one this fixes.
  ok('the windows still draw when their size tags are hidden',
    hidden.strokes === shown.strokes,
    `${hidden.strokes} vs ${shown.strokes} strokes`);
  // NO STANDARD DRAWS, the same way an untagged dimension does: a page that
  // never wired a profile has not hidden anything.
  ok('an elevation with no layer standard still tags its windows',
    tagsIn(paint(() => null)).length === tagsIn(shown).length);

  return { win, warnings };
}

run();
console.log(`dim-layers-harness: ${checks - failures}/${checks} checks passed, ${failures} failed`);
if (!MUTATE) process.exit(failures ? 1 : 0);
if (failures) {
  console.error('dim-layers-harness: checks are red, so the mutation table would be meaningless');
  process.exit(1);
}

// ── MUTATIONS ───────────────────────────────────────────────────────────────
//
// Each breaks one link of the chain in memory and asserts the checks go red.
// A mutation that makes a file UNPARSEABLE is reported INVALID rather than
// caught: it would fail every check for the wrong reason, which is the exact
// miscount Devin found in harness-env.js on 29 Sep.
const MUTATIONS = [
  ['the overall is tagged exterior detail on a roofed stack',
    'auto-dims.js', c => c.replace(
      `          }\n          strings.push({ coords: [lo, hi], layer: DIM_LAYERS.OVERALL });`,
      `          }\n          strings.push({ coords: [lo, hi], layer: DIM_LAYERS.EXTERIOR });`)],
  ['the overall is tagged exterior detail on a walls stack',
    'auto-dims.js', c => c.replace(
      `if (jogCoords.length > 2) strings.push({ coords: jogCoords, layer: DIM_LAYERS.EXTERIOR });\n          strings.push({ coords: [lo, hi], layer: DIM_LAYERS.OVERALL });`,
      `if (jogCoords.length > 2) strings.push({ coords: jogCoords, layer: DIM_LAYERS.EXTERIOR });\n          strings.push({ coords: [lo, hi], layer: DIM_LAYERS.EXTERIOR });`)],
  ['opening centres are tagged overall',
    'auto-dims.js', c => c.replace('layer: DIM_LAYERS.FENESTRATION', 'layer: DIM_LAYERS.OVERALL')],
  ['the jog string loses its layer',
    'auto-dims.js', c => c.replace(
      'strings.push({ coords: jogCoords, layer: DIM_LAYERS.EXTERIOR })',
      'strings.push({ coords: jogCoords, layer: null })')],
  ['the segment is built without carrying the layer',
    'auto-dims.js', c => c.replace('            layer: string.layer,\n', '')],
  ['the along string measures from the beam ends, not the house edge',
    'auto-dims.js', c => c.replace(
      'emit(along, [edge[along][0], ...inner, edge[along][1]], fixed + side * clearFt);',
      'emit(along, [runLo, ...inner, runHi], fixed + side * clearFt);')],
  ['the column strings sit on the beam instead of clear of it',
    'auto-dims.js', c => c.replace(
      'clearFt = COLUMN_CLEAR_FT,', 'clearFt = 0,')],
  ['the across string is never emitted',
    'auto-dims.js', c => c.replace(
      'if (fixed > edge[across][0] + 0.01 && fixed < edge[across][1] - 0.01) {',
      'if (false) {')],
  ['a post off the beam line joins the beam anyway',
    'auto-dims.js', c => c.replace(
      'if (Math.abs(point[across] - fixed) > ON_BEAM_FT) return false;', '')],
  ['the stair hole stops being looked for',
    'auto-dims.js', c => c.replace(
      'const side = clearSide(1) ? 1 : clearSide(-1) ? -1 : 0;', 'const side = 1;')],
  ['a column segment loses its layer',
    'auto-dims.js', c => c.replace(
      'layer: DIM_LAYERS.COLUMNS,', 'layer: null,')],
  ['the format drops the layer again',
    'drawing-format.js', c => c.replace(
      'const layer = oneOf(dimension?.layer, DIMENSION_LAYERS, null);',
      'const layer = null;')],
  ['the format takes any layer it is handed',
    'drawing-format.js', c => c.replace(
      'const layer = oneOf(dimension?.layer, DIMENSION_LAYERS, null);',
      'const layer = dimension?.layer ?? null;')],
  ['a dimension layer is renamed in the standards table only',
    'profile-manager.js', c => c.replace("id: 'A-DIMS-OVR', name: 'A-DIMS-OVR'",
      "id: 'A-DIM-OVR', name: 'A-DIM-OVR'")],
  ['the dimension layers lose their Visible tick',
    'profile-manager.js', c => c.replace(
      "use: 'Overall size — the footprint corner to corner, eave to eave. The one string a listing plan keeps.', printable: true, visibility: true",
      "use: 'Overall size — the footprint corner to corner, eave to eave. The one string a listing plan keeps.', printable: true")],
  ['layout-plan stops handing over the standards',
    'layout-plan.js', c => c.replace(
      'layerStandard: layerTable ? (id => layerTable[id] || null) : null,', '')],
  ['cut-view-env stops handing over the standards',
    'cut-view-env.js', c => c.replace(
      'layerStandard: layerTable ? (id => layerTable[id] || null) : null,', '')],
  ['cut-view-env hands over an empty table',
    'cut-view-env.js', c => c.replace(
      'layerStandard: layerTable ? (id => layerTable[id] || null) : null,',
      'layerStandard: id => null,')],
  ['layout-plan hands over an empty table',
    'layout-plan.js', c => c.replace(
      'layerStandard: layerTable ? (id => layerTable[id] || null) : null,',
      'layerStandard: id => null,')],
];

let caught = 0;
let invalid = 0;
for (const [name, file, edit] of MUTATIONS) {
  const probe = loadWith({ [file]: edit });
  if (probe.failed.length) {
    invalid += 1;
    console.log(`  INVALID   ${name} -- ${probe.failed[0]}`);
    continue;
  }
  const before = failures;
  const beforeChecks = checks;
  try { run({ [file]: edit }); } catch (err) { failures += 1; }
  const died = failures > before;
  if (died) caught += 1;
  else console.log(`  SURVIVED  ${name}`);
  failures = before;
  checks = beforeChecks;
}
const expected = MUTATIONS.length - invalid;
console.log(`dim-layers-harness: ${caught}/${MUTATIONS.length} mutations caught`
  + (invalid ? `, ${invalid} INVALID (did not parse -- not counted as caught)` : ''));
process.exit(caught === expected && !invalid ? 0 : 1);
