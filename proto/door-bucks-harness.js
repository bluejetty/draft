#!/usr/bin/env node
// door-bucks-harness.js — THE DOOR BUCKS A GARAGE'S FOUNDATION PLAN CUTS
//
// Movie, 16 Oct: "DOOR BUCKS at the man door and each garage door, 2" wider
// than the door each side ... the slab pours through the buck ... The inside
// edge of the door buck, below the slab, is a lighter line."
//
// door-bucks.js is pure: walls and fenestrations in, bucks out. The bands
// repro has both doors Movie named -- a man door (2'-6") and an overhead
// (16') on garage walls, each over a concrete wall on the FOUNDATION view --
// and a house front door over the house's concrete, which is NOT a buck.
//
// Run: node proto/door-bucks-harness.js            (checks)
//      node proto/door-bucks-harness.js --mutate   (checks + mutation table)
const MUTATE = require('./harness-args.js').mutationMode();
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const MUTATIONS = [
  ['the buck is the door\'s width, not 2" wider each side', 'door-bucks.js',
    c => c.replace('  const BUCK_EXTRA_FT = 2 / 12;', '  const BUCK_EXTRA_FT = 0;')],
  ['a door on a house wall cuts a buck too', 'door-bucks.js',
    c => c.replace("      if (!host || host.body !== 'garage' || (host.view || 'plan') !== 'plan') return;",
      "      if (!host || (host.view || 'plan') !== 'plan') return;")],
  ['a door well off the concrete still cuts it', 'door-bucks.js',
    c => c.replace('  const UNDER_FT = 1;', '  const UNDER_FT = 100;')],
  ['the inside face is always the start face', 'door-bucks.js',
    c => c.replace("        insideFace: toMiddle >= 0 ? 'end' : 'start',", "        insideFace: 'start',")],
  ['the buck spans one face only', 'door-bucks.js',
    c => c.replace('    return [p(-buck.halfLen, buck.startOff), p(buck.halfLen, buck.startOff),\n      p(buck.halfLen, buck.endOff), p(-buck.halfLen, buck.endOff)];',
      '    return [p(-buck.halfLen, buck.startOff), p(buck.halfLen, buck.startOff),\n      p(buck.halfLen, buck.startOff), p(-buck.halfLen, buck.startOff)];')],
  ['the concrete of every level is cut, not the one being drawn', 'door-bucks.js',
    c => c.replace('      && (concreteLevelId == null || Number(wall.levelId) === Number(concreteLevelId)));',
      '      );')],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('door-bucks',
    MUTATIONS, { root: ROOT, harness: __filename });
  process.exit(all ? 0 : 1);
}

const win = require('./harness-env.js').loadDraftModules();
const DB = win.DraftDoorBucks;
const G = win.DraftGeometry2D;
const WT = win.DraftWallTypes.WALL_TYPES;
const thicknessFt = wall => ((WT.find(t => t.id === (wall.wallType || 'stud_2x6')) || WT[1]).totalIn / 12);
const SAVED = JSON.parse(fs.readFileSync(path.join(ROOT, 'proto', 'repro-movie-bands.draft'), 'utf8'));

let failed = 0, ran = 0;
const check = (label, cond, detail) => {
  ran += 1;
  if (cond) return;
  failed += 1;
  console.log(`  FAIL ${label}${detail !== undefined ? `\n       ${detail}` : ''}`);
};
const bucksOf = (over = {}) => DB.doorBucks({
  walls: SAVED.walls, fenestrations: SAVED.fenestrations, thicknessFt,
  faceOffsets: G.wallFaceOffsets, concreteLevelId: 1, ...over,
});
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

const bucks = bucksOf();
const byDoor = Object.fromEntries(bucks.map(b => [b.doorId, b]));
check('the man door and the overhead door each cut a buck, and the house door does not',
  Object.keys(byDoor).sort().join(',') === 'fenestration-35,fenestration-36', Object.keys(byDoor).join(','));
check('the man door\'s buck is on the concrete under its wall', byDoor['fenestration-35']?.wallId === 'wall-63',
  byDoor['fenestration-35']?.wallId);
check('the overhead door\'s buck is on the concrete under its wall', byDoor['fenestration-36']?.wallId === 'wall-65',
  byDoor['fenestration-36']?.wallId);
check('a buck is the door plus 2" a side: 2\'-6" reads 2\'-10"', near(byDoor['fenestration-35']?.widthFt, 2.5 + 4 / 12),
  byDoor['fenestration-35']?.widthFt);
check('and 16\' reads 16\'-4"', near(byDoor['fenestration-36']?.widthFt, 16 + 4 / 12), byDoor['fenestration-36']?.widthFt);
check('the overhead door\'s buck is marked as the garage door\'s', byDoor['fenestration-36']?.garage === true);
check('the man door\'s is not', byDoor['fenestration-35']?.garage === false);
check('a buck spans the concrete\'s 8" from face to face',
  bucks.every(b => near(b.endOff - b.startOff, 8 / 12)), bucks.map(b => b.endOff - b.startOff).join(','));
check('its centre is the door\'s centre projected onto the concrete',
  near(byDoor['fenestration-36']?.centre.x, 8) && near(byDoor['fenestration-36']?.centre.z, 46),
  JSON.stringify(byDoor['fenestration-36']?.centre));
// THE INSIDE FACE: the garage lies at +z of the man door's wall (z 19 -> 46)
// and at -z of the overhead door's (z 46, the garage above it). Both read
// 'end' here because each wall's +across happens to point into the garage;
// the control below turns a wall round and the answer follows.
check('the inside face is the face toward the garage', bucks.every(b => b.insideFace === 'end'),
  bucks.map(b => b.insideFace).join(','));
const turned = {
  walls: SAVED.walls.map(w => (w.id === 'wall-65' ? { ...w, start: w.end, end: w.start, refLine: 'right' } : w)),
};
const turnedBucks = bucksOf(turned);
check('turn the concrete round and the inside face turns with it',
  turnedBucks.find(b => b.doorId === 'fenestration-36')?.insideFace === 'start',
  turnedBucks.find(b => b.doorId === 'fenestration-36')?.insideFace);
// THE CORNERS, start face first, along then across.
const corners = DB.buckCorners(byDoor['fenestration-36']);
check('the four corners run the buck\'s length on both faces',
  corners.length === 4 && near(Math.hypot(corners[1].x - corners[0].x, corners[1].z - corners[0].z), 16 + 4 / 12)
    && near(Math.hypot(corners[3].x - corners[0].x, corners[3].z - corners[0].z), 8 / 12),
  JSON.stringify(corners));
// NO CONCRETE, NO BUCK: a door over nothing poured cuts nothing.
check('a door over no concrete cuts no buck',
  bucksOf({ walls: SAVED.walls.filter(w => w.id !== 'wall-65') }).every(b => b.doorId !== 'fenestration-36'));
check('a door well off the concrete line cuts no buck',
  bucksOf({ walls: SAVED.walls.map(w => (w.id === 'wall-33' ? { ...w, start: { ...w.start, z: 43 }, end: { ...w.end, z: 43 } } : w)) })
    .every(b => b.doorId !== 'fenestration-36'));
check('only the level being drawn is cut', bucksOf({ concreteLevelId: 5 }).length === 0);
check('and with no level named, any concrete is', bucksOf({ concreteLevelId: null }).length === 2);
check('nothing in, nothing out', DB.doorBucks({}).length === 0 && DB.doorBucks({ walls: [], fenestrations: [] }).length === 0);

console.log(`\ndoor bucks: ${ran} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
