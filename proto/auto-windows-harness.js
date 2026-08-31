// Offline checks for auto-windows.js (board #169) — the siting ruleset with
// no browser in the way. Mirrors the spec families in
// tests/auto-windows.spec.js: front/back maximized, the trapped bedroom
// rescued on its side, the one-side rule, both sides, density caps, the 3'
// and 2' clearances, deference to the drafter, and the garage door face.
//
//   node proto/auto-windows-harness.js
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

console.log(`auto-windows harness: ${pass} checks passed, ${fails.length} failed`);
fails.forEach(line => console.log('  FAIL ' + line));
process.exitCode = fails.length ? 1 : 0;
