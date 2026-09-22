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

  // ── A WINDOW CLEARS THE ROOF UNDER IT ─────────────────────────────────
  //
  // Movie, 21 Sep, looking at E4 RIGHT: *"the window should be about 4\"
  // over the roof line"*. On repro-2storey-garage the garage ridge stands at
  // x = 8 and a window spans x 6..10, so the roof comes up through the middle
  // of it -- because this module has never known roofs exist.
  //
  // WHICH WAY THE WINDOW MOVES WAS HIS CALL AND HE MADE IT: *"keep top of
  // window at same spot and subtract size from bottom"*. Three ways to win
  // four inches and they look different on an elevation --
  //
  //     RAISE the sill      keeps the size, takes the head up with it
  //     SHORTEN from below  keeps the head, makes this one shorter   <- his
  //     MOVE sideways       keeps size and head, breaks the row's spacing
  //
  // -- and a row of heads that no longer line up is worse on a drawing than
  // one window that is short. So the head never moves and the sill rises.
  //
  // THE PROFILE IS THE CALLER'S, because this module is pure and roofs are
  // geometry MODEL already holds. `face.roofFt` is the roof standing in front
  // of a face, sampled ACROSS THE WHOLE FACE as heights above THIS LEVEL'S
  // FLOOR -- the same datum sillFt and headFt use, or the arithmetic below is
  // two rulers pretending to be one:
  //
  //     roofFt: [{ offsetFt, heightFt }, ...]
  //
  // Whole face, and zero where no roof stands there. A profile covering only
  // part of a face would have to say what the rest means, and every answer to
  // that is a second rule nobody asked for; sampling the lot says it in data.
  const ROOF_CLEAR_FT = 4 / 12;

  // THE FLOOR IS THE SHORTEST THING IN THE STOCK, not a number chosen here.
  // Lift a sill far enough and the head is under it: what is left is not a
  // short window, it is no window. The WC unit is 24" and is the smallest the
  // ladder deals, so a window the dealer would not have dealt in the first
  // place is one it will not leave behind either.
  const MIN_GLASS_FT = Math.min(DEFAULT_WINDOW.headFt - DEFAULT_WINDOW.sillFt,
    WC_WINDOW.headFt - WC_WINDOW.sillFt);

  const roofTopOver = (profile, from, to) => {
    if (!Array.isArray(profile) || !profile.length) return null;
    const pts = profile.map(p => ({ o: num(p?.offsetFt), h: num(p?.heightFt) }))
      .sort((a, b) => a.o - b.o);
    // Between samples the roof is a straight line, which is what a roof plane
    // is; outside them it is the end sample, which is only ever reached when
    // a caller sampled less than the whole face.
    const at = o => {
      if (o <= pts[0].o) return pts[0].h;
      if (o >= pts[pts.length - 1].o) return pts[pts.length - 1].h;
      const i = pts.findIndex(p => p.o >= o);
      const lo = pts[i - 1], hi = pts[i];
      return hi.o === lo.o ? hi.h : lo.h + (hi.h - lo.h) * (o - lo.o) / (hi.o - lo.o);
    };
    // THE HIGHEST POINT UNDER THE WINDOW, not the height at its centre. A
    // ridge crossing a window off-centre is exactly the case Movie was
    // looking at, and the middle of that window is not where the roof peaks.
    return pts.reduce((top, p) => (p.o > from && p.o < to ? Math.max(top, p.h) : top),
      Math.max(at(from), at(to)));
  };

  // ONE WINDOW AGAINST ONE PROFILE, and exported, because the dealer is not
  // the only thing that puts a window on a wall. premade-plans.js deals the
  // 2 STOREY's upper openings from a fixed list -- `8, 16, 24` across the
  // front -- and on the design with a garage that middle one lands on the
  // ridge to the foot. That is the window Movie reported, and it never went
  // near dealWindows. Two placers, one rule; the arithmetic lives here.
  //
  //   -> { sillFt, roofTopFt, lifted }   what the window should carry
  //   -> null                            there is no glass left: no window
  const clearRoofUnder = ({ roofFt, offsetFt, widthFt, sillFt, headFt }) => {
    const top = roofTopOver(roofFt, offsetFt - widthFt / 2, offsetFt + widthFt / 2);
    if (top == null) return { sillFt, roofTopFt: null, lifted: false };
    const raised = top + ROOF_CLEAR_FT;
    if (raised <= sillFt + 1e-9) return { sillFt, roofTopFt: top, lifted: false };
    if (headFt - raised < MIN_GLASS_FT) return null;
    return { sillFt: raised, roofTopFt: top, lifted: true };
  };

  // Null when there is no glass left, so the caller can say so rather than
  // keep a window with its sill above its own head.
  const liftOverRoof = (face, win) => {
    const cleared = clearRoofUnder({
      roofFt: face?.roofFt, offsetFt: win.offset, widthFt: win.widthFt,
      sillFt: win.sillFt, headFt: win.headFt,
    });
    if (!cleared) return null;
    if (!cleared.lifted) return win;
    return { ...win, sillFt: cleared.sillFt, roofFt: cleared.roofTopFt };
  };

  // ── AND THE PROFILE ITSELF, SAMPLED ONCE FOR BOTH PAGES ───────────────
  //
  // This was written in MODEL.dc.html first and would have been written again
  // in MODEL.html, because the premade builder lives there and the dealer
  // does not. Three things in it are easy to get subtly different the second
  // time -- which roofs count, which side of the wall to sample, and what the
  // heights are measured FROM -- and a difference in any of them is a wrong
  // window on one page and a right one on the other.
  //
  // PURE, WITH THE ROOF HEIGHT INJECTED. `riseAt(pt, roof)` is cut-view's
  // sectionRoofHeightAt, which no module may reach for; the caller hands it
  // in along with each roof's bearing. So this file still loads under node
  // with nothing but itself.
  //
  //   start    the face's first corner, in world feet
  //   u        the unit vector along the face, in the offsets openings use
  //   outward  the unit normal pointing AWAY from the building
  //   roofs    [{ roof, base, riseAt }] -- base from roofBaseElev
  //   floorTopFt / wallTopFt   this level's floor and plate
  const ROOF_SAMPLE_FT = 0.25;
  const roofProfileAlong = ({ start, u, outward, lengthFt, roofs,
    floorTopFt, wallTopFt }) => {
    if (!Array.isArray(roofs) || !roofs.length || !(lengthFt > 0)) return null;
    // NOT EVERY ROOF IS IN THE WAY, and getting this wrong deals no windows
    // at all rather than deals them badly. Sample any exterior wall and the
    // roof THIS WALL HOLDS UP is standing right there, because its overhang
    // reaches two feet past the wall face -- and its eave is at the plate,
    // above every window head on the storey. Counted, it lifts every sill
    // above its own head and every window is dropped.
    //
    // So the test is what a roof BEARS on: below this wall's top it is a
    // lower body's roof standing in front of the window; at the top it is
    // the roof over the drafter's head.
    const lower = roofs.filter(entry => entry.base < wallTopFt - 0.05);
    if (!lower.length) return null;
    // JUST OUTSIDE THE WALL, not on it. A roof edge landing exactly on the
    // wall face puts the sample on a polygon boundary, where inside/outside
    // is a coin toss; a nudge into the overhang is unambiguous and is the
    // side the window is looking at.
    const profile = [];
    for (let o = 0; o <= lengthFt + 1e-9; o = Math.min(o + ROOF_SAMPLE_FT, lengthFt)) {
      const pt = {
        x: start.x + u.x * o + outward.x * 0.05,
        z: start.z + u.z * o + outward.z * 0.05,
      };
      let top = 0;
      lower.forEach(entry => {
        const rise = entry.riseAt(pt, entry.roof);
        if (!Number.isFinite(rise)) return;
        top = Math.max(top, entry.base + rise - floorTopFt);
      });
      profile.push({ offsetFt: o, heightFt: Math.max(0, top) });
      if (o >= lengthFt) break;
    }
    return profile.some(p => p.heightFt > 0) ? profile : null;
  };

  // ── The deal ──────────────────────────────────────────────────────────
  // opts: {
  //   faces: [{ id, wallId, levelId, orientation, lengthFt,
  //             blocked?: bool, taken?: [{ centre, widthFt }],
  //             roofFt?: [{ offsetFt, heightFt }] }],
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

      // SERVED IS READ OFF THE WINDOWS THAT SURVIVE, not added to as they
      // are dealt. It used to be the latter, and the roof clearance broke it:
      // a claim window can now be dealt and then dropped for having no glass
      // left, which would have left its room marked served by a window that
      // is not on the drawing -- and the report at the foot of this level is
      // the one place that says a room got nothing.
      const servedIds = () => new Set(windows
        .filter(win => win.levelId === levelId && win.roomId != null)
        .map(win => win.roomId));
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
        });

        fill(face, target, taken, out, DEFAULT_WINDOW);
        out.sort((a, b) => a.offset - b.offset);

        // THE ROOF LAST, and on every window however it was dealt. A claim
        // window and a density-fill one are made in two different places and
        // neither is the right home for a rule that applies to both.
        //
        // AND AFTER SEATING, NOT BEFORE. The sill answers to the roof; the
        // OFFSET answers to the room's frontage and the spacing rules, and
        // letting a roof push a window sideways is the third option Movie did
        // not pick. A window dropped here keeps its place in `taken` on
        // purpose: the roof that emptied it is still standing there, so the
        // gap is not somewhere another window should be dealt instead.
        const kept = [];
        out.forEach(win => {
          const lifted = liftOverRoof(face, win);
          if (!lifted) {
            report.push(`${face.orientation} face ${face.id}: no window at ${win.offset.toFixed(1)}' — `
              + `the roof stands ${(roofTopOver(face.roofFt, win.offset - win.widthFt / 2, win.offset + win.widthFt / 2)).toFixed(2)}' up `
              + `and a head at ${win.headFt.toFixed(2)}' leaves less glass than the ${(MIN_GLASS_FT * 12).toFixed(0)}" minimum`);
            return;
          }
          if (lifted !== win) {
            report.push(`${face.orientation} face ${face.id}: the window at ${win.offset.toFixed(1)}' `
              + `sits ${(lifted.sillFt - win.sillFt).toFixed(2)}' higher — its sill clears the roof below it by 4"`);
          }
          kept.push(lifted);
        });
        windows.push(...kept);

        if (out.length < target) {
          report.push(`${face.orientation} face ${face.id}: room for ${out.length} of ${target} — the 3'-0" spacing and 2'-0" corner clearances take the rest`);
        }
      });

      // Every room with an exterior face was owed a shot at one window.
      const served = servedIds();
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
    ROOF_CLEAR_FT, MIN_GLASS_FT,
    faceOrientation, dealWindows, garageDoorPlan,
    // The roof clearance, reachable on its own: dealWindows applies it to its
    // own hand, and MODEL.html applies it to the premade plan's openings,
    // which this module never sees.
    clearRoofUnder, roofProfileAlong,
  });
})();
}
