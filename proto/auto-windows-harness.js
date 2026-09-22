// Offline checks for auto-windows.js (board #169) — the siting ruleset with
// no browser in the way. Mirrors the spec families in
// tests/auto-windows.spec.js: front/back maximized, the trapped bedroom
// rescued on its side, the one-side rule, both sides, density caps, the 3'
// and 2' clearances, deference to the drafter, and the garage door face.
//
//   node proto/auto-windows-harness.js

// No mutation mode here, so this harness accepts no arguments at all. It
// used to read none: `node auto-windows-harness.js --mutate` printed a full
// passing run and exited 0, having mutated nothing. noFlags(), not
// mutationMode() -- the latter would accept --mutate and print green for a
// mode that does not exist.
require('./harness-args.js').noFlags();

global.window = global.window || {};
require('../auto-windows.js');
const A = window.DraftAutoWindows;

let pass = 0;
const fails = [];
const check = (label, ok, detail) => {
  if (ok) { pass++; return; }
  fails.push(detail ? `${label} — ${detail}` : label);
};
const eq = (label, got, want) => check(label, got === want, `got ${got}, want ${want}`);

const face = (id, orientation, lengthFt, extra = {}) =>
  ({ id, wallId: `w-${id}`, levelId: 2, orientation, lengthFt, ...extra });
const RECT = () => [
  face('F', 'front', 40), face('B', 'back', 40),
  face('L', 'left', 30), face('R', 'right', 30),
];
const countBy = windows => windows.reduce((acc, w) => {
  acc[w.orientation] = (acc[w.orientation] || 0) + 1; return acc;
}, {});
const room = (id, base, frontage) => ({ id, base, levelId: 2, frontage });

// ── Orientation mapping (E1 south is the front) ────────────────────────
eq('normal +z reads front', A.faceOrientation({ x: 0, z: 1 }), 'front');
eq('normal -z reads back', A.faceOrientation({ x: 0, z: -1 }), 'back');
eq('normal -x reads left', A.faceOrientation({ x: -1, z: 0 }), 'left');
eq('normal +x reads right', A.faceOrientation({ x: 1, z: 0 }), 'right');
eq('a diagonal leaning south still reads front', A.faceOrientation({ x: 0.4, z: 0.9 }), 'front');

// ── Front and back are maximized; the sides obey the one-side rule ─────
{
  const { windows, sidesByLevel } = A.dealWindows({ faces: RECT(), rooms: [] });
  const by = countBy(windows);
  check('front carries at least the minimum two', by.front >= 2, `front=${by.front}`);
  check('a 40 ft front is maximized past the minimum', by.front > 2, `front=${by.front}`);
  eq('back defaults to two per floor', by.back, 2);
  check('the left side carries windows', (by.left || 0) >= 2, `left=${by.left}`);
  eq('the right wall stays bare', by.right || 0, 0);
  eq('the window side is recorded as left', (sidesByLevel[2] || []).join(','), 'left');
}

// ── A trapped bedroom is rescued on its own side ───────────────────────
{
  // Its claim touches the RIGHT wall only — no front, no back.
  const rooms = [room(11, 'BEDROOM 2', [{ faceId: 'R', centreFt: 15 }])];
  const { windows, sidesByLevel } = A.dealWindows({ faces: RECT(), rooms });
  const mine = windows.filter(w => w.roomId === 11);
  eq('the trapped bedroom gets its window', mine.length, 1);
  eq('and it lands on the side it actually touches', mine[0]?.orientation, 'right');
  eq('that side becomes the window side', (sidesByLevel[2] || []).join(','), 'right');
  eq('so the left wall is the bare one now', countBy(windows).left || 0, 0);
  check('the rescue window centres on the claim frontage',
    Math.abs((mine[0]?.offset ?? -99) - 15) < 0.001, `offset=${mine[0]?.offset}`);
}

