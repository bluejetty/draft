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
  // RE-AIMED 14 OCT, when the footprint became the ROOF PLAN itself (Movie:
  // "the ROOF PLAN with the WALL OUTLINES would be a good drawing to use for
  // the FOOTPRINT"). The old anchor was the outline-and-fill this replaced,
  // which now only runs where there is no roof.
  ['the site sheet draws no footprint, only the lot', 'layout-plan.js',
    c => c.replace(`        if (drawRoofPlan(ctx, toS, saved, id, { ...env, siteFootprint: true })) {
          drewFootprint = true;
        }`, '        drewFootprint = true;')],
  ['the house-s own area is not shaded', 'layout-plan.js',
    c => c.replace('      bodies.forEach(body => { siteLoop(ctx, toS, insideOf(body)); ctx.fill(); });',
      '      bodies.forEach(() => {});')],
  ['the shading covers the walls as well as the rooms', 'layout-plan.js',
    c => c.replace('      const inner = geo.offsetOutline(body.points, -thick);',
      '      const inner = body.points;')],
  ['the roof plan brings its own dimensions onto the site sheet', 'layout-plan.js',
    c => c.replace('      && env.hologram !== true && env.siteFootprint !== true) {',
      '      && env.hologram !== true) {')],
  ['the lot line is not drawn at all', 'layout-plan.js',
    c => c.replace(`      siteLoop(ctx, toS, lot.points);
      ctx.stroke();`, '      siteLoop(ctx, toS, lot.points);')],

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
// A ROOF CARRIES ITS EDGES, its overhang and its pitch -- drawing-format
// writes all three on load, and drawRoof2D reads `edges` by index. A fixture
// without them is a roof no drawing has.
const ROOF = { id: 'r', levelId: 7, points: rect(-2, -2, 32, 26),
  edges: ['eave', 'eave', 'eave', 'eave'], overhang: 2, pitch: 4, fascia: 5.5,
  layer: 'A-ROOF' };
const LOT = { id: 'lot', site: true, levelId: 8, points: rect(-7, -20, 38, 100) };

const paint = saved => {
  const { ctx, strokes, fills, texts } = H.recordingCtx();
  const drew = LP.drawSitePlan(ctx, p => ({ x: p.x, y: p.z }), saved, {});
  return { drew, strokes, fills, texts };
};

const all = paint({ outlines: [LOT, GARAGE, UPPER], roofs: [ROOF] });
const noHouse = paint({ outlines: [LOT], roofs: [] });
const noLot = paint({ outlines: [GARAGE], roofs: [ROOF] });

check('a site with a lot and a building draws both', all.drew === true,
  `drawSitePlan answered ${all.drew}`);
check('and a drawing with neither draws nothing',
  paint({ outlines: [], roofs: [] }).drew === false, 'it drew something from nothing');

// THE LOT LINE IS A STROKE OF ITS OWN, over everything else: it is the
// boundary the whole sheet is about.
//
// COUNTED BY WEIGHT SINCE 14 OCT, not by the total. This read "one more
// stroke with the lot than without", which was the same sentence while the
// line was all the lot brought -- and then the lot started bringing its two
// dimension rows as well (Movie: "the dimensions which i will also add to the
// outside of the site lines"), and a true claim went red on an arithmetic
// that had stopped expressing it. The property line is the only thing on this
// sheet drawn at its own weight, which is what made it findable.
const heavyOf = painted => painted.strokes.filter(stroke => stroke.w >= 3);
check('the lot line is a stroke of its own',
  heavyOf(all).length - heavyOf(noLot).length === 1,
  `${heavyOf(all).length} heavy strokes with the lot, ${heavyOf(noLot).length} without`);
// AND IT BRINGS ITS DIMENSION ROWS WITH IT: the house's position against the
// two lot lines, and the lot end to end, both ways round. Counted off the
// module rather than typed here -- what the painter must not do is answer
// with rows and draw none of them.
const rows = LP.siteDimStrings({ outlines: [LOT, GARAGE, UPPER], roofs: [ROOF] });
check('and the lot brings its dimension rows with it',
  rows.length > 0 && all.strokes.length - noLot.strokes.length > rows.length,
  `${rows.length} rows, ${all.strokes.length - noLot.strokes.length} strokes added`);
check('the rows read the house and the lot, inner and outer',
  rows.some(row => row.row === 'inner') && rows.filter(row => row.row === 'outer').length === 2,
  JSON.stringify(rows.map(row => `${row.row}:${row.axis}`)));
// AND A DRAWING WITH NO ROOF STILL GETS A FOOTPRINT -- a drafter who has
// traced his walls and not yet pressed the bone has a building to place, and
// an empty square on the site sheet would say he has not.
check('a building with no roof yet is still drawn',
  noHouse.fills.length < paint({ outlines: [LOT, GARAGE], roofs: [] }).fills.length,
  'an outline with no roof drew no footprint at all');

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

// ── THE FOOTPRINT IS THE ROOF PLAN (Movie, 14 Oct) ────────────────────────
//
// "for the FOOTPRINT on the site plan the ROOF PLAN with the WALL OUTLINES
// would be a good drawing to use ... (but the dimensioning will be different
// on the site plan".
//
// So the roof costs a great deal more ink than the dashed eave line this used
// to draw -- planes, ridges, hips, and the wall tops under them. Measured as
// a difference against the same drawing with the roof taken away, because the
// NUMBER of strokes a roof plan makes is the roof painter's business and not
// this harness's to pin.
const roofed = paint({ outlines: [LOT, GARAGE], roofs: [ROOF], walls: [], levels: [] });
const roofless = paint({ outlines: [LOT, GARAGE], roofs: [], walls: [], levels: [] });
check('a drawing with a roof draws the roof plan as its footprint',
  roofed.strokes.length > roofless.strokes.length + 2,
  `${roofed.strokes.length} strokes with the roof, ${roofless.strokes.length} without`);

// AND NO DIMENSIONS COME WITH IT: "the dimensioning will be different on the
// site plan", so the roof plan's own strings stay on the roof sheet. A
// dimension draws text, which is the cheapest thing to count.
const DIMS = { outlines: [LOT, GARAGE], roofs: [ROOF], walls: [], levels: [],
  dimensions: [{ id: 'd1', levelId: 7, start: { x: 0, z: -4 }, end: { x: 30, z: -4 } }] };
check('and the roof plan-s own dimensions do not come with it',
  paint(DIMS).texts.length === roofed.texts.length,
  `${paint(DIMS).texts.length} texts with a dimension on the roof level, ${roofed.texts.length} without`);

// THE AREA INSIDE THE WALLS IS SHADED (Movie: "perrhaps the FOOTPRINT area of
// the house could be darker shading too (everything withing interior walls").
// One fill per building, and it is INSIDE the outline -- the outline is the
// exterior face, so a shading that matched it exactly would be covering the
// walls as well as the room.
const shaded = roofed.fills.filter(f => f.ink === 'rgba(29,31,32,0.22)');
check('the house-s own area is shaded, once per building', shaded.length === 1,
  `${shaded.length} shading fills`);
check('and the shading sits inside the outline, not on it',
  shaded.length === 1 && Math.min(...shaded[0].pts.map(p => p.x)) > 0 + 1e-6
    && Math.max(...shaded[0].pts.map(p => p.x)) < 30 - 1e-6,
  shaded.length === 1 ? JSON.stringify(shaded[0].pts.map(p => [p.x, p.y])) : 'no shading');

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
