#!/usr/bin/env node
// WHAT EACH ROOF STANDS ON, FOR THE ROOF PLAN (geometry-2d roofBearing).
//
// Movie, 5 Oct, on the ROOF PLAN: "show the tops of the walls that the roofs
// are sitting on (should be 5.5" walls on both levels)" -- the exterior walls
// of the main floor under the main roof and of the 2nd floor under its own
// roof -- and the main roof stops at the OUTSIDE face of the 2nd floor walls.
//
//   node proto/roof-bearing-harness.js
const fs = require('fs');
const path = require('path');
require('./harness-args.js').noFlags();
const H = require('./harness-env.js');
const ROOT = path.join(__dirname, '..');
const G = H.loadDraftModules().DraftGeometry2D;

let passed = 0;
const failures = [];
const check = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { passed += 1; return; }
  failures.push(`${name}\n      got ${g}, want ${w}`);
};
const load = f => { const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'proto', f), 'utf8')); return d.drawing || d; };
const bear = d => G.roofBearing({ roofs: d.roofs, walls: d.walls, outlines: d.outlines, levels: d.levels });
const ids = list => list.map(w => w.id).sort();

// Movie's own MOD BILEVEL: the main roof on MAIN FL's five house walls, the
// room's roof on the room's six -- not the garage's, not the cavity walls.
{
  const d = load('repro-movie-modbilevel-e3-peak.draft');
  const [main, room] = ['roof-67', 'roof-74'].map(id => bear(d).find(b => b.roof.id === id));
  check('MOD BILEVEL: the main roof stands on MAIN FL', main.levelId, 3);
  check('on its exterior house walls, no garage wall among them',
    ids(main.walls), ids(d.walls.filter(w => w.levelId === 3 && w.body !== 'garage')));
  check('the room\'s roof stands on OVER GARAGE', room.levelId, 4);
  check('on the room\'s own walls, not the cavity walls hung under it',
    room.walls.every(w => !(w.baseHeight > 0)) && room.walls.length, 6);
  check('the main roof stops at the room\'s outline (its outside face)',
    main.exclude.map(loop => loop.length), [6]);
  check('and the room\'s roof is stopped by nothing', room.exclude.length, 0);
  check('the garage roof gets no wall tops', bear(d).some(b => b.roof.garage), false);
}

// A 2 STOREY: one house roof, on the 2ND FL's walls, stopped by nothing.
{
  const d = load('repro-2storey-garage.draft');
  const b = bear(d);
  check('2 STOREY: one house roof', b.length, 1);
  check('standing on the 2ND FL', b[0].levelId, 5);
  check('on its four exterior walls', b[0].walls.length, 4);
  check('with nothing cut out of it', b[0].exclude.length, 0);
}

// A BILEVEL with no storey of its own: the house roof on MAIN FL.
{
  const b = bear(load('repro-bilevel-garage-e1.draft'));
  check('BILEVEL: the house roof on MAIN FL', b.map(x => [x.levelId, x.exclude.length]), [[3, 0]]);
}

// An interior wall is not a wall top on the roof plan.
{
  const sq = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }];
  const wall = (id, a, b) => ({ id, levelId: 3, start: { x: a[0], z: a[1] }, end: { x: b[0], z: b[1] } });
  const walls = [wall('n', [0, 0], [10, 0]), wall('e', [10, 0], [10, 10]), wall('s', [10, 10], [0, 10]),
    wall('w', [0, 10], [0, 0]), wall('in', [5, 0], [5, 10])];
  const b = G.roofBearing({ roofs: [{ id: 'r', points: sq }], walls,
    outlines: [{ levelId: 3, points: sq }], levels: [{ id: 7 }, { id: 3 }] });
  check('an interior wall is left out', ids(b[0].walls), ['e', 'n', 's', 'w']);
}

