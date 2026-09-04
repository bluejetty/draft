// geometry-2d.js wallJoins — how does the drafter's wall meet its neighbour?
//
// The classifier the wall painter reads. It was inline in MODEL.dc.html and
// therefore reachable only by the old page: MODEL.html passes joins = null, so
// every corner on the new page is a butt joint.
//
// Sharing this is HALF that debt. The other half is the vertex pool: identity
// is the key here, and MODEL.html builds walls off parsed JSON, which restores
// values rather than references -- so its coincident corners are separate
// objects and this returns an empty Map. The check below named
// "coincident endpoints in separate objects do not join" is the proof, and it
// is the obstacle as much as the invariant.
//
// The four kinds it emits are miter, tee, continuation and multi. It never
// emits `none`; the painter honours that defensively and nothing produces it.
// Naming that here because a dictionary entry claiming a fifth kind, and a
// first kind called `corner`, both survived half a day — the painter mitres
// anything it does not recognise, so a wrong name paints correctly and no
// test can tell. Read the names off THIS function.
global.window = global.window || {};
require('../geometry-2d.js');
const G = global.window.DraftGeometry2D;

let failed = 0, ran = 0;
const check = (label, got, want) => {
  ran += 1;
  if (got !== want) { failed += 1; console.log(`  FAIL ${label}\n       got ${got}, want ${want}`); }
};

// Endpoints are SHARED POINT OBJECTS. That identity is the whole mechanism.
const P = (x, z) => ({ x, z });
const wall = (a, b) => ({ start: a, end: b });
const kindAt = (walls, pt) => {
  const join = G.wallJoins(walls).get(pt);
  return join ? join.type : 'none';
};

// ── The four kinds ──
const o = P(0, 0), e = P(10, 0), n = P(10, 10), w = P(-10, 0), s = P(10, -10);

check('two walls at a right angle mitre',
  kindAt([wall(o, e), wall(e, n)], e), 'miter');

check('two walls running straight on continue',
  kindAt([wall(o, e), wall(e, P(20, 0))], e), 'continuation');

check('a stem into a through-host is a tee',
  kindAt([wall(w, e), wall(e, P(20, 0)), wall(e, n)], e), 'tee');

check('four arms is a multi, with no unambiguous pair to mitre',
  kindAt([wall(w, e), wall(e, P(20, 0)), wall(e, n), wall(e, s)], e), 'multi');

// ── What it refuses to classify ──
check('a lone wall end is no join at all',
  kindAt([wall(o, e)], e), 'none');

// COINCIDENT IS NOT JOINED. Two walls at the same coordinate holding SEPARATE
// point objects never splice — this is what keeps a garage wall independent of
// the house wall it sits on, and the reason the map is keyed by object.
const houseCorner = P(10, 0), garageCorner = P(10, 0);
check('coincident endpoints in separate objects do not join',
  kindAt([wall(o, houseCorner), wall(garageCorner, n)], houseCorner), 'none');
check('and neither does the other one',
  kindAt([wall(o, houseCorner), wall(garageCorner, n)], garageCorner), 'none');

// ── The angle thresholds, at the boundary rather than the middle ──
// Near-collinear but not collinear is still a mitre: the classifier asks
// whether the cross product clears 0.001, not whether it looks straight.
const nearlyStraight = P(20, 0.5);
check('a shallow bend is a mitre, not a continuation',
  kindAt([wall(o, e), wall(e, nearlyStraight)], e), 'miter');

// A degenerate wall has no direction, so it cannot classify anything.
check('a zero-length wall yields no join',
  kindAt([wall(o, e), wall(e, P(10, 0))], e), 'none');

// ── Three arms that are not a tee ──
// A tee needs two arms in near-opposition to act as the host. Three arms at
// 120 degrees have no host pair, so the vertex is left unclassified rather
// than guessed at.
const a120 = P(10 + Math.cos(Math.PI * 2 / 3) * 10, Math.sin(Math.PI * 2 / 3) * 10);
const b120 = P(10 + Math.cos(-Math.PI * 2 / 3) * 10, Math.sin(-Math.PI * 2 / 3) * 10);
check('three arms with no opposed pair is not a tee',
  kindAt([wall(e, P(20, 0)), wall(e, a120), wall(e, b120)], e), 'none');

console.log(`\n${ran - failed}/${ran} checks passed`);
process.exit(failed ? 1 : 0);
