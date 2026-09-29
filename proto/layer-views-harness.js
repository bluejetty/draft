#!/usr/bin/env node
// LAYER VIEWS — the table that decides WHICH DRAWING OF A LEVEL you are on,
// and, since the composer was wired to it, which layers that drawing carries.
//
// WHY IT EXISTS. Devin's audit, 28 Sep: layer-views.js publishes eight names
// and no harness in the repo loads it. The page tests reach it through MODEL's
// layer-set buttons, so what they witness is that pressing FLOOR PLAN changed
// the drawing -- not that MAIN FL and 2ND FL share one table, not that an
// unknown view falls back to the level's default rather than painting nothing,
// and not that the floor list still names the beam's post.
//
// IT IS PURE DATA PLUS FOUR LOOKUPS, so the subject loads into a sandbox and
// is called directly. The value is not in the lookups -- they are four lines
// each -- it is in the TABLE, which nothing has ever checked and which two
// painters now read.
//
// THE CONTENTS LISTS ARE LOAD-BEARING NOW, WHICH THEY WERE NOT. Until
// plan-composition.js gained `viewLayers`, a name could be dropped from one of
// these arrays and every sheet would look the same. Today dropping one stops
// that layer being drawn on that view, silently, on both sheet pages. So the
// checks below are written against the format rather than against the table:
// a layer the drawing format WRITES and no view CARRIES is a record saved
// forever and drawn nowhere, which is exactly the defect that put
// S-COL-FOOTING on the floor view on 25 Sep.
//
// WHAT IT DELIBERATELY DOES NOT DO is assert the lists item by item. A copy of
// the table in a second file is not a check; it is the same claim twice, and
// it goes green on a table rebuilt wrong in the same shape.
//
// Run: node proto/layer-views-harness.js
//      node proto/layer-views-harness.js --mutate
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const MUTATE = require('./harness-args.js').mutationMode();

let EDIT = null;
const readSubject = name => {
  const text = fs.readFileSync(path.join(ROOT, name), 'utf8');
  return EDIT && EDIT.file === name ? EDIT.fn(text) : text;
};

function loadViews() {
  const win = {};
  const sandbox = { window: win, console, Math, Number, String, Object, Array,
    JSON, Map, Set, RegExp, isFinite, parseFloat, parseInt };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readSubject('layer-views.js'), sandbox, { filename: 'layer-views.js' });
  if (!win.DraftLayerViews) throw new Error('layer-views.js did not publish DraftLayerViews');
  return win.DraftLayerViews;
}

// THE LAYERS THE FORMAT WRITES, read out of drawing-format.js rather than
// listed here -- a hand-kept copy of that list is a claim about the format
// that nothing enforces, and the format is the side that moves.
const formatLayers = () => {
  const text = readSubject('drawing-format.js');
  const found = new Set();
  for (const m of text.matchAll(/^\s*layer: '([^']+)',/gm)) found.add(m[1]);
  return [...found];
};

// A layer the format writes that NO view carries, with the reason it is not a
// lost record. Each of these is ungated on the sheet for a stated reason, so
// the membership question is never asked of it.
const UNGATED = {
  // plan-composition.js picks roofs with { views: false }: a roof belongs to
  // the level it covers and shows on every drawing of it.
  'A-ROOF': 'roofs are whole-level, picked with views:false',
  // outline-master's shapes are the drafter's reference stock, not sheet
  // content; they are never composed onto a viewport.
  OUTLINE: 'master outlines are boneyard stock, not sheet content',
  // The scanned PDF/image behind the drawing. It is a drafting aid on MODEL
  // and is deliberately absent from every sheet.
  UNDERLAY: 'the scan-in underlay is a drafting aid, never printed',
};

let passed = 0;
let failures = [];
const check = (label, condition, detail) => {
  if (condition) { passed += 1; return; }
  failures.push(detail ? `${label} — ${detail}` : label);
};
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