// ── Bedrooms trapped on BOTH sides: both walls go to work ──────────────
{
  const rooms = [
    room(21, 'BEDROOM 2', [{ faceId: 'R', centreFt: 10 }]),
    room(22, 'BEDROOM 3', [{ faceId: 'L', centreFt: 20 }]),
  ];
  const { windows, sidesByLevel } = A.dealWindows({ faces: RECT(), rooms });
  const by = countBy(windows);
  eq('both sides are recorded', (sidesByLevel[2] || []).join(','), 'left,right');
  check('the left wall carries windows', (by.left || 0) >= 2, `left=${by.left}`);
  check('the right wall carries windows', (by.right || 0) >= 2, `right=${by.right}`);
  eq('each trapped bedroom is served', windows.filter(w => w.roomId === 21 || w.roomId === 22).length, 2);
}

// ── A bedroom on the front is NOT trapped ──────────────────────────────
{
  const rooms = [room(31, 'BEDROOM 2', [{ faceId: 'F', centreFt: 12 }, { faceId: 'R', centreFt: 8 }])];
  const { sidesByLevel } = A.dealWindows({ faces: RECT(), rooms });
  eq('a bedroom with front frontage leaves the default side standing',
    (sidesByLevel[2] || []).join(','), 'left');
}

// ── The WC takes the small high unit ───────────────────────────────────
{
  const rooms = [room(41, 'WC', [{ faceId: 'F', centreFt: 20 }])];
  const { windows } = A.dealWindows({ faces: RECT(), rooms });
  const wc = windows.find(w => w.roomId === 41);
  eq('the WC window is the small unit', wc?.kind, 'wc');
  check('and it is set high', (wc?.sillFt ?? 0) > A.DEFAULT_WINDOW.sillFt,
    `sill=${wc?.sillFt}`);
  check('a WC unit is narrower than the default', (wc?.widthFt ?? 9) < A.DEFAULT_WINDOW.widthFt,
    `w=${wc?.widthFt}`);
}

// ── Never crowd: 3'-0" between openings, 2'-0" off a corner ────────────
{
  const { windows } = A.dealWindows({ faces: RECT(), rooms: [] });
  const byFace = {};
  windows.forEach(w => { (byFace[w.faceId] = byFace[w.faceId] || []).push(w); });
  let tooClose = 0, tooNear = 0;
  Object.entries(byFace).forEach(([faceId, list]) => {
    const len = RECT().find(f => f.id === faceId).lengthFt;
    list.sort((a, b) => a.offset - b.offset).forEach((w, i) => {
      if (w.offset - w.widthFt / 2 < A.TUNABLES.MIN_CORNER_FT - 1e-9) tooNear++;
      if (w.offset + w.widthFt / 2 > len - A.TUNABLES.MIN_CORNER_FT + 1e-9) tooNear++;
      const next = list[i + 1];
      if (next && (next.offset - next.widthFt / 2) - (w.offset + w.widthFt / 2)
        < A.TUNABLES.MIN_GAP_FT - 1e-9) tooClose++;
    });
  });
  eq('no two openings crowd each other', tooClose, 0);
  eq('nothing runs into a corner', tooNear, 0);
}

// ── Density caps ───────────────────────────────────────────────────────
{
  const faces = [face('L', 'left', 60), face('F', 'front', 12)];
  const { windows } = A.dealWindows({ faces, rooms: [] });
  const by = countBy(windows);
  check('a long side stops at the long-wall cap',
    (by.left || 0) <= A.TUNABLES.SIDE_MAX_LONG, `left=${by.left}`);
  check('a short front still gets what it can fit', (by.front || 0) >= 1, `front=${by.front}`);
}
{
  const faces = [face('L', 'left', 26)];
  const { windows } = A.dealWindows({ faces, rooms: [] });
  check('an ordinary side stops at three', windows.length <= A.TUNABLES.SIDE_MAX,
    `left=${windows.length}`);
}

