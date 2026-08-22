// Stored-drawing format: version and the pure readers that turn stored JSON into
// values the Model Space component can trust. Nothing here touches the DOM, the
// file store or component state, so both file loading and undo history use it.
if (!window.DraftDrawingFormat) {
(() => {
  // Bump when the stored shape changes; loads of any other version are refused.
  const VERSION = 1;

  const num = value => (Number.isFinite(Number(value)) ? Number(value) : null);

  const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);
  const positive = (value, fallback) => {
    const parsed = num(value);
    return parsed !== null && parsed > 0 ? parsed : fallback;
  };
  const number = (value, fallback) => num(value) ?? fallback;

  // { ok } when the object is a drawing of this exact version, otherwise a
  // reason: 'version' only for drawings from a newer Draft, 'invalid' for the rest.
  const checkEnvelope = saved => {
    if (!saved || typeof saved !== 'object' || !Array.isArray(saved.levels)) {
      return { ok: false, reason: 'invalid' };
    }
    if (saved.version !== VERSION) {
      return { ok: false, reason: Number(saved.version) > VERSION ? 'version' : 'invalid' };
    }
    return { ok: true, reason: 'loaded' };
  };

  const point = value => {
    if (!value) return null;
    const x = num(value.x);
    const z = num(value.z);
    if (x === null || z === null) return null;
    return { x, y: num(value.y) ?? 0, z };
  };

  const levelId = (value, levelIds) => {
    const id = Number(value);
    return levelIds.has(id) ? id : null;
  };

  const levels = rawLevels => (Array.isArray(rawLevels) ? rawLevels : [])
    .filter(level => level && Number.isFinite(Number(level.id)))
    .map(level => ({
      id: Number(level.id),
      name: String(level.name || 'LEVEL').toUpperCase(),
      elev: num(level.elev) ?? 0,
      visible: true,
    }));

  // Cuts predating explicit ownership keep a null levelId: two levels can share
  // an elevation, so guessing an owner could delete the wrong section later.
  const cuts = (rawCuts, levelIds) => {
    const seen = new Set();
    return (Array.isArray(rawCuts) ? rawCuts : []).map(cut => {
      const id = Number(cut?.id);
      const startPt = point(cut?.startPt);
      const endPt = point(cut?.endPt);
      const dirX = num(cut?.dirVec?.x);
      const dirZ = num(cut?.dirVec?.z);
      const elev = num(cut?.elev);
      if (!Number.isInteger(id) || seen.has(id) || !startPt || !endPt
        || dirX === null || dirZ === null || elev === null) return null;
      const dirLength = Math.hypot(dirX, dirZ);
      if (dirLength < 0.001) return null;
      seen.add(id);
      return {
        id,
        name: String(cut.name || 'SECTION').toUpperCase(),
        startPt: { x: startPt.x, z: startPt.z },
        endPt: { x: endPt.x, z: endPt.z },
        dirVec: { x: dirX / dirLength, z: dirZ / dirLength },
        elev,
        levelId: levelId(cut?.levelId, levelIds),
      };
    }).filter(Boolean);
  };

  const dimensions = (rawDimensions, levelIds) => {
    const seen = new Set();
    return (Array.isArray(rawDimensions) ? rawDimensions : []).map(dimension => {
      const id = Number(dimension?.id);
      const start = point(dimension?.start);
      const end = point(dimension?.end);
      const dimensionLevelId = levelId(dimension?.levelId, levelIds);
      const view = oneOf(dimension?.view, ['plan', 'floor', 'e-power', 'foundation'], null);
      if (!Number.isInteger(id) || seen.has(id) || !start || !end || dimensionLevelId == null || !view) return null;
      if (Math.hypot(end.x - start.x, end.z - start.z) < 0.001) return null;
      seen.add(id);
      return { id, start, end, levelId: dimensionLevelId, view, auto: dimension?.auto === true };
    }).filter(Boolean);
  };

  // Openings anchor to a host wall by id: type decides the CAD layer, offset
  // is the distance from the wall start to the opening centre along the wall.
  // Host-wall existence is the caller's check — walls restore after this runs.
  const fenestrations = (rawFenestrations, levelIds) => (Array.isArray(rawFenestrations) ? rawFenestrations : [])
    .map(opening => {
      const wallId = String(opening?.wallId || '').trim();
      const openingLevelId = levelId(opening?.levelId, levelIds);
      const type = oneOf(opening?.type, ['door', 'window'], null);
      const width = positive(opening?.width, null);
      const offset = num(opening?.offset);
      if (!wallId || openingLevelId == null || !type || width == null || offset === null || offset < 0) return null;
      const sillHeight = Math.max(0, number(opening?.sillHeight, 0));
      const headHeight = positive(opening?.headHeight, null);
      if (headHeight == null || headHeight <= sillHeight) return null;
      return {
        id: String(opening?.id || '').trim(),
        wallId,
        levelId: openingLevelId,
        view: oneOf(opening?.view, ['plan', 'foundation'], 'plan'),
        type,
        layer: type === 'door' ? 'A-DOOR' : 'A-GLAZ',
        offset,
        width,
        sillHeight,
        headHeight,
      };
    }).filter(Boolean);

  // Surface openings are free-form closed outlines cut from a host floor or
  // roof footprint (stairwells, skylights, chimneys). Host existence is the
  // caller's check — floors and roofs restore before openings resolve.
  const surfaceOpenings = (rawOpenings, levelIds) => (Array.isArray(rawOpenings) ? rawOpenings : [])
    .map(opening => {
      const openingLevelId = levelId(opening?.levelId, levelIds);
      const hostType = oneOf(opening?.hostType, ['floor', 'roof'], null);
      const hostId = String(opening?.hostId || '').trim();
      const points = (Array.isArray(opening?.points) ? opening.points : []).map(point).filter(Boolean);
      if (openingLevelId == null || !hostType || !hostId || points.length < 3) return null;
      return {
        id: String(opening?.id || '').trim(),
        hostType,
        hostId,
        points,
        levelId: openingLevelId,
        layer: hostType === 'roof' ? 'A-ROOF-OPNG' : 'A-FL-OPNG',
      };
    }).filter(Boolean);

  // Shapes are closed construction outlines owned by a level — drawn by hand
  // or captured from a wall network. They carry no roof or floor semantics;
  // the ROOF and FLOOR commands build their own geometry from a shape. A shape
  // may double as a flooring area: a finish type plus thickness laid over the
  // floor sheathing, saved on A-FL-FLOORING.
  const FLOORING_TYPES = ['hardwood', 'laminate', 'tile', 'carpet'];
  const flooring = raw => {
    const type = oneOf(raw?.type, FLOORING_TYPES, null);
    if (type == null) return null;
    return { type, thicknessIn: positive(raw?.thicknessIn, 3 / 8) };
  };
  const shapes = (rawShapes, levelIds) => (Array.isArray(rawShapes) ? rawShapes : [])
    .map(shape => {
      const shapeLevelId = levelId(shape?.levelId, levelIds);
      const points = (Array.isArray(shape?.points) ? shape.points : []).map(point).filter(Boolean);
      if (shapeLevelId == null || points.length < 3) return null;
      const shapeFlooring = flooring(shape?.flooring);
      return {
        id: String(shape?.id || '').trim(),
        points,
        levelId: shapeLevelId,
        sourceLevelId: levelId(shape?.sourceLevelId, levelIds),
        flooring: shapeFlooring,
        layer: shapeFlooring ? 'A-FL-FLOORING' : 'SHAPE',
      };
    }).filter(Boolean);

  // Roof footprints are closed outlines owned by a whole level; each footprint
  // segment classifies as EAVE or GABLE, and the overhang / pitch stay clamped
  // to the drafting limits so the stored heel is always derivable.
  const roofs = (rawRoofs, levelIds) => (Array.isArray(rawRoofs) ? rawRoofs : [])
    .map(roof => {
      const roofLevelId = levelId(roof?.levelId, levelIds);
      const points = (Array.isArray(roof?.points) ? roof.points : []).map(point).filter(Boolean);
      if (roofLevelId == null || points.length < 3) return null;
      return {
        id: String(roof?.id || '').trim(),
        points,
        levelId: roofLevelId,
        sourceLevelId: levelId(roof?.sourceLevelId, levelIds),
        sourceShapeId: String(roof?.sourceShapeId || '').trim() || null,
        edges: points.map((_, index) =>
          (Array.isArray(roof?.edges) && roof.edges[index] === 'gable' ? 'gable' : 'eave')),
        overhang: Math.min(6, Math.max(0, number(roof?.overhang, 2))),
        pitch: Math.min(24, Math.max(0, number(roof?.pitch, 4))),
        fascia: 5.5,
        garage: roof?.garage === true,
        plateHeightFt: Number.isFinite(Number(roof?.plateHeightFt)) ? Number(roof.plateHeightFt) : null,
        layer: 'A-ROOF',
      };
    }).filter(Boolean);

  // Columns are manual point supports (teleposts on pad footings) owned by a
  // level; the footing choice rides along so the FOUNDATION plan can mark the
  // pad centre and the estimates can price it.
  const columns = (rawColumns, levelIds) => {
    const seen = new Set();
    return (Array.isArray(rawColumns) ? rawColumns : []).map(column => {
      const id = Number(column?.id);
      const centre = point(column?.point);
      const columnLevelId = levelId(column?.levelId, levelIds);
      const view = oneOf(column?.view, ['plan', 'floor', 'foundation'], null);
      if (!Number.isInteger(id) || seen.has(id) || !centre || columnLevelId == null || !view) return null;
      seen.add(id);
      return {
        id,
        point: centre,
        levelId: columnLevelId,
        view,
        footing: oneOf(column?.footing, ['pad36', 'pad42'], 'pad36'),
        layer: 'S-COL/FOOTING',
      };
    }).filter(Boolean);
  };

  // A beam is one span between two supports, FLUSH (top flush with the joists,
  // bearing on the sill plate at foundation walls) or DROPPED (joists resting
  // on it — a beam pocket where it bears on a foundation wall).
  const beams = (rawBeams, levelIds) => {
    const seen = new Set();
    return (Array.isArray(rawBeams) ? rawBeams : []).map(beam => {
      const id = Number(beam?.id);
      const start = point(beam?.start);
      const end = point(beam?.end);
      const beamLevelId = levelId(beam?.levelId, levelIds);
      const view = oneOf(beam?.view, ['plan', 'floor', 'foundation'], null);
      if (!Number.isInteger(id) || seen.has(id) || !start || !end || beamLevelId == null || !view) return null;
      if (Math.hypot(end.x - start.x, end.z - start.z) < 0.001) return null;
      seen.add(id);
      return {
        id,
        start,
        end,
        levelId: beamLevelId,
        view,
        mode: oneOf(beam?.mode, ['flush', 'dropped'], 'flush'),
        layer: 'S-BEAM',
      };
    }).filter(Boolean);
  };

  // A straight stair placed from the top nosing: start is the upper-floor
  // nosing at the opening, end fixes the downhill direction, and the rise /
  // riser count re-derive from the level heights on load. Handrail bars are
  // stair metadata ('left' / 'right' going down, 'both', or 'none').
  const stairs = (rawStairs, levelIds) => {
    const seen = new Set();
    return (Array.isArray(rawStairs) ? rawStairs : []).map(stair => {
      const id = Number(stair?.id);
      const start = point(stair?.start);
      const end = point(stair?.end);
      const stairLevelId = levelId(stair?.levelId, levelIds);
      const view = oneOf(stair?.view, ['plan'], null);
      const riseFt = positive(stair?.riseFt, null);
      if (!Number.isInteger(id) || seen.has(id) || !start || !end || stairLevelId == null || !view) return null;
      if (Math.hypot(end.x - start.x, end.z - start.z) < 0.001) return null;
      if (riseFt === null) return null;
      seen.add(id);
      const risers = Number(stair?.risers);
      return {
        id,
        start,
        end,
        levelId: stairLevelId,
        view,
        widthFt: positive(stair?.widthFt, 3),
        riseFt,
        risers: Number.isInteger(risers) && risers > 0 ? risers : 1,
        treadRunIn: positive(stair?.treadRunIn, 10),
        rail: oneOf(stair?.rail, ['left', 'right', 'both', 'none'], 'left'),
        layer: 'A-STR',
      };
    }).filter(Boolean);
  };

  // BONEYARD shelves are storage slots outside the level stack. Every drawing
  // has at least one shelf; drawings saved before the BONEYARD existed load
  // with the single default shelf.
  const boneyardShelves = raw => {
    const seen = new Set();
    const shelves = (Array.isArray(raw) ? raw : []).map(shelf => {
      const id = Number(shelf?.id);
      if (!Number.isInteger(id) || id < 1 || seen.has(id)) return null;
      seen.add(id);
      return { id, name: String(shelf?.name || `SHELF ${id}`).toUpperCase() };
    }).filter(Boolean);
    return shelves.length ? shelves : [{ id: 1, name: 'SHELF 1' }];
  };

  // Master outlines live on a BONEYARD shelf. Each point carries a stable id
  // that level copies reference, so master edits can find their inherited
  // counterparts without merging vertices.
  const boneyardOutlines = (raw, shelfIds) => {
    const seenPointIds = new Set();
    return (Array.isArray(raw) ? raw : []).map(outline => {
      const shelfId = Number(outline?.shelfId);
      if (!shelfIds.has(shelfId)) return null;
      const points = (Array.isArray(outline?.points) ? outline.points : []).map(raw => {
        const parsed = point(raw);
        const id = String(raw?.id || '').trim();
        if (!parsed || !id || seenPointIds.has(id)) return null;
        seenPointIds.add(id);
        const bulge = Number(raw?.bulge);
        return { ...parsed, id, bulge: Number.isFinite(bulge) ? bulge : 0 };
      }).filter(Boolean);
      if (points.length < 3) return null;
      return {
        id: String(outline?.id || '').trim(),
        shelfId,
        sourceLevelId: Number.isInteger(Number(outline?.sourceLevelId)) ? Number(outline.sourceLevelId) : null,
        garage: outline?.garage === true,
        points,
      };
    }).filter(Boolean);
  };

  // Level outlines are per-level copies of a master (srcId links each point to
  // its master point) or purely local outlines (masterId null). Points whose
  // srcId is listed in overriddenSrcIds were adjusted locally, so master edits
  // leave them alone.
  const outlines = (raw, levelIds) => (Array.isArray(raw) ? raw : [])
    .map(outline => {
      const outlineLevelId = levelId(outline?.levelId, levelIds);
      const points = (Array.isArray(outline?.points) ? outline.points : []).map(raw => {
        const parsed = point(raw);
        if (!parsed) return null;
        const srcId = String(raw?.srcId || '').trim();
        const bulge = Number(raw?.bulge);
        return { ...parsed, srcId: srcId || null, bulge: Number.isFinite(bulge) ? bulge : 0 };
      }).filter(Boolean);
      if (outlineLevelId == null || points.length < 3) return null;
      return {
        id: String(outline?.id || '').trim(),
        masterId: String(outline?.masterId || '').trim() || null,
        levelId: outlineLevelId,
        garage: outline?.garage === true,
        points,
        overriddenSrcIds: (Array.isArray(outline?.overriddenSrcIds) ? outline.overriddenSrcIds : [])
          .map(id => String(id || '').trim()).filter(Boolean),
        layer: 'OUTLINE',
      };
    }).filter(Boolean);

  // Backgrounds are at most two other levels, never the active one.
  const backgroundLevelIds = (rawIds, levelIds, activeLevelId) =>
    (Array.isArray(rawIds) ? rawIds : [])
      .map(Number)
      .filter((id, index, ids) => levelIds.has(id) && id !== activeLevelId && ids.indexOf(id) === index)
      .slice(0, 2);

  window.DraftDrawingFormat = {
    VERSION,
    checkEnvelope,
    point,
    levelId,
    levels,
    cuts,
    dimensions,
    columns,
    beams,
    stairs,
    fenestrations,
    surfaceOpenings,
    shapes,
    roofs,
    boneyardShelves,
    boneyardOutlines,
    outlines,
    backgroundLevelIds,
    oneOf,
    number,
    positive,
  };
})();
}