function runChecks() {
  passed = 0; failures = [];
  const V = loadViews();

  // ── WHICH LEVELS HAVE DRAWINGS AT ALL ────────────────────────────────
  //
  // ONE TABLE FOR EVERY FLOOR, by identity rather than by contents: two
  // arrays that happen to agree today are two arrays that can stop agreeing,
  // and "MAIN FL and 2ND FL are the same kind of thing" is the claim.
  check('every floor level shares ONE set of views',
    V.layerViewsForLevelId(3) === V.layerViewsForLevelId(5));
  check('a level added with + ADD is a floor, not a blank',
    same(V.layerViewsForLevelId(9).map(v => v.id),
      V.layerViewsForLevelId(3).map(v => v.id)),
    `level 9 got [${V.layerViewsForLevelId(9).map(v => v.id)}]`);
  // The rail hands ids out of the DOM, where everything is a string.
  check('a level id that arrives as a string finds its views',
    V.layerViewsForLevelId('3').length === V.layerViewsForLevelId(3).length);
  // AND THE HALF THAT IS NOT FREE. A string keys the table by accident --
  // object keys are strings already -- but it does not match the whole-level
  // ids, so an uncoerced '7' walks past ROOF and is handed the floor set.
  check('ROOF is ROOF even when the rail says so in a string',
    V.layerViewsForLevelId('7').length === 0,
    `got [${V.layerViewsForLevelId('7').map(v => v.id)}]`);

  // SITE AND ROOF ARE WHOLE-LEVEL DRAFTING CONTEXTS. An empty list is the
  // signal the composer reads to gate nothing -- give ROOF a view set and
  // every roof on the sheet starts being asked whether its layer is carried.
  check('ROOF has no layer views', V.layerViewsForLevelId(7).length === 0);
  check('SITE has no layer views', V.layerViewsForLevelId(8).length === 0);
  check('a level id of zero or below has no views',
    V.layerViewsForLevelId(0).length === 0 && V.layerViewsForLevelId(-2).length === 0);

  // ── THE DEFAULT IS A VIEW THAT EXISTS ────────────────────────────────
  //
  // Swept rather than spot-checked: the default is what an unknown view id
  // falls back to, so a default naming a view the level does not have turns
  // every fallback into an empty layer list.
  [1, 3, 5, 9, 12].forEach(id => {
    const views = V.layerViewsForLevelId(id);
    const def = V.defaultLayerViewId(id);
    check(`level ${id} opens on a view it actually has`,
      views.some(v => v.id === def), `default is ${def}`);
  });
  check('FOUNDATION opens on the concrete, not on walls',
    V.defaultLayerViewId(1) === 'foundation');
  check('a floor opens on its walls', V.defaultLayerViewId(3) === 'plan');
  check('a level with no views has no default',
    V.defaultLayerViewId(7) === null);

  // ── layersFor: WHAT THE COMPOSER IS HANDED ───────────────────────────
  const plan = V.layersFor(3, 'plan');
  check('a known view hands back its own contents',
    same(plan, V.layerViewsForLevelId(3).find(v => v.id === 'plan').contents));
  // AN UNKNOWN VIEW IS NOT AN ERROR. An old layout, or one hand-edited, names
  // a view that has since been retired; falling back to the level's default
  // draws it, and returning [] would blank the viewport.
  check('an unknown view falls back to the level default, drawn not blank',
    same(V.layersFor(3, 'no-such-view'), V.layersFor(3, V.defaultLayerViewId(3))));
  check('the fallback is not an empty list', V.layersFor(3, 'no-such-view').length > 0);
  check('a level with no views carries no layers on any view',
    V.layersFor(7, 'plan').length === 0 && V.layersFor(7, undefined).length === 0);

  // THE TWO DIMENSION LAYERS THE SHEET TELLS APART. layout-plan's own harness
  // proves the gate honours this; here is where the difference comes from.
  check('the walls plan carries the interior string and NOT the column string',
    plan.includes('A-DIMS-INT') && !plan.includes('A-DIMS-COLS'),
    `plan: ${plan.join(' ')}`);
  check('the floor layout carries the column string',
    V.layersFor(3, 'floor').includes('A-DIMS-COLS'));

  // 25 SEP, MOVIE: a post on MAIN FL was a record in the file and on no
  // sheet. The beam was on the floor view and what holds it up was not.
  check('what holds the beam up is on the same view as the beam',
    V.layersFor(3, 'floor').includes('S-BEAM')
      && V.layersFor(3, 'floor').includes('S-COL-FOOTING'));

  // ── NO VIEW IS A DEAD END, AND NO LAYER IS A DEAD RECORD ─────────────
  const everyView = [1, 3].flatMap(id => V.layerViewsForLevelId(id).map(v => ({ id, v })));
  everyView.forEach(({ id, v }) => {
    check(`level ${id} / ${v.id} draws something`, v.contents.length > 0);
    check(`level ${id} / ${v.id} names no layer twice`,
      new Set(v.contents).size === v.contents.length);
    check(`level ${id} / ${v.id} has a label to put in the rail`,
      typeof v.label === 'string' && v.label.length > 0);
    // A note belongs on every drawing: it is how the drafter writes on one.
    check(`level ${id} / ${v.id} can be written on`,
      v.contents.includes('A-ANNO-NOTE'));
    // Frozen per view, not once at the top: layersFor hands the live array
    // out of the shared table, so ONE unfrozen list is a way to edit what
    // every floor level draws.
    check(`level ${id} / ${v.id} hands out a list nobody can edit`,
      Object.isFrozen(v.contents));
  });

  const carried = new Set(everyView.flatMap(({ v }) => v.contents));
  formatLayers().forEach(layer => {
    check(`a record saved as ${layer} lands on some sheet view`,
      carried.has(layer) || Object.prototype.hasOwnProperty.call(UNGATED, layer),
      'the format writes this layer and no view carries it, so the record is '
      + 'saved forever and drawn nowhere -- add it to a view, or to UNGATED '
      + 'here with the reason it is never gated');
  });

  // ── THE TABLE CANNOT BE EDITED BY A CALLER ───────────────────────────
  //
  // layersFor hands back the live array out of the shared table, and the
  // table is shared by every floor level. A caller that sorts or pushes the
  // list it was given would be editing what every other level draws.
  check('the view sets are frozen', Object.isFrozen(V.FLOOR_LEVEL_VIEWS));
  check('a layer list handed out cannot be edited',
    Object.isFrozen(V.layersFor(3, 'plan')));
  let pushed = false;
  try { V.layersFor(3, 'plan').push('E-POWER'); pushed = true; } catch (err) { /* frozen */ }
  check('pushing onto a handed-out list does not reach the table',
    !V.layersFor(3, 'plan').includes('E-POWER'),
    pushed ? 'the push landed and every floor view now carries E-POWER' : '');

  // ── floorLevels: THE REVERSAL IS THE POINT ───────────────────────────
  //
  // The rail lists top-down and a stair climbs from the level BELOW, so
  // reading this the wrong way up lands the flight on the wrong storey.
  const rail = [{ id: 7, name: 'ROOF' }, { id: 5, name: '2ND FL' },
    { id: 3, name: 'MAIN FL' }, { id: 1, name: 'FOUNDATION' }];
  const floors = V.floorLevels(rail);
  check('floorLevels comes back bottom-up, not in rail order',
    same(floors.map(l => l.id), [3, 5]), `got [${floors.map(l => l.id)}]`);
  check('a level with no floor of its own is not in the list',
    !floors.some(l => l.id === 7) && !floors.some(l => l.id === 1));
  // A filter that reversed the caller's array in place would reorder the
  // levels rail itself, from a function that only says it reads it.
  check('the caller-s own array is left the way it came',
    same(rail.map(l => l.id), [7, 5, 3, 1]));
  check('no levels is no floors, not a throw', V.floorLevels(null).length === 0);

  // ── floorHomeView: WHERE A FLOOR OUTLINE SAVES ───────────────────────
  //
  // drawing-format.js:218 records what this costs when it is got wrong, and
  // says why no fixture caught it: the old page always writes the field.
  check('drawn on FOUNDATION, a floor is concrete',
    V.floorHomeView('foundation', 3) === 'foundation');
  check('on a level that HAS a foundation set it is concrete whatever view was open',
    V.floorHomeView('plan', 1) === 'foundation'
      && V.floorHomeView('e-power', 1) === 'foundation');
  check('only a level with no foundation set gets a framed floor',
    V.floorHomeView('plan', 3) === 'floor' && V.floorHomeView('floor', 5) === 'floor');
  check('a level with no views at all still answers',
    V.floorHomeView('plan', 7) === 'floor');
}

