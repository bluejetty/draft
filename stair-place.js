// A STAIR PLACED BY HAND (Movie, 25 Oct): "i can't insert a new set of stairs
// when i use the STAIR command button" -- then, of the shapes, "give them a
// popup choice", and of where it is placed from, both: on the floor it comes
// DOWN from, or on the floor below going UP.
//
// THE RECORD IS ALWAYS THE DOWNWARD ONE. A stair is filed on the floor it
// descends from, its `start` the top nosing and start -> end the way down
// (stair-geometry.js); that is what every painter, the well cutter and the
// framing already read. So DOWN is the press as it stands: the top step where
// the hand pressed, the flight running the way the hand points. UP is the
// same flight found backwards: its bottom step where the hand pressed, its
// first leg climbing the way the hand points, and its turn the other hand --
// a flight that turns right on the way down turns left on the way up.
//
// Pure: stair-geometry.js is handed in, so the harness can hold it.
if (!window.DraftStairPlace) {
(() => {
  const unit = (from, to) => {
    const dx = to.x - from.x, dz = to.z - from.z;
    const len = Math.hypot(dx, dz);
    return len > 1e-9 ? { x: dx / len, z: dz / len } : null;
  };
  const otherHand = turn => (turn === 'left' ? 'right' : 'left');
  // `end` along `d` for the first leg's length, the way stair-geometry
  // stores it (stairEndFor).
  const withEnd = (SG, rec, layout) => {
    const end = SG.stairEndFor(rec, layout);
    return { ...rec, end: { x: end.x, y: 0, z: end.z } };
  };
  // THE FLIGHT FOR A PRESS AND AN AIM. `at` the press, `toward` the cursor,
  // `layout` the descent's (stairLayout), `shape` STRAIGHT / L / U, `turn`
  // the hand it turns as the drafter walks it -- down for DOWN, up for UP.
  // Returns { start, end, shape, turn } -- the stored, downward record's own
  // fields -- or null when the hand points nowhere yet.
  const stairFromAim = (SG, { at, toward, layout, shape = 'straight', turn = 'right', widthFt = 3, up = false }) => {
    const aim = unit(at, toward);
    if (!aim || !layout) return null;
    const kind = shape === 'L' || shape === 'U' ? shape : 'straight';
    const base = { widthFt, shape: kind, rail: 'right', winders: 0 };
    if (!up) {
      const rec = { ...base, turn, start: { x: at.x, y: 0, z: at.z },
        end: { x: at.x + aim.x, y: 0, z: at.z + aim.z } };
      return withEnd(SG, rec, layout);
    }
    // UP: lay the downward flight out from the origin heading +x, find its
    // bottom step and the way its last leg climbs, then turn and slide the
    // whole thing so that step is the press and that leg climbs the aim.
    const stored = otherHand(turn);
    const probe = withEnd(SG, { ...base, turn: stored, start: { x: 0, y: 0, z: 0 }, end: { x: 1, y: 0, z: 0 } }, layout);
    const parts = SG.stairPlanParts(probe, layout);
    const foot = parts.walk[parts.walk.length - 1];
    const last = parts.runs[parts.runs.length - 1];
    const climb = { x: -last.dir.x, z: -last.dir.z };
    const angle = Math.atan2(aim.z, aim.x) - Math.atan2(climb.z, climb.x);
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const place = p => {
      const dx = p.x - foot.x, dz = p.z - foot.z;
      return { x: at.x + dx * cos - dz * sin, y: 0, z: at.z + dx * sin + dz * cos };
    };
    return { ...probe, start: place(probe.start), end: place(probe.end) };
  };
  // ITS OUTLINE, to preview: each run a rectangle its width wide about its
  // centre line, and the landing's square.
  const stairOutline = (SG, rec, layout) => {
    const parts = SG.stairPlanParts(rec, layout);
    const half = (Number(rec.widthFt) || 3) / 2;
    const runs = parts.runs.map(run => {
      const n = { x: -run.dir.z, z: run.dir.x };
      const a = run.start, b = { x: run.start.x + run.dir.x * run.lenFt, z: run.start.z + run.dir.z * run.lenFt };
      return [
        { x: a.x + n.x * half, z: a.z + n.z * half }, { x: b.x + n.x * half, z: b.z + n.z * half },
        { x: b.x - n.x * half, z: b.z - n.z * half }, { x: a.x - n.x * half, z: a.z - n.z * half },
      ];
    });
    return { runs, landing: parts.landing ? parts.landing.poly : null, walk: parts.walk };
  };
  window.DraftStairPlace = Object.freeze({ stairFromAim, stairOutline });
})();
}
