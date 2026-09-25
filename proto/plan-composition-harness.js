// THE PLAN'S DRAW ORDER, AND THE FILTERING THAT DECIDES WHAT IS IN IT.
//
// plan-composition.js exists because that order lived in three places and
// drifted. Its own header counts the drift. What it did NOT have, until this
// file, was a single check -- no harness, no spec, nothing. It has been in
// production the whole time through layout-plan.js, which is what draws the
// sheet the app's own link calls "the sheet that goes to site".
//
// THAT IS THE WHOLE REASON THIS EXISTS, and the reason it was written BEFORE
// the model page was moved onto the module rather than after: a shared
// composition with no checks is not a single source of truth, it is a single
// point of failure with three former copies to be blamed instead.
//
// The module's own tail says so: `forLevel` and `onView` are exported "for
// the harness and for a caller that wants the same filtering without the
// painting". This is that harness, arriving late.
//
// WHAT IT MEASURES. Everything here is decided by the module and nothing by
// a painter: the ORDER, the FILTERING (level, view, layer) and the contract
// that a stage with no env is SKIPPED rather than guessed. render-2d.js's
// painters have their own suite; this one hands them a recorder and reads
// which was called, in what order, with which entity.
//
// Run: node proto/plan-composition-harness.js          (checks)
//      node proto/plan-composition-harness.js --mutate (checks + mutation table)
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'plan-composition.js');
const MUTATION_MODE = require('./harness-args.js').mutationMode();

// A render module that paints nothing and remembers everything. Every name
// plan-composition reaches for is here; a call to one it invents throws
// rather than passing, because a painter this stub does not know about is a
// painter nobody is checking.
function recorder() {
  const tape = [];
  const note = name => (ctx, toS, entity, ...rest) => {
    const id = entity && typeof entity === 'object' && entity.id !== undefined ? `#${entity.id}` : '';
    tape.push(`${name}${id}`);
    return rest;
  };
  const render = {
    drawFloor2D: note('floor'),
    drawShape2D: note('shape'),
    drawRoof2D: note('roof'),
    drawOpening2D: note('opening'),
    drawFixture2D: note('fixture'),
    drawStairs2D: (ctx, toS, env) => {
      tape.push(`stairs[${(env.stairs || []).map(s => s.id).join(',')}]`);
    },
    drawCutMarks2D: () => tape.push('cutMarks'),
    drawOutlines2D: () => tape.push('outlines'),
    drawDimension2D: note('dimension'),
    drawBeam2D: note('beam'),
    drawColumn2D: (ctx, toS, column, options) => {
      tape.push(`column#${column.id}${options && options.footing ? ':pile' : ''}`);
    },
    drawNoteScreen2D: (ctx, anchor, text, note_) => tape.push(`note#${note_.id}`),
    // THE WALL PASS IS THE ONE THAT CARRIES ITS PHASE, because the two-pass
    // draw is the thing most easily collapsed by accident.
    drawWallSeg2D: (ctx, toS, wall, selected, joins, phase) => tape.push(`wall#${wall.id}:${phase}`),
  };
  return { render, tape };
}

// A canvas that answers every call and draws nothing. `strokeLines` really
// strokes, so the tape gets a mark from the context rather than a painter.
function ctxStub(tape) {
  return {
    save() {}, restore() {}, beginPath() {}, closePath() {},
    moveTo() {}, lineTo() {}, quadraticCurveTo() {},
    stroke() { tape.push('line'); }, fill() {}, fillText() {},
    strokeStyle: '', fillStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
  };
}

function load(mutate) {
  let src = fs.readFileSync(SRC, 'utf8');
  if (mutate) {
    const next = mutate(src);
    if (next === src) throw new Error('mutation matched nothing -- it would prove nothing');
    if (mutate(next) !== next) {
      throw new Error('mutation anchor matches more than once -- replace() takes '
        + 'the FIRST, which may not be the code the mutation is named for');
    }
    src = next;
  }
  const window = {};
  new Function('window', src)(window);
  return window;
}

const toS = pt => ({ x: (pt && pt.x) || 0, y: (pt && pt.z) || 0 });

