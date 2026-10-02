// TURNING THE HOUSE A QUARTER, AND EVERYTHING THAT STANDS ON IT.
//
// Movie, 27 Sep: *"can we add a HOUSE ROTATE function ... make it rotate the
// actual model space so the E1 E2 etc all rotate. make the rotations 90degrees
// don't allow in between"*, and, on why: *"this will allow them to rotate a
// house 90 degress depending on length of house so it fits on the layout pages
// nicer"*.
//
// AND THEN THE CLARIFICATION THAT SETTLES THE DESIGN: *"you understand that
// rotation stuff? the front view E1 will stay as the same view but the house
// and the E1-E4 lines will rotate"*.
//
// SO E1 KEEPS ITS WALL. This is not "look at the house from the next side
// round" -- the front stays the front, and what changes is which way the house
// LIES on the paper. A long house that ran off a landscape sheet lies across
// it instead. Which means two things move together: the geometry turns, and
// the elevation marks turn with it, so the mark that was reading the south
// wall is now on the west side still reading the same wall.
//
// THE MARKS ARE NOT THIS FILE'S. cut-marks.js owns where an elevation stands,
// and it takes the turn as a number; this file owns the GEOMETRY. Splitting it
// the other way -- a rotation that also placed marks -- would put two owners
// on one table again, which the four copies of E_MARK_SIDES already cost.
//
// ── REVERSIBLE, WHICH TAKES MORE THAN AVOIDING TRIGONOMETRY ──────────────
//
// A quarter turn is a swap and a negation, so the ROTATION is exact where
// Math.cos(Math.PI / 2) would not be. That is not enough on its own, and the
// first draft of this file claimed it was.
//
// THE CENTRE IS WHAT COSTS THE EXACTNESS. Turning about a point means
// `c + R(p - c)`, and in floating point `(c + v) - c` is not always `v` -- so
// four turns applied one at a time, which is what a drafter does, came back
// with 8.5 as 8.500000000000002. Measured, on the first line of
// repro-garage-house.
//
// SO THE RESULT LANDS ON A LATTICE. Every turned coordinate is rounded to a
// MILLIONTH OF A FOOT -- which is a hundred-thousandth of an inch, far below
// anything this app measures, snaps to or prints -- and a lattice point turned
// four times is the point it started on. A drafter who turns a house round the
// houses gets his file back rather than one that has drifted at every corner:
// a dirty save, a re-snapped wall, and eventually a join that no longer
// closes.
if (!window.DraftPlanRotate) {
(() => {
  const QUARTER_TURNS = 4;

  // ── WHAT CARRIES A PLAN COORDINATE ────────────────────────────────────
  //
  // Movie named three of these and then said the quiet part: *"the dimension
  // and annotation notes should shift to line up to the propery direction"*,
  // *"and the room tags"*, *"etc"*. The "etc" is the whole problem -- a
  // rotation that turns the walls and forgets the room tags leaves a plan with
  // its labels in the wrong rooms, and nothing crashes.
  //
  // SO THE ANSWER IS A TABLE AND NOT A FUNCTION FULL OF SPECIAL CASES, and
  // the table is EXPORTED so a harness can walk a drawing looking for any
  // point this list does not reach. That check is the one that answers "etc":
  // a record type added next year fails it rather than quietly standing still
  // while the house turns underneath it.
  //
  // Each entry is an array on the drawing and the fields on its items that
  // hold a point. `points` means an array of them.
  const ROTATED = Object.freeze([
    { key: 'walls', at: ['start', 'end'] },
    { key: 'lines', at: ['start', 'end'] },
    { key: 'beams', at: ['start', 'end'] },
    { key: 'stairs', at: ['start', 'end'] },
    { key: 'dimensions', at: ['start', 'end'] },
    { key: 'notes', at: ['anchor', 'text'] },
    { key: 'columns', at: ['point'] },
    { key: 'roomTags', at: ['at'] },
    { key: 'electricDevices', at: ['at'] },
    { key: 'floors', points: true },
    { key: 'roofs', points: true },
    { key: 'shapes', points: true },
    { key: 'outlines', points: true },
    { key: 'surfaceOpenings', points: true },
    // A CUT CARRIES A DIRECTION AS WELL AS TWO ENDS, and a direction turns
    // about the ORIGIN rather than about the house: it is which way the cut
    // looks, not where it is. Rotated as a point it would be flung across the
    // plan and stop being a unit vector.
    { key: 'cuts', at: ['startPt', 'endPt'], spin: ['dirVec'] },
    // AN UNDERLAY IS A PICTURE PINNED TO THE PLAN, and its corner is a bare
    // x and z rather than a point object. Its width and height SWAP: a
    // photograph turned on its side is as tall as it was wide.
    { key: 'underlays', bare: true, swapSize: true },
  ]);

  // ── AND WHAT DOES NOT TURN, WITH THE REASON ──────────────────────────
  //
  // Written down rather than left absent, because "it is not in the table" and
  // "it is deliberately not in the table" look identical from the outside, and
  // the completeness check has to be able to tell them apart.
  const NOT_ROTATED = Object.freeze([
    // THE BONEYARD IS A SHELF, NOT PART OF THE BUILDING. It stands off to one
    // side of the plan holding outlines a drafter has parked; turning it about
    // the house's centre would fling it somewhere else entirely, and turning
    // it about its own would spin the parked shapes for no reason. What a
    // drafter means by rotating the house is the house.
    { key: 'boneyardOutlines', why: 'a parked shelf beside the plan, not part of the building' },
    // LAYOUT VIEWPORTS ARE SHEET COORDINATES -- inches on paper, not feet on
    // the ground. They frame the plan and are not in it.
    { key: 'layout', why: 'sheet inches, not plan feet' },
  ]);

  // ── THE TURN ITSELF ───────────────────────────────────────────────────
  //
  // Clockwise on the plan, which with x running right and z running down is
  // (x, z) -> (-z, x): a point to the east goes to the south. That is the
  // direction the E-mark table already runs in -- E1 south, E2 west, E3 north,
  // E4 east reads clockwise -- so one turn moves each elevation one seat along
  // and cut-marks needs an index shift and nothing else.
  // A MILLIONTH OF A FOOT, which is where the lattice is. Not a tolerance for
  // comparing things -- a place to land, so that turning and turning back is
  // the same number and not merely a near one.
  const LATTICE = 1e6;
  const snap = value => Math.round(value * LATTICE) / LATTICE;

  const spin = (pt, turns) => {
    let x = Number(pt.x), z = Number(pt.z);
    for (let i = 0; i < (((turns % 4) + 4) % 4); i += 1) {
      const wasX = x;
      x = -z;
      z = wasX;
    }
    return { x, z };
  };
  // ABOUT A CENTRE, which is the house's own box. Turning about the world
  // origin would send a house drawn away from it into the next county.
  const turnPoint = (pt, centre, turns) => {
    if (!pt || !Number.isFinite(Number(pt.x)) || !Number.isFinite(Number(pt.z))) return pt;
    const local = spin({ x: Number(pt.x) - centre.x, z: Number(pt.z) - centre.z }, turns);
    // EVERY OTHER FIELD SURVIVES. A wall's point carries `srcId` linking it to
    // a boneyard master, and a rotation that rebuilt it as a bare {x, z} would
    // cut every one of those links -- silently, since nothing reads srcId
    // until a body is asked what it belongs to.
    return { ...pt, x: snap(centre.x + local.x), z: snap(centre.z + local.z) };
  };

  // THE HOUSE'S OWN BOX, off the plan walls -- the same extents cut-marks
  // rings and MODEL fits to, so a turn lands the house back in the same place
  // rather than sliding it across the sheet. levelId > 0 leaves the boneyard
  // out, which is the one rule every one of those readers already shares.
  const planCentre = drawing => {
    const walls = (Array.isArray(drawing?.walls) ? drawing.walls : [])
      .filter(w => Number(w?.levelId) > 0 && w?.start && w?.end);
    if (!walls.length) return { x: 0, z: 0 };
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    walls.forEach(w => [w.start, w.end].forEach(pt => {
      minX = Math.min(minX, Number(pt.x)); maxX = Math.max(maxX, Number(pt.x));
      minZ = Math.min(minZ, Number(pt.z)); maxZ = Math.max(maxZ, Number(pt.z));
    }));
    if (![minX, maxX, minZ, maxZ].every(Number.isFinite)) return { x: 0, z: 0 };
    return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
  };

  // ── TURNING A WHOLE DRAWING ───────────────────────────────────────────
  //
  // A NEW RECORD, not a mutation. The caller holds the drawing the page is
  // painting from, and a rotation that edited it in place would turn the house
  // under a half-finished gesture.
  const rotateDrawing = (drawing, turns = 1) => {
    const n = (((Number(turns) || 0) % 4) + 4) % 4;
    if (!drawing || typeof drawing !== 'object') return drawing;
    if (n === 0) return { ...drawing };
    const centre = planCentre(drawing);
    const out = { ...drawing };
    ROTATED.forEach(rule => {
      const list = drawing[rule.key];
      if (!Array.isArray(list)) return;
      out[rule.key] = list.map(item => {
        if (!item || typeof item !== 'object') return item;
        const next = { ...item };
        (rule.at || []).forEach(field => {
          if (next[field]) next[field] = turnPoint(next[field], centre, n);
        });
        (rule.spin || []).forEach(field => {
          if (next[field]) next[field] = { ...next[field], ...spin(next[field], n) };
        });
        if (rule.points && Array.isArray(next.points)) {
          next.points = next.points.map(pt => turnPoint(pt, centre, n));
        }
        if (rule.bare && Number.isFinite(Number(next.x)) && Number.isFinite(Number(next.z))) {
          const moved = turnPoint({ x: next.x, z: next.z }, centre, n);
          next.x = moved.x;
          next.z = moved.z;
        }
        // AN ODD TURN SWAPS THE SIDES. Two turns is upside down and the same
        // way round, so the swap is on odd turns only.
        if (rule.swapSize && n % 2 === 1
          && Number.isFinite(Number(next.widthFt)) && Number.isFinite(Number(next.heightFt))) {
          const was = next.widthFt;
          next.widthFt = next.heightFt;
          next.heightFt = was;
        }
        return next;
      });
    });
    // THE DATUM TURNS WITH THE HOUSE. It is the drafter's own zero -- the
    // point their first click set -- and the grid is anchored to it, so a
    // datum left behind puts the grid at an angle to the walls it was drawn
    // against.
    if (drawing.drawingOrigin) {
      out.drawingOrigin = turnPoint(drawing.drawingOrigin, centre, n);
    }
    // AND THE DRAWING REMEMBERS HOW FAR ROUND IT HAS BEEN TURNED, because the
    // elevation marks need it: E1 keeps its wall, so after one turn its mark
    // stands on the west rather than the south. cut-marks reads this and
    // shifts each elevation one seat along; nothing else needs to know.
    out.planTurn = ((((Number(drawing.planTurn) || 0) + n) % 4) + 4) % 4;
    return out;
  };

  // ── TURNING A DRAWING WHERE IT LIES, FOR A BUILDER ────────────────────
  //
  // Movie, 1 Oct: *"i'd like the drawings to start out with E1 on the right
  // side looking leftwards towards the house"*. The premade house and the
  // ordered garage are written front-down -- E1's own seat with no turn -- so
  // MODEL turns the drawing back to that seat, lets the builder work, and
  // turns everything forward again, the new building with it.
  //
  // IN PLACE, the opposite of rotateDrawing's bargain, and for the one reason
  // that bargain cannot serve: the builder's undo step holds its walls and
  // records BY IDENTITY, and a copy would leave Ctrl+Z hunting objects that
  // are no longer in the drawing. So the POINT OBJECTS move, and every record
  // and every undo step keeps holding the same ones.
  //
  // ABOUT THE ORIGIN, which is what makes back-and-forward exact: a turn about
  // zero is a swap and a negation with no centre to add and take away, so the
  // walls a drafter already drew come back to the bit, not merely to the
  // lattice. ONCE PER OBJECT, because a corner two walls share is one object
  // and turning it once per wall would turn it twice.
  //
  // `also` takes points held outside the drawing's lists -- MODEL's corner
  // pool -- which must turn with the walls or a new wall would merge onto a
  // corner standing in the other frame. planTurn is NOT touched: the caller
  // turns back and forward, and the count is where it started.
  const turnInPlace = (drawing, turns = 1, { also = [] } = {}) => {
    const n = (((Number(turns) || 0) % 4) + 4) % 4;
    if (!n || !drawing || typeof drawing !== 'object') return drawing;
    const seen = new Set();
    const move = pt => {
      if (!pt || typeof pt !== 'object' || seen.has(pt)) return;
      if (!Number.isFinite(Number(pt.x)) || !Number.isFinite(Number(pt.z))) return;
      seen.add(pt);
      const next = spin(pt, n);
      pt.x = next.x;
      pt.z = next.z;
    };
    ROTATED.forEach(rule => {
      const list = drawing[rule.key];
      if (!Array.isArray(list)) return;
      list.forEach(item => {
        if (!item || typeof item !== 'object') return;
        (rule.at || []).forEach(field => move(item[field]));
        (rule.spin || []).forEach(field => move(item[field]));
        if (rule.points && Array.isArray(item.points)) item.points.forEach(move);
        if (rule.bare) move(item);
        if (rule.swapSize && n % 2 === 1
          && Number.isFinite(Number(item.widthFt)) && Number.isFinite(Number(item.heightFt))) {
          const was = item.widthFt;
          item.widthFt = item.heightFt;
          item.heightFt = was;
        }
      });
    });
    move(drawing.drawingOrigin);
    (Array.isArray(also) ? also : []).forEach(move);
    return drawing;
  };

  window.DraftPlanRotate = Object.freeze({
    turnInPlace,
    QUARTER_TURNS,
    LATTICE,
    snap,
    ROTATED,
    NOT_ROTATED,
    spin,
    turnPoint,
    planCentre,
    rotateDrawing,
  });
})();
}
