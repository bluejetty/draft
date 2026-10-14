#!/usr/bin/env node
// WHAT A SITE PLAN DRAWS: the lot line, the building's footprint, the eave.
//
// Movie, 14 Oct: "also show a 'footprint shape' of the building on the site
// plan. is that possible", and then the report that sent this into layout-plan
// at all -- "i tried to do the site plan in the layout area - it should pop up
// a viewport with the new site plan, (nothing happens)".
//
// MEASURED OFF THE PAINTER'S OWN STROKES rather than off pixels: three
// drawings, each one thing different, and each check is a DIFFERENCE between
// two of them. A painter that drew the lot twice and no footprint would pass
// "there is ink on the sheet" and fails every check below.
//
// Run: node proto/site-plan-harness.js
//      node proto/site-plan-harness.js --mutate
const MUTATE = require('./harness-args.js').mutationMode();
const path = require('path');
const H = require('./harness-env.js');
const ROOT = path.join(__dirname, '..');

const MUTATIONS = [
  ['the site sheet draws no footprint, only the lot', 'layout-plan.js',
    c => c.replace(`    bodies.forEach(body => {
      siteLoop(ctx, toS, body.points);
      ctx.fill();
      ctx.stroke();
    });`, '    bodies.forEach(() => {});')],
  ['the lot line is not drawn at all', 'layout-plan.js',
    c => c.replace(`      siteLoop(ctx, toS, lot.points);
      ctx.stroke();`, '      siteLoop(ctx, toS, lot.points);')],
  ['the eave line is dropped, so the setback has nothing to measure to',
    'layout-plan.js',
    c => c.replace('    roofs.forEach(roof => { siteLoop(ctx, toS, roof.points); ctx.stroke(); });',
      '    roofs.forEach(() => {});')],
  ['the footprint takes every storey, so an upper floor draws over the ground',
    'layout-plan.js',
    c => c.replace('      bodies: ground === null ? [] : bodies.filter(item => num(item.levelId) === ground),',
      '      bodies,')],
  ['the lot is drawn as a building too', 'layout-plan.js',
    c => c.replace('    const bodies = outlines.filter(item => item.site !== true',
      '    const bodies = outlines.filter(item => true')],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('site-plan',
    MUTATIONS, { root: ROOT, harness: __filename });
  process.exit(all ? 0 : 1);
}

const win = H.loadDraftModules();
const LP = win.DraftLayoutPlan;

let passed = 0;
const failures = [];
const check = (name, condition, detail) => {
  if (condition) { passed += 1; return; }
  failures.push(detail ? `${name}\n      ${detail}` : name);
};

const rect = (x0, z0, x1, z1) => [{ x: x0, z: z0 }, { x: x1, z: z0 },
  { x: x1, z: z1 }, { x: x0, z: z1 }];

// A 30 x 24 garage on MAIN FL, its roof 2 ft bigger all round, and a 45 x 120
// lot: his own drawing, near enough.
const GARAGE = { id: 'g', levelId: 3, points: rect(0, 0, 30, 24) };
const UPPER = { id: 'u', levelId: 5, points: rect(0, 0, 30, 18) };
const ROOF = { id: 'r', levelId: 7, points: rect(-2, -2, 32, 26) };
const LOT = { id: 'lot', site: true, levelId: 8, points: rect(-7, -20, 38, 100) };

const paint = saved => {
  const { ctx, strokes, fills } = H.recordingCtx();
  const drew = LP.drawSitePlan(ctx, p => ({ x: p.x, y: p.z }), saved, {});
  return { drew, strokes, fills };
};

const all = paint({ outlines: [LOT, GARAGE, UPPER], roofs: [ROOF] });
const noHouse = paint({ outlines: [LOT], roofs: [] });
const noLot = paint({ outlines: [GARAGE], roofs: [ROOF] });

check('a site with a lot and a building draws both', all.drew === true,
  `drawSitePlan answered ${all.drew}`);
check('and a drawing with neither draws nothing',
  paint({ outlines: [], roofs: [] }).drew === false, 'it drew something from nothing');

// THE FOOTPRINT IS A FILL, which is what makes it read as a building at a
// site plan's scale rather than as another boundary.
check('the building is filled, the lot is not',
  all.fills.length - noHouse.fills.length === 1,
  `${all.fills.length} fills with the building, ${noHouse.fills.length} without`);
check('and the lot line is a stroke of its own',
  all.strokes.length - noLot.strokes.length === 1,
  `${all.strokes.length} strokes with the lot, ${noLot.strokes.length} without`);

// ONE FOOTPRINT, NOT ONE PER STOREY. The upper floor stands on the same
// ground; drawing both would print a second outline inside the first and read
// as a courtyard.
check('a two-storey building still draws one footprint',
  LP.sitePlanParts({ outlines: [LOT, GARAGE, UPPER] }).bodies.length === 1,
  JSON.stringify(LP.sitePlanParts({ outlines: [LOT, GARAGE, UPPER] }).bodies.map(b => b.id)));
check('and it is the GROUND one, not the storey over it',
  LP.sitePlanParts({ outlines: [LOT, GARAGE, UPPER] }).bodies[0].id === 'g',
  'the footprint was taken from the upper storey');
// THE FLAG IS THE RULE, NOT THE LEVEL. A lot filed on SITE is kept out by
// the level filter too, so a lot on a FLOOR level is what actually asks
// whether `site: true` is being read -- and a hand-edited file or any future
// path that files one elsewhere must not put a property line on the sheet as
// a building.
check('the lot is never counted as a building, whatever level it is filed on',
  LP.sitePlanParts({ outlines: [{ ...LOT, levelId: 3 }, GARAGE] }).bodies.length === 1
    && LP.sitePlanParts({ outlines: [{ ...LOT, levelId: 3 }] }).bodies.length === 0,
  JSON.stringify(LP.sitePlanParts({ outlines: [{ ...LOT, levelId: 3 }, GARAGE] })
    .bodies.map(b => b.id)));

// THE EAVE IS THE ROOF'S OWN POINTS, which already carry the overhang they
// were built with -- so the line on the sheet is the real eave rather than a
// wall offset by a number typed in the painter.
const eave = paint({ outlines: [LOT, GARAGE], roofs: [ROOF] });
check('the eave line is drawn from the roof, and dashed',
  eave.strokes.length - paint({ outlines: [LOT, GARAGE], roofs: [] }).strokes.length === 1,
  'no eave line came out of a drawing with a roof');

// AND THE FRAME HOLDS BOTH (the case that started this: a building wider than
// its lot). planBounds on the site level has to reach the building, or the
// sheet crops off the very thing the drafter is looking for.
const narrow = { ...LOT, points: rect(5, 0, 25, 100) };
const bounds = LP.planBounds({ outlines: [narrow, GARAGE], roofs: [ROOF],
  walls: [], levels: [] }, 8);
check('the site frame takes in a building that overhangs its lot',
  bounds && bounds.minX <= -2 + 1e-9 && bounds.maxX >= 32 - 1e-9,
  JSON.stringify(bounds));

console.log(`site plan harness: ${passed} checks passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach(line => console.log(`  ✘ ${line}`));
  process.exit(1);
}
