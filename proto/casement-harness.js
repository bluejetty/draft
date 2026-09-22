#!/usr/bin/env node
// A WINDOW IS A SINGLE OR A DOUBLE CASEMENT, AND THE DOUBLE WEARS A MULLION.
//
// Movie, 22 Sep 2026, on the room over the garage:
//
//   "for windows over the garage lets put windows at 36" height can we also
//    make it 66" wide and put a seperation in the center"
//   "1 window, with 2 window panes"
//   "let make it a different window TYPE in WINDOW PROPERTIES"
//   "the first one SINGLE CASEMENT, this one DOUBLE CASEMENT"
//
// and, asked whether picking the type should resize the window it is picked
// on, both halves of the ruling in one breath:
//
//   "no size should stay the same (they can change it)"
//   "ya lets make that size default for that type"
//
// ── WHY THERE IS NO SECOND LIST TO DRIFT ─────────────────────────────────
//
// drawing-format.js owns the VOCABULARY -- what a stored record may say --
// because it validates every record every page reads, and its own rule
// forbids it reading anything off `window`. geometry-2d.js owns the SIZES,
// because that is where a placer asks what a window is.
//
// So the sizes are a TABLE KEYED BY the vocabulary rather than a list beside
// it. The two cannot disagree about which casements exist without this file
// going red, and there is no list for anyone to forget. That is the cheap
// version of what proto/window-head-harness.js has to do the expensive way,
// and the first check below is the whole of the price.
//
//   node proto/casement-harness.js
require('./harness-args.js').noFlags();

const fs = require('fs');
const path = require('path');
const E = require('./elevation-harness.js');

const ROOT = path.join(__dirname, '..');
const win = E.loadDraftModules();
const G = win.DraftGeometry2D;
const F = win.DraftDrawingFormat;

let pass = 0;
const fails = [];
const eq = (label, got, want) => {
  if (String(got) === String(want)) { pass += 1; return; }
  fails.push(`${label} — got ${got}, want ${want}`);
};
const check = (label, ok, detail) => {
  if (ok) { pass += 1; return; }
  fails.push(detail ? `${label} — ${detail}` : label);
};
const inches = ft => `${(ft * 12).toFixed(2)}"`;

// ── THE TWO MODULES AGREE ON WHICH CASEMENTS EXIST ────────────────────────
eq('the vocabulary and the size table name the same casements',
  Object.keys(G.CASEMENT_SIZES_FT).sort().join(','),
  [...F.CASEMENT_TYPES].sort().join(','));
check('and there are actually some, rather than two empties agreeing',
  F.CASEMENT_TYPES.length >= 2, JSON.stringify(F.CASEMENT_TYPES));

// ── THE SIZES ARE THE ONES HE ASKED FOR ───────────────────────────────────
const dbl = G.CASEMENT_SIZES_FT.double;
eq('a double casement is 66 in wide', inches(dbl.widthFt), '66.00"');
eq('and 36 in tall', inches(dbl.heightFt), '36.00"');

// AND THE SINGLE IS WHAT A WINDOW HAS ALWAYS BEEN, derived from this file's
// own defaults rather than typed again: 4'-0" wide, and 4'-2" tall because a
// 2'-6" sill under the 6'-8" head windows and doors used to share is 4'-2".
const sgl = G.CASEMENT_SIZES_FT.single;
eq('a single casement is the app-s own default window width',
  sgl.widthFt, G.DEFAULT_WINDOW_WIDTH_FT);
eq('and its height is the old sill-to-shared-head distance, not a new number',
  sgl.heightFt, G.DEFAULT_OPENING_HEAD_FT - G.DEFAULT_WINDOW_SILL_FT);
check('so a double is SHORTER and WIDER than a single, which is the whole shape of it',
  dbl.heightFt < sgl.heightFt && dbl.widthFt > sgl.widthFt,
  `double ${inches(dbl.widthFt)}x${inches(dbl.heightFt)}, single ${inches(sgl.widthFt)}x${inches(sgl.heightFt)}`);

