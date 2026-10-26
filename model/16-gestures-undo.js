// MODEL.html's page script, part 16 of 17: pan and zoom, the SHIFT tap, half-finished gestures, a note's words, UNDO / REDO.
//
// Stage 2 of the split (Movie, 24 Oct: "how can we reduce the MODEL.html
// size in a nice organized way"): the one script the page carried, cut
// at its own section headings and moved here verbatim, in order. The
// parts load one after another as classic scripts and share one scope,
// as they did inside the page; the indent is the page's, kept so every
// line reads as it did there.

  // ── pan and zoom ──────────────────────────────────────────────────────────
  let dragging = null;
  // One drag for both gestures: `kind` says whether the press took a corner or
  // the wall's body, and `before` is the list of pooled vertices it will move
  // with the numbers they started with.
  let moveDrag = null;
  // ── HOW FAR A DRAG HAS GONE, IN THE LENGTH BOX (Movie, 24 Oct) ─────────
  //
  // "when i 'strech' stuff can the LENGTH box show the measured number of
  // how far i am moving the STRETCH from the origin point". Every drag that
  // moves something -- a wall's body or corner, an assembly, a selection
  // under MOVE, an opening sliding, a note, a stair -- reads its distance
  // from where the press took it while the button is down. The corners
  // say what they actually moved (a wall's body only goes square to
  // itself); the rest, how far the hand is from the press.
  //
  // READ IN PAINT, after the drag's own handler has moved what it moves, so
  // the number is this move's and not the last one's.
  const liveDragFt = () => {
    const d = moveDrag;
    if (d && d.active) {
      if (d.kind === 'opening' && d.opening) return Math.abs((Number(d.opening.offset) || 0) - (Number(d.was) || 0));
      const first = Array.isArray(d.before) && d.before.find(b => b && b.vtx);
      if (first) return Math.hypot(first.vtx.x - first.x, first.vtx.z - first.z);
      if (d.grab && cursorWorld) return Math.hypot(cursorWorld.x - d.grab.x, cursorWorld.z - d.grab.z);
    }
    const m = moveState && moveState.drag;
    if (m && m.moved) {
      if (m.kind === 'opening' && m.opening) return Math.abs((Number(m.opening.offset) || 0) - (Number(m.was) || 0));
      if (m.at && cursorWorld) return Math.hypot(cursorWorld.x - m.at.x, cursorWorld.z - m.at.z);
    }
    return null;
  };
  // ── A LONE SHIFT TAP BREAKS A CORNER (Movie, 24 Oct) ─────────────────
  //
  // "we should add the disconnect option for corners, but not with a popup
  // ... if the user selects a corner node ... will break the nodes and the
  // user will control one of the lines (if they selected the node and
  // selected one of the line at the beginning it will give them control of
  // that line, but if they only selected a node it will randomly give them
  // control of one", and then "choose NODE (and line if desired) and then
  // press SHIFT --- just shift once".
  //
  // ONCE, ON ITS OWN: SHIFT pressed and let go with no press, no other key
  // and no drag between. SHIFT+click still adds to a selection, SHIFT held
  // through a wall drag still lets its corners go, and SHIFT with a drawing
  // tool up still lines up on a node -- none of those is a lone tap, or
  // under SELECT.
  //
  // The corner under the hand is broken: the picked wall's end there comes
  // free and follows the hand until a click puts it down (one UNDO joins it
  // again); Esc joins it back at once.
  let shiftTap = null;
  window.addEventListener('keydown', e => {
    if (e.key === 'Shift' && !e.repeat) shiftTap = { clean: true };
    else if (shiftTap) shiftTap.clean = false;
  }, true);
  window.addEventListener('pointerdown', () => { if (shiftTap) shiftTap.clean = false; }, true);
  window.addEventListener('keyup', e => {
    if (e.key !== 'Shift') return;
    const tap = shiftTap;
    shiftTap = null;
    if (tap?.clean) breakCornerByShift();
  }, true);
  // THE CORNER AND THE WALL THAT COMES FREE: the picked wall's end under the
  // hand; with no wall picked, any wall's end there, the first that shares it.
  const cornerToBreak = () => {
    if (!cursorWorld) return null;
    const reach = CORNER_GRAB_PX / view.scale;
    const near = v => v && Math.hypot(v.x - cursorWorld.x, v.z - cursorWorld.z) <= reach;
    const picked = selectedSegment();
    if (picked && walls().includes(picked)) {
      const v = [picked.start, picked.end].find(near);
      return v ? { run: picked, v } : null;
    }
    let best = null;
    walls().forEach(w => [w.start, w.end].forEach(v => {
      if (!near(v)) return;
      const d = Math.hypot(v.x - cursorWorld.x, v.z - cursorWorld.z);
      if (!best || d < best.d) best = { run: w, v, d };
    }));
    return best;
  };
  const breakCornerByShift = () => {
    if (activeTool !== RESTING_TOOL || moveDrag || board === 'toy' || modalUp()) return;
    const hit = cornerToBreak();
    if (!hit) return;
    const { run, v } = hit;
    if (![...walls(), ...lines()].some(r => r !== run && (r.start === v || r.end === v))) {
      sayOnStrip('Nothing else meets at that corner -- there is nothing to break.');
      return;
    }
    // detachCorner frees the PICKED wall's end; picked here so it is this one.
    setSelection([{ type: 'wall', item: run }]);
    const before = [{ vtx: v, x: v.x, z: v.z, offX: v.offX, offZ: v.offZ }];
    const at = { x: v.x, y: 0, z: v.z };
    moveDrag = { kind: 'corner', body: run, grab: at, before, follow: [],
      sx: pointerScreen?.x ?? 0, sy: pointerScreen?.y ?? 0, active: true, carry: true };
    detachCorner(moveDrag, v);
    sayOnStrip('Corner broken -- this wall\'s end follows the hand; click to put it down, Esc joins it back.');
    paint();
  };
  // THE CLICK THAT PUTS THE CARRIED END DOWN is nothing else: its press is
  // kept from the page, and its release ends the drag as any release does.
  canvas.addEventListener('pointerdown', e => {
    if (!moveDrag?.carry) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    moveDrag.carry = false;
  }, true);
  window.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !moveDrag?.carry) return;
    e.stopImmediatePropagation();
    const md = moveDrag;
    moveDrag = null;
    const { shared, fresh } = md.loose;
    fresh.forEach((f, i) => {
      if (md.body.start === f.vtx) md.body.start = shared[i].vtx;
      if (md.body.end === f.vtx) md.body.end = shared[i].vtx;
      const k = vertexPool.indexOf(f.vtx);
      if (k >= 0) vertexPool.splice(k, 1);
    });
    sayOnStrip('Corner joined again.');
    paint();
  }, true);
  syncDragLength = () => {
    const ft = liveDragFt();
    if (ft == null || document.activeElement === lengthBox) return;
    lengthBox.value = feetLabel(ft);
    lengthBox.classList.add('live');
  };

  // ── §3: MOVING A BONE ────────────────────────────────────────────────────
  //
  // THE WALL MOVES PERPENDICULAR TO ITSELF. A wall running along x travels in
  // z and vice versa; the component along its own run is dropped rather than
  // constrained, because sliding a wall lengthwise is not a move this board
  // offers.
  const runAxisOf = w => (Math.abs(w.end.x - w.start.x) >= Math.abs(w.end.z - w.start.z)
    ? 'x' : 'z');
  const posOnMoveAxis = w => (runAxisOf(w) === 'x' ? w.start.z : w.start.x);

  // THE FIRST NUDGE OF AN OFF-GRID WALL LANDS IT ON THE FOOT MARK. Movie,
  // 13 Sep: "make the first point land on a ft point how about so we don't
  // have that problem" -- so a wall at 12'-0½" goes to 13'-0", then 14'-0".
  //
  // WHY THIS LIVES HERE AND NOT IN THE MODULE. allowedMove quantises the
  // DELTA, never the position: quantiseFeet(d, step) = round(d/step)*step. It
  // cannot land a wall on the grid because it never looks at where the wall
  // is. Teaching it to is the second constraint path §3 forbids. So the PAGE
  // decides what distance to ask for, and the module still decides whether
  // that distance is allowed -- which is the division of labour the order
  // describes.
  //
  // The half-inch is given up ONCE, on the wall the drafter deliberately
  // moved. A wall nobody touches is never re-gridded, which is what keeps the
  // 31 Aug rule intact: opening an old plan in TOY moves nothing.
  const FOOT = 1;
  const offGridBy = pos => {
    const frac = pos - Math.floor(pos);
    return Math.min(frac, FOOT - frac) < 1e-6 ? 0 : frac;
  };
  // ONE FUNCTION, AND IT RETURNS THE STEP. This was a landingDelta returning
  // null for an on-grid wall, and a caller turning that null into FOOT -- and
  // the gate showed the null branch was redundant twice over: with `ask` now
  // always the drafter's distance, an on-grid wall computes a step of exactly
  // FOOT down either path, so the two arms produced identical answers and the
  // mutant deleting the guard changed nothing.
  //
  // The distance to the next foot mark IN THE DIRECTION OF TRAVEL is the whole
  // rule, and on a wall already on the grid that distance IS a foot. Saying it
  // once is shorter than saying it twice and calling one of them a special
  // case.
  const landingStep = (pos, direction) => {
    const frac = offGridBy(pos);
    if (!frac) return FOOT;
    return direction > 0 ? FOOT - frac : frac;
  };

  // THE MODULE'S REASONS, IN THE DRAFTER'S WORDS. toy-constraints.js names
  // them as codes on purpose -- it is a node module with no screen -- so the
  // page is where they become a sentence. Movie's rule for TOY is that a
  // refusal is explained "in the room's own words", and a code is not that.
  //
  // The default is the code itself rather than a shrug: an unnamed reason is a
  // bug in this list, and printing it is how anyone finds out. A generic
  // "cannot move that" would hide the gap for ever.
  const BLOCKER_WORDS = {
    NOT_ORTHOGONAL: 'this wall is not square, so the toy cannot move it',
    TOUCHES_NON_ORTHOGONAL: 'this wall meets an angled wall, so the toy cannot move it',
    MIN_ROOM: 'that would make a room too small',
    OPENING_WOULD_NOT_FIT: 'a door or window would not fit after that',
    CANTILEVER: 'that would overhang more than 2 ft — bring the foundation out first',
    GROUP_MEMBER_BLOCKED: 'a wall joined to this one cannot move that far',
    OBJECT_CLEARANCE: 'something in the room would not have room left',
    NEEDS_A_BEAM: 'that span would need a beam',
    // The wall the drafter grabbed is square and so is its neighbour; moving
    // it is what would bend one. So this says what the MOVE would do, not what
    // the wall is -- the other two ortho lines above are about the wall.
    WOULD_ANGLE_NEIGHBOUR: 'that would leave the next wall on an angle — break it first',
  };
  const blockerSays = verdict =>
    BLOCKER_WORDS[verdict.reason] || `cannot move it: ${verdict.reason}`;

  const toyWallDelta = (md, dx, dz) => {
    const T = window.DraftToyConstraints;
    const C = window.DraftToyContext;
    const wall = md.body;
    if (!T || !C || !wall) return null;
    const axis = runAxisOf(wall);
    // Perpendicular only. The along-run component is discarded, not clamped.
    const wanted = axis === 'x' ? dz : dx;
    if (!wanted) return { dx: 0, dz: 0 };

    // TWO THINGS, AND I REMOVED ONE OF THEM AS REDUNDANT AN HOUR AGO. The gate
    // had shown `ask = land` changing nothing, so I dropped it -- but it was
    // only ever exercised pulling -z, where the distance to the mark behind is
    // 0.958 and quantising a one-foot ask by 0.958 lands on the mark anyway.
    // Push +z from the same wall and the distance to the mark AHEAD is 0.042:
    // quantising a one-foot ask by 0.042 gives 1.008, and the wall sails past
    // the mark to -5.03.
    //
    // So the step alone does not carry the rule. THE FIRST NUDGE OF AN
    // OFF-GRID WALL IS THE LANDING, whatever the drag distance -- that is what
    // `ask` says -- and the step is what stops the module rounding the landing
    // back off the grid. Both, and neither is decoration.
    //
    // The lesson is the one from the fixture that only ran -z: a gate result
    // is only as good as the directions the checks take. I generalised from
    // one arm of a branch and deleted a line that carried the other.
    const pos = posOnMoveAxis(wall);
    const dir = Math.sign(wanted);
    const land = landingStep(pos, dir);
    const ask = offGridBy(pos) ? dir * land : wanted;
    const probe = { ...wall, stepFt: land };
    // ZERO-LENGTH WALLS ARE NOT GEOMETRY, and handing one to the module makes
    // it refuse the very drag that is about to give the wall its length. §4's
    // connector is born with both ends at the same point; `isOrthogonal`
    // reports false for a run of no length, so `inertReason` sees the dragged
    // wall TOUCHING a non-orthogonal wall and calls it inert. The move is
    // refused by the thing the move creates.
    //
    // The format drops anything under 1e-6 on load, so a wall this short is
    // not a record the drawing will keep either. The module is asked about
    // real walls.
    const ctx = C.gather({ walls: (drawing.walls || [])
      .filter(w => Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z) >= 1e-6)
      .map(w => ({ ...w })) });
    // THE PAGE HAS TO SAY WHAT ACTUALLY MOVES, and until now it did not.
    //
    // Left to itself the module builds a weld group: any two walls whose ends
    // touch are welded, so a CLOSED ROOM is one group and dragging any wall of
    // it is judged as picking the whole house up and setting it down a foot
    // away. That is trivially legal, which is why `allowedMove` has answered
    // an unconditional yes here since §3 landed -- every room minimum, every
    // cantilever band, every beam-span rule in the module was unreachable from
    // this page, and no mutant could show it because the answer is the same
    // whether the rules work or not.
    //
    // Measured: dragging `n` on the plain square returned group [n,e,s,w] and
    // no stretches. The page then moved ONE wall and stretched its neighbours,
    // which is a different operation from the one that was approved.
    //
    // `welds` is the module's own override, so this is telling it the truth
    // rather than defeating it: the group is the dragged wall, and the walls
    // hanging off its corners are STRETCHES -- which is exactly what this page
    // does to them.
    const verdict = T.allowedMove(probe, ask,
      { ...ctx, mode: T.MODE.TOY, welds: [[wall.id]],
        // §4: the corners this drag already unshared. Their neighbours still
        // sit at the same coordinates until the first delta lands, so without
        // this the module refuses the bump-out as a diagonal it would have
        // caused -- a refusal about geometry the page has already resolved.
        detached: (md.connectors || []).map(c => c.detachedFrom).filter(Boolean) });
    // §3: "A BLOCKED DRAG STOPS DEAD AND THE BLOCKER SAYS WHY. Never elastic."
    // The saying is the half that was missing: allowedMove has always returned
    // a reason and this page has always stored it, and nothing put it on
    // screen. That is the same fault as a refusal written and overwritten --
    // a rule that exists to speak, silent -- so it goes through sayOnStrip
    // like every other thing this page says, and the next drag that actually
    // moves something clears it.
    const stopped = verdict.reason && verdict.delta === 0;
    md.blocked = stopped ? verdict : null;
    if (stopped) sayOnStrip(blockerSays(verdict));
    else if (verdict.delta) clearNotice();
    const moved = verdict.delta || 0;
    return axis === 'x' ? { dx: 0, dz: moved } : { dx: moved, dz: 0 };
  };
  // ── EVERY HALF-FINISHED GESTURE, PUT DOWN ────────────────────────────
  //
  // Movie, 27 Sep: *"do we have control over anything that happens when the
  // right mouse button is clicked, could we make it do more things i don't
  // think i've used the right click yet"*. He had not used it because it had
  // nothing to use: this page had no contextmenu handler at all, so the right
  // button PLACED A WALL POINT -- pointerdown never asked which button -- and
  // opened the browser's own menu over the drawing at the same time.
  //
  // THE OLD PAGE ALREADY RULED WHAT IT SHOULD DO. MODEL.dc.html:11320's
  // _onRightClick cancels the window selection, the extend, the wall, the
  // line, the floor, the outline and the cut, and clears NO selection. That
  // is the verb this page gets.
  //
  // AND WRITING IT DOWN FOUND THAT ESCAPE HAD BEEN LYING. Escape's own note
  // says it "puts down every other half-taken gesture on this page", and it
  // clears three of them -- the wall's anchor, the ruler's measure and the
  // unfinished bone. The CUT's first press, the BEAM's anchor, the FLOOR's
  // trace and the OUTLINE's trace all survived it, because the only thing
  // that ever cleared those was a TOOL CHANGE (the toolListener at :9018). So
  // a drafter four corners into a floor pressed Escape, saw nothing happen,
  // and pressed it again.
  //
  // ONE LIST, TWO CALLERS, which is what makes the claim checkable: Escape
  // and the right button cannot come to different opinions about what a
  // half-finished gesture is.
  //
  // LIVE DRAGS ARE NOT IN IT. bandDrag, moveDrag and wallPress are pointer
  // captures that end on their own pointerup; dropping one from under the
  // capture would leave the browser holding a pointer this page had
  // forgotten about. A gesture here is one that PERSISTS BETWEEN PRESSES.
  const cancelGestures = () => {
    const had = !!(drawStart || rulerFrom || pendingBone || cutStart || beamStart || elevLineStart
      || outlineCorners.length || floorCorners.length || shapeCorners.length || dimPoints.length
      || stretchState.a || stairHand.at);
    drawStart = null;
    stretchState = { a: null, b: null, base: null };
    if (dimPlacing) dimKeep();
    // A STAIR IN HAND goes; the tool stays up for the next first step.
    if (stairHand.at) { stairHand.at = null; syncStairPick(); }
    dimPoints = [];
    dimPlacing = false;
    rulerFrom = null;
    beamStart = null;
    cutStart = null;
    cutEnd = null;
    elevLineStart = null;
    elevNotePress = null;
    elevPointerTip = null;
    outlineCorners = [];
    floorCorners = [];
    shapeCorners = [];
    outlineFamily = null;
    if (pendingBone) { pendingBone = null; sayOnStrip('run cancelled'); }
    return had;
  };

  // THE RIGHT BUTTON PUTS THE GESTURE DOWN, and takes the browser's menu with
  // it. preventDefault unconditionally -- a menu over the sheet is wrong even
  // when there is nothing to cancel -- but the repaint only when something
  // actually changed, because a full canvas redraw for a press that did
  // nothing is the cost the hover branch's note is about.
  // THE CANCEL NOW RIDES THE RIGHT BUTTON'S RELEASE (endDrag), so a right DRAG
  // can pan without putting the gesture down. The menu is still refused here.
  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
  });

  // ── PANNING WITHOUT THE LEFT BUTTON (Movie, 4 Oct) ─────────────────────
  //
  // A left drag on empty sheet now draws the selection box, so the pan moves:
  // the RIGHT button drags the sheet (a right click that does not travel
  // still puts the gesture down, as it always has), and on a touch screen
  // TWO FINGERS drag it. `touchPts` is every finger on the glass.
  const touchPts = new Map();
  let twoPan = null;
  const touchMid = () => {
    const pts = [...touchPts.values()];
    return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
  };
  const startPan = (x, y, extra = {}) => ({ sx: x, sy: y, cx: view.cx, cz: view.cz, moved: 0,
    // On an elevation a pan moves the painter's frame, not the plan's view.
    elev: drawing && activeCut() && elevFrame ? { ...elevFrame } : null,
    ...extra });
  const panElev = (pan, dx, dy) => {
    if (!pan.elev) return false;
    const cutNow = activeCut();
    if (!cutNow) return false;
    elevPin = { pxPerFt: pan.elev.pxPerFt, uMin: pan.elev.uMin, yTop: pan.elev.yTop,
      x0: pan.elev.x0 + dx, y0: pan.elev.y0 + dy };
    elevPinFor = String(cutNow.id || cutNow.name);
    paint();
    return true;
  };
  // THE STAIR WORKSPACE TAKES A PRESS AS ENLARGE / SPLIT, and nothing else:
  // it is a drawing to read, not a sheet to draw on.
  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !stairWorkspaceOn() || modalUp()) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    if (stairPane !== 'split') stairPane = 'split';
    else {
      const r = canvas.getBoundingClientRect();
      const box = stairWorkspaceBox();
      stairPane = window.DraftStairSection.paneAtY(e.clientY - r.top - box.y, box.h);
    }
    paint();
  });
  // THE ROOM'S END WALL TAKES THE PRESS FIRST, while there is one to move.
  // Registered before the tools' own listeners so a press on the line is
  // never also a selection box or a pan.
  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0 || activeCut() || modalUp()) return;
    const pick = roomPick();
    if (!pick) return;
    const r = canvas.getBoundingClientRect();
    if (!nearRoomLine(pick, e.clientX - r.left, e.clientY - r.top)) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    roomDrag = { pointerId: e.pointerId };
    canvas.setPointerCapture(e.pointerId);
    paint();
  });
  canvas.addEventListener('pointermove', e => {
    if (!roomDrag || e.pointerId !== roomDrag.pointerId) return;
    e.stopImmediatePropagation();
    const pick = roomPick();
    if (!pick) { roomDrag = null; return; }
    const r = canvas.getBoundingClientRect();
    const w = toBuilderFrame(toWorld(e.clientX - r.left, e.clientY - r.top));
    const { a, inward, range } = pick.over;
    const t = (w.x - a.x) * inward.x + (w.z - a.z) * inward.z;
    const next = Math.max(range.lo, Math.min(range.hi, Math.round(t)));
    if (next !== pick.over.depthFt) {
      roomOverFt = next;
      sayOnStrip(`${roomPickWords(roomPick().over)}. Press the bone to build.`);
    }
    paint();
  });
  const endRoomDrag = e => {
    if (!roomDrag || e.pointerId !== roomDrag.pointerId) return;
    e.stopImmediatePropagation();
    roomDrag = null;
    paint();
  };
  canvas.addEventListener('pointerup', endRoomDrag);
  canvas.addEventListener('pointercancel', endRoomDrag);
  // ── EDITING A NOTE'S WORDS ─────────────────────────────────────────────
  // A double-click on a note opens its words in a box laid over the note
  // itself (Movie, 10 Oct). Enter keeps, Shift+Enter starts a new line,
  // Escape puts it back; clicking away keeps. One edit, one undo. A note
  // emptied out keeps its old words: the format has no note without any.
  const editNoteText = note => {
    const rect = canvas.getBoundingClientRect();
    const b = noteBox(note);
    const box = document.createElement('textarea');
    box.dataset.noteEdit = '';
    box.value = note.body;
    box.rows = Math.max(1, String(note.body).split('\n').length);
    Object.assign(box.style, { position: 'fixed', left: `${rect.left + b.left}px`,
      top: `${rect.top + b.top}px`, minWidth: `${Math.max(180, b.width)}px`, zIndex: 50,
      font: "600 14px 'Barlow Condensed', system-ui, sans-serif", padding: '2px 6px',
      textTransform: 'uppercase', resize: 'none' });
    let settled = false;
    const settle = keep => {
      if (settled) return;
      settled = true;
      const body = box.value.split('\n').map(line => line.trimEnd()).join('\n').trim().toUpperCase();
      box.remove();
      if (!keep || !body || body === note.body) return;
      undoStack.push(brushUndoStep([note]));
      note.body = body;
      markDirty();
      paint();
    };
    box.addEventListener('keydown', ev => {
      ev.stopPropagation();
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); settle(true); }
      if (ev.key === 'Escape') { ev.preventDefault(); settle(false); }
    });
    box.addEventListener('input', () => { box.rows = Math.max(1, box.value.split('\n').length); });
    box.addEventListener('blur', () => settle(true));
    document.body.appendChild(box);
    box.focus();
    box.select();
  };
  // A STAIR'S WIDTH, CHANGED ON THE PLAN (Movie, 25 Oct: "allow the user to
  // change that number on the plan to change the width too"): a double-click
  // on the mark opens a box on it; ENTER sets the width, Esc leaves it.
  const stairWidthMarkAt = (sx, sy) => stairWidthMarks.find(m => {
    const dx = sx - m.x, dy = sy - m.y;
    const c = Math.cos(-m.angle), s2 = Math.sin(-m.angle);
    const lx = dx * c - dy * s2, ly = dx * s2 + dy * c;
    return Math.abs(lx) <= m.w / 2 + 2 && Math.abs(ly) <= m.h / 2 + 2;
  }) || null;
  const editStairWidthAt = (mark, clientX, clientY) => {
    const box = document.createElement('input');
    box.type = 'number';
    box.id = 'stair-width-edit';
    box.dataset.stairWidthEdit = '';
    box.min = '36';
    box.step = '1';
    box.value = String(Math.round((Number(mark.stair.widthFt) || 3) * 12));
    box.style.cssText = `position:fixed;left:${clientX - 30}px;top:${clientY - 12}px;width:60px;z-index:60;`;
    let done = false;
    const settle = keep => {
      if (done) return;
      done = true;
      const value = box.value;
      box.remove();
      if (keep) { setStairWidth(mark.stair, value); showSelectionProps(); renderObjProp(); }
      paint();
    };
    box.addEventListener('keydown', ev => {
      ev.stopPropagation();
      if (ev.key === 'Enter') { ev.preventDefault(); settle(true); }
      if (ev.key === 'Escape') { ev.preventDefault(); settle(false); }
    });
    box.addEventListener('blur', () => settle(false));
    document.body.appendChild(box);
    box.focus();
    box.select();
  };
  canvas.addEventListener('dblclick', e => {
    if (!drawing || activeTool !== RESTING_TOOL || activeCut() || stairWorkspaceOn()) return;
    const r = canvas.getBoundingClientRect();
    const mark = stairWidthMarkAt(e.clientX - r.left, e.clientY - r.top);
    if (!mark) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    editStairWidthAt(mark, e.clientX, e.clientY);
  });
  canvas.addEventListener('dblclick', e => {
    if (!drawing || activeTool !== RESTING_TOOL || activeCut() || stairWorkspaceOn()) return;
    const rect = canvas.getBoundingClientRect();
    const note = noteAt(toWorld(e.clientX - rect.left, e.clientY - rect.top));
    if (!note) return;
    e.preventDefault();
    moveDrag = null;
    setSelection([{ type: 'note', item: note }]);
    paint();
    editNoteText(note);
  });
  // ── WHAT A CLICK WOULD TAKE, BESIDE THE CURSOR (Movie, 13 Oct) ───────
  //
  // "can we make a little text area come up along side the cursor when it
  // rolls over items so the user can identify what it would select if they
  // clicked at that time". He was trying to pick a garage door out of the wall
  // it sits in, with a dimension string and a room tag over the same few
  // pixels, and the page only told him afterwards -- "NOTHING THERE. PRESS
  // SOMETHING OF THE SAME KIND".
  //
  // IT ASKS hitAt, THE FUNCTION THE CLICK ITSELF ASKS. Not a second hit test:
  // hitAt carries the precedence (a tag beats the floor it names, a vertex
  // beats the segments through it) AND the OBJECT TYPE filters, through
  // filterAllows. So the label cannot disagree with what a press would
  // actually give -- which is the whole of its usefulness.
  //
  // AND THAT MAKES IT A READ-OUT OF THE FILTERS TOO, which is Movie's own
  // case: with DOOR/WIN switched off, hovering the garage door names the WALL
  // behind it. He asked which of the two it should say and the answer is this
  // one -- a label naming a door that a click cannot take would be the page
  // lying about the outcome, and he would be no wiser about why.
  //
  // NAMED BY shortName, the brush chip's own words, so the thing he is about
  // to copy properties from reads the same in both places.
  const hoverName = document.getElementById('hover-name');
  // The types hitAt can return, each said as the thing rather than the kind.
  // Defensive about fields: a label is not worth a thrown error over a record
  // written before one of them existed.
  const hitSays = hit => {
    if (!hit || !hit.item) return '';
    const F = window.DraftFormatters;
    const ftIn = feet => F.formatArchitecturalInches((Number(feet) || 0) * 12);
    const it = hit.item;
    const shared = shortName(hit.type, it);
    if (shared) return shared;
    if (hit.type === 'hologram') return `${it.mode === 'suite' ? 'SUITE' : 'HOLOGRAM'} ${it.name || ''}`.trim();
    if (hit.type === 'roomtag') return `ROOM TAG ${String(it.text || it.name || '').trim()}`.trim();
    if (hit.type === 'note') {
      const words = String(it.text?.body || it.body || it.text || '').trim().split(/\s+/);
      return `NOTE ${words.slice(0, 3).join(' ')}${words.length > 3 ? '\u2026' : ''}`.trim();
    }
    if (hit.type === 'fixture') return `FIXTURE ${String(it.kind || it.fixture || '').toUpperCase()}`.trim();
    if (hit.type === 'dimension') {
      if (hit.point) return 'DIM POINT';
      const dx = (it.end?.x ?? 0) - (it.start?.x ?? 0);
      const dz = (it.end?.z ?? 0) - (it.start?.z ?? 0);
      return `DIM ${ftIn(Math.hypot(dx, dz))}`;
    }
    if (hit.type === 'stair') return 'STAIR';
    if (hit.type === 'shape') return 'SHAPE';
    if (hit.type === 'outline') return it.garage ? 'OUTLINE (GARAGE)' : 'OUTLINE';
    if (hit.type === 'roof') return `ROOF ${it.pitch ?? '?'}:12`;
    return String(hit.type || '').toUpperCase();
  };
  // A GESTURE IN HAND OWNS THE POINTER. Naming what is under the cursor while
  // the drafter is dragging something is noise about a press he is not about
  // to make -- and during a MOVE the thing under the cursor is what he is
  // carrying.
  //
  // THE LIST IS THIS BRANCH'S. The MOVE command (claude/move-command) adds a
  // `moveCmd` of its own, and whichever of the two lands second should add it
  // here -- while a selection is following the cursor the thing under it is
  // what the drafter is CARRYING, which is the one case where naming it would
  // be actively wrong. Named here rather than left to be noticed.
  const hoverBusy = () => Boolean(moveDrag || bandDrag || itemBox
    || dragging || twoPan || roomDrag || drawStart || rulerOn || brushOn
    || activeCut() || modalUp());
  const hideHoverName = () => { if (hoverName && !hoverName.hidden) hoverName.hidden = true; };
  canvas.addEventListener('pointermove', e => {
    if (!hoverName) return;
    if (e.pointerType === 'touch' || hoverBusy() || !drawing) { hideHoverName(); return; }
    const rect = canvas.getBoundingClientRect();
    const says = hitSays(hitAt(toWorld(e.clientX - rect.left, e.clientY - rect.top)));
    if (!says) { hideHoverName(); return; }
    hoverName.textContent = says;
    // BESIDE THE CURSOR, not under it, and flipped near the right edge so the
    // label never runs off the window it is meant to be read in.
    const pad = 14;
    hoverName.hidden = false;
    const w = hoverName.offsetWidth;
    const x = e.clientX + pad + w > window.innerWidth ? e.clientX - pad - w : e.clientX + pad;
    hoverName.style.left = `${Math.max(2, x)}px`;
    hoverName.style.top = `${Math.max(2, e.clientY + pad)}px`;
  });
  canvas.addEventListener('pointerleave', hideHoverName);
  canvas.addEventListener('pointerdown', hideHoverName);

  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') {
      touchPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      // THE SECOND FINGER TAKES THE GESTURE: whatever the first began (a box,
      // a pan, a grab not yet armed) is dropped, and the two pan together.
      if (touchPts.size === 2) {
        bandDrag = null;
        itemBox = null;
        moveDrag = null;
        dragging = null;
        const m = touchMid();
        twoPan = startPan(m.x, m.y);
        canvas.setPointerCapture(e.pointerId);
        paint();
        return;
      }
      if (touchPts.size > 2) return;
    }
    if (e.button === 2) {
      dragging = startPan(e.clientX, e.clientY, { pan: true });
      canvas.classList.add('dragging');
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    // THE LEFT BUTTON DRAWS. Nothing asked which button until now, so a
    // right-click placed a wall point on its way to opening a menu, and a
    // middle-click did whatever the left one would have. The contextmenu
    // handler above is the right button's verb; this is what stops it having
    // a second one.
    if (e.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    // AN ELEVATION ON SCREEN takes its own presses: LINE, ANNOTATION, and
    // Select on a mark. Anything else falls through as it always did.
    if (drawing && activeCut() && elevPress(e, rect)) return;
    const at = toWorld(e.clientX - rect.left, e.clientY - rect.top);
    // THE RULER TAKES THE PRESS BEFORE ANYTHING ELSE, because it is the one
    // instrument that must be usable ON TOP of whatever is being drawn: a
    // drafter measures between two corners of a wall he is halfway through
    // placing. It writes nothing to the drawing -- two presses and a number
    // on the strip -- so taking the press costs him no geometry.
    if (rulerOn) { rulerPress(at); return; }
    // AND THE BRUSH TAKES IT NEXT, for the ruler's own reason turned round:
    // it is an instrument whose entire gesture is a press on something that
    // is already drawn, so letting select or pan see the press first would
    // leave it nothing to act on. It goes AFTER the ruler because the ruler
    // writes nothing at all and this writes properties.
    if (brushOn) { brushPress(at); return; }
    // ARMED TAKES THE PRESS WHOLE, before the corner/body hit test and before
    // panning. Otherwise the first tap of a wall that starts on an existing
    // corner would be read as grabbing that corner, and the drafter would drag
    // the building instead of drawing against it.
    // #392's two placement tools, kept from main, and §1's wall gesture kept
    // from this branch. The conflict was only that both rewrote this dispatch:
    // main added COLUMN and BEAM beside a one-line wall case, and §1 replaced
    // that one line with the press/lift split. Neither claim is about the other.
    if (activeTool === 'column') { placeColumn(at); return; }
    if (activeTool === 'beam') { beamPress(at); return; }
    if (activeTool === 'roof') { if (shedRoof) { loopPress(at); return; } roofPress(at); return; }
    if (activeTool === 'dormer') { dormerPress(at); return; }
    if (activeTool === 'outline' || activeTool === 'floor' || activeTool === 'shape') { loopPress(at); return; }
    if (activeTool === 'fenestration') {
      // THE BRUSH'S LOAD GOES ONTO AN OPENING PRESSED, not beside it (Movie,
      // 20 Oct: "paste the properties of that door to another existing door
      // which the user would like to change"); bare wall takes a new one.
      brushWarnClear();
      if (brushHas('fenestration')) {
        const hit = brushHitAt(at);
        if (hit?.type === 'fenestration') { brushDust(hit); return; }
      }
      placeOpening(at);
      return;
    }
    if (activeTool === 'fixture') { fixturePress(at); return; }
    // preventDefault, or the press's own focus change lands after the handler
    // and takes the NAME box's focus straight back off it.
    if (activeTool === 'roomtag') { e.preventDefault(); placeRoomTag(at); return; }
    // STAIR, BY HAND (Movie, 25 Oct): the first step, then the way it runs
    // (stairHandPress). AUTO STAIR stays in its properties panel.
    if (activeTool === 'stair') { stairHandPress(at); return; }
    if (activeTool === 'cut') { cutPress(at); return; }
    if (activeTool === 'node') { superNodePress(at); return; }
    if (activeTool === 'stretch') { stretchPress(at); return; }
    if (activeTool === 'dimension') { dimPress(at); return; }
    if (activeTool === 'trim' || activeTool === 'extend') { trimPress(at, e, activeTool); return; }
    if (drawsRun()) {
      // §1: "either drag, or press again and drag -- both must work". The lift
      // needs two facts this press knows and pointerup does not: where the
      // finger went down, and whether this press OPENED the run. Without the
      // second, the PC click-click's second press would commit on the down and
      // then again on the up.
      wallPress = { x: e.clientX, y: e.clientY, opened: !drawStart,
        touch: e.pointerType === 'touch' || e.pointerType === 'pen' };
      // THE POINTER TYPE DECIDES WHICH HANDLER FIRES THE SHARED COMMIT, and
      // that split is §1's, not an invention: "for PC the line creation will
      // be normal pc method ... Touch gets the press-drag-lift."
      //
      // A MOUSE COMMITS ON THE DOWN -- click to set, move, click to place, and
      // the closing click must land the wall at the point clicked.
      //
      // A FINGER NEVER COMMITS ON THE DOWN. §1 requires press-again-and-drag
      // to reach the same wall as press-drag-lift; if the second touch
      // committed where it landed, the drag after it would be ignored and the
      // wall would end at the moment the finger arrived rather than where it
      // left. The lift below closes every touch run.
      if (wallPress.touch && drawStart) { paint(); return; }
      drawPress(at);
      return;
    }
    // A WINDOW MODE TAKES THE PRESS BEFORE THE PAN, and before the corner and
    // body tests too. Otherwise a box begun on a selected wall would grab that
    // wall instead, and the drafter would drag the building across the sheet
    // while trying to draw a box round it.
    if (activeTool === RESTING_TOOL && selectionMode !== 'click') {
      bandDrag = { from: at, to: at, sx: e.clientX, sy: e.clientY,
        active: false, shift: e.shiftKey };
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    // ── A WINDOW'S SIZE TAG TAKES THE PRESS ──────────────────────────────
    //
    // BEFORE THE CORNER AND THE BODY, and it costs them nothing: the tag is
    // painted OUTSIDE the wall, stepped off by the assembly's own half
    // thickness plus a gap, so the patch it claims is sheet that no corner,
    // opening or wall body occupies. It is also the last ink laid over that
    // patch, and on this sheet what is on top is what was painted last -- so
    // taking the press first is the pick agreeing with the picture.
    const sizeTag = windowTagAt(e.clientX - rect.left, e.clientY - rect.top);
    if (sizeTag) {
      // THE PRESS IS CLAIMED, and this line is the whole feature. A press on
      // a canvas moves focus by default, and that default lands AFTER the
      // handler -- so the box was created, focused, and then blurred out of
      // existence by the same press that asked for it. It appeared and left
      // within one frame, which reads exactly like a click that did nothing.
      e.preventDefault();
      editWindowSize(sizeTag);
      return;
    }
    // VERTEX BEFORE BODY — the old page's own precedence (_findVertexHit at
    // MODEL.dc.html:16791, then _findLineHit at :16799). A press near a corner
    // is a corner press even though it is also on the wall.
    // ── MOVING A ROOM TAG ────────────────────────────────────────────────
    // A SELECTED tag goes where it is dragged (Movie, 1 Oct: "the user should
    // be able to select it and move it"); the first click selects, as an
    // opening's does. Before the corner: a tag is painted over everything.
    // ── SLIDING A DIMENSION ROW IN OR OUT ────────────────────────────────
    // A SELECTED dimension takes its whole row with it, square to the line,
    // so the string stays straight and lined up (Movie, 6 Oct). The first
    // click selects, as a tag's does.
    const dimGrab = filterAllows('dimension') ? dimensionAt(at) : null;
    if (dimGrab && selection.some(entry => entry.item === dimGrab)) {
      const row = dimRow(dimGrab);
      moveDrag = {
        kind: 'dimrow', normal: dimNormal(dimGrab), grab: at,
        row: row.map(item => ({ item, before: { ...item }, start: { ...item.start }, end: { ...item.end } })),
        sx: e.clientX, sy: e.clientY, active: false,
      };
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    // ── MOVING A NOTE ──────────────────────────────────────────────────────
    // A selected note drags by its text, and the leader's tip stays on what
    // it points at -- the way a drafter moves a note clear of the linework.
    // Grabbed at the tip, only the tip moves, to point at something else. A
    // note with no leader moves whole.
    // ── MOVING LINES AND NOTES TOGETHER ─────────────────────────────────────
    // Several lines and notes selected -- an EDITABLE DXF just loaded, or a
    // window round some linework -- drag as one piece from any of them
    // (Movie, 10 Oct: a group "moves as one piece, notes included"). Walls
    // keep their own corner and body drags, so a selection with a wall in it
    // is not armed here.
    const movable = selection.length > 1
      && selection.every(entry => MOVE_TOGETHER.has(entry.type));
    if (movable) {
      const grabbed = noteAt(at) || lineAt(at);
      if (grabbed && selection.some(entry => entry.item === grabbed)) {
        moveDrag = {
          kind: 'items', grab: at, sx: e.clientX, sy: e.clientY, active: false,
          items: selection.map(({ type, item }) => ({ type, item, before: { ...item } })),
        };
        canvas.setPointerCapture(e.pointerId);
        return;
      }
    }
    const noteGrab = noteAt(at);
    if (noteGrab && selection.some(entry => entry.item === noteGrab)) {
      const tip = toS(noteGrab.anchor), here = toS(at);
      const part = noteGrab.end === 'none' ? 'whole'
        : Math.hypot(tip.x - here.x, tip.y - here.y) <= NOTE_TIP_GRAB_PX ? 'tip' : 'text';
      moveDrag = {
        kind: 'note', note: noteGrab, before: { ...noteGrab }, part,
        grab: at, anchor: { ...noteGrab.anchor }, text: { ...noteGrab.text },
        sx: e.clientX, sy: e.clientY, active: false,
      };
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    // ── A ROOM SHAPE'S CORNER (Movie, 23 Oct) ──────────────────────────
    // On the one picked tag: a corner drags; a corner that is a wall's node
    // asks first (the card); an edge's midpoint grows a corner and drags it.
    // AND A PICKED SHAPE'S OR FLOOR'S (Movie, 25 Oct: dragging corners, as a
    // wall's ends drag): the same handles, the same drag. Their corners are
    // plain points, never a wall's node or a link -- the format keeps a
    // floor's and a shape's corners as numbers.
    const loopKind = selection.length === 1 && ['roomtag', 'shape', 'floor'].includes(selection[0].type)
      && filterAllows(selection[0].type) && roomShapeOf(selection[0].item) ? selection[0].type : null;
    const shapedTag = loopKind ? selection[0].item : null;
    const handle = shapedTag ? roomHandleAt(shapedTag, at) : null;
    if (handle) {
      const pts = shapedTag.points;
      if (loopKind === 'roomtag' && handle.kind === 'corner' && wallsOnCorner(pts[handle.index]).length) {
        askRoomCorner(shapedTag, handle.index);
        return;
      }
      const before = { ...shapedTag, points: pts.slice() };
      let points = pts.slice();
      let index = handle.index;
      if (handle.kind === 'mid') {
        const q = pts[index], r = pts[(index + 1) % pts.length];
        points.splice(index + 1, 0, { x: (q.x + r.x) / 2, z: (q.z + r.z) / 2 });
        index += 1;
        shapedTag.points = points;
      }
      moveDrag = {
        kind: 'roomcorner', loopKind, tag: shapedTag, before, points, index,
        grab: at, sx: e.clientX, sy: e.clientY, active: false, moved: false,
      };
      canvas.setPointerCapture(e.pointerId);
      paint();
      return;
    }
    const tagGrab = roomTagAt(at);
    if (tagGrab && selection.some(entry => entry.item === tagGrab)) {
      moveDrag = {
        kind: 'roomtag', tag: tagGrab, before: { ...tagGrab },
        grab: at, from: { ...tagGrab.at },
        // THE SHAPE COMES WITH THE NAME, but a corner that is a wall's node
        // stays with the wall: the name is not a handle on the house.
        points: roomShapeOf(tagGrab) ? tagGrab.points.map(pt => ({ pt, free: !wallsOnCorner(pt).length })) : null,
        sx: e.clientX, sy: e.clientY, active: false,
      };
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    // ── MOVING A STAIR ────────────────────────────────────────────────────
    //
    // Movie, 15 Oct: "Stairs locked -- no move or drag". They were: a stair
    // could be picked and deleted and that was the whole of it, so a flight
    // the suggester parked down the middle of the house could only be taken
    // out and re-suggested into the same place.
    //
    // A FLIGHT IS TWO POINTS AND IT TRAVELS AS ONE. start is the top nosing
    // and end fixes the downhill direction, so moving both by the same delta
    // keeps the run, the bearing, the shape and the turn -- a stair that is
    // moved is the same stair somewhere else, which is what a drag means.
    //
    // WITH THE OTHER SELECTED-OBJECT DRAGS, BEFORE THE CORNER, which is this
    // page's own order for them (dimrow, note and roomtag all sit above it):
    // the branch is reachable ONLY for a stair already selected, so a press on
    // a chosen flight tearing a wall corner out from under it would be the
    // page answering a gesture nobody made. The pick chain's own precedence
    // (wall and line BEFORE stair) is untouched -- it decides what the first
    // click selects, and nothing can be dragged here that it did not choose.
    const stairGrab = filterAllows('stair') ? stairAt(at) : null;
    if (stairGrab && selection.some(entry => entry.item === stairGrab)) {
      const well = stairWellOf(stairGrab);
      moveDrag = {
        kind: 'stair', stair: stairGrab, before: { ...stairGrab },
        grab: at, start: { ...stairGrab.start }, end: { ...stairGrab.end },
        well: well.hole, wellBefore: well.hole ? { ...well.hole } : null,
        wellPoints: well.hole ? well.hole.points.map(pt => ({ x: pt.x, z: pt.z })) : null,
        shared: well.shared,
        framing: stairFramingOf(stairGrab),
        sx: e.clientX, sy: e.clientY, active: false,
      };
      moveDrag.framingBefore = [...moveDrag.framing.beams, ...moveDrag.framing.columns].map(item => ({ item, before: { ...item } }));
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    const corner = cornerAt(at);
    // ── SLIDING AN OPENING ALONG ITS WALL ────────────────────────────────
    //
    // The third of the three Movie asked for: "i'll change them if i need to
    // afterwards". Place, take out, and now MOVE -- which is what "change"
    // most often means about a window that is a foot off.
    //
    // AFTER THE CORNER AND BEFORE THE WALL BODY, which is the same order the
    // pick chain keeps: a vertex beats what runs through it, and an opening
    // beats the wall it is cut into. In practice a corner and an opening
    // cannot be in the same place -- the bearing reserve keeps an opening off
    // both ends of its wall -- so the corner half is a rule stated rather
    // than a conflict resolved.
    const slide = corner ? null : openingBodyAt(at);
    if (slide) {
      const host = walls().find(wall => String(wall.id) === String(slide.wallId));
      if (host) {
        moveDrag = {
          kind: 'opening', opening: slide, host,
          // THE OFFSET IT STARTED AT, for the undo. One number, because that
          // is the whole of what a slide changes: an opening is a width and
          // an offset along a wall, and nothing else about it moves.
          was: slide.offset,
          live: liveRedimBegin(),
          sx: e.clientX, sy: e.clientY, active: false,
        };
        canvas.setPointerCapture(e.pointerId);
        return;
      }
    }
    // ── SLIDING A FIXTURE, MOVING AN ISLAND (Movie, 20 Oct) ──────────────
    // After the opening, before the wall body, for the opening's reason: a
    // fixture already in the selection is a grab, and it beats the wall it
    // stands against. fixtureMoveBegin / fixtureMoveTo say what moves.
    const fixtureGrab = corner || slide ? null : fixtureBodyAt(at);
    if (fixtureGrab) {
      const held = fixtureMoveBegin(fixtureGrab, at);
      if (held) {
        moveDrag = { kind: 'fixture', ...held, links: fixtureLinks(held.fixture), sx: e.clientX, sy: e.clientY, active: false };
        canvas.setPointerCapture(e.pointerId);
        return;
      }
    }
    const body = corner ? null : segmentBodyAt(at);
    if (corner || body) {
      // A grabbed corner or wall takes the gesture whole: no pan starts, so
      // the sheet cannot slide out from under geometry being placed.
      // A RIGID ASSEMBLY MOVES WHOLE, and until now this page wrote that it
      // was rigid and then ignored it. createAssembly stamps `fixed` and
      // `stretchBehavior: 'rigid'` (:6573) and NOTHING READ EITHER -- so a
      // drafter who ticked "stays rigid" got a group whose walls still moved
      // one at a time, and the tick did nothing at all.
      //
      // This is the gesture the level-lock port needs: MODEL.dc.html gates the
      // lock on `sd.rigid && sd.group` (:7059), a drag armed only when a node
      // of a rigid assembly is grabbed (:11142). Without it applyLevelLockDelta
      // would be a function with no caller, which the order forbids for the
      // same reason the propagation port had to arrive with its drag.
      //
      // A CORNER PRESS STILL TAKES THE CORNER. Reshaping one node of a rigid
      // assembly is a different question from moving it, and it is not this
      // order's to answer -- MODEL.dc.html refuses that press outright
      // (:10956) and this page has never refused it. Left as it was rather
      // than changed in passing.
      const rigidGroup = (!corner && body)
        ? groups().find(g => g?.fixed === true
            && (g.members || []).some(m => m.type === 'wall'
              && String(m.id) === String(body.id)))
        : null;
      if (rigidGroup) {
        // EVERY POINT ONCE, through the module, for the reason uniquePoints
        // exists: a corner shared by two walls of this assembly is one object,
        // and moving it twice tears the assembly at its own corners.
        const pts = window.DraftLevelLock.uniquePoints(
          itemsOfGroupAnywhere(rigidGroup));
        moveDrag = {
          kind: 'group', body, group: rigidGroup, grab: at, slide: anchorSlide(rigidGroup),
          before: pts.map(v => ({ vtx: v, x: v.x, z: v.z, offX: v.offX, offZ: v.offZ })),
          // THE SIBLINGS GO IN THE UNDO SNAPSHOT TOO, taken here at arm time
          // while nothing has moved yet. Undo restores from `before`, and a
          // snapshot holding only the assembly the drafter grabbed would put
          // that one back and leave every floor the lock carried sitting where
          // the drag left it -- one Ctrl+Z, two buildings, no longer locked to
          // each other in fact while the file still says they are.
          lockBefore: levelLockSiblings(rigidGroup).flatMap(sib =>
            window.DraftLevelLock.uniquePoints(itemsOfGroupAnywhere(sib))
              .map(v => ({ vtx: v, x: v.x, z: v.z, offX: v.offX, offZ: v.offZ }))),
          sx: e.clientX, sy: e.clientY, active: false,
        };
        canvas.setPointerCapture(e.pointerId);
        return;
      }
      const ends = corner ? [corner] : movingEnds(body);
      const before = ends.map(v => ({ vtx: v, x: v.x, z: v.z, offX: v.offX, offZ: v.offZ }));
      moveDrag = {
        kind: corner ? 'corner' : 'wall',
        // The wall itself, not just its moving ends: §3's constraint call
        // needs the run to know which way perpendicular is.
        body,
        grab: at,
        before,
        // A ONE-ANCHOR ASSEMBLY ON A CORNER IN HAND rides it (anchorFollowers).
        follow: anchorFollowers(before, corner ? null : body),
        sx: e.clientX, sy: e.clientY, active: false,
      };
      // ALT ONLY (Movie, 26 Oct): CTRL held is snapping off now.
      if (corner && e.altKey && board !== 'toy') detachCorner(moveDrag, corner);
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    // THE RING GOES WITH THE CLASSES. This runs when a press takes the
    // gesture: a highlight left burning under a wall being dragged says "you
    // could grab this" about a corner already in hand.
    canvas.classList.remove('over-corner', 'over-wall');
    if (hoverCorner) { hoverCorner = null; paint(); }
    dragging = startPan(e.clientX, e.clientY);
    // WITH SELECT IN HAND THE DRAG IS A BOX, not a pan (Movie, 4 Oct). A press
    // that never travels is still the click below; the box arms at the same
    // 4px a corner drag does.
    if (activeTool === RESTING_TOOL || activeTool === 'assembly') {
      itemBox = { from: at, to: at, active: false };
      dragging.box = itemBox;
    } else {
      canvas.classList.add('dragging');
    }
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (drawing && activeCut() && (elevLineStart || elevPointerTip)) elevMove(e);
    if (e.pointerType === 'touch' && touchPts.has(e.pointerId)) {
      touchPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (twoPan && touchPts.size >= 2) {
        const m = touchMid();
        if (panElev(twoPan, m.x - twoPan.sx, m.y - twoPan.sy)) return;
        view.cx = twoPan.cx - (m.x - twoPan.sx) / view.scale;
        view.cz = twoPan.cz - (m.y - twoPan.sy) / view.scale;
        paint();
        return;
      }
    }
    if (twoPan) return;
    if (bandDrag) {
      // The same 4px arm the corner drag uses: under that it is a click, and a
      // one-pixel box that selects nothing is indistinguishable from a tap
      // that missed.
      if (!bandDrag.active
        && Math.hypot(e.clientX - bandDrag.sx, e.clientY - bandDrag.sy) > DRAG_ARM_PX) {
        bandDrag.active = true;
      }
      const rect = canvas.getBoundingClientRect();
      bandDrag.to = toWorld(e.clientX - rect.left, e.clientY - rect.top);
      if (bandDrag.active) paint();
      return;
    }
    if (moveDrag) {
      const md = moveDrag;
      if (!md.active && Math.hypot(e.clientX - md.sx, e.clientY - md.sy) > DRAG_ARM_PX) {
        md.active = true;
        // §4: unshare any corner this wall shares with a COLLINEAR neighbour,
        // before the first delta lands, so the connector grows with the drag
        // instead of appearing at the end of it.
        splitRunCorners(md);
      }
      if (md.active) {
        const rect = canvas.getBoundingClientRect();
        const raw = toWorld(e.clientX - rect.left, e.clientY - rect.top);
        if (md.kind === 'dimrow') {
          // SQUARE TO THE LINE ONLY, in 3" steps: the row slides nearer or
          // farther and never along itself. New points each event, as the
          // tag's are, so the undo step keeps the ones it started with.
          const n = md.normal;
          const by = Math.round(((raw.x - md.grab.x) * n.x + (raw.z - md.grab.z) * n.z) * 4) / 4;
          md.row.forEach(({ item, start, end }) => {
            item.start = { ...start, x: start.x + n.x * by, z: start.z + n.z * by };
            item.end = { ...end, x: end.x + n.x * by, z: end.z + n.z * by };
          });
          md.by = by;
          paint();
          return;
        }
        if (md.kind === 'items') {
          // New points each event from the ones each item started with, so
          // the undo step's copies keep the points they were taken with.
          let dx = raw.x - md.grab.x, dz = raw.z - md.grab.z;
          // BY THE FOOT with the 1' light lit, as an assembly goes.
          const Q = window.DraftToyConstraints;
          if (footOn && Q) { dx = Q.quantiseFeet(dx); dz = Q.quantiseFeet(dz); }
          const by = p => ({ ...p, x: p.x + dx, z: p.z + dz });
          md.items.forEach(({ type, item, before }) => {
            if (type === 'line') { item.start = by(before.start); item.end = by(before.end); }
            if (type === 'note') { item.anchor = by(before.anchor); item.text = by(before.text); }
          });
          md.moved = Math.abs(dx) > 1e-9 || Math.abs(dz) > 1e-9;
          paint();
          return;
        }
        if (md.kind === 'note') {
          // New points each event, as for a tag: the undo step holds the old.
          const dx = raw.x - md.grab.x, dz = raw.z - md.grab.z;
          const by = p => ({ x: p.x + dx, z: p.z + dz });
          if (md.part !== 'tip') md.note.text = by(md.text);
          if (md.part !== 'text') md.note.anchor = by(md.anchor);
          paint();
          return;
        }
        if (md.kind === 'roomcorner') {
          // ONTO A WALL'S NODE when one is in reach -- the node's own object,
          // which is what links the corner to it -- else to the hand, by the
          // foot with the 1' light lit. A NEW ARRAY EACH EVENT, never the old
          // one edited: the undo step holds the corners the drag began with.
          const Q = window.DraftToyConstraints;
          let x = raw.x, z = raw.z;
          if (footOn && Q) { x = Q.quantiseFeet(x); z = Q.quantiseFeet(z); }
          // A WALL'S NODE TAKES THE CORNER AS ITSELF; a face corner (the
          // inside corner of two walls, say) takes it at its offset from the
          // nearest wall end, so the floor follows that wall too.
          // THE NEARER OF THE TWO WINS (Movie, 25 Oct: "i had a hard time
          // getting the flooring area shape to locate exactly onto the inside
          // corner"): the wall's centre node used to be asked first, so a
          // corner taken into an inside corner went to the middle of the wall
          // a couple of inches away whenever the node was in reach too.
          // ONE SNAPPING RULE (Movie, 26 Oct): a node from 2", a face corner
          // from 1 1/2", each held between 4 and 30 px on the screen, with the
          // circle on what it will take (paintSnapNode).
          const caught = window.DraftGeometry2D.nearestVertex(snapCandidates([md.points[md.index]]), raw, reachFt(NODE_REACH));
          const face = window.DraftGeometry2D.nearestVertex(wallFaceNodes(), raw, reachFt(CORNER_REACH));
          const far = q => (q ? Math.hypot(q.x - raw.x, q.z - raw.z) : Infinity);
          let pt;
          if (face && far(face) < far(caught)) {
            const link = roomLinkAt(face);
            pt = { x: face.x, z: face.z, ...(link ? { link } : {}) };
          } else pt = caught || { x, z };
          md.lit = face && far(face) < far(caught) ? { pt: { x: face.x, y: 0, z: face.z }, corner: face, node: false }
            : caught ? { pt: { x: caught.x, y: 0, z: caught.z }, corner: caught, node: true } : null;
          // A SHAPE'S OR FLOOR'S CORNER TAKES THE NUMBERS ONLY: no node, no link.
          if (md.loopKind !== 'roomtag') pt = md.loopKind === 'floor' ? { x: pt.x, y: 0, z: pt.z } : { x: pt.x, z: pt.z };
          md.points = md.points.map((p, i) => (i === md.index ? pt : p));
          md.tag.points = md.points;
          md.moved = true;
          paint();
          return;
        }
        if (md.kind === 'roomtag') {
          // A NEW POINT EACH EVENT, never the old one edited: the undo step
          // holds the point the tag started at, and it must stay that point.
          const dx = raw.x - md.grab.x, dz = raw.z - md.grab.z;
          md.tag.at = { x: md.from.x + dx, z: md.from.z + dz };
          // INSIDE ITS OWN FLOOR THE NAME MOVES ALONE (Movie, 23 Oct: "allow
          // the ROOM TAG to be moved around within the 'flooring' area without
          // changing the flooring"): the shape stays exactly as it was. Only a
          // shape no wall holds a corner of is carried, and only once the name
          // leaves it -- a tag square being taken to its room.
          const inside = !md.points || (() => {
            const ring = md.points.map(({ pt }) => pt), p = md.tag.at;
            let hit = false;
            for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
              const a = ring[i], b = ring[j];
              if ((a.z > p.z) !== (b.z > p.z) && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) hit = !hit;
            }
            return hit;
          })();
          const carry = !!md.points && !inside && md.points.every(({ free }) => free);
          if (md.points) md.tag.points = md.points.map(({ pt }) => (carry ? { x: pt.x + dx, z: pt.z + dz } : pt));
          paint();
          return;
        }
        if (md.kind === 'stair') {
          // NEW POINTS EACH EVENT, measured from where each one started and
          // never edited in place -- the undo step holds the objects the drag
          // began with, which is the discipline every branch above keeps and
          // the only thing that makes one Ctrl+Z put the flight back.
          //
          // BY THE DELTA, absolutely from the grab, for the wall branch's
          // reason: both points travel exactly the same distance rather than
          // the same distance to within the drift of a hundred events -- and a
          // flight whose two ends drift apart is a flight whose run and
          // bearing have quietly changed.
          let dx = raw.x - md.grab.x, dz = raw.z - md.grab.z;
          // WITH THE FOOT LIGHT LIT THE FOOT IS THE SNAP, per axis, exactly as
          // the wall drag does it -- quantiseFeet reached rather than rounding
          // written here again.
          const Q = window.DraftToyConstraints;
          if (footOn && Q) { dx = Q.quantiseFeet(dx); dz = Q.quantiseFeet(dz); }
          md.stair.start = { x: md.start.x + dx, z: md.start.z + dz };
          md.stair.end = { x: md.end.x + dx, z: md.end.z + dz };
          // AND ON TO A WALL'S INSIDE FACE when its side comes within reach
          // (Movie, 18 Oct), the well going the same way.
          const snap = stairFaceSnap(md.stair);
          if (snap) {
            dx += snap.frame.n.x * snap.shift;
            dz += snap.frame.n.z * snap.shift;
            md.stair.start = { x: md.start.x + dx, z: md.start.z + dz };
            md.stair.end = { x: md.end.x + dx, z: md.end.z + dz };
          }
          // THE WELL TRAVELS WITH THE FLIGHT, by the same delta rather than
          // re-cut from the moved stair: the hole's LENGTH comes from headroom
          // and may have been nudged or drawn wider than the run, and re-
          // deriving it would silently replace the drafter's hole with the
          // suggester's. A NEW ARRAY each event, for the reason above -- the
          // undo copy holds the array the drag started with.
          if (md.well) {
            md.well.points = md.wellPoints.map(pt => ({ x: pt.x + dx, z: pt.z + dz }));
          }
          // ITS FRAMING BY THE SAME DELTA, from where each piece started.
          md.framingBefore.forEach(({ item, before }) => {
            const by = p => ({ ...p, x: p.x + dx, z: p.z + dz });
            if (item.point) item.point = by(before.point);
            else { item.start = by(before.start); item.end = by(before.end); }
          });
          md.moved = Math.abs(dx) > 1e-9 || Math.abs(dz) > 1e-9;
          paint();
          return;
        }
        if (md.kind === 'fixture') { fixtureMoveTo(md, raw); carryFixtureLinks(md); paint(); return; }
        if (md.kind === 'opening') {
          const G = window.DraftGeometry2D;
          const wall = md.host;
          const dx = wall.end.x - wall.start.x, dz = wall.end.z - wall.start.z;
          const length = Math.hypot(dx, dz);
          // ALONG THE WALL, AND ONLY ALONG IT. The pointer is projected onto
          // the wall's own axis, so the opening tracks the finger down the
          // wall and ignores everything across it -- which is the only motion
          // an opening HAS. A drag that read the raw point would need the
          // drafter to trace a 6" strip to move a window three feet.
          const along = ((raw.x - wall.start.x) * dx + (raw.z - wall.start.z) * dz)
            / (length * length) * length;
          // CLAMPED EVERY EVENT, not checked at the end. The clamp is what
          // keeps the bearing under the lintel, and an opening allowed to run
          // off the end and be pulled back on release would be a drawing that
          // was briefly impossible -- and would stay impossible if the drag
          // ended off-canvas.
          const clamped = G.clampOpeningToWall(wall, along, md.opening.width, {
            walls: walls(),
            thicknessFt: openingThicknessFt(),
          });
          if (clamped && clamped.offset !== md.opening.offset) {
            md.opening.offset = clamped.offset;
            liveRedimStep(md.live);
          }
          paint();
          return;
        }
        if (md.kind === 'group') {
          // THE ASSEMBLY MOVES BY THE DELTA, measured absolutely from the
          // grab for the same reason the wall branch below does it: every
          // point travels exactly the same distance, rather than the same
          // distance to within the float drift of a hundred pointermove
          // events. Each point is written from its OWN start, so the assembly
          // keeps its shape no matter how many events the drag took.
          let dx = raw.x - md.grab.x, dz = raw.z - md.grab.z;
          // HELD SQUARE BY THE T-SQUARE, the MOVE verb's rule: the larger
          // travel wins.
          // TWO ANCHORS ON A LINE: along it only, like a window (anchorSlide).
          if (md.slide) ({ dx, dz } = slideDelta(md.slide, dx, dz));
          else if (tsquareOn && board !== 'toy') { if (Math.abs(dx) >= Math.abs(dz)) dz = 0; else dx = 0; }
          // AND BY THE FOOT with the 1' light lit, the MOVE verb's rule
          // (Movie, 20 Oct: "make it work for when i moved grouped stuff too").
          const Q = window.DraftToyConstraints;
          if (footOn && Q && !md.slide) { dx = Q.quantiseFeet(dx); dz = Q.quantiseFeet(dz); }
          md.before.forEach(b => { b.vtx.x = b.x + dx; b.vtx.z = b.z + dz; });
          md.before.forEach(b => relinkVertex(b.vtx));
          // THE LOCKED SIBLINGS DO NOT MOVE HERE. They move ONCE, on the
          // release, by the drag's TOTAL displacement -- which is what
          // MODEL.dc.html does (:7059, inside the pointerup handler at :6973,
          // with `sd.anchor.x - sd.starts.get(sd.anchor).x`).
          //
          // Worth naming, because the call site reads like a move handler and
          // was read as one: the delta DC passes is the total from the drag's
          // start, so calling it per pointermove would translate the siblings
          // by the whole distance again on every event and run them away
          // exponentially. Release is not a style choice there, it is what
          // that delta means.
          paint();
          return;
        }
        if (md.kind === 'corner') {
          // The corner goes TO the cursor, not by the cursor's delta — the old
          // page's node drag writes the point through (MODEL.dc.html:10848),
          // so a corner grabbed off-centre still lands under the pointer.
          //
          // ── THE INSTRUMENTS READ ON A POINT DRAG TOO ──────────────────────
          //
          // Movie: "dragging a point ignores the T-square and 1' snap". It did,
          // and only here: a run being DRAWN goes through drawPoint, which
          // squares it, projects the corner snap onto the axis and rounds the
          // whole foot. A point being DRAGGED went through cornerSnap and
          // nothing else, so the same two lit instruments governed where a
          // corner could be PUT and said nothing about where it could be
          // MOVED -- a drafter who squared a wall to draw it could pull it off
          // square a minute later with the T-square still down.
          //
          // SO THIS IS drawPoint's OWN ORDER, with the corner's starting place
          // as the `from` that a drawn run takes from drawStart. Reached
          // through the same three helpers rather than re-derived: square,
          // then the snap (axis-projected while squaring, so the squared
          // coordinate is kept exactly), then the foot if no real corner was
          // caught.
          //
          // THE SNAP STILL BEATS THE FOOT, which is drawPoint's rule and its
          // reason: "a snap that lands on a real corner is the one case where
          // the foot gives way -- the corner is where the geometry actually
          // joins". A corner caught and then rounded off again would be a snap
          // the drafter saw take and then saw let go.
          //
          // WITH NEITHER INSTRUMENT LIT THIS IS WHAT IT ALWAYS WAS: `wanted` is
          // `raw`, `fixed` is null, and the line below is
          // cornerSnap(raw, vtx) || raw.
          //
          // THE LIT INSTRUMENTS, NOT squaring() AND onTheFoot_if(). Those two
          // answer "is this run being held square / rounded", and BOTH carry
          // `board === 'toy'` as well as the switch -- which is right for a
          // run being DRAWN, where TOY's four directions are the board's own
          // rule. A corner DRAG on TOY has never been squared: toy-constraints
          // governs what moves there, and model-html-save.spec.js's bone-built
          // fixture drags a corner 90 across and 50 down and expects both to
          // land. Squaring that by the board would be this fix leaking into
          // TOY -- the same leak in the other direction that §3's gate is
          // written against -- so the gate here is the drafter's switch and
          // nothing else. Whether TOY should square a dragged corner is a
          // question for the board, not for this bug.
          const grabbed = md.before[0];
          const from = { x: grabbed.x, z: grabbed.z };
          const wanted = tsquareOn ? squareTo(from, raw) : raw;
          const fixed = tsquareOn ? squaredAxis(from, raw) : null;
          // THE MAGNET ON A DRAG TOO, with SNAP lit off TOY: the corners and
          // faces of every wall the node does not belong to.
          const magnet = snapLive() && board !== 'toy' ? (md.magnet ||= dragMagnet(grabbed.vtx)) : null;
          const hit = fixed
            ? axisMagnet(wanted, fixed, grabbed.vtx, magnet)
            : dragMagnetAt(wanted, grabbed.vtx, magnet);
          md.lit = hit;
          md.cursor = raw;
          // THE CURSOR READS THROUGH THE DRAG: the pointermove below this
          // branch never runs while an end is held, so the rays' "in line
          // with the hand" (litRays) read a cursor left where the press was.
          cursorWorld = raw;
          const snapped = hit?.pt || null;
          // THE CROSS LINES PULL TOO (Movie, 22 Oct), when no node or face has
          // caught and the square is not holding an axis: the end lands on
          // the line through whichever corner it is in line with -- the
          // inside corner of the room it is being trimmed to, as often as
          // not -- off the magnet's own corners (trackingNodes), never the
          // dragged wall's own, which travel with the hand.
          const tracked = !snapped && !fixed && board !== 'toy'
            ? trackSnap(wanted, [], (md.rays ||= dragMagnet(grabbed.vtx).corners)) : null;
          // MIN 0 FEET, not the drawn run's 1: a nudge of less than half a foot
          // rounds back to where the corner started, and a corner that stayed
          // put is the honest answer to a hand that barely moved.
          // THE CROSS LINE KEEPS ONLY THE AXIS IT WON; the foot still rounds
          // the other (the body drag's own rule: "the catch keeps the across
          // it won; the along is rounded"), so a 2.4 ft pull along a line
          // some corner shares still lands on the foot.
          const footed = footOn ? onTheFoot(from, { x: wanted.x, z: wanted.z }, 0) : wanted;
          const landed = snapped || (tracked
            ? { x: tracked.rays.some(r => r.axis === 'x') ? tracked.pt.x : footed.x,
              z: tracked.rays.some(r => r.axis === 'z') ? tracked.pt.z : footed.z }
            : footed);
          // AND WITHIN AN INCH OF A LINE THE RUN CROSSES, THE END IS ON IT
          // (inchJoin): a catch that beats the foot, as every catch does.
          const joined = board !== 'toy'
            ? inchJoin(grabbed.vtx, landed, (md.segs ||= dragMagnet(grabbed.vtx).segs)) : null;
          const pt = joined ? joined.pt : landed;
          grabbed.vtx.x = pt.x;
          grabbed.vtx.z = pt.z;
          // ON A FIXTURE'S HALF-INCH CORNER, THE WALL'S FACE GOES THERE, a
          // loose far end stepping across with it -- from where it stood when
          // the drag began, so a hand that moves off the corner puts it back.
          // THE WALL IS THE ONE THIS END BELONGS TO: a press on a corner arms
          // with no body, so it is found -- and only when there is one wall.
          const own = md.body && walls().includes(md.body) ? md.body
            : (() => { const at = walls().filter(w => w.start === grabbed.vtx || w.end === grabbed.vtx); return at.length === 1 ? at[0] : null; })();
          if (board !== 'toy' && own) {
            const other = own.start === grabbed.vtx ? own.end : own.start;
            if (md.faceFrom === undefined) {
              md.faceFrom = looseEnd(other, own) ? { x: other.x, z: other.z } : null;
              if (md.faceFrom) md.faceBefore = [{ vtx: other, x: other.x, z: other.z, offX: other.offX, offZ: other.offZ }];
            }
            const shift = faceOntoGap(own, grabbed.vtx, { otherFrom: md.faceFrom });
            if (!shift && md.faceFrom) { other.x = md.faceFrom.x; other.z = md.faceFrom.z; relinkVertex(other); }
          }
          // THE DOORS AND WINDOWS ON THE WALLS THIS END BELONGS TO STAY PUT.
          if (board !== 'toy') keepOpeningsPut(md, grabbed);
        } else {
          // A WALL MOVES BY THE DELTA, and the delta is measured from where
          // the press landed to where the cursor is now — never accumulated
          // move to move. Absolute is what makes "both ends travelled the same
          // distance" exactly true, rather than true to within the float drift
          // of a hundred pointermove events.
          let dx = raw.x - md.grab.x, dz = raw.z - md.grab.z;
          // SHIFT HELD: the wall goes on its own, its corners let go.
          if (board !== 'toy') setWallLoose(md, e.shiftKey);
          // THE T-SQUARE HOLDS A MOVED WALL SQUARE (Movie, 18 Oct: "i like how
          // the walls move, but when the T is on they should stay moving 90
          // degrees it is free moving right now but the T is on"). The wall
          // slides across its own run only, so the walls meeting its ends
          // stretch along their own lines and stay at 90.
          if (tsquareOn && board !== 'toy' && md.body?.start && md.body?.end) {
            const ux = md.body.end.x - md.body.start.x, uz = md.body.end.z - md.body.start.z;
            const len = Math.hypot(ux, uz);
            if (len > 1e-6) {
              const nx = -uz / len, nz = ux / len, across = dx * nx + dz * nz;
              dx = nx * across; dz = nz * across;
            }
          }
          // §3: ON THE TOY BOARD THE MOVE IS toy-constraints.js's TO DECIDE.
          // Not a second constraint path -- the page proposes a distance and
          // allowedMove rounds it, welds the group, refuses what it must and
          // says why. DRAFTING keeps wallSnapDelta exactly as it was.
          const toy = board === 'toy' ? toyWallDelta(md, dx, dz) : null;
          // THE FACES SEEK, after the ends' own corner snap and before the
          // foot: a face that catches beats the foot, the corner drag's own
          // rule ("a snap that lands on a real corner is the one case where
          // the foot gives way").
          const ends = !toy && !footOn ? wallSnapDelta(md.before, dx, dz) : null;
          const seek = !toy && !ends && snapLive() ? wallFaceSeek(md, dx, dz) : null;
          md.lit = seek ? seek.lit : null;
          md.cursor = raw;
          if (toy) { dx = toy.dx; dz = toy.dz; }
          else if (ends) { dx = ends.dx; dz = ends.dz; }
          else if (seek) {
            dx = seek.dx; dz = seek.dz;
            // AND THE OTHER AXIS STILL LANDS ON THE FOOT (Movie, 20 Oct: "the
            // 1' thing works when i change the wall lengths though i just
            // noticed but not moving walls side to side"). A face catches
            // ACROSS the run and the travel ALONG it is the hand's -- and in
            // a house a parallel face nearly always catches, so with the
            // light lit the wall slid wherever the hand stopped along its
            // run. The catch keeps the across it won; the along is rounded.
            if (footOn) { const q = footAlongRun(md.body, dx, dz); dx = q.dx; dz = q.dz; }
          }
          else if (footOn) {
            // THE FOOT LIGHT'S DRAG, and it is NOT the TOY path with a
            // different name. toyWallDelta discards the along-run component,
            // welds the group and refuses a move that would leave a
            // neighbour on an angle -- all correct for TOY and all wrong
            // here, because acceptance 6 says DRAFTING's other freedoms are
            // untouched. The light rounds DISTANCE. That is the whole of it.
            //
            // quantiseFeet is toy-constraints.js's own `round(d/step)*step`,
            // reached rather than copied: the order says if you find yourself
            // writing rounding code you are in the wrong function.
            //
            // PER AXIS, because a free drag has two components and the wall
            // must land a whole foot in each. Quantising the MAGNITUDE and
            // keeping the bearing would move an axis-aligned wall a whole
            // foot -- the same answer -- but leave a diagonal drag's ends on
            // no foot at all, which is the opposite of what the light says.
            //
            // It replaces wallSnapDelta rather than running after it, the way
            // the TOY arm replaces it: with the light lit the foot IS the
            // snap, and rounding a corner snap afterwards would pull the wall
            // back off the corner it had just caught.
            const Q = window.DraftToyConstraints;
            if (Q) { dx = Q.quantiseFeet(dx); dz = Q.quantiseFeet(dz); }
          }
          md.before.forEach(b => { b.vtx.x = b.x + dx; b.vtx.z = b.z + dz; });
        }
        // Live, on every move, exactly where the old page relinks — not once
        // on release. The two agree at the end of a completed drag; they part
        // company on a drag the browser cancels mid-gesture, and matching the
        // old page is the point.
        followAnchors(md.follow);
        md.before.forEach(b => relinkVertex(b.vtx));
        (md.follow || []).forEach(f => relinkVertex(f.vtx));
        paint();
      }
      return;
    }
    if (!dragging) {
      // HOVER HINT. The handles are 8px squares and the grab zone is 30, so
      // without this there is nothing on screen telling a drafter where the
      // corner tool starts and the pan ends — and now the same for the body of
      // a selected wall, whose grab zone has no marks on it at all.
      const rect = canvas.getBoundingClientRect();
      const at = toWorld(e.clientX - rect.left, e.clientY - rect.top);
      // The instruments read the cursor, which is what makes them
      // instruments: length and angle are live while the run is in hand and
      // blank when it is not, exactly as the old strip behaves.
      // LET GO OF SHIFT, THE FIRST REAL MOVE FREES THE CURSOR (refPoint);
      // UNLOCKED, THE NODE UNDER IT IS THE ONE SHIFT WILL LINE UP ON.
      if (refLock?.released && cursorWorld && Math.hypot(at.x - refLock.at.x, at.z - refLock.at.z) * view.scale > 6) dropRefLock();
      if (!refLock && REF_TOOLS.has(activeTool) && board !== 'toy') {
        const node = snapNodeAt(at);
        if (node) refHover = { x: node.x, z: node.z };
      }
      cursorWorld = at;
      pointerScreen = { x: e.clientX, y: e.clientY, type: e.pointerType };
      stripRefresh();
      const corner = cornerAt(at);
      canvas.classList.toggle('over-corner', !!corner);
      canvas.classList.toggle('over-wall', !corner && !!segmentBodyAt(at));
      // REPAINT ONLY WHEN THE ANSWER CHANGES, and identity is what decides:
      // cornerAt hands back the POOLED VERTEX OBJECT, so `!==` is "a different
      // corner", not "different numbers". A pointermove fires on every pixel
      // and this branch is the page's hot path -- repainting on each one would
      // put a full canvas redraw behind a mouse sweep across the sheet, which
      // is the cost the rail's one-seat-per-frame rule exists to avoid.
      //
      // Entering a corner, leaving it, and crossing straight from one to its
      // neighbour are all the same test, which is why it is one line.
      if (corner !== hoverCorner) { hoverCorner = corner; paint(); }
      // AND THE ONE EXCEPTION TO THE RULE ABOVE -- see previewTracksCursor.
      // `else`, so a move that crossed a corner boundary paints ONCE: the
      // branch above has already done it.
      else if (previewTracksCursor()) paint();
      // AND WHEN THE SNAP UNDER THE CURSOR CHANGES, with no run in hand yet:
      // the orange donut has to come and go over a node before the first
      // press, and nothing else repaints there.
      else if (drawsRun() || activeTool === 'outline' || activeTool === 'node') {
        const snap = drawSnap(at);
        const key = snap.pt ? `${snap.pt.x},${snap.pt.z},${snap.node ? 'n' : snap.bullseye ? 'b' : 'r'}` : '';
        if (key !== lastSnapKey) { lastSnapKey = key; paint(); }
      }
      // AND WITH MOVE ARMED, when what the hand would catch changes, or the
      // hand has gone a few pixels -- the faint glow around it follows at
      // that grain, not per pixel.
      else if (moveState?.on && !moveState.drag && selection.length) {
        const lit = moveHover()?.lit;
        const key = lit ? `${lit.pt.x},${lit.pt.z},${tierOf(lit)}` : '';
        const far = !moveHoverAt || Math.hypot(at.x - moveHoverAt.x, at.z - moveHoverAt.z) * view.scale > 6;
        if (key !== lastSnapKey || far) { lastSnapKey = key; moveHoverAt = at; paint(); }
      }
      return;
    }
    dragging.moved = Math.max(dragging.moved,
      Math.hypot(e.clientX - dragging.sx, e.clientY - dragging.sy));
    if (dragging.box) {
      const rect = canvas.getBoundingClientRect();
      dragging.box.to = toWorld(e.clientX - rect.left, e.clientY - rect.top);
      if (dragging.moved > DRAG_ARM_PX) dragging.box.active = true;
      if (dragging.box.active) paint();
      return;
    }
    if (panElev(dragging, e.clientX - dragging.sx, e.clientY - dragging.sy)) return;
    view.cx = dragging.cx - (e.clientX - dragging.sx) / view.scale;
    view.cz = dragging.cz - (e.clientY - dragging.sy) / view.scale;
    paint();
  });
  const endDrag = e => {
    if (e && e.pointerType === 'touch') {
      touchPts.delete(e.pointerId);
      if (twoPan) {
        if (touchPts.size < 2) twoPan = null;
        if (canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
        return;
      }
    }
    if (bandDrag) {
      const band = bandDrag;
      bandDrag = null;
      if (e && canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      if (band.active) {
        const raw = enclosedBy(band.from, band.to);
        // Deduped by item. withGroup is the identity today (see its note), so
        // this is a straight copy -- kept as the shape it will need if the
        // whole-assembly question above is ever answered yes.
        const caught = [];
        raw.forEach(entry => withGroup(entry).forEach(w => {
          if (!caught.some(c => c.item === w.item)) caught.push(w);
        }));
        // SHIFT ADDS TO WHAT IS THERE, exactly as it does for a click, and the
        // old page's own `!shiftHeld` replace flag. Without it a drafter can
        // build a selection by clicking but not by boxing, which is the
        // inconsistency that makes a tool feel broken rather than limited.
        setSelection(band.shift
          ? selection.concat(caught.filter(c =>
            !selection.some(entry => entry.item === c.item)))
          : caught);
      } else {
        // A press that never armed is a click, and a click still selects --
        // the old page runs _handleSelectClick for "a clean click (no drag) in
        // select mode" whichever window mode is armed.
        const rect = canvas.getBoundingClientRect();
        const hit = hitAt(toWorld(e.clientX - rect.left, e.clientY - rect.top));
        setSelection(hit ? [hit] : []);
      }
      paint();
      return;
    }
    if (moveDrag) {
      const md = moveDrag;
      // A grab that never armed moved nothing, so there is nothing to undo —
      // and a snapshot pushed for it would make one Ctrl+Z do nothing visible.
      if (md.active) {
        // Both halves of a locked move go into ONE history entry: the drafter
        // made one gesture, so one Ctrl+Z undoes all of it. See lockBefore.
        if (md.kind === 'dimrow') {
          // ONE GESTURE, ONE UNDO for the whole row. And the move is written
          // on each record (`moved`: where the row was first put, and how far
          // it has come) so AUTO DIMS, run again, puts the row back where the
          // drafter left it (Movie, 6 Oct: "Keep my moves").
          if (md.by) {
            // ON THE AXIS THE ROW STANDS ACROSS: a row along x is placed by
            // its z, and the other way about. `from` is where it was first
            // put -- kept through later moves -- and `by` how far it now is.
            const n = md.normal;
            const axis = Math.abs(n.z) >= Math.abs(n.x) ? 'z' : 'x';
            const clean = v => Math.round(v * 1e6) / 1e6;
            md.row.forEach(({ item, start }) => {
              const from = Number.isFinite(item.moved?.from) && item.moved?.axis === axis
                ? item.moved.from : start[axis];
              item.moved = { axis, from: clean(from), by: clean(item.start[axis] - from) };
            });
            undoStack.push({ kind: 'props', edits: md.row.map(({ item, before }) => ({ item, before })) });
            markDirty();
          }
          moveDrag = null;
          if (e && canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
          paint();
          return;
        }
        if (md.kind === 'items') {
          if (md.moved) {
            undoStack.push({ kind: 'props', edits: md.items.map(({ item, before }) => ({ item, before })) });
            markDirty();
          }
          moveDrag = null;
          if (e && canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
          paint();
          return;
        }
        if (md.kind === 'note') {
          const n = md.note;
          if (n.anchor.x !== md.anchor.x || n.anchor.z !== md.anchor.z
            || n.text.x !== md.text.x || n.text.z !== md.text.z) {
            undoStack.push({ kind: 'props', edits: [{ item: n, before: md.before }] });
            markDirty();
          }
          moveDrag = null;
          if (e && canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
          paint();
          return;
        }
        if (md.kind === 'roomcorner') {
          const tag = md.tag;
          if (md.moved) {
            // A CORNER DROPPED ON ITS NEIGHBOUR IS LET GO: three must stay.
            const pts = md.points.slice();
            const i = md.index;
            const same = (a, b) => a === b || (Math.abs(a.x - b.x) < 0.05 && Math.abs(a.z - b.z) < 0.05);
            const next = pts[(i + 1) % pts.length], prev = pts[(i - 1 + pts.length) % pts.length];
            if (pts.length > 3 && (same(pts[i], next) || same(pts[i], prev))) pts.splice(i, 1);
            const crossed = window.DraftGeometry2D.selfIntersects(pts);
            if (crossed) {
              tag.points = md.before.points;
              sayOnStrip('That corner would make the shape cross itself, so it goes back.');
            } else {
              tag.points = pts;
              const linked = md.loopKind === 'roomtag' && pts.includes(md.points[i]) && wallsOnCorner(md.points[i]).length > 0;
              const byFace = linked && !!md.points[i].link;
              undoStack.push({ kind: 'props', edits: [{ item: tag, before: md.before }] });
              markDirty();
              sayOnStrip(linked
                ? `Corner linked to the wall\u2019s ${byFace ? 'corner' : 'node'} \u2014 the floor follows the wall now. UNDO frees it.`
                : `${md.loopKind === 'roomtag' ? (tag.name || 'ROOM') : md.loopKind === 'floor' ? 'The floor' : 'The shape'} is ${roomTagEnv().areaLabel(window.DraftDrawingFormat.loopAreaSqFt(pts))}.`);
            }
          } else {
            tag.points = md.before.points;
          }
          moveDrag = null;
          if (e && canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
          showSelectionProps();
          paint();
          return;
        }
        if (md.kind === 'roomtag') {
          // The 'props' step puts the record back IN PLACE, the point with it.
          if (md.tag.at.x !== md.from.x || md.tag.at.z !== md.from.z) {
            undoStack.push({ kind: 'props', edits: [{ item: md.tag, before: md.before }] });
            markDirty();
          }
          moveDrag = null;
          if (e && canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
          paint();
          return;
        }
        if (md.kind === 'stair') {
          if (md.moved) {
            // ONE GESTURE, ONE UNDO, the well in the same step: the drafter
            // made one drag, so one Ctrl+Z puts the flight and its hole back
            // together. A 'props' step restores records in place, which is
            // what a stair needs -- it has no vertices of its own for a
            // 'move' step to walk.
            const edits = [{ item: md.stair, before: md.before }];
            if (md.well) edits.push({ item: md.well, before: md.wellBefore });
            edits.push(...md.framingBefore);
            // LOCKED to the faces its sides now lie on, or to none.
            const lock = stairLockNow(md.stair);
            if (lock) md.stair.lock = lock; else delete md.stair.lock;
            // TOUCHED BY HAND, SO NO LONGER THE SUGGESTER'S. The format says
            // `auto` tags "a placement the auto-stair rule suggested (cleared
            // the moment the drafter touches it)" -- and a drag is the plainest
            // touch there is. In the undo step, so Ctrl+Z gives it back.
            md.stair.auto = false;
            // AND FRAMED AGAIN WHERE IT LANDED (reframeStair): the framing
            // rode along for the drag so the drafter sees it go with him, and
            // is laid fresh on the drop -- a stair slid into a room of its own
            // can need a side beam it did not, or no longer need one it had.
            const reframed = [reframeStair(md.stair)];
            const slid = { kind: 'props', edits };
            undoStack.push(reframed[0].steps.length ? { kind: 'batch', steps: [slid, ...reframed[0].steps] } : slid);
            markDirty();
            // WHAT MOVED AND WHAT DID NOT, in one sentence. The two things a
            // drafter cannot see from the plan are a well left behind because
            // it is shared, and a well that has travelled off the floor it was
            // cut from -- so both are said rather than left to be discovered.
            const said = [md.well ? 'STAIR and its well moved' : 'STAIR moved'];
            if (md.shared) said.push('the shared well stayed put — two flights climb through it');
            if (md.well && wellOffItsFloor(md.well)) said.push('the well now runs off its floor');
            sayOnStrip(`${said.join(' · ')}.${stairFramingSaid(reframed)}`);
          }
          moveDrag = null;
          if (e && canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
          paint();
          return;
        }
        if (md.kind === 'fixture') {
          fixtureMoveRelease(md);
          moveDrag = null;
          if (e && canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
          paint();
          return;
        }
        if (md.kind === 'opening') {
          // ONE GESTURE, ONE UNDO, and the step carries the one number that
          // changed. A 'move' step restores VERTICES and an opening has none
          // of its own; pushing one here would hand undo a `before` list it
          // would walk as vertex snapshots and throw on.
          //
          // AND IT IS PUSHED ONLY IF THE OPENING ACTUALLY MOVED. A drag armed
          // past 4px whose clamp refused every event -- a window already hard
          // against its bearing, pulled further -- changed nothing, and an
          // undo step for it would cost the drafter a Ctrl+Z that appears to
          // do nothing.
          if (md.opening.offset !== md.was) {
            // AND THE STRINGS THAT MEASURE IT: auto-dims strings the openings'
            // own centres, so a window slid along its wall leaves its jamb
            // dimensions reading where it used to be. One gesture, one undo,
            // so the re-laid strings ride this step rather than a second one.
            undoStack.push(liveRedimFold({ kind: 'move-opening', opening: md.opening, was: md.was }, md.live));
            markDirty();
          }
          moveDrag = null;
          if (e && canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
          paint();
          return;
        }
        const moveStep = { kind: 'move',
          before: [...md.before, ...(md.lockBefore || []), ...(md.follow || []), ...(md.faceBefore || [])],
          // A WALL LET GO WITH SHIFT takes its old corners back on UNDO.
          ...(md.loose ? { loose: { wall: md.body, shared: md.loose.shared.map(b => b.vtx), fresh: md.loose.fresh.map(f => f.vtx) } } : {}) };
        // AN END DRAGGED SETTLES ITS WALLS' OPENINGS (settleOpeningsPut): the
        // steps ride the move's as one batch, so one UNDO puts it all back.
        const settledOpenings = md.kind === 'corner' && board !== 'toy' ? settleOpeningsPut(md) : [];
        undoStack.push(settledOpenings.length ? { kind: 'batch', steps: [moveStep, ...settledOpenings] } : moveStep);
        markDirty();
        // §5: the bone moved, so what the storey above covers has changed and
        // the roofs under it are stale. Recomputed on the RELEASE, not on
        // every pointermove -- a roof record per mouse event would be hundreds
        // across one drag.
        // THE LOCKED SIBLINGS MOVE NOW, once, by the whole distance the
        // assembly travelled -- measured from the snapshot taken when the drag
        // armed, which is the same total MODEL.dc.html reads off its anchor.
        //
        // On the RELEASE for the same reason §4's propagation and §5's roofs
        // are: a drag is hundreds of pointermove events and each one would
        // otherwise re-walk every point of every sibling assembly.
        if (md.kind === 'group' && md.group && md.before.length) {
          const a = md.before[0];
          applyLevelLockDelta(md.group, a.vtx.x - a.x, a.vtx.z - a.z);
        }
        if (board === 'toy') { boneFollows(md.before, md.body?.levelId); rebuildRoofs(); }
        // §4: A MASTER POINT MOVED, so every level that follows it moves now.
        // On the RELEASE rather than each pointermove, for §5's reason: the
        // riders are hundreds of records and a drag is hundreds of events.
        //
        // Guarded by "was this actually a master's point", not by "are we on
        // the boneyard": the two are the same today and would part the day
        // anything else can edit a master, and the wrong one of them would go
        // on looking correct.
        if (md.kind === 'corner') {
          const owner = (drawing?.boneyardOutlines || [])
            .find(m => (m.points || []).includes(md.before[0].vtx));
          if (owner) propagateMasterOutline(owner);
        }
        // ── AND THE STRINGS THAT MEASURE IT ────────────────────────────────
        //
        // LAST, after the lock's siblings have travelled, the bone has
        // followed and a master's riders have been propagated -- every one of
        // those moves geometry a string may be measuring, and a re-lay before
        // them would measure the drawing half way through the gesture.
        //
        // THE STEP IS FILLED IN AFTER IT WAS PUSHED, which is the one odd line
        // here and is deliberate: the push has to stay where it is so the
        // move is undone in the right order against anything the propagation
        // pushed, and nothing reads a step until an undo pops it.
        //
        // §6: AND IF THE WALL LEFT ITS FOOTPRINT, THE RE-LAY WAITS FOR THE
        // ANSWER. The card decides whether the footprint moved with the wall,
        // moved the whole building, or stayed -- three different buildings to
        // measure -- so stringing before it is answered would string a
        // drawing that does not exist yet. settleFootprint folds this same
        // step when it lands.
        const offered = offerFootprintChoice(md, moveStep);
        if (!offered) foldRedim(moveStep);
        // A TYPED LENGTH MAY FINISH IT, as it does a MOVE (moveTyped): a line
        // or wall dragged by its body, an assembly, or an end NODE (Movie,
        // 20 Oct: "when i grab an enpoint NODE, i'd like to move it over 1/16"
        // by typing into the length box"). Not a drag that let go with SHIFT,
        // carried locked siblings, moved a boneyard master's corner (its
        // riders were propagated on the release), or is waiting on the
        // footprint card: each of those did more than move points.
        const a = md.before?.[0];
        const ddx = a ? a.vtx.x - a.x : 0, ddz = a ? a.vtx.z - a.z : 0;
        const master = md.kind === 'corner'
          && (drawing?.boneyardOutlines || []).some(m => (m.points || []).includes(a?.vtx));
        // AN ASSEMBLY TOO: lockBefore is an array on every rigid-group drag,
        // empty when no level lock carries siblings, and `!md.lockBefore`
        // refused the typed length to every one of them -- which is why L
        // mid-drag under SELECT moved nothing until 20 Oct.
        moveTyped = !offered && board !== 'toy' && !md.loose && !(md.lockBefore && md.lockBefore.length) && !master
          && (md.kind === 'wall' || md.kind === 'group' || md.kind === 'corner') && Math.hypot(ddx, ddz) > 1e-6
          ? { drag: true, before: md.before, dx: ddx, dz: ddz, step: moveStep } : null;
        if (moveTyped) stripRefresh();
        finishTypedMidDrag();
      } else if (board === 'toy' && md.kind === 'wall' && md.body
        && walls().includes(md.body)) {
        // §4's CLICK, and it costs no new gesture. `segmentBodyAt` only
        // returns a wall or line that is ALREADY SELECTED, so reaching here
        // means the drafter pressed one he had already chosen and let go
        // without dragging -- which is the click the order describes, and is
        // not a press that could have been anything else. The drag is still
        // the move; this is the look.
        //
        // AND IT IS A BONE'S CLICK, so it asks whether the body IS a wall.
        // The grab answers for a selected LINE now as well, and a line is not
        // a bone: BREAK HERE would offer to put a joint in one.
        offerBoneChoice(md.body, md.grab);
      } else if (e && !e.shiftKey && activeTool !== 'assembly') {
        // A PRESS ON WHAT IS ALREADY IN HAND, let go where it was, IS THE
        // CLICK AGAIN: it takes the next thing under it (pickUnder).
        const rect = canvas.getBoundingClientRect();
        // A HANDLE TAPPED FIRST KEEPS ITS WALL, as it always did: only a press
        // again on the same spot steps off a corner handle.
        const under = pickUnder(e.clientX - rect.left, e.clientY - rect.top);
        const handle = md.kind === 'corner' || md.kind === 'roomcorner';
        if ((under.again || !handle) && under.hit && !selection.some(entry => entry.item === under.hit.item)) {
          wallPicked = under.hit.type === 'wall' ? under.hit.item : null;
          setSelection(withGroup(under.hit));
          sayPickUnder(under);
          paint();
        }
      }
      moveDrag = null;
      if (e && canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      return;
    }
    if (!dragging) return;
    // THE RIGHT BUTTON PANS; one that did not travel is the right CLICK, which
    // puts the gesture in hand down, as it did before the pan moved here.
    if (dragging.pan) {
      if (dragging.moved <= 4) {
        // ON A DIMENSION THE RIGHT BUTTON ENDS, it does not cancel (Movie,
        // 23 Oct: "for ESC where the string is abandoned and deleted don't
        // use RIGHT mouse button, only use esc key").
        if (dimInHand()) { dimOnceEnds(); stripRefresh(); paint(); }
        else if (cancelGestures()) { stripRefresh(); paint(); }
      }
      dragging = null;
      canvas.classList.remove('dragging');
      if (e && canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      return;
    }
    // THE BOX: left to right takes what it encloses, right to left what it
    // crosses too; Shift adds to the selection, as a Shift-click does.
    if (dragging.box && dragging.box.active) {
      const box = dragging.box;
      itemBox = null;
      dragging = null;
      if (e && canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      const caught = [];
      boxCatch(box.from, box.to, { crossing: boxIsCrossing(box) })
        .forEach(entry => withGroup(entry).forEach(w => {
          if (!caught.some(c => c.item === w.item)) caught.push(w);
        }));
      // A BOX OVER A ROOF'S NODES, AND NOTHING WHOLE, PICKS THOSE NODES
      // (Movie, 18 Oct: "if the user makes a right sweeping rectangle select
      // over roof nodes it will select the nodes and allow the user to either
      // delete all, move all, or reselect one node in the square").
      const nodes = !caught.length && !e?.shiftKey ? roofNodesInBox(box.from, box.to) : null;
      if (nodes) {
        pickRoofNodes(nodes.roof, nodes.list);
        paint();
        return;
      }
      setSelection(e && (e.shiftKey || activeTool === 'assembly')
        ? selection.concat(caught.filter(c => !selection.some(entry => entry.item === c.item)))
        : caught);
      paint();
      return;
    }
    itemBox = null;
    // A CLICK SELECTS, A DRAG PANS, and the difference is 4px of travel. Every
    // pointerdown starts a pan here -- it has since tier 1 -- so selection
    // cannot take pointerdown without taking panning with it. Deciding on
    // RELEASE, by how far the pointer actually went, leaves the pan untouched:
    // a drafter who moved the sheet gets no selection, and one who tapped a
    // wall gets no pan they can see.
    if (dragging.moved <= 4 && e) {
      const rect = canvas.getBoundingClientRect();
      // A PLAIN CLICK AGAIN ON THE SAME SPOT TAKES THE NEXT THING UNDER IT
      // (pickUnder); a shift-click or an ASSEMBLY click keeps the top one.
      const plainClick = !e.shiftKey && activeTool !== 'assembly';
      const under = plainClick ? pickUnder(e.clientX - rect.left, e.clientY - rect.top) : null;
      const hit = plainClick ? under.hit : hitAt(toWorld(e.clientX - rect.left, e.clientY - rect.top));
      // SHIFT ADDS OR REMOVES, which is what the mode help line promises and
      // the only way to build a selection of more than one by clicking. A
      // shift-click on something already selected takes it OUT -- the old
      // page's own toggle, and the reason the help says "adds or removes"
      // rather than "adds".
      // ASSEMBLING, EVERY CLICK IS A SHIFT-CLICK: the set is being built,
      // and a click that threw it away would make the drafter start over.
      const shiftNode = e.shiftKey && moveState?.node
        ? roofNodeNear(toWorld(e.clientX - rect.left, e.clientY - rect.top)) : null;
      if (shiftNode && shiftNode.roof === moveState.node.roof) {
        const list = moveState.node.list.includes(shiftNode.i)
          ? moveState.node.list.filter(i => i !== shiftNode.i) : [...moveState.node.list, shiftNode.i];
        if (list.length) pickRoofNodes(shiftNode.roof, list); else moveState.node = null;
        syncBreakVerb();
      } else if (e.shiftKey || activeTool === 'assembly') {
        if (hit) {
          const at = selection.findIndex(entry => entry.item === hit.item);
          // ASSEMBLING TAKES A WHOLE ASSEMBLY AT A CLICK: a WC picked by one
          // of its walls goes in entire, rather than that one wall being
          // pulled out of the WC into the new unit.
          const owner = activeTool === 'assembly' ? groupOf(hit) : null;
          const whole = owner ? itemsOfGroup(owner) : withGroup(hit);
          setSelection(at >= 0
            ? selection.filter(entry => !whole.some(w => w.item === entry.item))
            : selection.concat(whole.filter(w =>
              !selection.some(entry => entry.item === w.item))));
        }
        // A shift-click on empty space keeps the selection. Clearing it would
        // make an inaccurate shift-click destroy the set a drafter just built.
      } else {
        // An empty click clears, which is the other half of select: without it
        // the drafter has no way to put a selection down.
        //
        // A CLICK ON A ROOF'S EDGE PICKS THE EDGE as well as the roof, and a
        // roof already in hand answers a click just OUTSIDE its eave too --
        // the edge is a line, and half of the grab around it is off the roof.
        const world = toWorld(e.clientX - rect.left, e.clientY - rect.top);
        // A CLICK CLOSE TO A ROOF NODE PICKS THAT NODE (Movie, 18 Oct: "or
        // even just click close to a ROOF node"), ahead of the roof and of
        // whatever is under it.
        const nodeHit = roofNodeNear(world);
        if (nodeHit) {
          pickRoofNodes(nodeHit.roof, [nodeHit.i]);
          paint();
          dragging = null;
          canvas.classList.remove('dragging');
          if (canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
          return;
        }
        if (moveState?.node) moveState.node = null;
        const held = selection.length === 1 && selection[0].type === 'roof' ? selection[0].item : null;
        const roofHit = hit?.type === 'roof' ? hit.item
          : (!hit && held && roofEdgeNear(held, world) != null ? held : null);
        roofEdgeIdx = roofHit ? roofEdgeNear(roofHit, world) : null;
        roofEdgeClick = roofEdgeIdx != null ? world : null;
        // The wall a click landed on, for WALL OFF: a click on a WC wall now
        // picks the whole WC, and the verb still needs to know which wall.
        wallPicked = hit?.type === 'wall' ? hit.item : null;
        setSelection(roofHit && !hit ? [{ type: 'roof', item: roofHit }] : withGroup(hit));
        if (under) sayPickUnder(under);
      }
      paint();
    }
    dragging = null;
    canvas.classList.remove('dragging');
    if (e && canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  };
  // THE LIFT PLACES THE LINE. Movie, 13 Sep: "when the pointer lifts place the
  // line". Registered before endDrag and separate from it: a wall press
  // returns out of pointerdown before any pan or band drag is armed, so this
  // has no state to share with that one and nothing to unwind.
  //
  // IT CALLS drawPress -- THE SAME COMMIT BOTH GESTURES USE. §1 is explicit
  // that press-drag-lift and PC click-click "are the same wall by the time it
  // reaches commitWall; that is acceptance #2, and it is the reason the commit
  // must not live in either handler."
  canvas.addEventListener('pointerup', e => {
    const press = wallPress;
    wallPress = null;
    if (!press || !drawStart || !drawsRun()) return;
    // A LIFT THAT DID NOT TRAVEL, ON A PRESS THAT OPENED THE RUN, IS A TAP --
    // the first half of a gesture, whichever pointer is doing it. Committing
    // here would turn every PC click into a zero-length wall attempt, and
    // would stop a finger from tapping once to set a start.
    //
    // A press that did NOT open the run is a closing press, and on touch it
    // closes on the lift however far it travelled: that is both
    // press-again-and-drag and a plain two-tap, and neither has any other
    // handler left to commit it. On a mouse the down already committed, so
    // there is nothing here to do.
    // A MOUSE NEVER PLACES A WALL ON THE LIFT (Movie, 17 Oct: "there is a
    // click drag drop function for drawing a wall --- ITS NOT GOOD ... if it
    // is needed for IPAD it can be put for IPAD / Mobile only, but not on PC
    // or Linux" -- "the click drag wall can be easy to make mistakes"). On a
    // PC a wall is click, choose direction and length, click again or ENTER;
    // a press that slips a few pixels is not a wall. A finger or a pen keeps
    // press-drag-lift.
    if (!press.touch) return;
    const travelled = Math.hypot(e.clientX - press.x, e.clientY - press.y) >= DRAG_ARM_PX;
    if (press.opened && !travelled) return;
    const rect = canvas.getBoundingClientRect();
    drawPress(toWorld(e.clientX - rect.left, e.clientY - rect.top));
  });
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointerup', e => { if (elevNotePress) elevNoteLift(e); });
  canvas.addEventListener('pointercancel', endDrag);

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    // Zoom about the cursor: the world point under it must not move.
    const before = toWorld(sx, sy);
    const factor = Math.exp(-e.deltaY * 0.0015);
    // ON AN ELEVATION the wheel zooms the painter's frame about the cursor
    // (elevPin), from the fit down to half of it and in to 800 px a foot,
    // the plan's own ceiling.
    const cutNow = drawing ? activeCut() : null;
    if (cutNow && elevFrame) {
      const at = elevAt(sx, sy);
      const floor = elevFitPx ? elevFitPx * 0.5 : 0.25;
      const px = Math.max(floor, Math.min(elevFrame.pxPerFt * factor, 800));
      elevPin = {
        pxPerFt: px, uMin: elevFrame.uMin, yTop: elevFrame.yTop,
        x0: sx - (at.u - elevFrame.uMin) * px,
        y0: sy - (elevFrame.yTop - at.e) * px,
      };
      elevPinFor = String(cutNow.id || cutNow.name);
      paint();
      return;
    }
    // IN TO 800 PX A FOOT (Movie, 20 Oct: "would it be possible to go about
    // 4X even further zoom"): a sixteenth of an inch is four pixels there,
    // which is what a 1/16" nudge needs to be seen. 200 was the old stop, and
    // it stays the ceiling for 0-to-fit, so a tiny drawing still opens framed
    // rather than magnified.
    view.scale = Math.max(0.25, Math.min(view.scale * factor, 800));
    const after = toWorld(sx, sy);
    view.cx += before.x - after.x;
    view.cz += before.z - after.z;
    paint();
  }, { passive: false });

  window.addEventListener('keydown', e => {
    // TYPING IS NOT A COMMAND. A key pressed in a box on this page -- a
    // property, a name -- belongs to that box: Backspace in the WIDTH field
    // used to reach DELETE below and take the selected window away, and a 0
    // typed into a size refitted the sheet. The tool letters already keep out
    // of boxes (the column's own handler); these keys now do too.
    const typing = e.target instanceof HTMLElement
      && (e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName));
    if (typing) return;
    if (e.key === '0') { fit(); paint(); }
    // CTRL+A SELECTS ALL (selectAll, above). A plain A is the SHAPE key.
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'a') {
      if (!drawing || modalUp() || activeCut()) return;
      e.preventDefault();
      selectAll();
      return;
    }
    // CTRL+C COPIES AND CTRL+V PASTES (Movie, 25 Oct: "when the bottom bar has
    // COPY ... can we do CTL-C for copy and CTL-P for past"): the foot's COPY
    // and PASTE, the same verbs. V, not P -- Ctrl+P is the browser's print.
    // A plain C is still CUT; eventMatchesBinding keeps the two apart.
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && ['c', 'v'].includes(e.key.toLowerCase())) {
      if (!drawing || modalUp() || activeCut()) return;
      // NOTHING PICKED, the browser's own copy stands (text on the page).
      if (e.key.toLowerCase() === 'c' && !selection.length) return;
      e.preventDefault();
      if (e.key.toLowerCase() === 'c') { copySelection(); paint(); } else pasteHeld();
      return;
    }
    // ESCAPE IS THE OLD PAGE'S ESCAPE, measured rather than invented.
    // MODEL.dc.html:22165-22172 does two things in ONE press: it cancels every
    // in-progress gesture (_cancelWall among a dozen siblings) AND clears the
    // selection. It does NOT put the tool down — activeTool survives, so the
    // drafter who was drawing walls is still drawing walls.
    //
    // A ladder was tried here first — pending start, then the mode, then the
    // selection, one press each — and it is wrong twice over: it takes two
    // presses to reach the selection, and it disarms a tool the old page
    // keeps. A drafter who learns Escape on one page would lose their tool on
    // the other. The DRAW button is how this page puts the tool down, because
    // it is the affordance a drafter with no keyboard can reach.
    if (e.key === 'Escape') {
      if (roomCornerCard && !roomCornerCard.hidden) { settleRoomCorner(null); return; }
      // THE BRUSH GETS THE FIRST STEP, and only when it is holding something.
      // Loaded becomes empty; the tool stays up, which is the one thing the
      // chip cannot do -- pressing that turns the brush off altogether. An
      // empty brush is not an in-progress gesture, so it does not eat the
      // press that a drafter meant for his selection.
      if (brushWarned || (brushWarnBox && !brushWarnBox.hidden)) { brushWarnClear(); return; }
      if (brushLoad) { brushDrop(); return; }
      // THROUGH THE SHARED LIST, which is what turned this line from a claim
      // into a fact. It used to be `drawStart = null` plus the ruler and the
      // bone, under a note promising every half-taken gesture on the page --
      // and the cut, the beam, the floor and the outline were not in it.
      //
      // AND THE UNFINISHED BONE GOES WITH IT. The refusal elsewhere says
      // "finish or cancel the run you started", so a cancel has to exist -- a
      // message naming a way out that the page does not offer is worse than no
      // message. It is in cancelGestures with the rest of them, so the right
      // button cancels it too, which is the same sentence said twice by one
      // piece of code rather than two.
      cancelGestures();
      if (boneChoiceFor) { closeBoneChoice(); return; }
      // ESC WITH NOTHING SELECTED RELEASES THE FILTER, which is the release
      // the filter help line promises in writing (:22418-22419). With
      // something selected Esc clears the selection first, so a drafter never
      // loses both in one press.
      if (!selection.length && selectFilter !== 'all') setSelectFilter('all');
      if (!selection.length && selectPicking) setSelectPicking(false);
      elevSelected = null;
      setSelection([]);
      stripRefresh();
      paint();
      return;
    }
    // THE KEY AND THE BUTTON ARE THE SAME VERB (§7a). They were two
    // implementations of one sentence, and the button's was the narrower of
    // the two: a drafter who rubber-banded a wall and a floor could delete
    // the wall and watch the floor stay. Both now call pressDelete, so
    // neither can learn something the other does not.
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (activeCut() && elevSelected) { e.preventDefault(); deleteElevMark(); return; }
      if (!selection.length) return;
      e.preventDefault();
      pressDelete();
      return;
    }
    // THE KEY AND THE BUTTON ARE THE SAME VERB, as DELETE's are: both call
    // undoOnce, so neither can learn something the other does not.
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
      if (!undoStack.length && !pendingCornerList()) {
        // NOTHING FINE-GRAINED LEFT -- after a jump, or on a drawing just
        // opened -- so the key steps back through the versions instead.
        if (versions.cursor > 0) { e.preventDefault(); historyStep(-1); }
        return;
      }
      e.preventDefault();
      undoOnce();
      return;
    }
    // REDO (Movie, 20 Oct): Ctrl+Y, or Ctrl+Shift+Z, steps forward through
    // the versions -- the entries a jump back left ahead of the cursor.
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
      if (versions.cursor < versions.entries.length - 1) { e.preventDefault(); historyStep(1); }
    }
  });

  // ── UNDO / REDO: THE HISTORY TAB (Movie, 20 Oct) ───────────────────────
  //
  // "i need a better UNDO/REDO functionality in model space. can we put a
  // UNDO / REDO tab under the NOTES / CALC. and in there have the last 100
  // UNDO ... and then 100 REDO ... list with the DATE/TIME style stamps ...
  // click on each one and see what the changes are and it will change the
  // model to that version whichever they end up on, or if they want the
  // current version they select the CURRENT". Per session, not in the file
  // ("do it per session"), and a jump puts the WHOLE drawing back.
  //
  // HOW. Every edit ends in markDirty, so markDirty asks for a version and
  // the version is taken once the gesture's turn is over: the drawing as a
  // save would write it, kept as a string. Each entry says when, and what
  // changed -- the counts that moved, else the kinds whose contents did.
  // The CURSOR is the entry on the sheet: the entries before it are the
  // UNDO side, the ones after it the REDO side; CURRENT is the newest. A
  // jump adopts the entry's drawing through the door a file comes in by
  // (adoptFile, muted so it is not itself a version) and moves the cursor;
  // an edit made standing on an older entry drops the entries after it,
  // as Photoshop's history does. Ctrl+Z keeps the fine-grained undo while
  // there is one and steps back here when there is none; Ctrl+Y or
  // Ctrl+Shift+Z steps forward.
  const HISTORY_BACK = 100;
  const HISTORY_BYTES = 80 * 1024 * 1024;
  const HISTORY_COUNTED = [['walls', 'wall'], ['lines', 'line'], ['fenestrations', 'opening'],
    ['dimensions', 'dimension'], ['floors', 'floor'], ['roofs', 'roof'], ['fixtures', 'fixture'],
    ['notes', 'note'], ['stairs', 'stair'], ['columns', 'column'], ['beams', 'beam'],
    ['shapes', 'shape'], ['outlines', 'outline'], ['roomTags', 'room tag'], ['groups', 'assembly'],
    ['levels', 'level'], ['holograms', 'hologram'], ['underlays', 'picture'],
    ['superNodes', 'super node'], ['cuts', 'section']];
  // NAMED versions, NOT history: window.history is the URL bar's, and a
  // local by that name shadowed it (syncUrl's replaceState went missing).
  const versions = { entries: [], cursor: -1, muted: false, pending: false };
  const historyHash = text => {
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  const historyShape = saved => {
    const counts = {}, sigs = {};
    HISTORY_COUNTED.forEach(([key]) => {
      const list = Array.isArray(saved[key]) ? saved[key] : [];
      counts[key] = list.length;
      sigs[key] = historyHash(JSON.stringify(list));
    });
    return { counts, sigs };
  };
  const historyLabel = (prev, next) => {
    if (!prev) return 'OPENED';
    const noun = (word, n) => `${n} ${word}${n === 1 ? '' : 's'}`;
    const moved = HISTORY_COUNTED.filter(([key]) => next.counts[key] !== prev.counts[key])
      .map(([key, word]) => {
        const d = next.counts[key] - prev.counts[key];
        return `${d > 0 ? '+' : '\u2212'}${noun(word, Math.abs(d))}`;
      });
    if (moved.length) return moved.join(', ');
    const changed = HISTORY_COUNTED.filter(([key]) => next.sigs[key] !== prev.sigs[key]).map(([, word]) => `${word}s`);
    return changed.length ? `changed ${changed.join(', ')}` : 'settings';
  };
  const historyTime = at => {
    const d = new Date(at);
    const two = n => String(n).padStart(2, '0');
    return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
  };
  const historyList = document.querySelector('[data-history-list]');
  const historyCountEl = document.querySelector('[data-history-count]');
  const renderHistory = () => {
    if (!historyList) return;
    historyList.textContent = '';
    const n = versions.entries.length;
    if (historyCountEl) {
      historyCountEl.textContent = n
        ? `${versions.cursor} BACK \u00B7 ${n - 1 - versions.cursor} FORWARD` : '';
    }
    for (let i = n - 1; i >= 0; i -= 1) {
      const entry = versions.entries[i];
      const row = document.createElement('div');
      row.className = 'hp-row';
      row.dataset.historyRow = String(i);
      row.setAttribute('role', 'option');
      row.tabIndex = 0;
      row.setAttribute('aria-selected', String(i === versions.cursor));
      if (i > versions.cursor) row.dataset.side = 'redo';
      else if (i < versions.cursor) row.dataset.side = 'undo';
      const when = document.createElement('span');
      when.className = 'hp-when';
      when.textContent = historyTime(entry.at);
      const what = document.createElement('span');
      what.className = 'hp-what';
      what.textContent = i === n - 1 ? `CURRENT \u00B7 ${entry.label}` : entry.label;
      row.append(when, what);
      row.addEventListener('click', () => { historyJump(i); });
      row.addEventListener('keydown', ev => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); historyJump(i); }
      });
      historyList.append(row);
    }
  };
  const historyTake = () => {
    versions.pending = false;
    if (!drawing || versions.muted) return;
    const saved = serializeDrawing({ trim: false });
    const json = JSON.stringify(saved);
    const at = versions.entries[versions.cursor] || null;
    // NOTHING CHANGED, NO VERSION: a dirty mark with nothing behind it.
    if (at && at.json === json) return;
    const shape = historyShape(saved);
    // AN EDIT ON AN OLDER VERSION DROPS THE VERSIONS AFTER IT.
    versions.entries.length = versions.cursor + 1;
    versions.entries.push({ at: Date.now(), json, ...shape, label: historyLabel(at, shape) });
    while (versions.entries.length > HISTORY_BACK + 1) versions.entries.shift();
    let bytes = versions.entries.reduce((sum, e) => sum + e.json.length, 0);
    while (bytes > HISTORY_BYTES && versions.entries.length > 2) bytes -= versions.entries.shift().json.length;
    versions.cursor = versions.entries.length - 1;
    renderHistory();
  };
  // markDirty's hook: one version per gesture, taken when its turn is over.
  const historyNoteEdit = () => {
    if (versions.muted || versions.pending) return;
    versions.pending = true;
    window.setTimeout(historyTake, 0);
  };
  // A NEW DRAWING, A NEW HISTORY (adoptFile's hook): close the file and the
  // history goes, as Photoshop's does. A jump adopts too, muted, and keeps.
  const historyReset = () => {
    if (versions.muted) return;
    versions.entries.length = 0;
    versions.cursor = -1;
    renderHistory();
    historyNoteEdit();
  };
  const historyJump = async index => {
    const entry = versions.entries[index];
    if (!entry || index === versions.cursor || versions.muted) return false;
    versions.muted = true;
    try {
      const ok = await adoptFile(new File([entry.json], 'history.json', { type: 'application/json' }));
      if (!ok) return false;
      versions.cursor = index;
      bumpModelEpoch();
      paint();
      syncShell();
      syncBuildBar();
      buildChrome();
      loadUnderlayImages();
      // UNSAVED: what is on the sheet is not what the store holds.
      markDirty();
    } finally { versions.muted = false; }
    renderHistory();
    const tip = index === versions.entries.length - 1;
    sayOnStrip(tip ? 'CURRENT version back on the sheet.'
      : `The version from ${historyTime(entry.at)} is on the sheet. Draw on it and the versions after it go; CURRENT puts the newest back.`);
    return true;
  };
  const historyStep = by => historyJump(versions.cursor + by);

  // ONE UNDO, whichever control did the pressing. Until audit C4 the only
  // control was Ctrl+Z, and an iPad has no Ctrl key: a drafter there had no
  // way back from any edit at all.
  //
  // A CORNER IN HAND COMES OFF FIRST. Movie, 4 Oct, tracing an outline: "made
  // an accidental placement and wanted to [undo], but nothing happens. can we
  // make the UNDO feature go back one line in the outline creation". The
  // corners of an outline, floor or shape being traced are not on the undo
  // stack -- nothing is saved until the loop closes -- so the stack had
  // nothing to give back. Undo now takes the last corner off the trace; with
  // no trace in hand it undoes the last saved edit, as it always did.
  // THE STRINGS A GESTURE RE-LAID, PUT BACK. A move that re-dimensioned the
  // level carries both lists on its own step -- what it added and what it
  // swept to add them -- so the one Ctrl+Z that puts the wall back puts the
  // old strings back with it. 'built' has the same two loops with a selection
  // sweep interleaved; these two are all a move step needs.
  const undoRedim = step => {
    (step.items || []).forEach(({ list, item }) => {
      const at = list.indexOf(item);
      if (at >= 0) list.splice(at, 1);
    });
    (step.restored || []).forEach(({ list, items }) => {
      items.forEach(item => { if (!list.includes(item)) list.push(item); });
    });
    // §6: AND THE FREEZE COMES OFF. A cantilever takes its corner off the
    // master, and a corner left overridden after its overhang has been undone
    // is a point that silently stops following the bone -- invisible on the
    // plan, and only found later when a master edit moves every corner but
    // that one.
    (step.overrides || []).forEach(({ list, id }) => {
      const at = list.indexOf(id);
      if (at >= 0) list.splice(at, 1);
    });
  };

  const undoOnce = () => {
    const corners = pendingCornerList();
    if (corners) {
      corners.pop();
      sayOnStrip(corners.length ? 'last corner taken back' : 'first corner taken back');
      paint();
      return true;
    }
    const step = undoStack.pop();
    if (!step) return false;
    // The beam question is about the house as it stands; an UNDO puts it away.
    if (beamAskBox && !beamAskBox.hidden) beamAskBox.hidden = true;
    // A BATCH is several steps one gesture took: they go back last first.
    if (step.kind === 'batch') {
      undoStack.push(...step.steps);
      step.steps.forEach(() => undoOnce());
      return true;
    }
    // ONE PRESS IS ONE UNDO whether the press moved one corner or a wall's
    // two, drew a wall, or deleted one: the entry is whatever that gesture
    // captured, so a wall goes back in one keystroke rather than two.
    if (step.kind === 'replace-items') {
      step.added.forEach(item => { const at = step.list.indexOf(item); if (at >= 0) step.list.splice(at, 1); });
      step.removed.slice().sort((p, q) => p.index - q.index).forEach(({ item, index }) => step.list.splice(index, 0, item));
      setSelection([]);
    } else if (step.kind === 'rotate') {
      step.before.forEach(b => {
        b.vtx.x = b.x;
        b.vtx.z = b.z;
        if (b.offX !== undefined) { b.vtx.offX = b.offX; b.vtx.offZ = b.offZ; }
        // A ROOM CORNER'S LINK, as it was before the turn or the flip.
        if (b.link) b.vtx.link = b.link;
      });
      step.detached.forEach(d => { d.wall[d.key] = d.orig; });
      (step.wells || []).forEach(w => { w.hole.points = w.points; });
    } else if (step.kind === 'move') {
      undoRedim(step);
      if (step.loose) {
        const { wall, shared, fresh } = step.loose;
        fresh.forEach((v, i) => {
          if (wall.start === v) wall.start = shared[i];
          if (wall.end === v) wall.end = shared[i];
          const at = vertexPool.indexOf(v);
          if (at >= 0) vertexPool.splice(at, 1);
        });
      }
      step.before.forEach(b => {
        b.vtx.x = b.x;
        b.vtx.z = b.z;
        // The offsets go BACK to what they were, not to a re-measure. Undo that
        // recomputed them would leave the corner at its old position carrying a
        // new offset — a different drawing from the one before the drag, and one
        // whose difference nothing on screen would show.
        if (b.offX !== undefined) { b.vtx.offX = b.offX; b.vtx.offZ = b.offZ; }
      });
      // §6: AND THE MASTER IS ASKED AGAIN. A whole-building move was carried
      // by a propagation rather than by a list of points, so it is undone by
      // the same propagation: the master and every offset are back to what
      // they were on the line above, and asking again rebuilds precisely the
      // drawing that was there -- however many riders the propagation grows
      // later, which a snapshot taken today would not have known about.
      (step.repropagate || []).forEach(master => propagateMasterOutline(master));
    } else if (step.kind === 'trim') {
      // Each end back on the corner it had, the openings back where they sat,
      // and any corner the trim retired back in the pool -- in reverse, so a
      // corner trim's second end unwinds before its first.
      step.changes.slice().reverse().forEach(c => {
        c.wall[c.end] = c.was;
        c.shifts.forEach(sh => { sh.opening.offset = sh.was; });
      });
      (step.retired || []).forEach(corner => {
        if (!vertexPool.includes(corner)) vertexPool.push(corner);
      });
      // AND WHAT THE AUTOCAD TRIM ADDS: the far piece of a wall cut in two
      // goes, the openings it deleted come back, and every opening on the
      // wall returns to the wall and the offset it had.
      (step.added || []).forEach(a => {
        const at = a.list.indexOf(a.item);
        if (at >= 0) a.list.splice(at, 1);
      });
      if ((step.added || []).length) retirePoolCorners(step.added.map(a => a.item.start));
      (step.removed || []).forEach(r => { if (!r.list.includes(r.item)) r.list.push(r.item); });
      (step.openings || []).forEach(o => { o.opening.offset = o.offset; o.opening.wallId = o.wallId; });
    } else if (step.kind === 'move-opening') {
      undoRedim(step);
      // The record is mutated in place, so undo puts the one number back
      // rather than restoring a copy -- a copy would detach the opening
      // every other reader already holds by reference.
      step.opening.offset = step.was;
    } else if (step.kind === 'size-opening') {
      // A typed size moves two numbers, and both go back together: undoing
      // the width alone would leave the window the height it was retyped to
      // and read as a half-finished undo.
      step.opening.width = step.wasWidth;
      step.opening.sillHeight = step.wasSill;
    } else if (step.kind === 'edge-tag') {
      // The roof's own edges array is mutated in place, so undo puts the one
      // word back rather than restoring a copy of the roof -- a copy would
      // detach the record every other reader already holds by reference.
      step.roof.edges[step.index] = step.was;
    } else if (step.kind === 'node') {
      // A BREAK's node: the step carries its own way back.
      step.undo();
    } else if (step.kind === 'add-item') {
      // Structure placement. The list is captured in the step, so this works
      // for columns and beams without knowing which it is holding.
      const at = step.list.indexOf(step.item);
      if (at >= 0) step.list.splice(at, 1);
    } else if (step.kind === 'props') {
      // A DUST GOES BACK. The step holds each item and a copy of it as it
      // was, and the record is mutated IN PLACE rather than swapped for the
      // copy -- the selection, the properties panel and every painter hold
      // these by reference, and handing back a new object would leave all
      // of them pointing at the one that is no longer in the drawing.
      //
      // KEYS THE BRUSH ADDED ARE REMOVED, not left at their old value:
      // `garage` arrives on a window that never had one, and assigning the
      // `before` copy over the top would leave it standing. What was not
      // there before must not be there after.
      step.edits.forEach(({ item, before }) => {
        Object.keys(item).forEach(key => {
          if (!(key in before)) delete item[key];
        });
        Object.assign(item, before);
      });
      showSelectionProps();
    } else if (step.kind === 'remove-items') {
      // Put back in the reverse of the order they came out, so every index
      // recorded at removal is the right one again when it is used.
      step.removed.slice().reverse().forEach(({ list, index, item }) => {
        list.splice(Math.min(index, list.length), 0, item);
      });
    } else if (step.kind === 'remove-item') {
      // The mirror of 'add-item', and the same trick: the list is captured
      // in the step, so one branch puts a line, floor, outline, column or
      // beam back without knowing which it is holding.
      step.list.splice(Math.min(step.index, step.list.length), 0, step.item);
    } else if (step.kind === 'built') {
      // A WHOLE ORDER GOES BACK AT ONCE, walls and the loop that names
      // them, and the corners it minted are retired with them -- the
      // same reason single-wall undo retires its own.
      step.walls.forEach(wall => {
        const at = drawing.walls.indexOf(wall);
        if (at >= 0) drawing.walls.splice(at, 1);
      });
      setSelection(selection.filter(entry => !step.walls.includes(entry.item)));
      retirePoolCorners(step.walls.flatMap(wall => [wall.start, wall.end]));
      // THE LOOPS GO BACK ONLY IF THE ORDER MADE THEM. An ordered garage and
      // a premade bungalow mint their own and take them back with the walls;
      // a house raised from a loop the DRAFTER traced leaves that loop
      // standing -- he drew it, the bone only built on it, and an undo that
      // swallowed his trace would take back a gesture he never asked to
      // undo. So a build that owns nothing carries an empty list.
      (step.outlines || []).forEach(outline => {
        const outlineAt = step.list ? step.list.indexOf(outline) : -1;
        if (outlineAt >= 0) step.list.splice(outlineAt, 1);
      });
      // The openings the order hung on those walls go with them.
      (step.openings || []).forEach(record => {
        const at = (drawing.fenestrations || []).indexOf(record);
        if (at >= 0) drawing.fenestrations.splice(at, 1);
      });
      // AND THE REST OF THE BUILDING: the storey's floor, the slab, the
      // footing lines and the roof. Each carries the list it went into, so
      // this branch needs to know nothing about what any of them IS.
      (step.items || []).forEach(({ list, item }) => {
        const at = list.indexOf(item);
        if (at >= 0) list.splice(at, 1);
      });
      // And none of it stays selected: a line a DXF brought in, gone again,
      // is not a selection.
      const gone = new Set((step.items || []).map(({ item }) => item));
      if (gone.size) setSelection(selection.filter(entry => !gone.has(entry.item)));
      // AND WHAT THE PRESS TOOK OUT GOES BACK IN. Removing what a press
      // added is only half an undo when the press also replaced something:
      // AUTO DIMS sweeps a level's previous auto strings before laying
      // fresh ones, and without this the drafter would end with neither.
      (step.restored || []).forEach(({ list, items }) => {
        items.forEach(item => { if (!list.includes(item)) list.push(item); });
      });
    } else if (step.kind === 'add') {
      const at = drawing.walls.indexOf(step.wall);
      if (at >= 0) drawing.walls.splice(at, 1);
      setSelection(selection.filter(entry => entry.item !== step.wall));
      // AND RETIRE THE CORNERS IT INTRODUCED, or the pool keeps a phantom
      // the next drawn wall snaps to — a corner belonging to a wall that no
      // longer exists, invisible and magnetic.
      retirePoolCorners([step.wall.start, step.wall.end]);
    } else if (step.kind === 'remove') {
      drawing.walls.splice(Math.min(step.index, drawing.walls.length), 0, step.wall);
      // The dependents come back BY VALUE into the same raw arrays the
      // cascade took them out of. They were never normalised on the way in
      // (this page rides them through on the ...parsed spread), so putting
      // the same objects back is the only restoration that is exact.
      step.deps.forEach(d => { if (Array.isArray(d.list)) d.list.splice(Math.min(d.index, d.list.length), 0, d.item); });
      // AND THE FIXTURES IT KEPT GO BACK ON IT.
      (step.freed || []).forEach(({ item, before }) => {
        Object.keys(item).forEach(key => { if (!(key in before)) delete item[key]; });
        Object.assign(item, before);
      });
      // AND THE CORNERS GO BACK IN THE POOL. The restored wall already holds
      // these objects — identity on the wall survives the round trip — but
      // the pool is what the NEXT drawn endpoint searches. Leave them out
      // and a wall drawn onto the restored free end mints a fresh object at
      // the same coordinates instead of joining: every number right, the
      // drawing right, and the mitre silently gone. That is the same class
      // as the pooling mutation this rung's specs already caught, arriving
      // through undo instead of through create.
      (step.retired || []).forEach(corner => {
        if (!vertexPool.includes(corner)) vertexPool.push(corner);
      });
    }
    // AN UNDO IS AN EDIT TOO. The drawing on screen no longer matches the
    // file — going back to where you started is only free if you never
    // saved the trip out.
    markDirty();
    // AND THE RAILS ARE PART OF THE DRAWING ON SCREEN. Until the CUT tool
    // there was no undoable thing with a row of its own — a wall, a column
    // and a beam all live on the canvas, so paint() alone put the page
    // back. A section has a row in SECTIONS, and undo without this line
    // took the cut out of the record and left its row sitting there: press
    // it and the page looks for a cut that is gone. The rebuild is the same
    // one every commit already runs, and it is a no-op for the kinds that
    // touch nothing but the canvas.
    buildChrome();
    paint();
    return true;
  };
  window.addEventListener('resize', resize);

  // ── AND A RAIL THAT CHANGES SHAPE IS A STALE DRAWING ──────────────────────
  //
  // The elevation painter is handed the furniture's MEASURED boxes
  // (furnitureMargins, above), so what it draws is only right for the
  // furniture that was on screen when it ran. Boot is where that bites: the
  // first paint happens before the shell has laid the rails out, so it
  // measured nothing and
  // `?view=cut:E4&left=1&right=1` opened on an elevation drawn at full width
  // with both panels sitting on it. Measured at 1366px: building 128..1277,
  // under a left rail ending at 221 and a right one starting at 1040. Toggling
  // a rail repainted it at 251..1009 -- clear of both -- which is what said the
  // arithmetic was right and only its timing was wrong.
  //
  // AN OBSERVER RATHER THAN ONE MORE paint() AFTER BOOT, because the widths
  // move for more reasons than opening and closing: the right rail is
  // shrink-to-fit under its 277px bound, so switching panes inside it resizes
  // it with nothing toggled at all. The rule this states is the general one --
  // when the furniture over the canvas changes shape, what was painted under
  // it is out of date.
  if (window.ResizeObserver) {
    // AGAINST THE PAINT, NOT AGAINST THE LAST FIRE. An observer fires once per
    // element the moment it is attached, so a version of this that skipped its
    // own first callback was betting that the rails are not laid out yet when
    // it runs -- and if that bet ever lost, it would swallow the one fire that
    // fixes the boot paint and bring the whole defect back. Comparing against
    // what the drawing on screen was PAINTED for needs no such bet: a fire
    // that agrees with it repaints nothing whenever it happens, and one that
    // disagrees repaints however early it comes.
    const railsChanged = new ResizeObserver(() => {
      // Only a cut view reads the rails; a plan is painted the same at any
      // rail width, so this has nothing to say about it.
      if (!drawing || !activeCut()) return;
      if (railKey(furnitureMargins()) === paintedForRails) return;
      paint();
    });
    // AND THE FOOT BAR WITH THEM. It is the same claim on the canvas and the
    // same staleness: the bar is laid out after the first paint too, and its
    // height moves with `env(safe-area-inset-bottom)` -- which is zero on a
    // desktop and not on the iPad this page is drawn on.
    ['#left-rail', '#right-rail', '#house-strip'].forEach(sel => {
      const rail = document.querySelector(sel);
      if (rail) railsChanged.observe(rail);
    });
  }

