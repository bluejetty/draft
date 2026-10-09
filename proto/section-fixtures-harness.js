#!/usr/bin/env node
// A SECTION LOOKING INTO A BATHROOM DRAWS ITS FIXTURES.
//
// Movie, 9 Oct: the WC items redrawn in plan "and in elevations/sections"
// ("yes redraw all"), from the five interior sections WC_PLAN_2..6. cut-view's
// drawSectionFixtures stands each fixture beyond the cut in Movie's own
// elevation (fixture-profiles.js): its FRONT when it faces the cut, its SIDE
// when it is turned a quarter -- the wall it backs onto on the side it is --
// nothing when it faces away or a wall stands between it and the cut. The
// farthest goes down first, and each one's silhouette hides what is behind.
//
// EVERY COUNT IS A DIFFERENCE against the same section with no fixtures, so
// nothing else the section draws can make a check pass.
//
// Run: node proto/section-fixtures-harness.js
//      node proto/section-fixtures-harness.js --mutate
const MUTATE = require('./harness-args.js').mutationMode();
const fs = require('fs');
const path = require('path');
const H = require('./harness-env.js');
const ROOT = path.join(__dirname, '..');

const MUTATIONS = [
  ['the section never draws its fixtures', 'cut-view.js',
    c => c.replace('    drawSectionFixtures(env, ctx, cut, axis, stack, X, Y, pxPerFt, C);\n', '')],
  ['a wall between the fixture and the cut hides nothing', 'cut-view.js',
    c => c.replace('      if (sightBlocked(geo.center, depth, dir, levelWalls)) return;\n', '')],
  ['a fixture facing the cut is drawn side-on', 'cut-view.js',
    c => c.replace("return Math.abs(facing) >= FIXTURE_FRONT_COS ? 'front' : 'side';", "return 'side';")],
  ['a fixture on the viewer\'s side of the cut is drawn', 'cut-view.js',
    c => c.replace('}).filter(p => p && p.depth > 0).sort(', '}).filter(p => p).sort(')],
  ['a vanity is drawn its traced width, not its run', 'cut-view.js',
    c => c.replace('const k = stretch ? bayIn / profile.w : 1;', 'const k = 1;')],
  ['a side view never mirrors', 'cut-view.js',
    c => c.replace('const sign = out.x * axis.x + out.z * axis.z >= 0 ? 1 : -1;', 'const sign = 1;')],
  ['the nearest fixture goes down first', 'cut-view.js',
    c => c.replace('.sort((p, q) => q.depth - p.depth);', '.sort((p, q) => p.depth - q.depth);')],
  ['a fixture hides nothing behind it', 'cut-view.js',
    c => c.replace('        trace(profile.sil || []); ctx.fill();\n', '')],
  ['a cabinet run is one stretched door base', 'cut-view.js',
    c => c.replace('const n = tile ? Math.max(1, Math.round(runIn / tile)) : 1;', 'const n = 1;')],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('section-fixtures',
    MUTATIONS, { root: ROOT, harness: __filename });
  process.exit(all ? 0 : 1);
}

const win = H.loadDraftModules();
const CV = win.DraftCutView;
const PX = 40;

// THE PERF BUNGALOW'S OWN DEALT WASHROOM: a 2x6 wet wall (wall-40) along
// z = -31.2 with 2x4s closing the other three sides (41, 42 the door wall,
// 43), the room on +z. Its fixtures are this file's, placed the way LAYOUT's
// washroom spec places them: vanity and toilet on the wet wall, the alcove
// tub on wall-41 with its faucet end at the wet wall.
const SAVED = JSON.parse(fs.readFileSync(path.join(__dirname, 'perf-bungalow.draft'), 'utf8'));
const O = { x: -33.7, z: -31.2 };
const WID = 6.2;
const P = (x, z) => ({ x: O.x + x, z: O.z + z });
const fixture = (id, wallId, kind, offset, width, depth, more = {}) => ({
  id, wallId, levelId: 3, view: 'plan', kind, layer: 'A-FIXT', offset, width, depth, side: 1, ...more,
});
const FIXTURES = [
  fixture('van', 'wall-40', 'vanity', 1.5, 2.5, 2),
  fixture('wc', 'wall-40', 'toilet', 4.25, 5 / 3, 7 / 3),
  fixture('tub', 'wall-41', 'tub', 0.5, 5, 2.5, { endWallId: 'wall-40', dir: 1 }),
];
const BATH = { ...SAVED, fixtures: FIXTURES };
const cut = (startPt, endPt, dirVec) => ({ id: 9, name: 'S9', startPt, endPt, dirVec, levelId: 3 });
// Looking at the wet wall from inside the room, and the same line turned round.
const FACING = cut(P(-0.3, WID - 0.5), P(9.6, WID - 0.5), { x: 0, z: 1 });
const AWAY = cut(P(-0.3, WID - 0.5), P(9.6, WID - 0.5), { x: 0, z: -1 });
// From the hall, through the door wall: the room is behind wall-42. The line
// runs wall to wall of the house, so it still crosses walls with 42 gone.
const HALL = cut({ x: -36, z: O.z + WID + 3 }, { x: 3, z: O.z + WID + 3 }, { x: 0, z: 1 });
// Along the room from the wall-43 end: vanity, toilet and the tub's apron.
const ALONG = cut(P(0.6, -2.5), P(0.6, WID + 3), { x: -1, z: 0 });

