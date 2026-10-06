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

console.log(`roof-bearing harness: ${passed} checks passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach(line => console.log(`  ✘ ${line}`));
  process.exit(1);
}
