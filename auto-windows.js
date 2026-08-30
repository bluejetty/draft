// AUTO WINDOWS (board #169) — the office's siting ruleset as a pure module.
// Faces, room claims and existing openings in; a list of window placements
// out. No DOM, no component state: MODEL gathers the real geometry and
// commits the results, exactly like build-house.js / auto-stair.js /
// room-grow.js. Node-loadable so proto/auto-windows-harness.js can drive it.
//
// The bone deals the FIRST HAND, never the last: everything it places is an
// ordinary fenestration carrying `auto: true`, and the drafter's own marks
// and openings always outrank it.
if (!window.DraftAutoWindows) {
(() => {
  // ── The stock the dealer plays ────────────────────────────────────────
  // Sizes come from the #141 ladder; only these two exist this slice — the
  // drafter re-sizes by hand from the existing options.
  const DEFAULT_WINDOW = Object.freeze({
    kind: 'default', widthFt: 30 / 12, sillFt: 3, headFt: 3 + 42 / 12,   // W 30x42
  });
  // A WC gets a small unit set HIGH: the point is daylight without a
  // sightline, so it is the sill that changes, not just the size.
  const WC_WINDOW = Object.freeze({
    kind: 'wc', widthFt: 24 / 12, sillFt: 4.5, headFt: 4.5 + 24 / 12,    // W 24x24
  });

  const TUNABLES = Object.freeze({
    MIN_GAP_FT: 3,          // clear between opening EDGES — never crowd
    MIN_CORNER_FT: 2,       // clear from a corner
    FRONT_MIN: 2,           // front is maximized, and never below this
    BACK_MIN: 2,            // back default 2 per floor
    SIDE_MIN: 2,
    SIDE_MAX: 3,
    SIDE_MAX_LONG: 5,       // a long wall may carry up to five
    LONG_FACE_FT: 40,       // what counts as long
    FRONT_MAX: 5,
  });

  // E1 is the front elevation and the rest follow the section-mark
  // convention: E1 south (+z), E2 west (-x), E3 north (-z), E4 east (+x).
  // MODEL hands us the outward normal; this is the one place the mapping
  // lives so the board and the marks can never drift apart.
  const ORIENTATIONS = Object.freeze(['front', 'back', 'left', 'right']);
  const faceOrientation = normal => {
    const x = Number(normal?.x) || 0;
    const z = Number(normal?.z) || 0;
    if (Math.abs(z) >= Math.abs(x)) return z >= 0 ? 'front' : 'back';
    return x <= 0 ? 'left' : 'right';
  };

  const num = value => (Number.isFinite(value) ? value : 0);
  const norm = name => String(name ?? '').trim().toUpperCase();
  const isBedroom = base => norm(base).startsWith('BEDROOM');
  const isWet = base => ['WC', 'BATH', 'ENSUITE'].includes(norm(base));

  // ── Placing on one face ───────────────────────────────────────────────
  // Centres must clear each other by half of each width plus the gap, and
  // stand MIN_CORNER_FT off both ends. `taken` carries both what we have
  // already dealt and whatever the drafter already owns on this face.
  const clears = (centre, widthFt, taken, lengthFt) => {
    const half = widthFt / 2;
    if (centre - half < TUNABLES.MIN_CORNER_FT) return false;
    if (centre + half > lengthFt - TUNABLES.MIN_CORNER_FT) return false;
    return taken.every(other =>
      Math.abs(other.centre - centre) >= half + other.widthFt / 2 + TUNABLES.MIN_GAP_FT);
  };

  // Slide a wanted centre to the nearest spot that clears, rather than
  // dropping the window the moment its ideal position is occupied: a room
  // pushed two feet along its own frontage still reads as its window.
  const seat = (wanted, widthFt, taken, lengthFt) => {
    if (clears(wanted, widthFt, taken, lengthFt)) return wanted;
    const step = 0.25;
    const reach = lengthFt;
    for (let d = step; d <= reach; d += step) {
      if (clears(wanted - d, widthFt, taken, lengthFt)) return wanted - d;
      if (clears(wanted + d, widthFt, taken, lengthFt)) return wanted + d;
    }
    return null;
  };

  // Density fill: spread up to `target` windows evenly across the face,
  // keeping whatever is already seated. Even spacing is computed fresh for
  // each attempt so the result does not depend on which room went first.
  const fill = (face, target, taken, out, stock) => {
    for (let n = taken.length + 1; n <= target; n++) {
      const usable = face.lengthFt - 2 * TUNABLES.MIN_CORNER_FT;
      if (usable <= stock.widthFt) break;
      let placed = false;
      for (let slot = 1; slot <= n && !placed; slot++) {
        const wanted = TUNABLES.MIN_CORNER_FT + (usable * slot) / (n + 1);
        const centre = seat(wanted, stock.widthFt, taken, face.lengthFt);
        if (centre == null) continue;
        taken.push({ centre, widthFt: stock.widthFt });
        out.push({
          faceId: face.id, wallId: face.wallId, levelId: face.levelId,
          orientation: face.orientation, roomId: null, base: null,
          offset: centre, ...stock,
        });
        placed = true;
      }
      if (!placed) break;
    }
  };

  // ── The deal ──────────────────────────────────────────────────────────
  // opts: {
  //   faces: [{ id, wallId, levelId, orientation, lengthFt,
  //             blocked?: bool, taken?: [{ centre, widthFt }] }],
  //   rooms: [{ id, base, levelId, frontage: [{ faceId, centreFt }] }],
  // }
  // `blocked` marks a face the drafter has spoken for — a BONEYARD mark or
  // a hand-placed opening. Those faces are skipped whole. `taken` carries
  // openings on faces we may still deal on (a garage door, a stair-cut) so
  // the 3' rule holds against them too.
  const dealWindows = opts => {
    const faces = (opts?.faces || []).filter(face => face && face.lengthFt > 0);
    const rooms = opts?.rooms || [];
    const report = [];
    const windows = [];
    const sidesByLevel = {};
    if (!faces.length) return { windows, report, sidesByLevel };

    const levels = [...new Set(faces.map(face => face.levelId))].sort((a, b) => a - b);

    levels.forEach(levelId => {
      const levelFaces = faces.filter(face => face.levelId === levelId);
      const levelRooms = rooms.filter(room => room.levelId === levelId);
      const faceById = new Map(levelFaces.map(face => [face.id, face]));
      const orientationOf = faceId => faceById.get(faceId)?.orientation || null;

      // Which side becomes the window side. A BEDROOM whose claim touches
      // no front or back face is TRAPPED: the side it does touch has to
      // rescue it, and that side then collects the rest of the windows.
      const trappedSides = new Set();
      levelRooms.filter(room => isBedroom(room.base)).forEach(room => {
        const sides = (room.frontage || []).map(front => orientationOf(front.faceId));
        if (sides.some(side => side === 'front' || side === 'back')) return;
        sides.filter(side => side === 'left' || side === 'right')
          .forEach(side => trappedSides.add(side));
      });

      // No trapped bedroom → ONE side takes the windows and the other
      // stays bare. Until the site plan lands (#43/#212) the pick is
      // deterministic: LEFT (E2). One wall of the house ends up blank —
      // that is the rule, not a bug.
      const windowSides = trappedSides.size ? [...trappedSides].sort() : ['left'];
      sidesByLevel[levelId] = windowSides;
      if (!trappedSides.size) {
        report.push(`level ${levelId}: no bedroom is trapped, so windows take the LEFT side and the right wall stays bare (deterministic until the site plan lands)`);
      } else if (trappedSides.size > 1) {
        report.push(`level ${levelId}: bedrooms are trapped on both sides, so both side walls carry windows`);
      }

      const targetFor = face => {
        if (face.orientation === 'front') {
          return Math.min(TUNABLES.FRONT_MAX,
            Math.max(TUNABLES.FRONT_MIN, Math.floor(face.lengthFt / 10)));
        }
        if (face.orientation === 'back') return TUNABLES.BACK_MIN;
        if (!windowSides.includes(face.orientation)) return 0;
        const cap = face.lengthFt >= TUNABLES.LONG_FACE_FT
          ? TUNABLES.SIDE_MAX_LONG : TUNABLES.SIDE_MAX;
        return Math.min(cap, Math.max(TUNABLES.SIDE_MIN, Math.floor(face.lengthFt / 12)));
      };

      const served = new Set();
      // Rooms first, so a claim's own frontage decides where its window
      // sits; then density fill takes whatever is left of the target.
      levelFaces.forEach(face => {
        if (face.blocked) {
          report.push(`${face.orientation} face ${face.id}: left to the drafter — it carries his mark or opening`);
          return;
        }
        const target = targetFor(face);
        if (!target) return;
        const taken = (face.taken || []).map(item => ({
          centre: num(item.centre), widthFt: Math.max(0, num(item.widthFt)),
        }));
        const out = [];

        const claims = levelRooms
          .flatMap(room => (room.frontage || [])
            .filter(front => front.faceId === face.id)
            .map(front => ({ room, centreFt: num(front.centreFt) })))
          .sort((a, b) => a.centreFt - b.centreFt);

        claims.forEach(({ room, centreFt }) => {
          if (out.length >= target) return;
          const stock = isWet(room.base) ? WC_WINDOW : DEFAULT_WINDOW;
          const centre = seat(centreFt, stock.widthFt, taken, face.lengthFt);
          if (centre == null) return;
          taken.push({ centre, widthFt: stock.widthFt });
          out.push({
            faceId: face.id, wallId: face.wallId, levelId: face.levelId,
            orientation: face.orientation, roomId: room.id, base: room.base,
            offset: centre, ...stock,
          });
          served.add(room.id);
        });

        fill(face, target, taken, out, DEFAULT_WINDOW);
        out.sort((a, b) => a.offset - b.offset);
        windows.push(...out);

        if (out.length < target) {
          report.push(`${face.orientation} face ${face.id}: room for ${out.length} of ${target} — the 3'-0" spacing and 2'-0" corner clearances take the rest`);
        }
      });

      // Every room with an exterior face was owed a shot at one window.
      levelRooms
        .filter(room => (room.frontage || []).length && !served.has(room.id))
        .forEach(room => {
          const sides = (room.frontage || []).map(front => orientationOf(front.faceId));
          const bare = sides.every(side => side && side !== 'front' && side !== 'back'
            && !windowSides.includes(side));
          report.push(bare
            ? `${room.base || 'room'} ${room.id}: its only exterior wall is the bare side — no window this deal`
            : `${room.base || 'room'} ${room.id}: no room left on its exterior face for a window`);
        });
    });

    return { windows, report, sidesByLevel };
  };

  // ── Garage door face ──────────────────────────────────────────────────
  // Two singles beat one double when the run fits: it is the better street
  // face and it is what the office draws. Sizes follow the machinery
  // already in MODEL (7'-0" head), not a new ladder entry.
  const GARAGE = Object.freeze({
    SINGLE_FT: 8, DOUBLE_FT: 16, NARROW_FT: 9, HEAD_FT: 7,
  });

  // opts: { faces: [{ index, orientation, lengthFt, behindHouseFront?: bool }],
  //         manDoorFaceIndex?: number|null }
  const garageDoorPlan = opts => {
    const faces = (opts?.faces || []).filter(face => face && face.lengthFt > 0);
    if (!faces.length) return null;
    const manDoor = Number.isInteger(opts?.manDoorFaceIndex) ? opts.manDoorFaceIndex : null;

    // A garage that STEPS BACK from the house front has already told us
    // where the street is: the door takes the street face.
    const stepped = faces.some(face => face.behindHouseFront === true);
    let chosen = null;
    let reason = '';
    if (stepped) {
      chosen = faces.find(face => face.orientation === 'front' && face.behindHouseFront !== true)
        || faces.find(face => face.orientation === 'front')
        || null;
      if (chosen) reason = 'step-back garage: the door takes the street face';
    }
    if (!chosen && manDoor != null) {
      // Ambiguous rectangle: the door lands OPPOSITE the man-door
      // connection to the house, so nobody walks through the car.
      const opposite = { front: 'back', back: 'front', left: 'right', right: 'left' };
      const manFace = faces.find(face => face.index === manDoor);
      const want = opposite[manFace?.orientation];
      chosen = faces.find(face => face.orientation === want) || null;
      if (chosen) reason = 'no step-back cue: the door lands opposite the man-door connection';
    }
    if (!chosen) {
      chosen = faces.reduce((best, face) => (!best || face.lengthFt > best.lengthFt ? face : best), null);
      reason = 'no step-back cue and no man door: the door takes the longest run';
    }

    // Two singles need both doors, the gap between them and both corners.
    const twoSingles = chosen.lengthFt
      >= 2 * GARAGE.SINGLE_FT + TUNABLES.MIN_GAP_FT + 2 * TUNABLES.MIN_CORNER_FT;
    const doors = twoSingles
      ? [{ widthFt: GARAGE.SINGLE_FT, headFt: GARAGE.HEAD_FT },
         { widthFt: GARAGE.SINGLE_FT, headFt: GARAGE.HEAD_FT }]
      : [{
          widthFt: chosen.lengthFt >= GARAGE.DOUBLE_FT + 2 * TUNABLES.MIN_CORNER_FT
            ? GARAGE.DOUBLE_FT : GARAGE.NARROW_FT,
          headFt: GARAGE.HEAD_FT,
        }];

    // Centres: one door on the middle; a pair centred as a group, holding
    // the same 3'-0" between them that every other opening keeps. Thirds
    // look right and are not — on a 24' run they leave two 8' doors only
    // 8' apart, which is the pier between them cut to nothing.
    const offsets = doors.length === 2
      ? (() => {
          const span = 2 * GARAGE.SINGLE_FT + TUNABLES.MIN_GAP_FT;
          const start = (chosen.lengthFt - span) / 2;
          return [
            start + GARAGE.SINGLE_FT / 2,
            start + GARAGE.SINGLE_FT + TUNABLES.MIN_GAP_FT + GARAGE.SINGLE_FT / 2,
          ];
        })()
      : [chosen.lengthFt / 2];

    return {
      faceIndex: chosen.index,
      orientation: chosen.orientation,
      reason: twoSingles ? `${reason}; the run fits two singles` : reason,
      doors: doors.map((door, i) => ({ ...door, offset: offsets[i] })),
    };
  };

  window.DraftAutoWindows = Object.freeze({
    DEFAULT_WINDOW, WC_WINDOW, TUNABLES, GARAGE, ORIENTATIONS,
    faceOrientation, dealWindows, garageDoorPlan,
  });
})();
}