// ── Deference: the drafter's face is his ───────────────────────────────
{
  const faces = RECT();
  faces[0] = face('F', 'front', 40, { blocked: true });
  const { windows, report } = A.dealWindows({ faces, rooms: [] });
  eq('a marked face is dealt nothing', countBy(windows).front || 0, 0);
  check('and the deal says why', report.some(line => /drafter/i.test(line)), report.join(' | '));
  check('the other faces still get theirs', (countBy(windows).back || 0) === 2);
}
{
  // An opening already on the face (a garage door, a stair cut) is not a
  // reason to skip the face — but the 3' rule holds against it.
  const faces = RECT();
  faces[1] = face('B', 'back', 40, { taken: [{ centre: 20, widthFt: 16 }] });
  const { windows } = A.dealWindows({ faces, rooms: [] });
  const back = windows.filter(w => w.orientation === 'back');
  const clash = back.filter(w => Math.abs(w.offset - 20) < 8 + w.widthFt / 2 + A.TUNABLES.MIN_GAP_FT);
  eq('nothing is dealt on top of an existing opening', clash.length, 0);
}

// ── Every room with an exterior face is accounted for ──────────────────
{
  const rooms = [room(51, 'BEDROOM 2', [{ faceId: 'R', centreFt: 15 }]),
                 room(52, 'BEDROOM 3', [{ faceId: 'L', centreFt: 15 }])];
  const { windows, report } = A.dealWindows({ faces: RECT(), rooms });
  const served = new Set(windows.map(w => w.roomId).filter(Boolean));
  const unserved = rooms.filter(r => !served.has(r.id));
  check('an unserved room is reported, never silent',
    unserved.every(r => report.some(line => line.includes(String(r.id)))),
    `unserved=${unserved.map(r => r.id)} report=${report.join(' | ')}`);
}

// ── Determinism ────────────────────────────────────────────────────────
{
  const rooms = [room(61, 'BEDROOM 2', [{ faceId: 'R', centreFt: 12 }]),
                 room(62, 'WC', [{ faceId: 'F', centreFt: 30 }])];
  const a = A.dealWindows({ faces: RECT(), rooms });
  const b = A.dealWindows({ faces: RECT(), rooms });
  eq('the same house deals the same hand twice',
    JSON.stringify(a.windows), JSON.stringify(b.windows));
}

// ── Garage door face ───────────────────────────────────────────────────
{
  const plan = A.garageDoorPlan({
    faces: [
      { index: 0, orientation: 'front', lengthFt: 24, behindHouseFront: false },
      { index: 1, orientation: 'left', lengthFt: 22, behindHouseFront: true },
      { index: 2, orientation: 'back', lengthFt: 24, behindHouseFront: true },
      { index: 3, orientation: 'right', lengthFt: 22, behindHouseFront: true },
    ],
    manDoorFaceIndex: 1,
  });
  eq('a step-back garage puts the door on the street face', plan?.faceIndex, 0);
  eq('a 24 ft run takes two singles', plan?.doors.length, 2);
  check('the singles are 8 ft', plan?.doors.every(d => d.widthFt === A.GARAGE.SINGLE_FT));
  check('and they clear each other',
    Math.abs(plan.doors[1].offset - plan.doors[0].offset) >= 8 + A.TUNABLES.MIN_GAP_FT,
    `gap=${plan.doors[1].offset - plan.doors[0].offset}`);
}
{
  // No step-back cue anywhere: fall to the face opposite the man door.
  const plan = A.garageDoorPlan({
    faces: [
      { index: 0, orientation: 'front', lengthFt: 20 },
      { index: 1, orientation: 'left', lengthFt: 20 },
      { index: 2, orientation: 'back', lengthFt: 20 },
      { index: 3, orientation: 'right', lengthFt: 20 },
    ],
    manDoorFaceIndex: 2,
  });
  eq('an ambiguous rectangle lands opposite the man door', plan?.faceIndex, 0);
  check('the reason is stated', /opposite/.test(plan?.reason || ''), plan?.reason);
}
{
  const plan = A.garageDoorPlan({
    faces: [{ index: 0, orientation: 'front', lengthFt: 20 }],
    manDoorFaceIndex: null,
  });
  eq('a short run takes one double', plan?.doors.length, 1);
  eq('the double is 16 ft', plan?.doors[0].widthFt, A.GARAGE.DOUBLE_FT);
}
{
  const plan = A.garageDoorPlan({
    faces: [{ index: 0, orientation: 'front', lengthFt: 13 }],
  });
  eq('a very short run drops to the narrow door', plan?.doors[0].widthFt, A.GARAGE.NARROW_FT);
}
eq('no faces, no plan', A.garageDoorPlan({ faces: [] }), null);