// A PLACER WITH NO SIZE PLACES NOTHING, so an unknown casement answers as a
// single rather than as undefined.
check('an unknown casement still yields a size', Number(G.casementSizeFt('trouble')?.widthFt) > 0,
  JSON.stringify(G.casementSizeFt('trouble')));

// ── THE READER ────────────────────────────────────────────────────────────
const ids = new Set([3]);
const read = (over) => F.fenestrations([{
  id: 'f1', wallId: 'w1', levelId: 3, type: 'window', width: 4, offset: 5,
  sillHeight: 3, headHeight: 7, ...over,
}], ids)[0];

eq('a window with nothing stored reads as a single', read({}).casement, 'single');
eq('a stored double survives the read', read({ casement: 'double' }).casement, 'double');
eq('and a word that is not a casement falls back rather than through',
  read({ casement: 'triple' }).casement, 'single');
// A DOOR HAS NO CASEMENT. A `casement: 'single'` on every door in every file
// would be a key that says nothing about the thing it is written on.
eq('a door carries none even when one is stored on it',
  String(read({ type: 'door', sillHeight: 0, casement: 'double' }).casement), 'null');
// NO VERSION BUMP, and that is load-bearing: the stored shape only GAINS an
// optional key. checkEnvelope reads an older version as 'invalid' rather than
// as something to upgrade, so a bump would refuse every existing file.
eq('the stored format version is unchanged by this type', F.VERSION, 1);

// ── THE DESIGN DEALS THEM OVER THE GARAGE ─────────────────────────────────
// loadDraftModules() runs its files in a vm sandbox and hands back THAT
// sandbox's window. premade-plans.js is not in its list, so it is loaded here
// in node's own realm -- pointed at the same window object, or it would attach
// its exports somewhere nothing else can see and read a DraftGeometry2D that
// is not the one checked above.
global.window = win;
require(path.join(ROOT, 'premade-plans.js'));
const plan = win.DraftPremadePlans.planFor('twoStorey-over');
const over = plan.overGarageOpenings.filter(o => o.type === 'window');
check('the room over the garage takes windows at all', over.length > 0, `${over.length}`);
check('and every one of them is a double casement',
  over.every(o => o.casement === 'double'),
  over.map(o => o.casement).join(', '));
check('at the type-s own size, read rather than typed',
  over.every(o => Math.abs(o.widthFt - dbl.widthFt) < 1e-9),
  over.map(o => inches(o.widthFt)).join(', '));
// THE HEAD DOES NOT MOVE. 21 Sep: the head is the datum, so a shorter unit
// hangs its sill lower rather than dropping its head.
check('heading at 7 ft like every other window in the design',
  over.every(o => Math.abs(o.headFt - G.DEFAULT_WINDOW_HEAD_FT) < 1e-9),
  over.map(o => o.headFt).join(', '));
check('with the sill DERIVED from that head and the height, not carried',
  over.every(o => Math.abs((o.headFt - o.sillFt) - dbl.heightFt) < 1e-9),
  over.map(o => `${inches(o.headFt - o.sillFt)} of glass`).join(', '));
// AND THE REST OF THE DESIGN IS UNTOUCHED, which is the half that keeps the
// rest honest: this was a new type, not a change to what a window is.
const upper = plan.upperOpenings.filter(o => o.type === 'window');
check('every other window in the design is still a single',
  upper.length > 0 && upper.every(o => o.casement === 'single'),
  `${upper.length} upper windows: ${[...new Set(upper.map(o => o.casement))].join(', ')}`);
check('and still the size it was',
  upper.every(o => Math.abs(o.widthFt - sgl.widthFt) < 1e-9),
  upper.map(o => inches(o.widthFt)).join(', '));

