// OUTLINE MASTERS AND THEIR PER-LEVEL COPIES — the persisted shape of a house
// outline, in one place, so two pages cannot disagree about it.
//
// A drawn outline is stored TWICE over. The master lives on a BONEYARD shelf
// and owns the common geometry; every regular level carries a copy that points
// back at it, corner by corner, so moving a master point moves that corner on
// every floor while a level edit stays local. That linkage is the whole
// feature, and it is carried by two identifiers -- `masterId` on the copy and
// `srcId` on each of its points -- which are easy to write and impossible to
// notice missing: an outline with no links renders exactly like one with them
// until someone drags a master point and nothing follows.
//
// WHY THIS IS A MODULE AND NOT A SECOND COPY. MODEL.dc.html has derived this
// shape since the beginning; MODEL.html now needs to WRITE it too, and a
// hand-rolled twin is how #401 lost a shard. The arithmetic lives here and
// both pages call it. What each page does with the result is its own business:
// DC materialises points as THREE.Vector3 so its drag code can move them in
// place, MODEL.html keeps plain objects. That seam is deliberate -- the FORMAT
// is shared, the object type is not.
//
// THE NAME TRAP, and it is the reason to read this comment before editing.
// A master point's identifier is spelled TWO ways for the same value:
//
//   storage            `id`        (drawing-format.js writes it)
//   MODEL.dc.html      `pointId`   (its loader renames it in memory)
//
// So a copy built from a freshly parsed save must read `id`, and one built
// from DC's live memory must read `pointId`. Reading the wrong one does not
// throw: it yields undefined, every copy point gets `srcId: undefined`, and
// the outline looks perfect while being linked to nothing. masterPointId reads
// either and REFUSES a point carrying neither, because a missing link has to
// be loud at the moment it is made rather than silent until a drag.
if (!window.DraftOutlineMaster) {
(() => {
  // The layer every outline copy is drawn on. MODEL.dc.html:2627 has held this
  // string since outlines existed; it is here so the copy shape is complete in
  // one place rather than complete in one place plus a constant in another.
  const OUTLINE_LAYER = 'OUTLINE';

  // A master point's id, whichever of its two spellings it arrives in. See
  // THE NAME TRAP above. Refusing is the point: the alternative is `undefined`
  // travelling into srcId, where it looks like a link and is not one.
  const masterPointId = point => {
    const id = point?.pointId ?? point?.id;
    if (id === undefined || id === null || id === '') {
      throw new Error('outline master point has neither pointId nor id — '
        + 'a copy built from it would carry srcId: undefined and link to nothing');
    }
    return id;
  };

  // THE MASTER, from a closed loop of plain {x, z} corners.
  //
  // `y` is not stored on a master point and never was: the master is the
  // common plan geometry, and the height it is drawn at belongs to the level
  // reading it, which is why copyForLevel takes the elevation from the level
  // and not from here.
  //
  // Ids are injected rather than minted here. A page's id counter is its own
  // and has to stay the single source of the next number -- a module with its
  // own counter would hand out ids the page believes are free.
  const masterFromLoop = ({ points, shelfId, sourceLevelId = null, newItemId, newPointId }) => {
    if (typeof newItemId !== 'function' || typeof newPointId !== 'function') {
      throw new Error('masterFromLoop needs newItemId and newPointId from the page that owns the id counter');
    }
    const loop = (points || []).map(point => ({ x: point.x, z: point.z }));
    if (loop.length < 3) {
      throw new Error(`an outline master needs at least three corners, got ${loop.length}`);
    }
    return {
      id: newItemId(),
      shelfId,
      sourceLevelId,
      garage: false,
      marks: [],
      points: loop.map(point => ({ x: point.x, z: point.z, pointId: newPointId() })),
    };
  };

  // THE COPY that one level carries of a master.
  //
  // Returns a DESCRIPTOR, not the page's own object: `points` are plain
  // {x, y, z, srcId, bulge, attach} and the caller materialises them. DC turns
  // each into a Vector3 (and, for an attached garage, may swap in the house
  // copy's existing Vector3 so the shared node drags both outlines at once --
  // which is why `attach` is carried through rather than resolved here; point
  // IDENTITY is a page concern, and this module has no page to ask).
  //
  // The flags are copied from the master rather than defaulted, because they
  // describe the same outline seen from a different floor: a garage master's
  // copy is a garage, an open run's copy is open.
  const copyForLevel = (master, level, { newItemId }) => {
    if (typeof newItemId !== 'function') {
      throw new Error('copyForLevel needs newItemId from the page that owns the id counter');
    }
    if (!master || !level) throw new Error('copyForLevel needs both a master and a level');
    const elev = Number(level.elev) || 0;
    return {
      id: newItemId(),
      masterId: master.id,
      levelId: level.id,
      garage: master.garage === true,
      open: master.open === true,
      detached: master.detached === true,
      foundation: master.foundation || null,
      points: (master.points || []).map(point => ({
        x: point.x,
        y: elev,
        z: point.z,
        srcId: masterPointId(point),
        bulge: point.bulge || 0,
        attach: point.attach || null,
      })),
      overriddenSrcIds: [],
      layer: OUTLINE_LAYER,
    };
  };

  // Every level's copy of one master, in the levels' own order. The loop is
  // here rather than at three call sites for the reason the module is here.
  const copiesForLevels = (master, levels, opts) =>
    (levels || []).map(level => copyForLevel(master, level, opts));

  // THE SAME MASTER, SPELLED THE WAY THE FILE SPELLS IT.
  //
  // masterFromLoop hands back `pointId`, because that is what MODEL.dc.html
  // holds in memory and it is the page that has always built these. Storage
  // spells the same value `id` (drawing-format.js), and MODEL.dc.html's loader
  // is what renames it on the way in.
  //
  // MODEL.html has no loader and no serializer in between: what it pushes IS
  // what reaches the file. So it needs the storage spelling at the moment of
  // writing, and the rename belongs HERE rather than in a page -- it is the
  // same fact the reader half already owns, and a page that renamed keys on
  // its own would be keeping format knowledge the module exists to hold.
  //
  // Idempotent on purpose: a master already in storage spelling passes through
  // unchanged, so calling it twice cannot strip an id away.
  const storageMaster = master => {
    if (!master) throw new Error('storageMaster needs a master');
    return {
      ...master,
      points: (master.points || []).map(point => {
        const { pointId, ...rest } = point;
        return { ...rest, id: masterPointId(point) };
      }),
    };
  };

  window.DraftOutlineMaster = Object.freeze({
    OUTLINE_LAYER,
    masterPointId,
    masterFromLoop,
    storageMaster,
    copyForLevel,
    copiesForLevels,
  });
})();
}
