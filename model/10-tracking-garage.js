// MODEL.html's page script, part 10 of 17: hovered nodes, the tracking rays, the attached garage, CONNECT AT CORNER, the house off the trace, the lot.
//
// Stage 2 of the split (Movie, 24 Oct: "how can we reduce the MODEL.html
// size in a nice organized way"): the one script the page carried, cut
// at its own section headings and moved here verbatim, in order. The
// parts load one after another as classic scripts and share one scope,
// as they did inside the page; the indent is the page's, kept so every
// line reads as it did there.

  // ── A HOVERED NODE, AND SHIFT TO LINE UP ON IT (Movie, 23 Oct) ────────
  //
  // "on ARCHICAD, i can SCROLL OVER a node/ or corner and i can use that
  // 'node' or corner (the one most recently scrolled over become the point
  // if i press SHIFT and hold the T SQUARE will line up with that previously
  // scrolled over node and i can enter a length and the length will be
  // measured from that node" -- "if protractor is on at angle use that angle
  // or T use 90"; let go, "the SHIFT will return the cursor to free moving"
  // and the node is hovered again (or a new one) to use it again; every
  // drawing tool.
  //
  // While a drawing tool is up, the node the cursor last passed over is
  // REF_HOVER. SHIFT held with one in hand locks it (refLock): the next point
  // of any drawing tool lies on the line through it -- the locked angle, the
  // protractor's nearest step, or else straight across or straight up --
  // where the hand is along that line, and a length typed is measured from
  // it. Let go, the lock stays only until the pointer moves (so the length
  // can be typed with the hand still), then the cursor is free again and
  // the node forgotten.
  const REF_TOOLS = new Set(['wall', 'line', 'floor', 'shape', 'outline', 'roof', 'dimension', 'beam']);
  const refAim = (ref, at) => {
    const locked = lockedPoint(ref, at);
    if (locked) return locked;
    const stepped = protractorPoint(ref, at);
    if (stepped) return stepped;
    return Math.abs(at.x - ref.x) >= Math.abs(at.z - ref.z) ? { x: at.x, y: 0, z: ref.z } : { x: ref.x, y: 0, z: at.z };
  };
  const refPoint = at => {
    if (!refLock || !at || !REF_TOOLS.has(activeTool)) return null;
    const p = refAim(refLock, at);
    return { x: p.x, y: 0, z: p.z };
  };
  // A LENGTH TYPED WHILE LINED UP: that far from the node, along the line
  // the hand is aiming down. Null when nothing is lined up.
  const refTyped = feet => {
    if (!refLock || !cursorWorld) return null;
    const p = refAim(refLock, cursorWorld);
    const dx = p.x - refLock.x, dz = p.z - refLock.z, len = Math.hypot(dx, dz);
    if (len < 1e-6) return null;
    return { x: refLock.x + dx / len * feet, y: 0, z: refLock.z + dz / len * feet };
  };
  const dropRefLock = () => {
    if (!refLock && !refHover) return false;
    refLock = null;
    refHover = null;
    return true;
  };
  window.addEventListener('keydown', e => {
    // ALT, NOT SHIFT, since 27 Oct: Shift holds the run square, as ARCHICAD's
    // does, and lining up on a node moved over to Alt.
    if (e.key !== 'Alt' || e.repeat || !refHover || refLock || !REF_TOOLS.has(activeTool) || board === 'toy') return;
    const t = e.target;
    if (t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
    // The browser's own Alt (its menu bar) is not wanted on the sheet.
    e.preventDefault();
    refLock = { x: refHover.x, z: refHover.z, released: false, at: null };
    sayOnStrip('LINED UP on that node -- aim along the guide, and type a length to measure it from the node. Let go of ALT and move to go free.');
    paint();
  }, true);
  window.addEventListener('keyup', e => {
    if (e.key !== 'Alt' || !refLock) return;
    e.preventDefault();
    refLock.released = true;
    refLock.at = cursorWorld ? { x: cursorWorld.x, z: cursorWorld.z } : { x: refLock.x, z: refLock.z };
  }, true);
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && dropRefLock()) paint();
  }, true);
  // THE NODE IN HAND, RINGED, AND THE GUIDE FROM IT TO WHERE THE POINT
  // WOULD GO -- dashed while SHIFT holds it.
  paintRefGuide = () => {
    if (presenting || !REF_TOOLS.has(activeTool)) { delete canvas.dataset.refLock; return; }
    const node = refLock || refHover;
    if (!node) { delete canvas.dataset.refLock; return; }
    const ink = '#ffb84d';
    const p = toS(node);
    ctx.save();
    ctx.strokeStyle = ink;
    ctx.lineWidth = refLock ? 2 : 1.2;
    ctx.globalAlpha = refLock ? 1 : 0.6;
    ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.stroke();
    const to = refLock && cursorWorld ? refPoint(cursorWorld) : null;
    if (to) {
      const q = toS(to);
      ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
    if (refLock) canvas.dataset.refLock = JSON.stringify([Number(refLock.x.toFixed(4)), Number(refLock.z.toFixed(4))]);
    else delete canvas.dataset.refLock;
  };
  const drawPoint = at => {
    const ref = refPoint(at);
    if (ref) return ref;
    // THE LOCKED BEARING BEFORE EVERYTHING ELSE: the run travels along it and
    // nothing pulls it off -- no square, no corner snap -- only the whole foot
    // when that is on.
    const locked = lockedPoint(drawStart, at);
    if (locked) return onTheFoot_if() ? onTheFoot(drawStart, locked) : locked;
    // THE PROTRACTOR, LIT: the run turns in its steps, 45 or 30, and the hand
    // sets the length along the step it is nearest.
    const stepped = protractorPoint(drawStart, at);
    if (stepped) return onTheFoot_if() ? onTheFoot(drawStart, stepped) : stepped;
    const wanted = squareTo(drawStart, at);
    const fixed = squaredAxis(drawStart, at);
    // SNAP AND TRACK ON DRAFTING: TOY's points are the foot's. A NODE is
    // exact and skips the foot below; a CROSS LINE only sets the bearing, so
    // with the 1' light on the run still lands on the whole foot along it.
    // AND TOY TAKES THE POINT IT LIGHTS (Movie, 27 Oct: "i'm trying to snap
    // onto the end of the line, but it is snapping me couple inches over from
    // it"). The orange ring lit on the line's end in TOY too, and the press
    // landed where the hand was, or the foot rounded the run past it. A node
    // or the bullseye beats the foot on either board; TOY still takes no face
    // and no cross line. Held square, the run slides along its square to the
    // lit point, as axisSnap does on DRAFTING.
    const caught = !fixed || board === 'toy' ? drawSnap(at) : {};
    const lit = caught.node || caught.bullseye ? caught.pt : null;
    if (fixed && lit) return fixed === 'z' ? { x: lit.x, y: 0, z: wanted.z } : { x: wanted.x, y: 0, z: lit.z };
    const snap = !fixed && (board !== 'toy' || lit) ? caught : {};
    if (snap.pt && !snap.node && !snap.face && onTheFoot_if()) return onTheFoot(drawStart, snap.pt);
    const snapped = fixed ? axisSnap(wanted, fixed, [], board !== 'toy' ? drawMagnet() : null)
      : (snap.pt || cornerSnap(wanted, []));
    if (snapped) return snapped;
    const free = { x: wanted.x, y: 0, z: wanted.z };
    // INSIDE THE HOUSE, TOY'S GRAIN comes before the foot: the point lands on
    // the 6" grid or a hard line, and the run's length is whatever that makes
    // it. A run that starts outside or leaves the house is the foot's.
    const grain = toyInteriorGrain();
    if (grain && inHouse(grain, free) && (!drawStart || inHouse(grain, drawStart))) {
      return toyGrainPoint(grain, free, fixed);
    }
    return onTheFoot_if() ? onTheFoot(drawStart, free) : free;
  };

  // AN UNFINISHED RUN REFUSES A NEW ONE, AND SAYS SO. Ruled 13 Sep, after I
  // reported the boundary rather than hardening it: starting a disconnected
  // run while the first had only two taps used to drop those taps silently.
  // Nothing was lost from a saved file -- a two-point run was never a shape
  // the reader keeps -- but the drafter's hand had done something the screen
  // forgot, which is the quiet half of every failure this board is arranged
  // against.
  //
  // REFUSED AT THE FIRST PRESS OF THE NEW RUN, before any wall is made. The
  // run is what is refused, so refusing it after committing its first wall
  // would be a half-application -- the same thing "Stay in TOY commits nothing
  // and changes nothing" forbids one section over.
  // PRESSING ON THE OPEN END RESUMES THE RUN, and this is what §2's refusal
  // was missing. §2 asks whether the press continues the pending run and
  // tested it with `sameSpot` at 1e-6 -- an EQUALITY test between two points
  // computed by different routes.
  //
  // They cannot match. TOY rounds a run's LENGTH, not its coordinates
  // (model-toy-board.spec.js:333 makes that a rule), so committing the first
  // wall moves its end up to half a foot from the pixel the drafter released
  // on. Press there again to carry on and the raw press is nowhere near the
  // stored end by 1e-6 -- often further than CORNER_SNAP_PX, so cornerSnap
  // does not rescue it either -- and §2 refused a run that was continuing.
  // The wall was silently not drawn, with only the strip to say why.
  //
  // So the question is asked the way every other "did the drafter hit this"
  // question on this page is asked: a grab radius, not an equality. And it
  // returns THE STORED END, so the run resumes exactly where it left off
  // rather than a snap-width away from itself.
  // ── §4: BREAKING THE BONE ────────────────────────────────────────────────
  //
  // Movie: "they will be allowed to 'BREAK the bone' every foot if they want
  // to by clicking on it". The order is explicit that the marks are a set to
  // choose from, not a bone pre-chopped into forty segments: "same result, one
  // decision at a time".
  //
  // THE MARK IS A DISTANCE ALONG THE RUN, NOT A ROUNDED COORDINATE, and that
  // is the rule I broke once already tonight. TOY rounds a run's LENGTH
  // (model-toy-board.spec.js:333), so a bone whose start sits at x = -10.4 has
  // its marks at -9.4, -8.4, ... Rounding the clicked point's x would put the
  // break at a whole number that is not a mark on this bone at all -- whole
  // POSITIONS and a fractional LENGTH, which is exactly backwards.
  const breakMarkOn = (wall, at) => {
    const rx = wall.end.x - wall.start.x, rz = wall.end.z - wall.start.z;
    const run = Math.hypot(rx, rz);
    if (run < 2) return null;              // no interior mark to break at
    const along = ((at.x - wall.start.x) * rx + (at.z - wall.start.z) * rz) / run;
    // CLAMPED OFF BOTH ENDS. A break AT a corner is not a break -- it would
    // make a zero-length half, and the format drops anything under 1e-6 on
    // load, so it would be a wall that vanishes on the next reload.
    // CLAMPED OFF BOTH ENDS, and the clamp IS the guard. A `feet <= 0 || feet
    // >= run` line sat here too and the gate showed it surviving: the clamp
    // already pins feet to [1, floor(run) - 1], so nothing could ever reach
    // it. A guard nothing can exercise is a claim about a case that does not
    // exist -- the same dead-guard shape as the already-angled skip in
    // wouldAngle, removed on the same evidence.
    const feet = Math.min(Math.max(Math.round(along), 1), Math.floor(run) - 1 || 1);
    return { x: wall.start.x + (rx / run) * feet, y: 0,
      z: wall.start.z + (rz / run) * feet };
  };

  // The bone gains the point BETWEEN the two corners it lies between, never
  // appended: an outline is an ordered ring, so a point on the end is a
  // different shape, not the same shape with a joint in it.
  const insertOnEdge = (o, a, b, pt) => {
    const same = (p, q) => Math.hypot(p.x - q.x, p.z - q.z) < 1e-6;
    const pts = o.points || [];
    for (let i = 0; i < pts.length; i += 1) {
      const j = (i + 1) % pts.length;
      if ((same(pts[i], a) && same(pts[j], b)) || (same(pts[i], b) && same(pts[j], a))) {
        pts.splice(i + 1, 0, { x: pt.x, y: 0, z: pt.z });
        return true;
      }
    }
    return false;
  };

  // A BREAK ON A MASTERED LEVEL CUTS THE MASTER, ruled 14 Sep: "yes break
  // master and all that area attached to it locked to it".
  //
  // I BUILT THIS BACKWARDS FIRST. The line here read `if (o.masterId)
  // continue` -- "a master's copy is not ours to cut" -- which is the opposite
  // of the ruling, and the order names exactly why it matters: THE FIRST HOUSE
  // DRAWN IS MASTER-DERIVED, so refusing the break on a mastered outline makes
  // the very first bone anyone wants to cut the one bone that will not cut. It
  // would have passed every check I had written, because all of them draw one
  // unmastered bone.
  //
  // So the master governs the break exactly as it governs a move -- one rule
  // for the master, not one for moving and another for cutting -- and every
  // level locked to it takes the same cut. The unlocked exit is §5a's and is
  // not invented here.
  // TAKES THE ORIGINAL ENDS, not a wall. The first version took the new tail
  // wall and read its `start` -- which is the break point, because breakBoneAt
  // has already moved it. So it searched every ring for an edge from the mark
  // to the far corner, an edge that does not exist yet, matched nothing, and
  // cut no bone at all. The five §4 checks all passed anyway: they assert the
  // WALLS, and the wall split was fine. Only 7a, which reads the rings, saw it.
  const boneGainsPoint = (a, b, pt) => {
    const all = drawing.outlines || [];
    const hit = all.find(o => insertOnEdge(o, a, b, pt));
    if (!hit) return false;
    if (!hit.masterId) return true;        // a purely local bone cuts alone
    // The master, then every OTHER level that follows it. The clicked level is
    // already cut, and the geometry is the master's, so each copy takes the
    // cut at the same place on the same edge rather than at a point computed
    // again per level.
    (drawing.boneyardOutlines || []).forEach(m => {
      if (m.id === hit.masterId) insertOnEdge(m, a, b, pt);
    });
    all.forEach(o => {
      if (o === hit || o.masterId !== hit.masterId) return;
      insertOnEdge(o, a, b, pt);
    });
    return true;
  };

  const breakBoneAt = (wall, pt) => {
    // CAPTURED BEFORE THE MUTATION, because the ring still describes the wall
    // as it was and that is the edge the break has to be placed on.
    const was = { a: { x: wall.start.x, z: wall.start.z },
      b: { x: wall.end.x, z: wall.end.z } };
    const mid = poolVertex(pt, wall.levelId, wall.view);
    const tail = { ...wall, id: newDrawingItemId('wall'), start: mid, end: wall.end };
    wall.end = mid;
    const at = (drawing.walls || []).indexOf(wall);
    drawing.walls.splice(at < 0 ? drawing.walls.length : at + 1, 0, tail);
    boneGainsPoint(was.a, was.b, pt);
    // NO ROOF REBUILD. Movie, on a BREAK in an interior wall: *"i made a
    // 'BREAK' in an interior wall and a roof appeared. do you know why?"* --
    // this line used to call rebuildRoofs() "because the ring changed", and it
    // ran for EVERY break. rebuildRoofs walks every level, so the break was
    // only the trigger: a drawing that had never been through the roof
    // builder got a 4/12 hip over the whole top floor from a click on a
    // partition.
    //
    // AND A BREAK NEVER CHANGES A ROOF. On an exterior wall it adds a point
    // along a STRAIGHT edge of the bone -- the same area, the same uncovered
    // region, the same roof. On an interior wall it touches no bone at all.
    // The roof follows the bone when the bone's shape changes, which is the
    // drag that comes after a break (the boneFollows + rebuildRoofs on drag
    // end), not the break itself.
    undoStack.push({ kind: 'add', wall: tail });
    markDirty();
    paint();
    return tail;
  };

  // ── §4's SECOND HALF: THE CONNECTOR ──────────────────────────────────────
  //
  // "After a break the two halves are independent bones and each obeys §3."
  // A joint alone does not deliver that. The halves of a broken run are
  // COLLINEAR and share a corner, so dragging one swings the other -- §3b
  // refuses it rather than produce a diagonal, which is safe and leaves the L
  // and the bump-out the order names as the POINT of §4 unreachable.
  //
  // What makes them reachable: the drag UNSHARES that corner. The dragged
  // wall takes its own vertex, the neighbour keeps the old one, and a
  // connector wall spans the two. As the drag proceeds the connector grows --
  // perpendicular to the wall being dragged, because the move is -- and that
  // connector IS the side of the bump-out. Nothing is left angled, so §3b has
  // nothing to refuse.
  //
  // ONLY FOR COLLINEAR NEIGHBOURS. A perpendicular neighbour just gets longer
  // and stays square, which is §3's whole behaviour on an ordinary house;
  // splitting corners there would drop a zero-length wall into the drawing on
  // every drag.
  //
  // ONCE, WHEN THE DRAG ARMS, not on every pointermove -- a connector per
  // mouse event would be several hundred walls across one gesture.
  const collinearWith = (wall, other) => {
    const rx = wall.end.x - wall.start.x, rz = wall.end.z - wall.start.z;
    const ox = other.end.x - other.start.x, oz = other.end.z - other.start.z;
    const a = Math.hypot(rx, rz), b = Math.hypot(ox, oz);
    if (a < 1e-9 || b < 1e-9) return false;
    return Math.abs((rx * oz - rz * ox) / (a * b)) < 1e-6;
  };

  // ── SHIFT LETS A WALL GO OF ITS CORNERS (Movie, 18 Oct) ───────────────
  //
  // "an option to DISCONNECT the nodes at corners, maybe by pressing SHIFT
  // while attempting to move the line, then the nodes will disconnect when
  // SHIFT is being depressed but will bouce back to connected if SHIFT is
  // released" -- for the inside wall of a suite moved half an inch off the
  // party wall. Held, the dragged wall rides corners of its own and the walls
  // it met stay where they were; let go mid-drag, it takes the shared corners
  // back and they stretch with it again. Whichever it is on the release is
  // what is drawn, and one UNDO puts it all back.
  const setWallLoose = (md, on) => {
    if (md.kind !== 'wall' || !md.body || !walls().includes(md.body)) return;
    const wall = md.body;
    if (on && !md.loose) {
      const shared = md.before;
      // The shared corners back where they started, for the walls that stay.
      shared.forEach(b => { b.vtx.x = b.x; b.vtx.z = b.z; relinkVertex(b.vtx); });
      const fresh = shared.map(b => {
        const v = { x: b.x, y: b.vtx.y ?? 0, z: b.z, srcId: b.vtx.srcId ?? null, offX: b.vtx.offX ?? 0, offZ: b.vtx.offZ ?? 0 };
        vertexPool.push(v);
        if (wall.start === b.vtx) wall.start = v;
        if (wall.end === b.vtx) wall.end = v;
        return { vtx: v, x: b.x, z: b.z };
      });
      md.loose = { shared, fresh };
      md.before = fresh;
    } else if (!on && md.loose) {
      const { shared, fresh } = md.loose;
      fresh.forEach((f, i) => {
        if (wall.start === f.vtx) wall.start = shared[i].vtx;
        if (wall.end === f.vtx) wall.end = shared[i].vtx;
        const at = vertexPool.indexOf(f.vtx);
        if (at >= 0) vertexPool.splice(at, 1);
      });
      md.before = shared;
      md.loose = null;
    }
  };
  // ALT-DRAG LETS A CORNER GO (Movie, 22 Oct: "sometimes there is a corner
  // where a node is connected, sometimes i'd like to disconnect them and
  // extend one of the corner lines/walls"). A corner is one pooled point
  // every run meeting there owns, so a plain drag moves them all. With ALT
  // (or CTRL) held on the press, the SELECTED run's end takes a separate
  // vertex at the same place (the pool's own rule: "two corners at the same
  // place are still two corners if the pool never merged them") and the drag
  // moves that one; the others keep the corner. Carried on the drag as
  // `loose`, the shape the Shift body-drag already uses, so the one 'move'
  // undo joins them again. A free end has nothing to let go of.
  const detachCorner = (md, v) => {
    const run = selectedSegment();
    if (!run || (run.start !== v && run.end !== v)) return;
    const others = [...walls(), ...lines()].filter(r => r !== run && (r.start === v || r.end === v));
    if (!others.length) return;
    const fresh = { x: v.x, y: v.y ?? 0, z: v.z, srcId: v.srcId ?? null, offX: v.offX ?? 0, offZ: v.offZ ?? 0 };
    vertexPool.push(fresh);
    if (run.start === v) run.start = fresh; else run.end = fresh;
    md.body = run;
    md.before = [{ vtx: fresh, x: v.x, z: v.z, offX: v.offX, offZ: v.offZ }];
    md.follow = anchorFollowers(md.before, null);
    md.loose = { shared: [{ vtx: v, x: v.x, z: v.z }], fresh: [{ vtx: fresh, x: v.x, z: v.z }] };
    md.detached = fresh;
    sayOnStrip(`Corner let go — this ${walls().includes(run) ? 'wall' : 'line'}'s end moves alone; the other keeps the corner. UNDO joins them again.`);
  };
  // DOORS, WINDOWS AND FIXTURES STAY PUT WHEN A WALL'S END IS DRAGGED
  // (Movie, 23 Oct: "when a wall is stretched/shrunk lengthwise, can the
  // doors stay in the same position and if the wall is squeezed smaller than
  // where the door is, delete that door"). An opening's offset is measured
  // from its wall's start, so a start dragged took every door on the wall
  // with it. Each opening on a wall the end belongs to is held where it
  // stood on the sheet -- its centre, read off the wall as it was when the
  // end was pressed -- and its offset re-read from the wall as it is now; on
  // release, one no longer wholly on its wall is deleted. One UNDO puts the
  // offsets and the deleted back (the drag's step becomes a batch).
  const stayPutOf = (md, grabbed) => {
    if (md.stayPut) return md.stayPut;
    const v = grabbed.vtx, from = { x: grabbed.x, z: grabbed.z };
    md.stayPut = [];
    (drawing.walls || []).filter(w => w.start === v || w.end === v).forEach(wall => {
      const s = wall.start === v ? from : wall.start, e = wall.end === v ? from : wall.end;
      const len = Math.hypot(e.x - s.x, e.z - s.z) || 1;
      [drawing.fenestrations || [], drawing.fixtures || []].forEach(list => list
        .filter(o => String(o.wallId) === String(wall.id) && Number.isFinite(Number(o.offset)))
        .forEach(item => {
          const t = Number(item.offset) / len;
          md.stayPut.push({ item, wall, list, before: { ...item },
            at: { x: s.x + (e.x - s.x) * t, z: s.z + (e.z - s.z) * t } });
        }));
    });
    return md.stayPut;
  };
  const keepOpeningsPut = (md, grabbed) => {
    stayPutOf(md, grabbed).forEach(r => {
      const w = r.wall;
      const dx = w.end.x - w.start.x, dz = w.end.z - w.start.z, len = Math.hypot(dx, dz);
      if (len < 1e-6) return;
      const along = ((r.at.x - w.start.x) * dx + (r.at.z - w.start.z) * dz) / len;
      r.item.offset = Number(along.toFixed(4));
    });
  };
  // ON RELEASE: the ones no longer wholly on their wall go, as undoable
  // removals; the rest's new offsets, as a props step.
  const settleOpeningsPut = md => {
    const gone = [], edits = [];
    (md.stayPut || []).forEach(r => {
      const w = r.wall, len = Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z);
      const half = (Number(r.item.width) || 0) / 2, off = Number(r.item.offset);
      if (off - half < -1e-6 || off + half > len + 1e-6) {
        // AS IT WAS, so UNDO puts back the record the drafter had, not one
        // carrying the offset it fell off the wall with.
        r.item.offset = Number(r.before.offset);
        const index = r.list.indexOf(r.item);
        if (index >= 0) { r.list.splice(index, 1); gone.push({ kind: 'remove-item', list: r.list, index, item: r.item }); }
      } else if (Math.abs(off - Number(r.before.offset)) > 1e-9) edits.push({ item: r.item, before: r.before });
    });
    if (gone.length) sayOnStrip(`${gone.length} off the wall now, deleted. UNDO brings ${gone.length === 1 ? 'it' : 'them'} back.`);
    return [...(edits.length ? [{ kind: 'props', edits }] : []), ...gone];
  };
  const splitRunCorners = md => {
    if (board !== 'toy' || md.kind !== 'wall' || !md.body) return;
    const wall = md.body;
    md.before.forEach(b => {
      const v = b.vtx;
      const touching = (drawing.walls || [])
        .filter(w => w !== wall && (w.start === v || w.end === v));
      if (!touching.some(other => collinearWith(wall, other))) return;
      // A SEPARATE VERTEX AT THE SAME PLACE, and poolVertex must not be used:
      // mergeVertex merges by position and would hand back the very corner
      // being unshared. The pool's own rule allows this -- "two corners at the
      // same place are still two corners if the pool never merged them".
      const fresh = { x: v.x, y: 0, z: v.z,
        srcId: v.srcId ?? null, offX: v.offX ?? 0, offZ: v.offZ ?? 0 };
      vertexPool.push(fresh);
      if (wall.start === v) wall.start = fresh; else wall.end = fresh;
      b.vtx = fresh;
      const conn = { ...wall, id: newDrawingItemId('wall'), start: fresh, end: v };
      // Which neighbour this corner was shared WITH, so the constraint call
      // can be told it is no longer carried by the move.
      conn.detachedFrom = (touching.find(other => collinearWith(wall, other)) || {}).id;
      drawing.walls.push(conn);
      undoStack.push({ kind: 'add', wall: conn });
      md.connectors = (md.connectors || []).concat(conn);
    });
    if (md.connectors) markDirty();
  };

  // ── §5: A ROOF OVER WHATEVER NOTHING SITS ON ─────────────────────────────
  //
  // Movie, 14 Sep: a roof belongs to "every part of a floor that nothing sits
  // on" -- so it is a FUNCTION of the difference between one storey's
  // footprint and the one above it, recomputed when either bone moves, not a
  // thing attached to the top storey. A ranch is the degenerate case.
  //
  // THE GEOMETRY IS geometry-2d.js's, not a second opinion. uncoveredRegions
  // does the rectilinear difference and returns rectangles, because a storey
  // set back on all sides leaves a RING and the format's roof has `points`
  // with no holes.
  //
  // WHICH ROOFS ARE OURS: `sourceShapeId`, which the format already carries
  // (drawing-format.js:490) and which means "where this came from". A roof
  // built from a bone names that bone; a roof a drafter drew names nothing and
  // is NEVER touched here. No new field, and no guessing.
  const storeyAbove = levelId => {
    const here = (drawing.levels || []).find(l => Number(l.id) === Number(levelId));
    if (!here) return null;
    return (drawing.levels || [])
      .filter(l => (Number(l.elev) || 0) > (Number(here.elev) || 0))
      .sort((a, b) => (Number(a.elev) || 0) - (Number(b.elev) || 0))[0] || null;
  };

  const boneOf = levelId => (drawing.outlines || [])
    .find(o => Number(o.levelId) === Number(levelId)) || null;

  // The edge that dies into the storey above is a GABLE -- ruled 14 Sep, "the
  // roof should terminate where it meets the upper storey wall like a garage
  // roof that is dropped". A gable end is vertical and carries no eave
  // overhang, which is the property that matters: an eave there would hang two
  // feet of roof straight into the house above.
  //
  // The format has no third kind -- an edge is `gable` if it says so and
  // `eave` otherwise -- so this needs no format change and no older reader
  // sees anything it cannot read.
  const edgeKinds = (ring, upper) => {
    if (!upper) return ring.map(() => 'eave');
    const onUpper = pt => (upper.points || []).some((a, i) => {
      const b = upper.points[(i + 1) % upper.points.length];
      const cross = (b.x - a.x) * (pt.z - a.z) - (b.z - a.z) * (pt.x - a.x);
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len < 1e-9 || Math.abs(cross) / len > 1e-6) return false;
      const t = ((pt.x - a.x) * (b.x - a.x) + (pt.z - a.z) * (b.z - a.z)) / (len * len);
      return t >= -1e-6 && t <= 1 + 1e-6;
    });
    return ring.map((pt, i) => {
      const next = ring[(i + 1) % ring.length];
      return onUpper(pt) && onUpper(next) ? 'gable' : 'eave';
    });
  };

  // THE BONE FOLLOWS THE DRAG, and until §5 it did not.
  //
  // §2 is explicit: "a level's bone drives that level's FLOOR and WALL nodes"
  // and "the bone is not a separate drawing that happens to look like the
  // plan". But §3's drag moves wall VERTICES and nothing else, so every TOY
  // drag left the outline behind as a stale snapshot of where the house used
  // to be. Invisible on screen -- the walls are what paints -- and invisible
  // to every §3 check, which all read walls.
  //
  // §5 is what made it bite: roofs derive from the bone, so a bone that never
  // moved produced a roof over the old footprint. The drag moved the wall a
  // foot and the roof stayed where it was.
  //
  // By the ORIGINAL position, not by identity: an outline point is a plain
  // record, not the pooled vertex object the wall holds, so the two are only
  // ever connected by where they sit.
  //
  // ON THIS LEVEL ONLY. The first version walked every outline in the drawing
  // and moved any point sitting at the dragged corner -- so dragging the main
  // floor's wall silently reshaped the SECOND FLOOR's bone, because storeys
  // stacked on the same footprint have points at identical coordinates. A
  // §5 check caught it: the storey above followed the floor below and the
  // roof between them never changed. Matching by position is right; matching
  // by position across levels is not.
  const boneFollows = (before, levelId) => {
    const rings = (drawing.outlines || [])
      .filter(o => Number(o.levelId) === Number(levelId));
    before.forEach(b => {
      if (b.x === b.vtx.x && b.z === b.vtx.z) return;
      rings.forEach(ring => (ring.points || []).forEach(pt => {
        if (Math.hypot(pt.x - b.x, pt.z - b.z) > 1e-6) return;
        pt.x = b.vtx.x;
        pt.z = b.vtx.z;
      }));
    });
  };

  const rebuildRoofs = () => {
    const G = window.DraftGeometry2D;
    if (!G || !G.uncoveredRegions) return;
    const mine = new Set();
    (drawing.levels || []).forEach(level => {
      const bone = boneOf(level.id);
      if (!bone) return;
      mine.add(String(bone.id));
      const above = storeyAbove(level.id);
      const cover = above ? boneOf(above.id) : null;
      const regions = G.uncoveredRegions(bone.points || [], cover ? cover.points : null);
      // DROP THIS BONE'S OLD ROOFS FIRST, so a storey pushed back out takes
      // its roof away with it rather than leaving the old one behind. "A roof
      // appears" is satisfied by an implementation that only ever adds.
      drawing.roofs = (drawing.roofs || [])
        .filter(r => String(r.sourceShapeId || '') !== String(bone.id));
      regions.forEach(ring => {
        drawing.roofs.push({
          id: newDrawingItemId('roof'),
          points: ring.map(pt => ({ x: pt.x, y: 0, z: pt.z })),
          levelId: Number(level.id),
          sourceLevelId: above ? Number(above.id) : null,
          sourceShapeId: String(bone.id),
          edges: edgeKinds(ring, cover),
          // THE FORMAT'S OWN DEFAULTS, written out rather than left implicit:
          // pitch 4 is the 4/12 that was ruled, overhang 2 is what a roof
          // reads back as anyway (drawing-format.js:493-494).
          overhang: 2,
          pitch: 4,
          garage: false,
        });
      });
    });
    markDirty();
  };

  const boneChoice = document.getElementById('bone-choice');
  let boneChoiceFor = null;
  const closeBoneChoice = () => { boneChoiceFor = null; boneChoice.hidden = true; };
  const offerBoneChoice = (wall, at) => {
    const pt = breakMarkOn(wall, at);
    if (!pt) { sayOnStrip('this wall is too short to break'); return; }
    boneChoiceFor = { wall, pt };
    boneChoice.hidden = false;
    boneChoice.querySelector('[data-break-here]').focus();
  };
  boneChoice.querySelector('[data-break-here]').addEventListener('click', () => {
    const pick = boneChoiceFor;
    closeBoneChoice();
    if (pick) breakBoneAt(pick.wall, pick.pt);
  });
  // NOTHING AT ALL, the same contract as Stay in TOY: the drag already moves
  // the wall, so this button's whole job is to leave without changing
  // anything. A choice that always did something would not be a choice.
  boneChoice.querySelector('[data-break-move]').addEventListener('click', closeBoneChoice);

  const toyOpenEnd = at => {
    if (board !== 'toy' || !pendingBone) return null;
    const open = pendingBone.points[pendingBone.points.length - 1];
    if (!open) return null;
    const reach = CORNER_GRAB_PX / view.scale;
    return Math.hypot(at.x - open.x, at.z - open.z) <= reach
      ? { x: open.x, y: 0, z: open.z }
      : null;
  };

  const toyRunRefused = at => {
    if (board !== 'toy' || !pendingBone) return false;
    if (endsAt(pendingBone, at)) return false;      // this press continues it
    // NAMES BOTH WAYS OUT, because the order's wording does: "finish or cancel
    // the run you started". Escape is the cancel.
    sayOnStrip('finish or cancel the run you started — Esc cancels');
    return true;
  };

  const drawPress = at => {
    if (!drawStart) {
      // Resume before refusing: a press on the open end is the drafter
      // carrying on, which is the one case the refusal must not catch.
      const open = activeTool === 'wall' ? toyOpenEnd(at) : null;
      // stripRefresh BESIDE THE PAINT, on both openings. Without it the strip
      // still read "wall — first point" with a first point already down, and
      // the length box and angle box -- which stripRefresh is what enables --
      // stayed dead until the pointer happened to move. A mouse always moves,
      // so this was invisible on a PC and wrong on a tablet, where a tap sets
      // the anchor and nothing moves afterwards. Found by a check asserting
      // the strip SAID second point rather than that drawStart was set.
      if (open) { clearNotice(); drawStart = open; stripRefresh(); paint(); return; }
      if (activeTool === 'wall' && toyRunRefused(drawPoint(at))) return;
      clearNotice();
      drawStart = drawPoint(at); stripRefresh(); paint(); return;
    }
    clearNotice();
    const end = drawPoint(at);
    // A wall of no length is not a wall — the format drops anything under
    // 1e-6 on load, so committing one would write a record that vanishes on
    // the next open. Treat the second tap as a correction, not a commit.
    if (Math.hypot(end.x - drawStart.x, end.z - drawStart.z) < 0.001) { drawStart = end; paint(); return; }
    // WEARING WHAT THE BRUSH IS HOLDING, if it is holding a wall. Movie, 20
    // Sep: "if they change to WALL command and start drawing a wall those
    // 'selected' drafting brush properties will remain". Passed in HERE and
    // at the two typed-commit sites below rather than read inside commitWall,
    // because that function is also how a premade house and an ordered garage
    // raise their walls -- a loaded brush must not change what the bone
    // builds. Empty brush, empty options, and the drafter's stored defaults
    // answer exactly as they did.
    const made = commitDrawn(drawStart, end);
    // CHAINING, the old page's habit: the next wall starts where this one
    // ended, so a room is four taps and not eight. The pooled END object is
    // the start, so the corner is shared by identity.
    drawStart = made.item.end;
    setSelection([made]);
    stripRefresh();
    paint();
  };

  // ── THE OUTLINE TOOL ─────────────────────────────────────────────────────
  //
  // PARITY-model-html-vs-dc.md has carried "Draw an outline — absent,
  // must-have" since #389, and the reason is written at :3866: the old page's
  // _pressBuildType does TWO things, records the type and arms the outline
  // tool, and only the first half came across because there was no tool to
  // arm. This is the second half.
  //
  // THE GESTURE IS drawPress's SIBLING, not a new idea: successive presses
  // drop corners, and pressing the first corner again closes the loop. No
  // Enter and no FINISH button, because that is the old page's contract and a
  // tool that needs a keyboard is not one an iPad at the counter can use.
  //
  // WHAT IT PERSISTS IS THE OLD PAGE'S SHAPE, through outline-master.js rather
  // than a second copy of it: a master on the BONEYARD shelf holding the
  // common geometry, and a copy on every level linked back corner by corner.
  // This page still shows no BONEYARD -- that absence is settled -- and writes
  // the master anyway, sight unseen, because BUILD HOUSE reads outlines and
  // the drawing is shared with a page that does show it.
  let outlineCorners = [];
  // The corners of whichever loop is being traced right now, or null: the
  // armed tool's own list, and only while it holds a corner. UNDO takes from
  // this before it touches the saved edits.
  const pendingCornerList = () => {
    const list = activeTool === 'outline' ? outlineCorners
      : activeTool === 'floor' ? floorCorners
        : activeTool === 'shape' ? shapeCorners : null;
    return list && list.length ? list : null;
  };
  // THE TRACE IN HAND, whichever tool holds it: an outline's, a floor's or a
  // shape's corners, or the single slope roof's outline once it is at that
  // stage. Its corners send rays and its first corner is a node (Movie, 21
  // Oct, closing a roof: "having a hard time to complete the roof, can we
  // make the CROSS LINES (perpendicular locations) and the NODE SNAP on the
  // first point so the last point can find first point easily").
  const shedTracing = () => activeTool === 'roof' && !!shedRoof && shedRoof.stage === 'shape';
  const traceCorners = () => (shedTracing() ? shedRoof.corners : (pendingCornerList() || []));
  // THE FIRST CORNER IS A NODE ONCE THE LOOP CAN CLOSE ON IT -- three corners
  // down. Below three a press near it is a corner placed there, the rule every
  // loop tool keeps, and a node there would pull the hand onto it.
  const traceHome = () => { const c = traceCorners(); return c.length >= 3 ? [c[0]] : []; };
  // ── THE ORANGE TRACKING RAYS ───────────────────────────────────────────
  //
  // Movie, 1 Oct: *"at this point when i'm drawing a wall past the first point
  // i'd like orange lines to shoot across the screen 90 horiz from the first
  // point"*, then *"show the orange lines going rays outward in H and V
  // directions 90 180 270 0 and if he crosses one of them, light it up
  // glow"*, *"brighter orange"*, *"no snapping to the line"*, *"only brighten
  // it and glow it when he is on it"*, and *"make those orange lines for all
  // the ext wall nodes when they draw that and the outline too"*.
  //
  // SO: FROM EVERY POINT OF THE RUN IN HAND, four rays -- right, down, left,
  // up -- faint, across the whole sheet. The one the cursor is on lights up
  // bright and glows, and since 17 Oct (TRACK, drawSnap) a press within that
  // same reach lands on it: "i want to be able to 'snap' on the cross lines".
  //
  // THE WALL RUN'S POINTS ARE COLLECTED HERE because the wall gesture only
  // keeps its open end (`drawStart`); each place the run has stood is pushed
  // as it moves on, and the list empties when the run ends. The outline keeps
  // its own corners already.
  let wallRunNodes = [];
  // THE CROSS LINES CATCH FROM 1" (Movie, 26 Oct, one snapping rule), held
  // between 4 and 30 px on the screen like every other reach. A fixed six
  // pixels was a whole foot on a house fitted to the sheet (6 px a foot), and
  // a corner traced a foot off a line jumped on to it.
  const rayHitPx = () => reachFt('track') * view.scale;
  const trackingNodes = () => {
    // AND THE HOUSE'S CORNERS WHILE THE GARAGE IS DRAWN (Movie, 6 Oct: "when
    // i draw the GARAGE shape can the HOUSE shape nodes also create the
    // ORANGE Raylines"), so a garage corner lines up with the house's before
    // the first one is down. After the garage's own, so theirs keep their
    // places in the list.
    if (activeTool === 'outline' && outlineGarage && tracedOrder && traceStillThere(tracedHouse)) {
      const house = tracedHouse.points.map(p => ({ x: Number(p.x), z: Number(p.z) }))
        .filter(p => !outlineCorners.some(c => Math.abs(c.x - p.x) < 1e-6 && Math.abs(c.z - p.z) < 1e-6));
      return [...outlineCorners, ...house];
    }
    if (activeTool === 'outline') return outlineCorners;
    // A FLOOR'S, A SHAPE'S OR THE SINGLE SLOPE ROOF'S OUTLINE IN HAND tracks
    // from every corner too, as the house outline always has (Movie, 21 Oct).
    const trace = traceCorners();
    if (trace.length) return trace;
    // A DRAGGED END TRACKS FROM THE CORNERS IT COULD LINE UP WITH (Movie, 22
    // Oct: "i'd like the interior corners to have mini-node style magnetic
    // link / cross lines"): the faces' corners of every wall the end is not
    // joined to -- inside corners among them -- each sending its cross the
    // moment the hand is in line with it, and none before, so a house's
    // dozens of corners do not fill the sheet with lines.
    const md = moveDrag;
    if (md && md.kind === 'corner' && md.active && board !== 'toy') {
      md.rays ||= dragMagnet(md.before[0].vtx).corners;
      return md.rays.filter(c => litRays([c], cursorWorld).length);
    }
    if (!drawsRun() || !drawStart) { wallRunNodes = []; return wallRunNodes; }
    const last = wallRunNodes[wallRunNodes.length - 1];
    if (!last || Math.hypot(last.x - drawStart.x, last.z - drawStart.z) > 1e-6) {
      wallRunNodes.push({ x: drawStart.x, z: drawStart.z });
    }
    return wallRunNodes;
  };
  // Which rays the cursor is on: within a few pixels of the line, and on the
  // ray's own side of its node (a ray runs one way only).
  const litRays = (nodes, cursor) => {
    if (!cursor) return [];
    const c = toS(cursor);
    const lit = [];
    const hit = rayHitPx();
    nodes.forEach((node, i) => {
      const p = toS(node);
      const dx = c.x - p.x, dy = c.y - p.y;
      if (Math.abs(dy) <= hit && Math.abs(dx) > hit) lit.push({ i, dir: dx > 0 ? 0 : 180 });
      if (Math.abs(dx) <= hit && Math.abs(dy) > hit) lit.push({ i, dir: dy > 0 ? 90 : 270 });
    });
    return lit;
  };
  const TRACK_LIT = '#c8ff3a';
  const TRACK_FAINT = 'rgba(190, 255, 60, 0.28)';
  const TRACK_GLOW = 'rgba(200, 255, 60, 0.95)';
  // THE NODE A PRESS WOULD LAND ON, while a wall, line or outline is being
  // drawn: an orange glowing donut with an orange dot on the exact point
  // (Movie, 17 Oct: "a glowing donut with a orange dot in the middle" --
  // "node snape orange glow"). And a cross line snapped to from a node that
  // sends no ray of its own, lit while it holds the point.
  // ORANGE ON A NODE, NEON OFF ONE (Movie, 19 Oct: "please make mouseover
  // glow orange at 'magnetic snap nodes' and glow yellow green neon for LINE
  // and non node corner magnetic snaps"). A node is a wall's or a line's own
  // end; a face corner or a point on a face is not, and wears the cross
  // lines' colour.
  // THREE COLOURS FOR THREE TIERS (Movie, 19 Oct): ORANGE on a node,
  // YELLOW on a corner that acts like one, NEON on a face.
  const DONUT = {
    orange: { ink: '#ff9a1f', glow: 'rgba(255, 150, 30, 0.95)' },
    yellow: { ink: '#ffe600', glow: 'rgba(255, 230, 0, 0.95)' },
    neon: { ink: TRACK_LIT, glow: TRACK_GLOW },
    // THE POINT A MOVE WILL TAKE HOLD OF, its own colour, so the selection's
    // circle never reads as a target's.
    grab: { ink: '#22e3ff', glow: 'rgba(34, 227, 255, 0.95)' },
  };
  const tierOf = lit => (lit?.seg ? 'neon' : lit?.node ? 'orange' : 'yellow');
  const paintDonut = (pt, tier = 'orange') => {
    const c = DONUT[tier] || DONUT.orange;
    const p = toS(pt);
    ctx.save();
    ctx.shadowColor = c.glow;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = c.ink;
    ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };
  // THE MAGNETS IN REACH, in the cross lines' neon (Movie, 19 Oct: "make the
  // nodes light up bright orange and the edge of walls and corners that are
  // magnetic to light up the neon green yellow shade we have for the cross
  // lines"). The faces and face corners near the cursor glow faintly, so the
  // hand can see what will pull before it does; the one that has the point
  // glows bright, and the point itself takes the orange donut.
  const paintMagnets = (cursor, magnet, lit, { nodes = false } = {}) => {
    if (!cursor || !magnet) return;
    const reach = MAGNET_SHOW_PX / view.scale;
    const near = c => Math.hypot(c.x - cursor.x, c.z - cursor.z) <= reach;
    const segOn = seg => {
      const a = toS(seg.a), b = toS(seg.b);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    };
    ctx.save();
    magnet.segs.forEach(seg => {
      const foot = faceFoot(seg, cursor);
      if (!foot || Math.hypot(foot.x - cursor.x, foot.z - cursor.z) > reach) return;
      const on = lit?.seg === seg;
      ctx.strokeStyle = on ? TRACK_LIT : TRACK_FAINT;
      ctx.lineWidth = on ? 2 : 1;
      ctx.shadowColor = on ? TRACK_GLOW : 'transparent';
      ctx.shadowBlur = on ? 10 : 0;
      segOn(seg);
    });
    // THE CORNERS THAT ACT LIKE NODES, in yellow.
    magnet.corners.forEach(c => {
      if (!near(c)) return;
      const p = toS(c);
      ctx.fillStyle = DONUT.yellow.ink;
      ctx.shadowColor = DONUT.yellow.glow;
      ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
    });
    // AND THE NODES, faint orange, where the hand asked to see them (MOVE:
    // "stuff should glow when i mouse over so i know its magnetic snapable").
    if (nodes) (magnet.nodes || []).forEach(n => {
      if (!near(n) || n === lit?.corner) return;
      const p = toS(n);
      ctx.fillStyle = DONUT.orange.ink;
      ctx.shadowColor = DONUT.orange.glow;
      ctx.shadowBlur = 8;
      ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    });
    ctx.restore();
  };
  // THE SQUARE LINE-UP'S GUIDE: dashed, from the point to what it lined up
  // with, in the tier's colour.
  const paintGuide = (guide, tier = 'orange') => {
    const c = DONUT[tier] || DONUT.orange;
    const p = toS(guide.from), q = toS(guide.to);
    ctx.save();
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 1.25;
    ctx.setLineDash([6, 4]);
    ctx.shadowColor = c.glow;
    ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    ctx.restore();
  };
  // MOVE ARMED AND NOTHING PRESSED YET: the magnet the hover reads, worked
  // out again only when the drawing or the selection has changed, and what
  // the cursor would catch in it. Null when there is nothing to show -- a
  // roof's own MOVE, a beam row (no magnet, by Movie's word), SNAP off, TOY.
  let moveHoverCache = { key: '', magnet: null };
  const moveHover = () => {
    if (!moveState?.on || moveState.drag || moveState.roof || !selection.length || !cursorWorld) return null;
    if (!snapLive() || board === 'toy' || selection.every(e => e.type === 'beam')) return null;
    const key = `${modelEpoch}|${undoStack.length}|${selection.map(e => `${e.type}:${e.item?.id ?? ''}`).join(',')}`;
    if (moveHoverCache.key !== key) moveHoverCache = { key, magnet: magnetExcluding(carriedPoints(selectionEntries())) };
    return { magnet: moveHoverCache.magnet, lit: pointCatch(cursorWorld, moveHoverCache.magnet) };
  };
  const paintFaceLit = seg => {
    const a = toS(seg.a), b = toS(seg.b);
    ctx.save();
    ctx.strokeStyle = TRACK_LIT;
    ctx.lineWidth = 2;
    ctx.shadowColor = TRACK_GLOW;
    ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.restore();
  };
  // FOR THE SPECS: what the point is held by, and where -- and, on a dragged
  // wall, which of its own faces did the lining up.
  const markMagnet = lit => {
    if (!lit) { canvas.removeAttribute('data-snap-magnet'); return; }
    const r4 = v => Number(v.toFixed(4));
    canvas.setAttribute('data-snap-magnet', JSON.stringify({
      kind: lit.seg ? 'face' : lit.node ? 'node' : 'corner',
      at: [r4(lit.pt.x), r4(lit.pt.z)],
      ...(lit.own ? { own: [[r4(lit.own.a.x), r4(lit.own.a.z)], [r4(lit.own.b.x), r4(lit.own.b.z)]] } : {}),
      ...(lit.guide ? { guide: [[r4(lit.guide.from.x), r4(lit.guide.from.z)], [r4(lit.guide.to.x), r4(lit.guide.to.z)]] } : {}) }));
  };
  // THE NODE A PRESS WOULD LAND ON, while a wall, line or outline is being
  // drawn: an orange glowing donut with an orange dot on the exact point
  // (Movie, 17 Oct: "a glowing donut with a orange dot in the middle" --
  // "node snape orange glow"). And a cross line snapped to from a node that
  // sends no ray of its own, lit while it holds the point.
  const paintSnapNode = () => {
    // A FIXTURE THAT CAUGHT ITS NEIGHBOUR: the orange ring on the joint.
    // A SELECT drag holds it in moveDrag, a MOVE drag in moveState.
    const fixtureHeld = moveDrag?.kind === 'fixture' ? moveDrag
      : (() => { try { return moveState?.drag?.kind === 'fixture' ? moveState.drag.md : null; } catch { return null; } })();
    if (fixtureHeld) {
      canvas.removeAttribute('data-snap-node');
      if (fixtureHeld.lit) paintDonut(fixtureHeld.lit.pt, 'orange');
      markMagnet(fixtureHeld.lit || null);
      return;
    }
    // A NODE BEING DRAGGED shows what has it, from the drag's own answer.
    if ((moveDrag?.kind === 'corner' || moveDrag?.kind === 'wall') && moveDrag.active) {
      canvas.removeAttribute('data-snap-node');
      paintMagnets(moveDrag.cursor, moveDrag.magnet, moveDrag.lit);
      // A DRAGGED WALL'S OWN FACE GLOWS WITH WHAT CAUGHT IT (Movie, 19 Oct:
      // wall surfaces "magnetic for other wall surfaces"): both faces lit,
      // so the hand sees which of its two faces lined up.
      if (moveDrag.lit?.own) paintFaceLit(moveDrag.lit.own);
      if (moveDrag.lit) paintDonut(moveDrag.lit.pt, tierOf(moveDrag.lit));
      // THE END LET GO OF ITS CORNER glows orange in the hand (detachCorner).
      if (moveDrag.detached) paintDonut(moveDrag.detached, 'orange');
      markMagnet(moveDrag.lit);
      return;
    }
    // A SUITE HELD BY ITS CORNER (suiteGrabAt): the corner cyan in the
    // hand, or what it has landed on; before the press, the corner a press
    // would take -- with the suite in hand from its card's MOVE, or under
    // SELECT over any suite.
    const tm = (() => { try { return traceMoving; } catch { return null; } })();
    const grabMark = p => canvas.setAttribute('data-move-grab', JSON.stringify([Number(p.x.toFixed(4)), Number(p.z.toFixed(4))]));
    if (tm?.from && tm.grab && tm.before) {
      canvas.removeAttribute('data-snap-node');
      const held = { x: tm.grab.x + tm.underlay.x - tm.before.x, y: 0, z: tm.grab.z + tm.underlay.z - tm.before.z };
      if (tm.pointLock) paintDonut(tm.pointLock.lit.pt, tierOf(tm.pointLock.lit));
      else paintDonut(held, 'grab');
      grabMark(held);
      markMagnet(tm.pointLock?.lit || null);
      return;
    }
    // A FLIGHT HELD BY ITS CORNER (stairCornerAt): what it has landed on,
    // or the corner cyan in the hand.
    if (moveDrag?.kind === 'stair' && moveDrag.corner) {
      canvas.removeAttribute('data-snap-node');
      const held = { x: moveDrag.corner.x + moveDrag.stair.start.x - moveDrag.start.x, y: 0,
        z: moveDrag.corner.z + moveDrag.stair.start.z - moveDrag.start.z };
      if (moveDrag.lit) paintDonut(moveDrag.lit.pt, tierOf(moveDrag.lit));
      else paintDonut(held, 'grab');
      grabMark(held);
      markMagnet(moveDrag.lit || null);
      return;
    }
    const stairHover = !tm && !moveDrag && cursorWorld && activeTool === RESTING_TOOL
      ? selection.filter(e => e.type === 'stair').map(e => stairCornerAt(e.item, cursorWorld)).find(Boolean) : null;
    if (stairHover) {
      canvas.removeAttribute('data-snap-node');
      paintDonut({ x: stairHover.x, y: 0, z: stairHover.z }, 'grab');
      grabMark(stairHover);
      return;
    }
    const suiteHover = !cursorWorld || (tm && (!tm.hologram || tm.from)) ? null
      : tm ? suiteGrabAt(tm.underlay, cursorWorld)
        : activeTool === RESTING_TOOL ? holograms().filter(h => !h.hidden).map(h => suiteGrabAt(h, cursorWorld)).find(Boolean) : null;
    if (suiteHover) {
      canvas.removeAttribute('data-snap-node');
      paintDonut({ x: suiteHover.x, y: 0, z: suiteHover.z }, 'grab');
      grabMark(suiteHover);
      return;
    }
    // A FLOORING CORNER IN HAND shows the corner it will land on.
    if (moveDrag?.kind === 'roomcorner' && moveDrag.lit) {
      canvas.removeAttribute('data-snap-node');
      paintDonut(moveDrag.lit.pt, tierOf(moveDrag.lit));
      markMagnet(moveDrag.lit);
      return;
    }
    // THE MOVE TOOL'S DRAG shows what has it, the same way -- with the nodes
    // too, and the square line-up's guide.
    const mv = moveState?.drag;
    if (mv?.moved && (mv.kind === 'selection' || mv.kind === 'roof' || mv.kind === 'node')) {
      canvas.removeAttribute('data-snap-node');
      paintMagnets(mv.cursor, mv.magnet, mv.lit, { nodes: mv.kind === 'selection' });
      if (mv.lit?.guide) paintGuide(mv.lit.guide, tierOf(mv.lit));
      if (mv.lit) paintDonut(mv.lit.pt, tierOf(mv.lit));
      markMagnet(mv.lit);
      return;
    }
    // AND BEFORE THE PRESS, what the hand is over glows (Movie, 19 Oct:
    // "stuff should glow when i mouse over so i know its magnetic snapable").
    // THE SELECTION'S OWN CORNER UNDER THE HAND, before the press: the
    // circle the press will take hold of exactly (moveGrabAt).
    const grabHover = moveState?.on && !moveState.drag && !moveState.roof && cursorWorld ? moveGrabAt(cursorWorld) : null;
    if (grabHover) {
      canvas.removeAttribute('data-snap-node');
      paintDonut({ x: grabHover.x, y: 0, z: grabHover.z }, 'grab');
      canvas.setAttribute('data-move-grab', JSON.stringify([Number(grabHover.x.toFixed(4)), Number(grabHover.z.toFixed(4))]));
      return;
    }
    canvas.removeAttribute('data-move-grab');
    const hover = moveHover();
    if (hover) {
      canvas.removeAttribute('data-snap-node');
      paintMagnets(cursorWorld, hover.magnet, hover.lit, { nodes: true });
      if (hover.lit) paintDonut(hover.lit.pt, tierOf(hover.lit));
      markMagnet(hover.lit);
      return;
    }
    // A LOOP BEING TRACED -- outline, floor, shape -- reads the magnet too.
    const tracesLoop = activeTool === 'outline' || activeTool === 'floor' || activeTool === 'shape'
      // AND THE SINGLE SLOPE ROOF'S OUTLINE (Movie, 21 Oct), so its first
      // corner glows under the hand as the house outline's does.
      || shedTracing();
    if (!cursorWorld || !(drawsRun() || tracesLoop)) { markMagnet(null); return; }
    // A RUN HELD SQUARE asks the squared magnet, as drawPoint does; the
    // locked bearing and the protractor take no magnet at all.
    const runs = drawsRun() && board !== 'toy' && drawStart;
    const steered = runs && (lockedPoint(drawStart, cursorWorld) || protractorPoint(drawStart, cursorWorld));
    const fixed = runs && !steered ? squaredAxis(drawStart, cursorWorld) : null;
    const magnet = (drawsRun() || tracesLoop) && !steered ? drawMagnet() : null;
    if (fixed) {
      const lit = axisMagnet(squareTo(drawStart, cursorWorld), fixed, [], magnet);
      paintMagnets(cursorWorld, magnet, lit);
      if (lit) paintDonut(lit.pt, tierOf(lit));
      markMagnet(lit);
      canvas.removeAttribute('data-snap-node');
      return;
    }
    // AND THE WIDER CORNER CATCH UNDER IT. drawPoint falls back on
    // cornerSnap when SNAP finds nothing, and that took a wall's node with no
    // glow at all (Movie, 19 Oct: "looks like the LINE does attach to nodes,
    // but the rollover doesn't glow so the user is unaware of this").
    let snap = drawSnap(cursorWorld);
    if (!snap.pt && (drawsRun() || tracesLoop) && board !== 'toy') {
      const caught = cornerSnap(cursorWorld, []);
      if (caught) snap = { pt: { x: caught.x, y: 0, z: caught.z }, node: caught };
    }
    paintMagnets(cursorWorld, magnet, snap.face ? { seg: snap.face } : null);
    const ownNode = snap.node && isOwnNode(snap.node);
    if (snap.node || snap.bullseye || snap.face) {
      paintDonut(snap.pt, snap.face ? 'neon' : snap.node && !ownNode ? 'yellow' : 'orange');
      if (snap.node || snap.bullseye) {
        canvas.setAttribute('data-snap-node', JSON.stringify([Number(snap.pt.x.toFixed(4)), Number(snap.pt.z.toFixed(4))]));
      } else canvas.removeAttribute('data-snap-node');
    } else {
      canvas.removeAttribute('data-snap-node');
    }
    markMagnet(snap.face ? { pt: snap.pt, seg: snap.face }
      : snap.node ? { pt: snap.pt, node: ownNode, corner: snap.node } : null);
    (snap.rays || []).forEach(ray => {
      const p = toS(ray.n), q = toS(snap.pt);
      ctx.save();
      ctx.strokeStyle = TRACK_LIT;
      ctx.lineWidth = 1.25;
      ctx.shadowColor = TRACK_GLOW;
      ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      ctx.restore();
    });
  };
  const paintTrackingRays = () => {
    // THE SHEET ONLY. The rail paints its thumbnails through this same pass
    // with `ctx` pointed at a little canvas; a sight line has no business on
    // a thumbnail, and its attribute must describe the sheet.
    if (ctx.canvas !== canvas) return;
    paintSnapNode();
    const nodes = trackOn ? trackingNodes() : [];
    if (!nodes.length) { canvas.removeAttribute('data-tracking-rays'); return; }
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const lit = litRays(nodes, cursorWorld);
    const isLit = (i, dir) => lit.some(r => r.i === i && r.dir === dir);
    const end = (p, dir) => (dir === 0 ? { x: w, y: p.y } : dir === 180 ? { x: 0, y: p.y }
      : dir === 90 ? { x: p.x, y: h } : { x: p.x, y: 0 });
    ctx.save();
    nodes.forEach((node, i) => {
      const p = toS(node);
      [0, 90, 180, 270].forEach(dir => {
        const on = isLit(i, dir);
        const q = end(p, dir);
        // NEON YELLOW-GREEN, VERY THIN (Movie, 17 Oct: "can we make the
        // cross more of a yellow green neon color and very very thin line
        // that glows brighter when you are in 'snap mode closeness to it").
        ctx.strokeStyle = on ? TRACK_LIT : TRACK_FAINT;
        ctx.lineWidth = on ? 1.25 : 0.75;
        ctx.shadowColor = on ? TRACK_GLOW : 'transparent';
        ctx.shadowBlur = on ? 10 : 0;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
      });
    });
    ctx.restore();
    // FOR THE SPECS: the nodes the rays leave from and which of them is lit.
    canvas.setAttribute('data-tracking-rays', JSON.stringify({
      nodes: nodes.map(n => [Number(n.x.toFixed(4)), Number(n.z.toFixed(4))]),
      lit: lit.map(r => [r.i, r.dir]),
    }));
  };
  // WHICH BUILD FAMILY ARMED THE TRACE, kept for the colour: the order's rule
  // 4 is that a house outline draws in the build-bar family's colour, "red
  // house / blue split".
  let outlineFamily = null;
  // The floor being traced, corner by corner. A SEPARATE LIST from the
  // outline's on purpose: the two tools draw the same SHAPE and mean entirely
  // different things -- an outline is a guide that never prints, a floor is
  // structure -- and one shared array would let an abandoned trace of either
  // finish as the other.
  let floorCorners = [];
  let shapeCorners = [];

  // THE FAMILY COLOURS, and what each one is answerable to.
  //
  // BUNGALOW is the old page's house trace EXACTLY -- #c0392b is
  // MODEL.dc.html's own `traceHouse` (:8276), not a red picked to match it.
  //
  // BILEVEL is the "blue split" half of the order and it has NO counterpart on
  // the old page: a bilevel trace there is house red like every other, and the
  // SPLIT button that stood in that strip before the build menu never drew
  // anything -- _pressSplitLevel was a stub that said "coming soon". So this
  // is a colour the rung INTRODUCES rather than one it carries across, and it
  // is the page's existing trace blue rather than a seventh hex. That blue is
  // also the ATTACHED garage run's on the old page. The two cannot collide
  // today, because garage runs are not on this page at all; whoever lands them
  // owns telling them apart, and this note is the warning rather than a
  // surprise waiting in the palette.
  //
  // THE GARAGE FAMILY IS ABSENT ON PURPOSE -- see armOutline, which refuses it
  // rather than colouring it.
  // ROLE NAMES, not colours: the value is read from the live skin at call
  // time so a theme switch reaches a trace already on screen.
  const OUTLINE_TRACE_ROLES = Object.freeze({
    bungalow: 'draw-trace-bungalow',
    bilevel: 'draw-trace-bilevel',
  });
  // The colour the PAINTER is handed for a house trace. Falls back to the
  // house red rather than throwing: a family the map has not heard of is a
  // menu that grew, and a trace drawn in the ordinary house colour is a far
  // better answer to that than a trace that does not draw.
  const outlineTraceColor = () =>
    skin[OUTLINE_TRACE_ROLES[outlineFamily?.id] || OUTLINE_TRACE_ROLES.bungalow];

  // HOW NEAR COUNTS AS CLOSING. In FEET rather than pixels, so the same press
  // closes the same loop whatever the zoom: a pixel tolerance would demand
  // surgical aim zoomed out and would swallow a deliberate second corner
  // zoomed in.
  const OUTLINE_CLOSE_FT = 1.5;

  // IS THIS A GARAGE ORDER? Asked in ONE place because two copies of it is
  // how the trace and the bone come to disagree about the same tile -- and
  // they answer opposite questions from the same test, so a copy that drifted
  // would arm a house trace for a garage at one end and refuse to build it at
  // the other.
  const isGarageChoice = picked =>
    picked?.family?.id === 'detachedGarage' || Boolean(picked?.entry?.foundation);

  // WHAT THE DRAFTER PRESSES NEXT, in the words of the thing he picked. One
  // sentence, said from both ways in -- the tile arms the trace, and the
  // bone takes the sign down over the top of it -- so the page cannot tell
  // him two different things about one gesture.
  const sayTraceThe = picked => sayOnStrip(
    `Trace your ${isGarageChoice(picked) ? 'garage' : (picked?.entry?.label || 'house')} — `
    + 'press each corner, then the first corner again to close.');

  // Whether the trace in hand is a garage's: only ever from the OUTLINE
  // press, since a garage tile alone does not arm a trace.
  let outlineGarage = false;

  // ── THE TRACED HOUSE, STEP BY STEP (BONEYARD PR 3) ───────────────────
  // Movie, 3 Oct: "main floor -> garage (if attached) -> bone builds, like
  // the premade houses". The type picked on the board rides along with the
  // trace, and each loop is kept as it closes; the bone then builds the
  // whole house off them (traced-plans.js -> buildPremadePlan).
  let tracedOrder = null;
  let tracedBuildsOnClose = false;
  let tracedHouse = null;
  let tracedGarage = null;
  let tracedMasters = [];
  // WHERE THE ROOM OVER THE GARAGE ENDS, in feet from the house, once the
  // drafter has moved its end wall; null is the design's own 18 ft.
  let roomOverFt = null;

  const armOutline = (picked, { fromLink = false } = {}) => {
    // A DETACHED GARAGE PRESS IS NOT A HOUSE TRACE, and answering it with one
    // is worse than answering it with nothing. The old page sends those
    // entries to _toggleGarageMode('detached') with the foundation they
    // pre-answered (MODEL.dc.html:14339); garages are not traced on this page,
    // so arming the house trace here would take a garage press and persist a
    // master carrying `garage: false` -- a wrong drawing rather than a missing
    // feature, and one nothing downstream can tell from a house the drafter
    // meant to draw.
    //
    // AND IT NO LONGER SAYS THEY ARE NOT ON THIS PAGE, because they are:
    // buildOrderedGarage (:7085) sets one on the lot off the sign's bone. The
    // old sentence was written before that landed and it cost Movie a bug
    // report -- he read "not on this page yet", believed the page, and only
    // found the working gesture by pressing the bone anyway. A refusal that
    // is out of date is worse than no refusal: it argues the drafter out of
    // something that works.
    // UNLESS HE ASKED TO DRAW IT: the OUTLINE press is offered for every
    // type (Movie, 3 Oct), the garage included, and then the loop he draws
    // is the garage's.
    if (isGarageChoice(picked) && !fromLink) {
      sayOnStrip('Pick a size, then press the bone — I’ll set the garage on the lot.');
      return;
    }
    // THROUGH THE REGISTER, NOT AROUND IT. This line was `activeTool =
    // 'outline'` and had to be: outline was not in the roster at all, so
    // setTool would have found it unavailable on every board and put SELECT on
    // instead. Now that it is a tool, arming it any other way would make the
    // board a look rather than a rule -- the exact thing setTool's own comment
    // is about -- and would leave the strip and the key faces reading a tool
    // the page is not actually holding.
    //
    // THE ORDER MATTERS. setTool fires the listeners, and the one below clears
    // the pending corners and the family for whatever is being armed; the
    // choice's own family and its named sentence land after, on top.
    //
    // PUTTING THE OLD LINE BACK WAS TRIED AS A MUTATION AND SURVIVED, which is
    // worth writing down rather than leaving as a caught row nobody checked.
    // `activeTool = 'outline'` plus by-hand copies of the two clears setTool
    // does is behaviourally identical to this for everything today's two
    // boards can express. What it does NOT copy is `beamStart` -- a drafter
    // who anchored a beam and then picked a house type would keep that anchor,
    // which is the chain-commits-into-the-next-tool defect setTool's comment
    // describes -- and the board's refusal, which neither board can currently
    // demonstrate because both offer outline. So the register is the right
    // door for reasons no check here can fail on; that is the reason, not a
    // measurement, and it is labelled as such.
    setTool('outline');
    outlineFamily = picked?.family ?? null;
    outlineGarage = isGarageChoice(picked);
    // A NEW TYPE STARTS A NEW HOUSE: the loops of an earlier trace stay in
    // the drawing, but they are not this order's.
    tracedOrder = picked?.entry ? picked : null;
    // ONLY THE OUTLINE PRESS BUILDS ON CLOSE (Movie, 3 Oct: "if they select
    // the OUTLINE ... build the house"). A type picked at the window arms
    // the same trace and still waits for the bone, as it always has.
    tracedBuildsOnClose = Boolean(fromLink && tracedOrder);
    tracedHouse = null;
    tracedGarage = null;
    tracedMasters = [];
    roomOverFt = null;
    // ── AND THE FIRST CORNER IS ALREADY ON THE BULLSEYE ──────────────────
    //
    // Movie, 15 Oct: "when they select to DRAW THE OUTLINE (at the drive
    // thru) when the drivethru window disappears and it goes to the model
    // space screen, select the first point for them on the bullseye
    // (registration point), and allow them to proceed from that point".
    //
    // The sign comes down and the drafter is left in front of an empty sheet
    // with one mark on it. Clicking that mark is what he was going to do, so
    // the press does it for him and his first click is the SECOND corner.
    //
    // ONLY FROM THE DRIVE-THRU PRESS. A type picked at the window arms this
    // same trace and then waits for the bone -- he has not said he is about
    // to draw, and seeding a corner under a drafter who is still choosing
    // would put a point on his drawing he never placed.
    //
    // AFTER setTool, WHICH IS WHAT CLEARS THE LIST. Its listener empties
    // outlineCorners for whatever is being armed; a seed written before it
    // would be swept by the arming that was supposed to carry it.
    //
    // AND ONLY WHERE THERE IS A MARK TO START ON. gridDatum answers three
    // ways -- a point the drawing carries, the back-filled world origin, or
    // NOTHING -- and the painter draws the bullseye on exactly the first two.
    // Where it draws none, there is nothing on screen for this corner to be
    // standing on, and a point placed out of sight is worse than no point.
    const bullseye = fromLink ? gridDatum() : null;
    outlineCorners = bullseye ? [{ x: bullseye.x, z: bullseye.z }] : [];
    sayTraceThe(picked);
    paint();
  };

  // PUTTING THE TRACE DOWN IS PART OF PUTTING THE TOOL DOWN. setTool clears
  // the wall's anchor and the beam's for the reason its comment gives -- a
  // half-finished gesture belongs to the tool being put down, and an anchor
  // carried across is how a chain commits into the next tool's first tap. The
  // outline's pending corners are a third one of exactly that kind, and they
  // were the one nothing cleared: switch to SELECT mid-house, come back, and
  // the next press continued a loop the drafter had walked away from.
  //
  // They are cleared HERE rather than inside setTool because setTool is a
  // const several hundred lines above these `let`s and runs once at load --
  // naming them from inside it would be a temporal dead zone waiting for the
  // first drafter who armed a tool early.
  toolListeners.push(next => {
    outlineCorners = [];
    floorCorners = [];
    shapeCorners = [];
    outlineFamily = null;
    outlineGarage = false;
    // ARMED FROM THE KEY, which carries no house type with it -- so the trace
    // is the plain house red that outlineTraceColor falls back to, and the
    // sentence is the one without a name in it. A house-type press says the
    // named version immediately after this, over the top.
    if (next === 'outline') sayTraceThe(null);
  });

  // ── IT DRAWS LIKE EXT WALL (Movie, 3 Oct) ─────────────────────────────
  // "like EXT WALL": every edge square to the one before it -- 90-degree
  // corners -- and a whole number of feet long, on every board, with the
  // LENGTH and ANGLE boxes, the same rubber band and the orange rays. The
  // first corner lands where it is pressed (or on a corner it is near), the
  // way the wall's first point does; every corner after it is the cursor
  // squared off the last corner and brought to the nearest whole foot, so
  // the whole loop sits on whole feet from where it started and the last
  // edge can come home square.
  //
  // ── AND ON DRAFTING, 45s (Movie, 17 Oct) ──────────────────────────────
  // The North Point building has one chamfered corner, 10' x 10' on its grid
  // lines, and an outline that only turned square could not trace it: "the
  // 45 angle i need it too". So on DRAFTING the outline turns in eighth
  // turns -- square or 45, nothing between -- and the hand, the protractor
  // and the typed boxes all take it. TOY keeps the quarter turn: a 45 is a
  // building TOY cannot make, and the ANGLE box typed 45 is what moves the
  // board, as it always was.
  const outlineStep = () => (board === 'toy' ? 90 : 45);
  const outlineTail = () => outlineCorners[outlineCorners.length - 1] || null;
  // ── THE ATTACHED GARAGE'S OPEN RUN (MODEL.dc.html's, Movie 6 Oct) ─────
  // A traced house's garage can be drawn the old page's way: first corner ON
  // the house, three legs (or more) out, around and back, last corner ON the
  // house -- and it closes itself along the house wall. A closed loop still
  // works as it always did.
  const GARAGE_RUN_LINE = 'Now draw the garage: start ON the house, three legs out, around and back, '
    + 'and land the last corner ON the house — it closes itself.';
  const garageRunHouse = () => (activeTool === 'outline' && outlineGarage && tracedOrder
    && traceStillThere(tracedHouse) ? tracedHouse.points.map(p => ({ x: Number(p.x), z: Number(p.z) })) : null);
  const ringEdges = loop => loop.map((a, i) => ({ i, a, b: loop[(i + 1) % loop.length] }));
  const nearestOnSegment = (p, a, b) => {
    const dx = b.x - a.x, dz = b.z - a.z;
    const len2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2));
    const q = { x: a.x + t * dx, z: a.z + t * dz };
    return { q, t, d: Math.hypot(p.x - q.x, p.z - q.z) };
  };
  // Which house edge a point lies on, or -1.
  const houseEdgeAt = (house, p) => {
    const hit = ringEdges(house).find(e => nearestOnSegment(p, e.a, e.b).d < 1e-6);
    return hit ? hit.i : -1;
  };
  // The first corner lands ON the house wall when pressed near it, a whole
  // number of feet along that wall.
  const snapOntoHouse = (house, at) => {
    const best = ringEdges(house).map(e => ({ e, ...nearestOnSegment(at, e.a, e.b) }))
      .sort((p, q) => p.d - q.d)[0];
    if (!best || best.d > OUTLINE_CLOSE_FT) return null;
    const { a, b } = best.e;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const along = Math.max(0, Math.min(len, Math.round(best.t * len)));
    return { x: a.x + (b.x - a.x) * along / len, z: a.z + (b.z - a.z) * along / len };
  };
  // The last leg is brought onto the house wall when it is pressed near it:
  // along its own line to where that line meets the house.
  const legOntoHouse = (house, from, pt) => {
    const dx = Math.sign(pt.x - from.x), dz = Math.sign(pt.z - from.z);
    if (!dx && !dz) return null;
    let best = null;
    ringEdges(house).forEach(({ a, b }) => {
      // Axis-aligned leg against any edge: solve from + s*(dx,dz) on a..b.
      const ex = b.x - a.x, ez = b.z - a.z;
      const den = dx * ez - dz * ex;
      if (Math.abs(den) < 1e-9) return;
      const s = ((a.x - from.x) * ez - (a.z - from.z) * ex) / den;
      const u = ((a.x - from.x) * dz - (a.z - from.z) * dx) / den;
      if (s <= 1e-6 || u < -1e-6 || u > 1 + 1e-6) return;
      const q = { x: from.x + dx * s, z: from.z + dz * s };
      const off = Math.hypot(q.x - pt.x, q.z - pt.z);
      if (off <= OUTLINE_CLOSE_FT && (!best || off < best.off)) best = { q, off };
    });
    return best ? best.q : null;
  };
  // Home along the house wall from `end` to `start`, the shorter way round.
  const alongHouse = (house, end, start) => {
    const ei = houseEdgeAt(house, end), si = houseEdgeAt(house, start);
    if (ei < 0 || si < 0) return null;
    const n = house.length;
    const walk = step => {
      const out = [];
      let i = ei;
      for (let guard = 0; guard < n && i !== si; guard += 1) {
        i = (i + step + n) % n;
        // Forward visits each edge's END corner; backward each edge's START.
        out.push(step > 0 ? house[i] : house[(i + 1) % n]);
      }
      return out;
    };
    const length = pts => [end, ...pts, start].reduce((sum, p, k, all) =>
      (k ? sum + Math.hypot(p.x - all[k - 1].x, p.z - all[k - 1].z) : 0), 0);
    if (ei === si) return [];
    const fwd = walk(1), back = walk(-1);
    return length(fwd) <= length(back) ? fwd : back;
  };

  const outlinePoint = at => {
    const ref = refPoint(at);
    if (ref) return { x: ref.x, z: ref.z };
    const from = outlineTail();
    if (!from) {
      const corner = cornerSnap(at, []);
      if (corner) return { x: corner.x, z: corner.z };
      const snap = board !== 'toy' ? drawSnap(at) : {};
      if (snap.node || snap.bullseye) return { x: snap.pt.x, z: snap.pt.z };
      const house = garageRunHouse();
      const onHouse = house && snapOntoHouse(house, at);
      return onHouse || { x: at.x, z: at.z };
    }
    // The lock and the hand both turn in the outline's own step: a quarter
    // turn on TOY, an eighth on DRAFTING.
    const step = outlineStep();
    const locked = lockedPoint(from, at, { step });
    // ── ON DRAFTING THE OUTLINE OBEYS THE INSTRUMENTS, AS A WALL DOES ──────
    // Movie, 17 Oct, tracing the North Point building to the inch: "i have
    // the T and PROTRACTOR both turned OFF and angle i deleted to make sure
    // but it doesn't allow the line to move freely and i can't finish this
    // PRECISE outline". With the T-square lit it turns square; with an angle
    // locked it holds it; with neither the hand is FREE, and a pressed corner
    // is not rounded to the foot unless the 1' light is on -- it lands where
    // it is pressed, or on a corner, or on the first corner's line square to
    // it (the orange ray), so the loop can always be brought home. TOY keeps
    // its law: square, on the foot.
    if (board !== 'toy' && !locked) {
      const hand = tsquareLive() ? outlineHand(from, at, 90)
        : protractorOn ? outlineHand(from, at, protractorStep) : outlineAligned(at);
      const pt = onTheFoot_if() ? onTheFoot(from, hand) : hand;
      return { x: pt.x, z: pt.z };
    }
    const square = locked || outlineHand(from, at, step);
    const footed = onTheFoot(from, square);
    return { x: footed.x, z: footed.z };
  };
  // A FREE PRESS, SNAPPED: onto a corner if one is in reach, else onto the
  // first corner's own lines (the orange rays, square to it) if the press is
  // within a few pixels of one, else exactly where it was pressed.
  const outlineAligned = at => {
    const corner = cornerSnap(at, []);
    const first = outlineCorners[0];
    // HOME ONLY ONCE THERE IS A LOOP TO CLOSE: three corners. With one, a
    // short first edge pressed within the reach of the first corner was
    // pulled back on to it and lost -- the 1' step of Movie's MOD BILEVEL
    // garage, traced with the house fitted to the sheet (6 px a foot).
    if (first && outlineCorners.length >= 3
      && Math.hypot(at.x - first.x, at.z - first.z) <= reachFt(NODE_REACH)) return { x: first.x, z: first.z };
    if (corner) return { x: corner.x, z: corner.z };
    // SNAP AND TRACK, as a wall's point has them: a node, or the cross lines
    // -- the first corner's among them, so the loop can always be brought
    // home square. TRACK switched off, the press stays where it was (Movie:
    // "have them ON default", and off means off).
    const snap = drawSnap(at);
    if (snap.pt) return { x: snap.pt.x, z: snap.pt.z };
    return { x: at.x, z: at.z };
  };
  // THE HAND'S BEARING, ROUNDED TO THE STEP, and the point on it nearest the
  // hand. A quarter turn is the square it always was, written as it was --
  // the longer of the two runs wins -- so a TOY outline cannot move by so
  // much as a tie-break.
  const outlineHand = (from, at, step) => {
    const dx = at.x - from.x, dz = at.z - from.z;
    if (step === 90) return Math.abs(dx) >= Math.abs(dz) ? { x: at.x, z: from.z } : { x: from.x, z: at.z };
    const [ux, uz] = stepTurn(Math.round(Math.atan2(-dz, dx) * 180 / Math.PI / step) * step);
    const t = dx * ux + dz * uz;
    return { x: from.x + ux * t, z: from.z + uz * t };
  };
  // A STEP'S DIRECTION: an eighth turn exactly (below), anything else -- the
  // protractor's 30s and 60s -- by its cosine and sine.
  const stepTurn = deg => (deg % 45 === 0 ? eighthTurn(deg)
    : [Math.cos(deg * Math.PI / 180), -Math.sin(deg * Math.PI / 180)]);
  // THE PROTRACTOR'S POINT for a run from `from`, or null when it is dark.
  // Not on TOY, which holds every run square already.
  const protractorPoint = (from, at) => {
    if (!protractorOn || board === 'toy' || !from || !at) return null;
    const p = outlineHand(from, at, protractorStep);
    return { x: p.x, y: 0, z: p.z };
  };
  // AN EIGHTH TURN'S DIRECTION, EXACTLY. cos(90°) is 6e-17 in floating
  // point, not 0, and a square edge built from it lands its corner at
  // 14.000000000000002 -- off square by a hair, which every exact test
  // downstream (the roof's wings, the garage's join, a traced house's own
  // checks) reads as not square at all. So the axes are 0 and 1 and the
  // diagonals are the one root half, signed.
  const eighthTurn = deg => {
    const k = ((Math.round(deg / 45) % 8) + 8) % 8;
    const r = Math.SQRT1_2;
    return [[1, 0], [r, -r], [0, -1], [-r, -r], [-1, 0], [-r, r], [0, 1], [r, r]][k];
  };
  const sameCorner = (a, b) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.z - b.z) < 1e-6;
  // ── THE EDGE HOME ──────────────────────────────────────────────────────
  // It keeps the same law as every other edge -- square, or 45 on DRAFTING --
  // and it is allowed an eighth of an inch to get there. A 45 on a real
  // building is never a whole number: the North Point chamfer is 10'-6.59"
  // each way on its outside face, a diagonal of 14'-11.03", and no typed
  // sixteenth lands the loop back on its first corner exactly. Refusing
  // that would make the 45 a corner nobody could close.
  //
  // THE LAST CORNER SLIDES ALONG ITS OWN EDGE to make the edge home exact,
  // rather than the edge home leaning: an edge a hair off square is not
  // square, and the roof's wing reading (roofWingsOf) asks for square to a
  // millionth of a foot. So the closed loop is exactly what the law says,
  // and the drafter's last edge is at most a fraction of an inch longer or
  // shorter than he typed.
  const OUTLINE_HOME_FT = 1 / 96;
  const homeTail = () => {
    const first = outlineCorners[0], last = outlineTail();
    // FREE, THE EDGE HOME IS WHATEVER IT IS: on DRAFTING with no instrument
    // lit the outline turns at any angle, so its last edge may too.
    if (board !== 'toy' && !tsquareLive() && !protractorOn && angleLockDeg() == null) return last;
    const prev = outlineCorners[outlineCorners.length - 2];
    const dx = first.x - last.x, dz = first.z - last.z;
    const r = Math.SQRT1_2;
    const ways = outlineStep() === 90 ? [[1, 0], [0, 1]]
      : board !== 'toy' && protractorOn && protractorStep === 30
        ? [0, 30, 60, 90, 120, 150].map(stepTurn)
        : [[1, 0], [0, 1], [r, r], [r, -r]];
    let best = null;
    ways.forEach(([ux, uz]) => {
      const miss = Math.abs(dx * uz - dz * ux);
      if (miss > OUTLINE_HOME_FT || (best && miss >= best.miss)) return;
      if (miss < 1e-9) { best = { miss, at: last }; return; }
      // Where the last edge's line meets the line home through the first.
      const ex = last.x - prev.x, ez = last.z - prev.z;
      const den = ex * uz - ez * ux;
      if (Math.abs(den) < 1e-9) return;
      const s = ((first.x - prev.x) * uz - (first.z - prev.z) * ux) / den;
      const at = { x: prev.x + ex * s, z: prev.z + ez * s };
      if (Math.hypot(at.x - last.x, at.z - last.z) > 2 * OUTLINE_HOME_FT) return;
      best = { miss, at };
    });
    return best ? best.at : null;
  };
  // A 45 SAYS ITS LEGS. The drafter reads a chamfer off his sheet as so
  // much each way, and the edge he just drew is its diagonal; the strip
  // gives both, so he can check one against the other.
  const sayDiagonal = (a, b) => {
    const dx = Math.abs(b.x - a.x), dz = Math.abs(b.z - a.z);
    // A TRUE 45 ONLY: a free edge at any other angle has no legs to quote.
    if (dx < 1e-6 || dz < 1e-6 || Math.abs(dx - dz) > 1e-6) return;
    const say = ft => window.DraftFormatters.formatArchitecturalInches(ft * 12);
    sayOnStrip(`45° edge ${say(Math.hypot(dx, dz))} — ${say(dx)} each way`);
  };

  // ONE WAY A CORNER GOES DOWN, for the press and for both typed boxes.
  // `raw` is where the press actually landed, for the close test; a typed
  // corner has none and closes only by landing exactly on the first.
  const outlineAdd = (pt, raw = null) => {
    // THREE CORNERS BEFORE CLOSING IS LEGAL, because two enclose no floor --
    // the same floor the old page's own guard is about. Below three, a press
    // near the first corner is a drafter placing a corner there, not closing.
    // THE OPEN RUN ENDS ON THE HOUSE: three legs at least, first corner on
    // the house wall, and this one landing on it (or pressed near enough to
    // be brought onto it along its own leg).
    const house = garageRunHouse();
    if (house && outlineCorners.length >= 3 && houseEdgeAt(house, outlineCorners[0]) >= 0) {
      const landed = houseEdgeAt(house, pt) >= 0 ? pt
        : (raw && legOntoHouse(house, outlineTail(), pt));
      const home = landed && !sameCorner(landed, outlineCorners[0])
        && alongHouse(house, landed, outlineCorners[0]);
      if (home) {
        const run = outlineCorners;
        outlineCorners = [...run, landed, ...home]
          .filter((p, i, all) => !i || !sameCorner(p, all[i - 1]));
        if (sameCorner(outlineCorners[outlineCorners.length - 1], outlineCorners[0])) outlineCorners.pop();
        // A REFUSED LOOP GIVES HIM BACK HIS RUN, not the house corners it
        // borrowed, so the next press carries on from his last corner.
        if (!commitOutline()) outlineCorners = run;
        return;
      }
    }
    if (outlineCorners.length >= 3) {
      const first = outlineCorners[0];
      // A TYPED EDGE THAT LANDS WITHIN THE EIGHTH closes, as one landing
      // exactly does: typing the last edge of a loop with a 45 in it is how
      // a drafter closes it, and it cannot land exactly (see homeTail).
      const onFirst = sameCorner(pt, first)
        || (!raw && Math.hypot(pt.x - first.x, pt.z - first.z) <= OUTLINE_HOME_FT);
      const nearFirst = raw && Math.hypot(raw.x - first.x, raw.z - first.z) <= OUTLINE_CLOSE_FT;
      if (onFirst || nearFirst) {
        const home = homeTail();
        if (home) {
          outlineCorners[outlineCorners.length - 1] = home;
          // The last edge's own line (a 45's legs) is not news once the
          // loop has closed.
          clearNotice();
          commitOutline();
          return;
        }
        sayOnStrip('Line the last corner up with the first — follow its orange line — then close.');
        return;
      }
    }
    const from = outlineTail();
    if (from && sameCorner(pt, from)) return;
    clearNotice();
    outlineCorners.push(pt);
    if (from) sayDiagonal(from, pt);
    stripRefresh();
    paint();
  };

  const outlinePress = at => outlineAdd(outlinePoint(at), { x: at.x, z: at.z });

  // ── CONNECT AT CORNER (Movie, 6 Oct) ──────────────────────────────────
  // "when i make the garage connect at the corners like this it would
  // automatically move the wall over 1' from the corner so the foundation
  // concrete would be completely fastened (full 8\"width) to the house wall".
  // MODEL.dc.html's _chooseGarageCornerStub: a garage leg that carries a
  // house wall on past the house's corner is moved over square, toward the
  // garage, and a short stub joins it to the corner. His ruling: 1 ft, the
  // only answer on TOY; on DRAFTING 1 ft or the garage foundation's own
  // thickness.
  const near = (a, b) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.z - b.z) < 1e-6;
  const unitTo = (a, b) => {
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    return { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
  };
  // A CORNER ASKS ONCE: the stub a shift puts in runs straight on from the
  // house's OTHER wall at that corner, and asking about it would ask forever.
  const cornerKey = p => `${p.x.toFixed(4)},${p.z.toFixed(4)}`;
  const cornerJoinOf = (loop, decided = new Set()) => {
    const house = garageJoinHouse();
    if (!house) return null;
    // A house corner the garage passes straight through gets a corner of its
    // own first, so the leg past it can be found as a leg.
    let ring = loop.slice();
    house.forEach(c => {
      for (let i = 0; i < ring.length; i += 1) {
        const p = ring[i], q = ring[(i + 1) % ring.length];
        if (near(p, c) || near(q, c)) continue;
        const G = window.DraftGeometry2D;
        if (G.pointToSegment(c, { start: p, end: q }).d < 1e-6) { ring.splice(i + 1, 0, { x: c.x, z: c.z }); return; }
      }
    });
    for (let k = 0; k < ring.length; k += 1) {
      const v = ring[k];
      const ci = house.findIndex(c => near(c, v));
      if (ci < 0 || decided.has(cornerKey(v))) continue;
      const along = [house[(ci + house.length - 1) % house.length], house[(ci + 1) % house.length]]
        .map(h => unitTo(v, h));
      const legs = [(k + 1) % ring.length, (k + ring.length - 1) % ring.length];
      for (const j of legs) {
        const d = unitTo(v, ring[j]);
        // Straight on from a house wall, the far side of its corner.
        if (!along.some(h => Math.abs(h.x + d.x) < 1e-6 && Math.abs(h.z + d.z) < 1e-6)) continue;
        // AND ONLY WHEN THE TWO WALLS SIT ON OPPOSITE SIDES OF THE LINE
        // (Movie, 6 Oct): "if the wall connects at the corner and LINES UP -
        // there is no req. for it to move over ... it is only needed if it
        // connects at the edge where the full 8" (or thicker) wall only
        // touches on the corner, not the full 8" surface". A wall's thickness
        // is on its building's side. Garage and house on the SAME side of the
        // line: the two walls run on end to end and meet face to face. On
        // OPPOSITE sides: the garage's wall touches the house's only at the
        // corner point, and that is the one that steps over.
        const n = { x: -d.z, z: d.x };
        const side = (loop, toward) => (pointInRing(loop,
          { x: v.x + (toward.x + n.x) * 0.25, z: v.z + (toward.z + n.z) * 0.25 }) ? 1 : -1);
        const back = { x: -d.x, z: -d.z };
        if (side(ring, d) === side(house, back)) continue;
        return { ring, k, j };
      }
    }
    return null;
  };
  const shiftAtCorner = ({ ring, k, j }, ft) => {
    const n = ring.length;
    const r = [...ring.slice(k), ...ring.slice(0, k)];
    const jj = (j - k + n) % n;
    const v = r[0], d = unitTo(v, r[jj]);
    // AWAY FROM THE GARAGE, along the house's other wall at that corner
    // (Movie, 8 Oct: "the garage lines went 1 ft but wrong direction"): the
    // stub then lies on that wall and the garage's foundation bears full on
    // it. Toward the garage, the stub ran off the house into the garage.
    let perp = { x: -d.z, z: d.x };
    const probe = { x: v.x + (perp.x + d.x) * 0.25, z: v.z + (perp.z + d.z) * 0.25 };
    if (pointInRing(r, probe)) perp = { x: -perp.x, z: -perp.z };
    const move = p => ({ x: p.x + perp.x * ft, z: p.z + perp.z * ft });
    return jj === 1 ? [v, move(v), move(r[1]), ...r.slice(2)]
      : [v, ...r.slice(1, n - 1), move(r[n - 1]), move(v)];
  };
  const garageJoinHouse = () => (outlineGarage && tracedOrder && traceStillThere(tracedHouse)
    ? tracedHouse.points.map(p => ({ x: Number(p.x), z: Number(p.z) })) : null);
  const garageFoundationFt = () => (window.DraftWallTypes?.WALL_TYPES
    .find(t => t.id === 'concrete_8')?.totalIn || 8) / 12;
  const cornerCard = document.getElementById('corner-join');
  let cornerPending = null;
  const settleCorner = ft => {
    const pending = cornerPending;
    cornerPending = null;
    if (cornerCard) cornerCard.hidden = true;
    if (!pending) return;
    outlineCorners = shiftAtCorner(pending, ft);
    commitOutline(new Set([...pending.decided, cornerKey(pending.ring[pending.k])]));
  };
  if (cornerCard) {
    cornerCard.querySelector('[data-corner-foot]').addEventListener('click', () => settleCorner(1));
    cornerCard.querySelector('[data-corner-thick]').addEventListener('click', () => settleCorner(garageFoundationFt()));
    // ENTER TAKES THE FIRST, 1'-0", wherever the focus is; Escape backs out
    // and leaves the trace in hand.
    window.addEventListener('keydown', event => {
      if (cornerCard.hidden || (event.key !== 'Enter' && event.key !== 'Escape')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.key === 'Enter') {
        const focused = document.activeElement;
        if (focused?.matches?.('[data-corner-thick]')) settleCorner(garageFoundationFt());
        else settleCorner(1);
      } else {
        cornerPending = null;
        cornerCard.hidden = true;
        paint();
      }
    }, true);
  }

  const commitOutline = (decided = new Set()) => {
    const loop = outlineCorners.slice();
    if (loop.length < 3) return null;
    const join = cornerJoinOf(loop, decided);
    if (join) {
      const asked = new Set([...decided, cornerKey(join.ring[join.k])]);
      if (board === 'toy') {
        outlineCorners = shiftAtCorner(join, 1);
        sayOnStrip('The garage wall moved over 1 ft from the house corner, so its foundation bears full on the house wall.');
        return commitOutline(asked);
      }
      if (cornerCard) {
        cornerPending = { ...join, decided };
        const inches = Math.round(garageFoundationFt() * 12);
        cornerCard.querySelector('[data-corner-thick-label]').textContent = `${inches}"`;
        cornerCard.hidden = false;
        setTimeout(() => cornerCard.querySelector('[data-corner-foot]').focus(), 0);
        return null;
      }
    }
    // A CROSSED LOOP ENCLOSES NO FLOOR, and the old page refuses it at
    // MODEL.dc.html's own close with the same test from the same module. The
    // pending corners are KEPT on a refusal so the drafter can move the last
    // one rather than retrace the whole house.
    if (window.DraftGeometry2D.selfIntersects(loop)) {
      sayOnStrip('That outline crosses itself, so it encloses no floor area.');
      return null;
    }
    const OM = window.DraftOutlineMaster;
    const spec = OM.masterFromLoop({
      points: loop,
      shelfId: activeShelfId(),
      sourceLevelId: activeLevelId(),
      newItemId: () => newDrawingItemId('outline'),
      newPointId: () => newDrawingItemId('op'),
    });
    // THE FILE'S SPELLING, AT THE MOMENT OF WRITING. This page has no
    // serializer between the push and the file (see commitWall's note on
    // 'centre'), and storage spells a master point's id `id` while
    // MODEL.dc.html holds `pointId`. Writing the memory spelling would produce
    // a master whose points have no id at all once the old page loads it --
    // and it would look perfect until a corner was dragged.
    // A GARAGE'S LOOP SAYS SO, as the old page's garage masters do.
    const closingGarage = outlineGarage;
    let buildAfterClose = false;
    if (outlineGarage) spec.garage = true;
    const master = OM.storageMaster(spec);
    const levels = (drawing.levels || []);
    const copies = OM.copiesForLevels(master, levels, {
      newItemId: () => newDrawingItemId('outline'),
    });
    if (!Array.isArray(drawing.boneyardOutlines)) drawing.boneyardOutlines = [];
    if (!Array.isArray(drawing.outlines)) drawing.outlines = [];
    drawing.boneyardOutlines.push(master);
    copies.forEach(copy => drawing.outlines.push(copy));
    // WHAT THE BONE WILL BUILD, remembered as it is drawn. See outlineToBuild:
    // the copy on the level the drafter is standing on, because that is the
    // loop he just walked.
    tracedOutline = copies.find(copy =>
      Number(copy.levelId) === Number(activeLevelId())) || null;
    undoStack.push({ kind: 'add-outline', master, copies });
    outlineCorners = [];
    activeTool = RESTING_TOOL;
    // THE NEXT STEP OF A TRACED HOUSE: the garage when the type hangs one
    // on the house, else the bone.
    if (tracedOrder) {
      tracedMasters.push({ master, copies });
      if (closingGarage) tracedGarage = tracedOutline;
      else tracedHouse = tracedOutline;
      const label = tracedOrder.entry?.label || 'house';
      if (!closingGarage && window.DraftTracedPlans?.needsGarage(tracedOrder.entry?.id)) {
        setTool('outline');
        outlineFamily = tracedOrder.family ?? null;
        outlineGarage = true;
        sayOnStrip(GARAGE_RUN_LINE);
        openGarageLesson();
      } else {
        // THE LAST LOOP CLOSED, SO THE HOUSE GOES UP when the trace came off
        // the OUTLINE press (Movie, 3 Oct: "right away", no bone press).
        // Said first so a build that is refused -- a trace the type cannot
        // take, an empty wallet -- leaves the bone as the way on, and its
        // own refusal written over this.
        sayOnStrip(`Press the bone to build your ${isGarageChoice(tracedOrder) ? 'garage' : label}.`);
        buildAfterClose = tracedBuildsOnClose;
        // A MOD BILEVEL STOPS HERE TO ASK WHERE ITS ROOM ENDS (Movie, 5 Oct):
        // "the entry and balcony will be autodrawn, and then could be ask the
        // user where they would like the 2nd floor over the garage to extend
        // to". They are shown over his trace (paintRoomPick) and the room's
        // end wall is a line he moves -- "dont get them to draw a line, just
        // get them to move the line" -- so the house waits for the bone.
        if (closingGarage && roomPick()) {
          buildAfterClose = false;
          // LINED UP WITH THE BALCONY TO START (Movie, 10 Oct), when it can be.
          const lineUp = roomLineUpFt(roomPick());
          if (lineUp != null) roomOverFt = lineUp;
          sayOnStrip(ROOM_PICK_LINE);
        }
      }
    }
    markDirty();
    stripRefresh();
    paint();
    if (buildAfterClose) window.ModelBuild.build();
    return master;
  };

  // ── THE BONE BUILDS WHAT THE DRAFTER DREW ────────────────────────────────
  //
  // Movie, 18 Sep: "when they draw the U outline, they should still press the
  // BONE or blue house to cause the house to be created". The seam for it was
  // declared with the build bar (:4174, onBuild -- "build what the drafter
  // drew, his own outline") and NOTHING HAS EVER REGISTERED ON IT. The foot
  // bone fired into an empty list: a drafter traced his house, pressed the
  // bone, and the page called the drive-thru up over his loop.
  //
  // ALREADY BUILT IS DERIVED, NOT STORED. A `built: true` on the outline would
  // be a new key in the file for both pages to agree about, and the answer is
  // already in the drawing: a loop whose first edge has a wall running along
  // it has been built. Same rule as the cut id -- the old page writes
  // nextCutId and then refuses to trust it on load, so this page derives.
  //
  // THE FIRST EDGE IS ENOUGH and the whole ring would be worse. A drafter who
  // deletes one wall of a built house and presses the bone again means "put my
  // house back"; a ring test would call that unbuilt and lay a second wall
  // along every edge that survived.
  const NEAR_FT = 0.05;
  const samePoint = (a, b) => a && b && Math.hypot(a.x - b.x, a.z - b.z) < NEAR_FT;

  const outlineIsBuilt = (outline, levelId) => {
    const points = outline?.points || [];
    if (points.length < 2) return false;
    const [a, b] = points;
    return (drawing.walls || []).some(wall => Number(wall.levelId) === Number(levelId)
      && ((samePoint(wall.start, a) && samePoint(wall.end, b))
        || (samePoint(wall.start, b) && samePoint(wall.end, a))));
  };

  // THE LOOP THIS PAGE JUST TRACED, and only that one.
  //
  // THE FIRST VERSION TOOK ANY UNBUILT HOUSE OUTLINE ON THE LEVEL, and that is
  // too greedy by a long way: a drawing loaded from a file can carry outlines
  // whose walls were never made -- the repro fixture in
  // model-drivethru.spec.js carries five -- and the bone would then raise
  // walls round a loop the drafter had never drawn and was not asking about.
  // It also swallowed Movie's own rule for the empty press (15 Sep): "take
  // them to the full house flow if there isn't a house and detached garage
  // already ... it will do nothing once both house and garage both made". A
  // build that fires on a drawing which already has houses is not nothing.
  // model-drivethru.spec.js:477 is what caught it.
  //
  // So the bone answers a GESTURE, not a search: commitOutline records the
  // loop as it is drawn and this hands back that one, still unbuilt, still in
  // the drawing. An undo splices it out, and the test below it fails -- which
  // is the behaviour a drafter would expect from taking his trace back.
  let tracedOutline = null;

  const outlineToBuild = () => {
    const { levelId } = onActiveLevel();
    const outline = tracedOutline;
    if (!outline) return null;
    if (!(drawing?.outlines || []).includes(outline)) return null;
    if (Number(outline.levelId) !== Number(levelId)) return null;
    if ((outline.points || []).length < 3) return null;
    return outlineIsBuilt(outline, levelId) ? null : outline;
  };

  const buildFromDrawnOutline = () => {
    if (!drawing) return null;
    const outline = outlineToBuild();
    if (!outline) return null;
    const BH = window.DraftBuildHouse;
    const points = outline.points.map(point => ({ x: point.x, z: point.z }));
    // THE OUTLINE DECIDES WHICH SIDE THE BODY SITS ON, through the module the
    // old page builds with rather than a second copy of the winding test.
    const refLine = BH.outlineInteriorRef(points);
    const runs = BH.houseWallRuns(points);
    if (!runs.length) return null;
    // ONE GESTURE, ONE UNDO. The runs' own 'add' steps are dropped for the
    // single 'built' one, exactly as the ordered garage drops its four: left
    // in, the first Ctrl+Z would take the whole house and the next several
    // would each hunt a wall that was already gone.
    const mark = undoStack.length;
    const walls = runs.map(run => commitWall(run.start, run.end,
      { bone: false, refLine }));
    undoStack.length = mark;
    // `outline: null` -- the loop is the DRAFTER'S and it stays. See the
    // 'built' branch in undo, which now asks before it splices.
    undoStack.push({ kind: 'built', walls, outlines: [], list: null });
    sayOnStrip(`House built — ${walls.length} walls off your outline.`);
    markDirty();
    buildChrome();
    paint();
    return walls;
  };

  // ── THE WHOLE HOUSE OFF THE TRACE ──────────────────────────────────────
  //
  // When the trace was started from the board, the bone builds what the
  // board would have built -- floors, concrete, roofs, beams, stairs, dims,
  // windows and doors -- on the drafter's loops instead of the premade's
  // (traced-plans.js). The trace records come off the drawing with it, the
  // built outlines standing in their place, and one Ctrl+Z puts them back.
  const TRACE_REFUSALS = Object.freeze({
    NO_GARAGE: 'Trace the garage too — it is part of this house.',
    NO_FRONT: 'The front wall needs a straight run of 12 ft for the entry.',
    ROOM_NEEDS_RECTANGLE: 'The room over the garage needs a rectangular garage against the house.',
  });
  const traceStillThere = rec => !!rec && (drawing?.outlines || []).includes(rec);
  const traceRestore = () => {
    const restore = [];
    tracedMasters.forEach(({ master, copies }) => {
      const mi = (drawing.boneyardOutlines || []).indexOf(master);
      if (mi >= 0) {
        drawing.boneyardOutlines.splice(mi, 1);
        restore.push({ list: drawing.boneyardOutlines, items: [master] });
      }
      const gone = copies.filter(copy => drawing.outlines.includes(copy));
      gone.forEach(copy => drawing.outlines.splice(drawing.outlines.indexOf(copy), 1));
      if (gone.length) restore.push({ list: drawing.outlines, items: gone });
    });
    return restore;
  };
  // ── THE ROOM OVER THE GARAGE, ITS END WALL MOVED BY HAND ───────────────
  //
  // Movie, 5-6 Oct, on a traced MOD BILEVEL: once the house and garage are
  // traced, show the entry and the balcony and let him move "how far towards
  // the front of the garage the wall goes (if it goes all the way to the
  // front or cantilevers over the edge" -- whole feet, 8 ft at least, up to
  // 2 ft past the front; at the front or past it the lower garage roof goes,
  // and short of it a lower roof covers the open garage (traced-plans.js).
  //
  // IN THE BUILDER'S FRAME. planFromTrace reads +z as the front, and the
  // build turns the drawing back to no turn before it reads the trace
  // (builtFrontDown), so the preview does the same to the points and turns
  // what it draws forward again.
  const ROOM_PICK_LINE = 'Drag the bold line to where the room over the garage ends — '
    + '8 ft at least, up to 2 ft past the garage front. Then press the bone to build.';
  const planTurnNow = () => ((Number(drawing?.planTurn) || 0) % 4 + 4) % 4;
  const toBuilderFrame = p => window.DraftPlanRotate.spin(p, (4 - planTurnNow()) % 4);
  const fromBuilderFrame = p => window.DraftPlanRotate.spin(p, planTurnNow());
  const roomPick = () => {
    const TP = window.DraftTracedPlans;
    const base = window.DraftPremadePlans?.planFor(tracedOrder?.entry?.id);
    if (!TP || !window.DraftPlanRotate || !base?.entry || !base.overGarage) return null;
    if (!traceStillThere(tracedHouse) || !traceStillThere(tracedGarage)) return null;
    const house = tracedHouse.points.map(toBuilderFrame);
    const garage = tracedGarage.points.map(toBuilderFrame);
    const plan = TP.planFromTrace({ entryId: tracedOrder.entry.id, house, garage, roomDepthFt: roomOverFt });
    const over = TP.roomOverGarage(garage, house, roomOverFt);
    if (!over || plan.error) return null;
    const off = k => [over.a, over.b].map(p => fromBuilderFrame({
      x: p.x + over.inward.x * k, z: p.z + over.inward.z * k }));
    return { plan, over, line: off(over.depthFt) };
  };
  const roomPickWords = over => (over.depthFt > over.depth
    ? `room ${over.depthFt} ft — ${over.depthFt - over.depth} ft past the garage front, no lower roof`
    : over.depthFt === over.depth
      ? `room ${over.depthFt} ft — to the garage front, no lower roof`
      : `room ${over.depthFt} ft — lower roof over the last ${over.depth - over.depthFt} ft of garage`);
  // WHERE THE ROOM LINES UP WITH THE BALCONY: its end wall on the line of
  // the upper landing's far wall, measured the way the room is (from the
  // wall it shares with the house, in whole feet). Null when that is not a
  // depth the room can take -- a landing that does not reach past the house
  // line, or one beyond the room's range.
  const roomLineUpFt = pick => {
    const landing = pick?.plan?.upperLanding;
    if (!landing || !landing.length) return null;
    const { a, inward, range } = pick.over;
    const far = Math.max(...landing.map(p => (p.x - a.x) * inward.x + (p.z - a.z) * inward.z));
    const d = Math.round(far);
    return d >= range.lo && d <= range.hi ? d : null;
  };
  // ── THE CARD BESIDE THE LINE ───────────────────────────────────────────
  // ── HOW BIG IS THE LOT? (Movie, 13 Oct) ──────────────────────────────
  //
  // "when they go to the SITE layout in MODEL" the question comes up: pick a
  // tier, or type a width and depth, and AUTOSITE lays a rectangle that size.
  // The table itself is lot-sizes.js, so LAYOUT's copy of this question reads
  // the same six sizes and the same sentence about odd shapes.
  //
  // THE LOT IS AN OUTLINE carrying `site: true`. That is the whole reason
  // Movie's "they can click on points to break them" needs no code: outlines
  // already drag their points, break new ones into an edge, and undo. What
  // the flag does is keep the lot OUT of the readers that treat an outline as
  // a building -- auto-dims would string a 45' row around the house and call
  // the pair one cluster, areas would report the lot as floor area.
  const LS = window.DraftLotSizes;
  const lotCard = document.getElementById('lot-pick');
  // A tier id, 'custom', or null for not answered yet -- chosenSizeId's shape
  // next door, for the same reason: one place holds the press, the fields are
  // only read when 'custom' is the press.
  let lotSizeId = null;
  // HAS THE DRAFTER TOUCHED THE CARD HIMSELF? The OK press and the glow that
  // points at what it will do are for someone who does not want to read the
  // ladder (Movie, 16 Oct). The moment he presses anything else in the card
  // he IS reading it and making his own choice -- "until they press another
  // button" -- so the pointer stops pointing. It is not a lock: OK still
  // works, and now draws the size he picked rather than the best fit.
  let lotTouched = false;
  // ASKED ONCE PER VISIT, NOT ONCE PER PAINT. NOT NOW has to mean not now,
  // and the card is repainted on every repaint of the page; without this a
  // dismissed card would come straight back. Cleared on leaving SITE, so
  // coming back asks again -- which is right, because coming back to a site
  // with no lot on it is the drafter arriving at the question a second time.
  let lotAsked = false;
  // ASKED AGAIN, over a lot already drawn (Movie, 18 Oct: "i accidentally put
  // the site the wrong direction, how about if a user double clicks on the
  // site property line or the site layout view window in the LEVELS LAYERS
  // tab, bring up the initial SITE PLAN loading information popup so they can
  // reload or change the info"). The card opens on the size the lot has, and
  // what it draws then REPLACES the lot rather than adding a second one.
  let lotReopen = false;

  const lotMetric = () => drawing?.units === 'metric';
  // A LENGTH THE WAY THIS PAGE WRITES ONE, for the sentences the card says
  // about the smallest lot a building fits on. The tiers' own labels come
  // from lot-sizes.js's describe(); these are derived numbers and are
  // formatted here like every other length the page prints.
  const lotFt = feet => window.DraftFormatters.formatArchitecturalInches(Number(feet) * 12);
  const lotOnSite = () => activeLevelId() === SITE_LEVEL_ID && !boneyardActive;
  const lotExists = () => !!LS.siteOutlineOf(drawing?.outlines);
  // What the card is currently offering, in the unit in force.
  // TYPED THE WAY EVERY OTHER LENGTH ON THE PAGE IS (Movie, 18 Oct: "allow
  // 3/8" 11/16" etc as well as 50-6" 50'6" 50.5' etc" -- "looks like it only
  // allowing full ft dimensions, please adjust it for better precisions").
  // The box was a number field, which refuses 895-2 3/8 outright; in feet it
  // now reads through the page's own length parser. Metres stay a number.
  const lotTyped = value => {
    if (lotMetric()) return value;
    const parsed = window.DraftFormatters.parseArchitecturalLength(value);
    return parsed.ok ? parsed.inches / 12 : NaN;
  };
  const lotChosen = () => LS.lotSizeFor(lotSizeId,
    lotTyped(lotCard.querySelector('[data-lot-width]').value),
    lotTyped(lotCard.querySelector('[data-lot-depth]').value),
    { metric: lotMetric() });

  // WHAT THE LADDER IS MEASURED AGAINST, lifted out of the paint so the OK
  // press below can ask the same question and get the same answer. The
  // reasoning is unchanged and still belongs to the card: the SIDE eave is
  // the one that faces the property line, so it is the one the side setback
  // is measured from; the drawing's own PROJECT value wins, then the widest
  // roof actually built, then the panel default the next roof will use.
  const lotFitOptions = () => {
    const sideEave = Number(drawing?.roofSideOverhang);
    const eaves = (drawing?.roofs || []).map(roof => Number(roof.overhang))
      .filter(value => Number.isFinite(value));
    return { eaveFt: Number.isFinite(sideEave) && sideEave >= 0 ? sideEave
      : (eaves.length ? Math.max(...eaves) : roofOverhangFt) };
  };
  // THE SIZE THE CARD ITSELF WOULD CHOOSE -- "the first size to fit", which
  // is the row the ladder already brightens (Movie, 14 Oct). OK takes this
  // one, so the loud button and the bright row can never disagree.
  //
  // AND WITH NO BUILDING DRAWN there is no first-to-fit: every size fits and
  // the ladder brightens none of them, which is his own rule ("if no house
  // drawn all would be allowed nothing lighten up or faded"). A dead OK
  // there would be the one card in the app whose way-through is missing
  // exactly when the drafter knows least, so it falls back to the STANDARD
  // SUBURBAN lot -- the tier the list itself calls standard, not a number
  // typed here.
  const STANDARD_LOT_TIER = 'L';
  // MEASURED ON THE TURNED PLAN'S AXES: the lot is laid on them, so the
  // house has to be read on them too (Movie, 16 Oct: "it selected a site
  // plan not wide enough this time" -- a house turned a quarter, read along
  // x, offered a lot whose frontage ran along z).
  const lotHouseBox = () => LS.houseBoxOf(drawing?.outlines, drawing?.planTurn || 0);
  const bestLotTier = () =>
    LS.bestLotTierFor(lotHouseBox(), lotFitOptions())
    || (lotHouseBox()
      ? null : LS.LOT_TIERS.find(tier => tier.id === STANDARD_LOT_TIER) || null);

  paintLotPick = () => {
    if (!lotCard) return;
    const show = lotOnSite() && ((!lotExists() && !lotAsked) || lotReopen);
    lotCard.hidden = !show;
    if (!show) return;
    const metric = lotMetric();
    const unit = metric ? 'M' : 'FT';
    lotCard.querySelector('[data-lot-pick-says]').textContent = metric
      ? 'Pick a size, or type your own in metres.'
      : 'Pick a size, or type your own in feet.';
    const tiles = lotCard.querySelector('[data-lot-tiles]');
    // ── WHICH OF THEM THE BUILDING WILL ACTUALLY FIT ON ───────────────────
    //
    // Movie, 14 Oct, having drawn a 30 ft garage and then picked a 25 ft lot:
    // "can it figure out the house width and not allow lots that are too
    // small from the selections", "fade out the 'too small' sizes", "make the
    // most appropriate size brighter (first size to fit)", and -- the case
    // that keeps this quiet on an empty drawing -- "if no house drawn all
    // would be allowed nothing lighten up or faded".
    //
    // THE EAVE IS THE ONE ON THE DRAWING, not a typed default: his own 38 is
    // 30 of wall plus 4 a side, and the 4 is the eave's 2 plus its clearance.
    // A roof record carries the overhang it was built with, so the widest one
    // drawn is what the setback is measured from; with no roof yet the page's
    // own panel default answers, which is what the next roof will be built at.
    // THE SIDE EAVE IS THE ONE THAT MATTERS, and the drawing has had its own
    // since 13 Oct -- PROJECT's SIDE OVERHANG, `roofSideOverhang`, which
    // falls back to the main overhang when nobody has set it. It is the eave
    // that faces the side property line, so it is the eave the side setback
    // is measured from; the front and back ones answer to the front setback,
    // which is measured to the WALL.
    const house = lotHouseBox();
    const fitOpts = lotFitOptions();
    const best = LS.bestLotTierFor(house, fitOpts);
    const min = LS.minLotFor(house, fitOpts);
    tiles.replaceChildren(...LS.LOT_TIERS.map(tier => {
      const shown = LS.describe(tier, { metric });
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.lotTier = tier.id;
      button.setAttribute('aria-pressed', String(lotSizeId === tier.id));
      // FADED AND UNPICKABLE, which is the two halves of what he asked for:
      // "not allow lots that are too small" is the disabled, "fade out" is
      // the class. The row stays on the list rather than vanishing, so the
      // ladder still reads as a ladder and the drafter can see what his
      // building has ruled out.
      const fits = LS.lotFitsHouse(tier, house, fitOpts);
      if (!fits) {
        button.classList.add('lot-small');
        button.disabled = true;
      }
      if (best && tier.id === best.id) button.classList.add('lot-best');
      // ONE LINE, AND THE SIZE IS THE LOUD ONE (Movie: "25X120, 35X150
      // etc"). The tier letter and the area are what tell a drafter who has
      // not memorised the table which of six he wants -- and the CHARACTER is
      // on the row now rather than hidden in a tooltip (Movie, 14 Oct: "wide
      // columns allow all the text on one line"), because "Standard suburban"
      // is what picks a lot and a title attribute is read by nobody in a
      // hurry. The `title` stays for the same words, which is what a screen
      // reader and a slow mouse both get.
      const size = document.createElement('span');
      size.className = 'lot-size';
      size.textContent = shown.sizeLabel;
      const tierTag = document.createElement('span');
      tierTag.className = 'lot-tier';
      tierTag.textContent = tier.id;
      const area = document.createElement('span');
      area.className = 'lot-area';
      area.textContent = shown.areaLabel;
      const character = document.createElement('span');
      character.className = 'lot-character';
      // AND THE ROW SAYS WHY IT IS OUT, where it is out. A faded row with no
      // reason is a drafter wondering whether the app is broken.
      character.textContent = fits ? shown.character : 'Too small for this building';
      button.append(size, tierTag, area, character);
      button.title = fits ? `${tier.id} \u2014 ${shown.character}`
        : `${tier.id} \u2014 needs at least ${lotFt(min.widthFt)} x ${lotFt(min.depthFt)}`;
      button.addEventListener('click', () => {
        lotSizeId = tier.id; lotTouched = true; paintLotPick();
      });
      return button;
    }));
    const custom = document.createElement('button');
    custom.type = 'button';
    custom.dataset.lotTier = 'custom';
    custom.setAttribute('aria-pressed', String(lotSizeId === 'custom'));
    const customSize = document.createElement('span');
    customSize.className = 'lot-size';
    customSize.textContent = 'OTHER';
    const customTag = document.createElement('span');
    customTag.className = 'lot-tier';
    customTag.textContent = unit;
    const customArea = document.createElement('span');
    customArea.className = 'lot-area';
    customArea.textContent = 'type it';
    // THE SAME FOUR-PART ROW as the tiers above it, so OTHER reads as the
    // last entry in one list rather than as a different kind of control --
    // and it stays LAST, which is where "smallest to biggest last" puts the
    // one size that is not on the ladder at all.
    const customCharacter = document.createElement('span');
    customCharacter.className = 'lot-character';
    customCharacter.textContent = 'Any size you like';
    custom.append(customSize, customTag, customArea, customCharacter);
    custom.addEventListener('click', () => {
      lotSizeId = 'custom';
      lotTouched = true;
      paintLotPick();
      lotCard.querySelector('[data-lot-width]').focus();
    });
    tiles.appendChild(custom);

    lotCard.querySelector('[data-lot-custom]').hidden = lotSizeId !== 'custom';
    lotCard.querySelector('[data-lot-unit-w]').textContent = `${unit} X`;
    lotCard.querySelector('[data-lot-unit-d]').textContent = unit;
    // THE NOTE SAYS WHAT THE BUILDING NEEDS, before the sentence about odd
    // shapes. His own arithmetic, in his own units: "for that 30 for garage
    // with 2ft overhangs would be min 38 min". A typed size is NOT held to
    // it -- "allow them to create any size they would like if they enter
    // data and draw the site" -- so this is a statement, not a refusal.
    lotCard.querySelector('[data-lot-note]').textContent = min
      ? `${lotFt(house.widthFt)} of building with ${lotFt(fitOpts.eaveFt)} eaves `
        + `needs at least ${lotFt(min.widthFt)} x ${lotFt(min.depthFt)}. `
        + `${LS.AUTOSITE_NOTE}`
      : LS.AUTOSITE_NOTE;
    // THE VERB SAYS WHAT IT WILL DRAW, and is dead until there is something
    // to draw -- a typed pair that is out of bounds reads as nothing chosen,
    // which is what it is.
    const chosen = lotChosen();
    const draw = lotCard.querySelector('[data-lot-pick-draw]');
    draw.disabled = !chosen;
    draw.textContent = chosen
      ? `DRAW AUTOSITE ${chosen.sizeLabel}` : 'DRAW AUTOSITE';
    // ── AND WHAT OK WOULD DO, SAID BEFORE IT IS PRESSED ──────────────────
    //
    // OK draws the size already chosen, or -- with nothing chosen -- the one
    // the ladder brightens as the first that fits. It is dead only when
    // neither exists: no pick, and no tier big enough for the building.
    const ok = lotCard.querySelector('[data-lot-pick-ok]');
    const okTier = best || bestLotTier();
    const takes = chosen || (okTier ? LS.lotSizeFor(okTier.id, '', '', { metric }) : null);
    ok.disabled = !takes;
    ok.title = takes
      ? `OK \u2014 draws the autosite at ${takes.sizeLabel}`
      : 'No lot on the list is big enough for this building \u2014 type a size';
    // THE GLOW POINTS AT THE VERB, not at the size: a drafter who presses OK
    // without reading should still see WHICH button answered for him. It
    // stops the moment he presses anything else in the card.
    draw.classList.toggle('lot-ok-target', !!takes && !lotTouched);
  };

  // AUTOSITE: the rectangle, on the SITE level, centred on whatever is drawn.
  const drawAutosite = () => {
    const chosen = lotChosen();
    if (!chosen || !drawing) return;
    const centre = LS.centreOfOutlines(drawing.outlines) || { centerX: 0, centerZ: 0 };
    // FACING E1, WHICHEVER WAY THE HOUSE IS TURNED (Movie, 14 Oct: "the front
    // of the lot and the front of the house should line up both facing E1").
    const pts = LS.lotRectanglePoints(chosen.widthFt, chosen.depthFt, centre,
      drawing?.planTurn || 0);
    if (!pts) return;
    drawing.outlines = drawing.outlines || [];
    const was = LS.siteOutlineOf(drawing.outlines);
    const lotRecord = {
      id: newDrawingItemId('outline'),
      masterId: null,
      levelId: SITE_LEVEL_ID,
      garage: false,
      // THE FLAG IS THE POINT. See the note above addItem's neighbours: it is
      // what every reader of outlines asks to find out this is a lot line.
      site: true,
      detached: false,
      foundation: null,
      points: pts.map(pt => ({ x: pt.x, y: 0, z: pt.z })),
      overriddenSrcIds: [],
    };
    if (was) {
      // ONE UNDO PUTS THE OLD LOT BACK, size and all.
      const index = drawing.outlines.indexOf(was);
      const lotBefore = drawing.lot;
      drawing.outlines.splice(index, 1, lotRecord);
      undoStack.push({ kind: 'node', undo: () => {
        const at = drawing.outlines.indexOf(lotRecord);
        if (at >= 0) drawing.outlines.splice(at, 1, was);
        drawing.lot = lotBefore;
        setSelection([]);
      } });
      markDirty();
    } else {
      addItem(drawing.outlines, lotRecord);
    }
    lotReopen = false;
    // THE SIZE IS KEPT ON THE DRAWING so the page can say what was asked for
    // after the corners have been dragged off it -- and so LAYOUT need not
    // re-derive a tier from four points that may no longer be a rectangle.
    drawing.lot = { widthFt: chosen.widthFt, depthFt: chosen.depthFt,
      tier: chosen.custom ? null : chosen.id };
    lotAsked = true;
    paintLotPick();
    sayOnStrip(`AUTOSITE ${chosen.sizeLabel} ${chosen.unitLabel} drawn \u2014 `
      + 'drag its corners to suit your lot.');
  };

  if (lotCard) {
    lotCard.querySelector('[data-lot-pick-draw]').addEventListener('click', () => {
      lotTouched = true;
      drawAutosite();
    });
    // ── OK: THE WAY THROUGH FOR SOMEONE WHO DOES NOT WANT TO CHOOSE ──────
    //
    // Movie, 16 Oct: "put a big button on the bottom that says OK and make it
    // red so it draws attention. if they click that just put in the best fit
    // based on the sizes / setbacks", and why -- "make it easier for when the
    // user wants to think less and read less simplify it for them to get
    // through easy".
    //
    // IT HONOURS A CHOICE THAT WAS MADE. With a size picked, OK draws THAT:
    // a button that overrode the drafter's own pick because it knows better
    // is the opposite of the simplification he asked for. With nothing
    // picked it takes the first size that fits -- the one the ladder is
    // already brightening -- so OK and the bright row never disagree.
    lotCard.querySelector('[data-lot-pick-ok]').addEventListener('click', () => {
      if (!lotChosen()) {
        const best = bestLotTier();
        if (!best) return;
        lotSizeId = best.id;
      }
      lotTouched = true;
      paintLotPick();
      drawAutosite();
    });
    lotCard.querySelector('[data-lot-pick-skip]').addEventListener('click', () => {
      lotTouched = true;
      lotAsked = true;
      lotReopen = false;
      paintLotPick();
    });
    // DRAW IT MYSELF: the card steps out of the way and hands over the
    // OUTLINE tool, armed on the SITE level the drafter is already standing
    // on. The loop he closes is an ordinary outline -- which is what AUTOSITE
    // lays too, so a hand-drawn lot and a generated one are the same object
    // from here on. It does not carry `site: true`, deliberately: this page
    // cannot tell a lot line from a shed he drew, and guessing wrong would
    // quietly drop a building out of the dimension strings.
    lotCard.querySelector('[data-lot-pick-hand]').addEventListener('click', () => {
      lotTouched = true;
      lotAsked = true;
      paintLotPick();
      setTool('outline');
      sayOnStrip('Draw the lot line \u2014 click each corner, and close the loop on the first.');
    });
    // UPLOAD: TRACE's own file picker, which already takes PDF, JPG, PNG,
    // DXF and DWG and already asks the scale question a scanned site plan
    // needs answering. Opening the picker rather than the TRACE card because
    // the drafter has just said what he wants to do and a second menu
    // between him and the file dialog is a menu he did not ask for.
    lotCard.querySelector('[data-lot-pick-upload]').addEventListener('click', () => {
      lotTouched = true;
      lotAsked = true;
      paintLotPick();
      const picker = document.querySelector('[data-trace-file]');
      if (picker) picker.click();
      else sayOnStrip('Use the PHOTO chip to bring in a site plan.');
    });
    // A TYPED PAIR REPAINTS THE VERB, which is the only thing that reads it:
    // the button has to go live the moment both fields are sane and say what
    // it will draw.
    lotCard.querySelectorAll('[data-lot-width], [data-lot-depth]')
      .forEach(input => input.addEventListener('input', paintLotPick));
  }

  // ── AND OPENED AGAIN ON A LOT ALREADY DRAWN ─────────────────────────────
  // A double-click on the property line, or on the SITE PLAN seat in LEVELS /
  // LAYERS, puts the card back up on OTHER with the lot's own size typed in,
  // width and depth, so turning it round is swapping the two boxes.
  const reopenLot = () => {
    if (!lotCard || !drawing) return;
    const lot = drawing.lot || {};
    const outline = LS.siteOutlineOf(drawing.outlines);
    const xs = (outline?.points || []).map(p => p.x), zs = (outline?.points || []).map(p => p.z);
    const w = Number(lot.widthFt) || (xs.length ? Math.max(...xs) - Math.min(...xs) : 0);
    const d = Number(lot.depthFt) || (zs.length ? Math.max(...zs) - Math.min(...zs) : 0);
    const shown = ft => (lotMetric() ? String(Math.round(ft * 0.3048 * 100) / 100)
      : window.DraftFormatters.formatArchitecturalInches(ft * 12));
    lotSizeId = 'custom';
    lotCard.querySelector('[data-lot-width]').value = w ? shown(w) : '';
    lotCard.querySelector('[data-lot-depth]').value = d ? shown(d) : '';
    lotReopen = true;
    paintLotPick();
    sayOnStrip('THE LOT — change its size and press OK or DRAW AUTOSITE; NOT NOW leaves it as it is.');
  };
  canvas.addEventListener('dblclick', e => {
    if (!lotOnSite() || activeTool !== RESTING_TOOL || !lotExists()) return;
    const r = canvas.getBoundingClientRect();
    const hit = outlineAt(toWorld(e.clientX - r.left, e.clientY - r.top));
    if (hit && hit.site) reopenLot();
  });
  document.addEventListener('dblclick', e => {
    const seat = e.target?.closest?.(`[data-seat="${SITE_LEVEL_ID}:all"]`);
    if (!seat) return;
    // The first press of the double already took the sheet to SITE.
    setTimeout(() => { if (lotOnSite()) reopenLot(); }, 0);
  });

  const roomCard = document.getElementById('room-pick');
  const syncRoomCard = pick => {
    if (!roomCard) return;
    roomCard.hidden = !pick;
    if (!pick) return;
    const { over } = pick;
    const lineUp = roomLineUpFt(pick);
    const say = roomCard.querySelector('[data-room-pick-says]');
    const words = `${roomPickWords(over)}.`;
    if (say.textContent !== words) say.textContent = words;
    const up = roomCard.querySelector('[data-room-pick-lineup]');
    up.hidden = lineUp == null;
    up.setAttribute('aria-pressed', String(lineUp != null && over.depthFt === lineUp));
    roomCard.querySelector('[data-room-pick-full]')
      .setAttribute('aria-pressed', String(over.depthFt === over.depth));
    roomCard.querySelector('[data-room-pick-less]').disabled = over.depthFt <= over.range.lo;
    roomCard.querySelector('[data-room-pick-more]').disabled = over.depthFt >= over.range.hi;
  };
  const setRoomFt = ft => {
    const pick = roomPick();
    if (!pick || ft == null) return;
    roomOverFt = Math.max(pick.over.range.lo, Math.min(pick.over.range.hi, Math.round(ft)));
    sayOnStrip(`${roomPickWords(roomPick().over)}. Press BUILD or the bone.`);
    paint();
  };
  if (roomCard) {
    roomCard.querySelector('[data-room-pick-lineup]').addEventListener('click', () => setRoomFt(roomLineUpFt(roomPick())));
    roomCard.querySelector('[data-room-pick-full]').addEventListener('click', () => setRoomFt(roomPick()?.over.depth));
    roomCard.querySelector('[data-room-pick-less]').addEventListener('click', () => setRoomFt((roomPick()?.over.depthFt ?? 0) - 1));
    roomCard.querySelector('[data-room-pick-more]').addEventListener('click', () => setRoomFt((roomPick()?.over.depthFt ?? 0) + 1));
    roomCard.querySelector('[data-room-pick-build]').addEventListener('click', () => {
      roomCard.hidden = true;
      window.ModelBuild.build();
    });
  }
  let roomDrag = null;
  const ROOM_GRAB_PX = 10;
  const nearRoomLine = (pick, sx, sy) => {
    const [a, b] = pick.line.map(toS);
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((sx - a.x) * dx + (sy - a.y) * dy) / len2));
    return Math.hypot(sx - (a.x + t * dx), sy - (a.y + t * dy)) <= ROOM_GRAB_PX;
  };
  const paintRoomPick = () => {
    const pick = roomPick();
    syncRoomCard(pick);
    if (!pick) return;
    const loop = l => {
      if (!l || l.length < 2) return;
      ctx.beginPath();
      l.map(fromBuilderFrame).map(toS).forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
    };
    ctx.save();
    ctx.strokeStyle = skin['draw-line'];
    ctx.lineWidth = 1.25;
    ctx.setLineDash([6, 4]);
    // THE ENTRY AND THE BALCONY, drawn for him as he asked, and the room.
    [pick.plan.entry, pick.plan.upperLanding].forEach(l => { loop(l); ctx.stroke(); });
    loop(pick.over.room);
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = skin['accent'];
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
    // THE LINE HE MOVES.
    ctx.setLineDash([]);
    ctx.strokeStyle = skin['accent'];
    ctx.lineWidth = roomDrag ? 5 : 4;
    const [a, b] = pick.line.map(toS);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.fillStyle = skin['accent'];
    ctx.font = '12px "DM Mono", monospace';
    // OFF THE END OF THE LINE, where no wall of the trace runs through it.
    const tip = a.x >= b.x ? a : b;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`ROOM ${pick.over.depthFt}'`, tip.x + 8, tip.y);
    ctx.restore();
  };
  // EXPOSED FOR THE SPEC, which has to find the line to press on it.
  window.ModelRoomPick = Object.freeze({
    line: () => roomPick()?.line.map(p => ({ ...p })) || null,
    depthFt: () => roomPick()?.over.depthFt ?? null,
    lineUpFt: () => roomLineUpFt(roomPick()),
  });

  // ── A GARAGE ABOVE THE HOUSE CEILING: LINE IT UP? ────────────────────────
  //
  // Movie, 7 Oct: keep the garage's 10'-1 3/4" default -- "but ... if it
  // (garage) goes higher, ask the user if they would prefer to allign the
  // garage height with ceiling height", asked when the BONE is pressed. YES:
  // "GARAGE and HOUSE will be ONE ROOF" -- the garage's own WALL HEIGHT is set
  // so its top meets the house's (house wall + MAIN floor package, + the
  // frost-wall drop), which garage-roofs.js reads as one roof. NO: build as
  // typed, and ask again next time.
  //
  // A SPLIT, OR A GARAGE WITH A ROOM ON IT, IS NEVER ASKED: the split works
  // its own heights out, and a room over the garage holds its walls at the
  // house's plate already.
  const garageAlignCard = document.getElementById('garage-align');
  let garageAlignGo = null;
  const garageAboveCeiling = () => {
    const LA = window.DraftLevelAssembly, GR = window.DraftGarageRoofs;
    const houseTop = LA.houseWallTopFt(drawing);
    const garageTop = GR.garageTopFt(drawing, null);
    return garageTop > houseTop + GR.SAME_TOP_FT
      ? { houseTop, garageTop, alignedWallFt: LA.attachedGarageWallFt(drawing) - (garageTop - houseTop) }
      : null;
  };
  const asksGarageAlign = (entry, hasGarage) => Boolean(hasGarage && entry
    && entry.overGarage !== true && !window.DraftLevelAssembly.isSplitType(entry.type));
  // Runs `go` now, or after the drafter answers. True when it asked.
  const withGarageAlign = (entry, hasGarage, go) => {
    const above = asksGarageAlign(entry, hasGarage) ? garageAboveCeiling() : null;
    if (!above || !garageAlignCard) { go(); return false; }
    const F = window.DraftFormatters;
    const ftIn = ft => F.formatArchitecturalInches(ft * 12);
    garageAlignCard.querySelector('[data-garage-align-over]').textContent = ftIn(above.garageTop - above.houseTop);
    garageAlignCard.querySelector('[data-garage-align-to]').textContent = ftIn(above.alignedWallFt);
    garageAlignCard.querySelector('[data-garage-align-keep]').textContent =
      ftIn(window.DraftLevelAssembly.attachedGarageWallFt(drawing));
    garageAlignGo = { go, alignedWallFt: above.alignedWallFt };
    garageAlignCard.hidden = false;
    return true;
  };
  if (garageAlignCard) {
    const answer = lineUp => {
      const pending = garageAlignGo;
      garageAlignGo = null;
      garageAlignCard.hidden = true;
      if (!pending) return;
      if (lineUp) {
        const table = drawing.sectionTable || { rows: {} };
        const rows = table.rows || {};
        drawing.sectionTable = { ...table, rows: { ...rows,
          attachedGarage: { ...(rows.attachedGarage || {}), mainWallHeightFt: pending.alignedWallFt } } };
        markDirty();
      }
      pending.go();
    };
    garageAlignCard.querySelector('[data-garage-align-yes]').addEventListener('click', () => answer(true));
    garageAlignCard.querySelector('[data-garage-align-no]').addEventListener('click', () => answer(false));
  }

  // THE GARAGE SPAN ASK WAS HERE, and it is gone: a card offering "1. REQ
  // ENGINEERED BEAM / OR JOISTS" or "2. PLACE COLUMNS TO SUPPORT BEAM", the
  // levels it was asked about, and a hold that kept the bones from growing
  // out from under a question still on screen. Movie, 15 Oct: "don't ask the
  // user about placing beams and columns or the engineered owj, just make the
  // decision based on spans don't ask the user, they can adjust it later if
  // they need too".
  const buildTracedHouse = order => {
    const TP = window.DraftTracedPlans;
    if (!TP || !order?.entry) return null;
    const pts = rec => rec.points.map(p => ({ x: p.x, z: p.z }));
    if (isGarageChoice(order)) {
      const loop = traceStillThere(tracedGarage) ? tracedGarage
        : (traceStillThere(tracedHouse) ? tracedHouse : null);
      const garage = loop ? TP.detachedFromTrace(pts(loop)) : null;
      if (!garage) return null;
      return buildOrderedGarage(order, { ...garage, restore: traceRestore() });
    }
    if (!traceStillThere(tracedHouse)) return null;
    const plan = TP.planFromTrace({
      entryId: order.entry.id,
      house: pts(tracedHouse),
      garage: traceStillThere(tracedGarage) ? pts(tracedGarage) : null,
      roomDepthFt: roomOverFt,
    });
    if (plan.error) {
      sayOnStrip(TRACE_REFUSALS[plan.error] || 'This trace cannot be built as that type.');
      return null;
    }
    return buildPremadePlan(order, { plan, restore: traceRestore() });
  };

  // THE SEAM'S FIRST LISTENER. It says buildServed when the house went up,
  // which is how the press learns it has been answered -- see fireBuild.
  window.ModelBuild.onBuild(() => {
    if (tracedOrder && (traceStillThere(tracedHouse) || traceStillThere(tracedGarage))) {
      const order = tracedOrder;
      const hasGarage = !isGarageChoice(order) && traceStillThere(tracedHouse)
        && traceStillThere(tracedGarage);
      withGarageAlign(order.entry, hasGarage, () => {
        if (!builtFrontDown(buildTracedHouse)(order)) return;
        tracedOrder = null;
        tracedHouse = null;
        tracedGarage = null;
        tracedMasters = [];
        roomOverFt = null;
        // The card goes with the line it moved: the build turns the view to
        // E1, where the plan's paint never runs to hide it.
        const card = document.getElementById('room-pick');
        if (card) card.hidden = true;
        window.ModelBuild.buildServed();
        // AND THE SAME SHOW A PREMADE PRESS GETS: the bones grow, then E1.
        presentBuild();
      });
      return;
    }
    if (buildFromDrawnOutline()) window.ModelBuild.buildServed();
  });