// ONE OF EVERY ENTITY, all on level 3 and view 'plan' unless a check needs
// otherwise. Ids are what the tape prints, so they are short and speak.
const drawing = () => ({
  floors: [{ id: 'f1', levelId: 3, view: 'plan', layer: 'A-FLOR', points: [] }],
  shapes: [{ id: 'sh1', levelId: 3, view: 'plan', layer: 'A-SHAPE', points: [] }],
  roofs: [{ id: 'r1', levelId: 3, view: 'other', layer: 'A-ROOF', points: [] }],
  walls: [{ id: 'w1', levelId: 3, view: 'plan', start: { x: 0, z: 0 }, end: { x: 10, z: 0 } }],
  fenestrations: [{ id: 'o1', wallId: 'w1', levelId: 9, layer: 'A-GLAZ' }],
  fixtures: [{ id: 'x1', levelId: 3, view: 'plan', layer: 'A-FIXT', wallId: 'w1' }],
  stairs: [{ id: 'st1', levelId: 3, view: 'plan' }],
  lines: [{ id: 'l1', levelId: 3, view: 'plan', layer: 'A-ANNO', start: { x: 0, z: 0 }, end: { x: 1, z: 1 } }],
  dimensions: [{ id: 'd1', levelId: 3, view: 'plan', layer: 'A-DIMS' }],
  beams: [{ id: 'b1', levelId: 3, view: 'plan' }],
  columns: [{ id: 'c1', levelId: 3, view: 'plan', footing: 'pile10' }],
  notes: [{ id: 'n1', levelId: 3, view: 'plan', layer: 'A-ANNO', anchor: { x: 0, z: 0 }, text: { x: 1, z: 1 } }],
  electricDevices: [{ id: 'e1', levelId: 3, view: 'plan', layer: 'E-DEVC', kind: 'outlet' }],
});

// EVERY STAGE SUPPLIED. A check that wants one skipped deletes its env, which
// is the module's own contract -- "a caller says what it can draw by supplying
// the env for it".
const fullEnv = over => ({
  levelId: 3,
  viewId: 'plan',
  hasLayerViews: true,
  ...drawing(),
  floorEnv: {}, shapeEnv: {}, roofEnv: {}, wallEnv: {}, fixtureEnv: {},
  stairEnv: { riser: 7 }, cutMarkEnv: {}, outlineEnv: {}, dimensionEnv: {},
  structureEnv: {}, noteEnv: {}, openingEnv: {},
  openingGeometry: opening => ({ id: opening.id, glazing: [{ x: 0, z: 0 }, { x: 1, z: 0 }],
    corners: [{ x: 0, z: 0 }], center: { x: 0, z: 0 } }),
  wallJoins: walls => walls.length,
  columnFooting: column => (/pile/i.test(String(column.footing || '')) ? { pile: true } : null),
  ...over,
});

const run = (win, over) => {
  const { render, tape } = recorder();
  win.DraftRender2D = render;
  win.DraftPlanComposition.drawPlan(ctxStub(tape), toS, fullEnv(over));
  return tape;
};

