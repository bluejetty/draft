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
const MUTATE = process.argv.slice(2).includes('--mutate');
const ARGS = process.argv.slice(2).filter(a => a !== '--mutate');
if (ARGS.length) {
  console.error(`dim-layers-harness: takes no arguments (got ${ARGS.join(' ')})`);
  process.exit(2);
}

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
  ok('DIM_LAYERS names the three kinds auto-dims emits', known.size === 3,
    [...known].join(','));
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
  ok('a layer the format does not know becomes null, not itself',
    through('A-DIMS-NOPE')?.layer === null, String(through('A-DIMS-NOPE')?.layer));
  ok('a dimension written before layers existed stays null',
    through(undefined)?.layer === null, String(through(undefined)?.layer));

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
