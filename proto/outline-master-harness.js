// outline-master.js — the persisted shape of a house outline: one master on a
// BONEYARD shelf, one copy per level pointing back at it.
//
// WHY THIS MODULE EXISTS AND WHY IT IS CHECKED HERE. MODEL.dc.html has derived
// this shape since outlines existed. MODEL.html now has to WRITE it too, and
// the order for that rung is explicit: "No second copy of the format
// arithmetic ... a drifted twin is how #401 lost a shard." So the shape moved
// into a module both pages call, and this harness is what stops the module
// from drifting away from the page it was lifted out of.
//
// WHAT WOULD GO WRONG SILENTLY, which is what most of these checks are aimed
// at. The master/copy link is carried by two ids -- `masterId` on the copy and
// `srcId` on each copy point -- and an outline with neither renders EXACTLY
// like one with both. Nothing looks wrong until a drafter drags a master
// corner and the other floors do not follow, by which time the drawing has
// been saved. Every check below that asserts an id is guarding that.
//
// Run: node proto/outline-master-harness.js          (checks)
//      node proto/outline-master-harness.js --mutate (checks + mutation table)
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'outline-master.js');
const MUTATION_MODE = require('./harness-args.js').mutationMode();

function load(mutate) {
  let src = fs.readFileSync(SRC, 'utf8');
  if (mutate) {
    const next = mutate(src);
    if (next === src) throw new Error('mutation matched nothing -- it would prove nothing');
    src = next;
  }
  const window = {};
  new Function('window', src)(window);
  return window.DraftOutlineMaster;
}

// A counter per run, so a check that asserts an id is asserting the sequence
// the page would have produced rather than a number this file chose.
const mint = () => { let n = 0; return { item: () => `i${++n}`, point: () => `p${++n}` }; };

const SQUARE = [{ x: 0, z: 0 }, { x: 30, z: 0 }, { x: 30, z: 24 }, { x: 0, z: 24 }];
const LEVELS = [{ id: 3, name: 'MAIN FL', elev: 0 }, { id: 4, name: '2ND FL', elev: 9.5 }];

const makeMaster = (G, over = {}) => {
  const ids = mint();
  return G.masterFromLoop({
    points: SQUARE, shelfId: 1, sourceLevelId: 3,
    newItemId: ids.item, newPointId: ids.point, ...over,
  });
};

const CHECKS = [];
const check = (label, fn) => CHECKS.push({ label, fn });

// ── the master ──
check('a master carries the shelf it was drawn on',
  G => [makeMaster(G).shelfId, 1]);

check('and the level it was drawn from, so the boneyard knows where it came from',
  G => [makeMaster(G).sourceLevelId, 3]);

check('a drawn master is never a garage -- that is a separate gesture',
  G => [makeMaster(G).garage, false]);

check('a master starts with no marks rather than without the key',
  G => [JSON.stringify(makeMaster(G).marks), '[]']);

check('every master point gets its own id',
  G => { const m = makeMaster(G);
         return [new Set(m.points.map(p => p.pointId)).size, 4]; });

// The master is the COMMON plan geometry: it has no elevation of its own,
// because the height belongs to whichever level is reading it.
check('a master point is plan only -- x and z and an id, no y',
  G => [Object.keys(makeMaster(G).points[0]).sort().join(','), 'pointId,x,z']);

// Two corners enclose no floor. Refusing loudly beats storing a degenerate
// master that every level then copies.
check('a loop of two corners is refused',
  G => { try { makeMaster(G, { points: [{ x: 0, z: 0 }, { x: 1, z: 1 }] }); return ['accepted', 'refused']; }
         catch { return ['refused', 'refused']; } });

// The page owns its id counter. A module minting its own would hand back ids
// the page believes are still free.
check('minting is the page-s job, and its absence is refused',
  G => { try { G.masterFromLoop({ points: SQUARE, shelfId: 1 }); return ['accepted', 'refused']; }
         catch { return ['refused', 'refused']; } });

// ── the copy ──
check('a copy names the master it belongs to',
  G => { const m = makeMaster(G);
         return [G.copyForLevel(m, LEVELS[0], { newItemId: mint().item }).masterId, m.id]; });

check('and the level it sits on',
  G => { const m = makeMaster(G);
         return [G.copyForLevel(m, LEVELS[1], { newItemId: mint().item }).levelId, 4]; });