const CHECKS = [
  {
    label: 'the order, end to end, with one of every entity on the level',
    fn: win => [run(win).join(' '),
      'floor#f1 shape#sh1 roof#r1 wall#w1:fill wall#w1:stroke opening#o1 fixture#x1 '
      + 'stairs[st1] cutMarks outlines line dimension#d1 beam#b1 column#c1:pile note#n1'],
  },
  {
    label: 'the wall pass is TWO passes -- every fill before any stroke',
    fn: win => {
      // Collapsing them into one loop paints each wall's body over its
      // neighbour's edge, so a join stops reading as one assembly. Two walls
      // is the smallest drawing that can show it.
      const two = [
        { id: 'wa', levelId: 3, view: 'plan', start: { x: 0, z: 0 }, end: { x: 10, z: 0 } },
        { id: 'wb', levelId: 3, view: 'plan', start: { x: 10, z: 0 }, end: { x: 10, z: 8 } },
      ];
      return [run(win, { walls: two, fenestrations: [] })
        .filter(m => m.startsWith('wall')).join(' '),
      'wall#wa:fill wall#wb:fill wall#wa:stroke wall#wb:stroke'];
    },
  },
  // ── THE FILTERING ────────────────────────────────────────────────────
  {
    label: 'another level-s entities are not on this drawing',
    fn: win => [run(win, { levelId: 5 }).join(' ') || '(nothing)',
      // The roof is whole-level too, so level 5 draws nothing at all -- but
      // the stages that take a collection still run and still say so.
      'stairs[] cutMarks outlines'],
  },
  {
    label: 'a level with layer views shows ONE of them',
    fn: win => {
      const tape = run(win, { viewId: 'foundation' });
      return [tape.filter(m => /^(floor|wall|dimension)/.test(m)).join(' ') || '(none)', '(none)'];
    },
  },
  {
    label: 'a viewId of null means EVERY view -- what a saved viewport carrying none means',
    fn: win => {
      const tape = run(win, { viewId: null });
      return [tape.includes('floor#f1') && tape.includes('wall#w1:fill'), true];
    },
  },
  {
    label: 'a whole-level context ignores views entirely',
    fn: win => {
      const tape = run(win, { hasLayerViews: false, viewId: 'foundation' });
      return [tape.includes('floor#f1'), true];
    },
  },
  {
    label: 'a roof belongs to its LEVEL and shows on every drawing of it',
    fn: win => {
      // The fixture's roof carries view 'other' on purpose: a roof filtered
      // by view would vanish from the plan it covers.
      const tape = run(win, { viewId: 'plan' });
      return [tape.includes('roof#r1'), true];
    },
  },
  {
    label: 'an opening is filtered by its HOST WALL, not by its own level',
    fn: win => {
      // o1 carries levelId 9, which is nobody's level. It draws because its
      // wall is on this one -- a wall shared between storeys puts another
      // level's openings on this draw.
      const tape = run(win);
      return [tape.includes('opening#o1'), true];
    },
  },
  {
    label: 'and an opening whose host wall is NOT drawn is not drawn either',
    fn: win => {
      const tape = run(win, { fenestrations: [{ id: 'o9', wallId: 'gone', levelId: 3 }] });
      return [tape.some(m => m.startsWith('opening')), false];
    },
  },
  {
    label: 'the stair painter is handed the FILTERED list, not the whole collection',
    fn: win => {
      const stairs = [{ id: 'sA', levelId: 3, view: 'plan' }, { id: 'sB', levelId: 5, view: 'plan' }];
      return [run(win, { stairs }).find(m => m.startsWith('stairs')), 'stairs[sA]'];
    },
  },
  // ── THE LAYER TABLE ──────────────────────────────────────────────────
  {
    label: 'a layer switched off takes its entities with it',
    fn: win => {
      const tape = run(win, { layerStandard: id => ({ visible: id !== 'A-FLOR', printable: true }) });
      return [tape.some(m => m.startsWith('floor')), false];
    },
  },
  {
    label: 'a no-print layer still draws on screen, and not on a sheet',
    fn: win => {
      const standard = id => ({ visible: true, printable: id !== 'A-DIMS' });
      const onScreen = run(win, { layerStandard: standard }).some(m => m.startsWith('dimension'));
      const printed = run(win, { layerStandard: standard, isPrinting: true }).some(m => m.startsWith('dimension'));
      return [`${onScreen} ${printed}`, 'true false'];
    },
  },
  {
    label: 'no layer table at all draws the drawing, not nothing',
    fn: win => [run(win, { layerStandard: () => null }).includes('floor#f1'), true],
  },
  // ── A STAGE WITH NO ENV IS SKIPPED, NOT GUESSED ──────────────────────
  {
    label: 'a caller that cannot supply an env loses that stage and nothing else',
    fn: win => {
      // drawFloor2D reaches for env.colors.fill with no guard, so a guessed
      // env would not draw a paler floor -- it would throw mid-sheet.
      const tape = run(win, { floorEnv: undefined, structureEnv: undefined });
      return [`${tape.some(m => m.startsWith('floor'))} ${tape.some(m => /^(beam|column)/.test(m))} `
        + `${tape.includes('wall#w1:fill')}`, 'false false true'];
    },
  },
  {
    label: 'openings need their GEOMETRY, and without it the whole pass is off',
    fn: win => [run(win, { openingGeometry: undefined }).some(m => m.startsWith('opening')), false],
  },
  {
    label: 'a footing is the caller-s answer -- only a pile changes the drawn shape',
    fn: win => {
      const plain = run(win, { columns: [{ id: 'c9', levelId: 3, view: 'plan', footing: 'pad' }] });
      return [plain.find(m => m.startsWith('column')), 'column#c9'];
    },
  },
  {
    label: 'a drawing with nothing on it paints no geometry and does not throw',
    fn: win => {
      const bare = Object.fromEntries(Object.keys(drawing()).map(k => [k, []]));
      const tape = run(win, bare);
      return [tape.join(' '), 'stairs[] cutMarks outlines'];
    },
  },
  {
    label: 'no render module at all is a no-op, not a crash',
    fn: win => {
      const { tape } = recorder();
      win.DraftRender2D = null;
      win.DraftPlanComposition.drawPlan(ctxStub(tape), toS, fullEnv());
      return [tape.length, 0];
    },
  },
];

