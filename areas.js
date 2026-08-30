// Per-level and building area computation for permit applications: plain
// data in (floor shapes with their openings, outlines, room tag records),
// defensible figures out. Pure — no component state, no THREE, no store.
//
// The convention, stated where the drafter can read it (and printed by the
// AREAS dialog): areas are "as built" — a floor opening (stair rough
// openings included; the records don't distinguish a stairwell from any
// other hole, and the convention treats them alike) is deducted from the
// level whose floor it is cut from. The building total is the sum of the
// level nets, so a stairwell footprint counts exactly once: at the level
// with solid floor beneath it.
if (!window.DraftAreas) {
(() => {
  // Shoelace area of a plain {x, z} ring, sign dropped.
  const polygonArea = points => Math.abs(points.reduce((sum, pt, index) => {
    const next = points[(index + 1) % points.length];
    return sum + (pt.x * next.z - next.x * pt.z);
  }, 0) / 2);

  const CONVENTION = 'Areas are as built: floor openings (stair rough openings '
    + 'included) are deducted from the level they are cut from. The building '
    + 'total is the sum of the level nets, so a stairwell counts once — at the '
    + 'level with solid floor beneath it. The GARAGE is measured but kept OUT '
    + 'of the level nets and the building total, and reported on its own line: '
    + 'permit applications ask for floor area excluding the garage.';

  // Open-concept rule (stated, not guessed): one enclosed space is ONE room —
  // no invented boundaries. A KITCHEN-voted room well past a kitchen's
  // envelope rolls up as the combined space it is; the plan tag is untouched.
  // Threshold: the largest common kitchen footprints top out near 300 sq ft.
  const KITCHEN_COMBINED_SQFT = 300;
  const rollupName = room => (room.name === 'KITCHEN' && room.areaSqFt > KITCHEN_COMBINED_SQFT
    ? 'KITCHEN / LIVING' : room.name);

  // levels: [{ id, name }] in display order (floor levels only).
  // floors: [{ id, levelId, points, garage }] — every floor shape, any structure.
  // openings: [{ hostId, points }] — floor-hosted surface openings.
  // outlines: [{ levelId, points }] — footprint fallback for levels with no floor.
  // roomTags: [{ levelId, name, areaSqFt }] — the existing per-room records.
  // basementLevelId: the level reported as the suite line.
  function computeAreas({ levels, floors, openings, outlines, roomTags, basementLevelId }) {
    const floorsByLevel = new Map();
    floors.filter(floor => floor.points.length >= 3).forEach(floor => {
      if (!floorsByLevel.has(floor.levelId)) floorsByLevel.set(floor.levelId, []);
      floorsByLevel.get(floor.levelId).push(floor);
    });
    const openingsByHost = new Map();
    openings.filter(opening => opening.points.length >= 3).forEach(opening => {
      if (!openingsByHost.has(opening.hostId)) openingsByHost.set(opening.hostId, []);
      openingsByHost.get(opening.hostId).push(opening);
    });

    const rows = levels.map(level => {
      const levelFloors = floorsByLevel.get(level.id) || [];
      let grossSqFt = null, openingsSqFt = 0, garageSqFt = 0, source = 'none';
      if (levelFloors.length) {
        source = 'floors';
        grossSqFt = 0;
        levelFloors.forEach(floor => {
          const area = polygonArea(floor.points);
          grossSqFt += area;
          if (floor.garage) garageSqFt += area;
          (openingsByHost.get(floor.id) || []).forEach(opening => {
            openingsSqFt += polygonArea(opening.points);
          });
        });
      } else {
        const outline = outlines.find(candidate =>
          candidate.levelId === level.id && candidate.points.length >= 3);
        if (outline) {
          source = 'outline';
          grossSqFt = polygonArea(outline.points);
        } else {
          // Last resort: the rooms the level already measured. Approximate
          // (inside faces, walls excluded) and labeled as such — a stated
          // basis beats a silent guess.
          const roomSum = roomTags
            .filter(tag => tag.levelId === level.id && tag.areaSqFt > 0)
            .reduce((sum, tag) => sum + tag.areaSqFt, 0);
          if (roomSum > 0) {
            source = 'rooms';
            grossSqFt = roomSum;
          }
        }
      }
      return {
        levelId: level.id,
        name: level.name,
        source,
        grossSqFt,
        openingsSqFt,
        garageSqFt,
        // The net a drafter copies onto an application is the FLOOR area:
        // the garage is measured, reported on its own line, and kept out of
        // this number and out of the building total (audit Q16).
        netSqFt: grossSqFt === null ? null
          : Math.max(0, grossSqFt - openingsSqFt - garageSqFt),
        rooms: roomTags
          .filter(tag => tag.levelId === level.id && tag.areaSqFt > 0)
          .map(tag => ({ name: rollupName(tag), areaSqFt: tag.areaSqFt })),
      };
    });

    const measured = rows.filter(row => row.netSqFt !== null);
    const basementRow = rows.find(row => row.levelId === basementLevelId) || null;
    return {
      levels: rows,
      suite: basementRow && basementRow.netSqFt !== null
        ? { levelId: basementRow.levelId, name: basementRow.name, netSqFt: basementRow.netSqFt }
        : null,
      totalSqFt: measured.length
        ? measured.reduce((sum, row) => sum + row.netSqFt, 0)
        : null,
      // Reported beside the total, never inside it.
      garageSqFt: rows.reduce((sum, row) => sum + (row.garageSqFt || 0), 0),
      convention: CONVENTION,
    };
  }

  window.DraftAreas = Object.freeze({
    polygonArea,
    computeAreas,
    CONVENTION,
    KITCHEN_COMBINED_SQFT,
  });
})();
}
