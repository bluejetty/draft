// GARAGE SITE — where a detached garage stands, and how big its loop is.
//
// Movie, 15 Sep: "now i need the garage to be AUTOBUILT". A garage ordered
// off the board is not traced, so the page has to decide the one thing a
// trace would otherwise have said: where the box goes. That decision is a
// domain rule, so it lives here and not in the page —
// RD-DOCUMENTS/RULING-a-ported-rule-keeps-one-home.md. PROJECT will want
// the same answer the day it offers to place one.
//
// ── THE RULE ─────────────────────────────────────────────────────────────
// A detached garage stands BESIDE what is already built, never on top of
// it: east of everything drawn, one yard-gap clear, with its door wall on
// the same line as the house's front. An empty sheet has no house to stand
// beside, so the garage takes the middle of it.
//
// WIDTH IS ACROSS THE DOOR WALL and depth is back from it —
// build-menu.js's own naming, kept, because a 16x24 laid out as a 24x16 is
// a different building.
//
// It reads points and returns points. It mints no ids, writes nothing, and
// knows nothing about walls.
if (!window.DraftGarageSite) {
(() => {
  // A YARD BETWEEN THE TWO BODIES. Ten feet is the gap a drafter can see is
  // deliberate and can still drag closed; touching would read as an
  // attached garage, which is a different body altogether.
  const SETBACK_FT = 10;

  const pointsOf = thing => (Array.isArray(thing?.points) ? thing.points : []);

  // WHAT IS ALREADY STANDING on this level, as one box, or null for an
  // empty level. Walls count as well as outlines: a DRAFTING drawing has no
  // bone at all, and placing a garage through the middle of a hand-drawn
  // house because it carried no outline would be the whole bug.
  const occupied = (drawing, levelId) => {
    const xs = [];
    const zs = [];
    const take = pt => {
      if (!Number.isFinite(pt?.x) || !Number.isFinite(pt?.z)) return;
      xs.push(pt.x);
      zs.push(pt.z);
    };
    const onLevel = thing => Number(thing?.levelId) === Number(levelId);
    ((drawing && drawing.outlines) || []).filter(onLevel)
      .forEach(outline => pointsOf(outline).forEach(take));
    ((drawing && drawing.walls) || []).filter(onLevel)
      .forEach(wall => { take(wall.start); take(wall.end); });
    if (!xs.length) return null;
    return {
      minX: Math.min(...xs), maxX: Math.max(...xs),
      minZ: Math.min(...zs), maxZ: Math.max(...zs),
    };
  };

  // THE LOOP, CLOCKWISE FROM THE FRONT-LEFT CORNER. Four corners, closed by
  // the caller returning to the first — the same shape a traced loop has,
  // so whoever commits it treats both the same.
  const plot = (size, standing) => {
    const w = Number(size?.widthFt);
    const d = Number(size?.depthFt);
    if (!Number.isFinite(w) || !Number.isFinite(d) || w <= 0 || d <= 0) return null;
    // The door wall faces the viewer (+z), so depth runs back from it.
    const frontZ = standing ? standing.maxZ : d / 2;
    const leftX = standing ? standing.maxX + SETBACK_FT : -w / 2;
    return [
      { x: leftX, z: frontZ - d },
      { x: leftX + w, z: frontZ - d },
      { x: leftX + w, z: frontZ },
      { x: leftX, z: frontZ },
    ];
  };

  const plotFor = (drawing, levelId, size) =>
    plot(size, occupied(drawing, levelId));

  window.DraftGarageSite = Object.freeze({
    SETBACK_FT, occupied, plot, plotFor,
  });
})();
}