const MUTATIONS = [
  ['the two wall passes collapse into one loop',
    s => s.replace(`    walls.forEach(wall => render.drawWallSeg2D(ctx, toS, wall, false, joins, 'fill', env.wallEnv));
    walls.forEach(wall => render.drawWallSeg2D(ctx, toS, wall, false, joins, 'stroke', env.wallEnv));`,
    `    walls.forEach(wall => {
      render.drawWallSeg2D(ctx, toS, wall, false, joins, 'fill', env.wallEnv);
      render.drawWallSeg2D(ctx, toS, wall, false, joins, 'stroke', env.wallEnv);
    });`)],
  ['roofs are filtered by view like everything else',
    s => s.replace("const roofs = pick(env.roofs, { views: false });", 'const roofs = pick(env.roofs);')],
  ['the level filter is dropped -- every level draws at once',
    s => s.replace('return list(items).filter(item => item.levelId === levelId && (!views || keep(item)));',
      'return list(items).filter(item => (!views || keep(item)));')],
  ['a null viewId stops meaning every view',
    s => s.replace('!hasLayerViews || viewId === null || (item.view || \'plan\') === viewId;',
      "!hasLayerViews || (item.view || 'plan') === viewId;")],
  ['a whole-level context filters by view anyway',
    s => s.replace('!hasLayerViews || viewId === null', 'viewId === null')],
  ['openings are filtered by their own level instead of their host wall',
    s => s.replace('.filter(opening => hostIds.has(opening.wallId) && shows(opening.layer));',
      '.filter(opening => opening.levelId === env.levelId && shows(opening.layer));')],
  ['the stair painter gets the whole collection',
    s => s.replace('render.drawStairs2D(ctx, toS, { ...env.stairEnv, stairs: pick(env.stairs) });',
      'render.drawStairs2D(ctx, toS, { ...env.stairEnv, stairs: env.stairs });')],
  ['a hidden layer draws anyway',
    s => s.replace('    if (!standard.visible) return false;', '')],
  ['a no-print layer prints',
    s => s.replace('return !env.isPrinting || standard.printable !== false;', 'return true;')],
  ['a missing env is guessed rather than skipped',
    s => s.replace('if (env.floorEnv) floors.forEach', 'if (true) floors.forEach')],
  // THE POSITION of the structure block is already pinned by the end-to-end
  // order check -- it names every stage in sequence, so a block moved
  // anywhere fails it. What that check cannot see is the order WITHIN a
  // block, so this mutation asks about that instead.
  //
  // (The first attempt here moved the block, by inserting a line before
  // `pick(env.beams)`. It never applied: the inserted text carried the
  // anchor with it, so the double-apply guard found the anchor twice and
  // refused -- the guard working exactly as its own comment says it will.)
  ['columns are drawn before the beams they carry',
    s => s.replace(`      pick(env.beams).forEach(beam => render.drawBeam2D(ctx, toS, beam, {}, env.structureEnv));
      pick(env.columns).forEach(column => render.drawColumn2D(ctx, toS, column, {
        footing: env.columnFooting ? env.columnFooting(column) : null,
      }, env.structureEnv));`,
    `      pick(env.columns).forEach(column => render.drawColumn2D(ctx, toS, column, {
        footing: env.columnFooting ? env.columnFooting(column) : null,
      }, env.structureEnv));
      pick(env.beams).forEach(beam => render.drawBeam2D(ctx, toS, beam, {}, env.structureEnv));`)],
];

function check(win) {
  const missed = [];
  for (const { label, fn } of CHECKS) {
    let got, want;
    try { [got, want] = fn(win); } catch (err) { got = `THREW: ${err.message}`; want = '(no throw)'; }
    if (String(got) !== String(want)) missed.push({ label, got, want });
  }
  return missed;
}

const baseline = check(load(null));
for (const m of baseline) console.log(`  FAIL ${m.label}\n       got ${m.got}\n       want ${m.want}`);
console.log(`\n${CHECKS.length - baseline.length}/${CHECKS.length} checks passed`);

if (MUTATION_MODE) {
  console.log('\n' + 'mutation'.padEnd(62) + 'caught by');
  let survivors = 0, broken = 0;
  for (const [label, mutate] of MUTATIONS) {
    let by;
    try {
      const missed = check(load(mutate));
      if (!missed.length) survivors += 1;
      by = missed.length ? missed.map(m => m.label).join('\n' + ' '.repeat(62)) : '*** NOTHING ***';
    } catch (err) { broken += 1; by = `!!! MUTATION DID NOT APPLY: ${err.message}`; }
    console.log(`${label.padEnd(62)}${by}`);
  }
  console.log(`\n${MUTATIONS.length - survivors - broken}/${MUTATIONS.length} mutations caught`);
  if (broken) console.log(`${broken} mutation(s) never applied -- they prove nothing`);
  process.exit(baseline.length || survivors || broken ? 1 : 0);
}

process.exit(baseline.length ? 1 : 0);
