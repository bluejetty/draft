// RELOAD THE HOUSE TO THE PROJECT PAGE'S NUMBERS (Movie, 20 Oct): "i forgot
// to enter the PROJECT info first. i would like to tranform the existing
// outline wall and roof to the new contstuction type and heights" ... "to
// reload press the bone in project area once you pick your numbers and kinds
// of stuff youd like" ... "heights and attachement methods should all be
// able to change easily i hope, but the changing storeys of building type
// would be too hard cause problems".
//
// THE FOLLOW THAT ALREADY EXISTS IS NOT THIS. level-assembly.js moves a wall
// when the storey's number changes WHILE the wall stands at the old number,
// and reshapes a roof when the pitch or overhang changes. A wall drawn by
// hand stands at the WALL tool's 8'-0", not the storey's 8'-1 1/8", so no
// change ever catches it; and a wall TYPE is never followed at all. This is
// the explicit pass: the house as it stands, brought to the page as it reads
// now, pressed on purpose.
//
// WHAT FOLLOWS, AND WHAT IS LEFT ALONE:
//   - HEIGHT. On each level the TALLEST walls are the storey's walls and go
//     to the storey's WALL HT; a shorter wall (a pony wall, a half wall) was
//     cut down on purpose and keeps its height. The attached garage's walls
//     go to the garage's own top, the way the PROJECT page already treats
//     them. Grade beams and frost walls under the garage, and a detached
//     garage's walls, answer other rows and are not touched.
//   - TYPE. Only the SHELL: a wall lying on an outline of its level. Interior
//     partitions keep whatever they were framed in. The foundation borrows
//     the storeys' outlines, because raiseFoundationUnder records none of
//     its own. A level's type is the PROJECT page's own resolution -- the
//     level's assembly override, else the shared exterior type; the
//     foundation its own list -- and an unset one changes nothing.
//   - ROOF. Every roof that follows a PROJECT row (house, attached, detached)
//     is reshaped to that row's pitch and overhang; a ROOF-tool roof
//     (`follows: 'none'`) stays the drafter's. When a wall top moved, the
//     bungalow's roofs regroup (garage-roofs.js) exactly as a PROJECT save
//     would make them.
//   - THE TYPE OF HOUSE does not change here, and PROJECT.html locks the
//     choice while walls stand. BUNGALOW to 2 STOREY is a different house;
//     NEW is how that starts.
//
// Null when nothing changed, so the caller leaves the keys alone.
if (!window.DraftProjectReload) {
(() => {
  const LA = () => window.DraftLevelAssembly;
  const GR = () => window.DraftGarageRoofs;
  const G = () => window.DraftGeometry2D;

  // The lists wall-types.js publishes, mirrored for a page that does not
  // load it (PROJECT.html keeps its own copies for the same reason).
  const EXTERIOR_TYPES = Object.freeze(['stud_2x4', 'stud_2x6', 'icf', 'icf_13']);
  const FOUNDATION_TYPES = Object.freeze(['concrete_8', 'icf', 'icf_13', 'pt_wood_fdn']);
  const exteriorIds = () => window.DraftWallTypes?.EXTERIOR_WALL_TYPE_IDS || EXTERIOR_TYPES;
  const foundationIds = () => window.DraftWallTypes?.FOUNDATION_WALL_TYPE_IDS || FOUNDATION_TYPES;

  const EPS = 1e-6;
  const num = value => (Number.isFinite(Number(value)) ? Number(value) : null);
  const viewOf = wall => (wall?.view === 'foundation' ? 'foundation' : 'plan');

  // A wall this pass may look at: one standing on a level the drawing lists.
  // A BONEYARD shelf's suites (negative level ids, no level record) are a
  // parts bin, not the house, and keep what they came with.
  const standingOn = levelIds => wall => !!(wall && wall.start && wall.end
    && wall.levelId != null && levelIds.has(Number(wall.levelId)));

  // THE SHELL'S RINGS, by level.
  const ringsByLevel = drawing => {
    const byLevel = new Map();
    (drawing?.outlines || []).forEach(outline => {
      if (!outline) return;
      const points = Array.isArray(outline.points) ? outline.points : [];
      if (points.length < 3) return;
      const id = Number(outline.levelId);
      if (!byLevel.has(id)) byLevel.set(id, []);
      byLevel.get(id).push(G().loopSegments(points.map(pt => ({ x: Number(pt.x), z: Number(pt.z) }))));
    });
    return byLevel;
  };
  // A level with outlines of its own answers with them; one without -- the
  // FOUNDATION under a house, a storey traced freehand -- borrows every
  // outline in the drawing, since the shell stacks.
  const ringsFor = (byLevel, levelId) => {
    const own = byLevel.get(Number(levelId));
    if (own && own.length) return own;
    return [...byLevel.values()].flat();
  };

  const reloadHouse = (drawing, { offsetVariable } = {}) => {
    const walls = Array.isArray(drawing?.walls) ? drawing.walls : [];
    if (!walls.length) return null;
    const L = LA(), R = GR(), geo = G();
    const table = drawing.levelAssemblies;
    const levelIds = new Set((drawing.levels || []).map(level => Number(level.id)));
    const standing = standingOn(levelIds);
    const byLevel = ringsByLevel(drawing);
    const isDetached = R.detachedWallTest(drawing);
    const bodies = R.bodiesOf(drawing);
    const garageTop = R.garageTopFt(drawing, bodies ? bodies.garage : null);
    const activeType = exteriorIds().includes(drawing.activeWallType) ? drawing.activeWallType : null;

    // THE TALLEST WALL IN EACH GROUP is the storey's wall. Grouped by level,
    // view and body, because the garage's walls stand on the house's level
    // at a different height and must not make the house's look short -- and
    // a detached garage's, at its own, must not make the attached one's.
    const bodyOf = wall => (wall.body !== 'garage' ? 'house' : (isDetached(wall) ? 'detached' : 'garage'));
    const groupKey = wall => `${Number(wall.levelId)}|${viewOf(wall)}|${bodyOf(wall)}`;
    const tallest = new Map();
    walls.forEach(wall => {
      if (!standing(wall)) return;
      const top = num(wall.topHeight);
      if (top == null) return;
      const key = groupKey(wall);
      tallest.set(key, Math.max(tallest.get(key) ?? -Infinity, top));
    });

    const topFor = wall => {
      if (wall.body === 'garage') {
        // Grade beams and frost walls hang off the foundation datum; a
        // detached garage has its own row. Neither is the attached garage's
        // wall height.
        if (viewOf(wall) === 'foundation' || isDetached(wall)) return null;
        return garageTop;
      }
      return L.levelAssemblyFor(table, wall.levelId).wallHeightFt;
    };
    const typeFor = wall => {
      // A grade beam under the garage is a beam, not a foundation wall; a
      // detached garage answers its own row.
      if (wall.body === 'garage' && (isDetached(wall) || viewOf(wall) === 'foundation')) return null;
      const rings = ringsFor(byLevel, wall.levelId);
      if (!rings.some(ring => geo.edgeOnLoop(wall.start, wall.end, ring))) return null;
      const asm = L.levelAssemblyFor(table, wall.levelId);
      if (viewOf(wall) === 'foundation') {
        return foundationIds().includes(asm.wallType) ? asm.wallType : null;
      }
      return exteriorIds().includes(asm.wallType) ? asm.wallType : activeType;
    };

    let moved = 0, retyped = 0;
    const nextWalls = walls.map(wall => {
      if (!standing(wall)) return wall;
      let next = wall;
      const top = num(wall.topHeight);
      const want = topFor(wall);
      if (top != null && Number.isFinite(want)
        && Math.abs(top - tallest.get(groupKey(wall))) < EPS
        && Math.abs(top - want) > EPS) {
        next = { ...next, topHeight: want };
        moved += 1;
      }
      const type = typeFor(wall);
      if (type && type !== wall.wallType) {
        next = { ...next, wallType: type };
        retyped += 1;
      }
      return next;
    });

    let reshaped = 0;
    const roofs = Array.isArray(drawing.roofs) ? drawing.roofs : [];
    let nextRoofs = roofs;
    if (typeof offsetVariable === 'function' && roofs.length) {
      nextRoofs = roofs.map(roof => {
        const row = L.roofFollows(roof);
        if (!row) return roof;
        const out = L.reshapeRoof(roof, L.projectRoofFor(drawing, row), offsetVariable);
        if (out !== roof) reshaped += 1;
        return out;
      });
      if (!reshaped) nextRoofs = roofs;
    }
    // A moved top can bring the house and garage tops together or apart,
    // and that is one roof or two (garage-roofs.js).
    if (moved) {
      const regrouped = R.regroupRoofs({ ...drawing, walls: nextWalls, roofs: nextRoofs });
      if (regrouped) nextRoofs = regrouped;
    }
    if (!moved && !retyped && nextRoofs === roofs) return null;
    return { walls: nextWalls, roofs: nextRoofs, moved, retyped, reshaped };
  };

  // Whether a house stands to reload: walls on the sheet. An outline alone
  // is a plan not yet raised, and the BONE still builds it.
  const houseStands = drawing => (Array.isArray(drawing?.walls) ? drawing.walls : [])
    .some(wall => wall && wall.start && wall.end);

  window.DraftProjectReload = Object.freeze({ reloadHouse, houseStands });
})();
}