// THE LINK, corner by corner. This is the check that would have caught a copy
// built by reading the wrong spelling of the master point id.
check('every copy point links back to the master point it came from',
  G => { const m = makeMaster(G);
         const copy = G.copyForLevel(m, LEVELS[0], { newItemId: mint().item });
         return [copy.points.map(p => p.srcId).join(','),
                 m.points.map(p => p.pointId).join(',')]; });

// The copy is drawn at ITS level's height, which is the whole reason a copy
// exists rather than every floor sharing the master.
check('a copy sits at its own level-s elevation',
  G => { const m = makeMaster(G);
         return [G.copyForLevel(m, LEVELS[1], { newItemId: mint().item }).points[0].y, 9.5]; });

check('a level with no elevation reads as grade, not NaN',
  G => { const m = makeMaster(G);
         return [G.copyForLevel(m, { id: 9 }, { newItemId: mint().item }).points[0].y, 0]; });

check('a copy is drawn on the outline layer',
  G => { const m = makeMaster(G);
         return [G.copyForLevel(m, LEVELS[0], { newItemId: mint().item }).layer, 'OUTLINE']; });

check('a fresh copy has overridden nothing',
  G => { const m = makeMaster(G);
         return [JSON.stringify(G.copyForLevel(m, LEVELS[0], { newItemId: mint().item }).overriddenSrcIds), '[]']; });

// A garage master's copy is a garage. The flags describe the same outline seen
// from another floor, so they travel rather than defaulting.
check('the master-s flags travel to its copy',
  G => { const m = { ...makeMaster(G), garage: true, open: true, detached: true, foundation: 'FROST' };
         const c = G.copyForLevel(m, LEVELS[0], { newItemId: mint().item });
         return [`${c.garage},${c.open},${c.detached},${c.foundation}`, 'true,true,true,FROST']; });

check('and a plain master-s copy is plain',
  G => { const m = makeMaster(G);
         const c = G.copyForLevel(m, LEVELS[0], { newItemId: mint().item });
         return [`${c.garage},${c.open},${c.detached},${c.foundation}`, 'false,false,false,null']; });

// The attach id rides through unresolved: which Vector3 an attached garage
// corner SHARES is a question about object identity, and only a page can
// answer it. Carrying the marker is this module's whole part in it.
check('an attach marker rides through for the page to resolve',
  G => { const m = makeMaster(G);
         m.points[0].attach = 'house-corner-7';
         return [G.copyForLevel(m, LEVELS[0], { newItemId: mint().item }).points[0].attach, 'house-corner-7']; });

check('a bulge travels, and a missing one reads as straight',
  G => { const m = makeMaster(G);
         m.points[1].bulge = 0.25;
         const c = G.copyForLevel(m, LEVELS[0], { newItemId: mint().item });
         return [`${c.points[1].bulge},${c.points[0].bulge}`, '0.25,0']; });

check('one call copies a master onto every level',
  G => { const m = makeMaster(G);
         const ids = mint();
         return [G.copiesForLevels(m, LEVELS, { newItemId: ids.item }).map(c => c.levelId).join(','), '3,4']; });

// ── THE NAME TRAP ──
//
// Storage spells a master point's id `id`; MODEL.dc.html's loader renames it
// `pointId` in memory. A copy built from a freshly parsed save reads one, a
// copy built from DC's live memory reads the other, and reading the wrong one
// yields `undefined` -- which looks like a link and is not one.
check('a master straight off disk, spelling its point id "id", still links',
  G => [G.copyForLevel({ id: 'm1', points: [{ x: 0, z: 0, id: 'stored-7' }] },
    LEVELS[0], { newItemId: mint().item }).points[0].srcId, 'stored-7']);

check('a master from live memory, spelling it "pointId", links the same way',
  G => [G.copyForLevel({ id: 'm1', points: [{ x: 0, z: 0, pointId: 'mem-7' }] },
    LEVELS[0], { newItemId: mint().item }).points[0].srcId, 'mem-7']);

// The one that matters: a point carrying NEITHER must stop the copy, not
// quietly produce srcId: undefined on every corner.
check('a master point with neither spelling is refused, loudly',
  G => { try {
           G.copyForLevel({ id: 'm1', points: [{ x: 0, z: 0 }] }, LEVELS[0], { newItemId: mint().item });
           return ['accepted', 'refused'];
         } catch { return ['refused', 'refused']; } });

