#!/usr/bin/env node
// A PILE OUT IN THE OPEN CARRIES A POST UP TO WHAT IT HOLDS.
//
// Movie, 4 Oct, on EXT FINISH after pulling a roof out in BONEYARD: "a pile
// was added under the roof i extended but no POST/ Column going from the pile
// to the roof". Then: "6x6 (5.5\" x 5.5\")", "make the top of pile / bottom
// of column level with the top of concrete", and "when piles are generated
// also add a column to the bottom of whatever is being supported please".
//
// cut-view.js's pilePosts answers which piles carry a post and from where to
// where; the elevation paints it. The fixture is proto/repro-washroom-
// bungalow.draft with its front roof edge pulled 6 ft further out and piles
// placed under it the way the overhang ladder does -- built here rather than
// stored, so the drawing it starts from stays the one other harnesses read.
//
//   node proto/pile-post-harness.js
//   node proto/pile-post-harness.js --mutate    break it, prove each break is caught
const fs = require('fs');
const path = require('path');

const MUTATE = require('./harness-args.js').mutationMode();
const ROOT = path.join(__dirname, '..');

const MUTATIONS = [
  // The foot is the top of the CONCRETE: the bearing line less its plate.
  ['the post starts on the sill line, not the concrete', 'cut-view.js',
    c => c.replace('const foot = stack.foundation.wallTop - houseSillPlateFt();',
      'const foot = stack.foundation.wallTop;')],
  // A pile inside the foundation stands under the slab, not out in the open.
  ['a pile inside the foundation gets a post', 'cut-view.js',
    c => c.replace('if (concrete.some(f => over(p, f.points))) return null;', '')],
  // Tour-placed piles are the garage's grade beam piles.
  ['an auto pile gets a post', 'cut-view.js',
    c => c.replace("c.point && c.auto !== true\n", 'c.point\n')],
  // THE LOWEST thing over it is what the post holds.
  ['the post runs to the highest thing over it, not the lowest', 'cut-view.js',
    c => c.replace('(c.top < low.top ? c : low)', '(c.top > low.top ? c : low)')],
  // A roof is something a post carries.
  ['a roof is not carried', 'cut-view.js',
    c => c.replace('...roofs.filter(r => over(p, r.points))', '...roofs.filter(r => false && over(p, r.points))')],
  // A post is 5 1/2" wide.
  ['the post is drawn a full 6"', 'cut-view.js',
    c => c.replace('const POST_SIZE_IN = 5.5;', 'const POST_SIZE_IN = 6;')],
  // Painted after the walls, so a wall face does not cover it.
  ['the elevation draws no post', 'cut-view.js',
    c => c.replace('      box(u - half, u + half, post.foot, post.top, C.face);\n', '')],
  // Hidden behind the house the way a pile is.
  ['a post behind the house is drawn', 'cut-view.js',
    c => c.replace('if (fdnGeoms.some(g => g.depth > depth + 1 && u > g.lo + 0.05 && u < g.hi - 0.05)) return;', '')],
  // And the bare pile is not drawn a second time under its post.
  ['a post pile is drawn again as a bare pile', 'cut-view.js',
    c => c.replace('      if (postOf.has(column)) return;\n', '')],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('pile-post',
    MUTATIONS, { root: ROOT, harness: __filename });
  process.exit(all ? 0 : 1);
}

const { loadDraftModules, buildEnv, standardElevationCuts, paintElevation } = require('./harness-env.js');
const win = loadDraftModules();
const CV = win.DraftCutView;

let failed = 0, ran = 0;
const check = (label, ok, detail = '') => {
  ran += 1;
  if (ok) return;
  failed += 1;
  console.log(`  FAIL ${label}${detail ? `\n       ${detail}` : ''}`);
};

// ── THE FIXTURE ──────────────────────────────────────────────────────────
//
// The bungalow's floor runs z -15.20..6.71 and its roof (eave) to 8.71. The
// front, +z, is what E1 looks at. The roof's front edge goes out to 14.71 --
// a 6 ft push -- and a row of piles stands 4'-6" and 8 ft out from the wall
// line, as the ladder puts them. One pile inside the house, one auto pile
// and one out past every roof stand beside them as the cases with no post.
const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'proto', 'repro-washroom-bungalow.draft'), 'utf8'));
const saved = base.drawing || base;
const d = JSON.parse(JSON.stringify(saved));
const roof = d.roofs.find(r => !r.garage);
const front = Math.max(...roof.points.map(p => p.z));
roof.points.forEach(p => { if (Math.abs(p.z - front) < 1e-6) p.z = front + 6; });
const wallZ = Math.max(...d.floors.find(f => f.view === 'foundation').points.map(p => p.z));
let id = 900;
const pile = (x, z, extra = {}) => ({ id: id++, point: { x, y: 0, z }, levelId: 1, view: 'foundation',
  footing: 'pile10', pileMark: 'P1', ...extra });
const xs = [-21.46875, -13, -5, 3.3072916666666665];
d.columns = [...(d.columns || []),
  ...xs.map(x => pile(x, wallZ + 4.5)),
  pile(-10, 0),                                // inside the house
  pile(-9, wallZ + 4.5, { auto: true }),        // a tour pile
  pile(30, 30),                                // under nothing at all
];

const env = buildEnv(win, d);
const stack = CV.sectionLevelStack(env);
const fdn = stack.foundation;
const concreteTop = fdn.wallTop - 1.5 / 12;
const roofBase = CV.roofBaseElev(env.roofs().find(r => !r.garage), stack, env);