function paint(saved, c) {
  const env = H.buildEnv(win, saved);
  const extents = CV.cutViewExtents(env, c);
  const { ctx, strokes, fills } = H.recordingCtx();
  CV.drawCutView(env, ctx, 2000, 1200, c, { pxPerFt: PX, extents });
  return { strokes, fills };
}
const key = s => JSON.stringify(s.pts);
// The strokes and fills a drawing has that the same drawing with no fixtures
// does not: the fixtures, and nothing else.
function extra(saved, c) {
  const p = paint(saved, c), bare = paint({ ...saved, fixtures: [] }, c);
  const seen = new Map();
  bare.strokes.forEach(s => seen.set(key(s), (seen.get(key(s)) || 0) + 1));
  const strokes = p.strokes.filter(s => {
    const n = seen.get(key(s)) || 0;
    if (n) { seen.set(key(s), n - 1); return false; }
    return true;
  });
  const fills = p.fills.filter(f => f.pts && f.seq > Math.min(...strokes.map(s => s.seq).concat([Infinity])) - 50
    && !bare.fills.some(b => b.pts && key(b) === key(f)));
  return { strokes, fills };
}
// Inches across and up a stroke's whole extent.
const span = s => {
  const xs = s.pts.map(pt => pt.x), ys = s.pts.map(pt => pt.y);
  return [Math.round(((Math.max(...xs) - Math.min(...xs)) / PX) * 12),
    Math.round(((Math.max(...ys) - Math.min(...ys)) / PX) * 12)];
};

let failed = 0, ran = 0;
const check = (label, got, want) => {
  ran += 1;
  if (String(got) === String(want)) return;
  failed += 1;
  console.log(`  FAIL ${label}\n       got  ${got}\n       want ${want}`);
};

// ── FACING THE WET WALL ────────────────────────────────────────────────────
{
  const { strokes } = extra(BATH, FACING);
  check('all three fixtures are drawn', strokes.length, 3);
  const spans = strokes.map(span).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  // The toilet bowl-on, 18" and 28"; the tub end-on, cut to its 30" depth and
  // 20" high; the vanity's doors, stretched to its 30" run, 46" to the faucet.
  check('toilet front, tub end, vanity front', JSON.stringify(spans),
    JSON.stringify([[18, 28], [30, 20], [30, 46]]));
}

// ── TURNED ROUND, AND FROM THE HALL ────────────────────────────────────────
check('looking the other way, every fixture is behind the viewer',
  extra(BATH, AWAY).strokes.length, 0);
check('and from the hall, the door wall hides them all', extra(BATH, HALL).strokes.length, 0);
// From the far side of the wet wall the vanity and toilet face away: their
// own wall hides them.
const BEHIND = cut({ x: -36, z: O.z - 2 }, { x: 3, z: O.z - 2 }, { x: 0, z: -1 });
check('and from behind the wet wall, the pieces on it face away and are hidden',
  extra({ ...BATH, fixtures: FIXTURES.filter(f => f.wallId === 'wall-40') }, BEHIND).strokes.length, 0);
check('but with no door wall the hall sees them',
  extra({ ...BATH, walls: BATH.walls.filter(w => w.id !== 'wall-42') }, HALL).strokes.length, 3);

// ── ALONG THE ROOM: side-on, farthest first ────────────────────────────────
{
  const { strokes, fills } = extra(BATH, ALONG);
  // The tub's apron stretched to its alcove (5'-6" here), the toilet 26"
  // tank to bowl, the vanity its 24" depth.
  check('the vanity and toilet side-on, the tub\'s apron', JSON.stringify(strokes.map(span)),
    JSON.stringify([[66, 20], [26, 28], [24, 46]]));
  const sils = fills.slice().sort((a, b) => a.seq - b.seq);
  check('each one\'s silhouette goes down before its lines',
    sils.length === 3 && sils.every((f, i) => f.seq < strokes[i].seq), true);
  // The faucet stands at the wall end of a vanity seen side-on. Move the
  // vanity to the door wall and it must turn round with it.
  const faucetEnd = saved => {
    const s = extra(saved, ALONG).strokes.find(st => span(st)[1] === 46);
    const top = s.pts.reduce((a, b) => (b.y < a.y ? b : a));
    const xs = s.pts.map(pt => pt.x);
    return top.x < (Math.min(...xs) + Math.max(...xs)) / 2 ? 'low' : 'high';
  };
  const turned = {
    ...BATH,
    fixtures: [fixture('van', 'wall-42', 'vanity', 9.4 - 1.5, 2.5, 2)],
  };
  check('a vanity on the far wall shows its faucet at the other end',
    faucetEnd(BATH) !== faucetEnd(turned), true);
}

// ── A KITCHEN WALL ─────────────────────────────────────────────────────────
// Movie's kitchen pieces (KITCHENITEMS1/2.DXF) on the same wet wall: a 6'-0"
// CABINET run is three 24" door bases side by side, not one stretched door;
// the fridge stands 66" (Movie: "go 66"").
{
  const KITCHEN = { ...BATH, fixtures: [
    fixture('run', 'wall-40', 'cabinet', 3, 6, 2),
    fixture('ref', 'wall-40', 'fridge', 7.6, 3, 2.5),
  ] };
  const spans = extra(KITCHEN, FACING).strokes.map(span).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  check('a 6\' run is three 24" bays 35 1/2" high, the fridge 36" x 66"', JSON.stringify(spans),
    JSON.stringify([[24, 35], [24, 35], [24, 35], [36, 66]]));
}

console.log(`\n${ran - failed}/${ran} checks passed`);
if (failed) process.exitCode = 1;