if (!MUTATE) {
  runChecks();
  failures.forEach(f => console.log(`  FAIL  ${f}`));
  console.log(failures.length
    ? `layer-views-harness: ${failures.length} FAILED of ${passed + failures.length}`
    : `layer-views-harness: ${passed} checks pass`);
  process.exit(failures.length ? 1 : 0);
}

// ── MUTATIONS ───────────────────────────────────────────────────────────
const MUTATIONS = [
  ['floors no longer share one table', 'layer-views.js',
    c => c.replace('    5: FLOOR_LEVEL_VIEWS,', '    5: FLOOR_LEVEL_VIEWS.slice(),')],

  ['an added level gets no views', 'layer-views.js',
    c => c.replace('|| (id > 0 && !WHOLE_LEVEL_IDS.includes(id) ? FLOOR_LEVEL_VIEWS : []);', '|| [];')],

  ['the level id is trusted as it arrives', 'layer-views.js',
    c => c.replace('const id = Number(levelId);', 'const id = levelId;')],

  ['ROOF and SITE become floors', 'layer-views.js',
    c => c.replace('const WHOLE_LEVEL_IDS = Object.freeze([7, 8]);',
      'const WHOLE_LEVEL_IDS = Object.freeze([]);')],

  ['FOUNDATION opens on walls like a floor', 'layer-views.js',
    c => c.replace("return views.some(view => view.id === 'foundation') ? 'foundation' : 'plan';",
      "return 'plan';")],

  ['a level with no views claims a default anyway', 'layer-views.js',
    c => c.replace('if (!views.length) return null;', '')],

  ['an unknown view draws nothing instead of the default', 'layer-views.js',
    c => c.replace("    const view = views.find(v => v.id === viewId)\n      || views.find(v => v.id === defaultLayerViewId(levelId));",
      '    const view = views.find(v => v.id === viewId);')],

  ['the column string joins the walls plan', 'layer-views.js',
    c => c.replace("'A-DIMS-INT', 'A-DIMS-FENS', 'ROOM-IDS-AREA',",
      "'A-DIMS-INT', 'A-DIMS-COLS', 'A-DIMS-FENS', 'ROOM-IDS-AREA',")],

  ['the post comes off the floor view again', 'layer-views.js',
    c => c.replace("(['S-BEAM', 'S-COL-FOOTING', 'S-SLAB',", "(['S-BEAM', 'S-SLAB',")],

  ['the stair view cannot be written on', 'layer-views.js',
    c => c.replace("(['A-STR', 'A-FL-OPNG', 'STAIR SECTION', 'A-ANNO-NOTE'])",
      "(['A-STR', 'A-FL-OPNG', 'STAIR SECTION'])")],

  ['a handed-out layer list is the table-s own, editable', 'layer-views.js',
    // Every copy, not the first: the freeze is per view, and one list left
    // editable is enough.
    c => c.split('contents: Object.freeze(').join('contents: (')],

  ['the floors come back in rail order, top-down', 'layer-views.js',
    c => c.replace('    .slice()\n    .reverse();', '    .slice();')],

  ['every level counts as carrying a floor', 'layer-views.js',
    c => c.replace(".filter(level => layerViewsForLevelId(level.id).some(view => view.id === 'floor'))", '')],

  ['a floor drawn on a level that has a foundation is framed, not concrete', 'layer-views.js',
    c => c.replace("    return layerViewsForLevelId(levelId).some(view => view.id === 'foundation')\n      ? 'foundation' : 'floor';",
      "    return 'floor';")],

  ['the FOUNDATION view itself no longer saves concrete', 'layer-views.js',
    c => c.replace("    if (viewId === 'foundation') return 'foundation';", '')],
];

let caught = 0;
for (const [name, file, fn] of MUTATIONS) {
  const before = fs.readFileSync(path.join(ROOT, file), 'utf8');
  if (fn(before) === before) {
    console.log(`  ANCHOR MISSED  ${name}  (the edit changed nothing in ${file} -- re-aim it)`);
    continue;
  }
  EDIT = { file, fn };
  let red = false;
  try { runChecks(); red = failures.length > 0; }
  catch (err) { red = true; }
  EDIT = null;
  if (red) caught += 1;
  else console.log(`  SURVIVED  ${name}`);
}
console.log(`layer-views-harness: ${caught}/${MUTATIONS.length} mutations caught`);
process.exit(caught === MUTATIONS.length ? 0 : 1);
