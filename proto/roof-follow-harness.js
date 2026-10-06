// THE ROOF TAKES THE PROJECT PAGE'S OVERHANG AND PITCH, AND FOLLOWS A CHANGE.
//
// Movie, 6 Oct: "i tried to make the 4ft overhang using the PROJECT area but
// didn't work ... after i pressed the bone it was still 2ft eave", and, of a
// house already drawn: "RESHAPE each time ... allow it to autoregenerate".
//
// level-assembly.js answers which number a roof gets (projectRoofFor), which
// PROJECT row a roof follows (roofFollows), and moves a built roof when its
// row changes (roofsFollowingProject) -- PROJECT.html calls the last inside
// writeProjectToStore, beside wallsFollowingHeights, for the same reason.
//
// Run: node proto/roof-follow-harness.js          (checks)
//      node proto/roof-follow-harness.js --mutate (checks + mutations)
const fs = require('fs');
const path = require('path');
const MUTATION_MODE = require('./harness-args.js').mutationMode();
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'level-assembly.js');

const geoWindow = {};
// eslint-disable-next-line no-new-func
new Function('window', fs.readFileSync(path.join(ROOT, 'geometry-2d.js'), 'utf8'))(geoWindow);
const OFFSET = geoWindow.DraftGeometry2D.offsetOutlineVariable;

function load(mutate) {
  let src = fs.readFileSync(SRC, 'utf8');
  if (mutate) {
    const next = mutate(src);
    if (next === src) throw new Error('mutation matched nothing -- it would prove nothing');
    src = next;
  }
  const window = {};
  // eslint-disable-next-line no-new-func
  new Function('window', src)(window);
  return window.DraftLevelAssembly;
}

const CHECKS = [];
const check = (label, fn) => CHECKS.push({ label, fn });
const r3 = n => Math.round(n * 1000) / 1000;
const box = roof => {
  const xs = roof.points.map(p => p.x), zs = roof.points.map(p => p.z);
  return [r3(Math.min(...xs)), r3(Math.max(...xs)), r3(Math.min(...zs)), r3(Math.max(...zs))].join(',');
};

// A 40 x 28 house roofed at 2 ft, and an attached garage roof whose top
// edge (index 0) is cut flush against the house.
const HOUSE_ROOF = () => ({ id: 'h', levelId: 7, garage: false, follows: 'house', overhang: 2, pitch: 4,
  edges: ['eave', 'eave', 'eave', 'eave'],
  points: [{ x: -2, z: -2 }, { x: 42, z: -2 }, { x: 42, z: 30 }, { x: -2, z: 30 }] });
const GARAGE_ROOF = () => ({ id: 'g', levelId: 7, garage: true, overhang: 2, pitch: 4,
  edges: ['gable', 'eave', 'eave', 'eave'], edgeOverhang: [0, 2, 2, 2],
  points: [{ x: -2, z: 28 }, { x: 26, z: 28 }, { x: 26, z: 54 }, { x: -2, z: 54 }] });
const HAND_ROOF = () => ({ id: 'tool', levelId: 3, overhang: 2, pitch: 4, edges: ['eave', 'eave', 'eave'],
  points: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 0, z: 10 }] });
const D = (extra = {}) => ({ roofOverhang: 2, roofPitch: 4, sectionTable: { rows: {} }, ...extra });

check('a bungalow house roof reads the drawing overhang',
  L => [L.projectRoofFor(D({ roofOverhang: 4 }), 'house').overhangFt, 4]);
check('a MOD BILEVEL house reads its own row before the drawing',
  L => [L.projectRoofFor(D({ buildType: 'modifiedBilevel',
    sectionTable: { rows: { modifiedBilevel: { roofOverhangFt: 5, roofPitch: 6 } } } }), 'house').overhangFt, 5]);
check('a bungalow ignores a split row it is not',
  L => [L.projectRoofFor(D({ buildType: 'bungalow',
    sectionTable: { rows: { modifiedBilevel: { roofOverhangFt: 5 } } } }), 'house').overhangFt, 2]);
check('the garage reads its own row, and falls back to the drawing, not the split row',
  L => [[L.projectRoofFor(D({ roofOverhang: 3, buildType: 'modifiedBilevel',
    sectionTable: { rows: { modifiedBilevel: { roofOverhangFt: 5 } } } }), 'attachedGarage').overhangFt,
  L.projectRoofFor(D({ sectionTable: { rows: { attachedGarage: { roofOverhangFt: 1 } } } }), 'attachedGarage').overhangFt].join(), '3,1']);
check('a zero typed in a row is a zero, not a fallback',
  L => [L.projectRoofFor(D({ sectionTable: { rows: { attachedGarage: { roofOverhangFt: 0 } } } }), 'attachedGarage').overhangFt, 0]);
check('an empty drawing is 2 ft at 4/12',
  L => { const r = L.projectRoofFor({}, 'house'); return [`${r.overhangFt}/${r.pitch}`, '2/4']; });

check('an unstamped build roof is read off what it is',
  L => [[{ levelId: 7 }, { levelId: 7, garage: true, edgeOverhang: [0, 2, 2] },
    { levelId: 7, garage: true, edges: ['eave', 'eave', 'eave'] }, { levelId: 3 }]
    .map(L.roofFollows).join(), 'house,attachedGarage,detachedGarage,']);

