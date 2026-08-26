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

  // A point may carry its BUILD HOUSE link: the BONEYARD master point it
  // derived from (srcId) and its offset from that point at generation time.
  const point = value => {
    if (!value) return null;
    const x = num(value.x);
    const z = num(value.z);
    if (x === null || z === null) return null;
    const parsed = { x, y: num(value.y) ?? 0, z };
    const srcId = typeof value.srcId === 'string' ? value.srcId.trim() : '';
    if (srcId) {
      parsed.srcId = srcId;
      parsed.offX = num(value.offX) ?? 0;
      parsed.offZ = num(value.offZ) ?? 0;
    }
    return parsed;
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

  // Fixtures are semantic kitchen / bath / laundry plan symbols hosted on a
  // wall: kind picks the symbol and CAD layer, offset is the distance from the
  // wall start to the fixture centre along the wall, side is which face of the
  // wall the body projects from. Geometry is never stored — it redraws from
  // the current wall, so fixtures ride wall edits. The tub also records its
  // faucet-end wall (endWallId): it fills the alcove between that wall and the
  // next crossing wall, stretching up to 6" past standard before the leftover
  // becomes a deck strip. For the tub, offset is instead the slide gap between
  // the faucet-end wall face and the tub, and dir is which way along the back
  // wall the alcove runs from that face. Host-wall existence is the caller's
  // check.
  // island records a standoff: the clear distance from the host wall face to
  // the island's near edge, so it stands free of the wall but still rides it.
  const FIXTURE_KINDS = ['cabinet', 'vanity', 'sink', 'fridge', 'stove', 'dish', 'island', 'pantry', 'washer', 'dryer', 'toilet', 'tub', 'shower', 'stall', 'closet'];
  const FIXTURE_CASEWORK = ['cabinet', 'vanity'];
  const fixtures = (rawFixtures, levelIds) => (Array.isArray(rawFixtures) ? rawFixtures : [])
    .map(fixture => {
      const wallId = String(fixture?.wallId || '').trim();
      const fixtureLevelId = levelId(fixture?.levelId, levelIds);
      const kind = oneOf(fixture?.kind, FIXTURE_KINDS, null);
      const width = positive(fixture?.width, null);
      const depth = positive(fixture?.depth, null);
      const offset = num(fixture?.offset);
      if (!wallId || fixtureLevelId == null || !kind || width == null || depth == null || offset === null || offset < 0) return null;
      const endWallId = String(fixture?.endWallId || '').trim();
      if (kind === 'tub' && !endWallId) return null;
      const standoff = num(fixture?.standoff);
      return {
        id: String(fixture?.id || '').trim(),
        wallId,
        levelId: fixtureLevelId,
        view: 'plan',
        kind,
        layer: FIXTURE_CASEWORK.includes(kind) ? 'A-CASE' : 'A-FIXT',
        offset,
        width,
        depth,
        side: fixture?.side === -1 ? -1 : 1,
        ...(standoff !== null && standoff > 0 ? { standoff } : {}),
        ...(endWallId ? { endWallId, dir: fixture?.dir === -1 ? -1 : 1 } : {}),
      };
    }).filter(Boolean);

  // Surface openings are free-form closed outlines cut from a host floor or
  // roof footprint (stairwells, skylights, chimneys). Host existence is the
  // caller's check — floors and roofs restore before openings resolve. An
  // opening BUILD HOUSE cut for a stair carries that stair's id, so a
  // rebuild knows the stair already has its hole.
  const surfaceOpenings = (rawOpenings, levelIds) => (Array.isArray(rawOpenings) ? rawOpenings : [])
    .map(opening => {
      const openingLevelId = levelId(opening?.levelId, levelIds);
      const hostType = oneOf(opening?.hostType, ['floor', 'roof'], null);
      const hostId = String(opening?.hostId || '').trim();
      const points = (Array.isArray(opening?.points) ? opening.points : []).map(point).filter(Boolean);
      if (openingLevelId == null || !hostType || !hostId || points.length < 3) return null;
      const stairId = Number(opening?.stairId);
      return {
        id: String(opening?.id || '').trim(),
        hostType,
        hostId,
        points,
        levelId: openingLevelId,
        layer: hostType === 'roof' ? 'A-ROOF-OPNG' : 'A-FL-OPNG',
        ...(hostType === 'floor' && Number.isInteger(stairId) && stairId > 0 ? { stairId } : {}),
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
      const footing = oneOf(column?.footing, ['pad36', 'pad42', 'pile8', 'pile10', 'pile12'], 'pad36');
      // A pad column can carry a custom square size (inches) typed on the
      // FOUNDATION plan; piles keep their fixed diameters.
      const padIn = Number(column?.padIn);
      return {
        id,
        point: centre,
        levelId: columnLevelId,
        view,
        footing,
        ...(!footing.startsWith('pile') && Number.isFinite(padIn) && padIn > 0
          ? { padIn } : {}),
        layer: 'S-COL-FOOTING',
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

  // A stair placed from the top nosing: start is the upper-floor nosing at
  // the opening, end fixes the downhill direction of the first run, and the
  // rise / riser count re-derive from the level heights on load. Handrail
  // bars are stair metadata ('left' / 'right' going down, 'both', or 'none').
  // Shape: 'straight' (default), 'L' (one 90° landing, min 36"x36"), or 'U'
  // (switchback landing, runs 4.5" apart for a rail or wall). The turn
  // ('left' / 'right' walking down) orients L and U. Winders convert the one
  // landing into 2 or 3 pie treads — at most one winder landing per stair.
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
      const shape = oneOf(stair?.shape, ['straight', 'L', 'U'], 'straight');
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
        shape,
        turn: oneOf(stair?.turn, ['left', 'right'], 'right'),
        winders: shape === 'L' ? oneOf(Number(stair?.winders), [0, 2, 3], 0) : 0,
        layer: 'A-STR',
      };
    }).filter(Boolean);
  };

  // A MODEL annotation: a leader anchored on the object of interest with the
  // note text at its other end. Style rides on each note — leader end, an
  // optional fill with its own opacity, OUTLINE / NO OUTLINE, and a CORNER
  // BULLNOSE radius — so later styles extend without a format bump. Notes in
  // the STAIR workspace ('stair' view) store pane-local coordinates: x is
  // feet of run and z is feet of drop (section) or feet across (plan).
  const notes = (rawNotes, levelIds) => {
    const seen = new Set();
    return (Array.isArray(rawNotes) ? rawNotes : []).map(note => {
      const id = Number(note?.id);
      const anchor = point(note?.anchor);
      const text = point(note?.text);
      const noteLevelId = levelId(note?.levelId, levelIds);
      const view = oneOf(note?.view, ['plan', 'floor', 'e-power', 'foundation', 'stair'], null);
      const body = String(note?.body ?? '').trim();
      const end = oneOf(note?.end, ['arrow', 'line', 'none'], 'arrow');
      if (!Number.isInteger(id) || seen.has(id) || !anchor || !text || noteLevelId == null || !view || !body) return null;
      if (end !== 'none' && Math.hypot(text.x - anchor.x, text.z - anchor.z) < 0.001) return null;
      seen.add(id);
      return {
        id,
        anchor,
        text,
        levelId: noteLevelId,
        view,
        pane: view === 'stair' ? oneOf(note?.pane, ['section', 'plan'], 'section') : null,
        body,
        end,
        fill: note?.fill === true,
        fillOpacity: Math.min(1, Math.max(0, number(note?.fillOpacity, 0.85))),
        outline: note?.outline === true,
        bullnose: Math.min(30, Math.max(0, number(note?.bullnose, 0))),
        layer: 'A-ANNO-NOTE',
      };
    }).filter(Boolean);
  };

  // Room tags are the auto-placed room names (WC 1, KITCHEN, BEDROOM B2...)
  // on ROOM-IDS-AREA, one per enclosed room found on a level's PLAN. Each
  // carries its computed inside area so the MAIN FL area readout can toggle
  // without re-running detection.
  const roomTags = (rawTags, levelIds) => {
    const seen = new Set();
    return (Array.isArray(rawTags) ? rawTags : []).map(tag => {
      const id = Number(tag?.id);
      const at = point(tag?.at);
      const tagLevelId = levelId(tag?.levelId, levelIds);
      const name = String(tag?.name ?? '').trim().toUpperCase();
      if (!Number.isInteger(id) || seen.has(id) || !at || tagLevelId == null || !name) return null;
      seen.add(id);
      const area = number(tag?.areaSqFt, 0);
      return {
        id,
        at,
        levelId: tagLevelId,
        view: 'plan',
        name,
        areaSqFt: area > 0 ? area : 0,
        underMin: tag?.underMin === true,
        layer: 'ROOM-IDS-AREA',
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
  // counterparts without merging vertices. An OPEN outline (attached garage)
  // never wraps its last point to its first; its end points may carry an
  // attach id referencing a house master point they are welded to.
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
        const attach = String(raw?.attach || '').trim();
        return { ...parsed, id, bulge: Number.isFinite(bulge) ? bulge : 0, attach: attach || null };
      }).filter(Boolean);
      if (points.length < 3) return null;
      const open = outline?.open === true;
      // Fenestration marks live on the master: each keys to the edge starting
      // at edgeId, with the opening centre offsetFt along it. An OPEN outline's
      // last point owns no edge, so a mark keyed there is dropped.
      const pointIds = new Set(points.map(p => p.id));
      const lastPointId = points[points.length - 1].id;
      const marks = (Array.isArray(outline?.marks) ? outline.marks : []).map(mark => {
        const type = oneOf(mark?.type, ['door', 'window'], null);
        const edgeId = String(mark?.edgeId || '').trim();
        const offsetFt = num(mark?.offsetFt);
        const widthFt = positive(mark?.widthFt, null);
        if (!type || !edgeId || !pointIds.has(edgeId) || offsetFt === null || offsetFt < 0 || widthFt == null) return null;
        if (open && edgeId === lastPointId) return null;
        const sillFt = Math.max(0, number(mark?.sillFt, 0));
        const headFt = positive(mark?.headFt, null);
        if (headFt == null || headFt <= sillFt) return null;
        return { id: String(mark?.id || '').trim(), type, edgeId, offsetFt, widthFt, sillFt, headFt };
      }).filter(Boolean);
      return {
        id: String(outline?.id || '').trim(),
        shelfId,
        sourceLevelId: Number.isInteger(Number(outline?.sourceLevelId)) ? Number(outline.sourceLevelId) : null,
        garage: outline?.garage === true,
        open,
        detached: outline?.detached === true,
        foundation: oneOf(outline?.foundation, ['gradebeam', 'thickened'], null),
        cornerStubs: (Array.isArray(outline?.cornerStubs) ? outline.cornerStubs : []).map(stub => {
          const pointId = String(stub?.pointId || '').trim();
          const lengthIn = Number(stub?.lengthIn);
          return pointId && Number.isFinite(lengthIn) && lengthIn > 0 ? { pointId, lengthIn } : null;
        }).filter(Boolean),
        marks,
        points,
      };
    }).filter(Boolean);
  };

  // Level outlines are per-level copies of a master (srcId links each point to
  // its master point) or purely local outlines (masterId null). Points whose
  // srcId is listed in overriddenSrcIds were adjusted locally; offX/offZ hold
  // their offset from the master point, so master edits carry them along.
  const outlines = (raw, levelIds) => (Array.isArray(raw) ? raw : [])
    .map(outline => {
      const outlineLevelId = levelId(outline?.levelId, levelIds);
      const points = (Array.isArray(outline?.points) ? outline.points : []).map(raw => {
        const parsed = point(raw);
        if (!parsed) return null;
        const srcId = String(raw?.srcId || '').trim();
        const bulge = Number(raw?.bulge);
        const offX = Number(raw?.offX);
        const offZ = Number(raw?.offZ);
        return {
          ...parsed,
          srcId: srcId || null,
          bulge: Number.isFinite(bulge) ? bulge : 0,
          offX: Number.isFinite(offX) ? offX : null,
          offZ: Number.isFinite(offZ) ? offZ : null,
        };
      }).filter(Boolean);
      if (outlineLevelId == null || points.length < 3) return null;
      return {
        id: String(outline?.id || '').trim(),
        masterId: String(outline?.masterId || '').trim() || null,
        levelId: outlineLevelId,
        garage: outline?.garage === true,
        open: outline?.open === true,
        detached: outline?.detached === true,
        foundation: oneOf(outline?.foundation, ['gradebeam', 'thickened'], null),
        points,
        overriddenSrcIds: (Array.isArray(outline?.overriddenSrcIds) ? outline.overriddenSrcIds : [])
          .map(id => String(id || '').trim()).filter(Boolean),
        layer: 'OUTLINE',
      };
    }).filter(Boolean);

  // Underlays are reference images pinned under the plan: a vector PDF page
  // kept in its original form, or a photo / scanned page converted once to a
  // compressed image. The binary lives in the shared file store under the
  // underlay id; only placement and scale metadata is stored here.
  const underlays = (raw, levelIds) => (Array.isArray(raw) ? raw : [])
    .map(underlay => {
      const id = String(underlay?.id || '').trim();
      const underlayLevelId = levelId(underlay?.levelId, levelIds);
      const kind = oneOf(underlay?.kind, ['pdf', 'image'], null);
      const x = num(underlay?.x);
      const z = num(underlay?.z);
      const widthFt = positive(underlay?.widthFt, null);
      const heightFt = positive(underlay?.heightFt, null);
      if (!id || underlayLevelId == null || !kind || x === null || z === null || !widthFt || !heightFt) return null;
      const page = Number(underlay?.page);
      const opacity = num(underlay?.opacity);
      const scaleRatio = positive(underlay?.scaleRatio, null);
      return {
        id,
        levelId: underlayLevelId,
        kind,
        name: String(underlay?.name || '').trim(),
        page: Number.isInteger(page) && page >= 1 ? page : 1,
        x,
        z,
        widthFt,
        heightFt,
        opacity: opacity !== null && opacity >= 0.05 && opacity <= 1 ? opacity : 0.7,
        scaleRaw: String(underlay?.scaleRaw || '').trim() || null,
        scaleRatio,
        scaleUnit: scaleRatio ? oneOf(underlay?.scaleUnit, ['imperial', 'ratio'], null) : null,
        layer: 'UNDERLAY',
      };
    }).filter(Boolean);

  // Project information typed on the PROJECT tab: plain descriptive strings
  // carried with the drawing so the titleblock and the site plan's LEGAL LAND
  // DESCRIPTION block can print them. Later per-project settings (model-space
  // size, T-square angle set, filename slot) extend this object.
  const projectInfo = raw => {
    const line = value => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
    const block = value => String(value ?? '').replace(/\r\n?/g, '\n').trim().slice(0, 1000);
    return {
      name: line(raw?.name),
      client: line(raw?.client),
      address: line(raw?.address),
      legal: block(raw?.legal),
    };
  };

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
    notes,
    roomTags,
    fenestrations,
    fixtures,
    surfaceOpenings,
    shapes,
    roofs,
    boneyardShelves,
    boneyardOutlines,
    outlines,
    underlays,
    projectInfo,
    backgroundLevelIds,
    oneOf,
    number,
    positive,
  };
})();
}