// ── THE ROOF UNDER A WINDOW ───────────────────────────────────────────
//
// Movie, 21 Sep: "the window should be about 4\" over the roof line", and
// asked which of three ways it should move to get there: "keep top of window
// at same spot and subtract size from bottom". So the head is fixed and the
// sill rises, which makes this window shorter than its row rather than
// higher-headed or moved along.
//
// A LONE FRONT FACE, because the deal's other rules are exercised forty-odd
// times above and what is under test here is one window against one roof. A
// 12 ft front takes exactly one (floor(12/10) = 1, under the FRONT_MIN of 2
// only because the spacing runs out), so its offset is knowable and every
// check below can name it.
const roofFace = (roofFt, lengthFt = 12) =>
  [{ id: 'F', wallId: 'w-F', levelId: 2, orientation: 'front', lengthFt, roofFt }];
const level = profile => A.dealWindows({ faces: roofFace(profile), rooms: [] });
const flat = h => [{ offsetFt: 0, heightFt: h }, { offsetFt: 12, heightFt: h }];

{
  // The baseline this whole block is measured against: no roof, no change.
  const bare = A.dealWindows({ faces: roofFace(null), rooms: [] }).windows;
  eq('with no roof profile at all the deal is unchanged', bare.length, 1);
  eq('and its sill is the stock 3 ft', bare[0].sillFt, 3);

  // A roof at 1 ft is far below a 3 ft sill: a sill only ever RISES.
  const low = level(flat(1)).windows;
  eq('a roof below the sill does not lower it', low[0].sillFt, 3);
  check('and the window carries no roof note when it did not move',
    low[0].roofFt === undefined, JSON.stringify(low[0].roofFt));

  // 4 ft of roof + 4" = a 4.333 ft sill, and the head does not budge.
  const lifted = level(flat(4)).windows;
  eq('a roof above the sill lifts it to the roof plus 4 inches', lifted[0].sillFt, 4 + 4 / 12);
  eq('and the head stays exactly where the stock put it', lifted[0].headFt, bare[0].headFt);
  check('so the window is shorter than its row, not higher',
    lifted[0].headFt - lifted[0].sillFt < bare[0].headFt - bare[0].sillFt,
    `${(lifted[0].headFt - lifted[0].sillFt).toFixed(3)} vs ${(bare[0].headFt - bare[0].sillFt).toFixed(3)}`);
  eq('and it did not slide along the wall to escape', lifted[0].offset, bare[0].offset);
  check('and it says what it cleared', Math.abs(lifted[0].roofFt - 4) < 1e-9, lifted[0].roofFt);
  check('and the deal reports the lift', level(flat(4)).report.some(r => /clears the roof/.test(r)),
    level(flat(4)).report.join(' | '));
}
{
  // THE PEAK UNDER THE WINDOW, NOT THE HEIGHT AT ITS CENTRE -- which is the
  // case Movie was actually looking at. On repro-2storey-garage the garage
  // ridge stands at x = 8 and the window spans x 6..10: the roof comes up
  // through it OFF CENTRE, so a rule reading the middle would measure a foot
  // of roof that is not the foot in the way.
  const bare = A.dealWindows({ faces: roofFace(null), rooms: [] }).windows[0];
  const c = bare.offset, half = bare.widthFt / 2;
  // A ridge a quarter-width off centre, 4 ft up, with the centre at 1 ft --
  // so reading the centre lifts NOTHING (1 ft is under the 3 ft stock sill)
  // and reading the peak lifts to 4'-4". The two answers could not be
  // further apart, which is the point of the numbers.
  //
  // 4 FT AND NOT 5, and the first draft of this check said 5 and threw. A
  // 5 ft ridge under a 6'-6" head leaves 14" of glass, so the window is
  // DROPPED -- correctly, by the rule two blocks down -- and there was no
  // window left to read a sill off. The peak has to be high enough to move
  // the sill and low enough to leave a window standing.
  const ridge = [
    { offsetFt: 0, heightFt: 1 },
    { offsetFt: c, heightFt: 1 },
    { offsetFt: c + half / 2, heightFt: 4 },
    { offsetFt: c + half, heightFt: 1 },
    { offsetFt: 12, heightFt: 1 },
  ];
  const win = level(ridge).windows[0];
  eq('an off-centre ridge lifts the sill by its PEAK, not by the centre height',
    win.sillFt, 4 + 4 / 12);
}
{
  // NO GLASS LEFT IS NO WINDOW. The head is 6.5 ft; a roof at 6 ft leaves
  // 2 inches under it, and the smallest unit the ladder deals is the 24" WC.
  const gone = level(flat(6));
  eq('a roof that leaves less than the smallest unit deals no window', gone.windows.length, 0);
  check('and the deal says why, naming the roof height',
    gone.report.some(r => /no window at/.test(r) && /6\.00/.test(r)),
    gone.report.join(' | '));
  // AND THE ROOM IS NOT MARKED SERVED BY A WINDOW THAT WAS DROPPED. `served`
  // used to be added to as each claim window was dealt, which was true until
  // a window could be dealt and then taken away again.
  const claimed = A.dealWindows({
    faces: roofFace(flat(6)),
    rooms: [{ id: 'r1', base: 'BEDROOM 1', levelId: 2, frontage: [{ faceId: 'F', centreFt: 6 }] }],
  });
  eq('and no window reaches the drawing for the room that claimed it', claimed.windows.length, 0);
  check('and the room is reported as getting nothing, not as served',
    claimed.report.some(r => /^BEDROOM 1 r1:/.test(r)), claimed.report.join(' | '));
}
{
  // A profile that stops short of the face end: the last sample carries on.
  // Stated as a check because it is the one thing the contract asks callers
  // for -- sample the WHOLE face -- and a caller who does not gets this.
  const part = level([{ offsetFt: 0, heightFt: 4 }, { offsetFt: 1, heightFt: 4 }]).windows;
  eq('a profile shorter than the face holds its end value outward', part[0].sillFt, 4 + 4 / 12);
}

// MUTATION-RUN BY HAND, 22 Sep, because this harness carries no engine and a
// guard nobody has watched fail is worth nothing. Each was applied to
// auto-windows.js alone and caught by the check whose name describes it:
//
//   the clearance is zero                 -> lifts it to the roof plus 4 inches
//   reads the CENTRE, not the peak        -> lifts the sill by its PEAK
//   a window with no glass is kept        -> deals no window
//   the whole window is raised, head too  -> the head stays where the stock put it
//   the sill follows the roof DOWN        -> a roof below the sill does not lower it
//   dropped windows reach the drawing     -> no window reaches the drawing
//   a room with frontage counts as served -> reported as getting nothing
//
// THE LAST TWO ARE SEPARATE ON PURPOSE. The "dropped windows reach the
// drawing" mutation fails four checks at once, the served one among them, so
// it proves that check is connected without proving it measures anything of
// its own. The eager-`served` mutation fails it ALONE, which is what says the
// bookkeeping is guarded rather than merely downstream of something guarded.

console.log(`auto-windows harness: ${pass} checks passed, ${fails.length} failed`);
fails.forEach(line => console.log('  FAIL ' + line));
process.exitCode = fails.length ? 1 : 0;
