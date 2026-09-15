// BUILDING BODIES — what a drawing already holds, and what it may still take.
//
// Movie's standing rule for a project: "only 1 house and 1 detached garage
// maximum". Everything that asks "is there room for another one of these"
// asks it here, so the cap is one fact rather than one fact per page.
//
// ── WHAT A BODY IS ───────────────────────────────────────────────────────
// A footprint is an OUTLINE. A garage outline carries `garage: true`; a
// house outline does not. A garage is DETACHED when it says so, or when the
// boneyard master it was stamped from says so -- the same two-ways-round
// read MODEL.html's accessor already does for foundations, because a stamped
// copy carries the master's id rather than its properties.
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
  // it hangs off, which is why it does not spend the detached garage's slot.
  const hasAttachedGarage = drawing =>
    outlinesOf(drawing).some(o => isGarage(o) && !isDetached(drawing, o));

  // WHAT THE PROJECT COULD STILL TAKE, in the order a drafter builds them.
  // Empty means the project is full, and a caller with nothing to offer
  // should offer nothing rather than open an empty board.
  const missing = drawing => {
    const left = [];
    if (!hasHouse(drawing)) left.push('house');
    if (!hasDetachedGarage(drawing)) left.push('detachedGarage');
    return left;
  };

  const isFull = drawing => missing(drawing).length === 0;

  window.DraftBuildingBodies = Object.freeze({
    hasHouse, hasDetachedGarage, hasAttachedGarage, missing, isFull,
  });
})();
}
