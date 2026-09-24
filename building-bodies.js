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

  window.DraftBuildingBodies = Object.freeze({
    hasHouse, hasDetachedGarage, hasAttachedGarage, hasBuilding,
    missing, isFull,
  });
})();
}
