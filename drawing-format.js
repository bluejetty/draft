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
      visible: level.visible !== false,
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
      return { id, start, end, levelId: dimensionLevelId, view };
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
    fenestrations,
    backgroundLevelIds,
    oneOf,
    number,
    positive,
  };
})();
}