// ── EVERY WALL TOP A ROOF RESTS ON (geometry-2d roofPlanWalls) ────────────
//
// Movie, 7 Oct: "the corners on the house interior lines don't 'meld' ...
// also over the entry area, and over the garage they are missing -- i would
// like to show all ext walls that meet at the roof (where it is resting)".
const tops = d => G.roofPlanWalls({ walls: d.walls, outlines: d.outlines, floors: d.floors, levels: d.levels });
const key = w => [w.start, w.end].map(p => `${Math.round(p.x * 10) / 10},${Math.round(p.z * 10) / 10}`).join('>');
{
  const d = load('repro-movie-modbilevel-e3-peak.draft');
  const got = tops(d).map(key);
  check('MOD BILEVEL: the garage\'s walls past the room over it are drawn',
    ['38,-20>46,-20', '46,-20>46,4', '46,4>38,4'].every(k => got.includes(k)), true);
  check('and not the stretch the room stands over', got.some(k => k.startsWith('19,-20>46')), false);
  check('the room\'s walls round the entry notch are drawn, past its outline',
    ['20,4>6.5,4', '6.5,4>6.5,-2', '6.5,-2>14,-2', '14,-2>14,-20'].every(k => got.includes(k)), true);
  check('the entry\'s wall the room does not cover is drawn', got.includes('20,4>20,10'), true);
  check('the main wall stops where the room starts over it', got.includes('-20,-16>14,-16'), true);
  check('a wall between two of the room\'s own rooms is not', got.includes('20,4>20,-16'), false);
  check('nothing under the main floor is drawn',
    tops(d).some(w => [1, 2].includes(Number(w.levelId)) && key(w) !== '20,4>20,10'), false);
}

// ── AND THE PAINTER JOINS THEM ──────────────────────────────────────────────
const R = (() => {
  const sandbox = { window: {} };
  require('vm').runInNewContext(fs.readFileSync(path.join(ROOT, 'render-2d.js'), 'utf8'), sandbox,
    { filename: 'render-2d.js' });
  return sandbox.window.DraftRender2D;
})();
const faceSegs = walls => {
  const { ctx, strokes } = H.recordingCtx();
  R.drawWallTops2D(ctx, p => ({ x: p.x, y: p.z }), walls, { thicknessFt: () => 0.5 },
    { wallFaceOffsets: G.wallFaceOffsets });
  const segs = [];
  strokes.forEach(s => { for (let i = 0; i + 1 < s.pts.length; i += 2) segs.push([s.pts[i], s.pts[i + 1]]); });
  return segs.map(([a, b]) => [a, b].map(p => `${Math.round(p.x * 100) / 100},${Math.round(p.y * 100) / 100}`).sort().join('|'));
};
{
  const w = (a, b) => ({ levelId: 3, start: { x: a[0], z: a[1] }, end: { x: b[0], z: b[1] } });
  // An L: both faces of each wall run into the other's, corner to corner.
  const L = faceSegs([w([0, 0], [10, 0]), w([10, 0], [10, 10])]);
  const ends = new Set(L.flatMap(s => s.split('|')));
  check('an L corner: the four face lines meet in two points, not four loose ends',
    L.length === 4 && [...ends].filter(p => L.filter(s => s.split('|').includes(p)).length === 2).length, 2);
  // A tee: the through-wall runs on straight, the stem stops on its face.
  const T = faceSegs([w([0, 0], [10, 0]), w([10, 0], [20, 0]), w([10, 0], [10, 10])]);
  const stemEnds = T.filter(s => s.split('|').every(p => Number(p.split(',')[0]) >= 9 && Number(p.split(',')[0]) <= 11.5));
  check('a tee: the stem\'s two faces stop on the through-wall\'s face',
    stemEnds.length === 2 && new Set(stemEnds.map(s => s.split('|')
      .map(p => Number(p.split(',')[1])).sort((a, b) => a - b)[0])).size, 1);
}

console.log(`roof-bearing harness: ${passed} checks passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach(line => console.log(`  ✘ ${line}`));
  process.exit(1);
}
