// BUILDING BODIES — what a drawing already holds, and what it may still take.
//
// Movie's standing rule for a file: "1 autobuilt BUILDING per DRAFT file (a
// BUILDING would be a HOUSE or a DETACHED GARAGE)". The cap is on the PAIR
// rather than one slot each, which is the whole of the change: a house and a
// detached garage can no longer share a file, and whichever gets built first
// closes the board to both.
//
// Everything that asks "is there room for another one of these" asks it here,
// so the cap is one fact rather than one fact per page.
//
// ── WHAT A BODY IS ───────────────────────────────────────────────────────
// A footprint is an OUTLINE. A garage outline carries `garage: true`; a
// house outline does not. A garage is DETACHED when it says so, or when the
// boneyard master it was stamped from says so -- the same two-ways-round
// read MODEL.html's accessor already does for foundations, because a stamped
// copy carries the master's id rather than its properties.
//
// AN ATTACHED GARAGE IS NOT A BUILDING, and this is the reason the rule can
// be this blunt. It is part of the house it hangs off, so it spends no slot
// and carries no cap of its own -- Movie, asked directly whether two of them
// were allowed: "2 or more can be allowed for attached garage i think". A
// house with three of them is one building.
//
// ── WHY A MODULE ─────────────────────────────────────────────────────────
// Three pages will want it: MODEL refuses a bone that has nothing left to
// build, PROJECT lists the bodies, and the drive-thru will grey the tiles
// for a body the project already has. Written in one of them, the other two
// would each re-derive "is there a house", and the day a garage gains a
// second way of being detached, two of the three would be wrong --
// RD-DOCUMENTS/RULING-a-ported-rule-keeps-one-home.md.
//
// It reads a drawing and returns answers. It moves nothing, stores nothing,
// and knows no geometry beyond which list footprints live in.
if (!window.DraftBuildingBodies) {
(() => {
  const outlinesOf = drawing => (drawing && drawing.outlines) || [];

  // A stamped outline carries `masterId`; a master carries `shelfId`. Either
  // can be the one holding `detached`.
  const masterOf = (drawing, outline) => {
    if (!outline) return null;
    if (outline.shelfId != null) return outline;
    return ((drawing && drawing.boneyardOutlines) || [])
      .find(master => master.id === outline.masterId) || null;
  };

  const isGarage = outline => outline?.garage === true;
  const isDetached = (drawing, outline) =>
    outline?.detached === true || masterOf(drawing, outline)?.detached === true;

  // THE HOUSE IS EVERY FOOTPRINT THAT IS NOT A GARAGE, on any level. A two
  // storey house is one body with an outline per storey, so this answers
  // "is there a house", never "how many".
  const hasHouse = drawing => outlinesOf(drawing).some(o => !isGarage(o));

  const hasDetachedGarage = drawing =>
    outlinesOf(drawing).some(o => isGarage(o) && isDetached(drawing, o));

  // AN ATTACHED GARAGE IS NOT A BODY OF ITS OWN -- it is part of the house
  // it hangs off, which is why it does not spend the building's slot.
  const hasAttachedGarage = drawing =>
    outlinesOf(drawing).some(o => isGarage(o) && !isDetached(drawing, o));

  // THE ONE QUESTION THE CAP IS MADE OF. Note what it does NOT ask: how the
  // body got there. A hand-traced house counts exactly as much as an
  // autobuilt one, because the drafter looking at the screen sees a house
  // either way and a second building would land on top of it regardless.
  const hasBuilding = drawing => hasHouse(drawing) || hasDetachedGarage(drawing);

  // WHAT THE FILE COULD STILL TAKE. With nothing standing, EITHER is
  // offerable and the drafter picks which; with a building standing, neither
  // is. So this is two-or-nothing, never one -- the shape a caller greying
  // tiles needs, and the reason it stays a list rather than a boolean.
  //
  // Empty means full, and a caller with nothing to offer should offer
  // nothing rather than open an empty board.
  const missing = drawing =>
    hasBuilding(drawing) ? [] : ['house', 'detachedGarage'];

  // THE SAME BOOLEAN AS hasBuilding, and said so rather than left to be
  // discovered: under a one-per-file cap "holds a building" and "has no room"
  // are one fact, so a reader comparing them will find no difference and
  // should not have to go looking. They are kept apart because they are asked
  // by different callers about different things -- hasBuilding is about the
  // FILE, isFull is about the BOARD -- and because the day a third body joins
  // the rule they stop coinciding, with missing() the one that has to change.
  const isFull = drawing => missing(drawing).length === 0;

  // ── WHICH OUTLINE IS THE HOUSE ON THIS STOREY ────────────────────────────
  //
  // Lifted from MODEL.html, where it was four page-local helpers, because a
  // SECOND page now needs the same answer: plan-composition.js paints the
  // Construction Layout sheets and the window size tag has to know which way
  // is OUT of the house before it can sit on the exterior side of the glass.
  //
  // THE APPROXIMATION WAS CONSIDERED AND REJECTED. "The largest non-garage
  // outline on the level" agrees with this on an ordinary house and disagrees
  // exactly where a body sits OVER the garage -- the case bodyOverGarage
  // exists for -- so the sheet would tag the wrong side of a wall in the one
  // situation the rule was written to handle. One answer, used twice, is
  // cheaper than two answers that agree most of the time.
  //
  // drawing IS A PARAMETER NOW. All four read MODEL's closure; here they take
  // the drawing, which is what let them move at all.
  const OVER_GARAGE_BODY_SHARE = 0.5;

  // EVEN-ODD, and this is the FOURTH implementation of it in this repo rather
  // than a fifth: geometry-2d.js carries two private copies (:834 and :909)
  // and exports neither, and MODEL.html's was the third. MODEL delegates here
  // now, so the count does not rise.
  //
  // IT IS MODEL's FORM, not geometry-2d's, and the difference is real: this
  // one guards the zero denominator with Number.EPSILON where those two
  // divide by (pj.z - pi.z) outright. A horizontal edge is the case that
  // separates them. Which is right is a question for whoever unifies the
  // three, and it is not being decided here by picking quietly.
  const pointInLoop = (points, at) => {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i], b = points[j];
      const crosses = ((a.z > at.z) !== (b.z > at.z))
        && (at.x < (b.x - a.x) * (at.z - a.z) / ((b.z - a.z) || Number.EPSILON) + a.x);
      if (crosses) inside = !inside;
    }
    return inside;
  };

  // Every non-garage footprint drawn on one storey.
  const storeyBodies = (drawing, storeyId) => outlinesOf(drawing)
    .filter(outline => Number(outline.levelId) === Number(storeyId)
      && outline.garage !== true
      && (outline.points || []).length >= 3)
    .map(outline => ({ outline, storeyId }));

  // A SAMPLED SHARE, not a corner test: a body counts as over the garage when
  // more than half the points inside it are also inside a garage, anywhere in
  // the file. A room over the garage is a body whose whole footprint sits on
  // one, and a house that merely touches a garage at a corner is not.
  const bodyOverGarage = (drawing, outline) => {
    const garages = [];
    ((drawing && drawing.levels) || []).forEach(level => {
      outlinesOf(drawing).forEach(other => {
        if (other.garage === true && (other.points || []).length >= 3
          && Number(other.levelId) === Number(level.id)) garages.push(other);
      });
    });
    if (!garages.length) return false;
    const pts = outline.points;
    const xs = pts.map(pt => pt.x), zs = pts.map(pt => pt.z);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const z0 = Math.min(...zs), z1 = Math.max(...zs);
    const N = 12;
    let inBody = 0, over = 0;
    for (let i = 0; i < N; i += 1) {
      for (let j = 0; j < N; j += 1) {
        const at = { x: x0 + ((i + 0.5) / N) * (x1 - x0), z: z0 + ((j + 0.5) / N) * (z1 - z0) };
        if (!pointInLoop(pts, at)) continue;
        inBody += 1;
        if (garages.some(g => pointInLoop(g.points, at))) over += 1;
      }
    }
    return inBody > 0 && over / inBody > OVER_GARAGE_BODY_SHARE;
  };

  const houseOutlineOn = (drawing, levelId) => {
    const level = ((drawing && drawing.levels) || [])
      .find(item => Number(item.id) === Number(levelId));
    const bodies = level ? storeyBodies(drawing, level.id) : [];
    if (!bodies.length) return null;
    const ownArea = outline => Math.abs(outline.points.reduce((sum, pt, i) => {
      const next = outline.points[(i + 1) % outline.points.length];
      return sum + (pt.x * next.z - next.x * pt.z);
    }, 0) / 2);
    const house = bodies.filter(body => !bodyOverGarage(drawing, body.outline));
    // Nothing left means every body on this storey sits over the garage --
    // a detached garage with a room over it, which is exactly the case Movie
    // says DOES want a stair. Fall back to last-one-wins rather than refuse.
    const pool = house.length ? house : bodies;
    return pool.reduce((best, body) =>
      ownArea(body.outline) > ownArea(best.outline) ? body : best).outline;
  };

  window.DraftBuildingBodies = Object.freeze({
    hasHouse, hasDetachedGarage, hasAttachedGarage, hasBuilding,
    missing, isFull,
    pointInLoop, storeyBodies, houseOutlineOn,
  });
})();
}
