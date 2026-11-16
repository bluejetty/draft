// STAIR GEOMETRY — the riser math and the plan parts of a stair.
//
// Pulled out of MODEL.dc.html so both boards can draw a stair from ONE copy.
// render-2d.js's drawStairs2D asks its caller for two things it cannot work
// out itself: `layoutFor`, the risers and total run a stair descends through,
// and `partsFor`, the runs, landing, rails and walk line in world space. Both
// were methods on the Model Space component, so only that page could answer,
// and MODEL.html drew no stairs at all.
//
// THE CONSTANTS ARE RE-POINTED HERE, NOT COPIED. This differs from the two
// extractions before it and the difference is worth stating, because it looks
// like the weaker move and is not. cut-marks.js and fixture-geometry.js could
// take their constants outright -- nothing outside their closures used them,
// and MODEL.dc.html names CUT_BUBBLE_PUSH_FT zero times today. STAIR_TREAD_RUN_IN
// is named seventeen times and only six are in this closure: the STAIR SECTION
// drawing measures its own treads with it, and so do the auto-placer and the
// stair schedule. So the module owns the value and MODEL.dc.html binds a const
// to it. One source of truth either way; the seventeen uses do not change.
//
// WHAT IS DELIBERATELY NOT HERE: the level spine. `_stairDescent` needs the
// floor list, a level's assembly, its floor thickness and its wall top -- and
// those helpers are the app's, not the stair's. `_activeLevelId` has 66 uses,
// `_floorLevels` 21, `_levelAssembly` 17. Dragging them in to save one
// parameter would make the stair module the owner of the level model. So
// stairDescent takes a `levels` accessor instead and can be tested by handing
// it an object literal.
if (!window.DraftStairGeometry) {
(() => {
  // ── THE OFFICE'S STAIR NUMBERS (Movie, 25 Oct) ─────────────────────────
  //
  // "is stair limitations set up in STANDARDS, we should allow that to change
  // too in STANDARDS" -- MAX RISER 7 7/8" (200 mm, "use that measurement"),
  // MIN RISER 6" ("make min rise 6""), TREAD RUN 10", MIN WIDTH 36", MIN
  // HEADROOM 6'-10". These are the defaults; the STANDARDS package's
  // `stairStandards` overrides them, read once the first time a stair asks
  // (a STANDARDS change on its own page reaches a page when it next opens).
  // Each is clamped to a span a real stair keeps to, and the least riser
  // never above the most.
  const STAIR_STANDARD_DEFAULTS = Object.freeze({
    maxRiserIn: 7.875, minRiserIn: 6, treadRunIn: 10, minWidthIn: 36, headroomIn: 82,
  });
  const STAIR_STANDARD_SPANS = Object.freeze({
    maxRiserIn: [4, 12], minRiserIn: [3, 12], treadRunIn: [7, 16], minWidthIn: [24, 72], headroomIn: [72, 120],
  });
  const normaliseStairStandards = raw => {
    const src = raw && typeof raw === 'object' ? raw : {};
    const out = {};
    Object.keys(STAIR_STANDARD_DEFAULTS).forEach(key => {
      const v = Number(src[key]);
      const [lo, hi] = STAIR_STANDARD_SPANS[key];
      out[key] = Number.isFinite(v) && v > 0 ? Math.min(hi, Math.max(lo, v)) : STAIR_STANDARD_DEFAULTS[key];
    });
    if (out.minRiserIn > out.maxRiserIn) out.minRiserIn = out.maxRiserIn;
    return Object.freeze(out);
  };
  let standards = null;
  const stairStandards = () => {
    if (!standards) {
      let raw = null;
      try { raw = window.DraftProfileManager?.getActive?.('standards')?.content?.model?.stairStandards; } catch { raw = null; }
      standards = normaliseStairStandards(raw);
    }
    return standards;
  };
  // A PAGE OR A SPEC HANDING IT ITS OWN: the STANDARDS page as it edits, a
  // harness checking a non-default office.
  const useStairStandards = raw => { standards = normaliseStairStandards(raw); return standards; };
  const STAIR_RISER_FACE_IN = 11;      // nosing to riser face
  const STAIR_LANDING_MIN_FT = 3;      // 36" x 36" minimum CLEAR landing
  const STAIR_LANDING_DRYWALL_IN = 0.5; // finish allowance at a walled landing edge
  const STAIR_U_GAP_IN = 4.5;          // between U runs, for the rail or wall
  const STAIR_RAIL_INSET_FT = 0.25;    // bar 3" inside the stringer, 36" high throughout
  // Stair shapes: STRAIGHT is the default and the preferred stair -- the turned
  // shapes trade floor space for footprint. L turns 90 degrees over one landing
  // (minimum 36" x 36"); U switches back 180 degrees with the runs held 4.5"
  // apart for a handrail or wall between them.
  const STAIR_SHAPE_OPTIONS = Object.freeze([
    { id: 'straight', label: 'STRAIGHT', note: 'One straight run — the default and the preferred stair.' },
    { id: 'L',        label: 'L',        note: 'Two runs turning 90° over a landing (min 36" x 36").' },
    { id: 'U',        label: 'U',        note: 'Switchback: two runs 4.5" apart (rail or wall between) over one landing.' },
  ]);
  const STAIR_WINDER_OPTIONS = Object.freeze([0, 2, 3]); // flat landing, 2 winders, 3 winders

  // Even risers under the 7 7/8" maximum at a 10" tread run; one fewer
  // tread than risers because the upper floor itself is the top tread.
  // `count`, when given, is the drafter's own number of risers (the stair's
  // riserCount, set with OBJ / PROP's - / +); the rise is shared among them.
  const stairLayout = (riseFt, count = null) => {
    const riseIn = Math.max(0, (riseFt || 0) * 12);
    const risers = Number.isInteger(count) && count > 0 ? count
      : Math.max(1, Math.ceil(riseIn / stairStandards().maxRiserIn));
    const riserIn = riseIn / risers;
    const treads = Math.max(1, risers - 1);
    return { riseFt: riseIn / 12, risers, riserIn, treads, runFt: treads * stairStandards().treadRunIn / 12 };
  };

  // The 36" landing is CLEAR: measured to the nosing of the run above
  // (which projects ~1" over it) with 1/2" of drywall at a walled edge.
  const stairLandFt = (widthFt) => {
    const clearFt = STAIR_LANDING_MIN_FT
      + (STAIR_RISER_FACE_IN - stairStandards().treadRunIn + STAIR_LANDING_DRYWALL_IN) / 12;
    return Math.max(clearFt, widthFt);
  };

  // What a stair placed on this level's PLAN descends to. The stair runs
  // subfloor to subfloor: the rise to the floor below is that level's wall
  // height plus this level's floor assembly; the lowest floor descends past
  // the foundation wall onto the concrete slab instead.
  //
  // `levels` supplies what the component used to read off itself:
  //   floors        -- the floor levels in order, each { id, name }
  //   assemblyFor   -- id => { wallHeightFt, slabThicknessIn }
  //   floorFtFor    -- id => the floor assembly thickness in feet
  //   wallTopFtFor  -- (id, view) => the wall top height in feet
  const stairDescent = (levelId, levels) => {
    // A SPLIT'S LEVELS DO NOT STACK ONE ON THE NEXT, so a caller that knows
    // where its half-levels stand may answer for them. Absent, or with no
    // answer for this level, the rise is worked out below as it always was.
    const told = typeof levels.riseFtFor === 'function' ? levels.riseFtFor(levelId) : null;
    if (told && told.riseFt > 0) return told;
    const { floors, assemblyFor, floorFtFor, wallTopFtFor } = levels;
    const idx = floors.findIndex(level => level.id === levelId);
    if (idx < 0) return null;
    if (idx === 0) {
      const assembly = assemblyFor(1);
      const riseFt = floorFtFor(levelId)
        + wallTopFtFor(1, 'foundation')
        - assembly.slabThicknessIn / 12;
      return { riseFt, landing: 'the basement slab' };
    }
    const lower = floors[idx - 1];
    const riseFt = assemblyFor(lower.id).wallHeightFt + floorFtFor(levelId);
    return { riseFt, landing: `the ${lower.name} subfloor` };
  };

  // A stair keeps following the level heights after it is placed: edit a wall
  // height or joist depth and the risers and total run re-derive, falling
  // back to the rise captured at placement if its level goes away.
  const stairCurrentLayout = (stair, levels) => {
    const descent = stairDescent(stair.levelId, levels);
    const riseFt = descent && descent.riseFt > 0 ? descent.riseFt : stair.riseFt;
    // THE DRAFTER'S COUNT HOLDS while it keeps every riser inside the limits;
    // a floor height changed under it so far that it would not falls back to
    // the fewest that fit, rather than drawing a stair no code allows.
    const range = stairRiserRange(riseFt);
    const count = Number.isInteger(stair.riserCount) && range
      && stair.riserCount >= range.fewest && stair.riserCount <= range.most ? stair.riserCount : null;
    return stairLayout(riseFt, count);
  };
  // HOW MANY RISERS A RISE MAY TAKE: the fewest that keep each under the
  // maximum, the most that keep each over the minimum. Null with no rise.
  const stairRiserRange = (riseFt, { maxIn = stairStandards().maxRiserIn, minIn = stairStandards().minRiserIn } = {}) => {
    const riseIn = (riseFt || 0) * 12;
    if (!(riseIn > 0)) return null;
    const fewest = Math.max(1, Math.ceil(riseIn / maxIn - 1e-9));
    const most = Math.max(fewest, Math.floor(riseIn / minIn + 1e-9));
    return { fewest, most };
  };

  // How a turned shape spends its treads. The landing (flat, or 2-3
  // winders) sits near the middle of the descent and the straight treads
  // split as evenly as possible around it; too few treads to turn falls back
  // to a straight run.
  //
  // A U HAS TWO LANDINGS (jb, 14 Nov 2026: "on U shaped the wide landing
  // should be considered 2 landings (put them level at first and then they
  // can add a step by increasing the upper landing"; "on the U we should also
  // allow stairs between the upper and lower landings too"). The UPPER
  // landing is the first turn walking down (the record's `winders`), the
  // LOWER the second (`lowerWinders`); each is FLAT or 2 or 3 winders.
  // `midRisers` is how many risers part them: 0 is one level landing drawn
  // as two squares (the stair as it always was), 1 is a single step between
  // them, more is a short middle flight of midRisers - 1 treads across.
  // An L has ONE landing (jb, same day: "l only has one landing it only has 2
  // lengths of stairs").
  //
  // THE TREAD SLOTS THE TURN EATS (`landSlots`): a flat landing is one slot
  // (it is a tread, a deep one), each winder a slot, each middle tread a
  // slot. Two level flat landings are ONE slot between them.
  const stairShapeSplit = (stair, layout) => {
    const shape = STAIR_SHAPE_OPTIONS.some(option => option.id === stair.shape) ? stair.shape : 'straight';
    if (shape === 'straight' || layout.treads < 3) return null;
    const pick = n => (STAIR_WINDER_OPTIONS.includes(Number(n)) ? Number(n) : 0);
    const winders = pick(stair.winders);
    const lowerWinders = shape === 'U' ? pick(stair.lowerWinders) : 0;
    const wantMid = shape === 'U' && Number.isInteger(stair.midRisers) && stair.midRisers > 0 ? stair.midRisers : 0;
    const slotsFor = mid => {
      if (shape === 'L') return winders || 1;
      if (!winders && !lowerWinders && mid === 0) return 1;
      return (winders || 1) + (lowerWinders || 1) + Math.max(0, mid - 1);
    };
    // Both flights keep a tread: a middle flight the rise cannot afford is
    // shortened, never a flight taken to nothing.
    let midRisers = wantMid;
    while (midRisers > 0 && layout.treads - slotsFor(midRisers) < 2) midRisers -= 1;
    let landTreads = slotsFor(midRisers);
    // Winders the rise cannot afford fall back to the even turn the old page
    // had: a flight too short for them still turns.
    const fits = layout.treads - landTreads >= 2;
    const w1 = fits ? winders : 0, w2 = fits ? lowerWinders : 0;
    if (!fits) { midRisers = 0; landTreads = 1; }
    const merged = shape === 'U' && !w1 && !w2 && midRisers === 0;
    const midTreads = shape === 'U' && !merged ? Math.max(0, midRisers - 1) : 0;
    // Board #260: splitTreads overrides the even split with the TOP leg's
    // tread count -- the entry L's short flight (2-3 down to the front-wall
    // landing), or its stacked mirror (treads - 2..3). OBJ / PROP's FLIGHTS
    // row writes the same field (jb, 14 Nov 2026: "add more stairs to the
    // upper portion (delete from lower) or vice versa"). Clamped so both legs
    // keep at least one tread; absent = the even split, unchanged.
    const avail = layout.treads - landTreads;
    const override = Number.isInteger(stair.splitTreads) && stair.splitTreads > 0
      ? Math.min(stair.splitTreads, avail - 1)
      : null;
    const t1 = override != null ? Math.max(1, override)
      : Math.max(1, Math.floor(avail / 2));
    const t2 = Math.max(1, avail - t1);
    const runStep = stairStandards().treadRunIn / 12;
    const gapFt = STAIR_U_GAP_IN / 12;
    const widthFt = Number(stair.widthFt) || 3;
    // The space between a U's two flights: the 4.5" for the rail or wall, or
    // the middle flight's run where there is one.
    const sepFt = shape === 'U' ? Math.max(gapFt, midTreads * runStep) : 0;
    return { shape, winders: w1, lowerWinders: w2, midRisers: shape === 'U' ? midRisers : 0, midTreads, merged,
      landTreads, t1, t2, landFt: stairLandFt(widthFt), turn: stair.turn === 'left' ? 'left' : 'right',
      sepFt, offFt: shape === 'U' ? widthFt + sepFt : 0 };
  };

  // THE DESCENT UNFOLDED along the walk line, top to bottom: `{ treads }` for
  // a stretch of treads (winders and a middle flight count as treads), `{ flatFt }`
  // for a flat landing that deep. The section draws its flights from it.
  const stairSequence = split => {
    if (!split) return null;
    const seq = [{ treads: split.t1 }];
    const landing = n => seq.push(n ? { treads: n } : { flatFt: split.landFt });
    if (split.shape === 'L' || split.merged) landing(split.winders);
    else {
      landing(split.winders);
      if (split.midTreads) seq.push({ treads: split.midTreads });
      landing(split.lowerWinders);
    }
    seq.push({ treads: split.t2 });
    return seq;
  };

  // Fan lines across a landing square from the inside corner of its turn:
  // 45 degrees (2 winders) or 30 / 60 (3 winders). `pivot` is that corner,
  // `a` the way the flight came in, `b` the way the next goes out; the lines
  // run until they meet the square's far sides (`aLen` along a, `bLen` along b).
  const winderFan = (count, pivot, a, b, aLen, bLen) => {
    const angles = count === 2 ? [45] : count === 3 ? [30, 60] : [];
    return angles.map(deg => {
      const rad = deg * Math.PI / 180;
      const ra = Math.sin(rad), rb = Math.cos(rad);
      const t = Math.min(ra > 0 ? aLen / ra : Infinity, rb > 0 ? bLen / rb : Infinity);
      return [pivot, { x: pivot.x + a.x * ra * t + b.x * rb * t, z: pivot.z + a.z * ra * t + b.z * rb * t }];
    });
  };

  // The stair's plan parts in world space: one straight run, or two runs
  // joined by the landing square -- L turns 90 degrees (min 36" clear each
  // way, winder division lines fanning from the inside corner of the turn);
  // U switches back 180 degrees over TWO landing squares, the runs held 4.5"
  // apart for a rail or wall -- or further, with a middle flight between the
  // squares. The walk polyline traces the descent for the DN arrow.
  //
  // `landing` is the turn's whole landing (both of a U's squares and what
  // lies between, as one ring) for whoever wants the area; `landings` the
  // squares one by one, each with its winder lines and `flatIndex` (which
  // flat of the descent it is, for its elevation, or null for winders);
  // `middle` the run between a U's squares, or null.
  const stairPlanParts = (stair, layout) => {
    const split = stairShapeSplit(stair, layout);
    const dx = stair.end.x - stair.start.x, dz = stair.end.z - stair.start.z;
    const len = Math.hypot(dx, dz) || 1;
    const d = { x: dx / len, z: dz / len };
    const runStep = stairStandards().treadRunIn / 12;
    const S = { x: stair.start.x, z: stair.start.z };
    // Rail bars sit STAIR_RAIL_INSET_FT inside the stringer on the picked
    // side(s), and stay continuous through a turn: on the run edges they
    // follow the flights, and across the landing they run level along the
    // landing edge to meet the next flight's bar.
    const railSides = stair.rail === 'both' ? [-1, 1]
      : stair.rail === 'none' || !stair.rail ? []
      : [stair.rail === 'right' ? 1 : -1];
    const railOff = Math.max(0.05, stair.widthFt / 2 - STAIR_RAIL_INSET_FT);
    if (!split) {
      const end = { x: S.x + d.x * layout.runFt, z: S.z + d.z * layout.runFt };
      const rp = { x: -d.z, z: d.x }; // right side walking down
      return { shape: 'straight', split: null, landing: null, landings: [], middle: null, gap: null,
        runs: [{ start: S, dir: d, treads: layout.treads, lenFt: layout.runFt }],
        rails: railSides.map(side => [
          { x: S.x + rp.x * side * railOff, z: S.z + rp.z * side * railOff },
          { x: end.x + rp.x * side * railOff, z: end.z + rp.z * side * railOff },
        ]),
        walk: [S, end] };
    }
    const s = split.turn === 'right' ? 1 : -1;
    const perp = { x: -d.z * s, z: d.x * s }; // toward the turn side, walking down
    const at = (u, v) => ({ x: S.x + d.x * u + perp.x * v, z: S.z + d.z * u + perp.z * v });
    const w = stair.widthFt;
    const run1Len = split.t1 * runStep;
    const run2Len = split.t2 * runStep;
    const L = split.landFt;
    if (split.shape === 'L') {
      // Landing square: spans the run width and grows toward the turn side.
      const v0 = -w / 2, v1 = -w / 2 + L;
      const run2Start = at(run1Len + L / 2, v1);
      const run2End = { x: run2Start.x + perp.x * run2Len, z: run2Start.z + perp.z * run2Len };
      // Winder treads pivot the inside corner of the turn -- the corner the
      // entry face and the exit face share.
      const pivot = at(run1Len, v1);
      const winderLines = winderFan(split.winders, pivot, d, { x: -perp.x, z: -perp.z }, L, L);
      // A rail on one hand stays on that hand through the turn: the bar runs
      // the first flight at v = +/-railOff, corners over the landing, and
      // carries down the second flight at the matching offset.
      const lRails = railSides.map(side => {
        const v = side * s * railOff;                       // offset on run 1
        const u = run1Len + L / 2 - side * s * railOff;     // offset on run 2
        return [at(0, v), at(u, v), at(u, v1 + run2Len)];
      });
      const landing = { poly: [at(run1Len, v0), at(run1Len + L, v0), at(run1Len + L, v1), at(run1Len, v1)],
        winderLines, flatIndex: split.winders ? null : 0 };
      return { shape: 'L', split, gap: null, middle: null,
        runs: [
          { start: S, dir: d, treads: split.t1, lenFt: run1Len },
          { start: run2Start, dir: perp, treads: split.t2, lenFt: run2Len },
        ],
        landing, landings: [landing],
        rails: lRails,
        walk: [S, at(run1Len + L / 2, 0), run2Start, run2End] };
    }
    // U: switchback over two landing squares. Run 2's centreline stands
    // `off` across from run 1's: a width and the space between the flights.
    const gapFt = STAIR_U_GAP_IN / 12;
    const off = split.offFt;
    const v0 = -w / 2, vTop = off + w / 2;
    const back = { x: -d.x, z: -d.z };
    const run2Start = at(run1Len, off);
    const run2End = { x: run2Start.x + back.x * run2Len, z: run2Start.z + back.z * run2Len };
    // Where the upper square stops and the lower begins: level squares meet
    // in the middle of the 4.5"; a middle flight stands between them.
    const mid = split.midTreads > 0;
    const upTop = mid ? w / 2 : w / 2 + split.sepFt / 2;
    const lowBot = mid ? off - w / 2 : upTop;
    const upFlat = split.winders ? null : 0;
    const lowFlat = split.lowerWinders ? null : split.merged ? 0 : (upFlat == null ? 0 : 1);
    // Upper square: in along +u, out along +v; its inside corner is on the
    // run-1 side of the turn. Lower square: in along +v, out along -u.
    const upper = { poly: [at(run1Len, v0), at(run1Len + L, v0), at(run1Len + L, upTop), at(run1Len, upTop)],
      winderLines: winderFan(split.winders, at(run1Len, w / 2), d, { x: -perp.x, z: -perp.z }, L, w),
      flatIndex: upFlat };
    const lower = { poly: [at(run1Len, lowBot), at(run1Len + L, lowBot), at(run1Len + L, vTop), at(run1Len, vTop)],
      winderLines: winderFan(split.lowerWinders, at(run1Len, off - w / 2), d, perp, L, w),
      flatIndex: lowFlat };
    const middle = mid
      ? { start: at(run1Len + L / 2, w / 2), dir: perp, treads: split.midTreads,
        lenFt: split.midTreads * runStep, widthFt: L }
      : null;
    // The two flights are antiparallel, so a rail on one hand can't corner
    // straight across: it runs out to the far landing edge, turns level along
    // it, and comes back on the matching offset of the second flight.
    const uRails = railSides.map(side => {
      const v = side * s * railOff;            // offset on run 1
      const v2 = off - side * s * railOff;     // matching hand on run 2
      const uEdge = run1Len + L - STAIR_RAIL_INSET_FT;
      return [at(0, v), at(uEdge, v), at(uEdge, v2), at(run1Len - run2Len, v2)];
    });
    const gapV = w / 2 + split.sepFt / 2;
    return { shape: 'U', split,
      runs: [
        { start: S, dir: d, treads: split.t1, lenFt: run1Len },
        { start: run2Start, dir: back, treads: split.t2, lenFt: run2Len },
      ],
      landing: { poly: [at(run1Len, v0), at(run1Len + L, v0), at(run1Len + L, vTop), at(run1Len, vTop)],
        winderLines: [...upper.winderLines, ...lower.winderLines], flatIndex: upFlat },
      landings: [upper, lower],
      middle,
      rails: uRails,
      // The rail or wall between the flights, down the middle of the space
      // between them, from the landing to the shorter flight's end.
      gap: [at(run1Len, gapV), at(Math.max(0, run1Len - run2Len), gapV)],
      gapFt,
      walk: [S, at(run1Len + L / 2, 0), at(run1Len + L / 2, off), run2End] };
  };

  // Where a flight ends in world space: along the drawn direction, for the run
  // the layout works out -- the first leg's length on a shaped stair, the whole
  // run on a straight one.
  //
  // Returns a plain {x, y, z}. MODEL.dc.html built a THREE.Vector3 here, but its
  // one caller is the serializer, which reads x/y/z and nothing else -- the
  // vector was constructed and immediately taken apart. Keeping THREE out is
  // what lets this file stay dependency-free, which is the property that makes
  // it answerable from any board.
  const stairEndFor = (stair, layout) => {
    const split = stairShapeSplit(stair, layout);
    const lenFt = split ? split.t1 * stairStandards().treadRunIn / 12 : layout.runFt;
    const dx = stair.end.x - stair.start.x, dz = stair.end.z - stair.start.z;
    const len = Math.hypot(dx, dz) || 1;
    return {
      x: stair.start.x + (dx / len) * lenFt,
      y: stair.start.y || 0,
      z: stair.start.z + (dz / len) * lenFt,
    };
  };

  // ── WHICH STAIRS A PLAN SHOWS, AND HOW (Movie, 16 Oct) ─────────────────
  //
  // "BASEMENT shows main->basement only; MAIN shows main->2nd and any
  // main->basement; 2ND FL shows main->2nd normal weight and main->basement
  // lighter." Generalised: a floor shows the stairs that START on it (going
  // DN) and the stairs that LAND on it (going UP) at normal weight, a stair
  // entirely below it lighter, and never one above it. UP / DN and the riser
  // tag only on the floors a stair serves.
  //
  // A stair is filed on the floor it descends FROM (stairDescent above), and
  // lands on the floor under that in the ladder -- the lowest floor's lands
  // on the basement plan (level 1), which is not a floor of the ladder but
  // is a plan a drafter looks at.
  const BASEMENT_PLAN_ID = 1;
  const stairLandingLevelId = (levelId, floors) => {
    const idx = (floors || []).findIndex(level => Number(level.id) === Number(levelId));
    if (idx < 0) return null;
    return idx === 0 ? BASEMENT_PLAN_ID : Number(floors[idx - 1].id);
  };
  const stairRoleOn = (stair, levelId, floors) => {
    if (!stair) return null;
    if (Number(stair.levelId) === Number(levelId)) return 'own';
    const landing = stairLandingLevelId(stair.levelId, floors);
    if (landing != null && landing === Number(levelId)) return 'lands';
    const ladder = [BASEMENT_PLAN_ID, ...(floors || []).map(level => Number(level.id))];
    const here = ladder.indexOf(Number(levelId)), top = ladder.indexOf(Number(stair.levelId));
    if (here < 0 || top < 0) return null;
    return top < here ? 'below' : null;
  };
  const stairsShownOn = (levelId, stairs, floors) => (Array.isArray(stairs) ? stairs : [])
    .map(stair => ({ stair, role: stairRoleOn(stair, levelId, floors) }))
    .filter(entry => entry.role);

  // ── THE BREAK LINE WHERE A STAIR DOWN AND A STAIR UP STACK (jb, 16 Nov) ─
  //
  // "on the main floor where the downstairs and 2nd floor stairs both show we
  // should only show the TOP section of the basement stairs and the BOTTOM of
  // the upstairs flight, and seperate them [with] a Z". The drafting
  // convention: a floor between two stacked flights shows the flight going
  // DN from it only from its top to a break line, and the flight coming UP to
  // it only from its foot to that same line -- the Z-jogged diagonal across
  // the treads where the plan's cut plane slices the flight above.
  //
  // A PAIR IS AN 'own' STAIR (DN from here) AND A 'lands' STAIR (UP from
  // here) WHOSE PLAN FOOTPRINTS OVERLAP -- the stack lock's test. A stair with
  // no partner draws whole, as it always has.
  //
  // THE BREAK SITS ACROSS THE MIDDLE OF THE DN FLIGHT'S LONGEST RUN, and the
  // UP flight takes the same spot when its own run crosses it (stacked
  // flights share one line); otherwise the middle of its own longest run.
  // The Z is point-symmetric about its centre, so a flight running the other
  // way over the same spot draws the very same line.
  const STAIR_BREAK_PAD_FT = 0.15;   // past the stringer, inside the U's 4.5"
  const STAIR_BREAK_END_PAD_FT = 0.5; // past a run's ends, for its last tread
  const stairRunFrame = (run, stair) => {
    const d = run.dir;
    const p = { x: -d.z, z: d.x };
    const w = Number(run.widthFt) || stair.widthFt;
    const at = (u, v) => ({ x: run.start.x + d.x * u + p.x * v, z: run.start.z + d.z * u + p.z * v });
    const local = q => ({
      u: (q.x - run.start.x) * d.x + (q.z - run.start.z) * d.z,
      v: (q.x - run.start.x) * p.x + (q.z - run.start.z) * p.z,
    });
    return { d, p, w, at, local };
  };
  const stairFootprintRings = (parts, stair) => {
    const rings = [];
    [...parts.runs, ...(parts.middle ? [parts.middle] : [])].forEach(run => {
      const { w, at } = stairRunFrame(run, stair);
      if (!(run.lenFt > 0)) return;
      rings.push([at(0, -w / 2), at(run.lenFt, -w / 2), at(run.lenFt, w / 2), at(0, w / 2)]);
    });
    const landings = parts.landings && parts.landings.length ? parts.landings : parts.landing ? [parts.landing] : [];
    landings.forEach(landing => { if (landing.poly && landing.poly.length >= 3) rings.push(landing.poly); });
    return rings;
  };
  const ringsOverlap = (a, b) => {
    // Separating axes, as the stack lock asks it: rings that only touch are
    // two flights end to end, not a stack.
    const EPS = 1e-4;
    for (const ring of [a, b]) {
      for (let i = 0; i < ring.length; i++) {
        const p = ring[i], q = ring[(i + 1) % ring.length];
        const nx = -(q.z - p.z), nz = q.x - p.x;
        const len = Math.hypot(nx, nz);
        if (len < 1e-9) continue;
        const proj = r => r.map(v => (v.x * nx + v.z * nz) / len);
        const pa = proj(a), pb = proj(b);
        if (Math.max(...pa) <= Math.min(...pb) + EPS || Math.max(...pb) <= Math.min(...pa) + EPS) return false;
      }
    }
    return true;
  };
  const longestRunIndex = parts => parts.runs.reduce((best, run, i) =>
    (run.lenFt > parts.runs[best].lenFt + 1e-9 ? i : best), 0);
  // One stair's break: which run, where, the Z, the side kept, the walk line
  // cut short at the break. `keep` 'top' is the start side (the flight's top
  // walking down), 'bottom' the far side.
  const stairBreakFor = (stair, parts, runIndex, centreU, keep) => {
    const runs = parts.runs;
    const run = runs[runIndex];
    const { w, at } = stairRunFrame(run, stair);
    const len = run.lenFt;
    const c = Math.max(0, Math.min(len, centreU));
    const W = w / 2 + STAIR_BREAK_PAD_FT;
    // The slant: the Z's ends stand 0.6 of the half width up and down the
    // run from its centre -- kept inside the run on a short one.
    const k = Math.max(0, Math.min(W * 0.6, c * 0.8, (len - c) * 0.8));
    const j = 0.35;   // the jog, as a share of the slant
    const P0 = at(c + k, -W), A = at(c - k * j, -W * 0.1), B = at(c + k * j, W * 0.1), P3 = at(c - k, W);
    const u0 = -STAIR_BREAK_END_PAD_FT, u1 = len + STAIR_BREAK_END_PAD_FT;
    const top = [at(u0, -W), P0, A, B, P3, at(u0, W)];
    const bottom = [P0, at(u1, -W), at(u1, W), P3, B, A];
    const last = runs.length - 1;
    // THE REGION IS ONE SIMPLE POLYGON, kept inside or kept outside: the run
    // cut is the first or the last, so one side of the Z holds that run's
    // piece and nothing else of the stair.
    let region, invert;
    if (keep === 'top') { if (runIndex === 0) { region = top; invert = false; } else { region = bottom; invert = true; } }
    else if (runIndex === last) { region = bottom; invert = false; } else { region = top; invert = true; }
    // The walk line stops short of the jog, on its own side.
    const walk = parts.walk || [];
    let cutWalk;
    if (keep === 'top') {
      const stop = at(Math.max(Math.min(c, 0.25), c - k * j - 0.35), 0);
      cutWalk = runIndex === 0 ? [walk[0], stop] : [...walk.slice(0, -1), stop];
    } else {
      const from = at(Math.min(Math.max(c, len - 0.25), c + k * j + 0.35), 0);
      cutWalk = runIndex === last ? [from, walk[walk.length - 1]] : [from, ...walk.slice(1)];
    }
    return { keep, runIndex, centre: at(c, 0), region, invert, line: [P0, A, B, P3], walk: cutWalk, drawLine: true };
  };
  // Every break on a plan: a Map from stair to its break, for the stairs
  // stairsShownOn gave this level.
  const stairBreaksOn = (shown, levels) => {
    const out = new Map();
    const entries = (Array.isArray(shown) ? shown : []).filter(e => e && e.stair && e.stair.start && e.stair.end);
    const partsOf = new Map();
    const parts = stair => {
      if (!partsOf.has(stair)) {
        let got = null;
        try { got = stairPlanParts(stair, stairCurrentLayout(stair, levels)); } catch (_) { got = null; }
        partsOf.set(stair, got && got.runs && got.runs.length ? got : null);
      }
      return partsOf.get(stair);
    };
    const downs = entries.filter(e => e.role === 'own');
    const ups = entries.filter(e => e.role === 'lands');
    downs.forEach(({ stair: dn }) => {
      const dnParts = parts(dn);
      if (!dnParts || out.has(dn)) return;
      const dnRings = stairFootprintRings(dnParts, dn);
      const mate = ups.find(({ stair: up }) => !out.has(up) && parts(up)
        && dnRings.some(ra => stairFootprintRings(parts(up), up).some(rb => ringsOverlap(ra, rb))));
      if (!mate) return;
      const up = mate.stair;
      const upParts = parts(up);
      const dnIdx = longestRunIndex(dnParts);
      const dnBreak = stairBreakFor(dn, dnParts, dnIdx, dnParts.runs[dnIdx].lenFt / 2, 'top');
      // The UP flight takes the DN flight's spot when one of its runs, square
      // to the same line, crosses it.
      const dnDir = dnParts.runs[dnIdx].dir;
      let upIdx = -1, upU = 0;
      upParts.runs.forEach((run, i) => {
        if (upIdx >= 0) return;
        const frame = stairRunFrame(run, up);
        const q = frame.local(dnBreak.centre);
        const square = Math.abs(run.dir.x * dnDir.x + run.dir.z * dnDir.z) > 0.99;
        if (square && q.u > 0 && q.u < run.lenFt && Math.abs(q.v) <= frame.w / 2 + 1e-6) { upIdx = i; upU = q.u; }
      });
      const shared = upIdx >= 0;
      if (!shared) { upIdx = longestRunIndex(upParts); upU = upParts.runs[upIdx].lenFt / 2; }
      const upBreak = stairBreakFor(up, upParts, upIdx, upU, 'bottom');
      // One Z on the paper when the two lines are one.
      const same = shared && upBreak.line.every((p, i) =>
        Math.hypot(p.x - dnBreak.line[i].x, p.z - dnBreak.line[i].z) < 0.05
        || Math.hypot(p.x - dnBreak.line[3 - i].x, p.z - dnBreak.line[3 - i].z) < 0.05);
      if (same) upBreak.drawLine = false;
      out.set(dn, dnBreak);
      out.set(up, upBreak);
    });
    return out;
  };

  window.DraftStairGeometry = Object.freeze({
    stairBreaksOn,
    stairBreakFor,
    stairFootprintRings,
    stairLandingLevelId,
    stairRoleOn,
    stairsShownOn,
    stairLayout,
    stairLandFt,
    stairDescent,
    stairCurrentLayout,
    stairRiserRange,
    stairShapeSplit,
    stairSequence,
    stairEndFor,
    stairPlanParts,
    // READ LIVE, so every painter and every page follows the office's numbers
    // without holding a copy of its own.
    get STAIR_MAX_RISER_IN() { return stairStandards().maxRiserIn; },
    get STAIR_MIN_RISER_IN() { return stairStandards().minRiserIn; },
    get STAIR_TREAD_RUN_IN() { return stairStandards().treadRunIn; },
    get STAIR_MIN_WIDTH_IN() { return stairStandards().minWidthIn; },
    get STAIR_HEADROOM_IN() { return stairStandards().headroomIn; },
    STAIR_STANDARD_DEFAULTS,
    normaliseStairStandards,
    stairStandards,
    useStairStandards,
    STAIR_RISER_FACE_IN,
    STAIR_LANDING_MIN_FT,
    STAIR_LANDING_DRYWALL_IN,
    STAIR_U_GAP_IN,
    STAIR_RAIL_INSET_FT,
    STAIR_SHAPE_OPTIONS,
    STAIR_WINDER_OPTIONS,
  });
})();
}
