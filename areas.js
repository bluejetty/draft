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
// SIMPLE POLYGON IN. Shoelace has no other meaning: a ring that crosses itself
// has two lobes winding opposite ways, and they cancel to EXACTLY zero rather
// than to a wrong-looking number. Ask `DraftGeometry2D.selfIntersects` first if
// the ring came from somewhere untrusted.
//
// Not guarded here, on purpose (ruling, 2 Sep). MODEL refuses to commit a
// crossing outline at `_commitOutline`, so the drafter cannot draw one; anyone
// who arrives with one anyway went out of their way with the T-square stowed,
// and that is their problem rather than a number this module should soften.
if (!window.DraftAreas) {
(() => {
  // Shoelace area of a plain {x, z} ring, sign dropped.
  const polygonArea = points => Math.abs(points.reduce((sum, pt, index) => {
    const next = points[(index + 1) % points.length];
    return sum + (pt.x * next.z - next.x * pt.z);
  }, 0) / 2);

  // ONE CONTAINMENT RULE IN THE REPO, and it is not this file's. geometry-2d's
  // ringInsideRing asks both halves of the question -- every corner inside AND
  // no edge properly crossing a host edge, because a triangle can put all
  // three corners on an L-shaped floor and still run its long edge through the
  // notch -- and it is harnessed at proto/ring-inside-harness.js. Its header
  // names this defect as the reason it exists; it was written for this and
  // never wired to it.
  //
  // Re-implementing it here, or reaching for electric-rules' point-in-polygon
  // `contains` instead, would put a second containment rule in a repo that
  // already has a harnessed one -- the level-assembly duplication over again,
  // where two copies of one table drifted apart and a shared consumer was fed
  // whichever shape happened to call it.
  //
  // A MISSING DEPENDENCY THROWS rather than falling back. Silently deducting
  // everything is the defect this fix exists to end, and silently deducting
  // nothing would change every figure on the page without saying so. This
  // module is loaded after geometry-2d.js (MODEL.dc.html:15 before :24), and a
  // page missing geometry-2d is broken well beyond this dialog.
  const insideHost = (openingPoints, hostPoints) => {
    const geometry = window.DraftGeometry2D;
    if (!geometry || typeof geometry.ringInsideRing !== 'function') {
      throw new Error('areas.js needs DraftGeometry2D.ringInsideRing '
        + '\u2014 load geometry-2d.js before areas.js');
    }
    return geometry.ringInsideRing(openingPoints, hostPoints);
  };

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
      let excludedOpenings = 0;
      if (levelFloors.length) {
        source = 'floors';
        grossSqFt = 0;
        levelFloors.forEach(floor => {
          const area = polygonArea(floor.points);
          grossSqFt += area;
          if (floor.garage) garageSqFt += area;
          (openingsByHost.get(floor.id) || []).forEach(opening => {
            // IS THIS HOLE ACTUALLY IN THAT FLOOR? The slab polygon is never
            // cut -- the level's figure is `gross - openings - garage`,
            // arithmetic rather than geometry -- so nothing else ever asks.
            // Unasked, an opening run past the exterior wall, or one floating
            // outside the building entirely, still removed its full area from
            // a permit figure: silent, and always in the applicant's favour
            // (module review gate, verdict 2).
            //
            // NOT DEDUCTED, rather than clipped to the overlap. Clipping wants
            // a polygon intersection the repo does not have, and it would
            // answer with a THIRD number for a shape the drafter believes is
            // one hole -- a plausible figure hiding a wrong drawing. An
            // opening hanging off its slab means the drawing is wrong, and the
            // level's line says so instead (ruling, 9 Sep).
            //
            // Boundary counts as inside, by ringInsideRing's stated and
            // harnessed choice, so the stairwell run flush to an exterior wall
            // -- the move this whole design exists to allow -- still deducts.
            if (insideHost(opening.points, floor.points)) {
              openingsSqFt += polygonArea(opening.points);
            } else {
              excludedOpenings += 1;
            }
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
        // Openings whose host names this floor but which do not lie on it, so
        // nothing was deducted for them. DATA, not a sentence: this module is
        // pure and the AREAS dialog owns the drafter's wording.
        excludedOpenings,
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
