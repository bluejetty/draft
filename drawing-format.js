// Stored-drawing format: version and the pure readers that turn stored JSON into
// values the Model Space component can trust. Nothing here touches the DOM, the
// file store or component state, so both file loading and undo history use it.
if (!window.DraftDrawingFormat) {
(() => {
  // Bump when the stored shape changes; loads of any other version are refused.
  const VERSION = 1;

  // A REAL number, nothing coerced. `Number(value)` turned null, '', [], false
  // and whitespace all into 0, so a coordinate that was missing or damaged did
  // not fail — it quietly became the origin, and the entity loaded in the wrong
  // place with nothing to show for it. A coordinate we cannot read now rejects
  // its entity into `skipped`, which the load message reports.
  const num = value => (typeof value === 'number' && Number.isFinite(value) ? value : null);

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
        garage: opening?.garage === true,
        // Board #169: the bone's own windows carry their provenance so a
        // re-deal knows which are still its to replace. Old drawings have
        // no flag and validate unchanged as the drafter's.
        auto: opening?.auto === true,
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
        // A real number or nothing: `Number(null)` is 0, and a stored null
        // read as a plate height of ZERO bears a garage roof at the main
        // floor line instead of on its wall stack.
        plateHeightFt: num(roof?.plateHeightFt),
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
      // MOVE FLOOR pile stubs key to the pulled corner (a master point id)
      // and the level that pulled it, so a later pull of the same corner
      // re-lands exactly its own piles. Both halves or neither.
      const pullSrcId = String(column?.pullSrcId ?? '').trim();
      const pullLevelId = levelId(column?.pullLevelId, levelIds);
      return {
        id,
        point: centre,
        levelId: columnLevelId,
        view,
        footing,
        ...(!footing.startsWith('pile') && Number.isFinite(padIn) && padIn > 0
          ? { padIn } : {}),
        auto: column?.auto === true, // tour-placed; the stair re-derive may replace it
        ...(pullSrcId && pullLevelId != null
          ? { pullSrcId, pullLevelId } : {}),
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
        auto: beam?.auto === true, // tour-placed; the stair re-derive may replace it
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
      // Board #260, both additive: `auto` tags a placement the auto-stair
      // rule suggested (cleared the moment the drafter touches it), and
      // `splitTreads` overrides the even L/U split with the tread count of
      // the TOP leg before the landing — the entry L's short flight.
      // Absent means today's behavior exactly; old files are unaffected.
      const splitTreads = Number(stair?.splitTreads);
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
        auto: stair?.auto === true,
        ...(Number.isInteger(splitTreads) && splitTreads > 0 ? { splitTreads } : {}),
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
      // Stamps (board #198): a tag the drafter placed from the room tray
      // (or promoted by touching a detected tag). `base` is the tray chip
      // it still numbers under — null once renamed; `companionOf` ties an
      // auto-dropped ENSUITE/WALK-IN/CLOSET to its bedroom until the
      // drafter claims it by moving or renaming it. All additive: old
      // drawings load with plain detector tags.
      const stamped = tag?.stamped === true;
      const base = String(tag?.base ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
      const companionOf = Number(tag?.companionOf);
      // #276: claimedNo pins an edited BEDROOM/WC number — the ladder
      // renumbers around it. Additive; absent = auto-numbered as always.
      const claimedNo = Number(tag?.claimedNo);
      return {
        id,
        at,
        levelId: tagLevelId,
        view: 'plan',
        name,
        areaSqFt: area > 0 ? area : 0,
        underMin: tag?.underMin === true,
        stamped,
        ...(stamped && base ? { base } : {}),
        ...(stamped && Number.isInteger(claimedNo) && claimedNo > 0 ? { claimedNo } : {}),
        ...(stamped && Number.isInteger(companionOf) && companionOf !== id
          ? { companionOf } : {}),
        // #323: a stamp the drive-thru program dealt, not one the drafter
        // placed. Gruff replaces his own on a re-run and never touches
        // theirs. Additive: old drawings load with the flag absent, i.e.
        // every existing stamp reads as the drafter's, which it is.
        ...(stamped && tag?.auto === true ? { auto: true } : {}),
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
        const type = oneOf(mark?.type, ['door', 'window', 'gable-bump'], null);
        const edgeId = String(mark?.edgeId || '').trim();
        const offsetFt = num(mark?.offsetFt);
        const widthFt = positive(mark?.widthFt, null);
        if (!type || !edgeId || !pointIds.has(edgeId) || offsetFt === null || offsetFt < 0 || widthFt == null) return null;
        if (open && edgeId === lastPointId) return null;
        // A gable-bump mark (board #238) is a wall marker — where a
        // perpendicular wall would land if the gable-area wall moved
        // forward. No sill or head; nothing moves until the drafter does.
        if (type === 'gable-bump') {
          return { id: String(mark?.id || '').trim(), type, edgeId, offsetFt, widthFt };
        }
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
        return {
          ...parsed,
          srcId: srcId || null,
          // A bulge we cannot read is a straight edge, which is the safe
          // reading — 0 is the value, not a stand-in for a missing one.
          bulge: Number.isFinite(bulge) ? bulge : 0,
          // An offset is not like that: null means "none stored, derive it
          // from where the point sits", and 0 means "explicitly on top of
          // the master". `Number(null)` is 0, so an unreadable offset used
          // to pin an overridden point onto its master and move geometry.
          offX: num(raw?.offX),
          offZ: num(raw?.offZ),
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
    // The stored keys predate the PROJECT page's labels and stay put so the
    // titleblock and site plan keep reading them: `client` is the OWNER box,
    // `address` is CIVIC ADDRESS, `legal` the freeform legal line. The
    // structured legal fields and CONTRACTOR are additive — old drawings
    // load with them empty.
    // Room counts (board #198): written at BONE time from the room-tag
    // program — the stamps are the drafter's latest word, so they win over
    // anything typed earlier. null = never counted (old drawings).
    const count = value => {
      const n = Number(value);
      return Number.isInteger(n) && n >= 0 ? n : null;
    };
    return {
      name: line(raw?.name),
      client: line(raw?.client),
      contractor: line(raw?.contractor),
      address: line(raw?.address),
      legal: block(raw?.legal),
      legalBlock: line(raw?.legalBlock),
      legalLot: line(raw?.legalLot),
      legalPlan: line(raw?.legalPlan),
      legalParcel: line(raw?.legalParcel),
      legalOther: line(raw?.legalOther),
      bedrooms: count(raw?.bedrooms),
      bathrooms: count(raw?.bathrooms),
    };
  };

  // ZONE HEIGHTS (board #221): areas whose floors do not sit at MAIN FL 0 —
  // the garages, and the bilevel rows reserved for the split-level feature.
  // Only the signed offset from MAIN FL persists; the "local elevation" the
  // PROJECT page also shows is offset + the drawing's elevationDatum, so the
  // two readings can never disagree in storage. BUILD HOUSE's garage
  // generation consumes the garage rows in a follow-up.
  // The guided full-house tour (board #230): one persisted ladder step so a
  // reload resumes where the tour parked. Absent or unknown = no tour
  // running; later slices extend the ladder without changing old saves.
  const tour = raw => ({
    // rooms-main / rooms-second: the per-floor ROOM TRAY pauses (board
    // #198) — each floor stamps its rooms right after its stair/wall leg.
    step: oneOf(raw?.step,
      ['foundation', 'main', 'rooms-main', 'second', 'rooms-second', 'roof', 'finale'], null),
  });

  // Roof INTENT (board #238): the tour's roof pause edits intent, not
  // geometry — the bone consumes it when it builds the roof. Edges and
  // gables key by the MASTER outline's point ids (fromSrc → toSrc), which
  // survives garage splices and outline edits. `edges` lists only
  // overrides (a kind and/or a pulled overhang); `gables` are the mid-edge
  // features, centerFt measured from the FROM corner — the number a
  // drafter would dimension.
  const roofIntent = raw => {
    const srcRef = value => String(value ?? '').trim();
    const edges = (Array.isArray(raw?.edges) ? raw.edges : []).map(edge => {
      const fromSrc = srcRef(edge?.fromSrc), toSrc = srcRef(edge?.toSrc);
      if (!fromSrc || !toSrc) return null;
      const kind = oneOf(edge?.kind, ['eave', 'gable'], null);
      const overhangFt = positive(edge?.overhangFt, null);
      if (!kind && overhangFt == null) return null;
      return {
        fromSrc, toSrc,
        ...(kind ? { kind } : {}),
        ...(overhangFt != null ? { overhangFt } : {}),
      };
    }).filter(Boolean);
    const gables = (Array.isArray(raw?.gables) ? raw.gables : []).map(gable => {
      const fromSrc = srcRef(gable?.fromSrc), toSrc = srcRef(gable?.toSrc);
      const centerFt = positive(gable?.centerFt, null);
      const widthFt = positive(gable?.widthFt, null);
      if (!fromSrc || !toSrc || centerFt == null || widthFt == null) return null;
      return { fromSrc, toSrc, centerFt, widthFt };
    }).filter(Boolean);
    return { edges, gables };
  };

  const zoneHeights = raw => {
    const zones = raw && typeof raw.zones === 'object' && raw.zones ? raw.zones : {};
    // Real numbers only, here as everywhere else: `Number(null)` is 0, and a
    // zone offset that reads 0 instead of "not set" moves a drawn line.
    const offset = value => num(value) ?? 0;
    return {
      // GRADE LEVEL: the drawn grade line, stored relative to the TOP OF THE
      // FOUNDATION WALL. Defaults a deliberate 1'-0" below — the drawn grade
      // is the conservative LOW case and the site crew fills up to it, which
      // leaves fill to play with for drainage. Old saves carry no value and
      // land here.
      gradeOffsetFt: num(raw?.gradeOffsetFt) ?? -1,
      zones: {
        attachedGarage: { offsetFt: offset(zones.attachedGarage?.offsetFt) },
        // The detached garage DERIVES from grade until overridden — null
        // means derive (top of the garage grade beam sits ~8" above grade
        // at the house); a stored number is the drafter's override.
        detachedGarage: {
          // Number(null) is 0, so the null/absent check comes first — a
          // re-normalise must never turn "derive" into an explicit 0.
          offsetFt: zones.detachedGarage?.offsetFt == null ? null
            : Number.isFinite(Number(zones.detachedGarage.offsetFt))
              ? Number(zones.detachedGarage.offsetFt) : null,
        },
        bilevel: { offsetFt: offset(zones.bilevel?.offsetFt) },
        modifiedBilevel: { offsetFt: offset(zones.modifiedBilevel?.offsetFt) },
      },
    };
  };

  // LAYOUT (board #168): the sheet composition saved with the drawing. Paper
  // and orientation are the sheet's own; each viewport is a window onto model
  // space — kind picks the projection, pif the architectural scale (paper
  // inches per model foot), and xIn / yIn its centre on the sheet in paper
  // inches from the top-left corner. Sheet coordinates never mix with model
  // feet: pif is the only bridge. Old drawings carry no layout and load with
  // an empty sheet. `titleblock` (board #285) picks the company strip on the
  // 11×17 sheet; the ids mirror DraftTitleblock.STYLES.
  //
  // Three semantic kinds, each with its own reference into the model:
  //   plan      → levelId, a level in the drawing
  //   section   → cutId, a saved cut's integer id
  //   elevation → elevId, one of the four standard marks 'E1'..'E4'
  // A viewport whose kind is unknown or whose reference is gone is DROPPED,
  // never silently repointed at a plan: a section box turning into a plan of
  // the wrong level is worse than an empty seat. `sheet` seats the viewport
  // on a numbered page; `auto` marks a composition the bone dealt, which a
  // rebuild may replace — the flag clears on the drafter's first manual edit
  // so a hand-adjusted layout is never thrown away.
  const LAYOUT_PAPER_KEYS = ['11x17', '8.5x11'];
  const LAYOUT_TITLEBLOCKS = ['bluejetty', 'roughdrafter', 'bluejetty-band', 'roughdrafter-band'];
  const LAYOUT_ELEV_IDS = ['E1', 'E2', 'E3', 'E4'];
  const layout = (raw, levelIds, cutIds = new Set()) => {
    const seen = new Set();
    const viewports = (Array.isArray(raw?.viewports) ? raw.viewports : []).map(viewport => {
      const id = Number(viewport?.id);
      const kind = oneOf(viewport?.kind, ['plan', 'section', 'elevation'], viewport?.kind == null ? 'plan' : null);
      const pif = positive(viewport?.pif, null);
      const xIn = num(viewport?.xIn);
      const yIn = num(viewport?.yIn);
      const sheet = Number.isInteger(Number(viewport?.sheet)) && Number(viewport.sheet) >= 1
        ? Number(viewport.sheet) : 1;
      if (!Number.isInteger(id) || id < 1 || seen.has(id) || kind == null) return null;
      if (pif == null || xIn === null || yIn === null) return null;
      const base = { id, kind, pif, xIn, yIn, sheet };
      if (kind === 'plan') {
        const viewportLevelId = levelId(viewport?.levelId, levelIds);
        if (viewportLevelId == null) return null;
        seen.add(id);
        return { ...base, levelId: viewportLevelId };
      }
      if (kind === 'section') {
        const cutId = Number(viewport?.cutId);
        if (!Number.isInteger(cutId) || !cutIds.has(cutId)) return null;
        seen.add(id);
        return { ...base, cutId };
      }
      const elevId = oneOf(viewport?.elevId, LAYOUT_ELEV_IDS, null);
      if (elevId == null) return null;
      seen.add(id);
      return { ...base, elevId };
    }).filter(Boolean);
    return {
      paperKey: oneOf(raw?.paperKey, LAYOUT_PAPER_KEYS, null),
      orientation: oneOf(raw?.orientation, ['landscape', 'portrait'], null),
      titleblock: oneOf(raw?.titleblock, LAYOUT_TITLEBLOCKS, 'roughdrafter'),
      northArrow: raw?.northArrow === true,
      auto: raw?.auto === true,
      viewports,
      nextViewportId: Math.max(
        Number.isInteger(Number(raw?.nextViewportId)) ? Number(raw.nextViewportId) : 1,
        ...viewports.map(viewport => viewport.id + 1),
      ),
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
    zoneHeights,
    layout,
    tour,
    roofIntent,
    backgroundLevelIds,
    oneOf,
    number,
    positive,
  };
})();
}