// ── WHICH PILES CARRY A POST ─────────────────────────────────────────────
{
  const posts = CV.pilePosts(env, stack);
  check('the four piles under the pushed roof each carry a post', posts.length === 4,
    `${posts.length} post(s): ${JSON.stringify(posts.map(p => [p.point.x, p.point.z]))}`);
  check('every post is 5 1/2" square', posts.every(p => p.sizeIn === 5.5));
  check('every post starts at the top of the concrete, the sill plate under the bearing line',
    posts.every(p => Math.abs(p.foot - concreteTop) < 1e-9),
    `foot ${posts[0] && posts[0].foot} want ${concreteTop}`);
  check('and runs up to the roof\'s bearing line',
    posts.every(p => Math.abs(p.top - roofBase) < 1e-9 && p.carries === 'roof'),
    `top ${posts[0] && posts[0].top} want ${roofBase}`);
  check('the pile inside the house carries none', !posts.some(p => p.point.z === 0));
  check('nor the tour\'s own pile', !posts.some(p => p.column.auto === true));
  check('nor one under nothing at all', !posts.some(p => p.point.x === 30));
}

// ── A FLOOR OVERHANG: THE POST STOPS UNDER THE FLOOR ─────────────────────
//
// The same piles under a MAIN FL pushed out over them instead: the floor is
// lower than the roof, so the post holds the floor's underside.
{
  const f = JSON.parse(JSON.stringify(d));
  f.floors.filter(fl => fl.view !== 'foundation' && Number(fl.levelId) === 3).forEach(fl =>
    fl.points.forEach(p => { if (Math.abs(p.z - wallZ) < 1e-6) p.z = wallZ + 6; }));
  const fEnv = buildEnv(win, f);
  const fStack = CV.sectionLevelStack(fEnv);
  const main = fStack.floors.find(l => Number(l.id) === 3);
  const posts = CV.pilePosts(fEnv, fStack);
  check('under a floor pushed out, the post holds the floor\'s underside',
    posts.length === 4 && posts.every(p => Math.abs(p.top - main.floorBottom) < 1e-9 && p.carries === 'floor'),
    JSON.stringify(posts.map(p => [p.top, p.carries])) + ` want ${main.floorBottom}`);
}

// ── ON E1: THE POST IS ON THE SHEET ──────────────────────────────────────
{
  const cuts = standardElevationCuts(env);
  const e1 = cuts.find(c => c.id === 'E1');
  const painted = paintElevation(win, env, e1, { pxPerFt: 40 });
  const axis = painted.axis;
  const inside = (pts, u, e) => {
    let hit = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i], b = pts[j];
      if ((a.e > e) !== (b.e > e) && u < (b.u - a.u) * (e - a.e) / (b.e - a.e) + a.u) hit = !hit;
    }
    return hit;
  };
  // A post's fill: four corners, 5 1/2" wide, from the concrete to the roof.
  const half = 5.5 / 24, px = 1 / 40;
  const postFills = (painted.modelFills || []).filter(fl => {
    const us = fl.pts.map(p => p.u), es = fl.pts.map(p => p.e);
    return fl.pts.length === 4
      && Math.abs((Math.max(...us) - Math.min(...us)) - 2 * half) < 2 * px
      && Math.abs(Math.min(...es) - concreteTop) < 2 * px
      && Math.abs(Math.max(...es) - roofBase) < 2 * px;
  });
  check('E1 draws four posts', postFills.length === 4, `${postFills.length} drawn`);
  // Seen: nothing painted later covers the post's middle.
  const covered = postFills.filter(fl => {
    const u = fl.pts.reduce((a, p) => a + p.u, 0) / 4;
    const e = (concreteTop + roofBase) / 2;
    return (painted.modelFills || []).some(o => o.seq > fl.seq && inside(o.pts, u, e));
  });
  check('and none of them is painted over by the walls or the roof', covered.length === 0,
    `${covered.length} covered`);
  // A bare pile is a pair of dashed shafts starting under concrete; the
  // posts' piles are drawn with them, so the station of each post carries
  // exactly two shafts and not four.
  xs.forEach(x => {
    const u = x * axis.x + (wallZ + 4.5) * axis.z;
    const shafts = (painted.strokes || []).filter(st => st.pts.length === 2
      && st.pts.every(p => Math.abs(p.u - u) < 0.6) && Math.abs(st.pts[0].u - st.pts[1].u) < 1e-6
      && Math.min(st.pts[0].e, st.pts[1].e) < fdn.footingBottom);
    check(`the pile under the post at x ${x.toFixed(1)} is drawn once`, shafts.length === 2,
      `${shafts.length} shaft line(s)`);
  });

  // E3 looks at the back: every post stands behind the house there.
  const e3 = cuts.find(c => c.id === 'E3');
  const back = paintElevation(win, env, e3, { pxPerFt: 40 });
  const backPosts = (back.modelFills || []).filter(fl => {
    const us = fl.pts.map(p => p.u), es = fl.pts.map(p => p.e);
    return fl.pts.length === 4 && Math.abs((Math.max(...us) - Math.min(...us)) - 2 * half) < 2 * px
      && Math.abs(Math.min(...es) - concreteTop) < 2 * px;
  });
  // The two at the house's corners stand flush with its side walls and are
  // not behind them; the two between are.
  const mids = [-13, -5].map(x => x * back.axis.x + (wallZ + 4.5) * back.axis.z);
  const midU = fl => fl.pts.reduce((a, p) => a + p.u, 0) / 4;
  check('from the back, the posts behind the house are not drawn',
    !backPosts.some(fl => mids.some(u => Math.abs(midU(fl) - u) < 0.1)),
    `${backPosts.length} post(s) drawn`);
  check('and the two flush with its side walls still are', backPosts.length === 2,
    `${backPosts.length} post(s) drawn`);
}

console.log(`\npile posts: ${ran} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
