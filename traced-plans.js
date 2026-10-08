// TRACED PLANS — a premade design built off the outline the drafter drew.
//
// Movie, 3 Oct, BONEYARD PR 3: the drive-thru offers "PRESS BUTTON to build
// now -or- CLICK HERE to draw house OUTLINE", for every type; the drafter
// traces the main floor, then the garage when the type has one attached,
// and the bone builds "like the premade houses". Traced houses get automatic
// windows and doors.
//
// THE PREMADE BUILD IS THE BUILDER. MODEL.html's buildPremadePlan already
// raises a design's walls, floors, concrete, roofs, beams, stairs, dims and
// openings from a plan object (premade-plans.js's shape). This module makes
// that same object out of the drafter's loops, so there is one builder and
// one set of rules about what a house is -- only where the corners are comes
// from his hand instead of from premade-plans.js's numbers.
//
// HIS RULINGS (3 Oct):
//   ROOFS       a bungalow + garage and a 2 STOREY with the room over the
//               garage are ONE roof; a garage on a lower plate (2 STOREY +
//               garage, the bilevels) keeps its own lower roof -- "for the
//               dropped garage lower roof should be 2".
//   THE ENTRY   a bilevel's 12 x 6 landing is placed for him after the garage
//               is traced, straddling the garage line as the premade does;
//               with no garage it is centred on the front wall.
//   ROOM OVER   18 ft of the garage at the house end, as the premade.
//               On a MOD BILEVEL the drafter moves its end wall (Movie,
//               5-6 Oct): "dont get them to draw a line, just get them to
//               move the line", in whole feet, 8 ft at least, as far as the
//               garage front or 2 ft past it -- and "if it goes all the way
//               or cantilevered the lower roof can be removed"; short of
//               the front, a lower roof covers the open garage.
//   OPENINGS    auto-windows.js's rules as they are: a front door on the
//               front wall clear of the garage, windows dealt by the module,
//               an overhead door and a man door on the garage.
//
// +z IS THE FRONT, the convention premade-plans.js and garage-site.js share.
//
// Pure: points in, a plan out. No DOM, no ids, no drawing.
if (!window.DraftTracedPlans) {
(() => {
  const TOL = 1e-6;
  const P = () => window.DraftPremadePlans;
  const AW = () => window.DraftAutoWindows;
  const G = () => window.DraftGeometry2D;

  const ROOM_OVER_GARAGE_FT = 18;
  const ROOM_OVER_MIN_FT = 8;
  const ROOM_OVER_CANTILEVER_FT = 2;
  const FRONT_DOOR_WIDTH_FT = 3;
  const MAN_DOOR_WIDTH_FT = 2.5;
  // The premade bilevel's own frame: its landing spans x -10..2 on the front
  // line z = 20, and the garage's house-side wall stands at x = -4.
  const PREMADE_LINE_X = -4;
  const PREMADE_FRONT_Z = 20;

  // ── loops ───────────────────────────────────────────────────────────────
  const pt = (x, z) => ({ x, z });
  const same = (a, b) => Math.abs(a.x - b.x) < TOL && Math.abs(a.z - b.z) < TOL;
  const collinear = (a, b, c) =>
    Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) < TOL;
  // Plain {x, z}, no repeated corners, no straight-through corners.
  const clean = loop => {
    let out = (loop || []).map(p => pt(Number(p.x), Number(p.z)))
      .filter((p, i, all) => !same(p, all[(i + all.length - 1) % all.length]) || all.length === 1);
    let changed = true;
    while (changed && out.length > 3) {
      changed = false;
      for (let i = 0; i < out.length; i += 1) {
        const a = out[(i + out.length - 1) % out.length], b = out[i], c = out[(i + 1) % out.length];
        if (collinear(a, b, c) && ((b.x - a.x) * (c.x - b.x) + (b.z - a.z) * (c.z - b.z)) > 0) {
          out.splice(i, 1);
          changed = true;
          break;
        }
      }
    }
    return out;
  };
  const area = loop => loop.reduce((s, a, i) => {
    const b = loop[(i + 1) % loop.length];
    return s + (a.x * b.z - b.x * a.z);
  }, 0) / 2;
  const inLoop = (p, loop) => {
    let hit = false;
    for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
      const a = loop[j], b = loop[i];
      if ((a.z > p.z) !== (b.z > p.z) && p.x < a.x + (b.x - a.x) * (p.z - a.z) / (b.z - a.z)) hit = !hit;
    }
    return hit;
  };
  // Every edge with its length and its OUTWARD normal, found by asking which
  // side of the midpoint is indoors rather than trusting the winding.
  const edgesOf = loop => loop.map((a, i) => {
    const b = loop[(i + 1) % loop.length];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const ux = (b.x - a.x) / (len || 1), uz = (b.z - a.z) / (len || 1);
    let n = { x: uz, z: -ux };
    const mid = pt((a.x + b.x) / 2, (a.z + b.z) / 2);
    if (inLoop(pt(mid.x + n.x * 0.01, mid.z + n.z * 0.01), loop)) n = { x: -n.x, z: -n.z };
    return { index: i, a, b, len, ux, uz, n, mid };
  });
  // The stretches of edge `e` that lie on `other`'s edges, as [from, to]
  // feet along `e` from its start, merged.
  const coveredSpans = (e, other) => {
    const spans = [];
    edgesOf(other).forEach(o => {
      if (!collinear(e.a, e.b, o.a) || !collinear(e.a, e.b, o.b)) return;
      const t = p => (p.x - e.a.x) * e.ux + (p.z - e.a.z) * e.uz;
      const lo = Math.max(0, Math.min(t(o.a), t(o.b)));
      const hi = Math.min(e.len, Math.max(t(o.a), t(o.b)));
      if (hi - lo > TOL) spans.push([lo, hi]);
    });
    spans.sort((p, q) => p[0] - q[0]);
    return spans.reduce((out, s) => {
      const last = out[out.length - 1];
      if (last && s[0] <= last[1] + TOL) last[1] = Math.max(last[1], s[1]);
      else out.push([...s]);
      return out;
    }, []);
  };
  const coveredLength = (e, other) => coveredSpans(e, other).reduce((s, [a, b]) => s + b - a, 0);
  const onOther = (e, other) => Math.abs(coveredLength(e, other) - e.len) < 1e-4;
  // Put a corner wherever `other` has one strictly inside an edge of `loop`,
  // so a stretch shared with it becomes an edge of its own -- what the
  // builder's `against` skip needs to leave a shared wall unraised.
  const splitAt = (loop, other) => {
    const out = [];
    edgesOf(loop).forEach(e => {
      out.push(e.a);
      const inner = other
        .map(p => ({ p, t: (p.x - e.a.x) * e.ux + (p.z - e.a.z) * e.uz }))
        .filter(({ p, t }) => t > TOL && t < e.len - TOL && collinear(e.a, e.b, p))
        .sort((p, q) => p.t - q.t);
      inner.forEach(({ p }) => { if (!same(p, out[out.length - 1])) out.push(pt(p.x, p.z)); });
    });
    return out;
  };

  // ── ONE ROOF OVER TWO BODIES ───────────────────────────────────────────
  // The two loops filled on the whole-foot grid both are drawn on, and the
  // outline of the filled cells walked back into a loop. Null when they are
  // not on one grid, do not touch, or would make a hole -- the caller then
  // roofs them apart, which is a worse roof but never a wrong one.
  const unionLoops = (A, B) => {
    const a = clean(A), b = clean(B);
    if (a.length < 3 || b.length < 3) return null;
    const o = a[0];
    const all = [...a, ...b];
    const offGrid = all.some(p => Math.abs((p.x - o.x) - Math.round(p.x - o.x)) > 1e-6
      || Math.abs((p.z - o.z) - Math.round(p.z - o.z)) > 1e-6);
    if (offGrid) return null;
    const xs = all.map(p => Math.round(p.x - o.x)), zs = all.map(p => Math.round(p.z - o.z));
    const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    if ((x1 - x0) * (z1 - z0) > 250000) return null;
    const filled = new Set();
    for (let i = x0; i < x1; i += 1) {
      for (let j = z0; j < z1; j += 1) {
        const c = pt(o.x + i + 0.5, o.z + j + 0.5);
        if (inLoop(c, a) || inLoop(c, b)) filled.add(`${i},${j}`);
      }
    }
    if (!filled.size) return null;
    // Each filled cell's four sides, one way round; a side two cells share
    // cancels, and what is left is the outline.
    const edges = new Map();
    const add = (p, q) => {
      const back = `${q}>${p}`;
      if (edges.has(back)) edges.delete(back);
      else edges.set(`${p}>${q}`, [p, q]);
    };
    filled.forEach(key => {
      const [i, j] = key.split(',').map(Number);
      add(`${i},${j}`, `${i + 1},${j}`);
      add(`${i + 1},${j}`, `${i + 1},${j + 1}`);
      add(`${i + 1},${j + 1}`, `${i},${j + 1}`);
      add(`${i},${j + 1}`, `${i},${j}`);
    });
    const from = new Map();
    for (const [p, q] of edges.values()) {
      if (from.has(p)) return null;          // a pinch: two bodies touching at a corner
      from.set(p, q);
    }
    const start = from.keys().next().value;
    const ring = [];
    let at = start;
    do {
      ring.push(at);
      at = from.get(at);
      if (at === undefined || ring.length > edges.size) return null;
    } while (at !== start);
    if (ring.length !== edges.size) return null;   // more than one loop, or a hole
    let loop = clean(ring.map(k => {
      const [i, j] = k.split(',').map(Number);
      return pt(o.x + i, o.z + j);
    }));
    if (Math.sign(area(loop)) !== Math.sign(area(a))) loop = loop.reverse();
    return loop;
  };

  // ── OPENINGS ─────────────────────────────────────────────────────────────
  const opening = (edge, offsetFt, widthFt, type, over = {}) => {
    const g = G();
    return {
      edge, offsetFt, widthFt, type,
      // The premade's own sill: the window keeps the door's height and the
      // 7'-0" head (premade-plans.js WINDOW_SILL_FT).
      sillFt: type === 'door' ? 0 : Math.max(0, g.DEFAULT_WINDOW_HEAD_FT
        - (g.DEFAULT_OPENING_HEAD_FT - g.DEFAULT_WINDOW_SILL_FT)),
      headFt: type === 'door' ? g.DEFAULT_OPENING_HEAD_FT : g.DEFAULT_WINDOW_HEAD_FT,
      casement: type === 'window' ? 'single' : null,
      garage: false,
      ...over,
    };
  };
  // The free stretches of a face once what covers it is taken out.
  const freeSpans = (len, covered) => {
    const out = [];
    let at = 0;
    covered.forEach(([a, b]) => { if (a > at) out.push([at, a]); at = Math.max(at, b); });
    if (len > at) out.push([at, len]);
    return out;
  };
  // A loop's walls dealt by auto-windows.js. `skip` loops share whole edges
  // (no wall stands there); `cover` loops hide part of a face (the garage on
  // the house front), and what they hide is handed to the dealer as taken.
  const dealOn = (loop, { levelId = 1, skip = [], cover = [], frontDoor = false } = {}) => {
    const aw = AW();
    const faces = [];
    const doors = [];
    edgesOf(loop).forEach(e => {
      if (e.len < TOL || skip.some(other => onOther(e, other))) return;
      const covered = cover.flatMap(other => coveredSpans(e, other))
        .sort((p, q) => p[0] - q[0]);
      if (covered.length && Math.abs(covered.reduce((s, [a, b]) => s + b - a, 0) - e.len) < 1e-4) return;
      faces.push({
        id: e.index, wallId: e.index, levelId, lengthFt: e.len,
        orientation: aw.faceOrientation(e.n),
        taken: covered.map(([a, b]) => ({ centre: (a + b) / 2, widthFt: b - a })),
        free: freeSpans(e.len, covered),
      });
    });
    if (frontDoor) {
      // THE FRONT DOOR: the widest stretch of front wall the garage leaves,
      // at its middle. Every other opening then deals round it.
      const spots = faces.filter(f => f.orientation === 'front')
        .flatMap(f => f.free.map(([a, b]) => ({ f, a, b, len: b - a })))
        .filter(s => s.len >= FRONT_DOOR_WIDTH_FT + 2 * aw.TUNABLES.MIN_CORNER_FT)
        .sort((p, q) => q.len - p.len);
      const spot = spots[0];
      if (spot) {
        const centre = (spot.a + spot.b) / 2;
        doors.push(opening(spot.f.id, centre, FRONT_DOOR_WIDTH_FT, 'door'));
        spot.f.taken.push({ centre, widthFt: FRONT_DOOR_WIDTH_FT });
      }
    }
    const { windows } = aw.dealWindows({ faces, rooms: [] });
    return [
      ...doors,
      ...windows.map(w => opening(w.faceId, w.offset, w.widthFt, 'window',
        { sillFt: w.sillFt, headFt: w.headFt })),
    ];
  };
  // THE ENTRY'S DOOR INTO THE GARAGE GOES ON THE WALL THAT TOUCHES IT.
  // Movie, 7 Oct, on a traced MOD BILEVEL with the garage round the corner
  // from the entry: the premade's garage-half door then opened outdoors
  // beside the garage, and he moved it onto the entry's wall shared with the
  // garage, by the corner. The premade case -- garage beside the entry on
  // the same face -- already has it there, and is left alone.
  const entryGarageDoor = (entry, openings, garage) => {
    if (!garage || !entry || !Array.isArray(openings)) return openings;
    const edges = edgesOf(entry);
    const shared = edges.filter(e => e.len >= MAN_DOOR_WIDTH_FT + 1 && onOther(e, garage));
    if (!shared.length) return openings;
    const man = openings.findIndex(o => o.type === 'door'
      && Math.abs(o.widthFt - MAN_DOOR_WIDTH_FT) < TOL);
    if (man < 0 || shared.some(e => e.index === openings[man].edge)) return openings;
    const e = shared.sort((p, q) => q.len - p.len)[0];
    // By the corner he marked: the end of the shared wall that meets the
    // wall the premade put the door on.
    const was = edges.find(x => x.index === openings[man].edge);
    const nearB = was && (same(e.b, was.a) || same(e.b, was.b));
    const inset = MAN_DOOR_WIDTH_FT / 2 + 0.5;
    const offsetFt = nearB ? e.len - inset : inset;
    return openings.map((o, i) => (i === man ? { ...o, edge: e.index, offsetFt } : o));
  };

  // THE GARAGE'S OWN DOORS: the overhead door where auto-windows.js puts it,
  // and a man door on the back or the shortest other free wall.
  const garageDoors = (loop, house) => {
    const aw = AW();
    const houseFront = house ? Math.max(...house.map(p => p.z)) : -Infinity;
    const all = edgesOf(loop).filter(e => e.len > TOL);
    // THE WALL IT HANGS OFF THE HOUSE BY, which auto-windows.js reads as the
    // man-door connection: the overhead door then takes the face opposite,
    // the street, rather than the longest run (a side wall, on a deep garage).
    const joint = house ? all.map(e => ({ e, on: coveredLength(e, house) }))
      .filter(s => s.on > TOL).sort((p, q) => q.on - p.on)[0]?.e : null;
    const face = e => ({
      index: e.index, lengthFt: e.len, orientation: aw.faceOrientation(e.n),
      behindHouseFront: aw.faceOrientation(e.n) === 'front' && e.a.z < houseFront - TOL,
    });
    const faces = all.filter(e => !(house && onOther(e, house))).map(face);
    if (!faces.length) return [];
    const plan = aw.garageDoorPlan({
      faces: joint ? [...faces, face(joint)] : faces,
      manDoorFaceIndex: joint ? joint.index : null,
    });
    if (!plan) return [];
    const out = plan.doors.map(door => opening(plan.faceIndex, door.offset, door.widthFt, 'door',
      { garage: true, headFt: door.headFt }));
    const man = faces
      .filter(f => f.index !== plan.faceIndex && f.lengthFt >= MAN_DOOR_WIDTH_FT + 1)
      .sort((p, q) => (p.orientation === 'back' ? -1 : 0) - (q.orientation === 'back' ? -1 : 0)
        || p.lengthFt - q.lengthFt)[0];
    if (man) out.push(opening(man.index, man.lengthFt / 2, MAN_DOOR_WIDTH_FT, 'door'));
    return out;
  };

  // ── THE ROOM OVER THE GARAGE ───────────────────────────────────────────
  // 18 ft of a rectangular garage, from the wall it shares with the house,
  // or `depthFt` when the drafter has moved its end wall: whole feet, no
  // shorter than 8 ft (or the garage, if shallower) and no further than 2 ft
  // past the garage front. Returns { room, rest, ... } -- rest null when the
  // room reaches the front or hangs past it -- or null when the garage is
  // not a rectangle against the house. The shared wall (a, b), the way in
  // and the garage's depth come back too, for the line the drafter drags.
  const roomDepthRange = depth => ({
    lo: Math.min(ROOM_OVER_MIN_FT, depth),
    hi: depth + ROOM_OVER_CANTILEVER_FT,
  });
  // How deep the room is: the design's 18 ft (or the garage, if shallower),
  // or where he moved its end wall to, held to the range in whole feet.
  const roomDepthOf = (depth, depthFt) => {
    const range = roomDepthRange(depth);
    const asked = Number(depthFt);
    return Number.isFinite(asked) && depthFt != null
      ? Math.max(range.lo, Math.min(range.hi, Math.round(asked)))
      : Math.min(ROOM_OVER_GARAGE_FT, depth);
  };
  // THE PART OF A LOOP ON ONE SIDE OF A LINE: `f` is a signed distance and
  // what is kept is where it is <= 0 (Sutherland-Hodgman against one edge).
  const clipBy = (loop, f) => {
    const out = [];
    loop.forEach((p, i) => {
      const q = loop[(i + 1) % loop.length];
      const fp = f(p), fq = f(q);
      if (fp <= TOL) out.push(p);
      if ((fp < -TOL && fq > TOL) || (fp > TOL && fq < -TOL)) {
        const k = fp / (fp - fq);
        out.push(pt(p.x + (q.x - p.x) * k, p.z + (q.z - p.z) * k));
      }
    });
    return clean(out);
  };
  const roomOverGarage = (garage, house, depthFt = null) => {
    const g = clean(garage);
    if (g.length !== 4) return roomOverShapedGarage(g, house, depthFt);
    const shared = edgesOf(g)
      .map(e => ({ e, on: coveredLength(e, house) }))
      .filter(s => s.on > TOL)
      .sort((p, q) => q.on - p.on)[0];
    if (!shared) return null;
    const { e } = shared;
    const inward = { x: -e.n.x, z: -e.n.z };
    const depth = edgesOf(g)[(e.index + 1) % 4].len;
    const range = roomDepthRange(depth);
    const d = roomDepthOf(depth, depthFt);
    const off = (p, k) => pt(p.x + inward.x * k, p.z + inward.z * k);
    const room = [e.a, e.b, off(e.b, d), off(e.a, d)];
    const rest = depth - d > TOL ? [off(e.a, d), off(e.b, d), off(e.b, depth), off(e.a, depth)] : null;
    return { room, rest, a: e.a, b: e.b, inward, depth, depthFt: d, range };
  };
  // A GARAGE THAT IS NOT A PLAIN RECTANGLE -- one stepped 1 ft off a house
  // corner (Movie, 6 Oct: "CONNECT AT CORNER") -- takes its room the same
  // way: from the wall it shares with the house, as deep as asked, and the
  // rest is what lies beyond. The room is the garage clipped at that line;
  // hung past the far wall it is the garage with its far side carried out.
  //
  // A GARAGE WRAPPED ROUND A HOUSE CORNER (Movie, 6 Oct screenshot: down the
  // house's side wall and across the end of its front) shares two walls, and
  // part of it lies behind either one. The room is then measured from the
  // wall that faces the street -- the house front, the way the premade
  // MODIFIED BILEVEL's room runs from it toward the garage door -- and the
  // part of the garage beside the house, behind that line, is room too.
  // Only a garage that lies wholly behind the line it is measured from has
  // nothing to measure, and is refused.
  const roomOverShapedGarage = (g, house, depthFt) => {
    if (g.length < 4) return null;
    const shared = edgesOf(g)
      .map(e => ({ e, on: coveredLength(e, house), front: e.n.z < -0.5 }))
      .filter(x => x.on > TOL)
      .sort((p, q) => (q.front - p.front) || (q.on - p.on))[0];
    if (!shared) return null;
    const { e } = shared;
    const inward = { x: -e.n.x, z: -e.n.z };
    const t = p => (p.x - e.a.x) * inward.x + (p.z - e.a.z) * inward.z;
    const u = p => (p.x - e.a.x) * e.ux + (p.z - e.a.z) * e.uz;
    if (!g.some(p => t(p) > TOL)) return null;
    const depth = Math.max(...g.map(t));
    const range = roomDepthRange(depth);
    const d = roomDepthOf(depth, depthFt);
    const room = d > depth + TOL
      ? clean(g.map(p => (t(p) > depth - TOL
        ? pt(p.x + inward.x * (d - depth), p.z + inward.z * (d - depth)) : p)))
      : clipBy(g, p => t(p) - d);
    const rest = depth - d > TOL ? clipBy(g, p => d - t(p)) : null;
    const lo = Math.min(...g.map(u)), hi = Math.max(...g.map(u));
    const at = k => pt(e.a.x + e.ux * k, e.a.z + e.uz * k);
    return { room, rest, a: at(lo), b: at(hi), inward, depth, depthFt: d, range };
  };
  // Which edge of `loop` dies into `other` (the gable cut flush).
  const flushEdge = (loop, other) => {
    const best = edgesOf(loop).map(e => ({ i: e.index, on: coveredLength(e, other) }))
      .filter(s => s.on > TOL).sort((p, q) => q.on - p.on)[0];
    return best ? best.i : null;
  };

  // ── THE BILEVEL'S LANDING ──────────────────────────────────────────────
  // The house's front edge (the straight run furthest toward +z) and where
  // on it the 12 x 6 landing goes: straddling the garage line, or centred.
  const ENTRY_HALF = () => P().ENTRY_WIDTH_FT / 2;
  const entrySpot = (house, garage) => {
    const fronts = edgesOf(house).filter(e => Math.abs(e.uz) < TOL && e.n.z > 0.5)
      .sort((p, q) => q.a.z - p.a.z || q.len - p.len);
    const front = fronts[0];
    if (!front || front.len < P().ENTRY_WIDTH_FT) return null;
    const lo = Math.min(front.a.x, front.b.x), hi = Math.max(front.a.x, front.b.x);
    const z = front.a.z;
    let line = (lo + hi) / 2;
    let mirror = false;
    if (garage) {
      const spans = coveredSpans(front, garage);
      if (spans.length) {
        const xsAt = spans.flatMap(([a, b]) => [front.a.x + front.ux * a, front.a.x + front.ux * b]);
        const gLo = Math.min(...xsAt), gHi = Math.max(...xsAt);
        // The end of the garage that falls inside the house's front: from
        // there the street half runs one way and the garage half the other.
        if (gLo > lo + TOL) { line = gLo; mirror = false; }
        else if (gHi < hi - TOL) { line = gHi; mirror = true; }
      } else {
        // A GARAGE BESIDE THE FRONT'S END, standing forward of it (Movie,
        // 8 Oct: "the 2 doors should strattle where the garage connects with
        // the house"): nothing of it covers the front, so the landing goes
        // against its side wall at that end -- the street door on the front,
        // the garage door on the shared side wall.
        const depth = P().ENTRY_DEPTH_FT;
        const sideAt = x => edgesOf(garage).some(e => Math.abs(e.ux) < TOL
          && Math.abs(e.a.x - x) < 1e-4
          && Math.min(e.a.z, e.b.z) <= z - depth + 1e-4 && Math.max(e.a.z, e.b.z) >= z - 1e-4);
        if (sideAt(lo)) { line = lo; mirror = true; }
        else if (sideAt(hi)) { line = hi; mirror = false; }
      }
    }
    const half = ENTRY_HALF();
    line = Math.min(hi - half, Math.max(lo + half, line));
    return { edge: front.index, z, line, mirror, lo, hi };
  };
  // The premade bilevel's parts carried to this house: shifted so its garage
  // line lands on `line` and its front on `z`, and turned left for right when
  // the garage is on the other side.
  const carry = (spot) => {
    const s = spot.mirror ? -1 : 1;
    const T = p => pt(spot.line + s * (p.x - PREMADE_LINE_X), spot.z + (p.z - PREMADE_FRONT_Z));
    const loop = l => (l ? l.map(T) : null);
    const run = r => ({ start: T(r.start), end: T(r.end) });
    return {
      loop,
      stairs: st => Object.fromEntries(Object.entries(st).map(([k, v]) =>
        [k, Object.freeze({ ...v, ...T(v) })])),
      framing: f => ({
        fillWalls: f.fillWalls.map(run),
        posts: f.posts.map(T),
        wellBeamZ: spot.z + (f.wellBeamZ - PREMADE_FRONT_Z),
      }),
    };
  };
  // The house with the landing cut out of its front edge.
  const notch = (house, spot) => {
    const depth = P().ENTRY_DEPTH_FT;
    const half = ENTRY_HALF();
    const l = spot.line - half, r = spot.line + half;
    const out = [];
    house.forEach((p, i) => {
      out.push(p);
      if (i !== spot.edge) return;
      const q = house[(i + 1) % house.length];
      const ltr = q.x > p.x;
      const [x1, x2] = ltr ? [l, r] : [r, l];
      [pt(x1, spot.z), pt(x1, spot.z - depth), pt(x2, spot.z - depth), pt(x2, spot.z)]
        .forEach(c => { if (!same(c, out[out.length - 1]) && !same(c, q)) out.push(c); });
    });
    return out;
  };

  // ── WHICH TYPES HANG A GARAGE ON THE HOUSE ─────────────────────────────
  const needsGarage = entryId => !!P().planFor(entryId)?.garage;

  // ── THE PLAN ───────────────────────────────────────────────────────────
  // { entryId, house, garage } -> a plan buildPremadePlan reads, or
  // { error } saying why not.
  const planFromTrace = ({ entryId, house, garage = null, roomDepthFt = null } = {}) => {
    const base = P().planFor(entryId);
    if (!base) return { error: 'NO_DESIGN' };
    const H = clean(house);
    if (H.length < 3) return { error: 'NO_HOUSE' };
    if (base.garage && !garage) return { error: 'NO_GARAGE' };
    const Graw = base.garage && garage ? clean(garage) : null;
    if (Graw && Graw.length < 3) return { error: 'NO_GARAGE' };
    const Gr = Graw ? splitAt(Graw, H) : null;
    const storeys = base.storeys || 1;

    // ── THE BILEVELS ──────────────────────────────────────────────────
    if (base.entry) {
      const spot = entrySpot(H, Graw);
      if (!spot) return { error: 'NO_FRONT' };
      const c = carry(spot);
      const house2 = notch(H, spot);
      const entry = c.loop(base.entry);
      const over = base.overGarage ? roomOverGarage(Graw, H, roomDepthFt) : null;
      if (base.overGarage && !over) return { error: 'ROOM_NEEDS_RECTANGLE' };
      const garageLoop = Gr;
      const plan = {
        ...base,
        house: house2,
        foundation: H,
        houseRoof: H,
        houseOpenings: dealOn(house2, { skip: [entry], cover: Graw ? [Graw] : [] }),
        upperOpenings: null,
        entry,
        entryDeck: c.loop(base.entryDeck),
        entryOpenings: entryGarageDoor(entry, base.entryOpenings, Graw),
        stairs: c.stairs(base.stairs),
        framing: c.framing(base.framing),
        upperLanding: c.loop(base.upperLanding),
        garage: garageLoop,
        garageOpenings: garageLoop ? garageDoors(garageLoop, H) : null,
        garageTieRoof: null,
        storeys,
        traced: true,
      };
      if (over) {
        const room = splitAt(over.room, H);
        plan.overGarage = room;
        // SQUARE over the room, straight across its jog, and joined to the
        // upper landing (premade-plans.js modifiedBilevel, Movie 4-5 Oct).
        // AND NEVER NO ROOF (Movie, 8 Oct: "it had no roof on the room over
        // the garage"): where the landing does not meet the room the join
        // has nothing to join, and the room is roofed on its own.
        plan.overGarageRoof = P().joinLoops(P().squareOver(over.room), plan.upperLanding)
          || P().squareOver(over.room);
        plan.garageRoof = over.rest;
        plan.garageRoofHouseEnd = over.rest ? flushEdge(over.rest, over.room) : null;
        // THE DOOR IN OFF THE UPPER LANDING, on the room's house-side wall
        // where the landing meets it.
        const landing = plan.upperLanding;
        const lx = landing ? (Math.min(...landing.map(p => p.x)) + Math.max(...landing.map(p => p.x))) / 2 : null;
        const side = edgesOf(room).find(e => onOther(e, H) && lx != null
          && lx >= Math.min(e.a.x, e.b.x) - TOL && lx <= Math.max(e.a.x, e.b.x) + TOL);
        plan.overGarageOpenings = [
          ...dealOn(room, { levelId: 2, skip: [H] }),
          ...(side ? [opening(side.index, Math.abs(lx - side.a.x), P().MAN_DOOR_WIDTH_FT, 'door')] : []),
        ];
      } else {
        plan.garageRoof = garageLoop ? Graw : null;
        plan.garageRoofHouseEnd = garageLoop ? flushEdge(Graw, H) : null;
      }
      return plan;
    }

    // ── BUNGALOWS AND 2 STOREYS ───────────────────────────────────────
    const plan = {
      house: H,
      houseOpenings: dealOn(H, { cover: Graw ? [Graw] : [], frontDoor: true }),
      upperOpenings: storeys > 1 ? dealOn(H, { levelId: 2 }) : null,
      storeys,
      garage: Gr,
      garageOpenings: Gr ? garageDoors(Gr, H) : null,
      garageTieRoof: null,
      overGarage: null,
      overGarageOpenings: null,
      overGarageRoof: null,
      traced: true,
    };
    if (!Graw) {
      plan.houseRoof = H;
      plan.garageRoof = null;
      return plan;
    }
    if (base.overGarage) {
      const over = roomOverGarage(Graw, H, roomDepthFt);
      if (!over) return { error: 'ROOM_NEEDS_RECTANGLE' };
      plan.overGarage = splitAt(over.room, H);
      plan.overGarageOpenings = dealOn(plan.overGarage, { levelId: 2, skip: [H] });
      // ONE ROOF over the house and the room; the rest of the garage keeps
      // its own, lower, dying into the room.
      plan.houseRoof = unionLoops(H, over.room) || H;
      plan.garageRoof = over.rest;
      plan.garageRoofHouseEnd = over.rest ? flushEdge(over.rest, over.room) : null;
      if (plan.houseRoof === H) plan.overGarageRoof = over.room;
      return plan;
    }
    if (storeys > 1) {
      // THE DROPPED GARAGE: two roofs.
      plan.houseRoof = H;
      plan.garageRoof = Graw;
      plan.garageRoofHouseEnd = flushEdge(Graw, H);
      return plan;
    }
    // A BUNGALOW'S GARAGE: one roof over both, or two if they will not join.
    const one = unionLoops(H, Graw);
    plan.houseRoof = one || H;
    plan.garageRoof = one ? null : Graw;
    plan.garageRoofHouseEnd = one ? null : flushEdge(Graw, H);
    return plan;
  };

  // A DETACHED GARAGE drawn by hand: its corners and its doors.
  const detachedFromTrace = loop => {
    const g = clean(loop);
    if (g.length < 3) return null;
    return { corners: g, openings: garageDoors(g, null) };
  };

  window.DraftTracedPlans = Object.freeze({
    ROOM_OVER_GARAGE_FT, ROOM_OVER_MIN_FT, ROOM_OVER_CANTILEVER_FT,
    clean, edgesOf, coveredSpans, splitAt, unionLoops, roomOverGarage,
    entrySpot, notch, needsGarage, planFromTrace, detachedFromTrace, flushEdge,
  });
})();
}