// ── AND THE PAINTER DRAWS THE MULLION ─────────────────────────────────────
//
// The point of the whole ruling is a bar down the middle of the glass, and
// everything above this could be true with nothing drawn. Measured by painting
// the SAME drawing twice -- every window single, then one of them flipped to a
// double -- because the difference between two paints is exactly the mullion
// and nothing else has to be identified.
{
  const file = path.join(ROOT, 'proto', 'repro-L-house.draft');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const windows = (raw.fenestrations || []).filter(f => f.type === 'window');
  check('the fixture carries windows to flip', windows.length > 0, `${windows.length}`);

  // COUNTED BY SHAPE, NOT BY DIFFERENCE, and that was a correction. The first
  // version of this block measured the mullion as the DELTA between two
  // paints, which cannot tell "never draws one" from "draws one on every
  // window": both leave the delta at zero, and both then failed the same
  // check with the message "nothing was drawn at all". A failure that names
  // the wrong cause costs the next reading more than no check does.
  //
  // A mullion is the only stroke this painter emits as FOUR points forming two
  // short-separated verticals, so it can be counted outright. The all-single
  // paint below is what says that filter is clean: it must find none.
  const isMullion = st => {
    if (st.pts.length !== 4) return false;
    const seg = [[st.pts[0], st.pts[1]], [st.pts[2], st.pts[3]]];
    if (!seg.every(([a, b]) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) > 1)) return false;
    const apart = Math.abs(seg[0][0].x - seg[1][0].x);
    return apart > 0.5 && apart < 40;
  };
  const mullionsIn = saved => {
    const env = E.buildEnv(win, saved);
    return E.standardElevationCuts(env)
      .map(cut => E.paintElevation(win, env, cut).rawStrokes.filter(isMullion).length);
  };

  const allSingle = JSON.parse(JSON.stringify(raw));
  (allSingle.fenestrations || []).forEach(f => {
    if (f.type === 'window') f.casement = 'single';
  });
  const allDouble = JSON.parse(JSON.stringify(raw));
  (allDouble.fenestrations || []).forEach(f => {
    if (f.type === 'window') f.casement = 'double';
  });
  const oneDouble = JSON.parse(JSON.stringify(raw));
  oneDouble.fenestrations.find(f => f.type === 'window').casement = 'double';

  const none = mullionsIn(allSingle);
  const every = mullionsIn(allDouble);
  const one = mullionsIn(oneDouble);

  // THE THREE READINGS THAT SEPARATE THE THREE PAINTERS. A painter that draws
  // no mullion fails the second; one that bars every window fails the first;
  // one that bars the right windows passes all three, and nothing else does.
  check('a drawing of nothing but singles wears no mullion at all',
    none.every(n => n === 0), `per elevation: ${none.join(', ')}`);
  check('and a drawing of nothing but doubles wears plenty',
    every.reduce((a, b) => a + b, 0) > 0, `per elevation: ${every.join(', ')}`);
  check('and one double wears fewer than all of them do',
    one.reduce((a, b) => a + b, 0) > 0
    && one.reduce((a, b) => a + b, 0) < every.reduce((a, b) => a + b, 0),
    `one double: ${one.join(', ')}   all double: ${every.join(', ')}`);

  // ONE BAR PER DRAWING OF THE WINDOW, and a window is drawn more than once:
  // the flipped one shows on E1 AND E3, the opposite pair, because the
  // elevation painter does not cull a far wall's openings -- looking at the
  // back of the house you get the front wall's windows too. That is the
  // painter's existing behaviour and none of this ruling's business; what
  // matters is that each drawing gets ONE bar and never two.
  check('one double casement puts one mullion on each elevation that draws it',
    one.every(n => n === 0 || n === 1) && one.some(n => n === 1),
    `per elevation: ${one.join(', ')}`);
  check('and none on the elevations that do not',
    one.some(n => n === 0), `per elevation: ${one.join(', ')}`);

  // AND SAYING 'single' OUT LOUD IS THE SAME AS SAYING NOTHING, which is what
  // makes the default in the reader a description of every drawing made before
  // this type existed rather than a new opinion about them.
  const strokeCount = saved => {
    const env = E.buildEnv(win, saved);
    return E.standardElevationCuts(env)
      .reduce((n, cut) => n + E.paintElevation(win, env, cut).rawStrokes.length, 0);
  };
  eq('a window stored as single draws the same as one storing nothing',
    strokeCount(allSingle), strokeCount(raw));
}

console.log(`casement harness: ${pass} checks passed, ${fails.length} failed`);
fails.forEach(line => console.log('  ✘ ' + line));
process.exitCode = fails.length ? 1 : 0;