check('a house overhang of 2 -> 4 pushes every eave out 2 ft',
  L => { const out = L.roofsFollowingProject([HOUSE_ROOF()], D(), D({ roofOverhang: 4 }), OFFSET);
    return [out && `${box(out[0])}|${out[0].overhang}`, '-4,44,-4,32|4']; });
check('a flush garage edge stays on the house while its eaves move',
  L => { const out = L.roofsFollowingProject([GARAGE_ROOF()], D(), D({ roofOverhang: 4 }), OFFSET);
    return [out && `${box(out[0])}|${out[0].edgeOverhang.join()}`, '-4,28,28,56|0,4,4,4']; });
check('a pitch change alone re-pitches without moving the roof',
  L => { const out = L.roofsFollowingProject([HOUSE_ROOF()], D(), D({ roofPitch: 6 }), OFFSET);
    return [out && `${box(out[0])}|${out[0].pitch}`, '-2,42,-2,30|6']; });
check('only the row that moved moves its roofs',
  L => { const out = L.roofsFollowingProject([HOUSE_ROOF(), GARAGE_ROOF()], D(),
    D({ sectionTable: { rows: { attachedGarage: { roofOverhangFt: 3 } } } }), OFFSET);
    return [out && `${box(out[0])}|${box(out[1])}`, '-2,42,-2,30|-3,27,28,55']; });
// A ROW NOBODY TOUCHED MOVES NOTHING, even when its roof disagrees with it --
// a roof built before the build read PROJECT stays as drawn until its own
// number is changed.
check('a garage change leaves a house roof alone that disagrees with its own row',
  L => { const out = L.roofsFollowingProject([HOUSE_ROOF(), GARAGE_ROOF()], D({ roofOverhang: 5 }),
    D({ roofOverhang: 5, sectionTable: { rows: { attachedGarage: { roofOverhangFt: 3 } } } }), OFFSET);
    return [out && box(out[0]), '-2,42,-2,30']; });
check('a roof cut by hand with the ROOF tool never moves',
  L => [L.roofsFollowingProject([HAND_ROOF()], D(), D({ roofOverhang: 4 }), OFFSET), null]);
check('nothing changed hands back null, so PROJECT writes no roofs key',
  L => [L.roofsFollowingProject([HOUSE_ROOF()], D(), D(), OFFSET), null]);
check('the roofs handed in are not edited where they lie',
  L => { const roofs = [HOUSE_ROOF()];
    L.roofsFollowingProject(roofs, D(), D({ roofOverhang: 4 }), OFFSET);
    return [box(roofs[0]), '-2,42,-2,30']; });

const MUTATIONS = [
  ['the house ignores the split row',
    s => s.replace("const own = row === 'house' ? (isSplitType(type) ? rows[type] : null) : rows[row];",
      "const own = row === 'house' ? null : rows[row];")],
  ['a typed zero falls back like an empty cell',
    s => s.replace('const overhangFt = cellNumber(own?.roofOverhangFt)', 'const overhangFt = positiveNumber(own?.roofOverhangFt)')],
  ['a flush gable is pushed out with the eaves',
    s => s.replace("(value > 0 || (roof.edges || [])[index] !== 'gable' ? to.overhangFt : value));",
      '(to.overhangFt));')],
  ['the roof moves by the new overhang, not the difference',
    s => s.replace('const delta = now.map((value, index) => value - was[index]);', 'const delta = now;')],
  ['every roof on the drawing follows, hand-cut ones too',
    s => s.replace('if (Number(roof?.levelId) !== ROOF_LEVEL_ID) return null;', '')],
  ['every row is treated as moved',
    s => s.replace('if (was.overhangFt !== now.overhangFt || was.pitch !== now.pitch) wanted[row] = now;',
      'wanted[row] = now;')],
  ['the pitch is not carried',
    s => s.replace('edgeOverhang: now, pitch: to.pitch };', 'edgeOverhang: now };')],
  ['an unchanged list is handed back anyway (roofs)',
    s => s.replace('return reshapedAny ? following : null;', 'return following;')],
];

function score(L) {
  return CHECKS.map(({ label, fn }) => {
    let got, want;
    try { [got, want] = fn(L); } catch (err) { got = `threw: ${err.message}`; want = 'no throw'; }
    return { label, ok: String(got) === String(want), got, want };
  });
}

function run() {
  const results = score(load(null));
  const failed = results.filter(r => !r.ok);
  failed.forEach(r => console.log(`FAIL  ${r.label}\n      got  ${r.got}\n      want ${r.want}`));
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exitCode = 1;
}

function runMutations() {
  run();
  console.log('\n' + 'mutation'.padEnd(62) + 'caught by');
  let survived = 0, broken = 0;
  MUTATIONS.forEach(([label, mutate]) => {
    let L;
    try { L = load(mutate); } catch (err) {
      broken += 1;
      console.log(`${label.padEnd(62)}!!! MUTATION DID NOT APPLY: ${err.message}`);
      return;
    }
    const caught = score(L).filter(r => !r.ok).map(r => r.label);
    if (!caught.length) survived += 1;
    console.log(label.padEnd(62) + (caught.length ? caught.join('\n' + ' '.repeat(62)) : '*** NOTHING ***'));
  });
  console.log(`\n${MUTATIONS.length - survived - broken}/${MUTATIONS.length} mutations caught`);
  if (broken) console.log(`${broken} mutation(s) never applied -- they prove nothing`);
  if (survived || broken) process.exitCode = 1;
}

if (MUTATION_MODE) runMutations(); else run();