check('and an id of zero is an id, not an absence',
  G => [G.copyForLevel({ id: 'm1', points: [{ x: 0, z: 0, id: 0 }] },
    LEVELS[0], { newItemId: mint().item }).points[0].srcId, 0]);

// ── MUTATIONS ──
const MUTATIONS = [
  ['a copy forgets which master it belongs to',
    s => s.replace('masterId: master.id,', 'masterId: null,')],
  ['copy points lose their link back to the master',
    s => s.replace('srcId: masterPointId(point),', 'srcId: undefined,')],
  ['the name trap bites: only the in-memory spelling is read',
    s => s.replace('point?.pointId ?? point?.id', 'point?.pointId')],
  ['and the other way round: only the stored spelling is read',
    s => s.replace('point?.pointId ?? point?.id', 'point?.id')],
  ['a missing point id passes through as undefined instead of throwing',
    s => s.replace(
      "throw new Error('outline master point has neither pointId nor id — '\n        + 'a copy built from it would carry srcId: undefined and link to nothing');",
      'return undefined;')],
  ['every copy sits at grade rather than its own level',
    s => s.replace('const elev = Number(level.elev) || 0;', 'const elev = 0;')],
  ['the outline layer is misspelt',
    s => s.replace("const OUTLINE_LAYER = 'OUTLINE';", "const OUTLINE_LAYER = 'OUTLINES';")],
  ['a fresh copy claims every point is already overridden',
    s => s.replace('overriddenSrcIds: [],', 'overriddenSrcIds: (master.points || []).map(masterPointId),')],
  ['the garage flag stops travelling to the copy',
    s => s.replace('garage: master.garage === true,', 'garage: false,')],
  ['a master is born already flagged as a garage',
    s => s.replace('garage: false,\n      marks: [],', 'garage: true,\n      marks: [],')],
  ['a master forgets the shelf it was drawn on',
    s => s.replace('shelfId,\n      sourceLevelId,', 'shelfId: null,\n      sourceLevelId,')],
  ['every master point shares one id',
    s => s.replace('pointId: newPointId()', "pointId: 'same'")],
  ['a two-corner loop is accepted',
    s => s.replace('if (loop.length < 3) {', 'if (loop.length < 0) {')],
  ['bulge is dropped on the way across',
    s => s.replace('bulge: point.bulge || 0,', 'bulge: 0,')],
  ['the attach marker is dropped, so a shared garage node cannot be resolved',
    s => s.replace('attach: point.attach || null,', 'attach: null,')],
];

// ── Run ──
function run(G) {
  const missed = [];
  for (const { label, fn } of CHECKS) {
    let got, want;
    try { [got, want] = fn(G); } catch (err) { got = `THREW: ${err.message}`; want = '(no throw)'; }
    if (String(got) !== String(want)) missed.push({ label, got, want });
  }
  return missed;
}

const baseline = run(load(null));
for (const m of baseline) console.log(`  FAIL ${m.label}\n       got ${m.got}, want ${m.want}`);
console.log(`\n${CHECKS.length - baseline.length}/${CHECKS.length} checks passed`);

if (MUTATION_MODE) {
  console.log('\n' + 'mutation'.padEnd(74) + 'caught by');
  let survivors = 0, broken = 0;
  for (const [label, mutate] of MUTATIONS) {
    let missed, by;
    try {
      missed = run(load(mutate));
      if (!missed.length) survivors += 1;
      by = missed.length ? missed.map(m => m.label).join('\n' + ' '.repeat(74)) : '*** NOTHING ***';
    } catch (err) {
      broken += 1;
      by = `!!! MUTATION DID NOT APPLY: ${err.message}`;
    }
    console.log(`${label.padEnd(74)}${by}`);
  }
  console.log(`\n${MUTATIONS.length - survivors - broken}/${MUTATIONS.length} mutations caught`);
  if (broken) console.log(`${broken} mutation(s) never applied -- they prove nothing`);
  if (!MUTATIONS.length) console.log('NO MUTATIONS DEFINED -- this table proves nothing');
  process.exit(baseline.length || survivors || broken ? 1 : 0);
}

process.exit(baseline.length ? 1 : 0);
