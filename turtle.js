// THE TURTLE (turtle path step 3) — two verbs, and the walk they make.
//
// A Logo turtle that draws walls by walking. It has exactly two verbs:
//
//   TURN — left 90°, right 90°, or straight on. Nothing else.
//   GO   — a distance, in whole feet.
//
// TWO VERBS IS THE REASON THIS WORKS. Resist every request to add a third:
// each one added is a thing a beginner has to be taught before they can draw a
// wall, and the pair below already reaches every shape the generator can make.
//
// Because it can only turn 90°, everything it draws is orthogonal BY
// CONSTRUCTION. That is not a check that runs afterwards — there is no way to
// express a non-square wall with these verbs — which is why TOY output is
// TOY-editable by definition and why the constraint module never has to refuse
// anything the turtle drew.
//
// ── IT WALKS THE INSIDE FACE, AND THAT IS FORCED ─────────────────────────
//
// Not chosen. If the turtle walked the centreline, the user would type 12 and
// the finished room would measure 11'-6½" — every dimension on the drawing
// contradicting the number they entered, which is precisely the confusion the
// mode exists to prevent. So the turtle walks the inside face and thickness is
// added outward.
//
// The model already carries this: walls have `refLine`. Which value a wall
// gets is worked out from the direction the walk turned, below — it is a
// setting applied consistently, not machinery invented here.
//
// No UI, no DOM, no component state. Pure, so every rule is proved in node.
if (!window.DraftTurtle) {
(() => {
  // ── The rounding rule, which is the spine of the mode ──────────────────
  // "Everything adjustable is to the nearest foot. Everything the material
  // dictates keeps its real dimension." (Movie, 31 Aug.) A GO is adjustable,
  // so it is whole feet. Wall thickness is the material's and is untouched.
  const GO_STEP_FT = 1;
  // If a jog genuinely cannot be expressed in feet, half-feet come before
  // inches ever do -- and needing one is a signal the shape wants DRAFTING
  // MODE rather than a reason to widen the input path.
  const FINE_STEP_FT = 0.5;

  // Only four headings exist, because only 90° turns exist. +x east, +z south.
  const HEADINGS = Object.freeze([
    { name: 'E', x: 1, z: 0 },
    { name: 'S', x: 0, z: 1 },
    { name: 'W', x: -1, z: 0 },
    { name: 'N', x: 0, z: -1 },
  ]);

  const TURN = Object.freeze({ LEFT: 'left', RIGHT: 'right', STRAIGHT: 'straight' });

  const num = value => (typeof value === 'number' && Number.isFinite(value) ? value : null);

  // ── VERB 1 · TURN ─────────────────────────────────────────────────────
  // In screen terms +z is DOWN, so turning left from east faces north, which
  // is index −1. Getting this backwards mirrors every house the turtle draws.
  const turn = (heading, which) => {
    const at = ((num(heading) ?? 0) % 4 + 4) % 4;
    if (which === TURN.LEFT) return (at + 3) % 4;
    if (which === TURN.RIGHT) return (at + 1) % 4;
    return at;
  };

  // ── VERB 2 · GO ───────────────────────────────────────────────────────
  // Whole feet. A distance is quantised on the way IN, so what the user typed
  // and what the wall measures are the same number -- there is no later
  // rounding for a dimension string to disagree with.
  const quantise = (feetFt, { fine = false } = {}) => {
    const asked = num(feetFt);
    if (asked === null) return 0;
    const step = fine ? FINE_STEP_FT : GO_STEP_FT;
    return Math.round(asked / step) * step;
  };

  const step = (at, heading, feetFt, options) => {
    const dir = HEADINGS[((num(heading) ?? 0) % 4 + 4) % 4];
    const run = quantise(feetFt, options);
    return { x: at.x + dir.x * run, z: at.z + dir.z * run, ranFt: run };
  };

  // ── THE WALK ──────────────────────────────────────────────────────────
  // A list of { turn, goFt } read in order. The turn happens first, then the
  // go -- which is how a person says it out loud, and the order the two verbs
  // have to be read in for "left, twelve" to mean what it sounds like.
  const walk = (moves, { startAt, heading } = {}) => {
    let at = { x: (startAt && num(startAt.x)) ?? 0, z: (startAt && num(startAt.z)) ?? 0 };
    let facing = num(heading) ?? 0;
    const points = [{ x: at.x, z: at.z }];
    const legs = [];
    (moves || []).forEach(move => {
      facing = turn(facing, move && move.turn);
      const next = step(at, facing, move && move.goFt, move);
      if (next.ranFt === 0) return;   // a turn on the spot draws nothing
      legs.push({ start: { x: at.x, z: at.z }, end: { x: next.x, z: next.z },
        heading: facing, runFt: next.ranFt });
      at = { x: next.x, z: next.z };
      points.push({ x: at.x, z: at.z });
    });
    return { points, legs, heading: facing, at };
  };

  // Did the walk come back to where it started? A house outline has to close,
  // and the turtle either did or did not -- it is never nudged shut.
  const closes = (path, tolFt = 1e-9) => {
    const points = (path && path.points) || [];
    if (points.length < 4) return false;
    const first = points[0], last = points[points.length - 1];
    return Math.hypot(last.x - first.x, last.z - first.z) <= tolFt;
  };

  // Which side of the walk the inside is on. The app traces interior faces
  // with the room on the LEFT of every directed edge and a negative signed
  // area, so a walk with that sign was walked with its inside to the left.
  // Reading it off the walk rather than asking is what lets the user turn
  // whichever way feels natural and still get the faces right.
  const insideIsLeft = path => {
    const points = (path && path.points) || [];
    if (points.length < 3) return true;
    let doubled = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i], q = points[(i + 1) % points.length];
      doubled += p.x * q.z - q.x * p.z;
    }
    return doubled < 0;
  };

  // ── THE WALLS ─────────────────────────────────────────────────────────
  // The stored line IS the face the turtle walked, so `refLine` names the side
  // the inside is on and the thickness lands outward from it. That is the
  // whole reason the user's 12 stays 12.
  const wallsFrom = (path, { wallType = 'stud_2x6' } = {}) => {
    const ref = insideIsLeft(path) ? 'left' : 'right';
    return ((path && path.legs) || []).map((leg, index) => ({
      id: `turtle-${index + 1}`,
      start: { x: leg.start.x, z: leg.start.z },
      end: { x: leg.end.x, z: leg.end.z },
      wallType,
      refLine: ref,
      runFt: leg.runFt,
    }));
  };

  window.DraftTurtle = Object.freeze({
    GO_STEP_FT, FINE_STEP_FT, HEADINGS, TURN,
    turn, quantise, step, walk, closes, insideIsLeft, wallsFrom,
  });
})();
}
